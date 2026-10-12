import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenTarjetasDelMes } from './tarjeteando.js';
import { composicionPorTarjeta, composicionDesdeTarjetas } from '../../services/mes.js';

const congelar = (o) => {
  Object.values(o).forEach((v) => { if (v && typeof v === 'object') congelar(v); });
  return Object.freeze(o);
};

test('mismas cifras que la composición de Mes (services/mes.js)', () => {
  const porTarjeta = [
    { tarjetaId: 'VISA', fuente: 'resumen_cerrado', total: 100000, totalUsd: 20 },
    { tarjetaId: 'MC', fuente: 'en_curso', total: 50000, totalUsd: 0 },
    { tarjetaId: 'AMEX', fuente: 'sin_datos', total: 0, totalUsd: 0 }
  ];
  const cuotas = [{ tarjeta: 'VISA', monto: 30000 }, { tarjeta: 'MC', monto: 10000 }];
  const porTarjetaComp = composicionPorTarjeta({ porTarjeta, cuotas, fijosPorTarjeta: { VISA: 5000 } });
  const comp = composicionDesdeTarjetas(porTarjetaComp, { porTarjeta, fijosUsd: 12 });
  const mes = congelar({ ciclo: { mesKey: '2026-10', porTarjeta }, comp, cuotas: { items: cuotas, totalUsd: 7 } });

  const r = resumenTarjetasDelMes(mes);
  assert.equal(r.mesKey, '2026-10');
  assert.equal(r.total, comp.total);
  assert.equal(r.cuotas, comp.cuotas);
  assert.equal(r.fijos, comp.fijos);
  assert.equal(r.variables, comp.variables);
  assert.equal(r.usd.total, 20);
  assert.equal(r.usd.fijos, 12);
  assert.equal(r.usd.cuotas, 7);
  assert.deepEqual(r.sinDatos, ['AMEX']);
  assert.equal(r.tarjetasConDatos, 2);
  assert.equal(r.fuente, 'dispositivo_local');
});

test('no muta la entrada (objetos congelados no lanzan)', () => {
  const mes = congelar({ ciclo: { mesKey: '2026-11', porTarjeta: [] }, comp: { total: 0 } });
  assert.doesNotThrow(() => resumenTarjetasDelMes(mes));
});

test('sin datos: total 0 y todas las tarjetas en sinDatos', () => {
  const mes = { ciclo: { mesKey: '2026-10', porTarjeta: [{ tarjetaId: 'A', fuente: 'sin_datos' }, { tarjetaId: 'B', fuente: 'sin_datos' }] }, comp: {} };
  const r = resumenTarjetasDelMes(mes);
  assert.equal(r.total, 0);
  assert.deepEqual(r.sinDatos, ['A', 'B']);
  assert.equal(r.tarjetasConDatos, 0);
});

test('sin mes devuelve null', () => {
  assert.equal(resumenTarjetasDelMes(null), null);
  assert.equal(resumenTarjetasDelMes({}), null);
});

import { comprasDeTarjeta, sugerirAlcance } from './tarjeteando.js';

test('compras de tarjeta: una fila por plan de cuotas, sin pagos ni reintegros', () => {
  const movs = [
    { id: 'a', tarjeta: 'VISA', referencia_limpia: 'Heladera', fecha_compra: '2026-07-10', monto_pesos: 100000, es_cuota: true, cuota_actual: 2, total_cuotas: 6 },
    { id: 'b', tarjeta: 'VISA', referencia_limpia: 'Heladera', fecha_compra: '2026-07-10', monto_pesos: 100000, es_cuota: true, cuota_actual: 3, total_cuotas: 6 },
    { id: 'c', tarjeta: 'VISA', referencia_limpia: 'Asado', fecha_compra: '2026-09-01', monto_pesos: 40000 },
    { id: 'd', tarjeta: 'VISA', referencia_limpia: 'SU PAGO', monto_pesos: 500000, es_pago: true },
    { id: 'e', tarjeta: 'VISA', referencia_limpia: 'Reintegro', monto_pesos: -2000 }
  ];
  const c = comprasDeTarjeta(movs);
  assert.equal(c.length, 2);
  assert.equal(c[0].descripcion, 'Asado');
  assert.deepEqual(c[1].cuotas, { actual: 3, total: 6, monto_cuota: 100000, total_compra: 600000 });
  assert.equal(sugerirAlcance(100000, c[1]), 'cuota');
  assert.equal(sugerirAlcance(550000, c[1]), 'total');
  assert.equal(sugerirAlcance(300000, c[1]), 'total'); // devolución parcial del total, no una cuota
  const dos = comprasDeTarjeta([{ id: 'x', tarjeta: 'V', referencia_limpia: 'Zapas', fecha_compra: '2026-05-01', monto_pesos: 10000, es_cuota: true, cuota_actual: 1, total_cuotas: 3 }, { id: 'y', tarjeta: 'V', referencia_limpia: 'Zapas', fecha_compra: '2026-06-01', monto_pesos: 10000, es_cuota: true, cuota_actual: 1, total_cuotas: 3 }]);
  assert.equal(dos.length, 2); // dos compras iguales en fechas distintas no se fusionan
  assert.equal(sugerirAlcance(10000, c[0]), 'total');
});

import { tarjetasPorMes } from './tarjeteando.js';
test('tarjetas por mes desde las columnas de Evolución', () => {
  const t = tarjetasPorMes([{ mesKey: '2026-09', tipo: 'pagado', total: 100.004, usdAparte: 0, porTarjeta: { V: 100 } }, { mesKey: '2026-10', tipo: 'en_curso', total: 50, usdAparte: 3 }, null]);
  assert.deepEqual(t['2026-09'], { total: 100, tipo: 'pagado', usd: 0 });
  assert.equal(t['2026-10'].usd, 3);
  assert.equal(tarjetasPorMes([{ mesKey: '2026-08', tipo: 'pagado', total: 0, porTarjeta: {} }])['2026-08'], undefined);
});
