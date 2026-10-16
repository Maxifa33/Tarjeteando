import { supabase } from '../supabase.js';

/** Acceso a Supabase de Alcancía. RLS filtra por usuario; precios y tasas son compartidos (solo lectura). */

const chk = ({ data, error }) => { if (error) throw error; return data; };
const n = (v) => (v == null ? null : Number(v));

const META = 'id, nombre, objetivo, moneda, fecha_objetivo, bolsillo_id, saldo_inicial, estado, notas, created_at';
const numMeta = (m) => ({ ...m, objetivo: n(m.objetivo), saldo_inicial: n(m.saldo_inicial) || 0 });
export const listarMetas = async () => (await supabase.from('metas').select(META).order('created_at').then(chk)).map(numMeta);
export const crearMeta = async (fila) => numMeta(await supabase.from('metas').insert(fila).select(META).single().then(chk));
export const actualizarMeta = async (id, cambios) => numMeta(await supabase.from('metas').update(cambios).eq('id', id).select(META).single().then(chk));
/** Borra la meta y sus aportes a mano. La reserva de Mercado Pago no se toca. */
export const borrarMeta = (id) => supabase.from('metas').delete().eq('id', id).then(chk);

export const listarAportes = async () => (await supabase.from('meta_aportes').select('id, meta_id, fecha, monto, nota').order('fecha', { ascending: false }).order('id').then(chk))
  .map((a) => ({ ...a, monto: Number(a.monto) }));
export const crearAporte = (fila) => supabase.from('meta_aportes').insert(fila).select('id').single().then(chk);
export const borrarAporte = (id) => supabase.from('meta_aportes').delete().eq('id', id).then(chk);

/** Todos los movimientos de las reservas vinculadas (desde siempre: el saldo de una reserva es acumulado). */
export async function movimientosDeReservas(bolsilloIds, { todas = false } = {}) {
  if (!todas && !bolsilloIds?.length) return [];
  const out = [];
  for (let i = 0; ; i += 1000) {
    let q = supabase.from('movimientos').select('id, fecha, monto, direccion, tipo, bolsillo_id, previo_reserva, created_at').eq('tipo', 'reserva');
    if (!todas) q = q.in('bolsillo_id', bolsilloIds); // { todas: true }: todas las reservas
    const filas = await q.order('fecha').order('id').range(i, i + 999).then(chk);
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out.map((m) => ({ ...m, monto: Number(m.monto) }));
}

const INV = 'id, tipo, nombre, simbolo, cantidad, moneda, capital, fecha_inicio, tna, plazo_dias, valor_manual, estado, notas, created_at, subtipo, aseguradora, suma_asegurada, valor_rescate, aporte_monto, aporte_frecuencia, valor_fecha, cotizacion_aportes';
const numInv = (i) => ({ ...i, cantidad: n(i.cantidad), capital: n(i.capital), tna: n(i.tna), valor_manual: n(i.valor_manual), suma_asegurada: n(i.suma_asegurada), valor_rescate: n(i.valor_rescate), aporte_monto: n(i.aporte_monto) });
/** Serie de inflación mensual del INDEC: Map 'YYYY-MM' → variación %. */
export async function serieInflacion() {
  const f = await supabase.from('inflacion_mensual').select('periodo, variacion').order('periodo').then(chk);
  return new Map((f || []).filter((x) => x.variacion != null && Number.isFinite(Number(x.variacion))).map((x) => [String(x.periodo).slice(0, 7), Number(x.variacion)]));
}
/** Vínculos de inversiones con cobros recurrentes (tarjeta o cuenta). */
export const listarVinculos = async () => (await supabase.from('inversion_vinculos').select('id, inversion_id, origen, clave, ref, etiqueta, created_at').order('created_at').then(chk)) || [];
export const crearVinculo = (fila) => supabase.from('inversion_vinculos').insert(fila).select('id').single().then(chk);
export const borrarVinculo = (id) => supabase.from('inversion_vinculos').delete().eq('id', id).then(chk);

/** Gastos de cuenta (columnas mínimas) desde `desde`, para asociar cobros recurrentes. */
export async function movimientosParaCobros(desde) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const filas = await supabase.from('movimientos').select('id, fecha, monto, moneda, tipo, direccion, estado, descripcion, descripcion_original, contraparte, cuenta_id, cuentas(nombre)')
      .eq('tipo', 'gasto').eq('direccion', 'salida').gte('fecha', desde).order('fecha').order('id').range(i, i + 999).then(chk);
    out.push(...filas.map((m) => ({ ...m, monto: Number(m.monto) })));
    if (filas.length < 1000) break;
  }
  return out;
}

/** Historial del dólar oficial y MEP desde `desde` (para pasar cobros en pesos a dólares). { oficial: [{fecha, venta}], bolsa: [...] } */
export async function historicoDolar(desde) {
  const out = { oficial: [], bolsa: [] };
  for (const casa of ['oficial', 'bolsa']) {
    for (let i = 0; ; i += 1000) {
      const filas = await supabase.from('cotizaciones_historicas').select('fecha, venta').eq('casa', casa).gte('fecha', desde).order('fecha').range(i, i + 999).then(chk);
      out[casa].push(...filas.map((f) => ({ fecha: f.fecha, venta: Number(f.venta) })));
      if (filas.length < 1000) break;
    }
  }
  return out;
}
export const listarInversiones = async () => (await supabase.from('inversiones').select(INV).order('created_at').then(chk)).map(numInv);
export const crearInversion = async (fila) => numInv(await supabase.from('inversiones').insert(fila).select(INV).single().then(chk));
export const actualizarInversion = async (id, cambios) => numInv(await supabase.from('inversiones').update(cambios).eq('id', id).select(INV).single().then(chk));
export const borrarInversion = (id) => supabase.from('inversiones').delete().eq('id', id).then(chk);

const PRECIO = 'tipo, simbolo, precio, compra, venta, moneda, variacion, fecha';
const numP = (p) => ({ ...p, precio: Number(p.precio), compra: n(p.compra), venta: n(p.venta), variacion: n(p.variacion) });

/** Precios de lo que tenés + todos los dólares. Devuelve Map 'tipo|simbolo' → fila. */
export async function preciosPara(invs) {
  const porTipo = new Map();
  invs.filter((i) => i.simbolo && i.tipo !== 'dolar').forEach((i) => { if (!porTipo.has(i.tipo)) porTipo.set(i.tipo, new Set()); porTipo.get(i.tipo).add(i.simbolo); });
  const pedidos = [supabase.from('precios').select(PRECIO).eq('tipo', 'dolar').then(chk)];
  porTipo.forEach((simbolos, tipo) => pedidos.push(supabase.from('precios').select(PRECIO).eq('tipo', tipo).in('simbolo', [...simbolos]).then(chk)));
  const filas = (await Promise.all(pedidos)).flat().map(numP);
  return new Map(filas.map((p) => [`${p.tipo}|${p.simbolo}`, p]));
}

/** Buscar ticker o fondo para el alta. */
export async function buscarPrecios(tipo, q) {
  const t = String(q || '').trim().replace(/[%_,()]/g, '');
  if (!t) return [];
  const patron = tipo === 'fci' ? `%${t}%` : `${t.toUpperCase()}%`;
  const filas = await supabase.from('precios').select(PRECIO).eq('tipo', tipo).ilike('simbolo', patron).order('simbolo').limit(20).then(chk);
  return filas.map(numP);
}

export const tasasPlazoFijo = async () => (await supabase.from('tasas_plazo_fijo').select('entidad, tna, fecha').order('tna', { ascending: false }).limit(5).then(chk))
  .map((t) => ({ ...t, tna: Number(t.tna) }));

/** Saldos reales de las reservas (los extractos no los traen). Ver alcancia/reservas.js. */
export const listarAjustes = async () => (await supabase.from('reserva_ajustes').select('id, bolsillo_id, fecha, saldo_real, nota, created_at').order('fecha').then(chk))
  .map((a) => ({ ...a, saldo_real: Number(a.saldo_real) }));
export const guardarAjuste = (fila) => supabase.from('reserva_ajustes').upsert(fila, { onConflict: 'bolsillo_id,fecha' }).select('id').single().then(chk);
export const borrarAjuste = (id) => supabase.from('reserva_ajustes').delete().eq('id', id).then(chk);

/* ---------- Reservas manuales (las que no salen de ningún extracto) ---------- */

/** Crea la reserva y, si ya tenés plata, su primer saldo real de hoy. Si el saldo falla, deshace la reserva. */
export async function crearReserva(fila, saldo, hoy) {
  const b = await supabase.from('bolsillos').insert({ ...fila, origen: 'manual' }).select('id').single().then(chk);
  if (saldo != null) {
    try { await supabase.from('reserva_ajustes').insert({ bolsillo_id: b.id, fecha: hoy, saldo_real: saldo, nota: 'Saldo inicial' }).then(chk); }
    catch (e) { await supabase.from('bolsillos').delete().eq('id', b.id); throw e; }
  }
  return b;
}
export const actualizarReserva = (id, cambios) => supabase.from('bolsillos').update(cambios).eq('id', id).eq('origen', 'manual').select('id').single().then(chk);
export const archivarReserva = (id, archivada) => actualizarReserva(id, { archivada });

/** Borra una reserva manual: primero devuelve los movimientos importados que tenía vinculados (vuelven a ser lo que eran). */
export async function borrarReserva(id) {
  // Una meta vinculada perdería su saldo en silencio: primero hay que desvincularla.
  const metas = await supabase.from('metas').select('nombre').eq('bolsillo_id', id).then(chk);
  if (metas.length) throw Object.assign(new Error('vinculada a una meta'), { codigo: 'meta', metas: metas.map((m) => m.nombre) });
  const vinculados = await supabase.from('movimientos').select('id').eq('bolsillo_id', id).not('previo_reserva', 'is', null).then(chk);
  for (const m of vinculados) await desvincularMovimiento(m.id);
  return supabase.from('bolsillos').delete().eq('id', id).eq('origen', 'manual').then(chk);
}

export const listarMovsManuales = async () => (await supabase.from('reserva_movs').select('id, bolsillo_id, fecha, monto, sentido, nota, created_at').order('fecha').then(chk))
  .map((m) => ({ ...m, monto: Number(m.monto) }));
export const crearMovReserva = (fila) => supabase.from('reserva_movs').insert(fila).select('id').single().then(chk);
export const borrarMovReserva = (id) => supabase.from('reserva_movs').delete().eq('id', id).then(chk);

/** Vincula un movimiento importado a una reserva manual (deja de ser gasto/ingreso). Ver RPC economics_vincular_reserva. */
export const vincularMovimiento = (movId, bolsilloId) => supabase.rpc('economics_vincular_reserva', { p_mov: movId, p_bolsillo: bolsilloId }).then(chk);
export const desvincularMovimiento = (movId) => supabase.rpc('economics_desvincular_reserva', { p_mov: movId }).then(chk);

/** Movimientos importados que se pueden vincular: misma moneda, sin reserva ni deuda, últimos 90 días. */
export async function candidatosVincular(moneda, hoy) {
  const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() - 90);
  const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const filas = await supabase.from('movimientos').select('id, fecha, monto, direccion, tipo, descripcion, contraparte, descripcion_original')
    .in('tipo', ['gasto', 'ingreso', 'transferencia_interna']).is('bolsillo_id', null).is('deuda_id', null).eq('moneda', moneda).gte('fecha', desde)
    .order('fecha', { ascending: false }).order('id').limit(80).then(chk);
  return filas.map((m) => ({ ...m, monto: Number(m.monto) }));
}
