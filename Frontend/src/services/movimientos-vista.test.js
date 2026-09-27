/**
 * Tests de services/movimientos-vista.js — `npm test`.
 * Los primeros comparan contra una copia literal del filtro de la vista vieja
 * (App.jsx, MovimientosView hasta la fase 3).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  filtrarMovimientos, mesesDisponibles, ordenarResumenes, agruparPorDia, separarCuotas,
  composicionPeriodo, historialComercio, tipoDeFila, planDeMovimiento, labelDia, mesKeyDeFecha
} from './movimientos-vista.js';

// ---- Copia de la lógica vieja (sin filtros de fecha/banco, que ya no están en la UI) ----
function filtroViejo(movimientos, { modoFiltro, mesSeleccionado, resumenSeleccionado, searchQuery = '', filtroTarjeta = '', filtroMoneda = '', filtroCuotas = '', filtroTipoGasto = '', gastosFijos = new Set() }) {
  const esGastoFijo = (m) => gastosFijos.size > 0 && !!m.id && gastosFijos.has(m.id);
  return movimientos.filter(m => {
    if (modoFiltro === 'resumen') {
      if (resumenSeleccionado && m.resumen_id !== resumenSeleccionado) return false;
    } else if (mesSeleccionado) {
      if (mesKeyDeFecha(m.fecha_compra) !== mesSeleccionado) return false;
    }
    if (searchQuery &&
        !m.referencia_limpia?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.referencia_original?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filtroTarjeta && m.tarjeta !== filtroTarjeta) return false;
    if (filtroMoneda === 'USD' && !(m.monto_dolares > 0)) return false;
    if (filtroCuotas === 'si' && !m.cuota_texto) return false;
    if (filtroTipoGasto === 'fijo' && !esGastoFijo(m)) return false;
    return true;
  });
}

const resumenes = [
  { id: 'S-8', tarjeta: 'VISA Santander', anio: 2026, mes: 8, fecha_cierre: '2026-08-28' },
  { id: 'S-9', tarjeta: 'VISA Santander', anio: 2026, mes: 9, fecha_cierre: '2026-09-25' },
  { id: 'G-8', tarjeta: 'VISA Galicia', anio: 2026, mes: 8 },
  { id: 'S-7', tarjeta: 'VISA Santander', anio: 2026, mes: 7, fecha_cierre: '2026-07-30' }
];
const mov = (id, resumen_id, tarjeta, fecha, ref, pesos, extra = {}) => ({
  id, resumen_id, tarjeta, fecha_compra: fecha, referencia_original: ref.toUpperCase() + ' 123', referencia_limpia: ref, monto_pesos: pesos, monto_dolares: 0, ...extra
});
const movs = [
  mov('a', 'S-9', 'VISA Santander', '2026-09-01', 'Coto', 86420.15),
  mov('b', 'S-9', 'VISA Santander', '2026-09-25', 'Netflix', 11999),
  mov('c', 'S-9', 'VISA Santander', '2026-08-30', 'Fravega', 45000, { cuota_texto: '03/06' }),
  mov('d', 'S-9', 'VISA Santander', '2026-09-12', 'Amazon', 0, { monto_dolares: 41.14 }),
  mov('e', 'S-9', 'VISA Santander', '2026-09-25', 'Reintegro Coto', -8642),
  mov('f', 'S-8', 'VISA Santander', '2026-08-02', 'Netflix', 11999),
  mov('g', 'G-8', 'VISA Galicia', '2026-08-15', 'Jumbo', 64310.75),
  mov('h', 'S-7', 'VISA Santander', '2026-07-05', 'Netflix', 10999),
  mov('i', 'S-9', 'VISA Santander', null, 'Sin fecha', 100)
];
const fijos = new Set(['b', 'f', 'h']);

describe('mismos resultados que la vista vieja', () => {
  const casos = [
    ['mes por defecto', { modoFiltro: 'mes', mesSeleccionado: mesesDisponibles(movs)[0] }, { modo: 'mes', periodo: mesesDisponibles(movs)[0] }],
    ['mes anterior', { modoFiltro: 'mes', mesSeleccionado: '2026-08' }, { modo: 'mes', periodo: '2026-08' }],
    ['resumen por defecto', { modoFiltro: 'resumen', resumenSeleccionado: ordenarResumenes(resumenes)[0].id }, { modo: 'resumen', resumenId: ordenarResumenes(resumenes)[0].id }],
    ['resumen + búsqueda por nombre limpio', { modoFiltro: 'resumen', resumenSeleccionado: 'S-9', searchQuery: 'netf' }, { modo: 'resumen', resumenId: 'S-9', texto: 'netf' }],
    ['búsqueda por descripción original', { modoFiltro: 'mes', mesSeleccionado: '2026-09', searchQuery: 'COTO 1' }, { modo: 'mes', periodo: '2026-09', texto: 'COTO 1' }],
    ['tarjeta', { modoFiltro: 'mes', mesSeleccionado: '2026-08', filtroTarjeta: 'VISA Galicia' }, { modo: 'mes', periodo: '2026-08', tarjeta: 'VISA Galicia' }],
    ['USD', { modoFiltro: 'resumen', resumenSeleccionado: 'S-9', filtroMoneda: 'USD' }, { modo: 'resumen', resumenId: 'S-9', tipo: 'usd' }],
    ['cuotas', { modoFiltro: 'resumen', resumenSeleccionado: 'S-9', filtroCuotas: 'si' }, { modo: 'resumen', resumenId: 'S-9', tipo: 'cuotas' }],
    ['fijos', { modoFiltro: 'mes', mesSeleccionado: '2026-08', filtroTipoGasto: 'fijo', gastosFijos: fijos }, { modo: 'mes', periodo: '2026-08', tipo: 'fijos', fijos }]
  ];
  for (const [nombre, viejo, nuevo] of casos) {
    test(nombre, () => {
      assert.deepEqual(filtrarMovimientos(movs, nuevo).map((m) => m.id), filtroViejo(movs, viejo).map((m) => m.id));
    });
  }

  test('meses y resúmenes ordenados como antes (el más reciente primero)', () => {
    assert.deepEqual(mesesDisponibles(movs), ['2026-09', '2026-08', '2026-07']);
    assert.deepEqual(ordenarResumenes(resumenes).map((r) => r.id), ['S-9', 'S-8', 'G-8', 'S-7']);
  });
});

describe('filtros nuevos', () => {
  test('Variables excluye fijos, cuotas y reintegros', () => {
    const ids = filtrarMovimientos(movs, { modo: 'resumen', resumenId: 'S-9', tipo: 'variables', fijos }).map((m) => m.id);
    assert.deepEqual(ids, ['a', 'd', 'i']);
  });

  test('Reintegros = los mismos que ReintegrosView (recientes; anteriores a pedido)', () => {
    const reintegros = [
      { ...movs[4], es_reciente: true },
      { ...mov('z', 'S-7', 'VISA Santander', '2026-07-02', 'Devolución Easy', -500), es_reciente: false }
    ];
    assert.deepEqual(filtrarMovimientos(movs, { tipo: 'reintegros', reintegros }).map((m) => m.id), ['e']);
    assert.deepEqual(filtrarMovimientos(movs, { tipo: 'reintegros', reintegros, verAnteriores: true }).map((m) => m.id), ['e', 'z']);
    // ReintegrosView también buscaba por tarjeta
    assert.equal(filtrarMovimientos(movs, { tipo: 'reintegros', reintegros, verAnteriores: true, texto: 'santander' }).length, 2);
  });

  test('tipo de fila: reintegro > cuota > fijo > variable', () => {
    assert.equal(tipoDeFila(movs[4], fijos), 'reintegro');
    assert.equal(tipoDeFila(movs[2], fijos), 'cuota');
    assert.equal(tipoDeFila(movs[1], fijos), 'fijo');
    assert.equal(tipoDeFila(movs[0], fijos), 'variable');
  });
});

describe('agruparPorDia', () => {
  test('fecha local, sin corrimiento UTC; más reciente primero; Sin fecha al final', () => {
    const g = agruparPorDia(filtrarMovimientos(movs, { modo: 'resumen', resumenId: 'S-9' }));
    assert.deepEqual(g.map((x) => x.fecha), ['2026-09-25', '2026-09-12', '2026-09-01', '2026-08-30', null]);
    // El 1 de septiembre sigue siendo martes 1, no lunes 31 de agosto.
    assert.equal(g[2].label, 'Martes 1 de septiembre');
    assert.equal(g[4].label, 'Sin fecha');
    assert.equal(g[0].total, 11999 - 8642);
  });

  test('labelDia sale de la fecha local', () => {
    assert.equal(labelDia('2026-09-25'), 'Viernes 25 de septiembre');
  });
});

describe('separarCuotas y composicionPeriodo', () => {
  const periodo = filtrarMovimientos(movs, { modo: 'resumen', resumenId: 'S-9' });
  test('las cuotas se separan', () => {
    const { cuotas, resto } = separarCuotas(periodo);
    assert.deepEqual(cuotas.map((m) => m.id), ['c']);
    assert.equal(resto.length, periodo.length - 1);
  });
  test('composición: variables / fijos / cuotas, total neto con reintegros', () => {
    const c = composicionPeriodo(periodo, fijos);
    assert.equal(c.cuotas, 45000);
    assert.equal(c.fijos, 11999);
    assert.equal(c.variables, 86420.15 + 100);
    assert.equal(c.reintegros, 8642);
    assert.equal(c.total, 86420.15 + 11999 + 45000 - 8642 + 100);
    assert.equal(c.totalUsd, 41.14);
  });
});

describe('historialComercio', () => {
  test('mismo comercio aunque se haya renombrado (clave de comercio), en los resúmenes de su tarjeta', () => {
    const renombrado = movs.map((m) => (m.referencia_limpia === 'Netflix' && m.resumen_id === 'S-7' ? { ...m, referencia_limpia: 'Netflix viejo' } : m));
    const h = historialComercio(renombrado, movs[1], resumenes);
    assert.deepEqual(h.map((x) => [x.resumenId, x.total, x.actual]), [['S-7', 10999, false], ['S-8', 11999, false], ['S-9', 11999, true]]);
  });
});

describe('planDeMovimiento', () => {
  const planes = [{ id: 'p1', tarjeta: 'VISA Santander', descripcion: 'Fravega', total_cuotas: 6, monto_cuota: 45000 }];
  test('encuentra el plan de una cuota', () => {
    assert.equal(planDeMovimiento(movs[2], planes).id, 'p1');
  });
  test('plan que ya no existe: null (se oculta "Ver plan")', () => {
    assert.equal(planDeMovimiento(movs[2], []), null);
    assert.equal(planDeMovimiento(movs[0], planes), null);
  });
});
