import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeuda, puntaje, sugerirPagos, simular, compararPlanes, validarDeuda, manualParecido, itemsPlan, pagadoEnMes } from './deudas.js';

// Datos ficticios.
const prestamo = { id: 'p1', nombre: 'Préstamo Banco Uno', tipo: 'prestamo', acreedor: 'Banco Uno', moneda: 'ARS', saldo_inicial: 600000, fecha_inicio: '2026-01-01', cuota_monto: 50000, cuotas_restantes: 12, tasa_anual: 60, palabra_clave: null, estado: 'activa' };
const persona = { id: 'q1', nombre: 'Le debo a Juan', tipo: 'persona', acreedor: 'Juan Perez', moneda: 'ARS', saldo_inicial: 100000, fecha_inicio: '2026-02-01', cuota_monto: null, cuotas_restantes: null, tasa_anual: null, palabra_clave: null, estado: 'activa' };
const mov = (o) => ({ id: Math.random().toString(36).slice(2), direccion: 'salida', moneda: 'ARS', tipo: 'gasto', estado: 'confirmado', deuda_id: null, deudas_descartadas: [], descripcion: '', contraparte: null, descripcion_original: '', ...o });

test('estadoDeuda: descuenta pagos desde el alta, no los anteriores', () => {
  const movs = [
    mov({ deuda_id: 'p1', monto: 50000, fecha: '2026-02-05' }),
    mov({ deuda_id: 'p1', monto: 50000, fecha: '2026-03-05' }),
    mov({ deuda_id: 'p1', monto: 50000, fecha: '2025-12-05' }), // antes del alta
    mov({ deuda_id: 'p1', monto: 50000, fecha: '2026-03-06', moneda: 'USD' }) // otra moneda
  ];
  const e = estadoDeuda(prestamo, movs);
  assert.equal(e.pagado, 100000);
  assert.equal(e.saldo, 500000);
  assert.equal(e.cuotasRestantes, 10);
  assert.equal(e.minimo, 50000);
  assert.equal(e.ultimoPago, '2026-03-05');
});

test('estadoDeuda: nunca negativo y mínimo acotado al saldo', () => {
  const e = estadoDeuda({ ...persona, cuota_monto: 80000 }, [mov({ deuda_id: 'q1', monto: 70000, fecha: '2026-02-10' })]);
  assert.equal(e.saldo, 30000);
  assert.equal(e.minimo, 30000);
  const f = estadoDeuda(persona, [mov({ deuda_id: 'q1', monto: 150000, fecha: '2026-02-10' })]);
  assert.equal(f.saldo, 0);
  assert.equal(f.progreso, 1);
});

test('puntaje: préstamo por monto de cuota + pista en el texto', () => {
  assert.ok(puntaje(prestamo, mov({ monto: 50500, fecha: '2026-04-01', descripcion: 'Debito cuota prestamo 123' })) > 0);
  // Mismo monto sin pista ni acreedor: no alcanza.
  assert.equal(puntaje(prestamo, mov({ monto: 50000, fecha: '2026-04-01', descripcion: 'Supermercado' })), 0);
  // Fuera de ±3%.
  assert.equal(puntaje(prestamo, mov({ monto: 53000, fecha: '2026-04-01', descripcion: 'cuota prestamo' })), 0);
  // Acreedor + pista sin cuota cargada: alcanza.
  assert.ok(puntaje({ ...prestamo, cuota_monto: null }, mov({ monto: 7000, fecha: '2026-04-01', descripcion: 'DEBITO CUOTA PRESTAMO BANCO UNO' })) > 0);
  // Categoría Deudas (por id, aunque la hayas renombrado) cuenta como pista.
  assert.ok(puntaje(prestamo, mov({ monto: 50000, fecha: '2026-04-01', descripcion: 'debito automatico', categoria_id: 'cd' }), { catDeudas: 'cd' }) > 0);
  // Solo el nombre del banco no alcanza (le comprás cosas también).
  assert.equal(puntaje(prestamo, mov({ monto: 7000, fecha: '2026-04-01', descripcion: 'Banco Uno comision' })), 0);
  // Nombre del banco + monto de cuota sí.
  assert.ok(puntaje(prestamo, mov({ monto: 50000, fecha: '2026-04-01', descripcion: 'Banco Uno debito' })) > 0);
});

test('puntaje: persona por contraparte con nombre completo', () => {
  assert.ok(puntaje(persona, mov({ monto: 20000, fecha: '2026-03-01', contraparte: 'JUAN PÉREZ' })) > 0);
  assert.equal(puntaje(persona, mov({ monto: 20000, fecha: '2026-03-01', contraparte: 'Juan Gomez' })), 0);
  assert.ok(puntaje(persona, mov({ monto: 20000, fecha: '2026-03-01', contraparte: 'PEREZ JUAN' })) >= 3); // otro orden
  // Antes del alta, entrada, ya vinculado, descartado o pago de tarjeta: no.
  assert.equal(puntaje(persona, mov({ monto: 1, fecha: '2026-01-15', contraparte: 'Juan Perez' })), 0);
  assert.equal(puntaje(persona, mov({ monto: 1, fecha: '2026-03-01', contraparte: 'Juan Perez', direccion: 'entrada' })), 0);
  assert.equal(puntaje(persona, mov({ monto: 1, fecha: '2026-03-01', contraparte: 'Juan Perez', deuda_id: 'x' })), 0);
  assert.equal(puntaje(persona, mov({ monto: 1, fecha: '2026-03-01', contraparte: 'Juan Perez', deudas_descartadas: ['q1'] })), 0);
  assert.equal(puntaje(persona, mov({ monto: 1, fecha: '2026-03-01', contraparte: 'Juan Perez', tipo: 'pago_tarjeta' })), 0);
  assert.equal(puntaje({ ...persona, estado: 'saldada' }, mov({ monto: 1, fecha: '2026-03-01', contraparte: 'Juan Perez' })), 0);
});

test('puntaje: palabra clave como palabra completa, sin tildes', () => {
  const atraso = { id: 'a1', nombre: 'Luz', tipo: 'atraso', acreedor: null, moneda: 'ARS', saldo_inicial: 30000, fecha_inicio: '2026-01-01', palabra_clave: 'Electrica', estado: 'activa' };
  assert.ok(puntaje(atraso, mov({ monto: 10000, fecha: '2026-02-01', descripcion: 'Pago Eléctrica Sur' })) > 0);
  assert.equal(puntaje(atraso, mov({ monto: 10000, fecha: '2026-02-01', descripcion: 'Electricasur' })), 0);
  // Atraso sin palabra clave: acreedor (sigla de 3 letras) + "plan de pago".
  const abl = { ...atraso, palabra_clave: null, acreedor: 'ABL' };
  assert.ok(puntaje(abl, mov({ monto: 10000, fecha: '2026-02-01', descripcion: 'PAGO ABL PLAN DE PAGO' })) > 0);
  assert.equal(puntaje(abl, mov({ monto: 10000, fecha: '2026-02-01', descripcion: 'PAGO ABL' })), 0);
});

test('sugerirPagos: una sugerencia por movimiento, la de mayor puntaje', () => {
  const m = mov({ monto: 50000, fecha: '2026-04-01', descripcion: 'cuota prestamo', contraparte: 'Juan Perez' });
  const s = sugerirPagos([prestamo, persona], [m, mov({ monto: 999, fecha: '2026-04-02', descripcion: 'kiosco' })]);
  assert.equal(s.length, 1);
  assert.equal(s[0].mov.id, m.id);
});

test('simular: sin tasa, ambos órdenes terminan igual; mínimos insuficientes avisan', () => {
  const items = [{ id: 'a', nombre: 'A', saldo: 100000, minimo: 10000, tasa: null }, { id: 'b', nombre: 'B', saldo: 50000, minimo: 0, tasa: null }];
  const av = simular(items, 30000, 'avalancha');
  const bo = simular(items, 30000, 'bola');
  assert.equal(av.meses, 5);
  assert.equal(bo.meses, 5);
  assert.equal(av.intereses, 0);
  assert.equal(bo.orden[0].id, 'b'); // la más chica primero
  assert.equal(simular(items, 5000).insuficiente, true);
  assert.equal(simular([], 1000).meses, 0);
});

test('simular: avalancha paga menos intereses cuando hay tasas distintas', () => {
  const items = [
    { id: 'cara', nombre: 'Cara', saldo: 500000, minimo: 20000, tasa: 120 },
    { id: 'chica', nombre: 'Chica', saldo: 100000, minimo: 10000, tasa: 10 }
  ];
  const c = compararPlanes(items, 120000);
  assert.ok(c.avalancha.intereses < c.bola.intereses);
  assert.equal(c.avalancha.orden[0].id, 'cara');
  assert.equal(c.bola.orden[0].id, 'chica');
  assert.equal(c.recomendada, 'avalancha');
});

test('simular: si la cuota no cubre el interés, nunca termina (con motivo)', () => {
  const r = simular([{ id: 'x', nombre: 'X', saldo: 1000000, minimo: 10000, tasa: 200 }], 10000);
  assert.equal(r.nunca, true);
  assert.equal(r.meses, null);
  assert.equal(r.motivo, 'intereses');
  assert.equal(simular([{ id: 'y', nombre: 'Y', saldo: 1000, minimo: 0, tasa: null }], 0).motivo, 'sin_monto');
  assert.equal(simular([{ id: 'z', nombre: 'Z', saldo: 1000000, minimo: 0, tasa: null }], 100).motivo, 'muy_largo');
});

test('compararPlanes: si solo uno termina, se recomienda ese; si ninguno, null', () => {
  const items = [{ id: 'cara', nombre: 'Cara', saldo: 1000000, minimo: 0, tasa: 110 }, { id: 'chica', nombre: 'Chica', saldo: 300000, minimo: 0, tasa: 0 }];
  const c = compararPlanes(items, 100000);
  assert.ok(c.avalancha.meses);
  assert.equal(c.bola.meses, null);
  assert.equal(c.recomendada, 'avalancha');
  assert.equal(compararPlanes(items, 1000).recomendada, null);
});

test('validarDeuda: montos es-AR, saldo desde cuotas, errores claros', () => {
  const base = { nombre: 'Préstamo', tipo: 'prestamo', fecha_inicio: '2026-10-01' };
  assert.equal(validarDeuda({ ...base, saldo_inicial: '1.500.000,50' }).fila.saldo_inicial, 1500000.5);
  assert.equal(validarDeuda({ ...base, cuota_monto: '50.000', cuotas_restantes: '12' }).fila.saldo_inicial, 600000);
  assert.match(validarDeuda({ ...base }).error, /debés/);
  assert.match(validarDeuda({ ...base, saldo_inicial: 'abc' }).error, /debés/);
  assert.match(validarDeuda({ ...base, saldo_inicial: '100', cuotas_restantes: '2.5' }).error, /cuotas/);
  assert.match(validarDeuda({ ...base, nombre: ' ', saldo_inicial: '1' }).error, /nombre/);
  assert.match(validarDeuda({ ...base, fecha_inicio: '', saldo_inicial: '1' }).error, /fecha/);
  assert.equal(validarDeuda({ ...base, saldo_inicial: '1000', tasa_anual: '85,5%' }).fila.tasa_anual, 85.5);
});

test('manualParecido y pagadoEnMes', () => {
  const pagos = [{ origen: 'manual', monto: 50000, fecha: '2026-04-01' }, { origen: 'galicia', monto: 50000, fecha: '2026-04-01' }];
  assert.ok(manualParecido(pagos, { monto: 50500, fecha: '2026-04-08' }));
  assert.equal(manualParecido(pagos, { monto: 50500, fecha: '2026-04-20' }), null);
  const movs = [mov({ deuda_id: 'p1', monto: 100, fecha: '2026-04-03' }), mov({ monto: 50, fecha: '2026-04-03' }),
    mov({ deuda_id: 'p1', monto: 70, fecha: '2026-04-04', tipo: 'transferencia_interna' }), mov({ deuda_id: 'p1', monto: 30, fecha: '2026-04-05', estado: 'revisar' })];
  assert.equal(pagadoEnMes(movs, '2026-04'), 100); // solo lo que Billetera ya restó
});

test('itemsPlan: solo activas en pesos con saldo', () => {
  const usd = { ...persona, id: 'u', moneda: 'USD' };
  const saldada = { ...persona, id: 's', estado: 'saldada' };
  const it = itemsPlan([prestamo, usd, saldada], []);
  assert.deepEqual(it.map((d) => d.id), ['p1']);
  assert.equal(it[0].tasa, null); // cuotas fijas: la tasa ya está en la cuota
  assert.equal(it[0].fija, true);
  const abierta = itemsPlan([{ ...prestamo, cuotas_restantes: null }], []);
  assert.equal(abierta[0].tasa, 60);
});

test('compararPlanes: una sola deuda o mismo resultado → iguales, sin "Conviene" falso', () => {
  const una = compararPlanes([{ id: 'p', nombre: 'P', saldo: 50000, minimo: 10000, tasa: null, fija: true }], 23000);
  assert.equal(una.iguales, true);
  assert.equal(una.avalancha.meses, 3);
  assert.equal(una.avalancha.intereses, 0);
  const distintas = compararPlanes([
    { id: 'cara', nombre: 'Cara', saldo: 500000, minimo: 20000, tasa: 120 },
    { id: 'chica', nombre: 'Chica', saldo: 100000, minimo: 10000, tasa: 10 }
  ], 120000);
  assert.equal(distintas.iguales, false);
});
