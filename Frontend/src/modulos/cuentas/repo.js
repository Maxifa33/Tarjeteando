import { supabase } from '../supabase.js';
import { claveCuenta } from './huella.js';
import { normalizar } from './util.js';

/** Acceso a Supabase de los módulos de cuentas (Platita, Billetera). RLS filtra por usuario. */

const chk = ({ data, error }) => { if (error) throw error; return data; };

export async function cargarContexto() {
  const [cuentas, bolsillos, categorias, importaciones, reglas] = await Promise.all([
    supabase.from('cuentas').select('id, nombre, tipo, institucion, numero, moneda, titular_nombre, titular_cuit').then(chk),
    supabase.from('bolsillos').select('id, cuenta_id, nombre, tipo').then(chk),
    supabase.from('categorias').select('id, nombre, tipo, user_id').then(chk),
    supabase.from('importaciones').select('hash_archivo').then(chk),
    supabase.from('reglas_contraparte').select('contraparte, direccion, tipo, categoria_id').then(chk)
  ]);
  const huellas = new Set();
  // Paginado: Supabase devuelve hasta 1000 filas por pedido.
  for (let desde = 0; ; desde += 1000) {
    const filas = await supabase.from('movimientos').select('huella').range(desde, desde + 999).then(chk);
    filas.forEach((f) => huellas.add(f.huella));
    if (filas.length < 1000) break;
  }
  const porId = Object.fromEntries(cuentas.map((c) => [c.id, c]));
  return {
    cuentas, bolsillos, categorias, reglas,
    titulares: cuentas.filter((c) => c.titular_nombre || c.titular_cuit).map((c) => ({ nombre: c.titular_nombre, cuit: c.titular_cuit })),
    huellasExistentes: huellas,
    hashesImportados: new Set(importaciones.map((i) => i.hash_archivo)),
    bolsillosExistentes: new Set(bolsillos.map((b) => `${porId[b.cuenta_id]?.institucion}|${b.nombre}`))
  };
}

async function asegurarCuenta(cuenta, titular, ctx) {
  const existe = ctx.cuentas.find((c) => claveCuenta(c) === claveCuenta(cuenta));
  if (existe) {
    if (titular && !existe.titular_nombre) {
      await supabase.from('cuentas').update({ titular_nombre: titular.nombre, titular_cuit: titular.cuit }).eq('id', existe.id).then(chk);
    }
    return existe.id;
  }
  const fila = await supabase.from('cuentas').insert({
    nombre: cuenta.nombre, tipo: cuenta.tipo, institucion: cuenta.institucion, numero: cuenta.numero, moneda: cuenta.moneda,
    titular_nombre: titular?.nombre || null, titular_cuit: titular?.cuit || null
  }).select('id, nombre, tipo, institucion, numero, moneda, titular_nombre, titular_cuit').single().then(chk);
  ctx.cuentas.push(fila);
  return fila.id;
}

async function asegurarBolsillos(cuentaId, nombres, tiposElegidos, ctx) {
  const ids = {};
  for (const nombre of nombres) {
    const ya = ctx.bolsillos.find((b) => b.cuenta_id === cuentaId && b.nombre === nombre);
    if (ya) { ids[nombre] = ya.id; continue; }
    const fila = await supabase.from('bolsillos').insert({ cuenta_id: cuentaId, nombre, tipo: tiposElegidos[nombre] || 'apartado' })
      .select('id, cuenta_id, nombre, tipo').single().then(chk);
    ctx.bolsillos.push(fila);
    ids[nombre] = fila.id;
  }
  return ids;
}

/**
 * Guarda un archivo del plan: cuenta, bolsillos, registro de importación y movimientos.
 * Los movimientos van con upsert ignorando duplicados por (user_id, huella): reimportar nunca duplica.
 */
export async function guardarArchivo(archivo, { tiposBolsillo = {}, titular = null }, ctx) {
  const r = archivo.resultado;
  const cuentaId = await asegurarCuenta(r.cuenta, r.titular || titular, ctx);
  const nombresBolsillo = [...new Set(archivo.nuevos.filter((m) => m.bolsillo).map((m) => m.bolsillo))];
  const bolsilloIds = await asegurarBolsillos(cuentaId, nombresBolsillo, tiposBolsillo, ctx);

  // Upsert por hash: si una importación anterior del mismo archivo quedó a medias, se reutiliza su registro
  // y las huellas deciden qué falta cargar (nunca se bloquea el reintento).
  const imp = await supabase.from('importaciones').upsert({
    cuenta_id: cuentaId, origen: r.origen, nombre_archivo: archivo.nombre, hash_archivo: archivo.hash,
    filas_total: r.movimientos.length, filas_nuevas: archivo.nuevos.length, filas_duplicadas: archivo.duplicados
  }, { onConflict: 'user_id,hash_archivo' }).select('id').single().then(chk);

  const catId = (nombre, tipo) => ctx.categorias.find((c) => c.nombre === nombre && c.tipo === tipo)?.id || null;
  const filas = archivo.nuevos.map((m) => ({
    cuenta_id: cuentaId,
    fecha: m.fecha,
    monto: m.monto,
    moneda: r.cuenta.moneda || 'ARS',
    direccion: m.direccion,
    tipo: m.tipo,
    modulo: m.modulo,
    categoria_id: m.categoria_id || (m.categoria ? catId(m.categoria, m.tipo === 'ingreso' ? 'ingreso' : 'gasto') : null),
    descripcion: m.contraparte || m.descripcion,
    descripcion_original: [m.descripcion, ...(m.detalle || [])].join(' · '),
    contraparte: m.contraparte,
    origen: r.origen,
    id_externo: m.id_externo,
    huella: m.huella,
    importacion_id: imp.id,
    estado: m.estado,
    cuenta_en_presupuesto: m.cuenta_en_presupuesto,
    naturaleza: m.naturaleza,
    bolsillo_id: m.bolsillo ? bolsilloIds[m.bolsillo] : null
  }));
  for (let i = 0; i < filas.length; i += 500) {
    await supabase.from('movimientos').upsert(filas.slice(i, i + 500), { onConflict: 'user_id,huella', ignoreDuplicates: true }).then(chk);
  }
  filas.forEach((f) => ctx.huellasExistentes.add(f.huella));
  ctx.hashesImportados.add(archivo.hash);
  return { cuentaId, guardados: filas.length };
}

const SELECT_MOV = 'id, fecha, monto, moneda, direccion, tipo, modulo, estado, descripcion, descripcion_original, contraparte, naturaleza, cuenta_en_presupuesto, categoria_id, bolsillo_id, cuenta_id, origen, vinculo_tarjeta, categorias(nombre), bolsillos(nombre, tipo), cuentas(nombre, institucion)';

export async function movimientosEntre(desde, hasta) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const filas = await supabase.from('movimientos').select(SELECT_MOV)
      .gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).range(i, i + 999).then(chk);
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out.map((m) => ({ ...m, monto: Number(m.monto), categoria: m.categorias?.nombre || null, bolsillo: m.bolsillos || null, cuenta: m.cuentas || null }));
}

export async function mesesConDatos() {
  const filas = await supabase.from('movimientos').select('fecha').order('fecha', { ascending: false }).limit(1).then(chk);
  return filas[0]?.fecha || null;
}

export async function categorias() {
  return supabase.from('categorias').select('id, nombre, tipo').order('nombre').then(chk);
}

export async function actualizarMovimiento(id, cambios) {
  return supabase.from('movimientos').update(cambios).eq('id', id).select('id').single().then(chk);
}

export async function listarBolsillos() {
  return supabase.from('bolsillos').select('id, nombre, tipo, cuenta_id').order('nombre').then(chk);
}

export async function cambiarTipoBolsillo(id, tipo) {
  return supabase.from('bolsillos').update({ tipo }).eq('id', id).then(chk);
}

/** Regla por contraparte: las próximas importaciones de esa persona se clasifican solas. */
export async function guardarRegla({ contraparte, direccion, tipo, categoria_id }) {
  return supabase.from('reglas_contraparte').upsert(
    { contraparte: normalizar(contraparte), direccion, tipo, categoria_id: categoria_id || null },
    { onConflict: 'user_id,contraparte,direccion' }
  ).then(chk);
}

/** Aplica la regla a lo ya importado de esa persona que sigue "a revisar". */
export async function aplicarReglaExistentes({ contraparte, direccion, tipo, categoria_id }) {
  // Se compara normalizado (sin tildes ni mayúsculas), igual que en la importación.
  const clave = normalizar(contraparte);
  const filas = await supabase.from('movimientos').select('id, contraparte').eq('estado', 'revisar').eq('direccion', direccion).then(chk);
  const ids = filas.filter((f) => normalizar(f.contraparte) === clave).map((f) => f.id);
  if (!ids.length) return [];
  return supabase.from('movimientos').update({
    tipo, categoria_id: categoria_id || null, estado: 'confirmado',
    modulo: tipo === 'ingreso' ? 'platita' : 'billetera',
    cuenta_en_presupuesto: tipo !== 'transferencia_interna',
    naturaleza: tipo === 'ingreso' ? 'activo' : null
  }).in('id', ids).select('id').then(chk);
}
