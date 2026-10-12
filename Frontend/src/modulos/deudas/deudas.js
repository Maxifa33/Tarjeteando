import { r2, normalizar, parseMonto } from '../cuentas/util.js';

/**
 * Saldar: lógica pura de deudas (sin Supabase).
 * Una deuda guarda lo que debías el día del alta (saldo_inicial, fecha_inicio).
 * Lo que debés hoy = saldo_inicial − pagos vinculados desde esa fecha.
 */

export const TIPOS_DEUDA = [
  { id: 'prestamo', label: 'Préstamo' },
  { id: 'persona', label: 'Persona' },
  { id: 'atraso', label: 'Atraso' }
];

const enMoneda = (d, m) => (m.moneda || 'ARS') === (d.moneda || 'ARS');
const cuenta = (d, m) => m.deuda_id === d.id && m.direccion === 'salida' && enMoneda(d, m) && m.fecha >= d.fecha_inicio;

/** Estado de una deuda a partir de sus pagos (movimientos con deuda_id). */
export function estadoDeuda(d, movs = []) {
  const pagos = movs.filter((m) => cuenta(d, m)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const pagado = r2(pagos.reduce((s, m) => s + Number(m.monto), 0));
  const inicial = Number(d.saldo_inicial) || 0;
  const saldo = r2(Math.max(0, inicial - pagado));
  const cuotas = d.cuotas_restantes == null ? null : Math.max(0, d.cuotas_restantes - pagos.length);
  return {
    pagos, pagado, saldo,
    progreso: inicial > 0 ? Math.min(1, pagado / inicial) : 1,
    cuotasRestantes: cuotas,
    minimo: d.cuota_monto ? Math.min(Number(d.cuota_monto), saldo) : 0,
    ultimoPago: pagos[0]?.fecha || null
  };
}

/** Pagado a deudas en un mes 'YYYY-MM'. */
export function pagadoEnMes(movs, mesKey) {
  // Mismos filtros que Billetera: solo gastos confirmados en pesos (lo que Presupuestos ya restó).
  return r2(movs.filter((m) => m.deuda_id && m.tipo === 'gasto' && m.estado !== 'revisar' && m.direccion === 'salida' && m.moneda !== 'USD' && String(m.fecha).startsWith(mesKey))
    .reduce((s, m) => s + Number(m.monto), 0));
}

const PISTA = /\b(cuota|prestamo|credito|deuda|financiacion|plan de pago|moratoria)\b/;

// ¿Aparece `aguja` en `texto` como palabra(s) completa(s)? (normalizado, mínimo 3 letras)
function contiene(texto, aguja) {
  const a = normalizar(aguja);
  if (a.length < 3) return false; // siglas como ABL, YPF, BNA sí; la palabra completa evita falsos positivos
  const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`).test(texto);
}

// Nombres iguales aunque estén en otro orden ("PEREZ JUAN" = "Juan Pérez").
const mismasPalabras = (a, b) => {
  const x = normalizar(a).split(' ').filter(Boolean).sort().join(' ');
  return !!x && x === normalizar(b).split(' ').filter(Boolean).sort().join(' ');
};

/** Puntaje de que el movimiento `m` sea un pago de la deuda `d` (0 = no). `catDeudas`: id de tu categoría Deudas. */
export function puntaje(d, m, { catDeudas = null } = {}) {
  if (d.estado !== 'activa' || m.deuda_id || m.direccion !== 'salida' || !enMoneda(d, m)) return 0;
  if (m.fecha < d.fecha_inicio) return 0;
  if (!['gasto'].includes(m.tipo)) return 0;
  if ((m.deudas_descartadas || []).includes(d.id)) return 0;
  const texto = normalizar([m.descripcion, m.contraparte, m.descripcion_original].filter(Boolean).join(' '));
  let p = 0;
  if (d.palabra_clave && contiene(texto, d.palabra_clave)) p += 3;
  const pista = PISTA.test(texto) || (catDeudas && m.categoria_id === catDeudas);
  let acreedor = false;
  if (d.acreedor) {
    if (d.tipo === 'persona') {
      if (m.contraparte && mismasPalabras(m.contraparte, d.acreedor)) p += 3;
      else if (contiene(texto, d.acreedor) && normalizar(d.acreedor).includes(' ')) p += 2; // nombre y apellido
    } else if (contiene(texto, d.acreedor)) { p += 1; acreedor = true; }
  }
  const cerca = d.cuota_monto && Math.abs(Number(m.monto) - Number(d.cuota_monto)) <= Number(d.cuota_monto) * 0.03;
  if (cerca) p += pista ? 2 : p > 0 ? 1 : 0;
  else if (acreedor && pista) p += 1; // "PAGO EDENOR PLAN DE PAGO", "CUOTA PRESTAMO GALICIA" sin cuota cargada
  // Solo el nombre del banco/empresa no alcanza (también le comprás cosas): pide algo más.
  return p >= 2 ? p : 0;
}

/** Movimientos que parecen pagos de deudas, cada uno con su mejor candidata. */
export function sugerirPagos(deudas = [], movs = [], opciones = {}) {
  const out = [];
  for (const m of movs) {
    let mejor = null; let max = 0;
    for (const d of deudas) {
      const p = puntaje(d, m, opciones);
      if (p > max) { max = p; mejor = d; }
    }
    if (mejor) out.push({ mov: m, deuda: mejor, puntaje: max });
  }
  return out.sort((a, b) => (a.mov.fecha < b.mov.fecha ? 1 : -1));
}

/** Pago cargado a mano que probablemente es el mismo que `m` (±3% y ±10 días). */
export function manualParecido(pagos = [], m) {
  const dias = (a, b) => Math.abs(new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000;
  return pagos.find((p) => p.origen === 'manual' && Math.abs(p.monto - m.monto) <= p.monto * 0.03 && dias(p.fecha, m.fecha) <= 10) || null;
}

/**
 * Simula pagar todas las deudas con `montoMensual` fijo.
 * Cada mes: interés (tasa_anual/12, si la cargaste), mínimos de todas, y el resto a la prioritaria.
 * 'avalancha' = primero la de mayor tasa (menos intereses). 'bola' = primero la más chica (te liberás antes de cuotas).
 */
export function simular(items = [], montoMensual, estrategia = 'avalancha', { tope = 360 } = {}) {
  const ds = items.filter((d) => d.saldo > 0).map((d) => ({ ...d, resto: d.saldo }));
  const minimos = r2(ds.reduce((s, d) => s + (d.minimo || 0), 0));
  const presupuesto = Number(montoMensual) || 0;
  const sinFin = (motivo, extra = {}) => ({ meses: null, intereses: null, orden: [], minimos, insuficiente: motivo === 'insuficiente', nunca: motivo !== 'insuficiente', motivo, ...extra });
  if (!ds.length) return { meses: 0, intereses: 0, orden: [], minimos, insuficiente: false, nunca: false, motivo: null };
  if (presupuesto < minimos - 0.005) return sinFin('insuficiente');
  if (presupuesto <= 0) return sinFin('sin_monto');

  const prioridad = (a, b) => (estrategia === 'bola'
    ? a.resto - b.resto || (b.tasa || 0) - (a.tasa || 0)
    : (b.tasa || 0) - (a.tasa || 0) || a.resto - b.resto);
  let intereses = 0;
  const orden = [];
  for (let mes = 1; mes <= tope; mes++) {
    const vivas = ds.filter((d) => d.resto > 0.005);
    vivas.forEach((d) => { const i = d.resto * ((d.tasa || 0) / 100 / 12); d.resto += i; intereses += i; });
    let caja = presupuesto;
    vivas.forEach((d) => { const pago = Math.min(d.minimo || 0, d.resto); d.resto -= pago; caja -= pago; });
    for (const d of [...vivas].sort(prioridad)) {
      if (caja <= 0.005) break;
      const pago = Math.min(caja, d.resto); d.resto -= pago; caja -= pago;
    }
    vivas.forEach((d) => { if (d.resto <= 0.005) { d.resto = 0; orden.push({ id: d.id, nombre: d.nombre, mes }); } });
    if (ds.every((d) => d.resto <= 0.005)) return { meses: mes, intereses: r2(intereses), orden, minimos, insuficiente: false, nunca: false, motivo: null };
  }
  // ¿Crece la deuda (los intereses le ganan al pago) o solo tarda más de 30 años?
  const crece = ds.reduce((s, d) => s + d.resto, 0) >= items.reduce((s, d) => s + (d.saldo > 0 ? d.saldo : 0), 0);
  return sinFin(crece ? 'intereses' : 'muy_largo', { intereses: r2(intereses), orden });
}

/** Compara avalancha y bola de nieve y dice cuál conviene. */
export function compararPlanes(items, montoMensual) {
  const avalancha = simular(items, montoMensual, 'avalancha');
  const bola = simular(items, montoMensual, 'bola');
  const conTasa = items.some((d) => d.saldo > 0 && d.tasa > 0);
  let recomendada = 'bola';
  // Si solo uno de los dos termina, ese es el que conviene.
  if (avalancha.meses && !bola.meses) return { avalancha, bola, conTasa, recomendada: 'avalancha', ahorro: 0 };
  if (!avalancha.meses && bola.meses) return { avalancha, bola, conTasa, recomendada: 'bola', ahorro: 0 };
  if (avalancha.meses && bola.meses) {
    const ahorro = r2((bola.intereses || 0) - (avalancha.intereses || 0));
    // Avalancha si ahorra algo que valga la pena; si no, bola (cerrás deudas antes y motiva).
    if (ahorro > Math.max(1000, montoMensual * 0.05)) recomendada = 'avalancha';
    return { avalancha, bola, conTasa, recomendada, ahorro };
  }
  return { avalancha, bola, conTasa, recomendada: null, ahorro: 0 };
}

/** 'YYYY-MM' sumando `n` meses a `desde`. */
export function mesMas(desde, n) {
  const [a, m] = desde.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Valida y limpia el formulario de alta/edición. Devuelve { fila } o { error }. */
export function validarDeuda(f) {
  const nombre = String(f.nombre || '').trim();
  if (!nombre) return { error: 'Poné un nombre (ej. "Préstamo Galicia").' };
  const vacio = (v) => v === '' || v == null;
  // Montos como los escribís: "150.000", "150000,50", "$ 1.234,5". Inválido = NaN (no null).
  const num = (v) => (vacio(v) ? null : parseMonto(v) ?? NaN);
  const cuota = num(f.cuota_monto);
  const cuotas = vacio(f.cuotas_restantes) ? null : Number(f.cuotas_restantes);
  let saldo = num(f.saldo_inicial);
  if (saldo == null && cuota > 0 && Number.isInteger(cuotas) && cuotas > 0) saldo = r2(cuota * cuotas);
  const tasa = vacio(f.tasa_anual) ? null : Number(String(f.tasa_anual).replace(',', '.').replace('%', '').trim());
  if (saldo == null || !Number.isFinite(saldo) || saldo <= 0) return { error: 'Poné cuánto debés hoy (o la cuota y las cuotas que faltan).' };
  if (cuota != null && (!Number.isFinite(cuota) || cuota <= 0)) return { error: 'La cuota tiene que ser un monto mayor a 0.' };
  if (cuotas != null && (!Number.isInteger(cuotas) || cuotas < 0)) return { error: 'Las cuotas que faltan tienen que ser un número.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.fecha_inicio || ''))) return { error: 'Falta la fecha desde la que contás los pagos.' };
  if (tasa != null && (!Number.isFinite(tasa) || tasa < 0 || tasa > 1000)) return { error: 'La tasa es anual en %, entre 0 y 1000.' };
  return {
    fila: {
      nombre, tipo: f.tipo || 'prestamo', acreedor: String(f.acreedor || '').trim() || null,
      moneda: f.moneda || 'ARS', saldo_inicial: r2(saldo), fecha_inicio: f.fecha_inicio,
      cuota_monto: cuota != null ? r2(cuota) : null, cuotas_restantes: cuotas,
      tasa_anual: tasa, palabra_clave: String(f.palabra_clave || '').trim() || null,
      notas: String(f.notas || '').trim() || null
    }
  };
}

/** Deudas activas en pesos, listas para simular (las en dólares van aparte). */
export function itemsPlan(deudas = [], movs = []) {
  return deudas.filter((d) => d.estado === 'activa' && (d.moneda || 'ARS') === 'ARS').map((d) => {
    const e = estadoDeuda(d, movs);
    return { id: d.id, nombre: d.nombre, saldo: e.saldo, minimo: e.minimo, tasa: d.tasa_anual == null ? null : Number(d.tasa_anual) };
  }).filter((d) => d.saldo > 0);
}
