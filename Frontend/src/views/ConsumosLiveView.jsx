import React, { useState } from 'react';
import { Search, Trash2, Upload, Eye, EyeOff, Clock, Zap } from 'lucide-react';
import { pesos, dolares, corto } from '../ui/formato.js';

/**
 * Últimos consumos: el detalle de lo importado del home banking (se llega desde el
 * menú Más). La importación se hace en Importar. Misma lógica que la vista vieja:
 * dedup contra el último cierre, filtros, totales, gasto por día y por categoría.
 * Sin recharts: barras propias con divs.
 */

const COLORES_CATEGORIA = {
  Marketplace: '#8b5cf6',
  Suscripciones: '#06b6d4',
  Viajes: '#f59e0b',
  Supermercado: '#10b981',
  'Servicios/Impuestos': '#ef4444',
  Hogar: '#ec4899',
  Gastronomia: '#f97316',
  Salud: '#14b8a6',
  Otros: '#64748b'
};

function normalizarFechaResumen(f) {
  if (!f) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  const m = String(f).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

const campo = { minHeight: 44, borderRadius: 12, border: 0, background: 'var(--fill)', padding: '0 12px', font: 'inherit', fontSize: 15, color: 'var(--label)' };

const ConsumosLiveView = ({ consumosLive = [], resumenes = [], onDeleteConsumos, onIrAImportar }) => {
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTarjeta, setFiltroTarjeta] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [ocultarOficializados, setOcultarOficializados] = useState(true);

  // Fecha de cierre del último resumen por tarjeta (dedup por período), por últimos 4.
  const cierrePorTarjeta = {};
  resumenes.forEach((r) => {
    const ult4 = (r.tarjeta || '').match(/(\d{4})/)?.[1];
    if (!ult4 || !r.fecha_cierre) return;
    const fechaIso = normalizarFechaResumen(r.fecha_cierre);
    if (!fechaIso) return;
    if (!cierrePorTarjeta[ult4] || fechaIso > cierrePorTarjeta[ult4]) cierrePorTarjeta[ult4] = fechaIso;
  });

  const visibles = consumosLive.filter((c) => {
    if (ocultarOficializados) {
      const cierre = cierrePorTarjeta[c.tarjeta_ult4];
      if (cierre && c.fecha && c.fecha <= cierre) return false;
    }
    if (filtroTarjeta && c.tarjeta !== filtroTarjeta) return false;
    if (filtroCategoria && c.categoria !== filtroCategoria) return false;
    if (filtroTexto && !(c.descripcion || '').toLowerCase().includes(filtroTexto.toLowerCase())) return false;
    return true;
  });

  const consumosGasto = visibles.filter((c) => !c.es_pago);
  const totalGastado = consumosGasto.reduce((s, c) => s + (c.monto_pesos > 0 ? c.monto_pesos : 0), 0);
  const totalDevoluciones = consumosGasto.reduce((s, c) => s + (c.monto_pesos < 0 ? c.monto_pesos : 0), 0);
  const totalDolares = consumosGasto.reduce((s, c) => s + (c.monto_dolares > 0 ? c.monto_dolares : 0), 0);
  const cantConsumos = consumosGasto.filter((c) => c.monto_pesos > 0 || c.monto_dolares > 0).length;

  const ult4Presentes = [...new Set(consumosGasto.map((c) => c.tarjeta_ult4))];
  let totalResumenRef = 0;
  ult4Presentes.forEach((ult4) => {
    const r = resumenes.filter((x) => (x.tarjeta || '').includes(ult4)).sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes))[0];
    if (r) totalResumenRef += r.total_consumos_pesos || 0;
  });
  const pctVsResumen = totalResumenRef > 0 ? Math.round((totalGastado / totalResumenRef) * 100) : null;

  const porDia = {};
  consumosGasto.forEach((c) => { if (c.fecha && c.monto_pesos > 0) porDia[c.fecha] = (porDia[c.fecha] || 0) + c.monto_pesos; });
  const dias = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b));
  const maxDia = Math.max(1, ...dias.map(([, v]) => v));

  const porCategoria = {};
  consumosGasto.forEach((c) => { if (c.monto_pesos > 0) { const k = c.categoria || 'Otros'; porCategoria[k] = (porCategoria[k] || 0) + c.monto_pesos; } });
  const categorias = Object.entries(porCategoria).sort(([, a], [, b]) => b - a);
  const maxCat = Math.max(1, ...categorias.map(([, v]) => v));

  const tarjetasUnicas = [...new Set(consumosLive.map((c) => c.tarjeta))].filter(Boolean);
  const categoriasUnicas = [...new Set(consumosLive.filter((c) => !c.es_pago).map((c) => c.categoria))].filter(Boolean);

  const cifra = (label, valor) => (
    <div style={{ background: 'var(--fill2)', borderRadius: 20, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span className="cap" style={{ fontSize: 13 }}>{label}</span>
      <span className="rnd" style={{ fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap' }}>{valor}</span>
    </div>
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 17, color: 'var(--label2)' }}>Gasto en curso antes del cierre del resumen.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {consumosLive.length > 0 && (
            <button type="button" className="btn" style={{ minHeight: 44 }}
              onClick={() => { if (window.confirm('¿Limpiar todos los consumos importados?')) onDeleteConsumos?.(); }}>
              <Trash2 size={16} aria-hidden="true" /> Limpiar
            </button>
          )}
          <button type="button" className="btn btn-pri" style={{ minHeight: 44 }} onClick={() => onIrAImportar?.()}>
            <Upload size={16} aria-hidden="true" /> Importar
          </button>
        </div>
      </div>

      {consumosLive.length === 0 ? (
        <div style={{ padding: 40, borderRadius: 24, background: 'var(--fill2)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Zap size={36} aria-hidden="true" style={{ color: 'var(--label2)' }} />
          <p style={{ margin: 0, fontSize: 15, color: 'var(--label2)', maxWidth: 440 }}>Todavía no importaste consumos. Subí el Excel de "Últimos consumos" de tu banco desde Importar.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 14 }}>
            {cifra('Total gastado', pesos(totalGastado, { decimales: 2 }))}
            {cifra('Consumido en dólares', dolares(totalDolares))}
            {pctVsResumen != null ? cifra('vs. último cierre', `${pctVsResumen} %`) : cifra('Devoluciones', pesos(Math.abs(totalDevoluciones)))}
            {cifra('Consumos', cantConsumos)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 14 }}>
            {dias.length > 0 && (
              <section aria-label="Gasto por día" style={{ background: 'var(--fill2)', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 className="h3">Gasto por día</h2>
                <div role="img" aria-label={dias.map(([f, v]) => `${f.slice(8)}/${f.slice(5, 7)}: ${pesos(v)}`).join(', ')}
                  style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, overflowX: 'auto' }}>
                  {dias.map(([f, v]) => (
                    <div key={f} aria-hidden="true" title={`${f}: ${pesos(v)}`} style={{ flex: '1 0 10px', maxWidth: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ width: '100%', height: `${(v / maxDia) * 130}px`, borderRadius: '4px 4px 0 0', background: 'var(--r2)' }} />
                      <span style={{ fontSize: 9, color: 'var(--label2)' }}>{f.slice(8)}</span>
                    </div>
                  ))}
                </div>
                <span className="cap">Máximo en un día: {pesos(maxDia)}</span>
              </section>
            )}
            {categorias.length > 0 && (
              <section aria-label="Gasto por categoría" style={{ background: 'var(--fill2)', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h2 className="h3">Gasto por categoría</h2>
                {categorias.map(([nombre, v]) => (
                  <div key={nombre} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,140px) 1fr 80px', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: COLORES_CATEGORIA[nombre] || '#64748b', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                    </span>
                    <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--track)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: 8, width: `${(v / maxCat) * 100}%`, background: COLORES_CATEGORIA[nombre] || '#64748b', borderRadius: 4 }} />
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{corto(v)}</span>
                  </div>
                ))}
              </section>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ ...campo, display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px', color: 'var(--label2)' }}>
              <Search size={16} aria-hidden="true" />
              <input aria-label="Buscar comercio" placeholder="Buscar comercio" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)}
                style={{ border: 0, background: 'none', outline: 'none', font: 'inherit', color: 'var(--label)', width: '100%' }} />
            </label>
            <select aria-label="Tarjeta" value={filtroTarjeta} onChange={(e) => setFiltroTarjeta(e.target.value)} style={campo}>
              <option value="">Todas las tarjetas</option>
              {tarjetasUnicas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select aria-label="Categoría" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={campo}>
              <option value="">Todas las categorías</option>
              {categoriasUnicas.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" className={`pchip ${ocultarOficializados ? 'on' : ''}`} aria-pressed={ocultarOficializados}
              onClick={() => setOcultarOficializados((v) => !v)} style={{ minHeight: 44 }}
              title="Oculta los consumos previos al cierre del último resumen importado">
              {ocultarOficializados ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              Ocultar ya facturados
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibles.length === 0 ? (
              <p className="cap" style={{ fontSize: 15, textAlign: 'center', padding: 24 }}>No hay consumos con estos filtros.</p>
            ) : (
              [...visibles].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '6px 8px', borderBottom: '0.5px solid var(--sep)' }}>
                  <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, color: c.es_pago ? 'var(--label2)' : 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descripcion || '(sin descripción)'}</span>
                      {c.es_cuota && <span className="tag cuota">{c.cuota_actual}/{c.total_cuotas}</span>}
                      {c.es_pendiente && <span className="tag revisar" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} aria-hidden="true" /> Pendiente</span>}
                    </span>
                    <span className="cap">{c.fecha} · {c.tarjeta} · {c.es_pago ? 'Pago/devolución' : c.categoria}</span>
                  </span>
                  <span className="rnd" style={{ fontWeight: 600, whiteSpace: 'nowrap', color: c.monto_pesos < 0 || c.monto_dolares < 0 ? 'var(--ok)' : 'var(--label)' }}>
                    {c.monto_dolares > 0 ? dolares(c.monto_dolares) : pesos(c.monto_pesos, { decimales: 2 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default ConsumosLiveView;
