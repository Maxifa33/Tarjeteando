import React, { useEffect, useState } from 'react';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import { parseMonto } from '../../cuentas/util.js';
import { validarAjuste, validarMovReserva, saldoAl } from '../../alcancia/reservas.js';
import { guardarAjuste, borrarAjuste, crearMovReserva, borrarMovReserva, desvincularMovimiento, archivarReserva, borrarReserva } from '../../alcancia/repo.js';
import { hoyISO, fechaDM } from '../deudas/HojasDeuda.jsx';
import { DobleToque } from './HojasMeta.jsx';
import FormReserva from './FormReserva.jsx';
import VincularMovimiento from './VincularMovimiento.jsx';
import { dinero } from './dinero.js';
import '../modulos.css';

const signo = (n, moneda) => `${n >= 0 ? '+' : '−'}${dinero(Math.abs(n), moneda)}`;
const MEDIO = { digital: 'digital', efectivo: 'efectivo', otro: 'otro' };

/** Detalle de una reserva: saldo, mover plata (manuales), actualizar saldo e historial con balance corrido. */
export const DetalleReserva = ({ estado, existentes = [], onCerrar, onCambio }) => {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [sentido, setSentido] = useState('deposito');
  const [nota, setNota] = useState('');
  const [mMonto, setMMonto] = useState('');
  const [mFecha, setMFecha] = useState(hoyISO());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [sub, setSub] = useState(null); // 'editar' | 'vincular'
  useEffect(() => { setMonto(''); setFecha(hoyISO()); setSentido('deposito'); setNota(''); setMMonto(''); setMFecha(hoyISO()); setError(null); setSub(null); }, [estado?.id]);
  if (!estado) return null;
  const manual = estado.origen === 'manual';
  const m = estado.moneda;

  const hacer = async (fn) => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio?.(); return true; }
    catch (e) { setError(e?.codigo === 'meta' ? `Esta reserva está vinculada a la meta ${e.metas.join(', ')}. Desvinculala o borrá la meta primero.` : 'No se pudo guardar. Revisá tu conexión.'); return false; }
    finally { setOcupado(false); }
  };
  const corregir = async (e) => {
    e.preventDefault();
    const v = validarAjuste({ bolsilloId: estado.id, fecha: mFecha, monto: parseMonto(mMonto) }, hoyISO());
    if (v.error) { setError(v.error); return; }
    if (await hacer(() => guardarAjuste(v.fila))) setMMonto('');
  };
  const mover = async (e) => {
    e.preventDefault();
    const v = validarMovReserva({ sentido, monto, fecha, nota }, { saldo: fecha ? saldoAl(estado, fecha) : estado.saldo, hoy: hoyISO() });
    if (v.error) { setError(v.error); return; }
    if (await hacer(() => crearMovReserva({ ...v.fila, bolsillo_id: estado.id }))) { setMonto(''); setNota(''); }
  };
  const filas = [...estado.filas].reverse();
  const cerrarSub = () => setSub(null);

  return (
    <>
      <Hoja abierta={!sub} onCerrar={onCerrar} titulo={estado.nombre}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 4px 8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{dinero(estado.saldo, m)}</span>
            {m !== 'ARS' && (
              <span className="mod-cifra" style={{ fontSize: 14, color: 'var(--label2)' }}>
                {estado.equivalenteARS != null
                  ? `≈ ${dinero(estado.equivalenteARS, 'ARS')}${m === 'USD' ? ' al MEP' : ` · cotización manual${estado.cotizacionFecha ? ` del ${fechaDM(estado.cotizacionFecha)}` : ''}`}`
                  : (m === 'USD' ? 'Sin cotización del dólar por ahora' : 'Sin cotización: editá la reserva para ver el equivalente en pesos')}
              </span>
            )}
            <span style={{ fontSize: 14, color: 'var(--label2)' }}>
              {estado.tipo === 'ahorro' ? 'Ahorro' : 'Apartado'}{manual ? ` · ${MEDIO[estado.medio] || 'manual'}` : ' · Mercado Pago'} · {estado.sinAnclar ? (manual ? 'sin saldo confirmado' : 'saldo sin confirmar') : `saldo confirmado el ${fechaDM(estado.ultimoAjuste)}`}
            </span>
            <span className="mod-cifra" style={{ fontSize: 13, color: 'var(--label2)' }}>
              Pusiste {dinero(estado.aportado, m)} · sacaste {dinero(estado.retirado, m)}{manual ? '' : ' (desde el primer extracto importado)'}
            </span>
            {estado.notas && <span style={{ fontSize: 13, color: 'var(--label2)' }}>{estado.notas}</span>}
          </div>

          {manual && !estado.archivada && (
            <form onSubmit={mover} aria-labelledby="dr-mover" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 id="dr-mover" className="h3" style={{ margin: 0 }}>Mover plata</h3>
              <Seg opciones={[{ id: 'deposito', label: 'Puse' }, { id: 'retiro', label: 'Saqué' }]} valor={sentido} onCambio={setSentido} ariaLabel="Poner o sacar plata" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="mod-campo" inputMode="decimal" aria-label="Monto" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
                <input className="mod-campo" type="date" max={hoyISO()} aria-label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ flex: '0 1 170px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="mod-campo" aria-label="Nota (opcional)" placeholder="Nota (opcional)" maxLength={120} value={nota} onChange={(e) => setNota(e.target.value)} style={{ flex: '1 1 160px' }} />
                <button type="submit" className="btn btn-pri" disabled={ocupado} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>Esto no toca tus cuentas ni Presupuestos. Si la plata salió de una cuenta que importaste (ej. un retiro de cajero), usá "Vincular movimiento" para que deje de contar como gasto.</p>
            </form>
          )}

          <form onSubmit={corregir} aria-labelledby="dr-act" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 id="dr-act" className="h3" style={{ margin: 0 }}>{manual ? 'Corregir saldo' : 'Actualizar saldo'}</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>
              {manual ? 'Si lo que tenés no coincide con el saldo de acá, poné el real y de ahí en adelante se suma desde ese punto.'
                : 'Los extractos no traen el saldo de la reserva ni su rendimiento. Poné lo que ves hoy en Mercado Pago y de ahí en adelante se suma solo al importar.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="mod-campo" inputMode="decimal" aria-label="Saldo real" placeholder={manual ? 'Saldo real' : 'Saldo en MP'} value={mMonto} onChange={(e) => setMMonto(e.target.value)} />
              <input className="mod-campo" type="date" max={hoyISO()} aria-label="Fecha del saldo" value={mFecha} onChange={(e) => setMFecha(e.target.value)} style={{ flex: '0 1 170px' }} />
              <button type="submit" className="btn btn-pri" disabled={ocupado} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}

          <section aria-labelledby="dr-hist" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3 id="dr-hist" className="h3" style={{ margin: 0 }}>Movimientos</h3>
            {filas.length ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filas.map((f) => f.tipo === 'ajuste' ? (
                  <li key={`a${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '6px 10px', borderRadius: 12, background: 'var(--fill2)' }}>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: 15 }}>
                      <span>{fechaDM(f.fecha)} · Saldo confirmado</span>
                      {Math.abs(f.diferencia) >= 0.005 && <span style={{ fontSize: 12, color: 'var(--label2)' }}>{signo(f.diferencia, m)} frente a lo calculado{manual ? '' : ' (rendimiento o saldo previo)'}</span>}
                    </span>
                    <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{dinero(f.saldo, m)}</span>
                    <DobleToque texto="Borrar" confirmar="¿Borrar?" disabled={ocupado} onConfirmado={() => hacer(() => borrarAjuste(f.id))} />
                  </li>
                ) : (
                  <li key={`m${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 10px' }}>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: 15 }}>
                      <span>{fechaDM(f.fecha)} · {f.monto > 0 ? 'Pusiste' : 'Sacaste'}</span>
                      {(f.nota || f.vinculado) && <span style={{ fontSize: 12, color: 'var(--label2)' }}>{[f.vinculado ? 'de tus cuentas (vinculado)' : null, f.nota].filter(Boolean).join(' · ')}</span>}
                    </span>
                    <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{signo(f.monto, m)}</span>
                    <span className="mod-cifra" style={{ fontSize: 13, color: 'var(--label2)', minWidth: 96, textAlign: 'right' }}>{dinero(f.saldo, m)}</span>
                    {f.manual && <DobleToque texto="Borrar" confirmar="¿Borrar?" disabled={ocupado} onConfirmado={() => hacer(() => borrarMovReserva(f.id))} />}
                    {f.vinculado && <DobleToque texto="Desvincular" confirmar="¿Desvincular?" disabled={ocupado} onConfirmado={() => hacer(() => desvincularMovimiento(f.id))} />}
                  </li>
                ))}
              </ul>
            ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Todavía no hay movimientos en esta reserva.</p>}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>La columna de la derecha es el saldo después de cada movimiento.</p>
          </section>

          {manual && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <DobleToque texto="Borrar reserva" confirmar="¿Borrar? Los movimientos vinculados vuelven a ser lo que eran" disabled={ocupado}
                onConfirmado={async () => { if (await hacer(() => borrarReserva(estado.id))) onCerrar(); }} />
              <button type="button" className="btn" disabled={ocupado} onClick={() => hacer(() => archivarReserva(estado.id, !estado.archivada))} style={{ minHeight: 44 }}>
                {estado.archivada ? 'Reactivar' : 'Archivar'}
              </button>
              <button type="button" className="btn" disabled={ocupado} onClick={() => setSub('editar')} style={{ minHeight: 44 }}>Editar</button>
              {!estado.archivada && <button type="button" className="btn btn-pri" disabled={ocupado} onClick={() => setSub('vincular')} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>Vincular movimiento</button>}
            </div>
          )}
        </div>
      </Hoja>
      {manual && (
        <>
          <FormReserva abierta={sub === 'editar'} reserva={estado} existentes={existentes} bloquearMoneda={estado.movimientos > 0 || estado.ultimoAjuste != null} onCerrar={cerrarSub} onGuardado={onCambio} />
          <VincularMovimiento abierta={sub === 'vincular'} reserva={estado} onCerrar={cerrarSub} onCambio={onCambio} />
        </>
      )}
    </>
  );
};
