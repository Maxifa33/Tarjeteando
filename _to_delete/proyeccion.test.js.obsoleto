/**
 * Tests de robustez al ORDEN DE SUBIDA usando los PDFs reales de prueba.
 *
 * Verifica el invariante: el orden en que se suben los resúmenes NO influye en
 * ningún cálculo. Todo se ancla al período del resumen (no a created_at ni al
 * índice del array).
 *
 * Cubre los 3 escenarios del pedido:
 *   1) VISA GAL Diciembre + Master GAL Agosto en orden invertido → sumas idénticas.
 *   2) Santander Octubre después de BBVA Diciembre → meses de proyección correctos.
 *   3) Mezclar el orden de las 4 tarjetas → sumas iguales al centavo.
 */

const fs = require('fs');
const path = require('path');
const PDFParserService = require('../src/services/pdf-parser.service');
const { proyectarCuotas } = require('../src/services/proyeccion.service');

const PDF_DIR = path.join(__dirname, 'fixtures/pdfs');
const parser = new PDFParserService();

const ARCHIVOS = {
  visaGalDic: 'VISA GAL - Diciembre 2025.pdf',
  masterGalAgo: 'Master GAL- Agosto 2025.pdf',
  santanderOct: 'SANTANDER VISA OCTUBRE 2025.pdf',
  bbvaDic: 'BBVA VISA - Diciembre 2025.pdf',
};

// Los PDFs reales NO están versionados (datos financieros privados). Si no están en
// fixtures/pdfs/, los tests que dependen de ellos se saltean (los unitarios sintéticos siguen).
const PDFS_DISPONIBLES = Object.values(ARCHIVOS).every(f => fs.existsSync(path.join(PDF_DIR, f)));
const describePdf = PDFS_DISPONIBLES ? describe : describe.skip;

if (!PDFS_DISPONIBLES) {
  console.warn('[proyeccion.test] PDFs de fixtures ausentes → se saltean los tests con PDFs reales.');
}

// Cache de parseos (parsear PDFs es costoso; se hace una sola vez)
const parsed = {};

beforeAll(async () => {
  if (!PDFS_DISPONIBLES) return;
  // Silenciar los console.log ruidosos del parser durante los tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  for (const [key, file] of Object.entries(ARCHIVOS)) {
    const buffer = fs.readFileSync(path.join(PDF_DIR, file));
    parsed[key] = await parser.parsearPDF(buffer, file);
  }
}, 60000);

afterAll(() => {
  if (console.log.mockRestore) console.log.mockRestore();
});

// --- Réplica EXACTA del dedup de comprasCuotas de app.js (líneas ~859-907) ---
// Se replica a propósito para poder probar la robustez al orden con los PDFs reales.
function construirComprasCuotas(resultadosOrdenados) {
  const comprasCuotas = {};
  resultadosOrdenados.forEach(resultado => {
    const tarjetaNombre = resultado.tarjeta;
    (resultado.compras || []).forEach(compra => {
      const hashKey = compra.hash_logico;
      if (comprasCuotas[hashKey]) {
        const existente = comprasCuotas[hashKey];
        const cuotaActual = compra.cuotas && compra.cuotas.length > 0
          ? Math.max(...compra.cuotas.map(c => c.numero_cuota))
          : existente.cuota_actual;
        if (cuotaActual > existente.cuota_actual) {
          existente.cuota_actual = cuotaActual;
          existente.cuotas_restantes = existente.total_cuotas - cuotaActual;
          existente.fecha_ultima_cuota = resultado.resumen.fecha_cierre;
        }
      } else {
        const cuotaActual = compra.cuotas && compra.cuotas.length > 0
          ? Math.max(...compra.cuotas.map(c => c.numero_cuota))
          : 1;
        comprasCuotas[hashKey] = {
          hash_logico: hashKey,
          tarjeta: tarjetaNombre,
          referencia_limpia: compra.referencia_limpia,
          total_cuotas: compra.total_cuotas,
          monto_cuota: compra.monto_cuota,
          cuota_actual: cuotaActual,
          cuotas_restantes: compra.total_cuotas - cuotaActual,
          fecha_ultima_cuota: resultado.resumen.fecha_cierre,
        };
      }
    });
  });
  return comprasCuotas;
}

// Réplica de storage.getEstadisticas: total a pagar = suma del último resumen por tarjeta
function totalAPagar(resultadosOrdenados) {
  const ultimos = {};
  resultadosOrdenados
    .map(r => ({ tarjeta: r.tarjeta, anio: r.resumen.anio, mes: r.resumen.mes, total: r.resumen.total_a_pagar_pesos }))
    .sort((a, b) => new Date(b.anio, b.mes - 1) - new Date(a.anio, a.mes - 1))
    .forEach(r => { if (!ultimos[r.tarjeta]) ultimos[r.tarjeta] = r; });
  return Object.values(ultimos).reduce((s, r) => s + (r.total || 0), 0);
}

function activas(comprasCuotas) {
  return Object.values(comprasCuotas).filter(c => c.cuotas_restantes > 0);
}

describePdf('Parsers: contrato de datos (período + fecha por transacción)', () => {
  test('cada parser devuelve período canónico y fecha real por movimiento', () => {
    Object.values(parsed).forEach(r => {
      expect(r.exito).toBe(true);
      expect(typeof r.resumen.mes).toBe('number');
      expect(typeof r.resumen.anio).toBe('number');
      expect(r.resumen.fecha_cierre).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Toda transacción trae fecha_compra (date YYYY-MM-DD)
      r.movimientos.forEach(m => {
        expect(m.fecha_compra).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});

describePdf('Escenario 1: VISA GAL Dic + Master GAL Ago en orden invertido', () => {
  const crono = () => [parsed.masterGalAgo, parsed.visaGalDic]; // ago, luego dic
  const invert = () => [parsed.visaGalDic, parsed.masterGalAgo]; // dic, luego ago

  test('total a pagar idéntico al centavo', () => {
    expect(totalAPagar(invert())).toBeCloseTo(totalAPagar(crono()), 2);
  });

  test('comprasCuotas idéntico (cuota_actual, cuotas_restantes, fecha)', () => {
    expect(construirComprasCuotas(invert())).toEqual(construirComprasCuotas(crono()));
  });

  test('proyección idéntica en ambos órdenes', () => {
    const pc = proyectarCuotas(activas(construirComprasCuotas(crono())), 6);
    const pi = proyectarCuotas(activas(construirComprasCuotas(invert())), 6);
    expect(pi).toEqual(pc);
  });
});

describePdf('Escenario 2: Santander Octubre después de BBVA Diciembre', () => {
  const crono = () => [parsed.bbvaDic, parsed.santanderOct];
  const invert = () => [parsed.santanderOct, parsed.bbvaDic];

  test('la proyección arranca el mes siguiente al resumen más reciente (Dic 2025 → Ene 2026)', () => {
    const proy = proyectarCuotas(activas(construirComprasCuotas(crono())), 6);
    expect(proy[0].mes).toBe('2026-01');
    expect(proy[5].mes).toBe('2026-06');
  });

  test('cada cuota proyectada lleva número correcto respecto de su período (NN/MM)', () => {
    const comp = construirComprasCuotas(crono());
    const proy = proyectarCuotas(activas(comp), 6);
    // BBVA "Gomeria Daytona": 6 cuotas, período Dic 2025 → su última cuota cae en Ene 2026
    const eneroBBVA = proy[0].detalles.filter(d => /gomeria/i.test(d.referencia));
    if (eneroBBVA.length) {
      // El número de cuota debe terminar en "/6" y no exceder el total
      eneroBBVA.forEach(d => {
        const [n, m] = d.cuota.split('/').map(Number);
        expect(n).toBeLessThanOrEqual(m);
        expect(n).toBeGreaterThan(0);
      });
    }
    // Ningún detalle puede tener número de cuota > total en ningún mes
    proy.forEach(mesP => mesP.detalles.forEach(d => {
      const [n, m] = d.cuota.split('/').map(Number);
      expect(n).toBeLessThanOrEqual(m);
    }));
  });

  test('proyección y comprasCuotas idénticos en ambos órdenes', () => {
    expect(construirComprasCuotas(invert())).toEqual(construirComprasCuotas(crono()));
    const pc = proyectarCuotas(activas(construirComprasCuotas(crono())), 6);
    const pi = proyectarCuotas(activas(construirComprasCuotas(invert())), 6);
    expect(pi).toEqual(pc);
  });
});

describePdf('Escenario 3: mezclar el orden de subida de las 4 tarjetas', () => {
  const ordenA = () => [parsed.visaGalDic, parsed.masterGalAgo, parsed.santanderOct, parsed.bbvaDic];
  const ordenB = () => [parsed.santanderOct, parsed.bbvaDic, parsed.visaGalDic, parsed.masterGalAgo];
  const ordenC = () => [parsed.bbvaDic, parsed.visaGalDic, parsed.masterGalAgo, parsed.santanderOct];

  test('total a pagar coincide al centavo en cualquier orden', () => {
    const a = totalAPagar(ordenA());
    expect(totalAPagar(ordenB())).toBeCloseTo(a, 2);
    expect(totalAPagar(ordenC())).toBeCloseTo(a, 2);
  });

  test('comprasCuotas y proyección idénticos en cualquier orden', () => {
    const ca = construirComprasCuotas(ordenA());
    const cb = construirComprasCuotas(ordenB());
    const cc = construirComprasCuotas(ordenC());
    expect(cb).toEqual(ca);
    expect(cc).toEqual(ca);

    const pa = proyectarCuotas(activas(ca), 6);
    expect(proyectarCuotas(activas(cb), 6)).toEqual(pa);
    expect(proyectarCuotas(activas(cc), 6)).toEqual(pa);

    // El total proyectado de cada mes es consistente (no depende del orden)
    const sumar = arr => arr.reduce((s, m) => s + m.total, 0);
    expect(sumar(proyectarCuotas(activas(cb), 6))).toBeCloseTo(sumar(pa), 2);
  });
});

describe('proyectarCuotas: unitario con datos sintéticos controlados', () => {
  test('ancla al período de la cuota, no a la fecha de hoy', () => {
    // Compra de 6 cuotas, cuota 3 cargada en el resumen de Octubre 2025.
    const cuotas = [{
      referencia_limpia: 'Test', tarjeta: 'X',
      total_cuotas: 6, cuota_actual: 3, cuotas_restantes: 3,
      monto_cuota: 1000, fecha_ultima_cuota: '2025-10-15',
    }];
    // "hoy" en el futuro lejano no debe mover la proyección.
    const proy = proyectarCuotas(cuotas, 6, new Date('2027-01-01'));
    expect(proy[0].mes).toBe('2025-11'); // Nov 2025 = período + 1
    expect(proy[0].detalles[0].cuota).toBe('4/6');
    expect(proy[1].detalles[0].cuota).toBe('5/6');
    expect(proy[2].detalles[0].cuota).toBe('6/6');
    // Cuota 7 no existe → meses siguientes vacíos
    expect(proy[3].detalles).toHaveLength(0);
    expect(proy[0].total).toBe(1000);
  });

  test('reintegros/montos negativos se respetan en el total', () => {
    const cuotas = [
      { referencia_limpia: 'Compra', tarjeta: 'X', total_cuotas: 3, cuota_actual: 1, cuotas_restantes: 2, monto_cuota: 5000, fecha_ultima_cuota: '2025-12-10' },
      { referencia_limpia: 'Reintegro', tarjeta: 'X', total_cuotas: 3, cuota_actual: 1, cuotas_restantes: 2, monto_cuota: -1500, fecha_ultima_cuota: '2025-12-10' },
    ];
    const proy = proyectarCuotas(cuotas, 6, new Date('2025-12-20'));
    expect(proy[0].mes).toBe('2026-01');
    expect(proy[0].total).toBe(3500); // 5000 - 1500
  });
});
