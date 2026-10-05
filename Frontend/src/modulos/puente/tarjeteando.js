/**
 * Puente de SOLO LECTURA entre los módulos y Tarjeteando.
 *
 * Recibe el objeto `mes` que App.jsx ya calcula con services/mes.js (cicloDePago,
 * cuotasDelMes, composicionPorTarjeta, composicionDesdeTarjetas) y devuelve un resumen
 * plano para los módulos. No importa storage.js, no escribe nada y no muta lo recibido:
 * así las cifras son por construcción las mismas que la cápsula de Mes.
 *
 * Los datos de Tarjeteando viven en este navegador (localStorage): el resumen solo
 * existe en el dispositivo donde se importaron los resúmenes.
 */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {Object|null} mes  { ciclo: { mesKey, porTarjeta }, comp: { cuotas, fijos, fijosUsd, variables, total }, cuotas? }
 * @returns {{ mesKey, total, cuotas, fijos, variables, usd: { total, fijos, cuotas }, sinDatos: string[], tarjetasConDatos: number, fuente: 'dispositivo_local' } | null}
 */
export function resumenTarjetasDelMes(mes) {
  if (!mes || !mes.ciclo) return null;
  const porTarjeta = Array.isArray(mes.ciclo.porTarjeta) ? mes.ciclo.porTarjeta : [];
  const comp = mes.comp || {};
  const conDatos = porTarjeta.filter((t) => t.fuente !== 'sin_datos');
  const cuotasUsd = Number(mes.cuotas?.totalUsd) || 0;
  return {
    mesKey: mes.ciclo.mesKey || null,
    total: r2(comp.total),
    cuotas: r2(comp.cuotas),
    fijos: r2(comp.fijos),
    variables: r2(comp.variables),
    usd: {
      total: r2(conDatos.reduce((s, t) => s + (Number(t.totalUsd) || 0), 0)),
      fijos: r2(comp.fijosUsd),
      cuotas: r2(cuotasUsd)
    },
    sinDatos: porTarjeta.filter((t) => t.fuente === 'sin_datos').map((t) => t.tarjetaId),
    tarjetasConDatos: conDatos.length,
    fuente: 'dispositivo_local'
  };
}
