import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle } from 'lucide-react';
import Seg from '../ui/Seg.jsx';
import Hoja from '../ui/Hoja.jsx';
import LineaDeTiempoPlanes, { TAG } from '../ui/LineaDeTiempoPlanes.jsx';
import DetallePlan from '../ui/DetallePlan.jsx';
import useCompacto, { useMedia } from '../ui/useCompacto.js';
import { identidades, identidadTarjeta } from '../ui/identidad.js';
import { pesos, mesLargo, nombreMes, capitalizar } from '../ui/formato.js';
import { sumarMeses } from '../services/mes.js';
import { lineaDeTiempo, resumenPlanes, proximasCuotas, cuotasDelPlan, ordenarPorFin } from '../services/planes-vista.js';

/**
 * Cuotas: cuándo termina cada plan, cuánta plata se libera, y qué hacer con los
 * planes que el banco dejó de facturar. La lógica vive en services/planes-vista.js.
 */

const FILTROS = [
  { id: 'en_curso', label: 'En curso' },
  { id: 'a_revisar', label: 'A revisar' },
  { id: 'terminados', label: 'Terminados' },
  { id: 'todos', label: 'Todos' }
];
const PASA = {
  en_curso: (f) => f.estado === 'vigente' || f.estado === 'ultima',
  a_revisar: (f) => f.estado === 'a_revisar',
  terminados: (f) => f.estado === 'terminado',
  todos: () => true
};

// Celular: una barra por plan, un segmento por cuota (hasta 24; con más, barra continua).
const BarraCuotas = ({ cuotas, color, estado }) => {
  if (cuotas.length > 24) {
    const pagadas = cuotas.filter((c) => c.estado === 'pagada').length;
    const pct = Math.round((pagadas / cuotas.length) * 100);
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{ flexGrow: 1, height: 8, borderRadius: 4, background: 'var(--fill)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: 8, width: `${pct}%`, background: color }} />
        </span>
        <span className="cap">{pct} %</span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" style={{ display: 'flex', gap: 2 }}>
      {cuotas.map((c) => (
        <span
          key={c.numero}
          className={c.estado === 'este_mes' && estado !== 'a_revisar' ? 'rayado-tramo' : ''}
          style={{
            flex: 1, height: 8, borderRadius: 2, boxSizing: 'border-box',
            backgroundColor: estado === 'a_revisar' && c.estado !== 'pagada' ? 'transparent' : color,
            border: estado === 'a_revisar' && c.estado !== 'pagada' ? `1px dashed ${color}` : 'none',
            opacity: c.estado === 'falta' && estado !== 'a_revisar' ? 0.3 : 1
          }}
        />
      ))}
    </span>
  );
};

const CuotasView = ({
  planes = [],
  hoyMesKey,
  desfase = {},
  cotizacionVenta = 0,
  tarjetas = [],
  nombresTarjetas = {},
  busqueda = '',
  planElegido = null,
  decisiones = [],
  onDecidir,
  onDeshacer,
  oscuro = true
}) => {
  const compacto = useCompacto();
  const angosto = useMedia('(max-width: 1100px)');
  const usarHoja = compacto || angosto;
  const [filtro, setFiltro] = useState('en_curso');
  const [elegido, setElegido] = useState(planElegido);
  const [hoja, setHoja] = useState(false);
  const [aviso, setAviso] = useState(null); // { texto, id }
  const filasRef = useRef(new Map());

  const opts = { hoyMesKey, desfase, cotizacionVenta };
  const datos = useMemo(() => lineaDeTiempo(planes, opts), [planes, hoyMesKey, desfase, cotizacionVenta]); // eslint-disable-line react-hooks/exhaustive-deps
  const cifras = useMemo(() => resumenPlanes(planes, opts), [planes, hoyMesKey, desfase, cotizacionVenta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entrada desde "Ver plan en Cuotas": mostrar ese plan aunque no esté en el filtro.
  useEffect(() => {
    if (!planElegido) return;
    setElegido(planElegido);
    const f = datos.filas.find((x) => x.planId === planElegido);
    if (f && !PASA[filtro](f)) setFiltro('todos');
    if (usarHoja && f) setHoja(true);
  }, [planElegido]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const ids = useMemo(() => identidades(tarjetas), [tarjetas]);
  const idDe = (nombre) => ids.get(nombre) || identidadTarjeta({ nombre }, 0);
  const colorDe = (nombre) => { const i = idDe(nombre); return oscuro ? i.chartOscuro : i.chartClaro; };
  const nombreTarjeta = (nombre) => {
    const t = tarjetas.find((x) => x.nombre === nombre);
    if (t) return nombresTarjetas[t.id] || nombre;
    // Tarjeta que solo existe por Últimos consumos ('live:<grupoKey>'): su nombre
    // personalizado o banco + red.
    return nombresTarjetas[nombre] || planes.find((p) => p.tarjeta === nombre)?.tarjeta_label || nombre;
  };

  const q = busqueda.toLowerCase();
  const filas = useMemo(() => ordenarPorFin(datos.filas
    .filter(PASA[filtro])
    .filter((f) => !q || f.plan.descripcion?.toLowerCase().includes(q) || f.plan.tarjeta?.toLowerCase().includes(q))),
  [datos, filtro, q]);

  const sel = filas.find((f) => f.planId === elegido) || (usarHoja ? null : filas[0] || null);
  const decisionDe = (f) => decisiones.filter((d) => d.claveDePlan === f.plan.clave || f.plan.alias?.includes(d.claveDePlan)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null;

  const elegir = (id) => { setElegido(id); if (usarHoja) setHoja(true); };
  const cerrarHoja = () => {
    setHoja(false);
    const el = sel && filasRef.current.get(sel.planId);
    if (el) setTimeout(() => el.focus(), 0);
  };

  const decidir = async (f, decision) => {
    const id = await onDecidir?.(f.plan, decision);
    setAviso({ texto: `Listo: ${f.plan.descripcion} quedó como ${decision === 'terminado' ? 'terminado' : 'vigente'}.`, id });
  };
  const deshacer = async (id) => {
    await onDeshacer?.(id);
    setAviso(null);
  };

  // ---------- frase ----------
  const mes = nombreMes(hoyMesKey);
  const proximo = nombreMes(sumarMeses(hoyMesKey, 1));
  const libera = cifras.seLiberaProximoMes;
  const liberaTotal = libera.reduce((s, x) => s + x.monto, 0);
  const Frase = (
    <p style={{ margin: 0, fontSize: compacto ? 19 : 22, lineHeight: compacto ? '26px' : '30px', letterSpacing: '-.01em', color: 'var(--label2)', maxWidth: 1000 }}>
      {cifras.restante > 0 ? (
        <>Después de {mes} te quedan <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{pesos(cifras.restante)}</strong> en cuotas{cifras.restanteEstimado ? ' (con dólares estimados)' : ''}.</>
      ) : (
        <>Después de {mes} no te quedan cuotas por pagar.</>
      )}
      {libera.length > 0 && (
        <> En {proximo} terminás {libera.length === 1 ? libera[0].descripcion : `${libera.length} planes`} y liberás <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{pesos(liberaTotal)} por mes</strong>.</>
      )}
      {cifras.terminaUltimo && cifras.terminaUltimo !== hoyMesKey && (
        <> El último plan termina en <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{mesLargo(cifras.terminaUltimo)}</strong>.</>
      )}
    </p>
  );

  const cifra = (label, valor, sub) => (
    <div style={{ background: 'var(--fill2)', borderRadius: 20, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span className="cap" style={{ fontSize: 13 }}>{label}</span>
      <span className="rnd" style={{ fontSize: compacto ? 20 : 24, fontWeight: 700, whiteSpace: 'nowrap' }}>{valor}</span>
      <span className="cap">{sub}</span>
    </div>
  );
  const Cifras = (
    <div style={{ display: 'grid', gridTemplateColumns: compacto ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: 14 }}>
      {cifra('En curso', `${cifras.enCurso} ${cifras.enCurso === 1 ? 'plan' : 'planes'}`, cifras.ultimasEsteMes ? `${cifras.ultimasEsteMes} con última cuota este mes` : 'ninguno termina este mes')}
      {cifra('Este mes', pesos(cifras.esteMes), `en ${cifras.tarjetasEsteMes} ${cifras.tarjetasEsteMes === 1 ? 'tarjeta' : 'tarjetas'}`)}
      {cifra('Restante', pesos(cifras.restante), `después de ${mes}`)}
      {cifra('A revisar', `${cifras.aRevisar} ${cifras.aRevisar === 1 ? 'plan' : 'planes'}`, cifras.aRevisar ? 'el banco dejó de facturarlos' : 'nada pendiente')}
    </div>
  );

  const Leyenda = !compacto && (
    <div className="cap" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '12px 10px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 8, borderRadius: 4, background: 'var(--label2)' }} />Pagado</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 8, borderRadius: 2, background: 'repeating-linear-gradient(45deg,var(--label2) 0 2px,transparent 2px 4px)' }} />Este mes</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 8, borderRadius: 4, background: 'var(--label2)', opacity: 0.3 }} />Falta pagar</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 8, borderRadius: 4, border: '1.5px dashed var(--label2)', boxSizing: 'border-box' }} />No se proyecta</span>
      <span>El color es la tarjeta.</span>
    </div>
  );

  const vacio = filas.length === 0 && (
    <p className="cap" style={{ fontSize: 15, margin: '16px 10px' }}>
      {q ? 'No hay planes con esa búsqueda.' : filtro === 'a_revisar' ? 'No hay planes para revisar.' : filtro === 'terminados' ? 'No hay planes terminados.' : 'No tenés compras en cuotas en curso.'}
    </p>
  );

  const ListaCompacta = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {filas.map((f) => {
        const [tag] = TAG[f.estado] || [];
        return (
          <button
            key={f.planId}
            ref={(el) => { if (el) filasRef.current.set(f.planId, el); else filasRef.current.delete(f.planId); }}
            type="button"
            onClick={() => elegir(f.planId)}
            aria-label={`${f.plan.descripcion}, ${tag ? tag.toLowerCase() : 'en curso'}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 8px', borderBottom: '0.5px solid var(--sep)', color: 'var(--label)', textAlign: 'left', width: '100%', opacity: f.estado === 'terminado' ? 0.6 : 1, minHeight: 44 }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="chip-plastico" aria-hidden="true" style={{ background: idDe(f.plan.tarjeta).plastico }} />
              <span style={{ flexGrow: 1, minWidth: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.plan.descripcion}</span>
              <span className="rnd" style={{ fontWeight: 600 }}>{f.restante > 0 ? pesos(f.restante) : '—'}</span>
            </span>
            <BarraCuotas cuotas={cuotasDelPlan(f.plan, opts)} color={colorDe(f.plan.tarjeta)} estado={f.estado} />
            <span className="cap">
              {(f.plan.cuotas_pagadas ?? f.plan.cuota_actual)}/{f.plan.total_cuotas} · {f.estado === 'a_revisar' ? 'a revisar: no se proyecta' : f.estado === 'terminado' ? `terminó en ${mesLargo(f.fin)}` : f.estado === 'ultima' ? 'última cuota este mes' : `termina en ${mesLargo(f.fin)}`}
            </span>
          </button>
        );
      })}
    </div>
  );

  const detalle = sel && (
    <DetallePlan
      fila={sel}
      identidad={idDe(sel.plan.tarjeta)}
      color={colorDe(sel.plan.tarjeta)}
      nombreTarjeta={nombreTarjeta(sel.plan.tarjeta)}
      cuotas={cuotasDelPlan(sel.plan, opts)}
      proximas={proximasCuotas(sel.plan, opts)}
      hoyMesKey={hoyMesKey}
      decisionId={decisionDe(sel)?.id || null}
      onDecidir={decidir}
      onDeshacer={deshacer}
    />
  );

  const avisoFlotante = aviso && createPortal(
    <div className="aviso-flotante vidrio entra" role="status">
      <CheckCircle size={18} aria-hidden="true" style={{ color: 'var(--ok)', flexShrink: 0 }} />
      <span style={{ flexGrow: 1 }}>{aviso.texto}</span>
      {aviso.id && <button type="button" className="btn" onClick={() => deshacer(aviso.id)} style={{ minHeight: 36 }}>Deshacer</button>}
    </div>,
    document.body
  );

  const Encabezado = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: compacto ? 'stretch' : 'flex-end', gap: compacto ? 12 : 20, flexDirection: compacto ? 'column' : 'row' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label2)' }}>Planes en cuotas</span>
        <h1 className="titulo">Cuotas</h1>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <Seg ariaLabel="Estado" valor={filtro} onCambio={setFiltro} opciones={FILTROS.map((f) => ({ ...f, label: f.id === 'a_revisar' && cifras.aRevisar ? `${f.label} (${cifras.aRevisar})` : f.label }))} />
      </div>
    </div>
  );

  if (usarHoja) {
    return (
      <section className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {Encabezado}
        {Frase}
        {Cifras}
        {compacto ? ListaCompacta : (
          <LineaDeTiempoPlanes datos={datos} filas={filas} identidadDe={idDe} colorDe={colorDe} nombreTarjeta={nombreTarjeta} elegido={null} onElegir={elegir} />
        )}
        {vacio}
        {Leyenda}
        <Hoja abierta={hoja && !!sel} onCerrar={cerrarHoja} titulo="Plan en cuotas">{detalle}</Hoja>
        {avisoFlotante}
      </section>
    );
  }

  return (
    <section className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Encabezado}
      {Frase}
      {Cifras}
      <div>
        <LineaDeTiempoPlanes datos={datos} filas={filas} identidadDe={idDe} colorDe={colorDe} nombreTarjeta={nombreTarjeta} elegido={sel?.planId} onElegir={elegir} />
        {vacio}
        {Leyenda}
      </div>
      {detalle && (
        <div style={{ padding: '22px 24px', borderRadius: 24, background: 'var(--fill2)' }} aria-label="Detalle del plan" role="region">
          {detalle}
        </div>
      )}
      {avisoFlotante}
    </section>
  );
};

export default CuotasView;
