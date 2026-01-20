# Integración de Claude Vision Parser

## Descripción
Este servicio permite procesar:
- PDFs renderizados como imagen (ej: Banco Macro)
- Screenshots de resúmenes
- Fotos de resúmenes físicos
- Cualquier banco sin parser específico

## Instalación

```bash
cd Backend

# Dependencias requeridas
npm install @anthropic-ai/sdk sharp

# Para convertir PDFs a imagen (elegir UNA opción):

# Opción A: pdf2pic (más fácil, usa GraphicsMagick)
npm install pdf2pic
# Requiere: brew install graphicsmagick

# Opción B: pdf-poppler (más preciso)
npm install pdf-poppler
# Requiere: brew install poppler
```

## Configuración

1. Crear archivo `.env` en la carpeta Backend:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

2. Instalar dotenv:
```bash
npm install dotenv
```

## Integración en app.js

Agregar al inicio del archivo:

```javascript
require('dotenv').config();
const VisionParserService = require('./services/vision-parser.service');

// Inicializar servicio de visión (solo si hay API key)
let visionParser = null;
if (process.env.ANTHROPIC_API_KEY) {
  visionParser = new VisionParserService(process.env.ANTHROPIC_API_KEY);
  console.log('[Vision] Servicio de visión habilitado');
} else {
  console.log('[Vision] Sin API key - servicio de visión deshabilitado');
}
```

## Modificar endpoint de upload

Reemplazar el endpoint `/api/v1/resumenes/upload`:

```javascript
app.post('/api/v1/resumenes/upload', upload.array('pdfs'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No se enviaron archivos' });
    }

    const resultados = [];
    
    for (const file of req.files) {
      console.log('\n Procesando:', file.originalname);
      
      let resultado;
      
      // Intentar con parser tradicional primero
      try {
        resultado = await pdfParser.parsear(file.buffer, file.originalname);
        
        // Si el parser detecta que es imagen o falla, usar Vision
        if (!resultado.exito && visionParser) {
          console.log('[Parser] Intentando con Vision API...');
          resultado = await visionParser.procesarArchivo(
            file.buffer, 
            file.originalname,
            file.mimetype
          );
        }
        
      } catch (parseError) {
        // Si hay error y tenemos Vision disponible, intentar con eso
        if (visionParser) {
          console.log('[Parser] Error en parser tradicional, usando Vision...');
          resultado = await visionParser.procesarArchivo(
            file.buffer,
            file.originalname, 
            file.mimetype
          );
        } else {
          resultado = { exito: false, error: parseError.message };
        }
      }
      
      // Si indica usar parser tradicional (PDF con texto), volver a intentar
      if (resultado.usarParserTradicional) {
        resultado = await pdfParser.parsear(file.buffer, file.originalname);
      }

      if (resultado.exito) {
        // ... resto del código para guardar en DB (igual que antes)
      }
      
      resultados.push({
        archivo: file.originalname,
        exito: resultado.exito,
        metodo: resultado.metodo || 'parser',
        movimientos: resultado.exito ? resultado.movimientos.length : 0,
        error: resultado.error
      });
    }

    res.json({ success: true, resultados });
    
  } catch (error) {
    console.error('Error en upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Soporte para imágenes

Para aceptar imágenes además de PDFs, modificar multer:

```javascript
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
      cb(new Error('Tipo de archivo no soportado'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
});
```

## Actualizar Frontend

En el componente ImportarView, actualizar el accept del input:

```jsx
<input
  id="file-input"
  type="file"
  multiple
  accept=".pdf,image/*"
  className="hidden"
  onChange={(e) => handleUpload(e.target.files)}
/>
```

Y el texto:
```jsx
<p className="text-sm text-[var(--text-muted)]">
  PDFs de resúmenes o screenshots/fotos
</p>
```

## Costo estimado

- Claude Sonnet: ~$0.003 por imagen (1000 tokens input + 500 output)
- Un resumen típico de 3 páginas: ~$0.01
- 100 resúmenes al mes: ~$1

## Flujo de decisión

```
Archivo recibido
      │
      ▼
┌─────────────────┐
│ ¿Es PDF?        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   SÍ         NO (imagen)
    │         │
    ▼         │
┌───────────┐ │
│ ¿Tiene    │ │
│ texto?    │ │
└─────┬─────┘ │
      │       │
  ┌───┴───┐   │
  │       │   │
 SÍ      NO   │
  │       │   │
  ▼       ▼   ▼
Parser   Vision API
Trad.    (Claude)
  │           │
  └─────┬─────┘
        │
        ▼
   Validación
   matemática
        │
        ▼
   Guardar en DB
```

## Troubleshooting

### "No se pudo convertir PDF a imagen"
- Instalar GraphicsMagick: `brew install graphicsmagick`
- O instalar Poppler: `brew install poppler`

### "ANTHROPIC_API_KEY not set"
- Verificar que existe el archivo `.env`
- Verificar que la key empieza con `sk-ant-`

### Resultados imprecisos
- Claude Vision tiene ~98% de precisión
- Si hay errores, revisar la calidad de la imagen
- PDFs muy comprimidos pueden perder detalle
