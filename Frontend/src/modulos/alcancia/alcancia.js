import { r2, parseMonto } from '../cuentas/util.js';

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
  { id: 'otro', label: 'Otro' }
];
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
export function valuar(inv, precios, { mep, hoy }) {
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

export function validarInversion(f) {
  const nombre = String(f.nombre || f.simbolo || '').trim();
  const tipo = f.tipo;
  if (!TIPOS_INVERSION.some((t) => t.id === tipo)) return { error: 'Elegí el tipo.' };
  if (!nombre) return { error: 'Poné un nombre.' };
  const cantidad = parseCantidad(f.cantidad, tipo); const capital = num(f.capital); const tna = pct(f.tna); const valor = num(f.valor_manual);
  const plazo = f.plazo_dias === '' || f.plazo_dias == null ? null : Number(f.plazo_dias);
  for (const [v, msg] of [[cantidad, 'La cantidad'], [capital, 'Lo que pusiste'], [valor, 'El valor']]) if (v != null && !(v >= 0)) return { error: `${msg} tiene que ser un número.` };
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
  return {
    fila: {
      tipo, nombre, simbolo: f.simbolo || null, cantidad: cantidad || null,
      moneda: tipo === 'dolar' ? 'ARS' : f.moneda || 'ARS', // en dólares, "lo que pusiste" son pesos
      capital: capital ?? null, fecha_inicio: f.fecha_inicio || null, tna: tna ?? null, plazo_dias: plazo,
      valor_manual: valor ?? null, notas: String(f.notas || '').trim() || null
    }
  };
}
