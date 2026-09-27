import React from 'react';

/** Control segmentado. La opción activa lleva fondo --solid y sombra. */
const Seg = ({ opciones = [], valor, onCambio, ariaLabel }) => (
  <div className="seg" role="group" aria-label={ariaLabel}>
    {opciones.map(o => (
      <button
        key={o.id}
        type="button"
        className={o.id === valor ? 'on' : ''}
        aria-pressed={o.id === valor}
        onClick={() => onCambio?.(o.id)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default Seg;
