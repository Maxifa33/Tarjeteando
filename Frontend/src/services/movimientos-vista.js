/**
 * Movimientos — lógica de la vista, sin React (testeable en Node).
 *
 * Mantiene la semántica de la vista vieja:
 *  - 'mes':     el mes calendario de fecha_compra; meses ordenados del más reciente
 *               al más viejo; por defecto el más reciente.
 *  - 'resumen': los movimientos de un resumen (resumen_id); resúmenes ordenados por
 *               fecha_cierre (o anio/mes) del más reciente al más viejo; por defecto
 *               el más reciente.
 *  - búsqueda:  nombre limpio o descripción original, sin distinguir mayúsculas.
 *
 * Tipo de cada fila (disjuntos): reintegro > cuota > fijo > variable.
 * Fechas: strings 'YYYY-MM-DD'. Nunca new Date('YYYY-MM-DD').
 */
import { claveComercio } from './series.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** 'YYYY-MM' del mes calendario de una fecha del parser (o null). */
export function mesKeyDeFecha(valor) {
  const m = String(valor || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

const fechaDe = (m) => m?.fecha_compra || m?.fecha || null;

/** Meses con movimientos, del más reciente al más viejo (por fecha_compra, como la vista vieja). */
export function mesesDisponibles(movs = []) {
  return [...new Set(movs.map((m) => mesKeyDeFecha(m.fecha_compra)).filter(Boolean))].sort().reverse();
}

/** Resúmenes del más reciente al más viejo (fecha_cierre; si falta, anio/mes). */
export function ordenarResumenes(resumenes = []) {
  const clave = (r) => r.fecha_cierre || `${r.anio}-${String(r.mes).padStart(2, '0')}-01`;
  return [...resumenes].sort((a, b) => clave(b).localeCompare(clave(a)));
}

const REGEX_REINTEGRO = /reintegro|devoluci[oó]n|cr[eé]dito|bonificaci[oó]n/i;

/** Mismo criterio que App.jsx para detectar reintegros. */
export function esReintegro(m) {
  return m.monto_pesos < 0 || m.monto_dolares < 0 || REGEX_REINTEGRO.test(m.referencia_original || m.referencia_limpia || '');
}

/** 'reintegro' | 'cuota' | 'fijo' | 'variable' */
export function tipoDeFila(m, fijos = new Set()) {
  if (esReintegro(m)) return 'reintegro';
  if (m.cuota_texto) return 'cuota';
  if (m.id && fijos.has(m.id)) return 'fijo';
  return 'variable';
}

const coincideTexto = (m, texto, { conTarjeta = false } = {}) => {
  if (!texto) return true;
  const q = texto.toLowerCase();
  return !!(m.referencia_limpia?.toLowerCase().includes(q)
    || m.referencia_original?.toLowerCase().includes(q)
    || (conTarjeta && m.tarjeta?.toLowerCase().includes(q)));
};

/**
 * Filtra como la vista vieja y agrega los filtros nuevos en una fila.
 * @param {Object} o
 *  - modo: 'mes' | 'resumen'; periodo: 'YYYY-MM' (modo mes); resumenId (modo resumen)
 *  - tipo: 'todos' | 'variables' | 'fijos' | 'cuotas' | 'reintegros' | 'usd'
 *  - texto: búsqueda; tarjeta: nombre de tarjeta (desde Tarjetas); fijos: Set de ids
 *  - reintegros: lista de App (con es_reciente); verAnteriores: bool
 * Con tipo 'reintegros' no se filtra por período: son los mismos que mostraba
 * ReintegrosView (los del último resumen de cada tarjeta, o todos con verAnteriores).
 */
export function filtrarMovimientos(movs = [], o = {}) {
  const { modo = 'mes', periodo = null, resumenId = null, tipo = 'todos', texto = '', tarjeta = '', fijos = new Set(), reintegros = null, verAnteriores = false } = o;

  if (tipo === 'reintegros') {
    const base = reintegros || movs.filter(esReintegro).map((m) => ({ ...m, es_reciente: true }));
    return base
      .filter((m) => verAnteriores || m.es_reciente)
      .filter((m) => coincideTexto(m, texto, { conTarjeta: true }))
      .filter((m) => !tarjeta || m.tarjeta === tarjeta);
  }

  return movs.filter((m) => {
    if (modo === 'resumen') {
      if (resumenId && m.resumen_id !== resumenId) return false;
    } else if (periodo && mesKeyDeFecha(m.fecha_compra) !== periodo) {
      return false;
    }
    if (!coincideTexto(m, texto)) return false;
    if (tarjeta && m.tarjeta !== tarjeta) return false;
    const t = tipoDeFila(m, fijos);
    if (tipo === 'variables' && t !== 'variable') return false;
    if (tipo === 'fijos' && t !== 'fijo') return false;
    if (tipo === 'cuotas' && !m.cuota_texto) return false;
    if (tipo === 'usd' && !(m.monto_dolares > 0)) return false;
    return true;
  });
}

/** Etiqueta de un día en fecha local: 'Viernes 25 de septiembre'. */
export function labelDia(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 'Sin fecha';
  const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const txt = f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** Agrupa por día (fecha local), del más reciente al más viejo; 'Sin fecha' al final. */
export function agruparPorDia(movs = []) {
  const grupos = new Map();
  movs.forEach((m) => {
    const f = fechaDe(m);
    const k = /^\d{4}-\d{2}-\d{2}/.test(String(f || '')) ? String(f).slice(0, 10) : '';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : b.localeCompare(a)))
    .map(([fecha, filas]) => ({
      fecha: fecha || null,
      label: fecha ? labelDia(fecha) : 'Sin fecha',
      total: r2(filas.reduce((s, m) => s + (Number(m.monto_pesos) || 0), 0)),
      totalUsd: r2(filas.reduce((s, m) => s + (Number(m.monto_dolares) || 0), 0)),
      filas
    }));
}

/** Separa las cuotas (se muestran plegadas en "Cuotas del período"). */
export function separarCuotas(movs = []) {
  const cuotas = [];
  const resto = [];
  movs.forEach((m) => (m.cuota_texto && !esReintegro(m) ? cuotas : resto).push(m));
  return { cuotas, resto };
}

/** Composición del período en pesos: variables / fijos / cuotas (sin reintegros) y total neto. */
export function composicionPeriodo(movs = [], fijos = new Set()) {
  const out = { variables: 0, fijos: 0, cuotas: 0, reintegros: 0 };
  movs.forEach((m) => {
    const t = tipoDeFila(m, fijos);
    const v = Number(m.monto_pesos) || 0;
    if (t === 'reintegro') out.reintegros += Math.abs(v);
    else if (t === 'cuota') out.cuotas += v;
    else if (t === 'fijo') out.fijos += v;
    else out.variables += v;
  });
  return {
    variables: r2(out.variables), fijos: r2(out.fijos), cuotas: r2(out.cuotas), reintegros: r2(out.reintegros),
    total: r2(movs.reduce((s, m) => s + (Number(m.monto_pesos) || 0), 0)),
    totalUsd: r2(movs.reduce((s, m) => s + (Number(m.monto_dolares) || 0), 0))
  };
}

/**
 * Historial de un comercio en los últimos resúmenes de su tarjeta (hasta el del
 * movimiento incluido). Usa claveComercio: un comercio renombrado sigue siendo el mismo.
 * @returns [{ resumenId, mesKey, total, actual }]
 */
export function historialComercio(movs = [], mov, resumenes = [], { ultimos = 6 } = {}) {
  if (!mov) return [];
  const clave = claveComercio(mov.referencia_original || mov.referencia_limpia || '');
  if (!clave) return [];
  const propios = ordenarResumenes(resumenes.filter((r) => r.tarjeta === mov.tarjeta));
  const i = propios.findIndex((r) => r.id === mov.resumen_id);
  const ventana = (i >= 0 ? propios.slice(i, i + ultimos) : propios.slice(0, ultimos)).reverse();
  return ventana.map((r) => ({
    resumenId: r.id,
    mesKey: mesKeyDeFecha(r.fecha_cierre) || (r.anio && r.mes ? `${r.anio}-${String(r.mes).padStart(2, '0')}` : null),
    total: r2(movs
      .filter((m) => m.resumen_id === r.id && claveComercio(m.referencia_original || m.referencia_limpia || '') === clave)
      .reduce((s, m) => s + (Number(m.monto_pesos) || Number(m.monto_dolares) || 0), 0)),
    actual: r.id === mov.resumen_id
  }));
}

/** Plan de cuotas de un movimiento (formatearParaVista), o null si ya no existe. */
export function planDeMovimiento(mov, planes = []) {
  if (!mov?.cuota_texto) return null;
  const n = String(mov.cuota_texto).match(/(\d+)\/(\d+)/);
  if (!n) return null;
  const total = Number(n[2]);
  const nombre = (mov.referencia_limpia || mov.referencia_original || '').toLowerCase();
  const monto = Number(mov.monto_pesos) || Number(mov.monto_dolares) || 0;
  const candidatos = planes.filter((p) => p.tarjeta === mov.tarjeta && p.total_cuotas === total
    && (p.descripcion || '').toLowerCase() === nombre);
  if (!candidatos.length) return null;
  // Si hay varios con el mismo nombre, el de la cuota más parecida.
  return candidatos.sort((a, b) => Math.abs((a.monto_cuota || 0) - monto) - Math.abs((b.monto_cuota || 0) - monto))[0];
}
