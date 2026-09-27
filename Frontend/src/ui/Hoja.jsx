import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Hoja inferior de vidrio para celular. Entra desde abajo con --spring.
 * Esc, el velo o la X la cierran. Se usa desde la fase 4.
 * Va en un portal a <body>: así queda por encima del riel y el vidrio desenfoca
 * de verdad lo que hay detrás (dentro de <main> no puede).
 */
const Hoja = ({ abierta, onCerrar, titulo, children }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!abierta) { setVisible(false); return undefined; }
    const id = requestAnimationFrame(() => setVisible(true));
    const onKey = (e) => { if (e.key === 'Escape') onCerrar?.(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey); };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onCerrar}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.32)', border: 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="vidrio hoja-panel"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxHeight: '90%', overflowY: 'auto',
          borderRadius: '34px 34px 0 0', padding: '8px 20px 32px',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform var(--spring-dur) var(--spring)'
        }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--fill)', margin: '0 auto 8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: -6 }}
          >
            <span style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} aria-hidden="true" />
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Hoja;
