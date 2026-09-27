/**
 * Tests de la sección Tarjetas (services/tarjetas.js) — `npm test`.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { armarTarjetas, buscarTarjeta, resumenTodas } from './tarjetas.js';

const HOY = '2026-09-26';
const tarjetas = [
  { id: 1, nombre: 'VISA BBVA', banco: 'BBVA', tipo: 'VISA' },
  { id: 2, nombre: 'VISA Santander', banco: 'Santander', tipo: 'VISA' },
  { id: 3, nombre: 'VISA Macro', banco: 'Macro', tipo: 'VISA' }
];
const resumenes = [
  { id: 'b9', tarjeta: 'VISA BBVA', fecha_cierre: '2026-09-24', fecha_vencimiento: '2026-10-05', total_a_pagar_pesos: 326410, total_a_pagar_dolares: 22.99 },
  { id: 'b8', tarjeta: 'VISA BBVA', fecha_cierre: '2026-08-24', fecha_vencimiento: '2026-09-05', total_a_pagar_pesos: 300000 },
  { id: 's8', tarjeta: 'VISA Santander', fecha_cierre: '2026-08-28', fecha_vencimiento: '2026-09-09', total_a_pagar_pesos: 700000 },
  { id: 'm8', tarjeta: 'VISA Macro', fecha_cierre: '2026-08-20', fecha_vencimiento: '2026-09-02', total_a_pagar_pesos: 90000 }
];
const ciclo = (grupoKey, banco, red, miembros, cierre, vto, extra = {}) => ({
  grupoKey, banco, red, principal: miembros[0], miembros, fecha_cierre: cierre, fecha_vencimiento: vto,
  estado: 'provisional', actualizado_at: '2026-09-26T22:46:00.000Z', ...extra
});
const consumo = (grupo_key, ciclo_cierre, ult4, pesos, extra = {}) => ({ grupo_key, ciclo_cierre, tarjeta_ult4: ult4, monto_pesos: pesos, monto_dolares: 0, es_cuota: false, ...extra });
const ciclosLive = {
  'Santander|Visa|3327': ciclo('Santander|Visa|3327', 'Santander', 'Visa', ['3327', '1510'], '2026-10-01', '2026-10-09', { limite: 26200000, disponible: 23750000 }),
  // Ciclo siguiente de BBVA (el resumen de septiembre ya cerró).
  'BBVA|Visa|2291': ciclo('BBVA|Visa|2291', 'BBVA', 'Visa', ['2291'], '2026-10-24', '2026-11-05'),
  'sin-banco|Mastercard|8823': ciclo('sin-banco|Mastercard|8823', '', 'Mastercard', ['8823'], '2026-10-09', '2026-10-21')
};
const consumosLive = [
  consumo('Santander|Visa|3327', '2026-10-01', '3327', 739748.66),
  consumo('Santander|Visa|3327', '2026-10-01', '3327', 108327.44, { es_cuota: true }),
  consumo('Santander|Visa|3327', '2026-10-01', '1510', 44166.55),
  consumo('BBVA|Visa|2291', '2026-10-24', '2291', 15000),
  consumo('sin-banco|Mastercard|8823', '2026-10-09', '8823', 187905)
];
const lista = armarTarjetas({ hoy: HOY, tarjetas, resumenes, ciclosLive, consumosLive });
const por = Object.fromEntries(lista.map((t) => [t.id, t]));

describe('armarTarjetas', () => {
  test('todas las tarjetas + el grupo sin tarjeta', () => {
    assert.deepEqual(lista.map((t) => t.id), ['VISA BBVA', 'VISA Santander', 'VISA Macro', 'sin-banco|Mastercard|8823']);
  });

  test('SuperCard: un solo plástico con dos plásticos en el detalle', () => {
    const s = por['VISA Santander'];
    assert.equal(s.estado, 'en_curso');
    assert.equal(s.superCard, true);
    assert.deepEqual(s.ultimos4, ['3327', '1510']);
    assert.equal(s.total, 892242.65);
    assert.deepEqual(s.plasticos.map((p) => [p.ult4, p.unPago, p.cuotas, p.subtotal]), [
      ['3327', 739748.66, 108327.44, 848076.1],
      ['1510', 44166.55, 0, 44166.55]
    ]);
    assert.equal(s.disponible, 23750000);
  });

  test('resumen cerrado + Últimos consumos del ciclo siguiente', () => {
    const b = por['VISA BBVA'];
    assert.equal(b.estado, 'cerrado');
    assert.equal(b.total, 326410);
    assert.equal(b.totalUsd, 22.99);
    assert.deepEqual(b.proximoCiclo, { total: 15000, cierre: '2026-10-24', vencimiento: '2026-11-05' });
    assert.deepEqual(b.plasticos, [], 'el reparto del ciclo siguiente no se mezcla con el cerrado');
    assert.deepEqual(b.ultimos4, ['2291']);
  });

  test('solo resúmenes vencidos: pagado, con el último', () => {
    assert.equal(por['VISA Macro'].estado, 'pagado');
    assert.equal(por['VISA Macro'].total, 90000);
  });

  test('grupo sin banco: pide el banco', () => {
    const g = por['sin-banco|Mastercard|8823'];
    assert.equal(g.sinBanco, true);
    assert.equal(g.nombre, 'Sin banco Mastercard');
  });
});

describe('buscarTarjeta', () => {
  test('por id o por la clave del grupo (el id cambia al asignar el banco)', () => {
    assert.equal(buscarTarjeta(lista, 'VISA Santander').id, 'VISA Santander');
    assert.equal(buscarTarjeta(lista, 'Santander|Visa|3327').id, 'VISA Santander');
    assert.equal(buscarTarjeta(lista, 'nada'), null);
  });
});

describe('resumenTodas', () => {
  test('las cifras de Todas', () => {
    const r = resumenTodas(lista);
    assert.equal(r.enCurso, 892242.65 + 187905);
    assert.equal(r.nEnCurso, 2);
    assert.equal(r.cerrado, 326410);
    assert.equal(r.disponible, 23750000);
    assert.equal(r.limite, 26200000);
    assert.equal(r.plasticos, 5);
  });
});
