import { refNumerica } from '../puente/tarjeteando.js';

/**
 * Cobros recurrentes asociados a una inversión (ej. la prima de un seguro con ahorro). Funciones puras.
 * Vínculo = { inversion_id, origen: 'tarjeta'|'cuenta', clave, ref? } — ref = número estable de la referencia
 * (N° de póliza) cuando hace falta distinguir dos cobros del mismo comercio.
 * Cobro = { id, origen, fecha 'YYYY-MM-DD', monto, moneda, clave, ref, etiqueta, fuente, mesPago? }.
 */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
const masMeses = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const fin = new Date(y, m - 1 + n + 1, 0).getDate();
  const x = new Date(y, m - 1 + n, Math.min(d, fin));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const MESES_FREC = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };

export const COTIZACIONES_APORTES = [
  { id: 'oficial_15', label: 'Oficial vendedor del día 15 (o hábil anterior)', nota: 'Así calcula Zurich el VRU$S.' },
  { id: 'oficial_dia', label: 'Oficial vendedor del día del cobro' },
  { id: 'mep_dia', label: 'MEP del día del cobro' }
];

// Palabras de los extractos bancarios que no identifican a quién le pagás.
const GENERICAS = new Set(['debito', 'debitos', 'deb', 'db', 'dbt', 'automatico', 'automatica', 'aut', 'auto', 'adhesion', 'pago', 'pagos', 'pag', 'de', 'del', 'la', 'el', 'los', 'las',
  'a', 'en', 'por', 'con', 'y', 'al', 'transferencia', 'transf', 'trf', 'enviada', 'recibida', 'compra', 'servicio', 'servicios', 'serv', 'cuota', 'cuotas', 'mensual', 'cargo', 'cargos',
  'cuenta', 'cta', 'cte', 'ca', 'cc', 'nro', 'n', 'numero', 'ref', 'op', 'operacion', 'mp', 'qr', 'online', 'web', 'debin', 'visa', 'master', 'mastercard', 'amex', 'tarjeta', 'tc', 'td',
  'mercado', 'mercadopago', 'banco', 'galicia', 'santander', 'bbva', 'macro', 'nacion', 'provincia', 'ciudad', 'icbc', 'hsbc', 'patagonia', 'supervielle', 'credicoop', 'uala', 'brubank', 'naranja', 'lemon', 'personal', 'modo', 'cocos', 'billetera', 'virtual', 'cvu', 'cbu', 'alias']);

/** Clave de un movimiento de cuenta: palabras distintivas en minúsculas, sin números ni palabras genéricas. */
export function claveCuenta(texto = '') {
  const t = String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  return [...new Set(t.filter((w) => !/\d/.test(w) && w.length > 1 && !GENERICAS.has(w)))].slice(0, 4).join(' ');
}

/** Movimientos de cuenta aptos como cobro: gastos confirmados en salida, con algo que identifique al destinatario. */
export function cobrosDeCuenta(movs = []) {
  return (movs || []).filter((m) => m.tipo === 'gasto' && m.direccion === 'salida' && m.estado !== 'revisar' && Number(m.monto) > 0)
    .map((m) => {
      const texto = [m.contraparte, m.descripcion].filter(Boolean).join(' ') || m.descripcion_original || '';
      return { id: `c:${m.id}`, movId: m.id, origen: 'cuenta', fecha: m.fecha, monto: r2(m.monto), moneda: m.moneda || 'ARS', clave: claveCuenta(texto),
        ref: refNumerica(`${texto} ${m.descripcion_original || ''}`), etiqueta: m.contraparte || m.descripcion || texto, cuenta: m.cuentas?.nombre || m.cuenta?.nombre || '', fuente: `cuenta:${m.cuenta_id || ''}` };
    }).filter((c) => c.clave);
}

const claveV = (v) => `${v.origen}|${v.clave}`;

/** ¿El cobro `c` es del vínculo `v`? Un vínculo sin ref se queda con todo lo de su clave salvo las refs que tomó otro vínculo. */
function coincide(v, c, refsTomadas) {
  if (v.origen !== c.origen || v.clave !== c.clave) return false;
  if (v.ref) return c.ref === v.ref;
  return !(c.ref && refsTomadas.get(claveV(v))?.has(c.ref));
}
const refsPorClave = (todos = []) => {
  const m = new Map();
  todos.filter((v) => v.ref).forEach((v) => { if (!m.has(claveV(v))) m.set(claveV(v), new Set()); m.get(claveV(v)).add(v.ref); });
  return m;
};

/**
 * Candidatos para asociar: cobros agrupados por origen + clave (y por N° de referencia cuando se repite mes a mes),
 * los recurrentes primero. Excluye lo que ya está asociado a CUALQUIER inversión. `pista` (aseguradora) sube a los que la contienen.
 */
export function candidatosCobro(cobros = [], { pista = '', vinculos = [] } = {}) {
  const tomadas = refsPorClave(vinculos);
  const libre = (c) => !vinculos.some((v) => coincide(v, c, tomadas));
  const porClave = new Map();
  cobros.filter(libre).forEach((c) => { const k = claveV(c); if (!porClave.has(k)) porClave.set(k, []); porClave.get(k).push(c); });
  const grupos = [];
  const armar = (cs, ref) => {
    const u = cs.reduce((a, c) => (!a || c.fecha > a.fecha ? c : a), null);
    return { origen: cs[0].origen, clave: cs[0].clave, ref, etiqueta: u.etiqueta, n: cs.length, meses: new Set(cs.map((c) => String(c.fecha).slice(0, 7))).size, ultimo: u, fuente: u.tarjeta || u.cuenta || '' };
  };
  porClave.forEach((cs) => {
    // Referencias estables (aparecen en 2+ meses): cada una es un cobro distinto (ej. dos pólizas Zurich).
    const mesesPorRef = new Map();
    cs.forEach((c) => { if (c.ref) { if (!mesesPorRef.has(c.ref)) mesesPorRef.set(c.ref, new Set()); mesesPorRef.get(c.ref).add(String(c.fecha).slice(0, 7)); } });
    const estables = [...mesesPorRef].filter(([, ms]) => ms.size >= 2).map(([r]) => r);
    if (estables.length >= 1 && (estables.length > 1 || cs.some((c) => c.ref !== estables[0]))) {
      estables.forEach((r) => grupos.push(armar(cs.filter((c) => c.ref === r), r)));
      const resto = cs.filter((c) => !estables.includes(c.ref));
      if (resto.length) grupos.push(armar(resto, null));
    } else grupos.push(armar(cs, estables[0] || null));
  });
  const p = String(pista || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().split(/\s+/)[0] || '';
  return grupos.map((g) => ({ ...g, sugerido: p.length >= 3 && g.clave.includes(p) }))
    .sort((a, b) => (b.sugerido - a.sugerido) || (b.meses - a.meses) || String(b.ultimo.fecha).localeCompare(String(a.ultimo.fecha)));
}

/**
 * Cobros de una inversión según sus vínculos (`todos` = vínculos de todas las inversiones), ordenados por fecha.
 * Si la inversión tiene vínculos de tarjeta y de cuenta, un cobro de cuenta igual a uno de tarjeta (±5 días, ±1 %) se descarta:
 * es el mismo pago visto dos veces.
 */
export function cobrosDe(vinculos = [], cobros = [], todos = vinculos) {
  const tomadas = refsPorClave(todos);
  const vistos = new Set();
  const cs = cobros.filter((c) => c.fecha && !vistos.has(c.id) && vinculos.some((v) => coincide(v, c, tomadas)) && vistos.add(c.id));
  const tj = cs.filter((c) => c.origen === 'tarjeta');
  return cs.filter((c) => c.origen !== 'cuenta' || !tj.some((t) => t.moneda === c.moneda && Math.abs(dias(t.fecha, c.fecha)) <= 5 && Math.abs(t.monto - c.monto) <= t.monto * 0.01))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Cotización (venta) para pasar un cobro en pesos a dólares. `historico`: { oficial: [{fecha, venta}], bolsa: [...] } ordenados.
 * oficial_15: la del último día 15 (o hábil anterior) en o antes del cobro — regla del VRU$S de Zurich.
 */
export function cotizacionPara(regla, fecha, historico) {
  const casa = regla === 'mep_dia' ? 'bolsa' : 'oficial';
  const serie = historico?.[casa];
  if (!serie?.length || !fecha) return null;
  let tope = fecha;
  if (regla === 'oficial_15') {
    const [y, m, d] = fecha.split('-').map(Number);
    const ym = d >= 15 ? [y, m] : (m === 1 ? [y - 1, 12] : [y, m - 1]);
    tope = `${ym[0]}-${String(ym[1]).padStart(2, '0')}-15`;
  }
  let lo = 0; let hi = serie.length - 1; let ok = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (serie[mid].fecha <= tope) { ok = mid; lo = mid + 1; } else hi = mid - 1; }
  if (ok < 0 || dias(serie[ok].fecha, tope) > 7) return null; // hueco en el historial: no adivinar
  const v = Number(serie[ok].venta);
  return v > 0 ? { valor: v, fecha: serie[ok].fecha, casa } : null;
}

/** Frecuencia en meses: la cargada o, si no hay, la que surge de la distancia típica entre cobros. */
export function frecuenciaMeses(inv, cobros = []) {
  const guardada = MESES_FREC[inv.aporte_frecuencia] || null;
  // Con 3+ cobros manda lo que muestran los datos (la frecuencia del form viene en 'mensual' por defecto).
  if (cobros.length >= (guardada ? 3 : 2)) {
    const gaps = cobros.slice(1).map((c, k) => dias(cobros[k].fecha, c.fecha)).filter((g) => g > 0).sort((a, b) => a - b);
    if (gaps.length) {
      const med = gaps[Math.floor(gaps.length / 2)];
      return [1, 3, 6, 12].reduce((best, m) => (Math.abs(m * 30.44 - med) < Math.abs(best * 30.44 - med) ? m : best), 1);
    }
  }
  return guardada || 1;
}

/**
 * Aportes de una inversión a partir de sus cobros, en la moneda de la póliza.
 *  - Cobros en pesos de una póliza en U$S: se pasan con la regla de cotización (sin cotización → hueco).
 *  - Huecos entre el primer y el último cobro (resumen sin importar, cambio de tarjeta): se estiman con el cobro más cercano.
 *  - Antes del primer cobro importado: con "total aportado" cargado, lo que falta se reparte en los períodos previos;
 *    sin él, en U$S se estima con el aporte; en pesos NO (los aportes se indexan) → `faltaBase`.
 * @returns { flujos:[{fecha, monto, estimado}], total, reales, estimados, huecos, sinCotizacion, faltaBase, ultimo, conversion, frec }
 */
export function aportesDe(inv, cobros = [], historico = null, { hasta = null } = {}) {
  const moneda = inv.moneda || 'ARS';
  const regla = inv.cotizacion_aportes || 'oficial_15';
  const frec = frecuenciaMeses(inv, cobros);
  const medio = frec * 15; // medio período, en días
  const reales = []; let sinCotizacion = 0;
  cobros.forEach((c) => {
    if (hasta && c.fecha > hasta) return;
    if (c.moneda === moneda) { reales.push({ fecha: c.fecha, monto: c.monto, estimado: false }); return; }
    if (moneda === 'USD' && c.moneda === 'ARS') {
      const q = cotizacionPara(regla, c.fecha, historico);
      if (q) { reales.push({ fecha: c.fecha, monto: r2(c.monto / q.valor), estimado: false, cotizacion: q }); return; }
    }
    sinCotizacion += 1;
  });
  const base = { reales: reales.length, estimados: 0, huecos: 0, sinCotizacion, faltaBase: false, ultimo: cobros.length ? cobros[cobros.length - 1] : null, frec,
    frecInferida: !!inv.aporte_frecuencia && MESES_FREC[inv.aporte_frecuencia] !== frec,
    conversion: moneda === 'USD' && cobros.some((c) => c.moneda === 'ARS') ? regla : null };
  if (!reales.length) return { ...base, flujos: [], total: 0 };
  const flujos = [...reales];
  // Huecos: períodos esperados entre el primer y el último cobro sin ningún cobro cerca.
  const primero = reales[0].fecha; const ultimo = reales[reales.length - 1].fecha;
  for (let k = 1, f = masMeses(primero, frec); k < 600 && f < ultimo && dias(f, ultimo) > medio; k++, f = masMeses(primero, k * frec)) {
    if (reales.some((r) => Math.abs(dias(r.fecha, f)) <= medio)) continue;
    const cerca = reales.reduce((a, r) => (Math.abs(dias(r.fecha, f)) < Math.abs(dias(a.fecha, f)) ? r : a));
    flujos.push({ fecha: f, monto: cerca.monto, estimado: true }); base.huecos += 1;
  }
  // Sin fecha de alta ni total aportado no se sabe si hubo aportes antes de tus datos: no inventar ganancia.
  if (!inv.fecha_inicio && inv.capital == null) base.faltaBase = true;
  // Antes del primer cobro importado.
  const previos = [];
  if (inv.fecha_inicio && dias(inv.fecha_inicio, primero) > medio) {
    for (let k = 0, f = inv.fecha_inicio; k < 600 && dias(f, primero) > medio; k++, f = masMeses(inv.fecha_inicio, k * frec)) previos.push(f);
  }
  if (previos.length) {
    const cap = inv.capital == null ? null : Number(inv.capital);
    const sumaPost = flujos.reduce((s, x) => s + x.monto, 0);
    if (cap != null && cap > sumaPost) previos.forEach((f) => flujos.push({ fecha: f, monto: r2((cap - sumaPost) / previos.length), estimado: true }));
    else if (moneda === 'USD' && Number(inv.aporte_monto) > 0) previos.forEach((f) => flujos.push({ fecha: f, monto: Number(inv.aporte_monto), estimado: true }));
    else base.faltaBase = true; // en pesos (o sin aporte cargado) no se puede inventar lo aportado antes de tus datos
    base.estimados = flujos.filter((x) => x.estimado).length - base.huecos;
  }
  flujos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { ...base, flujos, total: r2(flujos.reduce((s, x) => s + x.monto, 0)) };
}

/**
 * Rendimiento anual (%) con flujos fechados: la tasa r tal que Σ monto·(1+r)^(días hasta `hasta`/365) = valor.
 * Devuelve { anual, corto, dudoso } o null.
 */
export function rendimientoFlujos(flujos = [], valor, hasta) {
  const fs = flujos.filter((f) => f.monto > 0 && f.fecha <= hasta);
  if (!fs.length || valor == null || !Number.isFinite(Number(valor))) return null;
  valor = Number(valor);
  if (dias(fs[0].fecha, hasta) < 365) return { anual: null, corto: true, dudoso: false };
  if (valor <= 0) return { anual: -100, corto: false, dudoso: false };
  const t = fs.map((f) => Math.max(0, dias(f.fecha, hasta)) / 365);
  const vf = (r) => fs.reduce((s, f, i) => s + f.monto * (1 + r) ** t[i], 0);
  let lo = -0.9999; let hi = 1;
  while (vf(hi) < valor && hi < 64) hi *= 2;
  if (vf(hi) < valor) return { anual: null, corto: false, dudoso: true };
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (vf(m) > valor) hi = m; else lo = m; }
  const anual = ((lo + hi) / 2) * 100;
  if (anual > 1000) return { anual: null, corto: false, dudoso: true };
  return { anual: Math.round(anual * 10) / 10 + 0, corto: false, dudoso: false };
}

/**
 * ¿Dejó de cobrarse? Solo si hay datos importados de ESA misma fuente (esa tarjeta o esa cuenta) posteriores a cuando
 * tendría que haber llegado el próximo cobro. `ultimaPorFuente`: { 'tarjeta:visa': '2026-08-30', 'cuenta:<id>': … }.
 */
export function cobroAtrasado(inv, cobros = [], ultimaPorFuente = {}, hoy) {
  if (!cobros.length) return null;
  const u = cobros[cobros.length - 1];
  const esperado = masMeses(u.fecha, frecuenciaMeses(inv, cobros));
  const datosHasta = ultimaPorFuente[u.fuente];
  if (!datosHasta) return null;
  const limite = datosHasta < hoy ? datosHasta : hoy;
  return dias(esperado, limite) > 15 ? { esperado, ultimo: u } : null;
}

/** Aportes del mes para Presupuestos: con tarjeta por mes de pago del resumen; desde cuentas por fecha. */
export function aportesDelMes(mesKey, vinculos = [], cobrosTarjeta = [], cobrosCuenta = []) {
  const porInv = new Map();
  vinculos.forEach((v) => { if (!porInv.has(v.inversion_id)) porInv.set(v.inversion_id, []); porInv.get(v.inversion_id).push(v); });
  let tarjeta = 0; let cuenta = 0;
  porInv.forEach((vs) => {
    cobrosDe(vs, [...cobrosTarjeta, ...cobrosCuenta], vinculos).forEach((c) => {
      if (c.moneda === 'USD') return;
      if (c.origen === 'tarjeta' && c.mesPago === mesKey) tarjeta += c.monto;
      if (c.origen === 'cuenta' && String(c.fecha).startsWith(mesKey)) cuenta += c.monto;
    });
  });
  return { tarjeta: r2(tarjeta), cuenta: r2(cuenta), total: r2(tarjeta + cuenta) };
}
