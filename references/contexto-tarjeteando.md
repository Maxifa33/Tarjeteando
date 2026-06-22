# Contexto Técnico — Tarjeteando

> Lectura obligatoria antes de cada sesión de debugging. Contiene el estado real del código, no un resumen genérico.

---

## Stack y Deploy

| Capa | Tecnología | Deploy |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Vercel |
| Backend | Node.js + Express | Railway |
| DB | In-memory (`db` object en RAM) + localStorage browser | — |
| PDF parsing | pdf-parse (texto) + Claude Vision API (fallback) | — |

**URL base API:** `import.meta.env.VITE_API_URL || 'http://localhost:3000'`  
**Todos los endpoints:** `/api/v1/...`

---

## Estructura de archivos

```
tarjetas-proyecto/
├── Frontend/
│   ├── src/
│   │   ├── App.jsx               ← monolítico, ~3443 líneas, TODOS los componentes
│   │   ├── index.css             ← CSS variables, temas claro/oscuro
│   │   └── services/
│   │       └── storage.js        ← 446 líneas, helpers localStorage
│   ├── package.json
│   └── .env.local                ← VITE_API_URL
├── Backend/
│   ├── src/
│   │   ├── app.js                ← 1134 líneas, Express server + db en RAM
│   │   └── services/
│   │       ├── pdf-parser.service.js    ← 1464 líneas, parser por banco
│   │       └── vision-parser.service.js ← 565 líneas, Claude Vision API
│   ├── data/
│   │   └── reglas-usuario.json   ← ÚNICO archivo persistente del backend
│   ├── package.json
│   └── .env                      ← ANTHROPIC_API_KEY, PORT, FRONTEND_URL
├── references/
│   └── contexto-tarjeteando.md  ← este archivo
└── CLAUDE.md                     ← instrucciones para Claude Code
```

---

## Frontend — App.jsx

### Imports clave
```js
import React, { useState, useEffect, useCallback } from 'react';
import storage from './services/storage';
// lucide-react: LayoutDashboard, Receipt, CreditCard, Tag, Upload, TrendingUp, ...
// recharts: LineChart, AreaChart, BarChart, Bar, PieChart, Pie, Cell, ...
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1`;
```

### Componentes (orden en el archivo)
1. **`OnboardingWizard`** — wizard inicial, 3 pasos, se muestra si `!localStorage.getItem('onboarding_completed')`
2. **`CreditCardVisual`** — card visual de cada tarjeta. Props: `tarjeta, cotizacion=null, onClick, onEdit, onDelete`
3. **`SettingsModal`** — modal con tabs: tarjetas, preferencias, alertas, datos, temas
4. **`App`** — componente raíz con TODO el estado global
5. **`DashboardView`** — vista principal: StatCards, CreditCardVisuals, gráficos, proyección cuotas
6. **`MovimientosView`** — lista con filtros por tarjeta/tipo/mes
7. **`CuotasView`** — cuotas activas con progress bars y proyección
8. **`ReglasView`** — gestión de reglas limpieza de nombres + pendientes de nombre
9. **`ImportarView`** — drag & drop para PDFs e imágenes

### Estado global en `App`
```js
const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
const [sidebarOpen, setSidebarOpen] = useState(false);
const [activeView, setActiveView] = useState('dashboard');
const [searchQuery, setSearchQuery] = useState('');
const [settingsOpen, setSettingsOpen] = useState(false);
const [settingsInitialTab, setSettingsInitialTab] = useState('tarjetas');
const [filtroTipoGastoInicial, setFiltroTipoGastoInicial] = useState(null);
const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding_completed'));
const [tarjetas, setTarjetas] = useState([]);
const [movimientos, setMovimientos] = useState([]);
const [resumenes, setResumenes] = useState([]);
const [cuotasActivas, setCuotasActivas] = useState([]);
const [proyeccionCuotas, setProyeccionCuotas] = useState([]);
const [dashboard, setDashboard] = useState({});
const [proyecciones, setProyecciones] = useState({ evolucion_mensual: [] });
const [reglas, setReglas] = useState([]);
const [loading, setLoading] = useState(true);
const [gastosFijos, setGastosFijos] = useState(new Set());
const [nombresTarjetas, setNombresTarjetas] = useState({});
const [cotizacion, setCotizacion] = useState(() => {
  try {
    const cache = JSON.parse(localStorage.getItem('cotizacion_cache') || 'null');
    if (cache && Date.now() - cache.cachedAt < 30 * 60 * 1000) return cache;
  } catch {}
  return null;
});
```

### fetchData (useCallback)
Fuente de verdad: **localStorage** (via `storage.*`). NO llama al backend para datos.

```js
// Flujo fetchData:
storage.getResumenes()          → setResumenes
storage.getMovimientos()        → setMovimientos
storage.getTarjetas()           → setTarjetas (enriquecidas con último resumen y stats)
storage.getReglas()             → setReglas
storage.getEstadisticas()       → setDashboard
storage.getEvolucionMensual(6)  → setProyecciones
// Proyección de cuotas (calculada en App, NO usa storage.getProyeccionCuotas):
for (let i = 0; i < 6; i++) {  // i=0 = mes actual
  cuotasActivasData.forEach(m => {
    if (m.total_cuotas - m.cuota_actual >= i) totalMes += m.monto_pesos || 0;
  });
}
setProyeccionCuotas(proyeccionCalculada); // [{mes, mes_nombre, total, cantidad_cuotas}]
```

### Cotización dólar tarjeta
```js
// useEffect en App, cache 30 min en localStorage key: 'cotizacion_cache'
fetch('https://dolarapi.com/v1/dolares/tarjeta')  // primario
// Fallback: 'https://api.bluelytics.com.ar/v2/latest'
// Objeto guardado: {venta, compra, nombre, fechaActualizacion, cachedAt}
```

### Funciones auxiliares clave
```js
formatMonto(n)           // → "$1.234.567,89"
formatMontoDolares(n)    // → "USD 1.234,56"
getTarjetaColor(nombre)  // usa TARJETA_COLORS o hash del nombre
getCardTheme(banco)      // usa BANK_THEMES por banco
analizarGastosFijosVariables(movimientos) // detecta gastos recurrentes
```

### DashboardView — props
```js
DashboardView({
  tarjetas, movimientos, resumenes, cuotasActivas, proyeccionCuotas,
  dashboard, proyecciones, reglas, gastosFijos, loading,
  onImport, onViewChange, onFiltroTipoGasto, cotizacion = null
})
```

**StatCards del Dashboard:**
1. Total a pagar (último resumen de cada tarjeta)
2. Cuotas Próximo Mes = `proyeccionCuotas[0]?.total || 0`
3. Movimientos (total del último resumen)
4. Tarjetas activas

**Gráfico de barras proyección cuotas:**
- Estado: `mesDetalleIdx` (null = ninguno seleccionado)
- Click en barra → toggle `mesDetalleIdx`
- Barras no seleccionadas: `opacity 0.4`
- Texto bajo barra: "X consumos en cuotas pendientes"
- Panel de detalle expandible filtra: `cuotasActivas.filter(c => c.cuotas_restantes >= i)`

### CreditCardVisual — lógica clave
```jsx
// Si tarjeta tiene saldo USD y hay cotización:
{ultimoResumen.total_a_pagar_dolares > 0 && cotizacion?.venta && (
  <p>≈ {formatMonto(ultimoResumen.total_a_pagar_dolares * cotizacion.venta)} ARS</p>
)}
```

---

## Frontend — storage.js

### localStorage keys
```js
const STORAGE_KEYS = {
  RESUMENES:  'tarjetas_resumenes',   // array de resúmenes
  MOVIMIENTOS:'tarjetas_movimientos', // array de movimientos
  REGLAS:     'tarjetas_reglas',      // array de reglas
  TARJETAS:   'tarjetas_lista',       // array de tarjetas
  CONFIG:     'tarjetas_config',      // { theme, apiKey }
  VERSION:    'tarjetas_version'      // '1.1.0'
};
// Keys externas (manejadas fuera de storage.js):
// 'cotizacion_cache'     → {venta, compra, nombre, fechaActualizacion, cachedAt}
// 'onboarding_completed' → boolean
// 'theme'               → 'dark'|'light'
// 'nombresTarjetas'     → {[nombre]: alias}
```

### Métodos principales
```js
storage.getResumenes()                          // → Resumen[]
storage.saveResumen(resumen)                    // upsert por id
storage.deleteResumen(id)                       // borra resumen + movimientos asociados
storage.getMovimientos()                        // → Movimiento[]
storage.saveMovimientos(resumenId, movs, nombre)// reemplaza movimientos del resumen
storage.getTarjetas()                           // → Tarjeta[]
storage.saveTarjeta(tarjeta)                    // upsert por nombre
storage.getReglas()                             // → Regla[]
storage.saveRegla(regla)                        // upsert por id (Date.now() si sin id)
storage.deleteRegla(id)                         // filter out
storage.getConfig()                             // → { theme, apiKey }
storage.saveConfig(config)                      // merge
storage.exportAll()                             // → { version, exportDate, data: {...} }
storage.importAll(data, merge=false)            // reemplaza o mergea
storage.clearAll()                              // borra todas las keys
storage.getEstadisticas()                       // calcula totales desde localStorage
storage.getEvolucionMensual(meses=6)            // evolución mensual pesos
storage.getProyeccionCuotas(mesesFuturos=6)     // ATENCIÓN: empieza en i=1, no i=0
```

**⚠️ GOTCHA:** `storage.getProyeccionCuotas()` itera desde `i=1` (solo meses futuros, excluye el actual). En `fetchData` de App.jsx itera desde `i=0` (incluye mes actual). El gráfico usa la versión de App.jsx (i=0). Si alguien usa `storage.getProyeccionCuotas()` directo, el mes actual no aparece.

---

## Backend — app.js

### DB en memoria
```js
const db = {
  tarjetas: [],        // Tarjeta[]
  resumenes: [],       // Resumen[]
  movimientos: [],     // Movimiento[]
  comprasCuotas: {},   // { [hash_logico]: ComprasCuotas }
  alertas: [],
  reglasUsuario: [],   // Regla[] (persiste en data/reglas-usuario.json)
  pendientesNombre: [] // movimientos con nombre dudoso
};
```

**Único dato persistente:** `Backend/data/reglas-usuario.json` (cargado al arrancar, guardado con cada POST /reglas)

### Endpoints (todos en /api/v1/)
```
POST   /resumenes/upload         ← sube PDFs, parsea, guarda en db
GET    /tarjetas                 ← db.tarjetas
PATCH  /tarjetas/:id             ← actualizar tarjeta
DELETE /tarjetas/:id
GET    /movimientos              ← db.movimientos (con ?tarjeta=, ?mes=, ?anio=)
GET    /resumenes                ← db.resumenes
DELETE /resumenes/:id
GET    /cuotas/activas           ← filtra movimientos con es_cuota
GET    /cuotas/proyeccion        ← proyección de cuotas (similar a storage pero desde db)
GET    /reglas                   ← db.reglasUsuario
POST   /reglas                   ← agrega regla + guarda JSON
DELETE /reglas/:id
GET    /pendientes-nombre        ← db.pendientesNombre
POST   /pendientes-nombre/:id/resolver
DELETE /pendientes-nombre/:id
GET    /dashboard/resumen        ← estadísticas del db
GET    /proyecciones/graficos
GET    /proyecciones/proximo-mes
```

### Flujo upload PDF
```
POST /resumenes/upload
  → multer (memoryStorage, max 10MB, acepta .pdf + imágenes)
  → para cada archivo:
      1. pdfParser.parsearPDF(buffer, filename)
         si falla o lanza USAR_VISION → visionParser.procesarArchivo(buffer, filename, mimetype)
      2. Si resultado.exito:
         - guardar en db.tarjetas (upsert por nombre)
         - guardar en db.resumenes (upsert por id)
         - guardar movimientos en db.movimientos
         - procesar compras en cuotas → db.comprasCuotas (hash_logico)
         - movimientos dudosos → db.pendientesNombre
```

---

## Backend — pdf-parser.service.js

### Bancos detectados (tradicional)
```
GALICIA_MASTERCARD, GALICIA_VISA
BBVA_VISA
SANTANDER_VISA, SANTANDER_MASTERCARD, SANTANDER_AMEX
HSBC_GENERIC, ICBC_GENERIC
DESCONOCIDO → lanza Error('USAR_VISION: ...')
```

**Bancos reconocidos por nombre** (incluso sin parser específico): Galicia, BBVA, Santander, Macro, HSBC, ICBC, Ciudad, Nación, Provincia, Patagonia, Supervielle, Brubank, Ualá, Mercado Pago

### Método principal
```js
async parsearPDF(buffer, nombreArchivo)
// Returns:
{
  exito: true,
  tarjeta: string,           // nombre completo ej: "VISA Galicia"
  resumen: {
    banco: string, tipo: string, mes: number, anio: number,
    fecha_cierre: string, fecha_vencimiento: string,
    total_a_pagar_pesos: number, total_a_pagar_dolares: number,
    total_consumos_pesos: number, total_consumos_dolares: number,
    impuestos: { iva, sellos, iibb, percepciones, comisiones, impuesto_pais, otros, total_impuestos }
  },
  movimientos: Movimiento[],
  compras: ComprasCuotas[],
  movimientosDudosos: Movimiento[]
}
```

### Validación de totales
El parser valida en consola: suma extraída vs total_a_pagar del PDF. Diferencias ≤ $100 se loguean como ℹ️ (pagos/créditos), mayores como ⚠️.

---

## Backend — vision-parser.service.js

```js
// Modelo: claude-sonnet-4-20250514
// Dependencias: @anthropic-ai/sdk, mupdf, sharp, canvas, pdf-parse
// Max 3 páginas por PDF (escala 2.0x para calidad)

async detectarTipoPDF(buffer)  // → { tipo: 'texto'|'imagen', caracteres: number }
async pdfToImages(buffer)      // → base64[] (PNG via mupdf)
async procesarArchivo(buffer, filename, mimetype)  // → mismo formato que pdfParser
```

**Activo solo si:** `process.env.ANTHROPIC_API_KEY` está seteado en Backend/.env

---

## Schemas de datos

### Resumen (localStorage key: `tarjetas_resumenes`)
```typescript
{
  id: string;                  // `${tarjeta}-${anio}-${mes}` ej: "VISA Galicia-2024-11"
  tarjeta: string;             // nombre de tarjeta
  mes: number;                 // 1-12
  anio: number;
  fecha_cierre: string;
  fecha_vencimiento: string;
  total_a_pagar_pesos: number;
  total_a_pagar_dolares: number;
  total_consumos_pesos: number;
  total_consumos_dolares: number;
  impuestos: {
    iva: number; sellos: number; iibb: number; percepciones: number;
    comisiones: number; impuesto_pais: number; otros: number; total_impuestos: number;
  };
  cantidad_movimientos: number;
  fecha_importacion: string;   // ISO string
}
```

### Movimiento (localStorage key: `tarjetas_movimientos`)
```typescript
{
  id: string;                  // `${resumen_id}-${idx}`
  resumen_id: string;          // `${tarjeta}-${anio}-${mes}`
  tarjeta: string;
  mes_resumen: number;
  anio_resumen: number;
  fecha_compra: string;        // YYYY-MM-DD
  referencia_original: string; // texto crudo del PDF
  referencia_limpia: string;   // después de aplicar reglas
  es_dudoso: boolean;          // nombre no reconocido
  sugerencias: string[];
  monto_pesos: number;
  monto_dolares: number;
  es_cuota: boolean;
  cuota_actual: number;        // ej: 2
  total_cuotas: number;        // ej: 6
  cuota_texto: string;         // ej: "2/6"
}
```

### Cuota formateada (usada en `cuotasActivas` state de App)
```typescript
{
  id: string;
  descripcion: string;         // referencia_limpia || referencia_original
  tarjeta: string;
  total_cuotas: number;
  cuotas_pagadas: number;      // = cuota_actual del movimiento
  cuotas_restantes: number;    // = total_cuotas - cuota_actual
  monto_cuota: number;         // monto_pesos || monto_dolares
  monto_cuota_pesos: number;
  monto_cuota_dolares: number;
  monto_total: number;
  es_ultima_cuota: boolean;
  fecha_compra: string;
}
```

### Tarjeta (localStorage key: `tarjetas_lista`)
```typescript
{
  id: number;
  nombre: string;              // ej: "VISA Galicia"
  tipo: string;                // "VISA" | "MASTERCARD" | "AMEX" | "CABAL" | "NARANJA"
  banco: string;               // ej: "Galicia"
  activa: boolean;
  // Enriquecida en App.jsx:
  ultimo_resumen: {
    total_a_pagar: number; total_a_pagar_dolares: number;
    total_consumos_pesos: number; total_consumos_dolares: number;
    fecha_cierre: string; fecha_vencimiento: string; mes: number; anio: number;
    cantidad_movimientos: number;
  } | null;
  estadisticas: {
    total_movimientos: number;
    compras_en_cuotas: number;
    monto_cuotas_pendientes: number;
    cantidad_cuotas: number;
  };
}
```

### Regla (localStorage key: `tarjetas_reglas`)
```typescript
{
  id: number;                  // Date.now()
  patron: string;              // regex o texto exacto
  nombre_limpio: string;
  fecha_creacion: string;
  veces_usado: number;
  es_exacta?: boolean;
}
```

---

## Gotchas críticos

### 1. Proyección de cuotas — criterio duplicado
En `App.jsx/fetchData` (líneas ~1537-1543):
```js
for (let i = 0; i < 6; i++) {  // i=0 = mes actual
  if (m.total_cuotas - m.cuota_actual >= i) totalMes += m.monto_pesos || 0;
}
```
En el panel de detalle del gráfico de barras:
```js
cuotasActivas.filter(c => c.cuotas_restantes >= i)
```
**Si se cambia el criterio en uno, hay que cambiarlo en el otro.**

### 2. Backend pierde datos al reiniciar
Todo el `db` está en RAM. Railway reinicia el servidor → hay que volver a subir PDFs. `localStorage` del browser es la fuente de verdad.

### 3. Único dato persistente del backend
`Backend/data/reglas-usuario.json` — se carga al arrancar y se guarda con cada `POST /reglas`. Si este archivo se borra, se pierden las reglas.

### 4. storage.getProyeccionCuotas() vs fetchData
`storage.getProyeccionCuotas()` empieza en `i=1` (no incluye mes actual). `fetchData` empieza en `i=0` (incluye mes actual). El dashboard usa fetchData, no `getProyeccionCuotas()`.

### 5. App.jsx es monolítico
~3443 líneas, un solo archivo. Todos los componentes están en scope global del módulo. Variables como `TARJETA_COLORS`, `BANK_THEMES`, `formatMonto()` son accesibles desde todos los componentes sin props.

### 6. Cotización `null` no rompe nada
Si `cotizacion === null`, el badge no se muestra y el equivalente ARS en `CreditCardVisual` tampoco. No hay error.

### 7. Resumen ID format
`id = "${tarjeta}-${anio}-${mes}"` — si se importa el mismo resumen dos veces, se sobreescribe (upsert). Los movimientos también se reemplazan.

---

## Cambios recientes (22/06/2026)

### StatCard "Cuotas Próximo Mes"
- Antes: mostraba total acumulado de cuotas futuras
- Ahora: `proyeccionCuotas[0]?.total || 0` (mes actual, i=0)

### Cotización USD en tiempo real
- API: `https://dolarapi.com/v1/dolares/tarjeta` + fallback bluelytics
- Cache 30 min en `'cotizacion_cache'`
- Badge en Dashboard: "💵 Dólar tarjeta: $X.XXX · HH:MM"
- CreditCardVisual: tarjetas USD muestran `≈ $X.XXX ARS`

### StatCard "Total últimos 2 resúmenes"
- 4ta StatCard del Dashboard: suma los 2 resúmenes más recientes por tarjeta
- Cálculo: `resumenes.filter(r => r.tarjeta === t.nombre).sort(...).slice(0,2).reduce(...)` usando `total_a_pagar_pesos` y `total_a_pagar_dolares`
- Toggle `+ USD→ARS`: convierte USD a ARS usando `cotizacion.venta` y muestra total combinado
- Estado: `resumenCombinado` (boolean) en `DashboardView`

### Gráfico de barras cuotas — interactivo
- Click en barra → toggle panel de detalle
- Barras no seleccionadas: opacity 0.4
- Texto: "X consumos en cuotas pendientes"
- Panel: desglose por cuota con badge de color por tarjeta

---

## Cómo correr en local

```bash
# Terminal 1
cd Backend && npm run dev    # localhost:3000

# Terminal 2
cd Frontend && npm run dev   # localhost:5173
```

### Variables de entorno

**Backend/.env:**
```
ANTHROPIC_API_KEY=sk-ant-...   # para Vision API
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**Frontend/.env.local:**
```
VITE_API_URL=http://localhost:3000
```

---

## Dependencias Backend
```json
{
  "@anthropic-ai/sdk": "^0.71.2",
  "canvas": "^3.2.1",
  "cors": "^2.8.5",
  "dotenv": "^16.6.1",
  "express": "^4.18.2",
  "multer": "^2.0.0",
  "mupdf": "^1.27.0",
  "pdf-parse": "^1.1.1",
  "sharp": "^0.34.5"
}
```
