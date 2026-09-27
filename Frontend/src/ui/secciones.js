import { PieChart, CreditCard, Receipt, Calendar } from 'lucide-react';

/** Las 4 secciones principales del rediseño, en orden. */
export const SECCIONES = [
  { id: 'mes', label: 'Mes', icono: PieChart },
  { id: 'tarjetas', label: 'Tarjetas', icono: CreditCard },
  { id: 'movimientos', label: 'Movimientos', corto: 'Movim.', icono: Receipt },
  { id: 'cuotas', label: 'Cuotas', icono: Calendar }
];
