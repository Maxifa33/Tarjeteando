import React, { useEffect, useRef, useState } from 'react';
import { FileText, Trash2, RotateCcw } from 'lucide-react';
import Hoja from '../../../ui/Hoja.jsx';
import { listarImportaciones, borrarImportacion, borrarTodo } from '../../cuentas/repo.js';
import '../modulos.css';

const fecha = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`; };

/**
 * Archivos importados: borrar uno (con sus movimientos) o empezar de cero.
 * Toda acción que borra pide un segundo toque. No toca los datos de Tarjeteando.
 */
const ArchivosImportados = ({ abierta, onCerrar, onCambio }) => {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [confirmando, setConfirmando] = useState(null); // id | 'todo'
  const [ocupado, setOcupado] = useState(false);
  const [tambienPersonal, setTambienPersonal] = useState(false);
  const timer = useRef(null);
  // La confirmación (segundo toque) se desarma sola a los 4 s.
  const armar = (id) => { setConfirmando(id); clearTimeout(timer.current); timer.current = setTimeout(() => setConfirmando(null), 4000); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const cargar = async () => {
    setError(null);
    try { setLista(await listarImportaciones()); } catch { setError('No se pudo leer la lista. Revisá tu conexión.'); setLista([]); }
  };
  useEffect(() => { if (abierta) { cargar(); setConfirmando(null); setTambienPersonal(false); } }, [abierta]);

  const borrarUno = async (imp) => {
    if (confirmando !== imp.id) { armar(imp.id); return; }
    clearTimeout(timer.current);
    setOcupado(true);
    try { await borrarImportacion(imp.id); await cargar(); await onCambio?.(); }
    catch { setError('No se pudo borrar. Revisá tu conexión.'); }
    finally { setOcupado(false); setConfirmando(null); }
  };
  const empezarDeCero = async () => {
    if (confirmando !== 'todo') { armar('todo'); return; }
    clearTimeout(timer.current);
    setOcupado(true);
    try { await borrarTodo({ todo: tambienPersonal }); setError(null); }
    catch { setError('No se pudo borrar todo. Puede haber quedado a medias: tocá Empezar de cero otra vez para terminar.'); }
    try { await cargar(); await onCambio?.(); } finally { setOcupado(false); setConfirmando(null); }
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Archivos importados">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>Archivos importados</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--label2)' }}>Borrar un archivo saca todos sus movimientos, también los cambios que les hayas hecho. Después lo podés volver a importar.</p>
        </div>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        {lista === null ? <p role="status" style={{ margin: 0 }}>Cargando…</p> : !lista.length ? (
          <p style={{ margin: 0, fontSize: 15, color: 'var(--label2)' }}>No hay archivos importados.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lista.map((imp) => (
              <li key={imp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--fill2)' }}>
                <FileText size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>{imp.nombre_archivo}</span>
                  <span aria-live="polite" style={{ fontSize: 13, color: 'var(--label2)' }}>{confirmando === imp.id ? 'Tocá Borrar otra vez para confirmar · ' : ''}{imp.cuenta} · {imp.cantidad} movimientos · {fecha(imp.created_at)}</span>
                </span>
                <button type="button" className={confirmando === imp.id ? 'btn' : 'ico'} disabled={ocupado} onClick={() => borrarUno(imp)}
                  aria-label={confirmando === imp.id ? `Confirmar borrar ${imp.nombre_archivo}` : `Borrar ${imp.nombre_archivo}`}
                  style={confirmando === imp.id ? { minHeight: 44, color: 'var(--danger)' } : undefined}>
                  {confirmando === imp.id ? 'Borrar' : <Trash2 size={17} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="arch-cero" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 18, border: '0.5px solid var(--sep)' }}>
          <h3 id="arch-cero" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Empezar de cero</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Borra todos los movimientos, archivos, cuentas y reservas de Platita y Billetera. Tus tarjetas en Tarjeteando no se tocan.</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14 }}>
            <input type="checkbox" checked={tambienPersonal} onChange={(e) => setTambienPersonal(e.target.checked)} style={{ width: 20, height: 20 }} />
            También borrar mis categorías propias y las reglas por persona
          </label>
          <button type="button" className="btn" disabled={ocupado} onClick={empezarDeCero} style={{ minHeight: 44, alignSelf: 'flex-start', color: confirmando === 'todo' ? 'var(--danger)' : undefined }}>
            <RotateCcw size={16} aria-hidden="true" /> {ocupado && confirmando === 'todo' ? 'Borrando…' : confirmando === 'todo' ? 'Tocá de nuevo para borrar todo' : 'Empezar de cero'}
          </button>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar} disabled={ocupado} style={{ minHeight: 44 }}>Listo</button>
        </div>
      </div>
    </Hoja>
  );
};

export default ArchivosImportados;
