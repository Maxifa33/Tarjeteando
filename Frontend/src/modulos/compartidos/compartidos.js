import { r2, normalizar, parseMonto } from '../cuentas/util.js';

/**
 * Compartidos: lógica pura (sin Supabase). Todo en centavos enteros para que las partes sumen exacto.
 * Saldo de un participante: lo que puso − lo que le toca + lo que pagó a otros − lo que le pagaron.
 * Positivo = le deben. Negativo = debe.
 */

const c = (n) => Math.round(Number(n) * 100);
const p = (cent) => cent / 100;

export const DIVISIONES = [
  { id: 'iguales', label: 'Iguales' },
  { id: 'montos', label: 'Montos' },
  { id: 'porcentajes', label: '%' },
  { id: 'partes', label: 'Partes' }
];

/** Reparte los centavos que sobran de a uno, empezando por los de mayor resto (y en orden). */
function repartirResto(totalCent, pesos) {
  const suma = pesos.reduce((s, x) => s + x, 0);
  const crudos = pesos.map((w) => (totalCent * w) / suma);
  const base = crudos.map(Math.floor);
  let resto = totalCent - base.reduce((s, x) => s + x, 0);
  const orden = crudos.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; resto > 0; k = (k + 1) % orden.length, resto--) base[orden[k].i] += 1;
  return base;
}

/**
 * Divide un gasto. `partes` = [{ p: participanteId, valor }]: en 'iguales' solo cuentan los incluidos;
 * en 'montos' valor = $; en 'porcentajes' valor = %; en 'partes' valor = cantidad de partes.
 * Devuelve { partes: [{ p, valor, monto }] } con montos que suman exacto, o { error }.
 */
export function repartir(monto, division, partes) {
  const total = c(monto);
  if (!(total > 0)) return { error: 'Poné el monto del gasto.' };
  const lista = (partes || []).filter((x) => x && x.p);
  if (!lista.length) return { error: 'Elegí entre quiénes se divide.' };
  const v = lista.map((x) => Number(x.valor));
  if (division === 'iguales') {
    const m = repartirResto(total, lista.map(() => 1));
    return { partes: lista.map((x, i) => ({ p: x.p, valor: 1, monto: p(m[i]) })) };
  }
  if (v.some((x) => !Number.isFinite(x) || x < 0)) return { error: 'Completá el valor de cada persona marcada (0 o más).' };
  if (division === 'montos') {
    const suma = v.reduce((s, x) => s + c(x), 0);
    if (suma !== total) return { error: `Los montos suman ${fmt(p(suma))} y el gasto es ${fmt(monto)}${suma < total ? `: faltan ${fmt(p(total - suma))}` : `: sobran ${fmt(p(suma - total))}`}.` };
    return { partes: lista.map((x, i) => ({ p: x.p, valor: r2(v[i]), monto: p(c(v[i])) })).filter((x) => x.monto > 0) };
  }
  if (division === 'porcentajes') {
    const suma = r2(v.reduce((s, x) => s + x, 0));
    // En centésimas: 33,33 × 3 = 99,99 se acepta (sobra un centavo de %).
    if (Math.abs(Math.round(suma * 100) - 10000) > 1) return { error: `Los porcentajes suman ${String(suma).replace('.', ',')}%: tienen que sumar 100%.` };
  }
  if (division === 'partes' && !v.some((x) => x > 0)) return { error: 'Poné al menos una parte.' };
  if (!['porcentajes', 'partes'].includes(division)) return { error: 'División desconocida.' };
  const m = repartirResto(total, v);
  return { partes: lista.map((x, i) => ({ p: x.p, valor: v[i], monto: p(m[i]) })).filter((x) => x.monto > 0) };
}

const fmt = (n) => `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Saldos por participante: Map id → número (positivo = le deben). */
export function saldos(participantes = [], gastos = [], pagos = []) {
  const s = new Map(participantes.map((x) => [x.id, 0]));
  const sumar = (id, cent) => { if (s.has(id)) s.set(id, s.get(id) + cent); };
  gastos.forEach((g) => {
    sumar(g.pagado_por, c(g.monto));
    (g.partes || []).forEach((x) => sumar(x.p, -c(x.monto)));
  });
  pagos.forEach((x) => { sumar(x.de, c(x.monto)); sumar(x.a, -c(x.monto)); });
  return new Map([...s.entries()].map(([k, v]) => [k, p(v)]));
}

/** Menos transferencias posibles para quedar a mano (deudor más grande → acreedor más grande). */
export function simplificar(mapaSaldos) {
  const deudores = []; const acreedores = [];
  mapaSaldos.forEach((v, id) => { const k = c(v); if (k < 0) deudores.push({ id, k: -k }); else if (k > 0) acreedores.push({ id, k }); });
  deudores.sort((a, b) => b.k - a.k); acreedores.sort((a, b) => b.k - a.k);
  const out = [];
  let i = 0; let j = 0;
  while (i < deudores.length && j < acreedores.length) {
    const m = Math.min(deudores[i].k, acreedores[j].k);
    out.push({ de: deudores[i].id, a: acreedores[j].id, monto: p(m) });
    deudores[i].k -= m; acreedores[j].k -= m;
    if (!deudores[i].k) i++;
    if (!acreedores[j].k) j++;
  }
  return out;
}

/** Resumen de un grupo desde mi lado. */
export function resumenGrupo(grupo, participantes, gastos, pagos) {
  const ps = participantes.filter((x) => x.grupo_id === grupo.id);
  const gs = gastos.filter((x) => x.grupo_id === grupo.id);
  const pg = pagos.filter((x) => x.grupo_id === grupo.id);
  const s = saldos(ps, gs, pg);
  const yo = ps.find((x) => x.es_yo) || null;
  const transferencias = simplificar(s);
  return {
    participantes: ps, gastos: gs, pagos: pg, saldos: s, yo, transferencias,
    miSaldo: yo ? s.get(yo.id) : 0,
    total: r2(gs.reduce((t, g) => t + Number(g.monto), 0)),
    miParte: yo ? r2(gs.reduce((t, g) => t + (g.partes || []).filter((x) => x.p === yo.id).reduce((u, x) => u + Number(x.monto), 0), 0)) : 0,
    aMano: transferencias.length === 0
  };
}

const palabras = (s) => normalizar(s).replace(/[^a-z0-9ñ ]/g, ' ').split(' ').filter((w) => w.length >= 3);

/** ¿El nombre del participante está en la contraparte? Todas sus palabras (de 3+ letras), en cualquier orden. */
export function nombreCoincide(nombre, contraparte) {
  const n = palabras(nombre); const k = new Set(palabras(contraparte));
  return n.length > 0 && n.every((w) => k.has(w));
}

/**
 * Transferencias de tus cuentas que parecen pagos de un compartido.
 * Entrada de alguien que te debe → pago de esa persona a vos. Salida a alguien a quien le debés → pago tuyo.
 * El monto no puede pasar lo que se debe (+1% por redondeos). `usados` = ids de movimientos ya vinculados.
 */
export function sugerirPagos(resumenes = [], movs = [], usados = new Set()) {
  const out = [];
  for (const m of movs) {
    if (usados.has(m.id) || m.compartido_descartado || !m.contraparte || m.moneda === 'USD') continue;
    if (!['ingreso', 'gasto'].includes(m.tipo) || m.vinculo_tarjeta || m.deuda_id) continue;
    let mejor = null;
    for (const r of resumenes) {
      if (!r.yo || r.grupo.archivado || r.grupo.moneda !== 'ARS') continue;
      const mio = r.saldos.get(r.yo.id) || 0;
      for (const persona of r.participantes) {
        if (persona.es_yo || !nombreCoincide(persona.nombre, m.contraparte)) continue;
        const suyo = r.saldos.get(persona.id) || 0;
        // Entrada: te paga alguien que debe al grupo, hasta lo que a vos te deben. Salida: le pagás a alguien a quien el grupo le debe, hasta lo que debés.
        const debe = m.direccion === 'entrada' ? Math.min(-suyo, mio) : Math.min(suyo, -mio);
        if (!(debe > 0.005)) continue;
        if (Number(m.monto) > debe + 0.01) continue;
        // Ya hay un pago igual cargado a mano (ej. reimportaste el archivo): no se sugiere.
        const de = m.direccion === 'entrada' ? persona.id : r.yo.id; const a = m.direccion === 'entrada' ? r.yo.id : persona.id;
        if (r.pagos.some((x) => x.de === de && x.a === a && Math.abs(x.monto - Number(m.monto)) < 0.005 && x.fecha === m.fecha)) continue;
        const dif = Math.abs(debe - Number(m.monto));
        if (!mejor || dif < mejor.dif) mejor = { mov: m, grupo: r.grupo, de, a, persona, debe: Math.round(debe * 100) / 100, dif };
      }
    }
    if (mejor) out.push(mejor);
  }
  return out.sort((a, b) => (a.mov.fecha < b.mov.fecha ? 1 : -1));
}

/** Lo que te deben y lo que debés, sumando todos los grupos en pesos. */
export function totales(resumenes = []) {
  let teDeben = 0; let debes = 0;
  resumenes.filter((r) => !r.grupo.archivado && r.grupo.moneda === 'ARS').forEach((r) => { if (r.miSaldo > 0) teDeben += r.miSaldo; else debes -= r.miSaldo; });
  return { teDeben: r2(teDeben), debes: r2(debes) };
}

/** Valores del formulario → partes para `repartir`. */
export function leerValores(division, incluidos, valores) {
  // Un casillero vacío no es 0: es un error (si no, esa persona quedaría afuera sin aviso).
  const leer = (v) => (v == null || String(v).trim() === '' ? NaN : division === 'montos' ? (parseMonto(v) ?? NaN) : Number(String(v).replace(',', '.')));
  return incluidos.map((id) => ({ p: id, valor: division === 'iguales' ? 1 : leer(valores[id]) }));
}
