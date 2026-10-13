import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';
import '../ui/modulos.css';
import { pesos } from '../../ui/formato.js';
import { saldos, simplificar } from './compartidos.js';
import { grupoPublico } from './repo.js';
import { supabase } from '../supabase.js';

/**
 * Vista pública de un compartido (link de solo lectura). Página aparte: no carga Tarjeteando
 * ni datos del dueño, solo lo que devuelve economics_grupo_publico para ese token.
 */

// Apariencia del sistema (la app guarda la suya, acá no hay).
try { if (!window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('claro'); } catch { /* sin matchMedia */ }

const fecha = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', ''); };

const Publico = () => {
  const token = useMemo(() => { try { return new URLSearchParams(window.location.search).get('t'); } catch { return null; } }, []);
  const [g, setG] = useState(undefined);
  useEffect(() => {
    if (!supabase || !token || !/^[0-9a-f-]{36}$/i.test(token)) { setG(null); return; }
    grupoPublico(token).then((d) => setG(d || null)).catch(() => setG(null));
  }, [token]);
  if (g === undefined) return <p role="status" style={{ padding: 24 }}>Cargando…</p>;
  if (!g) return (
    <main style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, margin: '24px 0 8px' }}>Este link no está disponible</h1>
      <p style={{ color: 'var(--label2)', margin: 0 }}>Puede que lo hayan apagado. Pedile uno nuevo a quien te lo pasó.</p>
    </main>
  );
  const nombres = Object.fromEntries(g.participantes.map((p) => [p.id, p.nombre === 'Yo' ? 'Quien comparte' : p.nombre]));
  const gastos = g.gastos.map((x) => ({ ...x, monto: Number(x.monto), partes: (x.partes || []).map((y) => ({ ...y, monto: Number(y.monto) })) }));
  const pagos = g.pagos.map((x) => ({ ...x, monto: Number(x.monto) }));
  const s = saldos(g.participantes, gastos, pagos);
  const tr = simplificar(s);
  const total = gastos.reduce((t, x) => t + x.monto, 0);
  return (
    <main style={{ padding: '24px 16px 48px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--label2)' }}>Compartido · solo lectura</span>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.02em' }}>{g.nombre}</h1>
        <span className="mod-cifra" style={{ fontSize: 15, color: 'var(--label2)' }}>{gastos.length} gastos · {pesos(total)}</span>
      </header>
      <section aria-labelledby="p-mano" style={{ padding: 18, borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id="p-mano" className="h3" style={{ margin: 0 }}>Para quedar a mano</h2>
        {tr.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tr.map((t) => (
              <li key={`${t.de}-${t.a}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 16 }}>
                <span>{nombres[t.de]} → {nombres[t.a]}</span>
                <strong className="mod-cifra">{pesos(t.monto, { decimales: t.monto % 1 ? 2 : 0 })}</strong>
              </li>
            ))}
          </ul>
        ) : <p style={{ margin: 0 }}>Están todos a mano.</p>}
      </section>
      <section aria-labelledby="p-gastos" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id="p-gastos" className="h3" style={{ margin: 0 }}>Gastos</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {gastos.map((x, i) => (
            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '0.5px solid var(--sep)', paddingBottom: 10 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15 }}>{x.descripcion}</span>
                <span style={{ fontSize: 13, color: 'var(--label2)' }}>{fecha(x.fecha)} · pagó {nombres[x.pagado_por]}</span>
              </span>
              <span className="mod-cifra" style={{ fontSize: 15, fontWeight: 600 }}>{pesos(x.monto)}</span>
            </li>
          ))}
        </ul>
      </section>
      {pagos.length > 0 && (
        <section aria-labelledby="p-pagos" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="p-pagos" className="h3" style={{ margin: 0 }}>Pagos</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pagos.map((x, i) => <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}><span>{fecha(x.fecha)} · {nombres[x.de]} → {nombres[x.a]}</span><span className="mod-cifra">{pesos(x.monto)}</span></li>)}
          </ul>
        </section>
      )}
      <footer style={{ fontSize: 12, color: 'var(--label2)' }}>Hecho con Tarjeteando.</footer>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<Publico />);
