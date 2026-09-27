/**
 * Sección Mes — cálculos puros (sin React ni storage).
 *
 * Responde: ¿cuánto del próximo pago ya está comprometido y cuánto queda libre
 * hasta el tope?
 *
 * Regla del "ciclo de pago" (documentada en CLAUDE.md):
 *  - El mes del ciclo es el del PRÓXIMO VENCIMIENTO ≥ hoy (entre resúmenes cerrados
 *    sin vencer y ciclos en curso de Últimos consumos).
 *  - Por tarjeta: si hay un resumen cerrado que vence ese mes (y no venció), se usa su
 *    total a pagar. Si no, el ciclo en curso de Últimos consumos que vence ese mes.
 *    Si no hay ninguno: 'sin_datos' (no suma y genera aviso).
 *  - El total de Últimos consumos YA incluye la cuota del mes: las cuotas nunca se
 *    suman encima. Variables = total − cuotas − fijos (residuo).
 *
 * Fechas: siempre strings 'YYYY-MM-DD' / 'YYYY-MM'. Nunca new Date('YYYY-MM-DD').
 */
import { resumenCard } from './consumos/ciclos.js';
import { hoyISO } from './consumos/comun.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM' → índice absoluto de mes. */
export const indiceMesKey = (mk) => {
  const [a, m] = String(mk).split('-').map(Number);
  return a * 12 + (m - 1);
};
/** Índice absoluto → 'YYYY-MM'. */
export const mesKeyDeIndice = (i) => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
/** Suma n meses a un 'YYYY-MM'. */
export const sumarMeses = (mk, n) => mesKeyDeIndice(indiceMesKey(mk) + n);
/** 'YYYY-MM-DD' → 'YYYY-MM' (o null). */
export const mesKeyDe = (fecha) => (/^\d{4}-\d{2}/.test(String(fecha || '')) ? String(fecha).slice(0, 7) : null);

const normTxt = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const canonRed = (x) => {
  const t = normTxt(x);
  if (/AMEX|AMERICAN/.test(t)) return 'AMEX';
  if (/MASTER/.test(t)) return 'MASTER';
  if (/VISA/.test(t)) return 'VISA';
  return t;
};

/** Red de una tarjeta de la lista (tipo, red o, si faltan, el nombre). */
const redDeTarjeta = (t) => canonRed(t.red || t.tipo || t.nombre);
const bancoDeTarjeta = (t) => {
  if (t.banco) return normTxt(t.banco);
  const n = normTxt(t.nombre);
  return ['SANTANDER', 'GALICIA', 'BBVA', 'MACRO'].find((b) => n.includes(b)) || '';
};

/** ¿El ciclo de Últimos consumos es de esta tarjeta? (mismo banco + misma red) */
export function cicloEsDeTarjeta(ciclo, tarjeta) {
  const banco = normTxt(ciclo.banco);
  if (!banco) return false; // sin banco asignado: no se puede emparejar
  return banco === bancoDeTarjeta(tarjeta) && canonRed(ciclo.red) === redDeTarjeta(tarjeta);
}

/** Ciclos de Últimos consumos con datos, con sus números (resumenCard). */
function ciclosConDatos(ciclosLive = {}, consumosLive = [], hoy) {
  return Object.values(ciclosLive || {})
    .filter((c) => c && c.estado !== 'conciliado' && c.fecha_vencimiento)
    .map((ciclo) => ({ ciclo, datos: resumenCard(ciclo, consumosLive, hoy) }))
    .filter((x) => x.datos.n > 0);
}

/** Mes del próximo vencimiento ≥ hoy. Sin ninguno: el mes de hoy. */
export function mesDelProximoVencimiento({ hoy = hoyISO(), resumenes = [], ciclosLive = {}, consumosLive = [] } = {}) {
  const vtos = [
    ...resumenes.map((r) => r?.fecha_vencimiento),
    ...ciclosConDatos(ciclosLive, consumosLive, hoy).map((x) => x.ciclo.fecha_vencimiento)
  ].filter((v) => mesKeyDe(v) && v >= hoy).sort();
  return mesKeyDe(vtos[0]) || mesKeyDe(hoy);
}

/**
 * Qué se paga en el mes del ciclo, tarjeta por tarjeta.
 * @param {Object} p
 *  - hoy:          'YYYY-MM-DD'
 *  - tarjetas:     lista de storage ({ nombre, banco, tipo })
 *  - resumenes:    [{ tarjeta, fecha_cierre, fecha_vencimiento, total_a_pagar_pesos, total_a_pagar_dolares }]
 *  - ciclosLive / consumosLive: Últimos consumos (services/consumos/ciclos.js)
 *  - mesKey:       opcional; por defecto, el del próximo vencimiento ≥ hoy
 * @returns {{ mesKey, porTarjeta: Array }}
 */
export function cicloDePago({ hoy = hoyISO(), tarjetas = [], resumenes = [], ciclosLive = {}, consumosLive = [], mesKey = null } = {}) {
  const mk = mesKey || mesDelProximoVencimiento({ hoy, resumenes, ciclosLive, consumosLive });
  const vivos = ciclosConDatos(ciclosLive, consumosLive, hoy)
    .filter((x) => mesKeyDe(x.ciclo.fecha_vencimiento) === mk && x.ciclo.fecha_vencimiento >= hoy);
  const usados = new Set();

  const desdeCiclos = (lista, base) => {
    lista.forEach((x) => usados.add(x.ciclo.grupoKey));
    const principal = lista[0].ciclo;
    return {
      ...base,
      fuente: 'en_curso',
      total: r2(lista.reduce((s, x) => s + x.datos.total_ars, 0)),
      totalUsd: r2(lista.reduce((s, x) => s + x.datos.total_usd, 0)),
      unPago: r2(lista.reduce((s, x) => s + x.datos.un_pago, 0)),
      cierre: principal.fecha_cierre || null,
      vencimiento: principal.fecha_vencimiento || null,
      actualizado: lista.map((x) => x.ciclo.actualizado_at).filter(Boolean).sort().pop() || null,
      grupoKeys: lista.map((x) => x.ciclo.grupoKey),
      plasticos: lista.flatMap((x) => x.datos.miembros.map((m) => ({ ult4: m.ult4, total: r2(m.subtotal) })))
    };
  };

  const porTarjeta = tarjetas.map((t) => {
    const base = { tarjetaId: t.nombre, nombre: t.nombre, banco: t.banco || '', red: t.tipo || t.red || '' };
    const cerrado = resumenes
      .filter((r) => r && r.tarjeta === t.nombre && mesKeyDe(r.fecha_vencimiento) === mk && r.fecha_vencimiento >= hoy)
      .sort((a, b) => String(b.fecha_cierre || '').localeCompare(String(a.fecha_cierre || '')))[0];
    if (cerrado) {
      // Si hay un ciclo en curso de la misma tarjeta que vence este mes, lo tapa el resumen.
      vivos.filter((x) => cicloEsDeTarjeta(x.ciclo, t)).forEach((x) => usados.add(x.ciclo.grupoKey));
      return {
        ...base,
        fuente: 'resumen_cerrado',
        total: r2(cerrado.total_a_pagar_pesos),
        totalUsd: r2(cerrado.total_a_pagar_dolares),
        unPago: null,
        cierre: cerrado.fecha_cierre || null,
        vencimiento: cerrado.fecha_vencimiento || null,
        actualizado: null,
        grupoKeys: [],
        plasticos: []
      };
    }
    const propios = vivos.filter((x) => !usados.has(x.ciclo.grupoKey) && cicloEsDeTarjeta(x.ciclo, t));
    if (propios.length) return desdeCiclos(propios, base);
    return {
      ...base, fuente: 'sin_datos', total: 0, totalUsd: 0, unPago: null,
      cierre: null, vencimiento: null, actualizado: null, grupoKeys: [], plasticos: []
    };
  });

  // Ciclos que no son de ninguna tarjeta conocida (tarjeta sin resúmenes o sin banco): entrada propia.
  vivos.filter((x) => !usados.has(x.ciclo.grupoKey)).forEach((x) => {
    const c = x.ciclo;
    const nombre = `${c.banco || 'Sin banco'} ${c.red || ''}`.trim();
    porTarjeta.push(desdeCiclos([x], { tarjetaId: c.grupoKey, nombre, banco: c.banco || '', red: c.red || '' }));
  });

  return { mesKey: mk, porTarjeta };
}

/**
 * Meses entre el cierre y el vencimiento de cada tarjeta (suele ser 1; 0 si cierra
 * y vence el mismo mes). Sale del resumen más reciente. Default 1.
 */
export function desfasePorTarjeta(resumenes = []) {
  const ultimo = {};
  resumenes.forEach((r) => {
    if (!r?.tarjeta || !mesKeyDe(r.fecha_cierre) || !mesKeyDe(r.fecha_vencimiento)) return;
    if (!ultimo[r.tarjeta] || r.fecha_cierre > ultimo[r.tarjeta].fecha_cierre) ultimo[r.tarjeta] = r;
  });
  return Object.fromEntries(Object.entries(ultimo).map(([t, r]) => [
    t, indiceMesKey(mesKeyDe(r.fecha_vencimiento)) - indiceMesKey(mesKeyDe(r.fecha_cierre))
  ]));
}

/**
 * Cuotas que se PAGAN en `mesKey`. Cada tarjeta factura en el mes de cierre y se paga
 * `desfase` meses después: el período facturado es mesKey − desfase.
 * Incluye la cuota del último resumen cargado (diff 0), porque también se paga ese mes.
 * Para diff ≥ 1 coincide con el bucket de proyectarCuotas cuyo mes_key es el período.
 *
 * @param planes  salida de construirPlanes o de formatearParaVista (acepta ambas formas)
 */
export function cuotasDelMes(planes = [], mesKey, { desfase = {}, cotizacionVenta = 0, tarjetas = null } = {}) {
  const pago = indiceMesKey(mesKey);
  const items = [];
  planes.forEach((p) => {
    if (!p || p.interrumpida) return;
    if (tarjetas && !tarjetas.includes(p.tarjeta)) return;
    if (!p.periodo_anio || !p.periodo_mes) return;
    const actual = p.cuota_actual ?? p.cuotas_pagadas;
    const total = p.total_cuotas;
    if (!actual || !total) return;
    const periodoFacturado = pago - (desfase[p.tarjeta] ?? 1);
    const diff = periodoFacturado - (p.periodo_anio * 12 + (p.periodo_mes - 1));
    const numero = actual + diff;
    if (diff < 0 || numero > total) return;
    const pesos = p.monto_pesos ?? p.monto_cuota_pesos ?? 0;
    const usd = p.monto_dolares ?? p.monto_cuota_dolares ?? 0;
    items.push({
      id: p.id,
      descripcion: p.descripcion || p.referencia_limpia || p.referencia_original || 'Sin descripción',
      tarjeta: p.tarjeta,
      cuota_numero: numero,
      total_cuotas: total,
      monto: r2(pesos || usd * cotizacionVenta),
      monto_dolares: usd,
      es_estimado_usd: !pesos && !!usd,
      es_ultima: numero === total,
      // mes en que se paga la última cuota
      hasta: mesKeyDeIndice(pago + (total - numero))
    });
  });
  items.sort((a, b) => b.monto - a.monto || a.descripcion.localeCompare(b.descripcion));
  // Las cuotas en dólares van aparte (como los fijos en USD): el total en pesos no las
  // incluye, porque el resumen las cobra en su saldo en dólares.
  const enPesos = items.filter((i) => !i.es_estimado_usd);
  return {
    total: r2(enPesos.reduce((s, i) => s + i.monto, 0)),
    totalUsd: r2(items.filter((i) => i.es_estimado_usd).reduce((s, i) => s + i.monto_dolares, 0)),
    items
  };
}

/**
 * Composición del pago del mes. variables es el residuo y nunca es negativo.
 * @returns {{ cuotas, fijos, fijosUsd, variables, total, avisos: Array<{tipo, ...}> }}
 */
export function composicion({ porTarjeta = [], cuotasDelMes: cuotas = 0, fijosArs = 0, fijosUsd = 0 } = {}) {
  const conDatos = porTarjeta.filter((t) => t.fuente !== 'sin_datos');
  const total = r2(conDatos.reduce((s, t) => s + (t.total || 0), 0));
  const avisos = [];
  const sinDatos = porTarjeta.filter((t) => t.fuente === 'sin_datos');
  if (sinDatos.length) avisos.push({ tipo: 'tarjeta_sin_datos', tarjetas: sinDatos.map((t) => t.tarjetaId) });

  let variables = r2(total - cuotas - fijosArs);
  if (variables < 0) {
    variables = 0;
    if (total > 0) avisos.push({ tipo: 'datos_inconsistentes' });
  }
  return {
    cuotas: r2(cuotas),
    fijos: r2(fijosArs),
    fijosUsd: r2(fijosUsd),
    variables,
    // Con datos consistentes coincide con la suma de las fuentes.
    total: r2(Math.max(total, cuotas + fijosArs)),
    avisos
  };
}

/** Libre hasta el tope. Sin tope: todo null. */
export function libre(total, tope) {
  if (tope === null || tope === undefined || !(Number(tope) > 0)) return { libre: null, pasado: false, pct: null };
  const l = r2(tope - total);
  return { libre: l, pasado: l < 0, pct: total / tope };
}

/**
 * Próximo mes: cuotas + fijos ya firmados, más lo ya consumido en ciclos que vencen
 * ese mes (0 si todavía no abrió ninguno).
 * @param p.cuotasDelMes  total de cuotas que se pagan el mes siguiente
 * @param p.porTarjetaSiguiente  cicloDePago(...).porTarjeta con mesKey = mes siguiente
 * @param p.cuotasPorTarjeta  { [tarjetaId]: total de cuotas de esa tarjeta ese mes }
 */
export function proximoMes({ cuotasDelMes: cuotas = 0, fijosArs = 0, fijosUsd = 0, porTarjetaSiguiente = [], cuotasPorTarjeta = {} } = {}) {
  const consumido = porTarjetaSiguiente.reduce((s, t) => {
    if (t.fuente === 'en_curso') return s + (t.unPago || 0);
    if (t.fuente === 'resumen_cerrado') return s + Math.max(0, (t.total || 0) - (cuotasPorTarjeta[t.tarjetaId] || 0));
    return s;
  }, 0);
  const variables = r2(consumido);
  return {
    cuotas: r2(cuotas),
    fijos: r2(fijosArs),
    fijosUsd: r2(fijosUsd),
    variables,
    total: r2(cuotas + fijosArs + variables),
    abierto: porTarjetaSiguiente.some((t) => t.fuente !== 'sin_datos'),
    avisos: []
  };
}
