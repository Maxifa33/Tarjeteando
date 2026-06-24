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

**Git / Deploy:** repo `github.com/Maxifa33/Tarjeteando`. Rama de trabajo: `develop`. **Producción deploya desde `main`** (Vercel + Railway via integración git, auto-deploy al pushear `main`). Flujo: commitear en `develop` → push → fast-forward `develop`→`main` → deploy. Railway healthcheck: `/api/v1/health`.

---

## Estructura de archivos

```
tarjetas-proyecto/
├── Frontend/
│   ├── src/
│   │   ├── App.jsx               ← monolítico, ~3553 líneas, TODOS los componentes
│   │   ├── index.css             ← CSS variables, temas claro/oscuro
│   │   └── services/
│   │       └── storage.js        ← ~422 líneas, helpers localStorage
│   ├── package.json
│   └── .env.local                ← VITE_API_URL
├── Backend/
│   ├── src/
│   │   ├── app.js                ← Express server + db en RAM
│   │   └── services/
│   │       ├── pdf-parser.service.js    ← 1464 líneas, parser por banco
│   │       ├── vision-parser.service.js ← 565 líneas, Claude Vision API
│   │       └── proyeccion.service.js    ← lógica pura de proyección de cuotas (anclada al período)
│   ├── tests/
│   │   ├── proyeccion.test.js    ← robustez al orden de subida (se saltea si faltan los PDFs)
│   │   └── fixtures/pdfs/        ← resúmenes reales de prueba — NO versionado (.gitignore, datos privados)
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
10. **`ConsumosLiveView`** — vista "Últimos consumos": importa XLSX/CSV de Galicia, stats, gráficos (gasto/día + categoría), lista filtrable, dedup por período
11. **`CSVColumnMapper`** — modal fallback para mapear columnas manualmente si el formato no se reconoce

### Servicio: consumos-parser.js (`Frontend/src/services/`)
Parser del export "Últimos consumos" de Galicia (XLSX jerárquico). **No es CSV plano.** Usa SheetJS (`xlsx`).
- `parseConsumosFile(arrayBuffer)` → `{ consumos, metadata, warnings, subtotales }` (wrapper browser)
- `parseRows(rows)` → mismo output, opera sobre matriz de filas (testeable en Node)
- `categorizarConsumo(descripcion)` → categoría por diccionario `CATEGORIAS_CONSUMO`
- `parsearMontoConsumo`, `normalizarFecha`, `parsearCuotas` → helpers exportados
- **Lógica clave:** forward-fill de fechas vacías, detección de tarjetas por "terminada en XXXX" (soporta múltiples por archivo), separación de pagos/devoluciones (`es_pago`), pendientes (`es_pendiente`), validación contra "Subtotal de..." excluyendo pagos y pendientes.
- **Validado** contra `Backend/tests/fixtures/Ultimos Consumos/` (Visa 3327 = 2 tarjetas, Amex 2017). Totales coinciden exacto con subtotales del Excel.

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
storage.getEvolucionMensual(6)  → setProyecciones  // ventana anclada al período del resumen más reciente
// Proyección de cuotas ANCLADA AL PERÍODO del resumen de cada tarjeta (NO a la fecha de hoy
// ni al orden de subida). Si la cuota N cae en el período P, la cuota N+k cae en P+k.
const ancla = max(período del último resumen de cada tarjeta);
for (let i = 0; i < 6; i++) {
  const fecha = ancla + (i + 1) meses;  // bucket 0 = mes siguiente al último resumen
  cuotasOrdenadas.forEach(m => {       // cuotasOrdenadas = orden determinístico (tarjeta, ref, ...)
    const diff = mesesEntre(períodoDeTarjeta(m), fecha);
    const numeroCuota = m.cuota_actual + diff;
    if (diff >= 1 && numeroCuota <= m.total_cuotas) { totalMes += m.monto_pesos; detalles.push({...}); }
  });
  total = Math.round(totalMes * 100) / 100;  // redondeo estable a 2 decimales
}
setProyeccionCuotas(proyeccionCalculada); // [{mes, mes_nombre, total, cantidad_cuotas, detalles[]}]
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

**StatCards del Dashboard** (grid `lg:grid-cols-4`, en orden real en el código):
1. **Gastos Fijos** — `totalFijos` (movimientos del último período, clasificados fijos)
2. **Cuotas Activas** — `dashboard.cuotas_activas`
3. **Cuotas Próximo Mes** — `proyeccionCuotas[0]?.total || 0` (mes siguiente al último resumen, no la fecha de hoy)
4. **Total a pagar · {mes}** — suma de `total_a_pagar` (ARS+USD) de los resúmenes cuyo `fecha_vencimiento` cae en `mesRef` (el vencimiento más reciente); ver sección "Cambios recientes". Toggle `+ USD→ARS`.

**Gráfico de barras proyección cuotas:**
- Estado: `mesDetalleIdx` (null = ninguno seleccionado)
- Click en barra → toggle `mesDetalleIdx`
- Barras no seleccionadas: `opacity 0.4`
- Texto bajo barra: "X consumos en cuotas pendientes"
- Panel de detalle expandible: lee directo de `proyeccionCuotas[i].detalles` (cada uno con `cuota_numero`, `total_cuotas`, `tarjeta`, `monto_cuota`). Ya NO recomputa con un criterio aparte → fuente única.

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
  CONSUMOS_LIVE: 'tarjetas_consumos_live', // ConsumoLive[] — consumos pre-resumen (XLSX)
  VERSION:    'tarjetas_version'      // '1.1.0'
};
// Keys externas (manejadas fuera de storage.js):
// 'cotizacion_cache'     → {venta, compra, nombre, fechaActualizacion, cachedAt}
// 'onboarding_completed' → boolean
// 'theme'               → 'dark'|'light'
// 'nombresTarjetas'     → {[nombre]: alias}
// 'dashboard_card_order' → string[] — orden manual de las stat cards del Dashboard
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
storage.getEvolucionMensual(meses=6)            // evolución mensual pesos, ventana anclada al período más reciente
storage.getConsumosLive()                       // → ConsumoLive[]
storage.saveConsumosLive(nuevos)                // merge por id (dedup hash), no duplica
storage.deleteConsumosLive(tarjeta?)            // borra de una tarjeta o todos
```

**Consumos live (`tarjetas_consumos_live`)** están incluidos en `exportAll()` (key `consumosLive`), `importAll()` (merge por id) y `clearAll()`.

**Nota:** `getEvolucionMensual()` ya NO se ancla a la fecha de hoy. Toma el período del resumen más reciente (`max(anio, mes)`) y muestra los últimos `meses` meses terminando ahí, así los resúmenes recientes siempre aparecen aunque sean de meses anteriores a hoy. `getProyeccionCuotas()` fue **eliminado** (estaba muerto y su criterio era inconsistente); la proyección vive en `fetchData` (frontend) y en `proyeccion.service.js` (backend).

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
GET    /cuotas/proyeccion        ← proyección anclada al período (usa proyeccion.service.js)
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

## Backend — proyeccion.service.js

Lógica pura y testeable de la proyección de cuotas. **Invariante: se ancla SIEMPRE al período del resumen donde aparece cada cuota (`fecha_ultima_cuota`), nunca a la fecha de hoy ni al orden de subida.**

```js
proyectarCuotas(cuotasActivas, meses = 6, hoy = new Date())
// - Ordena las cuotas determinísticamente (tarjeta, referencia, total_cuotas, monto) → el orden
//   de subida no afecta ni el detalle ni el total (ruido de punto flotante).
// - Ancla = período del resumen más reciente entre las cuotas activas.
// - Bucket i = ancla + (i + 1) meses. numeroCuota = cuota_actual + mesesEntre(período, bucket).
//   Incluye la cuota si diff >= 1 y numeroCuota <= total_cuotas.
// - total redondeado a 2 decimales (Math.round(x*100)/100).
// Returns: [{ mes, mes_nombre, total, cantidad_cuotas, detalles:[{referencia,tarjeta,cuota,monto}] }]
```

El endpoint `GET /cuotas/proyeccion` lo usa con `db.comprasCuotas`. El frontend (`fetchData`) implementa la misma lógica sobre los movimientos del último resumen de cada tarjeta (no puede importar el módulo del backend; arquitectura separada). Tests: `Backend/tests/proyeccion.test.js`.

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

### ConsumoLive (localStorage key: `tarjetas_consumos_live`)
```typescript
{
  id: string;                  // hash base64(tarjeta+fecha+descripcion+montos+comprobante)
  tarjeta: string;             // 'Visa 3327' / 'Amex 2017' (tipo + últimos 4)
  tarjeta_ult4: string;        // '3327'
  fecha: string;               // YYYY-MM-DD (forward-filled si venía vacío)
  descripcion: string;
  comprobante: string;
  cuotas_texto: string;        // '2 de 3' o ''
  es_cuota: boolean;
  cuota_actual: number | null;
  total_cuotas: number | null;
  monto_pesos: number;         // negativo = devolución/pago
  monto_dolares: number;
  categoria: string;           // de categorizarConsumo()
  es_pago: boolean;            // 'Su pago' o sección pagos → excluir del gasto
  es_pendiente: boolean;       // comprobante '-' o 'Pendiente'
  fecha_importacion: string;   // ISO
}
```

---

## Gotchas críticos

### 1. Proyección de cuotas — anclada al período (RESUELTO el orden de subida)
La proyección se ancla al **período del resumen** de cada tarjeta, no a la fecha de hoy ni al orden de subida. El criterio ya **no está duplicado**: `fetchData` construye `proyeccionCuotas[i].detalles` y el panel del gráfico lee de ahí (fuente única). El backend usa `proyeccion.service.js` con la misma fórmula.
**Si tocás la fórmula, hay 2 copias inevitables (front no importa del back):** `App.jsx/fetchData` y `Backend/src/services/proyeccion.service.js` — mantenelas en sync.

### 2. Backend pierde datos al reiniciar
Todo el `db` está en RAM. Railway reinicia el servidor → hay que volver a subir PDFs. `localStorage` del browser es la fuente de verdad.

### 3. Único dato persistente del backend
`Backend/data/reglas-usuario.json` — se carga al arrancar y se guarda con cada `POST /reglas`. Si este archivo se borra, se pierden las reglas.

### 4. getEvolucionMensual: ventana anclada al período más reciente
`storage.getEvolucionMensual()` muestra los últimos N meses **terminando en el período del resumen más reciente**, no en la fecha de hoy. Así un resumen viejo de una tarjeta recién cargada siempre aparece en el gráfico. (`getProyeccionCuotas()` fue eliminado.)

### 4b. Consumos live son INDEPENDIENTES de resúmenes/cuotas
`ConsumosLiveView` y `tarjetas_consumos_live` NO tocan `db`, `resumenes`, `movimientos`, `cuotasActivas` ni `proyeccionCuotas`. El "dedup por período" (toggle "Ocultar ya facturados") solo **filtra la vista**: oculta consumos con `fecha <= fecha_cierre` del último resumen de esa tarjeta (match por últimos 4 dígitos). Nunca borra datos. Requiere `xlsx` (SheetJS) en Frontend/package.json.

### 5. App.jsx es monolítico
~4000 líneas, un solo archivo. Todos los componentes están en scope global del módulo. Variables como `TARJETA_COLORS`, `BANK_THEMES`, `formatMonto()` son accesibles desde todos los componentes sin props.

### 6. Cotización `null` no rompe nada
Si `cotizacion === null`, el badge no se muestra y el equivalente ARS en `CreditCardVisual` tampoco. No hay error.

### 7. Resumen ID format
`id = "${tarjeta}-${anio}-${mes}"` — si se importa el mismo resumen dos veces, se sobreescribe (upsert). Los movimientos también se reemplazan.

---

## Cambios recientes (22-23/06/2026)

### Dashboard: stat cards compactas, reordenables + card "Últimos consumos"
- **Nueva card** "Últimos consumos" (icon Zap, leftmost por default): muestra gasto live en ARS + USD (`consumosLive` filtrado por `!es_pago`, solo montos positivos). Click → vista consumos-live.
- **Layout:** las 5 cards ahora en **una fila** flex (`flex flex-wrap lg:flex-nowrap`), cada una con ancho variable según `weight` (`flexGrow` + `flexBasis:0`). Usan `.stat-card-sm` (variante compacta en index.css).
- **Reordenables:** drag & drop nativo (grip icon en hover). Orden persistido en localStorage `dashboard_card_order`. `moveCard(dragId, targetId)` + estado `cardOrder` en `DashboardView`. Default: `['live','fijos','cuotasActivas','cuotasProx','totalPagar']` (const `DEFAULT_CARD_ORDER`).
- `DashboardView` recibe nueva prop `consumosLive`.

### Feature: "Últimos consumos" (consumos pre-resumen, XLSX)
- **Nueva sección** en sidebar (icon Zap, entre Movimientos y Cuotas). Independiente de resúmenes/cuotas.
- **Parser nuevo:** `Frontend/src/services/consumos-parser.js` — formato "Últimos consumos" de Galicia (XLSX jerárquico). Usa SheetJS (`xlsx` agregado a package.json).
- Maneja: forward-fill de fechas, múltiples tarjetas por archivo, cuotas "X de Y", pagos/devoluciones (negativos), pendientes. Categorización rule-based.
- **Vista:** StatCards (total gastado, USD, % vs último cierre, cantidad), gráficos (gasto/día + pie por categoría), lista filtrable, toggle "Ocultar ya facturados" (dedup por período).
- **storage.js:** key `tarjetas_consumos_live` + `getConsumosLive/saveConsumosLive/deleteConsumosLive`.
- **Validado** contra fixtures reales (Visa 3327 = 2 tarjetas, Amex 2017): totales coinciden exacto con subtotales del Excel.
- **Pendiente del usuario:** correr `cd Frontend && npm install` (agrega `xlsx`).

### Fix: orden de subida no influye en cálculos (anclaje al período)
- **Problema real:** la proyección de cuotas y la ventana del gráfico se anclaban a `new Date()` (hoy), no al período del resumen → con resúmenes viejos los meses NN/MM salían corridos y el gráfico mostraba todo en $0. (Las sumas mensuales ya eran order-independent; el orden de subida no las afectaba.)
- **Fix:**
  - `App.jsx/fetchData`: proyección anclada al período del último resumen de cada tarjeta; bucket 0 = mes siguiente. Lleva `detalles[]` por mes (el panel del gráfico ya no recomputa). Orden determinístico + redondeo a 2 decimales.
  - `storage.getEvolucionMensual`: ventana anclada al período más reciente (no a hoy). `getProyeccionCuotas` eliminado (muerto).
  - Backend: `proyeccion.service.js` (lógica pura) + endpoint `/cuotas/proyeccion` refactorizado.
  - Tests: `tests/proyeccion.test.js` (11) — verifican order-independence al centavo con PDFs reales.
- **Pre-existente (no tocado):** `tests/api.test.js` falla porque `app.js` no exporta `app` y hace `app.listen` al importarse; `tests/parser.test.js` tiene 4 fallos de detección/limpieza.

### StatCard "Cuotas Próximo Mes"
- Antes: mostraba total acumulado de cuotas futuras
- Ahora: `proyeccionCuotas[0]?.total || 0` (mes siguiente al período del último resumen)

### Cotización USD en tiempo real
- API: `https://dolarapi.com/v1/dolares/tarjeta` + fallback bluelytics
- Cache 30 min en `'cotizacion_cache'`
- Badge en Dashboard: "💵 Dólar tarjeta: $X.XXX · HH:MM"
- CreditCardVisual: tarjetas USD muestran `≈ $X.XXX ARS`

### StatCard "Total a pagar · {mes}"
- 4ta StatCard del Dashboard. Representa **lo que hay que reservar del sueldo para pagar las tarjetas este mes**.
- Se agrupa por **mes de `fecha_vencimiento`**, NO por el último resumen cargado de cada tarjeta (evita mezclar vencimientos de meses distintos si el usuario no cargó el mismo mes para todas).
- `mesRef` = mes (`YYYY-MM`) del `fecha_vencimiento` **más reciente** entre TODOS los resúmenes (opción A). `mesVencimiento(r)` usa `fecha_vencimiento` → fallback `fecha_cierre` → fallback período (`anio`/`mes`).
- Suma `total_a_pagar_pesos` / `total_a_pagar_dolares` solo de `resumenes.filter(r => mesVencimiento(r) === mesRef)`. Los resúmenes de meses previos y las tarjetas sin resumen de ese mes **se desestiman**.
- Subtítulo muestra el mes (`mesRefLabel`) para que la mezcla de meses sea visible.
- Toggle `+ USD→ARS`: convierte USD a ARS usando `cotizacion.venta` y muestra total combinado. Estado: `resumenCombinado` (boolean) en `DashboardView`.

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
