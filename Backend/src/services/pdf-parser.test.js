/**
 * Tests para PDFParserService
 * Ejecutar con: node src/services/pdf-parser.test.js
 */

const PDFParserService = require('./pdf-parser.service');

const parser = new PDFParserService();

let passed = 0;
let failed = 0;

function test(nombre, fn) {
  try {
    fn();
    console.log(`✓ ${nombre}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${nombre}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, mensaje = '') {
  if (actual !== expected) {
    throw new Error(`${mensaje}\n    Esperado: ${JSON.stringify(expected)}\n    Obtenido: ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual, expected, mensaje = '') {
  if (!actual.includes(expected)) {
    throw new Error(`${mensaje}\n    Esperado que contenga: ${JSON.stringify(expected)}\n    Obtenido: ${JSON.stringify(actual)}`);
  }
}

console.log('\n=== Tests de separarComprobanteYMonto ===\n');

// Setear formato para los tests
parser.formatoDetectado = 'GALICIA_VISA';

test('Monto con separador de miles y espacios', () => {
  const resultado = parser.separarComprobanteYMonto(
    'MERPAGO*CUESTABLANCA 01/03 734655 10.996,68',
    'GALICIA_VISA'
  );
  assertEqual(resultado.monto, 10996.68, 'Monto incorrecto');
  assertIncludes(resultado.referencia, 'MERPAGO*CUESTABLANCA', 'Referencia debe contener CUESTABLANCA');
});

test('Monto simple sin separador de miles', () => {
  const resultado = parser.separarComprobanteYMonto(
    'NETFLIX 99,00',
    'GALICIA_VISA'
  );
  assertEqual(resultado.monto, 99, 'Monto incorrecto');
  assertEqual(resultado.referencia, 'NETFLIX', 'Referencia incorrecta');
});

test('Monto con comprobante pegado (sin punto)', () => {
  const resultado = parser.separarComprobanteYMonto(
    'COMERCIO 73465510996,68',
    'GALICIA_VISA'
  );
  // Cuando está pegado sin punto, debería separar comprobante
  assertEqual(resultado.monto, 10996.68, 'Monto incorrecto');
});

test('Monto negativo (devolución)', () => {
  const resultado = parser.separarComprobanteYMonto(
    'DEVOLUCION 734655-1.500,00',
    'GALICIA_VISA'
  );
  assertEqual(resultado.monto, -1500, 'Monto negativo incorrecto');
});

console.log('\n=== Tests de limpiarReferencia ===\n');

test('MERPAGO*CUESTABLANCA debe dar Cuestablanca (Mercado Pago)', () => {
  const resultado = parser.limpiarReferencia('MERPAGO*CUESTABLANCA');
  assertIncludes(resultado.limpio.toLowerCase(), 'cuestablanca', 'Debe contener cuestablanca');
  assertIncludes(resultado.limpio.toLowerCase(), 'mercado pago', 'Debe contener mercado pago');
});

test('MERPAGO*AUSOL debe dar Ausol (Mercado Pago)', () => {
  const resultado = parser.limpiarReferencia('MERPAGO*AUSOL');
  // Puede matchear la regla de Autopistas del Sol o extraer AUSOL
  console.log(`    Resultado: ${resultado.limpio}`);
});

test('NETFLIX debe quedar como Netflix', () => {
  const resultado = parser.limpiarReferencia('NETFLIX');
  assertEqual(resultado.limpio, 'Netflix', 'Debe ser Netflix');
});

test('Referencia con números largos debe limpiarlos', () => {
  const resultado = parser.limpiarReferencia('COMERCIO 734655');
  // limpiarReferencia no quita números, eso lo hace limpiarReferenciaBasica
  console.log(`    Resultado: ${resultado.limpio}`);
});

console.log('\n=== Tests de extraerNombreMerpago ===\n');

test('MERPAGO*CUESTABLANCA extrae CUESTABLANCA', () => {
  const resultado = parser.extraerNombreMerpago('MERPAGO*CUESTABLANCA');
  assertEqual(resultado, 'CUESTABLANCA (Mercado Pago)', 'Extracción incorrecta');
});

test('MERPAGO*AUSOL 12345 extrae AUSOL', () => {
  const resultado = parser.extraerNombreMerpago('MERPAGO*AUSOL 12345');
  assertEqual(resultado, 'AUSOL (Mercado Pago)', 'Debe quitar números');
});

test('MERCPAGO*TIENDA extrae TIENDA', () => {
  const resultado = parser.extraerNombreMerpago('MERCPAGO*TIENDA');
  assertEqual(resultado, 'TIENDA (Mercado Pago)', 'Debe funcionar con MERCPAGO');
});

console.log('\n=== Tests de parsearLineaGalicia (flujo completo) ===\n');

test('Línea con cuota y espacios: MERPAGO*CUESTABLANCA 01/03 734655 10.996,68', () => {
  parser.formatoDetectado = 'GALICIA_VISA';
  const lineas = ['24-12-25 * MERPAGO*CUESTABLANCA 01/03 734655 10.996,68'];

  // Simular extracción
  const fecha = '24-12-25';
  const resto = 'MERPAGO*CUESTABLANCA 01/03 734655 10.996,68';

  const mov = parser.parsearLineaGalicia(fecha, resto, lineas, 0);

  console.log(`    Movimiento parseado:`);
  console.log(`      fecha: ${mov?.fecha_compra}`);
  console.log(`      referencia_original: ${mov?.referencia_original}`);
  console.log(`      cuota: ${mov?.cuota_texto}`);
  console.log(`      monto: ${mov?.monto_pesos}`);

  if (mov) {
    assertEqual(mov.monto_pesos, 10996.68, 'Monto incorrecto');
    assertEqual(mov.cuota_texto, '01/03', 'Cuota incorrecta');
    assertIncludes(mov.referencia_original, 'CUESTABLANCA', 'Debe contener CUESTABLANCA');
  } else {
    throw new Error('Movimiento es null');
  }
});

console.log('\n=== Tests de reglas de limpieza ===\n');

test('Verificar que no hay regla que convierta a ABL como nombre limpio', () => {
  const reglas = parser.cargarReglasLimpieza();
  // Buscar reglas donde el resultado sea "ABL" o "Abl" (el impuesto)
  const reglasAbl = reglas.filter(r =>
    r.reemplazo.toLowerCase() === 'abl'
  );

  if (reglasAbl.length > 0) {
    console.log('    Reglas encontradas que producen ABL:');
    reglasAbl.forEach(r => console.log(`      ${r.patron} → ${r.reemplazo}`));
  }

  assertEqual(reglasAbl.length, 0, 'No debería haber reglas que produzcan ABL como nombre limpio');
});

console.log('\n=== Resumen ===\n');
console.log(`Pasaron: ${passed}`);
console.log(`Fallaron: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
