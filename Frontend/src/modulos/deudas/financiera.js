/**
 * Matemática financiera pura (sin React ni Supabase). Sistema francés (cuota fija).
 * Tasas MENSUALES como decimal (0.05 = 5 % por mes). Para pasar de/a TNA usar tnaAMensual / mensualATna.
 * TNA = tasa nominal anual con capitalización mensual (la que informan los bancos): i_mensual = TNA / 12.
 */

const r2 = (n) => Math.round(n * 100) / 100;

export const tnaAMensual = (tnaPct) => (Number(tnaPct) || 0) / 100 / 12;
export const mensualATna = (i) => i * 12 * 100;
/** Tasa efectiva anual (%) a partir de la mensual. */
export const teaDesdeMensual = (i) => ((1 + i) ** 12 - 1) * 100;

/** Capital que "compran" n cuotas de valor `cuota` a tasa mensual i (= lo que pagarías hoy para cancelar). */
export function valorPresente(cuota, i, n) {
  if (!(n > 0) || !(cuota > 0)) return 0;
  if (!i) return r2(cuota * n);
  return r2(cuota * (1 - (1 + i) ** -n) / i);
}

/** Cuota de un préstamo de `capital` a n cuotas con tasa mensual i. */
export function cuotaFrancesa(capital, i, n) {
  if (!(capital > 0) || !(n > 0)) return 0;
  if (!i) return r2(capital / n);
  return r2(capital * i / (1 - (1 + i) ** -n));
}

/**
 * Tasa mensual implícita: la que hace que n cuotas de `cuota` valgan `capital` hoy.
 * Devuelve 0 si cuota×n ≈ capital, y null si es imposible (cuota×n < capital) o absurda (> 100 % mensual).
 */
export function tasaImplicita(capital, cuota, n) {
  if (!(capital > 0) || !(cuota > 0) || !Number.isInteger(n) || n < 1) return null;
  const total = cuota * n;
  if (Math.abs(total - capital) <= Math.max(0.01 * n, capital * 1e-9)) return 0;
  if (total < capital) return null;
  // f(i) = VP(cuota, i, n) − capital es decreciente en i: bisección entre 0 y 100 % mensual.
  let lo = 0; let hi = 1;
  const f = (i) => cuota * (1 - (1 + i) ** -n) / i - capital;
  if (f(hi) > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

/**
 * Cuántas cuotas de `cuota` hacen falta para saldar `capital` a tasa mensual i.
 * Infinity si la cuota no cubre ni el interés del primer mes. Tolerancia de centavos (las cuotas vienen redondeadas).
 */
export function cuotasParaSaldar(capital, cuota, i) {
  if (!(capital > 0)) return 0;
  if (!(cuota > 0)) return Infinity;
  if (!i) return Math.ceil(capital / cuota - 1e-4);
  const x = 1 - (capital * i) / cuota;
  if (x <= 0) return Infinity;
  return Math.ceil(-Math.log(x) / Math.log(1 + i) - 1e-4);
}

/**
 * Resumen de un préstamo en cuotas fijas. `capital` = lo que prestaron / saldo de capital hoy.
 * Devuelve null si los datos no cierran (cuota × n menor que el capital).
 */
export function resumenPrestamo({ capital, cuota, n }) {
  const i = tasaImplicita(capital, cuota, n);
  if (i == null) return null;
  const total = r2(cuota * n);
  return {
    mensual: i, tna: mensualATna(i), tea: teaDesdeMensual(i),
    total, intereses: r2(total - capital),
    cft: capital > 0 ? ((total / capital) - 1) * 100 : 0 // sobrecosto total sobre el capital, en %
  };
}

/** Plan de amortización (francés): un renglón por cuota. */
export function cronograma({ capital, cuota, i, n }) {
  const out = []; let saldo = capital;
  for (let k = 1; k <= n && saldo > 0.005; k++) {
    const interes = saldo * i;
    const pago = Math.min(cuota, saldo + interes);
    const amort = pago - interes;
    saldo = Math.max(0, saldo - amort);
    if (saldo < 0.5) saldo = 0; // residuo de redondeo del valor presente
    out.push({ n: k, interes: r2(interes), amortizacion: r2(amort), cuota: r2(pago), saldo: r2(saldo) });
  }
  return out;
}
