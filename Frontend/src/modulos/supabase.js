import { createClient } from '@supabase/supabase-js';

/**
 * Cliente único de Supabase para los módulos. Tarjeteando no lo usa.
 * Sin variables de entorno (o con una URL inválida) exporta null: los módulos
 * quedan ocultos y el resto de la app sigue igual.
 */
const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

const crear = () => {
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  } catch (e) {
    console.error('[modulos] Supabase mal configurado', e);
    return null;
  }
};

export const supabase = crear();
