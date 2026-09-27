import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767.98px)';

/** true mientras la media query se cumpla. Se actualiza en vivo. */
export function useMedia(query) {
  const [coincide, setCoincide] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const onChange = (e) => setCoincide(e.matches);
    setCoincide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return coincide;
}

/** true si el viewport mide menos de 768 px. */
export default function useCompacto() {
  return useMedia(QUERY);
}

/**
 * Ancho disponible de un nodo, en vivo. Devuelve [ref, ancho].
 * ref es un callback ref: funciona aunque el nodo se monte más tarde.
 */
export function useAncho() {
  const [nodo, setNodo] = useState(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!nodo) return undefined;
    setAncho(nodo.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    ro.observe(nodo);
    return () => ro.disconnect();
  }, [nodo]);
  return [setNodo, ancho];
}
