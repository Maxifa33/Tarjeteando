/**
 * Puente de SOLO LECTURA entre los módulos y Tarjeteando.
 *
 * Recibe el objeto `mes` que App.jsx ya calcula con services/mes.js (cicloDePago,
 * cuotasDelMes, composicionPorTarjeta, composicionDesdeTarjetas) y devuelve un resumen
 * plano para los módulos. No importa storage.js, no escribe nada y no muta lo recibido:
 * así las cifras son por construcción las mismas que la cápsula de Mes.
 *
 * Los datos de Tarjeteando viven en este navegador (localStorage): el resumen solo
 * existe en el dispositivo donde se importaron los resúmenes.
 */

import { claveComercio } from '../../services/series.js';

/** Identidad estable de un comercio/cobro (misma regla que las series de Tarjeteando). */
export const claveCobro = claveComercio;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {Object|null} mes  { ciclo: { mesKey, porTarjeta }, comp: { cuotas, fijos, fijosUsd, variables, total }, cuotas? }
 * @returns {{ mesKey, total, cuotas, fijos, variables, usd: { total, fijos, cuotas }, sinDatos: string[], tarjetasConDatos: number, fuente: 'dispositivo_local' } | null}
 */
export function resumenTarjetasDelMes(mes) {
  if (!mes || !mes.ciclo) return null;
  const porTarjeta = Array.isArray(mes.ciclo.porTarjeta) ? mes.ciclo.porTarjeta : [];
  const comp = mes.comp || {};
  const conDatos = porTarjeta.filter((t) => t.fuente !== 'sin_datos');
  const cuotasUsd = Number(mes.cuotas?.totalUsd) || 0;
  return {
    mesKey: mes.ciclo.mesKey || null,
    total: r2(comp.total),
    cuotas: r2(comp.cuotas),
    fijos: r2(comp.fijos),
    variables: r2(comp.variables),
    usd: {
      total: r2(conDatos.reduce((s, t) => s + (Number(t.totalUsd) || 0), 0)),
      fijos: r2(comp.fijosUsd),
      cuotas: r2(cuotasUsd)
    },
    sinDatos: porTarjeta.filter((t) => t.fuente === 'sin_datos').map((t) => t.tarjetaId),
    tarjetasConDatos: conDatos.length,
    fuente: 'dispositivo_local'
  };
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Compras con tarjeta de Tarjeteando para vincular un recupero (SOLO LECTURA).
 * Las cuotas de un mismo plan aparecen en varios resúmenes: se deja una sola fila por plan
 * (la de la cuota más alta vista) con el monto de la cuota y el total de la compra.
 * Excluye pagos, reintegros y montos negativos.
 *
 * @param movimientos  movimientos de Tarjeteando (resúmenes) + opcionalmente los "en curso"
 * @returns [{ id, clave, tarjeta, descripcion, fecha, moneda, monto, cuotas: null | { actual, total, monto_cuota, total_compra } }]
 */
export function comprasDeTarjeta(movimientos = []) {
  const porClave = new Map();
  movimientos.forEach((m) => {
    if (!m || m.es_pago) return;
    const pesos = Number(m.monto_pesos) || 0;
    const usd = Number(m.monto_dolares) || 0;
    if (pesos <= 0 && usd <= 0) return;
    const descripcion = m.referencia_limpia || m.referencia_original || 'Compra';
    const enCuotas = !!(m.es_cuota && Number(m.total_cuotas) > 1);
    const monto = pesos > 0 ? pesos : usd;
    const moneda = pesos > 0 ? 'ARS' : 'USD';
    const clave = enCuotas
      ? `${m.tarjeta}|${norm(descripcion)}|${m.total_cuotas}|${m.fecha_compra || ''}`
      : `id:${m.id}`;
    const fila = {
      id: m.id,
      clave,
      tarjeta: m.tarjeta_label || m.tarjeta || '',
      descripcion,
      fecha: m.fecha_compra || null,
      moneda,
      monto: r2(monto),
      cuotas: enCuotas ? { actual: Number(m.cuota_actual) || 1, total: Number(m.total_cuotas), monto_cuota: r2(monto), total_compra: r2(monto * Number(m.total_cuotas)) } : null
    };
    const ya = porClave.get(clave);
    if (!ya || (fila.cuotas && ya.cuotas && fila.cuotas.actual > ya.cuotas.actual)) porClave.set(clave, fila);
  });
  return [...porClave.values()].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
}

/** ¿El recupero corresponde a una cuota o al total de la compra? Gana el monto más cercano. */
export function sugerirAlcance(montoRecupero, compra) {
  if (!compra?.cuotas) return 'total';
  // 'cuota' solo si el monto se parece a una cuota (±10%); una devolución parcial del total es 'total'.
  const c = compra.cuotas.monto_cuota;
  return Math.abs(montoRecupero - c) <= Math.max(c * 0.1, 1) ? 'cuota' : 'total';
}

/**
 * Lo que se paga de tarjetas por mes de vencimiento, desde las columnas de Evolución
 * (services/evolucion.js): 'pagado' (resúmenes vencidos), 'en_curso' (= cápsula de Mes)
 * y 'comprometido' (cuotas + fijos ya firmados). SOLO LECTURA.
 * @returns {{ [mesKey]: { total, tipo, usd } }}
 */
export function tarjetasPorMes(columnas = []) {
  const out = {};
  columnas.forEach((c) => {
    if (!c?.mesKey) return;
    // Un mes 'pagado' sin ningún resumen (no lo importaste) no es "0 de tarjetas": es "sin datos".
    if (c.tipo === 'pagado' && !Object.keys(c.porTarjeta || {}).length) return;
    out[c.mesKey] = { total: r2(c.total), tipo: c.tipo, usd: r2(c.usdAparte || 0) };
  });
  return out;
}

// ───────────── Cobros recurrentes (para asociarlos a una inversión) ─────────────

const pad2 = (n) => String(n).padStart(2, '0');
/** Número largo de la referencia (ej. N° de póliza en 'ZURICH INTERNA0000003393731'), sin ceros adelante. Distingue dos pólizas del mismo comercio. */
export function refNumerica(texto = '') {
  const runs = String(texto).match(/\d{5,}/g) || [];
  const largo = runs.sort((a, b) => b.length - a.length)[0];
  return largo ? largo.replace(/^0+/, '') || null : null;
}

/** Mes en que se paga un resumen: su vencimiento; sin vencimiento, el mes siguiente al período. */
function mesDePagoResumen(r) {
  const v = String(r?.fecha_vencimiento || '');
  if (/^\d{4}-\d{2}/.test(v)) return v.slice(0, 7);
  if (r?.anio && r?.mes) { const t = Number(r.anio) * 12 + Number(r.mes); return `${Math.floor(t / 12)}-${pad2((t % 12) + 1)}`; }
  return null;
}

/**
 * Consumos con tarjeta aptos para asociar como cobro recurrente (SOLO LECTURA): sin pagos, reintegros ni cuotas.
 * @returns [{ id, origen:'tarjeta', fecha, monto, moneda, clave, etiqueta, tarjeta, mesPago }]
 */
export function cobrosDeTarjeta(movimientos = [], resumenes = []) {
  const porId = new Map((resumenes || []).map((r) => [r.id, r]));
  const vistos = new Set();
  const out = [];
  (movimientos || []).forEach((m) => {
    if (!m || m.es_pago || vistos.has(m.id)) return;
    if (m.es_cuota && Number(m.total_cuotas) > 1) return;
    const pesos = Number(m.monto_pesos) || 0; const usd = Number(m.monto_dolares) || 0;
    if (pesos <= 0 && usd <= 0) return;
    const texto = m.referencia_original || m.referencia_limpia || '';
    const clave = claveComercio(texto);
    if (!clave) return;
    vistos.add(m.id);
    const r = porId.get(m.resumen_id);
    const fecha = m.fecha_compra || null;
    out.push({
      id: `t:${m.id}`, origen: 'tarjeta', fecha, monto: r2(pesos > 0 ? pesos : usd), moneda: pesos > 0 ? 'ARS' : 'USD',
      clave, ref: refNumerica(texto), etiqueta: m.referencia_limpia || texto, tarjeta: m.tarjeta_label || m.tarjeta || '', fuente: `tarjeta:${m.tarjeta || ''}`,
      mesPago: mesDePagoResumen(r) || (m.anio_resumen && m.mes_resumen ? mesDePagoResumen({ anio: m.anio_resumen, mes: m.mes_resumen }) : null)
    });
  });
  return out;
}
