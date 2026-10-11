/**
 * Registro de módulos de Economics (los módulos opcionales de Tarjeteando).
 *
 * Archivo puro (sin React ni íconos) para poder testearlo con node --test.
 * Los íconos se resuelven por nombre en modulos/ui/iconos.js.
 *
 * Para sumar un módulo: agregarlo acá, a la CHECK de modulos_usuario.modulo_id en
 * Supabase y a ICONOS_MODULOS.
 */

export const MAX_FAVORITOS = 2;

export const MODULOS = [
  {
    id: 'platita',
    nombre: 'Platita',
    descripcion: 'Tus ingresos activos y pasivos: sueldo, honorarios, extras y rendimientos.',
    icono: 'Banknote',
    estado: 'beta',
    promesa: [
      'Ingresos del mes de un vistazo, separados en activos y pasivos.',
      'Se completan solos al importar los movimientos de Galicia y Mercado Pago.'
    ]
  },
  {
    id: 'billetera',
    nombre: 'Billetera',
    descripcion: 'Lo que gastás sin tarjeta: efectivo y transferencias.',
    icono: 'Wallet',
    estado: 'beta',
    promesa: [
      'Importás el movimiento de cuenta de Galicia o Mercado Pago y queda todo cargado.',
      'Sin duplicados: el pago de la tarjeta y las transferencias entre tus cuentas no cuentan como gasto.'
    ]
  },
  {
    id: 'compartidos',
    nombre: 'Compartidos',
    corto: 'Compart.',
    descripcion: 'Gastos divididos: viajes, la casa, el trabajo.',
    icono: 'Users',
    estado: 'proximamente',
    promesa: [
      'Grupos con 2 o más personas, cada gasto dividido como quieras.',
      'Quién le debe a quién, con la menor cantidad de transferencias.'
    ]
  },
  {
    id: 'saldar',
    nombre: 'Saldar',
    descripcion: 'Préstamos y deudas fuera de la tarjeta, con un plan para cancelarlas.',
    icono: 'Scale',
    estado: 'proximamente',
    promesa: [
      'Todas tus deudas en un lugar, con su costo real.',
      'Un orden de pago sugerido según lo que te entra cada mes.'
    ]
  },
  {
    id: 'alcancia',
    nombre: 'Alcancía',
    descripcion: 'Guardar platita para algo: metas, fondo de emergencia e inversiones.',
    icono: 'PiggyBank',
    estado: 'proximamente',
    promesa: [
      'Metas con fecha y monto: vacaciones, emergencia, una compra grande.',
      'Tus inversiones valuadas al cierre del día anterior, con sugerencias (no asesoramiento).'
    ]
  },
  {
    id: 'presupuestos',
    nombre: 'Presupuestos',
    corto: 'Presup.',
    descripcion: 'Tu plan del mes con tarjetas, gastos sin tarjeta, deudas y ahorro juntos.',
    icono: 'Calculator',
    estado: 'proximamente',
    usaPuenteTarjeteando: true,
    promesa: [
      'Cuánto entra, cuánto ya está comprometido y cuánto te queda.',
      'Presupuestos para viajes y eventos armados con tus números reales.'
    ]
  }
];

const IDS = new Set(MODULOS.map((m) => m.id));

/** ¿El id de vista corresponde a un módulo? */
export function esModulo(id) {
  return IDS.has(id);
}

export function moduloPorId(id) {
  return MODULOS.find((m) => m.id === id) || null;
}

/** Cantidad de favoritos activos en un estado. */
export function contarFavoritos(estado = {}) {
  return MODULOS.filter((m) => estado[m.id]?.activo && estado[m.id]?.favorito).length;
}

/**
 * Pestañas y menú según los módulos del usuario.
 * - Sin módulos activos: pestanas === secciones (mismo array, mismo orden).
 * - Favoritos activos (hasta maxFavoritos, por `orden` y luego por orden del registro) van como pestañas
 *   después de las secciones de Tarjeteando; el resto de los activos va al menú Más.
 * - Ids en `estado` que no están en el registro se ignoran.
 *
 * @param {Array} secciones  SECCIONES de ui/secciones.js
 * @param {Object} estado    { [modulo_id]: { activo, favorito, orden } }
 * @returns {{ pestanas: Array, enMenu: Array }}
 */
export function seccionesConModulos(secciones = [], estado = {}, { maxFavoritos = MAX_FAVORITOS, modulos = MODULOS } = {}) {
  const activos = modulos
    .map((m, i) => ({ m, i, e: estado[m.id] }))
    .filter((x) => x.e && x.e.activo);
  if (!activos.length) return { pestanas: secciones, enMenu: [] };

  const favoritos = activos
    .filter((x) => x.e.favorito)
    .sort((a, b) => (a.e.orden ?? 0) - (b.e.orden ?? 0) || a.i - b.i)
    .slice(0, maxFavoritos);
  const enPestana = new Set(favoritos.map((x) => x.m.id));

  const comoSeccion = (m) => ({ id: m.id, label: m.nombre, corto: m.corto, icono: m.icono, esModulo: true });
  return {
    pestanas: [...secciones, ...favoritos.map((x) => comoSeccion(x.m))],
    enMenu: activos.filter((x) => !enPestana.has(x.m.id)).map((x) => x.m)
  };
}
