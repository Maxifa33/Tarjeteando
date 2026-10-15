import { r2 } from './util.js';

/** Agregados del mes para Platita y Billetera. Puros: reciben filas de movimientos. */

const sumar = (lista) => r2(lista.reduce((s, m) => s + (Number(m.monto) || 0), 0));
// Neto con signo: un gasto que es entrada (devolución) resta; un ingreso que es salida, también.
const neto = (lista, positiva) => r2(lista.reduce((s, m) => s + (m.direccion && m.direccion !== positiva ? -1 : 1) * (Number(m.monto) || 0), 0));

function porCategoria(lista) {
  const mapa = new Map();
  lista.forEach((m) => {
    const k = m.categoria || 'Sin categoría';
    const e = mapa.get(k) || { categoria: k, total: 0, cantidad: 0, movs: [] };
    const signo = m.tipo === 'recupero' ? -1 : m.tipo === 'gasto' ? (m.direccion === 'entrada' ? -1 : 1) : (m.direccion === 'salida' ? -1 : 1);
    e.total = r2(e.total + signo * m.monto); e.cantidad += 1; e.movs.push(m);
    mapa.set(k, e);
  });
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

/** Ingresos (Platita). Los "a revisar" se muestran aparte y no suman hasta confirmarlos. */
export function resumenPlatita(movs = []) {
  const ingresos = movs.filter((m) => m.tipo === 'ingreso' && m.moneda !== 'USD');
  const confirmados = ingresos.filter((m) => m.estado !== 'revisar');
  const activos = confirmados.filter((m) => m.naturaleza !== 'pasivo');
  const pasivos = confirmados.filter((m) => m.naturaleza === 'pasivo');
  return {
    total: neto(confirmados, 'entrada'),
    activos: neto(activos, 'entrada'),
    pasivos: neto(pasivos, 'entrada'),
    porCategoria: porCategoria(confirmados),
    revisar: ingresos.filter((m) => m.estado === 'revisar'),
    lista: confirmados
  };
}

/**
 * Gastos sin tarjeta (Billetera). No suman: pagos de tarjeta, movimientos entre cuentas
 * propias ni reservas. Las reservas se informan aparte (apartado vs. ahorro).
 */
export function resumenBilletera(movs = []) {
  const pesos = movs.filter((m) => m.moneda !== 'USD');
  const gastos = pesos.filter((m) => m.tipo === 'gasto');
  const confirmados = gastos.filter((m) => m.estado !== 'revisar');
  // Recuperos: plata que te devuelven de un gasto tuyo. Sin vínculo a tarjeta restan acá
  // (en su categoría); vinculados a una compra con tarjeta se descuentan en Presupuestos.
  const recuperos = pesos.filter((m) => m.tipo === 'recupero' && m.estado !== 'revisar');
  // Si no recordás cómo pagaste el gasto, no se descuenta de Billetera (podría haber sido con tarjeta):
  // va aparte y Presupuestos lo suma igual a lo que te queda.
  // Con tarjeta = vinculado a una compra o marcado "con tarjeta" aunque la compra todavía no esté en un resumen.
  const esTarjeta = (m) => !!m.vinculo_tarjeta || m.recupero_pago === 'tarjeta';
  const recNoSe = recuperos.filter((m) => !esTarjeta(m) && m.recupero_pago === 'no_se');
  const recSinTarjeta = recuperos.filter((m) => !esTarjeta(m) && m.recupero_pago !== 'no_se');
  const recTarjeta = recuperos.filter(esTarjeta);
  const reservas = pesos.filter((m) => m.tipo === 'reserva');
  const reservado = (tipo) => r2(reservas.filter((m) => (m.bolsillo?.tipo || 'apartado') === tipo)
    .reduce((s, m) => s + (m.direccion === 'salida' ? m.monto : -m.monto), 0));
  return {
    total: r2(neto(confirmados, 'salida') - sumar(recSinTarjeta)),
    bruto: neto(confirmados, 'salida'),
    porCategoria: porCategoria([...confirmados, ...recSinTarjeta]),
    recuperos,
    recuperado: sumar(recuperos),
    recuperadoTarjeta: sumar(recTarjeta),
    recuperadoNoSe: sumar(recNoSe),
    revisar: gastos.filter((m) => m.estado === 'revisar'),
    lista: confirmados,
    apartado: reservado('apartado'),
    ahorrado: reservado('ahorro'),
    pagosTarjeta: neto(pesos.filter((m) => m.tipo === 'pago_tarjeta' && m.estado !== 'revisar'), 'salida')
  };
}

/** 'YYYY-MM' → { desde, hasta } (strings, sin Date('YYYY-MM-DD')). */
export function rangoMes(mesKey) {
  const [a, m] = mesKey.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { desde: `${mesKey}-01`, hasta: `${mesKey}-${String(ultimo).padStart(2, '0')}` };
}

export function moverMes(mesKey, delta) {
  const [a, m] = mesKey.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
