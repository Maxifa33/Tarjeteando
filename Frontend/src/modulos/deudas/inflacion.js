import { tnaAMensual, teaDesdeMensual } from './financiera.js';

/**
 * Inflación (IPC nivel general, INDEC) y tasas de referencia. Funciones puras.
 * Variaciones en % (1,9 = 1,9 %). Filas de entrada: { periodo: 'YYYY-MM-DD', variacion, interanual? }.
 */

export const claveMes = (periodo) => String(periodo).slice(0, 7);
const sumaMes = (k, d) => {
  const [y, m] = k.split('-').map(Number);
  const t = y * 12 + (m - 1) + d;
  return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`;
};

/** Acumula variaciones mensuales (%): interés compuesto. */
export const acumular = (vars) => (vars.reduce((a, v) => a * (1 + v / 100), 1) - 1) * 100;

/** Tasa real (%) = (1 + nominal) / (1 + inflación) − 1. */
export const tasaReal = (nominalPct, inflPct) => ((1 + nominalPct / 100) / (1 + inflPct / 100) - 1) * 100;

/** TEA (%) desde TNA (%), capitalización mensual (misma convención que financiera.js). */
export const teaDesdeTna = (tnaPct) => teaDesdeMensual(tnaAMensual(tnaPct));

/**
 * 13 meses terminando en el último mes con dato (el primero es el mismo mes del año anterior).
 * Un mes sin dato queda con valor null (el gráfico corta la línea; no se inventa).
 */
export function serie13(filas) {
  const mapa = new Map();
  for (const f of filas || []) {
    const v = Number(f.variacion);
    if (Number.isFinite(v)) mapa.set(claveMes(f.periodo), { v, ia: f.interanual == null ? null : Number(f.interanual) });
  }
  if (!mapa.size) return null;
  const ultimo = [...mapa.keys()].sort().pop();
  return Array.from({ length: 13 }, (_, i) => {
    const mes = sumaMes(ultimo, i - 12);
    const d = mapa.get(mes);
    return { mes, valor: d ? d.v : null, interanual: d ? d.ia : null };
  });
}

/**
 * Resumen para mostrar y para comparar tasas.
 *  - interanual: la oficial del INDEC si está cargada; si no, recompuesta (aprox. ±0,1 pp) con `aprox: true`.
 *  - ritmo: últimos 3 meses anualizados (cómo viene la inflación hoy).
 */
export function resumenInflacion(filas) {
  const serie = serie13(filas);
  if (!serie) return null;
  const ult = serie[12];
  const ult12 = serie.slice(1).map((p) => p.valor);
  const ult3 = serie.slice(10).map((p) => p.valor);
  const completa = (a) => a.every((v) => v != null);
  const oficial = ult.interanual;
  const interanual = oficial != null ? oficial : (completa(ult12) ? acumular(ult12) : null);
  return {
    serie, ultimo: ult, anterior: serie[0], mensualPrevio: serie[11],
    interanual, aprox: oficial == null && interanual != null,
    ritmo: completa(ult3) ? ((1 + acumular(ult3) / 100) ** 4 - 1) * 100 : null,
    faltantes: serie.filter((p) => p.valor == null).length
  };
}

/**
 * Compara una TNA (%) con la inflación. `real*` > 0 = la tasa le gana a la inflación.
 * Para una inversión, > 0 es bueno. Para una deuda, > 0 es que te cuesta más que la inflación.
 */
export function compararConInflacion(tnaPct, resumen) {
  const tea = teaDesdeTna(tnaPct);
  return {
    tea,
    realInteranual: resumen?.interanual != null ? tasaReal(tea, resumen.interanual) : null,
    realRitmo: resumen?.ritmo != null ? tasaReal(tea, resumen.ritmo) : null
  };
}

/** Cuánto pierde por año (en valor real, %) una deuda o plata sin interés frente a la inflación. */
export const licuacionAnual = (inflPct) => tasaReal(0, inflPct);

const BANCOS = [
  ['BANCO DE LA NACION ARGENTINA', 'Banco Nación'], ['BANCO DE LA PROVINCIA DE BUENOS AIRES', 'Banco Provincia'],
  ['BANCO DE LA CIUDAD DE BUENOS AIRES', 'Banco Ciudad'], ['BANCO DE GALICIA Y BUENOS AIRES S.A.', 'Galicia'],
  ['BANCO SANTANDER ARGENTINA S.A.', 'Santander'], ['BANCO BBVA ARGENTINA S.A.', 'BBVA'],
  ['BANCO MACRO S.A.', 'Macro'], ['BANCO CREDICOOP COOPERATIVO LIMITADO', 'Credicoop'],
  ['BANCO PATAGONIA S.A.', 'Patagonia'], ['BANCO HIPOTECARIO S.A.', 'Hipotecario']
];
const BILLETERAS_PF = [['UALA', 'Ualá'], ['Brubank', 'Brubank']];
const norm = (s) => String(s || '').trim().toUpperCase();

/**
 * Tabla de referencia: bancos grandes (plazo fijo 30 d, clientes) y billeteras. TNA en %.
 * `vieja` = dato con más de 7 días (la fuente dejó de actualizar).
 */
export function armarTasas({ plazoFijo = [], billeteras = [], hoy }) {
  const dias = (f) => Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${String(f).slice(0, 10)}T00:00:00Z`)) / 86400000);
  const pf = new Map(plazoFijo.map((r) => [norm(r.entidad), r]));
  const filas = [];
  const agregar = (id, nombre, tipo, producto, tnaFrac, fecha) => {
    const tna = Number(tnaFrac) * 100;
    if (!Number.isFinite(tna) || tna <= 0) return;
    filas.push({ id, nombre, tipo, producto, tna, fecha, vieja: hoy ? dias(fecha) > 7 : false });
  };
  for (const [clave, nombre] of BANCOS) { const r = pf.get(norm(clave)); if (r) agregar(clave, nombre, 'banco', 'Plazo fijo 30 días', r.tna, r.fecha); }
  for (const [clave, nombre] of BILLETERAS_PF) { const r = pf.get(norm(clave)); if (r) agregar(clave, nombre, 'billetera', 'Plazo fijo 30 días', r.tna, r.fecha); }
  for (const b of billeteras) agregar(b.entidad, b.entidad, 'billetera', b.producto, b.tna, b.fecha);
  return filas.sort((a, b) => b.tna - a.tna);
}

/** es-AR: 33,4 % — con `signo`, +1,2 % / −9,7 %. */
export function fmtPct(n, { dec = 1, signo = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '—';
  const r = Math.round(Math.abs(n) * 10 ** dec) / 10 ** dec;
  const txt = r.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const s = n < 0 && r !== 0 ? '−' : signo && r !== 0 ? '+' : '';
  return `${s}${txt} %`;
}
