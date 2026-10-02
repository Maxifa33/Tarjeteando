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

Post-rediseño B+C (fases 0–7, rama `feat/rediseno-bc`).

```
tarjetas-proyecto/
├── Frontend/
│   ├── src/
│   │   ├── App.jsx               ← estado global, handlers, ruteo; Ajustes, Importar y Reglas
│   │   ├── index.css             ← importa ui/tokens.css; clases mínimas de vistas secundarias
│   │   ├── novedades.js          ← APP_VERSION, NOVEDADES por versión y GUIA (mini manual)
│   │   ├── views/                ← MesView, TarjetasView, MovimientosView, CuotasView, Guia, Onboarding
│   │   ├── ui/                   ← tokens.css, AppShell, Rail, Hoja, Seg, CampoDeLuz, Capsula,
│   │   │                            EvolucionChart, DetalleMes, MiniHistorial, Plastico, PilaWallet,
│   │   │                            FilaMovimiento, DetalleMovimiento, LineaDeTiempoPlanes,
│   │   │                            DetallePlan, identidad.js, formato.js, useCompacto.js
│   │   └── services/             ← cálculos puros con tests (`npm test`)
│   │       ├── storage.js        ← localStorage (1.4.0) + migraciones idempotentes
│   │       ├── migraciones.js    ← 1.4.0, período de resúmenes, decisiones de planes
│   │       ├── cuotas.js         ← ÚNICA calculadora de cuotas (planes, identidad, en curso)
│   │       ├── mes.js            ← ciclo de pago, cuotasDelMes, composición, tope
│   │       ├── evolucion.js      ← gráfico Evolución (pagado / en curso / comprometido)
│   │       ├── tarjetas.js       ← qué muestra cada plástico, nombres personalizados
│   │       ├── movimientos-vista.js ← filtros, días, historial de comercio, consumos en curso
│   │       ├── planes-vista.js   ← línea de tiempo y cifras de Cuotas
│   │       ├── series.js         ← IDs SHA-256, cadenas de gastos fijos, overrides, preguntas
│   │       ├── apariencia.js     ← modo de color / reducir transparencia
│   │       ├── consumos-parser.js
│   │       └── consumos/         ← lectores de Últimos consumos y ciclos (ciclos.js, live.js…)
│   ├── package.json
│   └── .env.local                ← VITE_API_URL
├── Backend/
│   ├── src/
│   │   ├── app.js                ← Express server + db en RAM
│   │   └── services/
│   │       ├── pdf-parser.service.js    ← parser por banco (devuelve comprobante)
│   │       └── vision-parser.service.js ← Claude Vision API
│   ├── tests/
│   │   ├── parser.test.js
│   │   ├── fixtures-regresion.test.js ← re-parsea los 40 PDFs reales, totales al centavo
│   │   └── fixtures/pdfs/        ← resúmenes reales de prueba — NO versionado (datos privados)
│   ├── data/
│   │   └── reglas-usuario.json   ← ÚNICO archivo persistente del backend
│   ├── package.json
│   └── .env                      ← ANTHROPIC_API_KEY, PORT, FRONTEND_URL
├── rediseno-2026/                ← specs y prototipos del rediseño
├── references/
│   └── contexto-tarjeteando.md  ← este archivo
└── CLAUDE.md                     ← instrucciones para Claude Code
```

---

## Frontend — App.jsx y vistas

Desde el rediseño B+C, `App.jsx` conecta estado y handlers; la UI de cada sección vive
en `src/views/` y los cálculos en `src/services/`. **Código nuevo fuera de `App.jsx`.**
Ya no existen `DashboardView`, las StatCards, `CreditCardVisual`, `ConsumosLiveView`
ni la proyección dentro de `fetchData`.

- **Secciones:** Mes (`MesView`), Tarjetas (`TarjetasView`), Movimientos
  (`MovimientosView`, incluye los Últimos consumos en curso), Cuotas (`CuotasView`).
  `activeView` sigue siendo la fuente de verdad ('dashboard' = Mes).
- **fetchData** lee todo de localStorage (`storage.*`), aplica las reglas de nombres y
  arma los planes con `construirPlanes(movimientos, resumenes, decisiones, { enCurso })`,
  donde `enCurso = observacionesEnCurso({ consumosLive, ciclosLive, tarjetas })`.
  `setCuotasActivas(formatearParaVista(planes))` es lo único que guarda planes.
- **refrescarLive** (importar / borrar / asignar banco a Últimos consumos) recalcula los
  planes con la última base de `fetchData` (ref `basePlanesRef`), sin recargar todo.
- Mes, Evolución, Tarjetas y Cuotas usan `cuotasDelMes` (services/mes.js): meses de
  PAGO (período de cierre + `desfase` de la tarjeta).

### Servicio: consumos-parser.js (`Frontend/src/services/`)
Parser del export "Últimos consumos" de Galicia/Santander/Amex (XLSX jerárquico). Usa SheetJS (`xlsx`).
Cada consumo trae `comprobante`, `es_cuota`, `cuota_actual`, `total_cuotas`, `es_pago`,
`grupo_key` y `ciclo_cierre` (después de `aplicarArchivo`). Macro y genérico: `consumos/`.

### Cotización dólar tarjeta
```js
// useEffect en App, cache 30 min en localStorage key: 'cotizacion_cache'
fetch('https://dolarapi.com/v1/dolares/tarjeta')  // primario
// Fallback: 'https://api.bluelytics.com.ar/v2/latest'
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
  TIPO_OVERRIDES: 'tarjetas_tipo_overrides',   // [{mov_id, tipo, desde:'YYYY-MM', tipo_previo, origen_previo, creado}]
  DECISIONES_FIJOS: 'tarjetas_decisiones_fijos', // [{tipo:'enlace'|'no_enlace'|'baja'|'sigue'|'omitida'|'respondida', mov_id, prev_id?, periodo?, creado}]
  METRICAS_DETECTOR: 'tarjetas_metricas_detector', // {correcciones, a_fijo, a_variable, preguntas_respondidas}
  VERSION:    'tarjetas_version'      // '1.2.0' (1.2.0 = migración a ID hash)
};
// Keys externas (manejadas fuera de storage.js):
// 'cotizacion_cache'     → {venta, compra, nombre, fechaActualizacion, cachedAt}
// 'onboarding_completed' → boolean
// 'theme'               → 'dark'|'light'
// 'nombresTarjetas'     → {[nombre]: alias}
// 'dashboard_card_order' → string[] — orden manual de las stat cards del Dashboard
// 'novedades_version_vista' → APP_VERSION cuyo modal de Novedades ya se mostró
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
storage.getTipoOverrides() / saveTipoOverride(o) // cambios manuales Fijo/Variable (uno por mov_id)
storage.getDecisionesFijos() / saveDecisionFijo(d) // respuestas a las preguntas de fijos
storage.getMetricasDetector() / registrarMetrica(campo) // tasa de corrección del detector
```

`saveMovimientos` asigna el ID con `asignarIds()` de series.js. Overrides, decisiones y
métricas van en `exportAll()`/`importAll()`; `importAll` normaliza backups viejos al ID hash.

**Consumos live (`tarjetas_consumos_live`)** están incluidos en `exportAll()` (key `consumosLive`), `importAll()` (merge por id) y `clearAll()`.

**Nota:** `getEvolucionMensual()` ya NO se ancla a la fecha de hoy. Toma el período del resumen más reciente (`max(anio, mes)`) y muestra los últimos `meses` meses terminando ahí, así los resúmenes recientes siempre aparecen aunque sean de meses anteriores a hoy. `getProyeccionCuotas()` fue **eliminado**; la proyección vive en `services/cuotas.js` + `cuotasDelMes` (mes.js).

**Migraciones idempotentes en cada carga** (y después de `importAll`): `migrarPeriodoResumenes`
corrige `anio/mes` de resúmenes guardados con el corrimiento de zona horaria del parser viejo
(cierre del día 1 en el mes anterior) y `anio_resumen/mes_resumen` de sus movimientos, sin
cambiar ids; `migrarDecisionesPlanes` copia las decisiones con clave vieja a `<clave>#1`.

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

## Backend — proyeccion.service.js (eliminado)

Se borró el 14/09/2026 junto con `db.comprasCuotas` y `/api/v1/cuotas/*`. La única
calculadora de cuotas es `Frontend/src/services/cuotas.js` (ver Gotchas → 1).

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
  id: string;                  // 'mv_' + 24 hex de SHA-256(resumen_id|fecha|ref_original|cuota|pesos|usd#n)
                               // (el comprobante NO entra en el hash: los ids guardados no cambian)
  resumen_id: string;          // `${tarjeta}-${anio}-${mes}`
  tarjeta: string;
  mes_resumen: number;         // mes de CIERRE del resumen (del string fecha_cierre)
  anio_resumen: number;
  fecha_compra: string;        // YYYY-MM-DD
  referencia_original: string; // texto crudo del PDF
  referencia_limpia: string;   // después de aplicar reglas
  comprobante: string | null;  // crudo, tal cual el PDF ('008547'); null si el banco no lo trae
                               // o el resumen se importó antes de 10/2026
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

Comprobante por banco: Galicia Visa 6 dígitos (en su línea o pegado al monto), Galicia
Master 5, Santander y Amex 6 (columna antes del marcador `*`/`K`), BBVA 6 (cupón), compras
en USD pegado al importe. Macro (Vision): null salvo que venga en la respuesta.

### Plan formateado (`cuotasActivas` en App = `formatearParaVista(construirPlanes(...))`)
```typescript
{
  id: string;                  // id del movimiento (u observación) más reciente del plan
  clave: string;               // identidad: 'tarjeta|c:<comprobante>' o '<clave base>#<k>'
  alias: string[];             // todas las claves con las que se vio (las decisiones usan cualquiera)
  descripcion: string;         // referencia_limpia || referencia_original
  tarjeta: string;             // nombre, o 'live:<grupoKey>' si solo existe por Últimos consumos
  tarjeta_label: string|null;  // banco + red para las tarjetas live:
  total_cuotas: number;
  cuotas_pagadas: number;      // = cuota_actual
  cuotas_restantes: number;
  monto_cuota: number; monto_cuota_pesos: number; monto_cuota_dolares: number;
  monto_total: number;
  es_ultima_cuota: boolean;
  fecha_compra: string;
  estado: 'vigente'|'ultima_cuota'|'terminada'|'interrumpida';
  interrumpida: boolean;
  periodo_anio: number; periodo_mes: number;   // ancla del plan (mes de cierre)
  origen: 'en_curso'|null;     // el plan avanzó (o nació) con Últimos consumos
  cuota_resumen, periodo_resumen_anio, periodo_resumen_mes; // ancla del último resumen si avanzó
  motivo: 'decision_usuario'|null; decision: 'terminado'|'vigente'|null;
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
  es_clave?: boolean;          // patron = claveComercio(referencia_original); la crea el usuario al renombrar
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

### 0. NUNCA usar `new Date('YYYY-MM-DD')` para fechas del parser
`fecha_compra` / `fecha_cierre` son **fechas de calendario sin hora**. `new Date('2026-08-10')` las lee como medianoche **UTC** y en Argentina (UTC-3) muestra el 09/08; además un consumo del día 1 caía en el mes anterior al agrupar. Usar siempre `parseFechaLocal()` / `mesKeyDeFecha()`. El patrón viejo `+ 'T12:00:00'` también funciona y sigue vivo en algunos renders.

### 1. Cuotas — UNA sola calculadora: `Frontend/src/services/cuotas.js`
`construirPlanes`, `observacionesEnCurso`, `formatearParaVista`, `normalizarComprobante`,
`idDePlan` (y `proyectarCuotas` / `totalPendiente`, hoy solo en tests). `App.jsx` solo la
llama; Mes, Evolución, Tarjetas y Cuotas leen los planes con `cuotasDelMes` (mes.js). El
motor viejo del backend se eliminó. Si tocás la fórmula, hay un solo lugar.

**Período:** un resumen es del mes de su CIERRE (`resumen.anio/mes`, del string
`fecha_cierre`; el parser y la migración de storage nunca usan `new Date`). Las
observaciones en curso usan el mismo criterio con `ciclo.fecha_cierre`.

### 1a. Identidad del plan
- **ID = tarjeta + comprobante normalizado** (`tarjeta|c:9872`): solo dígitos, sin ceros
  a la izquierda (`'009872'` = `'00009872'`); vacío o solo ceros = sin comprobante.
- **Sin comprobante:** clave base (`tarjeta|nombre|total|monto/1000`) + ocurrencia `#k`
  dentro del mismo resumen, numerada por (fecha_compra, id). **Compras idénticas son
  planes distintos**, y el `#k` de un mes empalma con el `#k` del siguiente.
- **Compatibilidad:** un resumen viejo sin comprobante y uno nuevo con comprobante de la
  misma compra se unen por clave base + cuota esperada (cuota_actual + diferencia de
  períodos). Nunca dos planes para la misma compra. `plan.alias` guarda todas las claves.
- La misma compra dos veces en un resumen (puesta al día, ej. Sony 02/03 y 03/03 con el
  mismo comprobante): gana la cuota más alta.
- Nunca se empareja por nombre de comercio: las reglas de nombres lo cambian.
- Decisiones (`tarjetas_decisiones_planes`): las guardadas con clave vieja (sin `#` ni
  `|c:`) se copian a `<clave>#1` en cada carga (migración idempotente; la original queda).

### 1b. Estado y anclaje
Cada plan se ancla al período donde se lo vio por última vez. `estado`:

| estado | significado |
|---|---|
| `vigente` | quedan cuotas y el banco las factura |
| `ultima_cuota` | la última cuota es la del período más reciente de la tarjeta |
| `terminada` | terminó antes (o el usuario lo dio por terminado: `motivo 'decision_usuario'`) |
| `interrumpida` | quedan cuotas pero un resumen posterior de la tarjeta no lo facturó ("a revisar"; no se proyecta) |

`interrumpida` sale **solo de resúmenes** (`ultimoPeriodoPorTarjeta`): un plan que no
aparece en Últimos consumos no se marca interrumpido. Caso validado: Easy Warnes (VISA GAL
Jul→Ago 2026) contra el "Cuotas a vencer" del banco, al centavo.

### 1c. Observaciones en curso (Últimos consumos)
`observacionesEnCurso({ consumosLive, ciclosLive, tarjetas })`: consumos `es_cuota` (no
pagos, no 1/1) del ciclo vigente de cada grupo que no esté `conciliado`. Forma de
movimiento con `origen 'en_curso'`; tarjeta = la de storage que empareja por banco + red
(`cicloEsDeTarjeta`), o `live:<grupoKey>`.

En `construirPlanes(..., { enCurso })`, después de armar los planes con resúmenes:
1. Empareja por comprobante normalizado (misma tarjeta); si no, por tarjeta + total de
   cuotas + cuota esperada + monto (pesos: |dif| ≤ max(1%, $100); USD: ≤ 0,01). Una
   observación por plan y por período: dos idénticas avanzan dos planes distintos.
2. Período posterior al del plan → el plan avanza (`cuota_actual`, período, `origen
   'en_curso'`; mantiene nombre y referencia del resumen y guarda su ancla del resumen en
   `cuota_resumen`/`periodo_resumen_*`). **Mismo período → gana el resumen.**
3. Sin plan: se crea solo si es la cuota 1 o la tarjeta no tiene resúmenes (Macro,
   Amex solo con Últimos consumos), y nunca si un resumen ya cubre ese período. El resto
   va a `sinEmparejar` (`sinEmparejarDe(planes)`, para debug) y no se proyecta.
4. Sin `enCurso`, la salida es idéntica a la de antes.

Los resúmenes, sus movimientos y las columnas "pagado" de Evolución no se tocan:
`cuotasDelMes` usa el ancla del resumen para los meses anteriores al período en curso.
El total del Mes no cambia (el total de Últimos consumos ya incluye las cuotas): una
compra 1/N solo pasa de variables a cuotas. Los ítems de planes `live:` usan el grupoKey,
igual que Mes. DetallePlan muestra "Actualizado con Últimos consumos · se confirma con
el próximo resumen".

### 2. Backend pierde datos al reiniciar
Todo el `db` está en RAM. Railway reinicia el servidor → hay que volver a subir PDFs. `localStorage` del browser es la fuente de verdad.

### 3. Único dato persistente del backend
`Backend/data/reglas-usuario.json` — se carga al arrancar y se guarda con cada `POST /reglas`. Si este archivo se borra, se pierden las reglas.

### 4. getEvolucionMensual: ventana anclada al período más reciente
`storage.getEvolucionMensual()` muestra los últimos N meses **terminando en el período del resumen más reciente**, no en la fecha de hoy. Así un resumen viejo de una tarjeta recién cargada siempre aparece en el gráfico. (`getProyeccionCuotas()` fue eliminado.)

### 4b. Últimos consumos: provisionales, nunca pisan un resumen
`tarjetas_consumos_live` NO toca `resumenes` ni `movimientos`. Sus cuotas sí entran a los
planes como **observaciones en curso** (Gotchas → 1c): actualizan el estado del plan,
nunca lo que cerró un resumen, y en el mismo período gana el resumen. En Movimientos se
ven como filas `origen 'en_curso'` (`movimientosEnCurso`), excluyendo los ciclos que ya
cubre un resumen. Requiere `xlsx` (SheetJS) en Frontend/package.json.

### 5. App.jsx sigue siendo grande
Estado global + Ajustes, Importar y Reglas. Las secciones viven en `src/views/` y los
cálculos en `src/services/`; no agregar UI nueva en `App.jsx`.

### 6. Cotización `null` no rompe nada
Si `cotizacion === null`, el badge no se muestra y el equivalente ARS en `CreditCardVisual` tampoco. No hay error.

### 6b. Gastos fijos: series encadenadas por ID (services/series.js)
**Bug que lo motivó (24/09/2026):** renombrar un fijo lo pasaba a variable. El detector
agrupaba por `referencia_limpia` (el nombre visible), la edición solo renombraba los
movimientos con `referencia_original` idéntica (Apple/Netflix/Claude traen un código de
factura distinto cada mes) y el Set de fijos (nombres) no se recalculaba.

Modelo actual (tomado de Bitcoin, solo hash + encadenamiento):
- **ID de movimiento** = `mv_` + SHA-256 del contenido (`asignarIds`). Re-subir un resumen da los mismos IDs.
- **claveComercio(referencia_original)**: descripción sin códigos variables (tokens con dígitos 5+, numéricos 3+, mayúsc/minúsc mezcladas 6+, 7+ letras con ≤1 vocal). `'APPLE.COM/BILL MVGLV3QHY'` → `'apple com bill'`.
- **Cadena (serie)**: por comercio+moneda+tarjeta, cada cargo se engancha al de la cadena abierta más parecido si está a **±25% del eslabón ANTERIOR** (la inflación no la corta); puede saltear hasta 2 resúmenes. Cada movimiento sabe su `serie_id` y `prev_id`. Así Apple 4,99 (suscripción) y las compras sueltas en Apple son cadenas distintas.
- **Clasificación por cadena**: ≥3 meses, presencia ≥0.6, importe repetido ≥60% o variación mediana ≤10% (fijo) / ≤25% (recurrente). Si el comercio tiene >1,5 compras/mes o es un rubro de consumo (combustible, apps de viaje, súper, delivery, peajes: `RUBROS_DE_CONSUMO`), solo cuenta el importe repetido. Sin cargo 2 resúmenes seguidos ⇒ `finalizado`.
- **Override manual** (desplegable de la columna Tipo): vale desde el período de ese movimiento hacia adelante para toda su serie; gana el `desde` más reciente ≤ período. El detector ya no toca esos meses.
- **Preguntas** (`preguntasPendientes`): fijo ausente en el último resumen de su tarjeta. Con cargo del mismo comercio fuera de rango ⇒ "¿es el mismo?" (1 o 2 resúmenes de ausencia); sin cargo ⇒ "¿lo diste de baja?" (solo en la 1ª ausencia). Respuestas en `tarjetas_decisiones_fijos`; si no responde, la regla automática decide.
- **Renombrar** crea una regla `es_clave` y aplica a todos los movimientos de esa clave; no afecta el tipo.

Sobre las fixtures: Zurich, Federación Patronal, Personal, Swiss Medical, Claude AI, Netflix, Apple 4,99 y Apple 9,99 (USD). Club Independiente genera la pregunta de aumento ($32.000 → $68.000). Sin falsos fijos de YPF/DiDi/Rappi.

### 6c. Marcadores de fila Galicia: solo `*` y `K`
El regex era `([*KVEU]?)` y se comía la primera letra de comercios que empiezan con V/E/U: `VENTI TICKETS`→`ENTI TICKETS`, `VITAL SUPERMAYORISTA`→`ITAL...`, `EXPRESS SAN MARTIN`→`XPRESS...`. Las reglas `ital\s*super` y `carpuride` de `cargarReglasLimpieza` eran parches de ese bug. Ahora es `([*K]?)`: si V/E/U eran marcador real quedan como prefijo y las reglas los absorben por substring (`VTemu.com`→`Temu`).

### 6d. `capitalizar()` no se aplica a nombres canónicos
Si una regla (o `extraerNombreMerpago`) ya devolvió el nombre final, capitalizar lo rompía: `Claude AI (Anthropic)`→`Claude Ai (anthropic)`, `OSDE`→`Osde`. Ahora solo se capitaliza el texto crudo del banco.

### 6e. BBVA imprime "TOTAL CONSUMOS DE <titular>" dos veces
Una en el consolidado de la página 1 y otra al cierre del detalle. El `while` acumulador las sumaba ⇒ `total_consumos_pesos` al doble. Se deduplica por texto del match, salvo cuando lleva prefijo `TARJETA NNNN` (multi-tarjeta legítimo de Macro).

### 7. Resumen ID format
`id = "${tarjeta}-${anio}-${mes}"` — si se importa el mismo resumen dos veces, se sobreescribe (upsert). Los movimientos también se reemplazan.

---

## Cambios recientes (24/09/2026) — series de gastos fijos, Tipo editable, Novedades y Guía
Rama `feat/series-gastos-fijos`.
- Fix: renombrar un fijo lo pasaba a variable (ver 6b).
- ID SHA-256 por movimiento + cadenas de suscripción (`services/series.js`). Migración de localStorage a 1.2.0.
- Columna Tipo en Movimientos: desplegable Fijo/Variable (`TipoGastoSelector`, menú en portal).
- `PreguntasFijosCard` en Dashboard y en Importar tras subir resúmenes.
- `NovedadesModal` (una vez por versión) y vista `Guía` en el menú. Contenido en `Frontend/src/novedades.js`.
- **Regla de trabajo:** cada feature que cambie el uso de la app sube `APP_VERSION`, agrega su entrada en `NOVEDADES` y actualiza `GUIA`.
- No hace falta volver a subir resúmenes: la migración re-identifica los movimientos guardados.

## Cambios recientes (04/09/2026) — auditoría de parsing y cuotas

Rama `fix/auditoria-parser-cuotas-2026-09`. 9 bugs detectados corriendo el parser contra las 40 fixtures reales:

| # | Sev | Bug | Fix |
|---|---|---|---|
| 1 | P0 | Todas las fechas se mostraban 1 día antes; los consumos del día 1 caían en el mes anterior | `parseFechaLocal` / `mesKeyDeFecha` en App.jsx (9 usos) |
| 2 | P0 | Las cuotas se leían solo del último resumen: un plan no refacturado desaparecía | Planes desde TODOS los resúmenes + ancla por plan + flag `interrumpida` |
| 3 | P1 | `([*KVEU]?)` se comía la primera letra del comercio | `([*K]?)` |
| 4 | P1 | BBVA duplicaba `total_consumos_pesos` (×2) | dedupe de matches repetidos |
| 5 | P2 | La regla `easy` exigía la palabra "home" | `easy\.com|\beasy\b` |
| 6 | P2 | `capitalizar()` rompía los nombres canónicos de las reglas | solo capitaliza texto crudo |
| 7 | P2 | Cuotas en USD proyectaban $0 | se pesifican con `cotizacion.venta` |
| 8 | P2 | Filtros desde/hasta mezclaban UTC y hora local | `parseFechaLocal` |
| 9 | P2 | Gastos fijos: solo detectaba 1 (ver 6b) | criterio nuevo, 8 detectados |

**Resuelto (bug 9):** el motor de cuotas del backend se eliminó y la calculadora quedó
en `Frontend/src/services/cuotas.js`, con tests propios. Endpoints dados de baja:
`GET /api/v1/cuotas/activas`, `GET /api/v1/cuotas/proyeccion`,
`GET /api/v1/proyecciones/proximo-mes`. `GET /api/v1/tarjetas` ya no devuelve
`estadisticas.compras_en_cuotas` ni `monto_cuotas_pendientes`, y
`GET /api/v1/dashboard/resumen` ya no devuelve campos de cuotas. Ninguno de esos
endpoints lo consumía el frontend (solo usa `/resumenes/upload`, `/reglas`,
`PATCH /tarjetas/:id` y `/pendientes-nombre/*`).

**Test nuevo:** `Backend/tests/fixtures-regresion.test.js` re-parsea las 40 fixtures y exige que la suma de movimientos coincida al centavo con el total del resumen. Es la red que hubiera atajado los bugs 3 y 4.

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

## Tests

```bash
cd Frontend && npm test    # services/*, consumos/*, ui/* (node:test, sin deps; usa las fixtures si están)
cd Backend  && npm test    # parser + regresión sobre los 40 PDFs reales (jest)
```

En el Backend, `api.test.js` y `src/services/pdf-parser.test.js` requieren `sharp`
(binario nativo): corren en macOS pero fallan en un entorno Linux con `node_modules`
instalado en Mac. `parser.test.js` y `fixtures-regresion.test.js` corren en cualquier lado.

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
