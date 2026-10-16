import { supabase } from '../supabase.js';

/** Acceso a Supabase de Saldar. RLS filtra por usuario. */

const chk = ({ data, error }) => { if (error) throw error; return data; };
const CAMPOS = 'id, nombre, tipo, acreedor, moneda, saldo_inicial, fecha_inicio, cuota_monto, cuotas_restantes, tasa_anual, dia_vencimiento, palabra_clave, estado, notas, created_at';
const MOV = 'id, fecha, monto, moneda, direccion, tipo, estado, descripcion, descripcion_original, contraparte, origen, deuda_id, deudas_descartadas, categoria_id, categoria_previa_id, estado_previo, cuenta_id, categorias!movimientos_categoria_id_fkey(nombre), cuentas(nombre)';
const num = (d) => ({ ...d, saldo_inicial: Number(d.saldo_inicial), cuota_monto: d.cuota_monto == null ? null : Number(d.cuota_monto), tasa_anual: d.tasa_anual == null ? null : Number(d.tasa_anual) });
const plano = (m) => ({ ...m, monto: Number(m.monto), categoria: m.categorias?.nombre || null, cuenta: m.cuentas || null });

export async function listarDeudas() {
  return (await supabase.from('deudas').select(CAMPOS).order('created_at').then(chk)).map(num);
}

export async function crearDeuda(fila) {
  return num(await supabase.from('deudas').insert(fila).select(CAMPOS).single().then(chk));
}

export async function actualizarDeuda(id, cambios) {
  return num(await supabase.from('deudas').update(cambios).eq('id', id).select(CAMPOS).single().then(chk));
}

/**
 * Borra la deuda. Los pagos importados vuelven a su categoría anterior y quedan sin vínculo;
 * los cargados a mano se borran. Si se corta a mitad, volver a borrar termina el trabajo.
 */
export async function borrarDeuda(id) {
  const deudas = await idCategoriaDeudas();
  const vinc = await supabase.from('movimientos').select('id, categoria_id, categoria_previa_id, estado_previo').eq('deuda_id', id).neq('origen', 'manual').then(chk);
  for (const m of vinc.filter((x) => x.estado_previo)) {
    await supabase.from('movimientos').update(restauracion(m, deudas)).eq('id', m.id).then(chk);
  }
  await supabase.from('movimientos').delete().eq('deuda_id', id).eq('origen', 'manual').then(chk);
  return supabase.from('deudas').delete().eq('id', id).then(chk);
}

/** Pagos vinculados a cualquier deuda. */
export async function pagosDeDeudas() {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const filas = await supabase.from('movimientos').select(MOV).not('deuda_id', 'is', null).order('fecha', { ascending: false }).order('id').range(i, i + 999).then(chk);
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out.map(plano);
}

/** Gastos sin vincular desde `desde` (candidatos a pago de deuda). Hasta 2000, los más nuevos. */
export async function candidatos(desde) {
  const out = [];
  for (let i = 0; i < 2000; i += 1000) {
    const filas = await supabase.from('movimientos').select(MOV)
      .is('deuda_id', null).eq('direccion', 'salida').eq('tipo', 'gasto').gte('fecha', desde)
      .order('fecha', { ascending: false }).order('id').range(i, i + 999).then(chk);
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out.map(plano);
}

export async function idCategoriaDeudas() {
  // La propia que reemplaza a la del sistema, si la renombraste; si no, la del sistema.
  const cats = await supabase.from('categorias').select('id, nombre, user_id, reemplaza').eq('tipo', 'gasto').then(chk);
  const base = cats.find((c) => !c.user_id && c.nombre === 'Deudas');
  if (!base) return null;
  return (cats.find((c) => c.user_id && c.reemplaza === base.id) || base).id;
}

/** Lo que Saldar cambió al confirmar, de vuelta. La categoría solo si sigue en Deudas (si la cambiaste después, se respeta). */
function restauracion(m, catDeudas) {
  if (!m.estado_previo) return {};
  return {
    estado: m.estado_previo,
    ...(m.categoria_id === catDeudas ? { categoria_id: m.categoria_previa_id } : {}),
    categoria_previa_id: null, estado_previo: null
  };
}

/**
 * Confirmar: el movimiento es un pago de la deuda. Pasa a Deudas y confirmado; se guarda cómo estaba
 * (vuelve si lo quitás). Primero se vincula (solo si nadie lo vinculó antes) y recién después se borra el
 * pago a mano que era el mismo: si eso falla, los dos quedan a la vista en el detalle para quitar uno.
 * Devuelve false si otra pestaña ya lo había vinculado.
 */
export async function confirmarPago(mov, deudaId, { reemplazaManualId = null } = {}) {
  const categoria_id = await idCategoriaDeudas();
  const filas = await supabase.from('movimientos').update({
    deuda_id: deudaId, estado: 'confirmado', estado_previo: mov.estado || 'confirmado',
    categoria_previa_id: mov.categoria_id || null,
    ...(categoria_id ? { categoria_id } : {})
  }).eq('id', mov.id).is('deuda_id', null).select('id').then(chk);
  if (!filas.length) return false;
  if (reemplazaManualId) {
    const { error } = await supabase.from('movimientos').delete().eq('id', reemplazaManualId).eq('origen', 'manual').eq('deuda_id', deudaId);
    if (error) throw new Error('duplicado');
  }
  return true;
}

/** "No es": no vuelve a sugerirse para esa deuda. */
export async function descartar(mov, deudaId) {
  const lista = [...new Set([...(mov.deudas_descartadas || []), deudaId])];
  return supabase.from('movimientos').update({ deudas_descartadas: lista }).eq('id', mov.id).then(chk);
}

/** Quitar un pago: el importado se desvincula (vuelve como estaba y no se sugiere de nuevo); el cargado a mano se borra. */
export async function quitarPago(mov) {
  if (mov.origen === 'manual') return supabase.from('movimientos').delete().eq('id', mov.id).eq('origen', 'manual').then(chk);
  const deudas = mov.estado_previo ? await idCategoriaDeudas() : null;
  return supabase.from('movimientos').update({
    deuda_id: null,
    deudas_descartadas: [...new Set([...(mov.deudas_descartadas || []), mov.deuda_id])],
    ...restauracion(mov, deudas)
  }).eq('id', mov.id).then(chk);
}

async function cuentaEfectivo(moneda) {
  const buscar = async () => (await supabase.from('cuentas').select('id').eq('institucion', 'efectivo').eq('moneda', moneda).or('numero.is.null,numero.eq.').limit(1).then(chk))[0]?.id;
  const ya = await buscar();
  if (ya) return ya;
  const { data, error } = await supabase.from('cuentas')
    .insert({ nombre: moneda === 'USD' ? 'Efectivo USD' : 'Efectivo', tipo: 'efectivo', institucion: 'efectivo', moneda }).select('id').single();
  if (!error) return data.id;
  if (error.code === '23505') { const otra = await buscar(); if (otra) return otra; } // la creó otra pestaña
  throw error;
}

/** Pago cargado a mano (efectivo o algo que todavía no importaste). Cuenta como gasto en Billetera. */
export async function registrarPagoManual(deuda, { monto, fecha, nota }) {
  const [cuenta_id, categoria_id] = await Promise.all([cuentaEfectivo(deuda.moneda || 'ARS'), idCategoriaDeudas()]);
  const huella = `manual:${crypto.randomUUID()}`;
  return supabase.from('movimientos').insert({
    cuenta_id, fecha, monto, moneda: deuda.moneda || 'ARS', direccion: 'salida', tipo: 'gasto', modulo: 'billetera',
    categoria_id, descripcion: `Pago ${deuda.nombre}`, descripcion_original: nota || 'Cargado a mano en Saldar',
    contraparte: deuda.acreedor || null, origen: 'manual', huella, estado: 'confirmado', cuenta_en_presupuesto: true, deuda_id: deuda.id
  }).select('id').single().then(chk);
}
