/**
 * Formato "Últimos consumos" de Banco Macro (.xls de home banking).
 *
 *   Últimos consumos de tarjeta de crédito
 *   Visa
 *   Visa ...4246
 *   Fecha de vencimiento: 31/09/2026     ← el banco puede exportar fechas imposibles
 *   Fecha de cierre: 13/09/2026
 *   Fecha | Establecimiento | · | Tarjeta | Importe $ | · | Importe U$S   ← celdas combinadas
 *   13/09/2026 | JUMBO ESCOBAR | · | ...4246 | $ 25,942.50 | · | -        ← números en formato inglés
 *   27/07/2026 | MERPAGO*MERCADOLIBRE 02/06 | ...                          ← cuota dentro de la descripción
 *   · | · | Total consumos | · | $ 1,200,365.66 | · | U$D 30.84
 *
 * Las columnas se buscan por el texto del encabezado, nunca por posición fija.
 */
import { parsearMontoConsumo, categorizarConsumo } from '../consumos-parser.js';
import { fechaSegura, idConsumo, detectarRed } from './comun.js';

const txt = (c) => (c == null ? '' : String(c).trim());

export function esFormatoMacro(rows) {
  const cab = rows.slice(0, 15).map((r) => (r || []).map(txt).join('|')).join('\n');
  return /[ÚU]ltimos consumos de tarjeta de cr[ée]dito/i.test(cab) && /Establecimiento/i.test(cab);
}

export function parseMacro(rows) {
  const warnings = [];
  const metadata = { fecha_cierre: '', fecha_vencimiento: '', disponible: null, limite: null };
  let red = 'Tarjeta';
  let ult4Cabecera = '';
  let idx = null; // índices de columnas
  let totalArchivo = null;
  const consumos = [];
  const fechaImportacion = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] || []).map(txt);
    const unida = row.filter(Boolean).join(' ');
    if (!unida) continue;

    if (!idx) {
      const mVto = unida.match(/Fecha de vencimiento:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (mVto) {
        const f = fechaSegura(mVto[1]);
        metadata.fecha_vencimiento = f.fecha;
        if (f.corregida) warnings.push(`El banco informó un vencimiento inexistente (${mVto[1]}); se tomó ${f.fecha.split('-').reverse().join('/')}.`);
        continue;
      }
      const mCierre = unida.match(/Fecha de cierre:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (mCierre) {
        const f = fechaSegura(mCierre[1]);
        metadata.fecha_cierre = f.fecha;
        if (f.corregida) warnings.push(`El banco informó un cierre inexistente (${mCierre[1]}); se tomó ${f.fecha.split('-').reverse().join('/')}.`);
        continue;
      }
      const mUlt4 = unida.match(/\.{2,}\s*(\d{4})\b/);
      if (mUlt4 && !/fecha/i.test(unida)) { ult4Cabecera = mUlt4[1]; red = detectarRed(unida) || red; continue; }
      if (/^(visa|mastercard|american express|amex|cabal)$/i.test(unida)) { red = detectarRed(unida); continue; }
      const low = row.map((c) => c.toLowerCase());
      if (low.includes('fecha') && low.some((c) => c.startsWith('establecimiento'))) {
        idx = {
          fecha: low.indexOf('fecha'),
          desc: low.findIndex((c) => c.startsWith('establecimiento')),
          tarjeta: low.findIndex((c) => c === 'tarjeta'),
          ars: low.findIndex((c) => /importe\s*\$/.test(c)),
          usd: low.findIndex((c) => /importe\s*u\$[sd]|importe\s*usd/.test(c)),
        };
      }
      continue;
    }

    if (/Total consumos/i.test(unida)) {
      const montos = row.filter((c) => /\d/.test(c) && /\$|U\$|USD/i.test(c));
      totalArchivo = {
        pesos: parsearMontoConsumo(montos.find((c) => !/U\$|USD/i.test(c)) || 0),
        dolares: parsearMontoConsumo(montos.find((c) => /U\$|USD/i.test(c)) || 0),
      };
      continue;
    }

    const f = fechaSegura(row[idx.fecha]);
    if (!f.fecha) continue;
    let descripcion = row[idx.desc] || '';
    const montoPesos = parsearMontoConsumo(row[idx.ars]);
    const montoDolares = idx.usd >= 0 ? parsearMontoConsumo(row[idx.usd]) : 0;
    const esPago = /^SU PAGO/i.test(descripcion);
    if (esPago && montoPesos === 0 && montoDolares === 0) continue; // pago sin importe informado

    let es_cuota = false, cuota_actual = null, total_cuotas = null, cuotas_texto = '';
    const mc = descripcion.match(/\s(\d{1,2})\/(\d{1,2})$/);
    if (mc && +mc[1] >= 1 && +mc[1] <= +mc[2]) {
      es_cuota = true; cuota_actual = +mc[1]; total_cuotas = +mc[2];
      cuotas_texto = `${cuota_actual} de ${total_cuotas}`;
      descripcion = descripcion.slice(0, mc.index).trim();
    }
    const ult4 = (row[idx.tarjeta] || '').match(/(\d{4})/)?.[1] || ult4Cabecera;

    const consumo = {
      tarjeta: `${red} ${ult4}`,
      tarjeta_ult4: ult4,
      fecha: f.fecha,
      descripcion,
      comprobante: '',
      cuotas_texto, es_cuota, cuota_actual, total_cuotas,
      monto_pesos: montoPesos,
      monto_dolares: montoDolares,
      categoria: categorizarConsumo(descripcion),
      es_pago: esPago,
      es_pendiente: false,
      fecha_importacion: fechaImportacion,
    };
    consumo.id = idConsumo(consumo);
    consumos.push(consumo);
  }

  if (!idx) warnings.push('No se encontró la fila de encabezados (Fecha | Establecimiento | Importe).');

  // Validación contra "Total consumos" del banco
  if (totalArchivo) {
    const gasto = consumos.filter((c) => !c.es_pago);
    const sp = gasto.reduce((s, c) => s + c.monto_pesos, 0);
    const sd = gasto.reduce((s, c) => s + c.monto_dolares, 0);
    if (Math.abs(sp - totalArchivo.pesos) > 1 || Math.abs(sd - totalArchivo.dolares) > 0.01) {
      warnings.push(`La suma leída ($${sp.toFixed(2)} / U$S ${sd.toFixed(2)}) no coincide con el total del banco ($${totalArchivo.pesos.toFixed(2)} / U$S ${totalArchivo.dolares.toFixed(2)}).`);
    }
  }

  const ult4s = [...new Set(consumos.map((c) => c.tarjeta_ult4).filter(Boolean))];
  if (ult4Cabecera && !ult4s.includes(ult4Cabecera)) ult4s.unshift(ult4Cabecera);

  // Un bloque por plástico (Macro suele traer uno solo); todos comparten cierre y vto.
  const bloques = (ult4s.length ? ult4s : ['']).map((u, i) => ({
    ult4: u,
    red,
    metadata: { ...metadata },
    consumos: consumos.filter((c) => c.tarjeta_ult4 === u || (i === 0 && !c.tarjeta_ult4)),
    validado: !!totalArchivo && warnings.every((w) => !/no coincide/.test(w)),
  }));

  return { formato: 'macro', banco_sugerido: 'Macro', bloques, warnings, total_archivo: totalArchivo };
}
