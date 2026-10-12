import React, { useEffect, useRef, useState } from 'react';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import { parseMonto } from '../../cuentas/util.js';
import { validarMeta, aTexto as numTexto } from '../../alcancia/alcancia.js';
import { crearMeta, actualizarMeta, borrarMeta, crearAporte, borrarAporte } from '../../alcancia/repo.js';
import { hoyISO, plata, fechaDM } from '../deudas/HojasDeuda.jsx';
import '../modulos.css';

export const Campo = ({ label, nota, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--label2)' }}>
    {label}
    {children}
    {nota && <span style={{ fontSize: 12 }}>{nota}</span>}
  </label>
);

export const DobleToque = ({ texto, confirmar, onConfirmado, disabled }) => {
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

export const Botonera = ({ onCerrar, ocupado, texto = 'Guardar' }) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
    <button type="button" className="btn" onClick={onCerrar} disabled={ocupado} style={{ minHeight: 44 }}>Cancelar</button>
    <button type="submit" className="btn btn-pri" disabled={ocupado} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>{ocupado ? 'Guardando…' : texto}</button>
  </div>
);

const aTexto = (n) => (n == null || n === 0 ? '' : numTexto(n));
const vacia = () => ({ nombre: '', objetivo: '', moneda: 'ARS', fecha_objetivo: '', bolsillo_id: '', saldo_inicial: '', notas: '' });

/** Alta / edición de una meta. */
export const FormMeta = ({ abierta, meta, bolsillos, usados, conMovimientos, onCerrar, onGuardado }) => {
  const [f, setF] = useState(vacia);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!abierta) return;
    setError(null);
    setF(meta ? { nombre: meta.nombre, objetivo: aTexto(meta.objetivo), moneda: meta.moneda, fecha_objetivo: meta.fecha_objetivo || '', bolsillo_id: meta.bolsillo_id || '', saldo_inicial: aTexto(meta.saldo_inicial), notas: meta.notas || '' } : vacia());
  }, [abierta, meta]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  // Una reserva alimenta una sola meta (si no, se contaría dos veces).
  const libres = bolsillos.filter((b) => !usados.has(b.id) || b.id === meta?.bolsillo_id);

  const guardar = async () => {
    const v = validarMeta(f, { nueva: !meta, hoy: hoyISO() });
    if (v.error) { setError(v.error); return; }
    if (v.fila.bolsillo_id && v.fila.moneda !== 'ARS') { setError('Las reservas de Mercado Pago son en pesos: elegí $ o sacá la reserva.'); return; }
    setOcupado(true); setError(null);
    try { await (meta ? actualizarMeta(meta.id, v.fila) : crearMeta(v.fila)); onGuardado?.(); onCerrar(); }
    catch { setError('No se pudo guardar. Revisá tu conexión.'); }
    finally { setOcupado(false); }
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={meta ? 'Editar meta' : 'Nueva meta'}>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <Campo label="¿Para qué?"><input className="mod-campo" value={f.nombre} onChange={set('nombre')} placeholder="Vacaciones, auto, fondo de emergencia…" /></Campo>
        <Campo label="¿Cuánto querés juntar?">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="mod-campo" inputMode="decimal" value={f.objetivo} onChange={set('objetivo')} placeholder="0" />
            <select className="mod-select" value={f.moneda} onChange={set('moneda')} aria-label="Moneda" disabled={!!conMovimientos}><option value="ARS">$</option><option value="USD">U$S</option></select>
          </div>
          {conMovimientos && <span style={{ fontSize: 12 }}>La moneda no se cambia porque la meta ya tiene plata cargada.</span>}
        </Campo>
        <Campo label="¿Para cuándo? (opcional)" nota="Con fecha, Alcancía te dice cuánto separar por mes.">
          <input className="mod-campo" type="date" value={f.fecha_objetivo} onChange={set('fecha_objetivo')} />
        </Campo>
        <Campo label="Reserva de Mercado Pago (opcional)" nota={libres.length ? 'Lo que entra y sale de esa reserva cuenta solo para esta meta, cada vez que importás.' : 'Cuando importes Mercado Pago, vas a poder vincular una reserva.'}>
          <select className="mod-select" value={f.bolsillo_id} onChange={set('bolsillo_id')} disabled={!libres.length}>
            <option value="">Sin reserva: la cargo a mano</option>
            {libres.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Lo que ya tenés juntado (opcional)" nota={f.bolsillo_id ? 'Solo lo que no aparece en lo importado (ej. lo que había en la reserva antes de tu primer resumen).' : 'Lo que ya separaste hasta hoy.'}>
          <input className="mod-campo" inputMode="decimal" value={f.saldo_inicial} onChange={set('saldo_inicial')} placeholder="0" />
        </Campo>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <Botonera onCerrar={onCerrar} ocupado={ocupado} />
      </form>
    </Hoja>
  );
};

/** Detalle de una meta: aportes, sumar o sacar plata, editar, lograda, borrar. */
export const DetalleMeta = ({ meta, estado, aportes, reserva, onCerrar, onCambio, onEditar }) => {
  const [monto, setMonto] = useState('');
  const [sentido, setSentido] = useState('aporte');
  const [fecha, setFecha] = useState(hoyISO());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { setMonto(''); setSentido('aporte'); setFecha(hoyISO()); setError(null); }, [meta?.id]);
  if (!meta || !estado) return null;
  const propios = aportes.filter((a) => a.meta_id === meta.id);
  const hacer = async (fn) => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio?.(); return true; } catch { setError('No se pudo guardar. Revisá tu conexión.'); return false; } finally { setOcupado(false); }
  };
  const agregar = async () => {
    const m = parseMonto(monto);
    if (!(m > 0)) { setError('Poné un monto.'); return; }
    if (!fecha) { setError('Poné la fecha.'); return; }
    if (fecha > hoyISO()) { setError('La fecha no puede ser futura.'); return; }
    if (sentido === 'retiro' && m > estado.juntado + 0.005) { setError(`No podés sacar más de lo juntado (${plata(estado.juntado, meta.moneda)}).`); return; }
    if (await hacer(() => crearAporte({ meta_id: meta.id, fecha, monto: sentido === 'retiro' ? -m : m }))) setMonto('');
  };

  return (
    <Hoja abierta={!!meta} onCerrar={onCerrar} titulo={meta.nombre}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{plata(estado.juntado, meta.moneda)}</span>
          <span style={{ fontSize: 14, color: 'var(--label2)' }}>de {plata(meta.objetivo, meta.moneda)}{meta.fecha_objetivo ? ` para el ${fechaDM(meta.fecha_objetivo)}` : ''}</span>
          <div className="mod-barra" aria-hidden="true"><i style={{ transform: `scaleX(${estado.progreso})` }} /></div>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>
            {meta.saldo_inicial ? `Ya tenías ${plata(meta.saldo_inicial, meta.moneda)} · ` : ''}A mano {plata(estado.manual, meta.moneda)}{meta.bolsillo_id ? ` · Reserva "${reserva?.nombre || ''}" ${plata(estado.reserva, meta.moneda)}` : ''}
          </span>
        </div>

        {meta.estado === 'activa' && (
          <section aria-labelledby="dm-mover" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 id="dm-mover" className="h3" style={{ margin: 0 }}>Mover plata</h3>
            {meta.bolsillo_id && <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Lo que pasa por la reserva se suma solo al importar. Usá esto para plata que tenés en otro lado.</p>}
            <Seg opciones={[{ id: 'aporte', label: 'Sumé' }, { id: 'retiro', label: 'Saqué' }]} valor={sentido} onCambio={setSentido} ariaLabel="Sumar o sacar" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="mod-campo" inputMode="decimal" aria-label="Monto" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
              <input className="mod-campo" type="date" max={hoyISO()} aria-label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ flex: '0 1 170px' }} />
              <button type="button" className="btn btn-pri" disabled={ocupado} onClick={agregar} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>Guardar</button>
            </div>
          </section>
        )}

        <section aria-labelledby="dm-hist" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="dm-hist" className="h3" style={{ margin: 0 }}>Cargado a mano</h3>
          {propios.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {propios.map((a) => (
                <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
                  <span style={{ flex: 1, fontSize: 15 }}>{fechaDM(a.fecha)} · {a.monto > 0 ? 'Sumé' : 'Saqué'}</span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{a.monto > 0 ? '+' : '−'}{plata(Math.abs(a.monto), meta.moneda)}</span>
                  <DobleToque texto="Borrar" confirmar="¿Borrar?" disabled={ocupado} onConfirmado={() => hacer(() => borrarAporte(a.id))} />
                </li>
              ))}
            </ul>
          ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Nada cargado a mano.</p>}
        </section>

        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <DobleToque texto="Borrar meta" confirmar="¿Borrar? La reserva no se toca" disabled={ocupado} onConfirmado={async () => { if (await hacer(() => borrarMeta(meta.id))) onCerrar(); }} />
          <button type="button" className="btn" disabled={ocupado} onClick={() => onEditar(meta)} style={{ minHeight: 44 }}>Editar</button>
          <button type="button" className={estado.cumplida && meta.estado === 'activa' ? 'btn btn-pri' : 'btn'} disabled={ocupado}
            // Al lograrla se congela lo juntado y se libera la reserva para la próxima meta.
            onClick={() => hacer(() => actualizarMeta(meta.id, meta.estado === 'activa'
              ? { estado: 'lograda', saldo_inicial: Math.max(0, estado.juntado - estado.manual), bolsillo_id: null }
              : { estado: 'activa' }))} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
            {meta.estado === 'activa' ? 'Marcar lograda' : 'Reactivar'}
          </button>
        </div>
      </div>
    </Hoja>
  );
};
