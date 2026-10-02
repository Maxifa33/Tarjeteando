import React, { useState } from 'react';
import { Wallet, Upload, Sparkles, Clock, FileText, Edit3, CheckCircle } from 'lucide-react';

/**
 * Bienvenida para usuarios nuevos: 3 pasos y después Importar (mismo flujo que antes,
 * con el estilo nuevo). Se muestra sola, antes del marco de la app.
 */
const BANCOS = ['Galicia', 'Macro', 'Santander', 'BBVA', 'HSBC', 'ICBC'];

const Tip = ({ icono: Icono, titulo, texto }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 16, background: 'var(--fill2)', textAlign: 'left' }}>
    <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--fill)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icono size={16} />
    </span>
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</span>
      <span style={{ fontSize: 13, lineHeight: '18px', color: 'var(--label2)' }}>{texto}</span>
    </span>
  </div>
);

const OnboardingWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);

  const steps = [
    {
      icono: Wallet,
      titulo: 'Bienvenido a Tarjeteando',
      contenido: (
        <p style={{ margin: 0, fontSize: 17, lineHeight: '24px', color: 'var(--label2)', maxWidth: 440 }}>
          Tu asistente para los resúmenes de tus tarjetas de crédito. Te ayudamos a entender tus gastos,
          seguir tus cuotas y saber cuánto ya está comprometido del próximo pago.
        </p>
      )
    },
    {
      icono: Upload,
      titulo: 'Subí tu primer resumen',
      contenido: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', maxWidth: 460 }}>
          <p style={{ margin: 0, fontSize: 17, lineHeight: '24px', color: 'var(--label2)' }}>
            Arrastrá el PDF de tu resumen o el Excel de Últimos consumos. Leemos VISA, Mastercard y American Express
            de los principales bancos argentinos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {BANCOS.map((b) => <span key={b} className="pchip" style={{ cursor: 'default' }}>{b}</span>)}
          </div>
          <p style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--label2)' }}>
            <Clock size={16} aria-hidden="true" style={{ color: 'var(--warn)', flexShrink: 0 }} />
            La primera carga puede tardar unos segundos mientras procesamos el PDF.
          </p>
        </div>
      )
    },
    {
      icono: Sparkles,
      titulo: 'Tips para empezar',
      contenido: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460, width: '100%' }}>
          <Tip icono={FileText} titulo="Subí varios meses" texto="Con más resúmenes, el historial y la proyección de cuotas son más precisos." />
          <Tip icono={Edit3} titulo="Renombrá comercios" texto="Desde el detalle de cada movimiento: el nombre nuevo vale para todos los meses." />
          <Tip icono={CheckCircle} titulo="Tus datos son privados" texto="Todo se guarda en tu navegador. No almacenamos tus resúmenes en ningún servidor." />
        </div>
      )
    }
  ];

  const actual = steps[step - 1];
  const Icono = actual.icono;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--base)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div className="mancha" style={{ background: '#E8484E', transform: 'translate(-15vw, -20vh) scale(1.1)', opacity: 'calc(var(--blob-op) * 1)' }} />
        <div className="mancha" style={{ background: '#4C8FEA', transform: 'translate(55vw, 40vh) scale(0.9)', opacity: 'calc(var(--blob-op) * 1)' }} />
      </div>
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-titulo" className="vidrio entra"
        style={{ position: 'relative', width: 'min(620px, 100%)', maxHeight: '100%', overflowY: 'auto', borderRadius: 32, padding: 'clamp(20px, 5vw, 36px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step} aria-label={`Paso ${step} de ${steps.length}`}
          style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {steps.map((_, i) => (
            <span key={i} className="spr" style={{ height: 8, borderRadius: 4, width: i + 1 === step ? 40 : 8, background: i + 1 <= step ? 'var(--label)' : 'var(--fill)' }} />
          ))}
        </div>
        <div key={step} className="entra" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
          <span aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--fill)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icono size={32} />
          </span>
          <h1 id="onboarding-titulo" className="titulo" style={{ fontSize: 30, lineHeight: '36px' }}>{actual.titulo}</h1>
          {actual.contenido}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16, borderTop: '0.5px solid var(--sep)' }}>
          <button type="button" className="btn" onClick={() => setStep((s) => Math.max(1, s - 1))} style={{ minHeight: 44, visibility: step === 1 ? 'hidden' : 'visible' }}>
            Anterior
          </button>
          <span className="cap">Paso {step} de {steps.length}</span>
          {step < steps.length ? (
            <button type="button" className="btn btn-pri" onClick={() => setStep((s) => s + 1)} style={{ minHeight: 44, padding: '0 22px' }}>Siguiente</button>
          ) : (
            <button type="button" className="btn btn-pri" onClick={onComplete} style={{ minHeight: 44, padding: '0 22px' }}>Comenzar</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
