/**
 * Punto de entrada de "Últimos consumos": recibe las hojas de un archivo y
 * devuelve BLOQUES (un bloque = un plástico, con su ciclo y sus consumos).
 *
 * Orden: formato Santander/Galicia/Amex → formato Macro → plantilla guardada →
 * `requiereMapeo` (la app pide el mapeo a la IA o al usuario y vuelve a llamar).
 */
import { parseRows, esFormatoSantander } from '../consumos-parser.js';
import { esFormatoMacro, parseMacro } from './macro.js';
import { prepararMapeo, parseGenerico } from './generico.js';
import { idConsumo, detectarRed } from './comun.js';

function bloquesSantander(rows) {
  const r = parseRows(rows);
  const orden = r.metadata.tarjetas_detectadas.map((n) => n.split(' ').pop());
  const ult4s = [...new Set([...orden, ...r.consumos.map((c) => c.tarjeta_ult4).filter(Boolean)])];
  const meta = {
    fecha_cierre: r.metadata.fecha_cierre,
    fecha_vencimiento: r.metadata.fecha_vencimiento,
    disponible: r.metadata.disponible,
    limite: r.metadata.limite,
  };
  const bloques = ult4s.map((u, i) => {
    const consumos = r.consumos.filter((c) => c.tarjeta_ult4 === u || (i === 0 && !c.tarjeta_ult4));
    const red = detectarRed(r.metadata.tarjetas_detectadas.find((n) => n.endsWith(u)) || '') || 'Tarjeta';
    return { ult4: u, red, metadata: { ...meta }, consumos, validado: !!r.subtotales[u] && !r.warnings.some((w) => w.includes(u)) };
  });
  return { formato: 'santander', banco_sugerido: '', bloques, warnings: r.warnings.filter((w) => !/No se detectaron/.test(w)) };
}

/**
 * @param {Array<{nombre, rows}>} hojas
 * @param {{ plantillas?: Object }} opts  plantillas guardadas, por firma
 */
export function parseUltimosConsumos(hojas, { plantillas = {} } = {}) {
  const bloques = [];
  const warnings = [];
  const formatos = new Set();
  let banco_sugerido = '';
  let requiereMapeo = null;

  for (const hoja of hojas) {
    const rows = hoja.rows || [];
    if (!rows.some((r) => (r || []).some((c) => c != null && String(c).trim()))) continue;
    let res = null;
    if (esFormatoMacro(rows)) res = parseMacro(rows);
    else if (esFormatoSantander(rows)) res = bloquesSantander(rows);
    else {
      const prep = prepararMapeo(rows);
      if (prep && plantillas[prep.firma]) res = parseGenerico(rows, plantillas[prep.firma]);
      else if (prep && !requiereMapeo) { requiereMapeo = { hoja: hoja.nombre, ...prep }; continue; }
      else continue;
    }
    formatos.add(res.formato);
    banco_sugerido = banco_sugerido || res.banco_sugerido || '';
    warnings.push(...res.warnings);
    bloques.push(...res.bloques.filter((b) => b.consumos.length || b.ult4));
  }

  // IDs estables por contenido; filas idénticas reciben un número de ocurrencia.
  const vistos = {};
  for (const b of bloques) {
    for (const c of b.consumos) {
      const base = idConsumo(c);
      vistos[base] = (vistos[base] || 0) + 1;
      c.id = vistos[base] === 1 ? base : idConsumo(c, vistos[base]);
    }
  }

  if (!bloques.length && !requiereMapeo) warnings.push('No se reconocieron consumos en el archivo.');
  return {
    formato: [...formatos].join('+') || (requiereMapeo ? 'desconocido' : 'vacio'),
    banco_sugerido,
    bloques: requiereMapeo && !bloques.length ? [] : bloques,
    warnings,
    requiereMapeo: bloques.length ? null : requiereMapeo,
  };
}

/** Browser: ArrayBuffer (xlsx/xls/csv) → hojas como matrices de texto. */
export async function leerHojas(buffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  return wb.SheetNames.map((nombre) => ({
    nombre,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null, raw: false }),
  }));
}

export const EXTENSIONES_CONSUMOS = /\.(xlsx|xls|csv)$/i;
