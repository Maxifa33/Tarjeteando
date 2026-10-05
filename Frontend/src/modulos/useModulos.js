import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { MAX_FAVORITOS, contarFavoritos, esModulo } from './registro.js';

// Key propia de los módulos: NO es parte de STORAGE_KEYS de Tarjeteando ni viaja en exportAll.
const CACHE = 'modulos_estado_cache';

const leerCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE) || '{}') || {}; } catch { return {}; }
};
const guardarCache = (estado) => {
  try { localStorage.setItem(CACHE, JSON.stringify(estado)); } catch { /* sin storage */ }
};
const borrarCache = () => {
  try { localStorage.removeItem(CACHE); } catch { /* sin storage */ }
};

const MSJ_RED = 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.';

/**
 * Sesión + módulos activos/favoritos del usuario.
 * Las pestañas se pintan desde la cache local; Supabase es la fuente de verdad.
 * Escrituras: optimistas, una a la vez por módulo (`guardando`), revertidas solo para ese módulo.
 */
export default function useModulos() {
  const configurado = !!supabase;
  const [sesion, setSesion] = useState(null);
  const [estado, setEstado] = useState(leerCache);
  const [cargando, setCargando] = useState(configurado);
  const [error, setError] = useState(null);
  const [pidiendoLogin, setPidiendoLogin] = useState(false);
  const [guardando, setGuardando] = useState({}); // { [id]: true }
  const estadoRef = useRef(estado);
  const enVuelo = useRef(new Set());
  const escrituras = useRef(0); // invalida lecturas que salieron antes de una escritura

  const aplicar = (fn) => {
    setEstado((prev) => {
      const sig = fn(prev);
      estadoRef.current = sig;
      return sig;
    });
  };

  useEffect(() => {
    if (!supabase) return undefined;
    let vivo = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!vivo) return;
        setSesion(data?.session || null);
        if (!data?.session) setCargando(false);
      })
      .catch(() => { if (vivo) setCargando(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s || null));
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  const recargar = useCallback(async () => {
    if (!supabase || !sesion) return;
    const marca = escrituras.current;
    setCargando(true);
    try {
      const { data, error: err } = await supabase.from('modulos_usuario').select('modulo_id, activo, favorito, orden');
      if (err) throw err;
      if (marca !== escrituras.current) return; // hubo un cambio mientras leíamos: gana el cambio
      const nuevo = {};
      (data || []).forEach((f) => {
        if (esModulo(f.modulo_id)) nuevo[f.modulo_id] = { activo: f.activo, favorito: f.favorito, orden: f.orden };
      });
      aplicar(() => nuevo);
      guardarCache(nuevo);
    } catch {
      setError('No se pudieron leer tus módulos. Se muestran los últimos guardados en este dispositivo.');
    } finally {
      setCargando(false);
    }
  }, [sesion]);

  useEffect(() => { recargar(); }, [sesion?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = useCallback(async (id, cambios) => {
    if (!supabase) return false;
    if (!sesion) { setPidiendoLogin(true); return false; }
    if (enVuelo.current.has(id)) return false;
    enVuelo.current.add(id);
    escrituras.current += 1;
    setGuardando((g) => ({ ...g, [id]: true }));
    setError(null);

    const previo = estadoRef.current[id];
    const fila = { activo: false, favorito: false, orden: 0, ...(previo || {}), ...cambios };
    aplicar((prev) => ({ ...prev, [id]: fila }));

    let ok = true;
    try {
      const { error: err } = await supabase.from('modulos_usuario').upsert({
        user_id: sesion.user.id, modulo_id: id, activo: fila.activo, favorito: fila.favorito, orden: fila.orden
      });
      if (err) throw err;
    } catch {
      ok = false;
      aplicar((prev) => {
        const sig = { ...prev };
        if (previo) sig[id] = previo; else delete sig[id];
        return sig;
      });
      setError(MSJ_RED);
    } finally {
      enVuelo.current.delete(id);
      setGuardando((g) => { const s = { ...g }; delete s[id]; return s; });
      guardarCache(estadoRef.current);
    }
    return ok;
  }, [sesion]);

  const activar = (id) => guardar(id, { activo: true });
  const desactivar = (id) => guardar(id, { activo: false, favorito: false });
  const alternarFavorito = (id) => {
    const actual = estadoRef.current;
    const e = actual[id] || {};
    const esFav = !!(e.activo && e.favorito);
    if (!esFav && contarFavoritos(actual) >= MAX_FAVORITOS) {
      setError(`Podés tener hasta ${MAX_FAVORITOS} favoritos. Quitá uno para sumar este.`);
      return Promise.resolve(false);
    }
    const maxOrden = Math.max(0, ...Object.values(actual).filter((x) => x.activo && x.favorito).map((x) => x.orden || 0));
    return guardar(id, { favorito: !esFav, activo: true, orden: esFav ? 0 : Math.min(maxOrden + 1, 32000) });
  };

  const entrar = async (email) => {
    if (!supabase) return { ok: false, error: 'Módulos no configurados.' };
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (err) return { ok: false, error: err.status === 429 ? 'Pediste muchos links seguidos. Esperá un minuto.' : 'No se pudo enviar el link. Revisá el email.' };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Sin conexión. Probá de nuevo en un rato.' };
    }
  };

  const salir = async () => {
    if (!supabase) return;
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* la sesión local se borra igual */ }
    setSesion(null);
    aplicar(() => ({}));
    borrarCache();
  };

  return {
    configurado, sesion, estado, cargando, guardando, error, limpiarError: () => setError(null),
    pidiendoLogin, cerrarLogin: () => setPidiendoLogin(false),
    activar, desactivar, alternarFavorito, entrar, salir, recargar
  };
}
