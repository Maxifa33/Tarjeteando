import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, Menu } from 'lucide-react';
import { SECCIONES } from './secciones.js';

const CERRADO = 62;
// botón + 4 secciones + gaps + separador + Importar + aire
const ABIERTO = 62 + 4 * 56 + 2 * 3 + 9 + 56 + 10;

const estiloItem = {
  width: 54, height: 54, borderRadius: 27, flexShrink: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 2, fontSize: 10, fontWeight: 600, color: 'var(--label)'
};

/**
 * Riel de navegación para celular: un botón de vidrio abajo a la derecha (o a la
 * izquierda) que se despliega hacia arriba con las 4 secciones e Importar.
 */
const Rail = ({ seccion, onSeccion, onImportar, izquierda = false }) => {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef(null);
  const actual = SECCIONES.find(s => s.id === seccion);
  const IconoActual = actual?.icono || Menu;

  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { setAbierto(false); botonRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const elegir = (id) => {
    setAbierto(false);
    onSeccion?.(id);
  };

  const oculto = !abierto;

  return (
    <>
      {abierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          onClick={() => setAbierto(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 35, background: 'rgba(0,0,0,.12)', border: 0 }}
        />
      )}
      <nav
        aria-label="Secciones"
        className="vidrio spr"
        style={{
          position: 'fixed', bottom: 30, [izquierda ? 'left' : 'right']: 12,
          width: 62, height: abierto ? ABIERTO : CERRADO, borderRadius: 31,
          overflow: 'hidden', zIndex: 40,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center'
        }}
      >
        <div
          aria-hidden={oculto}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 4,
            opacity: abierto ? 1 : 0, transition: 'opacity .25s',
            visibility: abierto ? 'visible' : 'hidden'
          }}
        >
          {SECCIONES.map(s => {
            const Icono = s.icono;
            const on = s.id === seccion;
            return (
              <button
                key={s.id}
                type="button"
                tabIndex={oculto ? -1 : 0}
                aria-current={on ? 'page' : undefined}
                aria-label={s.label}
                onClick={() => elegir(s.id)}
                style={{ ...estiloItem, background: on ? 'var(--fill)' : 'transparent' }}
              >
                <Icono size={21} aria-hidden="true" />
                <span aria-hidden="true">{s.corto || s.label}</span>
              </button>
            );
          })}
          <div aria-hidden="true" style={{ width: 30, height: 0.5, background: 'var(--sep)', margin: '4px 0' }} />
          <button
            type="button"
            tabIndex={oculto ? -1 : 0}
            aria-label="Importar"
            onClick={() => { setAbierto(false); onImportar?.(); }}
            style={{ ...estiloItem, background: 'var(--inv)', color: 'var(--inv-text)' }}
          >
            <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <div style={{ height: 6 }} />
        </div>
        <button
          ref={botonRef}
          type="button"
          onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar menú de secciones' : `Sección actual: ${actual?.label || 'otra'}. Abrir menú de secciones`}
          style={{ ...estiloItem, margin: '4px 0', background: 'var(--fill)' }}
        >
          {abierto
            ? <X size={20} strokeWidth={2.4} aria-hidden="true" />
            : <><IconoActual size={21} aria-hidden="true" /><span aria-hidden="true">{actual?.corto || actual?.label || 'Menú'}</span></>}
        </button>
      </nav>
    </>
  );
};

export default Rail;
