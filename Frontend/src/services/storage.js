/**
 * Storage Service
 * Maneja la persistencia de datos en localStorage
 */

const STORAGE_KEYS = {
  RESUMENES: 'tarjetas_resumenes',
  MOVIMIENTOS: 'tarjetas_movimientos',
  REGLAS: 'tarjetas_reglas',
  TARJETAS: 'tarjetas_lista',
  CONFIG: 'tarjetas_config',
  VERSION: 'tarjetas_version'
};

const CURRENT_VERSION = '1.1.0'; // Incrementado para migración de tarjetas en movimientos

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
      this.setItem(STORAGE_KEYS.MOVIMIENTOS, movimientosActualizados);
      console.log(`[Storage] Migrados ${migrados} movimientos con tarjeta faltante`);
    }
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

    // Agregar nuevos movimientos con el resumen_id y tarjeta
    const nuevos = movimientos.map((m, idx) => ({
      ...m,
      id: `${resumenId}-${idx}`,
      resumen_id: resumenId,
      tarjeta: m.tarjeta || tarjeta // Usar la tarjeta del movimiento o la inferida
    }));

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

      const { resumenes, movimientos, tarjetas, reglas, config } = data.data;

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

      } else {
        // Replace: reemplazar todo
        if (resumenes) this.setItem(STORAGE_KEYS.RESUMENES, resumenes);
        if (movimientos) this.setItem(STORAGE_KEYS.MOVIMIENTOS, movimientos);
        if (tarjetas) this.setItem(STORAGE_KEYS.TARJETAS, tarjetas);
        if (reglas) this.setItem(STORAGE_KEYS.REGLAS, reglas);
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

// Singleton
const storage = new StorageService();

export default storage;
export { STORAGE_KEYS };
