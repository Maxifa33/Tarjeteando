import React from 'react';
import { indiceMesKey } from '../services/mes.js';
import { pesos } from './formato.js';

/**
 * Línea de tiempo de planes (web). Una fila por plan: nombre | pista de meses | restante.
 * Pagado sólido, este mes rayado, falta al 30 %, a revisar con borde punteado (no se
 * proyecta), terminados atenuados al 60 %. Meses de pago, como en Mes.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const TAG = { ultima: ['Última', 'reint'], a_revisar: ['A revisar', 'revisar'], terminado: ['Terminado', ''] };

export function tramosDeFila(f, desde, hasta, hoy) {
  const ini = indiceMesKey(f.inicio);
  const fin = indiceMesKey(f.fin);
  const visto = ini + (f.plan.cuotas_pagadas ?? f.plan.cuota_actual) - 1; // último mes facturado
  const corte = (a, b) => [Math.max(a, desde), Math.min(b, hasta)];
  const t = [];
  const push = (tipo, a, b) => { const [x, y] = corte(a, b); if (x <= y) t.push({ tipo, a: x, b: y }); };
  if (f.estado === 'a_revisar') {
    push('pagado', ini, visto);
    push('no_proyecta', visto + 1, fin);
  } else if (f.estado === 'terminado') {
    push('pagado', ini, f.plan.motivo === 'decision_usuario' ? visto : fin);
  } else {
    push('pagado', ini, hoy - 1);
    push('este_mes', hoy, hoy);
    push('falta', hoy + 1, fin);
  }
  return t;
}

const LineaDeTiempoPlanes = ({ datos, filas, identidadDe, colorDe, nombreTarjeta, elegido, onElegir }) => {
  const { meses, hoy: hoyKey } = datos;
  const n = meses.length;
  const desde = indiceMesKey(meses[0]);
  const hasta = indiceMesKey(meses[n - 1]);
  const hoy = indiceMesKey(hoyKey);
  const pct = (i) => ((i - desde) / n) * 100;
  const iHoy = meses.indexOf(hoyKey);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="prow" aria-hidden="true" style={{ minHeight: 34, pointerEvents: 'none' }}>
        <span className="cap" style={{ fontWeight: 600 }}>Plan</span>
        <span style={{ position: 'relative', height: 34 }}>
          {meses.map((mk, i) => {
            const m = Number(mk.slice(5, 7));
            return (
              <span key={mk} style={{ position: 'absolute', left: `${(i / n) * 100}%`, width: `${100 / n}%`, top: 10, textAlign: 'center', fontSize: 11, color: mk === hoyKey ? 'var(--label)' : 'var(--label2)', fontWeight: mk === hoyKey ? 700 : 500, whiteSpace: 'nowrap' }}>
                {MESES[m - 1]}{(m === 1 || i === 0) ? <span style={{ fontSize: 9, opacity: 0.8 }}>'{mk.slice(2, 4)}</span> : null}
              </span>
            );
          })}
        </span>
        <span className="cap" style={{ textAlign: 'right', fontWeight: 600 }}>Restante</span>
      </div>
      <div style={{ position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 310, right: 140, top: 0, bottom: 0, pointerEvents: 'none' }}>
          {meses.map((mk, i) => (
            <span key={mk} style={{ position: 'absolute', left: `${(i / n) * 100}%`, top: 0, bottom: 0, width: 0.5, background: 'var(--sep)', opacity: i === 0 ? 0 : 1 }} />
          ))}
          {iHoy >= 0 && <span style={{ position: 'absolute', left: `${(iHoy / n) * 100}%`, top: -6, bottom: 0, width: 1.5, background: 'var(--label)', opacity: 0.7 }} />}
        </div>
        {filas.map((f) => {
          const color = colorDe(f.plan.tarjeta);
          const tramos = tramosDeFila(f, desde, hasta, hoy);
          const [tag, cls] = TAG[f.estado] || [];
          const numero = f.plan.cuotas_pagadas ?? f.plan.cuota_actual;
          return (
            <button
              key={f.planId}
              type="button"
              className={`prow ${elegido === f.planId ? 'on' : ''}`}
              aria-pressed={elegido === f.planId}
              aria-label={`${f.plan.descripcion}, ${tag ? tag.toLowerCase() : 'en curso'}`}
              onClick={() => onElegir?.(f.planId)}
              style={{ opacity: f.estado === 'terminado' ? 0.6 : 1 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span className="chip-plastico" aria-hidden="true" style={{ background: identidadDe(f.plan.tarjeta).plastico }} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.plan.descripcion}</span>
                  <span className="cap" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    {nombreTarjeta(f.plan.tarjeta)} · {numero}/{f.plan.total_cuotas}
                    {tag && <span className={`tag ${cls}`}>{tag}</span>}
                  </span>
                </span>
              </span>
              <span aria-hidden="true" style={{ position: 'relative', height: 52 }}>
                {tramos.map((t, i) => {
                  const redondoIzq = i === 0 && !f.empiezaAntes;
                  const redondoDer = i === tramos.length - 1 && !f.terminaDespues;
                  const estilo = {
                    left: `${pct(t.a)}%`, width: `${((t.b - t.a + 1) / n) * 100}%`,
                    borderRadius: `${redondoIzq ? 7 : 0}px ${redondoDer ? 7 : 0}px ${redondoDer ? 7 : 0}px ${redondoIzq ? 7 : 0}px`
                  };
                  if (t.tipo === 'no_proyecta') {
                    return <span key={i} className="tramo" style={{ ...estilo, border: `1.5px dashed ${color}` }} />;
                  }
                  return (
                    <span
                      key={i}
                      className={`tramo ${t.tipo === 'este_mes' ? 'rayado-tramo' : ''}`}
                      style={{ ...estilo, backgroundColor: color, opacity: t.tipo === 'falta' ? 0.3 : 1 }}
                    />
                  );
                })}
                {f.empiezaAntes && <span className="cap" style={{ position: 'absolute', left: -2, top: 16 }}>‹</span>}
              </span>
              <span className="rnd" style={{ textAlign: 'right', fontWeight: 600, fontSize: 15 }}>
                {f.restante > 0 ? `${pesos(f.restante)}${f.estimado ? '*' : ''}` : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LineaDeTiempoPlanes;
