/**
 * Migraciones de localStorage que no tocan movimientos (testeables en Node con un
 * almacenamiento falso { getItem, setItem, removeItem }).
 */
import { normalizarApariencia } from './apariencia.js';

const leer = (almacen, key) => {
  try {
    const v = almacen.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

/**
 * 1.3.0 → 1.4.0 (rediseño B+C). Idempotente.
 *  - El tema viejo ('tarjetas_theme' o config.theme) pasa a config.apariencia, si
 *    todavía no hay apariencia guardada.
 *  - Se borran 'tarjetas_theme', 'dashboard_card_order' y config.theme.
 * @returns {{ cambios: string[] }}
 */
export function migrarA140(almacen) {
  const cambios = [];
  let temaViejo = null;
  try { temaViejo = almacen.getItem('tarjetas_theme'); } catch { /* sin storage */ }
  const config = leer(almacen, 'tarjetas_config') || {};

  const nueva = { ...config };
  if (!config.apariencia) {
    nueva.apariencia = normalizarApariencia(null, temaViejo || config.theme || null);
    cambios.push('apariencia');
  }
  if ('theme' in nueva) {
    delete nueva.theme;
    cambios.push('config.theme');
  }
  if (cambios.length) {
    try { almacen.setItem('tarjetas_config', JSON.stringify(nueva)); } catch { /* sin storage */ }
  }
  for (const key of ['tarjetas_theme', 'dashboard_card_order']) {
    try {
      if (almacen.getItem(key) !== null) {
        almacen.removeItem(key);
        cambios.push(key);
      }
    } catch { /* sin storage */ }
  }
  return { cambios };
}

/**
 * Período del resumen = mes de cierre, tomado del string 'YYYY-MM-DD' (sin new Date).
 * El parser viejo lo calculaba con new Date(): en hora argentina un cierre del día 1
 * quedaba en el mes anterior. Corrige resumen.anio/mes y anio_resumen/mes_resumen de
 * sus movimientos. No cambia ids. Idempotente: corre en cada carga.
 * @returns {{ corregidos: string[] }} ids de los resúmenes corregidos
 */
export function migrarPeriodoResumenes(almacen) {
  const resumenes = leer(almacen, 'tarjetas_resumenes');
  if (!Array.isArray(resumenes)) return { corregidos: [] };

  const periodoPorId = new Map();
  const nuevos = resumenes.map((r) => {
    const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(r?.fecha_cierre ?? ''));
    if (!m) return r;
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    if (r.anio === anio && r.mes === mes) return r;
    periodoPorId.set(r.id, { anio, mes });
    return { ...r, anio, mes };
  });
  if (!periodoPorId.size) return { corregidos: [] };

  try { almacen.setItem('tarjetas_resumenes', JSON.stringify(nuevos)); } catch { /* sin storage */ }
  const movimientos = leer(almacen, 'tarjetas_movimientos');
  if (Array.isArray(movimientos)) {
    const movs = movimientos.map((mv) => {
      const p = periodoPorId.get(mv?.resumen_id);
      return p ? { ...mv, anio_resumen: p.anio, mes_resumen: p.mes } : mv;
    });
    try { almacen.setItem('tarjetas_movimientos', JSON.stringify(movs)); } catch { /* sin storage */ }
  }
  return { corregidos: [...periodoPorId.keys()] };
}
