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
