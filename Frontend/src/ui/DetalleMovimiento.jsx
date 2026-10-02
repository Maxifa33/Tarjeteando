import React, { useEffect, useState } from 'react';
import Seg from './Seg.jsx';
import { pesos, dolares, mesCorto, capitalizar } from './formato.js';

/**
 * Detalle de un movimiento (panel en web, hoja en celular): tarjeta, nombre, monto,
 * fecha, descripción original, plan en cuotas, tipo Variable | Fijo, renombrar
 * (crea una regla por clave de comercio) e historial del comercio.
 */
const fechaCompleta = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 'Sin fecha';
  const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return capitalizar(f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', ''));
};

const DetalleMovimiento = ({
  mov,
  nombreTarjeta,
  identidad,
  color,
  tipo,
  historial = [],
  plan = null,
  pregunta = null,
  onCambiarTipo,
  onEditarDescripcion,
  onVerPlan
}) => {
  const actual = mov.referencia_limpia || mov.referencia_original || '';
  const [borrador, setBorrador] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setBorrador(actual); }, [mov.id, actual]);

  const esReint = tipo === 'reintegro';
  const ars = Number(mov.monto_pesos) || 0;
  const usd = Number(mov.monto_dolares) || 0;
  const signo = esReint ? '− ' : '';
  const n = String(mov.cuota_texto || '').match(/(\d+)\/(\d+)/);
  const limpio = borrador.trim();
  const puedeGuardar = !!limpio && limpio !== actual && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    try { await onEditarDescripcion?.(mov, limpio); } finally { setGuardando(false); }
  };

  // Historial: 6 columnas, la del movimiento opaca y el resto al 45 %.
  const max = Math.max(1, ...historial.map((h) => h.total));
  const conMonto = historial.filter((h) => h.total > 0);
  const promedio = conMonto.length ? conMonto.reduce((s, h) => s + h.total, 0) / conMonto.length : 0;
  const frase = (() => {
    if (pregunta?.tipo === 'cambio_monto' && pregunta.ultimo?.monto) {
      const v = Math.round(((pregunta.candidato.monto - pregunta.ultimo.monto) / pregunta.ultimo.monto) * 100);
      return `${v >= 0 ? 'Subió' : 'Bajó'} ${Math.abs(v)} % este mes. Confirmá en Mes si sigue siendo fijo.`;
    }
    if (conMonto.length > 1) return `Promedio de los últimos ${historial.length}: ${pesos(promedio)}`;
    if (conMonto.length === 1) return 'Es la primera vez que aparece en estos resúmenes.';
    return '';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 42, height: 28, borderRadius: 6, background: identidad.plastico, boxShadow: '0 4px 10px rgba(0,0,0,.25)', flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{nombreTarjeta}</span>
          <span className="cap">
            {mov.origen === 'en_curso'
              ? `Últimos consumos${mov.tarjeta_ult4 ? ` · plástico ·${mov.tarjeta_ult4}` : ''}`
              : mov.tarjeta_ult4 ? `Plástico ·${mov.tarjeta_ult4}` : (mov.resumen_id ? 'Resumen importado' : '')}
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 20, lineHeight: '25px', fontWeight: 700, letterSpacing: '-.01em', overflowWrap: 'anywhere' }}>{actual}</span>
        {ars !== 0 && <span className="rnd" style={{ fontSize: 26, lineHeight: '32px', fontWeight: 700, color: esReint ? 'var(--ok)' : 'var(--label)' }}>{signo}{pesos(Math.abs(ars), { decimales: 2 })}</span>}
        {usd !== 0 && <span className="rnd" style={{ fontSize: ars !== 0 ? 17 : 26, lineHeight: ars !== 0 ? '22px' : '32px', fontWeight: 700, color: esReint ? 'var(--ok)' : 'var(--label)' }}>{signo}{dolares(Math.abs(usd))}</span>}
        <span className="cap" style={{ fontSize: 13 }}>{fechaCompleta(mov.fecha_compra || mov.fecha)}{esReint ? ' · Reintegro' : ''}{mov.origen === 'en_curso' ? ' · En curso' : ''}{mov.es_pendiente ? ' · Pendiente' : ''}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="cap">{mov.origen === 'en_curso' ? 'Descripción en Últimos consumos' : 'Descripción en el resumen'}{mov.categoria ? ` · ${mov.categoria}` : ''}</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'var(--fill)', overflowWrap: 'anywhere' }}>
          {mov.referencia_original || '—'}
        </span>
      </div>

      {n && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="cap">Plan en cuotas</span>
            <span className="cap">Cuota {Number(n[1])} de {Number(n[2])}</span>
          </div>
          <span aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--fill)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: 6, width: `${(Number(n[1]) / Number(n[2])) * 100}%`, background: color }} />
          </span>
          {plan && onVerPlan && (
            <button type="button" className="btn" onClick={() => onVerPlan(plan)} style={{ alignSelf: 'flex-start', minHeight: 40 }}>Ver plan en Cuotas</button>
          )}
        </div>
      )}

      {mov.origen === 'en_curso' && tipo === 'variable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="cap">Tipo de gasto</span>
          <span style={{ fontSize: 14, color: 'var(--label2)' }}>El tipo se define cuando llega el resumen.</span>
        </div>
      )}

      {mov.origen !== 'en_curso' && (tipo === 'fijo' || tipo === 'variable') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="cap">Tipo de gasto</span>
          <Seg
            ariaLabel="Tipo de gasto"
            valor={tipo}
            onCambio={(t) => t !== tipo && onCambiarTipo?.(mov, t)}
            opciones={[{ id: 'variable', label: 'Variable' }, { id: 'fijo', label: 'Fijo' }]}
          />
          <span className="cap">Desde este resumen en adelante.</span>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label className="cap" htmlFor={`nombre-${mov.id}`}>Nombre para mostrar</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id={`nombre-${mov.id}`}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 10, border: 0, background: 'var(--fill)', padding: '0 12px', font: 'inherit', fontSize: 15, color: 'var(--label)' }}
          />
          <button type="submit" className="btn btn-pri" disabled={!puedeGuardar} style={{ height: 40, borderRadius: 10, opacity: puedeGuardar ? 1 : 0.5 }}>Guardar</button>
        </div>
        <span className="cap">Crea una regla para todos los meses de este comercio.</span>
      </form>

      {historial.filter((h) => h.total > 0).length === 1 && (
        <span className="cap">Es la primera vez que aparece en tus resúmenes.</span>
      )}

      {historial.filter((h) => h.total > 0).length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="cap">Este comercio en los últimos {historial.length} resúmenes</span>
          <div role="img" aria-label={historial.map((h) => `${h.mesKey ? mesCorto(h.mesKey) : ''}: ${pesos(h.total)}`).join(', ')}
            style={{ display: 'grid', gridTemplateColumns: `repeat(${historial.length},minmax(0,1fr))`, gap: 6, alignItems: 'end', height: 58 }}>
            {historial.map((h) => (
              <div key={h.resumenId} aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span className="spr" style={{ width: 14, height: Math.max(h.total > 0 ? 2 : 0, (h.total / max) * 38), borderRadius: '4px 4px 0 0', background: color, opacity: h.actual ? 1 : 0.45 }} />
                <span className="cap" style={{ fontSize: 10, fontWeight: h.actual ? 700 : 400 }}>{h.mesKey ? mesCorto(h.mesKey) : '—'}</span>
              </div>
            ))}
          </div>
          {frase && <span className="cap">{frase}</span>}
        </div>
      )}
    </div>
  );
};

export default DetalleMovimiento;
