import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { pesos, dolares, mesLargo } from '../../../ui/formato.js';
import Seg from '../../../ui/Seg.jsx';
import { movimientosEntre, mesesConDatos, listarBolsillos } from '../../cuentas/repo.js';
import { rangoMes, moverMes } from '../../cuentas/resumen.js';
import { historial } from '../../cuentas/presupuesto.js';
import { tarjetasPorMes, cobrosDeTarjeta } from '../../puente/tarjeteando.js';
import { cobrosDeCuenta, cobrosDe, aportesDe, cobroAtrasado } from '../../alcancia/aportes.js';
import { resumenReservas, estadoReserva, movsManuales, MEDIOS } from '../../alcancia/reservas.js';
import { estadoMeta, planMetas, valuar, totalCartera, interesPlazoFijo, TIPOS_INVERSION } from '../../alcancia/alcancia.js';
import { listarMetas, listarAportes, movimientosDeReservas, listarAjustes, listarMovsManuales, listarInversiones, preciosPara, tasasPlazoFijo, serieInflacion, listarVinculos, historicoDolar, movimientosParaCobros } from '../../alcancia/repo.js';
import { hoyISO, plata, fechaDM } from '../deudas/HojasDeuda.jsx';
import { FormMeta, DetalleMeta } from './HojasMeta.jsx';
import { FormInversion, DetalleInversion } from './HojasInversion.jsx';
import { DetalleReserva } from './HojasReserva.jsx';
import FormReserva from './FormReserva.jsx';
import { dinero, etiquetaMoneda } from './dinero.js';
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
  const [ajustes, setAjustes] = useState([]);
  const [capacidad, setCapacidad] = useState(undefined);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const id = ++pedido.current; setError(null);
    try {
      const [ms, as, bs, ajs, mans] = await Promise.all([listarMetas(), listarAportes(), listarBolsillos(), listarAjustes(), listarMovsManuales()]);
      const ids = [...new Set(ms.map((m) => m.bolsillo_id).filter(Boolean))];
      const rs = await movimientosDeReservas(ids);
      if (id !== pedido.current) return;
      setMetas(ms); setAportes(as); setBolsillos(bs); setAjustes(ajs); setMovs([...rs, ...movsManuales(mans)]);
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus metas. Revisá tu conexión.'); setMetas((m) => m || []); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { let vivo = true; capacidadMensual(tarjeteando).then((c) => { if (vivo) setCapacidad(c); }).catch(() => { if (vivo) setCapacidad(null); }); return () => { vivo = false; }; }, [tarjeteando]);

  const hoy = hoyISO();
  // Saldo de cada reserva vinculada; `ancla`: tiene saldo propio (manual o con saldo real) y entonces 'lo que ya tenés' no suma.
  const saldosReserva = useMemo(() => {
    const out = {};
    (metas || []).forEach((m) => {
      const b = m.bolsillo_id && bolsillos.find((x) => x.id === m.bolsillo_id);
      if (!b || out[b.id]) return;
      const e = estadoReserva(b, movs, ajustes);
      out[b.id] = { saldo: e.saldo, ancla: b.origen === 'manual' || !e.sinAnclar };
    });
    return out;
  }, [metas, bolsillos, movs, ajustes]);
  const bolsillosForm = useMemo(() => bolsillos.map((b) => ({ ...b, ancla: b.origen === 'manual' || ajustes.some((a) => a.bolsillo_id === b.id) })), [bolsillos, ajustes]);
  const estados = useMemo(() => Object.fromEntries((metas || []).map((m) => [m.id, estadoMeta(m, { aportes, movs, hoy, saldosReserva })])), [metas, aportes, movs, hoy, saldosReserva]);
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

      <FormMeta abierta={!!form} meta={form?.meta || null} bolsillos={bolsillosForm} usados={usados}
        conMovimientos={!!form?.meta && (form.meta.saldo_inicial > 0 || aportes.some((a) => a.meta_id === form.meta.id) || !!form.meta.bolsillo_id)} onCerrar={() => setForm(null)} onGuardado={cargar} />
      <DetalleMeta meta={form ? null : detalle} estado={detalle ? estados[detalle.id] : null} aportes={aportes}
        reserva={detalle ? bolsillos.find((b) => b.id === detalle.bolsillo_id) : null}
        onCerrar={() => setDetalleId(null)} onCambio={cargar} onEditar={(m) => setForm({ meta: m })} />
    </section>
  );
};

/* ---------- Reservas (Mercado Pago y manuales) ---------- */
const TotalesReservas = ({ r }) => {
  const { monedas, equivalente } = r;
  if (!monedas.length) return <Grande label="Plata en tus reservas" valor={pesos(0)} />;
  // Las monedas sin plata no hacen ruido: solo se listan las que tienen saldo (si ninguna tiene, la primera).
  const lista = monedas.some((t) => t.total > 0) ? monedas.filter((t) => t.total > 0) : monedas.slice(0, 1);
  if (lista.length === 1) {
    const t = lista[0];
    const enPesos = t.moneda !== 'ARS' && t.total > 0 && !t.faltaCotizacion ? ` · ≈ ${pesos(t.ars)}` : '';
    return <Grande label="Plata en tus reservas" valor={dinero(t.total, t.moneda)} nota={`Ahorro ${dinero(t.ahorro, t.moneda)} · Apartado ${dinero(t.apartado, t.moneda)}${enPesos}`} />;
  }
  return (
    <section aria-label="Plata en tus reservas" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, color: 'var(--label2)' }}>Plata en tus reservas</span>
      {lista.map((t) => (
        <span key={t.moneda} style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="mod-cifra" style={{ fontSize: t.moneda === 'ARS' ? 34 : 24, lineHeight: t.moneda === 'ARS' ? '40px' : '30px', fontWeight: 700, letterSpacing: '-.02em' }}>{dinero(t.total, t.moneda)}</span>
          <span className="mod-cifra" style={{ fontSize: 13, color: 'var(--label2)' }}>Ahorro {dinero(t.ahorro, t.moneda)} · Apartado {dinero(t.apartado, t.moneda)}</span>
        </span>
      ))}
      {equivalente.mostrar && (
        <span style={{ fontSize: 14, color: 'var(--label2)' }}>
          {equivalente.completo ? <>En pesos, todo junto: <strong className="mod-cifra">≈ {pesos(equivalente.ars)}</strong></>
            : <>Equivalente en pesos: <strong className="mod-cifra">≈ {pesos(equivalente.ars)}</strong> sin contar {equivalente.faltan.join(', ')} (falta la cotización)</>}
        </span>
      )}
    </section>
  );
};

const Reservas = () => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [alta, setAlta] = useState(false);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const id = ++pedido.current; setError(null);
    try {
      const [bs, ms, as, mans, ps] = await Promise.all([listarBolsillos(), movimientosDeReservas(null, { todas: true }), listarAjustes(), listarMovsManuales(), preciosPara([]).catch(() => new Map())]);
      if (id !== pedido.current) return;
      const f = ps.get('dolar|bolsa');
      setDatos({ bs, movs: [...ms, ...movsManuales(mans)], as, mep: f ? Number(f.compra || f.precio) : null });
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus reservas. Revisá tu conexión.'); setDatos((d) => d || { bs: [], movs: [], as: [], mep: null }); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const hoy = hoyISO();
  const r = useMemo(() => (datos ? resumenReservas(datos.bs, datos.movs, datos.as, hoy, { mep: datos.mep }) : null), [datos, hoy]);
  if (!r) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;
  const conSaldo = r.estados.filter((e) => e.saldo > 0);
  const vacias = r.estados.filter((e) => e.saldo <= 0);
  const detalle = [...r.estados, ...r.archivadas].find((e) => e.id === detalleId) || null;

  const tarjeta = (e) => {
    const manual = e.origen === 'manual';
    const equiv = e.moneda !== 'ARS' && e.saldo > 0 ? (e.equivalenteARS != null ? `≈ ${pesos(e.equivalenteARS)}` : 'sin cotización') : null;
    const pie = manual ? [MEDIOS.find((x) => x.id === e.medio)?.label || null, equiv, e.archivada ? 'archivada' : null].filter(Boolean).join(' · ') || null
      : e.sinAnclar ? (e.movimientos ? 'Saldo sin confirmar: tocá para cargar el de Mercado Pago' : 'Sin movimientos importados')
        : `Confirmado el ${fechaDM(e.ultimoAjuste)}${e.diasDesdeAjuste > 35 ? ' · conviene actualizarlo' : ''}${equiv ? ` · ${equiv}` : ''}`;
    return <Tarjeta key={e.id} onClick={() => setDetalleId(e.id)} label={`${e.nombre}: ${dinero(e.saldo, e.moneda)}. Ver movimientos`}
      titulo={e.nombre} sub={`${e.tipo === 'ahorro' ? 'Ahorro' : 'Apartado'} · ${manual ? etiquetaMoneda(e.moneda) : 'Mercado Pago'}`} valor={dinero(e.saldo, e.moneda)} pie={pie} />;
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <TotalesReservas r={r} />
        <button type="button" className="btn btn-pri" onClick={() => setAlta(true)} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
          <Plus size={16} aria-hidden="true" /> Nueva reserva
        </button>
      </div>
      {error && <div className="mod-aviso" role="alert">{error} <button type="button" className="btn" onClick={cargar} style={{ minHeight: 44 }}>Reintentar</button></div>}
      {r.sinAnclar > 0 && <div className="mod-aviso" role="status">{r.sinAnclar} {r.sinAnclar === 1 ? 'reserva de Mercado Pago tiene' : 'reservas de Mercado Pago tienen'} el saldo sin confirmar: el extracto no lo trae. Abrila y cargá el que ves en Mercado Pago.</div>}
      <section aria-labelledby="alc-res" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="alc-res" className="h3" style={{ margin: 0 }}>Con plata</h2>
        {conSaldo.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{conSaldo.map(tarjeta)}</ul>
          : error ? null : <Vacio titulo={r.estados.length ? 'Ninguna reserva tiene plata.' : 'Todavía no hay reservas.'} texto="Cargá las tuyas (efectivo, dólares, euros, lo que uses) con 'Nueva reserva'. Las de Mercado Pago aparecen solas cuando importás el resumen." />}
      </section>
      {vacias.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Sin saldo ({vacias.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{vacias.map(tarjeta)}</ul>
        </details>
      )}
      {r.archivadas.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Archivadas ({r.archivadas.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{r.archivadas.map(tarjeta)}</ul>
        </details>
      )}
      <FormReserva abierta={alta} reserva={null} existentes={datos.bs} onCerrar={() => setAlta(false)} onGuardado={cargar} />
      <DetalleReserva estado={alta ? null : detalle} existentes={datos.bs} onCerrar={() => setDetalleId(null)} onCambio={cargar} />
    </section>
  );
};

/* ---------- Inversiones ---------- */
const Inversiones = ({ tarjeteando }) => {
  const [invs, setInvs] = useState(null);
  const [precios, setPrecios] = useState(new Map());
  const [tasas, setTasas] = useState([]);
  const [inflacion, setInflacion] = useState(null);
  const [vinculos, setVinculos] = useState([]);
  const [errorVinculos, setErrorVinculos] = useState(false);
  // Gastos de cuenta para cobros: se bajan una sola vez, solo si hay un vínculo de cuenta o abrís el selector.
  const [movsCuenta, setMovsCuenta] = useState(null);
  const [quiereCuenta, setQuiereCuenta] = useState(false);
  const pidioCuenta = useRef(false);
  const [historico, setHistorico] = useState({ datos: null, desde: null, error: false });
  const [capacidad, setCapacidad] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const id = ++pedido.current; setError(null);
    try {
      const is = await listarInversiones();
      const conSeguroPesos = is.some((i) => i.tipo === 'seguro' && i.moneda === 'ARS');
      const seguros = is.filter((i) => i.tipo === 'seguro');
      const [ps, ts, inf, vs] = await Promise.all([preciosPara(is), tasasPlazoFijo().catch(() => []), conSeguroPesos ? serieInflacion().catch(() => null) : null,
        seguros.length ? listarVinculos().then((v) => ({ ok: v }), () => ({ error: true })) : { ok: [] }]);
      if (id !== pedido.current) return;
      setInvs(is); setPrecios(ps); setTasas(ts); setInflacion(inf);
      if (vs.ok) { setVinculos(vs.ok); setErrorVinculos(false); } else setErrorVinculos(true);
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus inversiones. Revisá tu conexión.'); setInvs((x) => x || []); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { let vivo = true; capacidadMensual(tarjeteando).then((c) => { if (vivo) setCapacidad(c); }).catch(() => {}); return () => { vivo = false; }; }, [tarjeteando]);

  const mepFila = precios.get('dolar|bolsa');
  const mep = mepFila ? Number(mepFila.compra || mepFila.precio) : null;
  const hoy = hoyISO();
  // Cobros asociados (prima en la tarjeta o débito en la cuenta) → aportes reales de cada seguro.
  const cobrosT = useMemo(() => cobrosDeTarjeta(tarjeteando?.movimientos || [], tarjeteando?.resumenes || []), [tarjeteando]);
  const necesitaCuenta = quiereCuenta || vinculos.some((v) => v.origen === 'cuenta');
  const cargarCuenta = useCallback(() => {
    pidioCuenta.current = true; setMovsCuenta((m) => (m === 'error' ? null : m));
    const hace6 = `${Number(hoyISO().slice(0, 4)) - 6}${hoyISO().slice(4)}`;
    movimientosParaCobros(hace6).then(setMovsCuenta, () => setMovsCuenta('error'));
  }, []);
  useEffect(() => { if (necesitaCuenta && !pidioCuenta.current) cargarCuenta(); }, [necesitaCuenta, cargarCuenta]);
  const movsC = Array.isArray(movsCuenta) ? movsCuenta : [];
  const cobrosC = useMemo(() => cobrosDeCuenta(movsC), [movsCuenta]); // eslint-disable-line react-hooks/exhaustive-deps
  const todosCobros = useMemo(() => [...cobrosT, ...cobrosC], [cobrosT, cobrosC]);
  const porInv = useMemo(() => {
    const out = {};
    (invs || []).filter((i) => i.tipo === 'seguro').forEach((i) => { const vs = vinculos.filter((v) => v.inversion_id === i.id); out[i.id] = { vinculos: vs, cobros: cobrosDe(vs, todosCobros, vinculos) }; });
    return out;
  }, [invs, vinculos, todosCobros]);
  // Solo si hace falta pasar pesos a dólares, se baja el historial del dólar desde el primer cobro.
  const desdeHist = useMemo(() => {
    const fs = (invs || []).filter((i) => i.tipo === 'seguro' && i.moneda === 'USD').flatMap((i) => porInv[i.id]?.cobros.filter((c) => c.moneda === 'ARS').map((c) => c.fecha) || []).sort();
    if (!fs.length) return null;
    const d = new Date(`${fs[0]}T12:00:00`); d.setDate(d.getDate() - 40); return d.toISOString().slice(0, 10);
  }, [invs, porInv]);
  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    let vivo = true;
    if (!desdeHist || (historico.datos && historico.desde <= desdeHist)) return undefined;
    setHistorico((h) => ({ ...h, error: false }));
    historicoDolar(desdeHist).then((d) => { if (vivo) setHistorico({ datos: d, desde: desdeHist, error: false }); }, () => { if (vivo) setHistorico((h) => ({ ...h, error: true })); });
    return () => { vivo = false; };
  }, [desdeHist, reintento]); // eslint-disable-line react-hooks/exhaustive-deps
  const histListo = !desdeHist || (historico.datos && historico.desde <= desdeHist);
  // Último dato de CADA fuente (esa tarjeta, esa cuenta): la alerta solo salta si importaste algo posterior de esa misma fuente.
  const ultimaPorFuente = useMemo(() => {
    const u = {};
    [...cobrosT, ...movsC.map((m) => ({ fuente: `cuenta:${m.cuenta_id || ''}`, fecha: m.fecha }))].forEach((c) => { if (c.fecha && (!u[c.fuente] || c.fecha > u[c.fuente])) u[c.fuente] = c.fecha; });
    return u;
  }, [cobrosT, movsCuenta]); // eslint-disable-line react-hooks/exhaustive-deps
  const aportes = useMemo(() => {
    const out = {};
    (invs || []).filter((i) => i.tipo === 'seguro').forEach((i) => {
      const cs = porInv[i.id]?.cobros || [];
      if (!cs.length) return;
      const necesitaHist = i.moneda === 'USD' && cs.some((c) => c.moneda === 'ARS');
      if (necesitaHist && !histListo) { out[i.id] = { pendiente: true, error: historico.error, flujos: [], reales: 0 }; return; }
      out[i.id] = { ...aportesDe(i, cs, historico.datos, { hasta: i.valor_fecha || hoy }), atrasado: i.estado === 'activa' ? cobroAtrasado(i, cs, ultimaPorFuente, hoy) : null };
    });
    return out;
  }, [invs, porInv, historico, histListo, ultimaPorFuente, hoy]);
  const valores = useMemo(() => Object.fromEntries((invs || []).map((i) => [i.id, valuar(i, precios, { mep, hoy, inflacion, aportes })])), [invs, precios, mep, hoy, inflacion, aportes]);
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
    const valor = v.sinPrecio ? '—' : v.moneda === 'USD' && v.usd != null ? dolares(v.usd) : v.ars != null ? pesos(v.ars) : '—';
    const pie = v.sinPrecio ? 'Sin cotización todavía'
      : [v.ganancia != null ? `${v.ganancia >= 0 ? '+' : '−'}${plata(Math.abs(v.ganancia), v.gananciaMoneda)}${v.gananciaPct != null ? ` (${v.gananciaPct >= 0 ? '+' : '−'}${Math.abs(v.gananciaPct).toFixed(1).replace('.', ',')}%)` : ''}` : null,
        v.sinMep ? 'sin dólar para pasar a pesos' : null, v.estimado ? 'estimado' : null, v.seguro?.viejo ? 'actualizá el valor' : null, v.seguro && v.seguro.rescate == null && v.seguro.cuenta != null ? 'sin descontar rescate' : null, v.seguro?.rinde?.anual != null ? `${v.seguro.rescate != null ? 'si rescatás, ' : ''}rinde ${v.seguro.rinde.anual >= 0 ? '' : '−'}${Math.abs(v.seguro.rinde.anual).toFixed(1).replace('.', ',')}% anual${v.seguro.rinde.estimado ? ' (estimado)' : ''}${v.seguro.real != null ? ` · real ${v.seguro.real >= 0 ? '+' : '−'}${Math.abs(v.seguro.real).toFixed(1).replace('.', ',')}%` : ''}` : null,
        v.seguro?.faltaAportado ? 'cargá el total aportado o asociá el cobro' : null, aportes[i.id]?.atrasado ? 'no aparece el último cobro' : null, aportes[i.id]?.pendiente ? (aportes[i.id].error ? 'no se pudo leer el dólar histórico' : 'calculando…') : null, v.seguro?.rinde?.dudoso ? 'revisá los datos' : null,
        v.seguro?.aportadoEstimado && v.ganancia != null ? 'aportado estimado' : null, v.vence ? `${v.vencido ? 'venció' : 'vence'} ${fechaDM(v.vence)}` : null].filter(Boolean).join(' · ') || null;
    return (
      <Tarjeta key={i.id} onClick={() => setDetalleId(i.id)} label={`${i.nombre}: ${valor}. Ver detalle`} titulo={i.nombre}
        sub={i.tipo === 'seguro' ? `Seguro${i.aseguradora ? ` · ${i.aseguradora}` : ''}` : `${tipo}${i.simbolo && i.tipo !== 'dolar' && i.simbolo !== i.nombre ? ` · ${i.simbolo}` : ''}`} valor={valor} pie={pie} />
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
        onEditar={(i) => setForm({ inversion: i })}
        cobrosCtx={detalle?.tipo === 'seguro' ? {
          ...porInv[detalle.id], todos: todosCobros, todosVinculos: vinculos, aportes: aportes[detalle.id] || null, atrasado: aportes[detalle.id]?.atrasado || null, sinTarjetaLocal: !cobrosT.length,
          errorVinculos, cuenta: movsCuenta === 'error' ? 'error' : movsCuenta ? 'ok' : necesitaCuenta ? 'cargando' : 'sin_pedir',
          onAbrir: () => setQuiereCuenta(true), onReintentarCuenta: cargarCuenta, onReintentarHist: () => setReintento((n) => n + 1)
        } : null} />
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
