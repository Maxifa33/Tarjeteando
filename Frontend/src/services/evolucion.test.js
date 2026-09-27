/**
 * Tests de Evolución y proyección (services/evolucion.js) — `npm test`.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { serieEvolucion, detalleMes, escalaY, mesDePago, serieDeTarjeta } from './evolucion.js';
import { construirPlanes, proyectarCuotas } from './cuotas.js';
import { cicloDePago, composicion, desfasePorTarjeta, sumarMeses } from './mes.js';

const HOY = '2026-09-26';
const T = 'VISA Galicia';

// Tres resúmenes pagados (jun, jul, ago → vencen jul, ago, sep) y uno cerrado que vence en octubre.
const res = (mes, cierre, vto, total) => ({ id: `${T}-2026-${mes}`, tarjeta: T, anio: 2026, mes, fecha_cierre: cierre, fecha_vencimiento: vto, total_a_pagar_pesos: total });
const JUN = res(6, '2026-06-26', '2026-07-08', 300000);
const JUL = res(7, '2026-07-31', '2026-08-12', 400000);
const AGO = res(8, '2026-08-28', '2026-09-09', 500000);
const SEP = res(9, '2026-09-25', '2026-10-07', 450000);
const BBVA = { id: 'VISA BBVA-2026-7', tarjeta: 'VISA BBVA', anio: 2026, mes: 7, fecha_cierre: '2026-07-24', fecha_vencimiento: '2026-08-05', total_a_pagar_pesos: 100000 };
const resumenes = [JUN, JUL, AGO, SEP, BBVA];

const mov = (r, id, ref, pesos, cuota = '') => ({ id, resumen_id: r.id, tarjeta: r.tarjeta, referencia_limpia: ref, cuota_texto: cuota, monto_pesos: pesos, monto_dolares: 0 });
const movimientos = [
  mov(JUL, 'm1', 'Heladera', 50000, '01/03'), mov(JUL, 'm2', 'Netflix', 12000),
  mov(AGO, 'm3', 'Heladera', 50000, '02/03'), mov(AGO, 'm4', 'Netflix', 12000),
  mov(SEP, 'm5', 'Heladera', 50000, '03/03'), mov(SEP, 'm6', 'Netflix', 12000),
  mov(SEP, 'm7', 'Moto', 80000, '02/06'),
  { ...mov(AGO, 'm8', 'Steam', 0), monto_dolares: 20 }
];
const tipos = { m2: { tipo: 'fijo' }, m4: { tipo: 'fijo' }, m6: { tipo: 'fijo' } };
const planes = construirPlanes(movimientos, resumenes);
const fijos = { ars: 12000, usd: 0, items: [{ tarjeta: T, moneda: 'ARS', montoTipico: 12000 }] };
const tarjetas = [{ nombre: T, banco: 'Galicia', tipo: 'VISA' }, { nombre: 'VISA BBVA', banco: 'BBVA', tipo: 'VISA' }];
const ciclo = cicloDePago({ hoy: HOY, tarjetas, resumenes });
const comp = composicion({ porTarjeta: ciclo.porTarjeta, cuotasDelMes: 130000, fijosArs: 12000 });
const desfase = desfasePorTarjeta(resumenes);
const cols = serieEvolucion({ resumenes, movimientos, tipos, planes, fijos, ciclo, composicion: comp, desfase });

describe('serieEvolucion', () => {
  test('orden y tipos: pagados → en curso → 6 comprometidos', () => {
    assert.equal(ciclo.mesKey, '2026-10');
    assert.deepEqual(cols.map((c) => c.mesKey), ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);
    assert.deepEqual(cols.map((c) => c.tipo), ['pagado', 'pagado', 'pagado', 'en_curso', ...Array(6).fill('comprometido')]);
    assert.equal(cols[6].anioCorto, "'27");
  });

  test('sin columnas vacías antes del primer resumen', () => {
    assert.equal(cols[0].mesKey, '2026-07');
  });

  test('cada mes pagado = suma de los resúmenes que vencieron ese mes', () => {
    assert.equal(cols[0].total, 300000);
    assert.equal(cols[1].total, 500000); // Galicia jul (400.000) + BBVA (100.000)
    assert.deepEqual(cols[1].porTarjeta, { [T]: 400000, 'VISA BBVA': 100000 });
    assert.equal(cols[2].total, 500000);
  });

  test('suma porTarjeta = total = suma porTipo, en todas las columnas', () => {
    cols.forEach((c) => {
      const sT = Object.values(c.porTarjeta).reduce((s, v) => s + v, 0);
      const sP = c.porTipo.cuotas + c.porTipo.fijos + c.porTipo.variables;
      assert.ok(Math.abs(sT - c.total) < 0.01, `${c.mesKey} porTarjeta`);
      assert.ok(Math.abs(sP - c.total) < 0.01, `${c.mesKey} porTipo`);
    });
  });

  test('porTipo de un mes pagado sale de sus movimientos (cuotas, fijos, resto)', () => {
    assert.deepEqual(cols[1].porTipo, { cuotas: 50000, fijos: 12000, variables: 438000 });
    assert.equal(cols[2].usdExcluido, 20, 'USD sin cotización: se excluye y se avisa');
  });

  test('meses sin resumen en el medio valen 0 (no se saltean)', () => {
    const r = [JUN, AGO];
    const c = serieEvolucion({ resumenes: r, ciclo: { mesKey: '2026-10', porTarjeta: [] }, composicion: null });
    assert.deepEqual(c.slice(0, 3).map((x) => [x.mesKey, x.total]), [['2026-07', 300000], ['2026-08', 0], ['2026-09', 500000]]);
  });

  test('el mes en curso coincide con el total de Mes', () => {
    const enCurso = cols.find((c) => c.tipo === 'en_curso');
    assert.equal(enCurso.total, comp.total);
    assert.equal(enCurso.total, 450000);
  });

  test('comprometido = proyectarCuotas (por mes_key, con el desfase) + fijos', () => {
    const proy = proyectarCuotas(planes, { meses: 8, resumenes });
    cols.filter((c) => c.tipo === 'comprometido').forEach((c) => {
      const facturado = sumarMeses(c.mesKey, -1); // Galicia: cierra un mes, vence el siguiente
      const bucket = proy.find((p) => p.mes_key === facturado);
      assert.equal(c.total, (bucket ? bucket.total : 0) + 12000, c.mesKey);
      assert.equal(c.porTipo.variables, 0, 'no se inventa gasto variable');
    });
    // Noviembre: Moto 3/6 (facturada en octubre) + Netflix.
    assert.equal(cols[4].total, 92000);
  });
});

describe('detalleMes', () => {
  test("'Dejás de pagar' detecta el plan cuya última cuota fue el mes anterior", () => {
    // Moto 02/06 en SEP (vence oct) → 06/06 se paga en febrero; en marzo ya no.
    const mar = cols.find((c) => c.mesKey === '2027-03');
    const d = detalleMes(mar, planes, { desfase });
    assert.deepEqual(d.terminan.map((q) => q.descripcion), ['Moto']);
    assert.equal(d.dejasDePagar, 80000);
    assert.equal(d.cuotas.length, 0);
  });

  test('lista las cuotas del mes', () => {
    const nov = cols.find((c) => c.mesKey === '2026-11');
    const d = detalleMes(nov, planes, { desfase });
    assert.deepEqual(d.cuotas.map((q) => `${q.descripcion} ${q.cuota_numero}/${q.total_cuotas}`), ['Moto 3/6']);
    // Heladera 03/03 se paga en octubre (el mes anterior a noviembre): en noviembre se deja de pagar.
    assert.deepEqual(d.terminan.map((q) => q.descripcion), ['Heladera']);
  });

  test('pasado o en curso: sin detalle de cuotas', () => {
    assert.deepEqual(detalleMes(cols[0], planes).cuotas, []);
  });
});

describe('escalaY', () => {
  test('múltiplo de 500.000 con 6 % de aire', () => {
    assert.equal(escalaY(1818938).max, 2000000);
    assert.equal(escalaY(1900000).max, 2500000);
  });
  test('el tope mayor al máximo manda', () => {
    assert.equal(escalaY(1000000, 2400000).max, 3000000);
  });
  test('compacto: múltiplo de 1.000.000 y ≤ 6 marcas', () => {
    const e = escalaY(4700000, null, { compacto: true });
    assert.equal(e.max, 5000000);
    assert.ok(e.ticks.length <= 6);
    assert.equal(e.ticks[0], 0);
  });
});

test('mesDePago usa el vencimiento; sin vencimiento, el mes siguiente al período', () => {
  assert.equal(mesDePago(JUL), '2026-08');
  assert.equal(mesDePago({ anio: 2026, mes: 12 }), '2027-01');
});

test('serieDeTarjeta: una sola tarjeta, 0 en los meses sin datos', () => {
  const s = serieDeTarjeta(cols, 'VISA BBVA');
  assert.equal(s.length, cols.length);
  assert.deepEqual(s.slice(0, 3).map((v) => v.total), [0, 100000, 0]);
  assert.equal(s[3].tipo, 'en_curso');
});
