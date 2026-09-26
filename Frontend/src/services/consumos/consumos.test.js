import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseUltimosConsumos } from './index.js';
import { agruparBloques, aplicarArchivo, resumenCard, cardsEnCurso, conciliarConResumen, asignarBanco } from './ciclos.js';
import { parsearMontoConsumo } from '../consumos-parser.js';
import { fechaSegura } from './comun.js';
import { prepararMapeo, parseGenerico } from './generico.js';

const fx = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const r2 = (n) => Math.round(n * 100) / 100;
const vacio = () => ({ alias: {}, ciclos: {}, consumos: [] });
const gasto = (b) => b.consumos.filter((c) => !c.es_pago);
const suma = (arr, k) => r2(arr.reduce((s, c) => s + c[k], 0));

test('montos: es-AR, formato inglés y dólares', () => {
  assert.equal(parsearMontoConsumo('$1.234,56'), 1234.56);
  assert.equal(parsearMontoConsumo('$-1.334.010,48'), -1334010.48);
  assert.equal(parsearMontoConsumo('$ 25,942.50'), 25942.5);
  assert.equal(parsearMontoConsumo('$ 1,200,365.66'), 1200365.66);
  assert.equal(parsearMontoConsumo('U$D 30.84'), 30.84);
  assert.equal(parsearMontoConsumo('U$S41,14'), 41.14);
  assert.equal(parsearMontoConsumo('$1.500'), 1500);
  assert.equal(parsearMontoConsumo('-'), 0);
});

test('fecha imposible del banco (31/09) se corrige y se avisa', () => {
  assert.deepEqual(fechaSegura('31/09/2026'), { fecha: '2026-09-30', corregida: true });
  assert.deepEqual(fechaSegura('13/09/2026'), { fecha: '2026-09-13', corregida: false });
});

test('Santander Visa: 2 tablas (#3327 y #1510), totales exactos del banco', () => {
  const r = parseUltimosConsumos(fx('santander-visa').hojas);
  assert.equal(r.formato, 'santander');
  assert.deepEqual(r.bloques.map((b) => b.ult4), ['3327', '1510']);
  const [a, b] = r.bloques;
  assert.equal(suma(gasto(a), 'monto_pesos'), 848076.10);
  assert.equal(suma(gasto(a), 'monto_dolares'), 41.14);
  assert.equal(suma(gasto(b), 'monto_pesos'), 44166.55);
  assert.equal(gasto(a).filter((c) => c.es_cuota).length, 5);
  assert.equal(a.metadata.fecha_cierre, '2026-10-01');
  assert.equal(a.metadata.fecha_vencimiento, '2026-10-09');
  assert.equal(a.metadata.limite, 26204000);
  assert.equal(a.metadata.disponible, 23747782.30);
  assert.ok(r.bloques.every((x) => x.validado));
  assert.equal(r.warnings.length, 0);
});

test('Amex #2017: total exacto y pago aparte', () => {
  const r = parseUltimosConsumos(fx('santander-amex').hojas);
  assert.equal(r.bloques.length, 1);
  assert.equal(r.bloques[0].red, 'Amex');
  assert.equal(suma(gasto(r.bloques[0]), 'monto_pesos'), 28671.88);
  assert.equal(r.bloques[0].consumos.filter((c) => c.es_pago).length, 1);
});

test('Macro Visa #4246 (.xls): formato inglés, cuotas en la descripción, total del banco', () => {
  const r = parseUltimosConsumos(fx('macro-visa').hojas);
  assert.equal(r.formato, 'macro');
  assert.equal(r.banco_sugerido, 'Macro');
  assert.equal(r.bloques.length, 1);
  const b = r.bloques[0];
  assert.equal(b.ult4, '4246');
  assert.equal(b.red, 'Visa');
  assert.equal(gasto(b).length, 37);
  assert.equal(suma(gasto(b), 'monto_pesos'), 1200365.66);
  assert.equal(suma(gasto(b), 'monto_dolares'), 30.84);
  const cuotas = gasto(b).filter((c) => c.es_cuota);
  assert.equal(cuotas.length, 5);
  const ml = cuotas.find((c) => c.monto_pesos === 5793.52);
  assert.equal(ml.descripcion, 'MERPAGO*MERCADOLIBRE');
  assert.equal(ml.cuota_actual, 2); assert.equal(ml.total_cuotas, 6);
  assert.equal(b.metadata.fecha_cierre, '2026-09-13');
  assert.equal(b.metadata.fecha_vencimiento, '2026-09-30');
  assert.ok(r.warnings.some((w) => /inexistente/.test(w)));
  assert.ok(b.validado);
});

test('IDs únicos aunque haya filas idénticas', () => {
  const r = parseUltimosConsumos(fx('macro-visa').hojas);
  const ids = r.bloques.flatMap((b) => b.consumos.map((c) => c.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('SuperCard: mismo archivo + mismo cierre y vto → un grupo, datos compartidos una vez', () => {
  const r = parseUltimosConsumos(fx('santander-visa').hojas);
  const grupos = agruparBloques(r.bloques);
  assert.equal(grupos.length, 1);
  const est = aplicarArchivo({ grupos, asignaciones: { 0: { banco: 'Santander' } }, archivo: { id: 'f1', nombre: 'x.xlsx' }, estado: vacio() });
  const ciclo = Object.values(est.ciclos)[0];
  assert.deepEqual(ciclo.miembros, ['3327', '1510']);
  const d = resumenCard(ciclo, est.consumos, '2026-09-26');
  assert.equal(d.es_super, true);
  assert.equal(r2(d.total_ars), 892242.65);
  assert.equal(r2(d.total_usd), 41.14);
  assert.equal(r2(d.miembros[0].subtotal), 848076.10);
  assert.equal(r2(d.miembros[0].un_pago), 800998.66);
  assert.equal(r2(d.miembros[0].cuotas), 47077.44);
  assert.equal(r2(d.miembros[1].subtotal), 44166.55);
  assert.equal(d.dias_al_cierre, 5);
  assert.equal(est.alias['1510'].grupoKey, ciclo.grupoKey);
});

test('Excepción: mismo archivo con cierres distintos → Cards separadas marcadas como hermanas', () => {
  const r = parseUltimosConsumos(fx('santander-visa').hojas);
  r.bloques[1].metadata = { ...r.bloques[1].metadata, fecha_cierre: '2026-10-08', fecha_vencimiento: '2026-10-20' };
  const grupos = agruparBloques(r.bloques);
  assert.equal(grupos.length, 2);
  const est = aplicarArchivo({ grupos, asignaciones: { 0: { banco: 'Santander' }, 1: { banco: 'Santander' } }, archivo: { id: 'f1', nombre: 'x' }, estado: vacio() });
  const cards = cardsEnCurso(est.ciclos, est.consumos, '2026-09-26');
  assert.equal(cards.length, 2);
  assert.ok(cards.every((c) => !c.datos.es_super && c.hermanos.length === 1));
});

test('Subir el mismo archivo dos veces no duplica; un consumo anulado desaparece', () => {
  const hojas = fx('santander-visa').hojas;
  const g = agruparBloques(parseUltimosConsumos(hojas).bloques);
  let est = aplicarArchivo({ grupos: g, asignaciones: { 0: { banco: 'Santander' } }, archivo: { id: 'f1', nombre: 'a' }, estado: vacio() });
  est = aplicarArchivo({ grupos: g, archivo: { id: 'f2', nombre: 'a' }, estado: est }); // ya conocido: no pide banco
  assert.equal(r2(resumenCard(Object.values(est.ciclos)[0], est.consumos).total_ars), 892242.65);

  const g2 = agruparBloques(parseUltimosConsumos(hojas).bloques);
  g2[0].bloques[0].consumos = g2[0].bloques[0].consumos.filter((c) => c.descripcion !== 'Naturgy');
  est = aplicarArchivo({ grupos: g2, archivo: { id: 'f3', nombre: 'b' }, estado: est });
  assert.equal(r2(resumenCard(Object.values(est.ciclos)[0], est.consumos).total_ars), r2(892242.65 - 122835.27));
});

test('Archivo posterior con solo #3327 actualiza la misma SuperCard', () => {
  const g = agruparBloques(parseUltimosConsumos(fx('santander-visa').hojas).bloques);
  let est = aplicarArchivo({ grupos: g, asignaciones: { 0: { banco: 'Santander' } }, archivo: { id: 'f1', nombre: 'a' }, estado: vacio() });
  const solo = agruparBloques(parseUltimosConsumos(fx('santander-visa').hojas).bloques.slice(0, 1));
  est = aplicarArchivo({ grupos: solo, archivo: { id: 'f2', nombre: 'b' }, estado: est });
  assert.equal(Object.keys(est.ciclos).length, 1);
});

test('Amex y Santander Visa con igual cierre en archivos distintos NO se agrupan', () => {
  let est = aplicarArchivo({ grupos: agruparBloques(parseUltimosConsumos(fx('santander-visa').hojas).bloques), asignaciones: { 0: { banco: 'Santander' } }, archivo: { id: 'f1', nombre: 'a' }, estado: vacio() });
  est = aplicarArchivo({ grupos: agruparBloques(parseUltimosConsumos(fx('santander-amex').hojas).bloques), asignaciones: { 0: { banco: 'Santander' } }, archivo: { id: 'f2', nombre: 'b' }, estado: est });
  assert.equal(cardsEnCurso(est.ciclos, est.consumos, '2026-09-26').length, 2);
});

test('Conciliación: al importar el resumen del ciclo la Card sale de "en curso"; peajes iguales se emparejan 1 a 1', () => {
  const g = agruparBloques(parseUltimosConsumos(fx('santander-amex').hojas).bloques);
  let est = aplicarArchivo({ grupos: g, asignaciones: { 0: { banco: 'Santander' } }, archivo: { id: 'f1', nombre: 'a' }, estado: vacio() });
  const movs = [{ fecha_compra: '2026-09-13', monto_pesos: 994.15, monto_dolares: 0 }]; // solo 1 de los 2 peajes del 13/09
  const res = conciliarConResumen(est, { banco: 'Santander', tipo: 'AMEX', fecha_cierre: '2026-10-02' }, movs);
  assert.equal(res.conciliados.length, 1);
  assert.equal(res.consumos.filter((c) => c.estado === 'confirmado').length, 1);
  assert.equal(cardsEnCurso(res.ciclos, res.consumos, '2026-10-03').length, 0);
  // Otro banco o cierre lejano: no concilia
  assert.equal(conciliarConResumen(est, { banco: 'Galicia', tipo: 'AMEX', fecha_cierre: '2026-10-01' }).conciliados.length, 0);
  assert.equal(conciliarConResumen(est, { banco: 'Santander', tipo: 'AMEX', fecha_cierre: '2026-11-01' }).conciliados.length, 0);
});

test('Formato desconocido: pide mapeo con muestra mínima y luego lee con la plantilla', () => {
  const rows = [
    ['Banco Ejemplo - Mastercard terminada en 8823'],
    ['Fecha de cierre: 09/10/2026 - Vencimiento: 21/10/2026'],
    ['Fecha', 'Detalle', 'Plan', 'Pesos', 'Dólares'],
    ['01/09/2026', 'Supermercado', '', '10.000,50', ''],
    ['02/09/2026', 'Heladera', '3/12', '50.000,00', ''],
    ['03/09/2026', 'Netflix', '', '', '9,99'],
  ];
  const r = parseUltimosConsumos([{ nombre: 'h', rows }]);
  assert.ok(r.requiereMapeo);
  assert.equal(r.requiereMapeo.filas_muestra.length, 3);
  const plantilla = { firma: r.requiereMapeo.firma, mapeo: { fecha: 0, descripcion: 1, cuotas: 2, monto_ars: 3, monto_usd: 4 } };
  const r2_ = parseUltimosConsumos([{ nombre: 'h', rows }], { plantillas: { [plantilla.firma]: plantilla } });
  const b = r2_.bloques[0];
  assert.equal(b.ult4, '8823'); assert.equal(b.red, 'Mastercard');
  assert.equal(b.metadata.fecha_cierre, '2026-10-09');
  assert.equal(b.metadata.fecha_vencimiento, '2026-10-21');
  assert.equal(b.consumos.length, 3);
  assert.equal(b.consumos[1].cuota_actual, 3);
  assert.equal(b.consumos[2].monto_dolares, 9.99);
});

test('Sin banco igual se importa; la Card lo pide y al guardarlo no se vuelve a preguntar', () => {
  const g = agruparBloques(parseUltimosConsumos(fx('santander-visa').hojas).bloques);
  let est = aplicarArchivo({ grupos: g, archivo: { id: 'f1', nombre: 'a' }, estado: vacio() });
  const cards = cardsEnCurso(est.ciclos, est.consumos, '2026-09-26');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].ciclo.banco, '');
  est = { ...est, ...asignarBanco(est, cards[0].ciclo.grupoKey, 'Santander') };
  assert.equal(est.alias['1510'].banco, 'Santander');
  assert.equal(Object.values(est.ciclos)[0].banco, 'Santander');
  // Re-subir: mismo grupo, ya con banco
  est = aplicarArchivo({ grupos: g, archivo: { id: 'f2', nombre: 'a' }, estado: est });
  assert.equal(Object.keys(est.ciclos).length, 1);
  assert.equal(Object.values(est.ciclos)[0].banco, 'Santander');
  assert.ok(est.consumos.every((c) => c.tarjeta.startsWith('Santander Visa')));
});
