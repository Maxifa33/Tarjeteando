import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoMeta, planMetas, netoReserva, valuar, totalCartera, validarMeta, validarInversion, interesPlazoFijo, aTexto, aportadoEstimado, rendimientoSeguro, inflacionDelPeriodo } from './alcancia.js';

// Datos ficticios.
const meta = { id: 'm1', nombre: 'Viaje', objetivo: 1200000, moneda: 'ARS', fecha_objetivo: '2026-12-20', bolsillo_id: 'b1', saldo_inicial: 100000, estado: 'activa', created_at: '2026-06-01T00:00:00Z' };
const res = (o) => ({ tipo: 'reserva', bolsillo_id: 'b1', direccion: 'salida', ...o });

test('netoReserva: entra (salida de la cuenta) suma, retirar resta', () => {
  assert.equal(netoReserva([res({ monto: 300 }), res({ monto: 100, direccion: 'entrada' }), res({ monto: 50, bolsillo_id: 'otro' }), { tipo: 'gasto', bolsillo_id: 'b1', direccion: 'salida', monto: 9 }], 'b1'), 200);
});

test('estadoMeta: inicial + aportes + reserva; por mes contando este', () => {
  const e = estadoMeta(meta, {
    hoyMes: '2026-10',
    aportes: [{ meta_id: 'm1', fecha: '2026-09-10', monto: 100000 }, { meta_id: 'otra', fecha: '2026-09-10', monto: 999 }],
    movs: [res({ monto: 200000, fecha: '2026-08-05' }), res({ monto: 100000, fecha: '2026-09-05' })]
  });
  assert.equal(e.juntado, 500000);
  assert.equal(e.falta, 700000);
  assert.equal(e.meses, 3); // oct, nov, dic
  assert.equal(e.porMes, 233333.33);
  assert.equal(e.ritmo, 133333.33); // (0 + 200k + 200k) / 3 de jul-ago-sep
  assert.equal(e.llegaEn, 6);
});

test('estadoMeta: aportar este mes no baja la cuota; ritmo desde que existe', () => {
  const m = { ...meta, bolsillo_id: null, saldo_inicial: 0, objetivo: 300, fecha_objetivo: '2026-12-20', created_at: '2026-09-15T00:00:00Z' };
  const antes = estadoMeta(m, { hoy: '2026-10-12' });
  assert.equal(antes.porMes, 100); assert.equal(antes.esteMes, 100);
  const despues = estadoMeta(m, { hoy: '2026-10-12', aportes: [{ meta_id: 'm1', fecha: '2026-10-05', monto: 100 }] });
  assert.equal(despues.porMes, 100); assert.equal(despues.esteMes, 0);
  // Un retiro este mes no achica la cuota.
  const ret = estadoMeta({ ...m, saldo_inicial: 200 }, { hoy: '2026-10-12', aportes: [{ meta_id: 'm1', fecha: '2026-10-05', monto: -150 }] });
  assert.equal(ret.porMes, 83.33);
  // Creada en septiembre con 90 aportados: ritmo 90 (1 mes cerrado), no 30.
  assert.equal(estadoMeta(m, { hoy: '2026-10-12', aportes: [{ meta_id: 'm1', fecha: '2026-09-20', monto: 90 }] }).ritmo, 90);
  // Fecha temprana del mes: ese mes no cuenta. Fecha pasada este mes: vencida.
  assert.equal(estadoMeta({ ...m, fecha_objetivo: '2026-11-01' }, { hoy: '2026-10-12' }).meses, 1);
  assert.equal(estadoMeta({ ...m, fecha_objetivo: '2026-10-05' }, { hoy: '2026-10-12' }).vencida, true);
  assert.equal(aTexto(0.00000012), '0,00000012');
});

test('estadoMeta: vencida, cumplida y sin fecha', () => {
  assert.equal(estadoMeta({ ...meta, fecha_objetivo: '2026-08-01' }, { hoyMes: '2026-10' }).vencida, true);
  const c = estadoMeta({ ...meta, saldo_inicial: 2000000 }, { hoyMes: '2026-10' });
  assert.equal(c.cumplida, true); assert.equal(c.porMes, null); assert.equal(c.progreso, 1);
  const s = estadoMeta({ ...meta, fecha_objetivo: null }, { hoyMes: '2026-10' });
  assert.equal(s.porMes, null); assert.equal(s.llegaEn, null);
  // Retiros nunca dejan lo juntado negativo.
  assert.equal(estadoMeta({ ...meta, saldo_inicial: 0 }, { hoyMes: '2026-10', aportes: [{ meta_id: 'm1', fecha: '2026-10-01', monto: -50 }] }).juntado, 0);
});

test('planMetas: alcanza / no alcanza y cuáles se cubren por fecha', () => {
  const metas = [
    { id: 'a', estado: 'activa', moneda: 'ARS', fecha_objetivo: '2027-01-01' },
    { id: 'b', estado: 'activa', moneda: 'ARS', fecha_objetivo: '2026-12-01' },
    { id: 'u', estado: 'activa', moneda: 'USD', fecha_objetivo: '2026-12-01' }
  ];
  const est = { a: { porMes: 100 }, b: { porMes: 50 }, u: { porMes: 999 } };
  const p = planMetas(metas, est, 120);
  assert.equal(p.necesario, 150);
  assert.equal(p.alcanza, false);
  assert.equal(p.diferencia, -30);
  assert.deepEqual(p.cubiertas, ['b']);
  assert.equal(planMetas(metas, est, 200).alcanza, true);
  assert.equal(planMetas(metas, est, null).alcanza, null);
});

const precios = new Map([
  ['cedear|AAPL', { precio: 27200, moneda: 'ARS', fecha: '2026-10-12' }],
  ['cedear|AAPLD', { precio: 17.61, moneda: 'USD', fecha: '2026-10-12' }],
  ['bono|AL30', { precio: 86600, moneda: 'ARS', fecha: '2026-10-12' }],
  ['cripto|BTC', { precio: 80000, moneda: 'USD', fecha: '2026-10-12' }],
  ['dolar|bolsa', { precio: 1500, compra: 1500, venta: 1510, fecha: '2026-10-12' }],
  ['fci|Fondo X', { precio: 2.5, moneda: 'ARS', fecha: '2026-10-09' }]
]);
const ctx = { mep: 1500, hoy: '2026-10-12' };

test('valuar: CEDEAR en pesos y en dólares, con ganancia', () => {
  const v = valuar({ tipo: 'cedear', simbolo: 'AAPL', cantidad: 10, capital: 250000, moneda: 'ARS' }, precios, ctx);
  assert.equal(v.ars, 272000); assert.equal(v.usd, 181.33); assert.equal(v.ganancia, 22000); assert.equal(v.gananciaPct, 8.8);
  const d = valuar({ tipo: 'cedear', simbolo: 'AAPLD', cantidad: 10, capital: 170, moneda: 'USD' }, precios, ctx);
  assert.equal(d.usd, 176.1); assert.equal(d.ars, 264150); assert.equal(d.ganancia, 6.1);
});

test('valuar: bono cada 100 VN, cripto, dólares, FCI por cuotapartes', () => {
  assert.equal(valuar({ tipo: 'bono', simbolo: 'AL30', cantidad: 1000 }, precios, ctx).ars, 866000);
  assert.equal(valuar({ tipo: 'cripto', simbolo: 'BTC', cantidad: 0.01 }, precios, ctx).usd, 800);
  const usd = valuar({ tipo: 'dolar', simbolo: 'bolsa', cantidad: 100, capital: 140000, moneda: 'ARS' }, precios, ctx);
  assert.equal(usd.ars, 150000); assert.equal(usd.ganancia, 10000); assert.equal(usd.gananciaMoneda, 'ARS');
  assert.equal(valuar({ tipo: 'fci', simbolo: 'Fondo X', cantidad: 1000 }, precios, ctx).ars, 2500);
});

test('valuar: plazo fijo estimado, tope al plazo y vencimiento', () => {
  const pf = { tipo: 'plazo_fijo', capital: 1000000, tna: 36.5, fecha_inicio: '2026-09-12', plazo_dias: 30, moneda: 'ARS' };
  const v = valuar(pf, precios, ctx);
  assert.equal(v.ars, 1030000); assert.equal(v.estimado, true); assert.equal(v.vence, '2026-10-12'); assert.equal(v.vencido, true);
  assert.equal(valuar({ tipo: 'fci', simbolo: 'Fondo X', capital: 5000, moneda: 'ARS' }, precios, ctx).estimado, true); // sin fecha: lo que pusiste, marcado estimado
  assert.equal(valuar({ ...pf, plazo_dias: 365 }, precios, ctx).ars, 1030000); // 30 días transcurridos
  assert.equal(valuar({ ...pf, fecha_inicio: '2026-01-01', plazo_dias: 30 }, precios, ctx).ars, 1030000); // tope al plazo
});

test('valuar: sin precio y otro manual', () => {
  assert.equal(valuar({ tipo: 'cedear', simbolo: 'NOEXISTE', cantidad: 1 }, precios, ctx).sinPrecio, true);
  assert.equal(valuar({ tipo: 'otro', valor_manual: 5000, capital: 4000, moneda: 'ARS' }, precios, ctx).ganancia, 1000);
  const sm = valuar({ tipo: 'cedear', simbolo: 'AAPLD', cantidad: 1 }, precios, { mep: null, hoy: '2026-10-12' });
  assert.equal(sm.ars, null); assert.equal(sm.sinMep, true); assert.equal(sm.sinPrecio, false);
});

test('totalCartera: suma activas en pesos, cuenta las sin precio', () => {
  const invs = [{ id: 1, tipo: 'cedear', estado: 'activa' }, { id: 2, tipo: 'bono', estado: 'activa' }, { id: 3, tipo: 'cripto', estado: 'cerrada' }, { id: 4, tipo: 'cedear', estado: 'activa' }];
  const t = totalCartera([...invs, { id: 5, tipo: 'cripto', estado: 'activa' }], { 1: { ars: 100, usd: 1 }, 2: { ars: 50, usd: 0.5 }, 3: { ars: 999, usd: 9 }, 4: { ars: null, sinPrecio: true }, 5: { ars: null, usd: 7 } });
  assert.equal(t.ars, 150); assert.equal(t.faltan, 1); assert.equal(t.faltaMep, 1); assert.equal(t.usdSinPasar, 7); assert.equal(t.porTipo[0].tipo, 'cedear');
});

test('validaciones', () => {
  assert.equal(validarMeta({ nombre: 'Auto', objetivo: '5.000.000', saldo_inicial: '' }).fila.objetivo, 5000000);
  assert.match(validarMeta({ nombre: 'Auto', objetivo: '0' }).error, /juntar/);
  assert.match(validarInversion({ tipo: 'cedear', nombre: 'Apple' }).error, /ticker/);
  assert.match(validarInversion({ tipo: 'bono', simbolo: 'AL30', nombre: 'AL30' }).error, /nominal/);
  assert.match(validarInversion({ tipo: 'plazo_fijo', nombre: 'PF', capital: '1000' }).error, /fecha/);
  assert.match(validarInversion({ tipo: 'plazo_fijo', nombre: 'PF', capital: '1000', fecha_inicio: '2026-10-01' }).error, /plazo/);
  assert.equal(validarInversion({ tipo: 'cripto', simbolo: 'BTC', nombre: 'BTC', cantidad: '0.005' }).fila.cantidad, 0.005);
  assert.equal(validarInversion({ tipo: 'cripto', simbolo: 'BTC', nombre: 'BTC', cantidad: '0,00012345' }).fila.cantidad, 0.00012345);
  assert.equal(validarInversion({ tipo: 'bono', simbolo: 'AL30', nombre: 'AL30', cantidad: '1.000.000' }).fila.cantidad, 1000000);
  assert.equal(validarInversion({ tipo: 'bono', simbolo: 'AL30', nombre: 'AL30', cantidad: '10.000' }).fila.cantidad, 10000);
  assert.equal(validarInversion({ tipo: 'fci', simbolo: 'F', nombre: 'F', cantidad: '1.500' }).fila.cantidad, 1500);
  assert.equal(validarInversion({ tipo: 'fci', simbolo: 'F', nombre: 'F', cantidad: '1.5' }).fila.cantidad, 1.5);
  assert.equal(validarInversion({ tipo: 'cripto', simbolo: 'ETH', nombre: 'ETH', cantidad: '1.500' }).fila.cantidad, 1.5);
  assert.match(validarMeta({ nombre: 'X', objetivo: '1', fecha_objetivo: '2026-01-01' }, { nueva: true, hoy: '2026-10-12' }).error, /pasó/);
  const f = validarInversion({ tipo: 'dolar', simbolo: 'bolsa', nombre: 'Dólares', cantidad: '100', capital: '150.000' }).fila;
  assert.equal(f.moneda, 'ARS'); assert.equal(f.capital, 150000);
  assert.equal(validarInversion({ tipo: 'plazo_fijo', nombre: 'PF', capital: '1.000.000', fecha_inicio: '2026-10-01', tna: '35,5', plazo_dias: '30' }).fila.tna, 35.5);
  assert.equal(interesPlazoFijo(1000000, 0.365, 30), 30000);
});

test('estadoMeta con saldosReserva: reserva con saldo propio ignora saldo_inicial (no duplica)', () => {
  const base = { hoyMes: '2026-10', aportes: [{ meta_id: 'm1', fecha: '2026-09-10', monto: 100000 }], movs: [res({ monto: 200000, fecha: '2026-08-05' })] };
  // Con saldo real/manual: a mano 100.000 + reserva 350.000, sin sumar los 100.000 de saldo_inicial
  const e = estadoMeta(meta, { ...base, saldosReserva: { b1: { saldo: 350000, ancla: true } } });
  assert.equal(e.juntado, 450000);
  assert.equal(e.reserva, 350000);
  assert.equal(e.inicial, 0);
  // Reserva de MP sin saldo real: conserva saldo_inicial como siempre
  const e2 = estadoMeta(meta, { ...base, saldosReserva: { b1: { saldo: 200000, ancla: false } } });
  assert.equal(e2.juntado, 400000);
  assert.equal(e2.inicial, 100000);
  // Sin saldosReserva: comportamiento anterior intacto
  assert.equal(estadoMeta(meta, base).juntado, 400000);
});

test('estadoMeta en dólares con reserva manual en USD', () => {
  const usd = { ...meta, moneda: 'USD', objetivo: 5000, saldo_inicial: 0, fecha_objetivo: null };
  const e = estadoMeta(usd, { hoyMes: '2026-10', saldosReserva: { b1: { saldo: 1250.5, ancla: true } } });
  assert.equal(e.juntado, 1250.5);
  assert.equal(e.falta, 3749.5);
});

test('estadoMeta: reserva sin saldo propio mantiene el neto sin clamp (retiro neto por rendimiento)', () => {
  const m = { ...meta, saldo_inicial: 1000, objetivo: 5000 };
  const e = estadoMeta(m, { hoyMes: '2026-10', movs: [res({ monto: 300, direccion: 'entrada', fecha: '2026-09-01' })], saldosReserva: { b1: { saldo: 0, ancla: false } } });
  assert.equal(e.reserva, -300);
  assert.equal(e.juntado, 700);
});

test('seguro con ahorro: vale el rescate, ganancia contra lo aportado (estimado si no se carga)', () => {
  const ctx = { mep: 1000, hoy: '2026-10-16' };
  const base = { tipo: 'seguro', subtipo: 'unit_linked', moneda: 'USD', valor_manual: 1200, valor_rescate: 900, aporte_monto: 100, aporte_frecuencia: 'mensual', fecha_inicio: '2025-11-05', valor_fecha: '2026-10-01' };
  const v = valuar(base, new Map(), ctx);
  assert.equal(v.usd, 900); assert.equal(v.ars, 900000);
  assert.equal(v.seguro.aportado, 1100); // hasta la fecha del valor (01/10): 11 aportes, nov-25 a sep-26
  assert.equal(v.seguro.aportadoEstimado, true);
  assert.equal(v.ganancia, -200);
  assert.equal(v.fechaPrecio, null);
  assert.equal(aportadoEstimado({ aporte_monto: 100, fecha_inicio: '2026-01-31' }, '2026-02-28'), 200); // fin de mes
  assert.equal(aportadoEstimado({ aporte_monto: 100, fecha_inicio: '2026-11-01' }, '2026-10-16'), null); // alta futura
  assert.equal(valuar({ ...base, valor_fecha: null }, new Map(), ctx).seguro.viejo, true);
  assert.equal(v.seguro.viejo, false);
  const sinRescate = valuar({ ...base, valor_rescate: null, capital: 1000 }, new Map(), ctx);
  assert.equal(sinRescate.usd, 1200); assert.equal(sinRescate.ganancia, 200); assert.equal(sinRescate.seguro.aportadoEstimado, false);
  assert.equal(valuar({ ...base, valor_fecha: '2026-07-01' }, new Map(), ctx).seguro.viejo, true);
  assert.equal(aportadoEstimado({ aporte_monto: 600, aporte_frecuencia: 'semestral', fecha_inicio: '2026-01-10' }, '2026-10-16'), 1200);
  assert.equal(valuar({ ...base, valor_manual: null, valor_rescate: null }, new Map(), ctx).sinPrecio, true);
});

test('validarInversion: seguro', () => {
  const f = { tipo: 'seguro', nombre: 'Zurich Invest Future Joven', subtipo: 'unit_linked', moneda: 'USD', valor_manual: '1.200', aporte_monto: '100', aporte_frecuencia: 'mensual', valor_fecha: '2026-10-01' };
  const op = { hoy: '2026-10-16' };
  const ok = validarInversion(f, op).fila;
  assert.equal(ok.valor_manual, 1200); assert.equal(ok.aporte_monto, 100); assert.equal(ok.subtipo, 'unit_linked'); assert.equal(ok.moneda, 'USD');
  assert.match(validarInversion({ ...f, valor_manual: '' }, op).error, /valor de la cuenta/);
  assert.match(validarInversion({ ...f, subtipo: '' }, op).error, /tipo de seguro/);
  assert.match(validarInversion({ ...f, valor_rescate: '2000' }, op).error, /rescate/);
  assert.match(validarInversion({ ...f, valor_fecha: '' }, op).error, /fecha/);
  assert.match(validarInversion({ ...f, valor_fecha: '2026-11-01' }, op).error, /futura/);
  assert.match(validarInversion({ ...f, fecha_inicio: '2026-12-01' }, op).error, /futura/);
  assert.match(validarInversion({ ...f, capital: 'abc' }, op).error, /total aportado/);
  assert.equal(validarInversion({ tipo: 'otro', nombre: 'X', valor_manual: '5' }).fila.subtipo, null);
});

test('rendimientoSeguro: TIR con tiempo real, aniversario, frecuencias y casos borde', () => {
  const pol = { aporte_monto: 100, aporte_frecuencia: 'mensual', fecha_inicio: '2016-10-01' };
  const r = rendimientoSeguro(pol, 14500, null, '2026-09-30'); // 120 aportes de 100 → 14.500
  assert.ok(Math.abs(r.anual - 3.7) <= 0.1); assert.equal(r.estimado, true);
  assert.equal(rendimientoSeguro(pol, 12000, 12000, '2026-09-25').anual, 0);
  assert.equal(rendimientoSeguro(pol, 12000, 12000, '2026-09-25').estimado, false);
  assert.equal(rendimientoSeguro({ ...pol, fecha_inicio: '2026-03-01' }, 800, null, '2026-09-30').corto, true);
  assert.equal(rendimientoSeguro(pol, 0, null, '2026-09-30').anual, -100);
  assert.equal(rendimientoSeguro({ ...pol, aporte_monto: null }, 100, null, '2026-09-30'), null);
  assert.equal(rendimientoSeguro(pol, NaN, null, '2026-09-30'), null);
  assert.equal(rendimientoSeguro({ ...pol, aporte_frecuencia: 'anual', aporte_monto: 1200 }, 1e18, null, '2026-09-30').dudoso, true); // > 1000 % anual
  // Anual al 10 % verdadero: el día del aniversario (2º pago recién hecho) tiene que seguir dando 10 %.
  const an = { aporte_monto: 1200, aporte_frecuencia: 'anual', fecha_inicio: '2025-10-01' };
  assert.ok(Math.abs(rendimientoSeguro(an, 1320, null, '2026-09-30').anual - 10) < 0.3);
  assert.ok(Math.abs(rendimientoSeguro(an, 2520, null, '2026-10-01').anual - 10) < 0.3);
  // Trimestral al 10 % anual, valor justo después del 5º pago.
  const q = (1.1 ** 0.25); const vq = 300 * (q ** 4 + q ** 3 + q ** 2 + q + 1);
  assert.ok(Math.abs(rendimientoSeguro({ aporte_monto: 300, aporte_frecuencia: 'trimestral', fecha_inicio: '2025-10-01' }, vq, null, '2026-10-01').anual - 10) < 0.3);
});

test('inflacionDelPeriodo y seguro en pesos: real contra el mismo período; sin total aportado no inventa', () => {
  const serie = new Map(); for (let a = 2024; a <= 2026; a++) for (let m = 1; m <= 12; m++) { const k = `${a}-${String(m).padStart(2, '0')}`; if (k <= '2026-09') serie.set(k, 2); }
  const anual2 = (1.02 ** 12 - 1) * 100;
  assert.ok(Math.abs(inflacionDelPeriodo(serie, '2024-10-01', '2026-10-16') - anual2) < 1e-9); // oct no publicado: hasta sep
  assert.equal(inflacionDelPeriodo(serie, '2020-01-01', '2026-10-16'), null); // sin datos de todo el período
  assert.equal(inflacionDelPeriodo(serie, '2026-02-01', '2026-10-16'), null); // menos de 12 meses
  const base = { tipo: 'seguro', subtipo: 'retiro', moneda: 'ARS', valor_manual: 2000000, valor_rescate: 1800000, aporte_monto: 50000, fecha_inicio: '2024-10-01', valor_fecha: '2026-09-30', capital: 1250000 };
  const v = valuar(base, new Map(), { mep: 1000, hoy: '2026-10-16', inflacion: serie });
  assert.ok(v.seguro.rinde.anual > 0); assert.ok(v.seguro.rindeCuenta.anual > v.seguro.rinde.anual); // rinde = sobre el rescate (lo que se muestra)
  assert.ok(v.seguro.real < v.seguro.rinde.anual); assert.ok(Math.abs(v.seguro.inflacion - 26.8) < 0.1);
  const sinCap = valuar({ ...base, capital: null }, new Map(), { mep: 1000, hoy: '2026-10-16', inflacion: serie });
  assert.equal(sinCap.seguro.rinde, null); assert.equal(sinCap.ganancia, null); assert.equal(sinCap.seguro.faltaAportado, true);
  assert.equal(valuar({ ...base, moneda: 'USD', capital: null }, new Map(), { mep: 1000, hoy: '2026-10-16', inflacion: serie }).seguro.real, null);
});
