# Tests Automatizados

## Instalación

```bash
npm install --save-dev jest supertest
```

## Ejecutar Tests

```bash
# Todos los tests
npm test

# Solo tests del parser
npm test -- tests/parser.test.js

# Solo tests de API
npm test -- tests/api.test.js

# Con cobertura
npm test -- --coverage

# Watch mode (re-ejecuta en cambios)
npm test -- --watch

# Verbose (más detalle)
npm test -- --verbose
```

## Estructura

```
tests/
├── setup.js              # Configuración global
├── parser.test.js        # Tests del PDFParserService
├── api.test.js           # Tests de endpoints REST
└── fixtures/
    ├── expected-output.json  # Outputs esperados
    ├── visa-galicia-sample.pdf      # (opcional) PDF de prueba
    └── mastercard-galicia-sample.pdf # (opcional) PDF de prueba
```

## Agregar PDFs de Prueba

Para tests de integración completos, coloca PDFs reales en `tests/fixtures/`:

1. Copia un resumen de VISA Galicia y renómbralo `visa-galicia-sample.pdf`
2. Copia un resumen de Mastercard Galicia y renómbralo `mastercard-galicia-sample.pdf`
3. Descomenta los tests de integración en `parser.test.js`

## Agregar Nuevos Tests

### Test de limpieza de nombre

```javascript
test('limpia NuevoComercio correctamente', () => {
  const resultado = parser.limpiarReferencia('NUEVOCOMERCIO123');
  expect(resultado.limpio).toBe('Nuevo Comercio');
  expect(resultado.dudoso).toBe(false);
});
```

### Test de endpoint

```javascript
test('nuevo endpoint funciona', async () => {
  const res = await request(app).get('/api/v1/nuevo-endpoint');
  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
});
```

## Scripts de package.json

Agrega estos scripts a tu `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:parser": "jest tests/parser.test.js",
    "test:api": "jest tests/api.test.js"
  }
}
```

## Validaciones Matemáticas

Los tests incluyen validaciones para asegurar que:

- La suma de movimientos coincide con el total del resumen
- Los conteos de cuotas activas son consistentes
- Los montos se parsean correctamente (formato argentino)
- Los hashes de cuotas son determinísticos

## CI/CD

Para integrar con GitHub Actions, crea `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```
