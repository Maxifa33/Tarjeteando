import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Info } from 'lucide-react';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import { pesos } from '../../../ui/formato.js';
import { leerArchivo } from '../../cuentas/leer.js';
import { interpretar } from '../../cuentas/detectar.js';
import { armarPlan } from '../../cuentas/plan.js';
import { sha256Bytes } from '../../cuentas/huella.js';
import { cargarContexto, guardarArchivo } from '../../cuentas/repo.js';
import '../modulos.css';

const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '');

/**
 * Importar extractos de cuenta (Galicia, Mercado Pago u otra planilla): PDF, Excel o CSV.
 * 1) elegir archivos → 2) revisar lo que se va a cargar → 3) guardar. Nada se guarda sin confirmar.
 */
const ImportarCuentas = ({ abierta, onCerrar, onImportado }) => {
  const [fase, setFase] = useState('elegir'); // elegir | leyendo | revision | guardando | listo
  const [plan, setPlan] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [tipos, setTipos] = useState({});
  const [error, setError] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [guardados, setGuardados] = useState(0);
  const [nombres, setNombres] = useState({}); // nombre de cuenta para planillas genéricas
  const input = useRef(null);

  const reiniciar = () => { setFase('elegir'); setPlan(null); setError(null); setTipos({}); setGuardados(0); setNombres({}); };
  const cerrar = () => { reiniciar(); onCerrar(); };

  const procesar = async (files) => {
    const lista = [...(files || [])];
    if (!lista.length) return;
    setFase('leyendo'); setError(null);
    try {
      const contexto = await cargarContexto();
      const archivos = [];
      for (const f of lista) {
        try {
          const hash = await sha256Bytes(await f.arrayBuffer());
          archivos.push({ nombre: f.name, hash, resultado: interpretar(await leerArchivo(f)) });
        } catch (e) {
          archivos.push({ nombre: f.name, resultado: { ok: false, error: e.message || 'No se pudo leer el archivo.' } });
        }
      }
      const p = await armarPlan(archivos, contexto);
      const t = {};
      p.archivos.forEach((a) => (a.bolsillosNuevos || []).forEach((b) => { t[b.nombre] = b.tipo; }));
      setTipos(t); setCtx(contexto); setPlan(p); setFase('revision');
    } catch {
      setError('No pude conectar con tu cuenta. Revisá la conexión e intentá de nuevo.');
      setFase('elegir');
    }
  };

  const validos = plan ? plan.archivos.filter((a) => a.estado === 'listo' && a.nuevos.length && !a.guardado) : [];
  const totalNuevos = validos.reduce((s, a) => s + a.nuevos.length, 0);

  const guardar = async () => {
    setFase('guardando'); setError(null);
    let n = 0;
    try {
      for (const a of validos) {
        if (a.resultado.origen === 'archivo') {
          const nombre = (nombres[a.nombre] || '').trim() || 'Otra cuenta';
          a.resultado.cuenta = { ...a.resultado.cuenta, nombre, institucion: `otra:${nombre.toLowerCase().replace(/\s+/g, '-')}` };
        }
        const r = await guardarArchivo(a, { tiposBolsillo: tipos, titular: plan.titulares[0] || null }, ctx);
        a.guardado = true; // si después falla otro archivo, este no se reintenta
        n += r.guardados;
      }
      setGuardados(n); setFase('listo'); onImportado?.();
    } catch {
      setGuardados(n);
      setError(n ? `Se guardaron ${n} movimientos y después falló la conexión. Tocá Importar de nuevo: lo ya guardado no se duplica.` : 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
      setFase('revision');
    }
  };

  return (
    <Hoja abierta={abierta} onCerrar={cerrar} titulo="Importar movimientos de cuenta">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>Importar movimientos</h2>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--label2)' }}>Galicia (Excel o CSV) y Mercado Pago (PDF del resumen, Excel o CSV). Podés subir varios juntos.</p>
        </div>

        {fase === 'elegir' && (
          <>
            <button
              type="button" className={`mod-drop ${arrastrando ? 'on' : ''}`} onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); procesar(e.dataTransfer.files); }}
            >
              <Upload size={26} aria-hidden="true" />
              <span style={{ fontSize: 17, fontWeight: 600 }}>Arrastrá tus archivos o tocá para elegir</span>
              <span style={{ fontSize: 13, color: 'var(--label2)' }}>PDF, XLSX, XLS o CSV</span>
            </button>
            <input ref={input} type="file" multiple accept=".pdf,.xlsx,.xls,.csv" hidden onChange={(e) => { procesar(e.target.files); e.target.value = ''; }} />
          </>
        )}

        {fase === 'leyendo' && <p role="status" style={{ margin: 0, fontSize: 15 }}>Leyendo archivos…</p>}

        {(fase === 'revision' || fase === 'guardando') && plan && (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plan.archivos.map((a, i) => (
                <li key={i} style={{ padding: 16, borderRadius: 18, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <FileText size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>{a.nombre}</div>
                      {a.estado === 'listo' && (
                        <div style={{ fontSize: 13, color: 'var(--label2)' }}>
                          {a.resultado.cuenta.nombre} · {fechaCorta(a.resultado.desde)} → {fechaCorta(a.resultado.hasta)} · {a.nuevos.length} nuevos{a.duplicados ? `, ${a.duplicados} ya cargados` : ''}
                        </div>
                      )}
                      {a.estado === 'listo' && a.yaImportado && <div style={{ fontSize: 13, color: 'var(--label2)' }}>Este archivo ya se había importado: solo se carga lo que falte.</div>}
                      {a.guardado && <div style={{ fontSize: 13, color: 'var(--label2)' }}>Guardado.</div>}
                      {a.estado === 'error' && <div role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>{a.error}</div>}
                    </div>
                  </div>
                  {a.estado === 'listo' && a.resultado.origen === 'archivo' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--label2)' }}>
                      ¿De qué cuenta es este archivo?
                      <input className="mod-campo" value={nombres[a.nombre] || ''} placeholder="Ej.: Santander caja de ahorro"
                        onChange={(e) => setNombres((x) => ({ ...x, [a.nombre]: e.target.value }))} />
                    </label>
                  )}
                  {a.estado === 'listo' && (
                    <>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: a.resultado.validacion.ok ? 'var(--label2)' : 'var(--danger)' }}>
                        {a.resultado.validacion.ok ? <CheckCircle size={14} aria-hidden="true" style={{ color: 'var(--ok)' }} /> : <AlertCircle size={14} aria-hidden="true" />}
                        {a.resultado.validacion.detalle}
                      </div>
                      {a.nuevos.length > 0 && (
                        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14 }}>
                          <span>Ingresos <strong className="mod-cifra">{pesos(a.resumen.ingresos)}</strong></span>
                          <span>Gastos <strong className="mod-cifra">{pesos(a.resumen.gastos)}</strong></span>
                          <span>Entre cuentas/reservas <strong>{a.resumen.internos}</strong></span>
                          {a.resumen.revisar > 0 && <span>A revisar <strong>{a.resumen.revisar}</strong></span>}
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>

            {Object.keys(tipos).length > 0 && (
              <section aria-labelledby="imp-reservas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <h3 id="imp-reservas" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Tus reservas de Mercado Pago</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--label2)' }}>
                    <strong>Apartado</strong>: plata separada para un gasto que ya sabés que viene. <strong>Ahorro</strong>: fondo que no pensás gastar (como Emergencia). Ninguna cuenta como gasto.
                  </p>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(tipos).map(([nombre, tipo]) => (
                    <li key={nombre} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{nombre}</span>
                      <Seg opciones={[{ id: 'apartado', label: 'Apartado' }, { id: 'ahorro', label: 'Ahorro' }]} valor={tipo}
                        onCambio={(v) => setTipos((t) => ({ ...t, [nombre]: v }))} ariaLabel={`Tipo de la reserva ${nombre}`} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {plan.archivos.some((a) => a.estado === 'listo' && !a.resultado.validacion.ok) && (
              <div className="mod-aviso" role="status">
                <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Algún total no coincide con el del banco. Podés importar igual y revisar, o volver a bajar el archivo.</span>
              </div>
            )}
          </>
        )}

        {fase === 'listo' && (
          <div className="mod-aviso" role="status">
            <CheckCircle size={18} aria-hidden="true" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 1 }} />
            <span>Listo: {guardados} movimientos cargados. Los dudosos quedaron marcados "Revisar".</span>
          </div>
        )}

        {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {fase === 'revision' && <button type="button" className="btn" onClick={reiniciar} style={{ minHeight: 44 }}>Elegir otros</button>}
          <button type="button" className="btn" onClick={cerrar} disabled={fase === 'guardando'} style={{ minHeight: 44 }}>{fase === 'listo' ? 'Cerrar' : 'Cancelar'}</button>
          {(fase === 'revision' || fase === 'guardando') && (
            <button type="button" className="btn btn-pri" disabled={!totalNuevos || fase === 'guardando'} onClick={guardar} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
              {fase === 'guardando' ? 'Guardando…' : totalNuevos ? `Importar ${totalNuevos} movimientos` : 'Nada nuevo para importar'}
            </button>
          )}
        </div>
      </div>
    </Hoja>
  );
};

export default ImportarCuentas;
