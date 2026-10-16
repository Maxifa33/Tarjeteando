import React, { useState } from 'react';
import { useAncho } from '../../../ui/useCompacto.js';
import { capitalizar, mesLargo } from '../../../ui/formato.js';
import { fmtPct } from '../../deudas/inflacion.js';

/**
 * Línea de 13 meses (el primero = mismo mes del año anterior). Un solo eje, una sola serie:
 * sin leyenda (el título la nombra). Etiquetas directas en el primer y el último punto.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corto = (k) => MESES[Number(k.slice(5)) - 1];
const H = 210; const ML = 34; const MR = 18; const MT = 30; const MB = 38;
const COLOR = 'var(--r2)';

const GraficoInflacion = ({ serie }) => {
  const [ref, ancho] = useAncho();
  const [hover, setHover] = useState(null);
  const W = Math.max(ancho || 320, 260);
  const vals = serie.map((p) => p.valor).filter((v) => v != null);
  if (!vals.length) return null;
  const max = Math.max(1, Math.ceil(Math.max(...vals)));
  const min = Math.min(0, Math.floor(Math.min(...vals)));
  const paso = max - min <= 5 ? 1 : 2;
  const ticks = []; for (let v = min; v <= max; v += paso) ticks.push(v);
  const slot = (W - ML - MR) / 12;
  const X = (i) => ML + i * slot;
  const Y = (v) => MT + (1 - (v - min) / (max - min)) * (H - MT - MB);
  const tramos = []; let cur = [];
  serie.forEach((p, i) => { if (p.valor == null) { if (cur.length) tramos.push(cur); cur = []; } else cur.push([X(i), Y(p.valor)]); });
  if (cur.length) tramos.push(cur);
  const dib = (t) => t.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const cadaDos = slot < 30;
  const ult = serie[12]; const pri = serie[0];

  const tip = (() => {
    if (hover == null) return null;
    const p = serie[hover]; const w = 176;
    let x = X(hover) + 12; if (x + w > W) x = X(hover) - w - 12;
    return (
      <div className="graf-tip" role="status" style={{ left: Math.max(0, x), top: 4, width: w }}>
        <span className="cap" style={{ fontWeight: 600 }}>{capitalizar(mesLargo(p.mes))}{hover === 0 ? ' · hace un año' : ''}</span>
        <span className="rnd" style={{ fontSize: 20, fontWeight: 700 }}>{p.valor == null ? 'Sin dato' : fmtPct(p.valor)}</span>
        {p.valor != null && hover !== 0 && pri.valor != null && <span className="cap">vs {corto(pri.mes)} {pri.mes.slice(2, 4)}: {fmtPct(p.valor - pri.valor, { signo: true }).replace(' %', ' pp')}</span>}
      </div>
    );
  })();

  const resumen = `Inflación mensual de ${capitalizar(mesLargo(pri.mes))} a ${capitalizar(mesLargo(ult.mes))}. ${pri.valor != null ? `${corto(pri.mes)} ${pri.mes.slice(0, 4)}: ${fmtPct(pri.valor)}. ` : ''}${ult.valor != null ? `${corto(ult.mes)} ${ult.mes.slice(0, 4)}: ${fmtPct(ult.valor)}.` : ''}`;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={resumen} style={{ display: 'block', overflow: 'visible' }}>
        {ticks.map((v) => (
          <g key={v} aria-hidden="true">
            <line x1={ML} x2={W - MR} y1={Y(v)} y2={Y(v)} stroke="var(--sep)" strokeWidth="0.5" />
            <text x={ML - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--label2)" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}%</text>
          </g>
        ))}
        {hover != null && <line x1={X(hover)} x2={X(hover)} y1={MT - 8} y2={H - MB} stroke="var(--label2)" strokeWidth="1" strokeDasharray="3 3" aria-hidden="true" />}
        {tramos.map((t, k) => <path key={k} d={dib(t)} fill="none" stroke={COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
        {serie.map((p, i) => p.valor == null ? null : (
          <circle key={p.mes} cx={X(i)} cy={Y(p.valor)} r={hover === i ? 5.5 : 4.5}
            fill={i === 0 ? 'var(--solid)' : COLOR} stroke={i === 0 ? COLOR : 'var(--solid)'} strokeWidth="2" aria-hidden="true" />
        ))}
        {[0, 12].map((i) => serie[i].valor == null ? null : (
          <text key={i} x={X(i)} y={Y(serie[i].valor) - 12} textAnchor={i === 0 ? 'start' : 'end'} fontSize="13" fontWeight="700" fill="var(--label)" aria-hidden="true">{fmtPct(serie[i].valor)}</text>
        ))}
        {serie.map((p, i) => {
          if (cadaDos && i % 2 === 1 && i !== 12) return null;
          if (cadaDos && i === 11) return null;
          const anio = i === 0 || i === 12 || p.mes.endsWith('-01');
          return (
            <g key={p.mes} aria-hidden="true">
              <text x={X(i)} y={H - MB + 16} textAnchor="middle" fontSize="11" fill="var(--label2)">{corto(p.mes)}</text>
              {anio && <text x={X(i)} y={H - MB + 29} textAnchor="middle" fontSize="11" fill="var(--label2)">{p.mes.slice(0, 4)}</text>}
            </g>
          );
        })}
      </svg>
      {serie.map((p, i) => (
        <button key={p.mes} type="button" className="mod-grafcol" style={{ left: X(i) - slot / 2, width: slot, height: H - MB + 8 }}
          aria-label={`${capitalizar(mesLargo(p.mes))}: ${p.valor == null ? 'sin dato' : fmtPct(p.valor)}`}
          onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
      ))}
      {tip}
    </div>
  );
};

export default GraficoInflacion;
