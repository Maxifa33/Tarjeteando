/**
 * Tests de la sección Mes (services/mes.js) — `npm test`.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  cicloDePago,
  composicion,
  libre,
  proximoMes,
  cuotasDelMes,
  desfasePorTarjeta,
  mesDelProximoVencimiento,
  sumarMeses,
  composicionPorTarjeta,
  composicionDesdeTarjetas,
  fijosPorTarjeta
} from './mes.js';
import { construirPlanes, proyectarCuotas } from './cuotas.js';

const HOY = '2026-09-26';

// Fixture del prototipo: BBVA con resumen cerrado; Santander (2 plásticos), Galicia Visa
// y Galicia MC en curso con Últimos consumos. Todo vence en octubre.
const tarjetas = [
  { nombre: 'VISA BBVA', banco: 'BBVA', tipo: 'VISA' },
  { nombre: 'VISA Santander', banco: 'Santander', tipo: 'VISA' },
  { nombre: 'VISA Galicia', banco: 'Galicia', tipo: 'VISA' },
  { nombre: 'Mastercard Galicia', banco: 'Galicia', tipo: 'Mastercard' }
];

const resumenes = [
  // BBVA: cerrado, vence en octubre.
  { id: 'VISA BBVA-2026-9', tarjeta: 'VISA BBVA', anio: 2026, mes: 9, fecha_cierre: '2026-09-24', fecha_vencimiento: '2026-10-05', total_a_pagar_pesos: 326410, total_a_pagar_dolares: 22.99 },
  // Resúmenes viejos (ya vencidos): no cuentan.
  { id: 'VISA Santander-2026-8', tarjeta: 'VISA Santander', anio: 2026, mes: 8, fecha_cierre: '2026-08-28', fecha_vencimiento: '2026-09-09', total_a_pagar_pesos: 700000 },
  { id: 'VISA Galicia-2026-8', tarjeta: 'VISA Galicia', anio: 2026, mes: 8, fecha_cierre: '2026-09-04', fecha_vencimiento: '2026-09-16', total_a_pagar_pesos: 380000 },
  { id: 'Mastercard Galicia-2026-8', tarjeta: 'Mastercard Galicia', anio: 2026, mes: 8, fecha_cierre: '2026-09-11', fecha_vencimiento: '2026-09-23', total_a_pagar_pesos: 150000 }
];

const ciclo = (grupoKey, banco, red, miembros, cierre, vto) => ({
  grupoKey, banco, red, principal: miembros[0], miembros,
  fecha_cierre: cierre, fecha_vencimiento: vto, estado: 'provisional',
  actualizado_at: '2026-09-26T22:46:00.000Z'
});
const consumo = (grupo_key, ciclo_cierre, ult4, pesos, extra = {}) => ({
  grupo_key, ciclo_cierre, tarjeta_ult4: ult4, monto_pesos: pesos, monto_dolares: 0, es_cuota: false, ...extra
});

const ciclosLive = {
  'Santander|Visa|3327': ciclo('Santander|Visa|3327', 'Santander', 'Visa', ['3327', '1510'], '2026-10-01', '2026-10-09'),
  'Galicia|Visa|4410': ciclo('Galicia|Visa|4410', 'Galicia', 'Visa', ['4410'], '2026-10-02', '2026-10-14'),
  'Galicia|Mastercard|8823': ciclo('Galicia|Mastercard|8823', 'Galicia', 'Mastercard', ['8823'], '2026-10-09', '2026-10-21')
};
const consumosLive = [
  consumo('Santander|Visa|3327', '2026-10-01', '3327', 739748.66),
  consumo('Santander|Visa|3327', '2026-10-01', '3327', 108327.44, { es_cuota: true }),
  consumo('Santander|Visa|3327', '2026-10-01', '1510', 44166.55),
  consumo('Galicia|Visa|4410', '2026-10-02', '4410', 295957.20),
  consumo('Galicia|Visa|4410', '2026-10-02', '4410', 116423, { es_cuota: true }),
  consumo('Galicia|Mastercard|8823', '2026-10-09', '8823', 154562),
  consumo('Galicia|Mastercard|8823', '2026-10-09', '8823', 33343, { es_cuota: true })
];

describe('cicloDePago', () => {
  const ciclo = cicloDePago({ hoy: HOY, tarjetas, resumenes, ciclosLive, consumosLive });
  const por = Object.fromEntries(ciclo.porTarjeta.map((t) => [t.tarjetaId, t]));

  test('el mes del ciclo es el del próximo vencimiento ≥ hoy', () => {
    assert.equal(ciclo.mesKey, '2026-10');
  });

  test('BBVA sale del resumen cerrado; el resto, de Últimos consumos', () => {
    assert.equal(por['VISA BBVA'].fuente, 'resumen_cerrado');
    assert.equal(por['VISA BBVA'].total, 326410);
    assert.equal(por['VISA Santander'].fuente, 'en_curso');
    assert.equal(por['VISA Santander'].total, 892242.65);
    assert.equal(por['VISA Galicia'].total, 412380.2);
    assert.equal(por['Mastercard Galicia'].total, 187905);
  });

  test('SuperCard: los plásticos del grupo con su subtotal', () => {
    assert.deepEqual(por['VISA Santander'].plasticos, [
      { ult4: '3327', total: 848076.1 },
      { ult4: '1510', total: 44166.55 }
    ]);
  });

  test('Últimos consumos que ya incluyen la cuota: el total no se duplica', () => {
    // 739.748,66 + 108.327,44 (cuota) + 44.166,55 = 892.242,65: la cuota está una sola vez.
    const comp = composicion({ porTarjeta: ciclo.porTarjeta, cuotasDelMes: 353893.44, fijosArs: 70997 });
    assert.equal(comp.total, 1818937.85);
  });

  test('fixture del prototipo: composición y libre', () => {
    const comp = composicion({ porTarjeta: ciclo.porTarjeta, cuotasDelMes: 353893.44, fijosArs: 70997, fijosUsd: 22.99 });
    assert.equal(comp.total, 1818937.85);
    assert.equal(comp.cuotas, 353893.44);
    assert.equal(comp.fijos, 70997);
    assert.equal(comp.variables, 1394047.41);
    assert.equal(comp.fijosUsd, 22.99);
    assert.deepEqual(comp.avisos, []);
    assert.deepEqual(libre(comp.total, 2000000), { libre: 181062.15, pasado: false, pct: 1818937.85 / 2000000 });
  });
});

describe('tarjeta sin datos', () => {
  test('no suma y genera aviso', () => {
    const sinGaliciaMC = Object.fromEntries(Object.entries(ciclosLive).filter(([k]) => !k.includes('Mastercard')));
    const c = cicloDePago({ hoy: HOY, tarjetas, resumenes, ciclosLive: sinGaliciaMC, consumosLive });
    const mc = c.porTarjeta.find((t) => t.tarjetaId === 'Mastercard Galicia');
    assert.equal(mc.fuente, 'sin_datos');
    assert.equal(mc.total, 0);
    const comp = composicion({ porTarjeta: c.porTarjeta, cuotasDelMes: 0, fijosArs: 0 });
    assert.equal(comp.total, 1818937.85 - 187905);
    assert.deepEqual(comp.avisos, [{ tipo: 'tarjeta_sin_datos', tarjetas: ['Mastercard Galicia'] }]);
  });

  test('variables negativas → 0 con aviso datos_inconsistentes', () => {
    const comp = composicion({ porTarjeta: [{ tarjetaId: 'x', fuente: 'en_curso', total: 100 }], cuotasDelMes: 80, fijosArs: 50 });
    assert.equal(comp.variables, 0);
    assert.deepEqual(comp.avisos, [{ tipo: 'datos_inconsistentes' }]);
  });

  test('ciclo sin banco o de una tarjeta desconocida aparece como entrada propia', () => {
    const c = cicloDePago({
      hoy: HOY, tarjetas: [], resumenes: [],
      ciclosLive: { 'sin-banco|Visa|9999': ciclo('sin-banco|Visa|9999', '', 'Visa', ['9999'], '2026-10-01', '2026-10-10') },
      consumosLive: [consumo('sin-banco|Visa|9999', '2026-10-01', '9999', 5000)]
    });
    assert.equal(c.porTarjeta.length, 1);
    assert.equal(c.porTarjeta[0].tarjetaId, 'sin-banco|Visa|9999');
    assert.equal(c.porTarjeta[0].total, 5000);
  });
});

describe('libre', () => {
  test('tope null → libre null', () => {
    assert.deepEqual(libre(1000, null), { libre: null, pasado: false, pct: null });
  });
  test('te pasás del tope', () => {
    const l = libre(2100000, 2000000);
    assert.equal(l.libre, -100000);
    assert.equal(l.pasado, true);
  });
});

describe('fechas en el límite', () => {
  test('un resumen que vence HOY todavía cuenta', () => {
    const r = [{ tarjeta: 'VISA BBVA', fecha_cierre: '2026-09-15', fecha_vencimiento: HOY, total_a_pagar_pesos: 1000 }];
    const c = cicloDePago({ hoy: HOY, tarjetas: [tarjetas[0]], resumenes: r });
    assert.equal(c.mesKey, '2026-09');
    assert.equal(c.porTarjeta[0].fuente, 'resumen_cerrado');
  });

  test('un resumen ya vencido no cuenta para el ciclo', () => {
    const r = [{ tarjeta: 'VISA BBVA', fecha_cierre: '2026-09-15', fecha_vencimiento: '2026-09-25', total_a_pagar_pesos: 1000 }];
    const c = cicloDePago({ hoy: HOY, tarjetas: [tarjetas[0]], resumenes: r, mesKey: '2026-09' });
    assert.equal(c.porTarjeta[0].fuente, 'sin_datos');
    // Venció el 25/9 y hoy es 26/9: el próximo pago de esa tarjeta es en octubre.
    assert.equal(mesDelProximoVencimiento({ hoy: HOY, resumenes: r }), '2026-10');
  });

  test('todo vencido: el próximo pago se estima con el día del último vencimiento de cada tarjeta', () => {
    const r = [
      { tarjeta: 'VISA BBVA', fecha_vencimiento: '2026-08-05' },
      { tarjeta: 'VISA BBVA', fecha_vencimiento: '2026-09-05' },
      { tarjeta: 'VISA Galicia', fecha_vencimiento: '2026-09-16' }
    ];
    assert.equal(mesDelProximoVencimiento({ hoy: HOY, resumenes: r }), '2026-10');
    // Si una tarjeta todavía no llegó a su día de vencimiento este mes, es este mes.
    const r2 = [{ tarjeta: 'VISA BBVA', fecha_vencimiento: '2026-07-28' }];
    assert.equal(mesDelProximoVencimiento({ hoy: HOY, resumenes: r2 }), '2026-09');
    assert.equal(mesDelProximoVencimiento({ hoy: HOY, resumenes: [] }), '2026-09');
  });

  test('dos tarjetas del mismo banco que vencen en meses distintos: cada una en su mes', () => {
    const r = [
      { tarjeta: 'VISA Galicia', fecha_cierre: '2026-09-20', fecha_vencimiento: '2026-09-30', total_a_pagar_pesos: 1000 },
      { tarjeta: 'Mastercard Galicia', fecha_cierre: '2026-09-25', fecha_vencimiento: '2026-10-06', total_a_pagar_pesos: 2000 }
    ];
    const t = [tarjetas[2], tarjetas[3]];
    const sep = cicloDePago({ hoy: HOY, tarjetas: t, resumenes: r });
    assert.equal(sep.mesKey, '2026-09');
    assert.deepEqual(sep.porTarjeta.map((x) => x.fuente), ['resumen_cerrado', 'sin_datos']);
    const oct = cicloDePago({ hoy: HOY, tarjetas: t, resumenes: r, mesKey: '2026-10' });
    assert.deepEqual(oct.porTarjeta.map((x) => x.fuente), ['sin_datos', 'resumen_cerrado']);
  });

  test('sumarMeses cruza el año', () => {
    assert.equal(sumarMeses('2026-12', 1), '2027-01');
  });
});

// Caso Easy Warnes (ver cuotas.test.js): VISA Galicia, julio y agosto de 2026.
describe('cuotasDelMes contra proyectarCuotas (Easy Warnes)', () => {
  const resumen = (anio, mes, cierre, vto) => ({ id: `VISA Galicia-${anio}-${mes}`, tarjeta: 'VISA Galicia', anio, mes, fecha_cierre: cierre, fecha_vencimiento: vto });
  const JUL = resumen(2026, 7, '2026-07-31', '2026-08-12');
  const AGO = resumen(2026, 8, '2026-08-28', '2026-09-09');
  const mov = (r, referencia, cuota, pesos) => ({ id: `${r.id}-${referencia}`, resumen_id: r.id, tarjeta: r.tarjeta, referencia_limpia: referencia, cuota_texto: cuota, monto_pesos: pesos, monto_dolares: 0 });
  const movs = [
    mov(JUL, 'Muss Sa', '06/06', 73333.33), mov(JUL, 'Todopampa', '02/04', 29797.43),
    mov(JUL, 'Sodastream', '02/03', 45366.33), mov(JUL, 'Ilcapitano', '02/03', 39991.00),
    mov(JUL, 'Easy', '01/03', 53745.00),
    mov(AGO, 'Todopampa', '03/04', 29797.43), mov(AGO, 'Sodastream', '03/03', 45366.33),
    mov(AGO, 'Ilcapitano', '03/03', 39991.00), mov(AGO, 'Urquiza', '01/03', 106250.00),
    mov(AGO, 'Planoutcanaldeven', '01/03', 55200.00), mov(AGO, 'Puma Alto Palermo', '01/03', 53333.00)
  ];
  const planes = construirPlanes(movs, [JUL, AGO]);
  const desfase = desfasePorTarjeta([JUL, AGO]);
  const proy = proyectarCuotas(planes, { meses: 3, resumenes: [JUL, AGO] });

  test('desfase cierre → vencimiento de 1 mes', () => {
    assert.deepEqual(desfase, { 'VISA Galicia': 1 });
  });

  test('lo que se paga en octubre = bucket de septiembre de la proyección (por mes_key)', () => {
    const bucket = proy.find((p) => p.mes_key === '2026-09');
    assert.equal(cuotasDelMes(planes, '2026-10', { desfase }).total, bucket.total);
    assert.equal(bucket.total, 244580.43);
    assert.equal(cuotasDelMes(planes, '2026-11', { desfase }).total, proy.find((p) => p.mes_key === '2026-10').total);
  });

  test('lo que se paga en septiembre = las cuotas del resumen de agosto (Easy interrumpida no entra)', () => {
    const sep = cuotasDelMes(planes, '2026-09', { desfase });
    assert.equal(sep.total, 329937.76);
    assert.ok(!sep.items.some((i) => i.descripcion === 'Easy'));
  });

  test('marca la última cuota y hasta cuándo se paga', () => {
    const oct = cuotasDelMes(planes, '2026-10', { desfase });
    const todopampa = oct.items.find((i) => i.descripcion === 'Todopampa');
    assert.equal(todopampa.cuota_numero, 4);
    assert.equal(todopampa.es_ultima, true);
    const urquiza = oct.items.find((i) => i.descripcion === 'Urquiza');
    assert.equal(urquiza.cuota_numero, 2);
    assert.equal(urquiza.hasta, '2026-11');
  });

  test('acepta el formato de formatearParaVista', () => {
    const vista = planes.map((p) => ({ tarjeta: p.tarjeta, descripcion: p.referencia_limpia, cuotas_pagadas: p.cuota_actual, total_cuotas: p.total_cuotas, monto_cuota_pesos: p.monto_pesos, monto_cuota_dolares: 0, interrumpida: p.interrumpida, periodo_anio: p.periodo_anio, periodo_mes: p.periodo_mes }));
    assert.equal(cuotasDelMes(vista, '2026-10', { desfase }).total, 244580.43);
  });
});

describe('cuotas en dólares', () => {
  test('van aparte y no entran en el total en pesos', () => {
    const planes = [
      { tarjeta: 'VISA BBVA', descripcion: 'Steam', cuota_actual: 1, total_cuotas: 3, monto_pesos: 0, monto_dolares: 10, periodo_anio: 2026, periodo_mes: 9 },
      { tarjeta: 'VISA BBVA', descripcion: 'Coto', cuota_actual: 1, total_cuotas: 3, monto_pesos: 5000, monto_dolares: 0, periodo_anio: 2026, periodo_mes: 9 }
    ];
    const r = cuotasDelMes(planes, '2026-10', { cotizacionVenta: 1500 });
    assert.equal(r.total, 5000);
    assert.equal(r.totalUsd, 10);
    assert.equal(r.items.find((i) => i.descripcion === 'Steam').monto, 15000);
  });
});

describe('compras en 1 cuota', () => {
  test('una cuota 1/1 es compra común: no entra en cuotas', () => {
    const r = cuotasDelMes([{ tarjeta: 'X', descripcion: 'Uno', cuota_actual: 1, total_cuotas: 1, monto_pesos: 999, periodo_anio: 2026, periodo_mes: 9 }], '2026-10');
    assert.equal(r.total, 0);
  });
});

describe('proximoMes', () => {
  test('sin ciclos abiertos: solo cuotas y fijos', () => {
    const p = proximoMes({ cuotasDelMes: 300000, fijosArs: 70997, porTarjetaSiguiente: [{ tarjetaId: 'a', fuente: 'sin_datos' }] });
    assert.equal(p.variables, 0);
    assert.equal(p.total, 370997);
    assert.equal(p.abierto, false);
  });

  test('con un ciclo abierto: suma lo ya consumido sin las cuotas', () => {
    const p = proximoMes({
      cuotasDelMes: 300000, fijosArs: 70997,
      porTarjetaSiguiente: [{ tarjetaId: 'a', fuente: 'en_curso', total: 60000, unPago: 50000 }]
    });
    assert.equal(p.variables, 50000);
    assert.equal(p.abierto, true);
  });
});

describe('composicionPorTarjeta', () => {
  const c = cicloDePago({ hoy: HOY, tarjetas, resumenes, ciclosLive, consumosLive });
  // Cuotas y fijos del fixture del prototipo, repartidos por tarjeta.
  const cuotas = [
    { tarjeta: 'VISA Santander', monto: 108327.44 },
    { tarjeta: 'VISA Galicia', monto: 116423 },
    { tarjeta: 'Mastercard Galicia', monto: 33343 },
    { tarjeta: 'VISA BBVA', monto: 95800 },
    { tarjeta: 'VISA BBVA', monto: 20, monto_dolares: 20, es_estimado_usd: true }
  ];
  const fijos = fijosPorTarjeta([
    { tarjeta: 'VISA Santander', moneda: 'ARS', montoTipico: 30899 },
    { tarjeta: 'VISA Galicia', moneda: 'ARS', montoTipico: 36499 },
    { tarjeta: 'Mastercard Galicia', moneda: 'ARS', montoTipico: 3599 },
    { tarjeta: 'VISA BBVA', moneda: 'USD', montoTipico: 22.99 }
  ]);
  const porT = composicionPorTarjeta({ porTarjeta: c.porTarjeta, cuotas, fijosPorTarjeta: fijos });

  test('la suma por tarjeta = la composición total del mes', () => {
    const comp = composicion({ porTarjeta: c.porTarjeta, cuotasDelMes: 353893.44, fijosArs: 70997 });
    const desde = composicionDesdeTarjetas(porT, { porTarjeta: c.porTarjeta });
    assert.equal(desde.total, comp.total);
    assert.equal(desde.cuotas, comp.cuotas);
    assert.equal(desde.fijos, comp.fijos);
    assert.equal(desde.variables, comp.variables);
  });

  test('por tarjeta: cuotas + fijos + variables = total importado', () => {
    assert.deepEqual(porT['VISA Galicia'], { cuotas: 116423, fijos: 36499, variables: 259458.2, total: 412380.2, importado: 412380.2, completado: false });
    assert.equal(porT['VISA BBVA'].cuotas, 95800, 'las cuotas en USD no entran');
    assert.equal(porT['VISA BBVA'].fijos, 0, 'los fijos en USD no entran');
  });

  test('si cuotas + fijos superan lo importado, el total sube y hay aviso', () => {
    const p = composicionPorTarjeta({ porTarjeta: [{ tarjetaId: 'x', fuente: 'en_curso', total: 100 }], cuotas: [{ tarjeta: 'x', monto: 80 }], fijosPorTarjeta: { x: 50 } });
    assert.equal(p.x.total, 130);
    assert.equal(p.x.variables, 0);
    const d = composicionDesdeTarjetas(p, { porTarjeta: [{ tarjetaId: 'x', fuente: 'en_curso' }] });
    assert.deepEqual(d.avisos, [{ tipo: 'datos_inconsistentes' }]);
  });

  test('tarjeta sin datos: no tiene composición', () => {
    const p = composicionPorTarjeta({ porTarjeta: [{ tarjetaId: 'y', fuente: 'sin_datos', total: 0 }], fijosPorTarjeta: { y: 999 } });
    assert.deepEqual(p, {});
  });
});
