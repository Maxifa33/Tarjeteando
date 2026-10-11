import { parseMonto, fechaISO, r2, prolijo } from '../util.js';

/**
 * "Resumen de cuenta en pesos" de Mercado Pago (PDF).
 * Entrada: páginas con los textos y su posición, tal como los entrega pdf.js:
 *   [{ items: [{ x, y, str }] }]   (y crece hacia arriba)
 * Columnas: Fecha | Descripción | ID de la operación | Valor | Saldo.
 * La descripción puede ocupar 1 a 3 renglones, arriba y abajo del renglón de la fecha:
 * cada fragmento se asigna a la fila cuya fecha está más cerca en altura.
 */

const RX_FECHA = /^\d{2}-\d{2}-\d{4}$/;
const RX_ID = /^\d{9,}$/;
const RX_PLATA = /^\$\s*-?[\d.]+,\d{2}$/;
const ENCABEZADOS = /^(fecha|descripci[oó]n|id de la|operaci[oó]n|valor|saldo|detalle de movimientos)$/i;

export function esMercadoPagoTexto(texto = '') {
  return /RESUMEN DE CUENTA/i.test(texto) && /CVU:/i.test(texto) && /(Mercado ?Pago|Entradas:)/i.test(texto);
}

const unir = (items) => items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();

export function parseMercadoPagoPdf(paginas = []) {
  const todo = paginas.map((p) => unir([...p.items].sort((a, b) => b.y - a.y || a.x - b.x))).join('\n');
  const total = (rx) => { const m = todo.match(rx); return m ? parseMonto(m[1]) : null; };
  const entradas = total(/Entradas:\s*(\$\s*-?[\d.]+,\d{2})/i);
  const salidas = total(/Salidas:\s*(\$\s*-?[\d.]+,\d{2})/i);
  const saldoInicial = total(/Saldo inicial:\s*(\$\s*-?[\d.]+,\d{2})/i);
  const saldoFinal = total(/Saldo final:\s*(\$\s*-?[\d.]+,\d{2})/i);
  const cvu = (todo.match(/CVU:\s*(\d{22})/) || [])[1] || null;
  const cuit = (todo.match(/CUIT\/?\s*CUIL:\s*(\d{11})/i) || [])[1] || null;
  const p1 = paginas[0] ? paginas[0].items.filter((i) => i.str && i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x) : [];
  const iResumen = p1.findIndex((i) => /RESUMEN DE CUENTA/i.test(i.str));
  const titular = iResumen >= 0 && p1[iResumen + 1] && !/CVU|CUIT/i.test(p1[iResumen + 1].str) ? prolijo(p1[iResumen + 1].str) : null;

  const movimientos = [];
  const avisos = [];
  paginas.forEach((pag) => {
    const items = pag.items.filter((i) => i.str && i.str.trim());
    const anclas = items.filter((i) => RX_FECHA.test(i.str.trim()) && i.x < 80).sort((a, b) => b.y - a.y);
    if (!anclas.length) return;
    // Columnas a partir de los encabezados de la página (con valores por defecto del formato conocido).
    const xId = (items.find((i) => /^ID de la$/i.test(i.str.trim())) || { x: 190 }).x;
    const xValor = (items.find((i) => /^Valor$/i.test(i.str.trim())) || { x: 300 }).x;
    const xDesc = (items.find((i) => /^Descripci[oó]n$/i.test(i.str.trim())) || { x: 85 }).x;
    const yHead = (items.find((i) => /^Fecha$/i.test(i.str.trim())) || { y: Infinity }).y;

    const filas = anclas.map((a) => ({ ancla: a, desc: [], id: null, valor: null, saldo: null }));
    const cerca = (y) => filas.reduce((best, f) => (Math.abs(f.ancla.y - y) < Math.abs(best.ancla.y - y) ? f : best), filas[0]);

    items.forEach((it) => {
      const s = it.str.trim();
      if (anclas.includes(it)) return;
      if (it.y >= yHead - 2) return; // encabezado de página y de tabla
      const f = cerca(it.y);
      const dy = Math.abs(f.ancla.y - it.y);
      if (it.x >= xDesc - 4 && it.x < xId - 4) {
        if (dy <= 16 && !ENCABEZADOS.test(s)) f.desc.push(it);
        return;
      }
      if (dy > 3) return;
      if (it.x >= xId - 4 && it.x < xValor - 10 && RX_ID.test(s)) f.id = s;
      else if (RX_PLATA.test(s)) { if (f.valor === null) f.valor = s; else f.saldo = s; }
    });

    filas.forEach((f) => {
      if (f.valor === null) { avisos.push(`No pude leer el importe del ${f.ancla.str.trim()}.`); return; }
      // Si valor y saldo llegaron cambiados (orden de items), el de la izquierda es el valor.
      const plata = items.filter((i) => Math.abs(i.y - f.ancla.y) <= 3 && RX_PLATA.test(i.str.trim())).sort((a, b) => a.x - b.x);
      const valor = parseMonto(plata[0]?.str ?? f.valor);
      const saldo = plata[1] ? parseMonto(plata[1].str) : (f.saldo ? parseMonto(f.saldo) : null);
      const descripcion = unir(f.desc.sort((a, b) => b.y - a.y || a.x - b.x));
      movimientos.push({
        fecha: fechaISO(f.ancla.str.trim()),
        descripcion: descripcion || '(sin descripción)',
        detalle: [],
        monto: Math.abs(valor),
        direccion: valor >= 0 ? 'entrada' : 'salida',
        saldo,
        id_externo: f.id
      });
    });
  });

  const sumE = r2(movimientos.filter((m) => m.direccion === 'entrada').reduce((s, m) => s + m.monto, 0));
  const sumS = r2(movimientos.filter((m) => m.direccion === 'salida').reduce((s, m) => s + m.monto, 0));
  const okE = entradas === null || Math.abs(sumE - entradas) < 0.02;
  const okS = salidas === null || Math.abs(sumS - Math.abs(salidas)) < 0.02;
  const fechas = movimientos.map((m) => m.fecha).filter(Boolean).sort();

  return {
    ok: movimientos.length > 0,
    error: movimientos.length ? null : 'No encontré movimientos en el PDF.',
    origen: 'mercadopago',
    cuenta: { institucion: 'mercadopago', nombre: 'Mercado Pago', tipo: 'billetera_virtual', numero: cvu ? `…${cvu.slice(-6)}` : null, moneda: 'ARS' },
    titular: titular || cuit ? { nombre: titular, cuit } : null,
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
    movimientos,
    totales: { entradas, salidas, saldoInicial, saldoFinal },
    validacion: {
      ok: okE && okS,
      detalle: okE && okS
        ? 'Entradas y salidas coinciden con el resumen'
        : `No coinciden los totales: entradas ${sumE} vs ${entradas}, salidas ${sumS} vs ${salidas}`
    },
    avisos
  };
}
