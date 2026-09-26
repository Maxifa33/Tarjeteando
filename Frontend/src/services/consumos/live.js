/**
 * Puente entre la lógica pura de ciclos y el storage del navegador.
 * App.jsx / ImportarView llaman a estas funciones; ellas leen y guardan.
 */
import storage from '../storage.js';
import { aplicarArchivo, conciliarConResumen, asignarBanco } from './ciclos.js';

const estadoActual = () => ({
  alias: storage.getAliasUlt4(),
  ciclos: storage.getCiclosLive(),
  consumos: storage.getConsumosLive(),
});

export function importarGrupos({ grupos, asignaciones, archivo }) {
  const r = aplicarArchivo({ grupos, asignaciones, archivo, estado: estadoActual() });
  storage.setAliasUlt4(r.alias);
  storage.setCiclosLive(r.ciclos);
  storage.setConsumosLive(r.consumos);
  return r.aplicados;
}

/** Llamar después de guardar un Resumen: saca de "en curso" el ciclo que ya cerró. */
export function conciliarResumen({ banco, tipo, fecha_cierre }, movimientos) {
  const est = estadoActual();
  const r = conciliarConResumen(est, { banco, tipo, fecha_cierre }, movimientos);
  if (r.conciliados.length) {
    storage.setCiclosLive(r.ciclos);
    storage.setConsumosLive(r.consumos);
  }
  return r.conciliados;
}

export const getAlias = () => storage.getAliasUlt4();
export const getPlantillas = () => storage.getPlantillasConsumos();
export const guardarPlantilla = (p) => storage.savePlantillaConsumos(p);

export function guardarBanco(grupoKey, banco) {
  const r = asignarBanco(estadoActual(), grupoKey, banco);
  storage.setAliasUlt4(r.alias);
  storage.setCiclosLive(r.ciclos);
  storage.setConsumosLive(r.consumos);
}
