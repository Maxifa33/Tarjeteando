import React, { useEffect, useRef, useState } from 'react';
import { pesos } from './formato.js';

/**
 * Cápsula de composición: segmentos proporcionales sobre una pista, con 3 px de
 * separación y un marcador de tope. Anima ancho y posición con --spring.
 * La etiqueta interna aparece solo si el segmento mide ≥ 9 % y el texto entra.
 *
 * segmentos: [{ valor, color, textoColor, label }]
 * escala:    valor que ocupa el 100 % (normalmente max(tope, total))
 */
const Capsula = ({ segmentos = [], escala, tope = null, alto = 64, ariaLabel }) => {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = escala > 0 ? escala : 1;
  const pct = (v) => Math.max(0, Math.min(100, (v / base) * 100));
  const conEtiquetas = alto >= 40;
  const topePct = tope > 0 ? pct(tope) : null;
  const radio = alto / 2;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'relative', height: alto, marginTop: topePct !== null && conEtiquetas ? 28 : 0 }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: radio, background: 'var(--track)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 3, borderRadius: radio, overflow: 'hidden' }}>
        {segmentos.filter(s => s.valor > 0).map((s, i) => {
          const p = pct(s.valor);
          const px = (p / 100) * ancho;
          const entra = conEtiquetas && s.label && p >= 9 && px >= s.label.length * 8.5 + 28;
          return (
            <div
              key={s.label || i}
              className="spr"
              style={{
                width: `${p}%`, flexShrink: 0, background: s.color, color: s.textoColor,
                display: 'flex', alignItems: 'center', paddingLeft: entra ? (i === 0 ? 20 : 14) : 0,
                fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden'
              }}
            >
              {entra ? s.label : null}
            </div>
          );
        })}
      </div>
      {topePct !== null && (
        <>
          <div
            aria-hidden="true"
            className="spr"
            style={{
              position: 'absolute', top: -8, bottom: -8, left: `${topePct}%`, width: 2, marginLeft: -1,
              borderRadius: 1, background: 'var(--label)', transition: 'left var(--spring-dur) var(--spring)'
            }}
          />
          {conEtiquetas && (
            <span
              aria-hidden="true"
              className="cap"
              style={{
                position: 'absolute', top: -26, left: `${topePct}%`,
                transform: topePct > 20 ? 'translateX(-100%)' : 'none',
                padding: topePct > 20 ? '0 8px 0 0' : '0 0 0 8px',
                whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--label)',
                transition: 'left var(--spring-dur) var(--spring)'
              }}
            >
              tope {pesos(tope)}
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default Capsula;
