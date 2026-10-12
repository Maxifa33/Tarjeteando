import React, { useEffect, useRef, useState } from 'react';
import { pesos, dolares, mesCorto } from '../../../ui/formato.js';
import Hoja from '../../../ui/Hoja.jsx';
import Seg from '../../../ui/Seg.jsx';
import { TIPOS_DEUDA, validarDeuda, estadoDeuda } from '../../deudas/deudas.js';
import { parseMonto } from '../../cuentas/util.js';
import { crearDeuda, actualizarDeuda, borrarDeuda, quitarPago, registrarPagoManual } from '../../deudas/repo.js';
import '../modulos.css';

export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** '2026-10-09' → '9 oct' (con mes: los pagos cruzan meses). */
export const fechaDM = (iso) => (iso ? `${Number(iso.slice(8, 10))} ${mesCorto(iso.slice(0, 7))}` : '');
export const plata = (n, moneda) => (moneda === 'USD' ? dolares(n) : pesos(n));

const Campo = ({ label, nota, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--label2)' }}>
    {label}
    {children}
    {nota && <span style={{ fontSize: 12 }}>{nota}</span>}
  </label>
);

const AYUDA = {
  prestamo: { acreedor: 'Banco o app (ej. Galicia, Mercado Pago)', nombre: 'Préstamo personal' },
  persona: { acreedor: 'Nombre y apellido, como aparece en la transferencia', nombre: 'Le debo a…' },
  atraso: { acreedor: 'Empresa u organismo (ej. Edenor, ARBA)', nombre: 'Luz atrasada' }
};

const vacioForm = () => ({ tipo: 'prestamo', nombre: '', acreedor: '', moneda: 'ARS', saldo_inicial: '', cuota_monto: '', cuotas_restantes: '', tasa_anual: '', palabra_clave: '', notas: '', fecha_inicio: hoyISO() });
const aForm = (d) => ({
  tipo: d.tipo, nombre: d.nombre, acreedor: d.acreedor || '', moneda: d.moneda, saldo_inicial: String(d.saldo_inicial).replace('.', ','),
  cuota_monto: d.cuota_monto == null ? '' : String(d.cuota_monto).replace('.', ','), cuotas_restantes: d.cuotas_restantes ?? '',
  tasa_anual: d.tasa_anual ?? '', palabra_clave: d.palabra_clave || '', notas: d.notas || '', fecha_inicio: d.fecha_inicio
});

/** Alta o edición de una deuda. */
export const FormDeuda = ({ abierta, deuda, onCerrar, onGuardado }) => {
  const [f, setF] = useState(vacioForm);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (abierta) { setF(deuda ? aForm(deuda) : vacioForm()); setError(null); } }, [abierta, deuda]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const ayuda = AYUDA[f.tipo];
  const cuota = parseMonto(f.cuota_monto);
  const n = Number(f.cuotas_restantes);
  const calculado = !f.saldo_inicial && cuota > 0 && Number.isInteger(n) && n > 0 ? cuota * n : null;

  const guardar = async () => {
    const v = validarDeuda(f);
    if (v.error) { setError(v.error); return; }
    setGuardando(true); setError(null);
    try {
      const fila = deuda ? await actualizarDeuda(deuda.id, v.fila) : await crearDeuda(v.fila);
      onGuardado?.(fila); onCerrar();
    } catch { setError('No se pudo guardar. Revisá tu conexión.'); }
    finally { setGuardando(false); }
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={deuda ? 'Editar deuda' : 'Nueva deuda'}>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <Seg opciones={TIPOS_DEUDA} valor={f.tipo} onCambio={set('tipo')} ariaLabel="Tipo de deuda" />
        <Campo label="Nombre"><input className="mod-campo" value={f.nombre} onChange={set('nombre')} placeholder={ayuda.nombre} /></Campo>
        <Campo label={f.tipo === 'persona' ? '¿A quién?' : '¿Con quién?'} nota={ayuda.acreedor + '. Sirve para reconocer los pagos en tus cuentas.'}>
          <input className="mod-campo" value={f.acreedor} onChange={set('acreedor')} />
        </Campo>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Campo label="Cuota mensual (si tiene)"><input className="mod-campo" inputMode="decimal" value={f.cuota_monto} onChange={set('cuota_monto')} placeholder="0" /></Campo>
          <Campo label={deuda ? 'Cuotas que faltaban' : 'Cuotas que faltan'}><input className="mod-campo" inputMode="numeric" value={f.cuotas_restantes} onChange={set('cuotas_restantes')} placeholder="0" /></Campo>
        </div>
        <Campo label={deuda ? `Lo que debías el ${fechaDM(f.fecha_inicio)}` : 'Lo que debés hoy'}
          nota={calculado ? `Si lo dejás vacío: ${plata(calculado, f.moneda)} (cuota × cuotas que faltan).` : deuda ? 'El saldo de esa fecha: los pagos posteriores se descuentan solos.' : 'El total pendiente a hoy.'}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="mod-campo" inputMode="decimal" value={f.saldo_inicial} onChange={set('saldo_inicial')} placeholder={calculado ? String(calculado) : '0'} />
            <select className="mod-select" value={f.moneda} onChange={set('moneda')} aria-label="Moneda"><option value="ARS">$</option><option value="USD">U$S</option></select>
          </div>
        </Campo>
        <Campo label="Tasa anual % (opcional)" nota="Solo si lo que debés crece con intereses. Si ya está incluida en las cuotas, dejalo vacío.">
          <input className="mod-campo" inputMode="decimal" value={f.tasa_anual} onChange={set('tasa_anual')} placeholder="Ej. 85" />
        </Campo>
        <Campo label="Palabra clave (opcional)" nota='Una palabra que aparezca en el movimiento del pago, ej. "PRESTAMO 4521".'>
          <input className="mod-campo" value={f.palabra_clave} onChange={set('palabra_clave')} />
        </Campo>
        <Campo label="Contar pagos desde" nota="Los pagos anteriores a esta fecha no descuentan.">
          <input className="mod-campo" type="date" max={hoyISO()} value={f.fecha_inicio} onChange={set('fecha_inicio')} />
        </Campo>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCerrar} disabled={guardando} style={{ minHeight: 44 }}>Cancelar</button>
          <button type="submit" className="btn btn-pri" disabled={guardando} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Hoja>
  );
};

/** Botón que pide un segundo toque para confirmar (4 s). */
const DobleToque = ({ texto, confirmar, onConfirmado, disabled }) => {
  const [armado, setArmado] = useState(false);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button type="button" className="btn" disabled={disabled} style={{ minHeight: 44, color: armado ? 'var(--danger)' : undefined }}
      onClick={() => {
        if (armado) { clearTimeout(t.current); setArmado(false); onConfirmado(); return; }
        setArmado(true); t.current = setTimeout(() => setArmado(false), 4000);
      }}>
      {armado ? confirmar : texto}
    </button>
  );
};

/** Detalle: pagos, registrar uno a mano, editar, saldar, borrar. */
export const DetalleDeuda = ({ deuda, pagos, onCerrar, onCambio, onEditar }) => {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [avisoDup, setAvisoDup] = useState(null); // id del pago importado parecido ya avisado
  useEffect(() => { setAvisoDup(null); setMonto(deuda?.cuota_monto ? String(deuda.cuota_monto).replace('.', ',') : ''); setFecha(hoyISO()); setError(null); }, [deuda?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!deuda) return null;
  const e = estadoDeuda(deuda, pagos);
  const anteriores = pagos.filter((m) => m.deuda_id === deuda.id && m.fecha < deuda.fecha_inicio);

  const hacer = async (fn) => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio?.(); return true; } catch { setError('No se pudo guardar. Revisá tu conexión.'); return false; } finally { setOcupado(false); }
  };
  const pagar = async () => {
    const m = parseMonto(monto);
    if (!m || m <= 0) { setError('Poné el monto que pagaste.'); return; }
    if (!fecha) { setError('Poné la fecha del pago.'); return; }
    if (fecha > hoyISO()) { setError('La fecha no puede ser futura.'); return; }
    if (fecha < deuda.fecha_inicio) { setError(`Es anterior al ${fechaDM(deuda.fecha_inicio)}: no descontaría. Cambiá la fecha o editá la deuda.`); return; }
    // Al revés del aviso de "Posibles pagos": si ya hay un pago importado parecido, se pregunta una vez.
    const dias = (a, b) => Math.abs(new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000;
    const dup = e.pagos.find((p) => p.origen !== 'manual' && Math.abs(p.monto - m) <= m * 0.03 && dias(p.fecha, fecha) <= 10);
    if (dup && avisoDup !== dup.id) {
      setAvisoDup(dup.id);
      setError(`Ya hay un pago parecido de tus cuentas el ${fechaDM(dup.fecha)} (${plata(dup.monto, deuda.moneda)}). Si es otro, tocá Registrar de nuevo.`);
      return;
    }
    if (await hacer(() => registrarPagoManual(deuda, { monto: m, fecha }))) { setMonto(''); setAvisoDup(null); }
  };

  return (
    <Hoja abierta={!!deuda} onCerrar={onCerrar} titulo={deuda.nombre}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--label2)' }}>{TIPOS_DEUDA.find((t) => t.id === deuda.tipo)?.label}{deuda.acreedor ? ` · ${deuda.acreedor}` : ''}{deuda.estado === 'saldada' ? ' · Saldada' : ''}</span>
          <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{plata(e.saldo, deuda.moneda)}</span>
          <span style={{ fontSize: 14, color: 'var(--label2)' }}>
            Pagaste {plata(e.pagado, deuda.moneda)} de {plata(deuda.saldo_inicial, deuda.moneda)}{e.cuotasRestantes != null ? ` · faltan ${e.cuotasRestantes} cuotas` : ''}{deuda.tasa_anual ? ` · ${deuda.tasa_anual}% anual` : ''}
          </span>
          <div className="mod-barra" aria-hidden="true"><i style={{ transform: `scaleX(${e.progreso})` }} /></div>
        </div>

        {deuda.estado === 'activa' && (
          <section aria-labelledby="dd-pagar" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 id="dd-pagar" className="h3" style={{ margin: 0 }}>Registrar un pago</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Para efectivo o algo que no importaste. Si después aparece en tus cuentas, Saldar te avisa para no contarlo dos veces.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="mod-campo" inputMode="decimal" aria-label="Monto pagado" placeholder="Monto" value={monto} onChange={(ev) => setMonto(ev.target.value)} />
              <input className="mod-campo" type="date" max={hoyISO()} aria-label="Fecha del pago" value={fecha} onChange={(ev) => setFecha(ev.target.value)} style={{ flex: '0 1 170px' }} />
              <button type="button" className="btn btn-pri" disabled={ocupado} onClick={pagar} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>Registrar</button>
            </div>
          </section>
        )}

        <section aria-labelledby="dd-pagos" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="dd-pagos" className="h3" style={{ margin: 0 }}>Pagos</h3>
          {e.pagos.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {e.pagos.map((m) => (
                <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '4px 0' }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.descripcion}</span>
                    <span style={{ fontSize: 13, color: 'var(--label2)' }}>{fechaDM(m.fecha)} · {m.origen === 'manual' ? 'Cargado a mano' : m.cuenta?.nombre || ''}</span>
                  </span>
                  <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{plata(m.monto, deuda.moneda)}</span>
                  <DobleToque texto="Quitar" confirmar={m.origen === 'manual' ? '¿Borrar?' : '¿Quitar?'} disabled={ocupado} onConfirmado={() => hacer(() => quitarPago(m))} />
                </li>
              ))}
            </ul>
          ) : <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Todavía no hay pagos. Confirmá los que Saldar encuentre en tus cuentas o registralos acá.</p>}
          {anteriores.length > 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>{anteriores.length} pago(s) vinculados son anteriores al {fechaDM(deuda.fecha_inicio)} y no descuentan.</p>}
        </section>

        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <DobleToque texto="Borrar deuda" confirmar="¿Borrar? Los pagos a mano también" disabled={ocupado}
            onConfirmado={async () => { if (await hacer(() => borrarDeuda(deuda.id))) onCerrar(); }} />
          <button type="button" className="btn" disabled={ocupado} onClick={() => onEditar(deuda)} style={{ minHeight: 44 }}>Editar</button>
          <button type="button" className={e.saldo <= 0 && deuda.estado === 'activa' ? 'btn btn-pri' : 'btn'} disabled={ocupado}
            onClick={() => hacer(() => actualizarDeuda(deuda.id, { estado: deuda.estado === 'activa' ? 'saldada' : 'activa' }))}
            style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
            {deuda.estado === 'activa' ? 'Marcar saldada' : 'Reactivar'}
          </button>
        </div>
      </div>
    </Hoja>
  );
};
