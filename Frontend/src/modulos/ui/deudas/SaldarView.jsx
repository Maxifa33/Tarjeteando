import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Check, X, Sparkles } from 'lucide-react';
import { pesos, dolares, capitalizar, mesLargo } from '../../../ui/formato.js';
import { parseMonto } from '../../cuentas/util.js';
import { movimientosEntre, mesesConDatos } from '../../cuentas/repo.js';
import { rangoMes, moverMes } from '../../cuentas/resumen.js';
import { historial } from '../../cuentas/presupuesto.js';
import { tarjetasPorMes } from '../../puente/tarjeteando.js';
import { estadoDeuda, sugerirPagos, compararPlanes, itemsPlan, pagadoEnMes, manualParecido, mesMas, TIPOS_DEUDA } from '../../deudas/deudas.js';
import { listarDeudas, pagosDeDeudas, candidatos, confirmarPago, descartar, idCategoriaDeudas } from '../../deudas/repo.js';
import { FormDeuda, DetalleDeuda, hoyISO, plata, fechaDM } from './HojasDeuda.jsx';
import '../modulos.css';

const hoyMes = () => hoyISO().slice(0, 7);
const r2 = (n) => Math.round(n * 100) / 100;

/** Plata disponible para deudas: lo que te quedó en promedio + lo que ya pagás de deudas (últimos 3 meses con cuentas). */
async function sugerirMonto(tarjeteando, pagos) {
  const ultima = await mesesConDatos();
  if (!ultima) return null;
  // Solo meses cerrados: el mes en curso está incompleto y bajaría el promedio.
  const cerrado = moverMes(hoyMes(), -1);
  const mes = ultima.slice(0, 7) < cerrado ? ultima.slice(0, 7) : cerrado;
  const movs = await movimientosEntre(rangoMes(moverMes(mes, -2)).desde, rangoMes(mes).hasta);
  const h = historial(mes, movs, tarjetasPorMes(tarjeteando?.evolucion || []), 3).filter((x) => x.conCuentas);
  if (!h.length) return null;
  const prom = h.reduce((s, x) => s + x.teQueda + pagadoEnMes(pagos, x.mesKey), 0) / h.length;
  return { monto: Math.max(0, Math.round(prom / 1000) * 1000), meses: h.length };
}

const Plan = ({ items, sugerido }) => {
  const minimos = r2(items.reduce((s, d) => s + (d.minimo || 0), 0));
  const [texto, setTexto] = useState('');
  const tocado = useRef(false);
  useEffect(() => {
    if (tocado.current) return;
    const base = Math.max(minimos, sugerido?.monto || 0);
    setTexto(base ? String(base) : '');
  }, [minimos, sugerido]);
  const monto = parseMonto(texto) || 0;
  const c = useMemo(() => compararPlanes(items, monto), [items, monto]);
  if (!items.length) return null;

  const columna = ({ id, titulo, bajada, r }) => {
    const reco = c.recomendada === id && r.meses;
    return (
      <div key={id} style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8, padding: 18, borderRadius: 20, background: reco ? 'var(--fill)' : 'var(--fill2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{titulo}</span>
          {reco && <span className="mod-chip"><Sparkles size={12} aria-hidden="true" style={{ marginRight: 4 }} />Conviene</span>}
        </div>
        <span style={{ fontSize: 13, color: 'var(--label2)' }}>{bajada}</span>
        {r.meses ? (
          <>
            <span className="mod-cifra" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>{r.meses} {r.meses === 1 ? 'mes' : 'meses'}</span>
            <span style={{ fontSize: 14 }}>Terminás en {mesLargo(mesMas(hoyMes(), r.meses))}{c.conTasa ? ` · intereses ${pesos(r.intereses)}` : ''}</span>
            <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 14, color: 'var(--label2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {r.orden.map((o) => <li key={o.id}>{o.nombre} <span className="mod-cifra">· mes {o.mes}</span></li>)}
            </ol>
          </>
        ) : <span style={{ fontSize: 14 }}>{r.motivo === 'sin_monto' ? 'Poné un monto por mes.' : r.motivo === 'muy_largo' ? 'Con este monto tardás más de 30 años.' : 'Con este monto no terminás nunca: los intereses crecen más rápido que lo que pagás.'}</span>}
      </div>
    );
  };

  return (
    <section aria-labelledby="sal-plan" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 id="sal-plan" className="h3" style={{ margin: 0 }}>Plan para saldar</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--label2)', maxWidth: 360 }}>
        ¿Cuánto podés poner por mes para deudas?
        <input className="mod-campo" inputMode="decimal" value={texto} onChange={(e) => { tocado.current = true; setTexto(e.target.value); }} style={{ flex: '0 0 auto' }} />
        <span style={{ fontSize: 12 }}>
          {sugerido ? `Sugerido: lo que te quedó en promedio (${sugerido.meses} ${sugerido.meses === 1 ? 'mes' : 'meses'}, Presupuestos) más lo que ya pagás de deudas. ` : ''}
          Mínimo para cubrir cuotas: {pesos(minimos)}.
        </span>
      </label>
      <div aria-live="polite">
        {c.avalancha.insuficiente ? (
          <div className="mod-aviso" role="status">No alcanza para las cuotas mínimas ({pesos(minimos)} por mes). Subí el monto o renegociá alguna deuda.</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {columna({ id: 'avalancha', titulo: 'Avalancha', bajada: 'Primero la de tasa más alta. Pagás menos intereses.', r: c.avalancha })}
            {columna({ id: 'bola', titulo: 'Bola de nieve', bajada: 'Primero la más chica. Cerrás deudas antes y liberás cuotas.', r: c.bola })}
          </div>
        )}
        {!c.avalancha.insuficiente && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--label2)' }}>
            {!c.recomendada ? (monto > 0 ? 'Ninguno de los dos termina con este monto: subilo o renegociá la tasa más cara.' : '')
              : !c.avalancha.meses || !c.bola.meses ? `Solo ${c.recomendada === 'avalancha' ? 'avalancha' : 'bola de nieve'} termina con este monto.`
                : !c.conTasa ? 'Sin tasas cargadas, los dos planes tardan lo mismo: conviene bola de nieve porque cerrás deudas antes.'
                  : c.recomendada === 'avalancha' ? `Avalancha te ahorra ${pesos(c.ahorro)} en intereses.`
                    : 'La diferencia en intereses es chica: bola de nieve te da victorias rápidas.'}
            {' '}Las deudas en dólares no entran en el plan.
          </p>
        )}
      </div>
    </section>
  );
};

/** Saldar: tus deudas fuera de la tarjeta, los pagos que encontramos y un plan para cancelarlas. */
const SaldarView = ({ tarjeteando }) => {
  const [deudas, setDeudas] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [cands, setCands] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // { deuda } | null
  const [detalleId, setDetalleId] = useState(null);
  const [sugerido, setSugerido] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [catDeudas, setCatDeudas] = useState(null);
  const [esOtro, setEsOtro] = useState(() => new Set()); // sugerencias marcadas "es otro pago" (no reemplazan al manual)
  const pedido = useRef(0);
  useEffect(() => { idCategoriaDeudas().then(setCatDeudas).catch(() => {}); }, []);

  const cargar = useCallback(async () => {
    const id = ++pedido.current;
    setError(null);
    try {
      const [ds, ps] = await Promise.all([listarDeudas(), pagosDeDeudas()]);
      const activas = ds.filter((d) => d.estado === 'activa');
      const desde = activas.length ? activas.map((d) => d.fecha_inicio).sort()[0] : null;
      const cs = desde ? await candidatos(desde) : [];
      if (id !== pedido.current) return;
      setDeudas(ds); setPagos(ps); setCands(cs);
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus deudas. Revisá tu conexión.'); setDeudas((d) => d || []); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    let vivo = true;
    if (deudas?.some((d) => d.estado === 'activa')) sugerirMonto(tarjeteando, pagos).then((s) => { if (vivo) setSugerido(s); }).catch(() => {});
    return () => { vivo = false; };
  }, [deudas, pagos, tarjeteando]);

  const sugerencias = useMemo(() => sugerirPagos(deudas || [], cands, { catDeudas }), [deudas, cands, catDeudas]);
  const items = useMemo(() => itemsPlan(deudas || [], pagos), [deudas, pagos]);
  if (!deudas) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;

  const activas = deudas.filter((d) => d.estado === 'activa');
  const saldadas = deudas.filter((d) => d.estado === 'saldada');
  const total = (moneda) => r2(activas.filter((d) => d.moneda === moneda).reduce((s, d) => s + estadoDeuda(d, pagos).saldo, 0));
  const detalle = deudas.find((d) => d.id === detalleId) || null;

  const accion = async (s, fn) => {
    setOcupado(s.mov.id); setError(null);
    try {
      const ok = await fn();
      if (ok === false) setError('Ese movimiento ya estaba vinculado a una deuda (¿otra pestaña?). Se actualizó la lista.');
      await cargar();
    } catch (e) {
      setError(e?.message === 'duplicado'
        ? `Quedó vinculado, pero no se pudo borrar el pago cargado a mano. Abrí "${s.deuda.nombre}" y quitalo para no contarlo dos veces.`
        : 'No se pudo guardar. Revisá tu conexión.');
      await cargar();
    } finally { setOcupado(null); }
  };

  const tarjeta = (d) => {
    const e = estadoDeuda(d, pagos);
    const tipo = TIPOS_DEUDA.find((t) => t.id === d.tipo)?.label;
    return (
      <li key={d.id}>
        <button type="button" className="mod-mov" onClick={() => setDetalleId(d.id)} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 16, borderRadius: 20, background: 'var(--fill2)' }}
          aria-label={`${d.nombre}: debés ${plata(e.saldo, d.moneda)}. Ver detalle`}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</span>
              <span style={{ fontSize: 13, color: 'var(--label2)' }}>{tipo}{d.acreedor ? ` · ${d.acreedor}` : ''}</span>
            </span>
            <span className="mod-cifra" style={{ fontSize: 20, fontWeight: 700 }}>{plata(e.saldo, d.moneda)}</span>
          </span>
          <span className="mod-barra" aria-hidden="true"><i style={{ transform: `scaleX(${e.progreso})` }} /></span>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>
            {d.estado === 'saldada' ? `Saldada${e.ultimoPago ? ` · último pago ${fechaDM(e.ultimoPago)}` : ''}`
              : e.saldo <= 0 ? 'Pagada: marcala como saldada'
                : e.cuotasRestantes > 0 && d.cuota_monto ? `Faltan ${e.cuotasRestantes} ${e.cuotasRestantes === 1 ? 'cuota' : 'cuotas'} de ${plata(d.cuota_monto, d.moneda)}`
                  : e.ultimoPago ? `Último pago ${fechaDM(e.ultimoPago)}` : 'Sin pagos todavía'}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, color: 'var(--label2)' }}>Debés hoy</span>
            <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{pesos(total('ARS'))}</span>
            {total('USD') > 0 && <span className="mod-cifra" style={{ fontSize: 15, color: 'var(--label2)' }}>y {dolares(total('USD'))}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, color: 'var(--label2)' }}>Pagaste en {capitalizar(mesLargo(hoyMes()))}</span>
            <span className="mod-cifra" style={{ fontSize: 20, lineHeight: '26px', fontWeight: 600 }}>{pesos(pagadoEnMes(pagos, hoyMes()))}</span>
          </div>
        </div>
        <button type="button" className="btn btn-pri" onClick={() => setForm({ deuda: null })} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
          <Plus size={16} aria-hidden="true" /> Nueva deuda
        </button>
      </div>

      {error && <div className="mod-aviso" role="alert">{error}</div>}

      {sugerencias.length > 0 && (
        <section aria-labelledby="sal-posibles" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="sal-posibles" className="h3" style={{ margin: 0 }}>Posibles pagos ({sugerencias.length})</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Movimientos de tus cuentas que parecen pagos de una deuda.</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sugerencias.slice(0, 20).map((s) => {
              const parecido = manualParecido(estadoDeuda(s.deuda, pagos).pagos, s.mov);
              const manual = parecido && !esOtro.has(s.mov.id) ? parecido : null;
              const ocup = ocupado === s.mov.id;
              return (
                <li key={s.mov.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 16, background: 'var(--fill2)' }}>
                  <span style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.mov.descripcion}</span>
                    <span style={{ fontSize: 13, color: 'var(--label2)' }}>{fechaDM(s.mov.fecha)} · {s.mov.cuenta?.nombre || ''} · ¿pago de <strong style={{ color: 'var(--label)' }}>{s.deuda.nombre}</strong>?</span>
                    {parecido && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--label2)' }}>
                        {manual ? `¿Es el mismo que cargaste a mano el ${fechaDM(parecido.fecha)} (${plata(parecido.monto, s.deuda.moneda)})? Al confirmar, lo reemplaza.` : `Se suma aparte del cargado a mano el ${fechaDM(parecido.fecha)}.`}
                        <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => setEsOtro((x) => { const n = new Set(x); if (n.has(s.mov.id)) n.delete(s.mov.id); else n.add(s.mov.id); return n; })}>
                          {manual ? 'Es otro pago' : 'Es el mismo'}
                        </button>
                      </span>
                    )}
                  </span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{plata(s.mov.monto, s.deuda.moneda)}</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn" disabled={ocup} onClick={() => accion(s, () => descartar(s.mov, s.deuda.id))} style={{ minHeight: 44 }} aria-label={`No es pago de ${s.deuda.nombre}`}>
                      <X size={16} aria-hidden="true" /> No es
                    </button>
                    <button type="button" className="btn btn-pri" disabled={ocup} onClick={() => accion(s, () => confirmarPago(s.mov, s.deuda.id, { reemplazaManualId: manual?.id }))} style={{ minHeight: 44, borderRadius: 22, padding: '0 14px' }} aria-label={`Confirmar pago de ${s.deuda.nombre}`}>
                      <Check size={16} aria-hidden="true" /> Confirmar
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          {sugerencias.length > 20 && <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>Se muestran las 20 más nuevas.</p>}
        </section>
      )}

      <section aria-labelledby="sal-deudas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="sal-deudas" className="h3" style={{ margin: 0 }}>Tus deudas</h2>
        {activas.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activas.map(tarjeta)}
          </ul>
        ) : (
          <div style={{ padding: 20, borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 17 }}>{saldadas.length ? 'No tenés deudas activas.' : 'Cargá tus deudas fuera de la tarjeta.'}</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Préstamos del banco o Mercado Pago, plata que le debés a alguien, servicios o impuestos atrasados. Saldar reconoce los pagos en tus cuentas importadas.</p>
          </div>
        )}
      </section>

      <Plan items={items} sugerido={sugerido} />

      {saldadas.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Saldadas ({saldadas.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {saldadas.map(tarjeta)}
          </ul>
        </details>
      )}

      <FormDeuda abierta={!!form} deuda={form?.deuda || null} onCerrar={() => setForm(null)} onGuardado={() => cargar()} />
      <DetalleDeuda deuda={form ? null : detalle} pagos={pagos} onCerrar={() => setDetalleId(null)} onCambio={cargar}
        onEditar={(d) => setForm({ deuda: d })} />
    </section>
  );
};

export default SaldarView;
