import React, { useState } from 'react';
import Seg from './Seg.jsx';
import { useAncho } from './useCompacto.js';
import { escalaY } from '../services/evolucion.js';
import { pesos, dolares, corto, mesLargo, capitalizar } from './formato.js';

/**
 * Evolución y proyección: columnas apiladas con divs (sin recharts), un solo eje Y.
 * Pagados → Hoy → en curso (rayado) → banda "Ya comprometido".
 *
 * series: { tarjeta: [{ id, nombre, color }], tipo: [{ id, nombre, color }] } en orden de apilado.
 * Ningún texto usa el color de la serie: los valores van en --label / --label2.
 */

// slot = ancho por mes. Se estira para llenar el ancho disponible entre slotMin y
// slotMax; por debajo de slotMin aparece scroll horizontal. Las columnas no pasan de col.
const TAM = {
  web: { plotH: 220, slot: 62, slotMin: 44, slotMax: 120, col: 24, eje: 64, pie: 28 },
  compacto: { plotH: 150, slot: 22, slotMin: 22, slotMax: 40, col: 12, eje: 40, pie: 28 }
};

const ESTADO = { pagado: 'Pagado', en_curso: 'En curso', comprometido: 'Comprometido' };

export const valoresDe = (col, modo, series) =>
  (modo === 'tipo' ? series.tipo : series.tarjeta)
    .map((s) => ({ ...s, valor: modo === 'tipo' ? (col.porTipo[s.id] || 0) : (col.porTarjeta[s.id] || 0) }));

const Leyenda = ({ items, tope }) => (
  <div className="cap" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center' }}>
    {items.map((s) => (
      <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--label)' }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />{s.nombre}
      </span>
    ))}
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg,var(--label2) 0 2px,transparent 2px 4px)' }} />Estimado
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden="true" style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--fill)' }} />Ya comprometido
    </span>
    {tope > 0 && (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true" style={{ width: 14, height: 0, borderTop: '1.5px solid var(--label)' }} />Tu tope
      </span>
    )}
  </div>
);

const Tabla = ({ columnas }) => {
  const grid = { display: 'grid', gridTemplateColumns: '150px 110px repeat(4,minmax(96px,1fr))', gap: 8, padding: '7px 8px', borderBottom: '0.5px solid var(--sep)' };
  const der = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <div role="table" aria-label="Evolución y proyección" style={{ display: 'flex', flexDirection: 'column', fontSize: 13, minWidth: 700 }}>
        <div role="row" style={{ ...grid, fontWeight: 600, color: 'var(--label2)' }}>
          <span role="columnheader">Mes</span><span role="columnheader">Estado</span>
          <span role="columnheader" style={der}>Cuotas</span><span role="columnheader" style={der}>Fijos</span>
          <span role="columnheader" style={der}>Variables</span><span role="columnheader" style={der}>Total</span>
        </div>
        {columnas.map((c) => (
          <div role="row" key={c.mesKey} style={grid}>
            <span role="cell">{capitalizar(mesLargo(c.mesKey))}</span>
            <span role="cell" style={{ color: 'var(--label2)' }}>{ESTADO[c.tipo]}</span>
            <span role="cell" style={der}>{pesos(c.porTipo.cuotas)}</span>
            <span role="cell" style={der}>{pesos(c.porTipo.fijos)}</span>
            <span role="cell" style={der}>{c.tipo === 'comprometido' ? '—' : pesos(c.porTipo.variables)}</span>
            <span role="cell" style={{ ...der, fontWeight: 600 }}>{pesos(c.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const EvolucionChart = ({
  columnas: todas = [],
  series,
  modo = 'tarjeta',
  onModo,
  vista = 'grafico',
  onVista,
  seleccion,
  onSeleccion,
  tope = null,
  compacto = false
}) => {
  const [hover, setHover] = useState(null);
  const [refPlot, anchoDisp] = useAncho();
  const t = compacto ? TAM.compacto : TAM.web;

  // Compacto: 6 pagados + en curso + 6 comprometidos.
  const iCurso = todas.findIndex((c) => c.tipo === 'en_curso');
  const inicio = compacto ? Math.max(0, iCurso - 6) : 0;
  const columnas = todas.slice(inicio);
  const idx = (j) => j + inicio; // índice local → índice en `todas`
  const jCurso = iCurso - inicio;
  const jFut = columnas.findIndex((c) => c.tipo === 'comprometido');
  const nFut = columnas.filter((c) => c.tipo === 'comprometido').length;
  const jUltPagado = jCurso - 1;

  const { max, ticks } = escalaY(Math.max(...columnas.map((c) => c.total), 0), tope, { compacto });
  const Y = (v) => (v / max) * t.plotH;
  const slot = anchoDisp > 0 && columnas.length
    ? Math.min(t.slotMax, Math.max(t.slotMin, Math.floor((anchoDisp - t.eje - 4) / columnas.length)))
    : t.slot;
  const ancho = columnas.length * slot;
  const items = modo === 'tipo' ? series.tipo : series.tarjeta;

  const tooltip = (() => {
    if (compacto || hover === null || vista !== 'grafico') return null;
    const j = hover - inicio;
    const c = columnas[j];
    if (!c) return null;
    const w = 230;
    let x = j * slot + slot + 6;
    if (x + w > ancho) x = j * slot - w - 6;
    const filas = valoresDe(c, modo, series).filter((s) => s.valor > 0).reverse();
    return (
      <div className="graf-tip" role="status" style={{ left: x, top: 0, width: w }}>
        <span className="cap" style={{ fontWeight: 600 }}>
          {capitalizar(mesLargo(c.mesKey))}{c.tipo === 'en_curso' ? ' · en curso' : c.tipo === 'comprometido' ? ' · comprometido' : ''}
        </span>
        <span className="rnd" style={{ fontSize: 20, fontWeight: 700 }}>{pesos(c.total)}</span>
        {filas.map((s) => (
          <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span aria-hidden="true" style={{ width: 12, height: 2, borderRadius: 1, background: s.color, flexShrink: 0 }} />
            <strong style={{ fontWeight: 600 }}>{pesos(s.valor)}</strong>
            <span style={{ color: 'var(--label2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</span>
          </span>
        ))}
        {c.usdAparte > 0 && <span className="cap">+ {dolares(c.usdAparte)} aparte</span>}
        {c.usdExcluido > 0 && <span className="cap">{dolares(c.usdExcluido)} en cuotas o consumos sin cotización: no incluidos</span>}
      </div>
    );
  })();

  const etiquetaY = (v) => (v === 0 ? '0' : corto(v));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Seg ariaLabel="Agrupar por" valor={modo} onCambio={onModo} opciones={[{ id: 'tarjeta', label: 'Por tarjeta' }, { id: 'tipo', label: 'Por tipo' }]} />
        <Seg ariaLabel="Vista" valor={vista} onCambio={(v) => { setHover(null); onVista?.(v); }} opciones={[{ id: 'grafico', label: 'Gráfico' }, { id: 'tabla', label: 'Tabla' }]} />
      </div>

      {vista === 'tabla' ? (
        <Tabla columnas={todas} />
      ) : (
        <>
          <Leyenda items={items} tope={tope} />
          <div ref={refPlot} style={{ overflowX: 'auto', overflowY: 'visible', paddingTop: 18 }}>
            <div
              style={{ position: 'relative', height: t.plotH + t.pie, marginLeft: t.eje, width: ancho }}
              onMouseLeave={() => setHover(null)}
            >
              {ticks.map((v) => (
                <React.Fragment key={v}>
                  <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: t.plotH - Y(v), height: 0.5, background: 'var(--sep)' }} />
                  <span className="cap" aria-hidden="true" style={{ position: 'absolute', left: -t.eje, width: t.eje - 10, textAlign: 'right', top: t.plotH - Y(v) - 8 }}>{etiquetaY(v)}</span>
                </React.Fragment>
              ))}

              {nFut > 0 && (
                <>
                  <div aria-hidden="true" style={{ position: 'absolute', left: jFut * slot - 2, width: nFut * slot + 4, top: -14, bottom: 0, borderRadius: 14, background: 'var(--fill2)' }} />
                  {!compacto && <span className="cap" aria-hidden="true" style={{ position: 'absolute', left: jFut * slot + 12, top: -12, fontWeight: 600 }}>Ya comprometido</span>}
                </>
              )}
              {jCurso > 0 && (
                <>
                  <div aria-hidden="true" style={{ position: 'absolute', left: jCurso * slot - 1, top: -14, height: t.plotH + 14, width: 1.5, background: 'var(--label)', opacity: 0.7 }} />
                  {!compacto && <span className="cap" aria-hidden="true" style={{ position: 'absolute', left: jCurso * slot + 6, top: -12, fontWeight: 700, color: 'var(--label)' }}>Hoy</span>}
                </>
              )}

              {columnas.map((c, j) => {
                const vals = valoresDe(c, modo, series).filter((s) => s.valor > 0);
                // Compacto: sin etiqueta en el último pagado (se pisaría con la del mes en curso).
                const conEtiqueta = (!compacto && j === jUltPagado) || j === jCurso || j === jFut;
                const i = idx(j);
                const nuevoAnio = c.label === 'ene' || j === 0;
                return (
                  <button
                    key={c.mesKey}
                    type="button"
                    className={`graf-col ${seleccion === i ? 'on' : ''}`}
                    style={{ left: j * slot, width: slot, height: t.plotH + t.pie }}
                    aria-label={`${capitalizar(mesLargo(c.mesKey))}, ${ESTADO[c.tipo].toLowerCase()}: ${pesos(c.total)}`}
                    aria-pressed={seleccion === i}
                    onClick={() => onSeleccion?.(i)}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  >
                    <div className={`graf-pila ${c.tipo === 'en_curso' ? 'rayado' : ''}`} style={{ bottom: t.pie, width: t.col }}>
                      {vals.map((s, k) => (
                        <div key={s.id} style={{ height: Math.max(1, Y(s.valor) - (k ? 2 : 0)), background: s.color }} />
                      ))}
                    </div>
                    {conEtiqueta && c.total > 0 && (
                      <span aria-hidden="true" style={{ position: 'absolute', left: -8, right: -8, textAlign: 'center', bottom: t.pie + Y(c.total) + 6, fontSize: compacto ? 10 : 12, fontWeight: 700, color: 'var(--label)' }}>
                        {corto(c.total)}
                      </span>
                    )}
                    <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, textAlign: 'center', fontSize: compacto ? 10 : 12, color: 'var(--label2)', fontWeight: c.tipo === 'en_curso' ? 700 : 500, whiteSpace: 'nowrap' }}>
                      {compacto ? c.label.charAt(0).toUpperCase() : c.label}
                      {!compacto && nuevoAnio && <span style={{ fontSize: 10, opacity: 0.8 }}>{c.anioCorto}</span>}
                    </span>
                  </button>
                );
              })}

              {tope > 0 && (
                <>
                  <div aria-hidden="true" className="spr" style={{ position: 'absolute', left: 0, right: 0, top: t.plotH - Y(tope), borderTop: '1.5px solid var(--label)', opacity: 0.55, pointerEvents: 'none', transition: 'top var(--spring-dur) var(--spring)' }} />
                  <span className="cap" aria-hidden="true" style={{ position: 'absolute', right: 0, top: t.plotH - Y(tope) - 20, fontWeight: 600, color: 'var(--label)', pointerEvents: 'none', transition: 'top var(--spring-dur) var(--spring)' }}>
                    tope {pesos(tope)}
                  </span>
                </>
              )}
              {tooltip}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EvolucionChart;
