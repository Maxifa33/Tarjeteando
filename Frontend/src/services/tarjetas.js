/**
 * Sección Tarjetas — qué muestra cada plástico de la pila (lógica pura).
 *
 * Una entrada por tarjeta de la lista (storage) + una por cada grupo de Últimos
 * consumos que no es de ninguna (sin resúmenes o sin banco asignado). Los grupos
 * (Card / SuperCard) salen de services/consumos/ciclos.js: acá no se reagrupa nada.
 *
 * Estado de cada una:
 *  - 'cerrado':  hay un resumen cerrado que todavía no venció → muestra lo que hay que pagar.
 *                Si además hay Últimos consumos del ciclo siguiente, van en `proximoCiclo`.
 *  - 'en_curso': Últimos consumos del ciclo abierto → "Va por · estimado".
 *  - 'pagado':   solo resúmenes ya vencidos → el último.
 *  - 'sin_datos'.
 *
 * Fechas: strings 'YYYY-MM-DD'. Nunca new Date('YYYY-MM-DD').
 */
import { resumenCard } from './consumos/ciclos.js';
import { hoyISO } from './consumos/comun.js';
import { cicloEsDeTarjeta } from './mes.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function vivosConDatos(ciclosLive = {}, consumosLive = [], hoy) {
  return Object.values(ciclosLive || {})
    .filter((c) => c && c.estado !== 'conciliado')
    .map((ciclo) => ({ ciclo, datos: resumenCard(ciclo, consumosLive, hoy) }))
    .filter((x) => x.datos.n > 0)
    .sort((a, b) => String(b.ciclo.fecha_cierre || '').localeCompare(String(a.ciclo.fecha_cierre || '')));
}

const plasticosDe = (datos) => datos.miembros.map((m) => ({
  ult4: m.ult4, n: m.n, unPago: r2(m.un_pago), cuotas: r2(m.cuotas), subtotal: r2(m.subtotal), usd: r2(m.usd), share: m.share
}));

function vivo(x) {
  if (!x) return null;
  return {
    grupoKey: x.ciclo.grupoKey,
    total: r2(x.datos.total_ars),
    totalUsd: r2(x.datos.total_usd),
    cierre: x.ciclo.fecha_cierre || null,
    vencimiento: x.ciclo.fecha_vencimiento || null,
    limite: x.ciclo.limite ?? null,
    disponible: x.ciclo.disponible ?? null,
    actualizado: x.ciclo.actualizado_at || null,
    miembros: x.ciclo.miembros || [],
    plasticos: plasticosDe(x.datos)
  };
}

/**
 * @returns {Array<{ id, nombre, banco, red, tarjeta, estado, total, totalUsd, cierre, vencimiento,
 *   limite, disponible, actualizado, plasticos, ultimos4, superCard, sinBanco, grupoKeys,
 *   resumen, proximoCiclo }>}
 */
export function armarTarjetas({ hoy = hoyISO(), tarjetas = [], resumenes = [], ciclosLive = {}, consumosLive = [] } = {}) {
  const vivos = vivosConDatos(ciclosLive, consumosLive, hoy);
  const usados = new Set();

  const lista = tarjetas.map((t) => {
    const propios = resumenes
      .filter((r) => r && r.tarjeta === t.nombre)
      .sort((a, b) => String(b.fecha_cierre || `${b.anio}-${b.mes}`).localeCompare(String(a.fecha_cierre || `${a.anio}-${a.mes}`)));
    const ultimo = propios[0] || null;
    const cerrado = propios.find((r) => r.fecha_vencimiento && r.fecha_vencimiento >= hoy) || null;
    const x = vivos.find((v) => !usados.has(v.ciclo.grupoKey) && cicloEsDeTarjeta(v.ciclo, t));
    if (x) usados.add(x.ciclo.grupoKey);
    // Un ciclo en curso que cierra antes que el resumen cerrado es el mismo ciclo (ya conciliado de hecho).
    const live = x && (!cerrado || !cerrado.fecha_cierre || (x.ciclo.fecha_cierre || '') > cerrado.fecha_cierre) ? vivo(x) : null;

    const base = {
      id: t.nombre, nombre: t.nombre, banco: t.banco || '', red: t.tipo || t.red || '', tarjeta: t,
      sinBanco: false, grupoKeys: live ? [live.grupoKey] : [], resumen: ultimo,
      limite: live?.limite ?? null, disponible: live?.disponible ?? null, actualizado: live?.actualizado ?? null,
      plasticos: live?.plasticos || [], ultimos4: live?.miembros || [], superCard: (live?.miembros || []).length > 1
    };
    if (cerrado) {
      return {
        // El reparto por plástico de Últimos consumos es del ciclo siguiente: no va con el cerrado.
        ...base, estado: 'cerrado', resumen: cerrado, plasticos: [],
        total: r2(cerrado.total_a_pagar_pesos), totalUsd: r2(cerrado.total_a_pagar_dolares),
        cierre: cerrado.fecha_cierre || null, vencimiento: cerrado.fecha_vencimiento || null,
        proximoCiclo: live ? { total: live.total, cierre: live.cierre, vencimiento: live.vencimiento } : null
      };
    }
    if (live) {
      return { ...base, estado: 'en_curso', total: live.total, totalUsd: live.totalUsd, cierre: live.cierre, vencimiento: live.vencimiento, proximoCiclo: null };
    }
    if (ultimo) {
      return {
        ...base, estado: 'pagado', total: r2(ultimo.total_a_pagar_pesos), totalUsd: r2(ultimo.total_a_pagar_dolares),
        cierre: ultimo.fecha_cierre || null, vencimiento: ultimo.fecha_vencimiento || null, proximoCiclo: null
      };
    }
    return { ...base, estado: 'sin_datos', total: 0, totalUsd: 0, cierre: null, vencimiento: null, proximoCiclo: null };
  });

  // Grupos de Últimos consumos que no son de ninguna tarjeta de la lista.
  vivos.filter((x) => !usados.has(x.ciclo.grupoKey)).forEach((x) => {
    const v = vivo(x);
    const c = x.ciclo;
    lista.push({
      id: c.grupoKey,
      nombre: `${c.banco || 'Sin banco'} ${c.red || ''}`.trim(),
      banco: c.banco || '', red: c.red || '', tarjeta: null,
      sinBanco: !c.banco, grupoKeys: [c.grupoKey], resumen: null,
      estado: 'en_curso', total: v.total, totalUsd: v.totalUsd, cierre: v.cierre, vencimiento: v.vencimiento,
      limite: v.limite, disponible: v.disponible, actualizado: v.actualizado,
      plasticos: v.plasticos, ultimos4: v.miembros, superCard: v.miembros.length > 1, proximoCiclo: null
    });
  });
  return lista;
}

/** Busca una entrada por id o por la clave de su grupo (el id cambia al asignar el banco). */
export function buscarTarjeta(lista = [], id) {
  if (!id) return null;
  return lista.find((t) => t.id === id) || lista.find((t) => t.grupoKeys.includes(id)) || null;
}

/** Cifras de la vista "Todas". */
export function resumenTodas(lista = []) {
  const enCurso = lista.filter((t) => t.estado === 'en_curso');
  const cerradas = lista.filter((t) => t.estado === 'cerrado');
  const conLimite = lista.filter((t) => t.limite > 0);
  return {
    enCurso: r2(enCurso.reduce((s, t) => s + t.total, 0)),
    nEnCurso: enCurso.length,
    cerrado: r2(cerradas.reduce((s, t) => s + t.total, 0)),
    cerradas,
    disponible: conLimite.length ? r2(conLimite.reduce((s, t) => s + (t.disponible || 0), 0)) : null,
    limite: conLimite.length ? r2(conLimite.reduce((s, t) => s + t.limite, 0)) : null,
    plasticos: lista.reduce((s, t) => s + Math.max(1, t.ultimos4.length), 0)
  };
}

/**
 * Nombre para mostrar de una tarjeta en cualquier vista. Los nombres personalizados
 * (localStorage 'nombresTarjetas') se guardan por id de la tarjeta de la lista, o por
 * 'live:<grupoKey>' si la tarjeta solo existe por Últimos consumos.
 */
export function nombreVisible(tarjetaId, { tarjetas = [], nombres = {}, fallback = null } = {}) {
  const t = tarjetas.find((x) => x.nombre === tarjetaId);
  if (t && nombres[t.id]) return nombres[t.id];
  if (nombres[`live:${tarjetaId}`]) return nombres[`live:${tarjetaId}`];
  return fallback || tarjetaId;
}

/**
 * Cuando una tarjeta que solo existía por Últimos consumos pasa a tener resumen, su
 * nombre personalizado ('live:<grupoKey>') se muda a la clave de la tarjeta. Se
 * empareja por banco + red contra todos los ciclos (también los ya conciliados).
 * Devuelve el mismo objeto si no hay nada que mudar.
 */
export function migrarNombresLive(nombres = {}, { tarjetas = [], ciclosLive = {} } = {}) {
  const claves = Object.keys(nombres).filter((k) => k.startsWith('live:'));
  if (!claves.length) return nombres;
  let out = nombres;
  claves.forEach((k) => {
    const grupoKey = k.slice(5);
    const ciclo = ciclosLive[grupoKey];
    if (!ciclo) return;
    const t = tarjetas.find((x) => cicloEsDeTarjeta(ciclo, x));
    if (!t || t.id == null) return;
    if (out === nombres) out = { ...nombres };
    if (!out[t.id]) out[t.id] = out[k];
    delete out[k];
  });
  return out;
}
