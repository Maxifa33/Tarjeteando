import React from 'react';

/**
 * Plástico de 400×252 (compacto 358×226) con el gradiente de identidad de la tarjeta.
 * Arriba: banco + estado / monto + vence. Medio: chip dorado. Abajo: •• ult4 + red.
 * SuperCard: un segundo plástico asoma 9 px arriba al 55 %.
 */
export const TAM_PLASTICO = { web: { w: 400, h: 252 }, compacto: { w: 358, h: 226 } };

const Plastico = ({ identidad, banco, red, estado, monto, vence, ultimos4 = [], superCard = false, compacto = false }) => {
  const { w, h } = compacto ? TAM_PLASTICO.compacto : TAM_PLASTICO.web;
  const fg = identidad.texto;
  const fg2 = identidad.texto2;
  return (
    <div style={{ position: 'relative', width: w }}>
      {superCard && (
        <div aria-hidden="true" style={{ position: 'absolute', left: 12, right: 12, top: -9, height: 60, borderRadius: 18, background: identidad.plastico, opacity: 0.55 }} />
      )}
      <div className="plastico" style={{ width: w, height: h, padding: compacto ? '18px 20px' : '20px 22px', background: identidad.plastico, color: fg, textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{banco}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: fg2 }}>{estado}</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            <span className="rnd" style={{ fontSize: 20, fontWeight: 700 }}>{monto}</span>
            {vence && <span style={{ fontSize: 12, fontWeight: 500, color: fg2 }}>{vence}</span>}
          </span>
        </div>
        <div aria-hidden="true" style={{ width: 44, height: 32, borderRadius: 7, background: 'linear-gradient(135deg,#E8D9A8,#B89B55)', opacity: 0.9, position: 'relative', zIndex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, position: 'relative', zIndex: 1 }}>
          <span className="rnd" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
            {ultimos4.length ? ultimos4.map(u => `•• ${u}`).join('  ') : '••••'}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, fontStyle: 'italic', letterSpacing: '.02em' }}>{red}</span>
        </div>
      </div>
    </div>
  );
};

export default Plastico;
