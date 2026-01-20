/**
 * Tests para PDFParserService
 * 
 * Ejecutar con: npm test -- tests/parser.test.js
 */

const PDFParserService = require('../src/services/pdf-parser.service');
const fs = require('fs');
const path = require('path');

describe('PDFParserService', () => {
  let parser;

  beforeEach(() => {
    parser = new PDFParserService();
  });

  describe('detectarTarjeta', () => {
    test('detecta VISA Galicia correctamente', () => {
      const texto = 'BANCO GALICIA VISA GOLD Resumen de cuenta';
      const resultado = parser.detectarTarjeta(texto);
      expect(resultado.nombre).toBe('VISA Galicia');
      expect(resultado.tipo).toBe('VISA');
      expect(resultado.banco).toBe('Galicia');
    });

    test('detecta Mastercard Galicia correctamente', () => {
      const texto = 'MASTERCARD BANCO GALICIA Resumen mensual';
      const resultado = parser.detectarTarjeta(texto);
      expect(resultado.nombre).toBe('Mastercard Galicia');
      expect(resultado.tipo).toBe('MASTERCARD');
      expect(resultado.banco).toBe('Galicia');
    });

    test('lanza error para banco desconocido', () => {
      const texto = 'BANCO HSBC VISA Premium';
      expect(() => parser.detectarTarjeta(texto)).toThrow('No se pudo detectar');
    });
  });

  describe('limpiarReferencia', () => {
    test('limpia MercadoPago correctamente', () => {
      const resultado = parser.limpiarReferencia('MERPAGO*SPOTIFY');
      // El parser limpia a "Mercado Pago" por la regla general de MERPAGO
      expect(resultado.limpio).toBe('Mercado Pago');
      expect(resultado.dudoso).toBe(false);
    });

    test('limpia Apple correctamente', () => {
      const resultado = parser.limpiarReferencia('APPLE.COM/BILL');
      expect(resultado.limpio).toBe('Apple');
      expect(resultado.dudoso).toBe(false);
    });

    test('limpia Cabify correctamente', () => {
      const resultado = parser.limpiarReferencia('CABIFY25509RBJRLCN');
      expect(resultado.limpio).toBe('Cabify');
      expect(resultado.dudoso).toBe(false);
    });

    test('limpia Claude AI correctamente', () => {
      const resultado = parser.limpiarReferencia('CLAUDE.AI ANTHROPIC');
      expect(resultado.limpio.toLowerCase()).toBe('claude ai (anthropic)');
      expect(resultado.dudoso).toBe(false);
    });

    test('limpia Swiss Medical correctamente', () => {
      const resultado = parser.limpiarReferencia('SMG CIA ARG DE SEGUROS');
      expect(resultado.limpio).toBe('Swiss Medical');
      expect(resultado.dudoso).toBe(false);
    });

    test('marca como dudoso nombres con muchos números', () => {
      const resultado = parser.limpiarReferencia('XYZ123456789ABC');
      expect(resultado.dudoso).toBe(true);
      expect(resultado.sugerencias.length).toBeGreaterThan(0);
    });

    test('preserva nombres ya limpios', () => {
      const resultado = parser.limpiarReferencia('CARREFOUR');
      expect(resultado.limpio).toBe('Carrefour');
      expect(resultado.dudoso).toBe(false);
    });
  });

  describe('normalizarParaHash', () => {
    test('normaliza nombres para hash consistente', () => {
      const hash1 = parser.normalizarParaHash('Sodimac Vicente Lopez');
      const hash2 = parser.normalizarParaHash('SODIMAC VICENTE LOPE');
      // Ambos deberían tener el mismo hash truncado
      expect(hash1).toBe(hash2);
    });

    test('trunca a 15 caracteres', () => {
      const resultado = parser.normalizarParaHash('Este es un nombre muy largo que deberia truncarse');
      expect(resultado.length).toBeLessThanOrEqual(15);
    });

    test('elimina caracteres especiales', () => {
      const resultado = parser.normalizarParaHash('Test-Name_123!@#');
      expect(resultado).toBe('testname123');
    });
  });

  describe('generarHashCompra', () => {
    test('genera hash consistente para misma compra', () => {
      const hash1 = parser.generarHashCompra('sodimac', 100000, 6);
      const hash2 = parser.generarHashCompra('sodimac', 100000, 6);
      expect(hash1).toBe(hash2);
    });

    test('genera hash diferente para montos diferentes', () => {
      const hash1 = parser.generarHashCompra('sodimac', 100000, 6);
      const hash2 = parser.generarHashCompra('sodimac', 200000, 6);
      expect(hash1).not.toBe(hash2);
    });

    test('genera hash diferente para cuotas diferentes', () => {
      const hash1 = parser.generarHashCompra('sodimac', 100000, 6);
      const hash2 = parser.generarHashCompra('sodimac', 100000, 12);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('esNombreDudoso', () => {
    test('detecta nombres con muchos números como dudosos', () => {
      expect(parser.esNombreDudoso('ABC123456789')).toBe(true);
    });

    test('no marca nombres normales como dudosos', () => {
      expect(parser.esNombreDudoso('Carrefour')).toBe(false);
      expect(parser.esNombreDudoso('Swiss Medical')).toBe(false);
    });

    test('detecta códigos alfanuméricos como dudosos', () => {
      expect(parser.esNombreDudoso('XK2J9M8P5Q6R')).toBe(true);
    });
  });

  describe('generarSugerencias', () => {
    test('extrae palabras significativas', () => {
      const sugerencias = parser.generarSugerencias('MERPAGO*SUPERMERCADO NORTE');
      expect(sugerencias).toContain('Merpago');
      expect(sugerencias).toContain('Supermercado');
      expect(sugerencias).toContain('Norte');
    });

    test('ignora tokens cortos', () => {
      const sugerencias = parser.generarSugerencias('MP DE SA');
      // Solo tokens de 3+ caracteres
      expect(sugerencias.every(s => s.length >= 3)).toBe(true);
    });
  });

  describe('capitalizar', () => {
    test('capitaliza cada palabra', () => {
      expect(parser.capitalizar('hello world')).toBe('Hello World');
    });

    test('maneja mayúsculas mezcladas', () => {
      expect(parser.capitalizar('HELLO WORLD')).toBe('Hello World');
    });
  });

  describe('parsearMonto', () => {
    test('parsea montos argentinos con punto como separador de miles', () => {
      const resultado = parser.parsearMonto('1.234.567,89');
      expect(resultado).toBe(1234567.89);
    });

    test('parsea montos sin separador de miles', () => {
      const resultado = parser.parsearMonto('567,89');
      expect(resultado).toBe(567.89);
    });

    test('parsea montos enteros', () => {
      const resultado = parser.parsearMonto('1000');
      expect(resultado).toBe(1000);
    });

    test('parsea montos negativos', () => {
      const resultado = parser.parsearMonto('-1.234,56');
      expect(resultado).toBe(-1234.56);
    });
  });
});

// Tests de integración con PDFs reales - descomenta cuando tengas fixtures
// describe('Integración con PDFs reales', () => { ... });

describe('Reglas de limpieza', () => {
  let parser;

  beforeEach(() => {
    parser = new PDFParserService();
  });

  test('carga reglas de limpieza', () => {
    const reglas = parser.cargarReglasLimpieza();
    expect(Array.isArray(reglas)).toBe(true);
    expect(reglas.length).toBeGreaterThan(0);
  });

  test('reglas tienen estructura correcta', () => {
    const reglas = parser.cargarReglasLimpieza();
    reglas.forEach(regla => {
      expect(regla).toHaveProperty('patron');
      expect(regla).toHaveProperty('reemplazo');
      expect(typeof regla.patron).toBe('string');
      expect(typeof regla.reemplazo).toBe('string');
    });
  });

  // Tests específicos para cada categoría de regla
  const casosLimpieza = [
    { input: 'MERPAGO*MERCADOPAGO', expected: 'Mercado Pago' },
    { input: 'PEDIDOSYA*RESTAURANT', expected: 'Pedidosya' },
    { input: 'SPOTIFY AR', expected: 'Spotify' },
    { input: 'NETFLIX.COM', expected: 'Netflix' },
    { input: 'UBER *TRIP', expected: 'Uber' },
    { input: 'YPF ESTACION 123', expected: 'Ypf' },
    { input: 'SHELL AUTOPISTA', expected: 'Shell' },
    { input: 'CARREFOUR HIPERMERCADO', expected: 'Carrefour' },
    { input: 'FRAVEGA ONLINE', expected: 'Fravega' }
  ];

  casosLimpieza.forEach(({ input, expected }) => {
    test(`limpia "${input}" → "${expected}"`, () => {
      const resultado = parser.limpiarReferencia(input);
      expect(resultado.limpio.toLowerCase()).toBe(expected.toLowerCase());
    });
  });
});
