/**
 * Calculadora de cuotas — lógica pura y testeable.
 *
 * Esta es la ÚNICA fuente de verdad de cómo Tarjeteando entiende las compras en
 * cuotas. Antes existían dos implementaciones (esta, inline en App.jsx, y otra en
 * Backend/src/services/proyeccion.service.js) y los tests corrían sobre la del
 * backend, que el frontend nunca consumía: se testeaba el código que no se usaba.
 * El backend no tiene base de datos —`db` vive en RAM y se pierde al reiniciar—,
 * así que la fuente de verdad real es el localStorage del browser y la calculadora
 * tiene que vivir acá.
 *
 * Invariantes:
 *  - Un plan se arma con TODOS los resúmenes, no solo el último de cada tarjeta.
 *  - Cada plan se ancla al período del resumen donde se lo vio por última vez.
 *    Si la cuota N corresponde al período P, la cuota N+k corresponde al mes P+k.
 *  - El orden de subida de los resúmenes NO influye en ningún resultado.
 *  - Los consumos en dólares tienen monto_pesos = 0: se pesifican al proyectar.
 */

/** Índice absoluto de un mes (año*12 + mes-1), para comparar y restar períodos. */
export const indiceDeMes = (anio, mes) => anio * 12 + (mes - 1);

/** Período (año, mes) de un resumen, como índice absoluto. Null si no tiene. */
export const periodoDeResumen = (resumen) =>
  resumen && resumen.anio && resumen.mes ? indiceDeMes(resumen.anio, resumen.mes) : null;

/** Extrae {actual, total} de un movimiento en cuotas. Null si no es una cuota. */
export function numerosDeCuota(mov) {
  if (!mov) return null;
  if (mov.es_cuota && mov.cuota_actual && mov.total_cuotas) {
    return { actual: mov.cuota_actual, total: mov.total_cuotas };
  }
  const match = String(mov.cuota_texto || '').match(/(\d+)\/(\d+)/);
  if (match) {
    const actual = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (total > 0) return { actual, total };
  }
  return null;
}

/** Clave lógica de un plan: misma compra financiada a lo largo de los meses. */
export function claveDePlan(mov, total, montoPesos, montoDolares) {
  const nombre = (mov.referencia_limpia || mov.referencia_original || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
  // Redondeo del monto de cuota: tolera diferencias de centavos entre resúmenes.
  const montoClave = montoPesos ? Math.round(montoPesos / 1000) : Math.round(montoDolares);
  return `${mov.tarjeta}|${nombre}|${total}|${montoClave}`;
}

/**
 * Arma los planes de cuotas a partir de todos los movimientos y resúmenes.
 *
 * @param {Array} movimientos - movimientos de localStorage (con resumen_id o anio/mes_resumen)
 * @param {Array} resumenes   - resúmenes de localStorage ({id, tarjeta, anio, mes})
 * @returns {Array} planes, cada uno con cuota_actual, total_cuotas, monto_pesos,
 *   monto_dolares, periodo_anio, periodo_mes e `interrumpida`.
 */
export function construirPlanes(movimientos = [], resumenes = []) {
  const resumenPorId = {};
  const ultimoPeriodoPorTarjeta = {};
  resumenes.forEach(r => {
    if (!r) return;
    if (r.id) resumenPorId[r.id] = r;
    const p = periodoDeResumen(r);
    if (p === null) return;
    if (ultimoPeriodoPorTarjeta[r.tarjeta] === undefined || p > ultimoPeriodoPorTarjeta[r.tarjeta]) {
      ultimoPeriodoPorTarjeta[r.tarjeta] = p;
    }
  });

  const planes = new Map();
  movimientos.forEach(mov => {
    const nums = numerosDeCuota(mov);
    if (!nums) return;

    const resumen = resumenPorId[mov.resumen_id]
      || (mov.anio_resumen && mov.mes_resumen ? { anio: mov.anio_resumen, mes: mov.mes_resumen } : null);
    const periodo = periodoDeResumen(resumen);
    if (periodo === null) return;

    const montoPesos = mov.monto_pesos || 0;
    const montoDolares = mov.monto_dolares || 0;
    const clave = claveDePlan(mov, nums.total, montoPesos, montoDolares);
    const previo = planes.get(clave);
    // Gana siempre el resumen más reciente: así el orden de subida no influye.
    if (previo && periodo <= previo.periodo) return;

    planes.set(clave, {
      ...mov,
      clave,
      es_cuota: true,
      cuota_actual: nums.actual,
      total_cuotas: nums.total,
      monto_pesos: montoPesos,
      monto_dolares: montoDolares,
      periodo,
      periodo_anio: resumen.anio,
      periodo_mes: resumen.mes
    });
  });

  return [...planes.values()].map(plan => ({
    ...plan,
    // Un plan ya terminado (N/N) no está interrumpido, simplemente se acabó.
    interrumpida: plan.cuota_actual < plan.total_cuotas
      && (ultimoPeriodoPorTarjeta[plan.tarjeta] ?? plan.periodo) > plan.periodo
  }));
}

/** Orden determinístico: el orden de subida no debe mover totales ni el detalle. */
export function ordenarPlanes(planes) {
  return [...planes].sort((a, b) =>
    (a.tarjeta || '').localeCompare(b.tarjeta || '')
    || (a.referencia_limpia || '').localeCompare(b.referencia_limpia || '')
    || (a.total_cuotas - b.total_cuotas)
    || ((a.monto_pesos || 0) - (b.monto_pesos || 0))
    || ((a.monto_dolares || 0) - (b.monto_dolares || 0))
  );
}

/**
 * Proyecta las cuotas a los próximos meses.
 *
 * El bucket 0 es el mes SIGUIENTE al ancla. El ancla por defecto es el período del
 * resumen más reciente entre todas las tarjetas, nunca la fecha de hoy.
 *
 * @param {Array} planes - salida de construirPlanes
 * @param {Object} opciones
 * @param {number} [opciones.meses=6]
 * @param {Array}  [opciones.resumenes] - para derivar el ancla
 * @param {Date}   [opciones.ancla] - ancla explícita (tiene prioridad; útil en tests)
 * @param {number} [opciones.cotizacionVenta=0] - dólar tarjeta para pesificar cuotas USD
 * @param {Date}   [opciones.hoy] - fallback si no hay resúmenes (inyectable en tests)
 */
export function proyectarCuotas(planes = [], opciones = {}) {
  const {
    meses = 6,
    resumenes = [],
    cotizacionVenta = 0,
    hoy = new Date()
  } = opciones;

  let ancla = opciones.ancla || null;
  if (!ancla) {
    resumenes.forEach(r => {
      if (!r || !r.anio || !r.mes) return;
      const d = new Date(r.anio, r.mes - 1, 1);
      if (!ancla || d > ancla) ancla = d;
    });
  }
  if (!ancla) ancla = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const ordenados = ordenarPlanes(planes);
  const proyeccion = [];

  for (let i = 0; i < meses; i++) {
    const fecha = new Date(ancla.getFullYear(), ancla.getMonth() + i + 1, 1);
    let totalMes = 0;
    const detalles = [];

    ordenados.forEach(plan => {
      // Plan que el banco dejó de facturar: no se proyecta (se sigue viendo en Cuotas).
      if (plan.interrumpida) return;
      if (!plan.periodo_anio || !plan.periodo_mes) return;

      const diff = (fecha.getFullYear() - plan.periodo_anio) * 12
        + (fecha.getMonth() - (plan.periodo_mes - 1));
      const numeroCuota = plan.cuota_actual + diff;
      // Solo cuotas futuras respecto del período (diff >= 1) que aún no terminaron.
      if (diff < 1 || numeroCuota > plan.total_cuotas) return;

      // Las cuotas en dólares se pesifican al dólar tarjeta del momento (estimado).
      const montoARS = (plan.monto_pesos || 0) || (plan.monto_dolares || 0) * cotizacionVenta;
      totalMes += montoARS;
      detalles.push({
        id: plan.id,
        descripcion: plan.referencia_limpia || plan.referencia_original || 'Sin descripción',
        tarjeta: plan.tarjeta,
        cuota_numero: numeroCuota,
        total_cuotas: plan.total_cuotas,
        monto_cuota: montoARS,
        monto_cuota_dolares: plan.monto_dolares || 0,
        es_estimado_usd: !plan.monto_pesos && !!plan.monto_dolares
      });
    });

    proyeccion.push({
      mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      mes_nombre: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      mes_key: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`,
      total: Math.round(totalMes * 100) / 100, // redondeo estable a 2 decimales
      cantidad_cuotas: detalles.length,
      detalles
    });
  }

  return proyeccion;
}

/** Formato que consume CuotasView. */
export function formatearParaVista(planes = []) {
  return planes.map(plan => ({
    id: plan.id,
    descripcion: plan.referencia_limpia || plan.referencia_original || 'Sin descripción',
    tarjeta: plan.tarjeta,
    total_cuotas: plan.total_cuotas,
    cuotas_pagadas: plan.cuota_actual,
    cuotas_restantes: plan.total_cuotas - plan.cuota_actual,
    monto_cuota: plan.monto_pesos || plan.monto_dolares || 0,
    monto_cuota_pesos: plan.monto_pesos || 0,
    monto_cuota_dolares: plan.monto_dolares || 0,
    monto_total: (plan.monto_pesos || plan.monto_dolares || 0) * plan.total_cuotas,
    es_ultima_cuota: plan.cuota_actual === plan.total_cuotas,
    fecha_compra: plan.fecha_compra,
    interrumpida: !!plan.interrumpida,
    periodo_anio: plan.periodo_anio,
    periodo_mes: plan.periodo_mes
  }));
}

/** Cuánto falta pagar de los planes vigentes, en pesos (las cuotas USD se pesifican). */
export function totalPendiente(planes = [], cotizacionVenta = 0) {
  return planes.reduce((suma, plan) => {
    if (plan.interrumpida) return suma;
    const restantes = plan.total_cuotas - plan.cuota_actual;
    const cuotaARS = (plan.monto_pesos || 0) || (plan.monto_dolares || 0) * cotizacionVenta;
    return suma + cuotaARS * restantes;
  }, 0);
}
