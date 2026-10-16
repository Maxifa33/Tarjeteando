import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoReserva, resumenReservas, validarAjuste } from './reservas.js';

// Datos ficticios.
const b = { id: 'b1', nombre: 'Fondo', tipo: 'ahorro' };
const mov = (id, fecha, direccion, monto, bolsillo_id = 'b1') => ({ id, fecha, direccion, monto, tipo: 'reserva', bolsillo_id });
const aj = (id, fecha, saldo_real, bolsillo_id = 'b1') => ({ id, fecha, saldo_real, bolsillo_id });

test('sin ajuste: saldo = neto corrido y sinAnclar', () => {
  const e = estadoReserva(b, [mov(1, '2026-08-01', 'salida', 1000), mov(2, '2026-08-10', 'entrada', 300), mov(3, '2026-08-11', 'salida', 50, 'otra')]);
  assert.equal(e.saldo, 700);
  assert.equal(e.aportado, 1000);
  assert.equal(e.retirado, 300);
  assert.equal(e.sinAnclar, true);
  assert.deepEqual(e.filas.map((f) => f.saldo), [1000, 700]);
});

test('retirar más de lo que había (rendimiento) deja 0, no negativo', () => {
  const e = estadoReserva(b, [mov(1, '2026-09-04', 'salida', 200000), mov(2, '2026-09-22', 'entrada', 201926.21)]);
  assert.equal(e.saldo, 0);
  assert.equal(e.filas[1].saldo, 0);
});

test('con ajuste: el saldo real manda y los movimientos posteriores lo corren', () => {
  const e = estadoReserva(b, [mov(1, '2026-08-01', 'salida', 1000), mov(2, '2026-10-20', 'salida', 500)], [aj('a1', '2026-10-16', 5000)], '2026-10-21');
  assert.equal(e.saldo, 5500);
  assert.equal(e.sinAnclar, false);
  assert.equal(e.ultimoAjuste, '2026-10-16');
  assert.equal(e.diasDesdeAjuste, 5);
  const f = e.filas.find((x) => x.tipo === 'ajuste');
  assert.equal(f.diferencia, 4000); // 5000 real − 1000 calculado: saldo previo o rendimiento
});

test('movimiento del mismo día del ajuste no se suma otra vez', () => {
  const e = estadoReserva(b, [mov(1, '2026-10-16', 'entrada', 100105.02)], [aj('a1', '2026-10-16', 0)]);
  assert.equal(e.saldo, 0);
});

test('ajustes: gana el de fecha más reciente y se puede recalibrar', () => {
  const e = estadoReserva(b, [mov(1, '2026-08-01', 'salida', 100)], [aj('a2', '2026-10-01', 900), aj('a1', '2026-09-01', 500)]);
  assert.equal(e.saldo, 900);
  assert.equal(e.ultimoAjuste, '2026-10-01');
});

test('resumenReservas: totales por tipo, orden por saldo y cuenta sin anclar', () => {
  const bs = [b, { id: 'b2', nombre: 'Casco', tipo: 'apartado' }, { id: 'b3', nombre: 'Vacía', tipo: 'apartado' }];
  const r = resumenReservas(bs, [mov(1, '2026-08-01', 'salida', 1000), mov(2, '2026-08-01', 'salida', 400, 'b2')], [aj('a1', '2026-10-16', 2000, 'b1')]);
  assert.equal(r.total, 2400);
  assert.equal(r.ahorro, 2000);
  assert.equal(r.apartado, 400);
  assert.equal(r.sinAnclar, 1); // b2 tiene movimientos y no está anclada; b3 no tiene nada
  assert.deepEqual(r.estados.map((e) => e.id), ['b1', 'b2', 'b3']);
});

test('validarAjuste', () => {
  assert.equal(validarAjuste({ bolsilloId: 'b1', fecha: '2026-10-16', monto: null }, '2026-10-16').campo, 'monto');
  assert.equal(validarAjuste({ bolsilloId: 'b1', fecha: '2026-10-16', monto: -1 }, '2026-10-16').campo, 'monto');
  assert.equal(validarAjuste({ bolsilloId: 'b1', fecha: '', monto: 0 }, '2026-10-16').campo, 'fecha');
  assert.equal(validarAjuste({ bolsilloId: 'b1', fecha: '2026-10-17', monto: 0 }, '2026-10-16').campo, 'fecha');
  assert.deepEqual(validarAjuste({ bolsilloId: 'b1', fecha: '2026-10-16', monto: 0 }, '2026-10-16').fila, { bolsillo_id: 'b1', fecha: '2026-10-16', saldo_real: 0 });
});

test('mismo día: el resultado no depende del id (entra primero, sale después)', () => {
  const a = estadoReserva(b, [mov('z', '2026-09-01', 'entrada', 100), mov('a', '2026-09-01', 'salida', 100)]);
  const c = estadoReserva(b, [mov('a', '2026-09-01', 'entrada', 100), mov('z', '2026-09-01', 'salida', 100)]);
  assert.equal(a.saldo, 0);
  assert.equal(c.saldo, 0);
});

test('movimientos inválidos (monto NaN, dirección rara) se ignoran', () => {
  const e = estadoReserva(b, [mov(1, '2026-09-01', 'salida', 100), mov(2, '2026-09-02', 'salida', null), mov(3, '2026-09-03', 'otra', 50)]);
  assert.equal(e.saldo, 100);
});
