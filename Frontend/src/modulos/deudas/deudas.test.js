import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeuda, puntaje, sugerirPagos, simular, compararPlanes, validarDeuda, manualParecido, itemsPlan, pagadoEnMes, adelantar, proximoVencimiento, masUrgente, cancelacionHoy } from './deudas.js';

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
  // cuotas fijas con TNA: se simula sobre el capital (valor presente de las 12 cuotas a 60 %)
  assert.equal(it[0].tasa, 60);
  assert.equal(it[0].fija, false);
  assert.ok(it[0].saldo > 440000 && it[0].saldo < 450000);
  const sinTasa = itemsPlan([{ ...prestamo, tasa_anual: null }], []);
  assert.equal(sinTasa[0].tasa, null); // sin tasa: la cuota ya trae los intereses
  assert.equal(sinTasa[0].fija, true);
  assert.equal(sinTasa[0].saldo, 600000);
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

test('plan con cuotas fijas y TNA: pagar justo la cuota termina en las cuotas que faltan; pagar de más adelanta y ahorra', () => {
  const [it] = itemsPlan([prestamo], []);
  const justo = simular([it], 50000);
  assert.equal(justo.meses, 12);
  const mas = simular([it], 80000);
  assert.ok(mas.meses < 12);
  assert.ok(mas.intereses < justo.intereses);
});

test('simular: primerMes reparte cuotas mínimas y el extra a la deuda prioritaria', () => {
  const r = simular([
    { id: 'cara', nombre: 'Cara', saldo: 500000, minimo: 20000, tasa: 120 },
    { id: 'chica', nombre: 'Chica', saldo: 100000, minimo: 10000, tasa: 10 }
  ], 100000);
  const cara = r.primerMes.find((x) => x.id === 'cara'); const chica = r.primerMes.find((x) => x.id === 'chica');
  assert.equal(chica.cuota, 10000); assert.equal(chica.extra, 0);
  assert.equal(cara.cuota, 20000); assert.equal(cara.extra, 70000);
  assert.equal(r.primerMes.reduce((s, x) => s + x.cuota + x.extra, 0), 100000);
});

test('adelantar: un pago extra acorta el plan y ahorra intereses; sin extra no cambia nada', () => {
  const items = [{ id: 'a', nombre: 'A', saldo: 500000, minimo: 30000, tasa: 100 }];
  const r = adelantar(items, 60000, 100000);
  assert.ok(r.mesesMenos > 0);
  assert.ok(r.ahorro > 0);
  assert.equal(r.aplicado, 100000);
  assert.equal(r.deuda, 'A');
  const cero = adelantar(items, 60000, 0);
  assert.equal(cero.mesesMenos, 0); assert.equal(cero.ahorro, 0);
  assert.equal(adelantar(items, 60000, 9e9).aplicado, 500000); // no más que lo que debés
});

test('proximoVencimiento: próxima, hoy, vencida, pagada este mes, mes corto y alta posterior', () => {
  const d = { id: 'd', estado: 'activa', dia_vencimiento: 10, cuota_monto: 10000, fecha_inicio: '2026-01-01', saldo_inicial: 1000000, moneda: 'ARS' };
  const pago = (monto, fecha) => ({ deuda_id: 'd', direccion: 'salida', monto, fecha });
  assert.deepEqual(proximoVencimiento(d, [], '2026-10-05'), { fecha: '2026-10-10', dias: 5, estado: 'proxima', pagadaEsteMes: false });
  assert.equal(proximoVencimiento(d, [], '2026-10-10').estado, 'hoy');
  const v = proximoVencimiento(d, [], '2026-10-14');
  assert.equal(v.estado, 'vencida'); assert.equal(v.dias, -4);
  const p = proximoVencimiento(d, [pago(10000, '2026-10-02')], '2026-10-14');
  assert.equal(p.fecha, '2026-11-10'); assert.equal(p.pagadaEsteMes, true);
  assert.equal(proximoVencimiento(d, [pago(1000, '2026-10-02')], '2026-10-14').estado, 'vencida'); // pago chico no cubre la cuota
  assert.equal(proximoVencimiento({ ...d, dia_vencimiento: 31 }, [], '2026-02-10').fecha, '2026-02-28');
  assert.equal(proximoVencimiento({ ...d, fecha_inicio: '2026-10-12' }, [], '2026-10-14').fecha, '2026-11-10'); // venció antes del alta
  assert.equal(proximoVencimiento({ ...d, dia_vencimiento: null }, [], '2026-10-14'), null);
  assert.equal(proximoVencimiento({ ...d, estado: 'saldada' }, [], '2026-10-14'), null);
  const libre = { ...d, cuota_monto: null };
  assert.equal(proximoVencimiento(libre, [pago(5, '2026-10-02')], '2026-10-14').pagadaEsteMes, true);
});

test('masUrgente: la vencida gana a la próxima', () => {
  const a = { id: 'a', estado: 'activa', dia_vencimiento: 20, cuota_monto: 1, fecha_inicio: '2026-01-01', saldo_inicial: 1000 };
  const b = { id: 'b', estado: 'activa', dia_vencimiento: 5, cuota_monto: 1, fecha_inicio: '2026-01-01', saldo_inicial: 1000 };
  assert.equal(masUrgente([a, b], [], '2026-10-10').deuda.id, 'b');
  assert.equal(masUrgente([{ ...a, dia_vencimiento: null }], [], '2026-10-10'), null);
});

test('cancelacionHoy: capital e intereses solo con cuotas fijas + TNA; cronograma cierra en 0', () => {
  const d = { ...prestamo, saldo_inicial: 600000, cuota_monto: 50000, cuotas_restantes: 12, tasa_anual: 60 };
  const c = cancelacionHoy(d, estadoDeuda(d, []));
  assert.ok(c.capital > 440000 && c.capital < 450000);
  assert.equal(Math.round(c.capital + c.intereses), 600000);
  assert.equal(c.cronograma.length, 12);
  assert.ok(c.cronograma[11].saldo < 0.1);
  assert.equal(cancelacionHoy({ ...d, tasa_anual: null }, estadoDeuda(d, [])), null);
  assert.equal(cancelacionHoy({ ...d, cuotas_restantes: null }, estadoDeuda(d, [])), null);
});

test('validarDeuda: día de vencimiento 1-31 o vacío', () => {
  const base = { nombre: 'P', tipo: 'prestamo', fecha_inicio: '2026-10-01', saldo_inicial: '1000' };
  assert.equal(validarDeuda({ ...base, dia_vencimiento: '10' }).fila.dia_vencimiento, 10);
  assert.equal(validarDeuda({ ...base, dia_vencimiento: '' }).fila.dia_vencimiento, null);
  assert.equal(validarDeuda({ ...base, dia_vencimiento: '32' }).campo, 'dia_vencimiento');
  assert.equal(validarDeuda({ ...base, dia_vencimiento: '2,5' }).campo, 'dia_vencimiento');
});

test('adelantar: el extra derrama a la siguiente deuda cuando cancela la primera', () => {
  const items = [{ id: 'a', nombre: 'A', saldo: 100000, minimo: 10000, tasa: 100 }, { id: 'b', nombre: 'B', saldo: 300000, minimo: 10000, tasa: 40 }];
  const r = adelantar(items, 60000, 150000);
  assert.equal(r.aplicado, 150000);
  assert.equal(r.deuda, 'A y B');
});

test('revisión 2: sin mes de más por redondeo del valor presente', () => {
  const d = { ...prestamo, saldo_inicial: 120000, cuota_monto: 10000, cuotas_restantes: 12, tasa_anual: 120 };
  const [it] = itemsPlan([d], []);
  assert.equal(simular([it], 10000).meses, 12);
  const c = cancelacionHoy(d, estadoDeuda(d, []));
  assert.equal(c.cronograma.at(-1).saldo, 0);
});

test('revisión 2: cuotas fijas con TNA y saldo propio simulan con la tasa', () => {
  const d = { ...prestamo, saldo_inicial: 80000, cuota_monto: 10000, cuotas_restantes: 12, tasa_anual: 120 };
  const [it] = itemsPlan([d], []);
  assert.equal(it.tasa, 120);
  assert.equal(it.saldo, 80000);
});

test('revisión 2: vencimiento suma pagos del mes, respeta moneda/alta y se apaga al saldar', () => {
  const d = { id: 'd', estado: 'activa', dia_vencimiento: 10, cuota_monto: 10000, fecha_inicio: '2026-01-01', saldo_inicial: 100000, moneda: 'ARS' };
  const p = (monto, fecha, extra = {}) => ({ deuda_id: 'd', direccion: 'salida', moneda: 'ARS', monto, fecha, ...extra });
  assert.equal(proximoVencimiento(d, [p(3000, '2026-10-02'), p(3000, '2026-10-03')], '2026-10-14').pagadaEsteMes, true);
  assert.equal(proximoVencimiento(d, [p(10000, '2026-10-02', { moneda: 'USD' })], '2026-10-14').estado, 'vencida');
  assert.equal(proximoVencimiento({ ...d, fecha_inicio: '2026-10-05' }, [p(10000, '2026-10-02')], '2026-10-14').estado, 'vencida');
  assert.equal(proximoVencimiento({ ...d, saldo_inicial: 100 }, [p(100, '2026-09-20')], '2026-10-05'), null);
});
