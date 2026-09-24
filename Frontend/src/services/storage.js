/**
 * Storage Service
 * Maneja la persistencia de datos en localStorage
 */

import { asignarIds } from './series.js';

const STORAGE_KEYS = {
  RESUMENES: 'tarjetas_resumenes',
  MOVIMIENTOS: 'tarjetas_movimientos',
  REGLAS: 'tarjetas_reglas',
  TARJETAS: 'tarjetas_lista',
  CONFIG: 'tarjetas_config',
  CONSUMOS_LIVE: 'tarjetas_consumos_live',
  // Cambios manuales del tipo de gasto: [{mov_id, tipo, desde, creado, tipo_previo}]
  TIPO_OVERRIDES: 'tarjetas_tipo_overrides',
  // Respuestas a las preguntas de gastos fijos: [{tipo, mov_id, prev_id?, periodo, creado}]
  DECISIONES_FIJOS: 'tarjetas_decisiones_fijos',
  // Cuántas veces el usuario corrigió al detector (tasa de error real)
  METRICAS_DETECTOR: 'tarjetas_metricas_detector',
  VERSION: 'tarjetas_version'
};

// 1.1.0: tarjeta en cada movimiento. 1.2.0: ID hash (SHA-256) por movimiento.
const CURRENT_VERSION = '1.2.0';

class StorageService {
  constructor() {
    this.checkVersion();
  }

  /**
   * Verifica la versión del storage y migra si es necesario
   */
  checkVersion() {
    const version = localStorage.getItem(STORAGE_KEYS.VERSION);
    if (version !== CURRENT_VERSION) {
      this.migrateData(version);
      localStorage.setItem(STORAGE_KEYS.VERSION, CURRENT_VERSION);
    }
  }

  /**
   * Migra datos de versiones anteriores
   */
  migrateData(fromVersion) {
    console.log(`[Storage] Migrando desde versión ${fromVersion || 'inicial'} a ${CURRENT_VERSION}`);

    // Migración: Asegurar que todos los movimientos tengan la propiedad 'tarjeta'
    const movimientos = this.getItem(STORAGE_KEYS.MOVIMIENTOS, []);
    let migrados = 0;

    const movimientosActualizados = movimientos.map(m => {
      if (!m.tarjeta && m.resumen_id) {
        // Extraer tarjeta del resumen_id (formato: "TARJETA-AÑO-MES")
        const partes = m.resumen_id.split('-');
        if (partes.length >= 3) {
          const tarjeta = partes.slice(0, -2).join('-');
          migrados++;
          return { ...m, tarjeta };
        }
      }
      return m;
    });

    if (migrados > 0) {
      console.log(`[Storage] Migrados ${migrados} movimientos con tarjeta faltante`);
    }

    // Migración 1.2.0: el ID posicional ('<resumen>-<idx>') pasa a ser la huella
    // SHA-256 del contenido. Así re-subir un resumen conserva los IDs y los cambios
    // manuales de tipo que apuntan a ellos.
    this.setItem(STORAGE_KEYS.MOVIMIENTOS, conIdsHash(movimientosActualizados));
  }

  /**
   * Helper para leer JSON del localStorage
   */
  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`[Storage] Error leyendo ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Helper para escribir JSON al localStorage
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Storage] Error escribiendo ${key}:`, error);
      // Posible error de quota excedida
      if (error.name === 'QuotaExceededError') {
        alert('No hay espacio suficiente en el navegador. Considera exportar y limpiar datos antiguos.');
      }
      return false;
    }
  }

  // ==================== RESÚMENES ====================

  /**
   * Obtiene todos los resúmenes
   */
  getResumenes() {
    return this.getItem(STORAGE_KEYS.RESUMENES, []);
  }

  /**
   * Guarda un resumen (actualiza si existe, agrega si no)
   */
  saveResumen(resumen) {
    const resumenes = this.getResumenes();
    const index = resumenes.findIndex(r => r.id === resumen.id);

    if (index >= 0) {
      resumenes[index] = { ...resumenes[index], ...resumen };
    } else {
      resumenes.push(resumen);
    }

    return this.setItem(STORAGE_KEYS.RESUMENES, resumenes);
  }

  /**
   * Elimina un resumen por ID
   */
  deleteResumen(id) {
    const resumenes = this.getResumenes().filter(r => r.id !== id);
    this.setItem(STORAGE_KEYS.RESUMENES, resumenes);

    // También eliminar movimientos asociados
    const movimientos = this.getMovimientos().filter(m => m.resumen_id !== id);
    this.setItem(STORAGE_KEYS.MOVIMIENTOS, movimientos);

    return true;
  }

  // ==================== MOVIMIENTOS ====================

  /**
   * Obtiene todos los movimientos
   */
  getMovimientos() {
    return this.getItem(STORAGE_KEYS.MOVIMIENTOS, []);
  }

  /**
   * Guarda movimientos de un resumen
   */
  saveMovimientos(resumenId, movimientos, tarjetaNombre = null) {
    const todosMovimientos = this.getMovimientos();

    // Extraer nombre de tarjeta del resumenId si no se proporciona
    // El formato de resumenId es: "TARJETA-AÑO-MES" (ej: "VISA Galicia-2024-11")
    const tarjeta = tarjetaNombre || resumenId.split('-').slice(0, -2).join('-');

    // Eliminar movimientos anteriores de este resumen
    const filtrados = todosMovimientos.filter(m => m.resumen_id !== resumenId);

    // Agregar nuevos movimientos con el resumen_id, tarjeta e ID hash (SHA-256 del
    // contenido: el mismo resumen subido dos veces genera los mismos IDs).
    const nuevos = asignarIds(movimientos.map(m => ({
      ...m,
      resumen_id: resumenId,
      tarjeta: m.tarjeta || tarjeta // Usar la tarjeta del movimiento o la inferida
    })), resumenId);

    return this.setItem(STORAGE_KEYS.MOVIMIENTOS, [...filtrados, ...nuevos]);
  }

  // ==================== TARJETAS ====================

  /**
   * Obtiene lista de tarjetas únicas
   */
  getTarjetas() {
    return this.getItem(STORAGE_KEYS.TARJETAS, []);
  }

  /**
   * Agrega o actualiza una tarjeta
   */
  saveTarjeta(tarjeta) {
    const tarjetas = this.getTarjetas();
    const index = tarjetas.findIndex(t => t.nombre === tarjeta.nombre);

    if (index >= 0) {
      tarjetas[index] = { ...tarjetas[index], ...tarjeta };
    } else {
      tarjetas.push(tarjeta);
    }

    return this.setItem(STORAGE_KEYS.TARJETAS, tarjetas);
  }

  // ==================== REGLAS ====================

  /**
   * Obtiene todas las reglas de usuario
   */
  getReglas() {
    return this.getItem(STORAGE_KEYS.REGLAS, []);
  }

  /**
   * Guarda una regla
   */
  saveRegla(regla) {
    const reglas = this.getReglas();
    const newRegla = {
      ...regla,
      id: regla.id || Date.now()
    };

    const index = reglas.findIndex(r => r.id === newRegla.id);
    if (index >= 0) {
      reglas[index] = newRegla;
    } else {
      reglas.push(newRegla);
    }

    return this.setItem(STORAGE_KEYS.REGLAS, reglas);
  }

  /**
   * Elimina una regla
   */
  deleteRegla(id) {
    const reglas = this.getReglas().filter(r => r.id !== id);
    return this.setItem(STORAGE_KEYS.REGLAS, reglas);
  }

  // ==================== TIPO DE GASTO (fijo / variable) ====================

  getTipoOverrides() {
    return this.getItem(STORAGE_KEYS.TIPO_OVERRIDES, []);
  }

  /**
   * Guarda un cambio manual de tipo. Reemplaza uno previo sobre el mismo
   * movimiento; los hechos sobre otros meses de la serie se conservan (cada uno
   * vale desde su propio resumen hacia adelante).
   */
  saveTipoOverride(override) {
    const lista = this.getTipoOverrides().filter(o => o.mov_id !== override.mov_id);
    lista.push({ ...override, creado: new Date().toISOString() });
    return this.setItem(STORAGE_KEYS.TIPO_OVERRIDES, lista);
  }

  getDecisionesFijos() {
    return this.getItem(STORAGE_KEYS.DECISIONES_FIJOS, []);
  }

  saveDecisionFijo(decision) {
    const lista = this.getDecisionesFijos();
    lista.push({ ...decision, creado: new Date().toISOString() });
    return this.setItem(STORAGE_KEYS.DECISIONES_FIJOS, lista);
  }

  getMetricasDetector() {
    return this.getItem(STORAGE_KEYS.METRICAS_DETECTOR,
      { correcciones: 0, a_fijo: 0, a_variable: 0, preguntas_respondidas: 0 });
  }

  /** Suma 1 a un contador de la métrica del detector. */
  registrarMetrica(campo) {
    const m = this.getMetricasDetector();
    m[campo] = (m[campo] || 0) + 1;
    return this.setItem(STORAGE_KEYS.METRICAS_DETECTOR, m);
  }

  // ==================== CONFIGURACIÓN ====================

  /**
   * Obtiene configuración
   */
  getConfig() {
    return this.getItem(STORAGE_KEYS.CONFIG, {
      theme: 'dark',
      apiKey: null // Para Vision API si el usuario quiere usar la suya
    });
  }

  /**
   * Guarda configuración
   */
  saveConfig(config) {
    const current = this.getConfig();
    return this.setItem(STORAGE_KEYS.CONFIG, { ...current, ...config });
  }

  // ==================== CONSUMOS LIVE (pre-resumen) ====================

  /**
   * Obtiene todos los consumos live importados via XLSX/CSV
   */
  getConsumosLive() {
    return this.getItem(STORAGE_KEYS.CONSUMOS_LIVE, []);
  }

  /**
   * Guarda consumos live haciendo merge por id (dedup por hash).
   * Los consumos nuevos con id ya existente se ignoran.
   */
  saveConsumosLive(nuevosConsumos) {
    const existentes = this.getConsumosLive();
    const idsExistentes = new Set(existentes.map(c => c.id));
    const aAgregar = nuevosConsumos.filter(c => !idsExistentes.has(c.id));
    return this.setItem(STORAGE_KEYS.CONSUMOS_LIVE, [...existentes, ...aAgregar]);
  }

  /**
   * Elimina consumos live de una tarjeta específica, o todos si no se pasa tarjeta.
   */
  deleteConsumosLive(tarjeta = null) {
    if (!tarjeta) {
      return this.setItem(STORAGE_KEYS.CONSUMOS_LIVE, []);
    }
    const filtrados = this.getConsumosLive().filter(c => c.tarjeta !== tarjeta);
    return this.setItem(STORAGE_KEYS.CONSUMOS_LIVE, filtrados);
  }

  // ==================== EXPORT / IMPORT ====================

  /**
   * Exporta todos los datos a un objeto JSON
   */
  exportAll() {
    return {
      version: CURRENT_VERSION,
      exportDate: new Date().toISOString(),
      data: {
        resumenes: this.getResumenes(),
        movimientos: this.getMovimientos(),
        tarjetas: this.getTarjetas(),
        reglas: this.getReglas(),
        consumosLive: this.getConsumosLive(),
        tipoOverrides: this.getTipoOverrides(),
        decisionesFijos: this.getDecisionesFijos(),
        metricasDetector: this.getMetricasDetector(),
        config: this.getConfig()
      }
    };
  }

  /**
   * Importa datos desde un objeto JSON
   */
  importAll(data, merge = false) {
    try {
      if (!data.data) {
        throw new Error('Formato de datos inválido');
      }

      const { resumenes, tarjetas, reglas, consumosLive, config,
              tipoOverrides, decisionesFijos, metricasDetector } = data.data;
      // Backups viejos traen IDs posicionales: se normalizan al ID hash.
      const movimientos = data.data.movimientos ? conIdsHash(data.data.movimientos) : data.data.movimientos;

      if (merge) {
        // Merge: combinar con datos existentes
        const existingResumenes = this.getResumenes();
        const existingMovimientos = this.getMovimientos();
        const existingTarjetas = this.getTarjetas();
        const existingReglas = this.getReglas();

        // Merge resúmenes (evitar duplicados por ID)
        const resumenIds = new Set(existingResumenes.map(r => r.id));
        const newResumenes = resumenes.filter(r => !resumenIds.has(r.id));
        this.setItem(STORAGE_KEYS.RESUMENES, [...existingResumenes, ...newResumenes]);

        // Merge movimientos
        const movIds = new Set(existingMovimientos.map(m => m.id));
        const newMovimientos = movimientos.filter(m => !movIds.has(m.id));
        this.setItem(STORAGE_KEYS.MOVIMIENTOS, [...existingMovimientos, ...newMovimientos]);

        // Merge tarjetas
        const tarjetaNames = new Set(existingTarjetas.map(t => t.nombre));
        const newTarjetas = tarjetas.filter(t => !tarjetaNames.has(t.nombre));
        this.setItem(STORAGE_KEYS.TARJETAS, [...existingTarjetas, ...newTarjetas]);

        // Merge reglas
        const reglaPatterns = new Set(existingReglas.map(r => r.patron));
        const newReglas = reglas.filter(r => !reglaPatterns.has(r.patron));
        this.setItem(STORAGE_KEYS.REGLAS, [...existingReglas, ...newReglas]);

        // Merge consumos live (dedup por id)
        if (consumosLive) {
          const existingConsumos = this.getConsumosLive();
          const consumoIds = new Set(existingConsumos.map(c => c.id));
          const newConsumos = consumosLive.filter(c => !consumoIds.has(c.id));
          this.setItem(STORAGE_KEYS.CONSUMOS_LIVE, [...existingConsumos, ...newConsumos]);
        }

        // Merge cambios de tipo y respuestas (dedup por movimiento / por respuesta)
        if (tipoOverrides) {
          const existentes = this.getTipoOverrides();
          const ids = new Set(existentes.map(o => o.mov_id));
          this.setItem(STORAGE_KEYS.TIPO_OVERRIDES, [...existentes, ...tipoOverrides.filter(o => !ids.has(o.mov_id))]);
        }
        if (decisionesFijos) {
          const existentes = this.getDecisionesFijos();
          const clave = d => `${d.tipo}|${d.mov_id}|${d.periodo || ''}`;
          const claves = new Set(existentes.map(clave));
          this.setItem(STORAGE_KEYS.DECISIONES_FIJOS, [...existentes, ...decisionesFijos.filter(d => !claves.has(clave(d)))]);
        }

      } else {
        // Replace: reemplazar todo
        if (resumenes) this.setItem(STORAGE_KEYS.RESUMENES, resumenes);
        if (movimientos) this.setItem(STORAGE_KEYS.MOVIMIENTOS, movimientos);
        if (tarjetas) this.setItem(STORAGE_KEYS.TARJETAS, tarjetas);
        if (reglas) this.setItem(STORAGE_KEYS.REGLAS, reglas);
        if (consumosLive) this.setItem(STORAGE_KEYS.CONSUMOS_LIVE, consumosLive);
        if (tipoOverrides) this.setItem(STORAGE_KEYS.TIPO_OVERRIDES, tipoOverrides);
        if (decisionesFijos) this.setItem(STORAGE_KEYS.DECISIONES_FIJOS, decisionesFijos);
        if (metricasDetector) this.setItem(STORAGE_KEYS.METRICAS_DETECTOR, metricasDetector);
        if (config) this.setItem(STORAGE_KEYS.CONFIG, config);
      }

      return { success: true };
    } catch (error) {
      console.error('[Storage] Error importando:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Limpia todos los datos
   */
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    this.checkVersion();
    return true;
  }

  // ==================== ESTADÍSTICAS ====================

  /**
   * Calcula estadísticas del dashboard
   */
  getEstadisticas() {
    const resumenes = this.getResumenes();
    const movimientos = this.getMovimientos();
    const tarjetas = this.getTarjetas();

    // Total a pagar (suma de último resumen de cada tarjeta)
    const ultimosResumenes = {};
    resumenes
      .sort((a, b) => {
        const dateA = new Date(a.anio, a.mes - 1);
        const dateB = new Date(b.anio, b.mes - 1);
        return dateB - dateA;
      })
      .forEach(r => {
        if (!ultimosResumenes[r.tarjeta]) {
          ultimosResumenes[r.tarjeta] = r;
        }
      });

    const totalAPagar = Object.values(ultimosResumenes)
      .reduce((sum, r) => sum + (r.total_a_pagar_pesos || 0), 0);

    const totalAPagarDolares = Object.values(ultimosResumenes)
      .reduce((sum, r) => sum + (r.total_a_pagar_dolares || 0), 0);

    // Cuotas activas
    const cuotasActivas = movimientos.filter(m =>
      m.es_cuota && m.cuota_actual && m.total_cuotas && m.cuota_actual < m.total_cuotas
    );

    return {
      total_a_pagar: totalAPagar,
      total_a_pagar_dolares: totalAPagarDolares,
      total_tarjetas: tarjetas.length,
      total_resumenes: resumenes.length,
      total_movimientos: movimientos.length,
      cuotas_activas: cuotasActivas.length,
      ultimo_resumen: Object.values(ultimosResumenes)[0] || null
    };
  }

  /**
   * Obtiene datos para el gráfico de evolución
   */
  getEvolucionMensual(meses = 6) {
    const resumenes = this.getResumenes();

    if (resumenes.length === 0) return [];

    // Anclar la ventana al período del resumen MÁS RECIENTE (no a la fecha de hoy),
    // así los últimos resúmenes siempre aparecen aunque sean de meses anteriores.
    const periodoMasReciente = resumenes.reduce((max, r) => {
      const d = new Date(r.anio, r.mes - 1, 1);
      return d > max ? d : max;
    }, new Date(0));

    const resultado = [];

    for (let i = meses - 1; i >= 0; i--) {
      const fecha = new Date(periodoMasReciente.getFullYear(), periodoMasReciente.getMonth() - i, 1);
      const mes = fecha.getMonth() + 1;
      const anio = fecha.getFullYear();

      const resumenesDelMes = resumenes.filter(r => r.mes === mes && r.anio === anio);

      const totalMes = resumenesDelMes.reduce((sum, r) => sum + (r.total_a_pagar_pesos || 0), 0);

      resultado.push({
        mes: fecha.toLocaleDateString('es-AR', { month: 'short' }),
        anio,
        total: totalMes,
        // Desglose por tarjeta
        ...resumenesDelMes.reduce((acc, r) => {
          acc[r.tarjeta] = r.total_a_pagar_pesos || 0;
          return acc;
        }, {})
      });
    }

    return resultado;
  }
}

/** Re-asigna IDs hash agrupando por resumen (idempotente: el ID es la huella del contenido). */
function conIdsHash(movimientos = []) {
  const porResumen = {};
  movimientos.forEach(m => {
    const k = m.resumen_id || '';
    (porResumen[k] = porResumen[k] || []).push(m);
  });
  return Object.entries(porResumen).flatMap(([rid, ms]) => asignarIds(ms, rid));
}

// Singleton
const storage = new StorageService();

export default storage;
export { STORAGE_KEYS };
