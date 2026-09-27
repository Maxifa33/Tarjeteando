import React from 'react';
import { valoresDe } from './EvolucionChart.jsx';
import { pesos, dolares, mesLargo, capitalizar } from './formato.js';

/**
 * Panel debajo del gráfico con el detalle del mes elegido.
 *  - pagado / en curso: reparto por tarjeta o por tipo con barras.
 *  - comprometido: cuotas de ese mes + fijos + "Dejás de pagar …".
 */
// Planes con el mismo nombre (p. ej. la misma compra en varias tarjetas) van juntos.
function agrupar(planes) {
  const grupos = new Map();
  planes.forEach((q) => {
    const k = `${q.descripcion}|${q.es_estimado_usd ? 'usd' : 'ars'}`;
    const g = grupos.get(k) || { descripcion: q.descripcion, usd: q.es_estimado_usd, n: 0, monto: 0 };
    g.n += 1;
    g.monto += q.es_estimado_usd ? q.monto_dolares : q.monto;
    grupos.set(k, g);
  });
  return [...grupos.values()].map((g) => `${g.descripcion}${g.n > 1 ? ` ×${g.n}` : ''} (${g.usd ? dolares(g.monto) : pesos(g.monto)})`);
}

const DetalleMes = ({ columna: c, detalle, modo = 'tarjeta', series, fijos, identidadDe, subtituloCurso, compacto = false }) => {
  if (!c) return null;
  const titulo = capitalizar(mesLargo(c.mesKey)) + (c.tipo === 'en_curso' ? ' · en curso' : '');
  const caja = { display: 'flex', flexDirection: 'column', gap: 12, padding: compacto ? '16px' : '18px 22px', borderRadius: 20, background: 'var(--fill2)' };

  const cabecera = (sub) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{titulo}</span>
        <span className="cap" style={{ fontSize: 13 }}>{sub}</span>
      </span>
      <span className="rnd" style={{ fontSize: compacto ? 20 : 24, fontWeight: 700, whiteSpace: 'nowrap' }}>{pesos(c.total)}</span>
    </div>
  );

  if (c.tipo !== 'comprometido') {
    const filas = valoresDe(c, modo, series).filter((s) => s.valor > 0);
    return (
      <div style={caja} aria-live="polite">
        {cabecera(c.tipo === 'en_curso' ? subtituloCurso : 'Resúmenes pagados')}
        {filas.length === 0 && <span className="cap">No hay resúmenes que se hayan pagado este mes.</span>}
        {filas.map((s) => {
          const pct = c.total > 0 ? (s.valor / c.total) * 100 : 0;
          return (
            <div
              key={s.id}
              style={{ display: 'grid', gridTemplateColumns: compacto ? 'minmax(0,1fr) 44px 96px' : '200px 1fr 70px 110px', alignItems: 'center', gap: compacto ? 10 : 14, minHeight: 34, fontSize: 14 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</span>
              </span>
              {!compacto && (
                <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--track)', overflow: 'hidden' }}>
                  <span className="spr" style={{ display: 'block', height: 8, width: `${pct}%`, background: s.color, borderRadius: 4 }} />
                </span>
              )}
              <span className="cap" style={{ textAlign: 'right' }}>{Math.round(pct)} %</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{pesos(s.valor)}</span>
            </div>
          );
        })}
        {c.usdAparte > 0 && <span className="cap">Además, {dolares(c.usdAparte)} en dólares (aparte del total en pesos).</span>}
        {c.usdExcluido > 0 && <span className="cap">{dolares(c.usdExcluido)} en consumos sin cotización guardada: no entran en el reparto por tipo.</span>}
      </div>
    );
  }

  const cuotas = detalle?.cuotas || [];
  const nFijos = (fijos?.items || []).filter((f) => f.moneda !== 'USD').length;
  const fila = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, borderBottom: '0.5px solid var(--sep)', fontSize: 14 };
  return (
    <div style={caja} aria-live="polite">
      {cabecera('Ya comprometido: cuotas y fijos que van a aparecer sí o sí (los fijos se asumen iguales)')}
      <div style={{ display: 'grid', gridTemplateColumns: compacto ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', columnGap: 36 }}>
        {cuotas.map((q, i) => (
          <div key={`${q.id || q.descripcion}-${i}`} style={fila}>
            <span className="chip-plastico" aria-hidden="true" style={{ background: identidadDe(q.tarjeta).plastico }} />
            <span style={{ flexGrow: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.descripcion}</span>
            <span className="cap" style={{ width: 76, textAlign: 'right', flexShrink: 0 }}>{q.es_ultima ? 'última · ' : ''}{q.cuota_numero}/{q.total_cuotas}</span>
            <span style={{ width: 96, textAlign: 'right', fontWeight: 500, flexShrink: 0 }}>{q.es_estimado_usd ? dolares(q.monto_dolares) : pesos(q.monto)}</span>
          </div>
        ))}
        {c.porTipo.fijos > 0 && (
          <div style={fila}>
            <span aria-hidden="true" style={{ width: 22, height: 14, borderRadius: 3.5, background: 'var(--r2)', flexShrink: 0 }} />
            <span style={{ flexGrow: 1 }}>Gastos fijos · {nFijos}</span>
            <span style={{ textAlign: 'right', fontWeight: 500 }}>
              {pesos(c.porTipo.fijos)}{fijos?.usd > 0 ? ` + ${dolares(fijos.usd)}` : ''}
            </span>
          </div>
        )}
      </div>
      {cuotas.length === 0 && c.porTipo.fijos === 0 && <span className="cap">Nada comprometido para este mes.</span>}
      {detalle?.terminan?.length > 0 && (
        <span style={{ fontSize: 14, color: 'var(--label2)' }}>
          Dejás de pagar {agrupar(detalle.terminan).join(', ')} respecto del mes anterior.
        </span>
      )}
    </div>
  );
};

export default DetalleMes;
