import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMonto, fechaISO } from './util.js';
import { parseGalicia, esGalicia } from './parsers/galicia.js';
import { parseMercadoPagoPdf, esMercadoPagoTexto } from './parsers/mercadopago-pdf.js';
import { parseTabular } from './parsers/tabular.js';
import { interpretar } from './detectar.js';
import { clasificar, esPropio, tipoBolsillo } from './clasificar.js';
import { armarPlan } from './plan.js';
import { resumenPlatita, resumenBilletera, rangoMes, moverMes } from './resumen.js';

// Datos ficticios (no reales) con la forma exacta de los exports.
const TIT = { nombre: 'Juana Perez Gomez', cuit: '27111111114' };
const GAL = [
  ['Banco Galicia - Caja Ahorro Pesos'], ['Nro. de Cuenta: ...1234567'], ['Fecha Actual: 5/10/2026'], ['Hora Actual: 18:44'],
  ['Intervalo de Consulta: del 01/09/2026 al 06/10/2026'],
  ['Fecha', 'Movimiento', 'Débito', 'Crédito', 'Saldo Parcial', 'Comentarios'],
  ['02/10/2026', ' TRANSF. CTAS PROPIAS\n Juana Perez Gomez\n 27111111114\n VARIOS\n MERCADO LIBRE SRL\n', '-500.000,00', '0,00', '0,50', null],
  ['02/10/2026', ' PAGO TARJETA VISA\n OPERACION 2132629218\n', '-300.000,00', '0,00', '500000,50', null],
  ['02/10/2026', ' ACREDITAMIENTO DE HABERES\n EMPRESA SA\n 30707816836\n', '0,00', '800.000,00', '800000,50', null],
  ['22/09/2026', ' INTERES CAPITALIZADO\n Septiembre 2026\n', '0,00', '0,08', '0,50', null],
  ['20/09/2026', ' TRANSFERENCIA DE TERCEROS\n Pedro Lopez\n 20222222223\n', '0,00', '0,42', '0,42', null]
];

const MP_PAGINAS = [{ items: [
  { x: 258, y: 593, str: 'RESUMEN DE CUENTA EN PESOS' }, { x: 326, y: 580, str: 'Juana Perez Gomez' },
  { x: 188, y: 570, str: 'CVU:' }, { x: 209, y: 570, str: '0000003100000000001234' }, { x: 318, y: 570, str: 'CUIT/ CUIL:' }, { x: 364, y: 570, str: '27111111114' },
  { x: 175, y: 522, str: 'Entradas:' }, { x: 208, y: 522, str: '$ 1.001,50' }, { x: 175, y: 509, str: 'Salidas:' }, { x: 203, y: 509, str: '$ -700,00' },
  { x: 41, y: 442, str: 'Fecha' }, { x: 89, y: 442, str: 'Descripción' }, { x: 197, y: 446, str: 'ID de la' }, { x: 197, y: 438, str: 'operación' }, { x: 312, y: 442, str: 'Valor' }, { x: 384, y: 442, str: 'Saldo' },
  { x: 41, y: 412, str: '01-09-2026' }, { x: 89, y: 413, str: 'Rendimientos' }, { x: 197, y: 412, str: '1749232191752' }, { x: 315, y: 412, str: '$ 1,50' }, { x: 372, y: 412, str: '$ 1,50' },
  { x: 89, y: 392, str: 'Transferencia recibida' }, { x: 41, y: 382, str: '02-09-2026' }, { x: 89, y: 382, str: 'JUANA PEREZ' }, { x: 197, y: 382, str: '177038156928' }, { x: 305, y: 382, str: '$ 1.000,00' }, { x: 371, y: 382, str: '$ 1.001,50' }, { x: 89, y: 372, str: 'GOMEZ' },
  { x: 41, y: 352, str: '03-09-2026' }, { x: 89, y: 353, str: 'Dinero reservado Expensas' }, { x: 197, y: 352, str: '176080499947' }, { x: 305, y: 352, str: '$ -500,00' }, { x: 371, y: 352, str: '$ 501,50' },
  { x: 41, y: 322, str: '04-09-2026' }, { x: 89, y: 323, str: 'Pago SUBE' }, { x: 197, y: 322, str: '176080499948' }, { x: 305, y: 322, str: '$ -200,00' }, { x: 371, y: 322, str: '$ 301,50' }
] }];

test('parseMonto: es-AR, inglés, signos', () => {
  assert.equal(parseMonto('-2.484.858,00'), -2484858);
  assert.equal(parseMonto('2484858,16'), 2484858.16);
  assert.equal(parseMonto('$ -1.234,56'), -1234.56);
  assert.equal(parseMonto('1,234.56'), 1234.56);
  assert.equal(parseMonto('1.234'), 1234);
  assert.equal(parseMonto('abc'), null);
});

test('fechaISO sin corrimiento de zona', () => {
  assert.equal(fechaISO('02/10/2026'), '2026-10-02');
  assert.equal(fechaISO('03-09-2026'), '2026-09-03');
  assert.equal(fechaISO('2026-09-03T00:00:00'), '2026-09-03');
  assert.equal(fechaISO('31/13/2026'), null);
});

test('Galicia: lee, encadena saldos y detecta titular', () => {
  assert.ok(esGalicia(GAL));
  const r = parseGalicia(GAL);
  assert.equal(r.movimientos.length, 5);
  assert.equal(r.validacion.ok, true);
  assert.equal(r.cuenta.numero, '...1234567');
  assert.deepEqual(r.titular, { nombre: 'Juana Perez Gomez', cuit: '27111111114' });
  assert.equal(r.movimientos[1].id_externo, '2132629218');
  assert.equal(r.movimientos[0].direccion, 'salida');
});

test('Galicia: un saldo roto se detecta', () => {
  const malo = GAL.map((f) => [...f]); malo[8][4] = '999,00';
  assert.equal(parseGalicia(malo).validacion.ok, false);
});

test('Mercado Pago PDF: descripción en varios renglones, totales que validan', () => {
  const r = parseMercadoPagoPdf(MP_PAGINAS);
  assert.ok(esMercadoPagoTexto('RESUMEN DE CUENTA EN PESOS CVU: 1 Entradas:'));
  assert.equal(r.movimientos.length, 4);
  assert.equal(r.movimientos[1].descripcion, 'Transferencia recibida JUANA PEREZ GOMEZ');
  assert.equal(r.validacion.ok, true);
  assert.equal(r.titular.cuit, '27111111114');
  assert.equal(r.titular.nombre, 'Juana Perez Gomez');
});

test('Planilla genérica con Débito/Crédito y con importe con signo', () => {
  const a = parseTabular([['Fecha', 'Concepto', 'Débito', 'Crédito', 'Saldo'], ['01/09/2026', 'Café', '1.000,00', '', '5.000,00'], ['02/09/2026', 'Sueldo', '', '10.000,00', '15.000,00']]);
  assert.equal(a.movimientos.length, 2);
  assert.equal(a.movimientos[0].direccion, 'salida');
  const b = parseTabular([['Fecha', 'Descripción', 'Monto'], ['2026-09-01', 'Café', '-1000.50']]);
  assert.equal(b.movimientos[0].monto, 1000.5);
  assert.equal(parseTabular([['a', 'b'], ['1', '2']]).ok, false);
});

test('interpretar elige el lector por contenido', () => {
  assert.equal(interpretar({ tipo: 'hoja', hojas: [{ filas: GAL }] }).origen, 'galicia');
  assert.equal(interpretar({ tipo: 'pdf', paginas: MP_PAGINAS, texto: 'RESUMEN DE CUENTA EN PESOS CVU: x Entradas:' }).origen, 'mercadopago');
  assert.equal(interpretar({ tipo: 'pdf', paginas: [], texto: 'otro banco' }).ok, false);
});

test('clasificar Galicia: sueldo, interés, tarjeta, cuentas propias, terceros a revisar', () => {
  const r = parseGalicia(GAL).movimientos;
  const c = (m) => clasificar(m, { origen: 'galicia', titulares: [TIT] });
  assert.equal(c(r[0]).tipo, 'transferencia_interna');
  assert.equal(c(r[0]).cuenta_en_presupuesto, false);
  assert.equal(c(r[1]).tipo, 'pago_tarjeta');
  assert.deepEqual([c(r[2]).tipo, c(r[2]).categoria, c(r[2]).naturaleza], ['ingreso', 'Sueldo', 'activo']);
  assert.deepEqual([c(r[3]).categoria, c(r[3]).naturaleza], ['Rendimientos', 'pasivo']);
  assert.deepEqual([c(r[4]).tipo, c(r[4]).estado], ['ingreso', 'revisar']);
});

test('clasificar Mercado Pago: propio, reserva, SUBE', () => {
  const r = parseMercadoPagoPdf(MP_PAGINAS).movimientos;
  const c = (m) => clasificar(m, { origen: 'mercadopago', titulares: [TIT] });
  assert.equal(c(r[0]).naturaleza, 'pasivo');
  assert.equal(c(r[1]).tipo, 'transferencia_interna');
  assert.deepEqual([c(r[2]).tipo, c(r[2]).bolsillo, c(r[2]).modulo], ['reserva', 'Expensas', 'alcancia']);
  assert.equal(c(r[3]).categoria, 'Transporte');
  assert.equal(tipoBolsillo('Emergencia'), 'ahorro');
  assert.equal(tipoBolsillo('Expensas'), 'apartado');
  assert.equal(esPropio('FARINELLI MAXIMILIANO IVAN', [{ nombre: 'Maximiliano Ivan Farinelli' }]), true);
  assert.equal(esPropio('Maximiliano Gomez', [{ nombre: 'Maximiliano Ivan Farinelli' }]), false);
});

test('plan: reimportar no duplica y dos movimientos idénticos el mismo día cuentan dos veces', async () => {
  const filas = [['Fecha', 'Concepto', 'Monto'], ['01/09/2026', 'Café', '-1000'], ['01/09/2026', 'Café', '-1000']];
  const archivos = [{ nombre: 'x.csv', hash: 'h1', resultado: parseTabular(filas) }];
  const p1 = await armarPlan(archivos);
  assert.equal(p1.archivos[0].nuevos.length, 2);
  const existentes = new Set(p1.archivos[0].nuevos.map((m) => m.huella));
  const p2 = await armarPlan(archivos, { huellasExistentes: existentes });
  assert.equal(p2.archivos[0].nuevos.length, 0);
  assert.equal(p2.archivos[0].duplicados, 2);
  // Un archivo ya importado no se bloquea: solo carga lo que falte (por si la vez anterior falló a medias).
  const p3 = await armarPlan(archivos, { hashesImportados: new Set(['h1']), huellasExistentes: new Set([p1.archivos[0].nuevos[0].huella]) });
  assert.equal(p3.archivos[0].yaImportado, true);
  assert.equal(p3.archivos[0].nuevos.length, 1);
});

test('plan: titular de Mercado Pago reconoce la transferencia propia de Galicia en el mismo lote', async () => {
  const sinTitular = GAL.map((f) => [...f]);
  sinTitular[6][1] = ' CREDITO TRANSFERENCIA\n JUANA PEREZ GOMEZ\n 27111111114\n';
  sinTitular[6][2] = '0,00'; sinTitular[6][3] = '500.000,00';
  const p = await armarPlan([
    { nombre: 'g', resultado: { ...parseGalicia(sinTitular), validacion: { ok: true } } },
    { nombre: 'm', resultado: parseMercadoPagoPdf(MP_PAGINAS) }
  ]);
  assert.equal(p.archivos[0].nuevos[0].tipo, 'transferencia_interna');
  const bols = p.archivos[1].bolsillosNuevos;
  assert.deepEqual(bols, [{ nombre: 'Expensas', tipo: 'apartado' }]);
});

test('ids repetidos o columnas que no son id no colapsan movimientos', async () => {
  const filas = [['Fecha', 'Tipo de operación', 'Monto'], ['01/09/2026', 'Pago', '-10'], ['01/09/2026', 'Pago', '-20']];
  const r = parseTabular(filas);
  assert.equal(r.movimientos[0].id_externo, null);
  const conId = parseTabular([['Fecha', 'Descripción', 'Monto', 'Comprobante'], ['01/09/2026', 'a', '-10', 'X'], ['02/09/2026', 'b', '-20', 'X']]);
  const p = await armarPlan([{ nombre: 'c', resultado: conId }]);
  assert.equal(p.archivos[0].nuevos.length, 2);
});

test('PDF y planilla de Mercado Pago comparten cuenta', async () => {
  const { claveCuenta } = await import('./huella.js');
  assert.equal(claveCuenta({ institucion: 'mercadopago', numero: '…260948' }), claveCuenta({ institucion: 'mercadopago', numero: null }));
});

test('dirección: una devolución que sale no es ingreso; un familiar con CUIT distinto no es propio', () => {
  const c = clasificar({ descripcion: 'Devolución de pago', direccion: 'salida', monto: 10 }, { origen: 'mercadopago' });
  assert.equal(c.tipo, 'gasto');
  assert.equal(esPropio('CREDITO TRANSFERENCIA Maximiliano Farinelli 20111111112', [{ nombre: 'Maximiliano Ivan Farinelli', cuit: '20368995887' }]), false);
  assert.equal(esPropio('Transferencia enviada Maximiliano Farinelli', [{ nombre: 'Maximiliano Ivan Farinelli' }]), false);
  assert.equal(clasificar({ descripcion: 'Pago Uber Eats', direccion: 'salida', monto: 1 }, { origen: 'mercadopago' }).categoria, 'Delivery');
  assert.equal(clasificar({ descripcion: 'Pago PRESTAMO PERSONAL', direccion: 'salida', monto: 1 }, { origen: 'mercadopago' }).categoria, 'Deudas');
  const resumen = resumenBilletera([{ tipo: 'gasto', estado: 'confirmado', direccion: 'salida', monto: 100, categoria: 'Otros' }, { tipo: 'gasto', estado: 'confirmado', direccion: 'entrada', monto: 30, categoria: 'Otros' }]);
  assert.equal(resumen.total, 70);
});

test('resúmenes: a revisar no suman; reservas aparte; meses', () => {
  const movs = [
    { tipo: 'ingreso', estado: 'confirmado', naturaleza: 'activo', monto: 100, categoria: 'Sueldo' },
    { tipo: 'ingreso', estado: 'confirmado', naturaleza: 'pasivo', monto: 5, categoria: 'Rendimientos' },
    { tipo: 'ingreso', estado: 'revisar', naturaleza: 'activo', monto: 50 },
    { tipo: 'gasto', estado: 'confirmado', monto: 30, categoria: 'Transporte' },
    { tipo: 'gasto', estado: 'revisar', monto: 7 },
    { tipo: 'reserva', direccion: 'salida', monto: 40, bolsillo: { tipo: 'apartado' } },
    { tipo: 'reserva', direccion: 'entrada', monto: 10, bolsillo: { tipo: 'apartado' } },
    { tipo: 'reserva', direccion: 'salida', monto: 20, bolsillo: { tipo: 'ahorro' } },
    { tipo: 'pago_tarjeta', monto: 900 }
  ];
  const p = resumenPlatita(movs);
  assert.deepEqual([p.total, p.activos, p.pasivos, p.revisar.length], [105, 100, 5, 1]);
  const b = resumenBilletera(movs);
  assert.deepEqual([b.total, b.revisar.length, b.apartado, b.ahorrado, b.pagosTarjeta], [30, 1, 30, 20, 900]);
  assert.deepEqual(rangoMes('2026-02'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.equal(moverMes('2026-01', -1), '2025-12');
});

test('polyfill de ReadableStream para Safari: agrega for-await solo si falta', async () => {
  const { polyfillReadableStream } = await import('./leer.js');
  class RSFalso { constructor(datos) { this.datos = datos; } getReader() { const d = [...this.datos]; return { read: async () => (d.length ? { done: false, value: d.shift() } : { done: true }), releaseLock() {} }; } }
  assert.equal(polyfillReadableStream(RSFalso), true);
  const vistos = [];
  for await (const v of new RSFalso([1, 2, 3])) vistos.push(v);
  assert.deepEqual(vistos, [1, 2, 3]);
  assert.equal(polyfillReadableStream(RSFalso), false); // no pisa si ya existe
});

test('recupero: no es ingreso; sin tarjeta resta del gasto y su categoría; con tarjeta va aparte', async () => {
  const movs = [
    { tipo: 'gasto', estado: 'confirmado', direccion: 'salida', monto: 40000, categoria: 'Supermercado' },
    { tipo: 'recupero', estado: 'confirmado', direccion: 'entrada', monto: 30000, categoria: 'Supermercado' },
    { tipo: 'recupero', estado: 'confirmado', direccion: 'entrada', monto: 5000, vinculo_tarjeta: { alcance: 'cuota', cuota_numero: 2 } }
  ];
  const b = resumenBilletera(movs);
  assert.deepEqual([b.bruto, b.total, b.recuperado, b.recuperadoTarjeta], [40000, 10000, 35000, 5000]);
  assert.equal(b.porCategoria.find((c) => c.categoria === 'Supermercado').total, 10000);
  assert.equal(resumenPlatita(movs).total, 0);
});

test('regla por contraparte: las transferencias de esa persona entran como recupero', async () => {
  const { aplicarRegla } = await import('./plan.js');
  const reglas = [{ contraparte: 'tomas lopez', direccion: 'entrada', tipo: 'recupero', categoria_id: 'cat1' }];
  const m = aplicarRegla({ tipo: 'ingreso', estado: 'revisar', contraparte: 'Tomás López', direccion: 'entrada', naturaleza: 'activo' }, reglas);
  const sueldo = aplicarRegla({ tipo: 'ingreso', estado: 'confirmado', categoria: 'Sueldo', contraparte: 'Tomás López', direccion: 'entrada' }, reglas);
  assert.equal(sueldo.tipo, 'ingreso'); // lo ya reconocido no se pisa
  assert.deepEqual([m.tipo, m.estado, m.categoria_id, m.naturaleza, m.modulo], ['recupero', 'confirmado', 'cat1', null, 'billetera']);
  const otra = aplicarRegla({ tipo: 'gasto', estado: 'revisar', contraparte: 'Tomás López', direccion: 'salida' }, reglas);
  assert.equal(otra.tipo, 'gasto');
  const interna = aplicarRegla({ tipo: 'transferencia_interna', contraparte: 'Tomás López', direccion: 'entrada' }, reglas);
  assert.equal(interna.tipo, 'transferencia_interna');
});

test('presupuesto del mes real: ingresos − tarjetas − sin tarjeta + recuperos de tarjeta; libre descuenta reservas', async () => {
  const { presupuestoDelMes, historial } = await import('./presupuesto.js');
  const movs = [
    { fecha: '2026-09-02', tipo: 'ingreso', estado: 'confirmado', direccion: 'entrada', naturaleza: 'activo', monto: 1000000 },
    { fecha: '2026-09-03', tipo: 'gasto', estado: 'confirmado', direccion: 'salida', monto: 200000, categoria: 'Supermercado' },
    { fecha: '2026-09-04', tipo: 'recupero', estado: 'confirmado', direccion: 'entrada', monto: 50000, vinculo_tarjeta: { alcance: 'total' } },
    { fecha: '2026-09-05', tipo: 'reserva', direccion: 'salida', monto: 100000, bolsillo: { tipo: 'apartado' } },
    { fecha: '2026-09-06', tipo: 'pago_tarjeta', direccion: 'salida', monto: 600000 },
    { fecha: '2026-09-07', tipo: 'ingreso', estado: 'revisar', direccion: 'entrada', monto: 9999 }
  ];
  const p = presupuestoDelMes('2026-09', movs, { total: 600000, tipo: 'pagado', usd: 0 });
  assert.deepEqual([p.ingresos, p.tarjetas, p.sinTarjeta, p.recuperosTarjeta, p.teQueda, p.apartado, p.libre, p.pendientes],
    [1000000, 600000, 200000, 50000, 250000, 100000, 150000, 1]);
  const sin = presupuestoDelMes('2026-09', movs, null);
  assert.deepEqual([sin.tarjetasTipo, sin.tarjetas], ['desde_cuentas', 600000]); // sin Tarjeteando: lo pagado desde cuentas
  assert.equal(presupuestoDelMes('2026-09', [], null).tarjetasTipo, 'sin_datos');
  const h = historial('2026-09', movs, { '2026-09': { total: 600000, tipo: 'pagado', usd: 0 } }, 3);
  assert.deepEqual(h.map((x) => x.mesKey), ['2026-09', '2026-08', '2026-07']);
  assert.equal(h[0].teQueda, 250000);
});

test('categorías: renombrar una del sistema la reemplaza; el clasificador usa la nueva', async () => {
  const { categoriasVisibles, resolverCategoria, nombreOcupado } = await import('./categorias.js');
  const todas = [
    { id: 's1', user_id: null, nombre: 'Supermercado', tipo: 'gasto' },
    { id: 's2', user_id: null, nombre: 'Sueldo', tipo: 'ingreso' },
    { id: 'u1', user_id: 'yo', nombre: 'Almacén y súper', tipo: 'gasto', reemplaza: 's1' },
    { id: 'u2', user_id: 'yo', nombre: 'Mascotas', tipo: 'gasto' }
  ];
  assert.deepEqual(categoriasVisibles(todas, 'gasto').map((c) => c.id), ['u1', 'u2']);
  assert.equal(resolverCategoria('Supermercado', 'gasto', todas), 'u1');
  assert.equal(resolverCategoria('Sueldo', 'ingreso', todas), 's2');
  assert.equal(resolverCategoria('Inexistente', 'gasto', todas), null);
  assert.equal(nombreOcupado('mascotas', 'gasto', todas), true);
  assert.equal(nombreOcupado('Supermercado', 'gasto', todas), true); // aunque esté oculta, la base sigue usando ese nombre
  assert.equal(nombreOcupado('Supermercado', 'gasto', todas, 'u1'), false); // volver al nombre original está bien
});
