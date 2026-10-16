import React, { useEffect, useState } from 'react';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import { MEDIOS, validarReserva } from '../../alcancia/reservas.js';
import { crearReserva, actualizarReserva } from '../../alcancia/repo.js';
import { hoyISO, fechaDM } from '../deudas/HojasDeuda.jsx';
import { Campo, Botonera } from './HojasMeta.jsx';
import '../modulos.css';

const vacia = () => ({ nombre: '', moneda: 'ARS', codigo: '', medio: 'efectivo', tipo: 'apartado', saldo: '', cotizacion: '', notas: '' });
const Grupo = ({ label, nota, children }) => (
  <div role="group" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--label2)' }}>
    <span>{label}</span>
    {children}
    {nota && <span style={{ fontSize: 12 }}>{nota}</span>}
  </div>
);
const aTexto = (n) => (n == null ? '' : String(n).replace('.', ','));

/** Alta / edición de una reserva manual (efectivo o digital, en cualquier moneda). */
const FormReserva = ({ abierta, reserva, existentes = [], bloquearMoneda = false, onCerrar, onGuardado }) => {
  const [f, setF] = useState(vacia);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!abierta) return;
    setError(null);
    if (!reserva) { setF(vacia()); return; }
    const conocida = ['ARS', 'USD', 'EUR'].includes(reserva.moneda);
    setF({ nombre: reserva.nombre, moneda: conocida ? reserva.moneda : 'OTRA', codigo: conocida ? '' : reserva.moneda, medio: reserva.medio || 'otro', tipo: reserva.tipo, saldo: '', cotizacion: aTexto(reserva.cotizacion), notas: reserva.notas || '' });
  }, [abierta, reserva]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const moneda = (f.moneda === 'OTRA' ? f.codigo : f.moneda).trim().toUpperCase();
  const pideCotizacion = moneda !== '' && moneda !== 'ARS' && moneda !== 'USD';

  const guardar = async () => {
    const hoy = hoyISO();
    const v = validarReserva(f, { existentes, editando: reserva, hoy });
    if (v.error) { setError(v.error); return; }
    setOcupado(true); setError(null);
    try {
      if (reserva) { const { origen, ...cambios } = v.fila; await actualizarReserva(reserva.id, cambios); } // eslint-disable-line no-unused-vars
      else await crearReserva(v.fila, v.saldo, hoy);
      await onGuardado?.(); onCerrar();
    } catch (e) { setError(/duplicate|unique/i.test(String(e?.message)) ? 'Ya tenés una reserva con ese nombre.' : 'No se pudo guardar. Revisá tu conexión.'); }
    finally { setOcupado(false); }
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={reserva ? 'Editar reserva' : 'Nueva reserva'}>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <Campo label="Nombre"><input className="mod-campo" value={f.nombre} onChange={set('nombre')} placeholder="Sobre de efectivo, Dólares del viaje…" maxLength={40} aria-invalid={error && /nombre/i.test(error) ? 'true' : undefined} /></Campo>
        <Campo label="Moneda" nota={bloquearMoneda ? 'La moneda no se cambia porque la reserva ya tiene movimientos.' : null}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="mod-select" value={f.moneda} onChange={set('moneda')} aria-label="Moneda" disabled={bloquearMoneda}>
              <option value="ARS">Pesos ($)</option><option value="USD">Dólares (U$S)</option><option value="EUR">Euros (€)</option><option value="OTRA">Otra…</option>
            </select>
            {f.moneda === 'OTRA' && <input className="mod-campo" value={f.codigo} onChange={set('codigo')} placeholder="Código: BRL, CLP…" maxLength={5} aria-label="Código de la moneda" disabled={bloquearMoneda} style={{ textTransform: 'uppercase' }} />}
          </div>
        </Campo>
        <Grupo label="¿Dónde está?"><Seg opciones={MEDIOS} valor={f.medio} onCambio={set('medio')} ariaLabel="Medio" /></Grupo>
        <Grupo label="¿Para qué es?" nota="Apartado: plata separada para un gasto que viene. Ahorro: fondo que no pensás gastar.">
          <Seg opciones={[{ id: 'apartado', label: 'Apartado' }, { id: 'ahorro', label: 'Ahorro' }]} valor={f.tipo} onCambio={set('tipo')} ariaLabel="Tipo de reserva" />
        </Grupo>
        {!reserva && (
          <Campo label="¿Cuánto hay hoy? (opcional)" nota="Es el punto de partida. Después sumás y sacás plata desde el detalle.">
            <input className="mod-campo" inputMode="decimal" value={f.saldo} onChange={set('saldo')} placeholder="0" />
          </Campo>
        )}
        {pideCotizacion && (
          <Campo label={`¿Cuántos pesos vale 1 ${moneda}? (opcional)`} nota={reserva?.cotizacionFecha ? `Cargada el ${fechaDM(reserva.cotizacionFecha)}. Es manual: actualizala cuando cambie. Sin cotización no entra al total en pesos.` : 'Es manual: sin cotización esta reserva no entra al total en pesos.'}>
            <input className="mod-campo" inputMode="decimal" value={f.cotizacion} onChange={set('cotizacion')} placeholder="0" />
          </Campo>
        )}
        <Campo label="Notas (opcional)"><input className="mod-campo" value={f.notas} onChange={set('notas')} maxLength={200} /></Campo>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <Botonera onCerrar={onCerrar} ocupado={ocupado} />
      </form>
    </Hoja>
  );
};

export default FormReserva;
