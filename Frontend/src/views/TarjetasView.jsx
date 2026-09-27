import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Check, X, ChevronRight, Trash2 } from 'lucide-react';
import PilaWallet from '../ui/PilaWallet.jsx';
import Plastico from '../ui/Plastico.jsx';
import Capsula from '../ui/Capsula.jsx';
import MiniHistorial from '../ui/MiniHistorial.jsx';
import Hoja from '../ui/Hoja.jsx';
import useCompacto, { useMedia } from '../ui/useCompacto.js';
import { identidades, identidadTarjeta, ordenApilado } from '../ui/identidad.js';
import { buscarTarjeta, resumenTodas } from '../services/tarjetas.js';
import { serieDeTarjeta } from '../services/evolucion.js';
import { sumarMeses } from '../services/mes.js';
import { diasEntre, hoyISO } from '../services/consumos/comun.js';
import { pesos, dolares, nombreMes, capitalizar, diaCorto, momento, corto } from '../ui/formato.js';

/**
 * Sección Tarjetas: pila tipo Wallet + detalle de la tarjeta elegida, o la vista
 * "Todas" (cifras, vencimientos del mes y composición por tarjeta).
 * Los números llegan calculados (services/tarjetas.js, services/mes.js).
 */

const ESTADO = { cerrado: 'Cerrado · a pagar', en_curso: 'En curso', pagado: 'Pagado', sin_datos: 'Sin datos' };
const PUNTO = { cerrado: 'var(--warn)', en_curso: 'var(--ok)', pagado: 'var(--label2)', sin_datos: 'var(--label2)' };
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

const panel = { borderRadius: 20, background: 'var(--fill2)' };

const fechaCorta = (iso) => {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d}/${m}`;
};
// 'YYYY-MM-DD' → 'jue 1/10'
const diaConMes = (iso) => (iso ? `${diaCorto(iso)}/${Number(String(iso).slice(5, 7))}` : '—');
const enDias = (iso) => {
  if (!iso) return '';
  const d = diasEntre(hoyISO(), String(iso).slice(0, 10));
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d > 0) return `en ${d} días`;
  return d === -1 ? 'ayer' : `hace ${-d} días`;
};

// Monto grande con centavos chicos. Cifras proporcionales (no tabular-nums).
const MontoGrande = ({ valor, compacto }) => {
  const txt = pesos(valor, { decimales: 2 });
  const i = txt.lastIndexOf(',');
  return (
    <span className="rnd" style={{ fontSize: compacto ? 36 : 44, lineHeight: compacto ? '40px' : '48px', fontWeight: 700, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>
      {txt.slice(0, i)}<span style={{ fontSize: compacto ? 20 : 24, color: 'var(--label2)' }}>{txt.slice(i)}</span>
    </span>
  );
};

const BancoPicker = ({ grupoKey, bancos = [], onAsignar }) => {
  const [valor, setValor] = useState('');
  const guardar = () => valor.trim() && onAsignar?.(grupoKey, valor.trim());
  const listId = `bancos-${String(grupoKey).replace(/[^a-z0-9]/gi, '')}`;
  return (
    <div style={{ ...panel, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>¿De qué banco es esta tarjeta?</span>
      <span className="cap">El archivo de Últimos consumos no lo dice. Lo guardo y no te lo vuelvo a preguntar.</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          list={listId}
          value={valor}
          aria-label="Banco"
          placeholder="Banco"
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
          style={{ flex: '1 1 160px', minHeight: 44, borderRadius: 10, border: 0, background: 'var(--fill)', padding: '0 12px', font: 'inherit', fontSize: 15, color: 'var(--label)' }}
        />
        <datalist id={listId}>{bancos.map((b) => <option key={b} value={b} />)}</datalist>
        <button type="button" className="btn btn-pri" disabled={!valor.trim()} onClick={guardar} style={{ minHeight: 44, opacity: valor.trim() ? 1 : 0.5 }}>Guardar</button>
      </div>
    </div>
  );
};

const ResumenesCargados = ({ resumenes, onBorrar, onCerrar, compacto }) => {
  const [borrando, setBorrando] = useState(null);
  useEffect(() => {
    if (compacto) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compacto, onCerrar]);

  const ordenados = [...resumenes].sort((a, b) => String(b.fecha_cierre || '').localeCompare(String(a.fecha_cierre || '')));
  const lista = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {ordenados.length === 0 && <p className="cap" style={{ margin: '12px 0' }}>No hay resúmenes cargados.</p>}
      {ordenados.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, borderBottom: '0.5px solid var(--sep)' }}>
          <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>{r.tarjeta}</span>
            <span className="cap">
              {r.anio && r.mes ? capitalizar(new Date(r.anio, r.mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(' de ', ' ')) : ''}
              {r.cantidad_movimientos != null ? ` · ${r.cantidad_movimientos} movimientos` : ''}
            </span>
          </span>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{pesos(r.total_a_pagar_pesos || 0)}</span>
          <button
            type="button"
            className="ico"
            aria-label={`Borrar el resumen de ${r.tarjeta}`}
            disabled={borrando === r.id}
            onClick={async () => { setBorrando(r.id); try { await onBorrar(r); } finally { setBorrando(null); } }}
            style={{ color: 'var(--danger)' }}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
  const tituloTxt = `Resúmenes cargados (${resumenes.length})`;
  if (compacto) return <Hoja abierta titulo={tituloTxt} onCerrar={onCerrar}>{lista}</Hoja>;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={onCerrar} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.32)', border: 0 }} />
      <div role="dialog" aria-modal="true" aria-label={tituloTxt} className="vidrio entra" style={{ position: 'relative', width: 'min(640px, 100%)', maxHeight: '80vh', overflowY: 'auto', borderRadius: 28, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{tituloTxt}</h2>
          <button type="button" className="ico" aria-label="Cerrar" onClick={onCerrar} autoFocus><X size={18} aria-hidden="true" /></button>
        </div>
        {lista}
      </div>
    </div>
  );
};

const TarjetasView = ({
  lista = [],
  tarjetas = [],
  elegida = null,
  onElegir,
  composicionPorTarjeta = {},
  mesKey,
  totalMes = 0,
  cuotasProximo = { total: 0, items: [] },
  planes = [],
  movimientos = [],
  consumosLive = [],
  historial = [],
  cotizacion = null,
  nombresTarjetas = {},
  onGuardarNombre,
  onAsignarBanco,
  bancos = [],
  resumenes = [],
  onDeleteResumen,
  onVerMovimientos,
  oscuro = true
}) => {
  const compacto = useCompacto();
  // Ventana web angosta: la pila arriba y el detalle abajo, con los tamaños de web.
  const angosto = useMedia('(max-width: 1180px)');
  const [mostrarResumenes, setMostrarResumenes] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');

  // Identidad: las de la lista (orden de alta) + los grupos sin tarjeta al final.
  const ids = useMemo(() => identidades([
    ...tarjetas,
    ...lista.filter((t) => !t.tarjeta).map((t) => ({ nombre: t.id, banco: t.banco, red: t.red }))
  ]), [tarjetas, lista]);
  const idDe = (id) => ids.get(id) || identidadTarjeta({ nombre: id }, 0);

  const ordenadas = useMemo(() => ordenApilado(lista.map((t) => ({ ...t, nombre: t.nombre, banco: t.banco, tipo: t.red }))).map((x) => lista.find((t) => t.id === x.id)), [lista]);
  const unaSola = ordenadas.length === 1;
  const sel = unaSola ? ordenadas[0] : buscarTarjeta(lista, elegida);

  useEffect(() => { setEditando(false); }, [sel?.id]);

  const nombreDe = (t) => (t.tarjeta && nombresTarjetas[t.tarjeta.id]) || t.nombre;
  const montoPlastico = (t) => (t.estado === 'sin_datos' ? '—' : pesos(t.total));

  const cartas = ordenadas.map((t) => ({
    id: t.id,
    identidad: t.sinBanco ? identidadTarjeta({ nombre: '' }, 0) : idDe(t.id),
    banco: t.sinBanco ? 'Elegí el banco' : (t.banco || nombreDe(t)),
    red: titulo(t.red),
    estado: ESTADO[t.estado],
    monto: montoPlastico(t),
    vence: t.vencimiento ? `vence ${diaCorto(t.vencimiento)}` : '',
    ultimos4: t.ultimos4,
    superCard: t.superCard,
    aria: `${nombreDe(t)}, ${ESTADO[t.estado].toLowerCase()}${t.estado !== 'sin_datos' ? `, ${pesos(t.total)}` : ''}`
  }));
  const todas = resumenTodas(lista);

  // ---------- detalle de la elegida ----------
  const Detalle = sel ? (() => {
    const t = sel;
    const id = idDe(t.id);
    const color = oscuro ? id.chartOscuro : id.chartClaro;
    const comp = composicionPorTarjeta[t.id];
    const pctMes = comp && totalMes > 0 ? Math.round((comp.total / totalMes) * 100) : null;
    const usdPesos = t.totalUsd > 0 && cotizacion?.venta ? t.totalUsd * cotizacion.venta : null;
    const montoLabel = t.estado === 'en_curso' ? 'Va por · estimado' : t.estado === 'cerrado' ? 'A pagar' : t.estado === 'pagado' ? 'Último resumen' : '';
    const estadoSub = t.estado === 'en_curso' && t.actualizado ? `actualizado ${momento(t.actualizado)}`
      : t.estado === 'cerrado' && t.vencimiento ? `vence ${enDias(t.vencimiento)}`
      : t.estado === 'pagado' && t.vencimiento ? `venció el ${fechaCorta(t.vencimiento)}` : 'importá un resumen o Últimos consumos';

    const consumos = (() => {
      if (t.estado === 'en_curso' && t.grupoKeys.length) {
        return consumosLive
          .filter((c) => t.grupoKeys.includes(c.grupo_key) && c.ciclo_cierre === t.cierre && !c.es_pago)
          .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
          .slice(0, 5)
          .map((c, i) => ({ k: c.id || i, n: c.descripcion || 'Consumo', meta: `${fechaCorta(c.fecha)}${c.tarjeta_ult4 ? ` · ·${c.tarjeta_ult4}` : ''}${c.es_cuota ? ' · cuota' : ''}`, usd: !c.monto_pesos && c.monto_dolares, m: c.monto_pesos || c.monto_dolares || 0 }));
      }
      if (!t.resumen) return [];
      return movimientos
        .filter((m) => m.resumen_id === t.resumen.id)
        .sort((a, b) => String(b.fecha_compra || b.fecha || '').localeCompare(String(a.fecha_compra || a.fecha || '')))
        .slice(0, 5)
        .map((m, i) => ({ k: m.id || i, n: m.referencia_limpia || m.referencia_original, meta: fechaCorta(m.fecha_compra || m.fecha) + (m.cuota_texto ? ` · cuota ${m.cuota_texto}` : ''), usd: !m.monto_pesos && m.monto_dolares, m: m.monto_pesos || m.monto_dolares || 0 }));
    })();

    const cuotasT = planes.filter((p) => p.tarjeta === t.id && (p.estado === 'vigente' || p.estado === 'ultima_cuota'));
    const serie = serieDeTarjeta(historial, t.id);
    const totalPlast = t.plasticos.reduce((s, p) => s + p.subtotal, 0);
    const usado = t.limite > 0 && t.disponible != null ? Math.max(0, Math.min(100, ((t.limite - t.disponible) / t.limite) * 100)) : null;

    const celda = (label, valor, sub, extra = null, borde = true) => (
      <div style={{ padding: compacto ? '12px 12px 14px' : '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 2, borderRight: borde ? '0.5px solid var(--sep)' : 'none', minWidth: 0 }}>
        <span className="cap">{label}</span>
        <span style={{ fontSize: compacto ? 15 : 17, fontWeight: 600, whiteSpace: 'nowrap' }}>{valor}</span>
        {sub && <span className="cap">{sub}</span>}
        {extra}
      </div>
    );

    return (
      <div className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        {t.sinBanco && <BancoPicker grupoKey={t.grupoKeys[0]} bancos={bancos} onAsignar={onAsignarBanco} />}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: compacto ? 'flex-start' : 'flex-end', gap: compacto ? 12 : 24, flexDirection: compacto ? 'column' : 'row' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--label2)' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: PUNTO[t.estado] }} />
              {ESTADO[t.estado]} · {estadoSub}
            </span>
            {editando ? (
              <form
                onSubmit={(e) => { e.preventDefault(); if (nombreNuevo.trim()) onGuardarNombre?.(t.tarjeta.id, nombreNuevo.trim()); setEditando(false); }}
                style={{ display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <input
                  autoFocus
                  aria-label="Nombre de la tarjeta"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditando(false); } }}
                  style={{ fontSize: 24, fontWeight: 700, minHeight: 44, borderRadius: 10, border: 0, background: 'var(--fill)', padding: '0 12px', color: 'var(--label)', minWidth: 0, width: compacto ? '100%' : 320 }}
                />
                <button type="submit" className="ico" aria-label="Guardar nombre"><Check size={18} aria-hidden="true" /></button>
                <button type="button" className="ico" aria-label="Cancelar" onClick={() => setEditando(false)}><X size={18} aria-hidden="true" /></button>
              </form>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <h2 className="titulo" style={{ fontSize: compacto ? 28 : 34, lineHeight: compacto ? '34px' : '41px' }}>{nombreDe(t)}</h2>
                {t.tarjeta && (
                  <button type="button" className="ico" aria-label="Cambiar el nombre de la tarjeta" onClick={() => { setNombreNuevo(nombreDe(t)); setEditando(true); }}>
                    <Pencil size={16} aria-hidden="true" style={{ opacity: 0.6 }} />
                  </button>
                )}
              </span>
            )}
          </div>
          {t.estado !== 'sin_datos' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: compacto ? 'flex-start' : 'flex-end', gap: 2 }}>
              <span className="cap" style={{ fontSize: 13 }}>{montoLabel}</span>
              <MontoGrande valor={t.total} compacto={compacto} />
              {t.totalUsd > 0 && (
                <span className="rnd" style={{ fontSize: 16, fontWeight: 600, color: 'var(--label2)' }}>
                  + {dolares(t.totalUsd)}{usdPesos ? ` (≈ ${pesos(usdPesos)} al dólar tarjeta)` : ''}
                </span>
              )}
              {t.proximoCiclo && (
                <span className="cap" style={{ fontSize: 13 }}>y ya van {pesos(t.proximoCiclo.total)} del próximo ciclo</span>
              )}
            </div>
          )}
        </div>

        <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span className="cap" style={{ fontWeight: 600, color: 'var(--label)' }}>Esta tarjeta en {nombreMes(mesKey)}</span>
            {pctMes !== null && <span className="cap">{pctMes} % del mes · {pesos(comp.total)}</span>}
          </div>
          {comp ? (
            <>
              <Capsula
                alto={14}
                escala={comp.total}
                ariaLabel={`Cuotas ${pesos(comp.cuotas)}, fijos ${pesos(comp.fijos)}, variables ${pesos(comp.variables)}`}
                segmentos={[
                  { valor: comp.cuotas, color: 'var(--r1)', label: 'Cuotas' },
                  { valor: comp.fijos, color: 'var(--r2)', label: 'Fijos' },
                  { valor: comp.variables, color: 'var(--r3)', label: 'Variables' }
                ]}
              />
              <div className="cap" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <span>Cuotas <strong style={{ color: 'var(--label)' }}>{pesos(comp.cuotas)}</strong></span>
                <span>Fijos <strong style={{ color: 'var(--label)' }}>{pesos(comp.fijos)}</strong></span>
                <span>Variables <strong style={{ color: 'var(--label)' }}>{pesos(comp.variables)}</strong></span>
              </div>
            </>
          ) : (
            <span className="cap">No hay nada de esta tarjeta que se pague en {nombreMes(mesKey)}.</span>
          )}
        </div>

        <div style={{ ...panel, overflow: 'hidden' }}>
          {t.plasticos.length > 0 && (
            <div style={{ padding: '14px 20px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {t.plasticos.length > 1 && (
                <div aria-hidden="true" style={{ display: 'flex', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  {t.plasticos.map((p, i) => (
                    <span key={p.ult4} className="spr" style={{ width: `${totalPlast > 0 ? (p.subtotal / totalPlast) * 100 : 0}%`, background: color, opacity: i === 0 ? 1 : 0.45 }} />
                  ))}
                </div>
              )}
              {t.plasticos.map((p, i) => {
                const pct = totalPlast > 0 ? Math.round((p.subtotal / totalPlast) * 100) : 0;
                const punto = <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: color, opacity: i === 0 ? 1 : 0.45, flexShrink: 0 }} />;
                if (compacto) {
                  return (
                    <div key={p.ult4} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0', borderBottom: '0.5px solid var(--sep)', fontSize: 15 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {punto}
                        <span style={{ fontWeight: 600, flexGrow: 1 }}>Plástico ·{p.ult4}</span>
                        <span style={{ fontWeight: 600 }}>{pesos(p.subtotal)}</span>
                      </span>
                      <span className="cap" style={{ paddingLeft: 20 }}>
                        {p.n} {p.n === 1 ? 'consumo' : 'consumos'} · {pct} % · 1 pago {pesos(p.unPago)} · cuotas {pesos(p.cuotas)}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={p.ult4} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, fontSize: 15, borderBottom: '0.5px solid var(--sep)' }}>
                    {punto}
                    <span style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>Plástico ·{p.ult4}</span>
                      <span className="cap">{p.n} {p.n === 1 ? 'consumo' : 'consumos'} · {pct} % del total</span>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 130 }}><span className="cap">En 1 pago</span><span>{pesos(p.unPago)}</span></span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 120 }}><span className="cap">En cuotas</span><span>{pesos(p.cuotas)}</span></span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 130 }}><span className="cap">Subtotal</span><span style={{ fontWeight: 600 }}>{pesos(p.subtotal)}</span></span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            {celda('Cierre', diaConMes(t.cierre), t.cierre ? enDias(t.cierre) : null)}
            {celda('Vencimiento', diaConMes(t.vencimiento), t.vencimiento ? enDias(t.vencimiento) : null)}
            {celda(
              compacto ? 'Disponible' : 'Disponible / límite',
              t.limite > 0
                ? (compacto ? corto(t.disponible || 0) : <>{corto(t.disponible || 0)} <span style={{ fontWeight: 400, color: 'var(--label2)', fontSize: 15 }}>/ {corto(t.limite)}</span></>)
                : '—',
              t.limite > 0 ? (compacto ? `de ${corto(t.limite)}` : null) : 'Sale de Últimos consumos',
              usado !== null ? (
                <span aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--fill)', overflow: 'hidden', marginTop: 4 }}>
                  <span style={{ display: 'block', height: 4, width: `${usado}%`, background: color }} />
                </span>
              ) : null,
              false
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: 28 }}>
          <section style={{ display: 'flex', flexDirection: 'column' }} aria-label="Últimos consumos de esta tarjeta">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="h3">{t.estado === 'en_curso' ? 'Últimos consumos' : 'Último resumen'}</h3>
              <button type="button" onClick={() => onVerMovimientos?.(t)} style={{ fontSize: 14, color: 'var(--label2)', minHeight: 44, padding: '0 4px', borderRadius: 8 }}>Ver todos</button>
            </div>
            {consumos.length === 0 && <span className="cap">Sin consumos para mostrar.</span>}
            {consumos.map((c) => (
              <div key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderBottom: '0.5px solid var(--sep)', fontSize: 14 }}>
                <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.n}</span>
                  <span className="cap">{c.meta}</span>
                </span>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{c.usd ? dolares(c.m) : pesos(c.m, { decimales: 2 })}</span>
              </div>
            ))}
          </section>
          <section style={{ display: 'flex', flexDirection: 'column' }} aria-label="Cuotas en esta tarjeta">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
              <h3 className="h3">Cuotas en esta tarjeta</h3>
              <span className="cap">{cuotasT.length} {cuotasT.length === 1 ? 'plan' : 'planes'}</span>
            </div>
            {cuotasT.length === 0 && <span className="cap">No tiene cuotas en curso.</span>}
            {cuotasT.map((q, i) => {
              const cuota = q.monto_cuota_pesos || 0;
              const restan = cuota * (q.total_cuotas - q.cuotas_pagadas);
              return (
                <div key={`${q.id || q.descripcion}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderBottom: '0.5px solid var(--sep)', fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.descripcion}</span>
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{cuota ? pesos(cuota) : dolares(q.monto_cuota_dolares)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span aria-hidden="true" style={{ flexGrow: 1, height: 6, borderRadius: 3, background: 'var(--fill)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: 6, width: `${(q.cuotas_pagadas / q.total_cuotas) * 100}%`, background: color, borderRadius: 3 }} />
                    </span>
                    <span className="cap" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {q.cuotas_pagadas} de {q.total_cuotas}{restan > 0 ? ` · restan ${pesos(restan)}` : ' · última'}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        {serie.some((v) => v.total > 0) && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }} aria-label="Historial y proyección de la tarjeta">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <h3 className="h3">Historial y proyección</h3>
              <span className="cap">pagado · en curso · ya comprometido</span>
            </div>
            <MiniHistorial valores={serie} color={color} compacto={compacto} ariaLabel={`Historial de ${nombreDe(t)}`} />
          </section>
        )}
      </div>
    );
  })() : null;

  // ---------- Todas ----------
  const vtos = lista
    .filter((t) => t.vencimiento && t.vencimiento.slice(0, 7) === mesKey && (t.estado === 'cerrado' || t.estado === 'en_curso'))
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const compLista = ordenadas.filter((t) => composicionPorTarjeta[t.id]);
  const maxComp = Math.max(1, ...compLista.map((t) => composicionPorTarjeta[t.id].total));
  const cifra = (label, valor, sub) => (
    <div style={{ ...panel, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span className="cap" style={{ fontSize: 13 }}>{label}</span>
      <span className="rnd" style={{ fontSize: compacto ? 20 : 23, fontWeight: 700, letterSpacing: '-.015em', whiteSpace: 'nowrap' }}>{valor}</span>
      {sub && <span className="cap">{sub}</span>}
    </div>
  );
  const mesSig = mesKey ? nombreMes(sumarMeses(mesKey, 1)) : '';

  const Todas = (
    <div className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label2)' }}>{lista.length} {lista.length === 1 ? 'tarjeta' : 'tarjetas'} · {todas.plasticos} {todas.plasticos === 1 ? 'plástico' : 'plásticos'}</span>
        <h2 className="titulo" style={{ fontSize: compacto ? 28 : 34 }}>Todas las tarjetas</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compacto ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 14 }}>
        {cifra('En curso', pesos(todas.enCurso), `${todas.nEnCurso} ${todas.nEnCurso === 1 ? 'tarjeta sin cerrar' : 'tarjetas sin cerrar'}`)}
        {cifra('Cerrado, a pagar', pesos(todas.cerrado), todas.cerradas.length === 1 ? `${todas.cerradas[0].banco || todas.cerradas[0].nombre} · vence ${diaCorto(todas.cerradas[0].vencimiento)}` : `${todas.cerradas.length} resúmenes`)}
        {cifra(`Cuotas en ${mesSig}`, pesos(cuotasProximo.total), `${cuotasProximo.items.length} ${cuotasProximo.items.length === 1 ? 'plan sigue' : 'planes siguen'}`)}
        {cifra('Disponible total', todas.disponible !== null ? `$ ${corto(todas.disponible)}` : '—', todas.limite !== null ? `de $ ${corto(todas.limite)} de límite` : 'Sale de Últimos consumos')}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column' }} aria-label={`Vencimientos de ${nombreMes(mesKey)}`}>
        <h3 className="h3" style={{ paddingBottom: 6 }}>Vencimientos de {nombreMes(mesKey)}</h3>
        {vtos.length === 0 && <span className="cap">No hay vencimientos con datos este mes.</span>}
        {vtos.map((t) => (
          <button key={t.id} type="button" className="fila" onClick={() => onElegir?.(t.id)} aria-label={`Abrir ${nombreDe(t)}`} style={{ minHeight: 56, borderRadius: 0, padding: '0 8px', borderBottom: '0.5px solid var(--sep)', color: 'var(--label)', textAlign: 'left', width: '100%' }}>
            <span aria-hidden="true" style={{ width: 30, height: 19, borderRadius: 4, background: (t.sinBanco ? identidadTarjeta({ nombre: '' }, 0) : idDe(t.id)).plastico, flexShrink: 0 }} />
            <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{nombreDe(t)}</span>
              <span className="cap">{t.estado === 'cerrado' ? 'cerrado' : 'en curso'} · vence {diaCorto(t.vencimiento)}</span>
            </span>
            <span className="rnd" style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap' }}>{pesos(t.total)}</span>
            <ChevronRight size={14} aria-hidden="true" style={{ opacity: 0.45 }} />
          </button>
        ))}
      </section>

      {compLista.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="Composición por tarjeta">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 4, gap: 12, flexWrap: 'wrap' }}>
            <h3 className="h3">Composición por tarjeta</h3>
            <span className="cap" style={{ display: 'flex', gap: 14 }}>
              {[['var(--r1)', 'Cuotas'], ['var(--r2)', 'Fijos'], ['var(--r3)', 'Variables']].map(([c, n]) => (
                <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{n}</span>
              ))}
            </span>
          </div>
          {compLista.map((t) => {
            const c = composicionPorTarjeta[t.id];
            const w = (v) => `${(v / maxComp) * 100}%`;
            return (
              <button
                key={t.id}
                type="button"
                className="fila"
                onClick={() => onElegir?.(t.id)}
                aria-label={`${nombreDe(t)}: ${pesos(c.total)}. Cuotas ${pesos(c.cuotas)}, fijos ${pesos(c.fijos)}, variables ${pesos(c.variables)}`}
                style={{ display: 'grid', gridTemplateColumns: compacto ? 'minmax(0,1fr) 100px' : '200px 1fr 110px', alignItems: 'center', gap: compacto ? 8 : 16, minHeight: 44, padding: '6px 8px', borderRadius: 10, color: 'var(--label)', textAlign: 'left', width: '100%' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, minWidth: 0 }}>
                  <span className="chip-plastico" aria-hidden="true" style={{ background: idDe(t.id).plastico }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreDe(t)}</span>
                </span>
                <span aria-hidden="true" style={{ display: 'flex', gap: 2, height: 12, gridColumn: compacto ? '1 / -1' : 'auto', gridRow: compacto ? 2 : 'auto' }}>
                  <span className="spr" style={{ width: w(c.cuotas), background: 'var(--r1)', borderRadius: '6px 0 0 6px' }} />
                  <span className="spr" style={{ width: w(c.fijos), background: 'var(--r2)' }} />
                  <span className="spr" style={{ width: w(c.variables), background: 'var(--r3)', borderRadius: '0 6px 6px 0' }} />
                </span>
                <span className="rnd" style={{ textAlign: 'right', fontSize: 15, fontWeight: 600 }}>{pesos(c.total)}</span>
              </button>
            );
          })}
        </section>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="cap" style={{ fontSize: 15, margin: 0 }}>Elegí una tarjeta de la pila para ver sus plásticos, consumos y cuotas.</p>
        <button type="button" className="btn" onClick={() => setMostrarResumenes(true)} style={{ minHeight: 44 }}>
          {resumenes.length} {resumenes.length === 1 ? 'resumen cargado' : 'resúmenes cargados'}
        </button>
      </div>
    </div>
  );

  if (!lista.length) {
    return (
      <section className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 17, color: 'var(--label2)' }}>Todavía no hay tarjetas. Importá un resumen o Últimos consumos y aparecen acá.</p>
      </section>
    );
  }

  const botonTodas = !unaSola && (
    <button
      type="button"
      onClick={() => onElegir?.(null)}
      aria-pressed={!sel}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, padding: '0 18px', borderRadius: 18, background: sel ? 'var(--fill2)' : 'var(--fill)', color: 'var(--label)', width: compacto ? '100%' : 400, maxWidth: '100%' }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Todas las tarjetas</span>
        <span className="cap">{lista.length} tarjetas · {todas.plasticos} plásticos</span>
      </span>
      <span className="rnd" style={{ fontSize: 17, fontWeight: 600 }}>{pesos(totalMes)}</span>
    </button>
  );

  const pila = unaSola ? (
    <Plastico {...cartas[0]} compacto={compacto} />
  ) : (
    <PilaWallet tarjetas={cartas} elegida={sel?.id || null} onElegir={onElegir} compacto={compacto} oscuro={oscuro} />
  );

  const listaResumenes = mostrarResumenes && (
    <ResumenesCargados
      resumenes={resumenes}
      compacto={compacto}
      onCerrar={() => setMostrarResumenes(false)}
      onBorrar={async (r) => {
        if (!window.confirm(`¿Eliminar el resumen de ${r.tarjeta} y todos sus movimientos?`)) return;
        await onDeleteResumen?.(r);
      }}
    />
  );

  if (compacto) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {botonTodas}
        {pila}
        {sel ? Detalle : Todas}
        {listaResumenes}
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gridTemplateColumns: angosto ? 'minmax(0,1fr)' : '400px minmax(0,1fr)', gap: angosto ? 28 : 52, alignItems: 'start' }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {botonTodas}
        {pila}
      </div>
      <div style={{ minWidth: 0 }}>{sel ? Detalle : Todas}</div>
      {listaResumenes}
    </section>
  );
};

export default TarjetasView;
