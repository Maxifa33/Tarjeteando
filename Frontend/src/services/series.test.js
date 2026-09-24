/**
 * Tests de series de gastos (IDs hash, cadenas, overrides y preguntas).
 * Corren con `npm test` (node:test, sin dependencias).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import {
  sha256, asignarIds, claveComercio, regexDeClave,
  construirCadenas, aplicarOverrides, resumenFijos, preguntasPendientes
} from './series.js';

const aquí = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(aquí, '../../..');
const PDF_DIR = path.join(RAIZ, 'Backend/tests/fixtures/pdfs');

// ───────────── helpers ─────────────
const resumen = (tarjeta, anio, mes) => ({ id: `${tarjeta}-${anio}-${mes}`, tarjeta, anio, mes });
const cargo = (r, original, pesos, extra = {}) => ({
  resumen_id: r.id, tarjeta: r.tarjeta, fecha_compra: `${r.anio}-${String(r.mes).padStart(2, '0')}-05`,
  referencia_original: original, referencia_limpia: extra.limpia || original,
  monto_pesos: extra.usd ? 0 : pesos, monto_dolares: extra.usd ? pesos : 0, cuota_texto: extra.cuota || null
});
/** Arma movimientos con IDs hash reales, resumen por resumen. */
const conIds = (movs) => {
  const porRes = {};
  movs.forEach(m => (porRes[m.resumen_id] = porRes[m.resumen_id] || []).push(m));
  return Object.entries(porRes).flatMap(([id, ms]) => asignarIds(ms, id));
};
const meses = (tarjeta, desde, n) => Array.from({ length: n }, (_, i) => {
  const idx = desde[0] * 12 + desde[1] - 1 + i;
  return resumen(tarjeta, Math.floor(idx / 12), (idx % 12) + 1);
});
const clasificar = (movs, res, overrides = [], decisiones = []) => {
  const series = construirCadenas(movs, res, decisiones);
  const { tipos, fijos } = aplicarOverrides(movs, series, overrides);
  return { series, tipos, fijos, resumen: resumenFijos(series, tipos) };
};

// ───────────── 1. SHA-256 e IDs ─────────────
describe('SHA-256 e ID de movimiento', () => {
  test('vectores oficiales de SHA-256', () => {
    assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    assert.equal(sha256('ñandú'), sha256('ñandú')); // UTF-8 estable
  });

  test('el ID es la huella del contenido: mismo resumen => mismo ID aunque se re-suba', () => {
    const r = resumen('VISA', 2026, 5);
    const a = asignarIds([cargo(r, 'NETFLIX.COM X1', 100), cargo(r, 'COTO', 200)], r.id);
    const b = asignarIds([cargo(r, 'NETFLIX.COM X1', 100), cargo(r, 'COTO', 200)], r.id);
    assert.deepEqual(a.map(m => m.id), b.map(m => m.id));
    assert.match(a[0].id, /^mv_[0-9a-f]{24}$/);
  });

  test('no depende de la posición: reordenar no cambia los IDs', () => {
    const r = resumen('VISA', 2026, 5);
    const a = asignarIds([cargo(r, 'A', 1), cargo(r, 'B', 2)], r.id);
    const b = asignarIds([cargo(r, 'B', 2), cargo(r, 'A', 1)], r.id);
    assert.equal(a[0].id, b[1].id);
    assert.equal(a[1].id, b[0].id);
  });

  test('dos compras idénticas el mismo día tienen IDs distintos', () => {
    const r = resumen('VISA', 2026, 5);
    const ids = asignarIds([cargo(r, 'CAFE', 500), cargo(r, 'CAFE', 500)], r.id).map(m => m.id);
    assert.notEqual(ids[0], ids[1]);
  });
});

// ───────────── 2. Clave de comercio ─────────────
describe('claveComercio', () => {
  test('saca los códigos de factura que cambian cada mes (descripciones reales)', () => {
    const iguales = (lista) => assert.equal(new Set(lista.map(claveComercio)).size, 1, lista.join(' / '));
    iguales(['APPLE.COM/BILL MVGLV3QHY', 'APPLE.COM/BILL MVGLVQVK1', 'APPLE.COM/BILL', 'APPLE.COM BILL MVGLWX54T', 'APPLE.COM/BILL MSHNNHTFW']);
    iguales(['NETFLIX.COM', 'NETFLIX.COM WP12Mk9MM', 'NETFLIX.COM Rcmc3nfZQ', 'NETFLIX.COM PjfnJpPPQ', 'NETFLIX.COM DARXGqAHW']);
    iguales(['CLAUDE.AI SUBSCR in1T6yEzB', 'CLAUDE.AI SUBSCR in1TID1zB', 'CLAUDE.AI SUBSCR in1SaLLOB']);
    assert.equal(claveComercio('ZURICH INTERNA0000003393731- -'), 'zurich');
  });

  test('no junta comercios distintos', () => {
    assert.notEqual(claveComercio('PERSONAL'), claveComercio('PERSONAL FLOW'));
    assert.notEqual(claveComercio('C A INDEPENDIENT'), claveComercio('HAVANNA INDEPENDENCIA'));
  });

  test('regexDeClave matchea las variantes en el backend', () => {
    const re = new RegExp(regexDeClave(claveComercio('APPLE.COM/BILL MVGLV3QHY')), 'i');
    assert.ok(re.test('APPLE.COM BILL MVGLWX54T'));
    assert.ok(re.test('APPLE.COM/BILL'));
  });
});

// ───────────── 3. Cadenas ─────────────
describe('Cadenas de suscripción', () => {
  const res = meses('VISA', [2026, 1], 5);

  test('cada eslabón apunta al anterior y comparten serie', () => {
    const movs = conIds(res.map((r, i) => cargo(r, `NETFLIX.COM C${i}X9Z`, 10, { usd: true })));
    const { series } = clasificar(movs, res);
    const netflix = series.cadenas.find(c => c.clave === 'netflix com');
    assert.equal(netflix.eslabones.length, 5);
    netflix.eslabones.forEach((e, i) => {
      const info = series.porMovimiento[e.mov_id];
      assert.equal(info.serie_id, netflix.id);
      assert.equal(info.prev_id, i ? netflix.eslabones[i - 1].mov_id : null);
    });
  });

  test('la inflación no corta la cadena: ±25% contra el mes ANTERIOR', () => {
    const montos = [10000, 11500, 13200, 15000, 17100]; // +14% por mes, +71% acumulado
    const movs = conIds(res.map((r, i) => cargo(r, 'SWISS MEDICAL', montos[i])));
    const { series, resumen: r } = clasificar(movs, res);
    assert.equal(series.cadenas.length, 1);
    assert.equal(r.items.length, 1);
  });

  test('renombrar NO cambia el tipo (el bug original)', () => {
    const base = res.map((r, i) => cargo(r, `NETFLIX.COM C${i}X9Z`, 10, { usd: true, limpia: 'Netflix' }));
    const antes = clasificar(conIds(base), res);
    const renombrado = base.map((m, i) => i === 4 ? { ...m, referencia_limpia: 'Netflix Premium' } : m);
    const despues = clasificar(conIds(renombrado), res);
    assert.equal(antes.fijos.size, 5);
    assert.equal(despues.fijos.size, 5);
  });

  test('comercio mixto: la suscripción de Apple es fija, las compras sueltas no', () => {
    const sueltas = [2.99, 19.99, 7.49, 12.99, 0.99];
    const movs = conIds(res.flatMap((r, i) => [
      cargo(r, `APPLE.COM/BILL S${i}9AB`, 4.99, { usd: true }),
      cargo(r, `APPLE.COM/BILL Q${i}7CD`, sueltas[i], { usd: true })
    ]));
    const { tipos, resumen: r } = clasificar(movs, res);
    const fijos = movs.filter(m => tipos[m.id].tipo === 'fijo');
    assert.equal(fijos.length, 5);
    assert.ok(fijos.every(m => m.monto_dolares === 4.99));
    assert.equal(r.items.length, 1);
  });

  test('rubros de consumo (combustible, apps de viaje) no son fijos por parecerse', () => {
    const montos = [20300, 20010, 21000, 20500, 20800];
    const movs = conIds(res.map((r, i) => cargo(r, 'MERPAGO*APPYPFCOMB', montos[i])));
    assert.equal(clasificar(movs, res).fijos.size, 0);
  });

  test('las cuotas nunca entran en una cadena', () => {
    const movs = conIds(res.map((r, i) => cargo(r, 'EASY', 1000, { cuota: `0${i + 1}/06` })));
    const { series } = clasificar(movs, res);
    assert.equal(series.cadenas.length, 0);
  });
});

// ───────────── 4. Cambio manual del tipo ─────────────
describe('Cambio manual (override)', () => {
  const res = meses('VISA', [2026, 1], 5);
  const movs = conIds(res.map((r, i) => cargo(r, 'GIMNASIO SPORTCLUB', [15000, 9000, 22000, 12000, 30000][i])));
  const periodo = m => `${res.find(r => r.id === m.resumen_id).anio}-${String(res.find(r => r.id === m.resumen_id).mes).padStart(2, '0')}`;

  test('sin override, montos erráticos => variable', () => {
    assert.equal(clasificar(movs, res).fijos.size, 0);
  });

  test('marcar Fijo en marzo vale de marzo en adelante, no para atrás', () => {
    // Las cadenas se arman por parecido: acá cada cargo es su propia cadena salvo
    // los que caen en ±25%. Se marca un cargo suelto: afecta a ese movimiento.
    const m = movs[2];
    const { tipos } = clasificar(movs, res, [{ mov_id: m.id, tipo: 'fijo', desde: periodo(m), creado: '1' }]);
    assert.equal(tipos[m.id].tipo, 'fijo');
    assert.equal(tipos[m.id].origen, 'manual');
    assert.equal(tipos[movs[0].id].tipo, 'variable');
  });

  test('en una cadena, el override se propaga a los meses siguientes y no a los previos', () => {
    // ene-mar una cadena que se corta; abr-may otra (salto de +90%): ambas variables.
    const suave = conIds(res.map((r, i) => cargo(r, 'ESCUELA DE INGLES', [30000, 31000, 32000, 60000, 61000][i])));
    assert.equal(clasificar(suave, res).fijos.size, 0);

    const soloMayo = clasificar(suave, res, [{ mov_id: suave[4].id, tipo: 'fijo', desde: '2026-05', creado: '1' }]).tipos;
    assert.equal(soloMayo[suave[3].id].tipo, 'variable', 'abril (misma cadena, antes) no cambia');
    assert.equal(soloMayo[suave[4].id].tipo, 'fijo');

    const desdeAbril = clasificar(suave, res, [{ mov_id: suave[3].id, tipo: 'fijo', desde: '2026-04', creado: '1' }]).tipos;
    assert.equal(desdeAbril[suave[2].id].tipo, 'variable', 'marzo es otra cadena');
    assert.equal(desdeAbril[suave[3].id].tipo, 'fijo');
    assert.equal(desdeAbril[suave[4].id].tipo, 'fijo', 'mayo hereda por la cadena');
  });

  test('volver a un resumen anterior y marcar desde ahí extiende el cambio', () => {
    const suave = conIds(res.map((r, i) => cargo(r, 'ESCUELA DE INGLES', [60000, 61000, 60500, 61000, 62000][i])));
    const overrides = [
      { mov_id: suave[3].id, tipo: 'variable', desde: '2026-04', creado: '1' },
      { mov_id: suave[1].id, tipo: 'variable', desde: '2026-02', creado: '2' }
    ];
    const { tipos } = clasificar(suave, res, overrides);
    assert.equal(tipos[suave[0].id].tipo, 'fijo', 'enero sigue automático (fijo)');
    [1, 2, 3, 4].forEach(i => assert.equal(tipos[suave[i].id].tipo, 'variable'));
  });

  test('un fijo manual con 1 solo mes suma al total de fijos', () => {
    const nuevo = conIds([cargo(res[4], 'SPOTIFY P1234ZZ', 5000)]);
    const { resumen: r } = clasificar(nuevo, res, [{ mov_id: nuevo[0].id, tipo: 'fijo', desde: '2026-05', creado: '1' }]);
    assert.equal(r.ars, 5000);
  });
});

// ───────────── 5. Preguntas post-importación ─────────────
describe('Preguntas cuando falta un fijo', () => {
  const res = meses('VISA', [2026, 1], 5);

  test('aumento fuerte => pregunta "¿es el mismo?" y al confirmar se re-engancha', () => {
    const montos = [10, 10, 10, 10, 25];
    const movs = conIds(res.map((r, i) => cargo(r, `NETFLIX.COM C${i}X9Z`, montos[i], { usd: true })));
    const a = clasificar(movs, res);
    const preguntas = preguntasPendientes(a.series, a.tipos, res, []);
    assert.equal(preguntas.length, 1);
    assert.equal(preguntas[0].tipo, 'cambio_monto');
    assert.equal(preguntas[0].candidato.monto, 25);

    const decisiones = [{ tipo: 'enlace', mov_id: preguntas[0].candidato.mov_id, prev_id: preguntas[0].ultimo.mov_id, periodo: preguntas[0].periodo }];
    const b = clasificar(movs, res, [], decisiones);
    assert.equal(b.fijos.size, 5);
    assert.equal(preguntasPendientes(b.series, b.tipos, res, decisiones).length, 0);
  });

  test('falta sin candidato => pregunta "¿lo diste de baja?"', () => {
    const movs = conIds(res.slice(0, 4).map((r, i) => cargo(r, `NETFLIX.COM C${i}X9Z`, 10, { usd: true })));
    const a = clasificar(movs, res);
    const [p] = preguntasPendientes(a.series, a.tipos, res, []);
    assert.equal(p.tipo, 'faltante');

    // "Sí, lo di de baja" => sale de fijos, no se pregunta más
    const baja = [{ tipo: 'baja', mov_id: p.ultimo.mov_id, periodo: p.periodo }];
    const b = clasificar(movs, res, [], baja);
    assert.equal(b.resumen.items.length, 0);
    assert.equal(preguntasPendientes(b.series, b.tipos, res, baja).length, 0);

    // "No, sigue" => sigue fijo, no se pregunta más por ese resumen
    const sigue = [{ tipo: 'sigue', mov_id: p.ultimo.mov_id, periodo: p.periodo }];
    const c = clasificar(movs, res, [], sigue);
    assert.equal(c.resumen.items.length, 1);
    assert.equal(preguntasPendientes(c.series, c.tipos, res, sigue).length, 0);
  });

  test('si nadie responde y falta 2 veces sin candidato, la app decide sola (finalizado)', () => {
    const movs = conIds(res.slice(0, 3).map((r, i) => cargo(r, `NETFLIX.COM C${i}X9Z`, 10, { usd: true })));
    const a = clasificar(movs, res);
    assert.equal(a.resumen.items.length, 0);
    assert.equal(preguntasPendientes(a.series, a.tipos, res, []).length, 0);
  });

  test('"omitida" no vuelve a preguntar por ese resumen', () => {
    const movs = conIds(res.slice(0, 4).map((r, i) => cargo(r, `NETFLIX.COM C${i}X9Z`, 10, { usd: true })));
    const a = clasificar(movs, res);
    const [p] = preguntasPendientes(a.series, a.tipos, res, []);
    const dec = [{ tipo: 'omitida', mov_id: p.ultimo.mov_id, periodo: p.periodo }];
    assert.equal(preguntasPendientes(a.series, a.tipos, res, dec).length, 0);
  });
});

// ───────────── 6. Regresión con los PDFs reales ─────────────
const HAY_PDFS = fs.existsSync(PDF_DIR) && fs.readdirSync(PDF_DIR).some(f => f.endsWith('.pdf'));

describe('Gastos fijos sobre las fixtures reales', { skip: !HAY_PDFS && 'faltan las fixtures de PDFs' }, () => {
  const require = createRequire(import.meta.url);
  const PDFParserService = require(path.join(RAIZ, 'Backend/src/services/pdf-parser.service.js'));
  let cache = null;
  const parsearTodo = async () => {
    if (cache) return cache;
    const log = console.log, err = console.error;
    console.log = () => {}; console.error = () => {};
    try {
      const movimientos = [], resumenes = [];
      for (const archivo of fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf')).sort()) {
        let r;
        try { r = await new PDFParserService().parsearPDF(fs.readFileSync(path.join(PDF_DIR, archivo)), archivo); } catch { continue; }
        if (!r?.exito) continue;
        const id = `${r.tarjeta}-${r.resumen.anio}-${r.resumen.mes}`;
        if (resumenes.some(x => x.id === id)) continue; // mismo período subido dos veces
        resumenes.push({ id, tarjeta: r.tarjeta, anio: r.resumen.anio, mes: r.resumen.mes });
        asignarIds(r.movimientos.map(m => ({ ...m, tarjeta: r.tarjeta, resumen_id: id })), id)
          .forEach(m => movimientos.push(m));
      }
      return (cache = { movimientos, resumenes });
    } finally { console.log = log; console.error = err; }
  };

  test('IDs únicos para todos los movimientos', async () => {
    const { movimientos } = await parsearTodo();
    assert.equal(new Set(movimientos.map(m => m.id)).size, movimientos.length);
  });

  test('detecta los fijos conocidos y ninguno de consumo', async () => {
    const { movimientos, resumenes } = await parsearTodo();
    const { resumen: r } = clasificar(movimientos, resumenes);
    const nombres = r.items.map(i => `${i.nombre} ${i.moneda}`.toLowerCase());
    for (const esperado of ['zurich', 'federacion patronal', 'personal ars', 'swiss medical', 'claude', 'netflix', 'apple']) {
      assert.ok(nombres.some(n => n.includes(esperado)), `falta ${esperado}: ${nombres.join(', ')}`);
    }
    for (const prohibido of ['ypf', 'didi', 'rappi', 'coto']) {
      assert.ok(!nombres.some(n => n.includes(prohibido)), `falso fijo ${prohibido}`);
    }
  });

  test('Club Independiente (pasó de $32.000 a $68.000) genera la pregunta de aumento', async () => {
    const { movimientos, resumenes } = await parsearTodo();
    const a = clasificar(movimientos, resumenes);
    const preguntas = preguntasPendientes(a.series, a.tipos, resumenes, []);
    const club = preguntas.find(p => /independiente/i.test(p.nombre));
    assert.ok(club, 'debería preguntar por Club Independiente');
    assert.equal(club.tipo, 'cambio_monto');

    const dec = [{ tipo: 'enlace', mov_id: club.candidato.mov_id, prev_id: club.ultimo.mov_id, periodo: club.periodo }];
    const b = clasificar(movimientos, resumenes, [], dec);
    assert.ok(b.resumen.items.some(i => /independiente/i.test(i.nombre)), 'al confirmar vuelve a fijos');
  });
});
