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
