import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import { pesos, mesLargo, diaCorto, capitalizar } from '../../../ui/formato.js';
import { movimientosEntre, mesesConDatos, actualizarMovimiento, categorias as cargarCategorias, guardarRegla, aplicarReglaExistentes, crearCategoria } from '../../cuentas/repo.js';
import { sugerirAlcance } from '../../puente/tarjeteando.js';
import { categoriasVisibles, nombreOcupado } from '../../cuentas/categorias.js';
import { rangoMes, moverMes } from '../../cuentas/resumen.js';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import '../modulos.css';

const hoyMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Movimientos del mes elegido + categorías. Arranca en el último mes con datos. */
export function useMovimientosMes() {
  const [mes, setMes] = useState(null);
  const [movs, setMovs] = useState([]);
  const [cats, setCats] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const pedido = useRef(0);

  useEffect(() => {
    let vivo = true;
    Promise.all([mesesConDatos(), cargarCategorias()])
      .then(([ultima, c]) => { if (!vivo) return; setCats(c); setMes(ultima ? ultima.slice(0, 7) : hoyMes()); })
      .catch(() => { if (vivo) { setMes(hoyMes()); setError('No se pudieron leer tus movimientos.'); } });
    return () => { vivo = false; };
  }, []);

  const recargar = useCallback(async () => {
    if (!mes) return;
    const id = ++pedido.current; // si cambiás de mes rápido, gana el último pedido
    setCargando(true); setError(null);
    try {
      const { desde, hasta } = rangoMes(mes);
      const filas = await movimientosEntre(desde, hasta);
      if (id === pedido.current) setMovs(filas);
    } catch { if (id === pedido.current) setError('No se pudieron leer tus movimientos. Revisá tu conexión.'); }
    finally { if (id === pedido.current) setCargando(false); }
  }, [mes]);

  useEffect(() => { recargar(); }, [recargar]);
  const recargarCats = useCallback(async () => { try { setCats(await cargarCategorias()); } catch { /* sin red */ } }, []);
  return { mes, setMes, movs, cats, cargando, error, recargar, recargarCats };
}

export const SelectorMes = ({ mes, onCambio }) => (
  <div className="mod-mes" role="group" aria-label="Mes">
    <button type="button" className="ico" aria-label="Mes anterior" onClick={() => onCambio(moverMes(mes, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
    <span aria-live="polite">{capitalizar(mesLargo(mes))}</span>
    <button type="button" className="ico" aria-label="Mes siguiente" onClick={() => onCambio(moverMes(mes, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
  </div>
);

export const Cifra = ({ label, valor, fuerte, nota }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
    <span style={{ fontSize: 13, color: 'var(--label2)' }}>{label}</span>
    <span className="mod-cifra" style={{ fontSize: fuerte ? 34 : 20, lineHeight: fuerte ? '40px' : '26px', fontWeight: fuerte ? 700 : 600, letterSpacing: '-.02em' }}>{valor}</span>
    {nota && <span style={{ fontSize: 12, color: 'var(--label2)' }}>{nota}</span>}
  </div>
);

/** Totales por categoría. Tocá una para ver sus movimientos (y abrir cualquiera para editarlo). */
export const PorCategoria = ({ filas, total, titulo, onAbrir }) => {
  const [abiertas, setAbiertas] = useState(() => new Set());
  if (!filas.length) return null;
  const alternar = (k) => setAbiertas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <section aria-label={titulo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="h3" style={{ margin: 0 }}>{titulo}</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filas.map((f) => {
          const on = abiertas.has(f.categoria);
          const id = `cat-${f.categoria.replace(/\W+/g, '-')}`;
          return (
            <li key={f.categoria} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" onClick={() => alternar(f.categoria)} aria-expanded={on} aria-controls={id}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minHeight: 44, padding: '6px 0', background: 'transparent', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 15, width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ChevronRight size={16} aria-hidden="true" style={{ transform: on ? 'rotate(90deg)' : 'none', transition: 'transform .2s', color: 'var(--label2)' }} />
                    {f.categoria} <span style={{ color: 'var(--label2)', fontSize: 13 }}>· {f.cantidad}</span>
                  </span>
                  <span className="mod-cifra" style={{ fontWeight: 600 }}>{pesos(f.total)}</span>
                </span>
                <span className="mod-barra" aria-hidden="true" style={{ width: '100%' }}><i style={{ transform: `scaleX(${total ? Math.max(0.02, Math.min(1, f.total / total)) : 0})` }} /></span>
              </button>
              {on && (
                <ul id={id} aria-label={`Movimientos de ${f.categoria}`} style={{ listStyle: 'none', margin: '0 0 6px', padding: '0 0 0 12px', display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '2px solid var(--sep)' }}>
                  {[...(f.movs || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).map((m) => (onAbrir
                    ? <FilaMov key={m.id} m={m} onAbrir={onAbrir} />
                    : <li key={m.id} style={{ fontSize: 14 }}>{diaCorto(m.fecha)} · {m.descripcion} · {pesos(m.monto)}</li>))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const iconoTipo = (m) => (m.tipo === 'transferencia_interna' || m.tipo === 'reserva' ? Repeat : m.direccion === 'entrada' ? ArrowDownLeft : ArrowUpRight);

export const FilaMov = ({ m, onAbrir }) => {
  const Icono = iconoTipo(m);
  return (
    <li>
      <button type="button" className="mod-mov" onClick={() => onAbrir(m)} aria-label={`${m.descripcion}, ${pesos(m.monto)}, ${diaCorto(m.fecha)}. Editar`}>
        <span className="mod-tesela" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11 }}><Icono size={17} /></span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.descripcion}</span>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>
            {diaCorto(m.fecha)} · {m.tipo === 'recupero' ? `Recupero${m.compartido_pendiente ? ' · compartido sin asignar' : ''}${m.vinculo_tarjeta || m.recupero_pago === 'tarjeta' ? ' · tarjeta' : m.recupero_pago === 'no_se' ? ' · sin saber cómo se pagó' : m.categoria ? ` · ${m.categoria}` : ''}` : (m.categoria || (m.tipo === 'transferencia_interna' ? 'Entre mis cuentas' : m.tipo === 'reserva' ? 'Reserva' : 'Sin categoría'))} · {m.cuenta?.nombre || ''}
          </span>
        </span>
        {m.estado === 'revisar' && <span className="mod-chip">Revisar</span>}
        <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{m.direccion === 'entrada' ? '+' : '−'}{pesos(m.monto).replace('−', '')}</span>
      </button>
    </li>
  );
};

export const ListaMovs = ({ movs, onAbrir, titulo, vacio }) => (
  <section aria-label={titulo} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <h2 className="h3" style={{ margin: 0 }}>{titulo}</h2>
    {movs.length
      ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>{movs.map((m) => <FilaMov key={m.id} m={m} onAbrir={onAbrir} />)}</ul>
      : <p style={{ margin: 0, fontSize: 15, color: 'var(--label2)' }}>{vacio}</p>}
  </section>
);

export const AvisoRevisar = ({ cantidad, texto, onVer }) => (cantidad ? (
  <div className="mod-aviso" role="status">
    <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
    <span style={{ flex: 1 }}>{texto}</span>
    {onVer && <button type="button" className="btn" onClick={onVer} style={{ minHeight: 44 }}>Revisar</button>}
  </div>
) : null);

const TIPOS = [
  { id: 'gasto', label: 'Gasto' },
  { id: 'ingreso', label: 'Ingreso' },
  { id: 'recupero', label: 'Recupero' },
  { id: 'transferencia_interna', label: 'Entre mis cuentas' }
];

const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** Elegir la compra con tarjeta (de Tarjeteando) que este recupero devuelve. */
const ElegirCompra = ({ compras, monto, elegida, onElegir }) => {
  const [q, setQ] = useState('');
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtradas = t ? compras.filter((c) => c.descripcion.toLowerCase().includes(t) || c.tarjeta.toLowerCase().includes(t)) : compras;
    // Sin búsqueda: primero las de monto parecido (total o cuota) y más recientes.
    const dist = (c) => Math.min(Math.abs(c.monto - monto), c.cuotas ? Math.abs(c.cuotas.total_compra - monto) : Infinity);
    return (t ? filtradas : [...filtradas].sort((a, b) => dist(a) - dist(b))).slice(0, 12);
  }, [compras, q, monto]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--label2)' }}>
        ¿De qué compra con tarjeta?
        <input className="mod-campo" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercio o tarjeta" />
      </label>
      <ul aria-label="Compras con tarjeta" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
        {lista.map((c) => {
          const on = elegida?.clave === c.clave;
          return (
            <li key={c.clave}>
              <button type="button" aria-pressed={on} className="mod-mov" onClick={() => onElegir(c)} style={on ? { background: 'var(--fill)' } : undefined}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.descripcion}</span>
                  <span style={{ fontSize: 13, color: 'var(--label2)' }}>
                    {fechaCorta(c.fecha)} · {c.tarjeta}{c.cuotas ? ` · ${c.cuotas.total} cuotas de ${pesos(c.cuotas.monto_cuota)}` : ''}
                  </span>
                </span>
                <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{c.moneda === 'USD' ? `U$S ${c.monto}` : pesos(c.cuotas ? c.cuotas.total_compra : c.monto)}</span>
              </button>
            </li>
          );
        })}
        {!lista.length && <li style={{ fontSize: 14, color: 'var(--label2)', padding: 8 }}>No hay compras que coincidan en este dispositivo.</li>}
      </ul>
    </div>
  );
};

/** Hoja para confirmar o corregir un movimiento: tipo, categoría, activo/pasivo y, si es recupero, a qué compra corresponde. */
export const EditarMov = ({ mov, cats, compras = [], onCerrar, onGuardado, onCategoriaCreada }) => {
  const [tipo, setTipo] = useState(mov?.tipo);
  const [catId, setCatId] = useState(mov?.categoria_id || '');
  const [naturaleza, setNaturaleza] = useState(mov?.naturaleza || 'activo');
  // Cómo se pagó el gasto que te devuelven: 'con' (tarjeta) | 'sin' | 'nose'.
  const pagoDe = (m) => (m?.vinculo_tarjeta || m?.recupero_pago === 'tarjeta' ? 'con' : m?.recupero_pago === 'no_se' ? 'nose' : 'sin');
  const [pago, setPago] = useState(pagoDe(mov));
  const conTarjeta = pago === 'con';
  const [compartido, setCompartido] = useState(!!mov?.compartido_pendiente);
  const [compra, setCompra] = useState(null);
  const [alcance, setAlcance] = useState('total');
  const [cuotaNro, setCuotaNro] = useState(1);
  const [siempre, setSiempre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [nueva, setNueva] = useState(null); // nombre de la categoría que estás creando (null = no)
  const [creadas, setCreadas] = useState([]); // recién creadas, hasta que vuelvan las categorías
  useEffect(() => {
    setTipo(mov?.tipo); setCatId(mov?.categoria_id || ''); setNaturaleza(mov?.naturaleza || 'activo');
    setPago(pagoDe(mov)); setSiempre(false); setError(null); setNueva(null); setCompartido(!!mov?.compartido_pendiente);
    const v = mov?.vinculo_tarjeta;
    setCompra(v ? compras.find((c) => c.clave === v.clave) || { ...v, id: v.mov_id, monto: v.monto_compra, cuotas: v.cuotas || null } : null);
    setAlcance(v?.alcance || 'total'); setCuotaNro(v?.cuota_numero || 1);
  }, [mov, compras]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mov) return null;
  const editable = ['gasto', 'ingreso', 'transferencia_interna', 'recupero'].includes(mov.tipo);
  const tipos = TIPOS.filter((t) => t.id !== 'recupero' || mov.direccion === 'entrada');
  const tipoCat = tipo === 'ingreso' ? 'ingreso' : 'gasto';
  const todasCats = [...cats, ...creadas.filter((c) => !cats.some((x) => x.id === c.id))];
  const opciones = categoriasVisibles(todasCats, tipoCat);
  const crear = async () => {
    const n = (nueva || '').trim();
    if (!n) { setError('Poné un nombre para la categoría.'); return; }
    if (nombreOcupado(n, tipoCat, todasCats)) { setError(`Ya existe una categoría "${n}".`); return; }
    setError(null);
    try {
      const { id } = await crearCategoria(n, tipoCat);
      setCreadas((l) => [...l, { id, nombre: n, tipo: tipoCat, user_id: 'yo', reemplaza: null }]);
      setCatId(id); setNueva(null);
      onCategoriaCreada?.();
    } catch { setError('No se pudo crear la categoría. Revisá tu conexión.'); }
  };
  const quien = mov.contraparte || '';

  const elegirCompra = (c) => {
    setCompra(c);
    const a = sugerirAlcance(mov.monto, c);
    setAlcance(a);
    setCuotaNro(c.cuotas ? c.cuotas.actual : 1);
  };

  const guardar = async () => {
    setGuardando(true); setError(null);
    const cambios = { estado: 'confirmado' };
    if (editable) {
      cambios.tipo = tipo;
      cambios.modulo = tipo === 'ingreso' ? 'platita' : 'billetera';
      cambios.cuenta_en_presupuesto = tipo !== 'transferencia_interna';
      cambios.categoria_id = tipo === 'transferencia_interna' || (tipo === 'recupero' && conTarjeta) ? null : (catId || null);
      cambios.naturaleza = tipo === 'ingreso' ? naturaleza : null;
      cambios.recupero_pago = tipo === 'recupero' ? ({ con: 'tarjeta', sin: 'sin_tarjeta', nose: 'no_se' }[pago]) : null;
      cambios.compartido_pendiente = tipo === 'recupero' && compartido;
      cambios.vinculo_tarjeta = tipo === 'recupero' && conTarjeta && compra ? {
        clave: compra.clave, mov_id: compra.id, tarjeta: compra.tarjeta, descripcion: compra.descripcion, fecha: compra.fecha,
        moneda: compra.moneda, monto_compra: compra.cuotas ? compra.cuotas.total_compra : compra.monto,
        cuotas: compra.cuotas || null,
        alcance: compra.cuotas ? alcance : 'total',
        cuota_numero: compra.cuotas && alcance === 'cuota' ? Number(cuotaNro) : null
      } : null;
    }
    try {
      await actualizarMovimiento(mov.id, cambios);
      if (siempre && quien && editable && !(tipo === 'recupero' && conTarjeta)) {
        const regla = { contraparte: quien, direccion: mov.direccion, tipo, categoria_id: cambios.categoria_id };
        await guardarRegla(regla);
        await aplicarReglaExistentes(regla);
      }
      onGuardado?.(); onCerrar();
    } catch { setError('No se pudo guardar. Revisá tu conexión.'); }
    finally { setGuardando(false); }
  };

  return (
    <Hoja abierta={!!mov} onCerrar={onCerrar} titulo="Movimiento">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="h3">{diaCorto(mov.fecha)} · {mov.cuenta?.nombre}</span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>{mov.descripcion}</h2>
          <span className="mod-cifra" style={{ fontSize: 28, fontWeight: 700 }}>{mov.direccion === 'entrada' ? '+' : '−'}{pesos(mov.monto, { decimales: 2 }).replace('−', '')}</span>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>{mov.descripcion_original}</span>
        </div>
        {editable ? (
          <>
            <Seg opciones={tipos} valor={tipo} onCambio={(t) => { if (t !== tipo) { setTipo(t); setCatId(''); } }} ariaLabel="Tipo de movimiento" />
            {tipo === 'recupero' && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>
                Plata que te devuelven de un gasto que pagaste vos (un asado dividido, una compra que hiciste por alguien). No es ingreso: descuenta el gasto.
              </p>
            )}
            {tipo !== 'transferencia_interna' && !(tipo === 'recupero' && conTarjeta) && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--label2)' }}>
                {tipo === 'recupero' ? 'Categoría del gasto que te devuelven' : 'Categoría'}
                <select className="mod-select" value={nueva !== null ? '__nueva__' : catId}
                  onChange={(e) => { if (e.target.value === '__nueva__') setNueva(''); else { setNueva(null); setCatId(e.target.value); } }}>
                  <option value="">Sin categoría</option>
                  {opciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  <option value="__nueva__">+ Nueva categoría…</option>
                </select>
              </label>
            )}
            {nueva !== null && tipo !== 'transferencia_interna' && !(tipo === 'recupero' && conTarjeta) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="mod-campo" autoFocus aria-label="Nombre de la nueva categoría" placeholder="Nombre de la categoría" value={nueva}
                  onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }} />
                <button type="button" className="btn" onClick={() => setNueva(null)} style={{ minHeight: 44 }}>Cancelar</button>
                <button type="button" className="btn btn-pri" onClick={crear} style={{ minHeight: 44, borderRadius: 22, padding: '0 16px' }}>Crear</button>
              </div>
            )}
            {tipo === 'recupero' && (
              <>
                {/* Tres opciones largas: en lista (en el celular no entran en un control segmentado). */}
                <div role="radiogroup" aria-label="¿Cómo pagaste el gasto?" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 3, borderRadius: 12, background: 'var(--fill)' }}>
                  {[{ id: 'con', label: 'Lo pagué con tarjeta' }, { id: 'sin', label: 'NO lo pagué con tarjeta' }, { id: 'nose', label: 'No recuerdo cómo lo pagué' }].map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={pago === o.id} onClick={() => setPago(o.id)}
                      style={{ minHeight: 44, padding: '0 14px', borderRadius: 9, textAlign: 'left', fontSize: 15, fontWeight: pago === o.id ? 600 : 500, color: 'var(--label)',
                        background: pago === o.id ? 'var(--solid)' : 'transparent', boxShadow: pago === o.id ? '0 1px 3px rgba(0,0,0,.14)' : 'none', border: 0, cursor: 'pointer' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, fontSize: 14 }}>
                  <input type="checkbox" checked={compartido} onChange={(e) => setCompartido(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
                  <span>Es de un gasto compartido <span style={{ color: 'var(--label2)' }}>— queda en Compartidos → "Recuperos para asignar" para elegir el grupo y quién te pagó.</span></span>
                </label>
                {pago === 'nose' && <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>No se descuenta de Billetera (pudo ser con tarjeta). En Presupuestos suma igual a lo que te queda.</p>}
                {conTarjeta && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>
                      Vincular a la compra es opcional: si todavía no está en un resumen (ciclo abierto), guardalo igual y vinculalo más adelante.
                    </p>
                    {compra && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14 }}>Vinculado a <strong>{compra.descripcion}</strong>{compra.tarjeta ? ` · ${compra.tarjeta}` : ''}</span>
                        <button type="button" className="btn" onClick={() => setCompra(null)} style={{ minHeight: 44 }}>Quitar vínculo</button>
                      </div>
                    )}
                    {compras.length
                      ? <ElegirCompra compras={compras} monto={mov.monto} elegida={compra} onElegir={elegirCompra} />
                      : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>No hay compras de Tarjeteando en este dispositivo para vincular.</p>}
                  </div>
                )}
                {conTarjeta && compra?.cuotas && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--label2)' }}>Compra en {compra.cuotas.total} cuotas de {pesos(compra.cuotas.monto_cuota)} (total {pesos(compra.cuotas.total_compra)}). ¿Qué te devolvieron?</span>
                    <Seg opciones={[{ id: 'cuota', label: 'Una cuota' }, { id: 'total', label: 'El total' }]} valor={alcance} onCambio={setAlcance} ariaLabel="Alcance del recupero" />
                    {alcance === 'cuota' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                        Cuota
                        <select className="mod-select" value={cuotaNro} onChange={(e) => setCuotaNro(e.target.value)} aria-label="Número de cuota">
                          {Array.from({ length: compra.cuotas.total }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} de {compra.cuotas.total}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </>
            )}
            {tipo === 'ingreso' && (
              <Seg opciones={[{ id: 'activo', label: 'Activo (trabajo)' }, { id: 'pasivo', label: 'Pasivo (rinde solo)' }]} valor={naturaleza} onCambio={setNaturaleza} ariaLabel="Tipo de ingreso" />
            )}
            {tipo === 'transferencia_interna' && <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>No cuenta como ingreso ni como gasto.</p>}
            {quien && !(tipo === 'recupero' && conTarjeta) && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14 }}>
                <input type="checkbox" checked={siempre} onChange={(e) => setSiempre(e.target.checked)} style={{ width: 20, height: 20 }} />
                Siempre que {quien} {mov.direccion === 'entrada' ? 'me transfiera' : 'reciba plata mía'}, tratarlo así
              </label>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>
            {mov.tipo === 'pago_tarjeta' ? 'Pago de tarjeta: ya está contado en Tarjeteando, no se suma acá.' : `Reserva "${mov.bolsillo?.nombre || ''}": plata separada, no es gasto.`}
          </p>
        )}
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar} disabled={guardando} style={{ minHeight: 44 }}>Cancelar</button>
          {(editable || mov.estado === 'revisar') && (
            <button type="button" className="btn btn-pri" disabled={guardando} onClick={guardar} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
              {guardando ? 'Guardando…' : mov.estado === 'revisar' ? 'Confirmar' : 'Guardar'}
            </button>
          )}
        </div>
      </div>
    </Hoja>
  );
};
