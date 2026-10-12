import { normalizar } from './util.js';

/**
 * Categorías: las del sistema (user_id null) + las del usuario. Una categoría del usuario con
 * `reemplaza = <id del sistema>` es un renombre: la del sistema deja de mostrarse y todo lo
 * nuevo que caería en ella va a la del usuario. Puro.
 */
export function categoriasVisibles(todas = [], tipo = null) {
  const reemplazadas = new Set(todas.filter((c) => c.user_id && c.reemplaza).map((c) => c.reemplaza));
  return todas
    .filter((c) => !reemplazadas.has(c.id) && (!tipo || c.tipo === tipo))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Id de la categoría a usar para un nombre del clasificador ('Supermercado', 'Sueldo', …). */
export function resolverCategoria(nombre, tipo, todas = []) {
  if (!nombre) return null;
  const n = normalizar(nombre);
  const propia = todas.find((c) => c.user_id && c.tipo === tipo && normalizar(c.nombre) === n);
  if (propia) return propia.id;
  const sistema = todas.find((c) => !c.user_id && c.tipo === tipo && normalizar(c.nombre) === n);
  if (!sistema) return null;
  const renombrada = todas.find((c) => c.user_id && c.reemplaza === sistema.id);
  return renombrada ? renombrada.id : sistema.id;
}

/** ¿El nombre ya existe entre las visibles de ese tipo? (para no duplicar). */
export function nombreOcupado(nombre, tipo, todas = [], exceptoId = null) {
  const n = normalizar(nombre);
  const propia = todas.find((c) => c.id === exceptoId);
  // También cuentan las del sistema ocultas: si no, el clasificador mandaría lo de esa categoría base
  // a una propia que no la reemplaza. Se permite volver al nombre original de la que reemplazás.
  return todas.some((c) => c.tipo === tipo && c.id !== exceptoId && c.id !== propia?.reemplaza && normalizar(c.nombre) === n);
}
