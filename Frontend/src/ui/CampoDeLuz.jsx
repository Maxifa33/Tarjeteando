import React from 'react';

/**
 * Fondo de 4 manchas difuminadas con el color de cada tarjeta.
 * Las posiciones vienen en fracción del viewport (ver manchasDeLuz en identidad.js).
 * Se oculta con Reducir transparencia (.tj.rt) o prefers-reduced-transparency (tokens.css).
 */
const CampoDeLuz = ({ manchas = [] }) => (
  <div className="campo-luz" aria-hidden="true">
    {manchas.map(m => (
      <div
        key={m.clave}
        className="mancha"
        style={{
          background: m.color,
          transform: `translate(${m.x * 100}vw, ${m.y * 100}vh) scale(${m.escala})`,
          opacity: `calc(var(--blob-op) * ${m.opacidad})`
        }}
      />
    ))}
  </div>
);

export default CampoDeLuz;
