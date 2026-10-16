import React, { useEffect, useRef, useState } from 'react';
import Hoja from '../../../ui/Hoja.jsx';
import { pesos, dolares } from '../../../ui/formato.js';
import { TIPOS_INVERSION, CASAS_DOLAR, SUBTIPOS_SEGURO, FRECUENCIAS, validarInversion, aTexto as cantidadTexto } from '../../alcancia/alcancia.js';
import { crearInversion, actualizarInversion, borrarInversion, buscarPrecios } from '../../alcancia/repo.js';
import { hoyISO, plata, fechaDM } from '../deudas/HojasDeuda.jsx';
import { parseMonto } from '../../cuentas/util.js';
import { Campo, DobleToque, Botonera } from './HojasMeta.jsx';
import '../modulos.css';

const BUSCA = { accion: 'Ticker (ej. GGAL, YPFD)', cedear: 'Ticker (ej. AAPL; AAPLD = en dólares)', bono: 'Ticker (ej. AL30, GD30; terminado en D = dólares)', cripto: 'BTC, ETH, USDT…', fci: 'Nombre del fondo' };
const aTexto = cantidadTexto;
const vacia = (tipo = 'cedear') => ({ tipo, nombre: '', simbolo: tipo === 'dolar' ? 'bolsa' : '', cantidad: '', moneda: 'ARS', capital: '', fecha_inicio: tipo === 'plazo_fijo' ? hoyISO() : '', tna: '', plazo_dias: tipo === 'plazo_fijo' ? '30' : '', valor_manual: '', notas: '', subtipo: tipo === 'seguro' ? 'unit_linked' : '', aseguradora: '', suma_asegurada: '', valor_rescate: '', aporte_monto: '', aporte_frecuencia: 'mensual', valor_fecha: tipo === 'seguro' ? hoyISO() : '' });

/** Buscador de ticker o fondo contra los precios del último cierre. */
const Buscador = ({ tipo, valor, onElegir }) => {
  const [q, setQ] = useState(valor || '');
  const [lista, setLista] = useState([]);
  const [estado, setEstado] = useState(null);
  const pedido = useRef(0);
  useEffect(() => { setQ(valor || ''); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = q.trim();
    const id = ++pedido.current; // cualquier respuesta anterior queda vieja
    if (!t || t === valor) { setLista([]); setEstado(null); return undefined; }
    const h = setTimeout(async () => {
      try { const r = await buscarPrecios(tipo, t); if (id === pedido.current) { setLista(r); setEstado(r.length ? null : 'Sin resultados en el último cierre.'); } }
      catch { if (id === pedido.current) setEstado('No se pudo buscar.'); }
    }, 250);
    return () => clearTimeout(h);
  }, [q, tipo, valor]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Campo label={tipo === 'fci' ? 'Fondo' : 'Ticker'}>
        <input className="mod-campo" value={q} onChange={(e) => { setQ(e.target.value); if (valor) onElegir(null); }} placeholder={BUSCA[tipo]} autoCapitalize={tipo === 'fci' ? 'words' : 'characters'} />
      </Campo>
      {valor && <span style={{ fontSize: 12, color: 'var(--label2)' }}>Elegido: {valor}</span>}
      {lista.length > 0 && (
        <ul aria-label="Resultados" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
          {lista.map((p) => (
            <li key={p.simbolo}>
              <button type="button" className="mod-mov" onClick={() => { onElegir(p); setQ(p.simbolo); setLista([]); }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.simbolo}</span>
                <span className="mod-cifra" style={{ fontSize: 14, color: 'var(--label2)' }}>{p.moneda === 'USD' ? dolares(p.precio) : pesos(p.precio, { decimales: p.precio < 100 ? 2 : 0 })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {estado && <span role="status" style={{ fontSize: 12, color: 'var(--label2)' }}>{estado}</span>}
    </div>
  );
};

/** Alta / edición de una inversión. Los campos cambian según el tipo. */
export const FormInversion = ({ abierta, inversion, onCerrar, onGuardado }) => {
  const [f, setF] = useState(() => vacia());
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const autoNombre = useRef(true); // el nombre sigue al ticker hasta que lo escribís vos
  useEffect(() => {
    if (!abierta) return;
    setError(null);
    autoNombre.current = !inversion || inversion.nombre === inversion.simbolo;
    setF(inversion ? {
      ...vacia(inversion.tipo), ...inversion, cantidad: cantidadTexto(inversion.cantidad), capital: aTexto(inversion.capital), tna: aTexto(inversion.tna),
      plazo_dias: inversion.plazo_dias ?? '', valor_manual: aTexto(inversion.valor_manual), fecha_inicio: inversion.fecha_inicio || '', simbolo: inversion.simbolo || '', notas: inversion.notas || '',
      subtipo: inversion.subtipo || (inversion.tipo === 'seguro' ? 'unit_linked' : ''), aseguradora: inversion.aseguradora || '', suma_asegurada: aTexto(inversion.suma_asegurada),
      valor_rescate: aTexto(inversion.valor_rescate), aporte_monto: aTexto(inversion.aporte_monto), aporte_frecuencia: inversion.aporte_frecuencia || 'mensual', valor_fecha: inversion.valor_fecha || ''
    } : vacia());
  }, [abierta, inversion]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const t = f.tipo;
  const conTicker = ['accion', 'cedear', 'bono', 'cripto', 'fci'].includes(t);

  const elegir = (p) => setF((x) => ({ ...x, simbolo: p ? p.simbolo : '', nombre: p && autoNombre.current ? p.simbolo : x.nombre, moneda: p ? (t === 'cripto' ? 'USD' : p.moneda) : x.moneda }));
  const guardar = async () => {
    const datos = { ...f, nombre: f.nombre || (t === 'plazo_fijo' ? 'Plazo fijo' : t === 'dolar' ? 'Dólares' : t === 'seguro' ? (f.aseguradora ? `Seguro ${f.aseguradora}` : '') : f.simbolo) };
    // Si actualizaste el valor del seguro y no tocaste la fecha, los valores son de hoy.
    if (t === 'seguro' && inversion && datos.valor_fecha === (inversion.valor_fecha || '')
      && [['valor_manual', inversion.valor_manual], ['valor_rescate', inversion.valor_rescate]].some(([k, antes]) => { const n = datos[k] === '' ? null : parseMonto(datos[k]); return n != null && n !== antes; })) datos.valor_fecha = hoyISO();
    const v = validarInversion(datos);
    if (v.error) { setError(v.error); return; }
    setOcupado(true); setError(null);
    try { await (inversion ? actualizarInversion(inversion.id, v.fila) : crearInversion(v.fila)); onGuardado?.(); onCerrar(); }
    catch { setError('No se pudo guardar. Revisá tu conexión.'); }
    finally { setOcupado(false); }
  };

  const monedaSel = (
    <select className="mod-select" value={f.moneda} onChange={set('moneda')} aria-label="Moneda de lo que pusiste"><option value="ARS">$</option><option value="USD">U$S</option></select>
  );

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={inversion ? 'Editar inversión' : 'Nueva inversión'}>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <Campo label="Tipo">
          <select className="mod-select" value={t} disabled={!!inversion} onChange={(e) => setF(vacia(e.target.value))}>
            {TIPOS_INVERSION.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Campo>

        {conTicker && <Buscador tipo={t} valor={f.simbolo} onElegir={elegir} />}
        {t === 'dolar' && (
          <Campo label="Valuar al dólar" nota="Se usa el precio de compra (lo que te darían si vendés).">
            <select className="mod-select" value={f.simbolo} onChange={set('simbolo')}>{CASAS_DOLAR.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </Campo>
        )}
        <Campo label="Nombre"><input className="mod-campo" value={f.nombre} onChange={(e) => { autoNombre.current = false; set('nombre')(e); }} placeholder={t === 'plazo_fijo' ? 'Plazo fijo Galicia' : t === 'seguro' ? 'Ej. Zurich Invest Future Joven' : t === 'otro' ? 'Ej. cuenta remunerada, préstamo a un amigo' : f.simbolo || ''} /></Campo>

        {['accion', 'cedear', 'cripto', 'dolar', 'bono', 'fci'].includes(t) && (
          <Campo label={t === 'bono' ? 'Valor nominal' : t === 'dolar' ? 'Dólares que tenés' : t === 'fci' ? 'Cuotapartes (opcional)' : 'Cantidad'}
            nota={t === 'bono' ? 'Cotiza cada 100 de valor nominal.' : t === 'fci' ? 'Están en el resumen del fondo. Sin cuotapartes, se estima con lo que pusiste y la TNA.' : null}>
            <input className="mod-campo" inputMode="decimal" value={f.cantidad} onChange={set('cantidad')} placeholder="0" />
          </Campo>
        )}
        {t !== 'otro' && t !== 'seguro' && (
          <Campo label={t === 'plazo_fijo' ? 'Capital' : t === 'dolar' ? 'Lo que pagaste en pesos (opcional)' : t === 'fci' ? 'Lo que pusiste' : 'Lo que pusiste (opcional)'} nota={['plazo_fijo', 'fci', 'dolar'].includes(t) ? null : 'Para ver cuánto ganaste.'}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="mod-campo" inputMode="decimal" value={f.capital} onChange={set('capital')} placeholder="0" />
              {t !== 'dolar' && monedaSel}
            </div>
          </Campo>
        )}
        {(t === 'plazo_fijo' || t === 'fci') && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Campo label="TNA %"><input className="mod-campo" inputMode="decimal" value={f.tna} onChange={set('tna')} placeholder="Ej. 30" /></Campo>
            <Campo label="Desde"><input className="mod-campo" type="date" max={hoyISO()} value={f.fecha_inicio} onChange={set('fecha_inicio')} /></Campo>
            {t === 'plazo_fijo' && <Campo label="Plazo (días)"><input className="mod-campo" inputMode="numeric" value={f.plazo_dias} onChange={set('plazo_dias')} /></Campo>}
          </div>
        )}
        {t === 'otro' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Campo label="Cuánto vale hoy"><input className="mod-campo" inputMode="decimal" value={f.valor_manual} onChange={set('valor_manual')} placeholder="0" /></Campo>
            <Campo label="Lo que pusiste (opcional)">
              <div style={{ display: 'flex', gap: 8 }}><input className="mod-campo" inputMode="decimal" value={f.capital} onChange={set('capital')} placeholder="0" />{monedaSel}</div>
            </Campo>
          </div>
        )}
        {t === 'seguro' && (
          <>
            <Campo label="Tipo de seguro" nota={SUBTIPOS_SEGURO.find((x) => x.id === f.subtipo)?.ej ? `Ej. ${SUBTIPOS_SEGURO.find((x) => x.id === f.subtipo).ej}` : null}>
              <select className="mod-select" value={f.subtipo} onChange={set('subtipo')}>{SUBTIPOS_SEGURO.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
            </Campo>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Campo label="Aseguradora"><input className="mod-campo" value={f.aseguradora} onChange={set('aseguradora')} placeholder="Ej. Zurich" /></Campo>
              <Campo label="Moneda de la póliza" nota="Si los aportes son en pesos pero se ajustan por dólar, elegí U$S.">{monedaSel}</Campo>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Campo label="Valor de la cuenta" nota="El fondo acumulado, en tu estado de cuenta."><input className="mod-campo" inputMode="decimal" value={f.valor_manual} onChange={set('valor_manual')} placeholder="0" /></Campo>
              <Campo label="Valor de rescate (opcional)" nota="Lo que te darían si lo retirás hoy. Es lo que suma a tu cartera."><input className="mod-campo" inputMode="decimal" value={f.valor_rescate} onChange={set('valor_rescate')} placeholder="0" /></Campo>
            </div>
            <Campo label="Valores al"><input className="mod-campo" type="date" max={hoyISO()} value={f.valor_fecha} onChange={set('valor_fecha')} /></Campo>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Campo label="Aporte" nota="En la moneda de la póliza.">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="mod-campo" inputMode="decimal" value={f.aporte_monto} onChange={set('aporte_monto')} placeholder="0" />
                  <select className="mod-select" value={f.aporte_frecuencia} onChange={set('aporte_frecuencia')} aria-label="Frecuencia del aporte">{FRECUENCIAS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                </div>
              </Campo>
              <Campo label="Desde"><input className="mod-campo" type="date" max={hoyISO()} value={f.fecha_inicio} onChange={set('fecha_inicio')} /></Campo>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Campo label="Total aportado (opcional)" nota="Si no lo ponés, se estima con el aporte y la fecha."><input className="mod-campo" inputMode="decimal" value={f.capital} onChange={set('capital')} placeholder="0" /></Campo>
              <Campo label="Cobertura por fallecimiento (opcional)"><input className="mod-campo" inputMode="decimal" value={f.suma_asegurada} onChange={set('suma_asegurada')} placeholder="0" /></Campo>
            </div>
          </>
        )}
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <Botonera onCerrar={onCerrar} ocupado={ocupado} />
      </form>
    </Hoja>
  );
};

/** Detalle: valor, ganancia, de dónde sale el precio; editar, cerrar, borrar. */
export const DetalleInversion = ({ inversion: i, valor: v, onCerrar, onCambio, onEditar }) => {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  if (!i || !v) return null;
  const tipo = TIPOS_INVERSION.find((x) => x.id === i.tipo)?.label;
  const hacer = async (fn) => {
    setOcupado(true); setError(null);
    try { await fn(); await onCambio?.(); return true; } catch { setError('No se pudo guardar. Revisá tu conexión.'); return false; } finally { setOcupado(false); }
  };
  return (
    <Hoja abierta={!!i} onCerrar={onCerrar} titulo={i.nombre}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 8px' }}>
        <span style={{ fontSize: 13, color: 'var(--label2)' }}>{tipo}{i.simbolo && i.tipo !== 'dolar' ? ` · ${i.simbolo}` : ''}{i.cantidad ? ` · ${String(i.cantidad).replace('.', ',')}` : ''}{i.estado === 'cerrada' ? ' · Cerrada' : ''}</span>
        {v.seguro ? (() => {
          const sg = v.seguro; const m = i.moneda;
          const fr = FRECUENCIAS.find((x) => x.id === i.aporte_frecuencia)?.label || 'por mes';
          const sub = SUBTIPOS_SEGURO.find((x) => x.id === i.subtipo)?.label;
          const pct = (x, signo = true) => `${signo ? (x >= 0 ? '+' : '−') : ''}${Math.abs(x).toFixed(1).replace('.', ',')}%`;
          const fila = (k, val) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}><span style={{ color: 'var(--label2)' }}>{k}</span><span className="mod-cifra">{val}</span></div>;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{v.sinPrecio ? '—' : plata(sg.rescate ?? sg.cuenta, m)}</span>
              <span style={{ fontSize: 13, color: 'var(--label2)' }}>{sg.rescate != null ? 'Si lo rescatás hoy' : 'Valor de la cuenta (sin descontar penalidad por rescate)'}{m === 'USD' && v.ars != null ? ` · ≈ ${pesos(v.ars)} al MEP` : ''}</span>
              {sub && fila('Tipo', sub)}
              {sg.rescate != null && sg.cuenta != null && fila('Valor de la cuenta', plata(sg.cuenta, m))}
              {sg.rescate != null && sg.cuenta != null && sg.cuenta > sg.rescate && fila('Penalidad si rescatás hoy', plata(sg.cuenta - sg.rescate, m))}
              {i.aporte_monto != null && fila('Aporte', `${plata(i.aporte_monto, m)} ${fr}`)}
              {sg.aportado != null && fila(sg.aportadoEstimado ? 'Aportado (estimado)' : 'Aportado', plata(sg.aportado, m))}
              {v.ganancia != null && fila(v.ganancia >= 0 ? 'Ganancia' : 'Por debajo de lo aportado', `${plata(Math.abs(v.ganancia), m)}${v.gananciaPct != null ? ` (${v.gananciaPct >= 0 ? '+' : '−'}${Math.abs(v.gananciaPct).toFixed(1).replace('.', ',')}%)` : ''}`)}
              {sg.rinde?.anual != null && fila(`Rendimiento anual en ${m === 'USD' ? 'U$S' : 'pesos'}${sg.rescate != null ? ', si rescatás hoy' : ''}${sg.rinde.estimado ? ' (estimado)' : ''}`, pct(sg.rinde.anual))}
              {sg.rindeCuenta?.anual != null && fila('Sobre el valor de la cuenta', `${pct(sg.rindeCuenta.anual)} anual`)}
              {sg.real != null && fila(`Contra la inflación del período (${pct(sg.inflacion, false)} anual)`, `${pct(sg.real)} real`)}
              {sg.rinde?.corto && fila('Rendimiento anual', 'con menos de un año no es representativo')}
              {sg.rinde?.dudoso && fila('Rendimiento anual', 'no da: revisá el valor, el aporte y la moneda')}
              {sg.faltaAportado && fila('Rendimiento anual', 'cargá el total aportado (en pesos los aportes se ajustan)')}
              {sg.suma != null && fila('Cobertura por fallecimiento', plata(sg.suma, m))}
              <span style={{ fontSize: 12, color: 'var(--label2)' }}>
                {i.valor_fecha ? `Valores al ${fechaDM(i.valor_fecha)}. ` : ''}{sg.viejo ? (i.valor_fecha ? 'Hace más de 2 meses: actualizalo con tu último estado de cuenta. ' : 'Sin fecha: actualizalo con tu último estado de cuenta. ') : ''}{sg.aportadoEstimado ? 'Lo aportado es estimado con el aporte actual. ' : ''}
                {v.ganancia != null && v.ganancia < 0 ? 'Parte de cada aporte paga la cobertura y los cargos, así que los primeros años el valor suele quedar por debajo de lo aportado.' : ''}
              </span>
            </div>
          );
        })() : v.sinPrecio ? (
          <p style={{ margin: 0, fontSize: 15 }}>Sin cotización todavía. Se actualiza todas las noches con el cierre del día.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="mod-cifra" style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-.02em' }}>{v.moneda === 'USD' && v.usd != null ? dolares(v.usd) : pesos(v.ars)}</span>
            {v.moneda === 'USD' && v.ars != null && <span className="mod-cifra" style={{ fontSize: 15, color: 'var(--label2)' }}>≈ {pesos(v.ars)} al {i.tipo === 'dolar' ? (CASAS_DOLAR.find((c) => c.id === v.casa)?.label || 'dólar elegido') : 'MEP'}</span>}
            {v.sinMep && <span style={{ fontSize: 13, color: 'var(--label2)' }}>No hay cotización del dólar para pasarlo a pesos.</span>}
            {v.ganancia != null && <span className="mod-cifra" style={{ fontSize: 15 }}>{v.ganancia >= 0 ? 'Ganaste' : 'Perdiste'} {plata(Math.abs(v.ganancia), v.gananciaMoneda)}{v.gananciaPct != null ? ` (${v.gananciaPct >= 0 ? '+' : '−'}${Math.abs(v.gananciaPct).toFixed(1).replace('.', ',')}%)` : ''}</span>}
            <span style={{ fontSize: 12, color: 'var(--label2)' }}>
              {v.estimado ? (i.fecha_inicio ? `Estimado con TNA ${String(i.tna ?? 0).replace('.', ',')}% desde el ${fechaDM(i.fecha_inicio)}${v.vence ? ` · ${v.vencido ? 'venció' : 'vence'} el ${fechaDM(v.vence)}` : ''}.` : 'Es lo que pusiste: sin fecha ni cuotapartes no se puede estimar lo ganado.') : v.fechaPrecio ? `Cierre del ${fechaDM(v.fechaPrecio)}.` : ''}
              {v.vencido ? ' Si lo renovaste, editalo con la nueva fecha; si lo retiraste, tocá "Ya no la tengo".' : ''}
            </span>
          </div>
        )}
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <DobleToque texto="Borrar" confirmar="¿Borrar?" disabled={ocupado} onConfirmado={async () => { if (await hacer(() => borrarInversion(i.id))) onCerrar(); }} />
          <button type="button" className="btn" disabled={ocupado} onClick={() => onEditar(i)} style={{ minHeight: 44 }}>Editar</button>
          <button type="button" className="btn" disabled={ocupado} onClick={() => hacer(() => actualizarInversion(i.id, { estado: i.estado === 'activa' ? 'cerrada' : 'activa' }))} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>
            {i.estado === 'activa' ? 'Ya no la tengo' : 'Reactivar'}
          </button>
        </div>
      </div>
    </Hoja>
  );
};
