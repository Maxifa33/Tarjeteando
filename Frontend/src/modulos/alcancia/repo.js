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
export async function movimientosDeReservas(bolsilloIds) {
  if (!bolsilloIds.length) return [];
  const out = [];
  for (let i = 0; ; i += 1000) {
    const filas = await supabase.from('movimientos').select('id, fecha, monto, direccion, tipo, bolsillo_id')
      .eq('tipo', 'reserva').in('bolsillo_id', bolsilloIds).order('fecha').order('id').range(i, i + 999).then(chk);
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out.map((m) => ({ ...m, monto: Number(m.monto) }));
}

const INV = 'id, tipo, nombre, simbolo, cantidad, moneda, capital, fecha_inicio, tna, plazo_dias, valor_manual, estado, notas, created_at';
const numInv = (i) => ({ ...i, cantidad: n(i.cantidad), capital: n(i.capital), tna: n(i.tna), valor_manual: n(i.valor_manual) });
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
