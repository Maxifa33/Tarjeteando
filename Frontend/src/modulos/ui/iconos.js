import { Banknote, Wallet, Users, Scale, PiggyBank, Calculator, Puzzle } from 'lucide-react';

export const ICONOS_MODULOS = { Banknote, Wallet, Users, Scale, PiggyBank, Calculator };
export const iconoDe = (nombre) => ICONOS_MODULOS[nombre] || Puzzle;

/** Las pestañas de módulos traen el ícono por nombre; AppShell y Rail esperan el componente. */
export const conIconos = (secciones) => secciones.map((s) => (s.esModulo ? { ...s, icono: iconoDe(s.icono) } : s));
