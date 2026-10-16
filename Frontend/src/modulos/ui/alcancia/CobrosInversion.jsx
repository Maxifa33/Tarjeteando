import React, { useMemo, useState } from 'react';
import { Plus, CreditCard, Landmark, AlertTriangle } from 'lucide-react';
import { pesos, dolares } from '../../../ui/formato.js';
import { candidatosCobro, COTIZACIONES_APORTES } from '../../alcancia/aportes.js';
import { crearVinculo, borrarVinculo } from '../../alcancia/repo.js';
import { fechaDM } from '../deudas/HojasDeuda.jsx';
import { DobleToque } from './HojasMeta.jsx';

const plataDe = (m, moneda) => (moneda === 'USD' ? dolares(m) : pesos(m));
const Icono = ({ origen }) => (origen === 'tarjeta' ? <CreditCard size={16} aria-hidden="true" /> : <Landmark size={16} aria-hidden="true" />);

/**
 * Cobros recurrentes asociados a una inversión (prima del seguro en la tarjeta o débito en la cuenta).
 * `ctx`: { vinculos (de esta inversión), cobros (de esta inversión), todos (todos los cobros), aportes, atrasado, sinTarjetaLocal }.
 */
export const CobrosInversion = ({ inversion: i, ctx, onCambio }) => {
  const [eligiendo, setEligiendo] = useState(false);
  const [q, setQ] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const vinculos = ctx?.vinculos || [];
  const cands = useMemo(() => (eligiendo ? candidatosCobro(ctx?.todos || [], { pista: i.aseguradora || i.nombre, vinculos: ctx?.todosVinculos || vinculos }) : []), [eligiendo, ctx, i, vinculos]);
  const filtrados = cands.filter((c) => !q.trim() || `${c.etiqueta} ${c.clave} ${c.fuente}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
  const hacer = async (fn) => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio?.(); return true; } catch { setError('No se pudo guardar. Revisá tu conexión.'); return false; } finally { setOcupado(false); }
  };
  const ap = ctx?.aportes;
  const cobros = ctx?.cobros || [];
  const conv = COTIZACIONES_APORTES.find((x) => x.id === ap?.conversion);

  return (
    <section aria-labelledby={`cobros-${i.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 id={`cobros-${i.id}`} style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Cobros asociados</h3>
      {!vinculos.length && !eligiendo && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Asociá la prima (en la tarjeta o el débito en la cuenta): cada cobro cuenta como aporte real y el rendimiento usa sus fechas.</p>
      )}
      {vinculos.map((v) => {
        const cs = cobros.filter((c) => c.origen === v.origen && c.clave === v.clave && (!v.ref || c.ref === v.ref));
        const u = cs[cs.length - 1];
        return (
          <div key={v.id} className="mod-filaf" style={{ padding: '6px 0', minHeight: 52 }}>
            <Icono origen={v.origen} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.etiqueta || v.clave}{v.ref ? ` · N° ${v.ref}` : ''}</span>
              <span style={{ fontSize: 12, color: 'var(--label2)' }}>
                {v.origen === 'tarjeta' ? 'Tarjeta' : 'Cuenta'} · {cs.length} {cs.length === 1 ? 'cobro' : 'cobros'}{u ? ` · último ${fechaDM(u.fecha)} ${plataDe(u.monto, u.moneda)}` : ''}
                {!cs.length && v.origen === 'tarjeta' && ctx?.sinTarjetaLocal ? ' · los resúmenes de tarjeta están en otro dispositivo' : ''}{!cs.length && v.origen === 'cuenta' && ctx?.cuenta === 'cargando' ? ' · leyendo…' : ''}
              </span>
            </div>
            <DobleToque texto="Quitar" confirmar="¿Quitar?" disabled={ocupado} onConfirmado={() => hacer(() => borrarVinculo(v.id))} />
          </div>
        );
      })}
      {ctx?.atrasado && (
        <div className="mod-aviso" role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>No aparece el cobro que esperábamos cerca del {fechaDM(ctx.atrasado.esperado)} (el último fue el {fechaDM(ctx.atrasado.ultimo.fecha)}). ¿Se suspendió la póliza o cambiaste la tarjeta?</span>
        </div>
      )}
      {ctx?.errorVinculos && <div className="mod-aviso" role="alert">No se pudieron leer los cobros asociados. Revisá tu conexión.</div>}
      {ap?.pendiente && (ap.error
        ? <div className="mod-aviso" role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>No se pudo leer el dólar histórico para pasar los cobros a dólares. <button type="button" className="btn" onClick={ctx.onReintentarHist} style={{ minHeight: 36 }}>Reintentar</button></div>
        : <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>Pasando los cobros a dólares…</p>)}
      {ctx?.cuenta === 'error' && <div className="mod-aviso" role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>No se pudieron leer tus gastos de cuenta. <button type="button" className="btn" onClick={ctx.onReintentarCuenta} style={{ minHeight: 36 }}>Reintentar</button></div>}
      {ap && ap.reales > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>
          {ap.reales} {ap.reales === 1 ? 'aporte real' : 'aportes reales'}{ap.huecos ? ` + ${ap.huecos} estimados en meses sin cobro importado` : ''}{ap.estimados ? ` + ${ap.estimados} estimados de antes de tus primeros datos` : ''}.
          {conv ? ` En pesos, pasados a dólares con ${conv.label.toLowerCase()}.` : ''}{ap.sinCotizacion ? ` ${ap.sinCotizacion} sin cotización del dólar: se estiman con el cobro más cercano.` : ''}
          {ap.faltaBase ? (i.fecha_inicio ? ' La póliza empezó antes de tus primeros datos importados: cargá el total aportado (Editar) para calcular ganancia y rendimiento.' : ' Cargá la fecha de alta o el total aportado (Editar) para calcular ganancia y rendimiento.') : ''}
          {ap.frecInferida ? ` Por los cobros, el aporte es ${ap.frec === 12 ? 'anual' : ap.frec === 6 ? 'semestral' : ap.frec === 3 ? 'trimestral' : 'mensual'}: se usa eso.` : ''}
        </p>
      )}

      {eligiendo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="mod-campo" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (ej. Zurich)" aria-label="Buscar cobro" autoFocus />
          {ctx?.cuenta === 'cargando' && <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>Leyendo tus gastos de cuenta…</p>}
          {!filtrados.length && ctx?.cuenta !== 'cargando' && <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>{cands.length ? 'Nada con ese nombre.' : 'No hay gastos importados para asociar todavía.'}</p>}
          <ul className="mod-lista" aria-label="Cobros para asociar">
            {filtrados.map((c) => (
              <li key={`${c.origen}|${c.clave}`}>
                <button type="button" className="mod-fila" disabled={ocupado} style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', minHeight: 52 }}
                  onClick={async () => { if (await hacer(() => crearVinculo({ inversion_id: i.id, origen: c.origen, clave: c.clave, ref: c.ref || null, etiqueta: c.etiqueta }))) { setEligiendo(false); setQ(''); } }}>
                  <Icono origen={c.origen} />
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.etiqueta}{c.ref ? ` · N° ${c.ref}` : ''}{c.sugerido ? ' · sugerido' : ''}</span>
                    <span style={{ fontSize: 12, color: 'var(--label2)' }}>{c.origen === 'tarjeta' ? 'Tarjeta' : 'Cuenta'}{c.fuente ? ` ${c.fuente}` : ''} · {c.meses} {c.meses === 1 ? 'mes' : 'meses'} · último {fechaDM(c.ultimo.fecha)} {plataDe(c.ultimo.monto, c.ultimo.moneda)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={() => { setEligiendo(false); setQ(''); }} style={{ minHeight: 44, alignSelf: 'flex-start' }}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="btn" disabled={ocupado || ctx?.errorVinculos} onClick={() => { setEligiendo(true); ctx?.onAbrir?.(); }} style={{ minHeight: 44, alignSelf: 'flex-start', borderRadius: 22, padding: '0 16px' }}>
          <Plus size={16} aria-hidden="true" /> Asociar cobro recurrente
        </button>
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
    </section>
  );
};
