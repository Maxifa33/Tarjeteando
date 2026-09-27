import React, { forwardRef } from 'react';
import { pesos, dolares } from './formato.js';

/**
 * Fila de un movimiento (botón). Web: chip, nombre, descripción original + ·ult4,
 * etiquetas y monto. Celular: sin etiquetas; el tipo va como texto en la 2.ª línea.
 * tipo: 'variable' | 'fijo' | 'cuota' | 'reintegro'
 */
const FilaMovimiento = forwardRef(({ mov, nombre, tipo, plastico, seleccionado = false, onClick, compacto = false }, ref) => {
  const usd = Number(mov.monto_dolares) || 0;
  const ars = Number(mov.monto_pesos) || 0;
  const esReint = tipo === 'reintegro';
  const cuota = mov.cuota_texto ? String(mov.cuota_texto).replace(/^0/, '').replace('/0', '/') : '';
  const ult4 = mov.tarjeta_ult4 ? ` · ·${mov.tarjeta_ult4}` : '';
  const monto = (v, fn) => `${esReint ? '− ' : ''}${fn(Math.abs(v))}`;
  const tipoTxt = { fijo: 'Fijo', cuota: `Cuota ${cuota}`, reintegro: 'Reintegro', variable: '' }[tipo];

  // Celular: 'Fijo · ·4410' (o el nombre de la tarjeta si no hay últimos 4).
  const segunda = compacto
    ? [tipoTxt, mov.tarjeta_ult4 ? `·${mov.tarjeta_ult4}` : mov.tarjeta].filter(Boolean).join(' · ')
    : `${mov.referencia_original || ''}${ult4}`;

  return (
    <button
      ref={ref}
      type="button"
      className={`mrow ${seleccionado ? 'on' : ''}`}
      aria-pressed={seleccionado}
      onClick={onClick}
    >
      <span className="chip-plastico" aria-hidden="true" style={{ background: plastico }} />
      <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
        <span className="cap" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{segunda}</span>
      </span>
      {!compacto && tipo === 'fijo' && <span className="tag fijo">Fijo</span>}
      {!compacto && tipo === 'cuota' && <span className="tag cuota">Cuota {cuota}</span>}
      {!compacto && esReint && <span className="tag reint">Reintegro</span>}
      {!compacto && usd !== 0 && <span className="tag">U$S</span>}
      <span className="rnd" style={{ width: compacto ? 'auto' : 130, textAlign: 'right', fontWeight: 600, flexShrink: 0, color: esReint ? 'var(--ok)' : 'var(--label)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        {ars !== 0 && <span>{monto(ars, (v) => pesos(v, { decimales: 2 }))}</span>}
        {usd !== 0 && <span style={ars !== 0 ? { fontSize: 12, fontWeight: 500 } : undefined}>{monto(usd, dolares)}</span>}
        {ars === 0 && usd === 0 && <span>{pesos(0)}</span>}
      </span>
    </button>
  );
});

FilaMovimiento.displayName = 'FilaMovimiento';
export default FilaMovimiento;
