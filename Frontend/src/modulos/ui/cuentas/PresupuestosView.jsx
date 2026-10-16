import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Smartphone } from 'lucide-react';
import { pesos, dolares, mesCorto, capitalizar, mesLargo } from '../../../ui/formato.js';
import { movimientosEntre, mesesConDatos, listarBolsillos } from '../../cuentas/repo.js';
import { resumenReservas, movsManuales } from '../../alcancia/reservas.js';
import { movimientosDeReservas, listarAjustes, listarMovsManuales, preciosPara, listarVinculos } from '../../alcancia/repo.js';
import { cobrosDeCuenta, aportesDelMes } from '../../alcancia/aportes.js';
import { hoyISO } from '../deudas/HojasDeuda.jsx';
import { rangoMes, moverMes } from '../../cuentas/resumen.js';
import { historial } from '../../cuentas/presupuesto.js';
import { tarjetasPorMes, cobrosDeTarjeta } from '../../puente/tarjeteando.js';
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
  // Saldo de tus reservas (Alcancía): solo informativo, no entra en la cuenta del mes.
  const [reservas, setReservas] = useState(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [bs, ms, as, mans, ps] = await Promise.all([listarBolsillos(), movimientosDeReservas(null, { todas: true }), listarAjustes(), listarMovsManuales(), preciosPara([]).catch(() => new Map())]);
        const f = ps.get('dolar|bolsa');
        const r = resumenReservas(bs, [...ms, ...movsManuales(mans)], as, hoyISO(), { mep: f ? Number(f.compra || f.precio) : null });
        if (vivo) setReservas(r);
      } catch { if (vivo) setReservas(null); }
    })();
    return () => { vivo = false; };
  }, []);
  const tarjetas = useMemo(() => tarjetasPorMes(tarjeteando?.evolucion || []), [tarjeteando]);
  // Cobros asociados a inversiones (Alcancía): siguen restando, pero se muestran como aportes y no como consumo.
  const [vinculos, setVinculos] = useState([]);
  useEffect(() => { let vivo = true; listarVinculos().then((v) => { if (vivo) setVinculos(v); }).catch(() => {}); return () => { vivo = false; }; }, []);
  const cobrosT = useMemo(() => (vinculos.length ? cobrosDeTarjeta(tarjeteando?.movimientos || [], tarjeteando?.resumenes || []) : []), [vinculos, tarjeteando]);

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
  const ap = p && vinculos.length ? aportesDelMes(mes, vinculos, ['pagado', 'en_curso', 'comprometido'].includes(p.tarjetasTipo) ? cobrosT : [], cobrosDeCuenta(movs)) : null;
  // Nunca más que la línea de la que sale (datos de otro dispositivo o un mes a medias).
  const apT = ap ? Math.min(ap.tarjeta, p.tarjetas) : 0; const apC = ap ? Math.min(ap.cuenta, Math.max(0, p.sinTarjeta)) : 0;
  const apRecortado = ap && (apT < ap.tarjeta - 0.5 || apC < ap.cuenta - 0.5);
  const r2l = (n) => Math.round(n * 100) / 100;
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
              <Linea signo="−" label="Tarjetas" valor={r2l(p.tarjetas - apT)} nota={NOTA_TARJETAS[p.tarjetasTipo] + (p.tarjetasUsd ? ` · más ${dolares(p.tarjetasUsd)} aparte, no incluidos` : '') + (apT ? ' · sin aportes a inversiones' : '')} />
              <Linea signo="−" label="Gastos sin tarjeta" valor={r2l(p.sinTarjeta - apC)} nota={`Billetera, ya neto de recuperos sin tarjeta${apC ? ' · sin aportes a inversiones' : ''}`} />
              {apT + apC > 0 && <Linea signo="−" label="Aportes a inversiones" valor={r2l(apT + apC)} nota={`Cobros asociados en Alcancía${apT && apC ? ` · tarjeta ${pesos(apT)} · cuenta ${pesos(apC)}` : apT ? ' · con tarjeta' : ' · desde tus cuentas'}. Es plata que sale, pero no es consumo.${apRecortado ? ' Ojo: hay cobros asociados por más de lo que muestra la línea de la que salen (¿datos de otro dispositivo?); se tomó el máximo.' : ''}`} />}
              {p.recuperosTarjeta > 0 && <Linea signo="+" label="Recuperos de compras con tarjeta" valor={p.recuperosTarjeta} nota="Lo que te devolvieron de gastos que pagaste con tarjeta" />}
              {p.recuperosNoSe > 0 && <Linea signo="+" label="Otros recuperos" valor={p.recuperosNoSe} nota="Te devolvieron plata de gastos que no recordás cómo pagaste" />}
              <Linea label={p.teQueda >= 0 ? 'Te queda' : 'Gastaste de más'} valor={Math.abs(p.teQueda)} fuerte />
            </ul>
            {reservas && (reservas.equivalente.mostrar ? reservas.equivalente.ars : reservas.total) > 0 ? (
              <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--label2)' }}>
                Aparte, en tus reservas (Alcancía) tenés {pesos(reservas.equivalente.mostrar ? reservas.equivalente.ars : reservas.total)}
                {reservas.equivalente.mostrar && !reservas.equivalente.completo ? ` (sin contar ${reservas.equivalente.faltan.join(', ')})` : ''}. No se resta de lo que te queda.
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
