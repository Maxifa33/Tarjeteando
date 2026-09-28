/**
 * Tests de services/movimientos-vista.js — `npm test`.
 * Los primeros comparan contra una copia literal del filtro de la vista vieja
 * (App.jsx, MovimientosView hasta la fase 3).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  filtrarMovimientos, mesesDisponibles, ordenarResumenes, agruparPorDia, separarCuotas,
  composicionPeriodo, historialComercio, tipoDeFila, planDeMovimiento, labelDia, mesKeyDeFecha,
  movimientosEnCurso, resumenEnCurso, nombreSegunReglas
} from './movimientos-vista.js';
import { cicloDePago } from './mes.js';

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

// ───────────── Fase 7: Últimos consumos dentro de Movimientos ─────────────
describe('movimientosEnCurso', () => {
  const HOY = '2026-09-26';
  const tarjetasEC = [
    { nombre: 'VISA BBVA', banco: 'BBVA', tipo: 'VISA' },
    { nombre: 'VISA Santander', banco: 'Santander', tipo: 'VISA' },
    { nombre: 'VISA Galicia', banco: 'Galicia', tipo: 'VISA' }
  ];
  const resumenesEC = [
    { id: 'B-9', tarjeta: 'VISA BBVA', fecha_cierre: '2026-09-24', fecha_vencimiento: '2026-10-05', total_a_pagar_pesos: 326410, total_consumos_pesos: 300000 },
    { id: 'S-8', tarjeta: 'VISA Santander', fecha_cierre: '2026-08-28', fecha_vencimiento: '2026-09-09', total_a_pagar_pesos: 700000, total_consumos_pesos: 800000 },
    { id: 'G-9', tarjeta: 'VISA Galicia', fecha_cierre: '2026-09-04', fecha_vencimiento: '2026-09-16', total_a_pagar_pesos: 380000 }
  ];
  const ciclo = (grupoKey, banco, red, miembros, cierre, vto) => ({ grupoKey, banco, red, principal: miembros[0], miembros, fecha_cierre: cierre, fecha_vencimiento: vto, estado: 'provisional', actualizado_at: '2026-09-26T22:46:00.000Z' });
  const c = (id, grupo_key, ciclo_cierre, ult4, pesos, extra = {}) => ({ id, grupo_key, ciclo_cierre, tarjeta_ult4: ult4, monto_pesos: pesos, monto_dolares: 0, fecha: '2026-09-20', descripcion: 'COMERCIO ' + id, categoria: 'Otros', ...extra });
  const ciclosEC = {
    'Santander|Visa|3327': ciclo('Santander|Visa|3327', 'Santander', 'Visa', ['3327', '1510'], '2026-10-01', '2026-10-09'),
    'Galicia|Visa|4410': ciclo('Galicia|Visa|4410', 'Galicia', 'Visa', ['4410'], '2026-10-02', '2026-10-14'),
    // Macro: sin resúmenes cargados.
    'Macro|Visa|7788': ciclo('Macro|Visa|7788', 'Macro', 'Visa', ['7788'], '2026-10-05', '2026-10-15'),
    // BBVA: este ciclo ya lo cubre el resumen cerrado del 24/09 (no conciliado todavía).
    'BBVA|Visa|2291': ciclo('BBVA|Visa|2291', 'BBVA', 'Visa', ['2291'], '2026-09-25', '2026-10-05')
  };
  const consumosEC = [
    c('s1', 'Santander|Visa|3327', '2026-10-01', '3327', 739748.66, { descripcion: 'MERPAGO*COTO SUC 45' }),
    c('s2', 'Santander|Visa|3327', '2026-10-01', '3327', 108327.44, { es_cuota: true, cuota_actual: 3, total_cuotas: 6 }),
    c('s3', 'Santander|Visa|3327', '2026-10-01', '1510', 44166.55),
    c('s4', 'Santander|Visa|3327', '2026-10-01', '3327', -8642, { descripcion: 'REINTEGRO COTO' }),
    c('s5', 'Santander|Visa|3327', '2026-10-01', '3327', -500000, { es_pago: true, descripcion: 'SU PAGO' }),
    c('g1', 'Galicia|Visa|4410', '2026-10-02', '4410', 412380.2, { es_pendiente: true }),
    c('m1', 'Macro|Visa|7788', '2026-10-05', '7788', 0, { monto_dolares: 20, descripcion: 'STEAM' }),
    c('m2', 'Macro|Visa|7788', '2026-10-05', '7788', 15000),
    c('b1', 'BBVA|Visa|2291', '2026-09-25', '2291', 72118.4)
  ];
  const reglas = [{ patron: 'coto', nombre_limpio: 'Coto' }];
  const filas = movimientosEnCurso({ consumosLive: consumosEC, ciclosLive: ciclosEC, resumenes: resumenesEC, tarjetas: tarjetasEC, reglas, hoy: HOY });
  const por = (id) => filas.find((f) => f.id === `live:${id}`);

  test('la cabecera separa lo que entra en el pago de Mes (= su en curso) de lo posterior', () => {
    const mes = cicloDePago({ hoy: HOY, tarjetas: tarjetasEC, resumenes: resumenesEC, ciclosLive: ciclosEC, consumosLive: consumosEC });
    const enCursoMes = mes.porTarjeta.filter((t) => t.fuente === 'en_curso').reduce((acc, t) => acc + t.total, 0);
    const grupos = mes.porTarjeta.filter((t) => t.fuente === 'en_curso').flatMap((t) => t.grupoKeys);
    const r = resumenEnCurso(filas, resumenesEC, { gruposDelMes: grupos });
    assert.ok(Math.abs(r.delMes - enCursoMes) < 0.01, `${r.delMes} vs ${enCursoMes}`);
    assert.ok(Math.abs(r.delMes + r.posterior - r.total) < 0.01);
  });

  test('la suma por tarjeta coincide con el en curso de Mes (cicloDePago)', () => {
    const mes = cicloDePago({ hoy: HOY, tarjetas: tarjetasEC, resumenes: resumenesEC, ciclosLive: ciclosEC, consumosLive: consumosEC });
    mes.porTarjeta.filter((t) => t.fuente === 'en_curso').forEach((t) => {
      const suma = filas.filter((f) => f.tarjeta === t.tarjetaId).reduce((acc, f) => acc + f.monto_pesos, 0);
      assert.ok(Math.abs(suma - t.total) < 0.01, `${t.tarjetaId}: ${suma} vs ${t.total}`);
    });
  });

  test('un ciclo que ya cubre un resumen importado no aparece dos veces', () => {
    assert.equal(por('b1'), undefined);
    const mesSep = filtrarMovimientos([{ id: 'x', resumen_id: 'B-9', tarjeta: 'VISA BBVA', fecha_compra: '2026-09-20', referencia_limpia: 'Disco', referencia_original: 'DISCO', monto_pesos: 72118.4 }],
      { modo: 'mes', periodo: '2026-09', enCurso: filas });
    assert.equal(mesSep.filter((m) => m.monto_pesos === 72118.4).length, 1);
  });

  test('tarjeta sin ningún resumen: todos sus consumos (no pagos) aparecen', () => {
    assert.deepEqual(filas.filter((f) => f.grupoKey === 'Macro|Visa|7788').map((f) => f.id), ['live:m1', 'live:m2']);
    assert.equal(por('m1').tarjeta, 'Macro|Visa|7788');
    assert.equal(por('m1').tarjeta_label, 'Macro Visa');
  });

  test('pagos excluidos; negativo = reintegro; cuota con n/t; reglas de nombres', () => {
    assert.equal(por('s5'), undefined);
    assert.equal(tipoDeFila(por('s4')), 'reintegro');
    assert.equal(por('s2').cuota_texto, '3/6');
    assert.equal(tipoDeFila(por('s2')), 'cuota');
    assert.equal(tipoDeFila(por('s1'), new Set(['live:s1'])), 'variable', 'no hay fijos en curso');
    assert.equal(por('s1').referencia_limpia, 'Coto');
    assert.equal(por('g1').es_pendiente, true);
    assert.equal(por('s1').origen, 'en_curso');
  });

  test("filtro 'en_curso' ignora el período y respeta texto y tarjeta", () => {
    assert.equal(filtrarMovimientos(movs, { tipo: 'en_curso', modo: 'mes', periodo: '2020-01', enCurso: filas }).length, filas.length);
    assert.deepEqual(filtrarMovimientos(movs, { tipo: 'en_curso', enCurso: filas, texto: 'steam' }).map((f) => f.id), ['live:m1']);
    assert.equal(filtrarMovimientos(movs, { tipo: 'en_curso', enCurso: filas, tarjeta: 'VISA Galicia' }).length, 1);
  });

  test("por resumen, la ficha 'en_curso:<tarjeta>' trae los de esa tarjeta", () => {
    const r = filtrarMovimientos(movs, { modo: 'resumen', resumenId: 'en_curso:VISA Santander', enCurso: filas });
    assert.deepEqual(r.map((f) => f.id).sort(), ['live:s1', 'live:s2', 'live:s3', 'live:s4']);
  });

  test('por mes, los consumos en curso se suman al mes de su fecha', () => {
    assert.deepEqual(mesesDisponibles(movs, filas), ['2026-09', '2026-08', '2026-07']);
    const sep = filtrarMovimientos(movs, { modo: 'mes', periodo: '2026-09', enCurso: filas });
    assert.equal(sep.filter((m) => m.origen === 'en_curso').length, filas.length);
  });

  test('cabecera: total neto, dólares, % del último cierre y actualización', () => {
    const santander = filas.filter((f) => f.tarjeta === 'VISA Santander');
    const r = resumenEnCurso(santander, resumenesEC);
    assert.equal(r.total, 883600.65);
    assert.equal(r.cantidad, 4);
    assert.equal(r.pctUltimoCierre, Math.round((r.total / 800000) * 100));
    assert.equal(r.actualizado, '2026-09-26T22:46:00.000Z');
    assert.equal(resumenEnCurso(filas.filter((f) => f.grupoKey === 'Macro|Visa|7788'), resumenesEC).totalUsd, 20);
  });

  test('historial del comercio incluye la columna en curso', () => {
    const h = historialComercio([], por('s1'), resumenesEC, { enCurso: filas });
    assert.equal(h[h.length - 1].resumenId, 'en_curso');
    assert.equal(h[h.length - 1].actual, true);
  });

  test('sin consumos en curso nada cambia', () => {
    assert.deepEqual(movimientosEnCurso({}), []);
    assert.deepEqual(filtrarMovimientos(movs, { modo: 'mes', periodo: '2026-09', enCurso: [] }).map((m) => m.id),
      filtrarMovimientos(movs, { modo: 'mes', periodo: '2026-09' }).map((m) => m.id));
  });

  test('nombreSegunReglas: clave de comercio primero, después regex', () => {
    const r = [{ patron: 'coto', nombre_limpio: 'Coto' }, { patron: 'merpago coto', es_clave: true, nombre_limpio: 'Coto Palermo', fecha_creacion: '2026-09-01' }];
    assert.equal(nombreSegunReglas('MERPAGO*COTO SUC 45', []), null);
    assert.equal(nombreSegunReglas('COTO 123', r), 'Coto');
  });
});
