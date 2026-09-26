/**
 * Cards de "Últimos consumos" en el dashboard.
 *
 * Diseño "Estratos" (diseno/supercard-estratos.png):
 *  - Lo COMPARTIDO (banco, red, cierre, vto, límite) se muestra una sola vez.
 *  - Lo de CADA PLÁSTICO va en su fila, con su color y su parte de la barra.
 *  - Una sola tarjeta en el grupo → misma Card, sin barra ni filas.
 *  - Mismo archivo con ciclos distintos → Cards separadas con una marca discreta.
 */
import React, { useState } from 'react';
import { Zap, AlertCircle, Link2 } from 'lucide-react';

const COLOR_BANCO = {
  santander: '#DC2626', galicia: '#F97316', bbva: '#2563EB', macro: '#3B82F6',
  hsbc: '#DB0011', icbc: '#C4161C', nacion: '#0EA5E9', provincia: '#16A34A',
  patagonia: '#0891B2', supervielle: '#E11D48', naranja: '#FB923C', brubank: '#6D28D9',
};
const colorDe = (banco, red) => {
  const b = String(banco || '').toLowerCase();
  for (const [k, c] of Object.entries(COLOR_BANCO)) if (b.includes(k)) return c;
  if (/amex/i.test(red)) return '#2E77BC';
  let h = 0; for (const ch of b) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 50%)`;
};
// Tono del plástico N: el primero pleno, los siguientes más claros.
const tono = (color, i) => (i === 0 ? color : `color-mix(in srgb, ${color} ${Math.max(35, 60 - (i - 1) * 12)}%, white)`);

const ars = (n) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const partes = (n) => { const [e, d] = ars(n).split(','); return { e, d }; };
const corto = (n) => {
  if (!n) return '$ 0';
  if (n >= 1e6) return `$ ${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 2 })} M`;
  return `$ ${Math.round(n).toLocaleString('es-AR')}`;
};
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)} / ${iso.slice(5, 7)}` : '—');
const diaSemana = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' });
};
const haceCuanto = (isoTs) => {
  if (!isoTs) return '';
  const min = Math.round((Date.now() - new Date(isoTs).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const t = new Date(isoTs);
  const hoy = new Date();
  const hora = t.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (t.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  const dias = Math.round((hoy - t) / 86400000);
  return dias <= 1 ? `ayer ${hora}` : `hace ${dias} días`;
};
const textoCierre = (d) => {
  if (d == null) return '';
  if (d > 1) return `en ${d} días`;
  if (d === 1) return 'mañana';
  if (d === 0) return 'hoy';
  return `cerró hace ${-d} día${d === -1 ? '' : 's'}`;
};

const Caps = ({ children, className = '', style }) => (
  <span className={`font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] ${className}`} style={style}>{children}</span>
);

function Plasticos({ miembros, color }) {
  const vis = miembros.slice(0, 3);
  return (
    <div className="relative flex-none" style={{ width: 70 + (vis.length - 1) * 12, height: 46 + (vis.length - 1) * 10 }}>
      {vis.map((m, i) => {
        const k = vis.length;
        return (
          <div key={m.ult4} className="absolute rounded-lg shadow-lg"
               style={{ width: 64, height: 40, left: i * 12, top: (k - 1 - i) * 10, zIndex: k - i,
                        background: `linear-gradient(135deg, ${tono(color, i)}, color-mix(in srgb, ${tono(color, i)} 60%, black))` }}>
            <span className="absolute left-2 top-3 w-3 h-2 rounded-sm" style={{ background: 'linear-gradient(135deg,#e9d8a0,#a88a3c)' }} />
            <span className={`absolute right-1.5 font-mono text-[8px] text-white/85 ${i ? 'top-1' : 'bottom-1'}`}>{m.ult4}</span>
          </div>
        );
      })}
    </div>
  );
}

// El archivo no dice el banco: la Card lo pide una vez y no vuelve a preguntar.
function BancoPicker({ grupoKey, bancos = [], onAsignar }) {
  const [valor, setValor] = useState('');
  const listId = `bancos-${grupoKey.replace(/[^a-z0-9]/gi, '')}`;
  const guardar = () => valor.trim() && onAsignar?.(grupoKey, valor.trim());
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-xs text-amber-500">¿De qué banco es?</span>
      <input
        list={listId}
        value={valor}
        placeholder="Banco"
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        className="w-36 px-2.5 py-1 rounded-lg bg-[var(--glass-bg)] border border-amber-400/60 text-[var(--text-primary)] text-sm"
      />
      <datalist id={listId}>{bancos.map((b) => <option key={b} value={b} />)}</datalist>
      <button onClick={guardar} disabled={!valor.trim()}
              className="px-3 py-1 rounded-lg bg-[var(--accent-1)] text-white text-xs font-medium disabled:opacity-40">
        Guardar
      </button>
    </div>
  );
}

export function LiveCard({ ciclo, datos, hermanos = [], onClick, onAsignarBanco, bancos }) {
  const color = colorDe(ciclo.banco, ciclo.red);
  const { miembros, es_super } = datos;
  const total = partes(datos.total_ars);
  const usado = ciclo.limite && ciclo.disponible != null ? Math.min(1, Math.max(0, 1 - ciclo.disponible / ciclo.limite)) : null;

  return (
    <div onClick={onClick}
         className={`glass-card !p-0 overflow-hidden cursor-pointer flex flex-col ${es_super ? 'lg:col-span-2' : ''}`}
         style={{ borderColor: 'color-mix(in srgb, var(--accent-1) 25%, var(--glass-border))' }}>
      {/* Estrato 1 — compartido: quién es */}
      <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Plasticos miembros={miembros.length ? miembros : [{ ult4: ciclo.principal }]} color={color} />
        <div className="min-w-0 flex-1">
          <Caps className="!text-[var(--accent-1)] whitespace-nowrap">Últimos consumos</Caps>
          <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight mt-1">
            {ciclo.banco && (<>{ciclo.banco}<span className="text-[var(--text-muted)] font-normal mx-1.5">–</span></>)}{ciclo.red}
            {!es_super && (<><span className="text-[var(--text-muted)] font-normal mx-1.5">–</span>#{miembros[0]?.ult4 || ciclo.principal}</>)}
          </h3>
          {!ciclo.banco && <BancoPicker grupoKey={ciclo.grupoKey} bancos={bancos} onAsignar={onAsignarBanco} />}
          {es_super && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {miembros.map((m, i) => (
                <span key={m.ult4} className="font-mono text-[11px] px-2 py-0.5 rounded-full border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center gap-1.5">
                  <i className="w-1.5 h-1.5 rounded-full" style={{ background: tono(color, i) }} />#{m.ult4}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="w-full sm:w-auto sm:ml-auto sm:self-start sm:text-right flex-none flex sm:block items-center justify-between order-last sm:order-none">
          <Caps className="whitespace-nowrap">
            <i className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${datos.cerrado ? 'bg-amber-400' : 'bg-emerald-500'}`} />
            {datos.cerrado ? 'Esperando resumen' : 'En curso'}
          </Caps>
          <p className="font-mono text-xs text-[var(--text-secondary)] sm:mt-1">{haceCuanto(ciclo.actualizado_at)}</p>
        </div>
      </div>

      {/* Estrato 2 — el número */}
      <div className="px-5 sm:px-6 py-4 border-t border-[var(--glass-border)]">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <Caps>Va por</Caps>
            <p className="font-mono text-3xl sm:text-4xl tracking-tight text-[var(--text-primary)] leading-none mt-2 whitespace-nowrap">
              $ {total.e}<span className="text-2xl text-[var(--text-secondary)]">,{total.d}</span>
            </p>
            {datos.total_usd > 0 && (
              <p className="font-mono text-base text-[var(--accent-1)] mt-2">+ U$S {ars(datos.total_usd)}</p>
            )}
          </div>
          <p className="sm:text-right text-xs italic text-[var(--text-muted)] leading-snug">
            estimado del próximo resumen<br />sin impuestos ni intereses
          </p>
        </div>

        {es_super ? (
          <>
            <div className="flex h-2 rounded-full overflow-hidden gap-[3px] mt-5">
              {miembros.map((m, i) => (
                <i key={m.ult4} className="block h-full" style={{ width: `${Math.max(m.share * 100, 1.5)}%`, background: tono(color, i) }} />
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {miembros.map((m) => <Caps key={m.ult4}>#{m.ult4} · {Math.round(m.share * 100)} %</Caps>)}
            </div>
          </>
        ) : (
          <p className="font-mono text-xs text-[var(--text-secondary)] mt-4">
            {datos.n_cuotas > 0 ? (
              <>En 1 pago $ {ars(datos.un_pago)} <span className="text-[var(--text-muted)]">·</span> Cuotas $ {ars(datos.cuotas)}
              <span className="text-[var(--text-muted)]"> ×{datos.n_cuotas}</span></>
            ) : (
              <>{datos.n} consumo{datos.n === 1 ? '' : 's'} en 1 pago · sin cuotas</>
            )}
          </p>
        )}
      </div>

      {/* Estrato 3 — por plástico (solo SuperCard) */}
      {es_super && (<>
        <div className="px-5 pb-2 sm:hidden">
          {miembros.map((m, i) => (
            <div key={m.ult4} className="py-3 border-b border-[var(--glass-border)] last:border-0 font-mono">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <i className="w-2 h-2 rounded-full" style={{ background: tono(color, i) }} />#{m.ult4}
                  <span className="font-sans text-[11px] text-[var(--text-muted)]">{m.n} consumo{m.n === 1 ? '' : 's'}</span>
                </span>
                <span className="text-sm text-[var(--text-primary)]">$ {ars(m.subtotal)}</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1 pl-4">
                {m.un_pago ? `1 pago $ ${ars(m.un_pago)}` : ''}{m.un_pago && m.cuotas ? ' · ' : ''}{m.cuotas ? `cuotas $ ${ars(m.cuotas)} ×${m.n_cuotas}` : ''}{m.usd ? ` · U$S ${ars(m.usd)}` : ''}
              </p>
            </div>
          ))}
        </div>
        <div className="px-6 pb-2 hidden sm:block">
          <div>
            <div className="grid grid-cols-[1.1fr_1fr_1fr_.6fr_1.1fr] py-2 border-b border-[var(--glass-border)]">
              {['Plástico', 'En 1 pago', 'En cuotas', 'U$S', 'Subtotal'].map((h, i) => (
                <Caps key={h} className={i ? 'text-right' : ''}>{h}</Caps>
              ))}
            </div>
            {miembros.map((m, i) => (
              <div key={m.ult4} className="grid grid-cols-[1.1fr_1fr_1fr_.6fr_1.1fr] items-center py-3 border-b border-[var(--glass-border)] last:border-0 font-mono text-sm">
                <div className="flex items-center gap-2.5">
                  <i className="w-2 h-2 rounded-full flex-none" style={{ background: tono(color, i) }} />
                  <div>
                    <p className="text-[var(--text-primary)]">#{m.ult4}</p>
                    <p className="font-sans text-[11px] text-[var(--text-muted)]">{m.n} consumo{m.n === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <p className="text-right text-[var(--text-secondary)]">{m.un_pago ? `$ ${ars(m.un_pago)}` : '—'}</p>
                <p className="text-right text-[var(--text-secondary)]">
                  {m.cuotas ? <>$ {ars(m.cuotas)}<span className="text-[10px] text-[var(--text-muted)] ml-1">×{m.n_cuotas}</span></> : '—'}
                </p>
                <p className="text-right text-[var(--text-secondary)]">{m.usd ? ars(m.usd) : '—'}</p>
                <p className="text-right text-[var(--text-primary)]">$ {ars(m.subtotal)}</p>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {/* Estrato 4 — compartido: el reloj */}
      <div className={`mt-auto grid ${ciclo.limite ? 'grid-cols-2 sm:grid-cols-[1fr_1fr_1.5fr]' : 'grid-cols-2'} border-t border-[var(--glass-border)]`}
           style={{ background: 'color-mix(in srgb, var(--accent-1) 5%, transparent)' }}>
        <div className="px-6 py-4">
          <Caps>Cierre</Caps>
          <p className="font-mono text-lg text-[var(--text-primary)] mt-1 whitespace-nowrap">{ddmm(ciclo.fecha_cierre)}</p>
          <p className={`text-xs mt-0.5 ${datos.cerrado ? 'text-amber-500' : 'text-[var(--accent-1)]'}`}>{textoCierre(datos.dias_al_cierre)}</p>
        </div>
        <div className="px-6 py-4 border-l border-[var(--glass-border)]">
          <Caps>Vencimiento</Caps>
          <p className="font-mono text-lg text-[var(--text-primary)] mt-1 whitespace-nowrap">{ddmm(ciclo.fecha_vencimiento)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{diaSemana(ciclo.fecha_vencimiento)}</p>
        </div>
        {ciclo.limite ? (
          <div className="px-6 py-4 col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-[var(--glass-border)]">
            <Caps className="whitespace-nowrap">Disponible / límite</Caps>
            <p className="font-mono text-lg text-[var(--text-primary)] mt-1 whitespace-nowrap">
              {corto(ciclo.disponible)} <span className="text-sm text-[var(--text-muted)]">/ {corto(ciclo.limite).replace('$ ', '')}</span>
            </p>
            <div className="h-1 rounded-full bg-[var(--glass-border)] mt-2 overflow-hidden">
              <i className="block h-full bg-[var(--accent-1)]" style={{ width: `${(usado || 0) * 100}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {(!ciclo.validado || hermanos.length > 0) && (
        <div className="px-6 py-2.5 border-t border-[var(--glass-border)] flex flex-wrap gap-x-5 gap-y-1">
          {!ciclo.validado && (
            <span className="text-[11px] text-amber-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> No pudimos validar contra el total del banco
            </span>
          )}
          {hermanos.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> mismo archivo · ciclo distinto
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function LiveCardsSection({ cards, onVerDetalle, onAsignarBanco, bancos }) {
  if (!cards.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Zap className="w-5 h-5 text-[var(--accent-1)]" /> Últimos consumos
        </h3>
        <button onClick={onVerDetalle} className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-1)] transition-colors">
          Ver detalle
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cards.map((x) => (
          <LiveCard key={x.ciclo.grupoKey} ciclo={x.ciclo} datos={x.datos} hermanos={x.hermanos} onClick={onVerDetalle} onAsignarBanco={onAsignarBanco} bancos={bancos} />
        ))}
      </div>
    </div>
  );
}
