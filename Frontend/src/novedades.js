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

export const APP_VERSION = '2026.09.5';

export const NOVEDADES = [
  {
    // 2026.09.5 incluye lo de 2026.09.4 (nunca salió sola): el modal muestra solo la última.
    version: '2026.09.5',
    fecha: 'septiembre 2026',
    titulo: 'App nueva: Mes, Tarjetas, Movimientos y Cuotas',
    puntos: [
      {
        titulo: 'Poné un tope mensual',
        texto: 'En Mes ves cuánto del próximo pago ya está comprometido (cuotas, fijos y lo que vas gastando) y cuánto te queda libre hasta tu tope.'
      },
      {
        titulo: 'Evolución y proyección en un solo gráfico',
        texto: 'Lo que pagaste, el mes en curso y lo que ya está firmado para los próximos meses, en el mismo eje. Tocá un mes para ver el detalle.'
      },
      {
        titulo: 'Renombrá y clasificá desde el detalle',
        texto: 'Tocá un movimiento para cambiarle el nombre (vale para todos los meses) o marcarlo como Fijo o Variable. Reintegros ahora es un filtro de Movimientos.'
      },
      {
        titulo: 'Últimos consumos ahora está en Movimientos',
        texto: 'Lo que gastaste desde el último cierre aparece junto con tus movimientos, marcado En curso. Usá el filtro En curso para verlo solo. Cuando llega el resumen, cada consumo queda una sola vez.'
      },
      {
        titulo: 'Resolvé los planes que el banco dejó de facturar',
        texto: 'En Cuotas, los planes "a revisar" se marcan como terminados o vigentes con un toque. Y cada tarjeta tiene su plástico, con sus plásticos, consumos y cuotas, en Tarjetas.'
      }
    ]
  },
  {
    version: '2026.09.3',
    fecha: 'septiembre 2026',
    titulo: 'Últimos consumos en el dashboard',
    puntos: [
      {
        titulo: 'Una sola bandeja para importar',
        texto: 'En Importar arrastrá juntos resúmenes (PDF o capturas) y últimos consumos (Excel o CSV). La app reconoce cuál es cuál. Lee Santander, Galicia, Amex y Macro; si tu banco usa otro formato, lo aprende la primera vez.'
      },
      {
        titulo: 'Cuánto va tu próximo resumen',
        texto: 'Cada vez que subís los últimos consumos, el dashboard muestra por tarjeta cuánto llevás gastado en el ciclo, separado en 1 pago y cuotas, con el cierre y el vencimiento. Cuando subís el resumen de ese mes, lo reemplaza.'
      },
      {
        titulo: 'Tarjetas del mismo resumen, juntas',
        texto: 'Si un archivo trae varias tarjetas con el mismo cierre y vencimiento (por ejemplo una renovada), se muestran en una sola card, con el monto de cada una por separado.'
      }
    ]
  },
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
      'Tocá Importar (arriba a la derecha, o en el riel en el celular) y arrastrá tus resúmenes (PDF o capturas) y tus últimos consumos (Excel .xlsx/.xls o CSV del home banking). Podés subir todo junto: la app reconoce cuál es cuál.',
      'Últimos consumos: bajalos del home banking cuantas veces quieras antes del cierre. Cada archivo nuevo reemplaza al anterior de esa tarjeta, así lo anulado desaparece.',
      'Se importa al instante. Si el archivo no dice de qué banco es la tarjeta, Tarjetas te lo pregunta una sola vez.',
      'Si el formato de tu banco es nuevo, la app lo interpreta sola (o te pide indicar las columnas) y lo recuerda para la próxima.',
      'Se leen automáticamente Galicia (Visa y Mastercard), BBVA y Santander. Otros bancos se leen con reconocimiento de imagen.',
      'Si subís el mismo resumen dos veces, se reemplaza: no se duplican los movimientos y se conservan tus cambios.',
      'Tus datos quedan guardados en este navegador. Exportalos desde Más → Ajustes → Datos para tener un respaldo.',
      'Para borrar los Últimos consumos importados, usá "Borrar Últimos consumos importados" debajo de la zona de carga.'
    ]
  },
  {
    id: 'mes',
    titulo: 'Mes',
    icono: 'PieChart',
    items: [
      'Muestra el próximo pago: el mes del vencimiento más cercano. Por cada tarjeta usa el resumen cerrado que vence ese mes o, si todavía no cerró, sus últimos consumos.',
      'La cápsula separa lo que ya está comprometido: cuotas, gastos fijos y lo variable que vas gastando.',
      'Poné un tope mensual con el control de la derecha (o tocá el número para escribirlo). La frase te dice cuánto te queda o por cuánto te pasás.',
      'Próximo mes: cuotas y fijos que ya van a aparecer sí o sí, antes de gastar un peso.',
      'Evolución y proyección: hasta 12 meses pagados, el mes en curso y 6 meses ya comprometidos. Pasá el mouse o tocá una columna para ver el detalle. Podés verlo por tarjeta o por tipo, en gráfico o en tabla.',
      'Tocá una tarjeta de En curso para abrirla en Tarjetas.'
    ]
  },
  {
    id: 'tarjetas',
    titulo: 'Tarjetas',
    icono: 'CreditCard',
    items: [
      'Tus tarjetas en una pila, cada una con los colores de su banco. Tocá una para ver su detalle; tocala de nuevo (o "Todas las tarjetas") para volver.',
      'Si varias tarjetas comparten cierre y vencimiento, se ven como un solo plástico con cada plástico por separado en el detalle.',
      'En el detalle: cuánto va o cuánto hay que pagar, qué parte del mes es de esa tarjeta, cierre, vencimiento, disponible, últimos consumos, cuotas e historial.',
      'Tocá el lápiz para cambiarle el nombre a una tarjeta. El nombre se usa en toda la app.',
      'En "Todas las tarjetas" está la lista de resúmenes cargados, donde podés borrar uno.'
    ]
  },
  {
    id: 'movimientos',
    titulo: 'Movimientos',
    icono: 'Receipt',
    items: [
      'Navegá por mes o por resumen, y filtrá con un toque: Variables, Fijos, Cuotas, Reintegros o En dólares. El buscador filtra por nombre o por la descripción del resumen.',
      'Las cuotas del período van juntas, plegadas arriba de la lista.',
      'Tocá un movimiento para ver su detalle: renombrarlo (crea una regla que vale para todos los meses de ese comercio) o marcarlo como Fijo o Variable (vale desde ese resumen en adelante).',
      'Reintegros muestra las devoluciones, bonificaciones y créditos del último resumen de cada tarjeta; el histórico está en "Ver anteriores".',
      'En curso muestra lo que importaste de Últimos consumos y todavía no está en un resumen: total, cantidad y % del último cierre. Por mes, esos consumos se suman a su mes; por resumen, cada tarjeta tiene su ficha "en curso".'
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
      'Si un fijo no aparece en el último resumen o cambió mucho de precio, te lo preguntamos en Mes, con Deshacer. Si no respondés y falta dos resúmenes seguidos, se da por terminado.',
      'Las compras en cuotas no cuentan como gasto fijo: están en Cuotas.'
    ]
  },
  {
    id: 'cuotas',
    titulo: 'Cuotas',
    icono: 'Calendar',
    items: [
      'Una línea de tiempo con cada plan: lo pagado, este mes y lo que falta. Arriba, cuánto te queda por pagar y cuánto se libera el mes que viene.',
      'Filtrá En curso, A revisar, Terminados o Todos.',
      'Si el banco deja de facturar un plan que no terminó, queda "a revisar" y no se proyecta. En su detalle elegís Marcar como terminado o Sigue vigente (con Deshacer).',
      'Las cuotas en dólares se pasan a pesos con el dólar tarjeta del día y se marcan como estimadas.'
    ]
  },
  {
    id: 'live',
    titulo: 'Últimos consumos',
    icono: 'Zap',
    items: [
      'Importalos en Importar, como los resúmenes. Sus consumos aparecen en Movimientos con la etiqueta En curso (filtro En curso para verlos solos).',
      'Mes y Tarjetas usan los mismos consumos para el total en curso de cada tarjeta.',
      'Todavía no tienen tipo fijo o variable: se define cuando llega el resumen, que los reemplaza sin duplicar.'
    ]
  },
  {
    id: 'config',
    titulo: 'Más, apariencia y ajustes',
    icono: 'Settings',
    items: [
      'El botón Más (⋯, arriba a la derecha) tiene Ajustes, Reglas de nombres, esta guía y la apariencia (Sistema, Claro u Oscuro, y Reducir transparencia).',
      'En el celular, las secciones están en el riel de abajo a la derecha; desde Más lo podés pasar a la izquierda.',
      'Ajustes: tarjetas, preferencias, alertas y exportar o importar tus datos.',
      'La lupa busca en Movimientos; en Cuotas filtra los planes.'
    ]
  }
];
