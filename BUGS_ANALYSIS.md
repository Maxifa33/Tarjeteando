# Análisis de Bugs - Tarjetas App

## Estado: EN PROGRESO

---

## BUGS IDENTIFICADOS

### BUG 1: Color de tarjeta Macro (NARANJA en vez de AZUL/BLANCO)
**Estado:** ❌ No aplicado en UI
**Problema:** La card de Macro se muestra naranja, debería ser celeste/blanco con texto azul oscuro
**Causa raíz:**
- Se modificó BANK_THEMES pero el componente usa fallback a Galicia (naranja)
- La función getCardTheme existe pero posiblemente no se está usando correctamente
**Intentos fallidos:**
- Agregar textDark: true y textColor: 'text-blue-900' a BANK_THEMES
- Crear función getCardTheme() para match flexible

### BUG 2: Fechas en Card (muestra "Cierre en X días" en vez de fechas reales)
**Estado:** ❌ No aplicado en UI
**Problema:** La card muestra "12/2" y "20/2" (próximo cierre) en vez de "13/11" y "01/12" (cierre actual del resumen)
**Causa raíz:**
- El componente CreditCardVisual usa stats.dias_hasta_cierre
- No usa ultimo_resumen.fecha_cierre ni fecha_vencimiento
**Intentos fallidos:**
- Se modificó el JSX para mostrar ultimoResumen.fecha_cierre pero no se ve reflejado

### BUG 3: Monto incorrecto ($6.400.800 vs $440.531)
**Estado:** ✅ Corregido en backend (con validación post-proceso)
**Problema:** Vision API confunde códigos de barra con montos
**Solución aplicada:** Validación que detecta montos > 5M y usa suma de movimientos

### BUG 4: Gráfico de proyección de cuotas no visible
**Estado:** ❓ Por verificar en UI
**Problema:** El gráfico existe en código pero no aparece en el Dashboard
**Causa posible:** Condición proyeccionData.length > 0 no se cumple

### BUG 5: Edición de nombres de tarjetas
**Estado:** ❓ Por verificar en UI
**Problema:** El botón de editar debería aparecer al hover sobre el nombre
**Causa posible:** El código existe pero puede no estar visible

---

## DIAGNÓSTICO TÉCNICO

El problema principal es que **los cambios en el código fuente NO se están reflejando en la UI**.

Posibles causas:
1. El build no se está sirviendo correctamente
2. Cache del navegador
3. El frontend dev server no está recargando
4. Los archivos compilados (dist/) no coinciden con el código fuente

---

## PLAN DE ACCIÓN

1. Verificar qué archivo está sirviendo el frontend
2. Forzar rebuild completo del frontend
3. Verificar que los cambios están en el código fuente
4. Limpiar cache y servir de nuevo
