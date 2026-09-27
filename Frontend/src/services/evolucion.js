/**
 * Evolución y proyección — cálculos puros para el gráfico de la sección Mes.
 *
 * Un solo eje con tres tramos:
 *  - pagado:       hasta 12 meses anteriores al mes del ciclo. Total = suma de los
 *                  resúmenes que VENCIERON ese mes.
 *  - en_curso:     el mes del ciclo (fase 1: cicloDePago + composicion).
 *  - comprometido: los 6 meses siguientes. Solo cuotas + fijos: no se inventa gasto
 *                  variable. Se asume que los fijos siguen iguales.
 *
 * Invariante por columna: suma de porTarjeta = total = suma de porTipo.
 * Fechas: strings 'YYYY-MM-DD' / 'YYYY-MM'. Nunca new Date('YYYY-MM-DD').
 */
import { numerosDeCuota } from './cuotas.js';
import { cuotasDelMes, sumarMeses, mesKeyDe, indiceMesKey } from './mes.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const labelMes = (mk) => MESES[Number(String(mk).slice(5, 7)) - 1];
export const anioCorto = (mk) => `'${String(mk).slice(2, 4)}`;

/** Mes en que se pagó un resumen: su vencimiento; sin vencimiento, el mes siguiente al período. */
export function mesDePago(r) {
  const mk = mesKeyDe(r?.fecha_vencimiento);
  if (mk) return mk;
  if (r?.anio && r?.mes) return sumarMeses(`${r.anio}-${String(r.mes).padStart(2, '0')}`, 1);
  return null;
}

/** Reparte un total en cuotas / fijos / variables sin pasarse del total. */
function repartir(total, cuotas, fijos) {
  const c = Math.min(Math.max(0, cuotas), total);
  const f = Math.min(Math.max(0, fijos), Math.max(0, total - c));
  return { cuotas: r2(c), fijos: r2(f), variables: r2(Math.max(0, total - c - f)) };
}

/**
 * Columnas del gráfico.
 * @param {Object} p
 *  - resumenes, movimientos: de storage
 *  - tipos:        { [mov_id]: { tipo: 'fijo'|'variable' } } (aplicarOverrides: incluye cambios manuales)
 *  - planes:       planes de cuotas (construirPlanes o formatearParaVista)
 *  - fijos:        gastosFijosDetalle ({ items: [{ tarjeta, moneda, montoTipico }] })
 *  - ciclo, composicion: salida de la fase 1 para el mes en curso
 *  - desfase, cotizacionVenta: como en cuotasDelMes
 */
export function serieEvolucion({
  resumenes = [], movimientos = [], tipos = {}, planes = [], fijos = null,
  ciclo, composicion, porTarjetaComp = null, desfase = {}, cotizacionVenta = 0, pasados = 12, futuros = 6
} = {}) {
  const mesCiclo = ciclo.mesKey;
  const idxCiclo = indiceMesKey(mesCiclo);

  // ---- pagados ----
  const porMes = {};
  resumenes.forEach((r) => {
    const mk = mesDePago(r);
    if (!mk) return;
    const d = idxCiclo - indiceMesKey(mk);
    if (d < 1 || d > pasados) return;
    (porMes[mk] = porMes[mk] || []).push(r);
  });
  const movsPorResumen = {};
  movimientos.forEach((m) => { if (m?.resumen_id) (movsPorResumen[m.resumen_id] = movsPorResumen[m.resumen_id] || []).push(m); });

  // Sin columnas vacías antes del primer resumen.
  const conDatos = Object.keys(porMes).map(indiceMesKey);
  const desde = conDatos.length ? Math.min(...conDatos) : idxCiclo;
  const columnas = [];
  for (let i = desde; i < idxCiclo; i++) {
    const mk = sumarMeses(mesCiclo, i - idxCiclo);
    const rs = porMes[mk] || [];
    const porTarjeta = {};
    let cuotas = 0, fijosMes = 0, usdExcluido = 0, usdAparte = 0;
    rs.forEach((r) => {
      const total = Number(r.total_a_pagar_pesos) || 0;
      porTarjeta[r.tarjeta] = r2((porTarjeta[r.tarjeta] || 0) + total);
      usdAparte += Number(r.total_a_pagar_dolares) || 0;
      const cot = Number(r.cotizacion_venta || r.cotizacion) || 0;
      (movsPorResumen[r.id] || []).forEach((m) => {
        let monto = Number(m.monto_pesos) || 0;
        if (!monto && m.monto_dolares) {
          if (cot > 0) monto = m.monto_dolares * cot;
          else { usdExcluido += m.monto_dolares; return; }
        }
        if (numerosDeCuota(m)) cuotas += monto;
        else if (tipos[m.id]?.tipo === 'fijo') fijosMes += monto;
      });
    });
    const total = r2(Object.values(porTarjeta).reduce((s, v) => s + v, 0));
    columnas.push({
      mesKey: mk, label: labelMes(mk), anioCorto: anioCorto(mk), tipo: 'pagado',
      porTarjeta, porTipo: repartir(total, cuotas, fijosMes), total,
      usdAparte: r2(usdAparte), usdExcluido: r2(usdExcluido)
    });
  }

  // ---- en curso ----
  // Con la composición por tarjeta (fase 3) la columna coincide con la cápsula de Mes.
  const porTarjetaCurso = {};
  let porTipoCurso;
  if (porTarjetaComp) {
    Object.entries(porTarjetaComp).forEach(([id, x]) => { porTarjetaCurso[id] = r2(x.total); });
    const suma = (k) => r2(Object.values(porTarjetaComp).reduce((s, x) => s + x[k], 0));
    porTipoCurso = { cuotas: suma('cuotas'), fijos: suma('fijos'), variables: suma('variables') };
  } else {
    ciclo.porTarjeta.filter((t) => t.fuente !== 'sin_datos').forEach((t) => { porTarjetaCurso[t.tarjetaId] = r2(t.total); });
  }
  const totalCurso = r2(Object.values(porTarjetaCurso).reduce((s, v) => s + v, 0));
  columnas.push({
    mesKey: mesCiclo, label: labelMes(mesCiclo), anioCorto: anioCorto(mesCiclo), tipo: 'en_curso',
    porTarjeta: porTarjetaCurso,
    porTipo: porTipoCurso || repartir(totalCurso, composicion?.cuotas || 0, composicion?.fijos || 0),
    total: totalCurso,
    usdAparte: r2(ciclo.porTarjeta.reduce((s, t) => s + (t.totalUsd || 0), 0)), usdExcluido: 0
  });

  // ---- comprometidos ----
  const fijosPorTarjeta = {};
  (fijos?.items || []).filter((f) => f.moneda !== 'USD').forEach((f) => {
    fijosPorTarjeta[f.tarjeta] = (fijosPorTarjeta[f.tarjeta] || 0) + (f.montoTipico || 0);
  });
  const fijosTotal = r2(Object.values(fijosPorTarjeta).reduce((s, v) => s + v, 0));
  for (let i = 1; i <= futuros; i++) {
    const mk = sumarMeses(mesCiclo, i);
    const cuotas = cuotasDelMes(planes, mk, { desfase, cotizacionVenta });
    const porTarjeta = {};
    cuotas.items.filter((q) => !q.es_estimado_usd).forEach((q) => { porTarjeta[q.tarjeta] = (porTarjeta[q.tarjeta] || 0) + q.monto; });
    Object.entries(fijosPorTarjeta).forEach(([t, v]) => { porTarjeta[t] = (porTarjeta[t] || 0) + v; });
    Object.keys(porTarjeta).forEach((t) => { porTarjeta[t] = r2(porTarjeta[t]); });
    const total = r2(cuotas.total + fijosTotal);
    columnas.push({
      mesKey: mk, label: labelMes(mk), anioCorto: anioCorto(mk), tipo: 'comprometido',
      porTarjeta, porTipo: { cuotas: cuotas.total, fijos: fijosTotal, variables: 0 }, total,
      usdAparte: r2(cuotas.totalUsd + (fijos?.usd || 0)), usdExcluido: 0
    });
  }
  return columnas;
}

/**
 * Detalle de un mes comprometido: sus cuotas y qué planes se terminaron de pagar el
 * mes anterior ("Dejás de pagar …").
 */
export function detalleMes(col, planes = [], { desfase = {}, cotizacionVenta = 0 } = {}) {
  if (!col || col.tipo !== 'comprometido') return { cuotas: [], terminan: [], dejasDePagar: 0 };
  const cuotas = cuotasDelMes(planes, col.mesKey, { desfase, cotizacionVenta }).items;
  const anterior = cuotasDelMes(planes, sumarMeses(col.mesKey, -1), { desfase, cotizacionVenta }).items;
  const terminan = anterior.filter((q) => q.es_ultima);
  return {
    cuotas,
    terminan,
    dejasDePagar: r2(terminan.filter((q) => !q.es_estimado_usd).reduce((s, q) => s + q.monto, 0))
  };
}

/**
 * Escala del eje Y: múltiplo de 500.000 (web) o 1.000.000 (compacto), con 6 % de aire.
 * Devuelve el máximo y hasta 6 marcas.
 */
export function escalaY(maxTotal, tope = null, { compacto = false } = {}) {
  const paso = compacto ? 1000000 : 500000;
  const techo = Math.max(Number(maxTotal) || 0, Number(tope) || 0, 1) * 1.06;
  let max = Math.ceil(techo / paso) * paso;
  const saltos = Math.ceil(max / paso / 5); // ≤ 6 marcas
  const tick = paso * saltos;
  max = Math.ceil(max / tick) * tick;
  const ticks = [];
  for (let v = 0; v <= max; v += tick) ticks.push(v);
  return { max, ticks };
}

/** Serie de una sola tarjeta para MiniHistorial (fase 3). */
export function serieDeTarjeta(columnas = [], tarjetaId) {
  return columnas.map((c) => ({
    mesKey: c.mesKey, label: c.label, tipo: c.tipo, total: r2(c.porTarjeta[tarjetaId] || 0)
  }));
}
