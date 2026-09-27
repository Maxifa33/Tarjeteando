import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { pesos, dolares, mesLargo, capitalizar } from './formato.js';
import { sumarMeses } from '../services/mes.js';

/**
 * Detalle de un plan en cuotas (panel en web, hoja en celular): aviso de "última"
 * (cuánto se libera) o de "a revisar" con la decisión, 4 cifras, puntos por cuota y
 * próximas cuotas.
 */
const DetallePlan = ({ fila, identidad, color, nombreTarjeta, cuotas = [], proximas = [], hoyMesKey, decisionId = null, onDecidir, onDeshacer }) => {
  const p = fila.plan;
  const usd = !p.monto_cuota_pesos && p.monto_cuota_dolares;
  const monto = (v, montoUsd) => (usd ? `${dolares(montoUsd)} (≈ ${pesos(v)})` : pesos(v));
  const cuota = usd ? p.monto_cuota_dolares : p.monto_cuota_pesos;
  const pagadas = cuotas.filter((c) => c.estado === 'pagada').length;
  const fmt = (v) => (usd ? dolares(v) : pesos(v));
  const compra = p.fecha_compra ? capitalizar(mesLargo(String(p.fecha_compra).slice(0, 7))) : capitalizar(mesLargo(fila.inicio));

  const cifra = (label, valor) => (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="cap">{label}</span>
      <span className="rnd" style={{ fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>{valor}</span>
    </span>
  );

  const aviso = (() => {
    const caja = { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: 'var(--fill)' };
    if (fila.estado === 'a_revisar') {
      const faltan = p.total_cuotas - (p.cuotas_pagadas ?? p.cuota_actual);
      return (
        <div style={caja}>
          <AlertTriangle size={20} aria-hidden="true" style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, lineHeight: '20px' }}>
              El banco dejó de facturar este plan: quedaban {faltan} {faltan === 1 ? 'cuota' : 'cuotas'}. Mientras no decidas, no se proyecta.
            </span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-pri" onClick={() => onDecidir?.(fila, 'terminado')} style={{ minHeight: 44 }}>Marcar como terminado</button>
              <button type="button" className="btn" onClick={() => onDecidir?.(fila, 'vigente')} style={{ minHeight: 44 }}>Sigue vigente</button>
            </span>
          </span>
        </div>
      );
    }
    if (fila.estado === 'ultima') {
      return (
        <div style={caja}>
          <CheckCircle size={20} aria-hidden="true" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 14, lineHeight: '20px' }}>
            Es la última cuota. Desde {mesLargo(sumarMeses(hoyMesKey, 1))} liberás {pesos(fila.cuota)} por mes.
          </span>
        </div>
      );
    }
    if (p.decision && decisionId) {
      return (
        <div style={{ ...caja, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14 }}>{p.decision === 'terminado' ? 'Lo marcaste como terminado.' : 'Marcaste que sigue vigente.'}</span>
          <button type="button" className="btn" onClick={() => onDeshacer?.(decisionId)} style={{ minHeight: 40 }}>Volver a revisar</button>
        </div>
      );
    }
    return null;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 42, height: 28, borderRadius: 6, background: identidad.plastico, boxShadow: '0 4px 10px rgba(0,0,0,.25)', flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', overflowWrap: 'anywhere' }}>{p.descripcion}</span>
          <span className="cap" style={{ fontSize: 13 }}>{nombreTarjeta} · compra en {compra}</span>
        </span>
      </div>
      {aviso}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>
        {cifra('Cuota', fmt(cuota))}
        {cifra('Total del plan', fmt(cuota * p.total_cuotas))}
        {cifra('Pagado', fmt(cuota * pagadas))}
        {cifra('Restante', fila.restante > 0 ? `${pesos(fila.restante)}${fila.estimado ? ' (estimado)' : ''}` : pesos(0))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="cap" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{pagadas} de {p.total_cuotas} pagadas</span>
          <span>{capitalizar(mesLargo(fila.inicio))} → {mesLargo(fila.fin)}</span>
        </div>
        <div role="img" aria-label={`${pagadas} de ${p.total_cuotas} cuotas pagadas`} style={{ display: 'flex', gap: 3 }}>
          {cuotas.map((c) => (
            <span key={c.numero} aria-hidden="true" style={{ flex: 1, height: 10, borderRadius: 3, background: color, opacity: c.estado === 'pagada' ? 1 : c.estado === 'este_mes' ? 0.65 : 0.2 }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 className="h3" style={{ paddingBottom: 4 }}>{proximas.length ? 'Próximas cuotas' : fila.estado === 'terminado' ? 'Plan terminado' : 'Próximas cuotas'}</h3>
        {proximas.map((x) => (
          <div key={x.mesKey} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, borderBottom: '0.5px solid var(--sep)', fontSize: 14 }}>
            <span style={{ flexGrow: 1 }}>{capitalizar(mesLargo(x.mesKey))}{x.mesKey === hoyMesKey ? ' · este mes' : ''}</span>
            <span className="cap" style={{ width: 60 }}>{x.numero}/{x.total}</span>
            <span style={{ fontWeight: 500 }}>{monto(x.monto, x.montoUsd)}</span>
          </div>
        ))}
        {!proximas.length && (
          <span style={{ fontSize: 14, color: 'var(--label2)', paddingTop: 6 }}>
            {p.motivo === 'decision_usuario'
              ? 'Lo diste por terminado: no se proyecta.'
              : fila.estado === 'terminado' ? `Se pagó hasta ${mesLargo(fila.fin)}.` : 'Sin cuotas proyectadas hasta que lo revises.'}
          </span>
        )}
      </div>
    </div>
  );
};

export default DetallePlan;
