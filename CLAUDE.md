# Tarjeteando — Contexto para Claude Code

## Qué es este proyecto

App web personal para centralizar el seguimiento de tarjetas de crédito argentinas y compras en cuotas. Permite importar resúmenes PDF de bancos, ver saldos, cuotas pendientes y proyecciones de gastos futuros.

**Estado:** En desarrollo activo. Rediseño B+C terminado el 27/09/2026 (rama `feat/rediseno-bc`).

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + Tailwind CSS (utilidades) + tokens propios en `src/ui/tokens.css` |
| Gráficos | Propios, con divs/SVG (sin recharts desde el rediseño) |
| Tipografía | Fuentes del sistema (`-apple-system`, SF Pro, `system-ui`); sin Google Fonts |
| Backend | Node.js + Express |
| DB | En memoria (objeto `db` en RAM) + localStorage del browser |
| PDF parsing | pdf-parse (texto) + Claude Vision API (imágenes/bancos no reconocidos) |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |

**Importante:** No hay base de datos persistente en el backend. Los datos viven en `db` (RAM) y se pierden al reiniciar el servidor. La fuente de verdad es `localStorage` del browser. El backend solo parsea PDFs y devuelve datos; el frontend los persiste localmente.

**Sin dependencias nuevas para la UI:** el movimiento se hace con CSS (`transition`/`animation` con la curva `--spring`).

---

## Estructura de archivos relevantes

```
tarjetas-proyecto/
├── Frontend/
│   └── src/
│       ├── App.jsx            ← estado global, handlers y ruteo entre secciones (+ Ajustes, Importar, Reglas)
│       ├── index.css          ← importa ui/tokens.css; clases mínimas de las vistas secundarias
│       ├── novedades.js       ← APP_VERSION, NOVEDADES, GUIA
│       ├── views/             ← secciones: MesView, TarjetasView, MovimientosView, CuotasView,
│       │                         Guia (Novedades + Guía), Onboarding
│       ├── ui/                ← piezas visuales: tokens.css, AppShell, Rail, Hoja, Seg, CampoDeLuz,
│       │                         Capsula, EvolucionChart, DetalleMes, MiniHistorial, Plastico,
│       │                         PilaWallet, FilaMovimiento, DetalleMovimiento, LineaDeTiempoPlanes,
│       │                         DetallePlan, identidad.js, formato.js, useCompacto.js
│       └── services/          ← cálculos puros con tests (`npm test`)
│           ├── storage.js         ← localStorage (versión 1.4.0) + migraciones.js (idempotentes en cada carga)
│           ├── mes.js             ← ciclo de pago, composición, tope, próximo mes
│           ├── evolucion.js       ← gráfico Evolución y proyección
│           ├── tarjetas.js        ← qué muestra cada plástico, nombres personalizados
│           ├── movimientos-vista.js ← filtros, días, historial de comercio, consumos en curso
│           ├── planes-vista.js    ← línea de tiempo y cifras de Cuotas
│           ├── cuotas.js          ← planes, identidad (comprobante/ocurrencia) y cuotas en curso (única calculadora)
│           ├── series.js          ← gastos fijos (cadenas por ID de movimiento)
│           ├── apariencia.js      ← modo de color / reducir transparencia
│           └── consumos/          ← lectores de Últimos consumos y ciclos (Card/SuperCard)
├── Backend/
│   └── src/
│       ├── app.js           ← servidor Express completo (~1100 líneas)
│       └── services/
│           ├── pdf-parser.service.js   ← parser tradicional por banco
│           └── vision-parser.service.js ← parser con Claude Vision API
├── rediseno-2026/           ← specs (fases 0–6) y prototipos del rediseño B+C
├── CLAUDE.md                ← este archivo
└── Backend/VISION-INTEGRATION.md
```

---

## Arquitectura del Frontend

`App.jsx` conecta estado y handlers; la UI de cada sección vive en `src/views/` y los cálculos en `src/services/` (funciones puras con test). Regla: **código nuevo fuera de `App.jsx`**.

- `AppShell` (`ui/`) — marco: barra superior con pestañas **Mes · Tarjetas · Movimientos · Cuotas**, Buscar, menú **Más** e **Importar**; ventana de vidrio con scroll interno; en celular (< 768 px) riel plegable abajo.
- Menú **Más** (⋯) — Ajustes (`SettingsModal`), Reglas de nombres (`ReglasView`), Guía y novedades, Apariencia (Sistema / Claro / Oscuro, Reducir transparencia, Menú a la izquierda en celular).
- `MesView` — próximo pago, cápsula cuotas/fijos/variables, tope, pregunta de fijos, En curso por tarjeta, Evolución y proyección.
- `TarjetasView` — pila tipo Wallet + detalle de la tarjeta, o la vista Todas (con resúmenes cargados y borrar).
- `MovimientosView` — lista por día, filtros en una fila (Reintegros y **En curso** son filtros), detalle en panel o en `Hoja`. Los Últimos consumos que todavía no están en un resumen se ven acá (fase 7); ya no hay vista aparte.
- `CuotasView` — línea de tiempo de planes, decisiones sobre planes "a revisar".
- `activeView` sigue siendo la fuente de verdad de la navegación ('dashboard' = Mes).

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

## Glosario (usar siempre estas palabras)

- **Movimiento = gasto = consumo = compra** (sinónimos).
- **Tarjeta**: cuenta de crédito que genera UN resumen (banco + red + últimos 4). Varios **plásticos** pueden compartir resumen.
- **Resumen**: documento oficial del cierre. Datos cerrados.
- **Últimos consumos**: export parcial del home banking (xlsx/xls/csv) con lo no facturado. Provisional.
- **Card / SuperCard**: grupo de Últimos consumos de una tarjeta (SuperCard = varios plásticos, mismo cierre y vto). En la UI nueva se ven como un **plástico** de la pila en Tarjetas (la SuperCard, con el segundo plástico asomando).
- **Ciclo**: período entre cierres. **Conciliación**: el Resumen reemplaza a los Últimos consumos de su ciclo.
- **Ciclo de pago**: el mes del **próximo vencimiento ≥ hoy**; es el mes que muestra Mes.
- **Comprometido**: lo que ya se sabe que se va a pagar: cuotas + fijos (y, en el mes en curso, lo ya consumido).
- **Tope**: tope de gasto mensual del usuario (`config.tope_mensual`, null = sin tope). "Libre" = tope − total del ciclo de pago.
- **A revisar**: plan en cuotas que el banco dejó de facturar sin terminar. No se proyecta hasta que el usuario decide (terminado / vigente).

---

## Cambios recientes (02/10/2026) — identidad de planes y cuotas de Últimos consumos

Spec: `rediseno-2026/specs/fix-cuotas-identidad-y-ultimos-consumos.json`. Detalle en `references/contexto-tarjeteando.md` (Gotchas 1–1c).

- **Período del resumen = mes de CIERRE**, del string `fecha_cierre` (el parser ya no usa `new Date`: un cierre del día 1 caía en el mes anterior). Storage lo corrige en los resúmenes guardados (`migrarPeriodoResumenes`, idempotente, no cambia ids).
- **Comprobante:** el parser lo devuelve crudo en cada movimiento (`'008547'`; null si no hay). No entra en el hash del id. Se compara siempre con `normalizarComprobante` (solo dígitos, sin ceros a la izquierda).
- **Identidad del plan** (`services/cuotas.js`): `tarjeta|c:<comprobante>`, o clave base + ocurrencia `#k` dentro del resumen. Compras idénticas son planes distintos. Viejo sin comprobante + nuevo con comprobante de la misma compra = un plan (`alias`). Nunca emparejar por nombre. Decisiones con clave vieja → `<clave>#1` (`migrarDecisionesPlanes`).
- **Cuotas de Últimos consumos** (`observacionesEnCurso` → `construirPlanes(..., { enCurso })`): avanzan los planes existentes (comprobante, o tarjeta + total + cuota esperada + monto) y crean los nuevos solo si son cuota 1 o la tarjeta no tiene resúmenes (`live:<grupoKey>`); el resto va a `sinEmparejar`. Mismo período: gana el resumen. Interrumpidos solo desde resúmenes. El total del Mes y las columnas "pagado" no cambian (el plan guarda su ancla del resumen).
- `refrescarLive` recalcula los planes. DetallePlan avisa "Actualizado con Últimos consumos · se confirma con el próximo resumen".

---

## Módulos (Economics) — 02/10/2026, rama `feat/modulos-paso-0`

Capa opcional de módulos dentro de Tarjeteando: **Platita** (ingresos), **Billetera** (efectivo + transferencias), **Compartidos**, **Saldar** (deudas fuera de tarjeta), **Alcancía** (metas + inversiones), **Presupuestos**. Paso 0: activar/desactivar y favoritos; cada módulo es todavía una pantalla "Próximamente".

- **Todo el código nuevo vive en `Frontend/src/modulos/`.** Tarjeteando está congelado: no tocar `services/*`, `views/*`, `storage.js`, `migraciones.js` ni `STORAGE_KEYS`.
- `modulos/registro.js` — manifiesto (ids, nombres, íconos por nombre) + `seccionesConModulos()` (pura, testeada). Sin módulos activos devuelve exactamente `SECCIONES`.
- `modulos/useModulos.js` — sesión Supabase (magic link) + tabla `modulos_usuario`. Cache local en la key propia `modulos_estado_cache` (no viaja en exportAll). Escrituras optimistas, una a la vez por módulo.
- `modulos/puente/tarjeteando.js` — **solo lectura**: recibe el `mes` que ya calcula App.jsx y devuelve totales del ciclo de pago (mismas cifras que la cápsula de Mes).
- `modulos/ui/` — `GestorModulos` (Más → Módulos), `ModuloHost` (error boundary), `Proximamente`, `modulos.css` (todo con prefijo `.tj .mod-*`).
- Favoritos: máx. 2, como pestañas después de Cuotas (AppShell y Rail reciben prop `secciones`). Activos no favoritos: menú Más → "Mis módulos".
- Supabase: proyecto `tarjeteando-modulos` (sa-east-1). Tablas `modulos_usuario`, `cuentas`, `categorias`, `importaciones`, `movimientos` con RLS `user_id = auth.uid()`. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` en `Frontend/.env.local`. Sin esas variables, el ítem Módulos no aparece.
- Tarjeteando sigue sin login: la cuenta es solo para módulos.

### Paso 1 — Platita + Billetera (rama `feat/modulos-paso-1`)
- `modulos/cuentas/`: `leer.js` (PDF con pdfjs-dist **legacy**, cargado con import dinámico; XLSX/CSV con SheetJS) → `detectar.js` (elige lector por contenido) → `parsers/galicia.js`, `parsers/mercadopago-pdf.js` (por posición de cada texto; valida contra Entradas/Salidas del resumen), `parsers/tabular.js` (planillas genéricas por sinónimos de columnas) → `plan.js` (clasifica con `clasificar.js`, huellas con `huella.js`) → `repo.js` (Supabase).
- **Huella** (dedup): con n° de operación único en el archivo = cuenta+id+fecha+monto+dirección; sin id = hash del contenido + n° de ocurrencia en el día. Mercado Pago es una sola cuenta por usuario (PDF y Excel no se duplican). Reimportar un archivo (aunque haya fallado a medias) solo carga lo que falta.
- **Nunca suman**: `pago_tarjeta`, `transferencia_interna` (cuentas propias por CUIT o nombre completo del titular), compra de dólares, `reserva` (reservas de MP = `bolsillos`, tipo `apartado` o `ahorro`). Lo dudoso va con `estado='revisar'` y no suma hasta confirmarlo.
- Resúmenes con signo (`resumen.js`): un gasto que es entrada (devolución) resta.
- Vistas: `ui/cuentas/PlatitaView.jsx`, `BilleteraView.jsx`, `ImportarCuentas.jsx`, `comunes.jsx` (selector de mes, `EditarMov`). Cargadas con `React.lazy` desde `ModuloHost`.
- Tests: `src/modulos/cuentas/cuentas.test.js` con datos **ficticios**. Nunca commitear extractos reales.
- **Recupero** (`tipo='recupero'`, solo entradas): plata que te devuelven de un gasto tuyo. No es ingreso. Sin vínculo resta del gasto de Billetera y de su categoría; con `vinculo_tarjeta` (jsonb: compra de Tarjeteando, `alcance` 'total'|'cuota', `cuota_numero`) no resta en Billetera: se netea en Presupuestos. Compras para vincular: `comprasDeTarjeta()` del puente (solo lectura, datos de este dispositivo). `sugerirAlcance`: 'cuota' solo si el monto está a ±10% de una cuota.
- **Reglas por contraparte** (`reglas_contraparte`, contraparte normalizada + dirección): se aplican al importar solo a lo que quedó "a revisar", y al guardarlas a lo ya importado de esa persona que sigue a revisar. No se ofrecen para recuperos con tarjeta.

### Categorías y archivos (Platita / Billetera)
- Categorías del sistema (`user_id` null) no se editan: renombrar crea una propia con `reemplaza = <id base>` y le pasa movimientos y reglas, en una transacción (RPC `economics_renombrar_categoria`, security invoker). `cuentas/categorias.js`: `categoriasVisibles`, `resolverCategoria` (el clasificador usa la que reemplaza), `nombreOcupado` (cuenta también las base ocultas).
- Archivos importados (`ui/cuentas/ArchivosImportados.jsx`): borrar uno = sus movimientos + la importación. "Empezar de cero" (`borrarTodo`): movimientos → importaciones → bolsillos → cuentas (+ categorías propias y reglas opcional); pasos idempotentes, reintentar termina. No toca Tarjeteando. Confirmación por segundo toque que se desarma a los 4 s (Safari no da foco a botones).
- Nota: `apply_migration` del MCP se cuelga con cualquier `DELETE`/`DROP` en el SQL (pide confirmación): por eso `borrarTodo` es del lado del cliente.

### Paso 2 — Presupuestos v1, mes real (rama `feat/modulos-paso-2`)
- `modulos/cuentas/presupuesto.js` (puro): Te queda = Ingresos − Tarjetas − Gastos sin tarjeta + Recuperos vinculados a tarjeta; Libre = Te queda − apartado − ahorrado. `historial()` 6 meses.
- Tarjetas por mes de vencimiento desde `evolucion.columnas` de App.jsx (`tarjetasPorMes` del puente, solo lectura). Mes 'pagado' sin resúmenes = sin datos → fallback a pagos de tarjeta hechos desde las cuentas. Nunca se suman ambos (no hay doble conteo).
- `ui/cuentas/PresupuestosView.jsx`. App pasa `tarjeteandoParaModulos = { movimientos, evolucion: evolucion.columnas }` (declarado DESPUÉS del memo de evolución: si no, TDZ y la app entera no arranca).

### Paso 3 — Saldar (rama `feat/modulos-paso-3`)
- Tabla `deudas` (prestamo|persona|atraso, saldo_inicial a la `fecha_inicio`, cuota_monto, cuotas_restantes, tasa_anual, palabra_clave, estado activa|saldada). En `movimientos`: `deuda_id` (FK set null), `deudas_descartadas uuid[]`, `categoria_previa_id` + `estado_previo` (cómo estaba antes de confirmarlo como pago; se restaura al quitar/borrar, la categoría solo si sigue en Deudas).
- `modulos/deudas/deudas.js` (puro, tests en deudas.test.js): estadoDeuda (saldo = inicial − pagos misma moneda desde fecha_inicio), puntaje/sugerirPagos (palabra clave, acreedor + pista, cuota ±3%, persona por tokens; el solo nombre del banco no alcanza), simular/compararPlanes (avalancha vs bola, motivo cuando no termina), validarDeuda.
- `modulos/deudas/repo.js`: confirmar = update guardado `.is('deuda_id', null)` y DESPUÉS borrar el manual duplicado (si falla, quedan los dos visibles). Pago manual → cuenta `efectivo` creada a demanda, origen 'manual', huella 'manual:uuid', cuenta como gasto en Billetera.
- UI `ui/deudas/SaldarView.jsx` + `HojasDeuda.jsx`. Monto sugerido del plan = promedio (teQueda + pagos de deudas) de meses cerrados.
- Gotcha: el MCP de Supabase no aplica SQL con DELETE (ni dentro de funciones): por eso no hay RPCs atómicas acá.

### Paso 4 — Alcancía (rama `feat/modulos-paso-4`)
- Tablas `metas` (bolsillo_id opcional; índice único parcial: una reserva por meta activa), `meta_aportes` (monto <0 = retiro), `inversiones` (plazo_fijo|fci|dolar|accion|cedear|bono|cripto|otro). Compartidas solo lectura: `precios` (PK tipo+simbolo, último cierre) y `tasas_plazo_fijo`.
- Cotizaciones: pg_cron + pg_net, todo en la base, sin edge functions ni claves. `economics_pedir_cotizaciones()` 23:00 UTC → `economics_procesar_cotizaciones()` 23:05 y 23:30 UTC (security definer, sin execute para clientes). Fuentes: dolarapi (casas; precio = compra), data912 (acciones/CEDEARs/bonos/letras/ONs; USD si sufijo D/C y el base cotiza >100×; data912 es un proyecto hobby: riesgo de que desaparezca), coingecko (10 cripto, USD), argentinadatos (FCI vcp/1000 por cuotaparte; plazo fijo tnaClientes en decimal).
- `modulos/alcancia/alcancia.js` (puro, tests): estadoMeta (juntado = inicial + aportes + neto reserva; porMes desde el saldo al empezar el mes; ritmo sobre meses cerrados desde que existe), planMetas, valuar (bonos ÷100; dólares: capital en pesos, precio compra de la casa; plazo fijo interés simple con tope al plazo), totalCartera, parseCantidad (sin redondeo; "10.000" = miles salvo cripto).
- UI `ui/alcancia/AlcanciaView.jsx` (pestañas Metas/Inversiones) + `HojasMeta.jsx` + `HojasInversion.jsx`. Capacidad = promedio teQueda de meses completos (mismo criterio en Saldar). Marcar lograda congela lo juntado y desvincula la reserva.

---

## Cambios recientes (27/09/2026) — Rediseño B+C (fases 0 a 7)

Rama `feat/rediseno-bc` (fases 0 a 7, specs en `rediseno-2026/specs/`, prototipos en `rediseno-2026/prototipos/`).

**Qué cambió para el usuario:** la app pasa a 4 secciones (Mes, Tarjetas, Movimientos, Cuotas) dentro de una ventana de vidrio, con apariencia Sistema / Claro / Oscuro. El dashboard viejo, las StatCards, la vista Reintegros y los temas Liquid / dorado ya no existen.

**Reglas (no romper):**
- **Ciclo de pago** (`services/mes.js`): por tarjeta, resumen cerrado que vence ese mes → su total a pagar; si no hay, el ciclo en curso de Últimos consumos que vence ese mes (tarjeta ↔ ciclo por banco + red); si no, `sin_datos` (no suma, aviso).
- **Cuotas del mes**: cada tarjeta factura en su mes de cierre y paga `desfase` meses después (del último resumen: vto − cierre, default 1). `cuotasDelMes` elige por mes, nunca por posición en `proyectarCuotas`. Las cuotas en USD van aparte. Una "cuota" 1/1 es compra común (no cuenta como cuota).
- **Variables = total − cuotas − fijos**, calculado por tarjeta (`composicionPorTarjeta`) y sumado (`composicionDesdeTarjetas`): la cápsula de Mes = suma de "Esta tarjeta en el mes". Si cuotas + fijos superan lo importado, el total de esa tarjeta sube a lo comprometido y hay aviso. Nunca sumar cuotas al total de Últimos consumos.
- **Evolución** (`services/evolucion.js`): pagado por mes de vencimiento; comprometido = solo cuotas + fijos (no se inventa gasto variable).
- **Cuotas** (`services/planes-vista.js`): los meses de la línea de tiempo son meses de pago, así "Este mes" coincide con Mes. `construirPlanes(movs, resumenes, decisiones, { enCurso })`: 'terminado' → `estado 'terminada'`, `motivo 'decision_usuario'` (no se proyecta); 'vigente' → deja de estar interrumpido. Sin decisiones, la salida es idéntica a la de antes.
- **Identidad de tarjeta** (`ui/identidad.js`): plástico y color de gráfico por banco + red, nunca por orden ni por monto. Orden de apilado: Santander → BBVA → Galicia Visa → Galicia MC → otros (por alta).
- **Nombres personalizados** (`nombresTarjetas`): por id de tarjeta o `live:<grupoKey>` para tarjetas que solo existen por Últimos consumos; se muestran en todas las vistas (`nombreVisible`) y se mudan a la tarjeta cuando llega su resumen (`migrarNombresLive`).
- **Accesibilidad** es criterio de aceptación: foco visible, `aria-label` en íconos, áreas táctiles ≥ 44 px en celular, `prefers-reduced-motion`, `prefers-reduced-transparency` y `prefers-contrast` respetados. Ningún texto usa el color de una serie.
- Modales, hojas y avisos van en un **portal a `<body>`** (dentro de `<main>` quedan debajo de la barra y del riel y el vidrio no desenfoca).
- Fechas: nunca `new Date('YYYY-MM-DD')`; siempre strings o constructores locales.

**Últimos consumos en Movimientos (fase 7):** `movimientosEnCurso` (`services/movimientos-vista.js`) arma filas con forma de movimiento (`origen: 'en_curso'`, id `live:<id>`) a partir de `cardsEnCurso` / `resumenCard`: son exactamente los consumos que Mes y Tarjetas cuentan como en curso. Se excluyen los pagos y los ciclos que ya cubre un resumen importado (cierre ±5 días o posterior), así nada aparece dos veces. Los nombres se limpian con las mismas reglas que los resúmenes (`nombreSegunReglas`). En curso no hay fijos: el tipo se define cuando llega el resumen. "Borrar Últimos consumos importados" está en Importar.

**localStorage 1.4.0** (`services/migraciones.js`, idempotente): el tema viejo pasa a `config.apariencia`; se borran `tarjetas_theme`, `dashboard_card_order` y `config.theme`. Keys y campos nuevos: `config.apariencia`, `config.tope_mensual`, `tarjetas_decisiones_planes`; las decisiones de fijos tienen `id` (Deshacer). Todo viaja en `exportAll`/`importAll`; un backup de 1.3.0 se importa sin pérdida (test).

**Tests:** `cd Frontend && npm test` (node --test, sin dependencias) cubre `src/services/*.test.js`, `src/services/consumos/*.test.js` y `src/ui/*.test.js`.

---

## Cambios recientes (26/09/2026) — Últimos consumos en el dashboard, bandeja única, SuperCard

Rama `feat/ultimos-consumos-supercard`. Diseño: `~/Claude/Projects/Tarjeteando/diseno/supercard-estratos.png`.

(Glosario: ver la sección de arriba.)

**Código nuevo (todo testeable en Node, `npm test` → 63 tests):**
- `services/consumos/index.js` — `parseUltimosConsumos(hojas, {plantillas})` → bloques (1 por plástico). Recorre TODAS las hojas.
  Orden: formato Santander/Galicia/Amex (`consumos-parser.js`) → Macro (`macro.js`) → plantilla guardada → `requiereMapeo`.
- `services/consumos/macro.js` — números en formato inglés, cuotas en la descripción ("02/06"), fechas imposibles (31/09) corregidas con aviso, valida contra "Total consumos".
- `services/consumos/generico.js` + `POST /api/v1/consumos/mapear-columnas` (Backend, `mapeo-columnas.service.js`) — bancos desconocidos: la IA recibe SOLO encabezados + 8 filas, devuelve el mapeo y el frontend lo guarda como plantilla (`plantillas_consumos`). Sin IA → `CSVColumnMapper` manual.
- `services/consumos/ciclos.js` — `agruparBloques` (mismo archivo + mismo cierre y vto → grupo), `aplicarArchivo` (archivo nuevo REEMPLAZA grupo+ciclo), `resumenCard`, `cardsEnCurso`, `conciliarConResumen` (banco+red+cierre ±5 días; emparejamiento 1 a 1 por fecha ±1 y monto).
- `services/consumos/live.js` — puente con storage. (`components/LiveCards.jsx` se borró en el rediseño: las Cards son plásticos en Tarjetas.)
- `parsearMontoConsumo` detecta es-AR vs inglés por el último separador. Nunca asumir.

**Reglas:**
- El banco NUNCA se infiere del formato (Santander, Galicia y Amex exportan igual): sale del alias `ult4 → banco`. La importación NUNCA se frena por falta de banco: se importa con banco vacío y la Card lo pide (`BancoPicker` → `asignarBanco`). La clave del grupo no cambia al asignarlo.
- El total de Últimos consumos YA incluye la cuota del mes de planes viejos: no sumarle `cuotas.js`.
- Dos archivos distintos nunca forman un grupo. Un archivo posterior con un subconjunto de plásticos actualiza el mismo grupo.
- Un plástico sin consumos en el ciclo no ocupa fila.

**localStorage 1.3.0:** keys nuevas `tarjetas_ciclos_live`, `tarjetas_alias_ult4`, `plantillas_consumos`. Los consumos viejos sin grupo se reemplazan al subir de nuevo su archivo.
**ConsumosLiveView** ya no tiene uploader propio: su botón lleva a Importar. *(Desde la fase 7 del rediseño la vista no existe: los consumos están en Movimientos.)*
**Build:** `node_modules` está instalado para macOS; en la VM de Cowork `vite build` falla por el binario de rollup (no es un bug del código).

---

## Cambios recientes (24/09/2026) — series de gastos fijos, Tipo editable, Novedades y Guía

Detalle en `references/contexto-tarjeteando.md` (sección 6b).

- **Bug:** renombrar un gasto fijo lo pasaba a variable. Ahora el tipo se calcula por **ID de movimiento** (SHA-256 del contenido) y **cadenas de suscripción** (cada cargo apunta al anterior, ±25% contra el mes previo). Todo en `Frontend/src/services/series.js`.
- Renombrar crea una regla por **clave de comercio** (`es_clave`): el nombre se aplica a todos los meses; no toca el tipo.
- **Columna Tipo** en Movimientos: desplegable Fijo/Variable. Vale desde ese resumen en adelante y el detector no lo vuelve a tocar.
- **Preguntas** tras importar si un fijo falta o cambió mucho de precio (una tarjeta, un toque). Sin respuesta, decide la regla automática.
- **Novedades** (modal una vez por versión) y **Guía** (menú). **Regla:** toda feature que cambie el uso de la app sube `APP_VERSION` y actualiza `NOVEDADES` y `GUIA` en `Frontend/src/novedades.js`.
- localStorage 1.2.0: migra los IDs posicionales a ID hash automáticamente. Keys nuevas: `tarjetas_tipo_overrides`, `tarjetas_decisiones_fijos`, `tarjetas_metricas_detector`, `novedades_version_vista`.

---

## Cambios recientes (14/09/2026) — vista Cuotas: solo lo que está en curso

Cada plan tiene ahora un `estado` (`vigente` / `ultima_cuota` / `terminada` / `interrumpida`)
en `Frontend/src/services/cuotas.js`. La vista Cuotas oculta por defecto las `terminada`
(planes que se acabaron en resúmenes anteriores) detrás de un botón "Ver N terminadas".
La StatCard "Cuotas Activas" cuenta solo `vigente` — antes incluía las terminadas.

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
- Parser nuevo: `Frontend/src/services/consumos-parser.js` (usa SheetJS). Componentes `ConsumosLiveView` + `CSVColumnMapper` en `App.jsx`. *(ConsumosLiveView se borró en la fase 7.)*
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

- **`App.jsx` sigue siendo grande** (estado global + Ajustes, Importar y Reglas). Las secciones nuevas viven en `src/views/`; no agregar UI nueva en `App.jsx`.
- **El backend pierde datos al reiniciar.** Si el backend (Railway) se reinicia, hay que volver a subir los PDFs. El localStorage del browser es la fuente de verdad real.
- **Reglas de limpieza** se persisten en `Backend/data/reglas-usuario.json` (el único dato que sobrevive reinicios del backend). Renombrar un comercio desde la app también lo escribe ahí.
- **`cotizacion_cache` en localStorage** expira a los 30 minutos. Si la API de dolarapi.com falla y bluelytics también falla, `cotizacion` queda `null` y no se muestra nada (no rompe nada).
- **Proyección de cuotas:** hay una sola calculadora (`services/cuotas.js`); Mes, Evolución, Tarjetas y Cuotas usan `cuotasDelMes` (meses de pago). No duplicar criterios.
- **Colores de tarjetas:** `ui/identidad.js` (tabla del README del rediseño). Bancos no listados usan grafito + slots "otros" por orden de alta.
- **Los resúmenes no guardan pago mínimo ni cotización:** "A pagar" es el total; los USD de meses pagados se excluyen del reparto por tipo y se avisa.
- **`vite build`** falla en la VM de Cowork por el binario de rollup (no es un bug del código). Verificar con `npm run dev` en la Mac.

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
