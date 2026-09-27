/**
 * Tests de services/planes-vista.js — `npm test`.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { lineaDeTiempo, resumenPlanes, proximasCuotas, cuotasDelPlan, ordenarPorFin, rangoDePlan } from './planes-vista.js';
import { construirPlanes, formatearParaVista } from './cuotas.js';
import { cuotasDelMes, desfasePorTarjeta, sumarMeses } from './mes.js';

// Caso Easy Warnes (cuotas.test.js), con fechas: VISA Galicia cierra a fin de mes y vence el mes siguiente.
const resumen = (anio, mes, cierre, vto) => ({ id: `VISA Galicia-${anio}-${mes}`, tarjeta: 'VISA Galicia', anio, mes, fecha_cierre: cierre, fecha_vencimiento: vto });
const JUL = resumen(2026, 7, '2026-07-31', '2026-08-12');
const AGO = resumen(2026, 8, '2026-08-28', '2026-09-09');
const mov = (r, referencia, cuota, pesos, dolares = 0) => ({ id: `${r.id}-${referencia}`, resumen_id: r.id, tarjeta: r.tarjeta, referencia_limpia: referencia, cuota_texto: cuota, monto_pesos: pesos, monto_dolares: dolares });
const movs = [
  mov(JUL, 'Muss Sa', '06/06', 73333.33), mov(JUL, 'Todopampa', '02/04', 29797.43),
  mov(JUL, 'Sodastream', '02/03', 45366.33), mov(JUL, 'Ilcapitano', '02/03', 39991.00),
  mov(JUL, 'Easy', '01/03', 53745.00),
  mov(AGO, 'Todopampa', '03/04', 29797.43), mov(AGO, 'Sodastream', '03/03', 45366.33),
  mov(AGO, 'Ilcapitano', '03/03', 39991.00), mov(AGO, 'Urquiza', '01/03', 106250.00),
  mov(AGO, 'Planoutcanaldeven', '01/03', 55200.00), mov(AGO, 'Puma Alto Palermo', '01/03', 53333.00),
  mov(AGO, 'Steam', '01/02', 0, 10), mov(AGO, 'Compra común', '01/01', 999)
];
const resumenes = [JUL, AGO];
const planes = formatearParaVista(construirPlanes(movs, resumenes));
const desfase = desfasePorTarjeta(resumenes);
const HOY = '2026-09'; // el mes que se paga el resumen de agosto
const opts = { hoyMesKey: HOY, desfase, cotizacionVenta: 1500 };
const linea = lineaDeTiempo(planes, opts);
const fila = (n) => linea.filas.find((f) => f.plan.descripcion === n);

describe('lineaDeTiempo', () => {
  test('inicio y fin en meses de pago (Easy Warnes)', () => {
    // Urquiza 1/3 en el resumen de agosto → se paga sep, oct, nov.
    assert.deepEqual([fila('Urquiza').inicio, fila('Urquiza').fin], ['2026-09', '2026-11']);
    // Todopampa 3/4 en agosto → empezó en julio (pago), termina en octubre.
    assert.deepEqual([fila('Todopampa').inicio, fila('Todopampa').fin], ['2026-07', '2026-10']);
    assert.equal(fila('Todopampa').pagadasHasta, '2026-08');
    assert.equal(fila('Todopampa').enCurso, true);
  });

  test('restante = cuota × cuotas que faltan después del mes actual', () => {
    assert.equal(fila('Urquiza').restante, 106250 * 2);
    assert.equal(fila('Todopampa').restante, 29797.43);
  });

  test('"última": la última cuota es la de este mes', () => {
    assert.equal(fila('Sodastream').estado, 'ultima');
    assert.equal(fila('Ilcapitano').estado, 'ultima');
    assert.equal(fila('Todopampa').estado, 'vigente');
  });

  test('interrumpido: a revisar, no suma al restante', () => {
    assert.equal(fila('Easy').estado, 'a_revisar');
    assert.equal(fila('Easy').restante, 0);
    assert.equal(fila('Easy').enCurso, false);
  });

  test('plan que ya terminó en meses anteriores', () => {
    assert.equal(fila('Muss Sa').estado, 'terminado');
  });

  test('los planes de 1 cuota no entran (compra común)', () => {
    assert.equal(fila('Compra común'), undefined);
  });

  test('rango recortado con indicador de "empezó antes"', () => {
    const corto = lineaDeTiempo(planes, { ...opts, antes: 1 });
    assert.equal(corto.meses[0], '2026-08');
    assert.equal(corto.filas.find((f) => f.plan.descripcion === 'Todopampa').empiezaAntes, true);
    assert.equal(corto.filas.find((f) => f.plan.descripcion === 'Urquiza').empiezaAntes, false);
  });

  test('USD: la cuota se pesifica y queda marcada como estimada', () => {
    assert.equal(fila('Steam').cuota, 15000);
    assert.equal(fila('Steam').estimado, true);
  });

  test('orden por fin ascendente', () => {
    const orden = ordenarPorFin(linea.filas.filter((f) => f.estado !== 'terminado')).map((f) => f.fin);
    assert.deepEqual(orden, [...orden].sort());
  });
});

describe('resumenPlanes', () => {
  const r = resumenPlanes(planes, opts);

  test('"Este mes" = cuotasDelMes (lo mismo que Mes y el gráfico)', () => {
    assert.equal(r.esteMes, cuotasDelMes(planes, HOY, { desfase, cotizacionVenta: 1500 }).total);
  });

  test('el restante coincide con la proyección de los meses siguientes', () => {
    let proyectado = 0;
    for (let i = 1; i <= 12; i++) {
      const q = cuotasDelMes(planes, sumarMeses(HOY, i), { desfase, cotizacionVenta: 1500 });
      proyectado += q.items.reduce((s, x) => s + x.monto, 0); // incluye USD pesificado, como el restante
    }
    assert.ok(Math.abs(r.restante - proyectado) < 0.01, `${r.restante} vs ${proyectado}`);
    assert.equal(r.restanteEstimado, true);
  });

  test('lo que termina este mes se libera el mes que viene', () => {
    assert.deepEqual(r.seLiberaProximoMes.map((x) => x.descripcion).sort(), ['Ilcapitano', 'Sodastream']);
    assert.equal(r.ultimasEsteMes, 2);
  });

  test('cifras', () => {
    assert.equal(r.aRevisar, 1);
    assert.equal(r.terminaUltimo, '2026-11');
    assert.ok(r.enCurso >= 5);
  });
});

describe('detalle de un plan', () => {
  const urquiza = planes.find((p) => p.descripcion === 'Urquiza');
  test('próximas cuotas desde el mes actual', () => {
    assert.deepEqual(proximasCuotas(urquiza, opts).map((x) => [x.mesKey, x.numero]), [['2026-09', 1], ['2026-10', 2], ['2026-11', 3]]);
  });
  test('estado de cada cuota', () => {
    const todopampa = planes.find((p) => p.descripcion === 'Todopampa');
    assert.deepEqual(cuotasDelPlan(todopampa, opts).map((c) => c.estado), ['pagada', 'pagada', 'este_mes', 'falta']);
  });
  test('un plan interrumpido no tiene próximas cuotas', () => {
    assert.deepEqual(proximasCuotas(planes.find((p) => p.descripcion === 'Easy'), opts), []);
  });
  test('rangoDePlan sin período: null', () => {
    assert.equal(rangoDePlan({ total_cuotas: 3 }), null);
  });
});
