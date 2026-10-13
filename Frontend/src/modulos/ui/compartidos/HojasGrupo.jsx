import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import { pesos } from '../../../ui/formato.js';
import { parseMonto } from '../../cuentas/util.js';
import { repartir, leerValores, DIVISIONES } from '../../compartidos/compartidos.js';
import { crearGrupo, crearGasto, actualizarGasto, borrarGasto, registrarPago } from '../../compartidos/repo.js';
import { hoyISO, plata, fechaDM } from '../deudas/HojasDeuda.jsx';
import { Campo, DobleToque, Botonera } from '../alcancia/HojasMeta.jsx';
import '../modulos.css';

const Error = ({ texto }) => (texto ? <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{texto}</p> : null);

/** Nuevo grupo o cuenta con una persona. */
export const FormGrupo = ({ abierta, onCerrar, onGuardado }) => {
  const [tipo, setTipo] = useState('grupo');
  const [nombre, setNombre] = useState('');
  const [personas, setPersonas] = useState(['']);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (abierta) { setTipo('grupo'); setNombre(''); setPersonas(['']); setError(null); } }, [abierta]);
  const lista = tipo === 'persona' ? personas.slice(0, 1) : personas;
  const guardar = async () => {
    const nombres = lista.map((x) => x.trim()).filter(Boolean);
    if (!nombres.length) { setError(tipo === 'persona' ? 'Poné el nombre de la persona.' : 'Agregá al menos una persona.'); return; }
    if (new Set(nombres.map((x) => x.toLowerCase())).size !== nombres.length) { setError('Hay nombres repetidos.'); return; }
    if (nombres.some((x) => x.toLowerCase() === 'yo')) { setError('"Yo" ya sos vos: poné el nombre de las otras personas.'); return; }
    const n = tipo === 'persona' ? nombres[0] : nombre.trim();
    if (!n) { setError('Poné un nombre para el grupo.'); return; }
    setOcupado(true); setError(null);
    try { const g = await crearGrupo({ nombre: n, tipo, moneda: 'ARS' }, nombres); onGuardado?.(g); onCerrar(); }
    catch { setError('No se pudo guardar. Revisá tu conexión.'); }
    finally { setOcupado(false); }
  };
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Nuevo compartido">
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <Seg opciones={[{ id: 'grupo', label: 'Grupo' }, { id: 'persona', label: 'Con una persona' }]} valor={tipo} onCambio={setTipo} ariaLabel="Tipo" />
        {tipo === 'grupo' && <Campo label="Nombre del grupo"><input className="mod-campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Viaje a Bariloche, Casa, Fútbol…" /></Campo>}
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, color: 'var(--label2)', marginBottom: 6 }}>{tipo === 'persona' ? '¿Con quién?' : 'Personas (además de vos)'}</legend>
          {lista.map((x, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input className="mod-campo" aria-label={`Persona ${i + 1}`} value={x} onChange={(e) => setPersonas((l) => l.map((y, j) => (j === i ? e.target.value : y)))} placeholder="Nombre y apellido, como figura en las transferencias" />
              {tipo === 'grupo' && lista.length > 1 && <button type="button" className="ico" aria-label={`Quitar persona ${i + 1}`} onClick={() => setPersonas((l) => l.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>}
            </div>
          ))}
          {tipo === 'grupo' && <button type="button" className="btn" onClick={() => setPersonas((l) => [...l, ''])} style={{ minHeight: 44, alignSelf: 'flex-start' }}><Plus size={16} aria-hidden="true" /> Agregar persona</button>}
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Con nombre y apellido, Compartidos reconoce sus transferencias en tus cuentas. Con solo el nombre puede confundir a dos personas: siempre te pide confirmar.</span>
        </fieldset>
        <Error texto={error} />
        <Botonera onCerrar={onCerrar} ocupado={ocupado} texto="Crear" />
      </form>
    </Hoja>
  );
};

const fechaCorta = (iso) => fechaDM(iso);

/** Elegir un gasto propio (Billetera) o una compra con tarjeta (Tarjeteando) para compartir. */
const Origen = ({ movs, compras, usados, onElegir }) => {
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const a = movs.filter((m) => !usados.has(`m:${m.id}`)).map((m) => ({ clave: `m:${m.id}`, desc: m.descripcion, fecha: m.fecha, monto: m.monto, sub: m.cuenta?.nombre || 'Billetera', mov: m }));
    const b = compras.filter((x) => x.moneda !== 'USD' && !usados.has(`t:${x.clave}`)).map((x) => ({ clave: `t:${x.clave}`, desc: x.descripcion, fecha: x.fecha, monto: x.cuotas ? x.cuotas.total_compra : x.monto, sub: `${x.tarjeta}${x.cuotas ? ` · ${x.cuotas.total} cuotas` : ''}`, compra: x }));
    return [...a, ...b].filter((x) => !t || String(x.desc).toLowerCase().includes(t)).sort((x, y) => (x.fecha < y.fecha ? 1 : -1)).slice(0, 15);
  }, [movs, compras, usados, q]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input className="mod-campo" aria-label="Buscar gasto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus gastos y compras con tarjeta" />
      <ul aria-label="Tus gastos" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
        {items.map((x) => (
          <li key={x.clave}>
            <button type="button" className="mod-mov" onClick={() => onElegir(x)}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.desc}</span>
                <span style={{ fontSize: 13, color: 'var(--label2)' }}>{fechaCorta(x.fecha)} · {x.sub}</span>
              </span>
              <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{pesos(x.monto)}</span>
            </button>
          </li>
        ))}
        {!items.length && <li style={{ fontSize: 14, color: 'var(--label2)', padding: 8 }}>No hay gastos para elegir.</li>}
      </ul>
    </div>
  );
};

/** Alta / edición de un gasto compartido. */
export const FormGasto = ({ abierta, grupo, participantes, gasto, movs = [], compras = [], usados = new Set(), onCerrar, onGuardado }) => {
  const yo = participantes.find((p) => p.es_yo);
  const [f, setF] = useState({});
  const [verOrigen, setVerOrigen] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!abierta) return;
    setError(null); setVerOrigen(false);
    if (gasto) {
      const valores = Object.fromEntries(gasto.partes.map((x) => [x.p, gasto.division === 'iguales' ? '' : String(x.valor).replace('.', ',')]));
      setF({ descripcion: gasto.descripcion, monto: String(gasto.monto).replace('.', ','), fecha: gasto.fecha, pagado_por: gasto.pagado_por, division: gasto.division,
        incluidos: gasto.partes.map((x) => x.p), valores, movimiento_id: gasto.movimiento_id, tarjeta: gasto.tarjeta });
    } else {
      setF({ descripcion: '', monto: '', fecha: hoyISO(), pagado_por: yo?.id || participantes[0]?.id, division: 'iguales', incluidos: participantes.map((p) => p.id), valores: {}, movimiento_id: null, tarjeta: null });
    }
  }, [abierta, gasto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!abierta || !f.division) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const monto = parseMonto(f.monto);
  const vista = monto > 0 ? repartir(monto, f.division, leerValores(f.division, f.incluidos, f.valores)) : null;
  const alternar = (id) => setF((x) => ({ ...x, incluidos: x.incluidos.includes(id) ? x.incluidos.filter((y) => y !== id) : [...x.incluidos, id] }));
  const vinculado = f.movimiento_id || f.tarjeta;

  const elegirOrigen = (x) => {
    setF((y) => ({ ...y, descripcion: x.desc, monto: String(x.monto).replace('.', ','), fecha: x.fecha, pagado_por: yo?.id || y.pagado_por,
      movimiento_id: x.mov ? x.mov.id : null,
      tarjeta: x.compra ? { clave: x.compra.clave, tarjeta: x.compra.tarjeta, descripcion: x.compra.descripcion, fecha: x.compra.fecha, monto: x.monto, cuotas: x.compra.cuotas || null } : null }));
    setVerOrigen(false);
  };

  const guardar = async () => {
    if (!f.descripcion.trim()) { setError('Poné qué fue.'); return; }
    if (!(monto > 0)) { setError('Poné el monto.'); return; }
    if (!f.fecha) { setError('Poné la fecha.'); return; }
    const r = repartir(monto, f.division, leerValores(f.division, f.incluidos, f.valores));
    if (r.error) { setError(r.error); return; }
    const fila = { grupo_id: grupo.id, descripcion: f.descripcion.trim(), fecha: f.fecha, monto, pagado_por: f.pagado_por, division: f.division, partes: r.partes, movimiento_id: f.movimiento_id || null, tarjeta: f.tarjeta || null };
    setOcupado(true); setError(null);
    try { await (gasto ? actualizarGasto(gasto.id, fila) : crearGasto(fila)); onGuardado?.(); onCerrar(); }
    catch { setError('No se pudo guardar. Revisá tu conexión.'); }
    finally { setOcupado(false); }
  };

  const etiqueta = { montos: '$', porcentajes: '%', partes: 'partes' }[f.division];
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={gasto ? 'Editar gasto' : `Nuevo gasto · ${grupo.nombre}`}>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        {!gasto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="btn" aria-expanded={verOrigen} style={{ minHeight: 44, alignSelf: 'flex-start' }}
              onClick={() => {
                if (verOrigen || vinculado) { setVerOrigen(false); setF((x) => ({ ...x, movimiento_id: null, tarjeta: null })); } // a mano = sin vínculo
                else setVerOrigen(true);
              }}>
              {verOrigen || vinculado ? 'Cargar a mano' : 'Elegir de mis gastos o tarjetas'}
            </button>
            {verOrigen && <Origen movs={movs} compras={compras} usados={usados} onElegir={elegirOrigen} />}
          </div>
        )}
        {vinculado && <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Sale de {f.tarjeta ? `tu tarjeta (${f.tarjeta.tarjeta})` : 'tus cuentas'}: ya lo pagaste vos. Cuando te devuelvan, la transferencia queda como Recupero.</p>}
        <Campo label="¿Qué fue?"><input className="mod-campo" value={f.descripcion} onChange={set('descripcion')} placeholder="Súper, nafta, alquiler…" /></Campo>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Campo label="Monto"><input className="mod-campo" inputMode="decimal" value={f.monto} onChange={set('monto')} placeholder="0" disabled={!!vinculado} /></Campo>
          <Campo label="Fecha"><input className="mod-campo" type="date" value={f.fecha} onChange={set('fecha')} /></Campo>
        </div>
        <Campo label="¿Quién pagó?">
          <select className="mod-select" value={f.pagado_por} onChange={set('pagado_por')} disabled={!!vinculado}>
            {participantes.map((p) => <option key={p.id} value={p.id}>{p.es_yo ? 'Yo' : p.nombre}</option>)}
          </select>
        </Campo>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>¿Cómo se divide?</span>
          <Seg opciones={DIVISIONES} valor={f.division} onCambio={(d) => setF((x) => ({ ...x, division: d, valores: {} }))} ariaLabel="Cómo se divide" />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {participantes.map((p) => {
              const on = f.incluidos.includes(p.id);
              const parte = vista?.partes?.find((x) => x.p === p.id);
              return (
                <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, fontSize: 15 }}>
                    <input type="checkbox" checked={on} onChange={() => alternar(p.id)} style={{ width: 20, height: 20 }} />
                    {p.es_yo ? 'Yo' : p.nombre}
                  </label>
                  {on && f.division !== 'iguales' && (
                    <input className="mod-campo" inputMode="decimal" aria-label={`${etiqueta} de ${p.es_yo ? 'mí' : p.nombre}`} value={f.valores[p.id] ?? ''} placeholder={etiqueta}
                      onChange={(e) => setF((x) => ({ ...x, valores: { ...x.valores, [p.id]: e.target.value } }))} style={{ flex: '0 0 96px', minWidth: 0 }} />
                  )}
                  <span className="mod-cifra" style={{ fontSize: 14, color: 'var(--label2)', minWidth: 80, textAlign: 'right' }}>{on && parte ? pesos(parte.monto, { decimales: parte.monto % 1 ? 2 : 0 }) : ''}</span>
                </li>
              );
            })}
          </ul>
          {vista?.error && <span role="status" style={{ fontSize: 12, color: 'var(--label2)' }}>{vista.error}</span>}
        </div>
        <Error texto={error} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {gasto ? <DobleToque texto="Borrar gasto" confirmar="¿Borrar?" disabled={ocupado} onConfirmado={async () => { try { await borrarGasto(gasto.id); onGuardado?.(); onCerrar(); } catch { setError('No se pudo borrar.'); } }} /> : <span />}
          <Botonera onCerrar={onCerrar} ocupado={ocupado} />
        </div>
      </form>
    </Hoja>
  );
};

/** Registrar un pago entre dos personas (efectivo o algo que no está en tus cuentas). */
export const FormPago = ({ abierta, grupo, participantes, inicial, onCerrar, onGuardado }) => {
  const [f, setF] = useState({});
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!abierta) return;
    setError(null);
    setF({ de: inicial?.de || participantes.find((p) => !p.es_yo)?.id, a: inicial?.a || participantes.find((p) => p.es_yo)?.id, monto: inicial?.monto ? String(inicial.monto).replace('.', ',') : '', fecha: hoyISO(), nota: '' });
  }, [abierta, inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!abierta || !f.fecha) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const nombre = (p) => (p.es_yo ? 'Yo' : p.nombre);
  const guardar = async () => {
    const m = parseMonto(f.monto);
    if (f.de === f.a) { setError('Elegí dos personas distintas.'); return; }
    if (!(m > 0)) { setError('Poné el monto.'); return; }
    if (!f.fecha || f.fecha > hoyISO()) { setError('Poné una fecha de hoy o anterior.'); return; }
    setOcupado(true); setError(null);
    try { await registrarPago({ grupo_id: grupo.id, de: f.de, a: f.a, monto: m, fecha: f.fecha, nota: f.nota.trim() || null }); onGuardado?.(); onCerrar(); }
    catch { setError('No se pudo guardar. Revisá tu conexión.'); }
    finally { setOcupado(false); }
  };
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Registrar pago">
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Para efectivo o pagos que no están en tus cuentas. Las transferencias que importás se reconocen solas.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Campo label="Pagó"><select className="mod-select" value={f.de} onChange={set('de')}>{participantes.map((p) => <option key={p.id} value={p.id}>{nombre(p)}</option>)}</select></Campo>
          <Campo label="A"><select className="mod-select" value={f.a} onChange={set('a')}>{participantes.map((p) => <option key={p.id} value={p.id}>{nombre(p)}</option>)}</select></Campo>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Campo label="Monto"><input className="mod-campo" inputMode="decimal" value={f.monto} onChange={set('monto')} placeholder="0" /></Campo>
          <Campo label="Fecha"><input className="mod-campo" type="date" max={hoyISO()} value={f.fecha} onChange={set('fecha')} /></Campo>
        </div>
        <Campo label="Nota (opcional)"><input className="mod-campo" value={f.nota} onChange={set('nota')} /></Campo>
        <Error texto={error} />
        <Botonera onCerrar={onCerrar} ocupado={ocupado} />
      </form>
    </Hoja>
  );
};

export { plata };
