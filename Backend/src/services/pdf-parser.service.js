const pdfParse = require('pdf-parse');
const crypto = require('crypto');

class PDFParserService {
  constructor() {
    this.formatoDetectado = null;
  }

  async parsearPDF(buffer, nombreArchivo) {
    try {
      console.log('[Parser] Iniciando analisis de ' + nombreArchivo);
      
      const data = await pdfParse(buffer);
      const texto = data.text;
      
      this.formatoDetectado = this.detectarFormato(texto);
      console.log('[Parser] Formato detectado: ' + this.formatoDetectado);
      
      const tarjeta = this.detectarTarjeta(texto);
      const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      const resumen = this.extraerMetadatos(lineas, tarjeta, texto);
      const impuestos = this.extraerImpuestos(lineas, texto);
      resumen.impuestos = impuestos;

      const movimientos = this.extraerMovimientos(lineas, texto);
      
      const movimientosLimpios = movimientos.map(mov => {
        const limpieza = this.limpiarReferencia(mov.referencia_original);
        return {
          ...mov,
          referencia_limpia: limpieza.limpio,
          es_dudoso: limpieza.dudoso,
          sugerencias: limpieza.sugerencias
        };
      });
      
      const compras = this.detectarCuotas(movimientosLimpios);
      
      // Validar totales (solo pesos)
      const sumaExtraidaPesos = movimientosLimpios.reduce((sum, m) => sum + (m.monto_pesos || 0), 0);
      const sumaExtraidaDolares = movimientosLimpios.reduce((sum, m) => sum + (m.monto_dolares || 0), 0);
      
      console.log('[Parser] ' + movimientosLimpios.length + ' movimientos extraidos');
      console.log('[Parser] Suma pesos: $' + sumaExtraidaPesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
      if (sumaExtraidaDolares > 0) {
        console.log('[Parser] Suma dólares: USD ' + sumaExtraidaDolares.toLocaleString('es-AR', {minimumFractionDigits: 2}));
      }
      
      if (resumen.total_consumos_pesos) {
        console.log('[Parser] Total pesos PDF: $' + resumen.total_consumos_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
        const diferencia = Math.abs(sumaExtraidaPesos - resumen.total_consumos_pesos);
        if (diferencia < 1) {
          console.log('[Parser] ✓ Totales coinciden EXACTAMENTE');
        } else {
          console.log('[Parser] ⚠️ Diferencia: $' + diferencia.toLocaleString('es-AR', {minimumFractionDigits: 2}));
        }
      }

      // Validar: consumos + impuestos ≈ total_a_pagar (puede diferir por pagos/saldo anterior)
      if (resumen.total_a_pagar_pesos && impuestos.total_impuestos > 0) {
        const sumaTotalCalculada = resumen.total_consumos_pesos + impuestos.total_impuestos;
        const diferenciaTotal = sumaTotalCalculada - resumen.total_a_pagar_pesos;
        console.log('[Validación] Consumos($' + resumen.total_consumos_pesos.toLocaleString('es-AR') + ') + Impuestos($' + impuestos.total_impuestos.toLocaleString('es-AR') + ') = $' + sumaTotalCalculada.toLocaleString('es-AR'));
        if (Math.abs(diferenciaTotal) < 100) {
          console.log('[Validación] ✓ Total a pagar coincide ($' + resumen.total_a_pagar_pesos.toLocaleString('es-AR') + ')');
        } else if (diferenciaTotal > 0) {
          console.log('[Validación] ℹ️ Pagos/créditos en período: ~$' + diferenciaTotal.toLocaleString('es-AR'));
        } else {
          console.log('[Validación] ℹ️ Saldo anterior pendiente: ~$' + Math.abs(diferenciaTotal).toLocaleString('es-AR'));
        }
      }

      console.log('[Parser] ' + compras.length + ' compras en cuotas detectadas');
      
      return {
        exito: true,
        tarjeta: tarjeta.nombre,
        resumen: {
          ...resumen,
          banco: tarjeta.banco,
          tipo: tarjeta.tipo,
          total_consumos_dolares: sumaExtraidaDolares
        },
        movimientos: movimientosLimpios,
        compras,
        movimientosDudosos: movimientosLimpios.filter(m => m.es_dudoso)
      };
      
    } catch (error) {
      console.error('[Parser] Error:', error);
      return {
        exito: false,
        error: error.message
      };
    }
  }

  detectarFormato(texto) {
    const textoUpper = texto.toUpperCase();

    if (textoUpper.includes('MASTERCARD') && textoUpper.includes('GALICIA')) {
      return 'GALICIA_MASTERCARD';
    }

    if (textoUpper.includes('VISA') && textoUpper.includes('GALICIA')) {
      return 'GALICIA_VISA';
    }

    if ((textoUpper.includes('BBVA') || textoUpper.includes('BANCO BBVA')) && textoUpper.includes('VISA')) {
      return 'BBVA_VISA';
    }

    if ((textoUpper.includes('SANTANDER') || textoUpper.includes('SANTANDER RIO')) && textoUpper.includes('VISA')) {
      return 'SANTANDER_VISA';
    }

    return 'DESCONOCIDO';
  }

  detectarTarjeta(texto) {
    const textoUpper = texto.toUpperCase();

    const esVisa = /VISA/i.test(textoUpper);
    const esMastercard = /MASTERCARD/i.test(textoUpper);
    const esGalicia = /GALICIA|BANCO\s+GALICIA/i.test(textoUpper);
    const esBBVA = /BBVA|BANCO\s+BBVA/i.test(textoUpper);

    if (esVisa && esGalicia) {
      return { id: 1, nombre: 'VISA Galicia', tipo: 'VISA', banco: 'Galicia' };
    } else if (esMastercard && esGalicia) {
      return { id: 2, nombre: 'Mastercard Galicia', tipo: 'MASTERCARD', banco: 'Galicia' };
    } else if (esVisa && esBBVA) {
      return { id: 3, nombre: 'VISA BBVA', tipo: 'VISA', banco: 'BBVA' };
    }

    const esSantander = /SANTANDER/i.test(textoUpper);
    if (esVisa && esSantander) {
      return { id: 4, nombre: 'VISA Santander', tipo: 'VISA', banco: 'Santander' };
    }

    // Macro: buscar "MACRO" o "Sucursal.*CAMPANA" o patrones típicos de Macro
    const esMacro = /MACRO|BANCO\s+MACRO|Sucursal.*CAMPANA|CAMPANA.*CUIT/i.test(textoUpper);
    if (esVisa && esMacro) {
      return { id: 5, nombre: 'VISA Macro', tipo: 'VISA', banco: 'Macro' };
    }
    if (esMastercard && esMacro) {
      return { id: 6, nombre: 'Mastercard Macro', tipo: 'MASTERCARD', banco: 'Macro' };
    }
    // Si detectamos Macro sin tipo de tarjeta específico, asumir VISA (más común)
    if (esMacro && !esVisa && !esMastercard) {
      // Buscar indicadores en el texto
      if (/TARJETA\s+\d{4}.*Total\s+Consumos/i.test(textoUpper)) {
        return { id: 5, nombre: 'VISA Macro', tipo: 'VISA', banco: 'Macro' };
      }
    }

    throw new Error('No se pudo detectar el tipo de tarjeta del PDF');
  }

  extraerMetadatos(lineas, tarjeta, textoCompleto) {
    let metadatos = {
      mes: null,
      anio: null,
      fecha_cierre: null,
      fecha_vencimiento: null,
      total_a_pagar_pesos: 0,
      total_a_pagar_dolares: 0,
      total_consumos_pesos: 0,
      total_consumos_dolares: 0,
      impuestos: {
        iva: 0,
        sellos: 0,
        iibb: 0,
        percepciones: 0,
        comisiones: 0,
        impuesto_pais: 0,
        otros: 0,
        total_impuestos: 0
      }
    };
    
    // Buscar "Total Consumos de NOMBRE APELLIDO MONTO_PESOS MONTO_DOLARES" (VISA Galicia, BBVA y Macro)
    // Macro tiene múltiples tarjetas: "TARJETA XXXX Total Consumos de NOMBRE MONTO *"
    const regexTotalConsumos = /(?:TARJETA\s+\d+\s+)?Total\s+Consumos\s+de\s+[\w\s]+?\s+([\d.]+,\d{2})\s*\*?\s*([\d.,]+)?\s*\*?/gi;
    let totalConsumosMatch;
    let sumaTotalConsumosPesos = 0;
    let sumaTotalConsumosDolares = 0;
    let cantidadTarjetasAdicionales = 0;

    while ((totalConsumosMatch = regexTotalConsumos.exec(textoCompleto)) !== null) {
      const montoPesos = this.parsearMonto(totalConsumosMatch[1]);
      sumaTotalConsumosPesos += montoPesos;
      if (totalConsumosMatch[2]) {
        sumaTotalConsumosDolares += this.parsearMonto(totalConsumosMatch[2]);
      }
      cantidadTarjetasAdicionales++;
      console.log('[Metadatos] Total consumos tarjeta adicional #' + cantidadTarjetasAdicionales + ': $' + montoPesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
    }

    if (sumaTotalConsumosPesos > 0) {
      metadatos.total_consumos_pesos = sumaTotalConsumosPesos;
      if (sumaTotalConsumosDolares > 0) {
        metadatos.total_consumos_dolares = sumaTotalConsumosDolares;
      }
      console.log('[Metadatos] Total consumos (suma de ' + cantidadTarjetasAdicionales + ' tarjetas): $' + metadatos.total_consumos_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
    }

    // Mastercard Galicia: "TOTAL CONSUMOS EN PESOS" o "Total del Período" o buscar en líneas
    if (!metadatos.total_consumos_pesos) {
      // Patrón 1: "TOTAL CONSUMOS EN PESOS 1.234,56"
      const totalConsumosMC1 = textoCompleto.match(/TOTAL\s+CONSUMOS\s+EN\s+PESOS\s+([\d.]+,\d{2})/i);
      if (totalConsumosMC1) {
        metadatos.total_consumos_pesos = this.parsearMonto(totalConsumosMC1[1]);
        console.log('[Metadatos] Total consumos Mastercard: $' + metadatos.total_consumos_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
      }
    }

    if (!metadatos.total_consumos_pesos) {
      // Patrón 2: "CONSUMOS DEL PERIODO" o "CONSUMOS DEL MES" seguido de monto
      const totalConsumosMC2 = textoCompleto.match(/CONSUMOS\s+DEL\s+(?:PERIODO|MES|PERÍODO)\s*([\d.]+,\d{2})/i);
      if (totalConsumosMC2) {
        metadatos.total_consumos_pesos = this.parsearMonto(totalConsumosMC2[1]);
        console.log('[Metadatos] Total consumos período: $' + metadatos.total_consumos_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
      }
    }

    if (!metadatos.total_consumos_pesos) {
      // Patrón 3: Buscar línea "TOTAL CONSUMOS" y monto en siguiente línea o misma línea
      for (let i = 0; i < lineas.length; i++) {
        if (/^TOTAL\s+CONSUMOS$/i.test(lineas[i]) && i + 1 < lineas.length) {
          const siguienteLinea = lineas[i + 1].trim();
          const montoMatch = siguienteLinea.match(/^([\d.]+,\d{2})$/);
          if (montoMatch) {
            metadatos.total_consumos_pesos = this.parsearMonto(montoMatch[1]);
            console.log('[Metadatos] Total consumos (línea sig): $' + metadatos.total_consumos_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
            break;
          }
        }
        // También buscar "TOTAL CONSUMOS 1.234,56" en misma línea
        const totalEnLinea = lineas[i].match(/TOTAL\s+CONSUMOS\s+([\d.]+,\d{2})/i);
        if (totalEnLinea) {
          metadatos.total_consumos_pesos = this.parsearMonto(totalEnLinea[1]);
          console.log('[Metadatos] Total consumos (misma línea): $' + metadatos.total_consumos_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
          break;
        }
      }
    }

    // Buscar "TOTAL A PAGAR MONTO_PESOS MONTO_DOLARES"
    const totalPagarMatch = textoCompleto.match(/TOTAL\s+A\s+PAGAR\s+([\d.]+,\d{2})\s*([\d.,]+)?/i);
    if (totalPagarMatch) {
      metadatos.total_a_pagar_pesos = this.parsearMonto(totalPagarMatch[1]);
      if (totalPagarMatch[2]) {
        metadatos.total_a_pagar_dolares = this.parsearMonto(totalPagarMatch[2]);
      }
      console.log('[Metadatos] Total a pagar: $' + metadatos.total_a_pagar_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
    }

    // BBVA: Buscar "SALDO ACTUAL MONTO_PESOS MONTO_DOLARES" como alternativa
    if (!metadatos.total_a_pagar_pesos) {
      const saldoActualMatch = textoCompleto.match(/SALDO\s+ACTUAL\s+([\d.]+,\d{2})\s*([\d.,]+)?/i);
      if (saldoActualMatch) {
        metadatos.total_a_pagar_pesos = this.parsearMonto(saldoActualMatch[1]);
        if (saldoActualMatch[2]) {
          metadatos.total_a_pagar_dolares = this.parsearMonto(saldoActualMatch[2]);
        }
        console.log('[Metadatos] Saldo actual BBVA: $' + metadatos.total_a_pagar_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
      }
    }

    // Santander: Buscar "SALDO EN PESOS" o "TOTAL PESOS" o "LA SUMA DE"
    if (!metadatos.total_a_pagar_pesos) {
      // Patrón principal: "DEBITAREMOS DE SU C.C... LA SUMA DE $    204063,59 + U$S     33,15"
      const laSumaMatch = textoCompleto.match(/LA\s+SUMA\s+DE\s+\$\s*([\d.]+,\d{2})/i);
      if (laSumaMatch) {
        metadatos.total_a_pagar_pesos = this.parsearMonto(laSumaMatch[1]);
        console.log('[Metadatos] Total Santander (LA SUMA DE): $' + metadatos.total_a_pagar_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));

        // También extraer USD si está en la misma línea
        const usdMatch = textoCompleto.match(/LA\s+SUMA\s+DE\s+\$\s*[\d.]+,\d{2}\s*\+\s*U\$S\s*([\d.]+,\d{2})/i);
        if (usdMatch && !metadatos.total_a_pagar_dolares) {
          metadatos.total_a_pagar_dolares = this.parsearMonto(usdMatch[1]);
          console.log('[Metadatos] Total USD Santander: $' + metadatos.total_a_pagar_dolares.toLocaleString('es-AR', {minimumFractionDigits: 2}));
        }
      }

      // Patrones alternativos si no se encontró "LA SUMA DE"
      if (!metadatos.total_a_pagar_pesos) {
        const santanderPatterns = [
          /SALDO\s+EN\s+PESOS\s*\$?\s*([\d.]+,\d{2})/i,
          /TOTAL\s+PESOS\s*\$?\s*([\d.]+,\d{2})/i,
          /SALDO\s+TOTAL\s*\$?\s*([\d.]+,\d{2})/i,
          /IMPORTE\s+A\s+PAGAR\s*\$?\s*([\d.]+,\d{2})/i,
          /PAGO\s+TOTAL\s*\$?\s*([\d.]+,\d{2})/i
        ];
        for (const pattern of santanderPatterns) {
          const match = textoCompleto.match(pattern);
          if (match) {
            metadatos.total_a_pagar_pesos = this.parsearMonto(match[1]);
            console.log('[Metadatos] Total Santander: $' + metadatos.total_a_pagar_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
            break;
          }
        }
      }
    }

    // Santander: Buscar "SALDO EN DOLARES" o "TOTAL DOLARES"
    if (!metadatos.total_a_pagar_dolares) {
      const santanderUsdPatterns = [
        /SALDO\s+EN\s+D[OÓ]LARES\s*U\$?S?\s*([\d.]+,\d{2})/i,
        /TOTAL\s+D[OÓ]LARES\s*U\$?S?\s*([\d.]+,\d{2})/i,
        /SALDO\s+USD\s*([\d.]+,\d{2})/i
      ];
      for (const pattern of santanderUsdPatterns) {
        const match = textoCompleto.match(pattern);
        if (match) {
          metadatos.total_a_pagar_dolares = this.parsearMonto(match[1]);
          console.log('[Metadatos] Total USD Santander: $' + metadatos.total_a_pagar_dolares.toLocaleString('es-AR', {minimumFractionDigits: 2}));
          break;
        }
      }
    }

    // Macro: Si tiene múltiples tarjetas (TARJETA XXXX Total Consumos), el total a pagar
    // es la suma de los consumos + impuestos. Si no encontramos TOTAL A PAGAR explícito,
    // usamos los totales de consumos de tarjetas adicionales.
    if (!metadatos.total_a_pagar_pesos && cantidadTarjetasAdicionales > 0) {
      // Buscar impuestos específicos de Macro
      let impuestosMacro = 0;

      // IMPUESTO DE SELLOS
      const sellosMatch = textoCompleto.match(/IMPUESTO\s+DE\s+SELLOS\s*\$?\s*([\d.]+,\d{2})/i);
      if (sellosMatch) {
        impuestosMacro += this.parsearMonto(sellosMatch[1]);
      }

      // INTERESES FINANCIACION
      const interesesMatch = textoCompleto.match(/INTERESES\s+FINANCIACION\s*\$?\s*([\d.]+,\d{2})/i);
      if (interesesMatch) {
        impuestosMacro += this.parsearMonto(interesesMatch[1]);
      }

      // IVA (DB IVA $ 21% o similar)
      const ivaMatch = textoCompleto.match(/(?:DB\s+)?IVA\s*(?:\$\s*)?(?:21%?)?\s*([\d.]+,\d{2})/i);
      if (ivaMatch) {
        impuestosMacro += this.parsearMonto(ivaMatch[1]);
      }

      metadatos.total_a_pagar_pesos = sumaTotalConsumosPesos + impuestosMacro;
      console.log('[Metadatos] Total Macro (consumos + impuestos): $' + metadatos.total_a_pagar_pesos.toLocaleString('es-AR', {minimumFractionDigits: 2}));
    }

    // NO usar aproximaciones - los totales deben ser exactos del PDF
    if (!metadatos.total_a_pagar_pesos) {
      console.log('[Metadatos] ⚠️ No se encontró total a pagar - revisar formato del PDF');
    }
    
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];

      // BBVA: Buscar "CIERRE ACTUAL" seguido de fecha en línea siguiente
      if (/^CIERRE\s+ACTUAL$/i.test(linea) && i + 1 < lineas.length) {
        const fechaCierre = lineas[i + 1]?.trim();
        if (/^\d{2}-\w{3}-\d{2}$/.test(fechaCierre)) {
          metadatos.fecha_cierre = this.parsearFechaGaliciaMes(fechaCierre);
        }
      }

      // BBVA: Buscar "VENCIMIENTO ACTUAL" seguido de fecha en línea siguiente
      if (/^VENCIMIENTO\s+ACTUAL$/i.test(linea) && i + 1 < lineas.length) {
        const fechaVenc = lineas[i + 1]?.trim();
        if (/^\d{2}-\w{3}-\d{2}$/.test(fechaVenc)) {
          metadatos.fecha_vencimiento = this.parsearFechaGaliciaMes(fechaVenc);
        }
      }

      // Galicia: fechas concatenadas en una línea (ej: "13-Nov-2525-Nov-2518-Dic-25")
      // Formato: CierreAnterior + VencimientoAnterior + CierreActual, luego VencimientoActual en línea siguiente
      if (!metadatos.fecha_cierre && /\d{2}-\w{3}-\d{2}/.test(linea) && linea.includes('-')) {
        const fechas = linea.match(/(\d{2}-\w{3}-\d{2})/g);
        if (fechas && fechas.length >= 3) {
          // 3 fechas en línea: la tercera es Cierre Actual
          metadatos.fecha_cierre = this.parsearFechaGaliciaMes(fechas[2]);
          // Buscar vencimiento en línea siguiente
          if (i + 1 < lineas.length) {
            const siguienteLinea = lineas[i + 1];
            const fechaVenc = siguienteLinea.match(/(\d{2}-\w{3}-\d{2})/);
            if (fechaVenc) {
              metadatos.fecha_vencimiento = this.parsearFechaGaliciaMes(fechaVenc[1]);
            }
          }
        } else if (fechas && fechas.length === 2) {
          // 2 fechas: asumir cierre y vencimiento
          metadatos.fecha_cierre = this.parsearFechaGaliciaMes(fechas[0]);
          metadatos.fecha_vencimiento = this.parsearFechaGaliciaMes(fechas[1]);
        }
      }

      // Santander: "CIERRE  30 Oct 25VENCIMIENTO 07 Nov 25"
      if (!metadatos.fecha_cierre && /CIERRE.*VENCIMIENTO/i.test(linea)) {
        const santanderMatch = linea.match(/CIERRE\s+(\d{1,2})\s+(\w+)\s+(\d{2}).*?VENCIMIENTO\s+(\d{1,2})\s+(\w+)\s+(\d{2})/i);
        if (santanderMatch) {
          metadatos.fecha_cierre = this.parsearFechaSantander(santanderMatch[1], santanderMatch[2], santanderMatch[3]);
          metadatos.fecha_vencimiento = this.parsearFechaSantander(santanderMatch[4], santanderMatch[5], santanderMatch[6]);
        }
      }
    }
    
    if (metadatos.fecha_cierre) {
      const fecha = new Date(metadatos.fecha_cierre);
      metadatos.mes = fecha.getMonth() + 1;
      metadatos.anio = fecha.getFullYear();
    }

    return metadatos;
  }

  // ==================== IMPUESTOS Y CARGOS ====================
  // Extrae impuestos y cargos financieros del resumen
  extraerImpuestos(lineas, textoCompleto) {
    const impuestos = {
      iva: 0,
      sellos: 0,
      iibb: 0,
      percepciones: 0,
      comisiones: 0,
      impuesto_pais: 0,
      intereses_financiacion: 0,
      punitorios: 0,
      seguro_vida: 0,
      cargos_gestion: 0,
      otros: 0,
      total_impuestos: 0
    };

    // Patrones para detectar líneas de impuestos y cargos
    // Galicia: "18-12-25 INTERESES FINANCIACION $ 108.005,69"
    // Galicia: "18-12-25 PUNIT. PAG.MIN.ANTERIOR $ ... 15.666,84" (monto al final)
    // Galicia: "18-12-25 DB IVA $ 21% ... 25.971,23" (monto al final)
    // Santander: "30 IMPUESTO DE SELLOS $ 25.454,32"
    // BBVA: "DB.RG 5617..." con monto en línea siguiente
    const patrones = [
      { regex: /DB\.?RG\s+5617.*30%/i, campo: 'impuesto_pais' },
      { regex: /DB\s+IVA.*21%/i, campo: 'iva' },
      { regex: /I\.V\.A\.\s+21/i, campo: 'iva' },  // Mastercard Galicia: "I.V.A. 21,0%"
      { regex: /IVA\s+RG\s+4240/i, campo: 'percepciones' },
      { regex: /IMPUESTO\s+DE\s+SELLOS\s+P/i, campo: 'sellos' },  // Sellos sobre intereses (BBVA)
      { regex: /IMPUESTO\s+DE\s+SELLOS(?!\s+P)/i, campo: 'sellos' },
      { regex: /IMP\s+DE\s+SELLOS\s+P/i, campo: 'sellos' },  // Sellos sobre intereses (Galicia)
      { regex: /IMP\s+DE\s+SELLOS(?!\s+P)/i, campo: 'sellos' },
      { regex: /IIBB\s+PERCEP/i, campo: 'iibb' },
      { regex: /COMISION\s+CUENTA/i, campo: 'comisiones' },
      { regex: /INTERESES\s+COMPENSATORIOS/i, campo: 'intereses_financiacion' },  // Mastercard Galicia
      { regex: /INTERESES\s+FINANCIAC/i, campo: 'intereses_financiacion' },       // VISA Galicia
      { regex: /INTERESES\s+PUNITORIOS/i, campo: 'punitorios' },                  // Mastercard Galicia
      { regex: /PUNIT.*PAG.*MIN/i, campo: 'punitorios' },                         // VISA Galicia
      { regex: /SEGURO\s+DE\s+VIDA/i, campo: 'seguro_vida' },
      { regex: /CARGO.*GESTION/i, campo: 'cargos_gestion' },
      { regex: /GESTION.*COBR/i, campo: 'cargos_gestion' },
      { regex: /TRANSFERENCIA\s+DEUDA/i, campo: 'otros' }
    ];

    // Procesar líneas buscando impuestos (con deduplicación)
    const impuestosEncontrados = new Set();

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];

      for (const patron of patrones) {
        if (patron.regex.test(linea)) {
          let montoStr = null;

          // BBVA: monto puede estar en línea siguiente (solo si es positivo)
          // Formato: "DB IVA $ 21% [base]" y en la siguiente línea "[resultado]"
          if (i + 1 < lineas.length) {
            const siguienteLinea = lineas[i + 1].trim();
            // Solo usar línea siguiente si es un monto POSITIVO (sin signo menos)
            if (/^[\d.]+,\d{2}$/.test(siguienteLinea)) {
              montoStr = siguienteLinea;
            }
          }
          // Si no hay monto positivo en línea siguiente, buscar al final de la línea actual
          if (!montoStr) {
            const montoEnLinea = linea.match(/([\d.]+,\d{2})\s*$/);
            if (montoEnLinea) {
              montoStr = montoEnLinea[1];
            }
          }

          if (montoStr) {
            // Clave única: tipo + monto (evita duplicados entre páginas)
            const clave = `${patron.campo}-${montoStr}`;
            if (!impuestosEncontrados.has(clave)) {
              impuestosEncontrados.add(clave);
              const monto = this.parsearMonto(montoStr);
              impuestos[patron.campo] += monto;
            }
          }
          break; // Solo un patrón por línea
        }
      }
    }

    // Calcular total (impuestos + cargos financieros)
    impuestos.total_impuestos =
      impuestos.iva +
      impuestos.sellos +
      impuestos.iibb +
      impuestos.percepciones +
      impuestos.comisiones +
      impuestos.impuesto_pais +
      impuestos.intereses_financiacion +
      impuestos.punitorios +
      impuestos.seguro_vida +
      impuestos.cargos_gestion +
      impuestos.otros;

    // Log de impuestos y cargos
    if (impuestos.total_impuestos > 0) {
      const partes = [];
      if (impuestos.iva > 0) partes.push(`IVA: $${impuestos.iva.toLocaleString('es-AR')}`);
      if (impuestos.sellos > 0) partes.push(`Sellos: $${impuestos.sellos.toLocaleString('es-AR')}`);
      if (impuestos.iibb > 0) partes.push(`IIBB: $${impuestos.iibb.toLocaleString('es-AR')}`);
      if (impuestos.percepciones > 0) partes.push(`Percep: $${impuestos.percepciones.toLocaleString('es-AR')}`);
      if (impuestos.comisiones > 0) partes.push(`Comis: $${impuestos.comisiones.toLocaleString('es-AR')}`);
      if (impuestos.impuesto_pais > 0) partes.push(`Imp.País: $${impuestos.impuesto_pais.toLocaleString('es-AR')}`);
      if (impuestos.intereses_financiacion > 0) partes.push(`Int.Fin: $${impuestos.intereses_financiacion.toLocaleString('es-AR')}`);
      if (impuestos.punitorios > 0) partes.push(`Punit: $${impuestos.punitorios.toLocaleString('es-AR')}`);
      if (impuestos.seguro_vida > 0) partes.push(`Seguro: $${impuestos.seguro_vida.toLocaleString('es-AR')}`);
      if (impuestos.cargos_gestion > 0) partes.push(`Gestión: $${impuestos.cargos_gestion.toLocaleString('es-AR')}`);

      console.log('[Impuestos] ' + partes.join(' | '));
      console.log('[Impuestos] Total: $' + impuestos.total_impuestos.toLocaleString('es-AR', { minimumFractionDigits: 2 }));
    }

    return impuestos;
  }

  extraerMovimientos(lineas, textoCompleto) {
    if (this.formatoDetectado === 'GALICIA_VISA' || this.formatoDetectado === 'GALICIA_MASTERCARD') {
      return this.extraerMovimientosGalicia(lineas);
    }
    if (this.formatoDetectado === 'BBVA_VISA') {
      return this.extraerMovimientosBBVA(lineas);
    }
    if (this.formatoDetectado === 'SANTANDER_VISA') {
      return this.extraerMovimientosSantander(lineas);
    }
    return [];
  }

  extraerMovimientosGalicia(lineas) {
    const movimientos = [];
    let dentroDeTabla = false;
    let i = 0;
    
    while (i < lineas.length) {
      const linea = lineas[i];
      
      if (linea.includes('DETALLE DEL CONSUMO')) {
        dentroDeTabla = true;
        i++;
        continue;
      }
      
      if (dentroDeTabla && (
          /^TARJETA\s+\d{4}/i.test(linea) ||
          linea.includes('IMP DE SELLOS') ||
          linea.includes('INTERESES FINANC') ||
          linea.includes('PUNIT.')
      )) {
        dentroDeTabla = false;
        i++;
        continue;
      }
      
      if (!dentroDeTabla) {
        i++;
        continue;
      }
      
      if (/^FECHA.*REFERENCIA/i.test(linea) || /^PESOSD[OÓ]LARES$/i.test(linea)) {
        i++;
        continue;
      }
      
      // Detectar linea con fecha: DD-MM-YY o DD-MMM-YY (con mes en letras)
      const fechaMatch = linea.match(/^(\d{2}-(?:\d{2}|[A-Za-z]{3})-\d{2})([*KVEU]?)(.*)$/);
      
      if (fechaMatch) {
        const fecha = fechaMatch[1];
        const resto = fechaMatch[3].trim();
        
        const mov = this.parsearLineaGalicia(fecha, resto, lineas, i);
        
        if (mov && (mov.monto_pesos !== 0 || mov.monto_dolares)) {
          movimientos.push(mov);
          const montoStr = mov.monto_dolares ? `$${mov.monto_pesos} | USD ${mov.monto_dolares}` : `$${mov.monto_pesos}`;
          console.log('[Galicia] ' + mov.fecha_compra + ' | ' + mov.referencia_original.substring(0, 25).padEnd(25) + ' | ' + montoStr);
        }
      }
      
      i++;
    }
    
    return movimientos;
  }

  parsearLineaGalicia(fecha, resto, lineas, index) {
    let montoPesos = 0;
    let montoDolares = null;
    let cuotaTexto = null;
    let referencia = resto;
    
    // Caso especial: compra en dólares (tiene "USD" en la línea)
    if (/USD\s+[\d.,]+/.test(resto)) {
      const usdMatch = resto.match(/USD\s+([\d.,]+)/);
      if (usdMatch) {
        montoDolares = this.parsearMonto(usdMatch[1]);
      }
      
      // Para compras en USD, el monto en pesos es 0
      montoPesos = 0;
      
      // La referencia es lo que está antes de "USD"
      referencia = resto.substring(0, resto.indexOf('USD')).trim();
      
      // Extraer cuota si existe
      const cuotaMatch = referencia.match(/\s(\d{1,2}\/\d{1,2})(?:\s|$)/);
      if (cuotaMatch) {
        cuotaTexto = cuotaMatch[1];
        referencia = referencia.replace(/\s\d{1,2}\/\d{1,2}/, ' ').trim();
      }
      
      referencia = this.limpiarReferenciaBasica(referencia);
      
      return {
        fecha_compra: this.parsearFechaVisaGalicia(fecha),
        referencia_original: referencia,
        cuota_texto: cuotaTexto,
        monto_pesos: montoPesos,
        monto_dolares: montoDolares,
        es_devolucion: false
      };
    }
    
    // Verificar si el monto está en la misma línea (termina con ,XX)
    const tieneMontoEnLinea = /,\d{2}$/.test(resto);
    
    if (tieneMontoEnLinea) {
      const longitudComprobante = (this.formatoDetectado === 'GALICIA_MASTERCARD') ? 5 : 6;
      
      const regexCuota = new RegExp(`^(.*)\\s+(\\d{1,2})\\/(\\d{1,2})(\\d{${longitudComprobante}})([\\d.]+,\\d{2})$`);
      let cuotaMatch = resto.match(regexCuota);
      
      if (cuotaMatch) {
        referencia = cuotaMatch[1].trim();
        cuotaTexto = cuotaMatch[2] + '/' + cuotaMatch[3];
        montoPesos = this.parsearMonto(cuotaMatch[5]);
      } else {
        const resultado = this.separarComprobanteYMonto(resto, this.formatoDetectado);
        montoPesos = resultado.monto;
        referencia = resultado.referencia;
      }
      
    } else {
      // Monto en líneas separadas
      let j = index + 1;
      while (j < lineas.length && j <= index + 3) {
        const siguienteLinea = lineas[j].trim();
        
        if (/^\d+$/.test(siguienteLinea)) {
          j++;
          continue;
        }
        
        if (/^[\d.]+,\d{2}$/.test(siguienteLinea)) {
          if (montoPesos === 0) {
            montoPesos = this.parsearMonto(siguienteLinea);
          } else {
            montoDolares = this.parsearMonto(siguienteLinea);
          }
          j++;
          continue;
        }
        
        if (/^\d{2}-\d{2}-\d{2}/.test(siguienteLinea)) {
          break;
        }
        
        j++;
      }
    }
    
    // Extraer cuota de la referencia
    const cuotaMatch = referencia.match(/\s(\d{1,2}\/\d{1,2})(?:\s|$)/);
    if (cuotaMatch) {
      cuotaTexto = cuotaMatch[1];
      referencia = referencia.replace(/\s\d{1,2}\/\d{1,2}/, ' ').trim();
    }
    
    referencia = this.limpiarReferenciaBasica(referencia);
    
    if (referencia.length === 0 || montoPesos === 0) return null;
    
    return {
      fecha_compra: this.parsearFechaVisaGalicia(fecha),
      referencia_original: referencia,
      cuota_texto: cuotaTexto,
      monto_pesos: montoPesos,
      monto_dolares: montoDolares,
      es_devolucion: montoPesos < 0
    };
  }

  separarComprobanteYMonto(texto, formato) {
    const longitudComprobante = (formato === 'GALICIA_MASTERCARD') ? 5 : 6;
    
    const posicionComa = texto.lastIndexOf(',');
    if (posicionComa === -1 || posicionComa < 2) {
      return { monto: 0, referencia: texto };
    }
    
    const decimales = texto.substring(posicionComa + 1);
    if (decimales.length !== 2 || !/^\d{2}$/.test(decimales)) {
      return { monto: 0, referencia: texto };
    }
    
    let posInicioMonto = posicionComa - 1;
    while (posInicioMonto >= 0 && /[\d.]/.test(texto[posInicioMonto])) {
      posInicioMonto--;
    }
    
    let esNegativo = false;
    if (posInicioMonto >= 0 && texto[posInicioMonto] === '-') {
      esNegativo = true;
      posInicioMonto--;
    }
    
    while (posInicioMonto >= 0 && /\d/.test(texto[posInicioMonto])) {
      posInicioMonto--;
    }
    
    posInicioMonto++;
    
    const bloqueCompleto = texto.substring(posInicioMonto, posicionComa + 3);
    const digitosPuros = bloqueCompleto.replace(/\./g, '').replace(',', '').replace('-', '');
    
    if (digitosPuros.length <= longitudComprobante) {
      let monto = this.parsearMonto(bloqueCompleto);
      if (esNegativo && monto > 0) monto = -monto;
      const referencia = texto.substring(0, posInicioMonto).trim();
      return { monto, referencia };
    }
    
    const montoDigitos = digitosPuros.substring(longitudComprobante);
    const parteEntera = montoDigitos.substring(0, montoDigitos.length - 2);
    const parteDecimal = montoDigitos.substring(montoDigitos.length - 2);
    let monto = parseFloat(parteEntera + '.' + parteDecimal) || 0;
    
    if (esNegativo) {
      monto = -monto;
    }
    
    const referencia = texto.substring(0, posInicioMonto).trim();
    
    return { monto, referencia };
  }

  // ==================== SANTANDER ====================
  // Formato: YY MES DD COMPROBANTE [*KFE] DESCRIPCION [C.NN/NN] [USD X,XX] MONTO_PESOS [MONTO_USD]
  // La fecha puede continuar de línea anterior (solo día)
  extraerMovimientosSantander(lineas) {
    const movimientos = [];
    let anioActual = null;
    let mesActual = null;

    const mesesSantander = {
      'enero': '01', 'febrer': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
      'julio': '07', 'agosto': '08', 'septie': '09', 'octubr': '10', 'noviem': '11', 'diciem': '12'
    };


    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();

      // Ignorar líneas de encabezado, totales e impuestos
      if (/^Santander|^RESUMEN|^VISA|^Sucursal|^Grupo|^Cuenta|^Fecha.*Comprobante|^EL PRESENTE|^SALDO|^PAGO|^CAMPANA|^SUPERCLUB|^Le recordamos|^IVA:|^RAWSON|^PROV|^Cierre|^Prox|^LIMITES|^Tarjeta.*Total|^IMPUESTO|^IIBB|^IVA RG|^TNA|^\s*\(|^_+$/i.test(linea)) {
        continue;
      }

      // Detectar línea de movimiento con fecha completa: YY MES DD COMPROBANTE [*KFEU] DESCRIPCION
      // Ejemplo: "25 Octubre 03 310095 K  MERPAGO*MERCADOPAGO"
      const matchFechaCompleta = linea.match(/^(\d{2})\s+([A-Za-z]+\.?)\s+(\d{1,2})\s+(\d{4,10})\s*([*KFEU]?)\s+(.+)$/);

      if (matchFechaCompleta) {
        anioActual = '20' + matchFechaCompleta[1];
        const mesTexto = matchFechaCompleta[2].toLowerCase().substring(0, 6);
        mesActual = mesesSantander[mesTexto] || '01';
        const dia = matchFechaCompleta[3].padStart(2, '0');
        const descripcion = matchFechaCompleta[6];

        const mov = this.parsearLineaSantander(anioActual, mesActual, dia, descripcion);
        if (mov) {
          movimientos.push(mov);
          const montoStr = mov.monto_dolares ? `$${mov.monto_pesos} | USD ${mov.monto_dolares}` : `$${mov.monto_pesos}`;
          console.log('[Santander] ' + mov.fecha_compra + ' | ' + mov.referencia_original.substring(0, 25).padEnd(25) + ' | ' + montoStr);
        }
        continue;
      }

      // Detectar línea de movimiento con solo día (continúa fecha anterior)
      // Ejemplo: "12 009242 *  WWW.JULERIAQUE.COM.A"
      const matchSoloDia = linea.match(/^(\d{1,2})\s+(\d{4,10})\s*([*KFEU]?)\s+(.+)$/);

      if (matchSoloDia && anioActual && mesActual) {
        const dia = matchSoloDia[1].padStart(2, '0');
        const descripcion = matchSoloDia[4];

        const mov = this.parsearLineaSantander(anioActual, mesActual, dia, descripcion);
        if (mov) {
          movimientos.push(mov);
          const montoStr = mov.monto_dolares ? `$${mov.monto_pesos} | USD ${mov.monto_dolares}` : `$${mov.monto_pesos}`;
          console.log('[Santander] ' + mov.fecha_compra + ' | ' + mov.referencia_original.substring(0, 25).padEnd(25) + ' | ' + montoStr);
        }
        continue;
      }

      // Detectar línea SIN comprobante (solo día + espacios + descripción)
      // Ejemplo: "15           COM.RENO.A.TARJ.TIT      02/03                            18.633,33"
      const matchSinComprobante = linea.match(/^(\d{1,2})\s{3,}([A-Z].+[\d,]+)\s*$/);

      if (matchSinComprobante && anioActual && mesActual) {
        const dia = matchSinComprobante[1].padStart(2, '0');
        const descripcion = matchSinComprobante[2];

        // Ignorar líneas de impuestos, pagos y otros
        if (/^(IMPUESTO|DB\s+IVA|IVA\s+RG|IIBB|COMI\.MANT|DB\.IMPUESTO|DB\.RG|PUNIT|INTERESES)/i.test(descripcion)) {
          continue;
        }

        const mov = this.parsearLineaSantander(anioActual, mesActual, dia, descripcion);
        if (mov) {
          movimientos.push(mov);
          const montoStr = mov.monto_dolares ? `$${mov.monto_pesos} | USD ${mov.monto_dolares}` : `$${mov.monto_pesos}`;
          console.log('[Santander] ' + mov.fecha_compra + ' | ' + mov.referencia_original.substring(0, 25).padEnd(25) + ' | ' + montoStr);
        }
        continue;
      }

    }

    return movimientos;
  }

  parsearLineaSantander(anio, mes, dia, descripcion) {
    let montoPesos = 0;
    let montoDolares = null;
    let cuotaTexto = null;
    let referencia = descripcion.trim();

    // Buscar cuota formato Santander: C.NN/NN
    const cuotaMatch = referencia.match(/C\.(\d{1,2})\/(\d{1,2})/i);
    if (cuotaMatch) {
      cuotaTexto = cuotaMatch[1] + '/' + cuotaMatch[2];
      referencia = referencia.replace(/C\.\d{1,2}\/\d{1,2}/i, ' ').trim();
    }

    // Buscar USD inline: "USD X,XX"
    const usdMatch = referencia.match(/USD\s+([\d.,]+)/i);
    if (usdMatch) {
      montoDolares = this.parsearMonto(usdMatch[1]);
      // En Santander, cuando hay USD el monto al final es el mismo USD, no hay monto en pesos
      // Remover el USD y también el monto duplicado al final
      referencia = referencia.replace(/USD\s+[\d.,]+/i, ' ').trim();
      referencia = referencia.replace(/\s+[\d.]+,\d{2}\s*$/, '').trim();
      montoPesos = 0; // Compras en USD no tienen monto en pesos
    } else if (/COP\s+[\d.,]+/i.test(referencia)) {
      // Compras en pesos colombianos (COP): el monto final es USD
      // Ejemplo: "IN BOND GEMA N 1          COP  138.396,00                   33,15"
      const copMatch = referencia.match(/COP\s+([\d.,]+)/i);
      const usdFinal = referencia.match(/\s+([\d.]+,\d{2})\s*$/);
      if (usdFinal) {
        montoDolares = this.parsearMonto(usdFinal[1]);
      }
      referencia = referencia.replace(/COP\s+[\d.,]+/i, ' ').trim();
      referencia = referencia.replace(/\s+[\d.]+,\d{2}\s*$/, '').trim();
      montoPesos = 0; // Compras en COP no tienen monto en pesos
    } else {
      // Buscar montos al final de la línea (solo si no hay USD)
      // Pueden ser: MONTO_PESOS [MONTO_USD] o MONTO_PESOS- (negativo)
      const montosMatch = referencia.match(/\s+([\d.]+,\d{2})(-?)\s*([\d.]+,\d{2})?\s*$/);
      if (montosMatch) {
        montoPesos = this.parsearMonto(montosMatch[1]);
        if (montosMatch[2] === '-') {
          montoPesos = -montoPesos;
        }
        if (montosMatch[3]) {
          montoDolares = this.parsearMonto(montosMatch[3]);
        }
        referencia = referencia.replace(/\s+[\d.]+,\d{2}-?\s*([\d.]+,\d{2})?\s*$/, '').trim();
      }
    }

    // Limpiar referencia
    referencia = this.limpiarReferenciaBasica(referencia);

    // Ignorar si no hay monto o referencia
    if (referencia.length === 0 || (montoPesos === 0 && !montoDolares)) return null;

    // Ignorar pagos
    if (/^SU PAGO/i.test(referencia)) return null;

    return {
      fecha_compra: `${anio}-${mes}-${dia}`,
      referencia_original: referencia,
      cuota_texto: cuotaTexto,
      monto_pesos: montoPesos,
      monto_dolares: montoDolares,
      es_devolucion: montoPesos < 0
    };
  }

  // ==================== BBVA ====================
  // Formato BBVA: movimientos en múltiples líneas
  // Línea 1: Fecha (DD-Mmm-YY)
  // Línea 2: Descripción [C.NN/NN] [USD X,XX] NRO_CUPON
  // Línea 3: Monto pesos o dólares
  extraerMovimientosBBVA(lineas) {
    const movimientos = [];
    let dentroDeConsumos = false;
    let i = 0;

    while (i < lineas.length) {
      const linea = lineas[i];

      // Detectar INICIO de sección de consumos (ej: "Consumos Mauro Blandi")
      if (/^Consumos\s+\w+/i.test(linea)) {
        dentroDeConsumos = true;
        i++;
        continue;
      }

      // Detectar FIN de sección de consumos
      if (dentroDeConsumos && (
          /^Total\s+Consumos/i.test(linea) ||
          /^Banco\s+BBVA/i.test(linea) ||
          /^Sobre\s+\(/i.test(linea) ||
          /^Tasas$/i.test(linea) ||
          /^Total\s+de\s+cuotas/i.test(linea) ||
          /^COMISION\s+CUENTA/i.test(linea) ||
          /^Sus\s+pagos/i.test(linea)
      )) {
        dentroDeConsumos = false;
        i++;
        continue;
      }

      // Ignorar secciones que NO son consumos
      if (!dentroDeConsumos) {
        i++;
        continue;
      }

      // Ignorar header de tabla
      if (/^FECHADESCRIPCI[OÓ]N/i.test(linea)) {
        i++;
        continue;
      }

      // Detectar línea con SOLO fecha BBVA: DD-Mmm-YY
      const fechaMatch = linea.match(/^(\d{2}-[A-Za-z]{3}-\d{2})$/);
      if (fechaMatch && i + 1 < lineas.length) {
        const fecha = fechaMatch[1];
        const lineaDescripcion = lineas[i + 1]?.trim() || '';

        // Buscar línea de monto (puede ser i+2 o estar incluido)
        let lineaMonto = '';
        if (i + 2 < lineas.length && /^-?[\d.]+,\d{2}$/.test(lineas[i + 2]?.trim())) {
          lineaMonto = lineas[i + 2].trim();
        }

        const mov = this.parsearMovimientoBBVA(fecha, lineaDescripcion, lineaMonto);
        if (mov && (mov.monto_pesos !== 0 || mov.monto_dolares)) {
          movimientos.push(mov);
          const montoStr = mov.monto_dolares
            ? `$${mov.monto_pesos} | USD ${mov.monto_dolares}`
            : `$${mov.monto_pesos}`;
          console.log('[BBVA] ' + mov.fecha_compra + ' | ' + mov.referencia_original.substring(0, 25).padEnd(25) + ' | ' + montoStr);
        }

        // Saltar las líneas procesadas
        i += lineaMonto ? 3 : 2;
        continue;
      }

      i++;
    }

    return movimientos;
  }

  parsearMovimientoBBVA(fecha, lineaDescripcion, lineaMonto) {
    let montoPesos = 0;
    let montoDolares = null;
    let cuotaTexto = null;
    let referencia = lineaDescripcion;

    // Buscar cuota formato BBVA: C.NN/NN
    const cuotaMatch = referencia.match(/C\.(\d{1,2})\/(\d{1,2})/i);
    if (cuotaMatch) {
      cuotaTexto = cuotaMatch[1] + '/' + cuotaMatch[2];
      referencia = referencia.replace(/C\.\d{1,2}\/\d{1,2}/i, ' ').trim();
    }

    // Caso: USD inline en descripción (ej: "APPLE.COM/BILL USD 7,99420730")
    // El monto USD puede estar pegado al número de cupón, formato: X,XX seguido de 6 dígitos
    const usdInlineMatch = referencia.match(/USD\s+([\d.,]+)/i);
    if (usdInlineMatch) {
      let montoUsdStr = usdInlineMatch[1];
      // Si el monto tiene más de 2 decimales, probablemente tiene el cupón pegado
      // Formato esperado: "7,99420730" -> extraer "7,99"
      const montoConCuponMatch = montoUsdStr.match(/^([\d.]*\d,\d{2})\d{6,}$/);
      if (montoConCuponMatch) {
        montoUsdStr = montoConCuponMatch[1];
      }
      montoDolares = this.parsearMonto(montoUsdStr);
      referencia = referencia.replace(/USD\s+[\d.,]+/i, ' ').trim();
      montoPesos = 0;
    } else if (lineaMonto) {
      // Monto en línea separada
      montoPesos = this.parsearMonto(lineaMonto);
    }

    // Quitar número de cupón (6 dígitos al final)
    referencia = referencia.replace(/\d{6,}\s*$/, '').trim();

    // Limpiar referencia
    referencia = this.limpiarReferenciaBasica(referencia);

    // Detectar devolución (monto negativo o descripción con BONIF)
    const esDevolucion = montoPesos < 0 || /^BONIF/i.test(referencia);

    if (referencia.length === 0) return null;

    return {
      fecha_compra: this.parsearFechaGaliciaMes(fecha),
      referencia_original: referencia,
      cuota_texto: cuotaTexto,
      monto_pesos: montoPesos,
      monto_dolares: montoDolares,
      es_devolucion: esDevolucion
    };
  }

  limpiarReferenciaBasica(texto) {
    let limpio = texto.trim();
    limpio = limpio.replace(/\s+\d{6,}\s*$/g, '').trim();
    limpio = limpio.replace(/-\d{3}-\d{3}/g, '').trim();
    limpio = limpio.replace(/\s+/g, ' ').trim();
    return limpio;
  }

  parsearFechaVisaGalicia(texto) {
    const matchNumerico = texto.match(/(\d{2})-(\d{2})-(\d{2})/);
    if (matchNumerico) {
      const [_, dia, mes, anioCorto] = matchNumerico;
      const anio = '20' + anioCorto;
      return anio + '-' + mes + '-' + dia;
    }
    
    const matchLetras = texto.match(/(\d{2})-([A-Za-z]{3})-(\d{2})/);
    if (matchLetras) {
      const [_, dia, mesTexto, anioCorto] = matchLetras;
      const anio = '20' + anioCorto;
      
      const meses = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
        'jan': '01', 'apr': '04', 'aug': '08', 'dec': '12'
      };
      
      const mesNum = meses[mesTexto.toLowerCase()] || '01';
      return anio + '-' + mesNum + '-' + dia;
    }
    
    return null;
  }

  parsearFechaGaliciaMes(texto) {
    const match = texto.match(/(\d{2})-(\w{3})-(\d{2})/);
    if (!match) return null;

    const [_, dia, mesTexto, anioCorto] = match;
    const anio = '20' + anioCorto;

    const meses = {
      'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
      'jan': '01', 'apr': '04', 'aug': '08', 'dec': '12'
    };

    const mesNum = meses[mesTexto.toLowerCase()] || '01';
    return anio + '-' + mesNum + '-' + dia;
  }

  parsearFechaSantander(dia, mesTexto, anioCorto) {
    const anio = '20' + anioCorto;
    const diaStr = dia.padStart(2, '0');

    const meses = {
      'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
      'jan': '01', 'apr': '04', 'aug': '08', 'dec': '12'
    };

    const mesNum = meses[mesTexto.toLowerCase().substring(0, 3)] || '01';
    return `${anio}-${mesNum}-${diaStr}`;
  }

  parsearMonto(texto) {
    let limpio = texto.replace(/\$/g, '').trim();
    
    if (limpio.includes('.') && limpio.includes(',')) {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    }
    else if (limpio.includes(',')) {
      limpio = limpio.replace(',', '.');
    }
    
    return parseFloat(limpio) || 0;
  }

  limpiarReferencia(texto) {
    let limpio = texto.trim();
    limpio = limpio.replace(/\s*\([A-Z0-9]+\)\s*$/i, '');
    limpio = limpio.replace(/[*\/\\#]/g, ' ');
    limpio = limpio.replace(/\s+/g, ' ').trim();
    
    const reglas = this.cargarReglasLimpieza();
    for (const regla of reglas) {
      const regex = new RegExp(regla.patron, 'i');
      if (regex.test(limpio)) {
        limpio = regla.reemplazo;
        break;
      }
    }
    
    limpio = this.capitalizar(limpio);
    const esDudoso = this.esNombreDudoso(limpio);
    
    return {
      limpio,
      dudoso: esDudoso,
      sugerencias: esDudoso ? this.generarSugerencias(texto) : []
    };
  }

  esNombreDudoso(texto) {
    const noAlfabeticos = texto.replace(/[a-zA-Z\s]/g, '').length;
    const porcentaje = noAlfabeticos / texto.length;
    
    if (porcentaje > 0.3) return true;
    if (/[0-9]{6,}/.test(texto)) return true;
    
    return false;
  }

  generarSugerencias(texto) {
    const tokens = texto.match(/[a-zA-Z]{3,}/gi) || [];
    const sugerencias = tokens.map(token => 
      token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
    );
    return [...new Set(sugerencias)];
  }

  capitalizar(texto) {
    return texto
      .toLowerCase()
      .split(' ')
      .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
      .join(' ');
  }

  // Normalizar nombre para generar hash consistente
  normalizarParaHash(texto) {
    let normalizado = texto.toLowerCase();
    // Quitar caracteres especiales
    normalizado = normalizado.replace(/[^a-z0-9]/g, '');
    // Truncar a 15 caracteres para evitar diferencias por nombres cortados
    normalizado = normalizado.substring(0, 15);
    return normalizado;
  }

  detectarCuotas(movimientos) {
    const comprasMap = new Map();
    
    movimientos.forEach(mov => {
      if (!mov.cuota_texto) return;
      
      const match = mov.cuota_texto.match(/(\d+)\/(\d+)/);
      if (!match) return;
      
      const numCuota = parseInt(match[1]);
      const totalCuotas = parseInt(match[2]);
      
      // Usar nombre normalizado para hash consistente
      const nombreNormalizado = this.normalizarParaHash(mov.referencia_limpia);
      const montoTotalRedondeado = Math.round(mov.monto_pesos * totalCuotas);
      
      const hashLogico = this.generarHashCompra(
        nombreNormalizado,
        montoTotalRedondeado,
        totalCuotas
      );
      
      if (!comprasMap.has(hashLogico)) {
        comprasMap.set(hashLogico, {
          referencia_limpia: mov.referencia_limpia,
          total_cuotas: totalCuotas,
          monto_total: mov.monto_pesos * totalCuotas,
          monto_cuota: mov.monto_pesos,
          fecha_primera_compra: mov.fecha_compra,
          hash_logico: hashLogico,
          cuotas: []
        });
      }
      
      const compra = comprasMap.get(hashLogico);
      compra.cuotas.push({
        numero_cuota: numCuota,
        fecha_cobro: mov.fecha_compra,
        monto: mov.monto_pesos
      });
    });
    
    return Array.from(comprasMap.values());
  }

  generarHashCompra(nombreNormalizado, montoTotal, totalCuotas) {
    // Hash basado en: nombre normalizado + monto total REDONDEADO (tolerancia ±5%) + cantidad de cuotas
    // NO incluye fecha para que sea consistente entre meses
    // Redondear monto a miles para tolerar diferencias de extracción entre PDFs
    const montoRedondeado = Math.round(montoTotal / 1000) * 1000;
    const str = nombreNormalizado + '-' + montoRedondeado + '-' + totalCuotas;
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
  }

  cargarReglasLimpieza() {
    return [
      // === TRANSPORTE ===
      { patron: 'cabify|k\\s*cabify', reemplazo: 'Cabify' },
      { patron: 'didi|dlo.*didi', reemplazo: 'DiDi' },
      { patron: 'uber', reemplazo: 'Uber' },
      { patron: 'sube.*viajes|^sube', reemplazo: 'SUBE' },
      
      // === COMBUSTIBLE ===
      { patron: 'merpago.*ypf|mercpago.*ypf', reemplazo: 'YPF (Mercado Pago)' },
      { patron: '^ypf', reemplazo: 'YPF' },
      { patron: '^esso', reemplazo: 'Esso' },
      { patron: '^shell', reemplazo: 'Shell' },
      
      // === AUTOPISTAS ===
      { patron: 'autopista.*urban', reemplazo: 'Autopista Urban' },
      { patron: 'autopista.*del\\s*s', reemplazo: 'Autopista Del Sol' },
      
      // === DELIVERY / COMIDA ===
      { patron: '^rappi', reemplazo: 'Rappi' },
      { patron: '^pedidosya', reemplazo: 'PedidosYa' },
      { patron: 'mc\\s*donald|mcdonald', reemplazo: 'McDonalds' },
      { patron: 'starbucks', reemplazo: 'Starbucks' },
      { patron: 'coffee.*store', reemplazo: 'The Coffee Store' },
      
      // === SUSCRIPCIONES / SERVICIOS DIGITALES ===
      { patron: 'claude\\.?ai|anthropic', reemplazo: 'Claude AI (Anthropic)' },
      { patron: '^netflix|payu.*netflix', reemplazo: 'Netflix' },
      { patron: '^spotify', reemplazo: 'Spotify' },
      { patron: 'playstation.*network|psn', reemplazo: 'PlayStation Network' },
      { patron: 'apple\\.com|itunes', reemplazo: 'Apple' },
      { patron: 'google\\s*(play|storage|one)', reemplazo: 'Google' },
      { patron: 'amazon.*prime|prime.*video', reemplazo: 'Amazon Prime' },
      { patron: 'disney.*plus|disney\\+', reemplazo: 'Disney+' },
      { patron: 'hbo.*max', reemplazo: 'HBO Max' },
      
      // === SEGUROS ===
      { patron: 'zurich.*intern', reemplazo: 'Zurich Seguros' },
      { patron: 'experta.*seguros', reemplazo: 'Experta Seguros' },
      { patron: 'federacion\\s*pat', reemplazo: 'Federacion Patronal' },
      { patron: 'sancor', reemplazo: 'Sancor Seguros' },
      
      // === SALUD ===
      { patron: 'smg|swiss\\s*medical', reemplazo: 'Swiss Medical' },
      { patron: 'osde', reemplazo: 'OSDE' },
      { patron: 'galeno', reemplazo: 'Galeno' },
      
      // === TELECOMUNICACIONES ===
      { patron: 'movistar', reemplazo: 'Movistar' },
      { patron: 'personal.*flow', reemplazo: 'Personal Flow' },
      { patron: '^personal', reemplazo: 'Personal' },
      { patron: 'cablevision|fibertel', reemplazo: 'Cablevision' },
      { patron: 'cp.*pack.*claro|cp.*recarga.*claro|claro', reemplazo: 'Claro' },
      
      // === SERVICIOS ===
      { patron: 'metrogas', reemplazo: 'Metrogas' },
      { patron: 'aysa', reemplazo: 'AySA' },
      { patron: 'edenor', reemplazo: 'Edenor' },
      { patron: 'edesur', reemplazo: 'Edesur' },
      
      // === SUPERMERCADOS ===
      { patron: 'vital\\s*super|ital\\s*super', reemplazo: 'Vital Supermayorista' },
      { patron: 'coto', reemplazo: 'Coto' },
      { patron: 'merpago.*coto', reemplazo: 'Coto (Mercado Pago)' },
      { patron: 'carrefour', reemplazo: 'Carrefour' },
      { patron: 'dia\\s*tienda|^dia\\s', reemplazo: 'Dia' },
      { patron: 'diarco', reemplazo: 'Diarco' },
      { patron: 'pvs.*super.*florencia', reemplazo: 'Super Florencia' },
      
      // === TIENDAS / RETAIL ===
      { patron: 'fravega|www\\.fravega', reemplazo: 'Fravega' },
      { patron: 'garbarino', reemplazo: 'Garbarino' },
      { patron: 'musimundo', reemplazo: 'Musimundo' },
      { patron: 'sodimac', reemplazo: 'Sodimac' },
      { patron: 'easy\\s*home', reemplazo: 'Easy' },
      { patron: 'grimoldi', reemplazo: 'Grimoldi' },
      { patron: 'samsung', reemplazo: 'Samsung' },
      { patron: 'sonystyle|sony\\s*store', reemplazo: 'Sony Store' },
      { patron: 'brooksfield', reemplazo: 'Brooksfield' },
      
      // === MOTOS / AUTOS ===
      { patron: 'um\\s*argentina|urquiza\\s*motos', reemplazo: 'Urquiza Motos' },
      { patron: 'merpago.*gaonamotos', reemplazo: 'Gaona Motos (Mercado Pago)' },
      
      // === MERCADO PAGO (genéricos al final) ===
      { patron: 'merpago.*tiendabike', reemplazo: 'Tienda Bike (Mercado Pago)' },
      { patron: 'merpago.*brth', reemplazo: 'BRTH (Mercado Pago)' },
      { patron: 'merpago.*parfumerie', reemplazo: 'Parfumerie (Mercado Pago)' },
      { patron: 'merpago.*panaderia|panaderia.*ariel', reemplazo: 'Panaderia (Mercado Pago)' },
      { patron: 'merpago.*mercadolibre', reemplazo: 'Mercado Libre' },
      { patron: 'merpago.*getback', reemplazo: 'Getback (Mercado Pago)' },
      { patron: 'merpago.*balcarce', reemplazo: 'Balcarce (Mercado Pago)' },
      { patron: 'merpago.*greeneat', reemplazo: 'Green Eat (Mercado Pago)' },
      { patron: 'merpago.*estacionam', reemplazo: 'Estacionamiento (Mercado Pago)' },
      { patron: 'merpago.*temu', reemplazo: 'Temu (Mercado Pago)' },
      { patron: 'merpago.*|mercpago.*', reemplazo: 'Mercado Pago' },
      { patron: 'mercadolibre', reemplazo: 'Mercado Libre' },
      
      // === OTROS ===
      { patron: 'temu', reemplazo: 'Temu' },
      { patron: 'diggit', reemplazo: 'Diggit' },
      { patron: 'spaceball', reemplazo: 'Spaceball' },
      { patron: 'innocenti', reemplazo: 'Innocenti' },
      { patron: 'independient', reemplazo: 'Club Independiente' },
      { patron: 'cinepolis', reemplazo: 'Cinepolis' },
      { patron: 'hoyts', reemplazo: 'Hoyts' },
      { patron: 'carpuride', reemplazo: 'Carpuride' },
      { patron: 'shinui', reemplazo: 'Shinui' },
      { patron: 'tarsva', reemplazo: 'Tarsva' },
      { patron: 'kabul.*plateria', reemplazo: 'Kabul Plateria' },
      { patron: 'prestigio\\s*pagos', reemplazo: 'Prestigio Pagos' },
      { patron: 'epagos.*verif.*policial', reemplazo: 'Verificacion Policial' }
    ];
  }
}

module.exports = PDFParserService;
