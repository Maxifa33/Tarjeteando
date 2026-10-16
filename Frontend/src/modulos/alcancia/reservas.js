import { r2 } from '../cuentas/util.js';

/**
 * Reservas de Mercado Pago: saldo, historial y balance corrido (lógica pura).
 * Los extractos solo traen "reservado" y "retirado", no el saldo ni el rendimiento (que sale dentro del retiro).
 * Por eso el saldo se ancla a un saldo real cargado por el usuario (`reserva_ajustes`) y se corre con los
 * movimientos posteriores. Una reserva nunca baja de 0: si retirás más de lo que había, la diferencia es rendimiento.
 */

const delta = (m) => (m.direccion === 'salida' ? 1 : -1) * Number(m.monto);
const valido = (m) => Number.isFinite(Number(m.monto)) && (m.direccion === 'salida' || m.direccion === 'entrada');
const orden = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.id).localeCompare(String(b.id)));
// Mismo día: primero lo que entra a la reserva, después lo que sale, al final el saldo real. Así el clamp en 0 no depende del id.
const rango = (e) => (e.k === 'ajuste' ? 2 : delta(e.m) > 0 ? 0 : 1);
const difDias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/**
 * Estado de una reserva.
 * filas: cronológico, con saldo corrido. Un ajuste en la misma fecha que un movimiento va DESPUÉS de él
 * (el saldo real de ese día ya lo incluye).
 */
export function estadoReserva(bolsillo, movs = [], ajustes = [], hoy = null) {
  const mios = movs.filter((m) => m.tipo === 'reserva' && m.bolsillo_id === bolsillo.id && valido(m)).sort(orden);
  const ajs = ajustes.filter((a) => a.bolsillo_id === bolsillo.id).sort(orden);
  const eventos = [
    ...mios.map((m) => ({ k: 'mov', fecha: m.fecha, id: m.id, m })),
    ...ajs.map((a) => ({ k: 'ajuste', fecha: a.fecha, id: a.id, a }))
  ].sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : rango(x) - rango(y) || String(x.id).localeCompare(String(y.id))));

  let saldo = 0;
  let aportado = 0;
  let retirado = 0;
  const filas = [];
  eventos.forEach((e) => {
    if (e.k === 'mov') {
      const d = delta(e.m);
      if (d > 0) aportado = r2(aportado + d); else retirado = r2(retirado - d);
      saldo = r2(Math.max(0, saldo + d));
      filas.push({ tipo: 'mov', id: e.id, fecha: e.fecha, monto: r2(d), saldo });
    } else {
      const real = r2(e.a.saldo_real);
      filas.push({ tipo: 'ajuste', id: e.id, fecha: e.fecha, monto: real, diferencia: r2(real - saldo), saldo: real, nota: e.a.nota || null });
      saldo = real;
    }
  });
  const ultimo = ajs[ajs.length - 1] || null;
  return {
    id: bolsillo.id, nombre: bolsillo.nombre, tipo: bolsillo.tipo || 'apartado',
    saldo, aportado, retirado, filas,
    sinAnclar: !ultimo,
    ultimoAjuste: ultimo ? ultimo.fecha : null,
    diasDesdeAjuste: ultimo && hoy ? Math.max(0, difDias(ultimo.fecha, hoy)) : null,
    movimientos: mios.length
  };
}

/** Todas las reservas: estados (con saldo primero) y totales por tipo. */
export function resumenReservas(bolsillos = [], movs = [], ajustes = [], hoy = null) {
  const estados = bolsillos.map((b) => estadoReserva(b, movs, ajustes, hoy))
    .sort((a, b) => (b.saldo - a.saldo) || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  const suma = (tipo) => r2(estados.filter((e) => e.tipo === tipo).reduce((s, e) => s + e.saldo, 0));
  return { estados, total: r2(estados.reduce((s, e) => s + e.saldo, 0)), ahorro: suma('ahorro'), apartado: suma('apartado'), sinAnclar: estados.filter((e) => e.sinAnclar && e.movimientos > 0).length };
}

/** Valida el alta de un saldo real. Devuelve { fila } o { error, campo }. */
export function validarAjuste({ bolsilloId, fecha, monto }, hoy) {
  if (!(monto != null && Number.isFinite(monto) && monto >= 0)) return { error: 'Poné el saldo que ves en Mercado Pago (0 si quedó vacía).', campo: 'monto' };
  if (!fecha) return { error: 'Poné la fecha.', campo: 'fecha' };
  if (fecha > hoy) return { error: 'La fecha no puede ser futura.', campo: 'fecha' };
  return { fila: { bolsillo_id: bolsilloId, fecha, saldo_real: r2(monto) } };
}
