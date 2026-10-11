import { normalizar } from './util.js';

/** SHA-256 en hex (navegador y Node ≥ 20 tienen crypto.subtle). */
export async function sha256(texto) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Mercado Pago: una sola cuenta por usuario (el PDF trae el CVU y la planilla no), así PDF y Excel del mismo mes no se duplican.
export const claveCuenta = (c) => (c.institucion === 'mercadopago'
  ? `mercadopago||${c.moneda || 'ARS'}`
  : `${c.institucion}|${c.numero || ''}|${c.moneda || 'ARS'}`);

/**
 * Huella estable por movimiento para no duplicar al reimportar.
 * - Con número de operación: institución + cuenta + id.
 * - Sin número: hash de cuenta|fecha|monto|dirección|descripción + n° de ocurrencia ese día
 *   (dos cafés iguales el mismo día son dos movimientos, no un duplicado).
 */
export async function huellas(movimientos, cuenta) {
  const cc = claveCuenta(cuenta);
  const vistos = new Map();
  const out = [];
  // Un id que se repite dentro del archivo no es un número de operación confiable: se ignora.
  const usos = new Map();
  movimientos.forEach((m) => { if (m.id_externo) usos.set(m.id_externo, (usos.get(m.id_externo) || 0) + 1); });
  for (const m of movimientos) {
    if (m.id_externo && usos.get(m.id_externo) === 1) {
      out.push(await sha256(`${cc}|id|${m.id_externo}|${m.fecha}|${m.monto.toFixed(2)}|${m.direccion}`));
      continue;
    }
    const baseKey = `${cc}|${m.fecha}|${m.monto.toFixed(2)}|${m.direccion}|${normalizar([m.descripcion, ...(m.detalle || [])].join(' '))}`;
    const n = (vistos.get(baseKey) || 0) + 1;
    vistos.set(baseKey, n);
    out.push(await sha256(`${baseKey}#${n}`));
  }
  return out;
}

/** Hash del archivo completo (para avisar si se sube dos veces el mismo). */
export async function sha256Bytes(buffer) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
