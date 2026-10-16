import React, { useEffect, useState } from 'react';
import Hoja from '../../../ui/Hoja.jsx';
import { candidatosVincular, vincularMovimiento } from '../../alcancia/repo.js';
import { hoyISO, fechaDM } from '../deudas/HojasDeuda.jsx';
import { dinero } from './dinero.js';
import '../modulos.css';

const TIPOS = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia_interna: 'Entre tus cuentas' };
const queEra = (tipo) => (tipo === 'ingreso' ? 'un ingreso' : tipo === 'gasto' ? 'un gasto' : 'una transferencia entre tus cuentas');
const nombreMov = (m) => m.descripcion || m.contraparte || m.descripcion_original || 'Movimiento';

/** Elegir un movimiento importado (ej. un retiro de cajero) y contarlo como depósito o retiro de esta reserva. */
const VincularMovimiento = ({ abierta, reserva, onCerrar, onCambio }) => {
  const [lista, setLista] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!abierta || !reserva) return undefined;
    let vivo = true;
    setLista(null); setElegido(null); setError(null);
    candidatosVincular(reserva.moneda, hoyISO()).then((l) => { if (vivo) setLista(l); }).catch(() => { if (vivo) { setLista([]); setError('No se pudieron leer tus movimientos. Revisá tu conexión.'); } });
    return () => { vivo = false; };
  }, [abierta, reserva?.id, reserva?.moneda]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!reserva) return null;

  const confirmar = async () => {
    setOcupado(true); setError(null);
    try { await vincularMovimiento(elegido.id, reserva.id); await onCambio?.(); onCerrar(); }
    catch { setError('No se pudo vincular. Puede que el movimiento ya haya cambiado: volvé a abrir la lista.'); }
    finally { setOcupado(false); }
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={`Vincular a ${reserva.nombre}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 4px 8px' }}>
        {elegido ? (
          <>
            <p style={{ margin: 0, fontSize: 15 }}><strong>{nombreMov(elegido)}</strong> · {fechaDM(elegido.fecha)} · <span className="mod-cifra">{dinero(elegido.monto, reserva.moneda)}</span></p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>
              {elegido.direccion === 'salida'
                ? `Va a contar como plata que pusiste en "${reserva.nombre}": deja de ser ${queEra(elegido.tipo)} y suma al saldo de la reserva.`
                : `Va a contar como plata que sacaste de "${reserva.nombre}": deja de ser ${queEra(elegido.tipo)} y resta del saldo de la reserva.`}
              {' '}Podés deshacerlo cuando quieras desde el detalle de la reserva.
            </p>
            {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" disabled={ocupado} onClick={() => setElegido(null)} style={{ minHeight: 44 }}>Volver</button>
              <button type="button" className="btn btn-pri" disabled={ocupado} onClick={confirmar} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>{ocupado ? 'Vinculando…' : 'Vincular'}</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Movimientos de los últimos 90 días en {reserva.moneda === 'ARS' ? 'pesos' : reserva.moneda}, sin reserva ni deuda asignada. Elegí el que pusiste en esta reserva o sacaste de ella (ej. un retiro de cajero).</p>
            {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
            {!lista ? <p role="status" style={{ margin: 0 }}>Cargando…</p>
              : lista.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {lista.map((m) => (
                    <li key={m.id}>
                      <button type="button" className="mod-mov" onClick={() => setElegido(m)} style={{ minHeight: 52, width: '100%' }}
                        aria-label={`${nombreMov(m)}, ${fechaDM(m.fecha)}, ${dinero(m.monto, reserva.moneda)}. Elegir`}>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                          <span style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreMov(m)}</span>
                          <span style={{ fontSize: 12, color: 'var(--label2)' }}>{fechaDM(m.fecha)} · {TIPOS[m.tipo] || m.tipo} · {m.direccion === 'salida' ? 'salió' : 'entró'}</span>
                        </span>
                        <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{dinero(m.monto, reserva.moneda)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>No hay movimientos para vincular.</p>}
          </>
        )}
      </div>
    </Hoja>
  );
};

export default VincularMovimiento;
