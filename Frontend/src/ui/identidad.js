/**
 * Identidad visual de cada tarjeta: plástico (gradiente + color de texto) y color
 * de gráfico (claro/oscuro). El color sigue a la tarjeta, nunca al orden ni al monto.
 * Tabla: rediseno-2026/specs/README.md → "Identidad de tarjeta".
 */

const CONOCIDAS = {
  santander: {
    plastico: 'linear-gradient(135deg, #D0021B, #7A0615)',
    texto: '#FFFFFF', texto2: 'rgba(255,255,255,.72)',
    chartClaro: '#D6001C', chartOscuro: '#E8484E'
  },
  'galicia-visa': {
    plastico: 'linear-gradient(135deg, #F7B062, #F08A24)',
    texto: '#1D1D1F', texto2: 'rgba(29,29,31,.72)',
    chartClaro: '#C2500A', chartOscuro: '#D47A22'
  },
  'galicia-mc': {
    plastico: 'linear-gradient(135deg, #C2185B, #6E0B3E)',
    texto: '#FFFFFF', texto2: 'rgba(255,255,255,.72)',
    chartClaro: '#B0126B', chartOscuro: '#E2589E'
  },
  bbva: {
    plastico: 'linear-gradient(135deg, #155A96, #072146)',
    texto: '#FFFFFF', texto2: 'rgba(255,255,255,.72)',
    chartClaro: '#1B5FAF', chartOscuro: '#4C8FEA'
  }
};

const GRAFITO = {
  plastico: 'linear-gradient(135deg, #4A4A52, #1F1F24)',
  texto: '#FFFFFF', texto2: 'rgba(255,255,255,.72)'
};

// Slots de "otros bancos", por orden de alta. Van siempre con leyenda y etiqueta.
const OTROS = [
  { chartClaro: '#4a3aa7', chartOscuro: '#9085e9' },
  { chartClaro: '#1baf7a', chartOscuro: '#199e70' },
  { chartClaro: '#008300', chartOscuro: '#008300' },
  { chartClaro: '#eda100', chartOscuro: '#c98500' }
];

const ORDEN_APILADO = ['santander', 'bbva', 'galicia-visa', 'galicia-mc'];

const texto = (t) => [t?.banco, t?.red, t?.tipo, t?.nombre]
  .filter(Boolean).join(' ').toLowerCase();

/** Clave de identidad conocida ('santander', 'galicia-visa', ...) o null si es otro banco. */
export function claveConocida(tarjeta) {
  const s = texto(tarjeta);
  if (s.includes('santander')) return 'santander';
  if (s.includes('bbva') || s.includes('francés') || s.includes('frances')) return 'bbva';
  if (s.includes('galicia')) {
    if (/master|\bmc\b/.test(s)) return 'galicia-mc';
    if (/amex|american/.test(s)) return null;
    return 'galicia-visa';
  }
  return null;
}

/**
 * @param tarjeta     { banco, red|tipo, nombre }
 * @param indiceAlta  posición de la tarjeta entre las de "otros bancos", por orden de alta.
 *                    Se ignora para los bancos conocidos.
 */
export function identidadTarjeta(tarjeta, indiceAlta = 0) {
  const clave = claveConocida(tarjeta);
  if (clave) return { clave, ...CONOCIDAS[clave] };
  const slot = ((indiceAlta % OTROS.length) + OTROS.length) % OTROS.length;
  return { clave: `otro-${slot}`, ...GRAFITO, ...OTROS[slot] };
}

/**
 * Identidad de cada tarjeta de la lista (en el orden de alta de storage).
 * Devuelve un Map nombre → identidad.
 */
export function identidades(tarjetas = []) {
  const out = new Map();
  let otros = 0;
  tarjetas.forEach((t) => {
    const conocida = claveConocida(t);
    out.set(t.nombre, identidadTarjeta(t, conocida ? 0 : otros));
    if (!conocida) otros += 1;
  });
  return out;
}

/** Orden de apilado en gráficos: Santander → BBVA → Galicia Visa → Galicia MC → otros (por alta). */
export function ordenApilado(tarjetas = []) {
  const rango = (t) => {
    const i = ORDEN_APILADO.indexOf(claveConocida(t));
    return i === -1 ? ORDEN_APILADO.length : i;
  };
  return tarjetas
    .map((t, alta) => ({ t, alta }))
    .sort((a, b) => rango(a.t) - rango(b.t) || a.alta - b.alta)
    .map(({ t }) => t);
}

// Posiciones del campo de luz (prototipo web, vista Mes), en fracción del viewport.
const POSICIONES_LUZ = [
  { x: -0.14, y: -0.15 },
  { x: 0.68, y: -0.02 },
  { x: 0.03, y: 0.59 },
  { x: 0.75, y: 0.64 }
];

/**
 * Manchas del campo de luz: hasta 4, una por tarjeta, con el color de gráfico.
 * La escala va de 0.6 a 1.35 según la parte de cada tarjeta en el total (peso).
 * Sin tarjetas: 4 manchas neutras.
 *
 * @param items  [{ tarjeta, peso }]  (peso ≥ 0, cualquier unidad)
 */
export function manchasDeLuz(items = [], { oscuro = true } = {}) {
  const mapa = identidades(items.map(i => i.tarjeta));
  const visibles = items.slice(0, 4);
  if (!visibles.length) {
    return POSICIONES_LUZ.map((p, i) => ({
      clave: `neutra-${i}`, color: 'var(--label2)', x: p.x, y: p.y, escala: 0.9, opacidad: 0.2
    }));
  }
  const total = visibles.reduce((a, i) => a + Math.max(0, Number(i.peso) || 0), 0);
  return visibles.map((it, i) => {
    const id = mapa.get(it.tarjeta.nombre);
    const share = total > 0 ? Math.max(0, Number(it.peso) || 0) / total : 1 / visibles.length;
    return {
      clave: it.tarjeta.nombre,
      color: oscuro ? id.chartOscuro : id.chartClaro,
      x: POSICIONES_LUZ[i].x,
      y: POSICIONES_LUZ[i].y,
      escala: Number((0.6 + 0.75 * share).toFixed(3)),
      opacidad: 1
    };
  });
}
