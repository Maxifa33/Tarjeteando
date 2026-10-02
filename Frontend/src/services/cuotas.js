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
 * Comprobante normalizado: solo dígitos, sin ceros a la izquierda ('009872' y
 * '00009872' son el mismo). Vacío o solo ceros = sin comprobante (null).
 */
export function normalizarComprobante(c) {
  const d = String(c ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d || null;
}

/**
 * Identidad de un plan: tarjeta + comprobante normalizado. Sin comprobante, la clave
 * base + el número de ocurrencia de esa compra dentro de su resumen (#1, #2…): dos
 * compras idénticas en un resumen son dos planes, y el #k de un mes empalma con el
 * #k del siguiente.
 */
export function idDePlan(mov, nums, ocurrencia = 1) {
  const comp = normalizarComprobante(mov.comprobante);
  if (comp) return `${mov.tarjeta}|c:${comp}`;
  return `${claveDePlan(mov, nums.total, mov.monto_pesos || 0, mov.monto_dolares || 0)}#${ocurrencia}`;
}

/**
 * Arma los planes de cuotas a partir de todos los movimientos y resúmenes.
 *
 * Identidad (idDePlan): por comprobante, o por clave base + ocurrencia. Compatibilidad
 * entre resúmenes viejos sin comprobante y nuevos con comprobante de la misma compra:
 * se unen en un solo plan si coinciden la clave base y la cuota esperada (cuota_actual
 * + diferencia de períodos). Nunca dos planes para la misma compra. Cada plan guarda en
 * `alias` todas las claves con las que se lo vio (las decisiones pueden apuntar a
 * cualquiera) y en `clave` la más reciente.
 *
 * @param {Array} movimientos - movimientos de localStorage (con resumen_id o anio/mes_resumen)
 * @param {Array} resumenes   - resúmenes de localStorage ({id, tarjeta, anio, mes})
 * @param {Array} decisiones  - lo que decidió el usuario sobre planes interrumpidos:
 *   [{ claveDePlan, decision: 'terminado'|'vigente', fecha }]. Gana la más reciente.
 *   'terminado' → el plan pasa a 'terminada' (motivo 'decision_usuario') y no se proyecta.
 *   'vigente'   → deja de estar interrumpido y se proyecta hasta su última cuota.
 *   Sin decisiones, la salida es idéntica a la de antes.
 * @returns {Array} planes, cada uno con cuota_actual, total_cuotas, monto_pesos,
 *   monto_dolares, periodo_anio, periodo_mes e `interrumpida`.
 */
export function construirPlanes(movimientos = [], resumenes = [], decisiones = []) {
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

  // 1) Observaciones: cada movimiento en cuotas con su período y su clave base.
  const obs = [];
  movimientos.forEach((mov, orden) => {
    const nums = numerosDeCuota(mov);
    if (!nums) return;
    const resumen = resumenPorId[mov.resumen_id]
      || (mov.anio_resumen && mov.mes_resumen ? { anio: mov.anio_resumen, mes: mov.mes_resumen } : null);
    const periodo = periodoDeResumen(resumen);
    if (periodo === null) return;
    const montoPesos = mov.monto_pesos || 0;
    const montoDolares = mov.monto_dolares || 0;
    obs.push({
      mov, nums, resumen, periodo, orden, montoPesos, montoDolares,
      base: claveDePlan(mov, nums.total, montoPesos, montoDolares),
      comp: normalizarComprobante(mov.comprobante),
      grupo: mov.resumen_id || `${mov.tarjeta}|${periodo}`
    });
  });

  // 2) Ocurrencia #k de las compras sin comprobante, por (resumen, clave base), en
  //    orden determinístico (fecha de compra, id): no depende del orden de subida.
  const cmp = (a, b) => String(a.mov.fecha_compra || '').localeCompare(String(b.mov.fecha_compra || ''))
    || String(a.mov.id ?? '').localeCompare(String(b.mov.id ?? ''))
    || a.orden - b.orden;
  const porGrupo = new Map();
  obs.forEach(o => {
    if (o.comp) return;
    const k = `${o.grupo}\u0000${o.base}`;
    if (!porGrupo.has(k)) porGrupo.set(k, []);
    porGrupo.get(k).push(o);
  });
  porGrupo.forEach(lista => lista.sort(cmp).forEach((o, i) => { o.ocurrencia = i + 1; }));
  obs.forEach(o => { o.id = idDePlan(o.mov, o.nums, o.ocurrencia); });

  // 3) Empalme, del período más viejo al más nuevo.
  const planes = [];
  const porAlias = new Map();
  const empalma = (plan, o) => plan.base === o.base
    && plan.periodo < o.periodo
    && plan.ultimaObs !== o.periodo
    && plan.cuota_actual + (o.periodo - plan.periodo) === o.nums.actual
    && (!plan.comp || !o.comp || plan.comp === o.comp);

  [...obs].sort((a, b) => a.periodo - b.periodo || cmp(a, b)).forEach(o => {
    let plan = porAlias.get(o.id);
    if (!plan) {
      // Misma compra vista con y sin comprobante (resúmenes viejos y nuevos).
      plan = planes.find(p => empalma(p, o) && (o.comp ? !p.comp : p.comp));
    }
    if (!plan) {
      plan = { alias: [], primerOrden: o.orden, periodo: -Infinity };
      planes.push(plan);
    }
    if (!plan.alias.includes(o.id)) {
      plan.alias.push(o.id);
      porAlias.set(o.id, plan);
    }
    plan.primerOrden = Math.min(plan.primerOrden, o.orden);
    if (o.comp) plan.comp = o.comp;
    // Gana el resumen más reciente; dentro del mismo período (la misma compra dos
    // veces en un resumen, p. ej. una puesta al día), la cuota más alta.
    const gana = o.periodo > plan.periodo
      || (o.periodo === plan.periodo && o.nums.actual > plan.cuota_actual);
    if (!gana) return;
    Object.assign(plan, {
      datos: o.mov,
      clave: o.id,
      base: o.base,
      cuota_actual: o.nums.actual,
      total_cuotas: o.nums.total,
      monto_pesos: o.montoPesos,
      monto_dolares: o.montoDolares,
      periodo: o.periodo,
      periodo_anio: o.resumen.anio,
      periodo_mes: o.resumen.mes,
      ultimaObs: o.periodo
    });
  });

  // Decisión vigente por plan (la más reciente). Las de planes que ya no existen se ignoran.
  const decisionPorClave = {};
  (decisiones || []).forEach(d => {
    if (!d || !d.claveDePlan || (d.decision !== 'terminado' && d.decision !== 'vigente')) return;
    const previa = decisionPorClave[d.claveDePlan];
    if (!previa || String(d.fecha || '') >= String(previa.fecha || '')) decisionPorClave[d.claveDePlan] = d;
  });
  const decisionDe = (alias) => alias.map(a => decisionPorClave[a]).filter(Boolean)
    .reduce((m, d) => (!m || String(d.fecha || '') >= String(m.fecha || '') ? d : m), null);

  // El orden de salida es el de antes: el del primer movimiento de cada plan.
  return planes.sort((a, b) => a.primerOrden - b.primerOrden).map(p => {
    const plan = {
      ...p.datos,
      clave: p.clave,
      alias: p.alias,
      es_cuota: true,
      cuota_actual: p.cuota_actual,
      total_cuotas: p.total_cuotas,
      monto_pesos: p.monto_pesos,
      monto_dolares: p.monto_dolares,
      periodo: p.periodo,
      periodo_anio: p.periodo_anio,
      periodo_mes: p.periodo_mes
    };
    const ultimoPeriodo = ultimoPeriodoPorTarjeta[plan.tarjeta] ?? plan.periodo;
    const quedanCuotas = plan.cuota_actual < plan.total_cuotas;
    // Un plan ya terminado (N/N) no está interrumpido, simplemente se acabó.
    const interrumpida = quedanCuotas && ultimoPeriodo > plan.periodo;
    const decision = interrumpida ? decisionDe(p.alias) : null;
    if (decision?.decision === 'terminado') {
      return { ...plan, interrumpida: false, estado: 'terminada', motivo: 'decision_usuario', decision: 'terminado' };
    }
    if (decision?.decision === 'vigente') {
      return { ...plan, interrumpida: false, estado: 'vigente', decision: 'vigente' };
    }
    return { ...plan, interrumpida, estado: estadoDePlan({ quedanCuotas, interrumpida, esUltimoPeriodo: plan.periodo === ultimoPeriodo }) };
  });
}

/**
 * Estado de un plan, que es lo que decide si se muestra en la vista Cuotas:
 *  - 'vigente'      → quedan cuotas por pagar y el banco las sigue facturando.
 *  - 'ultima_cuota' → la última cuota se cobró en el resumen MÁS RECIENTE de la
 *                     tarjeta. Ya no se debe nada, pero es plata que se libera: se
 *                     muestra un mes y después desaparece sola.
 *  - 'terminada'    → se terminó en un resumen anterior. Es historial, no deuda.
 *  - 'interrumpida' → quedan cuotas en el papel pero el banco dejó de facturarlas.
 */
function estadoDePlan({ quedanCuotas, interrumpida, esUltimoPeriodo }) {
  if (interrumpida) return 'interrumpida';
  if (quedanCuotas) return 'vigente';
  return esUltimoPeriodo ? 'ultima_cuota' : 'terminada';
}

/** Planes que importan hoy: se deben, se acaban de terminar, o hay que revisarlos. */
export const ESTADOS_EN_CURSO = ['vigente', 'ultima_cuota', 'interrumpida'];

/** true si el plan todavía tiene algo que decirte este mes. */
export const estaEnCurso = (plan) => ESTADOS_EN_CURSO.includes(plan?.estado);

/** true si el plan no se proyecta: el banco dejó de facturarlo o el usuario lo dio por terminado. */
export const noSeProyecta = (plan) => !!plan?.interrumpida || plan?.motivo === 'decision_usuario';

/** Planes con deuda real por delante (los que cuenta la StatCard "Cuotas activas"). */
export const estaVigente = (plan) => plan?.estado === 'vigente';

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
      // Plan que el banco dejó de facturar (o que el usuario dio por terminado): no se
      // proyecta (se sigue viendo en Cuotas).
      if (noSeProyecta(plan)) return;
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

/** Formato que consume CuotasView, ordenado por lo que importa primero. */
export function formatearParaVista(planes = []) {
  // Primero lo que se acaba de terminar (plata que se libera), después lo vigente
  // ordenado por cuánto falta, y al final lo que hay que revisar.
  const prioridad = { ultima_cuota: 0, vigente: 1, interrumpida: 2, terminada: 3 };
  const ordenados = [...planes].sort((a, b) =>
    (prioridad[a.estado] ?? 9) - (prioridad[b.estado] ?? 9)
    || (a.total_cuotas - a.cuota_actual) - (b.total_cuotas - b.cuota_actual)
    || (b.monto_pesos || 0) - (a.monto_pesos || 0)
    || (a.referencia_limpia || '').localeCompare(b.referencia_limpia || '')
  );
  return ordenados.map(plan => ({
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
    estado: plan.estado,
    interrumpida: !!plan.interrumpida,
    periodo_anio: plan.periodo_anio,
    periodo_mes: plan.periodo_mes,
    clave: plan.clave,
    alias: plan.alias || [plan.clave],
    motivo: plan.motivo || null,
    decision: plan.decision || null
  }));
}

/** Cuánto falta pagar de los planes vigentes, en pesos (las cuotas USD se pesifican). */
export function totalPendiente(planes = [], cotizacionVenta = 0) {
  return planes.reduce((suma, plan) => {
    if (noSeProyecta(plan)) return suma;
    const restantes = plan.total_cuotas - plan.cuota_actual;
    const cuotaARS = (plan.monto_pesos || 0) || (plan.monto_dolares || 0) * cotizacionVenta;
    return suma + cuotaARS * restantes;
  }, 0);
}
