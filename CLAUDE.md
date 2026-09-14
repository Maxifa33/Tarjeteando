# Tarjeteando — Contexto para Claude Code

## Qué es este proyecto

App web personal para centralizar el seguimiento de tarjetas de crédito argentinas y compras en cuotas. Permite importar resúmenes PDF de bancos, ver saldos, cuotas pendientes y proyecciones de gastos futuros.

**Estado:** En desarrollo activo. Junio 2026.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| DB | En memoria (objeto `db` en RAM) + localStorage del browser |
| PDF parsing | pdf-parse (texto) + Claude Vision API (imágenes/bancos no reconocidos) |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |

**Importante:** No hay base de datos persistente en el backend. Los datos viven en `db` (RAM) y se pierden al reiniciar el servidor. La fuente de verdad es `localStorage` del browser. El backend solo parsea PDFs y devuelve datos; el frontend los persiste localmente.

---

## Estructura de archivos relevantes

```
tarjetas-proyecto/
├── Frontend/
│   └── src/
│       ├── App.jsx          ← TODO el frontend (monolítico, ~3400 líneas)
│       ├── index.css        ← variables CSS, temas claro/oscuro
│       └── services/
│           └── storage.js   ← helpers para leer/escribir localStorage
├── Backend/
│   └── src/
│       ├── app.js           ← servidor Express completo (~1100 líneas)
│       └── services/
│           ├── pdf-parser.service.js   ← parser tradicional por banco
│           └── vision-parser.service.js ← parser con Claude Vision API
├── CLAUDE.md                ← este archivo
└── Backend/VISION-INTEGRATION.md
```

---

## Arquitectura del Frontend

`App.jsx` es un único archivo con todos los componentes. Estructura:

- `OnboardingWizard` — wizard inicial para nuevos usuarios
- `CreditCardVisual` — card visual de cada tarjeta
- `SettingsModal` — modal de configuración (tarjetas, preferencias, alertas, datos, temas)
- `App` — componente raíz con todo el estado global
- `DashboardView` — vista principal con StatCards, gráficos y proyecciones
- `MovimientosView` — lista de movimientos con filtros
- `CuotasView` — vista de cuotas activas
- `ReglasView` — gestión de reglas de limpieza de nombres de comercios
- `ImportarView` — drag & drop para subir PDFs

**Variables de entorno Frontend:**
```
VITE_API_URL=http://localhost:3000   # en dev
VITE_API_URL=https://...railway.app  # en prod
```

---

## Arquitectura del Backend

`app.js` tiene un objeto `db` en memoria con:
- `db.tarjetas` — lista de tarjetas
- `db.resumenes` — resúmenes importados
- `db.movimientos` — todos los movimientos de todos los resúmenes
- `db.comprasCuotas` — compras en cuotas deduplicadas por `hash_logico`
- `db.reglasUsuario` — reglas de limpieza (persiste en `data/reglas-usuario.json`)
- `db.pendientesNombre` — movimientos con nombre dudoso

**Endpoints principales:**
```
POST /api/v1/resumenes/upload     ← sube PDFs, parsea y guarda en db
GET  /api/v1/tarjetas
GET  /api/v1/movimientos
GET  /api/v1/resumenes
GET  /api/v1/cuotas/activas
GET  /api/v1/cuotas/proyeccion
GET  /api/v1/reglas
POST /api/v1/reglas
GET  /api/v1/dashboard/resumen
```

---

## Bancos soportados (parser PDF tradicional)

- **BBVA Argentina** — Visa Gold, Mastercard Black
- **Santander Río** — Visa Superclub

Para otros bancos, el backend usa Claude Vision API como fallback automático (requiere `ANTHROPIC_API_KEY` en `.env` del Backend).

---

## Cambios recientes (14/09/2026) — una sola calculadora de cuotas

La lógica de cuotas se movió del backend al frontend y quedó en **`Frontend/src/services/cuotas.js`**
(`construirPlanes`, `proyectarCuotas`, `formatearParaVista`, `totalPendiente`). `App.jsx` solo la llama.

- Se eliminó el motor del backend: `db.comprasCuotas`, `proyeccion.service.js`, `GET /api/v1/cuotas/activas`,
  `GET /api/v1/cuotas/proyeccion` y `GET /api/v1/proyecciones/proximo-mes`. El frontend nunca los consumía
  (solo usa `/resumenes/upload`, `/reglas`, `PATCH /tarjetas/:id` y `/pendientes-nombre/*`).
- **Tests del frontend:** `cd Frontend && npm test` — usa `node --test`, sin dependencias nuevas.
  19 tests: unitarios, independencia del orden de subida con PDFs reales, y el caso Easy Warnes
  contra el "Cuotas a vencer" del propio resumen.
- Los archivos viejos quedaron en `_to_delete/` con extensión `.obsoleto` (no los levanta ni jest ni
  `require`). Borrá esa carpeta cuando quieras.

---

## Cambios recientes (04/09/2026) — auditoría parser + cuotas + gastos fijos

Rama `fix/auditoria-parser-cuotas-2026-09`. Detalle completo en `references/contexto-tarjeteando.md`.

- **Fechas:** nunca más `new Date('YYYY-MM-DD')` (lo lee como UTC y en AR resta un día). Usar `parseFechaLocal()` / `mesKeyDeFecha()` en `App.jsx`.
- **Cuotas:** los planes se arman con TODOS los resúmenes, no solo el último. Cada plan se ancla al período donde se lo vio por última vez. Si un resumen posterior no lo factura, se marca `interrumpida`: se muestra con badge pero no se proyecta.
- **Parser Galicia:** el marcador de fila pasó de `[*KVEU]` a `[*K]` (V/E/U se comían la primera letra del comercio).
- **BBVA:** se dedupica `TOTAL CONSUMOS DE <titular>` (aparecía 2 veces y duplicaba el total).
- **Limpieza de nombres:** `capitalizar()` ya no pisa los nombres canónicos de las reglas; `extraerNombreMerpago` aplica la regla del comercio extraído.
- **Gastos fijos:** criterio nuevo (mediana de variación mes a mes + presencia + importe repetido) y **soporte de consumos en USD**. Pasa de 1 a 8 detectados sobre las fixtures.
- **Test nuevo:** `Backend/tests/fixtures-regresion.test.js` (re-parsea las 40 fixtures, exige totales exactos).

---

## Cambios recientes (23/06/2026)

### Feature "Últimos consumos" (consumos pre-resumen, XLSX)
- Nueva sección en sidebar (icon Zap). Importa el export "Últimos consumos" de Galicia (.xlsx) para ver gasto en curso antes del cierre.
- **Independiente** de resúmenes/movimientos/cuotas. Vive en localStorage key `tarjetas_consumos_live`.
- Parser nuevo: `Frontend/src/services/consumos-parser.js` (usa SheetJS). Componentes `ConsumosLiveView` + `CSVColumnMapper` en `App.jsx`.
- **Nueva dependencia:** `xlsx`. Correr `cd Frontend && npm install` antes de levantar.

---

## Cambios recientes (22/06/2026)

### 1. StatCard "Cuotas Próximo Mes"
- **Archivo:** `Frontend/src/App.jsx`
- **Qué cambió:** La StatCard que antes mostraba el total acumulado de cuotas futuras ("Pendiente Cuotas") ahora muestra solo el monto comprometido en cuotas para el **mes actual** (`proyeccionCuotas[0].total`).
- **Label:** "Cuotas Próximo Mes"

### 2. Cotización USD → ARS en tiempo real
- **Archivo:** `Frontend/src/App.jsx`
- **Qué cambió:**
  - Estado `cotizacion` en el componente `App`, inicializado desde cache en localStorage.
  - `useEffect` que fetchea `https://dolarapi.com/v1/dolares/tarjeta` al cargar. Fallback a `https://api.bluelytics.com.ar/v2/latest` si falla.
  - Cache de 30 minutos en localStorage bajo la key `cotizacion_cache` (`{venta, compra, nombre, fechaActualizacion, cachedAt}`).
  - Badge en el Dashboard: "💵 Dólar tarjeta: $X.XXX · HH:MM".
  - En `CreditCardVisual`: tarjetas con saldo USD muestran el equivalente en ARS (`≈ $X.XXX ARS`).
- **Props nuevas:** `cotizacion` pasa de `App` → `DashboardView` → `CreditCardVisual`.

### 3. Gráfico de barras de proyección de cuotas — interactivo
- **Archivo:** `Frontend/src/App.jsx`
- **Qué cambió:**
  - Texto bajo cada barra cambiado de "X cuotas" a "X consumos en cuotas pendientes".
  - Click en barra → expande panel de detalle con el desglose de cada cuota del mes seleccionado (descripción, badge de color por tarjeta, nro de cuota "X/Y", monto).
  - Click de nuevo en la misma barra → colapsa el panel (toggle).
  - Barras no seleccionadas se atenúan (opacity 0.4).
  - Estado `mesDetalleIdx` en `DashboardView`.
  - Criterio de inclusión: `cuotas_restantes >= i` (mismo que la proyección en `fetchData`).

---

## Gotchas conocidos

- **`App.jsx` es monolítico.** Todos los componentes están en un solo archivo. Editarlo requiere conocer bien la estructura para no romper el scope de variables.
- **El backend pierde datos al reiniciar.** Si el backend (Railway) se reinicia, hay que volver a subir los PDFs. El localStorage del browser es la fuente de verdad real.
- **Reglas de limpieza** se persisten en `Backend/data/reglas-usuario.json` (el único dato que sobrevive reinicios del backend).
- **`cotizacion_cache` en localStorage** expira a los 30 minutos. Si la API de dolarapi.com falla y bluelytics también falla, `cotizacion` queda `null` y no se muestra nada (no rompe nada).
- **El criterio de proyección de cuotas** es `cuotas_restantes >= i` donde `i=0` es el mes actual. Este criterio está duplicado: en `fetchData` (líneas ~1519-1524) y en el panel de detalle del gráfico. Si se cambia uno, cambiar el otro.
- **Colores de tarjetas** están hardcodeados en `TARJETA_COLORS` y `BANK_THEMES`. Bancos no listados usan fallback por hash del nombre.

---

## Cómo correr en local

```bash
# Terminal 1 — Backend
cd Backend && npm run dev    # levanta en localhost:3000

# Terminal 2 — Frontend
cd Frontend && npm run dev   # levanta en localhost:5173
```

---

## Variables de entorno necesarias

**Backend `.env`:**
```
ANTHROPIC_API_KEY=sk-ant-...   # para Vision API (opcional pero recomendado)
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**Frontend `.env.local`:**
```
VITE_API_URL=http://localhost:3000
```
