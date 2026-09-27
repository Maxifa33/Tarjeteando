import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload, LayoutDashboard, Receipt, Repeat, Calendar, Zap, RefreshCcw, Settings, CreditCard, PieChart,
  Sparkles, X, CheckCircle, BookOpen, ChevronRight
} from 'lucide-react';
import { APP_VERSION, NOVEDADES, GUIA } from '../novedades.js';

const ICONOS_GUIA = { Upload, LayoutDashboard, Receipt, Repeat, Calendar, Zap, RefreshCcw, Settings, CreditCard, PieChart };

/** Modal que aparece una vez por versión con lo nuevo. Contenido en novedades.js. */
export const NovedadesModal = ({ onCerrar }) => {
  const actual = NOVEDADES[0];
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);
  if (!actual) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={() => onCerrar(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.32)', border: 0 }} />
      <div role="dialog" aria-modal="true" aria-labelledby="novedades-titulo" className="vidrio entra"
        style={{ position: 'relative', width: 'min(520px, 100%)', maxHeight: '85vh', overflowY: 'auto', borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="h3">Novedades · {actual.fecha}</span>
            <h2 id="novedades-titulo" style={{ margin: 0, fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: '-.01em' }}>{actual.titulo}</h2>
          </div>
          <button type="button" className="ico" aria-label="Cerrar" onClick={() => onCerrar(false)}><X size={18} aria-hidden="true" /></button>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {actual.puntos.map((p, i) => (
            <li key={i} style={{ display: 'flex', gap: 12 }}>
              <CheckCircle size={20} aria-hidden="true" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{p.titulo}</span>
                <span style={{ fontSize: 14, lineHeight: '20px', color: 'var(--label2)' }}>{p.texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => onCerrar(true)} style={{ minHeight: 44 }}>
            <BookOpen size={16} aria-hidden="true" /> Ver guía completa
          </button>
          <button type="button" className="btn btn-pri" onClick={() => onCerrar(false)} style={{ minHeight: 44 }} autoFocus>Entendido</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Mini manual de todas las funciones. Siempre disponible desde el menú Más. */
export const GuiaView = ({ onVerNovedades }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <p style={{ margin: 0, fontSize: 17, color: 'var(--label2)' }}>Todas las funciones, en pocas líneas. Versión {APP_VERSION}.</p>
      <button type="button" className="btn" onClick={onVerNovedades} style={{ minHeight: 44 }}>
        <Sparkles size={16} aria-hidden="true" /> Ver novedades
      </button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 14 }}>
      {GUIA.map((seccion) => {
        const Icono = ICONOS_GUIA[seccion.icono] || BookOpen;
        return (
          <section key={seccion.id} aria-labelledby={`guia-${seccion.id}`} style={{ padding: 20, borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--fill)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icono size={16} />
              </span>
              <h2 id={`guia-${seccion.id}`} style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{seccion.titulo}</h2>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seccion.items.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, lineHeight: '20px', color: 'var(--label2)' }}>
                  <ChevronRight size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  </section>
);
