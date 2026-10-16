import { pesos, dolares } from '../../../ui/formato.js';

const NBSP = ' ';
const SIMBOLO = { EUR: '€', GBP: '£' };

/** Importe en cualquier moneda: $ y U$S como en el resto de la app; las demás con 2 decimales y su símbolo o código. */
export function dinero(n, moneda = 'ARS') {
  if (moneda === 'ARS') return pesos(n);
  if (moneda === 'USD') return dolares(n);
  const v = Number(n) || 0;
  const txt = Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? '−' : ''}${SIMBOLO[moneda] || moneda}${NBSP}${txt}`;
}

export const etiquetaMoneda = (m) => (m === 'ARS' ? '$' : m === 'USD' ? 'U$S' : SIMBOLO[m] || m);
