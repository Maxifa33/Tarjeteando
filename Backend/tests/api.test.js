/**
 * Tests para API endpoints
 * 
 * Ejecutar con: npm test -- tests/api.test.js
 */

const request = require('supertest');
const path = require('path');

// Mock del servidor (sin iniciar el listen)
let app;

beforeAll(() => {
  // Configurar entorno de test
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3999';
  
  // Importar app sin iniciar servidor
  jest.resetModules();
  app = require('../src/app');
});

describe('API Endpoints', () => {
  
  describe('GET /api/v1/tarjetas', () => {
    test('retorna lista de tarjetas', async () => {
      const res = await request(app).get('/api/v1/tarjetas');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('cada tarjeta tiene estructura correcta', async () => {
      const res = await request(app).get('/api/v1/tarjetas');
      
      if (res.body.data.length > 0) {
        const tarjeta = res.body.data[0];
        expect(tarjeta).toHaveProperty('id');
        expect(tarjeta).toHaveProperty('nombre');
        expect(tarjeta).toHaveProperty('tipo');
        expect(tarjeta).toHaveProperty('banco');
      }
    });
  });

  describe('GET /api/v1/movimientos', () => {
    test('retorna lista de movimientos', async () => {
      const res = await request(app).get('/api/v1/movimientos');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('soporta filtro por tarjeta', async () => {
      const res = await request(app).get('/api/v1/movimientos?tarjeta=VISA%20Galicia');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/resumenes', () => {
    test('retorna lista de resúmenes', async () => {
      const res = await request(app).get('/api/v1/resumenes');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/cuotas/activas', () => {
    test('retorna array de cuotas activas', async () => {
      const res = await request(app).get('/api/v1/cuotas/activas');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/cuotas/proyeccion', () => {
    test('retorna proyección de cuotas', async () => {
      const res = await request(app).get('/api/v1/cuotas/proyeccion?meses=6');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('respeta parámetro de meses', async () => {
      const res = await request(app).get('/api/v1/cuotas/proyeccion?meses=3');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /api/v1/alertas', () => {
    test('retorna lista de alertas', async () => {
      const res = await request(app).get('/api/v1/alertas');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('contadores');
    });

    test('soporta filtro de no leídas', async () => {
      const res = await request(app).get('/api/v1/alertas?leidas=false');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/dashboard/resumen', () => {
    test('retorna resumen del dashboard', async () => {
      const res = await request(app).get('/api/v1/dashboard/resumen');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total_resumenes');
      expect(res.body.data).toHaveProperty('total_movimientos');
      expect(res.body.data).toHaveProperty('cuotas_activas');
      expect(res.body.data).toHaveProperty('pagos_pendientes');
      expect(res.body.data).toHaveProperty('total_pendiente_cuotas');
    });
  });

  describe('GET /api/v1/proyecciones/graficos', () => {
    test('retorna datos para gráficos', async () => {
      const res = await request(app).get('/api/v1/proyecciones/graficos');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('evolucion');
      expect(Array.isArray(res.body.data.evolucion)).toBe(true);
    });
  });
});

describe('API Reglas de Usuario', () => {
  
  describe('GET /api/v1/reglas', () => {
    test('retorna lista de reglas', async () => {
      const res = await request(app).get('/api/v1/reglas');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/reglas', () => {
    test('crea nueva regla', async () => {
      const timestamp = Date.now();
      const nuevaRegla = {
        patron: `TEST.*PATTERN${timestamp}`,
        nombre_limpio: 'Test Comercio'
      };

      const res = await request(app)
        .post('/api/v1/reglas')
        .send(nuevaRegla);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.patron).toBe(`TEST.*PATTERN${timestamp}`);
      expect(res.body.data.nombre_limpio).toBe('Test Comercio');
    });

    test('rechaza regla sin nombre_limpio', async () => {
      const reglaInvalida = {
        patron: 'SOME.*PATTERN'
      };

      const res = await request(app)
        .post('/api/v1/reglas')
        .send(reglaInvalida);
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('genera patrón automáticamente desde referencia_original', async () => {
      const uniqueId = Math.random().toString(36).substring(2, 10).toUpperCase();
      const regla = {
        nombre_limpio: 'Mi Comercio Auto',
        referencia_original: `MERPAGO*TESTCOMERCIO${uniqueId}`
      };

      const res = await request(app)
        .post('/api/v1/reglas')
        .send(regla);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('patron');
    });
  });

  describe('DELETE /api/v1/reglas/:id', () => {
    test('elimina regla existente', async () => {
      const timestamp = Date.now();
      // Primero crear una regla
      const crear = await request(app)
        .post('/api/v1/reglas')
        .send({ patron: `DELETE.*TEST${timestamp}`, nombre_limpio: 'Para Eliminar' });
      
      const reglaId = crear.body.data.id;

      // Luego eliminarla
      const res = await request(app).delete(`/api/v1/reglas/${reglaId}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('retorna 404 para regla inexistente', async () => {
      const res = await request(app).delete('/api/v1/reglas/999999999');
      
      expect(res.statusCode).toBe(404);
    });
  });
});

describe('API Nombres Pendientes', () => {
  
  describe('GET /api/v1/pendientes-nombre', () => {
    test('retorna lista de pendientes', async () => {
      const res = await request(app).get('/api/v1/pendientes-nombre');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('total');
    });
  });

  describe('DELETE /api/v1/pendientes-nombre/:id', () => {
    test('retorna success aunque no exista', async () => {
      const res = await request(app).delete('/api/v1/pendientes-nombre/999999');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('API Upload', () => {
  
  describe('POST /api/v1/resumenes/upload', () => {
    test('rechaza request sin archivos', async () => {
      const res = await request(app)
        .post('/api/v1/resumenes/upload');
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    // Test con PDF real (requiere fixture)
    /*
    test('procesa PDF correctamente', async () => {
      const pdfPath = path.join(__dirname, 'fixtures', 'visa-galicia-sample.pdf');
      
      const res = await request(app)
        .post('/api/v1/resumenes/upload')
        .attach('pdfs', pdfPath);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resultados.length).toBe(1);
    });
    */
  });
});

describe('Validaciones matemáticas', () => {

  test('totales de dashboard son consistentes', async () => {
    const [resDashboard, resMovimientos, resCuotas] = await Promise.all([
      request(app).get('/api/v1/dashboard/resumen'),
      request(app).get('/api/v1/movimientos'),
      request(app).get('/api/v1/cuotas/activas')
    ]);

    const dashboard = resDashboard.body.data;
    const movimientos = resMovimientos.body.data;
    const cuotas = resCuotas.body.data;

    // Verificar que el conteo de movimientos coincide
    expect(dashboard.total_movimientos).toBe(movimientos.length);

    // Verificar que el conteo de cuotas activas coincide
    expect(dashboard.cuotas_activas).toBe(cuotas.length);
  });
});
