import { normalizar, prolijo } from './util.js';

/**
 * Reglas para decidir qué es cada movimiento de cuenta. Puro y testeable.
 *
 * Salida por movimiento:
 *   tipo: 'ingreso' | 'gasto' | 'transferencia_interna' | 'pago_tarjeta' | 'reserva'
 *   modulo: 'platita' | 'billetera' | 'alcancia'
 *   categoria: nombre de categoría (se mapea a categorias.id al guardar)
 *   naturaleza: 'activo' | 'pasivo' | null (solo ingresos)
 *   estado: 'confirmado' | 'revisar'
 *   contraparte, bolsillo (nombre de la reserva), cuenta_en_presupuesto
 *
 * Nunca cuentan como gasto: pagos de tarjeta (ya están en Tarjeteando), movimientos
 * entre cuentas propias, compra de dólares y reservas de Mercado Pago.
 */

const PASIVAS = new Set(['Rendimientos', 'Rentas']);

const CATEGORIAS_GASTO = [
  [/pago de cuota|debito por deuda|prestamo|\bcuota\b/, 'Deudas'],
  [/rappi|pedidos ?ya|pedidosya|uber ?eats/, 'Delivery'],
  [/\bsube\b|subte|\buber\b|cabify|didi|peaje|ypf|shell|axion|nafta|estacionam|puma energy|gulf/, 'Transporte'],
  [/supermerc|\bcoto\b|carrefour|\bdia\b|jumbo|\bdisco\b|chango|\bvea\b|norfrig|carnicer|verduler|almacen|dietetica|diarco|maxiconsumo|makro|vital|autoservicio/, 'Supermercado'],
  [/edesur|edenor|metrogas|naturgy|aysa|telecentro|telefonica|movistar|\bclaro\b|fibertel|expensas|\babl\b|pago de servicio|municipal/, 'Hogar y servicios'],
  [/farmac|osde|swiss|galeno|medic|odonto|laborator/, 'Salud'],
  [/netflix|spotify|youtube|dlocal|apple|google|disney|\bhbo\b|chatgpt|openai|anthropic|claude|icloud|prime video/, 'Suscripciones'],
  [/mcdonald|burger|cafe|cafeter|resto|restaurant|parrilla|pizzer|heladeri|bar\b|cervec|montagne|lagerhaus|bakery|panader|kiosco|open 25/, 'Comida y salidas'],
  [/hoyts|cinemark|\bcine\b|teatro|club|bigbox|ticketek|entradas|recital|gimnasio|\bgym\b/, 'Ocio'],
];

export function categoriaGasto(texto) {
  const t = normalizar(texto);
  const hit = CATEGORIAS_GASTO.find(([rx]) => rx.test(t));
  return hit ? hit[1] : 'Otros';
}

export const tipoBolsillo = (nombre) => (/emergencia|ahorro|fondo|reserva general/i.test(nombre || '') ? 'ahorro' : 'apartado');

/**
 * ¿El texto nombra a alguno de los titulares?
 * - Si el texto trae un CUIT, decide el CUIT (un familiar con el mismo apellido no pasa).
 * - Si no, tienen que estar TODAS las palabras del nombre completo, en cualquier orden.
 */
export function esPropio(texto, titulares = []) {
  const t = normalizar(texto);
  if (!t) return false;
  const cuits = t.match(/\b\d{11}\b/g) || [];
  return titulares.some((ti) => {
    if (cuits.length && ti.cuit) return cuits.includes(String(ti.cuit));
    const palabras = normalizar(ti.nombre).split(' ').filter((p) => p.length > 1);
    if (palabras.length < 2) return false;
    const tokens = new Set(t.split(/[^a-z0-9]+/));
    return palabras.every((p) => tokens.has(p));
  });
}

const base = (m, extra) => ({
  tipo: 'gasto', modulo: 'billetera', categoria: 'Otros', naturaleza: null, estado: 'confirmado',
  contraparte: null, bolsillo: null, cuenta_en_presupuesto: true, ...extra
});

const ingreso = (categoria, extra = {}) => ({
  tipo: 'ingreso', modulo: 'platita', categoria,
  naturaleza: PASIVAS.has(categoria) ? 'pasivo' : 'activo', ...extra
});
const interna = (extra = {}) => ({ tipo: 'transferencia_interna', modulo: 'billetera', categoria: null, cuenta_en_presupuesto: false, ...extra });

function galicia(m, titulares) {
  const d = normalizar(m.descripcion);
  const det = m.detalle || [];
  const quien = det[0] ? prolijo(det[0]) : null;
  const todo = [m.descripcion, ...det].join(' ');
  const entra = m.direccion === 'entrada';

  if (entra && /acreditamiento de haberes|cash sueldos|sueldo anual complementario/.test(d)) return ingreso('Sueldo', { contraparte: quien });
  if (entra && /interes capitalizado/.test(d)) return ingreso('Rendimientos', { contraparte: 'Galicia' });
  if (entra && /reintegro/.test(d)) return ingreso('Reintegros', { contraparte: 'Galicia' });
  if (!entra && /pago (de )?tarjeta|pago (visa|master|amex)|pago resumen/.test(d)) return { tipo: 'pago_tarjeta', modulo: 'billetera', categoria: null, cuenta_en_presupuesto: false, contraparte: prolijo(m.descripcion.replace(/pago tarjeta/i, 'Tarjeta')) };
  if (/compra venta de dolares/.test(d)) return interna({ contraparte: 'Compra de dólares' });
  if (/ctas propias|cuenta propia/.test(d)) return interna({ contraparte: det[3] ? prolijo(det[3]) : quien });
  if (!entra && /extraccion/.test(d)) return { tipo: 'gasto', modulo: 'billetera', categoria: 'Efectivo', contraparte: 'Retiro de efectivo' };
  if (entra && /dep\.?\s*efvo|deposito/.test(d)) return ingreso('Extras', { estado: 'revisar', contraparte: 'Depósito en efectivo' });
  if (/transferencia|credito transf|coelsa/.test(d)) {
    if (esPropio(todo, titulares)) return interna({ contraparte: quien });
    return entra
      ? ingreso('Transferencias recibidas', { estado: 'revisar', contraparte: quien })
      : { tipo: 'gasto', categoria: 'Transferencias', estado: 'revisar', contraparte: quien };
  }
  if (!entra && /compra debito/.test(d)) return { tipo: 'gasto', categoria: categoriaGasto(todo), contraparte: quien };
  if (entra && /pago a proveedores|honorario/.test(d)) return ingreso('Honorarios', { estado: 'revisar', contraparte: quien });
  return entra ? ingreso('Extras', { estado: 'revisar', contraparte: quien }) : { tipo: 'gasto', categoria: categoriaGasto(todo), estado: 'revisar', contraparte: quien };
}

function mercadopago(m, titulares) {
  const raw = m.descripcion || '';
  const d = normalizar(raw);
  const resto = (rx) => prolijo(raw.replace(rx, '').replace(/[#\uFFFD]+/g, '').trim()) || null;
  const entra = m.direccion === 'entrada';

  if (entra && /^rendimientos?/.test(d)) return ingreso('Rendimientos', { contraparte: 'Mercado Pago' });
  if (/^dinero reservado/.test(d)) { const b = resto(/^dinero reservado/i); return { tipo: 'reserva', modulo: 'alcancia', categoria: null, cuenta_en_presupuesto: false, bolsillo: b, contraparte: b }; }
  if (/^dinero retirado/.test(d)) { const b = resto(/^dinero retirado/i); return { tipo: 'reserva', modulo: 'alcancia', categoria: null, cuenta_en_presupuesto: false, bolsillo: b, contraparte: b }; }
  if (/^transferencia (recibida|enviada)/.test(d)) {
    const quien = resto(/^transferencia (recibida|enviada)/i);
    if (esPropio(raw, titulares)) return interna({ contraparte: quien });
    return entra
      ? ingreso('Transferencias recibidas', { estado: 'revisar', contraparte: quien })
      : { tipo: 'gasto', categoria: 'Transferencias', estado: 'revisar', contraparte: quien };
  }
  if (/^devolucion/.test(d)) return entra ? ingreso('Reintegros', { contraparte: 'Devolución' }) : { tipo: 'gasto', categoria: 'Otros', estado: 'revisar', contraparte: 'Devolución' };
  if (!entra && /^pago (de )?(la )?tarjeta|^pago (visa|mastercard|amex)/.test(d)) return { tipo: 'pago_tarjeta', modulo: 'billetera', categoria: null, cuenta_en_presupuesto: false, contraparte: resto(/^pago/i) };
  if (/pago de cuota|debito por deuda/.test(d)) return { tipo: 'gasto', categoria: 'Deudas', contraparte: 'Mercado Pago' };
  if (/^pago sube/.test(d)) return { tipo: 'gasto', categoria: 'Transporte', contraparte: 'SUBE' };
  if (/^pago de servicio/.test(d)) return { tipo: 'gasto', categoria: 'Hogar y servicios', contraparte: resto(/^pago de servicio/i) || 'Servicio' };
  if (!entra && /^(pago|compra)/.test(d)) {
    const quien = resto(/^(pago con qr|pago|compra)/i);
    return { tipo: 'gasto', categoria: categoriaGasto(raw), contraparte: quien };
  }
  return entra ? ingreso('Extras', { estado: 'revisar' }) : { tipo: 'gasto', categoria: categoriaGasto(raw), estado: 'revisar' };
}

export function clasificar(m, { origen, titulares = [] } = {}) {
  const r = origen === 'galicia' ? galicia(m, titulares)
    : origen === 'mercadopago' ? mercadopago(m, titulares)
    : (m.direccion === 'entrada' ? ingreso('Extras', { estado: 'revisar' }) : { tipo: 'gasto', categoria: categoriaGasto(m.descripcion), estado: 'revisar' });
  const out = base(m, r);
  if (out.tipo !== 'ingreso') out.naturaleza = null;
  return out;
}
