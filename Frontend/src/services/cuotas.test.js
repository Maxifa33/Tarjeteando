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
  numerosDeCuota,
  estaVigente,
  estaEnCurso,
  normalizarComprobante,
  claveDePlan,
  observacionesEnCurso,
  sinEmparejarDe
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

describe('estado de cada plan (qué se muestra en la vista Cuotas)', () => {
  const ene = resumen('VISA', 2026, 1);
  const abr = resumen('VISA', 2026, 4);
  const may = resumen('VISA', 2026, 5);
  const resumenes = [ene, abr, may];

  const planes = construirPlanes([
    // sigue debiendo: se facturó en el último resumen
    mov(may, 'Heladera', '02/06', 50000),
    // terminó justo en el último resumen → plata que se libera este mes
    mov(may, 'Moto', '06/06', 30000),
    // terminó hace meses → historial puro
    mov(ene, 'Zapatillas', '03/03', 20000),
    // quedan cuotas pero el banco dejó de facturarlas
    mov(abr, 'Easy', '01/03', 40000)
  ], resumenes);

  const porNombre = Object.fromEntries(planes.map(p => [p.referencia_limpia, p]));

  test('clasifica los cuatro casos', () => {
    assert.equal(porNombre['Heladera'].estado, 'vigente');
    assert.equal(porNombre['Moto'].estado, 'ultima_cuota');
    assert.equal(porNombre['Zapatillas'].estado, 'terminada');
    assert.equal(porNombre['Easy'].estado, 'interrumpida');
  });

  test('solo "vigente" cuenta como deuda por delante', () => {
    assert.deepEqual(planes.filter(estaVigente).map(p => p.referencia_limpia), ['Heladera']);
  });

  test('la vista muestra todo menos las terminadas viejas', () => {
    const enCurso = planes.filter(estaEnCurso).map(p => p.referencia_limpia).sort();
    assert.deepEqual(enCurso, ['Easy', 'Heladera', 'Moto']);
  });

  test('un plan terminado no suma al pendiente ni a la proyección', () => {
    assert.equal(totalPendiente(planes), 50000 * 4); // solo Heladera: cuotas 3 a 6
    const proy = proyectarCuotas(planes, { meses: 4, resumenes });
    assert.deepEqual(proy.map(p => p.total), [50000, 50000, 50000, 50000]);
  });

  test('la vista viene ordenada: última cuota, vigentes, a revisar, terminadas', () => {
    const orden = formatearParaVista(planes).map(v => v.estado);
    assert.deepEqual(orden, ['ultima_cuota', 'vigente', 'interrumpida', 'terminada']);
  });

  test('entre vigentes, primero las que están por terminar', () => {
    const r = resumen('VISA', 2026, 6);
    const vista = formatearParaVista(construirPlanes([
      mov(r, 'Larga', '01/12', 1000),
      mov(r, 'Corta', '05/06', 1000),
      mov(r, 'Media', '03/09', 1000)
    ], [r]));
    assert.deepEqual(vista.map(v => v.descripcion), ['Corta', 'Media', 'Larga']);
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

  const parsearTodo = async (archivos = ARCHIVOS) => {
    const log = console.log;
    console.log = () => {};
    try {
      const movimientos = [];
      const resumenes = [];
      for (const archivo of archivos) {
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

  test('sin decisiones, la salida es idéntica a la de antes (fase 5)', async () => {
    const { movimientos, resumenes } = await parsearTodo();
    const antes = construirPlanes(movimientos, resumenes);
    assert.deepEqual(construirPlanes(movimientos, resumenes, []), antes);
    // Una decisión sobre un plan que no existe (resumen borrado) se ignora sin error.
    assert.deepEqual(construirPlanes(movimientos, resumenes, [{ claveDePlan: 'no|existe|3|1', decision: 'terminado', fecha: '2026-01-01' }]), antes);
    assert.equal(
      JSON.stringify(proyectarCuotas(construirPlanes(movimientos, resumenes, []), { meses: 6, resumenes })),
      JSON.stringify(proyectarCuotas(antes, { meses: 6, resumenes }))
    );
  });

  test('con comprobante: cada compra es un plan; la proyección no cambia', async () => {
    const { movimientos, resumenes } = await parsearTodo();
    // Los mismos movimientos sin comprobante (como los guardados antes del paso 1).
    const sinComprobante = movimientos.map(({ comprobante, ...m }) => m);
    const conComp = construirPlanes(movimientos, resumenes);
    const sinComp = construirPlanes(sinComprobante, resumenes);
    const totales = (planes) => proyectarCuotas(planes, { meses: 12, resumenes }).map(b => b.total);
    // Snapshot de la proyección con las fixtures, idéntica a la de antes del cambio de identidad.
    const SNAPSHOT = [401687.15, 149166.54, 117499.88, 117499.88, 44166.55, 44166.55, 44166.55, 44166.55, 44166.55, 44166.55, 0, 0];
    assert.deepEqual(totales(conComp), SNAPSHOT);
    assert.deepEqual(totales(sinComp), SNAPSHOT);
    assert.equal(conComp.length, 23);
    assert.equal(sinComp.length, 23);
    // Ninguna compra con comprobante queda en dos planes.
    const vistos = new Set();
    conComp.filter(p => p.clave.includes('|c:')).forEach(p => {
      assert.ok(!vistos.has(p.clave), p.clave);
      vistos.add(p.clave);
    });
  });

  test('Brooksfield y Sodimac (VISA Galicia jul–sep 2025): un plan cada uno, terminan en 03/03', async () => {
    const archivos = ['VISA GAL - Julio 2025.pdf', 'VISA GAL - Agosto 2025.pdf', 'VISA GAL - Septiembre 2025.pdf'];
    if (!archivos.every(f => fs.existsSync(path.join(PDF_DIR, f)))) return;
    const { movimientos, resumenes } = await parsearTodo(archivos);
    const planes = construirPlanes(movimientos, resumenes);
    for (const [re, comp] of [[/^brooksfield/i, 'VISA Galicia|c:8547'], [/^sodimac/i, 'VISA Galicia|c:990054']]) {
      const p = planes.filter(x => re.test(x.referencia_original));
      assert.equal(p.length, 1, String(re));
      assert.equal(p[0].clave, comp);
      assert.deepEqual([p[0].cuota_actual, p[0].total_cuotas, p[0].periodo_mes], [3, 3, 9]);
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

// ───────────── 4. decisiones del usuario sobre planes interrumpidos (fase 5) ─────────────
describe('Decisiones sobre planes a revisar', () => {
  const JUL = resumen('VISA Galicia', 2026, 7);
  const AGO = resumen('VISA Galicia', 2026, 8);
  const movs = [mov(JUL, 'Easy', '01/03', 53745), mov(AGO, 'Puma', '01/03', 53333)];
  const easyClave = construirPlanes(movs, [JUL, AGO]).find(p => p.referencia_limpia === 'Easy').clave;

  test('"terminado": pasa a terminada por decisión del usuario y no se proyecta', () => {
    const planes = construirPlanes(movs, [JUL, AGO], [{ claveDePlan: easyClave, decision: 'terminado', fecha: '2026-09-01' }]);
    const easy = planes.find(p => p.referencia_limpia === 'Easy');
    assert.equal(easy.estado, 'terminada');
    assert.equal(easy.motivo, 'decision_usuario');
    assert.equal(easy.interrumpida, false);
    const proy = proyectarCuotas(planes, { meses: 3, resumenes: [JUL, AGO] });
    assert.ok(proy.every(m => !m.detalles.some(d => d.descripcion === 'Easy')));
    assert.equal(totalPendiente(planes), 53333 * 2);
    assert.equal(formatearParaVista(planes).find(v => v.descripcion === 'Easy').motivo, 'decision_usuario');
  });

  test('"vigente": deja de estar interrumpido y se proyecta hasta su última cuota', () => {
    const planes = construirPlanes(movs, [JUL, AGO], [{ claveDePlan: easyClave, decision: 'vigente', fecha: '2026-09-01' }]);
    const easy = planes.find(p => p.referencia_limpia === 'Easy');
    assert.equal(easy.estado, 'vigente');
    assert.equal(easy.interrumpida, false);
    // Anclado a julio (1/3): la 3/3 cae en septiembre.
    const proy = proyectarCuotas(planes, { meses: 2, resumenes: [JUL, AGO] });
    assert.ok(proy[0].detalles.some(d => d.descripcion === 'Easy' && d.cuota_numero === 3));
  });

  test('"vigente" y el banco lo vuelve a facturar: no queda duplicado', () => {
    const SEP = resumen('VISA Galicia', 2026, 9);
    const planes = construirPlanes([...movs, mov(SEP, 'Easy', '03/03', 53745)], [JUL, AGO, SEP],
      [{ claveDePlan: easyClave, decision: 'vigente', fecha: '2026-09-01' }]);
    assert.equal(planes.filter(p => p.referencia_limpia === 'Easy').length, 1);
  });

  test('gana la decisión más reciente', () => {
    const planes = construirPlanes(movs, [JUL, AGO], [
      { claveDePlan: easyClave, decision: 'terminado', fecha: '2026-09-01' },
      { claveDePlan: easyClave, decision: 'vigente', fecha: '2026-09-02' }
    ]);
    assert.equal(planes.find(p => p.referencia_limpia === 'Easy').estado, 'vigente');
  });
});

// ──────── 5. identidad del plan: comprobante u ocurrencia ────────
describe('normalizarComprobante', () => {
  test('solo dígitos, sin ceros a la izquierda', () => {
    assert.equal(normalizarComprobante('009872'), '9872');
    assert.equal(normalizarComprobante('00009872'), '9872');
    assert.equal(normalizarComprobante('009 872'), '9872');
  });
  test('vacío o solo ceros = sin comprobante', () => {
    for (const c of ['000000', '', null, undefined]) assert.equal(normalizarComprobante(c), null);
  });
});

describe('Identidad de planes', () => {
  const R1 = resumen('VISA', 2026, 3);
  const R2 = resumen('VISA', 2026, 4);
  const conComp = (r, ref, cuota, pesos, comprobante, n = '') => ({ ...mov(r, ref, cuota, pesos), id: `${r.id}-${ref}-${cuota}-${comprobante}${n}`, comprobante });
  const dos = (r, cuota) => [
    { ...mov(r, 'Zapatillas', cuota, 20000), id: `${r.id}-a`, fecha_compra: '2026-01-10' },
    { ...mov(r, 'Zapatillas', cuota, 20000), id: `${r.id}-b`, fecha_compra: '2026-01-10' }
  ];

  test('dos compras idénticas en el mismo resumen son 2 planes y la proyección es doble', () => {
    const planes = construirPlanes(dos(R1, '03/06'), [R1]);
    assert.equal(planes.length, 2);
    assert.deepEqual(planes.map(p => p.clave).sort(), [`${claveDePlan({ tarjeta: 'VISA', referencia_limpia: 'Zapatillas' }, 6, 20000, 0)}#1`, `${claveDePlan({ tarjeta: 'VISA', referencia_limpia: 'Zapatillas' }, 6, 20000, 0)}#2`]);
    assert.equal(proyectarCuotas(planes, { meses: 1, resumenes: [R1] })[0].total, 40000);
  });

  test('en el resumen siguiente como 4/6 siguen siendo 2 (no 4)', () => {
    const planes = construirPlanes([...dos(R1, '03/06'), ...dos(R2, '04/06')], [R1, R2]);
    assert.equal(planes.length, 2);
    assert.ok(planes.every(p => p.cuota_actual === 4 && p.periodo_mes === 4 && !p.interrumpida));
  });

  test('con comprobantes distintos → 2 planes; mismo comprobante en dos tarjetas → 2 planes', () => {
    assert.equal(construirPlanes([conComp(R1, 'Zapatillas', '03/06', 20000, '000111'), conComp(R1, 'Zapatillas', '03/06', 20000, '000222')], [R1]).length, 2);
    const M1 = resumen('MASTER', 2026, 3);
    const planes = construirPlanes([conComp(R1, 'Zapatillas', '03/06', 20000, '000111'), conComp(M1, 'Zapatillas', '03/06', 20000, '000111')], [R1, M1]);
    assert.equal(planes.length, 2);
    assert.deepEqual(planes.map(p => p.clave).sort(), ['MASTER|c:111', 'VISA|c:111']);
  });

  test('el comprobante identifica aunque cambie el nombre (regla de nombres nueva)', () => {
    const planes = construirPlanes([conComp(R1, 'WWW.FRAVEGA', '03/18', 44166.55, '009872'), conComp(R2, 'Fravega', '04/18', 44166.55, '00009872')], [R1, R2]);
    assert.equal(planes.length, 1);
    assert.equal(planes[0].cuota_actual, 4);
  });

  test('resumen viejo sin comprobante + nuevo con comprobante de la misma compra → 1 plan', () => {
    const viejo = mov(R1, 'Heladera', '02/06', 30000);
    const nuevo = conComp(R2, 'Heladera', '03/06', 30000, '004455');
    for (const orden of [[viejo, nuevo], [nuevo, viejo]]) {
      const planes = construirPlanes(orden, [R1, R2]);
      assert.equal(planes.length, 1);
      assert.equal(planes[0].cuota_actual, 3);
      assert.equal(planes[0].clave, 'VISA|c:4455');
      assert.ok(planes[0].alias.includes(`${claveDePlan(viejo, 6, 30000, 0)}#1`));
    }
    // Y al revés: resumen viejo re-subido con comprobante, el nuevo sin.
    const planes = construirPlanes([conComp(R1, 'Heladera', '02/06', 30000, '004455'), mov(R2, 'Heladera', '03/06', 30000)], [R1, R2]);
    assert.equal(planes.length, 1);
    assert.equal(planes[0].cuota_actual, 3);
  });

  test('la misma compra dos veces en un resumen (puesta al día): gana la cuota más alta', () => {
    const planes = construirPlanes([conComp(R1, 'Sony', '02/03', 39235.58, '007860'), conComp(R1, 'Sony', '03/03', 39235.58, '007860')], [R1]);
    assert.equal(planes.length, 1);
    assert.equal(planes[0].cuota_actual, 3);
  });

  test('una decisión sobre el plan sin comprobante sigue valiendo cuando empalma con uno con comprobante', () => {
    const R3 = resumen('VISA', 2026, 5);
    const viejo = mov(R1, 'Heladera', '02/06', 30000);
    const nuevo = conComp(R2, 'Heladera', '03/06', 30000, '004455');
    const otro = mov(R3, 'Otra', '01/02', 1000);
    const clave = `${claveDePlan(viejo, 6, 30000, 0)}#1`;
    const planes = construirPlanes([viejo, nuevo, otro], [R1, R2, R3], [{ claveDePlan: clave, decision: 'terminado', fecha: '2026-06-01' }]);
    const heladera = planes.find(p => p.referencia_limpia === 'Heladera');
    assert.equal(heladera.motivo, 'decision_usuario');
  });

  test('el orden de subida no cambia la identidad (ocurrencias por fecha e id)', () => {
    const movs = [...dos(R1, '03/06'), ...dos(R2, '04/06'), mov(R1, 'Otra', '01/02', 500)];
    const ref = JSON.stringify(construirPlanes(movs, [R1, R2]).map(p => p.clave).sort());
    for (const semilla of [3, 17, 4242]) {
      assert.equal(JSON.stringify(construirPlanes(mezclar(movs, semilla), [R1, R2]).map(p => p.clave).sort()), ref);
    }
  });
});

// ──────── 6. cuotas de Últimos consumos como observaciones en curso ────────
describe('observacionesEnCurso', () => {
  const ciclos = {
    'Santander|Visa|3327': { grupoKey: 'Santander|Visa|3327', banco: 'Santander', red: 'Visa', fecha_cierre: '2026-10-01', fecha_vencimiento: '2026-10-09', estado: 'provisional' },
    'Macro|Visa|1111': { grupoKey: 'Macro|Visa|1111', banco: 'Macro', red: 'Visa', fecha_cierre: '2026-09-25', fecha_vencimiento: '2026-10-07', estado: 'provisional' },
    'Galicia|Visa|4410': { grupoKey: 'Galicia|Visa|4410', banco: 'Galicia', red: 'Visa', fecha_cierre: '2026-09-04', fecha_vencimiento: '2026-09-16', estado: 'conciliado' }
  };
  const tarjetas = [{ nombre: 'VISA Santander', banco: 'Santander', tipo: 'VISA' }, { nombre: 'VISA Galicia', banco: 'Galicia', tipo: 'VISA' }];
  const c = (grupo_key, ciclo_cierre, extra) => ({ id: `${grupo_key}-${extra.descripcion}`, grupo_key, ciclo_cierre, tarjeta_ult4: '3327', fecha: '2026-09-10', monto_dolares: 0, es_cuota: true, ...extra });
  const consumos = [
    c('Santander|Visa|3327', '2026-10-01', { descripcion: 'WWW.FRAVEGA.COM', cuota_actual: 14, total_cuotas: 18, monto_pesos: 44166.55, comprobante: '00009872' }),
    c('Santander|Visa|3327', '2026-10-01', { descripcion: 'Super', es_cuota: false, monto_pesos: 5000 }),
    c('Santander|Visa|3327', '2026-10-01', { descripcion: 'Pago', es_pago: true, cuota_actual: 1, total_cuotas: 3, monto_pesos: -100 }),
    c('Santander|Visa|3327', '2026-10-01', { descripcion: 'Una', cuota_actual: 1, total_cuotas: 1, monto_pesos: 100 }),
    c('Santander|Visa|3327', '2026-09-01', { descripcion: 'CicloViejo', cuota_actual: 2, total_cuotas: 3, monto_pesos: 100 }),
    c('Macro|Visa|1111', '2026-09-25', { descripcion: 'Notebook', cuota_actual: 2, total_cuotas: 6, monto_pesos: 90000 }),
    c('Galicia|Visa|4410', '2026-09-04', { descripcion: 'Conciliado', cuota_actual: 2, total_cuotas: 3, monto_pesos: 100 })
  ];
  const obs = observacionesEnCurso({ consumosLive: consumos, ciclosLive: ciclos, tarjetas });

  test('solo cuotas (no pagos ni 1/1) del ciclo vigente y no conciliado', () => {
    assert.deepEqual(obs.map(o => o.referencia_original), ['WWW.FRAVEGA.COM', 'Notebook']);
  });

  test('período = mes de cierre del ciclo, del string', () => {
    const f = obs[0];
    assert.deepEqual([f.anio_resumen, f.mes_resumen], [2026, 10]);
    assert.deepEqual([obs[1].anio_resumen, obs[1].mes_resumen], [2026, 9]);
  });

  test('forma de movimiento: tarjeta de storage o live:<grupoKey>', () => {
    assert.equal(obs[0].tarjeta, 'VISA Santander');
    assert.equal(obs[0].origen, 'en_curso');
    assert.equal(obs[0].comprobante, '00009872');
    assert.equal(obs[0].cuota_texto, '14/18');
    assert.equal(obs[1].tarjeta, 'live:Macro|Visa|1111');
    assert.equal(obs[1].tarjeta_label, 'Macro Visa');
  });
});

describe('construirPlanes con observaciones en curso', () => {
  const AGO = { ...resumen('VISA Santander', 2026, 8), fecha_cierre: '2026-08-28' };
  const SEP = { ...resumen('VISA Santander', 2026, 9), fecha_cierre: '2026-09-25' };
  const enCurso = (ref, cuota, pesos, extra = {}) => {
    const [a, t] = cuota.split('/').map(Number);
    return { id: `live:${ref}-${cuota}-${extra.n || ''}`, origen: 'en_curso', tarjeta: 'VISA Santander', referencia_original: ref, fecha_compra: '2026-09-10', es_cuota: true, cuota_actual: a, total_cuotas: t, cuota_texto: cuota, monto_pesos: pesos, monto_dolares: 0, comprobante: null, anio_resumen: 2026, mes_resumen: 10, ...extra };
  };
  const fravega = { ...mov(SEP, 'Fravega', '13/18', 44166.55), referencia_original: 'WWW.FRAVEGA.COM-SANT' };
  const base = [mov(AGO, 'Fravega', '12/18', 44166.55), fravega, mov(SEP, 'Heladera', '03/06', 30000)];

  test('plan 13/18 + observación 14/18 → 14/18 en curso y la proyección se corre un mes', () => {
    const antes = construirPlanes(base, [AGO, SEP]);
    const planes = construirPlanes(base, [AGO, SEP], [], { enCurso: [enCurso('WWW.FRAVEGA.COM', '14/18', 44166.55)] });
    const f = planes.find(p => p.referencia_limpia === 'Fravega');
    assert.deepEqual([f.cuota_actual, f.periodo_anio, f.periodo_mes, f.origen], [14, 2026, 10, 'en_curso']);
    assert.equal(f.referencia_original, 'WWW.FRAVEGA.COM-SANT', 'mantiene la referencia del resumen');
    assert.equal(f.estado, 'vigente');
    assert.equal(f.interrumpida, false);
    // Misma cuota en el mismo mes: el plan es uno solo, ahora anclado en octubre.
    const proyAntes = proyectarCuotas(antes, { meses: 2, resumenes: [AGO, SEP] });
    const proy = proyectarCuotas(planes, { meses: 2, resumenes: [AGO, SEP] });
    const cuotaFravega = (pr, i) => pr[i].detalles.find(d => d.descripcion === 'Fravega');
    assert.equal(cuotaFravega(proyAntes, 0).cuota_numero, 14);
    assert.equal(cuotaFravega(proy, 0), undefined, 'octubre ya está observado: se proyecta desde noviembre');
    assert.equal(cuotaFravega(proy, 1).cuota_numero, 15);
    assert.equal(planes.length, antes.length);
  });

  test('observación 1/9 sin plan → plan nuevo', () => {
    const planes = construirPlanes(base, [AGO, SEP], [], { enCurso: [enCurso('SODIMAC', '01/09', 12000)] });
    const s = planes.find(p => p.referencia_original === 'SODIMAC');
    assert.deepEqual([s.cuota_actual, s.total_cuotas, s.origen, s.periodo_mes], [1, 9, 'en_curso', 10]);
    assert.equal(planes.length, construirPlanes(base, [AGO, SEP]).length + 1);
  });

  test('observación 5/24 que no empareja en tarjeta con resúmenes → sinEmparejar, sin plan nuevo', () => {
    const planes = construirPlanes(base, [AGO, SEP], [], { enCurso: [enCurso('RARO', '05/24', 7000)] });
    assert.equal(planes.find(p => p.referencia_original === 'RARO'), undefined);
    assert.deepEqual(sinEmparejarDe(planes).map(o => o.referencia_original), ['RARO']);
    assert.deepEqual(sinEmparejarDe(construirPlanes(base, [AGO, SEP])), []);
  });

  test('empareja por comprobante aunque el monto cambie', () => {
    const conComp = [{ ...fravega, comprobante: '009872' }];
    const planes = construirPlanes(conComp, [SEP], [], { enCurso: [enCurso('Otra cosa', '14/18', 50000, { comprobante: '00009872' })] });
    assert.equal(planes.length, 1);
    assert.equal(planes[0].cuota_actual, 14);
  });

  test('un plan renombrado por una regla igual empareja (nunca por nombre)', () => {
    const renombrado = { ...fravega, referencia_limpia: 'Lavarropas del living' };
    const planes = construirPlanes([renombrado], [SEP], [], { enCurso: [enCurso('WWW.FRAVEGA.COM', '14/18', 44200)] });
    assert.equal(planes.length, 1);
    assert.equal(planes[0].cuota_actual, 14);
    assert.equal(planes[0].referencia_limpia, 'Lavarropas del living');
  });

  test('un plan que no aparece en Últimos consumos NO pasa a interrumpido', () => {
    const planes = construirPlanes(base, [AGO, SEP], [], { enCurso: [enCurso('WWW.FRAVEGA.COM', '14/18', 44166.55)] });
    const h = planes.find(p => p.referencia_limpia === 'Heladera');
    assert.equal(h.interrumpida, false);
    assert.equal(h.estado, 'vigente');
    assert.equal(h.periodo_mes, 9);
  });

  test('mismo período que el resumen (ciclo ya facturado) → gana el resumen, sin duplicado', () => {
    const sep = enCurso('WWW.FRAVEGA.COM', '13/18', 44166.55, { mes_resumen: 9 });
    const nueva = enCurso('NUEVA', '01/03', 1000, { mes_resumen: 9 });
    const planes = construirPlanes(base, [AGO, SEP], [], { enCurso: [sep, nueva] });
    assert.deepEqual(planes, construirPlanes(base, [AGO, SEP]));
    assert.deepEqual(sinEmparejarDe(planes).map(o => o.referencia_original), ['NUEVA']);
  });

  test('dos observaciones idénticas 4/6 → avanzan los 2 planes; una sola → avanza uno', () => {
    const dosSep = [
      { ...mov(SEP, 'Zapas', '03/06', 20000), id: 'a', fecha_compra: '2026-07-01' },
      { ...mov(SEP, 'Zapas', '03/06', 20000), id: 'b', fecha_compra: '2026-07-01' }
    ];
    const dos = construirPlanes(dosSep, [SEP], [], { enCurso: [enCurso('ZAPAS', '04/06', 20000, { n: 1 }), enCurso('ZAPAS', '04/06', 20000, { n: 2 })] });
    assert.deepEqual(dos.map(p => p.cuota_actual), [4, 4]);
    const uno = construirPlanes(dosSep, [SEP], [], { enCurso: [enCurso('ZAPAS', '04/06', 20000)] });
    assert.deepEqual(uno.map(p => [p.cuota_actual, p.periodo_mes]).sort(), [[3, 9], [4, 10]]);
    assert.ok(uno.every(p => !p.interrumpida));
  });

  test('cuota en USD empareja por monto_dolares', () => {
    const usd = mov(SEP, 'Steam', '02/03', 0, 10);
    const planes = construirPlanes([usd], [SEP], [], { enCurso: [enCurso('STEAM', '03/03', 0, { monto_dolares: 10.005 })] });
    assert.equal(planes.length, 1);
    assert.deepEqual([planes[0].cuota_actual, planes[0].estado], [3, 'ultima_cuota']);
    // Un monto en pesos no empareja con un plan en dólares.
    const p2 = construirPlanes([usd], [SEP], [], { enCurso: [enCurso('STEAM', '03/03', 10)] });
    assert.equal(p2[0].cuota_actual, 2);
  });

  test('tarjeta sin resúmenes (Macro): sus planes salen de Últimos consumos con tarjeta live:<grupoKey>', () => {
    const macro = { ...enCurso('NOTEBOOK', '02/06', 90000), tarjeta: 'live:Macro|Visa|1111', mes_resumen: 9 };
    const planes = construirPlanes(base, [AGO, SEP], [], { enCurso: [macro] });
    const n = planes.find(p => p.tarjeta === 'live:Macro|Visa|1111');
    assert.deepEqual([n.cuota_actual, n.origen, n.estado, n.interrumpida], [2, 'en_curso', 'vigente', false]);
    assert.equal(proyectarCuotas([n], { meses: 1, ancla: new Date(2026, 8, 1) })[0].detalles[0].cuota_numero, 3);
  });

  test('sin enCurso, la salida es la de siempre', () => {
    assert.deepEqual(construirPlanes(base, [AGO, SEP], [], { enCurso: [] }), construirPlanes(base, [AGO, SEP]));
  });
});
