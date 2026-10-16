import { r2, mesKeyDe } from './util.js';
import { resumenPlatita, resumenBilletera, moverMes } from './resumen.js';

/**
 * Presupuesto del mes real (Presupuestos v1). Puro.
 *   Te queda = Ingresos − Tarjetas − Gastos sin tarjeta + Recuperos de compras con tarjeta
 * Las reservas (Apartado/Ahorro) NO entran en la cuenta: su saldo se ve en Alcancía.
 * Tarjetas = lo que vence ese mes (Evolución de Tarjeteando): pagado, en curso o comprometido.
 */
export function presupuestoDelMes(mesKey, movsDelMes = [], tarjetasMes = null) {
  const p = resumenPlatita(movsDelMes);
  const b = resumenBilletera(movsDelMes);
  // Sin datos de Tarjeteando en este dispositivo: se usa lo pagado de tarjetas desde tus cuentas.
  const usaPagos = !tarjetasMes && b.pagosTarjeta > 0;
  const tarjetas = tarjetasMes ? tarjetasMes.total : b.pagosTarjeta;
  const teQueda = r2(p.total - tarjetas - b.total + b.recuperadoTarjeta + b.recuperadoNoSe);
  return {
    mesKey,
    ingresos: p.total,
    activos: p.activos,
    pasivos: p.pasivos,
    tarjetas,
    tarjetasTipo: tarjetasMes ? tarjetasMes.tipo : usaPagos ? 'desde_cuentas' : 'sin_datos',
    tarjetasUsd: tarjetasMes ? tarjetasMes.usd : 0,
    sinTarjeta: b.total,
    recuperosTarjeta: b.recuperadoTarjeta,
    recuperosNoSe: b.recuperadoNoSe,
    teQueda,
    conCuentas: movsDelMes.length > 0,
    pendientes: p.revisar.length + b.revisar.length,
    pendientesMonto: r2([...p.revisar, ...b.revisar].reduce((s, m) => s + m.monto, 0))
  };
}

/** Últimos `n` meses terminando en `mesKey` (el más reciente primero). */
export function historial(mesKey, movs = [], tarjetas = {}, n = 6) {
  const porMes = new Map();
  movs.forEach((m) => { const k = mesKeyDe(m.fecha); if (!porMes.has(k)) porMes.set(k, []); porMes.get(k).push(m); });
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = moverMes(mesKey, -i);
    out.push(presupuestoDelMes(k, porMes.get(k) || [], tarjetas[k] || null));
  }
  return out;
}
