import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronRight, X, CheckCircle } from 'lucide-react';
import Seg from '../ui/Seg.jsx';
import Hoja from '../ui/Hoja.jsx';
import FilaMovimiento from '../ui/FilaMovimiento.jsx';
import DetalleMovimiento from '../ui/DetalleMovimiento.jsx';
import useCompacto, { useMedia } from '../ui/useCompacto.js';
import { identidades, identidadTarjeta } from '../ui/identidad.js';
import { pesos, dolares, mesCorto, mesLargo, capitalizar } from '../ui/formato.js';
import {
  filtrarMovimientos, mesesDisponibles, ordenarResumenes, agruparPorDia, separarCuotas,
  composicionPeriodo, historialComercio, tipoDeFila, planDeMovimiento, mesKeyDeFecha
} from '../services/movimientos-vista.js';

/**
 * Movimientos: lista por día con filtros en una fila y un panel de detalle
 * (hoja en celular). La lógica de filtrado vive en services/movimientos-vista.js.
 */

const TIPOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'variables', label: 'Variables' },
  { id: 'fijos', label: 'Fijos' },
  { id: 'cuotas', label: 'Cuotas' },
  { id: 'reintegros', label: 'Reintegros' },
  { id: 'usd', label: 'En dólares' }
];
const DESDE_TIPO_VIEJO = { fijo: 'fijos', variable: 'variables' };

const modoGuardado = () => {
  try { return localStorage.getItem('movimientos_modo_filtro') === 'resumen' ? 'resumen' : 'mes'; } catch { return 'mes'; }
};

const MovimientosView = ({
  movimientos = [],
  tarjetas = [],
  resumenes = [],
  reintegros = [],
  periodoRecienteLabel = null,
  gastosFijos = new Set(),
  planes = [],
  preguntas = [],
  busqueda = '',
  onBuscar,
  onEditarDescripcion,
  onCambiarTipo,
  onVerPlan,
  filtro = null, // { tarjeta?, tipo?, n } — entrada desde otras vistas
  filtroTipoGastoInicial = '',
  nombresTarjetas = {},
  oscuro = true
}) => {
  const compacto = useCompacto();
  const angosto = useMedia('(max-width: 1100px)');
  const usarHoja = compacto || angosto;

  const [modo, setModo] = useState(modoGuardado);
  const [periodo, setPeriodo] = useState(null);
  const [resumenId, setResumenId] = useState(null);
  const [tipo, setTipo] = useState(DESDE_TIPO_VIEJO[filtroTipoGastoInicial] || 'todos');
  const [tarjeta, setTarjeta] = useState('');
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [cuotasAbiertas, setCuotasAbiertas] = useState(false);
  const [selId, setSelId] = useState(null);
  const [hoja, setHoja] = useState(false);
  const [aviso, setAviso] = useState(null);
  const filasRef = useRef(new Map());

  const meses = useMemo(() => mesesDisponibles(movimientos), [movimientos]);
  const resOrdenados = useMemo(() => ordenarResumenes(resumenes), [resumenes]);

  // Por defecto, como la vista vieja: el mes o el resumen más reciente.
  const mesActivo = meses.includes(periodo) ? periodo : meses[0] || null;
  const resumenActivo = resOrdenados.find((r) => r.id === resumenId) || resOrdenados[0] || null;
  const modoEfectivo = modo === 'resumen' && resOrdenados.length ? 'resumen' : 'mes';

  const cambiarModo = (m) => {
    setModo(m);
    try { localStorage.setItem('movimientos_modo_filtro', m); } catch { /* sin storage */ }
  };

  // Entrada desde otras vistas (Tarjetas "Ver todos", Mes, etc.).
  useEffect(() => {
    if (!filtro?.n) return;
    if (filtro.tarjeta) {
      setTarjeta(filtro.tarjeta);
      const ultimo = resOrdenados.find((r) => r.tarjeta === filtro.tarjeta);
      if (ultimo) { cambiarModo('resumen'); setResumenId(ultimo.id); }
    }
    if (filtro.tipo) setTipo(filtro.tipo);
  }, [filtro?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (DESDE_TIPO_VIEJO[filtroTipoGastoInicial]) setTipo(DESDE_TIPO_VIEJO[filtroTipoGastoInicial]);
  }, [filtroTipoGastoInicial]);

  const ids = useMemo(() => identidades(tarjetas), [tarjetas]);
  const idDe = (nombre) => ids.get(nombre) || identidadTarjeta({ nombre }, 0);
  const colorDe = (nombre) => { const i = idDe(nombre); return oscuro ? i.chartOscuro : i.chartClaro; };
  const tarjetaInfo = (nombre) => tarjetas.find((t) => t.nombre === nombre);
  const nombreTarjeta = (nombre) => { const t = tarjetaInfo(nombre); return (t && nombresTarjetas[t.id]) || nombre; };

  // ---------- filtrado (memoizado) ----------
  const base = useMemo(() => ({
    modo: modoEfectivo, periodo: mesActivo, resumenId: resumenActivo?.id, texto: busqueda, tarjeta, fijos: gastosFijos
  }), [modoEfectivo, mesActivo, resumenActivo?.id, busqueda, tarjeta, gastosFijos]);
  const delPeriodo = useMemo(() => filtrarMovimientos(movimientos, { ...base, texto: '', tipo: 'todos' }), [movimientos, base]);
  const filtrados = useMemo(
    () => filtrarMovimientos(movimientos, { ...base, tipo, reintegros, verAnteriores }),
    [movimientos, base, tipo, reintegros, verAnteriores]
  );
  const comp = useMemo(() => composicionPeriodo(delPeriodo, gastosFijos), [delPeriodo, gastosFijos]);

  const plegarCuotas = tipo !== 'cuotas' && tipo !== 'reintegros';
  const { cuotas, resto } = useMemo(
    () => (plegarCuotas ? separarCuotas(filtrados) : { cuotas: [], resto: filtrados }),
    [filtrados, plegarCuotas]
  );
  const dias = useMemo(() => agruparPorDia(resto), [resto]);
  const visibles = useMemo(() => [...(cuotasAbiertas ? cuotas : []), ...dias.flatMap((d) => d.filas)], [cuotas, cuotasAbiertas, dias]);

  // Selección: ninguna por defecto. Si el filtro deja afuera a la elegida, se limpia.
  const sel = visibles.find((m) => m.id === selId) || null;

  const elegir = (m) => {
    // En web, tocar otra vez la fila elegida la deselecciona.
    if (!usarHoja && selId === m.id) { setSelId(null); return; }
    setSelId(m.id);
    if (usarHoja) setHoja(true);
  };

  // Esc deselecciona en web (en celular lo maneja la Hoja).
  useEffect(() => {
    if (usarHoja || !selId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [usarHoja, selId]);

  // Panel vacío: lo más gastado del período por comercio (sin cuotas ni reintegros).
  const topComercios = useMemo(() => {
    const acc = new Map();
    resto.forEach((m) => {
      const t = tipoDeFila(m, gastosFijos);
      const ars = Number(m.monto_pesos) || 0;
      if (t === 'reintegro' || t === 'cuota' || ars <= 0) return;
      const nombre = m.referencia_limpia || m.referencia_original || 'Sin descripción';
      const x = acc.get(nombre) || { nombre, total: 0, n: 0, primero: m, tarjeta: m.tarjeta };
      x.total += ars; x.n += 1;
      if (ars > (Number(x.primero.monto_pesos) || 0)) x.primero = m;
      acc.set(nombre, x);
    });
    return [...acc.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [resto, gastosFijos]);
  const cerrarHoja = () => {
    setHoja(false);
    const el = sel && filasRef.current.get(sel.id);
    if (el) setTimeout(() => el.focus(), 0); // el foco vuelve a la fila
  };

  // Aviso de regla creada (3,2 s).
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 3200);
    return () => clearTimeout(t);
  }, [aviso]);

  const editarNombre = async (mov, nombre) => {
    await onEditarDescripcion?.(mov, nombre);
    setAviso(`Regla creada: «${mov.referencia_original}» se va a mostrar como «${nombre}».`);
  };

  const hayFiltros = !!busqueda || tipo !== 'todos' || !!tarjeta;
  const quitarFiltros = () => { onBuscar?.(''); setTipo('todos'); setTarjeta(''); setVerAnteriores(false); };

  // ---------- encabezado ----------
  const subPeriodo = tipo === 'reintegros'
    ? (verAnteriores ? 'Todos los reintegros' : `Último resumen de cada tarjeta${periodoRecienteLabel ? ` · ${periodoRecienteLabel}` : ''}`)
    : modoEfectivo === 'resumen' && resumenActivo
      ? `${nombreTarjeta(resumenActivo.tarjeta)} · resumen de ${mesLargo(mesKeyDeFecha(resumenActivo.fecha_cierre) || `${resumenActivo.anio}-${String(resumenActivo.mes).padStart(2, '0')}`)}`
      : mesActivo ? capitalizar(mesLargo(mesActivo)) : 'Sin movimientos';

  const labelResumen = (r) => {
    const mk = mesKeyDeFecha(r.fecha_cierre) || (r.anio && r.mes ? `${r.anio}-${String(r.mes).padStart(2, '0')}` : null);
    const t = tarjetaInfo(r.tarjeta);
    return `${t?.banco || nombreTarjeta(r.tarjeta)} ${mk ? `${mesCorto(mk)} '${mk.slice(2, 4)}` : ''}`.trim();
  };

  const Fichas = tipo === 'reintegros' ? null : (
    <div className="fichas" role="group" aria-label={modoEfectivo === 'resumen' ? 'Resumen' : 'Mes'}>
      {modoEfectivo === 'resumen'
        ? resOrdenados.map((r) => (
          <button key={r.id} type="button" className={`pchip ${r.id === resumenActivo?.id ? 'on' : ''}`} aria-pressed={r.id === resumenActivo?.id} onClick={() => setResumenId(r.id)}>
            <span className="chip-plastico" aria-hidden="true" style={{ width: 18, height: 12, background: idDe(r.tarjeta).plastico }} />
            {labelResumen(r)}
          </button>
        ))
        : meses.map((mk) => (
          <button key={mk} type="button" className={`pchip ${mk === mesActivo ? 'on' : ''}`} aria-pressed={mk === mesActivo} onClick={() => setPeriodo(mk)}>
            {capitalizar(mesCorto(mk))} '{mk.slice(2, 4)}
          </button>
        ))}
    </div>
  );

  const totalReint = filtrados.reduce((s, m) => s + Math.abs(Number(m.monto_pesos) || 0), 0);
  const totalReintUsd = filtrados.reduce((s, m) => s + Math.abs(Number(m.monto_dolares) || 0), 0);
  const nAnteriores = reintegros.filter((r) => !r.es_reciente).length;

  const Totales = tipo === 'reintegros' ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="rnd" style={{ fontSize: compacto ? 28 : 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ok)' }}>
          − {pesos(totalReint, { decimales: 2 })}{totalReintUsd > 0 ? <span style={{ fontSize: 18 }}> · − {dolares(totalReintUsd)}</span> : null}
        </span>
        <span className="cap" style={{ fontSize: 13 }}>{filtrados.length} {filtrados.length === 1 ? 'reintegro' : 'reintegros'}</span>
      </div>
      {nAnteriores > 0 && (
        <button type="button" className="btn" onClick={() => setVerAnteriores((v) => !v)} style={{ minHeight: 44 }}>
          {verAnteriores ? 'Ver solo el último resumen' : `Ver anteriores (${nAnteriores})`}
        </button>
      )}
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="rnd" style={{ fontSize: compacto ? 28 : 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>
          {pesos(comp.total, { decimales: 2 })}
          {comp.totalUsd > 0 && <span style={{ fontSize: 18, color: 'var(--label2)' }}> + {dolares(comp.totalUsd)}</span>}
        </span>
        <span className="cap" style={{ fontSize: 13 }}>
          {delPeriodo.length} {delPeriodo.length === 1 ? 'movimiento' : 'movimientos'}
          {filtrados.length !== delPeriodo.length ? ` · ${filtrados.length} con los filtros` : ''}
        </span>
      </div>
      {(comp.variables + comp.fijos + comp.cuotas) > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: compacto ? '100%' : 360 }}>
          <div aria-hidden="true" style={{ display: 'flex', gap: 2, height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--track)' }}>
            {[['variables', 'var(--r3)'], ['fijos', 'var(--r2)'], ['cuotas', 'var(--r1)']].map(([k, c]) => (
              <span key={k} className="spr" style={{ width: `${(comp[k] / (comp.variables + comp.fijos + comp.cuotas)) * 100}%`, background: c }} />
            ))}
          </div>
          <div className="cap" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>Variables <strong style={{ color: 'var(--label)' }}>{pesos(comp.variables)}</strong></span>
            <span>Fijos <strong style={{ color: 'var(--label)' }}>{pesos(comp.fijos)}</strong></span>
            <span>Cuotas <strong style={{ color: 'var(--label)' }}>{pesos(comp.cuotas)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );

  const Filtros = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: compacto ? 'nowrap' : 'wrap', flexDirection: compacto ? 'column' : 'row' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--fill)', color: 'var(--label2)', width: compacto ? '100%' : 260, boxSizing: 'border-box' }}>
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Buscar comercio"
          placeholder="Buscar comercio"
          value={busqueda}
          onChange={(e) => onBuscar?.(e.target.value)}
          style={{ border: 0, background: 'none', outline: 'none', font: 'inherit', fontSize: 15, color: 'var(--label)', width: '100%' }}
        />
      </label>
      <div className="fichas" role="group" aria-label="Tipo" style={{ width: compacto ? '100%' : 'auto' }}>
        {TIPOS.map((t) => (
          <button key={t.id} type="button" className={`pchip ${tipo === t.id ? 'on' : ''}`} aria-pressed={tipo === t.id} onClick={() => setTipo(t.id)}>{t.label}</button>
        ))}
        {tarjeta && (
          <button type="button" className="pchip on" onClick={() => setTarjeta('')} aria-label={`Quitar el filtro de ${nombreTarjeta(tarjeta)}`}>
            <span className="chip-plastico" aria-hidden="true" style={{ width: 18, height: 12, background: idDe(tarjeta).plastico }} />
            {nombreTarjeta(tarjeta)} <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );

  const fila = (m) => (
    <FilaMovimiento
      key={m.id}
      ref={(el) => { if (el) filasRef.current.set(m.id, el); else filasRef.current.delete(m.id); }}
      mov={m}
      nombre={m.referencia_limpia || m.referencia_original || 'Sin descripción'}
      tipo={tipoDeFila(m, gastosFijos)}
      plastico={idDe(m.tarjeta).plastico}
      seleccionado={!usarHoja && sel?.id === m.id}
      onClick={() => elegir(m)}
      compacto={compacto}
    />
  );

  const totalCuotas = cuotas.reduce((s, m) => s + (Number(m.monto_pesos) || 0), 0);
  const Lista = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {cuotas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            type="button"
            onClick={() => setCuotasAbiertas((v) => !v)}
            aria-expanded={cuotasAbiertas}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '0 12px', borderRadius: 10, color: 'var(--label)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 className="h3">Cuotas del período</h3>
              <span className="cap">{cuotas.length}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="rnd" style={{ fontSize: 15, fontWeight: 600 }}>{pesos(totalCuotas)}</span>
              <ChevronRight size={12} aria-hidden="true" className="spr" style={{ transform: `rotate(${cuotasAbiertas ? 90 : 0}deg)` }} />
            </span>
          </button>
          {cuotasAbiertas && <div className="entra" style={{ display: 'flex', flexDirection: 'column' }}>{cuotas.map(fila)}</div>}
        </div>
      )}
      {dias.map((d) => (
        <section key={d.fecha || 'sin-fecha'} aria-label={d.label} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 12px 4px', borderBottom: '0.5px solid var(--sep)' }}>
            <h3 className="h3">{d.label}</h3>
            <span className="cap">{pesos(d.total)}{d.totalUsd ? ` + ${dolares(d.totalUsd)}` : ''}</span>
          </div>
          {d.filas.map(fila)}
        </section>
      ))}
      {filtrados.length === 0 && (
        <div style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {hayFiltros ? (
            <>
              <span style={{ fontSize: 17, fontWeight: 600 }}>No hay resultados con estos filtros</span>
              <span className="cap" style={{ fontSize: 14, maxWidth: 420 }}>Probá con otro nombre o quitá los filtros para ver todo el período.</span>
              <button type="button" className="btn" onClick={quitarFiltros} style={{ marginTop: 6, minHeight: 44 }}>Quitar filtros</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 17, fontWeight: 600 }}>No hay movimientos en este período</span>
              <span className="cap" style={{ fontSize: 14, maxWidth: 420 }}>Importá un resumen o elegí otro período.</span>
            </>
          )}
        </div>
      )}
    </div>
  );

  const detalle = sel ? (
    <DetalleMovimiento
      mov={sel}
      nombreTarjeta={nombreTarjeta(sel.tarjeta)}
      identidad={idDe(sel.tarjeta)}
      color={colorDe(sel.tarjeta)}
      tipo={tipoDeFila(sel, gastosFijos)}
      historial={historialComercio(movimientos, sel, resumenes)}
      plan={planDeMovimiento(sel, planes)}
      pregunta={preguntas.find((p) => p.candidato?.mov_id === sel.id || p.ultimo?.mov_id === sel.id) || null}
      onCambiarTipo={onCambiarTipo}
      onEditarDescripcion={editarNombre}
      onVerPlan={onVerPlan}
    />
  ) : null;

  const Encabezado = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: compacto ? 'stretch' : 'flex-end', gap: compacto ? 12 : 20, flexDirection: compacto ? 'column' : 'row' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label2)' }}>{subPeriodo}</span>
        <h1 className="titulo">Movimientos</h1>
      </div>
      {tipo !== 'reintegros' && (
        <Seg
          ariaLabel="Agrupar por"
          valor={modoEfectivo}
          onCambio={cambiarModo}
          opciones={[{ id: 'mes', label: 'Por mes' }, { id: 'resumen', label: 'Por resumen' }]}
        />
      )}
    </div>
  );

  // En un portal: por encima de la barra y del riel.
  const avisoFlotante = aviso && createPortal(
    <div className="aviso-flotante vidrio entra" role="status">
      <CheckCircle size={18} aria-hidden="true" style={{ color: 'var(--ok)', flexShrink: 0 }} />
      {aviso}
    </div>,
    document.body
  );

  const columna = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      {Encabezado}
      {Fichas}
      {Totales}
      {Filtros}
      {Lista}
    </div>
  );

  if (usarHoja) {
    return (
      <section className="entra">
        {columna}
        <Hoja abierta={hoja && !!sel} onCerrar={cerrarHoja} titulo="Detalle del movimiento">{detalle}</Hoja>
        {avisoFlotante}
      </section>
    );
  }

  return (
    <section className="entra" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 36, alignItems: 'start' }}>
      {columna}
      {/* El panel queda fijo mientras la lista scrollea y nunca es más alto que la ventana:
          si no entra (pantallas bajas), scrollea por dentro, no con la lista. */}
      <aside aria-label="Detalle del movimiento" className="panel-detalle" style={{ position: 'sticky', top: 0, borderRadius: 24, background: 'var(--fill2)', padding: 20, maxHeight: 'calc(100dvh - 96px - 40px - 70px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}>
        {detalle || (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>Ningún movimiento elegido</span>
              <span className="cap" style={{ fontSize: 13 }}>Tocá uno de la lista para ver su detalle, cambiarle el nombre o marcarlo como fijo.</span>
            </div>
            {topComercios.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 className="h3" style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, letterSpacing: '.01em', color: 'var(--label2)', textTransform: 'uppercase' }}>Lo más gastado en este período</h3>
                {topComercios.map((c) => (
                  <button key={c.nombre} type="button" className="fila" onClick={() => elegir(c.primero)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, width: '100%', padding: '0 8px', borderRadius: 10, textAlign: 'left' }}>
                    <span aria-hidden="true" style={{ width: 22, height: 14, borderRadius: 3.5, background: idDe(c.tarjeta).plastico, flexShrink: 0 }} />
                    <span style={{ flexGrow: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14 }}>{c.nombre}</span>
                    <span className="cap" style={{ flexShrink: 0 }}>{c.n > 1 ? `${c.n} veces` : ''}</span>
                    <span className="rnd" style={{ fontWeight: 600, fontSize: 14, flexShrink: 0 }}>{pesos(c.total)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
      {avisoFlotante}
    </section>
  );
};

export default MovimientosView;
