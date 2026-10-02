/**
 * Formatos de la UI nueva. Pesos sin decimales para los resúmenes grandes
 * (como el prototipo); con decimales solo donde se pide.
 */
const NBSP = ' ';

export function pesos(n, { decimales = 0 } = {}) {
  const v = Number(n) || 0;
  const txt = Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${v < 0 ? '−' : ''}$${NBSP}${txt}`;
}

export function dolares(n) {
  const v = Number(n) || 0;
  return `U$S${NBSP}${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const fechaLocal = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
};

/** 'YYYY-MM' → 'octubre' */
export function nombreMes(mesKey) {
  const [a, m] = String(mesKey).split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' });
}

export const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** 'YYYY-MM' → 'oct' */
export function mesCorto(mesKey) {
  return nombreMes(mesKey).slice(0, 3);
}

/** 'YYYY-MM-DD' → 'vie 9' */
export function diaCorto(iso) {
  if (!iso) return '';
  const f = fechaLocal(iso);
  return `${f.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')} ${f.getDate()}`;
}

/** 'YYYY-MM-DD' → 'viernes 2/10' */
export function diaLargo(iso) {
  if (!iso) return '';
  const f = fechaLocal(iso);
  return `${f.toLocaleDateString('es-AR', { weekday: 'long' })} ${f.getDate()}/${f.getMonth() + 1}`;
}

/** Fecha de hoy para el encabezado: 'Domingo 27 de septiembre'. */
export function hoyLargo(ahora = new Date()) {
  return capitalizar(ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', ''));
}

/** ISO con hora → 'hoy 22:46' o '25/09 22:46'. */
export function momento(isoDateTime, ahora = new Date()) {
  if (!isoDateTime) return '';
  const f = new Date(isoDateTime);
  if (isNaN(f)) return '';
  const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const mismoDia = f.toDateString() === ahora.toDateString();
  return mismoDia ? `hoy ${hora}` : `${f.getDate()}/${f.getMonth() + 1} ${hora}`;
}

/** Valor corto para etiquetas de gráfico: '1,8 M', '450 k'. */
export function corto(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `${(Math.round(v / 1e5) / 10).toLocaleString('es-AR')} M`;
  if (Math.abs(v) >= 1e3) return `${Math.round(v / 1e3)} k`;
  return String(Math.round(v));
}

/** 'YYYY-MM' → 'octubre 2026' */
export function mesLargo(mesKey) {
  const [a, m] = String(mesKey).split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
}
