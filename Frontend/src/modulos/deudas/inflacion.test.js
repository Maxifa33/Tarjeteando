import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acumular, tasaReal, teaDesdeTna, serie13, resumenInflacion, compararConInflacion, licuacionAnual, armarTasas, fmtPct } from './inflacion.js';

// Serie real publicada por el INDEC (variación mensual, nivel general).
const REAL = [['2025-09', 2.1], ['2025-10', 2.3], ['2025-11', 2.5], ['2025-12', 2.8], ['2026-01', 2.9], ['2026-02', 2.9], ['2026-03', 3.4], ['2026-04', 2.6], ['2026-05', 2.1], ['2026-06', 1.9], ['2026-07', 2.1], ['2026-08', 1.7], ['2026-09', 1.9]];
const filas = REAL.map(([m, v]) => ({ periodo: `${m}-01`, variacion: String(v) }));
const cerca = (a, b, t = 0.01) => assert.ok(Math.abs(a - b) <= t, `${a} ≉ ${b}`);

test('serie13: 13 puntos, el primero es el mismo mes del año anterior', () => {
  const s = serie13(filas);
  assert.equal(s.length, 13);
  assert.equal(s[0].mes, '2025-09'); assert.equal(s[12].mes, '2026-09');
  assert.equal(s[0].valor, 2.1); assert.equal(s[12].valor, 1.9);
});
test('serie13: ignora meses anteriores a la ventana y marca huecos con null', () => {
  const f = [...filas, { periodo: '2024-01-01', variacion: 20 }].filter((x) => x.periodo !== '2026-03-01');
  const s = serie13(f);
  assert.equal(s.length, 13);
  assert.equal(s.find((p) => p.mes === '2026-03').valor, null);
  assert.equal(resumenInflacion(f).faltantes, 1);
  assert.equal(resumenInflacion(f).interanual, null); // sin dato oficial y con hueco: no se inventa
});
test('serie13: vacío → null; cruza año', () => {
  assert.equal(serie13([]), null); assert.equal(serie13(undefined), null);
  assert.equal(serie13([{ periodo: '2026-01-01', variacion: 2.9 }])[11].mes, '2025-12');
});
test('interanual: usa la oficial si existe; si no, recompone (±0,1 pp) y avisa', () => {
  const sin = resumenInflacion(filas);
  assert.equal(sin.aprox, true);
  cerca(sin.interanual, 33.4, 0.15);
  const con = resumenInflacion(filas.map((f) => (f.periodo === '2026-09-01' ? { ...f, interanual: '33.4' } : f)));
  assert.equal(con.interanual, 33.4); assert.equal(con.aprox, false);
});
test('ritmo: últimos 3 meses anualizados', () => {
  const r = resumenInflacion(filas).ritmo;
  cerca(r, ((1.019 * 1.017 * 1.021) ** 4 - 1) * 100, 1e-9);
});
test('tasaReal / licuación', () => {
  cerca(tasaReal(10, 10), 0); cerca(tasaReal(21, 10), 10); cerca(tasaReal(0, 100), -50);
  cerca(licuacionAnual(33.4), -25.04, 0.01);
});
test('teaDesdeTna: 36 % TNA → 42,58 % TEA', () => cerca(teaDesdeTna(36), 42.576, 0.01));
test('compararConInflacion: plazo fijo 19 % pierde contra 33,4 %', () => {
  const r = resumenInflacion(filas.map((f) => (f.periodo === '2026-09-01' ? { ...f, interanual: 33.4 } : f)));
  const c = compararConInflacion(19, r);
  assert.ok(c.realInteranual < -9 && c.realInteranual > -11);
  assert.ok(c.realRitmo < 0);
  assert.equal(compararConInflacion(19, null).realInteranual, null);
});
test('armarTasas: filtra referencia, ordena, marca viejos y descarta inválidos', () => {
  const t = armarTasas({
    hoy: '2026-10-16',
    plazoFijo: [
      { entidad: 'BANCO DE LA NACION ARGENTINA', tna: '0.1925', fecha: '2026-10-15' },
      { entidad: 'BANCO SANTANDER ARGENTINA S.A.', tna: '0.165', fecha: '2026-10-01' },
      { entidad: 'UALA', tna: '0.22', fecha: '2026-10-15' },
      { entidad: 'BANCO DINO S.A.', tna: '0.2', fecha: '2026-10-15' }, // no es de referencia
      { entidad: 'BANCO MACRO S.A.', tna: '0', fecha: '2026-10-15' } // tasa 0: se descarta
    ],
    billeteras: [{ entidad: 'Mercado Pago', producto: 'Mercado Fondo (FCI)', tna: '0.1916', fecha: '2026-10-15' }]
  });
  assert.deepEqual(t.map((x) => x.nombre), ['Ualá', 'Banco Nación', 'Mercado Pago', 'Santander']);
  assert.equal(t.find((x) => x.nombre === 'Santander').vieja, true);
  assert.equal(t.find((x) => x.nombre === 'Ualá').tipo, 'billetera');
  cerca(t[0].tna, 22, 1e-9);
});
test('fmtPct', () => {
  assert.equal(fmtPct(33.4), '33,4 %'); assert.equal(fmtPct(-9.74, { signo: true }), '−9,7 %');
  assert.equal(fmtPct(1.2, { signo: true }), '+1,2 %'); assert.equal(fmtPct(null), '—'); assert.equal(fmtPct(-0.01), '0,0 %');
});
