import React, { useEffect, useState } from 'react';
import Hoja from '../../../ui/Hoja.jsx';
import { parseMonto } from '../../cuentas/util.js';
import { validarAjuste } from '../../alcancia/reservas.js';
import { guardarAjuste, borrarAjuste } from '../../alcancia/repo.js';
import { hoyISO, plata, fechaDM } from '../deudas/HojasDeuda.jsx';
import { DobleToque } from './HojasMeta.jsx';
import '../modulos.css';

const signo = (n) => `${n >= 0 ? '+' : '−'}${plata(Math.abs(n), 'ARS')}`;

/** Detalle de una reserva: saldo, "Actualizar saldo" e historial con balance corrido. */
export const DetalleReserva = ({ estado, onCerrar, onCambio }) => {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { setMonto(''); setFecha(hoyISO()); setError(null); }, [estado?.id]);
  if (!estado) return null;

  const hacer = async (fn) => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio?.(); return true; } catch { setError('No se pudo guardar. Revisá tu conexión.'); return false; } finally { setOcupado(false); }
  };
  const guardar = async (e) => {
    e.preventDefault();
    const v = validarAjuste({ bolsilloId: estado.id, fecha, monto: parseMonto(monto) }, hoyISO());
    if (v.error) { setError(v.error); return; }
    if (await hacer(() => guardarAjuste(v.fila))) setMonto('');
  };
  const filas = [...estado.filas].reverse();

  return (
    <Hoja abierta={!!estado} onCerrar={onCerrar} titulo={estado.nombre}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{plata(estado.saldo, 'ARS')}</span>
          <span style={{ fontSize: 14, color: 'var(--label2)' }}>
            {estado.tipo === 'ahorro' ? 'Ahorro' : 'Apartado'} · {estado.sinAnclar ? 'saldo sin confirmar' : `saldo confirmado el ${fechaDM(estado.ultimoAjuste)}`}
          </span>
          <span className="mod-cifra" style={{ fontSize: 13, color: 'var(--label2)' }}>
            Reservaste {plata(estado.aportado, 'ARS')} · retiraste {plata(estado.retirado, 'ARS')} (desde el primer extracto importado)
          </span>
        </div>

        <form onSubmit={guardar} aria-labelledby="dr-act" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 id="dr-act" className="h3" style={{ margin: 0 }}>Actualizar saldo</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>
            Los extractos no traen el saldo de la reserva ni su rendimiento. Poné lo que ves hoy en Mercado Pago y de ahí en adelante se suma solo al importar.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="mod-campo" inputMode="decimal" aria-label="Saldo en Mercado Pago" placeholder="Saldo en MP" value={monto} onChange={(e) => setMonto(e.target.value)} />
            <input className="mod-campo" type="date" max={hoyISO()} aria-label="Fecha del saldo" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ flex: '0 1 170px' }} />
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
                    {Math.abs(f.diferencia) >= 0.005 && <span style={{ fontSize: 12, color: 'var(--label2)' }}>{signo(f.diferencia)} frente a lo calculado (rendimiento o saldo previo)</span>}
                  </span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{plata(f.saldo, 'ARS')}</span>
                  <DobleToque texto="Borrar" confirmar="¿Borrar?" disabled={ocupado} onConfirmado={() => hacer(() => borrarAjuste(f.id))} />
                </li>
              ) : (
                <li key={`m${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 10px' }}>
                  <span style={{ flex: 1, fontSize: 15 }}>{fechaDM(f.fecha)} · {f.monto > 0 ? 'Reservaste' : 'Retiraste'}</span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{signo(f.monto)}</span>
                  <span className="mod-cifra" style={{ fontSize: 13, color: 'var(--label2)', minWidth: 96, textAlign: 'right' }}>{plata(f.saldo, 'ARS')}</span>
                </li>
              ))}
            </ul>
          ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Todavía no hay movimientos importados de esta reserva.</p>}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>La columna de la derecha es el saldo después de cada movimiento.</p>
        </section>
      </div>
    </Hoja>
  );
};
