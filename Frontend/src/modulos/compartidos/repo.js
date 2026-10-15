import { supabase } from '../supabase.js';

/** Acceso a Supabase de Compartidos. RLS filtra por usuario. */

const chk = ({ data, error }) => { if (error) throw error; return data; };
const num = (k) => (x) => ({ ...x, [k]: Number(x[k]) });
const GRUPO = 'id, nombre, tipo, moneda, archivado, token_publico, created_at';
const PART = 'id, grupo_id, nombre, es_yo, orden, created_at';
const GASTO = 'id, grupo_id, descripcion, fecha, monto, pagado_por, division, partes, movimiento_id, tarjeta, created_at';
const PAGO = 'id, grupo_id, de, a, monto, fecha, movimiento_id, previo, nota, created_at';

export async function cargarTodo() {
  const [grupos, participantes, gastos, pagos] = await Promise.all([
    supabase.from('grupos').select(GRUPO).order('created_at').then(chk),
    supabase.from('participantes').select(PART).order('orden').order('created_at').then(chk),
    supabase.from('gastos_compartidos').select(GASTO).order('fecha', { ascending: false }).order('created_at', { ascending: false }).then(chk),
    supabase.from('pagos_compartidos').select(PAGO).order('fecha', { ascending: false }).order('created_at', { ascending: false }).then(chk)
  ]);
  return {
    grupos, participantes,
    gastos: gastos.map(num('monto')).map((g) => ({ ...g, partes: (g.partes || []).map((x) => ({ ...x, monto: Number(x.monto) })) })),
    pagos: pagos.map(num('monto'))
  };
}

/** Crea el grupo con vos y las personas que pongas, en una sola transacción. Un "1 a 1" es un grupo de tipo persona. */
export async function crearGrupo({ nombre, tipo, moneda }, nombres) {
  const id = await supabase.rpc('economics_crear_grupo', { p_nombre: nombre, p_tipo: tipo, p_moneda: moneda, p_nombres: nombres.map((n) => n.trim()) }).then(chk);
  return { id };
}
export const actualizarGrupo = (id, cambios) => supabase.from('grupos').update(cambios).eq('id', id).then(chk);

/** Link de solo lectura: se crea uno nuevo (el anterior deja de andar) o se apaga con null. */
export const cambiarLink = (id, activo) => supabase.from('grupos').update({ token_publico: activo ? crypto.randomUUID() : null }).eq('id', id).select('token_publico').single().then(chk);

/** Borra el grupo. Un trigger en la base devuelve a su estado los movimientos que se habían marcado como pagos (también en cascada). */
export const borrarGrupo = (id) => supabase.from('grupos').delete().eq('id', id).then(chk);

export const agregarParticipante = (grupoId, nombre, orden) => supabase.from('participantes').insert({ grupo_id: grupoId, nombre: nombre.trim(), orden }).then(chk);
export const renombrarParticipante = (id, nombre) => supabase.from('participantes').update({ nombre: nombre.trim() }).eq('id', id).then(chk);
/** Solo si no figura en ningún gasto ni pago (la base impide quitar a quien pagó; las partes las controla la app). */
export const quitarParticipante = (id) => supabase.from('participantes').delete().eq('id', id).then(chk);

export const crearGasto = (fila) => supabase.from('gastos_compartidos').insert(fila).select('id').single().then(chk);
export const actualizarGasto = (id, fila) => supabase.from('gastos_compartidos').update(fila).eq('id', id).then(chk);
export const borrarGasto = (id) => supabase.from('gastos_compartidos').delete().eq('id', id).then(chk);

export const registrarPago = (fila) => supabase.from('pagos_compartidos').insert(fila).select('id').single().then(chk);
/** Borra un pago; si vino de una transferencia, el trigger de la base la devuelve a como estaba. */
export const borrarPago = (pago) => supabase.from('pagos_compartidos').delete().eq('id', pago.id).then(chk);

/**
 * Confirmar que una transferencia es un pago del compartido (función en la base, todo o nada).
 * Entrada (te pagan): pasa a Recupero; si lo del grupo salió de tu tarjeta, queda vinculado a esa compra.
 * Salida (pagás vos): queda gasto, confirmado. Devuelve false si ya estaba vinculada.
 */
export const confirmarPagoDeMovimiento = (s) => supabase.rpc('economics_confirmar_pago_compartido', { p_mov: s.mov.id, p_grupo: s.grupo.id, p_de: s.de, p_a: s.a }).then(chk);

/** Recuperos que marcaste "es de un gasto compartido" y todavía no asignaste a un grupo. */
export const recuperosPendientes = () => paginar(() => supabase.from('movimientos').select(MOV)
  .eq('compartido_pendiente', true).eq('tipo', 'recupero').order('fecha', { ascending: false }).order('id'));

/** Asignar un recupero pendiente a un grupo: queda como pago de esa persona a vos (función en la base, todo o nada). */
export const asignarRecupero = (movId, grupoId, deId) => supabase.rpc('economics_asignar_recupero_compartido', { p_mov: movId, p_grupo: grupoId, p_de: deId }).then(chk);

/** Sacarlo de la lista sin asignarlo (no era de un compartido). */
export const quitarDePendientes = (id) => supabase.from('movimientos').update({ compartido_pendiente: false }).eq('id', id).then(chk);

export const descartarMovimiento = (id) => supabase.from('movimientos').update({ compartido_descartado: true }).eq('id', id).then(chk);

const MOV = 'id, fecha, monto, moneda, direccion, tipo, estado, descripcion, contraparte, categoria_id, vinculo_tarjeta, deuda_id, compartido_descartado, cuentas(nombre)';
async function paginar(q) {
  const out = [];
  for (let i = 0; i < 3000; i += 1000) {
    const filas = await q().range(i, i + 999).then(chk);
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out.map((m) => ({ ...m, monto: Number(m.monto), cuenta: m.cuentas || null }));
}

/** Transferencias con personas desde `desde` (candidatas a pago de un compartido). */
export const transferenciasDesde = (desde) => paginar(() => supabase.from('movimientos').select(MOV)
  .not('contraparte', 'is', null).eq('compartido_descartado', false).in('tipo', ['ingreso', 'gasto']).neq('moneda', 'USD').gte('fecha', desde)
  .order('fecha', { ascending: false }).order('id'));

/** Tus gastos sin tarjeta recientes, para cargar un compartido desde un movimiento. */
export const gastosRecientes = (desde) => paginar(() => supabase.from('movimientos').select(MOV)
  .eq('direccion', 'salida').eq('tipo', 'gasto').neq('moneda', 'USD').gte('fecha', desde).order('fecha', { ascending: false }).order('id'));

/** Vista pública por link (sin sesión). */
export const grupoPublico = (token) => supabase.rpc('economics_grupo_publico', { p_token: token }).then(chk);
