import { supabase } from '../supabase.js';
import { claveCuenta } from './huella.js';
import { normalizar } from './util.js';
import { resolverCategoria } from './categorias.js';

/** Acceso a Supabase de los módulos de cuentas (Platita, Billetera). RLS filtra por usuario. */

const chk = ({ data, error }) => { if (error) throw error; return data; };

export async function cargarContexto() {
  const [cuentas, bolsillos, categorias, importaciones, reglas] = await Promise.all([
    supabase.from('cuentas').select('id, nombre, tipo, institucion, numero, moneda, titular_nombre, titular_cuit').then(chk),
    supabase.from('bolsillos').select('id, cuenta_id, nombre, tipo, origen').then(chk),
    supabase.from('categorias').select('id, nombre, tipo, user_id, reemplaza').then(chk),
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
    bolsillosExistentes: new Set(bolsillos.flatMap((b) => [`${porId[b.cuenta_id]?.institucion}|${b.nombre}`, `${porId[b.cuenta_id]?.institucion}|${String(b.nombre).replace(/ \(MP\)$/, '')}`]))
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
    const ya = ctx.bolsillos.find((b) => b.cuenta_id === cuentaId && (b.nombre === nombre || b.nombre === `${nombre} (MP)`));
    if (ya) { ids[nombre] = ya.id; continue; }
    // Si ya tenés una reserva manual con ese nombre, la de Mercado Pago entra como "<nombre> (MP)" para no mezclarlas.
    const chocaConManual = ctx.bolsillos.some((b) => b.origen === 'manual' && String(b.nombre).trim().toLowerCase() === nombre.trim().toLowerCase());
    const fila = await supabase.from('bolsillos').insert({ cuenta_id: cuentaId, nombre: chocaConManual ? `${nombre} (MP)` : nombre, tipo: tiposElegidos[nombre] || 'apartado' })
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

  const catId = (nombre, tipo) => resolverCategoria(nombre, tipo, ctx.categorias);
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

const SELECT_MOV = 'id, fecha, monto, moneda, direccion, tipo, modulo, estado, descripcion, descripcion_original, contraparte, naturaleza, cuenta_en_presupuesto, categoria_id, bolsillo_id, cuenta_id, origen, vinculo_tarjeta, recupero_pago, compartido_pendiente, deuda_id, categorias!movimientos_categoria_id_fkey(nombre), bolsillos(nombre, tipo, moneda, origen), cuentas(nombre, institucion)';

export async function movimientosEntre(desde, hasta) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const filas = await supabase.from('movimientos').select(SELECT_MOV)
      .gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).order('id').range(i, i + 999).then(chk);
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
  return supabase.from('categorias').select('id, nombre, tipo, icono, user_id, reemplaza').order('nombre').then(chk);
}

/** Nueva categoría propia. */
export async function crearCategoria(nombre, tipo) {
  return supabase.from('categorias').insert({ nombre: nombre.trim(), tipo, user_id: (await supabase.auth.getUser()).data.user.id })
    .select('id').single().then(chk);
}

/**
 * Renombrar. Una propia se renombra directo. Una del sistema no se puede tocar (es de todos):
 * se crea una propia que la reemplaza y se le pasan tus movimientos y reglas.
 */
export async function renombrarCategoria(cat, nombre) {
  // En una sola transacción (función economics_renombrar_categoria): o se hace todo o nada.
  return supabase.rpc('economics_renombrar_categoria', { p_cat: cat.id, p_nombre: nombre.trim() }).then(chk);
}

/** Borrar una propia: sus movimientos quedan "Sin categoría". Si reemplazaba una del sistema, esa vuelve. */
export async function borrarCategoria(cat) {
  if (!cat.user_id) throw new Error('Las categorías base no se borran; podés renombrarlas.');
  if (cat.reemplaza) {
    await supabase.from('movimientos').update({ categoria_id: cat.reemplaza }).eq('categoria_id', cat.id).then(chk);
    await supabase.from('reglas_contraparte').update({ categoria_id: cat.reemplaza }).eq('categoria_id', cat.id).then(chk);
  }
  return supabase.from('categorias').delete().eq('id', cat.id).then(chk);
}

/** Archivos importados, del más nuevo al más viejo. */
export async function listarImportaciones() {
  const base = 'id, nombre_archivo, origen, filas_nuevas, filas_total, created_at, cuentas(nombre)';
  let filas;
  try {
    filas = await supabase.from('importaciones').select(`${base}, movimientos(count)`).order('created_at', { ascending: false }).then(chk);
  } catch {
    // Si el conteo embebido no está habilitado, se muestra lo que se cargó en esa importación.
    filas = await supabase.from('importaciones').select(base).order('created_at', { ascending: false }).then(chk);
  }
  return filas.map((f) => ({ ...f, cuenta: f.cuentas?.nombre || '', cantidad: f.movimientos?.[0]?.count ?? f.filas_nuevas }));
}

/**
 * Antes de borrar movimientos importados, los que estaban vinculados a una reserva manual pasan a ser depósitos/retiros manuales
 * de esa reserva: así su saldo no cambia. Insertar primero y desvincular después evita perderlos si se corta a mitad
 * (como mucho, un reintento los duplica una vez: el saldo real se corrige desde el detalle de la reserva).
 */
async function conservarVinculados(filtro) {
  const filas = await filtro(supabase.from('movimientos').select('id, fecha, monto, direccion, bolsillo_id, descripcion, descripcion_original').not('previo_reserva', 'is', null)).then(chk);
  if (!filas.length) return;
  await supabase.from('reserva_movs').insert(filas.map((m) => ({
    bolsillo_id: m.bolsillo_id, fecha: m.fecha, monto: Number(m.monto), sentido: m.direccion === 'salida' ? 'deposito' : 'retiro',
    nota: `Era un movimiento importado: ${m.descripcion || m.descripcion_original || 'sin detalle'}`.slice(0, 120)
  }))).then(chk);
  for (const m of filas) await supabase.rpc('economics_desvincular_reserva', { p_mov: m.id }).then(chk);
}

/** Borra un archivo importado y todos sus movimientos (incluidos los cambios que les hiciste). */
export async function borrarImportacion(id) {
  await conservarVinculados((q) => q.eq('importacion_id', id));
  await supabase.from('movimientos').delete().eq('importacion_id', id).then(chk);
  return supabase.from('importaciones').delete().eq('id', id).then(chk);
}

/**
 * Empezar de cero: borra movimientos, archivos, reservas de Mercado Pago y cuentas.
 * Las reservas manuales NO se borran: no salen de ningún archivo y no se pueden reimportar.
 * Pasos idempotentes y en orden de dependencias: si se corta a mitad, volver a tocar termina el trabajo.
 * Con `todo`, también tus categorías propias y reglas por persona. No toca Tarjeteando.
 */
export async function borrarTodo({ todo = false } = {}) {
  const todos = (q) => q.not('id', 'is', null);
  await conservarVinculados((q) => q);
  await todos(supabase.from('movimientos').delete()).then(chk);
  await todos(supabase.from('importaciones').delete()).then(chk);
  await todos(supabase.from('bolsillos').delete()).eq('origen', 'importada').then(chk);
  await todos(supabase.from('cuentas').delete()).then(chk);
  if (todo) {
    await todos(supabase.from('reglas_contraparte').delete()).then(chk);
    await supabase.from('categorias').delete().not('user_id', 'is', null).then(chk);
  }
}

export async function actualizarMovimiento(id, cambios) {
  return supabase.from('movimientos').update(cambios).eq('id', id).select('id').single().then(chk);
}

export async function listarBolsillos() {
  return supabase.from('bolsillos').select('id, nombre, tipo, cuenta_id, origen, moneda, medio, archivada, cotizacion_ars, cotizacion_fecha, notas').order('nombre').then(chk);
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
