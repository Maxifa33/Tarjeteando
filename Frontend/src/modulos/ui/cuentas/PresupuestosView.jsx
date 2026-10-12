import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Smartphone } from 'lucide-react';
import { pesos, dolares, mesCorto, capitalizar, mesLargo } from '../../../ui/formato.js';
import { movimientosEntre, mesesConDatos } from '../../cuentas/repo.js';
import { rangoMes, moverMes } from '../../cuentas/resumen.js';
import { historial } from '../../cuentas/presupuesto.js';
import { tarjetasPorMes } from '../../puente/tarjeteando.js';
import { SelectorMes } from './comunes.jsx';
import '../modulos.css';

const hoyMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const NOTA_TARJETAS = {
  pagado: 'Resúmenes que vencieron este mes',
  en_curso: 'Vence este mes, todavía en curso (igual que Mes)',
  comprometido: 'Solo cuotas y fijos ya firmados',
  desde_cuentas: 'Pagado desde tus cuentas (no hay resúmenes de este mes en este dispositivo; incluye lo pagado de dólares)',
  sin_datos: 'Sin datos de tarjetas para este mes'
};

/** Una línea de la cuenta del mes: signo explícito (no depende del color). */
const Linea = ({ signo, label, valor, nota, fuerte }) => (
  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: fuerte ? '14px 0 0' : '10px 0', borderTop: fuerte ? '0.5px solid var(--sep)' : 0 }}>
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: fuerte ? 17 : 15, fontWeight: fuerte ? 700 : 500 }}>{label}</span>
      {nota && <span style={{ fontSize: 12, color: 'var(--label2)' }}>{nota}</span>}
    </span>
    <span className="mod-cifra" style={{ fontSize: fuerte ? 28 : 17, fontWeight: fuerte ? 700 : 600, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>
      {signo && <span aria-hidden="true" style={{ color: 'var(--label2)', marginRight: 6 }}>{signo}</span>}
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{signo === '−' ? 'menos ' : signo === '+' ? 'más ' : ''}</span>
      {pesos(valor)}
    </span>
  </li>
);

/** Presupuestos v1: el mes real, sin cargar nada a mano. */
const PresupuestosView = ({ tarjeteando }) => {
  const [mes, setMes] = useState(null);
  const [movs, setMovs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [cargadoMes, setCargadoMes] = useState(null);
  const pedido = useRef(0);
  const tarjetas = useMemo(() => tarjetasPorMes(tarjeteando?.evolucion || []), [tarjeteando]);

  useEffect(() => {
    let vivo = true;
    mesesConDatos().then((u) => { if (vivo) setMes(u ? u.slice(0, 7) : hoyMes()); }).catch(() => { if (vivo) setMes(hoyMes()); });
    return () => { vivo = false; };
  }, []);

  const cargar = useCallback(async () => {
    if (!mes) return;
    const id = ++pedido.current;
    setCargando(true); setError(null);
    try {
      const filas = await movimientosEntre(rangoMes(moverMes(mes, -5)).desde, rangoMes(mes).hasta);
      if (id === pedido.current) { setMovs(filas); setCargadoMes(mes); }
    } catch { if (id === pedido.current) setError('No se pudieron leer tus movimientos. Revisá tu conexión.'); }
    finally { if (id === pedido.current) setCargando(false); }
  }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);

  const h = useMemo(() => (mes ? historial(mes, movs, tarjetas, 6) : []), [mes, movs, tarjetas]);
  if (!mes) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;
  const p = cargadoMes === mes ? h[0] : null; // nunca mostrar la cuenta de un mes con datos de otro
  const sinDatos = !cargando && p && !p.ingresos && !p.sinTarjeta && !p.tarjetas;
  const max = Math.max(1, ...h.map((x) => Math.max(x.ingresos, x.tarjetas + x.sinTarjeta)));

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      <SelectorMes mes={mes} onCambio={setMes} />
      {error && <div className="mod-aviso" role="alert">{error}</div>}

      {!p && !error ? <p role="status" style={{ margin: 0 }}>Cargando…</p> : sinDatos ? (
        <div style={{ padding: 20, borderRadius: 20, background: 'var(--fill2)' }}>
          <p style={{ margin: 0, fontSize: 17 }}>Todavía no hay datos de {mesLargo(mes)}.</p>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--label2)' }}>Importá tus cuentas en Platita o Billetera y tus resúmenes en Tarjeteando.</p>
        </div>
      ) : p && (
        <>
          <section aria-label={`Cuenta de ${mesLargo(mes)}`} aria-busy={cargando} style={{ padding: '18px 20px 20px', borderRadius: 22, background: 'var(--fill2)' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              <Linea label="Ingresos" valor={p.ingresos} nota={`Activos ${pesos(p.activos)} · Pasivos ${pesos(p.pasivos)}`} />
              <Linea signo="−" label="Tarjetas" valor={p.tarjetas} nota={NOTA_TARJETAS[p.tarjetasTipo] + (p.tarjetasUsd ? ` · más ${dolares(p.tarjetasUsd)} aparte, no incluidos` : '')} />
              <Linea signo="−" label="Gastos sin tarjeta" valor={p.sinTarjeta} nota="Billetera, ya neto de recuperos sin tarjeta" />
              {p.recuperosTarjeta > 0 && <Linea signo="+" label="Recuperos de compras con tarjeta" valor={p.recuperosTarjeta} nota="Lo que te devolvieron de gastos que pagaste con tarjeta" />}
              <Linea label={p.teQueda >= 0 ? 'Te queda' : 'Gastaste de más'} valor={Math.abs(p.teQueda)} fuerte />
            </ul>
            {(p.apartado || p.ahorrado) ? (
              <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--label2)' }}>
                Separaste {pesos(p.apartado)} en reservas para gastos que vienen{p.ahorrado ? ` y ahorraste ${pesos(p.ahorrado)}` : ''}. <strong style={{ color: 'var(--label)' }}>Libre de verdad: {pesos(p.libre)}</strong>.
              </p>
            ) : null}
          </section>

          {p.pendientes > 0 && (
            <div className="mod-aviso" role="status">
              <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Hay {p.pendientes} movimientos a revisar ({pesos(p.pendientesMonto)}) en Platita y Billetera. No están en la cuenta hasta que los confirmes.</span>
            </div>
          )}
          {p.tarjetasTipo !== 'pagado' && p.tarjetasTipo !== 'en_curso' && (
            <p style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--label2)' }}>
              <Smartphone size={14} aria-hidden="true" /> Las tarjetas salen de Tarjeteando en este dispositivo.
            </p>
          )}

          <section aria-labelledby="pre-hist" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 id="pre-hist" className="h3" style={{ margin: 0 }}>Últimos 6 meses</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ color: 'var(--label2)', textAlign: 'right' }}>
                  <th scope="col" style={{ textAlign: 'left', fontWeight: 500, padding: '6px 0' }}>Mes</th>
                  <th scope="col" style={{ fontWeight: 500 }}>Entró</th>
                  <th scope="col" style={{ fontWeight: 500 }}>Salió</th>
                  <th scope="col" style={{ fontWeight: 500 }}>Te quedó</th>
                </tr>
              </thead>
              <tbody>
                {h.map((x) => (
                  <tr key={x.mesKey} aria-current={x.mesKey === mes ? 'true' : undefined} style={{ borderTop: '0.5px solid var(--sep)', fontWeight: x.mesKey === mes ? 600 : 400 }}>
                    <th scope="row" style={{ textAlign: 'left', fontWeight: 'inherit', padding: '10px 0' }}>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {capitalizar(mesCorto(x.mesKey))} {x.mesKey.slice(2, 4)}
                        <span className="mod-barra" aria-hidden="true" style={{ width: 80 }}><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, (x.tarjetas + x.sinTarjeta) / max))})` }} /></span>
                      </span>
                    </th>
                    <td className="mod-cifra" style={{ textAlign: 'right' }}>{x.conCuentas ? pesos(x.ingresos) : '—'}</td>
                    <td className="mod-cifra" style={{ textAlign: 'right' }}>{pesos(r2s(x.tarjetas + x.sinTarjeta - x.recuperosTarjeta))}</td>
                    <td className="mod-cifra" style={{ textAlign: 'right' }}>{x.conCuentas ? pesos(x.teQueda) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>— = mes sin cuentas importadas: solo se ven las tarjetas.</p>
          </section>
        </>
      )}
    </section>
  );
};

const r2s = (n) => Math.round(n * 100) / 100;

export default PresupuestosView;
