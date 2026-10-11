/** Utilidades puras para leer extractos de cuenta (sin dependencias). */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export { r2 };

/**
 * Monto en formato es-AR ("-2.484.858,00", "$ -1.234,56", "2484858,16") o inglés ("1,234.56").
 * Detecta el separador decimal por el último separador. Devuelve null si no es un número.
 */
export function parseMonto(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? r2(v) : null;
  let s = String(v).replace(/\s|\$|ARS|U\$S|USD/gi, '').replace(/[−–]/g, '-');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  if (coma > punto) s = s.replace(/\./g, '').replace(',', '.');
  else if (punto > coma && coma !== -1) s = s.replace(/,/g, '');
  else if (punto !== -1 && coma === -1) {
    // Solo puntos: si hay más de uno o el último grupo tiene 3 dígitos, son miles.
    const partes = s.split('.');
    if (partes.length > 2 || partes[partes.length - 1].length === 3) s = partes.join('');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = r2(parseFloat(s));
  return neg ? -n : n;
}

/** Fecha a 'YYYY-MM-DD'. Acepta dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, Date local y serial de Excel. */
export function fechaISO(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Serial de Excel (1900): días desde 1899-12-30, sin zona horaria.
    const ms = Math.round(v) * 86400000;
    const d = new Date(Date.UTC(1899, 11, 30) + ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mes = Number(m[2]); const dia = Number(m[1]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  return null;
}

/** Texto sin acentos, en minúsculas y con espacios simples (para comparar). */
export function normalizar(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 'Maximiliano Ivan Farinelli' → 'Maximiliano Ivan Farinelli' (capitaliza solo si viene todo en mayúsculas). */
export function prolijo(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t)) {
    return t.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase());
  }
  return t;
}

export const mesKeyDe = (iso) => String(iso || '').slice(0, 7);
