import { r2, parseMonto } from '../cuentas/util.js';
import { rendimientoFlujos } from './aportes.js';

/**
 * Alcancía: lógica pura (sin Supabase).
 * Metas: lo juntado = lo que ya tenías + aportes a mano + movimientos de la reserva vinculada.
 * Inversiones: valuadas con el último cierre guardado en `precios` (job diario).
 */

const mesDe = (iso) => String(iso || '').slice(0, 7);
const difMeses = (a, b) => { const [ya, ma] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };

/** Neto de una reserva: lo que entró (salida de la cuenta hacia la reserva) menos lo que sacaste. */
export function netoReserva(movs = [], bolsilloId) {
  return r2(movs.filter((m) => m.tipo === 'reserva' && m.bolsillo_id === bolsilloId)
    .reduce((s, m) => s + (m.direccion === 'salida' ? 1 : -1) * Number(m.monto), 0));
}

/** Aportes por mes 'YYYY-MM' → neto (a mano + reserva). */
function aportesPorMes(meta, aportes, movs) {
  const mapa = new Map();
  const sumar = (k, v) => mapa.set(k, r2((mapa.get(k) || 0) + v));
  aportes.filter((a) => a.meta_id === meta.id).forEach((a) => sumar(mesDe(a.fecha), Number(a.monto)));
  if (meta.bolsillo_id) movs.filter((m) => m.tipo === 'reserva' && m.bolsillo_id === meta.bolsillo_id)
    .forEach((m) => sumar(mesDe(m.fecha), (m.direccion === 'salida' ? 1 : -1) * Number(m.monto)));
  return mapa;
}

/**
 * Estado de una meta. `hoy` 'YYYY-MM-DD' (o solo `hoyMes`).
 * `saldosReserva`: { bolsilloId: { saldo, ancla } } (ver reservas.js). Con una reserva vinculada que tiene saldo propio (manual o
 * con saldo real cargado), lo juntado = a mano + saldo de la reserva y `saldo_inicial` se ignora (si no, se contaría dos veces).
 * Una reserva de Mercado Pago sin saldo real conserva el comportamiento de siempre (inicial + movimientos).
 * porMes: cuánto poner cada mes (contando este) para llegar en la fecha, calculado con lo que tenías al empezar el mes
 * (si no, aportar este mes "bajaría" la cuota). esteMes: lo que falta poner este mes.
 * ritmo: promedio de los últimos meses cerrados (hasta 3, desde que existe la meta).
 */
export function estadoMeta(meta, { aportes = [], movs = [], hoyMes, hoy, saldosReserva = null }) {
  hoyMes = hoyMes || String(hoy).slice(0, 7);
  hoy = hoy || `${hoyMes}-01`;
  const manual = r2(aportes.filter((a) => a.meta_id === meta.id).reduce((s, a) => s + Number(a.monto), 0));
  const propia = meta.bolsillo_id && saldosReserva ? saldosReserva[meta.bolsillo_id] : null;
  const reserva = propia?.ancla ? propia.saldo : meta.bolsillo_id ? netoReserva(movs, meta.bolsillo_id) : 0;
  const inicial = propia?.ancla ? 0 : Number(meta.saldo_inicial || 0);
  const juntado = r2(Math.max(0, inicial + manual + reserva));
  const objetivo = Number(meta.objetivo);
  const falta = r2(Math.max(0, objetivo - juntado));
  const out = { juntado, manual, reserva, inicial, falta, progreso: objetivo > 0 ? Math.min(1, juntado / objetivo) : 0, cumplida: falta <= 0, porMes: null, esteMes: null, meses: null, vencida: false, ritmo: 0, llegaEn: null };
  const pm = aportesPorMes(meta, aportes, movs);
  const esteMes = pm.get(hoyMes) || 0;

  if (meta.fecha_objetivo && !out.cumplida) {
    if (meta.fecha_objetivo < hoy) out.vencida = true;
    else {
      // El mes de la fecha cuenta si la fecha es después del 10 (hay tiempo de aportar ese mes).
      const d = difMeses(hoyMes, mesDe(meta.fecha_objetivo)) + (Number(meta.fecha_objetivo.slice(8, 10)) > 10 ? 1 : 0);
      out.meses = Math.max(1, d);
      // Un retiro este mes no "baja" lo que hay que poner: se toma el menor de los dos saldos.
      const faltaAlEmpezar = Math.max(0, objetivo - Math.min(juntado, juntado - esteMes));
      out.porMes = r2(faltaAlEmpezar / out.meses);
      out.esteMes = r2(Math.max(0, Math.min(falta, out.porMes - esteMes)));
    }
  }
  // Ritmo: meses cerrados desde que existe la meta (o su primer movimiento), hasta 3.
  const creada = meta.created_at ? (() => { const d = new Date(meta.created_at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })() : null; // en hora local
  const inicios = [creada, ...pm.keys()].filter(Boolean).sort();
  const desde = inicios[0] || hoyMes;
  const cerrados = Math.min(3, Math.max(0, difMeses(desde, hoyMes)));
  if (cerrados > 0) {
    const ult = Array.from({ length: cerrados }, (_, i) => pm.get(mesMas(hoyMes, -(i + 1))) || 0);
    out.ritmo = r2(ult.reduce((s, v) => s + v, 0) / cerrados);
  }
  if (!out.cumplida && out.ritmo > 0) out.llegaEn = Math.ceil(falta / out.ritmo);
  return out;
}

export function mesMas(mesKey, n) {
  const [a, m] = mesKey.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * ¿Te alcanza para todas las metas con fecha? Solo metas en pesos.
 * `capacidad`: lo que te quedó en promedio por mes (Presupuestos, meses cerrados). null = sin datos.
 */
export function planMetas(metas, estados, capacidad) {
  const conFecha = metas.filter((m) => m.estado === 'activa' && m.moneda === 'ARS' && estados[m.id]?.porMes > 0)
    .sort((a, b) => (a.fecha_objetivo < b.fecha_objetivo ? -1 : 1));
  const necesario = r2(conFecha.reduce((s, m) => s + estados[m.id].porMes, 0));
  if (capacidad == null) return { necesario, capacidad: null, alcanza: null, diferencia: null, cubiertas: [] };
  // Si no alcanza para todas: cuáles sí, en orden de fecha.
  let resto = Math.max(0, capacidad); const cubiertas = [];
  for (const m of conFecha) { if (resto + 0.005 >= estados[m.id].porMes) { resto -= estados[m.id].porMes; cubiertas.push(m.id); } else break; }
  return { necesario, capacidad: r2(capacidad), alcanza: capacidad + 0.005 >= necesario, diferencia: r2(capacidad - necesario), cubiertas };
}

export const TIPOS_INVERSION = [
  { id: 'plazo_fijo', label: 'Plazo fijo' },
  { id: 'fci', label: 'Fondo (FCI)' },
  { id: 'dolar', label: 'Dólares' },
  { id: 'cedear', label: 'CEDEAR' },
  { id: 'accion', label: 'Acción' },
  { id: 'bono', label: 'Bono / ON / Letra' },
  { id: 'cripto', label: 'Cripto' },
  { id: 'seguro', label: 'Seguro con ahorro (vida / retiro)' },
  { id: 'otro', label: 'Otro' }
];
/** Seguros con componente de ahorro que se venden en Argentina. */
export const SUBTIPOS_SEGURO = [
  { id: 'unit_linked', label: 'Vida con inversión en fondos (unit linked)', ej: 'Zurich Invest Future / Advanced' },
  { id: 'universal_life', label: 'Vida universal (rendimiento mínimo garantizado)', ej: 'Orígenes Universal Life' },
  { id: 'capitalizacion', label: 'Vida con capitalización', ej: 'Sancor Vida Ahorro' },
  { id: 'dotal', label: 'Vida mixto / dotal (paga al vencimiento o fallecimiento)', ej: 'La Segunda Vida Dotal' },
  { id: 'retiro', label: 'Seguro de retiro', ej: 'Galicia, San Cristóbal, Orígenes' }
];
export const FRECUENCIAS = [
  { id: 'mensual', label: 'por mes', meses: 1 }, { id: 'trimestral', label: 'por trimestre', meses: 3 },
  { id: 'semestral', label: 'por semestre', meses: 6 }, { id: 'anual', label: 'por año', meses: 12 }
];
const mesesEntre = (desde, hasta) => {
  const [a1, m1, d1] = desde.split('-').map(Number); const [a2, m2, d2] = hasta.split('-').map(Number);
  const finMes = new Date(a2, m2, 0).getDate(); // alta el 31: en meses cortos el aporte cae el último día
  return Math.max(0, (a2 - a1) * 12 + (m2 - m1) + (d2 >= Math.min(d1, finMes) ? 1 : 0)); // cuenta el aporte del mes de alta
};
/** Total aportado estimado: aporte × cantidad de pagos desde el alta. */
export function aportadoEstimado(inv, hoy) {
  const f = FRECUENCIAS.find((x) => x.id === (inv.aporte_frecuencia || 'mensual'));
  if (!(Number(inv.aporte_monto) > 0) || !inv.fecha_inicio || !f) return null;
  const pagos = Math.ceil(mesesEntre(inv.fecha_inicio, hoy) / f.meses);
  if (!pagos) return null;
  return r2(Number(inv.aporte_monto) * pagos);
}
/**
 * Rendimiento anual de un seguro con ahorro (TIR): la tasa que hace que los aportes iguales, hechos al inicio de cada
 * período, valgan `valor` a la fecha `hasta`. Usa el tiempo real transcurrido (el aporte recién hecho no capitaliza).
 * `aportado` = total aportado; si no coincide con aporte × pagos, se usa el aporte promedio (estimado).
 * Devuelve { anual (%), estimado, corto, dudoso } o null.
 */
export function rendimientoSeguro(inv, valor, aportado, hasta) {
  const f = FRECUENCIAS.find((x) => x.id === (inv.aporte_frecuencia || 'mensual'));
  if (valor == null || !Number.isFinite(Number(valor)) || !inv.fecha_inicio || !f || !(Number(inv.aporte_monto) > 0)) return null;
  valor = Number(valor);
  const meses = mesesEntre(inv.fecha_inicio, hasta);
  const n = Math.ceil(meses / f.meses);
  if (!n) return null;
  if (meses < 12) return { anual: null, corto: true, estimado: false, dudoso: false };
  const teorico = Number(inv.aporte_monto) * n;
  const total = aportado ?? teorico;
  const estimado = aportado == null || Math.abs(total - teorico) > teorico * 0.05; // el aporte cambió en el tiempo
  const a = total / n;
  if (!(a > 0)) return null;
  const T = Math.max(n - 1, dias(inv.fecha_inicio, hasta) / 30.4375 / f.meses); // períodos desde el primer aporte
  const vf = (p) => { let t = 0; for (let k = 0; k < n; k++) t += a * (1 + p) ** (T - k); return t; };
  let anual;
  if (valor <= 0) anual = -100;
  else {
    let lo = -0.9999; let hi = 1;
    while (vf(hi) < valor && hi < 64) hi *= 2;
    if (vf(hi) < valor) return { anual: null, corto: false, estimado, dudoso: true };
    for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (vf(m) > valor) hi = m; else lo = m; }
    anual = ((1 + (lo + hi) / 2) ** (12 / f.meses) - 1) * 100;
  }
  if (anual > 1000) return { anual: null, corto: false, estimado, dudoso: true };
  return { anual: Math.round(anual * 10) / 10 + 0, corto: false, estimado, dudoso: false }; // + 0: sin "−0"
}

const mesesDif = (a, b) => { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
/**
 * Inflación anualizada (%) entre dos fechas con la serie mensual del INDEC (Map 'YYYY-MM' → variación %).
 * Toma desde el mes del alta hasta el mes de `hasta`; si los últimos 1–2 meses no se publicaron todavía, usa hasta
 * el último publicado. Si falta cualquier otro mes, null (no se puede comparar).
 */
export function inflacionDelPeriodo(serie, desde, hasta) {
  if (!serie?.size || !desde || !hasta) return null;
  const meses = [];
  let [a, m] = desde.slice(0, 7).split('-').map(Number);
  const fin = hasta.slice(0, 7);
  for (let g = 0; g < 1200; g++) { const k = `${a}-${String(m).padStart(2, '0')}`; meses.push(k); if (k >= fin) break; m += 1; if (m > 12) { m = 1; a += 1; } }
  while (meses.length && !serie.has(meses[meses.length - 1])) meses.pop(); // meses que el INDEC todavía no publicó
  if (!meses.length || mesesDif(meses[meses.length - 1], fin) > 2) return null;
  if (meses.length < 12 || meses.some((k) => !Number.isFinite(serie.get(k)))) return null;
  const acum = meses.reduce((x, k) => x * (1 + serie.get(k) / 100), 1);
  return (acum ** (12 / meses.length) - 1) * 100;
}

export const CASAS_DOLAR = [
  { id: 'bolsa', label: 'MEP' }, { id: 'oficial', label: 'Oficial' }, { id: 'blue', label: 'Blue' }, { id: 'cripto', label: 'Cripto' }, { id: 'contadoconliqui', label: 'CCL' }
];
const CON_PRECIO = new Set(['accion', 'cedear', 'bono', 'cripto', 'fci', 'dolar']);

const dias = (desde, hasta) => Math.max(0, Math.round((new Date(`${hasta}T12:00:00`) - new Date(`${desde}T12:00:00`)) / 86400000));
const masDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Precio guardado para una inversión, o null. `precios` = Map 'tipo|simbolo' → fila. */
export function precioDe(inv, precios) {
  if (!CON_PRECIO.has(inv.tipo) || !inv.simbolo) return null;
  return precios.get(`${inv.tipo}|${inv.simbolo}`) || null;
}

/**
 * Valor de una inversión en pesos y en dólares.
 * `mep`: dólar MEP compra (para pasar entre monedas). `hoy`: 'YYYY-MM-DD'.
 * capital está en `inv.moneda` (lo que pusiste); ganancia = valor en esa moneda − capital.
 */
export function valuar(inv, precios, { mep, hoy, inflacion = null, aportes = null }) { // inflacion: Map 'YYYY-MM' → variación % (INDEC)
  const conv = (v, de) => (de === 'USD' ? { ars: mep ? r2(v * mep) : null, usd: r2(v) } : { ars: r2(v), usd: mep ? r2(v / mep) : null });
  const cap = inv.capital == null ? null : Number(inv.capital);
  let nativo = null; let moneda = inv.moneda || 'ARS'; let estimado = false; let fechaPrecio = null; let sinPrecio = false; let vence = null;
  const q = Number(inv.cantidad || 0);
  const p = precioDe(inv, precios);

  if (inv.tipo === 'plazo_fijo' || (inv.tipo === 'fci' && !(q > 0 && p))) {
    // Interés simple con la TNA que cargaste (estimado).
    if (cap != null && inv.fecha_inicio) {
      const plazo = inv.plazo_dias || null;
      const d = Math.min(dias(inv.fecha_inicio, hoy), plazo || Infinity);
      nativo = r2(cap * (1 + ((Number(inv.tna) || 0) / 100) * d / 365));
      if (plazo) vence = masDias(inv.fecha_inicio, plazo);
    } else if (cap != null) nativo = cap; // sin fecha: lo que pusiste, sin intereses
    else sinPrecio = true;
    estimado = nativo != null;
  } else if (inv.tipo === 'seguro') {
    // Lo que cuenta es lo que te darían si rescatás hoy (los primeros años el rescate tiene penalidad).
    const cuenta = inv.valor_manual != null ? Number(inv.valor_manual) : null;
    const rescate = inv.valor_rescate != null ? Number(inv.valor_rescate) : null;
    nativo = rescate ?? cuenta;
    if (nativo == null) sinPrecio = true;
    const hasta = inv.valor_fecha || hoy;
    // Con cobros asociados (prima en la tarjeta o débito en la cuenta), lo aportado son esos cobros reales.
    const ap = aportes?.[inv.id];
    const pendiente = !!ap?.pendiente; // falta el historial del dólar para convertir los cobros: no mostrar números a medias
    const flujos = ap?.flujos?.filter((f) => f.fecha <= hasta) || [];
    const conCobros = !pendiente && flujos.some((f) => !f.estimado);
    const aportado = conCobros ? r2(flujos.reduce((x, f) => x + f.monto, 0)) : cap ?? aportadoEstimado(inv, hasta); // hasta la fecha del valor, no hasta hoy
    const v = nativo == null ? { ars: null, usd: null } : conv(nativo, moneda);
    const enCap = moneda === 'USD' ? v.usd : v.ars;
    // En pesos los aportes se indexan: sin el total aportado real (cargado o por cobros), ganancia y rendimiento serían inventados.
    const sinBase = pendiente || (conCobros ? !!ap.faltaBase : moneda === 'ARS' && cap == null);
    const gan = aportado != null && enCap != null && !sinBase ? r2(enCap - aportado) : null;
    const viejo = !inv.valor_fecha || dias(inv.valor_fecha, hoy) > 60;
    const tir = (valor) => {
      if (conCobros) { const r = rendimientoFlujos(flujos, valor, hasta); return r && { ...r, estimado: flujos.some((f) => f.estimado) }; }
      return rendimientoSeguro(inv, valor, cap, hasta);
    };
    const rinde = sinBase ? null : tir(nativo); // sobre lo que se muestra (rescate si hay)
    const rindeCuenta = sinBase || rescate == null || cuenta == null || rescate === cuenta ? null : tir(cuenta);
    // Real: contra la inflación anualizada del MISMO período (no la del último año).
    const inflPeriodo = moneda === 'ARS' && rinde?.anual != null ? inflacionDelPeriodo(inflacion, conCobros ? flujos[0].fecha : inv.fecha_inicio, hasta) : null;
    const real = inflPeriodo != null ? Math.round((((1 + rinde.anual / 100) / (1 + inflPeriodo / 100)) - 1) * 1000) / 10 + 0 : null;
    return { ...v, moneda, ganancia: gan, gananciaMoneda: moneda, gananciaPct: gan != null && aportado > 0 ? r2((gan / aportado) * 100) : null,
      estimado: false, fechaPrecio: null, // la fecha del seguro no es una cotización: no entra en "cotizaciones al cierre del…"
      sinPrecio: nativo == null, sinMep: nativo != null && v.ars == null, vence: null, vencido: false,
      seguro: { cuenta, rescate, aportado, aportadoEstimado: conCobros ? flujos.some((f) => f.estimado) : cap == null && aportado != null, conCobros, cobros: ap ? { reales: ap.reales, estimados: ap.estimados, huecos: ap.huecos, sinCotizacion: ap.sinCotizacion, conversion: ap.conversion, pendiente } : null, viejo, suma: inv.suma_asegurada != null ? Number(inv.suma_asegurada) : null, rinde, rindeCuenta, real, inflacion: inflPeriodo != null ? Math.round(inflPeriodo * 10) / 10 : null, faltaAportado: sinBase && !pendiente } };
  } else if (inv.tipo === 'otro') {
    nativo = inv.valor_manual != null ? Number(inv.valor_manual) : cap;
    if (nativo == null) sinPrecio = true;
  } else if (inv.tipo === 'dolar') {
    // Dólares: los valúo al precio de compra de la casa elegida (lo que te darían si vendés).
    moneda = 'USD';
    nativo = q;
    const casa = p ? Number(p.compra || p.precio) : null;
    fechaPrecio = p?.fecha || null;
    const usd = r2(q);
    const ars = casa ? r2(q * casa) : null;
    const gan = cap != null && ars != null ? r2(ars - cap) : null; // en dólares, el capital son los pesos que pagaste
    return { ars, usd, moneda: 'USD', ganancia: gan, gananciaMoneda: 'ARS', gananciaPct: gan != null && cap > 0 ? r2((gan / cap) * 100) : null, estimado: false, fechaPrecio, sinPrecio: false, sinMep: !casa, casa: inv.simbolo, vence: null, vencido: false };
  } else if (p && q > 0) {
    const divisor = inv.tipo === 'bono' ? 100 : 1; // bonos, ONs y letras cotizan cada 100 de valor nominal
    nativo = r2((q * Number(p.precio)) / divisor);
    moneda = p.moneda;
    fechaPrecio = p.fecha;
  } else sinPrecio = true;

  const vencido = !!vence && vence <= hoy;
  if (nativo == null) return { ars: null, usd: null, moneda, ganancia: null, gananciaMoneda: inv.moneda, gananciaPct: null, estimado, fechaPrecio, sinPrecio: true, sinMep: false, vence, vencido };
  const v = conv(nativo, moneda);
  const enMonedaCapital = (inv.moneda || 'ARS') === 'USD' ? v.usd : v.ars;
  const ganancia = cap != null && enMonedaCapital != null ? r2(enMonedaCapital - cap) : null;
  return { ...v, moneda, ganancia, gananciaMoneda: inv.moneda || 'ARS', gananciaPct: ganancia != null && cap > 0 ? r2((ganancia / cap) * 100) : null, estimado, fechaPrecio, sinPrecio, sinMep: v.ars == null, vence, vencido };
}

/** Totales de la cartera (solo activas). */
export function totalCartera(invs, valores) {
  let ars = 0; let faltan = 0; let faltaMep = 0; let usdSinPasar = 0; const porTipo = new Map();
  invs.filter((i) => i.estado === 'activa').forEach((i) => {
    const v = valores[i.id];
    if (!v || v.sinPrecio) { faltan += 1; return; }
    if (v.ars == null) { faltaMep += 1; usdSinPasar += v.usd || 0; return; } // tiene precio en dólares pero no hay dólar para pasarlo a pesos
    ars += v.ars;
    porTipo.set(i.tipo, r2((porTipo.get(i.tipo) || 0) + v.ars));
  });
  return { ars: r2(ars), faltan, faltaMep, usdSinPasar: r2(usdSinPasar), porTipo: [...porTipo.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total) };
}

/**
 * Cantidad (cuotapartes, cripto, nominales): sin redondear. Coma = decimal; un solo punto también es decimal
 * ("0.005" BTC); con varios puntos, son miles ("1.234.567").
 */
export function parseCantidad(v, tipo = null) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v).trim().replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  // "10.000" / "1.500" son miles (así se escribe acá), salvo en cripto, donde el punto es decimal.
  else if (tipo !== 'cripto' && /^[1-9]\d{0,2}\.\d{3}$/.test(s)) s = s.replace('.', '');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** Número a texto editable, sin notación científica ni redondeo ("0,00000012"). */
export const aTexto = (n) => (n == null ? '' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 12, useGrouping: false }));

/** Interés de un plazo fijo: capital × TNA × días / 365. `tna` en decimal (0.25). */
export const interesPlazoFijo = (capital, tna, dias30 = 30) => r2(capital * tna * dias30 / 365);

const num = (v) => (v === '' || v == null ? null : parseMonto(v) ?? NaN);
const pct = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.').replace('%', '').trim()));
const iso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export function validarMeta(f, { nueva = false, hoy = null } = {}) {
  const nombre = String(f.nombre || '').trim();
  if (!nombre) return { error: 'Poné un nombre (ej. "Vacaciones").' };
  const objetivo = num(f.objetivo);
  if (!(objetivo > 0)) return { error: 'Poné cuánto querés juntar.' };
  const inicial = num(f.saldo_inicial);
  if (inicial != null && !(inicial >= 0)) return { error: 'Lo que ya tenés tiene que ser un monto (o 0).' };
  if (f.fecha_objetivo && !iso(f.fecha_objetivo)) return { error: 'La fecha no es válida.' };
  if (nueva && hoy && f.fecha_objetivo && f.fecha_objetivo < hoy) return { error: 'La fecha ya pasó.' };
  return { fila: { nombre, objetivo: r2(objetivo), moneda: f.moneda || 'ARS', fecha_objetivo: f.fecha_objetivo || null, bolsillo_id: f.bolsillo_id || null, saldo_inicial: r2(inicial || 0), notas: String(f.notas || '').trim() || null } };
}

const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function validarInversion(f, { hoy = hoyLocal() } = {}) {
  const nombre = String(f.nombre || f.simbolo || '').trim();
  const tipo = f.tipo;
  if (!TIPOS_INVERSION.some((t) => t.id === tipo)) return { error: 'Elegí el tipo.' };
  if (!nombre) return { error: 'Poné un nombre.' };
  const cantidad = parseCantidad(f.cantidad, tipo); const capital = num(f.capital); const tna = pct(f.tna); const valor = num(f.valor_manual);
  const plazo = f.plazo_dias === '' || f.plazo_dias == null ? null : Number(f.plazo_dias);
  for (const [v, msg] of [[cantidad, 'La cantidad'], [capital, tipo === 'seguro' ? 'El total aportado' : 'Lo que pusiste'], [valor, 'El valor']]) if (v != null && !(v >= 0)) return { error: `${msg} tiene que ser un número.` };
  if (tna != null && !(tna >= 0 && tna <= 1000)) return { error: 'La TNA es en %, entre 0 y 1000.' };
  if (plazo != null && !(Number.isInteger(plazo) && plazo > 0)) return { error: 'El plazo es en días.' };
  if (f.fecha_inicio && !iso(f.fecha_inicio)) return { error: 'La fecha no es válida.' };
  if (['accion', 'cedear', 'bono', 'cripto', 'dolar'].includes(tipo)) {
    if (!f.simbolo) return { error: tipo === 'dolar' ? 'Elegí el tipo de dólar para valuarlo.' : 'Elegí el ticker.' };
    if (!(cantidad > 0)) return { error: tipo === 'bono' ? 'Poné el valor nominal que tenés.' : 'Poné la cantidad.' };
  }
  if (tipo === 'plazo_fijo' && !(capital > 0 && f.fecha_inicio && plazo)) return { error: 'Poné el capital, la fecha en que lo hiciste y el plazo.' };
  if (tipo === 'fci' && !(cantidad > 0 && f.simbolo) && !(capital > 0)) return { error: 'Elegí el fondo y las cuotapartes, o poné lo que pusiste.' };
  if (tipo === 'otro' && valor == null && capital == null) return { error: 'Poné cuánto vale.' };
  const rescate = num(f.valor_rescate); const suma = num(f.suma_asegurada); const aporte = num(f.aporte_monto);
  for (const [v, msg] of [[rescate, 'El valor de rescate'], [suma, 'La suma asegurada'], [aporte, 'El aporte']]) if (v != null && !(v >= 0)) return { error: `${msg} tiene que ser un número.` };
  if (tipo === 'seguro') {
    if (!SUBTIPOS_SEGURO.some((x) => x.id === f.subtipo)) return { error: 'Elegí qué tipo de seguro es.' };
    if (valor == null && rescate == null) return { error: 'Poné el valor de la cuenta (está en tu estado de cuenta o en la web de la aseguradora).' };
    if (rescate != null && valor != null && rescate > valor) return { error: 'El rescate no puede ser mayor que el valor de la cuenta.' };
    if (!iso(f.valor_fecha)) return { error: 'Poné la fecha de esos valores (la del estado de cuenta).' };
    if (f.valor_fecha > hoy) return { error: 'La fecha de los valores no puede ser futura.' };
    if (f.fecha_inicio && f.fecha_inicio > hoy) return { error: 'La fecha de alta no puede ser futura.' };
    if (f.fecha_inicio && f.fecha_inicio > f.valor_fecha) return { error: 'La fecha de los valores es anterior al alta de la póliza.' };
  }
  return {
    fila: {
      tipo, nombre, simbolo: f.simbolo || null, cantidad: cantidad || null,
      moneda: tipo === 'dolar' ? 'ARS' : f.moneda || 'ARS', // en dólares, "lo que pusiste" son pesos
      capital: capital ?? null, fecha_inicio: f.fecha_inicio || null, tna: tna ?? null, plazo_dias: plazo,
      valor_manual: valor ?? null, notas: String(f.notas || '').trim() || null,
      ...(tipo === 'seguro' ? {
        subtipo: f.subtipo, aseguradora: String(f.aseguradora || '').trim() || null, suma_asegurada: suma ?? null, valor_rescate: rescate ?? null,
        aporte_monto: aporte ?? null, aporte_frecuencia: f.aporte_frecuencia || 'mensual', valor_fecha: f.valor_fecha || null,
        cotizacion_aportes: (f.moneda || 'ARS') === 'USD' ? (['oficial_15', 'oficial_dia', 'mep_dia'].includes(f.cotizacion_aportes) ? f.cotizacion_aportes : 'oficial_15') : null
      } : { cotizacion_aportes: null, subtipo: null, aseguradora: null, suma_asegurada: null, valor_rescate: null, aporte_monto: null, aporte_frecuencia: null, valor_fecha: null })
    }
  };
}
