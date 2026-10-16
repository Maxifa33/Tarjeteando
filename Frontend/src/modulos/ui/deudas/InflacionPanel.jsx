import React, { useEffect, useMemo, useState } from 'react';
import Seg from '../../../ui/Seg.jsx';
import { capitalizar, mesLargo } from '../../../ui/formato.js';
import { estadoDeuda } from '../../deudas/deudas.js';
import { referenciasInflacionTasas } from '../../deudas/repo.js';
import { resumenInflacion, compararConInflacion, licuacionAnual, armarTasas, fmtPct } from '../../deudas/inflacion.js';
import GraficoInflacion from './GraficoInflacion.jsx';
import { hoyISO } from './HojasDeuda.jsx';

const Dato = ({ titulo, valor, nota }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
    <span style={{ fontSize: 13, color: 'var(--label2)' }}>{titulo}</span>
    <span className="mod-cifra" style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700 }}>{valor}</span>
    {nota && <span style={{ fontSize: 12, color: 'var(--label2)' }}>{nota}</span>}
  </div>
);

const COLS = 'minmax(96px,1.5fr) repeat(4, minmax(50px,1fr))';
const celda = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

/**
 * Inflación (INDEC) + tus deudas contra la inflación + tasas de referencia.
 * Los datos los carga solo el cron diario de Supabase (inflacion_mensual, tasas_plazo_fijo, tasas_billeteras).
 */
const InflacionPanel = ({ deudas, pagos }) => {
  const [datos, setDatos] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [vista, setVista] = useState('grafico');
  const [filtro, setFiltro] = useState('todos');
  useEffect(() => {
    let vivo = true;
    referenciasInflacionTasas().then((d) => { if (vivo) setDatos(d); }).catch(() => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, []);

  const resumen = useMemo(() => (datos ? resumenInflacion(datos.inflacion) : null), [datos]);
  const tasas = useMemo(() => (datos ? armarTasas({ plazoFijo: datos.plazoFijo, billeteras: datos.billeteras, hoy: hoyISO() }) : []), [datos]);
  const filas = useMemo(() => tasas
    .filter((t) => filtro === 'todos' || t.tipo === filtro)
    .map((t) => ({ ...t, ...compararConInflacion(t.tna, resumen) })), [tasas, filtro, resumen]);
  const activas = deudas.filter((d) => d.estado === 'activa' && (d.moneda || 'ARS') === 'ARS' && estadoDeuda(d, pagos).saldo > 0);
  const hayUSD = deudas.some((d) => d.estado === 'activa' && d.moneda === 'USD' && estadoDeuda(d, pagos).saldo > 0);

  const cabecera = (
    <h2 id="sal-infl" className="h3" style={{ margin: 0 }}>Inflación y tasas</h2>
  );
  if (fallo) return <section aria-labelledby="sal-infl" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{cabecera}<div className="mod-aviso" role="alert">No se pudo leer la inflación. Revisá tu conexión.</div></section>;
  if (!datos) return <section aria-labelledby="sal-infl" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{cabecera}<p role="status" style={{ margin: 0, color: 'var(--label2)' }}>Cargando…</p></section>;
  if (!resumen) return <section aria-labelledby="sal-infl" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{cabecera}<p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Todavía no hay datos de inflación. Se cargan solos cada día.</p></section>;

  const { ultimo, anterior, interanual, ritmo, aprox, serie, faltantes } = resumen;
  const pp = ultimo.valor != null && anterior.valor != null ? ultimo.valor - anterior.valor : null;
  const pos = (v) => v != null && Math.round(v * 10) / 10 > 0; // lo que se ve (1 decimal) decide el color y el conteo
  const ganan = filas.filter((f) => pos(f.realInteranual)).length;
  const gananRitmo = filas.filter((f) => pos(f.realRitmo)).length;

  const deudaFila = (d) => {
    const nombre = <span style={{ fontSize: 15, fontWeight: 600 }}>{d.nombre}</span>;
    const caja = (children) => (
      <li key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px', borderRadius: 16, background: 'var(--fill2)' }}>{nombre}{children}</li>
    );
    const tna = Number(d.tasa_anual);
    if (tna > 0) {
      const c = compararConInflacion(tna, resumen);
      const mas = c.realInteranual != null && c.realInteranual > 0;
      return caja(<>
        <span style={{ fontSize: 13, color: 'var(--label2)' }}>TNA {fmtPct(tna, { dec: 0 })} → TEA {fmtPct(c.tea)}</span>
        {c.realInteranual != null && (
          <span style={{ fontSize: 13, fontWeight: 600, color: mas ? 'var(--danger)' : 'var(--label)' }}>
            {mas ? `Más cara que la inflación: costo real ${fmtPct(c.realInteranual, { signo: true })} por año` : `Más barata que la inflación: la inflación te la licúa ${fmtPct(-c.realInteranual)} por año`}
          </span>
        )}
      </>);
    }
    if (d.tipo === 'prestamo') {
      return caja(<span style={{ fontSize: 13, color: 'var(--label2)' }}>Cargá la TNA (en “Más opciones” de la deuda) para compararla con la inflación.</span>);
    }
    return caja(
      <span style={{ fontSize: 13, color: 'var(--label2)' }}>
        {interanual == null ? 'Sin TNA cargada.' : `Sin TNA cargada: si no cobra interés, la inflación achica su valor real ${fmtPct(-licuacionAnual(interanual))} por año (a tu favor).`}
      </span>
    );
  };

  return (
    <section aria-labelledby="sal-infl" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cabecera}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Fuente: INDEC (IPC nivel general nacional), publicado vía argentinadatos.com. Se actualiza solo.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
        <Dato titulo={`En ${mesLargo(ultimo.mes).split(' ')[0]}`} valor={fmtPct(ultimo.valor)}
          nota={pp == null ? null : Math.abs(pp) < 0.05 ? `Igual que hace un año (${fmtPct(anterior.valor)})` : `${Math.abs(pp).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp ${pp > 0 ? 'más' : 'menos'} que hace un año (${fmtPct(anterior.valor)})`} />
        <Dato titulo="Últimos 12 meses" valor={fmtPct(interanual)} nota={aprox ? 'Aproximado' : 'Interanual oficial'} />
        <Dato titulo="Ritmo actual" valor={fmtPct(ritmo)} nota="Últimos 3 meses, a un año" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Inflación mensual, últimos 12 meses y el mismo mes del año anterior</h3>
          <Seg ariaLabel="Vista de inflación" valor={vista} onCambio={setVista} opciones={[{ id: 'grafico', label: 'Gráfico' }, { id: 'tabla', label: 'Tabla' }]} />
        </div>
        {vista === 'grafico' ? <GraficoInflacion serie={serie} /> : (
          <div role="table" aria-label="Inflación mensual" style={{ display: 'flex', flexDirection: 'column', fontSize: 14 }}>
            {[...serie].reverse().map((p, i) => (
              <div role="row" key={p.mes} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '0.5px solid var(--sep)' }}>
                <span role="cell">{capitalizar(mesLargo(p.mes))}{i === 12 ? ' (hace un año)' : ''}</span>
                <span role="cell" className="mod-cifra" style={{ fontWeight: 600 }}>{p.valor == null ? 'Sin dato' : fmtPct(p.valor)}</span>
              </div>
            ))}
          </div>
        )}
        {faltantes > 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>{faltantes === 1 ? 'Falta 1 mes' : `Faltan ${faltantes} meses`} en la serie; el gráfico no los inventa.</p>}
      </div>

      {(activas.length > 0 || hayUSD) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Tus deudas contra la inflación</h3>
          {activas.length > 0 && <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>{activas.map(deudaFila)}</ul>}
          {hayUSD && <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>Las deudas en dólares no se comparan con la inflación en pesos.</p>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>¿Qué tasas le ganan a la inflación?</h3>
          <Seg ariaLabel="Filtrar tasas" valor={filtro} onCambio={setFiltro}
            opciones={[{ id: 'todos', label: 'Todos' }, { id: 'banco', label: 'Bancos' }, { id: 'billetera', label: 'Billeteras' }]} />
        </div>
        {filas.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Sin tasas para mostrar.</p> : (
          <>
            <p style={{ margin: 0, fontSize: 14 }}>
              {[interanual != null && `${ganan} de ${filas.length} superaron la inflación de los últimos 12 meses (${fmtPct(interanual)})`,
                ritmo != null && `${gananRitmo} de ${filas.length} superan el ritmo actual (${fmtPct(ritmo)})`].filter(Boolean).join('; ') || 'Falta inflación para comparar.'}
            </p>
            <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Tasas de referencia (desplazable)">
              <div role="table" aria-label="Tasas de referencia" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, fontSize: 13 }}>
                <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '6px 4px', fontSize: 12, fontWeight: 600, color: 'var(--label2)', borderBottom: '0.5px solid var(--sep)' }}>
                  <span role="columnheader">Entidad</span>
                  <span role="columnheader" style={celda}>TNA</span>
                  <span role="columnheader" style={celda}>TEA</span>
                  <span role="columnheader" style={celda}>Real 12m</span>
                  <span role="columnheader" style={celda}>Real hoy</span>
                </div>
                {filas.map((f) => (
                  <div role="row" key={f.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '9px 4px', alignItems: 'center', borderBottom: '0.5px solid var(--sep)' }}>
                    <span role="cell" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</span>
                      <span style={{ fontSize: 12, color: 'var(--label2)' }}>{f.producto}{f.vieja ? ' · dato desactualizado' : ''}</span>
                    </span>
                    <span role="cell" style={celda}>{fmtPct(f.tna)}</span>
                    <span role="cell" style={celda}>{fmtPct(f.tea)}</span>
                    <span role="cell" style={{ ...celda, fontWeight: 600, color: pos(f.realInteranual) ? 'var(--ok)' : 'var(--label)' }}>{fmtPct(f.realInteranual, { signo: true })}</span>
                    <span role="cell" style={{ ...celda, fontWeight: 600, color: pos(f.realRitmo) ? 'var(--ok)' : 'var(--label)' }}>{fmtPct(f.realRitmo, { signo: true })}</span>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>
              Real = lo que rinde por encima (+) o por debajo (−) de la inflación: “12 m” contra la de los últimos 12 meses, “hoy” contra el ritmo de los últimos 3 meses.
              Bancos: plazo fijo a 30 días para clientes. Billeteras: rendimiento del último día hábil, anualizado; varía a diario. La TEA supone capitalización mensual. “Superar” compara con inflación pasada: no garantiza nada a futuro. Una billetera o un fondo no tienen el mismo riesgo que un plazo fijo. Información, no asesoramiento.
            </p>
          </>
        )}
      </div>
    </section>
  );
};

export default InflacionPanel;
