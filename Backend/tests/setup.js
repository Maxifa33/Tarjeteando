// Setup global para tests
jest.setTimeout(10000);

// Silenciar logs durante tests (opcional)
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn()
  };
}

// Helper para comparar números con tolerancia
expect.extend({
  toBeCloseTo(received, expected, tolerance = 0.01) {
    const pass = Math.abs(received - expected) <= tolerance;
    if (pass) {
      return {
        message: () => `expected ${received} not to be close to ${expected}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be close to ${expected} (tolerance: ${tolerance})`,
        pass: false
      };
    }
  }
});
