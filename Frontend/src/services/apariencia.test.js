import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizarApariencia,
  modoEfectivo,
  clasesApariencia,
  temaLegacy,
  configConDefaults,
  APARIENCIA_DEFAULT
} from './apariencia.js';

describe('normalizarApariencia', () => {
  test('sin apariencia ni tema viejo → sistema', () => {
    assert.deepEqual(normalizarApariencia(undefined, null), APARIENCIA_DEFAULT);
  });

  test('migra el tema viejo: liquid y dark → oscuro, light → claro', () => {
    assert.equal(normalizarApariencia(null, 'liquid').modo, 'oscuro');
    assert.equal(normalizarApariencia(null, 'dark').modo, 'oscuro');
    assert.equal(normalizarApariencia(null, 'light').modo, 'claro');
    assert.equal(normalizarApariencia(null, 'raro').modo, 'sistema');
  });

  test('si ya hay apariencia guardada, el tema viejo no la pisa', () => {
    const a = normalizarApariencia({ modo: 'claro', reducirTransparencia: true }, 'liquid');
    assert.deepEqual(a, { modo: 'claro', reducirTransparencia: true, railIzquierda: false });
  });

  test('valores inválidos caen al default', () => {
    const a = normalizarApariencia({ modo: 'rosa', reducirTransparencia: 'si', railIzquierda: 1 });
    assert.deepEqual(a, APARIENCIA_DEFAULT);
  });
});

describe('modo efectivo y clases', () => {
  test('sistema sigue a prefers-color-scheme', () => {
    assert.equal(modoEfectivo('sistema', true), 'oscuro');
    assert.equal(modoEfectivo('sistema', false), 'claro');
    assert.equal(modoEfectivo('claro', true), 'claro');
  });

  test('clases del contenedor .tj', () => {
    assert.deepEqual(clasesApariencia({ modo: 'oscuro', reducirTransparencia: false }, false), ['tj']);
    assert.deepEqual(clasesApariencia({ modo: 'claro', reducirTransparencia: true }, true), ['tj', 'claro', 'rt']);
  });

  test('tema legacy para SettingsModal', () => {
    assert.equal(temaLegacy('oscuro', false), 'dark');
    assert.equal(temaLegacy('sistema', false), 'light');
  });
});

describe('configConDefaults', () => {
  test('config vieja sin apariencia ni tope conserva lo demás', () => {
    const c = configConDefaults({ theme: 'dark', apiKey: 'x' }, 'liquid');
    assert.equal(c.apiKey, 'x');
    assert.equal(c.tope_mensual, null);
    assert.equal(c.apariencia.modo, 'oscuro');
  });

  test('config nula (localStorage bloqueado) → defaults', () => {
    const c = configConDefaults(null, null);
    assert.equal(c.tope_mensual, null);
    assert.deepEqual(c.apariencia, APARIENCIA_DEFAULT);
  });

  test('tope_mensual guardado se respeta', () => {
    assert.equal(configConDefaults({ tope_mensual: 900000 }).tope_mensual, 900000);
  });
});
