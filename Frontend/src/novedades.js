/**
 * Novedades por versión y Guía de uso.
 *
 * REGLA DEL PROYECTO: toda feature que cambie cómo se usa la app se cierra
 * actualizando este archivo:
 *   1. subir APP_VERSION y agregar su entrada al principio de NOVEDADES
 *      (2-3 puntos: qué cambió y cómo se usa);
 *   2. actualizar la sección que corresponda de GUIA.
 * El modal de Novedades aparece una sola vez por versión (localStorage
 * 'novedades_version_vista'); la Guía está siempre disponible en el menú.
 */

export const APP_VERSION = '2026.09.2';

export const NOVEDADES = [
  {
    version: '2026.09.2',
    fecha: 'septiembre 2026',
    titulo: 'Gastos fijos más inteligentes',
    puntos: [
      {
        titulo: 'Renombrar ya no cambia el tipo',
        texto: 'Si editás el nombre de un gasto, sigue siendo fijo o variable como antes. El nombre nuevo se aplica a todos los meses de ese comercio, también a los resúmenes que subas después.'
      },
      {
        titulo: 'Cambiá Fijo / Variable con un click',
        texto: 'En Movimientos, tocá la etiqueta de la columna Tipo y elegí. El cambio vale desde ese resumen en adelante. Para aplicarlo desde antes, cambialo en un resumen anterior.'
      },
      {
        titulo: 'Te preguntamos solo cuando hace falta',
        texto: 'Si un gasto fijo no aparece en el último resumen o cambió mucho de precio, la app te lo pregunta con un toque. Si no respondés, decide sola.'
      }
    ]
  }
];

export const GUIA = [
  {
    id: 'importar',
    titulo: 'Importar resúmenes',
    icono: 'Upload',
    items: [
      'Arrastrá los PDF de tus resúmenes a la sección Importar (podés subir varios juntos).',
      'Se leen automáticamente Galicia (Visa y Mastercard), BBVA y Santander. Otros bancos se leen con reconocimiento de imagen.',
      'Si subís el mismo resumen dos veces, se reemplaza: no se duplican los movimientos y se conservan tus cambios.',
      'Tus datos quedan guardados en este navegador. Exportalos desde Configuración → Datos para tener un respaldo.'
    ]
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    icono: 'LayoutDashboard',
    items: [
      'Tarjetas de resumen: Últimos consumos, Gastos fijos, Cuotas activas, Cuotas del próximo mes y Total a pagar del mes de vencimiento más reciente.',
      'Podés reordenar esas tarjetas arrastrándolas; el orden se recuerda.',
      'En Total a pagar, el botón + USD→ARS suma los dólares al dólar tarjeta del día.',
      'Tocá una barra del gráfico de proyección para ver qué cuotas vencen ese mes.',
      'Tocá Gastos fijos para ver la lista de movimientos fijos.'
    ]
  },
  {
    id: 'movimientos',
    titulo: 'Movimientos',
    icono: 'Receipt',
    items: [
      'Navegá por mes o por resumen, y filtrá por tarjeta, banco, fechas, moneda, cuotas o tipo de gasto.',
      'Para renombrar un comercio, pasá el mouse sobre la descripción y tocá el lápiz. El nombre nuevo se aplica a todos sus movimientos, pasados y futuros.',
      'Columna Tipo: tocá Fijo o Variable para cambiarlo. Vale desde ese resumen en adelante y la app ya no lo modifica sola.'
    ]
  },
  {
    id: 'fijos',
    titulo: 'Gastos fijos',
    icono: 'Repeat',
    items: [
      'La app detecta sola los gastos que se repiten todos los meses (suscripciones, seguros, prepagas, servicios), en pesos y en dólares.',
      'Cada gasto fijo se sigue mes a mes aunque aumente de precio (hasta ±25% contra el mes anterior).',
      'En comercios donde además comprás otras cosas (por ejemplo Apple), solo la suscripción se marca como fija.',
      'Si un fijo no aparece en el último resumen o cambió mucho de precio, te lo preguntamos. Si no respondés y falta dos resúmenes seguidos, se da por terminado.',
      'Las compras en cuotas no cuentan como gasto fijo: están en Cuotas.'
    ]
  },
  {
    id: 'cuotas',
    titulo: 'Cuotas',
    icono: 'Calendar',
    items: [
      'Muestra las compras en cuotas en curso, con progreso y monto por cuota.',
      'Las terminadas se esconden detrás de un botón para no mezclar historial con deuda.',
      'Si el banco deja de facturar un plan que no terminó, se marca como interrumpido y no se proyecta.',
      'Las cuotas en dólares se pasan a pesos con el dólar tarjeta del día.'
    ]
  },
  {
    id: 'live',
    titulo: 'Últimos consumos',
    icono: 'Zap',
    items: [
      'Importá el Excel de "Últimos consumos" de Galicia para ver lo gastado antes de que cierre el resumen.',
      'Es independiente de los resúmenes: no modifica movimientos ni cuotas.'
    ]
  },
  {
    id: 'reintegros',
    titulo: 'Reintegros',
    icono: 'RefreshCcw',
    items: [
      'Lista devoluciones, bonificaciones y créditos. Por defecto muestra los del último resumen de cada tarjeta; el histórico completo está a un click.'
    ]
  },
  {
    id: 'config',
    titulo: 'Configuración y temas',
    icono: 'Settings',
    items: [
      'Desde el engranaje: nombre de cada tarjeta, preferencias de moneda y fecha, alertas de vencimiento y de última cuota, exportación de datos y temas.',
      'El botón de sol/luna cambia entre los temas Liquid, Claro y Oscuro.',
      'El buscador de arriba filtra la vista en la que estás.'
    ]
  }
];
