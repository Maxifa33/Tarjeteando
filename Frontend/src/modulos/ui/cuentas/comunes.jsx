import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import { pesos, mesLargo, diaCorto, capitalizar } from '../../../ui/formato.js';
import { movimientosEntre, mesesConDatos, actualizarMovimiento, categorias as cargarCategorias, guardarRegla, aplicarReglaExistentes } from '../../cuentas/repo.js';
import { sugerirAlcance } from '../../puente/tarjeteando.js';
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
  return { mes, setMes, movs, cats, cargando, error, recargar };
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

export const PorCategoria = ({ filas, total, titulo }) => {
  if (!filas.length) return null;
  return (
    <section aria-label={titulo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="h3" style={{ margin: 0 }}>{titulo}</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filas.map((f) => (
          <li key={f.categoria} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
              <span>{f.categoria} <span style={{ color: 'var(--label2)', fontSize: 13 }}>· {f.cantidad}</span></span>
              <span className="mod-cifra" style={{ fontWeight: 600 }}>{pesos(f.total)}</span>
            </div>
            <div className="mod-barra" aria-hidden="true"><i style={{ transform: `scaleX(${total ? Math.max(0.02, f.total / total) : 0})` }} /></div>
          </li>
        ))}
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
            {diaCorto(m.fecha)} · {m.tipo === 'recupero' ? `Recupero${m.vinculo_tarjeta ? ' · tarjeta' : m.categoria ? ` · ${m.categoria}` : ''}` : (m.categoria || (m.tipo === 'transferencia_interna' ? 'Entre mis cuentas' : m.tipo === 'reserva' ? 'Reserva' : 'Sin categoría'))} · {m.cuenta?.nombre || ''}
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
export const EditarMov = ({ mov, cats, compras = [], onCerrar, onGuardado }) => {
  const [tipo, setTipo] = useState(mov?.tipo);
  const [catId, setCatId] = useState(mov?.categoria_id || '');
  const [naturaleza, setNaturaleza] = useState(mov?.naturaleza || 'activo');
  const [conTarjeta, setConTarjeta] = useState(!!mov?.vinculo_tarjeta);
  const [compra, setCompra] = useState(null);
  const [alcance, setAlcance] = useState('total');
  const [cuotaNro, setCuotaNro] = useState(1);
  const [siempre, setSiempre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setTipo(mov?.tipo); setCatId(mov?.categoria_id || ''); setNaturaleza(mov?.naturaleza || 'activo');
    setConTarjeta(!!mov?.vinculo_tarjeta); setSiempre(false); setError(null);
    const v = mov?.vinculo_tarjeta;
    setCompra(v ? compras.find((c) => c.clave === v.clave) || { ...v, id: v.mov_id, monto: v.monto_compra, cuotas: v.cuotas || null } : null);
    setAlcance(v?.alcance || 'total'); setCuotaNro(v?.cuota_numero || 1);
  }, [mov, compras]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mov) return null;
  const editable = ['gasto', 'ingreso', 'transferencia_interna', 'recupero'].includes(mov.tipo);
  const tipos = TIPOS.filter((t) => t.id !== 'recupero' || mov.direccion === 'entrada');
  const opciones = cats.filter((c) => c.tipo === (tipo === 'ingreso' ? 'ingreso' : 'gasto'));
  const quien = mov.contraparte || '';

  const elegirCompra = (c) => {
    setCompra(c);
    const a = sugerirAlcance(mov.monto, c);
    setAlcance(a);
    setCuotaNro(c.cuotas ? c.cuotas.actual : 1);
  };

  const guardar = async () => {
    if (tipo === 'recupero' && conTarjeta && !compra) { setError('Elegí la compra con tarjeta, o marcá "Sin tarjeta".'); return; }
    setGuardando(true); setError(null);
    const cambios = { estado: 'confirmado' };
    if (editable) {
      cambios.tipo = tipo;
      cambios.modulo = tipo === 'ingreso' ? 'platita' : 'billetera';
      cambios.cuenta_en_presupuesto = tipo !== 'transferencia_interna';
      cambios.categoria_id = tipo === 'transferencia_interna' || (tipo === 'recupero' && conTarjeta) ? null : (catId || null);
      cambios.naturaleza = tipo === 'ingreso' ? naturaleza : null;
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
                <select className="mod-select" value={catId} onChange={(e) => setCatId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {opciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            )}
            {tipo === 'recupero' && (
              <>
                <Seg opciones={[{ id: 'no', label: 'Lo pagué sin tarjeta' }, { id: 'si', label: 'Lo pagué con tarjeta' }]} valor={conTarjeta ? 'si' : 'no'}
                  onCambio={(v) => setConTarjeta(v === 'si')} ariaLabel="¿Cómo pagaste el gasto?" />
                {conTarjeta && (
                  compras.length
                    ? <ElegirCompra compras={compras} monto={mov.monto} elegida={compra} onElegir={elegirCompra} />
                    : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>No hay compras de Tarjeteando en este dispositivo. Importá tus resúmenes acá para vincularlo.</p>
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
