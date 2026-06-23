/**
 * Proyección de cuotas — lógica pura y testeable.
 *
 * Invariante: la proyección se ancla SIEMPRE al período del resumen donde aparece
 * cada cuota (vía `fecha_ultima_cuota`), nunca a la fecha de hoy ni al orden de subida.
 * Si la cuota número N corresponde al período P, la cuota N+k corresponde al mes P+k.
 *
 * El bucket 0 ("próximo mes") es el mes siguiente al resumen más reciente disponible.
 */

/** Devuelve el primer día del mes del período de una cuota. */
function periodoMesDeCuota(cuota, fallback) {
  const f = cuota.fecha_ultima_cuota ? new Date(cuota.fecha_ultima_cuota) : fallback;
  return new Date(f.getFullYear(), f.getMonth(), 1);
}

/**
 * @param {Array} cuotasActivas - compras en cuotas con cuotas_restantes > 0.
 *   Cada una: { cuota_actual, total_cuotas, monto_cuota, fecha_ultima_cuota,
 *               referencia_limpia, tarjeta }
 * @param {number} meses - cantidad de meses a proyectar.
 * @param {Date} [hoy] - usado solo como fallback si no hay períodos (inyectable para tests).
 * @returns {Array} buckets { mes, mes_nombre, total, cantidad_cuotas, detalles[] }
 */
function proyectarCuotas(cuotasActivas, meses = 6, hoy = new Date()) {
  const hoyMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  // Orden determinístico: el orden de subida (= orden de Object.values) no debe
  // influir ni en los totales (ruido de punto flotante) ni en el orden del detalle.
  const cuotas = [...cuotasActivas].sort((a, b) =>
    (a.tarjeta || '').localeCompare(b.tarjeta || '')
    || (a.referencia_limpia || '').localeCompare(b.referencia_limpia || '')
    || (a.total_cuotas - b.total_cuotas)
    || (a.monto_cuota - b.monto_cuota)
  );

  // Ancla = período del resumen más reciente entre las cuotas activas.
  let ancla = null;
  cuotas.forEach(c => {
    const p = periodoMesDeCuota(c, hoyMes);
    if (!ancla || p > ancla) ancla = p;
  });
  if (!ancla) ancla = hoyMes;

  const proyeccion = [];

  for (let i = 0; i < meses; i++) {
    // Mes objetivo = ancla + (i + 1)
    const fecha = new Date(ancla.getFullYear(), ancla.getMonth() + i + 1, 1);
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

    let totalMes = 0;
    const detalles = [];

    cuotas.forEach(cuota => {
      const periodoCuota = periodoMesDeCuota(cuota, hoyMes);
      const diff = (fecha.getFullYear() - periodoCuota.getFullYear()) * 12
        + (fecha.getMonth() - periodoCuota.getMonth());
      const numeroCuota = cuota.cuota_actual + diff;
      // Solo cuotas futuras respecto del período (diff >= 1) que aún no terminaron.
      if (diff >= 1 && numeroCuota <= cuota.total_cuotas) {
        totalMes += cuota.monto_cuota;
        detalles.push({
          referencia: cuota.referencia_limpia,
          tarjeta: cuota.tarjeta,
          cuota: `${numeroCuota}/${cuota.total_cuotas}`,
          monto: cuota.monto_cuota
        });
      }
    });

    proyeccion.push({
      mes: mesKey,
      mes_nombre: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      total: Math.round(totalMes * 100) / 100, // redondeo a 2 decimales (estable)
      cantidad_cuotas: detalles.length,
      detalles
    });
  }

  return proyeccion;
}

module.exports = { proyectarCuotas, periodoMesDeCuota };
