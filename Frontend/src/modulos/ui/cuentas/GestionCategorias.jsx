import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import Hoja from '../../../ui/Hoja.jsx';
import { categoriasVisibles, nombreOcupado } from '../../cuentas/categorias.js';
import { crearCategoria, renombrarCategoria, borrarCategoria } from '../../cuentas/repo.js';
import '../modulos.css';

/** Una categoría editable en el lugar: escribís, tocás ✓ (o Enter). */
const Fila = ({ cat, todas, onCambio, onError }) => {
  const [nombre, setNombre] = useState(cat.nombre);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const timer = useRef(null);
  useEffect(() => { setNombre(cat.nombre); }, [cat.nombre]);
  // Safari no da foco al botón al tocarlo: la confirmación se desarma sola a los 4 s.
  useEffect(() => () => clearTimeout(timer.current), []);
  const cambiado = nombre.trim() && nombre.trim() !== cat.nombre;

  const guardar = async () => {
    if (!cambiado) return;
    if (nombreOcupado(nombre, cat.tipo, todas, cat.id)) { onError(`Ya existe "${nombre.trim()}".`); return; }
    setOcupado(true);
    try { await renombrarCategoria(cat, nombre); onError(null); await onCambio(); }
    catch { onError('No se pudo renombrar. Revisá tu conexión.'); setNombre(cat.nombre); await onCambio(); }
    finally { setOcupado(false); }
  };
  const borrar = async () => {
    if (!confirmarBorrar) { setConfirmarBorrar(true); clearTimeout(timer.current); timer.current = setTimeout(() => setConfirmarBorrar(false), 4000); return; }
    clearTimeout(timer.current);
    setOcupado(true);
    try { await borrarCategoria(cat); onError(null); await onCambio(); }
    catch (e) { onError(e.message?.includes('base') ? e.message : 'No se pudo borrar.'); }
    finally { setOcupado(false); setConfirmarBorrar(false); }
  };

  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Nombre de la categoría {cat.nombre}</span>
        <input className="mod-campo" value={nombre} disabled={ocupado} onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setNombre(cat.nombre); }} />
      </label>
      {cambiado && (
        <button type="button" className="ico" aria-label={`Guardar nombre ${nombre}`} disabled={ocupado} onClick={guardar}><Check size={18} aria-hidden="true" /></button>
      )}
      {cat.user_id && !cambiado && (
        <button type="button" className={confirmarBorrar ? 'btn' : 'ico'} disabled={ocupado} onClick={borrar}
          aria-label={confirmarBorrar ? `Confirmar borrar ${cat.nombre}` : `Borrar ${cat.nombre}`} style={confirmarBorrar ? { minHeight: 44, color: 'var(--danger)' } : undefined}>
          {confirmarBorrar ? 'Borrar' : <Trash2 size={17} aria-hidden="true" />}
        </button>
      )}
    </li>
  );
};

/** Hoja para renombrar, agregar y borrar categorías de un tipo ('ingreso' o 'gasto'). */
const GestionCategorias = ({ abierta, tipo, todas, onCerrar, onCambio }) => {
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  const lista = categoriasVisibles(todas, tipo);

  const agregar = async (e) => {
    e.preventDefault();
    const n = nueva.trim();
    if (!n) return;
    if (nombreOcupado(n, tipo, todas)) { setError(`Ya existe "${n}".`); return; }
    setCreando(true); setError(null);
    try { await crearCategoria(n, tipo); setNueva(''); await onCambio(); }
    catch { setError('No se pudo crear. Revisá tu conexión.'); }
    finally { setCreando(false); }
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={`Categorías de ${tipo === 'ingreso' ? 'ingresos' : 'gastos'}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>Categorías de {tipo === 'ingreso' ? 'ingresos' : 'gastos'}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--label2)' }}>Renombrá cualquiera tocando su nombre. Las que agregues vos se pueden borrar; sus movimientos quedan sin categoría.</p>
        </div>
        <form onSubmit={agregar} style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1, display: 'flex' }}>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Nueva categoría</span>
            <input className="mod-campo" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva categoría (ej.: Mascotas)" />
          </label>
          <button type="submit" className="btn btn-pri" disabled={creando || !nueva.trim()} style={{ minHeight: 44, borderRadius: 22, padding: '0 16px' }}>
            <Plus size={16} aria-hidden="true" /> Agregar
          </button>
        </form>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map((c) => <Fila key={c.id} cat={c} todas={todas} onCambio={onCambio} onError={setError} />)}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar} style={{ minHeight: 44 }}>Listo</button>
        </div>
      </div>
    </Hoja>
  );
};

export default GestionCategorias;
