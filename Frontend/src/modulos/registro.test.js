import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS, seccionesConModulos, esModulo, contarFavoritos, MAX_FAVORITOS } from './registro.js';

const SECC = [{ id: 'mes' }, { id: 'tarjetas' }, { id: 'movimientos' }, { id: 'cuotas' }];

test('sin módulos activos devuelve exactamente las secciones de Tarjeteando', () => {
  const r = seccionesConModulos(SECC, {});
  assert.equal(r.pestanas, SECC);
  assert.deepEqual(r.enMenu, []);
  const r2 = seccionesConModulos(SECC, { billetera: { activo: false, favorito: true } });
  assert.equal(r2.pestanas, SECC);
});

test('favoritos van como pestañas después de Cuotas, ordenados por orden', () => {
  const r = seccionesConModulos(SECC, {
    alcancia: { activo: true, favorito: true, orden: 1 },
    billetera: { activo: true, favorito: true, orden: 0 }
  });
  assert.deepEqual(r.pestanas.map((s) => s.id), ['mes', 'tarjetas', 'movimientos', 'cuotas', 'billetera', 'alcancia']);
  assert.ok(r.pestanas[4].esModulo);
  assert.deepEqual(r.enMenu, []);
});

test('más favoritos que el máximo: los extra van al menú', () => {
  const estado = {};
  MODULOS.forEach((m, i) => { estado[m.id] = { activo: true, favorito: true, orden: i }; });
  const r = seccionesConModulos(SECC, estado);
  assert.equal(r.pestanas.length, SECC.length + MAX_FAVORITOS);
  assert.equal(r.enMenu.length, MODULOS.length - MAX_FAVORITOS);
});

test('activos no favoritos van al menú; favoritos inactivos no aparecen', () => {
  const r = seccionesConModulos(SECC, {
    saldar: { activo: true, favorito: false },
    compartidos: { activo: false, favorito: true }
  });
  assert.deepEqual(r.pestanas.map((s) => s.id), SECC.map((s) => s.id));
  assert.deepEqual(r.enMenu.map((m) => m.id), ['saldar']);
});

test('ids desconocidos se ignoran', () => {
  const r = seccionesConModulos(SECC, { fantasma: { activo: true, favorito: true } });
  assert.equal(r.pestanas, SECC);
  assert.equal(esModulo('fantasma'), false);
  assert.equal(esModulo('billetera'), true);
  assert.equal(esModulo('mes'), false);
});

test('contarFavoritos solo cuenta activos', () => {
  assert.equal(contarFavoritos({ billetera: { activo: true, favorito: true }, saldar: { activo: false, favorito: true } }), 1);
});

test('los ids del registro coinciden con la CHECK de Supabase', () => {
  assert.deepEqual(MODULOS.map((m) => m.id).sort(), ['alcancia', 'billetera', 'compartidos', 'platita', 'presupuestos', 'saldar']);
});
