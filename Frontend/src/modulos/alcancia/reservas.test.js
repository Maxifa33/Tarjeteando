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

// ---- Reservas manuales y monedas ----
import { movsManuales, aPesos, validarReserva, validarMovReserva, saldoAl } from './reservas.js';

const man = (o) => ({ id: 'x1', origen: 'manual', moneda: 'USD', tipo: 'ahorro', nombre: 'Caja fuerte', ...o });

test('movsManuales: depósito entra a la reserva, retiro sale', () => {
  const r = movsManuales([{ id: 'a', fecha: '2026-10-01', monto: '100.50', sentido: 'deposito', bolsillo_id: 'b1' }, { id: 'b', fecha: '2026-10-02', monto: '40', sentido: 'retiro', bolsillo_id: 'b1' }]);
  assert.deepEqual(r.map((x) => x.direccion), ['salida', 'entrada']);
  const e = estadoReserva(b, r);
  assert.equal(e.saldo, 60.5);
  assert.equal(e.filas[0].manual, true);
});

test('un importado vinculado se marca en las filas', () => {
  const e = estadoReserva(b, [{ ...mov(1, '2026-08-01', 'salida', 100000), previo_reserva: { tipo: 'gasto' } }]);
  assert.equal(e.filas[0].vinculado, true);
});

test('aPesos: ARS directo, USD con MEP, otras con cotización manual, null si falta', () => {
  assert.equal(aPesos(100, 'ARS'), 100);
  assert.equal(aPesos(100, 'USD', { mep: 1500 }), 150000);
  assert.equal(aPesos(100, 'USD'), null);
  assert.equal(aPesos(100, 'EUR', { cotizacion: 1700 }), 170000);
  assert.equal(aPesos(100, 'EUR'), null);
});

test('resumenReservas multimoneda: totales por moneda, equivalente y faltantes', () => {
  const bs = [
    { id: 'p', nombre: 'Sobre', tipo: 'apartado', moneda: 'ARS', origen: 'manual' },
    { id: 'd', nombre: 'Dólares', tipo: 'ahorro', moneda: 'USD', origen: 'manual' },
    { id: 'e', nombre: 'Euros', tipo: 'ahorro', moneda: 'EUR', origen: 'manual', cotizacion_ars: 1700 },
    { id: 'c', nombre: 'Reales', tipo: 'ahorro', moneda: 'BRL', origen: 'manual' },
    { id: 'z', nombre: 'Vieja', tipo: 'ahorro', moneda: 'ARS', origen: 'manual', archivada: true }
  ];
  const ajs = [aj('1', '2026-10-16', 1000, 'p'), aj('2', '2026-10-16', 200, 'd'), aj('3', '2026-10-16', 100, 'e'), aj('4', '2026-10-16', 50, 'c'), aj('5', '2026-10-16', 999, 'z')];
  const r = resumenReservas(bs, [], ajs, '2026-10-16', { mep: 1500 });
  assert.deepEqual(r.monedas.map((m) => m.moneda), ['ARS', 'USD', 'EUR', 'BRL']);
  assert.equal(r.equivalente.ars, 1000 + 300000 + 170000);
  assert.equal(r.equivalente.completo, false);
  assert.deepEqual(r.equivalente.faltan, ['BRL']);
  assert.equal(r.equivalente.mostrar, true);
  assert.equal(r.archivadas.length, 1);
  assert.equal(r.estados.some((e) => e.id === 'z'), false); // las archivadas no suman
  assert.equal(r.total, 1000); // compat: solo ARS
  const sinMep = resumenReservas(bs, [], ajs, '2026-10-16');
  assert.deepEqual(sinMep.equivalente.faltan, ['USD', 'BRL']);
});

test('resumenReservas: solo pesos no muestra equivalente; sinAnclar solo cuenta importadas', () => {
  const r = resumenReservas([b, { id: 'm', nombre: 'Manual', tipo: 'apartado', origen: 'manual' }], [mov(1, '2026-08-01', 'salida', 10), mov(2, '2026-08-01', 'salida', 10, 'm')], []);
  assert.equal(r.equivalente.mostrar, false);
  assert.equal(r.sinAnclar, 1);
});

test('validarReserva: campos, nombre repetido (también contra MP), moneda libre y cotización', () => {
  const ok = { nombre: 'Euros viaje', moneda: 'EUR', medio: 'efectivo', tipo: 'apartado', saldo: '350', cotizacion: '1.700,50', notas: '' };
  const v = validarReserva(ok, { existentes: [{ id: 'q', nombre: 'Emergencia' }], hoy: '2026-10-16' });
  assert.equal(v.fila.moneda, 'EUR');
  assert.equal(v.fila.cotizacion_ars, 1700.5);
  assert.equal(v.fila.cotizacion_fecha, '2026-10-16');
  assert.equal(v.fila.origen, 'manual');
  assert.equal(v.saldo, 350);
  assert.equal(validarReserva({ ...ok, nombre: ' emergencia ' }, { existentes: [{ id: 'q', nombre: 'Emergencia' }], hoy: 'x' }).campo, 'nombre');
  assert.equal(validarReserva({ ...ok, nombre: '' }, { hoy: 'x' }).campo, 'nombre');
  assert.equal(validarReserva({ ...ok, moneda: 'OTRA', codigo: 'br' }, { hoy: 'x' }).campo, 'codigo');
  assert.equal(validarReserva({ ...ok, moneda: 'OTRA', codigo: 'clp' }, { hoy: 'x' }).fila.moneda, 'CLP');
  assert.equal(validarReserva({ ...ok, medio: '' }, { hoy: 'x' }).campo, 'medio');
  assert.equal(validarReserva({ ...ok, cotizacion: '0' }, { hoy: 'x' }).campo, 'cotizacion');
  assert.equal(validarReserva({ ...ok, saldo: '-5' }, { hoy: 'x' }).campo, 'saldo');
  // USD y ARS no guardan cotización manual
  assert.equal(validarReserva({ ...ok, moneda: 'USD' }, { hoy: 'x' }).fila.cotizacion_ars, null);
  // Editar: el nombre propio no cuenta como repetido y la fecha de la cotización se conserva si no cambió
  const ed = man({ moneda: 'EUR', cotizacion_ars: 1700.5, cotizacion_fecha: '2026-09-01', nombre: 'Euros viaje' });
  const v2 = validarReserva(ok, { existentes: [ed], editando: ed, hoy: '2026-10-16' });
  assert.equal(v2.fila.cotizacion_fecha, '2026-09-01');
});

test('validarMovReserva: monto, fecha futura y no retirar más de lo que hay', () => {
  const ctx = { saldo: 100, hoy: '2026-10-16' };
  assert.equal(validarMovReserva({ sentido: 'deposito', monto: '', fecha: '2026-10-16' }, ctx).campo, 'monto');
  assert.equal(validarMovReserva({ sentido: 'deposito', monto: '5', fecha: '2026-10-17' }, ctx).campo, 'fecha');
  assert.equal(validarMovReserva({ sentido: 'retiro', monto: '100,01', fecha: '2026-10-16' }, ctx).campo, 'monto');
  assert.deepEqual(validarMovReserva({ sentido: 'retiro', monto: '100', fecha: '2026-10-16', nota: ' sueldo ' }, ctx).fila, { sentido: 'retiro', monto: 100, fecha: '2026-10-16', nota: 'sueldo' });
  assert.equal(validarMovReserva({ sentido: 'x', monto: '1', fecha: '2026-10-16' }, ctx).campo, 'sentido');
});

test('reserva manual: mismo día manda el orden de carga (created_at), no depósito antes que ajuste', () => {
  const bm = { id: 'b1', nombre: 'Sobre', tipo: 'apartado', origen: 'manual' };
  const a = { id: 'a1', bolsillo_id: 'b1', fecha: '2026-10-16', saldo_real: 100, created_at: '2026-10-16T10:00:00Z' };
  const dep = { id: 'z', fecha: '2026-10-16', monto: 50, tipo: 'reserva', bolsillo_id: 'b1', direccion: 'salida', manual: true, created_at: '2026-10-16T11:00:00Z' };
  assert.equal(estadoReserva(bm, [dep], [a]).saldo, 150); // creaste la reserva con 100 y después pusiste 50
  const antes = { ...dep, created_at: '2026-10-16T09:00:00Z' };
  assert.equal(estadoReserva(bm, [antes], [a]).saldo, 100); // el saldo real se cargó después y lo pisa
  // Importada: el saldo real del día ya incluye los movimientos del día
  assert.equal(estadoReserva({ ...bm, origen: 'importada' }, [dep], [a]).saldo, 100);
});

test('saldoAl: un retiro con fecha anterior a los depósitos no pasa', () => {
  const e = estadoReserva(b, [mov('1', '2026-10-10', 'salida', 100)]);
  assert.equal(saldoAl(e, '2026-10-05'), 0);
  assert.equal(saldoAl(e, '2026-10-10'), 100);
  assert.equal(saldoAl(e, '2026-10-20'), 100);
  assert.equal(validarMovReserva({ sentido: 'retiro', monto: '50', fecha: '2026-10-05' }, { saldo: saldoAl(e, '2026-10-05'), hoy: '2026-10-16' }).campo, 'monto');
});

test('validarReserva: saldo inválido se rechaza y editar con el estado conserva la fecha de la cotización', () => {
  const ok = { nombre: 'X', moneda: 'EUR', medio: 'digital', tipo: 'ahorro', saldo: 'abc', cotizacion: '1700' };
  assert.equal(validarReserva(ok, { hoy: '2026-10-16' }).campo, 'saldo');
  const estado = { id: 'q', nombre: 'X', cotizacion: 1700, cotizacionFecha: '2026-09-01' };
  assert.equal(validarReserva({ ...ok, saldo: '' }, { editando: estado, hoy: '2026-10-16' }).fila.cotizacion_fecha, '2026-09-01');
});
