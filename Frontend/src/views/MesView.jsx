import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, AlertTriangle, Plus } from 'lucide-react';
import Capsula from '../ui/Capsula.jsx';
import Seg from '../ui/Seg.jsx';
import useCompacto from '../ui/useCompacto.js';
import { identidades, identidadTarjeta, ordenApilado } from '../ui/identidad.js';
import EvolucionChart from '../ui/EvolucionChart.jsx';
import DetalleMes from '../ui/DetalleMes.jsx';
import { sumarMeses } from '../services/mes.js';
import { hoyISO } from '../services/consumos/comun.js';
import { pesos, dolares, nombreMes, capitalizar, mesCorto, diaCorto, diaLargo, hoyLargo, momento, mesLargo } from '../ui/formato.js';

/**
 * Sección Mes: cuánto del próximo pago ya está comprometido y cuánto queda libre
 * hasta el tope. Los números llegan calculados (services/mes.js); acá solo se dibujan.
 */

const TOPE_PASO = 50000;

// ---------- piezas chicas ----------

const Swatch = ({ color, punteado = false }) => (
  <span
    aria-hidden="true"
    style={{
      width: 10, height: 10, borderRadius: 3, flexShrink: 0, boxSizing: 'border-box',
      background: punteado ? 'transparent' : color,
      border: punteado ? '1.5px dashed var(--label2)' : 'none'
    }}
  />
);

const Chip = ({ fondo }) => (
  <span className="chip-plastico" aria-hidden="true" style={{ background: fondo }} />
);

const Encabezado = ({ titulo, extra }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 4, gap: 12 }}>
    <h3 className="h3">{titulo}</h3>
    {extra ? <span className="cap">{extra}</span> : null}
  </div>
);

const filaEstilo = {
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 40,
  borderBottom: '0.5px solid var(--sep)', fontSize: 14
};

const MiniPlastico = ({ fondo, multi }) => (
  <span aria-hidden="true" style={{ position: 'relative', width: 34, height: 22, flexShrink: 0 }}>
    {multi && <span style={{ position: 'absolute', left: 8, top: 0, width: 26, height: 17, borderRadius: 4, background: fondo, opacity: 0.55 }} />}
    <span style={{ position: 'absolute', left: 0, top: 5, width: 26, height: 17, borderRadius: 4, background: fondo, boxShadow: '0 2px 6px rgba(0,0,0,.25)' }} />
  </span>
);

// ---------- tope ----------

const TopeControl = ({ tope, maximo, onCambio, onQuitar, compacto = false }) => {
  const tactil = compacto ? 44 : 28;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');

  const confirmar = () => {
    const n = Math.round(Number(String(texto).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')));
    if (n > 0) onCambio(n, { inmediato: true });
    setEditando(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="cap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>Tope mensual</span>
        {editando ? (
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Tope mensual en pesos"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmar();
              if (e.key === 'Escape') { e.stopPropagation(); setEditando(false); }
            }}
            style={{ width: 120, height: 28, borderRadius: 8, border: 0, background: 'var(--fill)', padding: '0 8px', font: 'inherit', fontWeight: 600, color: 'var(--label)', textAlign: 'right' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => { setTexto(String(tope)); setEditando(true); }}
            aria-label={`Tope mensual ${pesos(tope)}. Tocá para escribirlo`}
            style={{ fontWeight: 600, color: 'var(--label)', minHeight: tactil, padding: '0 4px', borderRadius: 8 }}
          >
            {pesos(tope)}
          </button>
        )}
      </span>
      <input
        type="range"
        min={TOPE_PASO}
        max={maximo}
        step={TOPE_PASO}
        value={Math.min(tope, maximo)}
        onChange={(e) => onCambio(Number(e.target.value))}
        aria-label="Tope mensual"
        aria-valuetext={pesos(tope)}
        style={{ width: '100%', height: tactil, accentColor: 'var(--r2)', margin: 0 }}
      />
      <button type="button" className="cap" onClick={onQuitar} style={{ alignSelf: 'flex-end', minHeight: tactil, padding: '0 4px', borderRadius: 8 }}>
        Quitar tope
      </button>
    </div>
  );
};

// ---------- pregunta de fijos ----------

const OPCIONES = {
  cambio_monto: [['mismo', 'Sí, es fijo', true], ['otro', 'No, fue un extra', false]],
  faltante: [['baja', 'Sí, lo di de baja', true], ['sigue', 'No, sigue', false]]
};

const monto = (valor, moneda) => (moneda === 'USD' ? dolares(valor) : pesos(valor));

function textoPregunta(p) {
  if (p.tipo === 'cambio_monto') {
    const antes = p.ultimo?.monto || 0;
    const despues = p.candidato?.monto || 0;
    const variacion = antes ? Math.round(((despues - antes) / antes) * 100) : null;
    return (
      <>
        <strong style={{ fontWeight: 600 }}>{p.nombre}</strong> pasó de {monto(antes, p.moneda)} a {monto(despues, p.moneda)}
        {variacion !== null ? ` (${variacion > 0 ? '+' : ''}${variacion} %)` : ''}. ¿Lo sigo contando como fijo?
      </>
    );
  }
  return (
    <>
      No encontré <strong style={{ fontWeight: 600 }}>{p.nombre}</strong> en el último resumen de {p.tarjeta}. ¿Lo diste de baja?
    </>
  );
}

function textoListo(p, respuesta) {
  if (respuesta === 'mismo') return `Listo: ${p.nombre} sigue como fijo.`;
  if (respuesta === 'otro') return `Listo: ese cargo de ${p.nombre} cuenta como un extra.`;
  if (respuesta === 'baja') return `Listo: ${p.nombre} ya no cuenta como fijo.`;
  if (respuesta === 'sigue') return `Listo: ${p.nombre} sigue como fijo.`;
  return 'Listo.';
}

const PreguntaFijos = ({ preguntas = [], onResponder, onDeshacer }) => {
  const [hecho, setHecho] = useState(null); // { texto, ids }
  const [enviando, setEnviando] = useState(false);
  const p = preguntas[0];
  if (!p && !hecho) return null;

  const responder = async (respuesta) => {
    setEnviando(true);
    try {
      const ids = await onResponder?.(p, respuesta);
      setHecho({ texto: textoListo(p, respuesta), ids: ids || [] });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ padding: 16, borderRadius: 18, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {hecho && (
        <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15 }}>{hecho.texto}</span>
          {hecho.ids.length > 0 && (
            <button type="button" className="btn" onClick={async () => { await onDeshacer?.(hecho.ids); setHecho(null); }}>
              Deshacer
            </button>
          )}
        </div>
      )}
      {p && (
        <>
          <span style={{ fontSize: 15, lineHeight: '21px' }}>{textoPregunta(p)}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(OPCIONES[p.tipo] || OPCIONES.faltante).map(([resp, label, pri]) => (
              <button key={resp} type="button" disabled={enviando} className={`btn ${pri ? 'btn-pri' : ''}`} onClick={() => responder(resp)} style={{ minHeight: 44 }}>
                {label}
              </button>
            ))}
            <button type="button" disabled={enviando} className="btn" onClick={() => responder('omitir')} style={{ minHeight: 44, background: 'transparent', color: 'var(--label2)' }}>
              Después
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ---------- vista ----------

const MesView = ({
  ciclo,
  composicion: comp,
  proximo,
  planesDelMes = [],
  planesProximo = [],
  porTarjetaProximo = [],
  fijos,
  preguntas = [],
  onResponderPregunta,
  onDeshacerPregunta,
  tope = null,
  onTope,
  onAbrirTarjeta,
  onImportar,
  tarjetas = [],
  oscuro = true,
  evolucion = null
}) => {
  const compacto = useCompacto();
  const [vista, setVista] = useState('ciclo');
  const [topeLocal, setTopeLocal] = useState(tope);
  const guardarRef = useRef(null);

  useEffect(() => { setTopeLocal(tope); }, [tope]);
  useEffect(() => () => clearTimeout(guardarRef.current), []);

  const cambiarTope = (valor, { inmediato = false } = {}) => {
    setTopeLocal(valor);
    clearTimeout(guardarRef.current);
    if (inmediato) onTope?.(valor);
    else guardarRef.current = setTimeout(() => onTope?.(valor), 300);
  };
  const quitarTope = () => { clearTimeout(guardarRef.current); setTopeLocal(null); onTope?.(null); };

  // Identidades: las tarjetas de la lista (orden de alta) + las que solo aparecen en el
  // historial (dadas de baja) o en Últimos consumos sin tarjeta, agregadas al final
  // para no repintar las demás.
  const extras = useMemo(() => {
    const conocidas = new Set(tarjetas.map(t => t.nombre));
    const vistas = new Map();
    ciclo.porTarjeta.forEach(t => { if (!conocidas.has(t.tarjetaId)) vistas.set(t.tarjetaId, { nombre: t.tarjetaId, banco: t.banco, red: t.red, etiqueta: t.nombre }); });
    (evolucion?.columnas || []).forEach(c => Object.keys(c.porTarjeta).forEach(id => {
      if (!conocidas.has(id) && !vistas.has(id)) vistas.set(id, { nombre: id });
    }));
    return [...vistas.values()];
  }, [tarjetas, ciclo, evolucion]);
  const ids = useMemo(() => identidades([...tarjetas, ...extras]), [tarjetas, extras]);
  const idDe = (tarjetaId, extra = {}) => ids.get(tarjetaId) || identidadTarjeta({ nombre: tarjetaId, ...extra }, 0);

  // ----- Evolución y proyección (fase 2) -----
  const [modoEvo, setModoEvo] = useState('tarjeta');
  const [vistaEvo, setVistaEvo] = useState('grafico');
  const [selEvo, setSelEvo] = useState(null);
  const columnasEvo = evolucion?.columnas || [];
  const selDefault = columnasEvo.findIndex(c => c.tipo === 'comprometido');
  const seleccionEvo = selEvo ?? (selDefault >= 0 ? selDefault : columnasEvo.length - 1);
  const seriesEvo = useMemo(() => {
    const usados = new Set(columnasEvo.flatMap(c => Object.keys(c.porTarjeta).filter(k => c.porTarjeta[k] > 0)));
    const lista = [...tarjetas, ...extras].filter(t => usados.has(t.nombre));
    return {
      tarjeta: ordenApilado(lista).map(t => {
        const id = ids.get(t.nombre);
        return { id: t.nombre, nombre: t.etiqueta || t.nombre, color: oscuro ? id.chartOscuro : id.chartClaro };
      }),
      tipo: [
        { id: 'cuotas', nombre: 'Cuotas', color: 'var(--r1)' },
        { id: 'fijos', nombre: 'Fijos', color: 'var(--r2)' },
        { id: 'variables', nombre: 'Variables', color: 'var(--r3)' }
      ]
    };
  }, [columnasEvo, tarjetas, extras, ids, oscuro]);

  const esCiclo = vista === 'ciclo';
  const mesKey = esCiclo ? ciclo.mesKey : sumarMeses(ciclo.mesKey, 1);
  const mes = nombreMes(mesKey);
  const c = esCiclo ? comp : proximo;
  const total = c.total;
  const topeVal = topeLocal > 0 ? topeLocal : null;
  const libreVal = topeVal !== null ? Math.round((topeVal - total) * 100) / 100 : null;
  const pasado = libreVal !== null && libreVal < 0;
  const escala = Math.max(topeVal || 0, total, 1);

  // Slider: el máximo sale del total y del tope guardado (no del que se está moviendo).
  const maximo = Math.max(1000000, Math.ceil((Math.max(total * 2, (tope || 0) * 1.5)) / 500000) * 500000);

  const sinNada = esCiclo && total === 0 && ciclo.porTarjeta.every(t => t.fuente === 'sin_datos');
  const inconsistente = c.avisos?.some(a => a.tipo === 'datos_inconsistentes');

  // ----- frase -----
  const colorLibre = pasado ? 'var(--danger)' : 'var(--label)';
  const Frase = (
    <p style={{ margin: 0, fontSize: compacto ? 19 : 22, lineHeight: compacto ? '26px' : '30px', letterSpacing: '-.01em', maxWidth: 1000, color: 'var(--label2)' }}>
      {esCiclo ? (
        topeVal !== null
          ? <>Tu tope para {mes} es {pesos(topeVal)}. Ya hay <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{pesos(total)}</strong> en camino{pasado ? ':' : ', te quedan'} </>
          : <>Ya hay <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{pesos(total)}</strong> en camino para {mes}.</>
      ) : (
        <>{capitalizar(mes)} arranca con <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{pesos(total)}</strong> comprometidos antes de gastar un peso{topeVal === null ? '.' : pasado ? ':' : '. Te quedan'} </>
      )}
      {topeVal !== null && (
        <strong style={{ color: colorLibre, fontWeight: 700, display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          {pasado && <AlertTriangle size={18} aria-hidden="true" style={{ alignSelf: 'center' }} />}
          {pasado ? `te pasás por ${pesos(-libreVal)}.` : `${pesos(libreVal)}.`}
        </strong>
      )}
    </p>
  );

  const CapsulaMes = (
    <Capsula
      escala={escala}
      tope={topeVal}
      alto={compacto ? 52 : 64}
      ariaLabel={`Cuotas ${pesos(c.cuotas)}, fijos ${pesos(c.fijos)}, variables ${pesos(c.variables)}${topeVal !== null ? `, tope ${pesos(topeVal)}` : ''}`}
      segmentos={[
        { valor: c.cuotas, color: 'var(--r1)', textoColor: 'var(--t1)', label: 'Cuotas' },
        { valor: c.fijos, color: 'var(--r2)', textoColor: 'var(--t2)', label: 'Fijos' },
        { valor: c.variables, color: 'var(--r3)', textoColor: 'var(--t3)', label: 'Variables' }
      ]}
    />
  );

  const item = (swatch, label, valor, extra = null, color = 'var(--label)', peso = 600) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="cap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{swatch}{label}</span>
      <span className="rnd" style={{ fontSize: 18, fontWeight: peso, color, whiteSpace: 'nowrap' }}>
        {valor}
        {extra && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--label2)' }}> {extra}</span>}
      </span>
    </div>
  );

  const Leyenda = (
    <div style={{ display: 'grid', gridTemplateColumns: compacto ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: compacto ? 14 : 20, alignItems: 'end' }}>
      {item(<Swatch color="var(--r1)" />, 'Cuotas · ya firmadas', pesos(c.cuotas))}
      {item(<Swatch color="var(--r2)" />, 'Fijos · se repiten', pesos(c.fijos), c.fijosUsd > 0 ? `+ ${dolares(c.fijosUsd)}` : null)}
      {item(<Swatch color="var(--r3)" />, esCiclo ? 'Variables · en curso' : 'Variables · ya consumido', pesos(c.variables))}
      {topeVal !== null
        ? item(<Swatch punteado />, pasado ? 'Te pasás del tope' : 'Libre hasta el tope', pasado ? `− ${pesos(-libreVal)}` : pesos(libreVal), null, colorLibre, 700)
        : <div />}
    </div>
  );

  const Tope = topeVal !== null ? (
    <TopeControl tope={topeVal} maximo={maximo} onCambio={cambiarTope} onQuitar={quitarTope} compacto={compacto} />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: compacto ? 'stretch' : 'flex-start' }}>
      <span className="cap">Sin tope mensual</span>
      <button
        type="button"
        className="btn"
        style={{ minHeight: 44 }}
        onClick={() => cambiarTope(Math.max(TOPE_PASO, Math.ceil((total * 1.1 || 1000000) / 100000) * 100000), { inmediato: true })}
      >
        Poné un tope
      </button>
    </div>
  );

  const Aviso = inconsistente ? (
    <p role="note" style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: 'var(--warn)' }}>
      <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      Las cuotas y los fijos suman más que lo que muestran tus resúmenes y Últimos consumos de este ciclo. Puede faltar importar algo: variables quedó en 0.
    </p>
  ) : null;

  // ----- columnas -----
  const planes = esCiclo ? planesDelMes : planesProximo;
  const Cuotas = (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }} aria-label="Cuotas del mes">
      <Encabezado titulo="Comprometido · cuotas" extra={`${planes.length} ${planes.length === 1 ? 'plan' : 'planes'}`} />
      {planes.length === 0 && <p className="cap" style={{ margin: '6px 0' }}>No hay cuotas que se paguen en {mes}.</p>}
      {planes.map((q, i) => (
        <div key={`${q.id || q.descripcion}-${i}`} style={filaEstilo}>
          <Chip fondo={idDe(q.tarjeta).plastico} />
          <span style={{ flexGrow: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {q.descripcion} · {q.cuota_numero}/{q.total_cuotas}
          </span>
          <span className="cap" style={{ width: 78, textAlign: 'right', flexShrink: 0 }}>{q.es_ultima ? 'última' : `hasta ${mesCorto(q.hasta)}`}</span>
          <span style={{ width: 96, textAlign: 'right', fontWeight: 500, flexShrink: 0 }}>
            {q.es_estimado_usd ? dolares(q.monto_dolares) : pesos(q.monto)}
          </span>
        </div>
      ))}
    </section>
  );

  const itemsFijos = fijos?.items || [];
  const Fijos = (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }} aria-label="Gastos fijos">
      <Encabezado titulo="Recurrente · fijos" extra={`${itemsFijos.length} ${itemsFijos.length === 1 ? 'detectado' : 'detectados'}`} />
      {itemsFijos.length === 0 && <p className="cap" style={{ margin: '6px 0' }}>Todavía no detecté gastos fijos.</p>}
      {itemsFijos.map((f) => (
        <div key={f.serie_id} style={filaEstilo}>
          <Chip fondo={idDe(f.tarjeta).plastico} />
          <span style={{ flexGrow: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</span>
          <span className="cap" style={{ width: 70, textAlign: 'right', flexShrink: 0 }}>{f.meses} {f.meses === 1 ? 'mes' : 'meses'}</span>
          <span style={{ width: 96, textAlign: 'right', fontWeight: 500, flexShrink: 0 }}>{monto(f.montoTipico, f.moneda)}</span>
        </div>
      ))}
    </section>
  );

  const Pregunta = (
    <PreguntaFijos preguntas={preguntas} onResponder={onResponderPregunta} onDeshacer={onDeshacerPregunta} />
  );

  const filasCurso = (esCiclo ? ciclo.porTarjeta : porTarjetaProximo.filter(t => t.fuente !== 'sin_datos'));
  const totalCurso = filasCurso.reduce((s, t) => s + (t.total || 0), 0);
  // Para "Próximo mes" sin datos: el ciclo siguiente de cada tarjeta arranca el día
  // después de su cierre actual. Si ese cierre ya pasó, el ciclo ya está abierto.
  const cierres = ciclo.porTarjeta
    .filter(t => t.fuente !== 'sin_datos' && t.cierre)
    .sort((a, b) => a.cierre.localeCompare(b.cierre));
  const yaAbierto = cierres.find(t => t.cierre < hoyISO());
  const primerCierre = cierres.find(t => t.cierre >= hoyISO());

  const metaDe = (t) => {
    if (t.fuente === 'sin_datos') return 'Sin datos de este ciclo · Importá Últimos consumos';
    if (t.fuente === 'resumen_cerrado') return `resumen cerrado · vence ${diaCorto(t.vencimiento)}`;
    if (t.plasticos.length > 1) return `${t.plasticos.length} plásticos · vence ${diaCorto(t.vencimiento)}`;
    return `cierra ${diaCorto(t.cierre)} · vence ${diaCorto(t.vencimiento)}`;
  };

  const fuentes = (() => {
    const partes = [];
    const vivos = ciclo.porTarjeta.filter(t => t.fuente === 'en_curso');
    const ultimo = vivos.map(t => t.actualizado).filter(Boolean).sort().pop();
    if (vivos.length) partes.push(`Últimos consumos${ultimo ? ` de ${momento(ultimo)}` : ''}`);
    ciclo.porTarjeta.filter(t => t.fuente === 'resumen_cerrado').forEach(t => partes.push(`resumen cerrado de ${t.nombre}`));
    return partes.join(' · ');
  })();

  const EnCurso = (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }} aria-label="En curso por tarjeta">
      <Encabezado titulo="En curso · por tarjeta" extra={filasCurso.length ? pesos(totalCurso) : (esCiclo ? null : 'sin ciclos abiertos')} />
      {!esCiclo && !proximo.abierto ? (
        <>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: '22px', color: 'var(--label2)' }}>
            {yaAbierto ? (
              <>Todavía no hay consumos importados de ciclos que se paguen en {mes}. El de {yaAbierto.nombre} arrancó el <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{diaLargo(sumarDia(yaAbierto.cierre))}</strong>: importá sus Últimos consumos para verlo acá.</>
            ) : (
              <>
                Todavía no abrió ningún ciclo que se pague en {mes}.
                {primerCierre && (
                  <> El primero arranca el <strong style={{ color: 'var(--label)', fontWeight: 600 }}>{diaLargo(sumarDia(primerCierre.cierre))}</strong>, el día después del cierre de {primerCierre.nombre}.</>
                )}
              </>
            )}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: '22px', color: 'var(--label2)' }}>
            Todo lo de arriba ya está firmado: cuotas y fijos que van a aparecer sí o sí.
          </p>
        </>
      ) : (
        <>
          {filasCurso.map((t) => {
            const id = idDe(t.tarjetaId, { banco: t.banco, red: t.red });
            const sinDatos = t.fuente === 'sin_datos';
            const color = oscuro ? id.chartOscuro : id.chartClaro;
            return (
              <button
                key={t.tarjetaId}
                type="button"
                onClick={() => (sinDatos ? onImportar?.() : onAbrirTarjeta?.(t.tarjetaId))}
                aria-label={sinDatos ? `${t.nombre}: sin datos de este ciclo. Importar Últimos consumos` : `Abrir ${t.nombre} en Tarjetas`}
                className="fila"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '10px 8px', borderBottom: '0.5px solid var(--sep)', borderRadius: 0, textAlign: 'left', color: 'var(--label)', minHeight: 56 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <MiniPlastico fondo={id.plastico} multi={t.plasticos.length > 1} />
                  <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t.nombre}</span>
                    <span className="cap">{metaDe(t)}</span>
                  </span>
                  {!sinDatos && (
                    <span className="rnd" style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {pesos(t.total)}
                      {t.totalUsd > 0 && <span className="cap" style={{ display: 'block' }}>+ {dolares(t.totalUsd)}</span>}
                    </span>
                  )}
                  {sinDatos
                    ? <Plus size={14} aria-hidden="true" style={{ opacity: 0.55, flexShrink: 0 }} />
                    : <ChevronRight size={14} aria-hidden="true" style={{ opacity: 0.45, flexShrink: 0 }} />}
                </span>
                {t.plasticos.length > 1 && t.total > 0 && (
                  <span aria-hidden="true" style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden', marginLeft: 46, width: 'calc(100% - 66px)' }}>
                    {t.plasticos.map((p, i) => (
                      <span key={p.ult4} style={{ width: `${(p.total / t.total) * 100}%`, background: color, opacity: i === 0 ? 1 : 0.45 }} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
          {esCiclo && fuentes && <span className="cap" style={{ marginTop: 8 }}>Sale de: {fuentes}.</span>}
          {filasCurso.some(t => t.fuente !== 'sin_datos') && <span className="cap">Tocá una tarjeta para abrirla en Tarjetas.</span>}
        </>
      )}
    </section>
  );

  const nPagados = columnasEvo.filter(c => c.tipo === 'pagado').length;
  const ultimoFut = [...columnasEvo].reverse().find(c => c.tipo === 'comprometido');
  const colSel = columnasEvo[seleccionEvo];
  const Evolucion = columnasEvo.length ? (
    <section aria-label="Evolución y proyección" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: compacto ? 0 : 12, paddingTop: 24, borderTop: '0.5px solid var(--sep)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: '-.01em' }}>Evolución y proyección</h2>
        <span style={{ fontSize: 15, color: 'var(--label2)' }}>
          {nPagados > 0 ? `${nPagados} ${nPagados === 1 ? 'mes pagado' : 'meses pagados'}, ` : ''}
          {nombreMes(ciclo.mesKey)} en curso{ultimoFut ? ` y lo que ya está comprometido hasta ${mesLargo(ultimoFut.mesKey)}` : ''}.
          {modoEvo === 'tipo' ? ' Por tipo usa la detección de fijos de hoy, con tus cambios.' : ''}
        </span>
      </div>
      <EvolucionChart
        columnas={columnasEvo}
        series={seriesEvo}
        modo={modoEvo}
        onModo={setModoEvo}
        vista={vistaEvo}
        onVista={setVistaEvo}
        seleccion={seleccionEvo}
        onSeleccion={setSelEvo}
        tope={topeVal}
        compacto={compacto}
      />
      <DetalleMes
        columna={colSel}
        detalle={colSel ? evolucion.detalles?.[colSel.mesKey] : null}
        modo={modoEvo}
        series={seriesEvo}
        fijos={fijos}
        identidadDe={(id) => idDe(id)}
        subtituloCurso={fuentes ? `Estimado con ${fuentes}` : 'Estimado'}
        compacto={compacto}
      />
    </section>
  ) : null;

  const Cabecera = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: compacto ? 'stretch' : 'flex-end', gap: compacto ? 12 : 24, flexDirection: compacto ? 'column' : 'row' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label2)' }}>{hoyLargo()}</span>
        <h1 className="titulo">{capitalizar(mes)}</h1>
      </div>
      <Seg
        ariaLabel="Período"
        valor={vista}
        onCambio={setVista}
        opciones={[{ id: 'ciclo', label: 'Este ciclo' }, { id: 'proximo', label: 'Próximo mes' }]}
      />
    </div>
  );

  if (sinNada) {
    return (
      <section className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Cabecera}
        <div style={{ padding: compacto ? 20 : 32, borderRadius: 24, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
          <p style={{ margin: 0, fontSize: 19, lineHeight: '26px' }}>Importá tu primer resumen o Últimos consumos para ver cuánto se paga en {mes}.</p>
          <button type="button" className="btn btn-pri" style={{ minHeight: 44, padding: '0 18px' }} onClick={onImportar}>
            <Plus size={16} aria-hidden="true" /> Importar
          </button>
        </div>
        {itemsFijos.length > 0 || planesDelMes.length > 0 ? <>{Cuotas}{Fijos}</> : null}
      </section>
    );
  }

  if (compacto) {
    // Orden del prototipo iPhone: frase → cápsula → leyenda 2×2 → tope → pregunta →
    // En curso → (gráfico, fase 2) → cuotas → fijos.
    return (
      <section className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {Cabecera}
        {Frase}
        {CapsulaMes}
        {Leyenda}
        {Aviso}
        {Tope}
        {Pregunta}
        {EnCurso}
        {Evolucion}
        {Cuotas}
        {Fijos}
      </section>
    );
  }

  return (
    <section className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Cabecera}
      {Frase}
      {CapsulaMes}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,4fr) minmax(200px,1.3fr)', gap: 20, alignItems: 'end' }}>
        {Leyenda}
        {Tope}
      </div>
      {Aviso}
      <div style={{ height: 0.5, background: 'var(--sep)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr)' }}>
        <div style={{ paddingRight: 28, borderRight: '0.5px solid var(--sep)', minWidth: 0 }}>{Cuotas}</div>
        <div style={{ padding: '0 28px', borderRight: '0.5px solid var(--sep)', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {Fijos}
          {Pregunta}
        </div>
        <div style={{ paddingLeft: 28, minWidth: 0 }}>{EnCurso}</div>
      </div>
      {Evolucion}
    </section>
  );
};

// Día siguiente a una fecha 'YYYY-MM-DD' (sin new Date('YYYY-MM-DD')).
function sumarDia(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d + 1);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

export default MesView;
