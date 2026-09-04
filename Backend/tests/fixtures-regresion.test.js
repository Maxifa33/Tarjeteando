/**
 * Red de seguridad del parser: re-parsea TODOS los PDFs reales de fixtures y verifica
 * que la suma de movimientos coincida al centavo con el total que imprime el resumen.
 *
 * Existe porque los bugs mas caros del parser (marcador de fila comiendose la primera
 * letra del comercio, BBVA duplicando "Total Consumos") pasaron desapercibidos con los
 * tests unitarios: solo aparecen al correr el parser contra los PDFs de verdad.
 */
const fs = require('fs');
const path = require('path');
const PDFParserService = require('../src/services/pdf-parser.service');

const DIR = path.join(__dirname, 'fixtures', 'pdfs');
// Macro no tiene parser de texto: deriva a Vision API a proposito.
const ESPERAN_VISION = ['MACRO VISA - OCTUBRE 2025.pdf'];

const archivos = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.pdf')).sort()
  : [];

describe('Regresión sobre los PDFs reales', () => {
  const silenciar = () => { const l = console.log; console.log = () => {}; return l; };

  test('hay fixtures cargadas', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  archivos.forEach(archivo => {
    test(`${archivo}: la suma de movimientos coincide con el total del resumen`, async () => {
      const log = silenciar();
      try {
        const parser = new PDFParserService();
        let resultado;
        try {
          resultado = await parser.parsearPDF(fs.readFileSync(path.join(DIR, archivo)), archivo);
        } catch (e) {
          expect(ESPERAN_VISION).toContain(archivo);
          expect(e.message).toMatch(/USAR_VISION/);
          return;
        }
        if (!resultado.exito) {
          // parsearPDF atrapa el USAR_VISION y devuelve exito:false; app.js deriva a Vision.
          expect(ESPERAN_VISION).toContain(archivo);
          expect(resultado.error).toMatch(/USAR_VISION|No se pudo detectar/);
          return;
        }

        const suma = resultado.movimientos.reduce((s, m) => s + (m.monto_pesos || 0), 0);
        const totalPDF = resultado.resumen.total_consumos_pesos;
        if (totalPDF) {
          expect(Math.abs(suma - totalPDF)).toBeLessThan(0.01);
        }

        // Toda fecha parseada debe ser una fecha real YYYY-MM-DD
        resultado.movimientos.forEach(m => {
          expect(m.fecha_compra).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
      } finally {
        console.log = log;
      }
    });
  });

  test('el marcador de fila no se come la primera letra del comercio', async () => {
    const log = silenciar();
    try {
      const casos = [
        ['Master GAL - Enero 2026.pdf', ['VENTI TICKETS', 'EXPRESS SAN MARTIN 468']],
        ['Master GAL - Abril 2025.pdf', ['VITAL SUPERMAYORISTA']]
      ];
      for (const [archivo, esperados] of casos) {
        if (!archivos.includes(archivo)) continue;
        const r = await new PDFParserService().parsearPDF(fs.readFileSync(path.join(DIR, archivo)), archivo);
        const refs = r.movimientos.map(m => m.referencia_original);
        esperados.forEach(e => expect(refs).toContain(e));
      }
    } finally {
      console.log = log;
    }
  });

  test('BBVA no duplica el total de consumos', async () => {
    const archivo = 'BBVA VISA - Diciembre 2025.pdf';
    if (!archivos.includes(archivo)) return;
    const log = silenciar();
    try {
      const r = await new PDFParserService().parsearPDF(fs.readFileSync(path.join(DIR, archivo)), archivo);
      const suma = r.movimientos.reduce((s, m) => s + (m.monto_pesos || 0), 0);
      expect(r.resumen.total_consumos_pesos).toBeCloseTo(suma, 2);
    } finally {
      console.log = log;
    }
  });
});
