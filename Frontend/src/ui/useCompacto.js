import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767.98px)';

/** true si el viewport mide menos de 768 px. Se actualiza en vivo. */
export default function useCompacto() {
  const [compacto, setCompacto] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return undefined;
    const onChange = (e) => setCompacto(e.matches);
    setCompacto(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return compacto;
}
