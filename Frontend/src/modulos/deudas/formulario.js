import { r2, parseMonto } from '../cuentas/util.js';
import { estadoDeuda, validarDeuda, TIPOS_DEUDA } from './deudas.js';
import { resumenPrestamo, valorPresente, tnaAMensual, cuotasParaSaldar } from './financiera.js';

/**
 * Lógica pura del formulario de Saldar. El formulario habla en "hoy" (cuánto debés, cuántas cuotas faltan);
 * al guardar se traduce a lo que guarda la tabla (saldo_inicial a la fecha de inicio = debés hoy + lo ya pagado).
 */

const vacio = (v) => v === '' || v == null;
const texto = (n) => (n == null ? '' : String(n).replace('.', ','));
// Montos con separador de miles (como los escribe la gente): 10000 → "10.000".
const monto = (n) => (n == null ? '' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }));
const numero = (v) => (vacio(v) ? null : parseMonto(v));
const tasaNum = (v) => (vacio(v) ? null : Number(String(v).replace(',', '.').replace('%', '').trim()));

/** Préstamo → cuotas fijas; persona y atraso → monto libre (se puede cambiar). */
export const modoDeTipo = (tipo) => (tipo === 'prestamo' ? 'cuotas' : 'libre');
export const MODOS = [{ id: 'cuotas', label: 'Cuotas fijas' }, { id: 'libre', label: 'Monto libre' }];

export const formVacio = (hoy) => ({
  tipo: 'prestamo', modo: 'cuotas', nombre: '', acreedor: '', moneda: 'ARS',
  cuota_monto: '', cuotas_restantes: '', saldo_hoy: '', tasa_anual: '', dia_vencimiento: '', capital: '',
  palabra_clave: '', notas: '', fecha_inicio: hoy
});

/** Edición: muestra lo que debés HOY y las cuotas que faltan HOY, no los valores de la fecha de alta. */
export function formDesdeDeuda(d, pagos = []) {
  const e = estadoDeuda(d, pagos);
  const modo = d.cuotas_restantes != null ? 'cuotas' : 'libre';
  const auto = modo === 'cuotas' && d.cuota_monto > 0 && e.cuotasRestantes > 0 ? r2(Number(d.cuota_monto) * e.cuotasRestantes) : null;
  return {
    tipo: d.tipo, modo, nombre: d.nombre, acreedor: d.acreedor || '', moneda: d.moneda || 'ARS',
    cuota_monto: monto(d.cuota_monto), cuotas_restantes: modo === 'cuotas' ? String(e.cuotasRestantes ?? '') : '',
    saldo_hoy: auto != null && Math.abs(auto - e.saldo) <= 0.5 ? '' : monto(e.saldo), // vacío = se calcula solo
    tasa_anual: d.tasa_anual == null ? '' : texto(d.tasa_anual), dia_vencimiento: d.dia_vencimiento == null ? '' : String(d.dia_vencimiento), capital: '',
    palabra_clave: d.palabra_clave || '', notas: d.notas || '', fecha_inicio: d.fecha_inicio
  };
}

/** Todo lo que el formulario muestra en vivo. */
export function derivar(f) {
  const cuota = numero(f.cuota_monto);
  const n = vacio(f.cuotas_restantes) ? null : Number(f.cuotas_restantes);
  const cuotasOk = f.modo === 'cuotas' && cuota > 0 && Number.isInteger(n) && n > 0;
  const auto = cuotasOk ? r2(cuota * n) : null;
  const tipeado = numero(f.saldo_hoy);
  const saldo = tipeado != null ? tipeado : auto; // lo que escribís manda sobre cuota × cuotas
  const tasa = tasaNum(f.tasa_anual);
  const i = Number.isFinite(tasa) && tasa > 0 && tasa <= 1000 ? tnaAMensual(tasa) : 0;
  const coincide = auto != null && saldo != null && Math.abs(saldo - auto) <= 0.5; // si escribiste otro saldo, el cálculo no aplica
  const capitalHoy = cuotasOk && i > 0 && coincide ? valorPresente(cuota, i, n) : null; // lo que pagarías si cancelás hoy
  const ahorro = capitalHoy != null ? r2(auto - capitalHoy) : null;
  const mesesRaw = f.modo === 'libre' && saldo > 0 && cuota > 0 ? cuotasParaSaldar(saldo, cuota, i) : null;
  const meses = mesesRaw > 1200 ? Infinity : mesesRaw;
  const capitalIn = numero(f.capital);
  const implicita = cuotasOk && capitalIn > 0 ? resumenPrestamo({ capital: capitalIn, cuota, n }) : null;
  return {
    cuota, n, cuotasOk, auto, saldo, tasa, capitalHoy, ahorro, meses, implicita,
    implicitaInvalida: cuotasOk && capitalIn > 0 && !implicita
  };
}

/** Formulario → fila para guardar. Devuelve { fila } o { error, campo }. */
export function filaDesdeForm(f, { deuda = null, pagos = [] } = {}) {
  const dv = derivar(f);
  if (f.modo === 'cuotas') {
    if (!(dv.cuota > 0)) return { campo: 'cuota_monto', error: 'Poné la cuota mensual (o pasá a "Monto libre").' };
    if (!Number.isInteger(dv.n) || dv.n < 1) return { campo: 'cuotas_restantes', error: '¿Cuántas cuotas faltan? Tiene que ser un número entero.' };
  }
  if (!vacio(f.saldo_hoy) && !(numero(f.saldo_hoy) > 0)) return { campo: 'saldo_hoy', error: 'El saldo tiene que ser un monto mayor a 0. Si ya la pagaste, usá "Marcar saldada".' };
  if (f.modo === 'libre' && !(dv.saldo > 0)) return { campo: 'saldo_hoy', error: 'Poné cuánto debés hoy.' };
  const previo = deuda ? estadoDeuda({ ...deuda, fecha_inicio: f.fecha_inicio, moneda: f.moneda }, pagos) : { pagado: 0, pagos: [] };
  const tipo = TIPOS_DEUDA.find((t) => t.id === f.tipo)?.label || 'Deuda';
  const nombre = f.nombre.trim() || [tipo, f.acreedor.trim()].filter(Boolean).join(' ');
  return validarDeuda({
    ...f, nombre,
    saldo_inicial: dv.saldo > 0 ? r2(dv.saldo + previo.pagado) : '',
    cuotas_restantes: f.modo === 'cuotas' ? dv.n + previo.pagos.length : '',
    cuota_monto: f.cuota_monto
  });
}
