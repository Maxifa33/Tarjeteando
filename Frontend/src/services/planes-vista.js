/**
 * Cuotas — lógica de la vista (sin React, testeable en Node).
 *
 * Los meses de la línea de tiempo son meses de PAGO, como en Mes: la cuota que se
 * factura en el cierre de un mes se paga `desfase` meses después (vto − cierre de la
 * tarjeta; default 1). Así "Este mes" coincide con la cápsula de Mes y con el gráfico
 * (cuotasDelMes).
 *
 * Planes: formatearParaVista (cuotas_pagadas = número de la cuota del período del
 * plan). Los planes de 1 cuota son compras comunes: no entran.
 */
import { cuotasDelMes, indiceMesKey, mesKeyDeIndice } from './mes.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const actualDe = (p) => p.cuota_actual ?? p.cuotas_pagadas;
const pesosDe = (p) => p.monto_pesos ?? p.monto_cuota_pesos ?? 0;
const usdDe = (p) => p.monto_dolares ?? p.monto_cuota_dolares ?? 0;
const idDe = (p) => p.id ?? p.clave;

export const esPlanEnCuotas = (p) => (p?.total_cuotas || 0) > 1;
export const noSeProyecta = (p) => !!p?.interrumpida || p?.motivo === 'decision_usuario';

/** Cuota de un plan en pesos (USD pesificado con la cotización, marcado estimado). */
export function cuotaEnPesos(p, cotizacionVenta = 0) {
  const ars = pesosDe(p);
  if (ars) return { monto: ars, estimado: false };
  return { monto: r2(usdDe(p) * cotizacionVenta), estimado: true };
}

/** Meses de pago (índices absolutos) de la primera y la última cuota del plan. */
export function rangoDePlan(p, { desfase = {} } = {}) {
  if (!p?.periodo_anio || !p?.periodo_mes) return null;
  const pagoActual = p.periodo_anio * 12 + (p.periodo_mes - 1) + (desfase[p.tarjeta] ?? 1);
  const inicio = pagoActual - (actualDe(p) - 1);
  return { inicio, fin: inicio + p.total_cuotas - 1 };
}

/** Estado para la vista: 'ultima' | 'vigente' | 'a_revisar' | 'terminado'. */
export function estadoVista(p, hoy, rango) {
  if (p.interrumpida) return 'a_revisar';
  if (p.motivo === 'decision_usuario' || !rango || rango.fin < hoy) return 'terminado';
  if (rango.fin === hoy) return 'ultima';
  return 'vigente';
}

/**
 * Filas de la línea de tiempo.
 * @returns {{ meses: string[], hoy: string, filas: Array<{ planId, plan, inicio, fin, estado,
 *   pagadasHasta, enCurso, restante, estimado, empiezaAntes, terminaDespues }> }}
 */
export function lineaDeTiempo(planes = [], { hoyMesKey, desfase = {}, cotizacionVenta = 0, antes = 5, despues = 12 } = {}) {
  const hoy = indiceMesKey(hoyMesKey);
  const filas = planes.filter(esPlanEnCuotas).map((p) => {
    const rango = rangoDePlan(p, { desfase });
    if (!rango) return null;
    const estado = estadoVista(p, hoy, rango);
    const { monto, estimado } = cuotaEnPesos(p, cotizacionVenta);
    const faltan = estado === 'vigente' || estado === 'ultima' ? Math.max(0, rango.fin - hoy) : 0;
    return {
      planId: idDe(p), plan: p, estado,
      inicio: mesKeyDeIndice(rango.inicio), fin: mesKeyDeIndice(rango.fin),
      pagadasHasta: mesKeyDeIndice(Math.min(rango.fin, hoy - 1)),
      enCurso: rango.inicio <= hoy && hoy <= rango.fin && !noSeProyecta(p),
      restante: r2(monto * faltan), estimado, cuota: monto,
      _inicio: rango.inicio, _fin: rango.fin
    };
  }).filter(Boolean);

  const desde = hoy - antes;
  const finMax = Math.max(hoy, ...filas.filter((f) => f.estado !== 'terminado').map((f) => f._fin));
  const hasta = Math.min(hoy + despues, finMax);
  const meses = [];
  for (let i = desde; i <= hasta; i++) meses.push(mesKeyDeIndice(i));
  filas.forEach((f) => {
    f.empiezaAntes = f._inicio < desde;
    f.terminaDespues = f._fin > hasta;
  });
  return { meses, hoy: hoyMesKey, filas };
}

/** Orden: por fecha de fin ascendente (lo que termina antes, arriba). */
export function ordenarPorFin(filas = []) {
  return [...filas].sort((a, b) => a._fin - b._fin || a._inicio - b._inicio
    || String(a.plan.descripcion || '').localeCompare(String(b.plan.descripcion || '')));
}

/**
 * Cifras de Cuotas.
 * esteMes = cuotasDelMes(planes, hoy): lo mismo que usan Mes y el gráfico.
 */
export function resumenPlanes(planes = [], { hoyMesKey, desfase = {}, cotizacionVenta = 0 } = {}) {
  const { filas } = lineaDeTiempo(planes, { hoyMesKey, desfase, cotizacionVenta });
  const activos = filas.filter((f) => f.estado === 'vigente' || f.estado === 'ultima');
  const esteMes = cuotasDelMes(planes.filter(esPlanEnCuotas), hoyMesKey, { desfase, cotizacionVenta });
  const tarjetasEsteMes = new Set(esteMes.items.map((q) => q.tarjeta));
  const ultimas = filas.filter((f) => f.estado === 'ultima');
  const finUltimo = activos.length ? Math.max(...activos.map((f) => f._fin)) : null;
  return {
    enCurso: activos.length,
    ultimasEsteMes: ultimas.length,
    esteMes: esteMes.total,
    tarjetasEsteMes: tarjetasEsteMes.size,
    restante: r2(activos.reduce((s, f) => s + f.restante, 0)),
    restanteEstimado: activos.some((f) => f.estimado && f.restante > 0),
    aRevisar: filas.filter((f) => f.estado === 'a_revisar').length,
    terminados: filas.filter((f) => f.estado === 'terminado').length,
    // Lo que termina este mes deja de pagarse el mes que viene.
    seLiberaProximoMes: ultimas.map((f) => ({ planId: f.planId, descripcion: f.plan.descripcion, monto: f.cuota })),
    terminaUltimo: finUltimo === null ? null : mesKeyDeIndice(finUltimo)
  };
}

/** Próximas n cuotas de un plan (desde el mes actual, incluido). */
export function proximasCuotas(plan, { n = 4, hoyMesKey, desfase = {}, cotizacionVenta = 0 } = {}) {
  if (!plan || noSeProyecta(plan)) return [];
  const rango = rangoDePlan(plan, { desfase });
  if (!rango) return [];
  const hoy = indiceMesKey(hoyMesKey);
  const { monto, estimado } = cuotaEnPesos(plan, cotizacionVenta);
  const out = [];
  for (let i = Math.max(hoy, rango.inicio); i <= rango.fin && out.length < n; i++) {
    out.push({ mesKey: mesKeyDeIndice(i), numero: i - rango.inicio + 1, total: plan.total_cuotas, monto, montoUsd: pesosDe(plan) ? 0 : usdDe(plan), estimado });
  }
  return out;
}

/** Estado de cada cuota del plan: 'pagada' | 'este_mes' | 'falta'. */
export function cuotasDelPlan(plan, { hoyMesKey, desfase = {} } = {}) {
  const rango = rangoDePlan(plan, { desfase });
  if (!rango) return [];
  const hoy = indiceMesKey(hoyMesKey);
  // Interrumpido o terminado por decisión: pagadas son las que el banco facturó, no
  // las que tocaban por calendario.
  const facturadas = noSeProyecta(plan) ? actualDe(plan) : null;
  return Array.from({ length: plan.total_cuotas }, (_, k) => {
    const mes = rango.inicio + k;
    const estado = facturadas !== null
      ? (k + 1 <= facturadas ? 'pagada' : 'falta')
      : mes < hoy ? 'pagada' : mes === hoy ? 'este_mes' : 'falta';
    return { numero: k + 1, mesKey: mesKeyDeIndice(mes), estado };
  });
}
