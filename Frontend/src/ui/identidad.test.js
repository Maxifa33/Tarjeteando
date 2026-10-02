import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { identidadTarjeta, identidades, ordenApilado, manchasDeLuz, claveConocida, manchasElegida } from './identidad.js';

describe('identidadTarjeta', () => {
  test('el mismo banco y red siempre da el mismo color', () => {
    const a = identidadTarjeta({ nombre: 'VISA Santander', banco: 'Santander', tipo: 'VISA' }, 0);
    const b = identidadTarjeta({ nombre: 'Mi Santander', banco: 'Santander', tipo: 'VISA' }, 3);
    assert.equal(a.clave, 'santander');
    assert.equal(a.chartClaro, b.chartClaro);
    assert.equal(a.chartOscuro, b.chartOscuro);
    assert.equal(a.plastico, b.plastico);
  });

  test('Galicia Visa lleva texto oscuro; Galicia Mastercard, claro', () => {
    const v = identidadTarjeta({ nombre: 'VISA Galicia', banco: 'Galicia', tipo: 'VISA' });
    const m = identidadTarjeta({ nombre: 'Mastercard Galicia', banco: 'Galicia', tipo: 'Mastercard' });
    assert.equal(v.clave, 'galicia-visa');
    assert.equal(v.texto, '#1D1D1F');
    assert.equal(m.clave, 'galicia-mc');
    assert.equal(m.texto, '#FFFFFF');
  });

  test('BBVA se reconoce por el nombre aunque falte el banco', () => {
    assert.equal(claveConocida({ nombre: 'VISA BBVA' }), 'bbva');
  });

  test('otros bancos: grafito y slot por orden de alta', () => {
    const macro = identidadTarjeta({ nombre: 'VISA Macro', banco: 'Macro' }, 0);
    const naranja = identidadTarjeta({ nombre: 'Naranja X', banco: 'Naranja X' }, 1);
    assert.match(macro.plastico, /#4A4A52/);
    assert.equal(macro.chartClaro, '#4a3aa7');
    assert.equal(naranja.chartClaro, '#1baf7a');
  });
});

describe('identidades por orden de alta', () => {
  const lista = [
    { nombre: 'VISA Macro', banco: 'Macro' },
    { nombre: 'VISA Santander', banco: 'Santander' },
    { nombre: 'Naranja X', banco: 'Naranja X' }
  ];

  test('el fallback usa el orden de alta, salteando los bancos conocidos', () => {
    const m = identidades(lista);
    assert.equal(m.get('VISA Macro').clave, 'otro-0');
    assert.equal(m.get('Naranja X').clave, 'otro-1');
    assert.equal(m.get('VISA Santander').clave, 'santander');
  });

  test('el color no cambia si cambia el monto', () => {
    const a = manchasDeLuz(lista.map((t, i) => ({ tarjeta: t, peso: [10, 20, 30][i] })));
    const b = manchasDeLuz(lista.map((t, i) => ({ tarjeta: t, peso: [900, 1, 5][i] })));
    assert.deepEqual(a.map(x => x.color), b.map(x => x.color));
    assert.notDeepEqual(a.map(x => x.escala), b.map(x => x.escala));
  });
});

describe('ordenApilado', () => {
  test('Santander → BBVA → Galicia Visa → Galicia MC → otros por alta', () => {
    const orden = ordenApilado([
      { nombre: 'Naranja X', banco: 'Naranja X' },
      { nombre: 'Mastercard Galicia', banco: 'Galicia', tipo: 'Mastercard' },
      { nombre: 'VISA Macro', banco: 'Macro' },
      { nombre: 'VISA Galicia', banco: 'Galicia', tipo: 'VISA' },
      { nombre: 'VISA BBVA', banco: 'BBVA' },
      { nombre: 'VISA Santander', banco: 'Santander' }
    ]).map(t => t.nombre);
    assert.deepEqual(orden, [
      'VISA Santander', 'VISA BBVA', 'VISA Galicia', 'Mastercard Galicia', 'Naranja X', 'VISA Macro'
    ]);
  });
});

describe('manchasDeLuz', () => {
  test('sin tarjetas: 4 manchas neutras', () => {
    const m = manchasDeLuz([]);
    assert.equal(m.length, 4);
    assert.ok(m.every(x => x.color === 'var(--label2)' && x.opacidad === 0.2));
  });

  test('escala entre 0.6 y 1.35 según el peso', () => {
    const m = manchasDeLuz([
      { tarjeta: { nombre: 'VISA Santander', banco: 'Santander' }, peso: 100 },
      { tarjeta: { nombre: 'VISA BBVA', banco: 'BBVA' }, peso: 0 }
    ]);
    assert.equal(m[0].escala, 1.35);
    assert.equal(m[1].escala, 0.6);
  });

  test('usa el color de gráfico del modo', () => {
    const t = { tarjeta: { nombre: 'VISA BBVA', banco: 'BBVA' }, peso: 1 };
    assert.equal(manchasDeLuz([t], { oscuro: true })[0].color, '#4C8FEA');
    assert.equal(manchasDeLuz([t], { oscuro: false })[0].color, '#1B5FAF');
  });
});

describe('manchasElegida', () => {
  const base = manchasDeLuz([
    { tarjeta: { nombre: 'VISA Santander', banco: 'Santander' }, peso: 1 },
    { tarjeta: { nombre: 'VISA BBVA', banco: 'BBVA' }, peso: 1 },
    { tarjeta: { nombre: 'VISA Galicia', banco: 'Galicia' }, peso: 1 }
  ]);
  test('la elegida escala 1.6; las demás 0.45 con opacidad 0.45', () => {
    const m = manchasElegida(base, 'VISA BBVA');
    const bbva = m.find(x => x.clave === 'VISA BBVA');
    assert.equal(bbva.escala, 1.6);
    assert.ok(m.filter(x => x.clave !== 'VISA BBVA').every(x => x.escala === 0.45 && x.opacidad === 0.45));
    assert.deepEqual(m.map(x => x.color), base.map(x => x.color), 'el color no cambia');
  });
  test('sin elegida o elegida desconocida: igual que antes', () => {
    assert.equal(manchasElegida(base, null), base);
    assert.equal(manchasElegida(base, 'otra'), base);
  });
});
