/**
 * Helpers compartidos por los lectores de "Últimos consumos".
 */

/**
 * 'DD/MM/YYYY' | 'YYYY-MM-DD' | Date → { fecha: 'YYYY-MM-DD', corregida }.
 * Una fecha imposible (31/09) pasa al último día válido de ese mes y se marca
 * `corregida`, para avisar al usuario sin romper la importación.
 */
export function fechaSegura(valor) {
  if (!valor) return { fecha: '', corregida: false };
  if (valor instanceof Date && !isNaN(valor)) {
    const p = (n) => String(n).padStart(2, '0');
    return { fecha: `${valor.getFullYear()}-${p(valor.getMonth() + 1)}-${p(valor.getDate())}`, corregida: false };
  }
  const s = String(valor).trim();
  let d, m, y;
  let mm = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (mm) { [, d, m, y] = mm; if (y.length === 2) y = '20' + y; }
  else if ((mm = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) { [, y, m, d] = mm; }
  else return { fecha: '', corregida: false };
  d = +d; m = +m; y = +y;
  if (m < 1 || m > 12 || d < 1) return { fecha: '', corregida: false };
  const ultimo = new Date(y, m, 0).getDate();
  const corregida = d > ultimo;
  if (corregida) d = ultimo;
  return { fecha: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, corregida };
}

export function detectarRed(texto) {
  const t = String(texto || '').toUpperCase();
  if (/AMERICAN\s*EXPRESS|AMEX/.test(t)) return 'Amex';
  if (/MASTER/.test(t)) return 'Mastercard';
  if (/VISA/.test(t)) return 'Visa';
  if (/CABAL/.test(t)) return 'Cabal';
  if (/NARANJA/.test(t)) return 'Naranja';
  return '';
}

function hash32(str) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/** ID estable por contenido (mismo archivo subido dos veces → mismos IDs). */
export function idConsumo(c, ocurrencia = 0) {
  return 'lc_' + hash32([c.tarjeta_ult4, c.fecha, c.descripcion, c.monto_pesos, c.monto_dolares, c.comprobante, c.cuotas_texto, ocurrencia].join('|'));
}

/** Días entre dos fechas 'YYYY-MM-DD' (b - a), en calendario local. */
export function diasEntre(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export function hoyISO(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}
