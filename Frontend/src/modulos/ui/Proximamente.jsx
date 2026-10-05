import React from 'react';
import { ChevronRight, Smartphone } from 'lucide-react';
import { iconoDe } from './iconos.js';
import { pesos, dolares, mesLargo } from '../../ui/formato.js';
import './modulos.css';

const Cifra = ({ label, valor, fuerte }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
    <span style={{ fontSize: 13, color: 'var(--label2)' }}>{label}</span>
    <span className="mod-cifra" style={{ fontSize: fuerte ? 28 : 20, lineHeight: fuerte ? '34px' : '26px', fontWeight: fuerte ? 700 : 600, letterSpacing: '-.02em' }}>{valor}</span>
  </div>
);

/** Lo que Presupuestos ya puede leer de Tarjeteando (valida el puente). */
const DelMes = ({ puente }) => {
  if (!puente) return null;
  const sinNada = puente.tarjetasConDatos === 0;
  return (
    <section aria-labelledby="mod-puente" style={{ padding: 20, borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="h3">Ya conectado</span>
        <h2 id="mod-puente" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
          Tus tarjetas {puente.mesKey ? `en ${mesLargo(puente.mesKey)}` : 'este mes'}
        </h2>
      </div>
      {sinNada ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Todavía no hay resúmenes ni últimos consumos para este mes.</p>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Cifra label="A pagar" valor={pesos(puente.total)} fuerte />
          <Cifra label="Cuotas" valor={pesos(puente.cuotas)} />
          <Cifra label="Fijos" valor={pesos(puente.fijos)} />
          <Cifra label="Variables" valor={pesos(puente.variables)} />
          {puente.usd.total > 0 && <Cifra label="En dólares" valor={dolares(puente.usd.total)} />}
        </div>
      )}
      <p style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--label2)' }}>
        <Smartphone size={14} aria-hidden="true" /> Datos de tarjetas de este dispositivo.
      </p>
    </section>
  );
};

/** Pantalla de un módulo que todavía no está construido. */
const Proximamente = ({ modulo, puente }) => {
  const Icono = iconoDe(modulo.icono);
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="mod-tesela" aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--inv)', color: 'var(--inv-text)' }}>
          <Icono size={30} strokeWidth={1.8} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span className="h3">Próximamente</span>
          <p style={{ margin: 0, fontSize: 17, lineHeight: '24px', color: 'var(--label2)' }}>{modulo.descripcion}</p>
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(modulo.promesa || []).map((t, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 15, lineHeight: '22px' }}>
            <ChevronRight size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3, color: 'var(--label2)' }} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {modulo.usaPuenteTarjeteando && <DelMes puente={puente} />}
    </section>
  );
};

export default Proximamente;
