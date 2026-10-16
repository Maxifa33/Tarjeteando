import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pesos, dolares, mesCorto } from '../../../ui/formato.js';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import { TIPOS_DEUDA, estadoDeuda, proximoVencimiento, cancelacionHoy } from '../../deudas/deudas.js';
import { MODOS, modoDeTipo, formVacio, formDesdeDeuda, derivar, filaDesdeForm } from '../../deudas/formulario.js';
import { parseMonto } from '../../cuentas/util.js';
import { crearDeuda, actualizarDeuda, borrarDeuda, quitarPago, registrarPagoManual } from '../../deudas/repo.js';
import '../modulos.css';

export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** '2026-10-09' → '9 oct' (con mes: los pagos cruzan meses). */
export const fechaDM = (iso) => (iso ? `${Number(iso.slice(8, 10))} ${mesCorto(iso.slice(0, 7))}` : '');
/** 'Vence mañana', 'Venció el 3 oct (hace 4 días)'… para un resultado de proximoVencimiento. */
export const textoVencimiento = (v) => {
  const pl = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
  if (v.estado === 'vencida') return `Venció el ${fechaDM(v.fecha)} (hace ${pl(-v.dias)})`;
  if (v.estado === 'hoy') return 'Vence hoy';
  if (v.dias === 1) return 'Vence mañana';
  return `Vence el ${fechaDM(v.fecha)} (en ${pl(v.dias)})`;
};
export const plata = (n, moneda) => (moneda === 'USD' ? dolares(n) : pesos(n));

const Fila = ({ id, label, sub, error, children }) => (
  <div className="mod-filaf" data-error={error ? '1' : undefined}>
    <label htmlFor={id} className="mod-filaf-et">{label}{sub && <small>{sub}</small>}</label>
    {children}
  </div>
);

const AYUDA = {
  prestamo: { acreedor: 'Galicia, Mercado Pago…', quien: 'Con quién' },
  persona: { acreedor: 'Nombre y apellido', quien: 'A quién' },
  atraso: { acreedor: 'Edenor, ARBA…', quien: 'Con quién' }
};
const NOMBRE_AUTO = { prestamo: 'Préstamo', persona: 'Deuda', atraso: 'Atraso' };

const mil = (v) => { const n = parseMonto(v); return n == null ? v : n.toLocaleString('es-AR', { maximumFractionDigits: 2 }); };

/** El resultado en vivo: lo que el formulario entendió, antes de guardar. */
const Resumen = ({ f, dv }) => {
  const m = f.moneda;
  if (!(dv.saldo > 0)) {
    return (
      <div className="mod-resumen" aria-live="polite">
        <span className="mod-res-et">Debés hoy</span>
        <span className="mod-cifra mod-res-num">—</span>
        <span className="mod-res-sub">{f.modo === 'cuotas' ? 'Poné la cuota y cuántas faltan.' : 'Poné cuánto debés.'}</span>
      </div>
    );
  }
  const lineas = [];
  if (dv.cuotasOk) {
    lineas.push(<span key="c"><b>{dv.n} {dv.n === 1 ? 'cuota' : 'cuotas'}</b> de {plata(dv.cuota, m)}</span>);
    if (Math.abs(dv.saldo - dv.auto) > 0.5) lineas.push(<span key="d">Cuota × cuotas daría {plata(dv.auto, m)}; usamos lo que escribiste.</span>);
  } else if (dv.meses === Infinity) {
    lineas.push(<span key="i">Con {plata(dv.cuota, m)} por mes no se termina de pagar: no cubre los intereses.</span>);
  } else if (dv.meses) {
    lineas.push(<span key="m">Con {plata(dv.cuota, m)} por mes: <b>{dv.meses} {dv.meses === 1 ? 'mes' : 'meses'}</b>.</span>);
  }
  if (dv.capitalHoy != null) {
    lineas.push(<span key="k">Cancelando hoy pagarías unos <b>{plata(dv.capitalHoy, m)}</b>: te ahorrás {plata(dv.ahorro, m)} de intereses.</span>);
  }
  return (
    <div className="mod-resumen" aria-live="polite">
      <span className="mod-res-et">Debés hoy</span>
      <span className="mod-cifra mod-res-num">{plata(dv.saldo, m)}</span>
      {lineas.map((l, k) => <span key={k} className="mod-res-sub">{l}</span>)}
    </div>
  );
};

/** Alta o edición de una deuda. */
export const FormDeuda = ({ abierta, deuda, pagos = [], onCerrar, onGuardado }) => {
  const [f, setF] = useState(() => formVacio(hoyISO()));
  const [error, setError] = useState(null); // { campo, msg }
  const [guardando, setGuardando] = useState(false);
  const [mas, setMas] = useState(false);
  const modoTocado = useRef(false);
  const pagosRef = useRef(pagos);
  pagosRef.current = pagos;
  useEffect(() => {
    if (!abierta) return;
    const ini = deuda ? formDesdeDeuda(deuda, pagosRef.current) : formVacio(hoyISO());
    setF(ini); setError(null); setGuardando(false);
    modoTocado.current = !!deuda;
    setMas(!!deuda && !!(ini.tasa_anual || ini.palabra_clave || ini.notas || ini.moneda !== 'ARS' || (ini.modo === 'cuotas' && ini.saldo_hoy)));
  }, [abierta, deuda]);
  useEffect(() => {
    if (!error?.campo) return;
    if (['tasa_anual', 'fecha_inicio'].includes(error.campo) || (error.campo === 'saldo_hoy' && f.modo === 'cuotas')) setMas(true);
    requestAnimationFrame(() => document.getElementById(`fd-${error.campo}`)?.focus());
  }, [error]);

  const set = (k) => (e) => { setError(null); setF((x) => ({ ...x, [k]: e.target.value })); };
  const formatear = (k) => () => setF((x) => (x[k] === '' ? x : { ...x, [k]: mil(x[k]) }));
  const cambiarTipo = (tipo) => setF((x) => ({ ...x, tipo, ...(modoTocado.current ? {} : { modo: modoDeTipo(tipo) }) }));
  const cambiarModo = (modo) => { modoTocado.current = true; setError(null); setF((x) => ({ ...x, modo })); };
  const dv = useMemo(() => derivar(f), [f]);
  const err = (k) => error?.campo === k;
  const u = f.moneda === 'USD' ? ' (U$S)' : '';
  const nombreAuto = [NOMBRE_AUTO[f.tipo], f.acreedor.trim()].filter(Boolean).join(' ');

  const guardar = async () => {
    const v = filaDesdeForm(f, { deuda, pagos: pagosRef.current });
    if (v.error) { setError({ campo: v.campo, msg: v.error }); return; }
    setGuardando(true); setError(null);
    try {
      const fila = deuda ? await actualizarDeuda(deuda.id, v.fila) : await crearDeuda(v.fila);
      onGuardado?.(fila); onCerrar();
    } catch { setError({ campo: null, msg: 'No se pudo guardar. Revisá tu conexión y probá de nuevo.' }); }
    finally { setGuardando(false); }
  };

  const monto = (k, ph = '0') => ({
    id: `fd-${k}`, className: 'mod-filaf-in', inputMode: 'decimal', autoComplete: 'off', placeholder: ph, value: f[k],
    onChange: set(k), onBlur: formatear(k), 'aria-invalid': err(k) || undefined
  });

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={deuda ? 'Editar deuda' : 'Nueva deuda'}>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0 8px' }}>
        <div className="mod-seg-full"><Seg opciones={TIPOS_DEUDA} valor={f.tipo} onCambio={cambiarTipo} ariaLabel="Tipo de deuda" /></div>

        <div className="mod-grupo">
          <Fila id="fd-acreedor" label={AYUDA[f.tipo].quien} sub="Reconoce los pagos en tus cuentas">
            <input id="fd-acreedor" className="mod-filaf-in" autoComplete="off" autoCapitalize="words" placeholder={AYUDA[f.tipo].acreedor} value={f.acreedor} onChange={set('acreedor')} />
          </Fila>
          <Fila id="fd-nombre" label="Nombre" error={err('nombre')}>
            <input id="fd-nombre" className="mod-filaf-in" autoComplete="off" autoCapitalize="sentences" placeholder={nombreAuto || 'Como la querés ver'} value={f.nombre} onChange={set('nombre')} aria-invalid={err('nombre') || undefined} />
          </Fila>
        </div>

        <div>
          <p className="mod-seccion">¿Cómo la pagás?</p>
          <div className="mod-seg-full"><Seg opciones={MODOS} valor={f.modo} onCambio={cambiarModo} ariaLabel="Forma de pago" /></div>
          <div className="mod-grupo" style={{ marginTop: 10 }}>
            {f.modo === 'cuotas' ? (
              <>
                <Fila id="fd-cuota_monto" label={`Cuota mensual${u}`} error={err('cuota_monto')}>
                  <input {...monto('cuota_monto')} />
                </Fila>
                <Fila id="fd-cuotas_restantes" label="Cuotas que faltan" error={err('cuotas_restantes')}>
                  <input id="fd-cuotas_restantes" className="mod-filaf-in" inputMode="numeric" autoComplete="off" placeholder="0" value={f.cuotas_restantes} onChange={set('cuotas_restantes')} aria-invalid={err('cuotas_restantes') || undefined} />
                </Fila>
                <Fila id="fd-dia_vencimiento" label="Vence el día" sub="Opcional: te avisamos si se vence" error={err('dia_vencimiento')}>
                  <input id="fd-dia_vencimiento" className="mod-filaf-in" inputMode="numeric" autoComplete="off" placeholder="Ej. 10" value={f.dia_vencimiento} onChange={set('dia_vencimiento')} aria-invalid={err('dia_vencimiento') || undefined} />
                </Fila>
              </>
            ) : (
              <>
                <Fila id="fd-saldo_hoy" label={`Debés hoy${u}`} error={err('saldo_hoy')}>
                  <input {...monto('saldo_hoy')} />
                </Fila>
                <Fila id="fd-cuota_monto" label={`Pago mensual${u}`} sub="Opcional" error={err('cuota_monto')}>
                  <input {...monto('cuota_monto')} />
                </Fila>
                <Fila id="fd-dia_vencimiento" label="Vence el día" sub="Opcional: te avisamos si se vence" error={err('dia_vencimiento')}>
                  <input id="fd-dia_vencimiento" className="mod-filaf-in" inputMode="numeric" autoComplete="off" placeholder="Ej. 10" value={f.dia_vencimiento} onChange={set('dia_vencimiento')} aria-invalid={err('dia_vencimiento') || undefined} />
                </Fila>
              </>
            )}
          </div>
        </div>

        <Resumen f={f} dv={dv} />

        <details className="mod-mas" open={mas} onToggle={(e) => setMas(e.currentTarget.open)}>
          <summary>Más opciones</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
            <div className="mod-grupo">
              <Fila id="fd-moneda" label="Moneda">
                <select id="fd-moneda" className="mod-filaf-in" value={f.moneda} onChange={set('moneda')}><option value="ARS">Pesos ($)</option><option value="USD">Dólares (U$S)</option></select>
              </Fila>
              {f.modo === 'cuotas' && (
                <Fila id="fd-saldo_hoy" label={`Saldo actual${u}`} sub="Solo si tu banco dice otro" error={err('saldo_hoy')}>
                  <input {...monto('saldo_hoy', dv.auto ? mil(dv.auto) : '0')} />
                </Fila>
              )}
              <Fila id="fd-tasa_anual" label="Tasa anual (TNA)" sub={f.modo === 'cuotas' ? 'Del contrato. Calcula cuánto pagás si cancelás hoy' : 'Si crece con intereses, el plan la suma'} error={err('tasa_anual')}>
                <input id="fd-tasa_anual" className="mod-filaf-in" inputMode="decimal" autoComplete="off" placeholder="Ej. 85" value={f.tasa_anual} onChange={set('tasa_anual')} aria-invalid={err('tasa_anual') || undefined} /><span className="mod-filaf-suf" aria-hidden="true">%</span>
              </Fila>
              {f.modo === 'cuotas' && (
                <Fila id="fd-capital" label="Capital pendiente" sub="Si no sabés la tasa: lo que te prestaron, y la calculamos">
                  <input {...monto('capital')} />
                </Fila>
              )}
              <Fila id="fd-palabra_clave" label="Palabra clave" sub='Ej. PRESTAMO 4521'>
                <input id="fd-palabra_clave" className="mod-filaf-in" autoComplete="off" value={f.palabra_clave} onChange={set('palabra_clave')} />
              </Fila>
              <Fila id="fd-fecha_inicio" label="Contar pagos desde" sub="Los anteriores no descuentan" error={err('fecha_inicio')}>
                <input id="fd-fecha_inicio" className="mod-filaf-in" type="date" max={hoyISO()} value={f.fecha_inicio} onChange={set('fecha_inicio')} aria-invalid={err('fecha_inicio') || undefined} />
              </Fila>
              <Fila id="fd-notas" label="Notas">
                <input id="fd-notas" className="mod-filaf-in" autoComplete="off" value={f.notas} onChange={set('notas')} />
              </Fila>
            </div>
            {dv.implicita && (
              <div className="mod-aviso" role="status" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>Tasa implícita: <b>{dv.implicita.tna.toFixed(1).replace('.', ',')} % TNA</b> ({dv.implicita.tea.toFixed(0)} % efectiva anual). Intereses de las {dv.n} cuotas: {plata(dv.implicita.intereses, f.moneda)}.</span>
                <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => setF((x) => ({ ...x, tasa_anual: dv.implicita.tna.toFixed(2).replace('.', ',') }))}>Usar esta tasa</button>
              </div>
            )}
            {dv.implicitaInvalida && <div className="mod-aviso" role="status">Con esos datos no cierra: {dv.n} cuotas de {plata(dv.cuota, f.moneda)} suman menos que el capital.</div>}
          </div>
        </details>

        <div className="mod-cta">
          {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--danger)' }}>{error.msg}</p>}
          <button type="submit" className="btn btn-pri" disabled={guardando} style={{ minHeight: 50, borderRadius: 25, fontSize: 17, fontWeight: 600 }}>
            {guardando ? 'Guardando…' : deuda ? 'Guardar cambios' : 'Guardar deuda'}
          </button>
        </div>
      </form>
    </Hoja>
  );
};

/** Botón que pide un segundo toque para confirmar (4 s). */
const DobleToque = ({ texto, confirmar, onConfirmado, disabled }) => {
  const [armado, setArmado] = useState(false);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button type="button" className="btn" disabled={disabled} style={{ minHeight: 44, color: armado ? 'var(--danger)' : undefined }}
      onClick={() => {
        if (armado) { clearTimeout(t.current); setArmado(false); onConfirmado(); return; }
        setArmado(true); t.current = setTimeout(() => setArmado(false), 4000);
      }}>
      {armado ? confirmar : texto}
    </button>
  );
};

/** Detalle: pagos, registrar uno a mano, editar, saldar, borrar. */
export const DetalleDeuda = ({ deuda, pagos, onCerrar, onCambio, onEditar }) => {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [avisoDup, setAvisoDup] = useState(null); // id del pago importado parecido ya avisado
  useEffect(() => { setAvisoDup(null); setMonto(deuda?.cuota_monto ? String(deuda.cuota_monto).replace('.', ',') : ''); setFecha(hoyISO()); setError(null); }, [deuda?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!deuda) return null;
  const e = estadoDeuda(deuda, pagos);
  const venc = proximoVencimiento(deuda, pagos, hoyISO());
  const cancel = cancelacionHoy(deuda, e);
  const anteriores = pagos.filter((m) => m.deuda_id === deuda.id && m.fecha < deuda.fecha_inicio);

  const hacer = async (fn) => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio?.(); return true; } catch { setError('No se pudo guardar. Revisá tu conexión.'); return false; } finally { setOcupado(false); }
  };
  const pagar = async () => {
    const m = parseMonto(monto);
    if (!m || m <= 0) { setError('Poné el monto que pagaste.'); return; }
    if (!fecha) { setError('Poné la fecha del pago.'); return; }
    if (fecha > hoyISO()) { setError('La fecha no puede ser futura.'); return; }
    if (fecha < deuda.fecha_inicio) { setError(`Es anterior al ${fechaDM(deuda.fecha_inicio)}: no descontaría. Cambiá la fecha o editá la deuda.`); return; }
    // Al revés del aviso de "Posibles pagos": si ya hay un pago importado parecido, se pregunta una vez.
    const dias = (a, b) => Math.abs(new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000;
    const dup = e.pagos.find((p) => p.origen !== 'manual' && Math.abs(p.monto - m) <= m * 0.03 && dias(p.fecha, fecha) <= 10);
    if (dup && avisoDup !== dup.id) {
      setAvisoDup(dup.id);
      setError(`Ya hay un pago parecido de tus cuentas el ${fechaDM(dup.fecha)} (${plata(dup.monto, deuda.moneda)}). Si es otro, tocá Registrar de nuevo.`);
      return;
    }
    if (await hacer(() => registrarPagoManual(deuda, { monto: m, fecha }))) { setMonto(''); setAvisoDup(null); }
  };

  return (
    <Hoja abierta={!!deuda} onCerrar={onCerrar} titulo={deuda.nombre}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>{TIPOS_DEUDA.find((t) => t.id === deuda.tipo)?.label}{deuda.acreedor ? ` · ${deuda.acreedor}` : ''}{deuda.estado === 'saldada' ? ' · Saldada' : ''}</span>
          <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{plata(e.saldo, deuda.moneda)}</span>
          <span style={{ fontSize: 14, color: 'var(--label2)' }}>
            Pagaste {plata(e.pagado, deuda.moneda)} de {plata(deuda.saldo_inicial, deuda.moneda)}{e.cuotasRestantes != null ? ` · ${e.cuotasRestantes === 1 ? 'falta 1 cuota' : `faltan ${e.cuotasRestantes} cuotas`}` : ''}{deuda.tasa_anual ? ` · ${deuda.tasa_anual} % TNA` : ''}
          </span>
          <div className="mod-barra" aria-hidden="true"><i style={{ transform: `scaleX(${e.progreso})` }} /></div>
          {venc && <span style={{ fontSize: 14, fontWeight: 600, color: venc.estado === 'vencida' && !venc.pagadaEsteMes ? 'var(--danger)' : undefined }}>{venc.pagadaEsteMes ? `Este mes ya pagaste. ${textoVencimiento(venc)}` : textoVencimiento(venc)}</span>}
        </div>

        {cancel && deuda.estado === 'activa' && (
          <section aria-labelledby="dd-cancel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 id="dd-cancel" className="h3" style={{ margin: 0 }}>Si cancelás hoy</h3>
            <div className="mod-resumen">
              <span className="mod-res-et">Pagarías unos</span>
              <span className="mod-cifra mod-res-num">{plata(cancel.capital, deuda.moneda)}</span>
              <span className="mod-res-sub">En vez de {plata(e.saldo, deuda.moneda)}: te ahorrás <b>{plata(cancel.intereses, deuda.moneda)}</b> de intereses (con {deuda.tasa_anual} % TNA). Confirmá el monto exacto con el banco: puede haber cargos de cancelación.</span>
            </div>
            <details className="mod-mas">
              <summary>Cuánto de cada cuota es interés</summary>
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ color: 'var(--label2)', textAlign: 'right' }}><th scope="col" style={{ textAlign: 'left', fontWeight: 500, padding: '6px 0' }}>Cuota</th><th scope="col" style={{ fontWeight: 500 }}>Interés</th><th scope="col" style={{ fontWeight: 500 }}>Capital</th><th scope="col" style={{ fontWeight: 500 }}>Queda</th></tr></thead>
                <tbody>
                  {cancel.cronograma.map((r) => (
                    <tr key={r.n} className="mod-cifra" style={{ textAlign: 'right', borderTop: '0.5px solid var(--sep)' }}>
                      <th scope="row" style={{ textAlign: 'left', fontWeight: 500, padding: '8px 0' }}>{r.n}</th><td>{plata(r.interes, deuda.moneda)}</td><td>{plata(r.amortizacion, deuda.moneda)}</td><td>{plata(r.saldo, deuda.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </details>
          </section>
        )}

        {deuda.estado === 'activa' && (
          <section aria-labelledby="dd-pagar" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 id="dd-pagar" className="h3" style={{ margin: 0 }}>Registrar un pago</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Para efectivo o algo que no importaste. Si después aparece en tus cuentas, Saldar te avisa para no contarlo dos veces.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="mod-campo" inputMode="decimal" aria-label="Monto pagado" placeholder="Monto" value={monto} onChange={(ev) => setMonto(ev.target.value)} />
              <input className="mod-campo" type="date" max={hoyISO()} aria-label="Fecha del pago" value={fecha} onChange={(ev) => setFecha(ev.target.value)} style={{ flex: '0 1 170px' }} />
              <button type="button" className="btn btn-pri" disabled={ocupado} onClick={pagar} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>Registrar</button>
            </div>
          </section>
        )}

        <section aria-labelledby="dd-pagos" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="dd-pagos" className="h3" style={{ margin: 0 }}>Pagos</h3>
          {e.pagos.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {e.pagos.map((m) => (
                <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '4px 0' }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.descripcion}</span>
                    <span style={{ fontSize: 13, color: 'var(--label2)' }}>{fechaDM(m.fecha)} · {m.origen === 'manual' ? 'Cargado a mano' : m.cuenta?.nombre || ''}</span>
                  </span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{plata(m.monto, deuda.moneda)}</span>
                  <DobleToque texto="Quitar" confirmar={m.origen === 'manual' ? '¿Borrar?' : '¿Quitar?'} disabled={ocupado} onConfirmado={() => hacer(() => quitarPago(m))} />
                </li>
              ))}
            </ul>
          ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Todavía no hay pagos. Confirmá los que Saldar encuentre en tus cuentas o registralos acá.</p>}
          {anteriores.length > 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>{anteriores.length} pago(s) vinculados son anteriores al {fechaDM(deuda.fecha_inicio)} y no descuentan.</p>}
        </section>

        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <DobleToque texto="Borrar deuda" confirmar="¿Borrar? Los pagos a mano también" disabled={ocupado}
            onConfirmado={async () => { if (await hacer(() => borrarDeuda(deuda.id))) onCerrar(); }} />
          <button type="button" className="btn" disabled={ocupado} onClick={() => onEditar(deuda)} style={{ minHeight: 44 }}>Editar</button>
          <button type="button" className={e.saldo <= 0 && deuda.estado === 'activa' ? 'btn btn-pri' : 'btn'} disabled={ocupado}
            onClick={() => hacer(() => actualizarDeuda(deuda.id, { estado: deuda.estado === 'activa' ? 'saldada' : 'activa' }))}
            style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
            {deuda.estado === 'activa' ? 'Marcar saldada' : 'Reactivar'}
          </button>
        </div>
      </div>
    </Hoja>
  );
};
