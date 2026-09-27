import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, X, Check } from 'lucide-react';
import { SECCIONES } from './secciones.js';
import CampoDeLuz from './CampoDeLuz.jsx';
import Rail from './Rail.jsx';
import useCompacto from './useCompacto.js';

// Ícono de apariencia del prototipo: círculo mitad lleno.
const IconoApariencia = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
  </svg>
);

const Marca = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
    <div aria-hidden="true" style={{ position: 'relative', width: 28, height: 22, flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 21, height: 14, borderRadius: 4, background: 'linear-gradient(135deg,#C2185B,#6E0B3E)' }} />
      <div style={{ position: 'absolute', left: 7, top: 7, width: 21, height: 14, borderRadius: 4, background: 'linear-gradient(135deg,#D0021B,#7A0615)', boxShadow: '0 2px 6px rgba(0,0,0,.3)' }} />
    </div>
    <span className="marca-nombre" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Tarjeteando</span>
  </div>
);

/**
 * Menú "Más" (popover de vidrio). items: [{ tipo: 'radio'|'check'|'item'|'sep'|'titulo', id, label, checked, onSelect }]
 * Radios y checks dejan el menú abierto; los ítems de navegación lo cierran.
 */
const MenuMas = ({ items, onCerrar, estilo }) => {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
  }, []);

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const botones = [...ref.current.querySelectorAll('button')];
    const i = botones.indexOf(document.activeElement);
    const sig = e.key === 'ArrowDown' ? (i + 1) % botones.length : (i - 1 + botones.length) % botones.length;
    botones[sig]?.focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Más opciones"
      className="vidrio menu-mas entra"
      onKeyDown={onKeyDown}
      style={{ width: 250, padding: 6, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 50, ...estilo }}
    >
      {items.map((it, i) => {
        if (it.tipo === 'sep') return <div key={`sep-${i}`} className="sep" role="separator" />;
        if (it.tipo === 'titulo') {
          return <div key={`t-${i}`} className="cap" style={{ padding: '6px 12px 2px', fontWeight: 600 }}>{it.label}</div>;
        }
        const role = it.tipo === 'radio' ? 'menuitemradio' : it.tipo === 'check' ? 'menuitemcheckbox' : 'menuitem';
        const marcable = it.tipo === 'radio' || it.tipo === 'check';
        return (
          <button
            key={it.id}
            type="button"
            role={role}
            aria-checked={marcable ? !!it.checked : undefined}
            onClick={() => { it.onSelect?.(); if (!marcable) onCerrar(); }}
          >
            <span style={{ width: 18, display: 'inline-flex' }} aria-hidden="true">
              {marcable && it.checked ? <Check size={16} strokeWidth={2.6} /> : null}
            </span>
            {it.label}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Marco de la app. Web: barra superior (marca · pestañas · Buscar/Más/Importar) y
 * ventana de vidrio con scroll interno. Celular (< 768 px): marca arriba del
 * contenido y riel plegable abajo.
 */
const AppShell = ({
  seccion,
  onSeccion,
  onImportar,
  busqueda = '',
  onBuscar,
  menu = [],
  manchas = [],
  railIzquierda = false,
  titulo,
  subtitulo,
  children
}) => {
  const compacto = useCompacto();
  const itemsMenu = menu.filter(it => !it.soloCelular || compacto);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const mainRef = useRef(null);
  const menuWrapRef = useRef(null);
  const masRef = useRef(null);
  const buscarRef = useRef(null);

  // Cambiar de sección vuelve el contenido arriba.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [seccion]);

  // Menú Más: clic afuera o Esc lo cierran.
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const onDown = (e) => {
      if (!menuWrapRef.current?.contains(e.target)) setMenuAbierto(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenuAbierto(false); masRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuAbierto]);

  const cerrarBusqueda = () => {
    setBuscando(false);
    onBuscar?.('');
  };

  const campoAbierto = buscando || !!busqueda;

  const buscador = campoAbierto ? (
    <label
      className="vidrio"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 6px 0 14px',
        borderRadius: 22, width: compacto ? '100%' : 240, color: 'var(--label2)'
      }}
    >
      <Search size={17} aria-hidden="true" />
      <input
        ref={buscarRef}
        autoFocus
        type="search"
        aria-label="Buscar"
        placeholder="Buscar"
        value={busqueda}
        onChange={(e) => onBuscar?.(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrarBusqueda(); } }}
        style={{ flex: 1, minWidth: 0, border: 0, background: 'none', outline: 'none', font: 'inherit', fontSize: 15, color: 'var(--label)' }}
      />
      <button type="button" className="ico" aria-label="Cerrar búsqueda" onClick={cerrarBusqueda} style={{ width: 32, height: 32, borderRadius: 16 }}>
        <X size={16} aria-hidden="true" />
      </button>
    </label>
  ) : (
    <button type="button" className="ico vidrio" aria-label="Buscar" onClick={() => setBuscando(true)}>
      <Search size={19} aria-hidden="true" />
    </button>
  );

  const botonMas = (
    <div ref={menuWrapRef} style={{ position: 'relative' }}>
      <button
        ref={masRef}
        type="button"
        className="ico vidrio"
        aria-label="Apariencia y más opciones"
        aria-haspopup="menu"
        aria-expanded={menuAbierto}
        onClick={() => setMenuAbierto(a => !a)}
      >
        <IconoApariencia />
      </button>
      {menuAbierto && (
        <MenuMas
          items={itemsMenu}
          onCerrar={() => setMenuAbierto(false)}
          estilo={{ position: 'absolute', right: 0, top: 54 }}
        />
      )}
    </div>
  );

  const encabezado = titulo ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
      {subtitulo && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label2)' }}>{subtitulo}</span>}
      <h1 className="titulo">{titulo}</h1>
    </div>
  ) : null;

  if (compacto) {
    return (
      <>
        <CampoDeLuz manchas={manchas} />
        <main
          ref={mainRef}
          className="shell-scroll"
          style={{ position: 'fixed', inset: 0, overflowY: 'auto', overflowX: 'hidden', zIndex: 1, padding: '16px 16px 120px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            {campoAbierto ? buscador : <Marca />}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {!campoAbierto && buscador}
              {botonMas}
            </div>
          </div>
          {encabezado}
          {children}
        </main>
        <Rail seccion={seccion} onSeccion={onSeccion} onImportar={onImportar} izquierda={railIzquierda} />
      </>
    );
  }

  return (
    <>
      <CampoDeLuz manchas={manchas} />
      <header
        style={{
          position: 'fixed', left: 40, right: 40, top: 22, height: 52, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
        }}
      >
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex' }}>
          <Marca />
        </div>
        <nav aria-label="Secciones" className="vidrio" style={{ display: 'flex', gap: 2, padding: 6, borderRadius: 26, flexShrink: 0 }}>
          {SECCIONES.map(s => (
            <button
              key={s.id}
              type="button"
              className={`tab ${seccion === s.id ? 'on' : ''}`}
              aria-current={seccion === s.id ? 'page' : undefined}
              onClick={() => onSeccion?.(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          {buscador}
          {botonMas}
          <button type="button" className="btn btn-pri" aria-label="Importar" onClick={onImportar} style={{ height: 44, borderRadius: 22, padding: '0 18px', fontSize: 15, flexShrink: 0 }}>
            <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
            <span className="importar-label">Importar</span>
          </button>
        </div>
      </header>
      <main
        ref={mainRef}
        className="vidrio shell-scroll"
        style={{
          position: 'fixed', left: 40, right: 40, top: 96, bottom: 40, zIndex: 1,
          borderRadius: 36, padding: '30px 44px 40px', overflowY: 'auto', overflowX: 'hidden'
        }}
      >
        {encabezado}
        {children}
      </main>
    </>
  );
};

export default AppShell;
