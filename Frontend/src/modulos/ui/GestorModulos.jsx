import React, { useEffect, useRef, useState } from 'react';
import { Star, Mail, LogOut, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { MODULOS, MAX_FAVORITOS, contarFavoritos } from '../registro.js';
import { iconoDe } from './iconos.js';
import './modulos.css';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ingreso por link al email. Solo hace falta para los módulos: Tarjeteando no lo pide. */
const Acceso = ({ modulos, enfocar, onEnfocado }) => {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('idle'); // idle | enviando | enviado | error
  const [msj, setMsj] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (enfocar) { ref.current?.focus(); onEnfocado?.(); } }, [enfocar, onEnfocado]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!EMAIL_OK.test(email.trim())) { setEstado('error'); setMsj('Escribí un email válido.'); return; }
    setEstado('enviando');
    const r = await modulos.entrar(email.trim());
    if (r.ok) { setEstado('enviado'); setMsj(''); } else { setEstado('error'); setMsj(r.error); }
  };

  if (estado === 'enviado') {
    return (
      <div className="mod-aviso" role="status">
        <CheckCircle size={18} aria-hidden="true" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 1 }} />
        <span>Te mandamos un link a <strong>{email.trim()}</strong>. Abrilo en este dispositivo para entrar.</span>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18, borderRadius: 20, background: 'var(--fill2)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Entrá para usar módulos</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--label2)' }}>
          Con tu email los módulos se ven igual en todos tus dispositivos. Tarjeteando sigue funcionando sin cuenta.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="mod-email" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Email</label>
        <input
          ref={ref} id="mod-email" type="email" inputMode="email" autoComplete="email" placeholder="tu@email.com"
          className="mod-campo" value={email} onChange={(e) => { setEmail(e.target.value); if (estado === 'error') setEstado('idle'); }}
          aria-invalid={estado === 'error'} aria-describedby={estado === 'error' ? 'mod-email-error' : undefined}
        />
        <button type="submit" className="btn btn-pri" disabled={estado === 'enviando'} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
          <Mail size={16} aria-hidden="true" /> {estado === 'enviando' ? 'Enviando…' : 'Enviarme el link'}
        </button>
      </div>
      {estado === 'error' && (
        <p id="mod-email-error" role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{msj}</p>
      )}
    </form>
  );
};

const FilaModulo = ({ m, e, puedeFavorito, conSesion, ocupado, modulos }) => {
  const Icono = iconoDe(m.icono);
  const activo = !!e?.activo;
  const favorito = activo && !!e?.favorito;
  const idNombre = `mod-${m.id}-nombre`;
  const idDesc = `mod-${m.id}-desc`;
  return (
    <li className={`mod-fila ${activo ? 'on' : ''}`}>
      <span className="mod-tesela" aria-hidden="true"><Icono size={22} strokeWidth={1.9} /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span id={idNombre} style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>{m.nombre}</span>
          {m.estado === 'proximamente' && <span className="h3" style={{ fontSize: 11 }}>Próximamente</span>}
          {m.estado === 'beta' && <span className="mod-chip">Beta</span>}
        </span>
        <span id={idDesc} style={{ fontSize: 14, lineHeight: '20px', color: 'var(--label2)' }}>{m.descripcion}</span>
      </span>
      <button
        type="button" className="ico mod-estrella" aria-pressed={favorito}
        aria-label={favorito ? `Quitar ${m.nombre} de favoritos` : `Marcar ${m.nombre} como favorito`}
        title={!favorito && !puedeFavorito ? `Hasta ${MAX_FAVORITOS} favoritos` : undefined}
        aria-describedby={!favorito && !puedeFavorito ? 'mod-tope-favoritos' : undefined}
        disabled={ocupado || !conSesion || (!favorito && !puedeFavorito)}
        onClick={() => modulos.alternarFavorito(m.id)}
      >
        <Star size={19} aria-hidden="true" fill={favorito ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button" role="switch" className="mod-switch" aria-checked={activo}
        aria-labelledby={idNombre} aria-describedby={idDesc} disabled={ocupado} aria-busy={ocupado || undefined}
        onClick={() => (activo ? modulos.desactivar(m.id) : modulos.activar(m.id))}
      />
    </li>
  );
};

/** Más → Módulos: activar, desactivar y elegir favoritos. */
const GestorModulos = ({ modulos }) => {
  if (!modulos.configurado) {
    return (
      <div className="mod-aviso" role="status">
        <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Módulos no configurados en esta instalación. Tarjeteando funciona igual.</span>
      </div>
    );
  }

  const conSesion = !!modulos.sesion;
  const favoritos = contarFavoritos(modulos.estado);
  const puedeFavorito = favoritos < MAX_FAVORITOS;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
      <p style={{ margin: 0, fontSize: 17, lineHeight: '24px', color: 'var(--label2)' }}>
        Sumá a Tarjeteando solo lo que necesitás. Los favoritos aparecen como pestañas, hasta {MAX_FAVORITOS}; el resto, en Más.
      </p>

      {!conSesion && <Acceso modulos={modulos} enfocar={modulos.pidiendoLogin} onEnfocado={modulos.cerrarLogin} />}

      {modulos.error && (
        <div className="mod-aviso" role="alert">
          <AlertCircle size={18} aria-hidden="true" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{modulos.error}</span>
          <button type="button" className="btn" onClick={modulos.limpiarError} style={{ minHeight: 44 }}>Entendido</button>
        </div>
      )}

      <ul className="mod-lista" aria-label="Módulos" aria-busy={modulos.cargando}>
        {MODULOS.map((m) => (
          <FilaModulo key={m.id} m={m} e={modulos.estado[m.id]} puedeFavorito={puedeFavorito} conSesion={conSesion}
            ocupado={!!modulos.guardando[m.id] || (conSesion && modulos.cargando)} modulos={modulos} />
        ))}
      </ul>

      {!puedeFavorito && (
        <p id="mod-tope-favoritos" style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Ya tenés {MAX_FAVORITOS} favoritos. Quitá uno para elegir otro.</p>
      )}

      {conSesion && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 14, color: 'var(--label2)' }}>
          <span>Conectado como {modulos.sesion.user?.email}</span>
          <button type="button" className="btn" onClick={modulos.salir} style={{ minHeight: 44 }}>
            <LogOut size={16} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </section>
  );
};

export default GestorModulos;
