import { esGalicia, parseGalicia } from './parsers/galicia.js';
import { esMercadoPagoTexto, parseMercadoPagoPdf } from './parsers/mercadopago-pdf.js';
import { parseTabular } from './parsers/tabular.js';

/** Elige el lector según el contenido (nunca por el nombre del archivo). */
export function interpretar(leido) {
  if (leido.tipo === 'pdf') {
    if (esMercadoPagoTexto(leido.texto)) return parseMercadoPagoPdf(leido.paginas);
    return { ok: false, error: 'Por ahora leo PDFs del resumen de cuenta de Mercado Pago. Para otros bancos usá el Excel o CSV.' };
  }
  for (const h of leido.hojas || []) {
    if (esGalicia(h.filas)) return parseGalicia(h.filas);
  }
  for (const h of leido.hojas || []) {
    const texto = h.filas.slice(0, 15).flat().join(' ').toLowerCase();
    const origen = /mercado ?pago|release_date|net_amount|cvu/.test(texto) ? 'mercadopago' : 'archivo';
    const r = parseTabular(h.filas, { origen });
    if (r.ok) return r;
  }
  return { ok: false, error: 'No reconozco el formato del archivo.' };
}
