// Cargar .env solo en desarrollo (en producción las variables vienen del entorno)
const envPath = require('path').join(__dirname, '..', '.env');
if (require('fs').existsSync(envPath)) {
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PDFParserService = require('./services/pdf-parser.service');
const VisionParserService = require('./services/vision-parser.service');

// Configurar multer para aceptar PDFs e imágenes
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Use PDF o imágenes (PNG, JPG, WebP)'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
});

const pdfParser = new PDFParserService();

// Inicializar servicio de visión (solo si hay API key)
let visionParser = null;
if (process.env.ANTHROPIC_API_KEY) {
  visionParser = new VisionParserService(process.env.ANTHROPIC_API_KEY);
  console.log('[Vision] Servicio de visión habilitado');
} else {
  console.log('[Vision] Sin API key - servicio de visión deshabilitado (solo PDFs con texto)');
}
const app = express();
const PORT = process.env.PORT || 3000;

// CORS configurado para producción
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check para Railway
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let db = {
  tarjetas: [],
  // Resúmenes importados (uno por PDF)
  resumenes: [],
  // Movimientos de todos los resúmenes
  movimientos: [],
  // Compras en cuotas (deduplicadas por hash_logico)
  comprasCuotas: {},
  alertas: [],
  // Reglas de limpieza definidas por el usuario
  // { id, patron, nombre_limpio, fecha_creacion, veces_usado }
  reglasUsuario: [],
  // Nombres pendientes de asignar (movimientos dudosos)
  // { id, referencia_original, sugerencias, movimiento_id, fecha_detectado }
  pendientesNombre: []
};

// Cargar reglas de usuario desde archivo si existe
const reglasPath = path.join(__dirname, '..', 'data', 'reglas-usuario.json');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (fs.existsSync(reglasPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(reglasPath, 'utf-8'));
    db.reglasUsuario = data.reglasUsuario || [];
    console.log(`[DB] Cargadas ${db.reglasUsuario.length} reglas de usuario`);
  } catch (e) {
    console.log('[DB] No se pudieron cargar reglas de usuario');
  }
}

// Función para guardar reglas de usuario a archivo
function guardarReglasUsuario() {
  try {
    fs.writeFileSync(reglasPath, JSON.stringify({ reglasUsuario: db.reglasUsuario }, null, 2));
  } catch (e) {
    console.error('[DB] Error guardando reglas:', e.message);
  }
}

// ==================== TARJETAS ====================
app.get('/api/v1/tarjetas', (req, res) => {
  const tarjetasConEstadisticas = db.tarjetas.map(t => {
    const fechaActual = new Date();
    const proximoCierre = calcularProximoCierre(t.banco);
    const proximoVencimiento = calcularProximoVencimiento(t.banco);
    const diasHastaCierre = Math.ceil((proximoCierre - fechaActual) / (1000 * 60 * 60 * 24));
    const diasHastaVencimiento = Math.ceil((proximoVencimiento - fechaActual) / (1000 * 60 * 60 * 24));
    
    // Buscar último resumen de esta tarjeta
    const resumenesOrdenados = db.resumenes
      .filter(r => r.tarjeta === t.nombre)
      .sort((a, b) => {
        if (a.anio !== b.anio) return b.anio - a.anio;
        return b.mes - a.mes;
      });
    
    const ultimoResumen = resumenesOrdenados[0];
    
    // Contar movimientos de esta tarjeta
    const movimientosTarjeta = db.movimientos.filter(m => m.tarjeta === t.nombre);
    
    // Contar cuotas activas de esta tarjeta
    const cuotasTarjeta = Object.values(db.comprasCuotas)
      .filter(c => c.tarjeta === t.nombre && c.cuotas_restantes > 0);
    
    const montoCuotasPendientes = cuotasTarjeta.reduce((sum, c) => sum + (c.monto_cuota * c.cuotas_restantes), 0);
    
    return {
      ...t,
      proximo_cierre: proximoCierre.toISOString().split('T')[0],
      proximo_vencimiento: proximoVencimiento.toISOString().split('T')[0],
      dias_hasta_cierre: Math.max(0, diasHastaCierre),
      dias_hasta_vencimiento: Math.max(0, diasHastaVencimiento),
      ultimo_resumen: ultimoResumen ? {
        mes: ultimoResumen.mes,
        anio: ultimoResumen.anio,
        fecha_cierre: ultimoResumen.fecha_cierre,
        fecha_vencimiento: ultimoResumen.fecha_vencimiento,
        total_a_pagar: ultimoResumen.total_a_pagar_pesos,
        total_a_pagar_dolares: ultimoResumen.total_a_pagar_dolares || 0,
        total_consumos: ultimoResumen.total_consumos_pesos,
        total_consumos_dolares: ultimoResumen.total_consumos_dolares || 0,
        cantidad_movimientos: ultimoResumen.cantidad_movimientos
      } : null,
      estadisticas: {
        total_movimientos: movimientosTarjeta.length,
        compras_en_cuotas: cuotasTarjeta.length,
        monto_cuotas_pendientes: montoCuotasPendientes
      }
    };
  });

  res.json({
    success: true,
    data: tarjetasConEstadisticas
  });
});

// Actualizar nombre de tarjeta
app.patch('/api/v1/tarjetas/:id', (req, res) => {
  const tarjetaId = parseInt(req.params.id);
  const { nombre } = req.body;

  if (!nombre || nombre.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'El nombre es requerido'
    });
  }

  const tarjeta = db.tarjetas.find(t => t.id === tarjetaId);
  if (!tarjeta) {
    return res.status(404).json({
      success: false,
      error: 'Tarjeta no encontrada'
    });
  }

  const nombreAnterior = tarjeta.nombre;
  const nuevoNombre = nombre.trim();

  // Actualizar nombre de la tarjeta
  tarjeta.nombre = nuevoNombre;

  // Actualizar referencias en resúmenes
  db.resumenes.forEach(r => {
    if (r.tarjeta === nombreAnterior) {
      r.tarjeta = nuevoNombre;
      // Actualizar ID del resumen también
      const nuevoId = `${nuevoNombre}-${r.anio}-${r.mes}`;
      const idAnterior = r.id;
      r.id = nuevoId;
      // Actualizar referencias en movimientos
      db.movimientos.forEach(m => {
        if (m.resumen_id === idAnterior) {
          m.resumen_id = nuevoId;
        }
      });
    }
  });

  // Actualizar referencias en movimientos
  db.movimientos.forEach(m => {
    if (m.tarjeta === nombreAnterior) {
      m.tarjeta = nuevoNombre;
    }
  });

  // Actualizar referencias en compras en cuotas
  Object.values(db.comprasCuotas).forEach(c => {
    if (c.tarjeta === nombreAnterior) {
      c.tarjeta = nuevoNombre;
    }
  });

  console.log(`[Tarjetas] Renombrada: "${nombreAnterior}" → "${nuevoNombre}"`);

  res.json({
    success: true,
    data: tarjeta,
    message: `Tarjeta renombrada de "${nombreAnterior}" a "${nuevoNombre}"`
  });
});

// Eliminar tarjeta y todos sus datos
app.delete('/api/v1/tarjetas/:id', (req, res) => {
  const tarjetaId = parseInt(req.params.id);

  const tarjetaIndex = db.tarjetas.findIndex(t => t.id === tarjetaId);
  if (tarjetaIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Tarjeta no encontrada'
    });
  }

  const tarjeta = db.tarjetas[tarjetaIndex];
  const nombreTarjeta = tarjeta.nombre;

  // Eliminar resúmenes de esta tarjeta
  const resumenesEliminados = db.resumenes.filter(r => r.tarjeta === nombreTarjeta).length;
  db.resumenes = db.resumenes.filter(r => r.tarjeta !== nombreTarjeta);

  // Eliminar movimientos de esta tarjeta
  const movimientosEliminados = db.movimientos.filter(m => m.tarjeta === nombreTarjeta).length;
  db.movimientos = db.movimientos.filter(m => m.tarjeta !== nombreTarjeta);

  // Eliminar compras en cuotas de esta tarjeta
  const cuotasEliminadas = Object.values(db.comprasCuotas).filter(c => c.tarjeta === nombreTarjeta).length;
  Object.keys(db.comprasCuotas).forEach(key => {
    if (db.comprasCuotas[key].tarjeta === nombreTarjeta) {
      delete db.comprasCuotas[key];
    }
  });

  // Eliminar la tarjeta
  db.tarjetas.splice(tarjetaIndex, 1);

  console.log(`[Tarjetas] Eliminada: "${nombreTarjeta}" (${resumenesEliminados} resúmenes, ${movimientosEliminados} movimientos, ${cuotasEliminadas} cuotas)`);

  res.json({
    success: true,
    message: `Tarjeta "${nombreTarjeta}" eliminada junto con ${resumenesEliminados} resúmenes y ${movimientosEliminados} movimientos`
  });
});

// ==================== MOVIMIENTOS ====================
app.get('/api/v1/movimientos', (req, res) => {
  let movimientos = [...db.movimientos];
  
  // Ordenar por fecha descendente
  movimientos.sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
  
  if (req.query.tarjeta) {
    movimientos = movimientos.filter(m => m.tarjeta === req.query.tarjeta);
  }
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    movimientos = movimientos.filter(m => 
      (m.referencia_limpia || m.referencia_original || '').toLowerCase().includes(search)
    );
  }

  res.json({
    success: true,
    data: movimientos,
    pagination: {
      page: 1,
      limit: 50,
      total: movimientos.length
    }
  });
});

// ==================== RESÚMENES ====================
app.get('/api/v1/resumenes', (req, res) => {
  let resumenes = [...db.resumenes];
  
  // Ordenar por fecha descendente
  resumenes.sort((a, b) => {
    if (a.anio !== b.anio) return b.anio - a.anio;
    return b.mes - a.mes;
  });

  res.json({
    success: true,
    data: resumenes
  });
});

// Eliminar un resumen y sus movimientos asociados
app.delete('/api/v1/resumenes/:id', (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const idx = db.resumenes.findIndex(r => r.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Resumen no encontrado' });
  }

  const resumen = db.resumenes[idx];

  // Eliminar movimientos asociados a este resumen
  db.movimientos = db.movimientos.filter(m => m.resumen_id !== id);

  // Eliminar cuotas que pertenecían a este resumen
  Object.keys(db.comprasCuotas).forEach(key => {
    if (db.comprasCuotas[key].resumen_id === id) {
      delete db.comprasCuotas[key];
    }
  });

  // Eliminar el resumen
  db.resumenes.splice(idx, 1);

  console.log(`[Resumenes] Eliminado: ${id} (${resumen.tarjeta} - ${resumen.mes}/${resumen.anio})`);

  res.json({
    success: true,
    message: 'Resumen eliminado correctamente'
  });
});

// ==================== CUOTAS ====================
app.get('/api/v1/cuotas/activas', (req, res) => {
  const cuotas = Object.values(db.comprasCuotas);
  const hoy = new Date();

  // Calcular fecha límite: incluir últimas cuotas de los últimos 60 días
  const fechaLimite = new Date(hoy);
  fechaLimite.setDate(fechaLimite.getDate() - 60);

  const activas = cuotas
    .filter(c => {
      // Incluir si tiene cuotas restantes (cuotas activas normales)
      if (c.cuotas_restantes > 0) return true;

      // Incluir última cuota (cuota_actual === total_cuotas) si es reciente
      // Esto asegura que cuotas como 03/03 se muestren
      if (c.cuotas_restantes === 0 && c.cuota_actual === c.total_cuotas) {
        if (c.fecha_ultima_cuota) {
          const fechaUltima = new Date(c.fecha_ultima_cuota);
          return fechaUltima >= fechaLimite;
        }
        // Si no tiene fecha pero es última cuota, incluirla
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      // Primero las últimas cuotas (para que se vean arriba)
      if (a.cuotas_restantes === 0 && b.cuotas_restantes > 0) return -1;
      if (b.cuotas_restantes === 0 && a.cuotas_restantes > 0) return 1;
      // Luego por cuotas restantes
      return a.cuotas_restantes - b.cuotas_restantes;
    })
    .map(c => ({
      id: c.hash_logico,
      descripcion: c.referencia_limpia,
      tarjeta: c.tarjeta,
      total_cuotas: c.total_cuotas,
      cuotas_pagadas: c.cuota_actual,
      cuotas_restantes: c.cuotas_restantes,
      monto_cuota: c.monto_cuota,
      monto_total: c.monto_total,
      fecha_inicio: c.fecha_primera_compra,
      fecha_ultima_cuota: c.fecha_ultima_cuota,
      es_ultima_cuota: c.cuotas_restantes === 0 && c.cuota_actual === c.total_cuotas
    }));

  res.json({
    success: true,
    data: activas
  });
});

// Proyección de cuotas a futuro (próximos N meses)
app.get('/api/v1/cuotas/proyeccion', (req, res) => {
  const meses = parseInt(req.query.meses) || 6;
  const cuotasActivas = Object.values(db.comprasCuotas).filter(c => c.cuotas_restantes > 0);
  
  const proyeccion = [];
  const hoy = new Date();
  
  for (let i = 0; i < meses; i++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    
    let totalMes = 0;
    const detalles = [];
    
    cuotasActivas.forEach(cuota => {
      if (cuota.cuotas_restantes > i) {
        totalMes += cuota.monto_cuota;
        detalles.push({
          referencia: cuota.referencia_limpia,
          tarjeta: cuota.tarjeta,
          cuota: `${cuota.cuota_actual + i + 1}/${cuota.total_cuotas}`,
          monto: cuota.monto_cuota
        });
      }
    });
    
    proyeccion.push({
      mes: mesKey,
      mes_nombre: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      total: totalMes,
      cantidad_cuotas: detalles.length,
      detalles
    });
  }

  res.json({
    success: true,
    data: proyeccion
  });
});

// ==================== ALERTAS ====================
app.get('/api/v1/alertas', (req, res) => {
  let alertas = [...db.alertas];
  
  if (req.query.leidas === 'false') {
    alertas = alertas.filter(a => !a.leida);
  }

  res.json({
    success: true,
    data: alertas,
    contadores: {
      no_leidas: alertas.filter(a => !a.leida).length,
      archivadas: 0
    }
  });
});

app.patch('/api/v1/alertas/:id/marcar-leida', (req, res) => {
  const alerta = db.alertas.find(a => a.id === parseInt(req.params.id));
  if (alerta) {
    alerta.leida = true;
  }
  res.json({ success: true });
});

// ==================== REGLAS DE USUARIO ====================
// Obtener todas las reglas de usuario
app.get('/api/v1/reglas', (req, res) => {
  res.json({
    success: true,
    data: db.reglasUsuario.sort((a, b) => b.veces_usado - a.veces_usado)
  });
});

// Crear nueva regla de usuario
app.post('/api/v1/reglas', (req, res) => {
  const { patron, nombre_limpio, referencia_original } = req.body;
  
  if (!nombre_limpio) {
    return res.status(400).json({
      success: false,
      error: { message: 'nombre_limpio es requerido' }
    });
  }
  
  // Generar patrón a partir de la referencia original si no se proporciona
  const patronFinal = patron || generarPatronDesdeReferencia(referencia_original || nombre_limpio);
  
  // Verificar si ya existe una regla con este patrón
  const existente = db.reglasUsuario.find(r => r.patron.toLowerCase() === patronFinal.toLowerCase());
  if (existente) {
    return res.status(400).json({
      success: false,
      error: { message: 'Ya existe una regla con este patrón' }
    });
  }
  
  const nuevaRegla = {
    id: Date.now(),
    patron: patronFinal,
    nombre_limpio: nombre_limpio.trim(),
    fecha_creacion: new Date().toISOString(),
    veces_usado: 0
  };
  
  db.reglasUsuario.push(nuevaRegla);
  guardarReglasUsuario();
  
  // Aplicar la regla a movimientos existentes con el mismo patrón
  const regex = new RegExp(patronFinal, 'i');
  let actualizados = 0;
  db.movimientos.forEach(mov => {
    if (regex.test(mov.referencia_original) && mov.es_dudoso) {
      mov.referencia_limpia = nombre_limpio;
      mov.es_dudoso = false;
      actualizados++;
    }
  });
  
  // Eliminar de pendientes si corresponde
  db.pendientesNombre = db.pendientesNombre.filter(p => !regex.test(p.referencia_original));
  
  console.log(`[Reglas] Nueva regla creada: "${patronFinal}" → "${nombre_limpio}" (${actualizados} movimientos actualizados)`);
  
  res.json({
    success: true,
    data: nuevaRegla,
    movimientos_actualizados: actualizados
  });
});

// Eliminar regla de usuario
app.delete('/api/v1/reglas/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.reglasUsuario.findIndex(r => r.id === id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { message: 'Regla no encontrada' }
    });
  }
  
  db.reglasUsuario.splice(index, 1);
  guardarReglasUsuario();
  
  res.json({ success: true });
});

// ==================== NOMBRES PENDIENTES ====================
// Obtener movimientos con nombres pendientes de asignar
app.get('/api/v1/pendientes-nombre', (req, res) => {
  res.json({
    success: true,
    data: db.pendientesNombre,
    total: db.pendientesNombre.length
  });
});

// Resolver un nombre pendiente (crea regla y actualiza movimientos)
app.post('/api/v1/pendientes-nombre/:id/resolver', (req, res) => {
  const id = parseFloat(req.params.id);
  const { nombre_limpio } = req.body;
  
  if (!nombre_limpio) {
    return res.status(400).json({
      success: false,
      error: { message: 'nombre_limpio es requerido' }
    });
  }
  
  const pendiente = db.pendientesNombre.find(p => p.id === id);
  if (!pendiente) {
    return res.status(404).json({
      success: false,
      error: { message: 'Pendiente no encontrado' }
    });
  }
  
  // Crear regla automáticamente
  const patron = generarPatronDesdeReferencia(pendiente.referencia_original);
  
  const nuevaRegla = {
    id: Date.now(),
    patron,
    nombre_limpio: nombre_limpio.trim(),
    fecha_creacion: new Date().toISOString(),
    veces_usado: 0
  };
  
  db.reglasUsuario.push(nuevaRegla);
  guardarReglasUsuario();
  
  // Aplicar a todos los movimientos que coincidan
  const regex = new RegExp(patron, 'i');
  let actualizados = 0;
  db.movimientos.forEach(mov => {
    if (regex.test(mov.referencia_original)) {
      mov.referencia_limpia = nombre_limpio;
      mov.es_dudoso = false;
      actualizados++;
    }
  });
  
  // Eliminar todos los pendientes que coincidan con el patrón
  db.pendientesNombre = db.pendientesNombre.filter(p => !regex.test(p.referencia_original));
  
  console.log(`[Pendientes] Resuelto: "${pendiente.referencia_original}" → "${nombre_limpio}" (${actualizados} movimientos)`);
  
  res.json({
    success: true,
    data: {
      regla: nuevaRegla,
      movimientos_actualizados: actualizados
    }
  });
});

// Ignorar un nombre pendiente (no crear regla, solo quitarlo de pendientes)
app.delete('/api/v1/pendientes-nombre/:id', (req, res) => {
  const id = parseFloat(req.params.id);
  db.pendientesNombre = db.pendientesNombre.filter(p => p.id !== id);
  res.json({ success: true });
});

// Función para generar patrón regex desde referencia original
function generarPatronDesdeReferencia(ref) {
  // Extraer palabras significativas (3+ caracteres alfabéticos)
  const palabras = ref.match(/[a-zA-Z]{3,}/gi) || [];
  if (palabras.length === 0) return ref.substring(0, 15);
  
  // Usar las primeras 2-3 palabras más significativas
  const significativas = palabras
    .filter(p => !['merpago', 'mercpago', 'www', 'com', 'arg', 'srl', 'sa'].includes(p.toLowerCase()))
    .slice(0, 2);
  
  if (significativas.length === 0) return palabras[0];
  return significativas.join('.*');
}

// ==================== UPLOAD ====================
app.post('/api/v1/resumenes/upload', upload.array('pdfs'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No se subieron archivos' }
      });
    }

    const resultados = [];

    for (const file of req.files) {
      console.log('\n Procesando: ' + file.originalname + ' (' + file.mimetype + ')');

      let resultado;
      let metodoUsado = 'parser';

      // Si es imagen, usar Vision directamente
      if (file.mimetype.startsWith('image/')) {
        if (!visionParser) {
          resultados.push({
            archivo: file.originalname,
            error: 'Para procesar imágenes se requiere ANTHROPIC_API_KEY en .env'
          });
          continue;
        }
        console.log('[Vision] Procesando imagen...');
        resultado = await visionParser.procesarArchivo(file.buffer, file.originalname, file.mimetype);
        metodoUsado = 'vision';
      } else {
        // Es PDF, intentar con parser tradicional primero
        try {
          resultado = await pdfParser.parsearPDF(file.buffer, file.originalname);

          // Si el parser falló y tenemos Vision disponible, intentar con Vision
          if (!resultado.exito && visionParser) {
            console.log('[Parser] Intentando con Vision API...');
            resultado = await visionParser.procesarArchivo(file.buffer, file.originalname, file.mimetype);
            metodoUsado = 'vision';

            // Si Vision indica usar parser tradicional (PDF con texto), ya fallamos con él
            if (resultado.usarParserTradicional) {
              resultado = { exito: false, error: 'No se pudo extraer información del PDF' };
            }
          }
        } catch (parseError) {
          // Si hay error y tenemos Vision disponible, intentar con eso
          if (visionParser) {
            console.log('[Parser] Error en parser tradicional, usando Vision...');
            resultado = await visionParser.procesarArchivo(file.buffer, file.originalname, file.mimetype);
            metodoUsado = 'vision';
          } else {
            resultado = { exito: false, error: parseError.message };
          }
        }
      }

      if (resultado.exito) {
        // Para Vision, la estructura es ligeramente diferente
        const tarjetaNombre = resultado.tarjeta?.nombre || resultado.tarjeta;
        const resumenId = `${tarjetaNombre}-${resultado.resumen.anio}-${resultado.resumen.mes}`;

        // Crear tarjeta si no existe
        const tarjetaExistente = db.tarjetas.find(t => t.nombre === tarjetaNombre);
        if (!tarjetaExistente) {
          const nuevaTarjeta = {
            id: db.tarjetas.length + 1,
            nombre: tarjetaNombre,
            tipo: resultado.tipo || resultado.tarjeta?.tipo || 'VISA',
            banco: resultado.banco || resultado.tarjeta?.banco || 'Desconocido',
            activa: true
          };
          db.tarjetas.push(nuevaTarjeta);
          console.log(`[Tarjetas] Nueva tarjeta creada: ${tarjetaNombre} (banco: ${nuevaTarjeta.banco})`);
        }

        // Verificar si ya existe este resumen
        const resumenExistente = db.resumenes.find(r => r.id === resumenId);
        if (resumenExistente) {
          console.log(`Resumen ${resumenId} ya existe, actualizando...`);
          // Eliminar movimientos anteriores de este resumen
          db.movimientos = db.movimientos.filter(m => m.resumen_id !== resumenId);
        }
        
        // Guardar resumen
        const nuevoResumen = {
          id: resumenId,
          tarjeta: tarjetaNombre,
          mes: resultado.resumen.mes,
          anio: resultado.resumen.anio,
          fecha_cierre: resultado.resumen.fecha_cierre,
          fecha_vencimiento: resultado.resumen.fecha_vencimiento,
          total_a_pagar_pesos: resultado.resumen.total_a_pagar_pesos,
          total_a_pagar_dolares: resultado.resumen.total_a_pagar_dolares,
          total_consumos_pesos: resultado.resumen.total_consumos_pesos,
          total_consumos_dolares: resultado.resumen.total_consumos_dolares,
          impuestos: resultado.resumen.impuestos || null,
          cantidad_movimientos: resultado.movimientos.length,
          fecha_importacion: new Date().toISOString()
        };
        
        if (resumenExistente) {
          Object.assign(resumenExistente, nuevoResumen);
        } else {
          db.resumenes.push(nuevoResumen);
        }
        
        // Agregar movimientos con referencia al resumen
        const movimientosConTarjeta = resultado.movimientos.map((mov, idx) => ({
          ...mov,
          id: `${resumenId}-${idx}`,
          tarjeta: tarjetaNombre,
          resumen_id: resumenId,
          mes_resumen: resultado.resumen.mes,
          anio_resumen: resultado.resumen.anio
        }));
        
        // Aplicar reglas de usuario a movimientos dudosos
        movimientosConTarjeta.forEach(mov => {
          if (mov.es_dudoso) {
            // Buscar si hay una regla de usuario que coincida
            for (const regla of db.reglasUsuario) {
              try {
                const regex = new RegExp(regla.patron, 'i');
                if (regex.test(mov.referencia_original)) {
                  mov.referencia_limpia = regla.nombre_limpio;
                  mov.es_dudoso = false;
                  regla.veces_usado++;
                  console.log(`[Reglas] Aplicada: "${regla.patron}" → "${regla.nombre_limpio}"`);
                  break;
                }
              } catch (e) {
                // Regex inválido, ignorar
              }
            }
          }
        });
        
        // Guardar reglas actualizadas si se usaron
        guardarReglasUsuario();
        
        db.movimientos = [...db.movimientos, ...movimientosConTarjeta];
        
        // Registrar movimientos dudosos como pendientes (sin duplicar)
        const dudosos = movimientosConTarjeta.filter(m => m.es_dudoso);
        dudosos.forEach(mov => {
          // Verificar si ya existe un pendiente con referencia similar
          const refNormalizada = mov.referencia_original.toLowerCase().replace(/[^a-z]/g, '').substring(0, 20);
          const yaExiste = db.pendientesNombre.some(p => {
            const pNorm = p.referencia_original.toLowerCase().replace(/[^a-z]/g, '').substring(0, 20);
            return pNorm === refNormalizada;
          });
          
          if (!yaExiste) {
            db.pendientesNombre.push({
              id: Date.now() + Math.random(),
              referencia_original: mov.referencia_original,
              sugerencias: mov.sugerencias || [],
              movimiento_id: mov.id,
              tarjeta: tarjetaNombre,
              monto: mov.monto_pesos || mov.monto_dolares,
              fecha_detectado: new Date().toISOString()
            });
            console.log(`[Pendientes] Nuevo: "${mov.referencia_original}"`);
          }
        });
        
        if (dudosos.length > 0) {
          console.log(`[Pendientes] ${dudosos.length} movimientos dudosos, ${db.pendientesNombre.length} pendientes totales`);
        }
        
        // Procesar compras en cuotas (deduplicar por hash_logico)
        (resultado.compras || []).forEach(compra => {
          const hashKey = compra.hash_logico;
          
          if (db.comprasCuotas[hashKey]) {
            // Ya existe, actualizar información de la cuota actual
            const existente = db.comprasCuotas[hashKey];
            const cuotaActual = compra.cuotas && compra.cuotas.length > 0 
              ? Math.max(...compra.cuotas.map(c => c.numero_cuota))
              : existente.cuota_actual;
            
            // Solo actualizar si esta cuota es más reciente
            if (cuotaActual > existente.cuota_actual) {
              existente.cuota_actual = cuotaActual;
              existente.cuotas_restantes = existente.total_cuotas - cuotaActual;
              existente.fecha_ultima_cuota = resultado.resumen.fecha_cierre;
              existente.historial_cuotas.push({
                numero: cuotaActual,
                fecha: resultado.resumen.fecha_cierre,
                monto: compra.monto_cuota,
                resumen_id: resumenId
              });
            }
          } else {
            // Nueva compra en cuotas
            const cuotaActual = compra.cuotas && compra.cuotas.length > 0 
              ? Math.max(...compra.cuotas.map(c => c.numero_cuota))
              : 1;
            
            db.comprasCuotas[hashKey] = {
              hash_logico: hashKey,
              tarjeta: tarjetaNombre,
              referencia_limpia: compra.referencia_limpia,
              total_cuotas: compra.total_cuotas,
              monto_cuota: compra.monto_cuota,
              monto_total: compra.monto_total,
              fecha_primera_compra: compra.fecha_primera_compra,
              cuota_actual: cuotaActual,
              cuotas_restantes: compra.total_cuotas - cuotaActual,
              fecha_ultima_cuota: resultado.resumen.fecha_cierre,
              historial_cuotas: [{
                numero: cuotaActual,
                fecha: resultado.resumen.fecha_cierre,
                monto: compra.monto_cuota,
                resumen_id: resumenId
              }]
            };
          }
        });
        
        resultados.push({
          archivo: file.originalname,
          exito: true,
          tarjeta: tarjetaNombre,
          mes: resultado.resumen.mes,
          anio: resultado.resumen.anio,
          movimientos_extraidos: resultado.movimientos.length,
          movimientos_dudosos: resultado.movimientosDudosos?.length || 0,
          cuotas_detectadas: resultado.compras?.length || 0,
          total_pesos: resultado.resumen.total_a_pagar_pesos,
          total_consumos: resultado.resumen.total_consumos_pesos,
          impuestos: resultado.resumen.impuestos || null,
          fecha_cierre: resultado.resumen.fecha_cierre,
          fecha_vencimiento: resultado.resumen.fecha_vencimiento,
          actualizado: !!resumenExistente,
          metodo: metodoUsado,
          // Datos completos para localStorage
          datos: {
            tarjeta: tarjetaNombre,
            resumen: {
              mes: resultado.resumen.mes,
              anio: resultado.resumen.anio,
              fecha_cierre: resultado.resumen.fecha_cierre,
              fecha_vencimiento: resultado.resumen.fecha_vencimiento,
              total_a_pagar_pesos: resultado.resumen.total_a_pagar_pesos,
              total_a_pagar_dolares: resultado.resumen.total_a_pagar_dolares,
              total_consumos_pesos: resultado.resumen.total_consumos_pesos,
              total_consumos_dolares: resultado.resumen.total_consumos_dolares,
              impuestos: resultado.resumen.impuestos || null,
              banco: resultado.banco || 'Desconocido',
              tipo: resultado.tipo || 'VISA'
            },
            movimientos: movimientosConTarjeta
          }
        });

        console.log(`Procesado correctamente (método: ${metodoUsado})`);
      } else {
        resultados.push({
          archivo: file.originalname,
          exito: false,
          error: resultado.error
        });
        console.log('Error: ' + resultado.error);
      }
    }

    const exitosos = resultados.filter(r => !r.error).length;

    res.json({
      success: true,
      data: {
        procesados: resultados.length,
        exitosos,
        fallidos: resultados.length - exitosos,
        resultados
      },
      message: exitosos + ' resumen(es) procesado(s) exitosamente'
    });

  } catch (error) {
    console.error('Error en upload:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// ==================== DASHBOARD ====================
app.get('/api/v1/dashboard/resumen', (req, res) => {
  // Totales globales
  const cuotasActivas = Object.values(db.comprasCuotas).filter(c => c.cuotas_restantes > 0);
  const totalCuotasPendientes = cuotasActivas.reduce((sum, c) => sum + c.cuotas_restantes, 0);
  const montoPendienteCuotas = cuotasActivas.reduce((sum, c) => sum + (c.monto_cuota * c.cuotas_restantes), 0);

  res.json({
    success: true,
    data: {
      total_resumenes: db.resumenes.length,
      total_movimientos: db.movimientos.length,
      cuotas_activas: cuotasActivas.length,
      pagos_pendientes: totalCuotasPendientes,
      total_pendiente_cuotas: montoPendienteCuotas
    }
  });
});

// ==================== GRÁFICOS ====================
app.get('/api/v1/proyecciones/graficos', (req, res) => {
  // Agrupar resúmenes por mes y tarjeta
  const datosPorMes = {};
  const tarjetasSet = new Set();

  db.resumenes.forEach(resumen => {
    const mesKey = `${resumen.anio}-${String(resumen.mes).padStart(2, '0')}`;
    const tarjeta = resumen.tarjeta || 'Sin tarjeta';
    tarjetasSet.add(tarjeta);

    if (!datosPorMes[mesKey]) {
      datosPorMes[mesKey] = { mes: mesKey };
    }

    datosPorMes[mesKey][tarjeta] = (datosPorMes[mesKey][tarjeta] || 0) + (resumen.total_a_pagar_pesos || 0);
  });

  // Ordenar por mes
  const mesesOrdenados = Object.keys(datosPorMes).sort();
  const evolucion = mesesOrdenados.map(mes => {
    const datos = datosPorMes[mes];
    // Redondear todos los valores
    Object.keys(datos).forEach(key => {
      if (key !== 'mes' && typeof datos[key] === 'number') {
        datos[key] = Math.round(datos[key]);
      }
    });
    return datos;
  });

  res.json({
    success: true,
    data: {
      evolucion,
      tarjetas: Array.from(tarjetasSet)
    }
  });
});

app.get('/api/v1/proyecciones/proximo-mes', (req, res) => {
  const cuotasActivas = Object.values(db.comprasCuotas).filter(c => c.cuotas_restantes > 0);
  
  // Agrupar por tarjeta
  const porTarjeta = {};
  cuotasActivas.forEach(cuota => {
    if (!porTarjeta[cuota.tarjeta]) {
      porTarjeta[cuota.tarjeta] = {
        tarjeta: cuota.tarjeta,
        cantidad_cuotas: 0,
        monto_cuotas: 0
      };
    }
    porTarjeta[cuota.tarjeta].cantidad_cuotas++;
    porTarjeta[cuota.tarjeta].monto_cuotas += cuota.monto_cuota;
  });

  const totalProyectado = Object.values(porTarjeta).reduce((sum, t) => sum + t.monto_cuotas, 0);

  res.json({
    success: true,
    data: {
      total_proyectado: totalProyectado,
      por_tarjeta: Object.values(porTarjeta)
    }
  });
});

// ==================== UTILIDADES ====================
function calcularProximoCierre(banco, fechaBase = new Date()) {
  const hoy = fechaBase;
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  
  const primerDia = new Date(anio, mes, 1);
  const primerViernes = encontrarPrimerViernes(primerDia);
  
  const nViernes = banco === 'Galicia' ? 3 : 2;
  const vencimiento = new Date(primerViernes);
  vencimiento.setDate(vencimiento.getDate() + (nViernes * 7));
  
  const cierre = new Date(vencimiento);
  cierre.setDate(cierre.getDate() - 8);
  
  if (cierre < hoy) {
    const proximoMes = new Date(anio, mes + 1, 1);
    return calcularProximoCierre(banco, proximoMes);
  }
  
  return cierre;
}

function calcularProximoVencimiento(banco) {
  const cierre = calcularProximoCierre(banco);
  const vencimiento = new Date(cierre);
  vencimiento.setDate(vencimiento.getDate() + 8);
  return vencimiento;
}

function encontrarPrimerViernes(primerDia) {
  const dia = new Date(primerDia);
  while (dia.getDay() !== 5) {
    dia.setDate(dia.getDate() + 1);
  }
  return dia;
}

// ==================== SERVIDOR ====================
app.listen(PORT, () => {
  console.log('==================================================');
  console.log('Servidor de Tarjetas iniciado');
  console.log('==================================================');
  console.log('URL: http://localhost:' + PORT);
  console.log('API: http://localhost:' + PORT + '/api/v1');
  console.log('==================================================');
  console.log('Endpoints disponibles:');
  console.log('  GET  /api/v1/tarjetas');
  console.log('  GET  /api/v1/movimientos');
  console.log('  GET  /api/v1/resumenes');
  console.log('  GET  /api/v1/cuotas/activas');
  console.log('  GET  /api/v1/cuotas/proyeccion');
  console.log('  GET  /api/v1/alertas');
  console.log('  POST /api/v1/resumenes/upload');
  console.log('  GET  /api/v1/dashboard/resumen');
  console.log('  GET  /api/v1/proyecciones/graficos');
  console.log('  GET  /api/v1/proyecciones/proximo-mes');
  console.log('  --- Reglas y Nombres ---');
  console.log('  GET  /api/v1/reglas');
  console.log('  POST /api/v1/reglas');
  console.log('  DELETE /api/v1/reglas/:id');
  console.log('  GET  /api/v1/pendientes-nombre');
  console.log('  POST /api/v1/pendientes-nombre/:id/resolver');
  console.log('  DELETE /api/v1/pendientes-nombre/:id');
  console.log('==================================================');
});
