import { parseMonto, fechaISO, r2 } from '../util.js';

/**
 * Export "Movimientos" de Caja de Ahorro / Cuenta Corriente de Galicia (xlsx o csv).
 * Encabezado: 'Banco Galicia - Caja Ahorro Pesos', 'Nro. de Cuenta: ...7683032', … y la fila
 * 'Fecha | Movimiento | Débito | Crédito | Saldo Parcial | Comentarios'.
 * La columna Movimiento trae varias líneas: la 1ª es el tipo, el resto el detalle (titular, CUIT, OPERACION n).
 */

const celda = (v) => (v === null || v === undefined ? '' : String(v));

export function esGalicia(filas = []) {
  const cabeza = filas.slice(0, 8).map((f) => celda(f?.[0])).join(' ').toLowerCase();
  return cabeza.includes('banco galicia') || (cabeza.includes('galicia') && cabeza.includes('nro. de cuenta'));
}

export function parseGalicia(filas = []) {
  const avisos = [];
  const titulo = celda(filas[0]?.[0]).trim();
  const numero = (filas.slice(0, 8).map((f) => celda(f?.[0])).join('\n').match(/Nro\.?\s*de\s*Cuenta:\s*([.\d\-/]+)/i) || [])[1] || null;
  const moneda = /d[oó]lar|u\$s|usd/i.test(titulo) ? 'USD' : 'ARS';
  const tipoCuenta = /corriente/i.test(titulo) ? 'Cuenta corriente' : 'Caja de ahorro';

  const iHead = filas.findIndex((f) => f && /^fecha$/i.test(celda(f[0]).trim()) && /movimiento/i.test(celda(f[1])));
  if (iHead === -1) return { ok: false, error: 'No encontré la fila de encabezados (Fecha, Movimiento, Débito, Crédito).' };
  const head = filas[iHead].map((h) => celda(h).trim().toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const cFecha = 0; const cMov = 1;
  const cDeb = col(/d[eé]bito/); const cCred = col(/cr[eé]dito/); const cSaldo = col(/saldo/);

  const movimientos = [];
  filas.slice(iHead + 1).forEach((f, i) => {
    if (!f || !celda(f[cFecha]).trim()) return;
    const fecha = fechaISO(f[cFecha]);
    if (!fecha) { avisos.push(`Fila ${iHead + i + 2}: fecha ilegible, se saltea.`); return; }
    const lineas = celda(f[cMov]).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const deb = parseMonto(f[cDeb]) || 0;
    const cred = parseMonto(f[cCred]) || 0;
    const neto = r2(cred + (deb > 0 ? -deb : deb)); // el débito puede venir con o sin signo
    if (!neto) return;
    const op = lineas.join(' ').match(/OPERACION\s+(\d{6,})/i);
    movimientos.push({
      fecha,
      descripcion: lineas[0] || '(sin descripción)',
      detalle: lineas.slice(1),
      monto: Math.abs(neto),
      direccion: neto > 0 ? 'entrada' : 'salida',
      saldo: cSaldo >= 0 ? parseMonto(f[cSaldo]) : null,
      id_externo: op ? op[1] : null
    });
  });

  // Validación: el saldo parcial encadena (el archivo viene del más nuevo al más viejo).
  let rotos = 0;
  for (let i = 0; i < movimientos.length - 1; i++) {
    const a = movimientos[i]; const b = movimientos[i + 1];
    if (a.saldo === null || b.saldo === null) continue;
    const esperado = r2(b.saldo + (a.direccion === 'entrada' ? a.monto : -a.monto));
    if (Math.abs(esperado - a.saldo) > 0.02) rotos += 1;
  }

  // Titular: las transferencias entre cuentas propias traen nombre y CUIT del dueño.
  const propia = movimientos.find((m) => /CTAS PROPIAS|CUENTA PROPIA/i.test(m.descripcion) && m.detalle.length >= 2 && /^\d{11}$/.test(m.detalle[1]));
  const titular = propia ? { nombre: propia.detalle[0], cuit: propia.detalle[1] } : null;

  const fechas = movimientos.map((m) => m.fecha).sort();
  return {
    ok: true,
    origen: 'galicia',
    cuenta: { institucion: 'galicia', nombre: `Galicia ${tipoCuenta}${moneda === 'USD' ? ' USD' : ''}`, tipo: 'banco', numero, moneda },
    titular,
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
    movimientos,
    validacion: { ok: rotos === 0, detalle: rotos ? `${rotos} saldo(s) no encadenan` : 'Saldos encadenados' },
    avisos
  };
}
