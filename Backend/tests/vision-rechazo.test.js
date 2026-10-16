// Vision no debe aceptar archivos que no son un resumen de tarjeta.
const VisionParserService = require('../src/services/vision-parser.service');

function crear(datos) {
  const v = new VisionParserService('test-key');
  v.pdfToImages = async () => [Buffer.from('x')];
  v.procesarMultiplesImagenes = async () => datos;
  v.detectarTipoPDF = async () => ({ tipo: 'imagen', caracteres: 0 });
  return v;
}

describe('Vision: rechazo de archivos que no son resumen de tarjeta', () => {
  test('sin movimientos -> exito:false', async () => {
    const r = await crear({ banco: 'x', tarjeta: 'VISA', movimientos: [], periodo: {} })
      .procesarArchivo(Buffer.from('x'), 'a.pdf', 'application/pdf');
    expect(r.exito).toBe(false);
  });
  test('sin período -> exito:false', async () => {
    const r = await crear({ banco: 'Galicia', tarjeta: 'VISA', movimientos: [{ fecha: '2026-01-01', descripcion: 'A', monto_pesos: 10 }], periodo: {} })
      .procesarArchivo(Buffer.from('x'), 'a.pdf', 'application/pdf');
    expect(r.exito).toBe(false);
  });
  test('banco desconocido -> exito:false', async () => {
    const r = await crear({ banco: 'Otro', tarjeta: 'VISA', movimientos: [{ fecha: '2026-01-01', descripcion: 'A', monto_pesos: 10 }], periodo: { mes: 1, anio: 2026 } })
      .procesarArchivo(Buffer.from('x'), 'a.pdf', 'application/pdf');
    expect(r.exito).toBe(false);
  });
  test('resumen válido de Galicia sigue pasando', async () => {
    const r = await crear({ banco: 'Galicia', tarjeta: 'VISA', movimientos: [{ fecha: '2026-01-01', descripcion: 'A', monto_pesos: 10 }], periodo: { mes: 1, anio: 2026 }, totales: { total_consumos_pesos: 10, total_a_pagar_pesos: 10 } })
      .procesarArchivo(Buffer.from('x'), 'a.pdf', 'application/pdf');
    expect(r.exito).toBe(true);
  });
});
