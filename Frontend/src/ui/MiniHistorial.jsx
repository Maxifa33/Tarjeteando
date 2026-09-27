import React, { useState } from 'react';
import { pesos, corto, mesLargo, capitalizar } from './formato.js';

/**
 * Historial chico de una sola serie (una tarjeta). Se usa en la sección Tarjetas
 * (fase 3). Misma lógica que Evolución: pagados, Hoy, en curso rayado y banda
 * "Ya comprometido". Sin leyenda: el título de afuera dice qué es.
 *
 * valores: [{ mesKey, label, tipo: 'pagado'|'en_curso'|'comprometido', total }]
 */
const SUB = { pagado: 'Resumen pagado', en_curso: 'En curso · estimado', comprometido: 'Cuotas + fijos ya comprometidos' };

const MiniHistorial = ({ valores = [], color = 'var(--r2)', compacto = false, ariaLabel = 'Historial de la tarjeta' }) => {
  const [hover, setHover] = useState(null);
  const plotH = compacto ? 80 : 110;
  const col = compacto ? 9 : 16;
  const slot = compacto ? 20 : 42;
  const pie = 24;
  const max = Math.max(...valores.map((v) => v.total), 1) * 1.12;
  const Y = (v) => Math.max(v > 0 ? 1 : 0, (v / max) * plotH);
  const ancho = valores.length * slot;
  const jCurso = valores.findIndex((v) => v.tipo === 'en_curso');
  const jFut = valores.findIndex((v) => v.tipo === 'comprometido');
  const nFut = valores.filter((v) => v.tipo === 'comprometido').length;

  let tip = null;
  if (hover !== null && valores[hover]) {
    const v = valores[hover];
    const w = 170;
    let x = hover * slot + slot + 6;
    if (x + w > ancho) x = hover * slot - w - 6;
    tip = (
      <div className="graf-tip" role="status" style={{ left: Math.max(0, x), top: 0, width: w, gap: 2 }}>
        <span className="cap" style={{ fontWeight: 600 }}>{capitalizar(mesLargo(v.mesKey))}</span>
        <span className="rnd" style={{ fontSize: 16, fontWeight: 700 }}>{pesos(v.total)}</span>
        <span className="cap">{SUB[v.tipo]}</span>
      </div>
    );
  }

  return (
    <div role="group" aria-label={ariaLabel} style={{ overflowX: 'auto', paddingTop: 16 }}>
      <div style={{ position: 'relative', height: plotH + pie, width: ancho, margin: '0 10px' }} onMouseLeave={() => setHover(null)}>
        {nFut > 0 && (
          <div aria-hidden="true" style={{ position: 'absolute', left: jFut * slot - 2, width: nFut * slot + 4, top: -8, bottom: 0, borderRadius: 12, background: 'var(--fill2)' }} />
        )}
        {jCurso > 0 && (
          <div aria-hidden="true" style={{ position: 'absolute', left: jCurso * slot - 1, top: -8, height: plotH + 8, width: 1.5, background: 'var(--label)', opacity: 0.7 }} />
        )}
        {valores.map((v, j) => (
          <button
            key={v.mesKey}
            type="button"
            className={`graf-col ${hover === j ? 'on' : ''}`}
            style={{ left: j * slot, width: slot, height: plotH + pie }}
            aria-label={`${capitalizar(mesLargo(v.mesKey))}: ${pesos(v.total)}. ${SUB[v.tipo]}`}
            onMouseEnter={() => setHover(j)}
            onFocus={() => setHover(j)}
            onBlur={() => setHover(null)}
            onClick={() => setHover(hover === j ? null : j)}
          >
            <div className={`graf-pila ${v.tipo === 'en_curso' ? 'rayado' : ''}`} style={{ bottom: pie, width: col }}>
              <div style={{ height: Y(v.total), background: color, opacity: v.tipo === 'comprometido' ? 0.55 : 1 }} />
            </div>
            {((!compacto && j === jCurso - 1) || j === jCurso) && v.total > 0 && (
              <span aria-hidden="true" style={{ position: 'absolute', left: -10, right: -10, textAlign: 'center', bottom: pie + Y(v.total) + 4, fontSize: 11, fontWeight: 700, color: 'var(--label)' }}>
                {corto(v.total)}
              </span>
            )}
            {j % 3 === 0 && (
              <span aria-hidden="true" style={{ position: 'absolute', left: -6, right: -6, bottom: 4, textAlign: 'center', fontSize: 10, color: 'var(--label2)', whiteSpace: 'nowrap' }}>
                {v.label}
              </span>
            )}
          </button>
        ))}
        {tip}
      </div>
    </div>
  );
};

export default MiniHistorial;
