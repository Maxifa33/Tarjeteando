import { clasificar, tipoBolsillo } from './clasificar.js';
import { huellas } from './huella.js';
import { r2, mesKeyDe, normalizar } from './util.js';

/**
 * Reglas del usuario por contraparte ("siempre que Tomás me transfiera, es un recupero").
 * Solo pisan lo que la clasificación automática dejó para revisar o como transferencia con terceros.
 */
export function aplicarRegla(m, reglas = []) {
  // Solo lo que quedó dudoso: nunca pisa un sueldo, un pago de tarjeta o una transferencia propia ya reconocidos.
  if (!m.contraparte || m.estado !== 'revisar') return m;
  const r = reglas.find((x) => x.contraparte === normalizar(m.contraparte) && x.direccion === m.direccion);
  if (!r) return m;
  return {
    ...m,
    tipo: r.tipo,
    modulo: r.tipo === 'ingreso' ? 'platita' : 'billetera',
    categoria: null,
    categoria_id: r.categoria_id || null,
    naturaleza: r.tipo === 'ingreso' ? (m.naturaleza || 'activo') : null,
    cuenta_en_presupuesto: r.tipo !== 'transferencia_interna',
    estado: 'confirmado',
    regla: true
  };
}

/**
 * Arma el plan de importación de uno o varios archivos ya interpretados (sin tocar la base).
 * @param archivos  [{ nombre, hash, resultado }]  resultado = interpretar(...)
 * @param ctx       { titulares: [{nombre,cuit}], huellasExistentes: Set<string>, bolsillosExistentes: Set<'cuentaKey|nombre'> }
 */
export async function armarPlan(archivos, { titulares = [], huellasExistentes = new Set(), bolsillosExistentes = new Set(), hashesImportados = new Set(), reglas = [] } = {}) {
  // Titulares de todos los archivos del lote: así un Galicia y un Mercado Pago subidos juntos se reconocen entre sí.
  const tit = [...titulares];
  archivos.forEach((a) => { if (a.resultado?.titular) tit.push(a.resultado.titular); });

  const vistasEnLote = new Set();
  const salida = [];
  for (const a of archivos) {
    const r = a.resultado;
    if (!r?.ok) { salida.push({ ...a, estado: 'error', error: r?.error || 'No se pudo leer.' }); continue; }
    const hs = await huellas(r.movimientos, r.cuenta);
    const nuevos = [];
    let duplicados = 0;
    r.movimientos.forEach((m, i) => {
      const h = hs[i];
      if (huellasExistentes.has(h) || vistasEnLote.has(h)) { duplicados += 1; return; }
      vistasEnLote.add(h);
      nuevos.push(aplicarRegla({ ...m, huella: h, ...clasificar(m, { origen: r.origen, titulares: tit }) }, reglas));
    });
    const bolsillos = [...new Set(nuevos.filter((m) => m.bolsillo).map((m) => m.bolsillo))]
      .filter((b) => !bolsillosExistentes.has(`${r.cuenta.institucion}|${b}`))
      .map((nombre) => ({ nombre, tipo: tipoBolsillo(nombre) }));
    salida.push({ ...a, estado: 'listo', yaImportado: !!(a.hash && hashesImportados.has(a.hash)), nuevos, duplicados, bolsillosNuevos: bolsillos, resumen: resumir(nuevos) });
  }
  return { archivos: salida, titulares: tit };
}

export function resumir(movs) {
  const suma = (f) => r2(movs.filter(f).reduce((s, m) => s + m.monto, 0));
  return {
    ingresos: suma((m) => m.tipo === 'ingreso'),
    gastos: suma((m) => m.tipo === 'gasto'),
    internos: movs.filter((m) => ['transferencia_interna', 'pago_tarjeta', 'reserva'].includes(m.tipo)).length,
    recuperos: suma((m) => m.tipo === 'recupero'),
    revisar: movs.filter((m) => m.estado === 'revisar').length,
    meses: [...new Set(movs.map((m) => mesKeyDe(m.fecha)))].sort()
  };
}
