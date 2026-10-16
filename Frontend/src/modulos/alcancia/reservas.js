import { r2, parseMonto } from '../cuentas/util.js';

/**
 * Reservas (de Mercado Pago o manuales, en cualquier moneda): saldo, historial y balance corrido (lógica pura).
 * Los extractos solo traen "reservado" y "retirado", no el saldo ni el rendimiento (que sale dentro del retiro).
 * Por eso el saldo se ancla a un saldo real cargado por el usuario (`reserva_ajustes`) y se corre con los
 * movimientos posteriores. Una reserva nunca baja de 0: si retirás más de lo que había, la diferencia es rendimiento.
 */

const delta = (m) => (m.direccion === 'salida' ? 1 : -1) * Number(m.monto);
const valido = (m) => Number.isFinite(Number(m.monto)) && (m.direccion === 'salida' || m.direccion === 'entrada');
const orden = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.id).localeCompare(String(b.id)));
// Mismo día: primero lo que entra a la reserva, después lo que sale, al final el saldo real. Así el clamp en 0 no depende del id.
const rango = (e) => (e.k === 'ajuste' ? 2 : delta(e.m) > 0 ? 0 : 1);
const creado = (e) => (e.k === 'ajuste' ? e.a.created_at : e.m.created_at) || '';
const difDias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

export const MONEDAS = ['ARS', 'USD', 'EUR'];
export const MEDIOS = [{ id: 'digital', label: 'Digital' }, { id: 'efectivo', label: 'Efectivo' }, { id: 'otro', label: 'Otro' }];

/** Movimientos manuales (reserva_movs) con la misma forma que los importados: depósito = sale de tu bolsillo hacia la reserva. */
export const movsManuales = (rows = []) => rows.map((r) => ({
  id: r.id, fecha: r.fecha, monto: Number(r.monto), tipo: 'reserva', bolsillo_id: r.bolsillo_id,
  direccion: r.sentido === 'deposito' ? 'salida' : 'entrada', manual: true, nota: r.nota || null, created_at: r.created_at || null
}));

/** Pesos de un saldo: ARS directo, USD con el MEP, otras con la cotización manual de la reserva. null si falta el dato. */
export function aPesos(saldo, moneda, { mep = null, cotizacion = null } = {}) {
  if (moneda === 'ARS') return r2(saldo);
  if (moneda === 'USD') return mep > 0 ? r2(saldo * mep) : null;
  return cotizacion > 0 ? r2(saldo * cotizacion) : null;
}

/**
 * Estado de una reserva.
 * filas: cronológico, con saldo corrido. Un ajuste en la misma fecha que un movimiento va DESPUÉS de él
 * (el saldo real de ese día ya lo incluye).
 * `movs` mezcla importados y manuales (ver movsManuales); los importados vinculados traen `previo_reserva`.
 */
export function estadoReserva(bolsillo, movs = [], ajustes = [], hoy = null, { mep = null } = {}) {
  const mios = movs.filter((m) => m.tipo === 'reserva' && m.bolsillo_id === bolsillo.id && valido(m)).sort(orden);
  const ajs = ajustes.filter((a) => a.bolsillo_id === bolsillo.id).sort(orden);
  const manual = bolsillo.origen === 'manual';
  const eventos = [
    ...mios.map((m) => ({ k: 'mov', fecha: m.fecha, id: m.id, m })),
    ...ajs.map((a) => ({ k: 'ajuste', fecha: a.fecha, id: a.id, a }))
  ].sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1
    // Reserva manual: el mismo día manda el orden en que cargaste las cosas. Importada: el saldo real del día ya incluye sus movimientos.
    : (manual ? String(creado(x)).localeCompare(String(creado(y))) : rango(x) - rango(y)) || String(x.id).localeCompare(String(y.id))));

  let saldo = 0;
  let aportado = 0;
  let retirado = 0;
  const filas = [];
  eventos.forEach((e) => {
    if (e.k === 'mov') {
      const d = delta(e.m);
      if (d > 0) aportado = r2(aportado + d); else retirado = r2(retirado - d);
      saldo = r2(Math.max(0, saldo + d));
      filas.push({ tipo: 'mov', id: e.id, fecha: e.fecha, monto: r2(d), saldo, manual: !!e.m.manual, vinculado: !!e.m.previo_reserva, nota: e.m.nota || null });
    } else {
      const real = r2(e.a.saldo_real);
      filas.push({ tipo: 'ajuste', id: e.id, fecha: e.fecha, monto: real, diferencia: r2(real - saldo), saldo: real, nota: e.a.nota || null });
      saldo = real;
    }
  });
  const ultimo = ajs[ajs.length - 1] || null;
  const moneda = bolsillo.moneda || 'ARS';
  const cotizacion = bolsillo.cotizacion_ars != null ? Number(bolsillo.cotizacion_ars) : null;
  return {
    id: bolsillo.id, nombre: bolsillo.nombre, tipo: bolsillo.tipo || 'apartado',
    moneda, medio: bolsillo.medio || null, origen: bolsillo.origen || 'importada', archivada: !!bolsillo.archivada,
    cotizacion, cotizacionFecha: bolsillo.cotizacion_fecha || null, notas: bolsillo.notas || null,
    saldo, aportado, retirado, filas,
    equivalenteARS: aPesos(saldo, moneda, { mep, cotizacion }),
    sinAnclar: !ultimo,
    ultimoAjuste: ultimo ? ultimo.fecha : null,
    diasDesdeAjuste: ultimo && hoy ? Math.max(0, difDias(ultimo.fecha, hoy)) : null,
    movimientos: mios.length
  };
}

const ordenMoneda = (a, b) => { const i = (m) => { const k = MONEDAS.indexOf(m); return k < 0 ? 99 : k; }; return i(a) - i(b) || a.localeCompare(b); };

/**
 * Todas las reservas: estados activos (con saldo primero), archivadas aparte, totales por moneda y equivalente en pesos.
 * El equivalente es `completo` solo si todas las monedas con plata tienen cotización; `faltan` dice cuáles no.
 */
export function resumenReservas(bolsillos = [], movs = [], ajustes = [], hoy = null, { mep = null } = {}) {
  const todos = bolsillos.map((b) => estadoReserva(b, movs, ajustes, hoy, { mep }));
  const estados = todos.filter((e) => !e.archivada)
    .sort((a, b) => (b.equivalenteARS ?? b.saldo) - (a.equivalenteARS ?? a.saldo) || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  const archivadas = todos.filter((e) => e.archivada).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  const porMoneda = {};
  estados.forEach((e) => {
    const t = porMoneda[e.moneda] || (porMoneda[e.moneda] = { moneda: e.moneda, total: 0, ahorro: 0, apartado: 0, ars: 0, faltaCotizacion: false });
    t.total = r2(t.total + e.saldo);
    t[e.tipo === 'ahorro' ? 'ahorro' : 'apartado'] = r2(t[e.tipo === 'ahorro' ? 'ahorro' : 'apartado'] + e.saldo);
    if (e.saldo > 0) { if (e.equivalenteARS == null) t.faltaCotizacion = true; else t.ars = r2(t.ars + e.equivalenteARS); }
  });
  const monedas = Object.values(porMoneda).sort((a, b) => ordenMoneda(a.moneda, b.moneda));
  const faltan = monedas.filter((m) => m.faltaCotizacion).map((m) => m.moneda);
  const ars = r2(monedas.reduce((s, m) => s + m.ars, 0));
  const unaSolaMoneda = monedas.length === 1 && monedas[0].moneda === 'ARS';
  return {
    estados, archivadas, monedas,
    equivalente: { ars, completo: faltan.length === 0, faltan, mostrar: !unaSolaMoneda && monedas.some((m) => m.moneda !== 'ARS' && m.total > 0) },
    // Compat: totales en pesos (solo reservas en ARS)
    total: porMoneda.ARS ? porMoneda.ARS.total : 0, ahorro: porMoneda.ARS ? porMoneda.ARS.ahorro : 0, apartado: porMoneda.ARS ? porMoneda.ARS.apartado : 0,
    sinAnclar: estados.filter((e) => e.origen === 'importada' && e.sinAnclar && e.movimientos > 0).length
  };
}

/** Valida el alta de un saldo real. Devuelve { fila } o { error, campo }. */
export function validarAjuste({ bolsilloId, fecha, monto }, hoy) {
  if (!(monto != null && Number.isFinite(monto) && monto >= 0)) return { error: 'Poné el saldo que ves en Mercado Pago (0 si quedó vacía).', campo: 'monto' };
  if (!fecha) return { error: 'Poné la fecha.', campo: 'fecha' };
  if (fecha > hoy) return { error: 'La fecha no puede ser futura.', campo: 'fecha' };
  return { fila: { bolsillo_id: bolsilloId, fecha, saldo_real: r2(monto) } };
}

const num = (v) => (v == null || String(v).trim() === '' ? null : parseMonto(v));
const miles = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

/**
 * Alta / edición de una reserva manual. `f` viene del form (strings).
 * Devuelve { fila, saldo } (saldo = lo que tenés hoy, solo en el alta) o { error, campo }.
 */
export function validarReserva(f, { existentes = [], editando = null, hoy } = {}) {
  const nombre = String(f.nombre || '').trim();
  if (!nombre) return { error: 'Poné un nombre.', campo: 'nombre' };
  if (nombre.length > 40) return { error: 'El nombre es muy largo (máximo 40).', campo: 'nombre' };
  if (existentes.some((b) => b.id !== editando?.id && String(b.nombre || '').trim().toLowerCase() === nombre.toLowerCase())) {
    return { error: 'Ya tenés una reserva con ese nombre (incluye las de Mercado Pago).', campo: 'nombre' };
  }
  const moneda = (f.moneda === 'OTRA' ? String(f.codigo || '') : String(f.moneda || '')).trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(moneda)) return { error: 'La moneda es un código de 3 a 5 letras (ej. BRL, CLP).', campo: 'codigo' };
  if (!MEDIOS.some((m) => m.id === f.medio)) return { error: 'Elegí si es digital, efectivo u otro.', campo: 'medio' };
  if (f.tipo !== 'apartado' && f.tipo !== 'ahorro') return { error: 'Elegí apartado o ahorro.', campo: 'tipo' };
  const cotiz = num(f.cotizacion);
  if (f.cotizacion != null && String(f.cotizacion).trim() !== '' && !(cotiz > 0)) return { error: 'La cotización tiene que ser un número mayor a 0.', campo: 'cotizacion' };
  const saldo = num(f.saldo);
  if (f.saldo != null && String(f.saldo).trim() !== '' && !(saldo != null && saldo >= 0)) return { error: 'El saldo tiene que ser 0 o más.', campo: 'saldo' };
  const notas = String(f.notas || '').trim();
  if (notas.length > 200) return { error: 'Las notas son muy largas (máximo 200).', campo: 'notas' };
  const usaCotizacion = moneda !== 'ARS' && moneda !== 'USD';
  // `editando` puede ser el bolsillo crudo o el estado de estadoReserva (cotizacion / cotizacionFecha)
  const cotizPrev = editando?.cotizacion_ars ?? editando?.cotizacion ?? null;
  const fechaPrev = editando?.cotizacion_fecha ?? editando?.cotizacionFecha ?? null;
  const cambioCotiz = usaCotizacion && cotiz != null && (cotizPrev == null || Number(cotizPrev) !== cotiz);
  return {
    fila: {
      nombre, moneda, medio: f.medio, tipo: f.tipo, notas: notas || null, origen: 'manual',
      cotizacion_ars: usaCotizacion && cotiz != null ? r2(cotiz * 1e4) / 1e4 : null,
      cotizacion_fecha: usaCotizacion && cotiz != null ? (cambioCotiz ? hoy : fechaPrev || hoy) : null
    },
    saldo: saldo == null ? null : r2(saldo)
  };
}

/** Saldo de la reserva al final de una fecha (para validar retiros con fecha anterior a hoy). */
export function saldoAl(estado, fecha) {
  const previas = (estado.filas || []).filter((f) => f.fecha <= fecha);
  return previas.length ? previas[previas.length - 1].saldo : 0;
}

/** Valida un depósito o retiro manual. Retirar más de lo que hay no se permite (en las manuales no hay rendimiento oculto). */
export function validarMovReserva({ sentido, monto, fecha, nota }, { saldo = 0, hoy } = {}) {
  const m = num(monto);
  if (sentido !== 'deposito' && sentido !== 'retiro') return { error: 'Elegí si depositaste o retiraste.', campo: 'sentido' };
  if (!(m > 0)) return { error: 'Poné un monto mayor a 0.', campo: 'monto' };
  if (!fecha) return { error: 'Poné la fecha.', campo: 'fecha' };
  if (fecha > hoy) return { error: 'La fecha no puede ser futura.', campo: 'fecha' };
  if (sentido === 'retiro' && m > saldo + 0.005) return { error: `No podés retirar más de lo que hay (${miles(saldo)}).`, campo: 'monto' };
  const texto = String(nota || '').trim();
  return { fila: { sentido, monto: r2(m), fecha, nota: texto ? texto.slice(0, 120) : null } };
}
