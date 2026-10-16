import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formVacio, formDesdeDeuda, derivar, filaDesdeForm, modoDeTipo } from './formulario.js';
import { estadoDeuda } from './deudas.js';

const hoy = '2026-10-15';
const pago = (monto, fecha, id = fecha) => ({ id, deuda_id: 'd1', direccion: 'salida', moneda: 'ARS', monto, fecha, origen: 'manual' });
const deuda = { id: 'd1', nombre: 'Préstamo', tipo: 'prestamo', acreedor: 'Galicia', moneda: 'ARS', saldo_inicial: 60000, fecha_inicio: '2026-10-01', cuota_monto: 10000, cuotas_restantes: 6, tasa_anual: null, palabra_clave: null, estado: 'activa', notas: null };

test('alta en cuotas fijas: saldo = cuota × cuotas, sin tipear el saldo', () => {
  const f = { ...formVacio(hoy), cuota_monto: '10.000', cuotas_restantes: '6', acreedor: 'Galicia' };
  const r = filaDesdeForm(f);
  assert.equal(r.fila.saldo_inicial, 60000);
  assert.equal(r.fila.cuotas_restantes, 6);
  assert.equal(r.fila.nombre, 'Préstamo Galicia'); // nombre automático
});

test('alta en cuotas fijas: lo que tipeás como saldo manda (el banco dice otro número)', () => {
  const f = { ...formVacio(hoy), cuota_monto: '10000', cuotas_restantes: '6', saldo_hoy: '55.000' };
  assert.equal(filaDesdeForm(f).fila.saldo_inicial, 55000);
});

test('monto libre: saldo obligatorio, sin cuotas, cuota opcional', () => {
  const f = { ...formVacio(hoy), tipo: 'persona', modo: 'libre', acreedor: 'Juan Perez', saldo_hoy: '100000' };
  const r = filaDesdeForm(f);
  assert.equal(r.fila.cuotas_restantes, null);
  assert.equal(r.fila.cuota_monto, null);
  const sin = filaDesdeForm({ ...f, saldo_hoy: '' });
  assert.equal(sin.campo, 'saldo_hoy');
  assert.equal(sin.error, 'Poné cuánto debés hoy.');
});

test('errores con campo: cuota y cuotas faltantes en modo cuotas', () => {
  assert.equal(filaDesdeForm({ ...formVacio(hoy), cuotas_restantes: '6' }).campo, 'cuota_monto');
  assert.equal(filaDesdeForm({ ...formVacio(hoy), cuota_monto: '10000', cuotas_restantes: '2,5' }).campo, 'cuotas_restantes');
  assert.equal(filaDesdeForm({ ...formVacio(hoy), cuota_monto: '10000', cuotas_restantes: '0' }).campo, 'cuotas_restantes');
});

test('editar sin cambios no mueve nada (ida y vuelta con pagos)', () => {
  const pagos = [pago(10000, '2026-10-05'), pago(10000, '2026-10-10')];
  const f = formDesdeDeuda(deuda, pagos);
  assert.equal(f.cuotas_restantes, '4'); // lo que falta HOY
  assert.equal(f.saldo_hoy, '');          // se calcula solo: 4 × 10.000
  const { fila } = filaDesdeForm(f, { deuda, pagos });
  assert.equal(fila.saldo_inicial, 60000);
  assert.equal(fila.cuotas_restantes, 6);
  assert.equal(estadoDeuda({ ...deuda, ...fila }, pagos).saldo, 40000);
});

test('editar: corregir lo que debés hoy ajusta el saldo inicial sin perder los pagos', () => {
  const pagos = [pago(10000, '2026-10-05')];
  const f = { ...formDesdeDeuda(deuda, pagos), saldo_hoy: '45.000' };
  const { fila } = filaDesdeForm(f, { deuda, pagos });
  assert.equal(estadoDeuda({ ...deuda, ...fila }, pagos).saldo, 45000);
});

test('editar saldo distinto de cuota × cuotas se conserva como manual', () => {
  const d = { ...deuda, saldo_inicial: 55000 };
  const f = formDesdeDeuda(d, []);
  assert.equal(f.saldo_hoy, '55.000');
  assert.equal(formDesdeDeuda(deuda, []).cuota_monto, '10.000');
  assert.equal(filaDesdeForm(f, { deuda: d, pagos: [] }).fila.saldo_inicial, 55000);
});

test('un pago doble salta dos cuotas; uno parcial, ninguna', () => {
  assert.equal(estadoDeuda(deuda, [pago(20000, '2026-10-05')]).cuotasRestantes, 4);
  assert.equal(estadoDeuda(deuda, [pago(5000, '2026-10-05')]).cuotasRestantes, 6);
  assert.equal(estadoDeuda(deuda, [pago(60000, '2026-10-05')]).cuotasRestantes, 0);
});

test('derivar: costo de cancelar hoy con tasa, tasa implícita con capital, meses en monto libre', () => {
  const a = derivar({ ...formVacio(hoy), cuota_monto: '112825,41', cuotas_restantes: '12', tasa_anual: '60' });
  assert.equal(a.capitalHoy, 1000000);
  assert.ok(Math.abs(a.ahorro - 353904.92) < 0.05);
  const b = derivar({ ...formVacio(hoy), cuota_monto: '112825,41', cuotas_restantes: '12', capital: '1.000.000' });
  assert.ok(Math.abs(b.implicita.tna - 60) < 0.001);
  const c = derivar({ ...formVacio(hoy), cuota_monto: '112825,41', cuotas_restantes: '12', capital: '5.000.000' });
  assert.equal(c.implicitaInvalida, true);
  const d = derivar({ ...formVacio(hoy), tipo: 'persona', modo: 'libre', saldo_hoy: '100000', cuota_monto: '25000' });
  assert.equal(d.meses, 4);
});

test('modoDeTipo', () => {
  assert.equal(modoDeTipo('prestamo'), 'cuotas');
  assert.equal(modoDeTipo('persona'), 'libre');
});

test('revisión: saldo inválido no se ignora; saldo propio apaga el cálculo de cancelación; tasa absurda', () => {
  const base = { ...formVacio(hoy), cuota_monto: '1000', cuotas_restantes: '12' };
  for (const x of ['0', '-5', 'abc']) assert.equal(filaDesdeForm({ ...base, saldo_hoy: x }).campo, 'saldo_hoy');
  assert.equal(derivar({ ...base, saldo_hoy: '5000', tasa_anual: '85' }).capitalHoy, null);
  assert.equal(derivar({ ...base, tasa_anual: '1500' }).capitalHoy, null);
  assert.equal(derivar({ ...formVacio(hoy), modo: 'libre', saldo_hoy: '1000000000', cuota_monto: '1000' }).meses, Infinity);
});

test('revisión: saldo de capital menor que cuota × n conserva las cuotas cargadas', () => {
  const d = { ...deuda, saldo_inicial: 9500, cuota_monto: 1000, cuotas_restantes: 12 };
  assert.equal(estadoDeuda(d, []).cuotasRestantes, 12);
  assert.equal(estadoDeuda(d, [pago(1000, '2026-10-05')]).cuotasRestantes, 11);
  assert.equal(formDesdeDeuda(d, []).cuotas_restantes, '12');
});
