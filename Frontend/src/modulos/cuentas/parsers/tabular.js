import { parseMonto, fechaISO, r2 } from '../util.js';

/**
 * Lector genérico de planillas (xlsx/csv) de cualquier banco o billetera, incluido el
 * reporte de Mercado Pago en Excel/CSV. Busca la fila de encabezados por sinónimos.
 * Soporta: una columna de importe con signo, o columnas Débito/Crédito separadas.
 */

const SIN = {
  fecha: [/^fecha/, /^date$/, /release_date/, /^fecha de (la )?operaci[oó]n/, /^fecha origen/],
  descripcion: [/descrip/, /concepto/, /^movimiento$/, /^detalle$/, /transaction_type/, /^tipo de operaci[oó]n/, /^referencia$/],
  importe: [/^importe/, /^monto/, /^valor$/, /net_amount/, /^amount$/, /^total$/],
  debito: [/d[eé]bito/, /^debe$/, /egreso/, /salida/],
  credito: [/cr[eé]dito/, /^haber$/, /ingreso/, /entrada/],
  saldo: [/saldo/, /balance/],
  id: [/^id$/, /^id de (la )?operaci[oó]n$/, /^reference_id$/, /^source_id$/, /^(nro\.?|n[uú]mero) de operaci[oó]n$/, /^n[uú]mero de comprobante$/]
};

const norm = (v) => String(v ?? '').trim().toLowerCase();

function mapear(cabecera) {
  const usados = new Set();
  const buscar = (clave) => {
    const i = cabecera.findIndex((h, idx) => !usados.has(idx) && SIN[clave].some((rx) => rx.test(h)));
    if (i >= 0) usados.add(i);
    return i;
  };
  const m = { fecha: buscar('fecha') };
  m.debito = buscar('debito');
  m.credito = buscar('credito');
  m.importe = buscar('importe');
  m.saldo = buscar('saldo');
  m.id = buscar('id');
  m.descripcion = buscar('descripcion');
  return m;
}

export function encontrarTabla(filas = []) {
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const cab = (filas[i] || []).map(norm);
    if (cab.filter(Boolean).length < 3) continue;
    const m = mapear(cab);
    const tieneMonto = m.importe >= 0 || (m.debito >= 0 && m.credito >= 0);
    if (m.fecha >= 0 && tieneMonto && m.descripcion >= 0) return { fila: i, mapa: m };
  }
  return null;
}

export function parseTabular(filas = [], { origen = 'archivo', cuenta = null } = {}) {
  const t = encontrarTabla(filas);
  if (!t) return { ok: false, error: 'No reconozco las columnas. Necesito al menos Fecha, Descripción e Importe (o Débito y Crédito).' };
  const { fila, mapa } = t;
  const avisos = [];
  const movimientos = [];
  filas.slice(fila + 1).forEach((f, i) => {
    if (!f) return;
    const fecha = fechaISO(f[mapa.fecha]);
    if (!fecha) { if (String(f[mapa.fecha] ?? '').trim()) avisos.push(`Fila ${fila + i + 2}: fecha ilegible.`); return; }
    let neto;
    if (mapa.importe >= 0 && parseMonto(f[mapa.importe]) !== null) neto = parseMonto(f[mapa.importe]);
    else {
      const d = Math.abs(parseMonto(f[mapa.debito]) || 0);
      const c = Math.abs(parseMonto(f[mapa.credito]) || 0);
      neto = r2(c - d);
    }
    if (!neto) return;
    const lineas = String(f[mapa.descripcion] ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    movimientos.push({
      fecha,
      descripcion: lineas[0] || '(sin descripción)',
      detalle: lineas.slice(1),
      monto: Math.abs(neto),
      direccion: neto > 0 ? 'entrada' : 'salida',
      saldo: mapa.saldo >= 0 ? parseMonto(f[mapa.saldo]) : null,
      id_externo: mapa.id >= 0 && String(f[mapa.id] ?? '').trim() ? String(f[mapa.id]).trim() : null
    });
  });
  const fechas = movimientos.map((m) => m.fecha).sort();
  return {
    ok: movimientos.length > 0,
    error: movimientos.length ? null : 'La planilla no tiene movimientos.',
    origen,
    cuenta: cuenta || { institucion: origen === 'mercadopago' ? 'mercadopago' : 'otra', nombre: origen === 'mercadopago' ? 'Mercado Pago' : 'Otra cuenta', tipo: origen === 'mercadopago' ? 'billetera_virtual' : 'banco', numero: null, moneda: 'ARS' },
    titular: null,
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
    movimientos,
    validacion: { ok: true, detalle: 'Sin totales para comparar' },
    avisos
  };
}
