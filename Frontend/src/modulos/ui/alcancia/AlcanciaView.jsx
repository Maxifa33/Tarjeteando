import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { pesos, dolares, mesLargo } from '../../../ui/formato.js';
import Seg from '../../../ui/Seg.jsx';
import { movimientosEntre, mesesConDatos, listarBolsillos } from '../../cuentas/repo.js';
import { rangoMes, moverMes } from '../../cuentas/resumen.js';
import { historial } from '../../cuentas/presupuesto.js';
import { tarjetasPorMes } from '../../puente/tarjeteando.js';
import { resumenReservas } from '../../alcancia/reservas.js';
import { estadoMeta, planMetas, valuar, totalCartera, interesPlazoFijo, TIPOS_INVERSION } from '../../alcancia/alcancia.js';
import { listarMetas, listarAportes, movimientosDeReservas, listarAjustes, listarInversiones, preciosPara, tasasPlazoFijo } from '../../alcancia/repo.js';
import { hoyISO, plata, fechaDM } from '../deudas/HojasDeuda.jsx';
import { FormMeta, DetalleMeta } from './HojasMeta.jsx';
import { FormInversion, DetalleInversion } from './HojasInversion.jsx';
import { DetalleReserva } from './HojasReserva.jsx';
import '../modulos.css';

// Tolerancia de 3 días: el último día del mes puede no tener movimientos.
const menosDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hoyMes = () => hoyISO().slice(0, 7);
const TAB_KEY = 'alcancia_pestana';
const leerTab = () => { try { const t = localStorage.getItem(TAB_KEY); return t === 'inversiones' || t === 'reservas' ? t : 'metas'; } catch { return 'metas'; } };

/** Lo que te quedó en promedio por mes (Presupuestos), solo meses cerrados con cuentas importadas. */
async function capacidadMensual(tarjeteando) {
  const ultima = await mesesConDatos();
  if (!ultima) return null;
  // Solo meses completos: si el último extracto no llega a fin de mes, ese mes está a medias y no cuenta.
  const cerrado = moverMes(hoyMes(), -1);
  let mes = ultima.slice(0, 7) < cerrado ? ultima.slice(0, 7) : cerrado;
  if (mes === ultima.slice(0, 7) && ultima < menosDias(rangoMes(mes).hasta, 3)) mes = moverMes(mes, -1);
  const movs = await movimientosEntre(rangoMes(moverMes(mes, -2)).desde, rangoMes(mes).hasta);
  const h = historial(mes, movs, tarjetasPorMes(tarjeteando?.evolucion || []), 3).filter((x) => x.conCuentas);
  if (!h.length) return null;
  return { monto: Math.round(h.reduce((s, x) => s + x.teQueda, 0) / h.length), meses: h.length, hasta: mes };
}

const Grande = ({ label, valor, nota }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 13, color: 'var(--label2)' }}>{label}</span>
    <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{valor}</span>
    {nota && <span className="mod-cifra" style={{ fontSize: 14, color: 'var(--label2)' }}>{nota}</span>}
  </div>
);

const Tarjeta = ({ onClick, label, titulo, sub, valor, progreso, pie }) => (
  <li>
    <button type="button" className="mod-mov" onClick={onClick} aria-label={label}
      style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 16, borderRadius: 20, background: 'var(--fill2)' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</span>
          {sub && <span style={{ fontSize: 13, color: 'var(--label2)' }}>{sub}</span>}
        </span>
        <span className="mod-cifra" style={{ fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>{valor}</span>
      </span>
      {progreso != null && <span className="mod-barra" aria-hidden="true"><i style={{ transform: `scaleX(${progreso})` }} /></span>}
      {pie && <span style={{ fontSize: 13, color: 'var(--label2)' }}>{pie}</span>}
    </button>
  </li>
);

const Vacio = ({ titulo, texto }) => (
  <div style={{ padding: 20, borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <p style={{ margin: 0, fontSize: 17 }}>{titulo}</p>
    <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>{texto}</p>
  </div>
);

/* ---------- Metas ---------- */
const Metas = ({ tarjeteando }) => {
  const [metas, setMetas] = useState(null);
  const [aportes, setAportes] = useState([]);
  const [movs, setMovs] = useState([]);
  const [bolsillos, setBolsillos] = useState([]);
  const [capacidad, setCapacidad] = useState(undefined);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const id = ++pedido.current; setError(null);
    try {
      const [ms, as, bs] = await Promise.all([listarMetas(), listarAportes(), listarBolsillos()]);
      const ids = [...new Set(ms.map((m) => m.bolsillo_id).filter(Boolean))];
      const rs = await movimientosDeReservas(ids);
      if (id !== pedido.current) return;
      setMetas(ms); setAportes(as); setBolsillos(bs); setMovs(rs);
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus metas. Revisá tu conexión.'); setMetas((m) => m || []); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { let vivo = true; capacidadMensual(tarjeteando).then((c) => { if (vivo) setCapacidad(c); }).catch(() => { if (vivo) setCapacidad(null); }); return () => { vivo = false; }; }, [tarjeteando]);

  const hoy = hoyISO();
  const estados = useMemo(() => Object.fromEntries((metas || []).map((m) => [m.id, estadoMeta(m, { aportes, movs, hoy })])), [metas, aportes, movs, hoy]);
  if (!metas) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;
  const activas = metas.filter((m) => m.estado === 'activa');
  const logradas = metas.filter((m) => m.estado === 'lograda');
  const plan = planMetas(metas, estados, capacidad ? capacidad.monto : null);
  const total = (mon) => activas.filter((m) => m.moneda === mon).reduce((s, m) => s + estados[m.id].juntado, 0);
  // Una reserva alimenta una sola meta activa (las logradas la liberan para la próxima).
  const usados = new Set(activas.map((m) => m.bolsillo_id).filter(Boolean));
  const detalle = metas.find((m) => m.id === detalleId) || null;

  const tarjeta = (m) => {
    const e = estados[m.id];
    const pie = m.estado === 'lograda' ? 'Lograda'
      : e.cumplida ? '¡Llegaste! Marcala como lograda'
        : e.vencida ? `Venció el ${fechaDM(m.fecha_objetivo)}: te faltan ${plata(e.falta, m.moneda)}`
          : e.porMes ? `${plata(e.porMes, m.moneda)} por mes hasta ${mesLargo(m.fecha_objetivo.slice(0, 7))}${e.esteMes ? ` · este mes faltan ${plata(e.esteMes, m.moneda)}` : ' · este mes, listo'}`
            : e.llegaEn ? `A este ritmo llegás en ${e.llegaEn} ${e.llegaEn === 1 ? 'mes' : 'meses'}`
              : `Faltan ${plata(e.falta, m.moneda)}`;
    return (
      <Tarjeta key={m.id} onClick={() => setDetalleId(m.id)} label={`${m.nombre}: ${plata(e.juntado, m.moneda)} de ${plata(m.objetivo, m.moneda)}. Ver detalle`}
        titulo={m.nombre} sub={`de ${plata(m.objetivo, m.moneda)}${m.bolsillo_id ? ` · reserva ${bolsillos.find((b) => b.id === m.bolsillo_id)?.nombre || ''}` : ''}`}
        valor={plata(e.juntado, m.moneda)} progreso={e.progreso} pie={pie} />
    );
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <Grande label="Juntado en tus metas" valor={pesos(total('ARS'))} nota={total('USD') > 0 ? `y ${dolares(total('USD'))}` : null} />
        <button type="button" className="btn btn-pri" onClick={() => setForm({ meta: null })} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
          <Plus size={16} aria-hidden="true" /> Nueva meta
        </button>
      </div>
      {error && <div className="mod-aviso" role="alert">{error}</div>}

      {plan.necesario > 0 && (
        <section aria-label="¿Te alcanza?" aria-live="polite" style={{ padding: '16px 18px', borderRadius: 20, background: 'var(--fill)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15 }}>Para llegar a tiempo necesitás separar <strong className="mod-cifra">{pesos(plan.necesario)}</strong> por mes.</span>
          {capacidad === undefined ? <span role="status" style={{ fontSize: 13, color: 'var(--label2)' }}>Calculando lo que te queda…</span>
            : plan.alcanza == null ? <span style={{ fontSize: 13, color: 'var(--label2)' }}>Importá tus cuentas para saber si te alcanza con lo que te queda cada mes.</span>
              : plan.alcanza ? <span style={{ fontSize: 13, color: 'var(--label2)' }}>Te alcanza: en promedio te quedaron {pesos(plan.capacidad)} por mes ({capacidad.meses === 1 ? capacidad.hasta && mesLargo(capacidad.hasta) : `${capacidad.meses} meses hasta ${mesLargo(capacidad.hasta)}`}, Presupuestos). Sobran {pesos(plan.diferencia)} antes de deudas.</span>
                : <span style={{ fontSize: 13, color: 'var(--label2)' }}>
                  No te alcanza: te quedan {pesos(plan.capacidad)} por mes en promedio, faltan {pesos(-plan.diferencia)}.
                  {plan.cubiertas.length ? ` Llegás a tiempo con ${plan.cubiertas.map((id) => metas.find((m) => m.id === id)?.nombre).join(', ')}; para el resto, mové la fecha o el monto.` : ' Mové fechas o montos.'}
                </span>}
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Es la misma plata que Saldar propone para deudas: no alcanza para las dos cosas a la vez. Solo metas en pesos con fecha.</span>
        </section>
      )}

      <section aria-labelledby="alc-metas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="alc-metas" className="h3" style={{ margin: 0 }}>Tus metas</h2>
        {activas.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{activas.map(tarjeta)}</ul>
          : <Vacio titulo={logradas.length ? 'No tenés metas activas.' : 'Poné tu primera meta.'} texto="Vacaciones, un auto, un fondo de emergencia. Vinculala a una reserva de Mercado Pago y se actualiza sola cuando importás." />}
      </section>
      {logradas.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Logradas ({logradas.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{logradas.map(tarjeta)}</ul>
        </details>
      )}

      <FormMeta abierta={!!form} meta={form?.meta || null} bolsillos={bolsillos} usados={usados}
        conMovimientos={!!form?.meta && (form.meta.saldo_inicial > 0 || aportes.some((a) => a.meta_id === form.meta.id) || !!form.meta.bolsillo_id)} onCerrar={() => setForm(null)} onGuardado={cargar} />
      <DetalleMeta meta={form ? null : detalle} estado={detalle ? estados[detalle.id] : null} aportes={aportes}
        reserva={detalle ? bolsillos.find((b) => b.id === detalle.bolsillo_id) : null}
        onCerrar={() => setDetalleId(null)} onCambio={cargar} onEditar={(m) => setForm({ meta: m })} />
    </section>
  );
};

/* ---------- Reservas de Mercado Pago ---------- */
const Reservas = () => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const id = ++pedido.current; setError(null);
    try {
      const [bs, ms, as] = await Promise.all([listarBolsillos(), movimientosDeReservas(null, { todas: true }), listarAjustes()]);
      if (id !== pedido.current) return;
      setDatos({ bs, ms, as });
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus reservas. Revisá tu conexión.'); setDatos((d) => d || { bs: [], ms: [], as: [] }); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const hoy = hoyISO();
  const r = useMemo(() => (datos ? resumenReservas(datos.bs, datos.ms, datos.as, hoy) : null), [datos, hoy]);
  if (!r) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;
  const conSaldo = r.estados.filter((e) => e.saldo > 0);
  const vacias = r.estados.filter((e) => e.saldo <= 0);
  const detalle = r.estados.find((e) => e.id === detalleId) || null;

  const tarjeta = (e) => {
    const pie = e.sinAnclar ? (e.movimientos ? 'Saldo sin confirmar: tocá para cargar el de Mercado Pago' : 'Sin movimientos importados')
      : `Confirmado el ${fechaDM(e.ultimoAjuste)}${e.diasDesdeAjuste > 35 ? ' · conviene actualizarlo' : ''}`;
    return <Tarjeta key={e.id} onClick={() => setDetalleId(e.id)} label={`${e.nombre}: ${pesos(e.saldo)}. Ver movimientos`}
      titulo={e.nombre} sub={e.tipo === 'ahorro' ? 'Ahorro' : 'Apartado'} valor={pesos(e.saldo)} pie={pie} />;
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Grande label="Plata en tus reservas" valor={pesos(r.total)} nota={`Ahorro ${pesos(r.ahorro)} · Apartado ${pesos(r.apartado)}`} />
      {error && <div className="mod-aviso" role="alert">{error} <button type="button" className="btn" onClick={cargar} style={{ minHeight: 44 }}>Reintentar</button></div>}
      {r.sinAnclar > 0 && <div className="mod-aviso" role="status">{r.sinAnclar} {r.sinAnclar === 1 ? 'reserva tiene' : 'reservas tienen'} el saldo sin confirmar: el extracto no lo trae. Abrila y cargá el que ves en Mercado Pago.</div>}
      <section aria-labelledby="alc-res" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="alc-res" className="h3" style={{ margin: 0 }}>Con plata</h2>
        {conSaldo.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{conSaldo.map(tarjeta)}</ul>
          : error ? null : <Vacio titulo={r.estados.length ? 'Ninguna reserva tiene plata.' : 'Todavía no hay reservas.'} texto="Aparecen solas cuando importás tu resumen de Mercado Pago con 'Dinero reservado'." />}
      </section>
      {vacias.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Sin saldo ({vacias.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{vacias.map(tarjeta)}</ul>
        </details>
      )}
      <DetalleReserva estado={detalle} onCerrar={() => setDetalleId(null)} onCambio={cargar} />
    </section>
  );
};

/* ---------- Inversiones ---------- */
const Inversiones = ({ tarjeteando }) => {
  const [invs, setInvs] = useState(null);
  const [precios, setPrecios] = useState(new Map());
  const [tasas, setTasas] = useState([]);
  const [capacidad, setCapacidad] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const id = ++pedido.current; setError(null);
    try {
      const is = await listarInversiones();
      const [ps, ts] = await Promise.all([preciosPara(is), tasasPlazoFijo().catch(() => [])]);
      if (id !== pedido.current) return;
      setInvs(is); setPrecios(ps); setTasas(ts);
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus inversiones. Revisá tu conexión.'); setInvs((x) => x || []); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { let vivo = true; capacidadMensual(tarjeteando).then((c) => { if (vivo) setCapacidad(c); }).catch(() => {}); return () => { vivo = false; }; }, [tarjeteando]);

  const mepFila = precios.get('dolar|bolsa');
  const mep = mepFila ? Number(mepFila.compra || mepFila.precio) : null;
  const hoy = hoyISO();
  const valores = useMemo(() => Object.fromEntries((invs || []).map((i) => [i.id, valuar(i, precios, { mep, hoy })])), [invs, precios, mep, hoy]);
  if (!invs) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;
  const activas = invs.filter((i) => i.estado === 'activa');
  const cerradas = invs.filter((i) => i.estado === 'cerrada');
  const t = totalCartera(invs, valores);
  const fechas = activas.map((i) => valores[i.id]?.fechaPrecio).filter(Boolean).sort();
  const detalle = invs.find((i) => i.id === detalleId) || null;
  const mejor = tasas[0];
  const libre = capacidad?.monto > 0 ? capacidad.monto : null;

  const tarjeta = (i) => {
    const v = valores[i.id];
    const tipo = TIPOS_INVERSION.find((x) => x.id === i.tipo)?.label;
    const valor = v.sinPrecio ? '—' : v.moneda === 'USD' && v.usd != null ? dolares(v.usd) : pesos(v.ars);
    const pie = v.sinPrecio ? 'Sin cotización todavía'
      : [v.ganancia != null ? `${v.ganancia >= 0 ? '+' : '−'}${plata(Math.abs(v.ganancia), v.gananciaMoneda)}${v.gananciaPct != null ? ` (${v.gananciaPct >= 0 ? '+' : '−'}${Math.abs(v.gananciaPct).toFixed(1).replace('.', ',')}%)` : ''}` : null,
        v.sinMep ? 'sin dólar para pasar a pesos' : null, v.estimado ? 'estimado' : null, v.vence ? `${v.vencido ? 'venció' : 'vence'} ${fechaDM(v.vence)}` : null].filter(Boolean).join(' · ') || null;
    return (
      <Tarjeta key={i.id} onClick={() => setDetalleId(i.id)} label={`${i.nombre}: ${valor}. Ver detalle`} titulo={i.nombre}
        sub={`${tipo}${i.simbolo && i.tipo !== 'dolar' && i.simbolo !== i.nombre ? ` · ${i.simbolo}` : ''}`} valor={valor} pie={pie} />
    );
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <Grande label="Tu cartera" valor={pesos(t.ars)} nota={mep ? `≈ ${dolares(Math.round((t.ars / mep) * 100) / 100)} al MEP ${pesos(mep)}` : t.usdSinPasar ? `más ${dolares(t.usdSinPasar)} sin pasar a pesos` : null} />
        <button type="button" className="btn btn-pri" onClick={() => setForm({ inversion: null })} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
          <Plus size={16} aria-hidden="true" /> Nueva inversión
        </button>
      </div>
      {error && <div className="mod-aviso" role="alert">{error}</div>}
      {activas.length > 0 && (
        <p style={{ margin: '-16px 0 0', fontSize: 12, color: 'var(--label2)' }}>
          {fechas.length ? `Cotizaciones al cierre del ${fechaDM(fechas[0])}. ` : ''}Se actualizan todas las noches.{t.faltan ? ` ${t.faltan} sin cotización no suman.` : ''}{t.faltaMep ? ` ${t.faltaMep} en dólares no suman: falta la cotización del dólar.` : ''}
        </p>
      )}

      <section aria-labelledby="alc-inv" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="alc-inv" className="h3" style={{ margin: 0 }}>Lo que tenés</h2>
        {activas.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{activas.map(tarjeta)}</ul>
          : <Vacio titulo="Cargá lo que tenés invertido." texto="Plazos fijos, fondos, dólares, CEDEARs, acciones, bonos y cripto. Se valúan con el cierre del día anterior." />}
      </section>

      {mejor && (
        <section aria-labelledby="alc-parada" style={{ padding: '16px 18px', borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="alc-parada" className="h3" style={{ margin: 0 }}>Plata parada</h2>
          <span style={{ fontSize: 14 }}>
            Mejores plazos fijos a 30 días (clientes): {tasas.slice(0, 3).map((x) => `${x.entidad.replace(/ S\.A\.U?\.?$/i, '')} ${(x.tna * 100).toFixed(1).replace('.', ',')}%`).join(' · ')}.
          </span>
          {libre && <span style={{ fontSize: 14 }}>Si lo que te queda en un mes ({pesos(libre)} en promedio) no va a deudas ni metas, 30 días al {(mejor.tna * 100).toFixed(1).replace('.', ',')}% serían ≈ <strong className="mod-cifra">{pesos(interesPlazoFijo(libre, mejor.tna))}</strong> de interés.</span>}
          <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: 'var(--label2)' }}>
            <Info size={13} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} /> Información para comparar, no es asesoramiento. Tasas del BCRA del {fechaDM(mejor.fecha)}; antes de invertir, confirmalas en tu banco.
          </span>
        </section>
      )}

      {cerradas.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Ya no las tengo ({cerradas.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{cerradas.map(tarjeta)}</ul>
        </details>
      )}

      <FormInversion abierta={!!form} inversion={form?.inversion || null} onCerrar={() => setForm(null)} onGuardado={cargar} />
      <DetalleInversion inversion={form ? null : detalle} valor={detalle ? valores[detalle.id] : null} onCerrar={() => setDetalleId(null)} onCambio={cargar}
        onEditar={(i) => setForm({ inversion: i })} />
    </section>
  );
};

/** Alcancía: metas de ahorro e inversiones. */
const AlcanciaView = ({ tarjeteando }) => {
  const [tab, setTab] = useState(leerTab);
  const cambiar = (t) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* sin storage */ } };
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      <Seg opciones={[{ id: 'metas', label: 'Metas' }, { id: 'reservas', label: 'Reservas' }, { id: 'inversiones', label: 'Inversiones' }]} valor={tab} onCambio={cambiar} ariaLabel="Sección de Alcancía" />
      {tab === 'metas' ? <Metas tarjeteando={tarjeteando} /> : tab === 'reservas' ? <Reservas /> : <Inversiones tarjeteando={tarjeteando} />}
    </section>
  );
};

export default AlcanciaView;
