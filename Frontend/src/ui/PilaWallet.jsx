import React, { useEffect, useRef, useState } from 'react';
import Plastico, { TAM_PLASTICO } from './Plastico.jsx';

/**
 * Pila tipo Wallet. Todas: abanico (y = i × 80; compacto 64; más de 6: 64).
 * Elegida: arriba (y = 0) y el resto apilado en canto (y = 290 + j × 16; compacto
 * 252 + j × 12), un poco más chicas y más oscuras. Transform animado con --spring.
 * En celular, con una elegida, el contenedor recorta la pila: solo se ven los cantos.
 *
 * tarjetas: [{ id, identidad, banco, red, estado, monto, vence, ultimos4, superCard, aria }]
 */
const PilaWallet = ({ tarjetas = [], elegida = null, onElegir, compacto = false, oscuro = true }) => {
  const base = compacto ? TAM_PLASTICO.compacto : TAM_PLASTICO.web;
  // Ancho disponible (pantallas de 320 px o texto grande): la pila se achica entera.
  const ref = useRef(null);
  const [disponible, setDisponible] = useState(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setDisponible(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = disponible ? Math.min(base.w, disponible) : base.w;
  const k = w / base.w;
  const h = Math.round(base.h * k);
  const n = tarjetas.length;
  const paso = Math.round((compacto || n > 6 ? 64 : 80) * k);
  const inicioCantos = Math.round((compacto ? 252 : 290) * k);
  const canto = compacto ? 12 : 16;
  const hayElegida = tarjetas.some(t => t.id === elegida);
  const otras = tarjetas.filter(t => t.id !== elegida);

  const pos = (t, i) => {
    if (!hayElegida) return { y: i * paso, s: 1, z: i + 1, b: 1 };
    if (t.id === elegida) return { y: 0, s: 1, z: 50, b: 1 };
    const j = otras.indexOf(t);
    return { y: inicioCantos + j * canto, s: Math.min(0.96, 0.92 - (2 - j) * 0.02), z: j + 1, b: oscuro ? 0.7 : 0.94 };
  };

  const alto = !hayElegida
    ? (n - 1) * paso + h + 10
    : compacto
      ? inicioCantos + (n - 2) * canto + 18 // recorte: la elegida entera y los cantos de las demás
      : inicioCantos + (n - 2) * canto + h * 0.92 + 10;

  return (
    <div
      ref={ref}
      className="pila-carta"
      role="group"
      aria-label="Tarjetas"
      style={{ position: 'relative', width: w, maxWidth: '100%', height: n ? alto : 0, overflow: compacto && hayElegida ? 'hidden' : 'visible', transition: 'height var(--spring-dur) var(--spring)', paddingTop: 10, boxSizing: 'content-box' }}
    >
      {tarjetas.map((t, i) => {
        const p = pos(t, i);
        return (
          <div
            key={t.id}
            className="pila-carta"
            style={{
              position: 'absolute', left: 0, top: 10, width: w, zIndex: p.z,
              transform: `translateY(${p.y}px) scale(${p.s})`, transformOrigin: 'top center', filter: `brightness(${p.b})`
            }}
          >
            <button
              type="button"
              className="pila-slot"
              onClick={() => onElegir?.(t.id === elegida ? null : t.id)}
              aria-pressed={t.id === elegida}
              aria-label={t.aria}
              style={{ display: 'block', width: w, borderRadius: 20, padding: 0 }}
            >
              <div className="pila-lift">
                <Plastico
                  identidad={t.identidad}
                  banco={t.banco}
                  red={t.red}
                  estado={t.estado}
                  monto={t.monto}
                  vence={t.vence}
                  ultimos4={t.ultimos4}
                  superCard={t.superCard}
                  compacto={compacto}
                  ancho={w}
                />
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default PilaWallet;
