import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartir, saldos, simplificar, resumenGrupo, nombreCoincide, sugerirPagos, totales, leerValores } from './compartidos.js';

// Datos ficticios.
const suma = (r) => Math.round(r.partes.reduce((s, x) => s + x.monto, 0) * 100) / 100;

test('repartir: iguales reparte centavos y suma exacto', () => {
  const r = repartir(100, 'iguales', [{ p: 'a' }, { p: 'b' }, { p: 'c' }]);
  assert.deepEqual(r.partes.map((x) => x.monto), [33.34, 33.33, 33.33]);
  assert.equal(suma(r), 100);
});

test('repartir: montos, porcentajes y partes', () => {
  assert.equal(suma(repartir(1000, 'montos', [{ p: 'a', valor: 600 }, { p: 'b', valor: 400 }])), 1000);
  assert.match(repartir(1000, 'montos', [{ p: 'a', valor: 600 }, { p: 'b', valor: 300 }]).error, /faltan \$100/);
  const pc = repartir(999.99, 'porcentajes', [{ p: 'a', valor: 60 }, { p: 'b', valor: 40 }]);
  assert.equal(suma(pc), 999.99);
  assert.match(repartir(100, 'porcentajes', [{ p: 'a', valor: 60 }, { p: 'b', valor: 30 }]).error, /100%/);
  assert.equal(suma(repartir(100, 'porcentajes', [{ p: 'a', valor: 33.33 }, { p: 'b', valor: 33.33 }, { p: 'c', valor: 33.33 }])), 100);
  assert.match(repartir(100, 'partes', leerValores('partes', ['a', 'b'], { a: '2' })).error, /Completá/);
  const pt = repartir(300, 'partes', [{ p: 'a', valor: 2 }, { p: 'b', valor: 1 }]);
  assert.deepEqual(pt.partes.map((x) => x.monto), [200, 100]);
  // Quien queda en 0 no figura.
  assert.equal(repartir(100, 'partes', [{ p: 'a', valor: 1 }, { p: 'b', valor: 0 }]).partes.length, 1);
  assert.match(repartir(0, 'iguales', [{ p: 'a' }]).error, /monto/);
  assert.match(repartir(10, 'iguales', []).error, /quiénes/);
});

const ps = [{ id: 'yo', grupo_id: 'g', nombre: 'Yo', es_yo: true }, { id: 'juan', grupo_id: 'g', nombre: 'Juan Pérez' }, { id: 'ana', grupo_id: 'g', nombre: 'Ana' }];
const gastos = [
  { grupo_id: 'g', monto: 300, pagado_por: 'yo', partes: [{ p: 'yo', monto: 100 }, { p: 'juan', monto: 100 }, { p: 'ana', monto: 100 }] },
  { grupo_id: 'g', monto: 60, pagado_por: 'ana', partes: [{ p: 'yo', monto: 20 }, { p: 'juan', monto: 20 }, { p: 'ana', monto: 20 }] }
];

test('saldos y simplificar', () => {
  const s = saldos(ps, gastos, [{ de: 'juan', a: 'yo', monto: 50 }]);
  assert.equal(s.get('yo'), 130); // puso 300, le tocan 120, recibió 50
  assert.equal(s.get('juan'), -70);
  assert.equal(s.get('ana'), -60);
  const t = simplificar(s);
  assert.deepEqual(t, [{ de: 'juan', a: 'yo', monto: 70 }, { de: 'ana', a: 'yo', monto: 60 }]);
  assert.deepEqual(simplificar(new Map([['a', 0], ['b', 0]])), []);
});

test('resumenGrupo desde mi lado', () => {
  const r = resumenGrupo({ id: 'g', moneda: 'ARS' }, ps, gastos, []);
  assert.equal(r.miSaldo, 180); assert.equal(r.total, 360); assert.equal(r.miParte, 120); assert.equal(r.aMano, false);
});

test('nombreCoincide: todas las palabras, sin tildes ni orden', () => {
  assert.equal(nombreCoincide('Juan Pérez', 'PEREZ JUAN CARLOS'), true);
  assert.equal(nombreCoincide('Juan', 'Juan Carlos Gomez'), true);
  assert.equal(nombreCoincide('Juan Pérez', 'Juan Gomez'), false);
  assert.equal(nombreCoincide('Al', 'Al Pacino'), false); // muy corto
  assert.equal(nombreCoincide('Juan Pérez', 'PEREZ, JUAN.'), true); // puntuación
  assert.equal(nombreCoincide('María José Gómez', 'MARIA-JOSE GOMEZ'), true);
});

test('sugerirPagos: entradas de quien te debe, sin pasar la deuda', () => {
  const r = resumenGrupo({ id: 'g', moneda: 'ARS', archivado: false }, ps, gastos, []);
  r.grupo = { id: 'g', moneda: 'ARS', archivado: false };
  // Juan debe 120 al grupo; aunque el greedy lo puede mandar a otro: igual se sugiere hasta lo que me deben a mí.
  assert.equal(sugerirPagos([r], [{ id: 'z', moneda: 'ARS', tipo: 'ingreso', direccion: 'entrada', contraparte: 'Juan Perez', monto: 120, fecha: '2026-10-01' }])[0].debe, 120);
  // Pago a mano igual ya cargado: no se sugiere.
  const conPago = { ...r, pagos: [{ de: 'juan', a: 'yo', monto: 80, fecha: '2026-10-02' }] };
  const mov = (o) => ({ id: Math.random().toString(36).slice(2), moneda: 'ARS', tipo: 'ingreso', direccion: 'entrada', ...o });
  const ok = mov({ contraparte: 'PEREZ JUAN', monto: 80 });
  const s = sugerirPagos([r], [ok, mov({ contraparte: 'Juan Perez', monto: 500 }), mov({ contraparte: 'Pedro', monto: 10 }), mov({ contraparte: 'Ana Lopez', monto: 60, compartido_descartado: true })]);
  assert.equal(s.length, 1);
  assert.equal(s[0].mov.id, ok.id); assert.equal(s[0].de, 'juan'); assert.equal(s[0].a, 'yo');
  assert.equal(sugerirPagos([r], [ok], new Set([ok.id])).length, 0);
  assert.equal(sugerirPagos([conPago], [{ ...ok, fecha: '2026-10-02' }]).length, 0);
  assert.equal(sugerirPagos([r], [{ ...ok, tipo: 'recupero' }]).length, 0);
  // Una salida mía a Juan no es pago: yo no le debo.
  assert.equal(sugerirPagos([r], [mov({ contraparte: 'Juan Perez', monto: 10, direccion: 'salida', tipo: 'gasto' })]).length, 0);
});

test('totales y leerValores', () => {
  const t = totales([{ grupo: { moneda: 'ARS' }, miSaldo: 100 }, { grupo: { moneda: 'ARS' }, miSaldo: -40 }, { grupo: { moneda: 'USD' }, miSaldo: 999 }, { grupo: { moneda: 'ARS', archivado: true }, miSaldo: 5 }]);
  assert.deepEqual(t, { teDeben: 100, debes: 40 });
  assert.deepEqual(leerValores('montos', ['a'], { a: '1.500,50' }), [{ p: 'a', valor: 1500.5 }]);
  assert.deepEqual(leerValores('porcentajes', ['a'], { a: '33,5' }), [{ p: 'a', valor: 33.5 }]);
});
