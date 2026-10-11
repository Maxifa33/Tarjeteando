/**
 * Lee un archivo del usuario (PDF, XLSX/XLS o CSV) y lo deja en una forma neutra:
 *   { tipo: 'hoja', hojas: [{ nombre, filas: any[][] }] }  |  { tipo: 'pdf', paginas: [{ items: [{x,y,str}] }], texto }
 * pdf.js se carga recién cuando hace falta (no pesa para quien no importa PDFs).
 */
import * as XLSX from 'xlsx';

export async function leerArchivo(file) {
  const nombre = file.name || 'archivo';
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  const buffer = await file.arrayBuffer();
  if (ext === 'pdf' || file.type === 'application/pdf') return leerPdf(buffer);
  if (['xlsx', 'xls', 'csv', 'txt'].includes(ext)) return leerHoja(buffer, ext);
  throw new Error(`Formato no soportado: .${ext}. Usá PDF, Excel o CSV.`);
}

export function leerHoja(buffer, ext = 'xlsx') {
  const opts = ext === 'csv' || ext === 'txt'
    ? { type: 'string', raw: true, codepage: 65001 }
    : { type: 'array', cellDates: false };
  const data = ext === 'csv' || ext === 'txt' ? new TextDecoder('utf-8').decode(buffer) : buffer;
  const wb = XLSX.read(data, opts);
  return {
    tipo: 'hoja',
    hojas: wb.SheetNames.map((n) => ({ nombre: n, filas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: false }) }))
  };
}

/**
 * Safari (hasta 26) no permite recorrer un ReadableStream con `for await`, y pdf.js lo usa al
 * leer el texto (getTextContent): "undefined is not a function (near '...value of readableStream...')".
 * Se agrega el iterador estándar solo si falta.
 */
export function polyfillReadableStream(RS = globalThis.ReadableStream) {
  if (!RS || RS.prototype[Symbol.asyncIterator]) return false;
  async function* iterar() {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
  Object.defineProperty(RS.prototype, Symbol.asyncIterator, { value: iterar, writable: true, configurable: true });
  if (!RS.prototype.values) Object.defineProperty(RS.prototype, 'values', { value: iterar, writable: true, configurable: true });
  return true;
}

let pdfjsPromesa = null;
async function cargarPdfjs() {
  if (!pdfjsPromesa) {
    polyfillReadableStream();
    pdfjsPromesa = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); // build 'legacy': compatible con Safari más viejos
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })().catch((e) => { pdfjsPromesa = null; throw e; });
  }
  return pdfjsPromesa;
}

export async function leerPdf(buffer, pdfjsInyectado = null) {
  polyfillReadableStream();
  const pdfjs = pdfjsInyectado || await cargarPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pag = await doc.getPage(n);
    const tc = await pag.getTextContent();
    paginas.push({ items: tc.items.filter((i) => typeof i.str === 'string').map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str })) });
  }
  const texto = paginas.map((p) => p.items.map((i) => i.str).join(' ')).join('\n');
  return { tipo: 'pdf', paginas, texto };
}
