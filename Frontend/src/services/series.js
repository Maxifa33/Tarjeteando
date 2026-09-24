/**
 * Series de gastos: identidad de cada movimiento y de cada gasto recurrente.
 *
 * Tomado de Bitcoin, solo lo que sirve para una app de un solo usuario:
 *  - HASH (SHA-256): cada movimiento tiene un ID = huella de su contenido. Mismo
 *    contenido => mismo ID, aunque se vuelva a subir el resumen.
 *  - ENCADENAMIENTO: cada cargo de un gasto recurrente apunta al cargo anterior
 *    (`prev_id`), como un bloque apunta al bloque previo. La cadena entera es la
 *    "serie" (Netflix sep -> ago -> jul ...). Su ID sale del primer eslabón.
 *  Firmas y consenso distribuido NO: resuelven desconfianza entre partes, acá no hay.
 *
 * El hash identifica pero no reconoce: un cambio mínimo da otro hash. Qué cargo
 * es el eslabón siguiente lo decide una REGLA DE PARECIDO: mismo comercio
 * (claveComercio), misma moneda, misma tarjeta, y monto dentro de ±25% del
 * eslabón anterior (no del primero: así la inflación no corta la cadena).
 *
 * Todo es puro y determinístico: se recalcula desde los movimientos cada vez.
 * Lo único persistido son las decisiones del usuario (overrides y respuestas).
 */

// ───────────────────────────── SHA-256 ─────────────────────────────
// Implementación síncrona (FIPS 180-4). Web Crypto es async y obligaría a volver
// async todo el guardado; para unos cientos de movimientos esto sobra.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export function sha256(texto) {
  const datos = new TextEncoder().encode(String(texto));
  const largoBits = datos.length * 8;
  const total = Math.ceil((datos.length + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(datos);
  buf[datos.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(largoBits / 0x100000000));
  dv.setUint32(total - 4, largoBits >>> 0);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, x => x.toString(16).padStart(8, '0')).join('');
}

// ───────────────────────── ID de movimiento ─────────────────────────
const contenidoMovimiento = (m, resumenId) => [
  resumenId || m.resumen_id || '',
  m.fecha_compra || '',
  m.referencia_original || '',
  m.cuota_texto || '',
  Number(m.monto_pesos || 0).toFixed(2),
  Number(m.monto_dolares || 0).toFixed(2)
].join('|');

/**
 * Asigna a cada movimiento de un resumen su ID hash ('mv_' + 24 hex de SHA-256).
 * Dos movimientos idénticos en el mismo resumen (misma compra dos veces el mismo
 * día) se distinguen por su número de aparición: '#1', '#2'.
 */
export function asignarIds(movimientos, resumenId) {
  const vistos = {};
  return movimientos.map(m => {
    const base = contenidoMovimiento(m, resumenId);
    vistos[base] = (vistos[base] || 0) + 1;
    return { ...m, id: 'mv_' + sha256(`${base}#${vistos[base]}`).slice(0, 24) };
  });
}

// ───────────────────────── Clave de comercio ─────────────────────────
/**
 * Identidad estable del comercio, derivada de la descripción ORIGINAL del banco
 * sin los códigos que cambian cada mes. Ej.:
 *   'APPLE.COM/BILL MVGLV3QHY'   -> 'apple com bill'
 *   'NETFLIX.COM PjfnJpPPQ'      -> 'netflix com'
 *   'ZURICH INTERNA0000003393731- -' -> 'zurich'
 * Un token es "código" si tiene dígitos y 5+ caracteres, si es numérico de 3+,
 * si mezcla mayúsculas y minúsculas con 6+ caracteres, o si tiene 7+ letras con
 * a lo sumo una vocal (códigos de factura).
 */
export function claveComercio(ref = '') {
  const tokens = String(ref)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const limpios = tokens.filter(t => {
    if (/^\d+$/.test(t)) return t.length < 3;
    if (/\d/.test(t) && t.length >= 5) return false;
    if (t.length >= 6 && /[a-z]/.test(t) && /[A-Z]/.test(t)) return false;
    // Códigos solo de letras ('MSHNNHTFW'): 7+ letras con a lo sumo una vocal.
    if (t.length >= 7 && (t.match(/[aeiouAEIOU]/g) || []).length <= 1) return false;
    return true;
  });
  return limpios.join(' ').toLowerCase().trim();
}

/** Regex (string) equivalente a una clave, para que el backend la aplique al parsear. */
export function regexDeClave(clave) {
  const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clave.split(' ').map(escapar).join('[^A-Za-z0-9]+');
}

// ───────────────────────────── Períodos ─────────────────────────────
export const mesAIndice = (mesKey) => {
  const [a, m] = String(mesKey).split('-').map(Number);
  return a * 12 + (m - 1);
};
const pad = n => String(n).padStart(2, '0');
const mesDeResumen = r => (r && r.anio && r.mes) ? `${r.anio}-${pad(r.mes)}` : null;

export function periodoDeMovimiento(mov, periodoPorResumen = {}) {
  if (periodoPorResumen[mov.resumen_id]) return periodoPorResumen[mov.resumen_id];
  if (mov.anio_resumen && mov.mes_resumen) return `${mov.anio_resumen}-${pad(mov.mes_resumen)}`;
  const f = String(mov.fecha_compra || '').match(/^(\d{4})-(\d{2})/);
  return f ? `${f[1]}-${f[2]}` : null;
}

const mediana = (valores) => {
  if (!valores.length) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(o.length / 2);
  return o.length % 2 ? o[mitad] : (o[mitad - 1] + o[mitad]) / 2;
};

// ───────────────────────────── Parámetros ─────────────────────────────
export const PARAMS = {
  TOLERANCIA_ENLACE: 0.25, // ±25% contra el eslabón anterior
  MAX_RESUMENES_SALTEADOS: 2, // una cadena puede saltear hasta 2 resúmenes y seguir
  MIN_MESES: 3,
  MIN_PRESENCIA: 0.6,
  UMBRAL_FIJO: 10,
  UMBRAL_RECURRENTE: 25,
  CARGOS_POR_MES_AMBIGUO: 1.5 // comercio con varias compras por mes: exigir más
};

/**
 * Arma las cadenas (series) y las clasifica.
 *
 * @param movimientos  movimientos de localStorage (con id hash y resumen_id)
 * @param resumenes    resúmenes ({id, tarjeta, anio, mes})
 * @param decisiones   respuestas del usuario: {tipo:'enlace'|'no_enlace'|'baja'|'sigue'|'omitida', mov_id, prev_id?, periodo?}
 * @returns {{ cadenas, porMovimiento }}
 *   cadenas[i] = { id, clave, moneda, tarjeta, nombre, eslabones:[{mov_id, periodo, monto}], tipoAuto, analisis }
 *   porMovimiento: { [mov.id]: { serie_id, prev_id, periodo, moneda } }
 */
export function construirCadenas(movimientos = [], resumenes = [], decisiones = []) {
  const periodoPorResumen = {};
  const mesesPorTarjeta = {};
  resumenes.forEach(r => {
    const mk = mesDeResumen(r);
    if (!mk) return;
    if (r.id) periodoPorResumen[r.id] = mk;
    (mesesPorTarjeta[r.tarjeta] = mesesPorTarjeta[r.tarjeta] || new Set()).add(mk);
  });
  const indicesTarjeta = {};
  Object.entries(mesesPorTarjeta).forEach(([t, s]) => {
    indicesTarjeta[t] = [...s].map(mesAIndice).sort((a, b) => a - b);
  });
  const resumenesEntre = (tarjeta, desde, hasta) => // estrictamente entre
    (indicesTarjeta[tarjeta] || []).filter(i => i > desde && i < hasta).length;

  const enlaceForzado = {};  // mov_id -> prev_id
  const enlaceProhibido = new Set(); // `${prev}>${mov}`
  const bajas = new Set();   // mov_id del último eslabón dado de baja
  const sigue = {};          // mov_id -> [periodos confirmados como "sigue"]
  decisiones.forEach(d => {
    if (d.tipo === 'enlace' && d.mov_id && d.prev_id) enlaceForzado[d.mov_id] = d.prev_id;
    if (d.tipo === 'no_enlace' && d.mov_id && d.prev_id) enlaceProhibido.add(`${d.prev_id}>${d.mov_id}`);
    if (d.tipo === 'baja' && d.mov_id) bajas.add(d.mov_id);
    if ((d.tipo === 'sigue') && d.mov_id && d.periodo) (sigue[d.mov_id] = sigue[d.mov_id] || []).push(d.periodo);
  });

  // 1. Agrupar cargos por comercio + moneda + tarjeta
  const grupos = {};
  movimientos.forEach(mov => {
    if (!mov || !mov.id) return;
    if (mov.cuota_texto || mov.es_cuota) return; // cuotas: deuda, no gasto recurrente
    const clave = claveComercio(mov.referencia_original) ||
      String(mov.referencia_limpia || '').toLowerCase().trim();
    if (!clave || clave.length < 3) return;
    const periodo = periodoDeMovimiento(mov, periodoPorResumen);
    if (!periodo) return;
    [['ARS', mov.monto_pesos || 0], ['USD', mov.monto_dolares || 0]].forEach(([moneda, monto]) => {
      if (monto <= 0) return; // devoluciones y la moneda que no aplica
      const g = `${clave}|${moneda}|${mov.tarjeta}`;
      (grupos[g] = grupos[g] || { clave, moneda, tarjeta: mov.tarjeta, cargos: [] })
        .cargos.push({ mov, periodo, idx: mesAIndice(periodo), monto });
    });
  });

  // Ambigüedad por FAMILIA de comercio (nombre limpio): 'APPYPF COMBUST' y
  // 'MERPAGO*APPYPFCOMB' son claves distintas pero la misma estación de servicio.
  // Si la familia tiene varias compras por mes, sus cadenas son sospechosas.
  const familias = {};
  movimientos.forEach(mov => {
    if (!mov || mov.cuota_texto || mov.es_cuota) return;
    const periodo = periodoDeMovimiento(mov, periodoPorResumen);
    const nombre = String(mov.referencia_limpia || mov.referencia_original || '').toLowerCase().trim();
    if (!periodo || !nombre) return;
    [['ARS', mov.monto_pesos || 0], ['USD', mov.monto_dolares || 0]].forEach(([moneda, monto]) => {
      if (monto <= 0) return;
      const f = (familias[`${nombre}|${moneda}|${mov.tarjeta}`] = familias[`${nombre}|${moneda}|${mov.tarjeta}`] || { n: 0, meses: new Set() });
      f.n++; f.meses.add(periodo);
    });
  });
  const cargosPorMesFamilia = (mov, moneda) => {
    const nombre = String(mov.referencia_limpia || mov.referencia_original || '').toLowerCase().trim();
    const f = familias[`${nombre}|${moneda}|${mov.tarjeta}`];
    return f ? f.n / f.meses.size : 1;
  };

  const cadenas = [];
  const porMovimiento = {};

  Object.values(grupos).forEach(grupo => {
    const porPeriodo = {};
    grupo.cargos.forEach(c => (porPeriodo[c.idx] = porPeriodo[c.idx] || []).push(c));
    const indices = Object.keys(porPeriodo).map(Number).sort((a, b) => a - b);
    const cargosPorMes = Math.max(
      grupo.cargos.length / indices.length,
      ...grupo.cargos.map(c => cargosPorMesFamilia(c.mov, grupo.moneda))
    );
    const cadenasGrupo = [];

    indices.forEach(idx => {
      // Orden determinístico dentro del período
      const cargos = porPeriodo[idx].sort((a, b) => a.monto - b.monto || a.mov.id.localeCompare(b.mov.id));
      const abiertas = cadenasGrupo.filter(c => {
        const ult = c.eslabones[c.eslabones.length - 1];
        return !c.cerrada && ult.idx < idx &&
          resumenesEntre(grupo.tarjeta, ult.idx, idx) <= PARAMS.MAX_RESUMENES_SALTEADOS;
      });
      const asignado = new Set();
      const usada = new Set();

      // a) Enlaces confirmados por el usuario ("sí, es el mismo")
      cargos.forEach(c => {
        const prev = enlaceForzado[c.mov.id];
        if (!prev) return;
        const cadena = cadenasGrupo.find(k => !k.cerrada && k.eslabones[k.eslabones.length - 1].mov_id === prev);
        if (cadena && !usada.has(cadena)) {
          cadena.eslabones.push({ mov_id: c.mov.id, periodo: c.periodo, idx, monto: c.monto, mov: c.mov });
          asignado.add(c); usada.add(cadena);
        }
      });

      // b) Regla de parecido: el par más parecido primero (greedy)
      const pares = [];
      abiertas.forEach(cadena => {
        if (usada.has(cadena)) return;
        const ult = cadena.eslabones[cadena.eslabones.length - 1];
        cargos.forEach(c => {
          if (asignado.has(c)) return;
          if (enlaceProhibido.has(`${ult.mov_id}>${c.mov.id}`)) return;
          const d = Math.abs(c.monto - ult.monto) / ult.monto;
          if (d <= PARAMS.TOLERANCIA_ENLACE + 1e-9) pares.push({ cadena, c, d });
        });
      });
      pares.sort((x, y) => x.d - y.d || x.c.mov.id.localeCompare(y.c.mov.id));
      pares.forEach(({ cadena, c }) => {
        if (asignado.has(c) || usada.has(cadena)) return;
        cadena.eslabones.push({ mov_id: c.mov.id, periodo: c.periodo, idx, monto: c.monto, mov: c.mov });
        asignado.add(c); usada.add(cadena);
      });

      // c) Lo que no se enganchó empieza una cadena nueva (bloque génesis)
      cargos.forEach(c => {
        if (asignado.has(c)) return;
        cadenasGrupo.push({ eslabones: [{ mov_id: c.mov.id, periodo: c.periodo, idx, monto: c.monto, mov: c.mov }] });
      });

      // Una cadena dada de baja no recibe más eslabones
      cadenasGrupo.forEach(k => {
        if (bajas.has(k.eslabones[k.eslabones.length - 1].mov_id)) k.cerrada = true;
      });
    });

    cadenasGrupo.forEach(k => {
      const genesis = k.eslabones[0];
      const id = 'sr_' + sha256(genesis.mov_id).slice(0, 16);
      k.eslabones.forEach((e, i) => {
        porMovimiento[e.mov_id] = {
          serie_id: id,
          prev_id: i > 0 ? k.eslabones[i - 1].mov_id : null,
          periodo: e.periodo,
          moneda: grupo.moneda
        };
      });
      const ultimo = k.eslabones[k.eslabones.length - 1];
      const cadena = {
        id,
        clave: grupo.clave,
        moneda: grupo.moneda,
        tarjeta: grupo.tarjeta,
        nombre: ultimo.mov.referencia_limpia || ultimo.mov.referencia_original,
        eslabones: k.eslabones.map(({ mov_id, periodo, monto }) => ({ mov_id, periodo, monto })),
        dadaDeBaja: bajas.has(ultimo.mov_id),
        sigue: sigue[ultimo.mov_id] || []
      };
      const rubroDeConsumo = RUBROS_DE_CONSUMO.test(`${grupo.clave} ${String(cadena.nombre).toLowerCase()}`);
      Object.assign(cadena, clasificar(cadena, indicesTarjeta[grupo.tarjeta] || [],
        rubroDeConsumo ? Infinity : cargosPorMes));
      cadenas.push(cadena);
    });
  });

  cadenas.sort((a, b) => a.id.localeCompare(b.id));
  return { cadenas, porMovimiento };
}

/** Clasificación automática de una cadena (mismo criterio que el detector previo). */
function clasificar(cadena, indicesTarjeta, cargosPorMes) {
  const meses = cadena.eslabones.map(e => e.periodo);
  const valores = cadena.eslabones.map(e => e.monto);
  const base = { meses: meses.length };

  if (cadena.dadaDeBaja) {
    return { tipoAuto: 'finalizado', analisis: { ...base, razon: 'dado de baja por el usuario' } };
  }
  if (meses.length < PARAMS.MIN_MESES) {
    return { tipoAuto: 'variable', analisis: { ...base, razon: `solo ${meses.length} mes(es) con cargo` } };
  }

  const desde = mesAIndice(meses[0]);
  const ventana = indicesTarjeta.filter(i => i >= desde);
  // Un "sí, sigue" del usuario cuenta como presencia en ese resumen.
  const presentes = new Set([...meses, ...cadena.sigue].map(mesAIndice));
  const presencia = ventana.length ? Math.min(1, presentes.size / ventana.length) : 1;
  if (presencia < PARAMS.MIN_PRESENCIA) {
    return { tipoAuto: 'variable', analisis: { ...base, presencia,
      razon: `aparece en ${presentes.size} de ${ventana.length} resúmenes` } };
  }

  const ultimoPresente = Math.max(...presentes);
  const ultimoDisponible = ventana.length ? Math.max(...ventana) : ultimoPresente;
  const faltantes = ventana.filter(i => i > ultimoPresente).length;

  const cambios = [];
  for (let i = 1; i < valores.length; i++) {
    if (valores[i - 1] > 0) cambios.push(Math.abs(valores[i] - valores[i - 1]) / valores[i - 1]);
  }
  const variacion = mediana(cambios) * 100;
  const conteos = {};
  valores.forEach(v => { const k = v.toFixed(2); conteos[k] = (conteos[k] || 0) + 1; });
  const repeticion = Math.max(...Object.values(conteos)) / valores.length;

  // Comercio con varias compras por mes (DiDi, YPF, Apple con compras sueltas):
  // dos compras parecidas en meses seguidos no alcanzan. Se exige la huella de una
  // suscripción: el MISMO importe repetido.
  const ambiguo = cargosPorMes > PARAMS.CARGOS_POR_MES_AMBIGUO;

  let tipoAuto = 'variable';
  if (repeticion >= 0.6) tipoAuto = 'fijo';
  else if (!ambiguo && variacion <= PARAMS.UMBRAL_FIJO) tipoAuto = 'fijo';
  else if (!ambiguo && variacion <= PARAMS.UMBRAL_RECURRENTE) tipoAuto = 'recurrente';

  // Sin cargos en los últimos 2+ resúmenes: se dio de baja. Se guarda qué era antes
  // (tipoPrevio) para poder preguntar si en realidad cambió el monto.
  const tipoPrevio = tipoAuto;
  if (faltantes >= 2) tipoAuto = 'finalizado';

  return {
    tipoAuto,
    analisis: { ...base, presencia, variacion: +variacion.toFixed(1), repeticion: +(repeticion * 100).toFixed(0),
      ambiguo, faltantesAlFinal: faltantes, ultimoDisponible, tipoPrevio,
      razon: tipoAuto === 'variable' ? 'montos sin patrón de suscripción'
        : tipoAuto === 'finalizado' ? `sin cargos en los últimos ${faltantes} resúmenes` : null }
  };
}

/**
 * Rubros donde se compra seguido y por montos parecidos, pero que no son un gasto
 * fijo (combustible, viajes en app, súper, delivery, peajes). Para marcarlos fijos
 * automáticamente se exige el MISMO importe repetido; el usuario siempre puede
 * marcarlos a mano.
 */
const RUBROS_DE_CONSUMO = /\b(ypf|appypf\w*|shell|axion|puma energy|combust\w*|nafta|didi|uber|cabify|sube|carrefour|coto|jumbo|disco|vea|dia|changomas|makro|rappi|pedidosya|peaje\w*|autop\w*|corredores)\b/;

export const esTipoFijo = t => t === 'fijo' || t === 'recurrente';

/**
 * Tipo final de cada movimiento = automático, salvo que el usuario lo haya cambiado.
 * Un override vale DESDE el período del movimiento donde se hizo HACIA ADELANTE,
 * para toda la cadena de ese movimiento. Si hay varios, gana el de `desde` más
 * reciente que no sea posterior al período (a igualdad, el último creado).
 *
 * @param overrides [{ mov_id, tipo:'fijo'|'variable', desde:'YYYY-MM', creado }]
 * @returns { tipos: {mov_id: {tipo, origen:'auto'|'manual', desde?}}, fijos: Set<mov_id> }
 */
export function aplicarOverrides(movimientos, series, overrides = []) {
  const { cadenas, porMovimiento } = series;
  const cadenaPorId = Object.fromEntries(cadenas.map(c => [c.id, c]));

  // overrides agrupados por serie (o por movimiento suelto si no tiene serie)
  const porSerie = {};
  overrides.forEach(o => {
    const info = porMovimiento[o.mov_id];
    const k = info ? info.serie_id : `mov:${o.mov_id}`;
    (porSerie[k] = porSerie[k] || []).push(o);
  });

  const tipos = {};
  const fijos = new Set();
  movimientos.forEach(mov => {
    if (!mov?.id) return;
    const info = porMovimiento[mov.id];
    const cadena = info ? cadenaPorId[info.serie_id] : null;
    const auto = cadena && esTipoFijo(cadena.tipoAuto) ? 'fijo' : 'variable';
    const lista = porSerie[info ? info.serie_id : `mov:${mov.id}`] || [];
    const periodo = info?.periodo;
    const aplicables = lista
      .filter(o => !periodo || !o.desde || mesAIndice(o.desde) <= mesAIndice(periodo))
      .sort((a, b) => mesAIndice(b.desde || '0-1') - mesAIndice(a.desde || '0-1') ||
        String(b.creado || '').localeCompare(String(a.creado || '')));
    const o = aplicables[0];
    const tipo = o ? o.tipo : auto;
    tipos[mov.id] = o ? { tipo, origen: 'manual', desde: o.desde } : { tipo, origen: 'auto' };
    if (tipo === 'fijo') fijos.add(mov.id);
  });
  return { tipos, fijos };
}

/**
 * Resumen para el Dashboard: cadenas cuyo ÚLTIMO eslabón es fijo (auto o manual)
 * y que no están finalizadas. montoTipico = mediana de sus montos.
 */
export function resumenFijos(series, tipos) {
  const items = series.cadenas
    .filter(c => {
      const ult = c.eslabones[c.eslabones.length - 1];
      const t = tipos[ult.mov_id];
      if (!t || t.tipo !== 'fijo') return false;
      if (t.origen === 'auto') return esTipoFijo(c.tipoAuto);
      return !c.dadaDeBaja && (c.analisis?.faltantesAlFinal || 0) < 2;
    })
    .map(c => ({
      serie_id: c.id,
      nombre: c.nombre,
      moneda: c.moneda,
      tarjeta: c.tarjeta,
      tipo: tipos[c.eslabones[c.eslabones.length - 1].mov_id].origen === 'manual' ? 'manual' : c.tipoAuto,
      montoActual: c.eslabones[c.eslabones.length - 1].monto,
      montoTipico: mediana(c.eslabones.map(e => e.monto)),
      meses: c.eslabones.length
    }))
    .sort((a, b) => b.montoTipico - a.montoTipico);
  return {
    ars: items.filter(i => i.moneda === 'ARS').reduce((s, i) => s + i.montoTipico, 0),
    usd: items.filter(i => i.moneda === 'USD').reduce((s, i) => s + i.montoTipico, 0),
    items
  };
}

/**
 * Preguntas al usuario después de importar, para gastos FIJOS que faltan en el
 * último resumen de su tarjeta. Sin cargo parecido solo se pregunta en el PRIMER
 * faltante (al segundo la app decide sola que se dio de baja).
 *  - 'cambio_monto': hay un cargo del mismo comercio que no se enganchó por monto.
 *  - 'faltante': no hay ningún cargo del comercio.
 */
export function preguntasPendientes(series, tipos, resumenes = [], decisiones = []) {
  const ultimoPorTarjeta = {};
  resumenes.forEach(r => {
    const mk = mesDeResumen(r);
    if (!mk) return;
    const i = mesAIndice(mk);
    if (ultimoPorTarjeta[r.tarjeta] === undefined || i > ultimoPorTarjeta[r.tarjeta]) ultimoPorTarjeta[r.tarjeta] = i;
  });
  const indiceAMes = i => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
  const respondidas = new Set(decisiones
    .filter(d => d.periodo && d.mov_id)
    .map(d => `${d.mov_id}@${d.periodo}`));
  const prohibidos = new Set(decisiones.filter(d => d.tipo === 'no_enlace').map(d => `${d.prev_id}>${d.mov_id}`));

  const preguntas = [];
  series.cadenas.forEach(c => {
    if (c.dadaDeBaja) return;
    const ult = c.eslabones[c.eslabones.length - 1];
    const t = tipos[ult.mov_id];
    if (!t) return;
    if (t.origen === 'manual' && t.tipo !== 'fijo') return;
    // Elegible: fijo automático, fijo manual, o fijo que se "finalizó" solo por faltar
    // (puede ser un aumento que cortó la cadena).
    if (t.origen === 'auto' && !esTipoFijo(c.tipoAuto) &&
        !(c.tipoAuto === 'finalizado' && esTipoFijo(c.analisis?.tipoPrevio))) return;
    const ultimoT = ultimoPorTarjeta[c.tarjeta];
    if (ultimoT === undefined) return;
    const presentes = [...c.eslabones.map(e => e.periodo), ...c.sigue].map(mesAIndice);
    const ultimoPresente = Math.max(...presentes);
    if (ultimoPresente >= ultimoT) return; // está en el último resumen
    const periodo = indiceAMes(ultimoT);
    // ¿primer faltante? no puede haber otro resumen de la tarjeta en el medio
    const intermedios = resumenes.filter(r => {
      const mk = mesDeResumen(r);
      return r.tarjeta === c.tarjeta && mk && mesAIndice(mk) > ultimoPresente && mesAIndice(mk) < ultimoT;
    }).length;
    if (intermedios > 1) return;
    if (respondidas.has(`${ult.mov_id}@${periodo}`)) return;

    // Candidato: cargo del mismo comercio/moneda/tarjeta en ese período que empezó
    // una cadena propia (no se enganchó a ninguna).
    const candidatos = series.cadenas
      .filter(k => k !== c && k.clave === c.clave && k.moneda === c.moneda && k.tarjeta === c.tarjeta &&
        k.eslabones.length === 1 && k.eslabones[0].periodo === periodo &&
        !prohibidos.has(`${ult.mov_id}>${k.eslabones[0].mov_id}`))
      .map(k => k.eslabones[0])
      .sort((a, b) => Math.abs(Math.log(a.monto / ult.monto)) - Math.abs(Math.log(b.monto / ult.monto)));
    const candidato = candidatos[0];
    // Sin candidato solo se pregunta en el PRIMER faltante; al segundo la app ya
    // decidió sola (finalizado). Con candidato se pregunta igual: hay evidencia.
    if (!candidato && intermedios > 0) return;
    preguntas.push(candidato
      ? { id: `${ult.mov_id}@${periodo}`, tipo: 'cambio_monto', serie_id: c.id, nombre: c.nombre, moneda: c.moneda,
          tarjeta: c.tarjeta, periodo, ultimo: ult, candidato }
      : { id: `${ult.mov_id}@${periodo}`, tipo: 'faltante', serie_id: c.id, nombre: c.nombre, moneda: c.moneda,
          tarjeta: c.tarjeta, periodo, ultimo: ult });
  });
  return preguntas;
}
