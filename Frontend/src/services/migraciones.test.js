/**
 * Migración de localStorage 1.3.0 → 1.4.0 (services/migraciones.js) y un backup
 * exportado con la versión vieja importado en la nueva (storage.js con un
 * localStorage falso). `npm test`.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { migrarA140, migrarPeriodoResumenes, migrarDecisionesPlanes } from './migraciones.js';

const almacenFalso = (inicial = {}) => {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
    clear: () => datos.clear(),
    get length() { return datos.size; },
    key: (i) => [...datos.keys()][i] ?? null,
    _datos: datos
  };
};

describe('migrarA140', () => {
  test('tema viejo → config.apariencia; se borran las keys viejas', () => {
    const a = almacenFalso({
      tarjetas_theme: 'liquid',
      dashboard_card_order: '["live"]',
      tarjetas_config: JSON.stringify({ theme: 'dark', apiKey: 'x', tope_mensual: 900000 })
    });
    const { cambios } = migrarA140(a);
    const cfg = JSON.parse(a.getItem('tarjetas_config'));
    assert.deepEqual(cfg, { apiKey: 'x', tope_mensual: 900000, apariencia: { modo: 'oscuro', reducirTransparencia: false, railIzquierda: false } });
    assert.equal(a.getItem('tarjetas_theme'), null);
    assert.equal(a.getItem('dashboard_card_order'), null);
    assert.ok(cambios.includes('apariencia'));
  });

  test('idempotente: la segunda vez no cambia nada', () => {
    const a = almacenFalso({ tarjetas_theme: 'light' });
    migrarA140(a);
    const antes = a.getItem('tarjetas_config');
    assert.deepEqual(migrarA140(a).cambios, []);
    assert.equal(a.getItem('tarjetas_config'), antes);
    assert.equal(JSON.parse(antes).apariencia.modo, 'claro');
  });

  test('una apariencia ya guardada no se pisa', () => {
    const a = almacenFalso({
      tarjetas_theme: 'liquid',
      tarjetas_config: JSON.stringify({ apariencia: { modo: 'claro', reducirTransparencia: true, railIzquierda: false } })
    });
    migrarA140(a);
    assert.equal(JSON.parse(a.getItem('tarjetas_config')).apariencia.modo, 'claro');
    assert.equal(a.getItem('tarjetas_theme'), null);
  });

  test('usuario nuevo (sin nada): apariencia por defecto', () => {
    const a = almacenFalso();
    migrarA140(a);
    assert.equal(JSON.parse(a.getItem('tarjetas_config')).apariencia.modo, 'sistema');
  });
});

describe('storage.js con un backup de la versión vieja', () => {
  test('se importa sin pérdida y la apariencia sale del tema viejo', async () => {
    const ls = almacenFalso({ tarjetas_version: '1.3.0', tarjetas_theme: 'dark' });
    globalThis.localStorage = ls;
    const { default: storage } = await import('./storage.js');

    // Al cargar, storage migró a 1.4.0.
    assert.equal(ls.getItem('tarjetas_version'), '1.4.0');
    assert.equal(ls.getItem('tarjetas_theme'), null);
    assert.equal(storage.getConfig().apariencia.modo, 'oscuro');

    const backupViejo = {
      version: '1.3.0',
      exportDate: '2026-09-20T12:00:00.000Z',
      data: {
        resumenes: [{ id: 'VISA BBVA-2026-8', tarjeta: 'VISA BBVA', anio: 2026, mes: 8, total_a_pagar_pesos: 300000 }],
        movimientos: [{ resumen_id: 'VISA BBVA-2026-8', tarjeta: 'VISA BBVA', fecha_compra: '2026-08-02', referencia_original: 'NETFLIX', referencia_limpia: 'Netflix', monto_pesos: 11999, monto_dolares: 0 }],
        tarjetas: [{ nombre: 'VISA BBVA', banco: 'BBVA', tipo: 'VISA' }],
        reglas: [{ patron: 'netflix', nombre_limpio: 'Netflix' }],
        consumosLive: [],
        ciclosLive: {},
        aliasUlt4: {},
        plantillasConsumos: {},
        tipoOverrides: [],
        decisionesFijos: [],
        metricasDetector: { correcciones: 1 },
        config: { theme: 'liquid', apiKey: null }
      }
    };
    assert.deepEqual(storage.importAll(backupViejo), { success: true });
    assert.equal(storage.getResumenes().length, 1);
    assert.equal(storage.getMovimientos().length, 1);
    assert.equal(storage.getMovimientos()[0].referencia_limpia, 'Netflix');
    assert.equal(storage.getTarjetas().length, 1);
    assert.equal(storage.getReglas().length, 1);
    assert.equal(storage.getMetricasDetector().correcciones, 1);
    assert.deepEqual(storage.getDecisionesPlanes(), []);
    assert.equal(storage.getConfig().apariencia.modo, 'oscuro', 'config.theme del backup viejo → oscuro');

    // Y un export de la versión nueva trae las keys nuevas.
    const nuevo = storage.exportAll();
    assert.equal(nuevo.version, '1.4.0');
    assert.ok('decisionesPlanes' in nuevo.data);
    assert.ok('apariencia' in nuevo.data.config);
  });
});

describe('migrarPeriodoResumenes (período = mes de cierre, del string)', () => {
  const resumenes = [
    // Cierre del día 1 leído como UTC: quedó en septiembre.
    { id: 'VISA Galicia-2025-9', tarjeta: 'VISA Galicia', anio: 2025, mes: 9, fecha_cierre: '2025-10-01' },
    { id: 'VISA Galicia-2025-8', tarjeta: 'VISA Galicia', anio: 2025, mes: 8, fecha_cierre: '2025-08-28' },
    // Cierre del 1 de enero: corre también el año.
    { id: 'MC-2025-12', tarjeta: 'MC', anio: 2025, mes: 12, fecha_cierre: '2026-01-01' }
  ];
  const movimientos = [
    { id: 'a', resumen_id: 'VISA Galicia-2025-9', anio_resumen: 2025, mes_resumen: 9 },
    { id: 'b', resumen_id: 'VISA Galicia-2025-8', anio_resumen: 2025, mes_resumen: 8 },
    { id: 'c', resumen_id: 'MC-2025-12', anio_resumen: 2025, mes_resumen: 12 }
  ];
  const almacen = () => almacenFalso({
    tarjetas_resumenes: JSON.stringify(resumenes),
    tarjetas_movimientos: JSON.stringify(movimientos)
  });
  const leer = (a, k) => JSON.parse(a.getItem(k));

  test('un cierre del día 1 pasa al mes del cierre; los ids no cambian', () => {
    const a = almacen();
    const { corregidos } = migrarPeriodoResumenes(a);
    assert.deepEqual(corregidos, ['VISA Galicia-2025-9', 'MC-2025-12']);
    const rs = leer(a, 'tarjetas_resumenes');
    assert.deepEqual(rs.map((r) => [r.id, r.anio, r.mes]), [
      ['VISA Galicia-2025-9', 2025, 10], ['VISA Galicia-2025-8', 2025, 8], ['MC-2025-12', 2026, 1]
    ]);
    const ms = leer(a, 'tarjetas_movimientos');
    assert.deepEqual(ms.map((m) => [m.id, m.resumen_id, m.anio_resumen, m.mes_resumen]), [
      ['a', 'VISA Galicia-2025-9', 2025, 10], ['b', 'VISA Galicia-2025-8', 2025, 8], ['c', 'MC-2025-12', 2026, 1]
    ]);
  });

  test('un resumen correcto no cambia', () => {
    const a = almacenFalso({ tarjetas_resumenes: JSON.stringify([resumenes[1]]), tarjetas_movimientos: JSON.stringify([movimientos[1]]) });
    const antes = new Map(a._datos);
    assert.deepEqual(migrarPeriodoResumenes(a).corregidos, []);
    assert.deepEqual(a._datos, antes);
  });

  test('idempotente: la segunda vez no cambia nada', () => {
    const a = almacen();
    migrarPeriodoResumenes(a);
    const despues = new Map(a._datos);
    assert.deepEqual(migrarPeriodoResumenes(a).corregidos, []);
    assert.deepEqual(a._datos, despues);
  });

  test('sin resúmenes o sin fecha_cierre: no hace nada', () => {
    assert.deepEqual(migrarPeriodoResumenes(almacenFalso()).corregidos, []);
    const a = almacenFalso({ tarjetas_resumenes: JSON.stringify([{ id: 'x', anio: 2025, mes: 3 }]) });
    assert.deepEqual(migrarPeriodoResumenes(a).corregidos, []);
  });
});

describe('migrarDecisionesPlanes (clave vieja → clave base #1)', () => {
  const decisiones = [
    { id: 'dp_1', claveDePlan: 'VISA Galicia|easy|3|54', decision: 'terminado', fecha: '2026-09-01' },
    { id: 'dp_2', claveDePlan: 'VISA Galicia|puma|3|53#1', decision: 'vigente', fecha: '2026-09-02' },
    { id: 'dp_3', claveDePlan: 'VISA Galicia|c:8547', decision: 'vigente', fecha: '2026-09-03' }
  ];

  test('agrega la copia con #1 y conserva la original', () => {
    const a = almacenFalso({ tarjetas_decisiones_planes: JSON.stringify(decisiones) });
    assert.equal(migrarDecisionesPlanes(a).migradas, 1);
    const ds = JSON.parse(a.getItem('tarjetas_decisiones_planes'));
    assert.equal(ds.length, 4);
    assert.deepEqual(ds.slice(0, 3), decisiones);
    assert.deepEqual(ds[3], { id: 'dp_1#1', claveDePlan: 'VISA Galicia|easy|3|54#1', decision: 'terminado', fecha: '2026-09-01', migrada_de: 'dp_1' });
  });

  test('idempotente: la segunda vez no cambia nada', () => {
    const a = almacenFalso({ tarjetas_decisiones_planes: JSON.stringify(decisiones) });
    migrarDecisionesPlanes(a);
    const despues = a.getItem('tarjetas_decisiones_planes');
    assert.equal(migrarDecisionesPlanes(a).migradas, 0);
    assert.equal(a.getItem('tarjetas_decisiones_planes'), despues);
  });

  test('sin decisiones: no hace nada', () => {
    assert.equal(migrarDecisionesPlanes(almacenFalso()).migradas, 0);
  });
});
