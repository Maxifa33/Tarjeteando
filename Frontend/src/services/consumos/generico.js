/**
 * Lector genérico de "Últimos consumos" para bancos sin formato conocido.
 *
 * 1. `prepararMapeo(rows)` arma lo mínimo para pedir el mapeo (a la IA o al
 *    usuario): encabezados + 8 filas de muestra + texto de cabecera. Nunca el
 *    archivo entero.
 * 2. El mapeo (qué columna es cada dato) se guarda como PLANTILLA bajo la
 *    `firma` de los encabezados. La próxima vez se aplica sin llamar a nadie.
 * 3. `parseGenerico(rows, plantilla)` lee el archivo con esa plantilla.
 */
import { parsearMontoConsumo, parsearCuotas, categorizarConsumo } from '../consumos-parser.js';
import { fechaSegura, detectarRed } from './comun.js';

const txt = (c) => (c == null ? '' : String(c).trim());
const norm = (c) => txt(c).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/** Fila de encabezados: la primera con ≥3 celdas de texto y alguna que diga "fecha". */
export function buscarFilaEncabezado(rows) {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const r = (rows[i] || []).map(norm);
    const conTexto = r.filter((c) => c && !/^[\d$.,\s-]+$/.test(c));
    if (conTexto.length >= 3 && r.some((c) => /fecha/.test(c))) return i;
  }
  return -1;
}

export function firmaEncabezados(headers) {
  return headers.map(norm).filter(Boolean).join('|');
}

export function prepararMapeo(rows) {
  const fila = buscarFilaEncabezado(rows);
  if (fila < 0) return null;
  const headers = (rows[fila] || []).map(txt);
  const filas_muestra = rows.slice(fila + 1)
    .filter((r) => (r || []).some((c) => txt(c)))
    .slice(0, 8)
    .map((r) => headers.map((_, j) => txt((r || [])[j])));
  const texto_cabecera = rows.slice(0, fila).map((r) => (r || []).map(txt).filter(Boolean).join(' ')).filter(Boolean).join('\n');
  return { fila_encabezado: fila, headers, filas_muestra, texto_cabecera, firma: firmaEncabezados(headers) };
}

function buscarFechaEnTexto(texto, etiqueta) {
  const m = texto.match(new RegExp(`${etiqueta}[^0-9]{0,30}(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})`, 'i'));
  return m ? fechaSegura(m[1]).fecha : '';
}

/**
 * plantilla: { firma, mapeo: {fecha, descripcion, cuotas?, comprobante?, monto_ars, monto_usd?, ult4?}
 *              (índices de columna; null si no existe), cuotas_en_descripcion?, banco?, red? }
 */
export function parseGenerico(rows, plantilla) {
  const prep = prepararMapeo(rows);
  if (!prep) return { formato: 'generico', bloques: [], warnings: ['No se encontró la fila de encabezados.'] };
  const { mapeo } = plantilla;
  const col = (r, k) => (mapeo[k] == null || mapeo[k] === '' ? '' : txt((r || [])[+mapeo[k]]));
  const cabecera = prep.texto_cabecera;
  const metadata = {
    fecha_cierre: buscarFechaEnTexto(cabecera, 'cierre'),
    fecha_vencimiento: buscarFechaEnTexto(cabecera, 'venc'),
    disponible: null, limite: null,
  };
  const ult4Cab = cabecera.match(/(?:terminada en|\.{2,}|\*{2,}|x{2,})\s*(\d{4})/i)?.[1] || '';
  const red = plantilla.red || detectarRed(cabecera) || 'Tarjeta';
  const fechaImportacion = new Date().toISOString();
  const consumos = [];
  let ultimaFecha = '';

  for (const r of rows.slice(prep.fila_encabezado + 1)) {
    let descripcion = col(r, 'descripcion');
    const montoPesos = parsearMontoConsumo(col(r, 'monto_ars'));
    const montoDolares = parsearMontoConsumo(col(r, 'monto_usd'));
    if (!descripcion && !montoPesos && !montoDolares) continue;
    if (/^(sub)?total/i.test(descripcion) || (r || []).some((c) => /^total/i.test(txt(c)))) continue;
    const f = fechaSegura(col(r, 'fecha')).fecha;
    if (f) ultimaFecha = f;
    if (!f && !ultimaFecha) continue;

    let cuotas = parsearCuotas(col(r, 'cuotas'));
    let cuotas_texto = col(r, 'cuotas');
    const mc = descripcion.match(/\s(\d{1,2})\/(\d{1,2})$/);
    if (!cuotas.es_cuota && mc && +mc[1] <= +mc[2]) {
      cuotas = { es_cuota: true, cuota_actual: +mc[1], total_cuotas: +mc[2] };
      cuotas_texto = `${mc[1]} de ${mc[2]}`;
      descripcion = descripcion.slice(0, mc.index).trim();
    } else {
      const mc2 = cuotas_texto.match(/(\d+)\s*\/\s*(\d+)/);
      if (!cuotas.es_cuota && mc2) cuotas = { es_cuota: true, cuota_actual: +mc2[1], total_cuotas: +mc2[2] };
    }
    const ult4 = col(r, 'ult4').match(/(\d{4})/)?.[1] || ult4Cab;
    consumos.push({
      tarjeta: `${red} ${ult4}`.trim(),
      tarjeta_ult4: ult4,
      fecha: f || ultimaFecha,
      descripcion,
      comprobante: col(r, 'comprobante'),
      cuotas_texto: cuotas.es_cuota ? cuotas_texto : '',
      ...cuotas,
      monto_pesos: montoPesos,
      monto_dolares: montoDolares,
      categoria: categorizarConsumo(descripcion),
      es_pago: /su pago|pago en pesos|pago recibido/i.test(descripcion),
      es_pendiente: /pendiente/i.test(descripcion),
      fecha_importacion: fechaImportacion,
    });
  }

  const ult4s = [...new Set(consumos.map((c) => c.tarjeta_ult4))];
  const bloques = ult4s.map((u) => ({
    ult4: u, red, metadata: { ...metadata },
    consumos: consumos.filter((c) => c.tarjeta_ult4 === u),
    validado: false,
  }));
  const warnings = consumos.length ? [] : ['La plantilla no encontró consumos en el archivo.'];
  return { formato: 'generico', banco_sugerido: plantilla.banco || '', bloques, warnings };
}
