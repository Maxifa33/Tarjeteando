/**
 * Tests de la calculadora de cuotas — corren con `npm test` (node:test, sin dependencias).
 *
 * Reemplazan a Backend/tests/proyeccion.test.js, que probaba una segunda
 * implementación que el frontend nunca consumía. Ahora se testea el código que
 * realmente dibuja la pantalla.
 *
 * Cubre:
 *  1. Unitarios sintéticos: anclaje al período, cuotas USD, planes interrumpidos.
 *  2. Independencia del orden de subida, con los PDFs reales de fixtures.
 *  3. El caso Easy Warnes (VISA GAL Julio/Agosto 2026) contra los números que
 *     imprime el propio banco en "Cuotas a vencer".
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import {
  construirPlanes,
  proyectarCuotas,
  formatearParaVista,
  totalPendiente,
  numerosDeCuota
} from './cuotas.js';

const aquí = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(aquí, '../../..');
const PDF_DIR = path.join(RAIZ, 'Backend/tests/fixtures/pdfs');

// ───────────────────────────── helpers ─────────────────────────────
const resumen = (tarjeta, anio, mes) => ({ id: `${tarjeta}-${anio}-${mes}`, tarjeta, anio, mes });
const mov = (r, referencia, cuota, pesos, dolares = 0) => ({
  id: `${r.id}-${referencia}-${cuota}`,
  resumen_id: r.id,
  tarjeta: r.tarjeta,
  referencia_limpia: referencia,
  cuota_texto: cuota,
  monto_pesos: pesos,
  monto_dolares: dolares
});
const mezclar = (arr, semilla) => {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    const j = semilla % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

// ──────────────────────── 1. unitarios sintéticos ────────────────────────
describe('numerosDeCuota', () => {
  test('lee el formato NN/MM', () => {
    assert.deepEqual(numerosDeCuota({ cuota_texto: '08/12' }), { actual: 8, total: 12 });
    assert.deepEqual(numerosDeCuota({ cuota_texto: '1/3' }), { actual: 1, total: 3 });
  });

  test('acepta es_cuota explícito (formato Vision)', () => {
    assert.deepEqual(
      numerosDeCuota({ es_cuota: true, cuota_actual: 2, total_cuotas: 6 }),
      { actual: 2, total: 6 }
    );
  });

  test('devuelve null si no es una cuota', () => {
    assert.equal(numerosDeCuota({}), null);
    assert.equal(numerosDeCuota({ cuota_texto: 'USD 45,00' }), null);
    assert.equal(numerosDeCuota({ cuota_texto: '03/00' }), null);
  });
});

describe('construirPlanes y proyectarCuotas', () => {
  test('ancla al período del resumen, no a la fecha de hoy', () => {
    const r = resumen('VISA', 2026, 3);
    const planes = construirPlanes([mov(r, 'Sillon', '02/06', 10000)], [r]);
    const proy = proyectarCuotas(planes, { meses: 4, resumenes: [r], hoy: new Date(2030, 0, 1) });

    assert.equal(proy[0].mes_key, '2026-04');
    assert.deepEqual(proy.map(p => p.total), [10000, 10000, 10000, 10000]);
    assert.equal(proy[0].detalles[0].cuota_numero, 3);
    assert.equal(proy[3].detalles[0].cuota_numero, 6);
  });

  test('no proyecta más allá de la última cuota', () => {
    const r = resumen('VISA', 2026, 3);
    const planes = construirPlanes([mov(r, 'Heladera', '05/06', 8000)], [r]);
    const proy = proyectarCuotas(planes, { meses: 3, resumenes: [r] });
    assert.deepEqual(proy.map(p => p.total), [8000, 0, 0]);
  });

  test('un plan terminado (N/N) no se proyecta ni se marca interrumpido', () => {
    const r1 = resumen('VISA', 2026, 3);
    const r2 = resumen('VISA', 2026, 4);
    const planes = construirPlanes([mov(r1, 'Tele', '06/06', 5000)], [r1, r2]);
    assert.equal(planes[0].interrumpida, false);
    const proy = proyectarCuotas(planes, { meses: 3, resumenes: [r1, r2] });
    assert.deepEqual(proy.map(p => p.total), [0, 0, 0]);
  });

  test('un plan que el banco deja de facturar se marca interrumpido y no se proyecta', () => {
    const jul = resumen('VISA', 2026, 7);
    const ago = resumen('VISA', 2026, 8);
    const planes = construirPlanes(
      [mov(jul, 'Easy', '01/03', 53745), mov(ago, 'Puma', '01/03', 53333)],
      [jul, ago]
    );
    const easy = planes.find(p => p.referencia_limpia === 'Easy');
    const puma = planes.find(p => p.referencia_limpia === 'Puma');

    assert.equal(easy.interrumpida, true, 'Easy no aparece en agosto → interrumpida');
    assert.equal(puma.interrumpida, false);

    // Sigue visible en la vista Cuotas, con el aviso.
    const vista = formatearParaVista(planes);
    assert.equal(vista.find(v => v.descripcion === 'Easy').interrumpida, true);

    // Pero no suma en la proyección ni en el pendiente.
    const proy = proyectarCuotas(planes, { meses: 2, resumenes: [jul, ago] });
    assert.deepEqual(proy.map(p => p.total), [53333, 53333]);
    assert.equal(totalPendiente(planes), 53333 * 2);
  });

  test('el plan se ancla a SU período, no al último resumen de la tarjeta', () => {
    // Un plan facturado en junio que sigue vivo en agosto (aparece en ambos):
    // debe proyectarse desde agosto, no desde junio.
    const jun = resumen('VISA', 2026, 6);
    const ago = resumen('VISA', 2026, 8);
    const planes = construirPlanes(
      [mov(jun, 'Moto', '01/04', 20000), mov(ago, 'Moto', '03/04', 20000)],
      [jun, ago]
    );
    assert.equal(planes.length, 1, 'las dos apariciones son el mismo plan');
    assert.equal(planes[0].cuota_actual, 3);
    assert.equal(planes[0].interrumpida, false);

    const proy = proyectarCuotas(planes, { meses: 3, resumenes: [jun, ago] });
    assert.deepEqual(proy.map(p => p.total), [20000, 0, 0]);
    assert.equal(proy[0].detalles[0].cuota_numero, 4);
  });

  test('las cuotas en dólares se pesifican; sin cotización no inventan pesos', () => {
    const r = resumen('VISA', 2026, 5);
    const planes = construirPlanes([mov(r, 'PlayStation', '01/03', 0, 30)], [r]);

    const sinCotiz = proyectarCuotas(planes, { meses: 2, resumenes: [r] });
    assert.equal(sinCotiz[0].total, 0);
    assert.equal(sinCotiz[0].detalles[0].es_estimado_usd, true);
    assert.equal(sinCotiz[0].detalles[0].monto_cuota_dolares, 30);

    const conCotiz = proyectarCuotas(planes, { meses: 2, resumenes: [r], cotizacionVenta: 1500 });
    assert.equal(conCotiz[0].total, 45000);
    assert.equal(totalPendiente(planes, 1500), 90000);
  });

  test('los movimientos que no son cuotas se ignoran', () => {
    const r = resumen('VISA', 2026, 5);
    const planes = construirPlanes(
      [{ resumen_id: r.id, tarjeta: 'VISA', referencia_limpia: 'Coto', monto_pesos: 50000 }],
      [r]
    );
    assert.equal(planes.length, 0);
  });

  test('un movimiento sin resumen conocido no rompe nada', () => {
    const r = resumen('VISA', 2026, 5);
    const huerfano = { ...mov(r, 'Fantasma', '01/03', 1000), resumen_id: 'no-existe' };
    const planes = construirPlanes([mov(r, 'Real', '01/03', 2000), huerfano], [r]);
    assert.equal(planes.length, 1);
    assert.equal(planes[0].referencia_limpia, 'Real');
  });

  test('usa anio_resumen/mes_resumen si falta el resumen_id', () => {
    const r = resumen('VISA', 2026, 5);
    const sinId = { ...mov(r, 'Sin Id', '01/03', 3000), resumen_id: undefined, anio_resumen: 2026, mes_resumen: 5 };
    const planes = construirPlanes([sinId], [r]);
    assert.equal(planes.length, 1);
    assert.equal(planes[0].periodo_mes, 5);
  });

  test('sin resúmenes, el ancla cae en el mes de hoy (no rompe)', () => {
    const proy = proyectarCuotas([], { meses: 2, resumenes: [], hoy: new Date(2026, 4, 10) });
    assert.equal(proy[0].mes_key, '2026-06');
    assert.deepEqual(proy.map(p => p.total), [0, 0]);
  });
});

// ───────────── 2. independencia del orden, con los PDFs reales ─────────────
const ARCHIVOS = [
  'VISA GAL - Diciembre 2025.pdf',
  'Master GAL- Agosto 2025.pdf',
  'SANTANDER VISA OCTUBRE 2025.pdf',
  'VISA GAL - Marzo 2026.pdf'
];
const HAY_PDFS = fs.existsSync(PDF_DIR) && ARCHIVOS.every(f => fs.existsSync(path.join(PDF_DIR, f)));

describe('Independencia del orden de subida (PDFs reales)', { skip: !HAY_PDFS && 'faltan las fixtures de PDFs' }, () => {
  // El parser vive en el backend (CJS); el test lo carga por ruta relativa.
  const require = createRequire(import.meta.url);
  const PDFParserService = require(path.join(RAIZ, 'Backend/src/services/pdf-parser.service.js'));

  const parsearTodo = async () => {
    const log = console.log;
    console.log = () => {};
    try {
      const movimientos = [];
      const resumenes = [];
      for (const archivo of ARCHIVOS) {
        const r = await new PDFParserService().parsearPDF(fs.readFileSync(path.join(PDF_DIR, archivo)), archivo);
        if (!r.exito) continue;
        const id = `${r.tarjeta}-${r.resumen.anio}-${r.resumen.mes}`;
        resumenes.push({ id, tarjeta: r.tarjeta, anio: r.resumen.anio, mes: r.resumen.mes });
        r.movimientos.forEach((m, i) => movimientos.push({ ...m, id: `${id}-${i}`, tarjeta: r.tarjeta, resumen_id: id }));
      }
      return { movimientos, resumenes };
    } finally {
      console.log = log;
    }
  };

  test('los planes y la proyección no dependen del orden', async () => {
    const { movimientos, resumenes } = await parsearTodo();
    assert.ok(movimientos.length > 0, 'se parsearon movimientos');

    const referencia = JSON.stringify(
      proyectarCuotas(construirPlanes(movimientos, resumenes), { meses: 6, resumenes })
    );

    for (const semilla of [7, 101, 9973]) {
      const revuelto = proyectarCuotas(
        construirPlanes(mezclar(movimientos, semilla), mezclar(resumenes, semilla)),
        { meses: 6, resumenes: mezclar(resumenes, semilla) }
      );
      assert.equal(JSON.stringify(revuelto), referencia, `el orden ${semilla} cambió el resultado`);
    }
  });

  test('cada cuota proyectada lleva el número correcto respecto de su período', async () => {
    const { movimientos, resumenes } = await parsearTodo();
    const planes = construirPlanes(movimientos, resumenes);
    const proy = proyectarCuotas(planes, { meses: 6, resumenes });

    proy.forEach(bucket => {
      bucket.detalles.forEach(d => {
        assert.ok(d.cuota_numero >= 2, `${d.descripcion}: la proyección empieza en la cuota 2`);
        assert.ok(d.cuota_numero <= d.total_cuotas, `${d.descripcion}: ${d.cuota_numero}/${d.total_cuotas} se pasa del total`);
      });
    });
  });

  test('la proyección arranca el mes siguiente al resumen más reciente', async () => {
    const { movimientos, resumenes } = await parsearTodo();
    const ultimo = resumenes.reduce((max, r) => (!max || r.anio * 12 + r.mes > max.anio * 12 + max.mes ? r : max), null);
    const proy = proyectarCuotas(construirPlanes(movimientos, resumenes), { meses: 1, resumenes });
    const siguiente = new Date(ultimo.anio, ultimo.mes, 1);
    assert.equal(proy[0].mes_key, `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, '0')}`);
  });
});

// ──────── 3. caso real: VISA GAL Julio/Agosto 2026 contra el propio banco ────────
describe('Caso Easy Warnes contra "Cuotas a vencer" del resumen', () => {
  const JUL = resumen('VISA Galicia', 2026, 7);
  const AGO = resumen('VISA Galicia', 2026, 8);

  const movsJulio = [
    mov(JUL, 'Muss Sa', '06/06', 73333.33),
    mov(JUL, 'Todopampa', '02/04', 29797.43),
    mov(JUL, 'Sodastream', '02/03', 45366.33),
    mov(JUL, 'Ilcapitano', '02/03', 39991.00),
    mov(JUL, 'Easy', '01/03', 53745.00)
  ];
  const movsAgosto = [
    mov(AGO, 'Todopampa', '03/04', 29797.43),
    mov(AGO, 'Sodastream', '03/03', 45366.33),
    mov(AGO, 'Ilcapitano', '03/03', 39991.00),
    mov(AGO, 'Urquiza', '01/03', 106250.00),
    mov(AGO, 'Planoutcanaldeven', '01/03', 55200.00),
    mov(AGO, 'Puma Alto Palermo', '01/03', 53333.00)
  ];

  test('con solo Julio cargado, coincide con el "Cuotas a vencer" de Julio', () => {
    const planes = construirPlanes(movsJulio, [JUL]);
    const proy = proyectarCuotas(planes, { meses: 2, resumenes: [JUL] });
    // El PDF de Julio/26 imprime: Agosto $168.899,76 · Setiembre $83.542,43
    assert.equal(proy[0].total, 168899.76);
    assert.equal(proy[1].total, 83542.43);
  });

  test('con Julio + Agosto, coincide con el "Cuotas a vencer" de Agosto', () => {
    const planes = construirPlanes([...movsJulio, ...movsAgosto], [JUL, AGO]);
    const proy = proyectarCuotas(planes, { meses: 2, resumenes: [JUL, AGO] });
    // El PDF de Agosto/26 imprime: Setiembre $244.580,43 · Octubre $214.783,00
    assert.equal(proy[0].total, 244580.43);
    assert.equal(proy[1].total, 214783.00);

    // Y Easy sigue siendo visible, marcado como interrumpido.
    const easy = formatearParaVista(planes).find(v => v.descripcion === 'Easy');
    assert.ok(easy, 'Easy sigue apareciendo en la vista Cuotas');
    assert.equal(easy.interrumpida, true);
    assert.equal(easy.cuotas_restantes, 2);
  });

  test('el resultado es el mismo si se sube Agosto antes que Julio', () => {
    const enOrden = proyectarCuotas(construirPlanes([...movsJulio, ...movsAgosto], [JUL, AGO]), { meses: 3, resumenes: [JUL, AGO] });
    const invertido = proyectarCuotas(construirPlanes([...movsAgosto, ...movsJulio], [AGO, JUL]), { meses: 3, resumenes: [AGO, JUL] });
    assert.equal(JSON.stringify(invertido), JSON.stringify(enOrden));
  });
});
