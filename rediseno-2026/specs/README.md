# Rediseño B+C — specs para Claude Code

Diseño aprobado el 27/09/2026. Prototipos de referencia (abrir en el navegador, son interactivos):

- `rediseno-2026/prototipos/tarjeteando-app-web.html`: web, 4 secciones.
- `rediseno-2026/prototipos/tarjeteando-app-iphone.html`: celular (< 768 px).

Los prototipos usan **datos de ejemplo**. La app real calcula todo desde `localStorage`. Si un número del prototipo no se puede sacar de los datos reales, gana el dato real y se anota en el commit.

## Cómo usar

Una fase por sesión de Claude Code, en orden. Pegar:

> Leé `rediseno-2026/specs/README.md` y `rediseno-2026/specs/fase-N-*.json`. Implementá solo esa fase en la rama `feat/rediseno-bc` (creala desde `main` si no existe). Al terminar corré `cd Frontend && npm test` y dejá un commit con el nombre de la fase. No sigas con la fase siguiente.

| Fase | Archivo | Qué deja andando |
|---|---|---|
| 0 | `fase-0-base.json` | Tokens, apariencia, barra superior, riel de celular, ventana de vidrio. Las vistas viejas siguen, dentro del marco nuevo. |
| 1 | `fase-1-mes.json` | Sección **Mes**: reemplaza el dashboard. |
| 2 | `fase-2-evolucion.json` | Gráfico **Evolución y proyección** + mini gráfico por tarjeta. |
| 3 | `fase-3-tarjetas.json` | Sección **Tarjetas**: pila tipo Wallet + detalle. |
| 4 | `fase-4-movimientos.json` | **Movimientos** con panel de detalle y hoja en celular. Reintegros pasa a ser un filtro. |
| 5 | `fase-5-cuotas.json` | **Cuotas**: línea de tiempo y decisiones sobre planes "a revisar". |
| 6 | `fase-6-cierre.json` | Pulido de celular, accesibilidad, limpieza, Novedades y CLAUDE.md. |

Cada fase deja la app usable. Se puede frenar entre fases.

## Reglas para todas las fases

1. **Sin dependencias nuevas.** El movimiento se hace con CSS (`transition` y `animation` con la curva `--spring`). Los gráficos nuevos se hacen con divs/SVG propios, no con recharts.
2. **No tocar** parsers, backend, `services/consumos/*`, `services/series.js` ni `services/cuotas.js`, salvo donde la fase lo diga explícitamente.
3. **Código nuevo fuera de `App.jsx`:** `src/ui/` (piezas visuales), `src/views/` (secciones), `src/services/` (cálculos puros con tests). `App.jsx` solo conecta estado y handlers.
4. **Cálculos = funciones puras con test** en `src/services/*.test.js` (`node --test`). El test script de `package.json` ya incluye `src/services/*.test.js`.
5. **Fechas:** nunca `new Date('YYYY-MM-DD')`. Usar `parseFechaLocal()` / `mesKeyDeFecha()`.
6. **Glosario** de CLAUDE.md (Tarjeta, Resumen, Últimos consumos, Card, SuperCard, Ciclo). El total de Últimos consumos ya incluye la cuota del mes: nunca sumarle cuotas encima.
7. **Accesibilidad es criterio de aceptación**, no pulido:
   - contraste según los tokens;
   - botones reales con foco visible;
   - `aria-label` en los íconos;
   - áreas táctiles ≥ 44 px en celular;
   - `prefers-reduced-motion` y `prefers-reduced-transparency` respetados.
8. **`vite build`** falla en la VM de Cowork por el binario de rollup. Verificar con `npm run dev` en la Mac.
9. **Novedades:** no tocar `APP_VERSION` ni `NOVEDADES` hasta la fase 6. Es un solo release.

## Tokens (copiar exacto en `src/ui/tokens.css`)

Oscuro (default) / Claro:

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--base` | `#0B0B10` | `#E9EBF2` | fondo detrás del campo de luz |
| `--win` | `rgba(28,28,30,.72)` | `rgba(255,255,255,.72)` | vidrio (ventana, barra, menús, hojas) |
| `--win-border` | `rgba(255,255,255,.10)` | `rgba(255,255,255,.65)` | borde del vidrio 0.5px |
| `--solid` | `#1C1C1E` | `#FFFFFF` | vidrio con "Reducir transparencia" |
| `--label` | `#F5F5F7` | `#1D1D1F` | texto principal |
| `--label2` | `#AEAEB2` | `#56565B` | texto secundario (≥ 5.8:1 sobre vidrio) |
| `--sep` | `rgba(84,84,88,.55)` | `rgba(60,60,67,.18)` | separadores 0.5px |
| `--fill` | `rgba(120,120,128,.24)` | `rgba(120,120,128,.14)` | controles, filas seleccionadas |
| `--fill2` | `rgba(120,120,128,.14)` | `rgba(120,120,128,.09)` | grupos, paneles |
| `--track` | `rgba(120,120,128,.22)` | `rgba(120,120,128,.14)` | pista de barras |
| `--r1` / `--r2` / `--r3` | `#B8B6FF` / `#7D7AFF` / `#4B49B8` | `#2B2A7A` / `#4F4DD6` / `#8C8AE8` | Cuotas / Fijos / Variables (escala índigo = compromiso) |
| `--t1` `--t2` `--t3` | `#1D1D1F` `#1D1D1F` `#FFF` | `#FFF` `#FFF` `#1D1D1F` | texto dentro de r1/r2/r3 |
| `--inv` / `--inv-text` | `#F5F5F7` / `#000` | `#1D1D1F` / `#FFF` | botón primario monocromo |
| `--ok` | `#30D158` | `#1F7A35` | éxito (siempre con ícono o texto) |
| `--warn` | `#FF9F0A` | `#B25000` | aviso |
| `--danger` | `#FF453A` | `#D70015` | te pasás del tope |

- **Curva:** `--spring: linear(0, .09 5.6%, .263 11.1%, .441 16.7%, .593 22.2%, .711 27.8%, .8 33.3%, .863 38.9%, .908 44.4%, .938 50%, .959 55.6%, .982 66.7%, .993 77.8%, .998 88.9%, 1)`, 600 ms. Sin rebote.
- **Tipografía:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", sans-serif`. Montos grandes en `ui-rounded, "SF Pro Rounded"`. `font-variant-numeric: tabular-nums` solo en columnas.
- **Títulos:** 34/41 bold, -0.02em. Sección h3: 13px semibold uppercase `--label2`.
- **Radios:** ventana 36, paneles 20–24, controles 12, filas 12, chips de plástico 3.5.

## Identidad de tarjeta (`src/ui/identidad.js`)

Cada tarjeta tiene un **plástico** (gradiente con su propio color de texto) y un **color de gráfico** (light/dark). El color sigue a la tarjeta, nunca al orden.

| Banco + red | Plástico | Texto | Gráfico claro / oscuro |
|---|---|---|---|
| Santander | `135deg,#D0021B→#7A0615` | `#FFF` | `#D6001C` / `#E8484E` |
| Galicia Visa | `135deg,#F7B062→#F08A24` | `#1D1D1F` | `#C2500A` / `#D47A22` |
| Galicia Mastercard | `135deg,#C2185B→#6E0B3E` | `#FFF` | `#B0126B` / `#E2589E` |
| BBVA | `135deg,#155A96→#072146` | `#FFF` | `#1B5FAF` / `#4C8FEA` |
| Otros bancos (por orden de alta de la tarjeta) | grafito `135deg,#4A4A52→#1F1F24` | `#FFF` | `#4a3aa7`/`#9085e9`, `#1baf7a`/`#199e70`, `#008300`/`#008300`, `#eda100`/`#c98500` |

Los 4 colores conocidos se validaron para daltonismo y contraste. Orden de apilado en gráficos: Santander → BBVA → Galicia Visa → Galicia MC → otros. Los colores de "otros bancos" van siempre con leyenda y etiqueta, nunca solos.
