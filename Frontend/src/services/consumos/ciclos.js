/**
 * Ciclos en curso de "Últimos consumos" — lógica pura (sin React ni storage).
 *
 * Vocabulario (ver CLAUDE.md):
 *  - bloque:  un plástico leído de un archivo (ult4, red, cierre, vto, consumos).
 *  - grupo:   una o más tarjetas que comparten CIERRE y VENCIMIENTO dentro del
 *             mismo archivo → se muestran en UNA SuperCard. Si difieren, cada
 *             una es su propio grupo (Card individual).
 *  - alias:   ult4 → { grupoKey, banco, red }. Recuerda a qué grupo pertenece
 *             cada plástico, así un archivo posterior con solo #3327 actualiza
 *             la misma SuperCard. Dos archivos distintos nunca forman un grupo nuevo.
 *  - ciclo:   estado actual del grupo (cierre, vto, límite, disponible…).
 *             estado 'provisional' hasta que llega el Resumen → 'conciliado'.
 */
import { diasEntre, hoyISO } from './comun.js';

export const claveGrupo = (banco, red, ult4) => `${banco}|${red}|${ult4}`;

/** Agrupa los bloques de UN archivo por (cierre, vencimiento). */
export function agruparBloques(bloques) {
  const grupos = [];
  for (const b of bloques) {
    const k = `${b.metadata.fecha_cierre}|${b.metadata.fecha_vencimiento}`;
    let g = grupos.find((x) => x.k === k);
    if (!g) grupos.push((g = { k, fecha_cierre: b.metadata.fecha_cierre, fecha_vencimiento: b.metadata.fecha_vencimiento, bloques: [] }));
    g.bloques.push(b);
  }
  return grupos.map(({ k, ...g }) => g);
}

/** ¿Algún plástico del grupo ya es conocido? Devuelve su alias o null. */
export function aliasConocido(grupoArchivo, alias) {
  for (const b of grupoArchivo.bloques) if (b.ult4 && alias[b.ult4]) return alias[b.ult4];
  return null;
}

/**
 * Aplica un archivo ya parseado.
 * @param {Object} p
 *  - grupos:        salida de agruparBloques
 *  - asignaciones:  { [indiceGrupo]: { banco } } para grupos sin alias (respuesta del usuario)
 *  - archivo:       { id, nombre }
 *  - estado:        { alias, ciclos, consumos }
 * @returns {{ alias, ciclos, consumos, aplicados: string[] }}  (objetos nuevos, no muta)
 */
export function aplicarArchivo({ grupos, asignaciones = {}, archivo, estado, ahora = new Date() }) {
  const alias = { ...estado.alias };
  const ciclos = { ...estado.ciclos };
  let consumos = [...estado.consumos];
  const aplicados = [];

  grupos.forEach((g, i) => {
    const conocido = aliasConocido(g, alias);
    const principal = g.bloques[0];
    const banco = conocido?.banco || asignaciones[i]?.banco;
    if (!banco) return; // sin banco no se puede ubicar: la UI lo pregunta antes
    const red = conocido?.red || principal.red;
    const grupoKey = conocido?.grupoKey || claveGrupo(banco, red, principal.ult4);

    for (const b of g.bloques) if (b.ult4) alias[b.ult4] = { grupoKey, banco, red };

    const cierre = g.fecha_cierre;
    const ult4s = g.bloques.map((b) => b.ult4).filter(Boolean);
    // Archivo nuevo reemplaza al anterior del mismo grupo y ciclo (así desaparecen
    // las anulaciones). También limpia consumos legacy (sin grupo) de esos plásticos.
    consumos = consumos.filter((c) => {
      if (c.grupo_key) return !(c.grupo_key === grupoKey && c.ciclo_cierre === cierre);
      return !ult4s.includes(c.tarjeta_ult4);
    });
    for (const b of g.bloques) {
      for (const c of b.consumos) {
        consumos.push({
          ...c,
          tarjeta: `${banco} ${red} ${c.tarjeta_ult4 || b.ult4}`.trim(),
          grupo_key: grupoKey,
          ciclo_cierre: cierre,
          estado: 'provisional',
        });
      }
    }

    const previo = ciclos[grupoKey];
    const esMasNuevo = !previo || !previo.fecha_cierre || !cierre || cierre >= previo.fecha_cierre;
    if (esMasNuevo) {
      const meta = principal.metadata;
      ciclos[grupoKey] = {
        grupoKey, banco, red,
        principal: previo?.principal || principal.ult4,
        miembros: ult4s,
        fecha_cierre: cierre,
        fecha_vencimiento: g.fecha_vencimiento,
        limite: meta.limite ?? null,
        disponible: meta.disponible ?? null,
        validado: g.bloques.every((b) => b.validado),
        actualizado_at: ahora.toISOString(),
        archivo_id: archivo.id,
        archivo_nombre: archivo.nombre,
        estado: previo && previo.fecha_cierre === cierre && previo.estado === 'conciliado' ? 'conciliado' : 'provisional',
      };
    }
    aplicados.push(grupoKey);
  });

  return { alias, ciclos, consumos, aplicados };
}

/** Números de una Card (individual o SuperCard). */
export function resumenCard(ciclo, consumos, hoy = hoyISO()) {
  const propios = consumos.filter((c) => c.grupo_key === ciclo.grupoKey && c.ciclo_cierre === ciclo.fecha_cierre && !c.es_pago);
  const orden = [ciclo.principal, ...ciclo.miembros.filter((u) => u !== ciclo.principal)];
  const miembros = orden.map((ult4) => {
    const cs = propios.filter((c) => c.tarjeta_ult4 === ult4);
    const cuotas = cs.filter((c) => c.es_cuota);
    const unPago = cs.filter((c) => !c.es_cuota);
    const sum = (arr, k) => arr.reduce((s, c) => s + (c[k] || 0), 0);
    return {
      ult4,
      n: cs.length,
      un_pago: sum(unPago, 'monto_pesos'),
      cuotas: sum(cuotas, 'monto_pesos'),
      n_cuotas: cuotas.length,
      usd: sum(cs, 'monto_dolares'),
      subtotal: sum(cs, 'monto_pesos'),
    };
  }).filter((m) => m.n > 0); // un plástico sin consumos en el ciclo no ocupa fila

  const total_ars = miembros.reduce((s, m) => s + m.subtotal, 0);
  const total_usd = miembros.reduce((s, m) => s + m.usd, 0);
  miembros.forEach((m) => { m.share = total_ars > 0 ? m.subtotal / total_ars : 0; });
  const dias_al_cierre = ciclo.fecha_cierre ? diasEntre(hoy, ciclo.fecha_cierre) : null;
  return {
    total_ars, total_usd,
    un_pago: miembros.reduce((s, m) => s + m.un_pago, 0),
    cuotas: miembros.reduce((s, m) => s + m.cuotas, 0),
    n_cuotas: miembros.reduce((s, m) => s + m.n_cuotas, 0),
    n: miembros.reduce((s, m) => s + m.n, 0),
    miembros,
    es_super: miembros.length > 1,
    dias_al_cierre,
    cerrado: dias_al_cierre != null && dias_al_cierre < 0,
  };
}

/** Cards a mostrar en el dashboard: ciclos provisionales, por fecha de cierre. */
export function cardsEnCurso(ciclos, consumos, hoy = hoyISO()) {
  const visibles = Object.values(ciclos).filter((c) => c.estado !== 'conciliado');
  const cards = visibles
    .map((ciclo) => ({ ciclo, datos: resumenCard(ciclo, consumos, hoy) }))
    .filter((x) => x.datos.n > 0)
    .sort((a, b) => (a.ciclo.fecha_cierre || '').localeCompare(b.ciclo.fecha_cierre || ''));
  // Excepción: mismo archivo, ciclos distintos → Cards separadas con una marca.
  for (const x of cards) {
    x.hermanos = cards.filter((y) => y !== x && y.ciclo.archivo_id && y.ciclo.archivo_id === x.ciclo.archivo_id).map((y) => y.ciclo.grupoKey);
  }
  return cards;
}

const normTxt = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function mismaRed(red, tipo) {
  const a = normTxt(red), b = normTxt(tipo);
  if (!a || !b) return false;
  const canon = (x) => (/AMEX|AMERICAN/.test(x) ? 'AMEX' : /MASTER/.test(x) ? 'MASTER' : /VISA/.test(x) ? 'VISA' : x);
  return canon(a) === canon(b);
}

/**
 * Al importar un Resumen: el ciclo del mismo banco+red con cierre a ≤5 días pasa
 * a 'conciliado' (la Card vuelve a mostrar el resumen). Cada consumo provisional
 * se empareja con un movimiento del resumen por fecha ±1 día + monto exacto,
 * UNO a UNO (dos peajes iguales el mismo día necesitan dos movimientos).
 * @returns {{ ciclos, consumos, conciliados: string[] }}
 */
export function conciliarConResumen({ ciclos, consumos }, { banco, tipo, fecha_cierre }, movimientos = []) {
  const nuevosCiclos = { ...ciclos };
  let nuevosConsumos = consumos;
  const conciliados = [];
  if (!fecha_cierre) return { ciclos, consumos, conciliados };

  for (const ciclo of Object.values(ciclos)) {
    if (ciclo.estado === 'conciliado' || !ciclo.fecha_cierre) continue;
    if (normTxt(ciclo.banco) !== normTxt(banco) || !mismaRed(ciclo.red, tipo)) continue;
    if (Math.abs(diasEntre(ciclo.fecha_cierre, fecha_cierre)) > 5) continue;

    const libres = movimientos.map((m) => ({ fecha: m.fecha_compra || m.fecha, ars: m.monto_pesos || 0, usd: m.monto_dolares || 0, usado: false }));
    nuevosConsumos = nuevosConsumos.map((c) => {
      if (c.grupo_key !== ciclo.grupoKey || c.ciclo_cierre !== ciclo.fecha_cierre || c.es_pago) return c;
      const m = libres.find((l) => !l.usado && l.fecha && c.fecha && Math.abs(diasEntre(l.fecha, c.fecha)) <= 1
        && Math.abs(l.ars - c.monto_pesos) < 0.01 && Math.abs(l.usd - c.monto_dolares) < 0.01);
      if (!m) return c;
      m.usado = true;
      return { ...c, estado: 'confirmado' };
    });
    nuevosCiclos[ciclo.grupoKey] = { ...ciclo, estado: 'conciliado', conciliado_at: new Date().toISOString() };
    conciliados.push(ciclo.grupoKey);
  }
  return { ciclos: nuevosCiclos, consumos: nuevosConsumos, conciliados };
}
