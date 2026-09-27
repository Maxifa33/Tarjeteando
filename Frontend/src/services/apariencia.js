/**
 * Apariencia de la app: modo de color, reducir transparencia y lado del riel.
 * Se guarda en storage.getConfig().apariencia. Funciones puras (testeables en Node).
 */

export const MODOS = ['sistema', 'claro', 'oscuro'];

export const APARIENCIA_DEFAULT = Object.freeze({
  modo: 'sistema',
  reducirTransparencia: false,
  railIzquierda: false
});

// Temas viejos ('tarjetas_theme') → modo nuevo.
const DESDE_TEMA_VIEJO = { light: 'claro', dark: 'oscuro', liquid: 'oscuro' };

/**
 * Normaliza la apariencia guardada. Si no hay, migra desde el tema viejo.
 * @param guardada   config.apariencia (puede faltar o venir incompleta)
 * @param temaViejo  valor de localStorage 'tarjetas_theme' (o null)
 */
export function normalizarApariencia(guardada, temaViejo = null) {
  if (!guardada || typeof guardada !== 'object') {
    const modo = DESDE_TEMA_VIEJO[temaViejo] || APARIENCIA_DEFAULT.modo;
    return { ...APARIENCIA_DEFAULT, modo };
  }
  return {
    modo: MODOS.includes(guardada.modo) ? guardada.modo : APARIENCIA_DEFAULT.modo,
    reducirTransparencia: guardada.reducirTransparencia === true,
    railIzquierda: guardada.railIzquierda === true
  };
}

/** 'claro' | 'oscuro' efectivo, resolviendo 'sistema' con prefers-color-scheme. */
export function modoEfectivo(modo, sistemaOscuro) {
  if (modo === 'claro' || modo === 'oscuro') return modo;
  return sistemaOscuro ? 'oscuro' : 'claro';
}

/** Clases para el contenedor .tj. */
export function clasesApariencia(apariencia, sistemaOscuro) {
  const cls = ['tj'];
  if (modoEfectivo(apariencia.modo, sistemaOscuro) === 'claro') cls.push('claro');
  if (apariencia.reducirTransparencia) cls.push('rt');
  return cls;
}

/** Tema que esperan las piezas viejas (SettingsModal, chartColors): 'dark' | 'light'. */
export function temaLegacy(modo, sistemaOscuro) {
  return modoEfectivo(modo, sistemaOscuro) === 'claro' ? 'light' : 'dark';
}

/** Config con defaults: agrega apariencia y tope_mensual sin romper configs viejas. */
export function configConDefaults(guardada, temaViejo = null) {
  const base = { theme: 'dark', apiKey: null, tope_mensual: null };
  const cfg = guardada && typeof guardada === 'object' ? guardada : {};
  return {
    ...base,
    ...cfg,
    tope_mensual: cfg.tope_mensual ?? null,
    apariencia: normalizarApariencia(cfg.apariencia, temaViejo)
  };
}
