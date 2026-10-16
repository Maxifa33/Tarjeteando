import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveCuenta, cobrosDeCuenta, candidatosCobro, cobrosDe, cotizacionPara, aportesDe, rendimientoFlujos, cobroAtrasado, aportesDelMes, frecuenciaMeses } from './aportes.js';
import { cobrosDeTarjeta } from '../puente/tarjeteando.js';
import { valuar } from './alcancia.js';

// Datos ficticios.
const movT = (n, mes, { poliza = '0000003393731', monto = 30000, anio = 2026 } = {}) => ({ id: `m${poliza}${anio}${mes}`, resumen_id: `r${anio}${mes}`, referencia_original: `ZURICH INTERNA${poliza}- -`, referencia_limpia: 'Zurich', monto_pesos: monto, fecha_compra: `${anio}-${mes}-05`, tarjeta: 'visa' });
const resT = (mes, anio = 2026) => ({ id: `r${anio}${mes}`, fecha_vencimiento: mes === '12' ? `${anio + 1}-01-10` : `${anio}-${String(Number(mes) + 1).padStart(2, '0')}-10` });
const meses = ['01', '02', '03', '04', '05', '06'];
const tarjeta = cobrosDeTarjeta([...meses.map((m, k) => movT(k, m)), { id: 'x', referencia_original: 'NETFLIX.COM', monto_pesos: 9000, fecha_compra: '2026-03-02' }, { id: 'p', es_pago: true, monto_pesos: 1, referencia_original: 'SU PAGO' },
  { id: 'c', es_cuota: true, total_cuotas: 6, referencia_original: 'FRAVEGA', monto_pesos: 5000, fecha_compra: '2026-02-01' }], meses.map((m) => resT(m)));
const mc = (id, fecha, descripcion, monto = 50000, extra = {}) => ({ id, tipo: 'gasto', direccion: 'salida', estado: 'confirmado', monto, moneda: 'ARS', fecha, descripcion, cuenta_id: 'gal', ...extra });

test('claveCuenta: palabras distintivas, sin números ni genéricas (los débitos de servicios no se mezclan)', () => {
  assert.equal(claveCuenta('Débito automático Zurich'), 'zurich');
  assert.equal(claveCuenta('Débito automático Edenor'), 'edenor');
  assert.equal(claveCuenta('DB AUT ZURICH 03/26 OP 123456'), 'zurich');
  assert.equal(claveCuenta('Seguro Zurich Vida'), 'seguro zurich vida');
  assert.equal(claveCuenta('Pago de servicios'), '');
  assert.equal(claveCuenta('Pago en Mercado Pago'), '');
  assert.equal(claveCuenta('Zurich Zurich'), 'zurich');
  const cs = cobrosDeCuenta([mc(1, '2026-03-10', 'Débito automático Zurich'), mc(2, '2026-03-11', 'Pago de servicios'), mc(3, '2026-03-11', 'X', 1, { estado: 'revisar' })]);
  assert.equal(cs.length, 1); assert.equal(cs[0].clave, 'zurich'); assert.equal(cs[0].fuente, 'cuenta:gal');
});

test('cobros de tarjeta: sin pagos ni cuotas; N° de póliza como ref; mes de pago del resumen', () => {
  const z = tarjeta.filter((c) => c.clave === 'zurich');
  assert.equal(z.length, 6); assert.equal(z[0].ref, '3393731'); assert.equal(z[0].mesPago, '2026-02'); assert.equal(z[0].fuente, 'tarjeta:visa');
  assert.ok(!tarjeta.some((c) => c.id === 't:p' || c.id === 't:c'));
});

test('dos pólizas del mismo comercio: candidatos separados por N°, y lo asociado a una no aparece ni se cuenta en la otra', () => {
  const dos = [...tarjeta, ...cobrosDeTarjeta(meses.map((m, k) => movT(k, m, { poliza: '0000005551112', monto: 20000 })), meses.map((m) => resT(m)))];
  const c = candidatosCobro(dos, { pista: 'Zurich' });
  const refs = c.filter((x) => x.clave === 'zurich').map((x) => x.ref).sort();
  assert.deepEqual(refs, ['3393731', '5551112']); assert.equal(c[0].sugerido, true);
  const vA = { inversion_id: 'A', origen: 'tarjeta', clave: 'zurich', ref: '3393731' };
  assert.ok(!candidatosCobro(dos, { vinculos: [vA] }).some((x) => x.ref === '3393731'));
  assert.equal(cobrosDe([vA], dos, [vA]).length, 6);
  // Un vínculo sin ref (B) se queda con lo de su clave salvo la póliza ya tomada por A.
  const vB = { inversion_id: 'B', origen: 'tarjeta', clave: 'zurich', ref: null };
  assert.ok(cobrosDe([vB], dos, [vA, vB]).every((x) => x.ref === '5551112'));
});

test('cobrosDe: el mismo pago visto en tarjeta y en cuenta cuenta una sola vez', () => {
  const cuenta = cobrosDeCuenta([mc(9, '2026-03-07', 'Zurich', 30000), mc(10, '2026-09-10', 'Zurich', 31000)]);
  const vs = [{ origen: 'tarjeta', clave: 'zurich', ref: '3393731' }, { origen: 'cuenta', clave: 'zurich' }];
  const cs = cobrosDe(vs, [...tarjeta, ...cuenta], vs);
  assert.equal(cs.length, 7); // 6 de tarjeta + el de septiembre (el de marzo es el mismo de la tarjeta)
});

test('cotizacionPara: VRU$S = oficial vendedor del día 15 o hábil anterior', () => {
  const h = { oficial: [{ fecha: '2026-02-13', venta: 1000 }, { fecha: '2026-03-13', venta: 1100 }, { fecha: '2026-03-16', venta: 1150 }, { fecha: '2026-03-20', venta: 1200 }], bolsa: [{ fecha: '2026-03-20', venta: 1300 }] };
  assert.equal(cotizacionPara('oficial_15', '2026-03-20', h).valor, 1100);
  assert.equal(cotizacionPara('oficial_15', '2026-03-05', h).valor, 1000);
  assert.equal(cotizacionPara('oficial_dia', '2026-03-20', h).valor, 1200);
  assert.equal(cotizacionPara('mep_dia', '2026-03-21', h).valor, 1300);
  assert.equal(cotizacionPara('oficial_dia', '2026-05-01', h), null);
});

const hist = { oficial: ['2025-12-15', '2026-01-15', '2026-02-13', '2026-03-13', '2026-04-15', '2026-05-15'].map((fecha) => ({ fecha, venta: 1000 })) };
const zur = (vs = [{ origen: 'tarjeta', clave: 'zurich', ref: '3393731' }]) => cobrosDe(vs, tarjeta, vs);

test('aportesDe en U$S: convierte, estima antes del primer dato con el aporte, y los huecos con el cobro cercano', () => {
  const inv = { id: 'i', moneda: 'USD', aporte_monto: 30, aporte_frecuencia: 'mensual', fecha_inicio: '2025-10-05', cotizacion_aportes: 'oficial_15' };
  const a = aportesDe(inv, zur(), hist);
  assert.equal(a.reales, 6); assert.equal(a.estimados, 3); assert.equal(a.huecos, 0); assert.equal(a.total, 270);
  const sinMarzo = zur().filter((c) => !c.fecha.startsWith('2026-03'));
  const b = aportesDe(inv, sinMarzo, hist);
  assert.equal(b.reales, 5); assert.equal(b.huecos, 1); assert.equal(b.total, 270); // el hueco se estima: no infla la ganancia
  const sinHist = aportesDe(inv, zur(), { oficial: hist.oficial.slice(0, 5) }); // falta el 15/05 → junio sin cotización
  assert.equal(sinHist.sinCotizacion, 1); assert.equal(sinHist.reales, 5);
});

test('aportesDe en pesos: con total aportado reparte lo previo; sin él no inventa (faltaBase)', () => {
  const inv = { id: 'i', moneda: 'ARS', aporte_monto: 30000, aporte_frecuencia: 'mensual', fecha_inicio: '2025-07-05' };
  const sin = aportesDe(inv, zur(), null);
  assert.equal(sin.faltaBase, true);
  const con = aportesDe({ ...inv, capital: 300000 }, zur(), null);
  assert.equal(con.faltaBase, false); assert.equal(con.total, 300000); assert.equal(con.estimados, 6); // jul–dic 2025: 120.000 repartidos
  const desdeElPrimero = aportesDe({ ...inv, fecha_inicio: '2026-01-05' }, zur(), null);
  assert.equal(desdeElPrimero.faltaBase, false); assert.equal(desdeElPrimero.total, 180000);
});

test('póliza anual con frecuencia "mensual" por defecto: manda lo que muestran los cobros', () => {
  const cs = ['2024', '2025', '2026'].map((a) => ({ id: a, origen: 'tarjeta', fecha: `${a}-03-05`, monto: 1200, moneda: 'USD', fuente: 'tarjeta:visa' }));
  const inv = { moneda: 'USD', aporte_frecuencia: 'mensual', aporte_monto: 1200, fecha_inicio: '2024-03-05' };
  const a = aportesDe(inv, cs, null);
  assert.equal(a.frec, 12); assert.equal(a.huecos, 0); assert.equal(a.total, 3600); assert.equal(a.frecInferida, true);
  assert.equal(cobroAtrasado(inv, cs, { 'tarjeta:visa': '2026-09-30' }, '2026-10-16'), null);
  // Sin fecha de alta ni total aportado: no se calcula ganancia.
  assert.equal(aportesDe({ moneda: 'ARS' }, cs.map((c) => ({ ...c, moneda: 'ARS' })), null).faltaBase, true);
});

test('frecuencia y alerta de cobro atrasado por fuente', () => {
  const anual = [{ fecha: '2024-03-05', fuente: 'tarjeta:visa' }, { fecha: '2025-03-05', fuente: 'tarjeta:visa' }];
  assert.equal(frecuenciaMeses({}, anual), 12);
  assert.equal(cobroAtrasado({}, anual, { 'tarjeta:visa': '2025-09-30' }, '2026-10-16'), null); // anual: todavía no tocaba
  const cs = zur(); const inv = { aporte_frecuencia: 'mensual' };
  assert.equal(cobroAtrasado(inv, cs, { 'tarjeta:visa': '2026-06-30' }, '2026-10-16'), null); // no importaste nada después
  assert.equal(cobroAtrasado(inv, cs, { 'tarjeta:master': '2026-09-30' }, '2026-10-16'), null); // datos nuevos, pero de otra tarjeta
  assert.equal(cobroAtrasado(inv, cs, { 'tarjeta:visa': '2026-08-30' }, '2026-10-16').esperado, '2026-07-05');
});

test('rendimientoFlujos: TIR con fechas reales', () => {
  const r = rendimientoFlujos([{ fecha: '2024-10-16', monto: 1000 }, { fecha: '2025-10-16', monto: 1000 }], 2310, '2026-10-16');
  assert.ok(Math.abs(r.anual - 10) < 0.2);
  assert.equal(rendimientoFlujos([{ fecha: '2026-06-01', monto: 1 }], 2, '2026-10-16').corto, true);
  assert.equal(rendimientoFlujos([], 2, '2026-10-16'), null);
  assert.equal(rendimientoFlujos([{ fecha: '2024-10-16', monto: 1 }], 1e30, '2026-10-16').dudoso, true);
});

test('aportesDelMes y valuar con cobros asociados', () => {
  const cuenta = cobrosDeCuenta([mc(1, '2026-03-10', 'Débito automático Edenor', 50000)]);
  const vs = [{ inversion_id: 'A', origen: 'tarjeta', clave: 'zurich', ref: '3393731' }, { inversion_id: 'B', origen: 'cuenta', clave: 'edenor' }];
  const a = aportesDelMes('2026-03', vs, tarjeta, cuenta);
  assert.equal(a.tarjeta, 30000); assert.equal(a.cuenta, 50000);
  const inv = { id: 'i', tipo: 'seguro', subtipo: 'retiro', moneda: 'ARS', valor_manual: 200000, aporte_monto: 30000, aporte_frecuencia: 'mensual', fecha_inicio: '2026-01-05', valor_fecha: '2026-06-30' };
  const v = valuar(inv, new Map(), { mep: 1000, hoy: '2026-10-16', aportes: { i: aportesDe(inv, zur(), null, { hasta: '2026-06-30' }) } });
  assert.equal(v.seguro.conCobros, true); assert.equal(v.seguro.aportado, 180000); assert.equal(v.ganancia, 20000); assert.equal(v.seguro.faltaAportado, false);
  const p = valuar(inv, new Map(), { mep: 1000, hoy: '2026-10-16', aportes: { i: { pendiente: true, flujos: [], reales: 0 } } });
  assert.equal(p.ganancia, null); assert.equal(p.seguro.rinde, null); assert.equal(p.seguro.faltaAportado, false);
  const fb = valuar({ ...inv, fecha_inicio: '2025-01-05' }, new Map(), { mep: 1000, hoy: '2026-10-16', aportes: { i: aportesDe({ ...inv, fecha_inicio: '2025-01-05' }, zur(), null) } });
  assert.equal(fb.ganancia, null); assert.equal(fb.seguro.faltaAportado, true);
});
