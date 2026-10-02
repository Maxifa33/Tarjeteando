/**
 * Movimientos — lógica de la vista, sin React (testeable en Node).
 *
 * Mantiene la semántica de la vista vieja:
 *  - 'mes':     el mes calendario de fecha_compra; meses ordenados del más reciente
 *               al más viejo; por defecto el más reciente.
 *  - 'resumen': los movimientos de un resumen (resumen_id); resúmenes ordenados por
 *               fecha_cierre (o anio/mes) del más reciente al más viejo; por defecto
 *               el más reciente.
 *  - búsqueda:  nombre limpio o descripción original, sin distinguir mayúsculas.
 *
 * Tipo de cada fila (disjuntos): reintegro > cuota > fijo > variable.
 * Fechas: strings 'YYYY-MM-DD'. Nunca new Date('YYYY-MM-DD').
 */
import { claveComercio } from './series.js';
import { cardsEnCurso } from './consumos/ciclos.js';
import { diasEntre } from './consumos/comun.js';
import { cicloEsDeTarjeta } from './mes.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Nombre limpio de un comercio según las reglas del usuario (misma lógica que usa
 * fetchData con los movimientos de resúmenes). Primero las reglas por clave de
 * comercio (renombrar): gana la más reciente. Después las reglas viejas (exacta o
 * regex). Devuelve null si ninguna aplica.
 */
export function nombreSegunReglas(referenciaOriginal, reglas = []) {
  if (!referenciaOriginal || !reglas.length) return null;
  const reglasClave = reglas
    .filter((r) => r.es_clave)
    .sort((a, b) => String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || '')));
  if (reglasClave.length) {
    const clave = claveComercio(referenciaOriginal);
    const rc = clave && reglasClave.find((r) => r.patron === clave);
    if (rc) return rc.nombre_limpio;
  }
  const regla = reglas.find((r) => {
    if (r.es_clave) return false;
    if (r.es_exacta) return r.patron === referenciaOriginal;
    try {
      return new RegExp(r.patron, 'i').test(referenciaOriginal);
    } catch {
      return String(r.patron).toLowerCase() === String(referenciaOriginal).toLowerCase();
    }
  });
  return regla ? regla.nombre_limpio : null;
}

/**
 * Consumos de Últimos consumos que todavía no están en un resumen, con la forma de
 * un movimiento (origen 'en_curso'). Son EXACTAMENTE los que Mes y Tarjetas cuentan
 * como en curso: los grupos de cardsEnCurso y sus consumos de resumenCard (no pagos).
 * Un ciclo que ya cubre un resumen importado de la misma tarjeta (cierre ±5 días o
 * posterior) se deja afuera, para no duplicar con los movimientos del resumen.
 */
export function movimientosEnCurso({ consumosLive = [], ciclosLive = {}, resumenes = [], tarjetas = [], reglas = [], hoy } = {}) {
  const filas = [];
  cardsEnCurso(ciclosLive, consumosLive, hoy).forEach(({ ciclo }) => {
    const tarjeta = tarjetas.find((t) => cicloEsDeTarjeta(ciclo, t)) || null;
    if (tarjeta && ciclo.fecha_cierre) {
      const cubierto = resumenes.some((r) => r.tarjeta === tarjeta.nombre && r.fecha_cierre
        && (r.fecha_cierre >= ciclo.fecha_cierre || Math.abs(diasEntre(r.fecha_cierre, ciclo.fecha_cierre)) <= 5));
      if (cubierto) return;
    }
    const tarjetaId = tarjeta ? tarjeta.nombre : ciclo.grupoKey;
    const etiqueta = tarjeta ? tarjeta.nombre : `${ciclo.banco || 'Sin banco'} ${ciclo.red || ''}`.trim();
    consumosLive
      .filter((c) => c.grupo_key === ciclo.grupoKey && c.ciclo_cierre === ciclo.fecha_cierre && !c.es_pago)
      .forEach((c) => {
        const cuota = c.es_cuota && c.cuota_actual && c.total_cuotas ? `${c.cuota_actual}/${c.total_cuotas}` : (c.cuotas_texto || '');
        const original = c.descripcion || '';
        filas.push({
          id: `live:${c.id}`,
          origen: 'en_curso',
          resumen_id: null,
          fecha_compra: c.fecha || null,
          fecha: c.fecha || null,
          referencia_original: original,
          referencia_limpia: nombreSegunReglas(original, reglas) || original,
          tarjeta: tarjetaId,
          tarjeta_label: etiqueta,
          grupoKey: ciclo.grupoKey,
          tarjeta_ult4: c.tarjeta_ult4 || null,
          monto_pesos: Number(c.monto_pesos) || 0,
          monto_dolares: Number(c.monto_dolares) || 0,
          cuota_texto: cuota,
          categoria: c.categoria || null,
          es_pendiente: !!c.es_pendiente,
          vencimiento: ciclo.fecha_vencimiento || null,
          actualizado: ciclo.actualizado_at || null
        });
      });
  });
  return filas;
}

/**
 * Cabecera del filtro 'En curso': total neto en pesos (igual que el en curso de Mes y
 * Tarjetas), dólares, cantidad, % del último cierre de esas tarjetas y cuándo se
 * actualizó por última vez.
 */
export function resumenEnCurso(filas = [], resumenes = [], { gruposDelMes = null } = {}) {
  const total = r2(filas.reduce((s, m) => s + (Number(m.monto_pesos) || 0), 0));
  const totalUsd = r2(filas.reduce((s, m) => s + (Number(m.monto_dolares) || 0), 0));
  const tarjetas = [...new Set(filas.map((m) => m.tarjeta))];
  let ref = 0;
  tarjetas.forEach((t) => {
    const ultimo = ordenarResumenes(resumenes.filter((r) => r.tarjeta === t))[0];
    if (ultimo) ref += Number(ultimo.total_consumos_pesos) || Number(ultimo.total_a_pagar_pesos) || 0;
  });
  // Qué parte entra en el pago que muestra Mes (los mismos grupos que usa cicloDePago:
  // coincide con su en curso) y qué parte es de ciclos que Mes todavía no cuenta
  // (tarjetas que cerraron y siguieron comprando).
  const grupos = gruposDelMes ? new Set(gruposDelMes) : null;
  const delMes = grupos ? r2(filas.filter((m) => grupos.has(m.grupoKey)).reduce((s, m) => s + (Number(m.monto_pesos) || 0), 0)) : total;
  return {
    total, totalUsd,
    delMes,
    posterior: r2(total - delMes),
    cantidad: filas.length,
    pctUltimoCierre: ref > 0 ? Math.round((total / ref) * 100) : null,
    actualizado: filas.map((m) => m.actualizado).filter(Boolean).sort().pop() || null
  };
}

/** 'YYYY-MM' del mes calendario de una fecha del parser (o null). */
export function mesKeyDeFecha(valor) {
  const m = String(valor || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

const fechaDe = (m) => m?.fecha_compra || m?.fecha || null;

/** Meses con movimientos, del más reciente al más viejo (por fecha_compra, como la vista vieja). */
export function mesesDisponibles(movs = [], enCurso = []) {
  return [...new Set([...movs, ...enCurso].map((m) => mesKeyDeFecha(m.fecha_compra)).filter(Boolean))].sort().reverse();
}

/** Resúmenes del más reciente al más viejo (fecha_cierre; si falta, anio/mes). */
export function ordenarResumenes(resumenes = []) {
  const clave = (r) => r.fecha_cierre || `${r.anio}-${String(r.mes).padStart(2, '0')}-01`;
  return [...resumenes].sort((a, b) => clave(b).localeCompare(clave(a)));
}

const REGEX_REINTEGRO = /reintegro|devoluci[oó]n|cr[eé]dito|bonificaci[oó]n/i;

/** Mismo criterio que App.jsx para detectar reintegros. */
export function esReintegro(m) {
  return m.monto_pesos < 0 || m.monto_dolares < 0 || REGEX_REINTEGRO.test(m.referencia_original || m.referencia_limpia || '');
}

/** 'reintegro' | 'cuota' | 'fijo' | 'variable' */
export function tipoDeFila(m, fijos = new Set()) {
  // En curso: todavía no hay fijos (se sabe cuando llega el resumen).
  if (m.origen === 'en_curso') {
    if ((Number(m.monto_pesos) || 0) < 0 || (Number(m.monto_dolares) || 0) < 0) return 'reintegro';
    return m.cuota_texto ? 'cuota' : 'variable';
  }
  if (esReintegro(m)) return 'reintegro';
  if (m.cuota_texto) return 'cuota';
  if (m.id && fijos.has(m.id)) return 'fijo';
  return 'variable';
}

const coincideTexto = (m, texto, { conTarjeta = false } = {}) => {
  if (!texto) return true;
  const q = texto.toLowerCase();
  return !!(m.referencia_limpia?.toLowerCase().includes(q)
    || m.referencia_original?.toLowerCase().includes(q)
    || (conTarjeta && m.tarjeta?.toLowerCase().includes(q)));
};

/**
 * Filtra como la vista vieja y agrega los filtros nuevos en una fila.
 * @param {Object} o
 *  - modo: 'mes' | 'resumen'; periodo: 'YYYY-MM' (modo mes); resumenId (modo resumen)
 *  - tipo: 'todos' | 'variables' | 'fijos' | 'cuotas' | 'reintegros' | 'usd'
 *  - texto: búsqueda; tarjeta: nombre de tarjeta (desde Tarjetas); fijos: Set de ids
 *  - reintegros: lista de App (con es_reciente); verAnteriores: bool
 * Con tipo 'reintegros' no se filtra por período: son los mismos que mostraba
 * ReintegrosView (los del último resumen de cada tarjeta, o todos con verAnteriores).
 */
export function filtrarMovimientos(movs = [], o = {}) {
  const { modo = 'mes', periodo = null, resumenId = null, tipo = 'todos', texto = '', tarjeta = '', fijos = new Set(), reintegros = null, verAnteriores = false, enCurso = [] } = o;

  // 'En curso': solo los consumos de Últimos consumos, sin importar el período.
  if (tipo === 'en_curso') {
    return enCurso
      .filter((m) => coincideTexto(m, texto))
      .filter((m) => !tarjeta || m.tarjeta === tarjeta);
  }

  if (tipo === 'reintegros') {
    const base = reintegros || movs.filter(esReintegro).map((m) => ({ ...m, es_reciente: true }));
    return base
      .filter((m) => verAnteriores || m.es_reciente)
      .filter((m) => coincideTexto(m, texto, { conTarjeta: true }))
      .filter((m) => !tarjeta || m.tarjeta === tarjeta);
  }

  // Por resumen, la ficha 'En curso' de una tarjeta: 'en_curso:<tarjeta>'.
  const fichaEnCurso = modo === 'resumen' && String(resumenId || '').startsWith('en_curso:')
    ? String(resumenId).slice('en_curso:'.length) : null;
  // Por mes, los consumos en curso se mezclan con los del período (no se duplican:
  // movimientosEnCurso ya deja afuera lo que está en un resumen).
  const base = fichaEnCurso !== null
    ? enCurso.filter((m) => m.tarjeta === fichaEnCurso)
    : modo === 'mes' ? [...movs, ...enCurso] : movs;

  return base.filter((m) => {
    if (fichaEnCurso !== null) {
      // ya filtrado por tarjeta
    } else if (modo === 'resumen') {
      if (resumenId && m.resumen_id !== resumenId) return false;
    } else if (periodo && mesKeyDeFecha(m.fecha_compra) !== periodo) {
      return false;
    }
    if (!coincideTexto(m, texto)) return false;
    if (tarjeta && m.tarjeta !== tarjeta) return false;
    const t = tipoDeFila(m, fijos);
    if (tipo === 'variables' && t !== 'variable') return false;
    if (tipo === 'fijos' && t !== 'fijo') return false;
    if (tipo === 'cuotas' && !m.cuota_texto) return false;
    if (tipo === 'usd' && !(m.monto_dolares > 0)) return false;
    return true;
  });
}

/** Etiqueta de un día en fecha local: 'Viernes 25 de septiembre'. */
export function labelDia(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 'Sin fecha';
  const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const txt = f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** Agrupa por día (fecha local), del más reciente al más viejo; 'Sin fecha' al final. */
export function agruparPorDia(movs = []) {
  const grupos = new Map();
  movs.forEach((m) => {
    const f = fechaDe(m);
    const k = /^\d{4}-\d{2}-\d{2}/.test(String(f || '')) ? String(f).slice(0, 10) : '';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : b.localeCompare(a)))
    .map(([fecha, filas]) => ({
      fecha: fecha || null,
      label: fecha ? labelDia(fecha) : 'Sin fecha',
      total: r2(filas.reduce((s, m) => s + (Number(m.monto_pesos) || 0), 0)),
      totalUsd: r2(filas.reduce((s, m) => s + (Number(m.monto_dolares) || 0), 0)),
      filas
    }));
}

/** Separa las cuotas (se muestran plegadas en "Cuotas del período"). */
export function separarCuotas(movs = []) {
  const cuotas = [];
  const resto = [];
  movs.forEach((m) => (m.cuota_texto && !esReintegro(m) ? cuotas : resto).push(m));
  return { cuotas, resto };
}

/** Composición del período en pesos: variables / fijos / cuotas (sin reintegros) y total neto. */
export function composicionPeriodo(movs = [], fijos = new Set()) {
  const out = { variables: 0, fijos: 0, cuotas: 0, reintegros: 0 };
  movs.forEach((m) => {
    const t = tipoDeFila(m, fijos);
    const v = Number(m.monto_pesos) || 0;
    if (t === 'reintegro') out.reintegros += Math.abs(v);
    else if (t === 'cuota') out.cuotas += v;
    else if (t === 'fijo') out.fijos += v;
    else out.variables += v;
  });
  return {
    variables: r2(out.variables), fijos: r2(out.fijos), cuotas: r2(out.cuotas), reintegros: r2(out.reintegros),
    total: r2(movs.reduce((s, m) => s + (Number(m.monto_pesos) || 0), 0)),
    totalUsd: r2(movs.reduce((s, m) => s + (Number(m.monto_dolares) || 0), 0))
  };
}

/**
 * Historial de un comercio en los últimos resúmenes de su tarjeta (hasta el del
 * movimiento incluido). Usa claveComercio: un comercio renombrado sigue siendo el mismo.
 * @returns [{ resumenId, mesKey, total, actual }]
 */
export function historialComercio(movs = [], mov, resumenes = [], { ultimos = 6, enCurso = [] } = {}) {
  if (!mov) return [];
  const clave = claveComercio(mov.referencia_original || mov.referencia_limpia || '');
  if (!clave) return [];
  const mismaClave = (m) => claveComercio(m.referencia_original || m.referencia_limpia || '') === clave;
  // Columna 'en curso' (Últimos consumos de esa tarjeta), si el movimiento es en curso
  // o si el comercio ya aparece en el ciclo abierto.
  const vivos = enCurso.filter((m) => m.tarjeta === mov.tarjeta && mismaClave(m));
  const conCurso = mov.origen === 'en_curso' || vivos.length > 0;
  const propios = ordenarResumenes(resumenes.filter((r) => r.tarjeta === mov.tarjeta));
  const i = propios.findIndex((r) => r.id === mov.resumen_id);
  const cuantos = conCurso ? ultimos - 1 : ultimos;
  const ventana = (i >= 0 ? propios.slice(i, i + cuantos) : propios.slice(0, cuantos)).reverse();
  const columnaCurso = conCurso ? [{
    resumenId: 'en_curso',
    mesKey: mesKeyDeFecha(mov.origen === 'en_curso' ? mov.fecha_compra : vivos[0]?.fecha_compra),
    total: r2(vivos.reduce((s, m) => s + (Number(m.monto_pesos) || Number(m.monto_dolares) || 0), 0)),
    actual: mov.origen === 'en_curso',
    enCurso: true
  }] : [];
  return [...ventana.map((r) => ({
    resumenId: r.id,
    mesKey: mesKeyDeFecha(r.fecha_cierre) || (r.anio && r.mes ? `${r.anio}-${String(r.mes).padStart(2, '0')}` : null),
    total: r2(movs
      .filter((m) => m.resumen_id === r.id && claveComercio(m.referencia_original || m.referencia_limpia || '') === clave)
      .reduce((s, m) => s + (Number(m.monto_pesos) || Number(m.monto_dolares) || 0), 0)),
    actual: r.id === mov.resumen_id
  })), ...columnaCurso];
}

/** Plan de cuotas de un movimiento (formatearParaVista), o null si ya no existe. */
export function planDeMovimiento(mov, planes = []) {
  if (!mov?.cuota_texto) return null;
  const n = String(mov.cuota_texto).match(/(\d+)\/(\d+)/);
  if (!n) return null;
  const total = Number(n[2]);
  const nombre = (mov.referencia_limpia || mov.referencia_original || '').toLowerCase();
  const monto = Number(mov.monto_pesos) || Number(mov.monto_dolares) || 0;
  const candidatos = planes.filter((p) => p.tarjeta === mov.tarjeta && p.total_cuotas === total
    && (p.descripcion || '').toLowerCase() === nombre);
  if (!candidatos.length) return null;
  // Si hay varios con el mismo nombre, el de la cuota más parecida.
  return candidatos.sort((a, b) => Math.abs((a.monto_cuota || 0) - monto) - Math.abs((b.monto_cuota || 0) - monto))[0];
}
