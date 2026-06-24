/**
 * Parser de "Últimos consumos" (formato Galicia, XLSX/CSV)
 *
 * El export de home banking de Galicia es jerárquico:
 *  - Metadata global: "Consumido hasta el momento", fechas de cierre/vencimiento
 *  - Secciones por tarjeta: "Tarjeta ... terminada en XXXX"
 *  - Sección de pagos: "Pago de tarjeta y devoluciones"
 *  - Filas de datos con headers: Fecha | Descripción | Cuotas | Comprobante | Monto en pesos | Monto en dólares
 *  - Subtotales: "Subtotal de ... terminada en XXXX"
 *
 * Las filas consecutivas del mismo día tienen la Fecha vacía (forward-fill).
 * Los montos vienen como "$1.234,56" / "U$S46,69" / "$-4.498,80".
 *
 * Diseño: parseRows(rows) opera sobre una matriz de filas (array de arrays),
 * por lo que es testeable en Node sin browser. parseConsumosFile(buffer) es el
 * wrapper que usa SheetJS en el browser.
 */

import * as XLSX from 'xlsx';

// ==================== Diccionario de categorías ====================

export const CATEGORIAS_CONSUMO = {
  Marketplace: ['merpago', 'mercadolibre', 'mercado pago', 'mercadopago'],
  Suscripciones: ['spotify', 'netflix', 'apple.com', 'apple ', 'microsoft', 'xbox', 'canva', 'anthropic', 'crunchyro', 'linkedin', 'ebn*', 'google', 'youtube', 'disney', 'hbo', 'amazon prime', 'openai'],
  Viajes: ['aerolineas', 'despegar', 'booking', 'airbnb', 'latam', 'flybondi', 'jetsmart', 'turismo'],
  Supermercado: ['carrefour', 'dia ', 'dia tienda', 'cencosud', 'coto', 'jumbo', 'vea', 'disco', 'eden sa', 'la anonima', 'makro'],
  'Servicios/Impuestos': ['naturgy', 'claro', 'movistar', 'personal', 'edenor', 'edesur', 'arba', 'afip', 'arca', 'pagos360', 'metrogas', 'aysa', 'rentas', 'municipalidad'],
  Hogar: ['ferreteria', 'easy', 'sodimac', 'tangohogar', 'tecnoficina', 'fravega', 'garbarino', 'musimundo'],
  Gastronomia: ['restaurant', 'mcdonald', 'burger', 'starbucks', 'rappi', 'pedidosya', 'cafe', 'bar '],
  Salud: ['farmacia', 'farmacity', 'osde', 'swiss medical', 'galeno', 'clinica', 'sanatorio'],
};

/**
 * Asigna una categoría a un consumo según su descripción.
 */
export function categorizarConsumo(descripcion) {
  if (!descripcion) return 'Otros';
  const desc = descripcion.toLowerCase();
  for (const [categoria, patrones] of Object.entries(CATEGORIAS_CONSUMO)) {
    if (patrones.some((p) => desc.includes(p))) return categoria;
  }
  return 'Otros';
}

// ==================== Helpers de parsing ====================

/**
 * Normaliza un monto string/number a número.
 * "$1.234,56" → 1234.56 | "U$S46,69" → 46.69 | "$-4.498,80" → -4498.8
 * Acepta también números nativos (cuando Excel guardó la celda tipada).
 */
export function parsearMontoConsumo(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  let s = String(valor).trim();
  // Quitar prefijos de moneda
  s = s.replace(/U\$S/gi, '').replace(/\$/g, '').replace(/\s/g, '');
  if (s === '' || s === '-') return 0;
  // Detectar signo negativo
  const negativo = s.includes('-');
  s = s.replace(/-/g, '');
  // Formato es-AR: punto = miles, coma = decimal
  s = s.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return negativo ? -num : num;
}

/**
 * Normaliza una fecha DD/MM/YYYY → YYYY-MM-DD. Devuelve '' si no es válida.
 * Acepta también Date nativo (SheetJS con cellDates).
 */
export function normalizarFecha(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(valor).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Ya en formato ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}

/**
 * Parsea cuotas "X de Y" → { es_cuota, cuota_actual, total_cuotas }
 */
export function parsearCuotas(valor) {
  if (!valor) return { es_cuota: false, cuota_actual: null, total_cuotas: null };
  const m = String(valor).match(/(\d+)\s*de\s*(\d+)/i);
  if (m) {
    return { es_cuota: true, cuota_actual: parseInt(m[1], 10), total_cuotas: parseInt(m[2], 10) };
  }
  return { es_cuota: false, cuota_actual: null, total_cuotas: null };
}

/**
 * Detecta el tipo de tarjeta desde un texto de sección.
 */
function detectarTipoTarjeta(texto) {
  const t = (texto || '').toUpperCase();
  if (/AMERICAN\s*EXPRESS|AMEX/.test(t)) return 'Amex';
  if (/MASTERCARD/.test(t)) return 'Mastercard';
  if (/VISA/.test(t)) return 'Visa';
  if (/CABAL/.test(t)) return 'Cabal';
  return 'Tarjeta';
}

const HEADER_TOKENS = ['fecha', 'descrip', 'cuota', 'comprob', 'monto'];

function esFilaHeader(row) {
  const joined = row.filter(Boolean).map((c) => String(c).toLowerCase()).join('|');
  return HEADER_TOKENS.filter((tok) => joined.includes(tok)).length >= 3;
}

function btoaSafe(str) {
  // btoa en browser; Buffer en Node (para tests)
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, 'utf-8').toString('base64');
}

function hashId(consumo) {
  const raw = `${consumo.tarjeta}|${consumo.fecha}|${consumo.descripcion}|${consumo.monto_pesos}|${consumo.monto_dolares}|${consumo.comprobante}`;
  return btoaSafe(raw).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
}

// ==================== Parser principal ====================

/**
 * Parsea una matriz de filas (array de arrays) al modelo de consumos.
 * @param {Array<Array>} rows
 * @returns {{ consumos: Array, metadata: Object, warnings: Array<string> }}
 */
export function parseRows(rows) {
  const consumos = [];
  const warnings = [];
  const metadata = {
    consumido_pesos: 0,
    consumido_dolares: 0,
    fecha_cierre: '',
    fecha_vencimiento: '',
    tarjetas_detectadas: [],
  };
  const subtotalesArchivo = {}; // { ult4: { pesos, dolares } }

  let tarjetaActual = null; // { tipo, ult4, nombre }
  let ult4Actual = null;
  let seccionEsPagos = false;
  let enDatos = false;
  let ultimaFecha = '';
  const fechaImportacion = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const colA = row[0] != null ? String(row[0]).trim() : '';

    // ---- Metadata global ----
    if (/Consumido hasta el momento/i.test(colA)) {
      const next = rows[i + 1] || [];
      metadata.consumido_pesos = parsearMontoConsumo(next[0]);
      metadata.consumido_dolares = parsearMontoConsumo(next[1]);
      continue;
    }
    if (/Fecha de cierre/i.test(colA)) {
      const next = rows[i + 1] || [];
      metadata.fecha_cierre = normalizarFecha(next[0]);
      metadata.fecha_vencimiento = normalizarFecha(next[1]);
      continue;
    }

    // ---- Sección de pagos y devoluciones ----
    if (/Pago de tarjeta y devoluciones/i.test(colA)) {
      seccionEsPagos = true;
      enDatos = false;
      ultimaFecha = '';
      continue;
    }

    // ---- Sección por tarjeta ----
    // "Tarjeta Visa Crédito terminada en 3327" o "Tarjeta de NOMBRE - Visa Crédito terminada en 3327"
    const matchTarjeta = colA.match(/terminada en\s*(\d{4})/i);
    if (matchTarjeta && /tarjeta/i.test(colA) && !/subtotal/i.test(colA)) {
      const ult4 = matchTarjeta[1];
      const tipo = detectarTipoTarjeta(colA);
      ult4Actual = ult4;
      tarjetaActual = { tipo, ult4, nombre: `${tipo} ${ult4}` };
      if (!metadata.tarjetas_detectadas.includes(tarjetaActual.nombre)) {
        metadata.tarjetas_detectadas.push(tarjetaActual.nombre);
      }
      seccionEsPagos = false;
      enDatos = false;
      ultimaFecha = '';
      continue;
    }

    // ---- Subtotal: cierra la sección y guarda para validación ----
    const matchSubtotal = colA.match(/Subtotal de.*terminada en\s*(\d{4})/i);
    if (matchSubtotal) {
      const ult4 = matchSubtotal[1];
      subtotalesArchivo[ult4] = {
        pesos: parsearMontoConsumo(row[4]),
        dolares: parsearMontoConsumo(row[5]),
      };
      enDatos = false;
      continue;
    }

    // ---- Fila de headers → empiezan los datos ----
    if (esFilaHeader(row)) {
      enDatos = true;
      ultimaFecha = '';
      continue;
    }

    // ---- Fila de datos ----
    if (!enDatos) continue;
    // Saltar filas totalmente vacías
    if (row.every((c) => c == null || String(c).trim() === '')) continue;

    const fechaRaw = row[0];
    const descripcion = row[1] != null ? String(row[1]).trim() : '';
    const cuotasRaw = row[2];
    const comprobante = row[3] != null ? String(row[3]).trim() : '';
    const montoPesos = parsearMontoConsumo(row[4]);
    const montoDolares = parsearMontoConsumo(row[5]);

    // Si no hay descripción ni montos, no es un consumo válido
    if (!descripcion && montoPesos === 0 && montoDolares === 0) continue;

    // Forward-fill de fecha
    const fechaNorm = normalizarFecha(fechaRaw);
    if (fechaNorm) ultimaFecha = fechaNorm;
    const fecha = fechaNorm || ultimaFecha;

    const { es_cuota, cuota_actual, total_cuotas } = parsearCuotas(cuotasRaw);
    const es_pago = seccionEsPagos || /su pago/i.test(descripcion);
    const es_pendiente = comprobante === '-' || /pendiente/i.test(descripcion);

    const consumo = {
      tarjeta: tarjetaActual ? tarjetaActual.nombre : 'Sin tarjeta',
      tarjeta_ult4: ult4Actual || '',
      fecha,
      descripcion,
      comprobante,
      cuotas_texto: cuotasRaw ? String(cuotasRaw).trim() : '',
      es_cuota,
      cuota_actual,
      total_cuotas,
      monto_pesos: montoPesos,
      monto_dolares: montoDolares,
      categoria: categorizarConsumo(descripcion),
      es_pago,
      es_pendiente,
      fecha_importacion: fechaImportacion,
    };
    consumo.id = hashId(consumo);
    consumos.push(consumo);
  }

  // ---- Validación contra subtotales del archivo ----
  // El subtotal del archivo excluye pagos y consumos pendientes (aún no facturados),
  // así que la comparación los excluye también.
  for (const [ult4, sub] of Object.entries(subtotalesArchivo)) {
    const sumaPesos = consumos
      .filter((c) => c.tarjeta_ult4 === ult4 && !c.es_pago && !c.es_pendiente)
      .reduce((s, c) => s + c.monto_pesos, 0);
    const diff = Math.abs(sumaPesos - sub.pesos);
    if (sub.pesos > 0 && diff > 1) {
      warnings.push(
        `Tarjeta ${ult4}: suma calculada $${sumaPesos.toLocaleString('es-AR', { minimumFractionDigits: 2 })} difiere del subtotal del archivo $${sub.pesos.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (dif. $${diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`
      );
    }
  }

  if (consumos.length === 0) {
    warnings.push('No se detectaron consumos. ¿El archivo tiene el formato "Últimos consumos" de Galicia?');
  }

  return { consumos, metadata, warnings, subtotales: subtotalesArchivo };
}

/**
 * Wrapper de browser: lee un ArrayBuffer (XLSX o CSV) y devuelve el parse.
 * @param {ArrayBuffer} buffer
 */
export function parseConsumosFile(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  const result = parseRows(rows);
  result.metadata.hoja = sheetName;
  return result;
}
