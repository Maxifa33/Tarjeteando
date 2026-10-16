import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuotaFrancesa, valorPresente, tasaImplicita, cuotasParaSaldar, resumenPrestamo, cronograma, tnaAMensual, mensualATna, teaDesdeMensual } from './financiera.js';

const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('cuotaFrancesa: 1.000.000 a 12 cuotas, 60 % TNA = 112.825,41 (valor de referencia)', () => {
  assert.equal(cuotaFrancesa(1000000, tnaAMensual(60), 12), 112825.41);
  assert.equal(cuotaFrancesa(120000, 0, 12), 10000);
});

test('valorPresente y tasaImplicita son inversas', () => {
  assert.equal(valorPresente(112825.41, 0.05, 12), 1000000);
  cerca(tasaImplicita(1000000, 112825.41, 12), 0.05, 1e-7);
  assert.equal(valorPresente(10000, 0, 6), 60000);
});

test('tasaImplicita: sin interés = 0; datos imposibles o absurdos = null', () => {
  assert.equal(tasaImplicita(60000, 10000, 6), 0);
  assert.equal(tasaImplicita(60000, 9000, 6), null); // pagás menos de lo que recibiste
  assert.equal(tasaImplicita(0, 10000, 6), null);
  assert.equal(tasaImplicita(1000, 10000, 1.5), null);
  assert.equal(tasaImplicita(1000, 5000, 1), null); // 400 % mensual
});

test('conversiones de tasa', () => {
  cerca(mensualATna(0.05), 60, 1e-9);
  cerca(teaDesdeMensual(0.05), 79.5856, 1e-3); // 1,05^12 − 1
});

test('cuotasParaSaldar: con y sin interés, y cuota que no cubre el interés', () => {
  assert.equal(cuotasParaSaldar(1000000, 112825.41, 0.05), 12); // redondeo de centavos no suma una cuota de más
  assert.equal(cuotasParaSaldar(60000, 10000, 0), 6);
  assert.equal(cuotasParaSaldar(1000000, 50000, 0.05), Infinity); // 50.000 = solo el interés
  assert.equal(cuotasParaSaldar(0, 10, 0.05), 0);
});

test('resumenPrestamo: tasa, costo y datos inconsistentes', () => {
  const r = resumenPrestamo({ capital: 1000000, cuota: 112825.41, n: 12 });
  cerca(r.tna, 60, 1e-4);
  assert.equal(r.total, 1353904.92);
  assert.equal(r.intereses, 353904.92);
  assert.equal(resumenPrestamo({ capital: 2000000, cuota: 100000, n: 12 }), null);
});

test('cronograma: cierra en 0 y la suma de amortizaciones es el capital', () => {
  const c = cronograma({ capital: 1000000, cuota: 112825.41, i: 0.05, n: 12 });
  assert.equal(c.length, 12);
  assert.equal(c[0].interes, 50000);
  assert.ok(c[11].saldo < 0.05);
  cerca(c.reduce((s, x) => s + x.amortizacion, 0), 1000000, 0.2);
});
