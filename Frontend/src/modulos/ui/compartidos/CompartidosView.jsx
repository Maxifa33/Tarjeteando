import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Check, X, Link2, Users, User } from 'lucide-react';
import Hoja from '../../../ui/Hoja.jsx';
import { pesos } from '../../../ui/formato.js';
import { comprasDeTarjeta } from '../../puente/tarjeteando.js';
import { resumenGrupo, sugerirPagos, totales } from '../../compartidos/compartidos.js';
import {
  cargarTodo, transferenciasDesde, gastosRecientes, confirmarPagoDeMovimiento, descartarMovimiento,
  borrarPago, borrarGrupo, actualizarGrupo, cambiarLink, agregarParticipante, quitarParticipante
} from '../../compartidos/repo.js';
import { hoyISO, plata, fechaDM } from '../deudas/HojasDeuda.jsx';
import { DobleToque } from '../alcancia/HojasMeta.jsx';
import { FormGrupo, FormGasto, FormPago } from './HojasGrupo.jsx';
import '../modulos.css';

const menosDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nombre = (p) => (p ? (p.es_yo ? 'Vos' : p.nombre) : '');
// Con centavos cuando los hay: "$ 0" para 0,40 confunde.
const $ = (n) => pesos(n, { decimales: Math.round(Math.abs(n) * 100) % 100 ? 2 : 0 });
const estadoTexto = (s) => (Math.abs(s) < 0.005 ? 'A mano' : s > 0 ? `Te deben ${$(s)}` : `Debés ${$(-s)}`);

/** Detalle de un grupo: saldos, cómo quedar a mano, gastos, pagos, personas y link. */
const DetalleGrupo = ({ r, onCerrar, onCambio, onNuevoGasto, onEditarGasto, onPago }) => {
  const [persona, setPersona] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { setPersona(''); setError(null); setCopiado(false); }, [r?.grupo.id]);
  if (!r) return null;
  const g = r.grupo;
  const porId = Object.fromEntries(r.participantes.map((p) => [p.id, p]));
  const hacer = async (fn, msg = 'No se pudo guardar. Revisá tu conexión.') => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio(); return true; } catch { setError(msg); return false; } finally { setOcupado(false); }
  };
  const link = g.token_publico ? `${window.location.origin}/compartido.html?t=${g.token_publico}` : null;
  const copiar = async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); } catch { setCopiado(false); setError('No se pudo copiar: seleccioná el link y copialo.'); } };
  const usado = (id) => r.gastos.some((x) => x.pagado_por === id || x.partes.some((y) => y.p === id)) || r.pagos.some((x) => x.de === id || x.a === id);

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={g.nombre}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '4px 4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="mod-cifra" style={{ fontSize: 30, lineHeight: '36px', fontWeight: 700, letterSpacing: '-.02em' }}>{estadoTexto(r.miSaldo)}</span>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>Gastaron {$(r.total)} en total · tu parte {$(r.miParte)}</span>
          {g.archivado && <span style={{ fontSize: 13, color: 'var(--label2)' }}>Archivado: no suma en Te deben / Debés ni se buscan sus pagos.</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-pri" onClick={onNuevoGasto} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}><Plus size={16} aria-hidden="true" /> Gasto</button>
          <button type="button" className="btn" onClick={() => onPago(null)} style={{ minHeight: 44 }}>Registrar pago</button>
        </div>

        <section aria-labelledby="dg-mano" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="dg-mano" className="h3" style={{ margin: 0 }}>Para quedar a mano</h3>
          {r.transferencias.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {r.transferencias.map((t) => (
                <li key={`${t.de}-${t.a}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48 }}>
                  <span style={{ flex: 1, fontSize: 15 }}>{nombre(porId[t.de])} → {nombre(porId[t.a])}</span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{$(t.monto)}</span>
                  <button type="button" className="btn" onClick={() => onPago(t)} style={{ minHeight: 44 }} aria-label={`Registrar pago de ${nombre(porId[t.de])} a ${nombre(porId[t.a])}`}>Pagado</button>
                </li>
              ))}
            </ul>
          ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Están todos a mano.</p>}
        </section>

        <section aria-labelledby="dg-gastos" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="dg-gastos" className="h3" style={{ margin: 0 }}>Gastos ({r.gastos.length})</h3>
          {r.gastos.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {r.gastos.map((x) => (
                <li key={x.id}>
                  <button type="button" className="mod-mov" onClick={() => onEditarGasto(x)} aria-label={`${x.descripcion}, ${$(x.monto)}. Editar`}>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.descripcion}</span>
                      <span style={{ fontSize: 13, color: 'var(--label2)' }}>{fechaDM(x.fecha)} · pagó {nombre(porId[x.pagado_por])}{x.tarjeta ? ' · tarjeta' : x.movimiento_id ? ' · tus cuentas' : ''}</span>
                    </span>
                    <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{$(x.monto)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Todavía no hay gastos.</p>}
        </section>

        {r.pagos.length > 0 && (
          <section aria-labelledby="dg-pagos" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3 id="dg-pagos" className="h3" style={{ margin: 0 }}>Pagos</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {r.pagos.map((x) => (
                <li key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{fechaDM(x.fecha)} · {nombre(porId[x.de])} → {nombre(porId[x.a])}{x.movimiento_id ? <span style={{ fontSize: 13, color: 'var(--label2)' }}> · transferencia</span> : null}</span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{$(x.monto)}</span>
                  <DobleToque texto="Borrar" confirmar="¿Borrar?" disabled={ocupado} onConfirmado={() => hacer(() => borrarPago(x))} />
                </li>
              ))}
            </ul>
            {r.pagos.some((x) => x.movimiento_id) && <span style={{ fontSize: 12, color: 'var(--label2)' }}>Si borrás un pago que vino de una transferencia, el movimiento vuelve a como estaba.</span>}
          </section>
        )}

        <section aria-labelledby="dg-personas" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="dg-personas" className="h3" style={{ margin: 0 }}>Personas</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {r.participantes.map((p) => (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                <span style={{ flex: 1, fontSize: 15 }}>{p.es_yo ? 'Vos' : p.nombre}</span>
                <span className="mod-cifra" style={{ fontSize: 14, color: 'var(--label2)' }}>{(() => { const s = r.saldos.get(p.id) || 0; return Math.abs(s) < 0.005 ? 'a mano' : s > 0 ? `+${$(s)}` : `−${$(-s)}`; })()}</span>
                {!p.es_yo && !usado(p.id) && g.tipo === 'grupo' && <DobleToque texto="Quitar" confirmar="¿Quitar?" disabled={ocupado} onConfirmado={() => hacer(() => quitarParticipante(p.id), 'No se pudo quitar: tiene gastos o pagos.')} />}
              </li>
            ))}
          </ul>
          {g.tipo === 'grupo' && (
            <form onSubmit={(e) => { e.preventDefault(); const n = persona.trim(); if (!n) return; if (r.participantes.some((p) => p.nombre.toLowerCase() === n.toLowerCase())) { setError('Ya está en el grupo.'); return; } hacer(() => agregarParticipante(g.id, n, r.participantes.length)).then((ok) => ok && setPersona('')); }}
              style={{ display: 'flex', gap: 8 }}>
              <input className="mod-campo" aria-label="Nombre de la persona" value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Agregar persona" />
              <button type="submit" className="btn" disabled={ocupado} style={{ minHeight: 44 }}>Agregar</button>
            </form>
          )}
        </section>

        <section aria-labelledby="dg-link" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="dg-link" className="h3" style={{ margin: 0 }}>Que lo vean</h3>
          {link ? (
            <>
              <input className="mod-campo" readOnly value={link} aria-label="Link de solo lectura" onFocus={(e) => e.target.select()} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={copiar} style={{ minHeight: 44 }}>{copiado ? 'Copiado' : 'Copiar link'}</button>
                <DobleToque texto="Apagar link" confirmar="¿Apagar? Deja de andar" disabled={ocupado} onConfirmado={() => hacer(() => cambiarLink(g.id, false))} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--label2)' }}>Quien tenga el link ve los nombres, la descripción de cada gasto (tal como la cargaste) y los saldos, sin poder cambiar nada.</span>
            </>
          ) : (
            <button type="button" className="btn" disabled={ocupado} onClick={() => hacer(() => cambiarLink(g.id, true))} style={{ minHeight: 44, alignSelf: 'flex-start' }}>
              <Link2 size={16} aria-hidden="true" /> Crear link de solo lectura
            </button>
          )}
        </section>

        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <DobleToque texto="Borrar" confirmar="¿Borrar todo el grupo?" disabled={ocupado} onConfirmado={async () => { if (await hacer(() => borrarGrupo(g.id))) onCerrar(); }} />
          <button type="button" className="btn" disabled={ocupado} onClick={() => hacer(() => actualizarGrupo(g.id, { archivado: !g.archivado }))} style={{ minHeight: 44 }}>{g.archivado ? 'Desarchivar' : 'Archivar'}</button>
        </div>
      </div>
    </Hoja>
  );
};

/** Compartidos: gastos con otros (grupos y 1 a 1), quién le debe a quién y pagos desde tus transferencias. */
const CompartidosView = ({ tarjeteando }) => {
  const [datos, setDatos] = useState(null);
  const [trans, setTrans] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [error, setError] = useState(null);
  const [nuevoGrupo, setNuevoGrupo] = useState(false);
  const [detalleId, setDetalleId] = useState(null);
  const [formGasto, setFormGasto] = useState(null); // { gasto }
  const [formPago, setFormPago] = useState(null); // { inicial }
  const [ocupado, setOcupado] = useState(null);
  const pedido = useRef(0);
  const compras = useMemo(() => comprasDeTarjeta(tarjeteando?.movimientos || []), [tarjeteando]);

  const cargar = useCallback(async () => {
    const id = ++pedido.current; setError(null);
    try {
      // Los grupos son lo principal: si fallan las sugerencias, igual se muestran.
      const [d, t, g] = await Promise.all([cargarTodo(), transferenciasDesde(menosDias(120)).catch(() => []), gastosRecientes(menosDias(90)).catch(() => [])]);
      if (id !== pedido.current) return;
      setDatos(d); setTrans(t); setRecientes(g);
    } catch { if (id === pedido.current) { setError('No se pudieron leer tus compartidos. Revisá tu conexión.'); setDatos((x) => x || { grupos: [], participantes: [], gastos: [], pagos: [] }); } }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const resumenes = useMemo(() => (datos ? datos.grupos.map((g) => ({ grupo: g, ...resumenGrupo(g, datos.participantes, datos.gastos, datos.pagos) })) : []), [datos]);
  // Un mismo movimiento no puede ser gasto y pago a la vez (ni estar dos veces).
  const movsUsados = useMemo(() => new Set([...(datos?.pagos || []).map((p) => p.movimiento_id), ...(datos?.gastos || []).map((x) => x.movimiento_id)].filter(Boolean)), [datos]);
  const usadosPago = movsUsados;
  const usadosGasto = useMemo(() => new Set([...[...movsUsados].map((id) => `m:${id}`), ...(datos?.gastos || []).map((x) => x.tarjeta?.clave && `t:${x.tarjeta.clave}`).filter(Boolean)]), [datos, movsUsados]);
  const sugerencias = useMemo(() => sugerirPagos(resumenes, trans, usadosPago), [resumenes, trans, usadosPago]);
  if (!datos) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;

  const t = totales(resumenes);
  const activos = resumenes.filter((r) => !r.grupo.archivado);
  const archivados = resumenes.filter((r) => r.grupo.archivado);
  const detalle = resumenes.find((r) => r.grupo.id === detalleId) || null;
  const grupoForm = formGasto || formPago ? detalle : null;
  const accion = async (s, fn) => {
    setOcupado(s.mov.id); setError(null);
    try {
      const ok = await fn();
      if (ok === false) setError('Esa transferencia ya estaba vinculada o cambió. Se actualizó la lista.');
      await cargar();
    } catch { setError('No se pudo guardar. Revisá tu conexión.'); await cargar(); } finally { setOcupado(null); }
  };

  const tarjeta = (r) => {
    const Icono = r.grupo.tipo === 'persona' ? User : Users;
    return (
      <li key={r.grupo.id}>
        <button type="button" className="mod-mov" onClick={() => setDetalleId(r.grupo.id)} aria-label={`${r.grupo.nombre}: ${estadoTexto(r.miSaldo)}. Ver detalle`}
          style={{ padding: 14, borderRadius: 20, background: 'var(--fill2)', gap: 14 }}>
          <span className="mod-tesela" aria-hidden="true"><Icono size={20} /></span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.grupo.nombre}</span>
            <span style={{ fontSize: 13, color: 'var(--label2)' }}>{r.grupo.tipo === 'persona' ? '1 a 1' : `${r.participantes.length} personas`} · {r.gastos.length} gastos</span>
          </span>
          <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600, textAlign: 'right' }}>{estadoTexto(r.miSaldo)}</span>
        </button>
      </li>
    );
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, color: 'var(--label2)' }}>Te deben</span>
            <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{$(t.teDeben)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, color: 'var(--label2)' }}>Debés</span>
            <span className="mod-cifra" style={{ fontSize: 20, lineHeight: '26px', fontWeight: 600 }}>{$(t.debes)}</span>
          </div>
        </div>
        <button type="button" className="btn btn-pri" onClick={() => setNuevoGrupo(true)} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}><Plus size={16} aria-hidden="true" /> Nuevo</button>
      </div>
      {error && <div className="mod-aviso" role="alert">{error}</div>}

      {sugerencias.length > 0 && (
        <section aria-labelledby="com-pagos" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="com-pagos" className="h3" style={{ margin: 0 }}>Posibles pagos ({sugerencias.length})</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Transferencias de tus cuentas con gente de tus compartidos. Si te pagaron, el movimiento pasa a Recupero.</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sugerencias.slice(0, 20).map((s) => (
              <li key={s.mov.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 16, background: 'var(--fill2)' }}>
                <span style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{s.mov.direccion === 'entrada' ? `${s.persona.nombre} te pagó` : `Le pagaste a ${s.persona.nombre}`}</span>
                  <span style={{ fontSize: 13, color: 'var(--label2)' }}>{fechaDM(s.mov.fecha)} · {s.mov.contraparte} · en <strong style={{ color: 'var(--label)' }}>{s.grupo.nombre}</strong> {s.mov.direccion === 'entrada' ? 'te debe hasta' : 'le debés hasta'} {$(s.debe)}</span>
                </span>
                <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{$(s.mov.monto)}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn" disabled={ocupado === s.mov.id} onClick={() => accion(s, () => descartarMovimiento(s.mov.id))} style={{ minHeight: 44 }} aria-label="No es un pago de compartidos"><X size={16} aria-hidden="true" /> No es</button>
                  <button type="button" className="btn btn-pri" disabled={ocupado === s.mov.id} onClick={() => accion(s, () => confirmarPagoDeMovimiento(s))} style={{ minHeight: 44, borderRadius: 22, padding: '0 14px' }} aria-label={`Confirmar pago en ${s.grupo.nombre}`}><Check size={16} aria-hidden="true" /> Confirmar</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="com-grupos" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="com-grupos" className="h3" style={{ margin: 0 }}>Tus compartidos</h2>
        {activos.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{activos.map(tarjeta)}</ul> : (
          <div style={{ padding: 20, borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 17 }}>Dividí gastos con otros.</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Un viaje, la casa, el fútbol, o lo que te debe alguien. Podés cargar gastos de tus cuentas o de tus tarjetas, y Compartidos reconoce cuando te transfieren.</p>
          </div>
        )}
      </section>
      {archivados.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Archivados ({archivados.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{archivados.map(tarjeta)}</ul>
        </details>
      )}

      <FormGrupo abierta={nuevoGrupo} onCerrar={() => setNuevoGrupo(false)} onGuardado={async (g) => { await cargar(); setDetalleId(g.id); }} />
      {detalle && !formGasto && !formPago && (
        <DetalleGrupo r={detalle} onCerrar={() => setDetalleId(null)} onCambio={cargar}
          onNuevoGasto={() => setFormGasto({ gasto: null })} onEditarGasto={(x) => setFormGasto({ gasto: x })} onPago={(tr) => setFormPago({ inicial: tr })} />
      )}
      {grupoForm && formGasto && (
        <FormGasto abierta grupo={grupoForm.grupo} participantes={grupoForm.participantes} gasto={formGasto.gasto} movs={recientes} compras={compras} usados={usadosGasto}
          onCerrar={() => setFormGasto(null)} onGuardado={cargar} />
      )}
      {grupoForm && formPago && (
        <FormPago abierta grupo={grupoForm.grupo} participantes={grupoForm.participantes} inicial={formPago.inicial} onCerrar={() => setFormPago(null)} onGuardado={cargar} />
      )}
    </section>
  );
};

export default CompartidosView;
