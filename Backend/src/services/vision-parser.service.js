/**
 * Vision Parser Service
 * Usa Claude Vision API para extraer datos de:
 * - PDFs renderizados como imagen (ej: Macro)
 * - Screenshots de resúmenes
 * - Fotos de resúmenes físicos
 */

const Anthropic = require('@anthropic-ai/sdk');
const pdf = require('pdf-parse');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class VisionParserService {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
    this.model = 'claude-sonnet-4-20250514';
  }

  /**
   * Detecta si un PDF tiene texto extraíble o es imagen
   */
  async detectarTipoPDF(buffer) {
    try {
      const data = await pdf(buffer);
      const textoLimpio = data.text.replace(/\s+/g, '').trim();
      
      // Si tiene menos de 100 caracteres, probablemente es imagen
      if (textoLimpio.length < 100) {
        return { tipo: 'imagen', caracteres: textoLimpio.length };
      }
      
      // Verificar si tiene palabras clave de resumen
      const tieneContenido = /resumen|consumos|total|visa|mastercard|pagar/i.test(data.text);
      
      return { 
        tipo: tieneContenido ? 'texto' : 'imagen',
        caracteres: textoLimpio.length 
      };
    } catch (error) {
      console.error('[Vision] Error detectando tipo PDF:', error.message);
      return { tipo: 'imagen', caracteres: 0 };
    }
  }

  /**
   * Convierte PDF a imágenes PNG usando pdf-to-img (JavaScript puro)
   * No requiere dependencias de sistema como GraphicsMagick
   */
  async pdfToImages(buffer) {
    try {
      // Usar pdf-to-img (JavaScript puro, no requiere dependencias de sistema)
      const pdfToImg = await import('pdf-to-img');

      console.log('[Vision] Usando pdf-to-img para conversión...');

      const doc = await pdfToImg.pdf(buffer, { scale: 2.0 });
      console.log(`[Vision] PDF tiene ${doc.length} páginas`);

      const images = [];
      let pageNum = 0;

      for await (const image of doc) {
        pageNum++;
        if (pageNum > 3) break; // Max 3 páginas

        if (image && image.length > 0) {
          images.push(image);
          console.log(`[Vision] Página ${pageNum}: ${image.length} bytes`);
        }
      }

      if (images.length === 0) {
        throw new Error('No se pudieron renderizar páginas del PDF');
      }

      return images;

    } catch (error) {
      console.error('[Vision] Error con pdf-to-img:', error.message);
      throw new Error('No se pudo convertir PDF a imagen. Error: ' + error.message);
    }
  }

  /**
   * Procesa una imagen con Claude Vision
   */
  async procesarImagen(imageBuffer, mediaType = 'image/png') {
    const base64 = imageBuffer.toString('base64');
    
    const prompt = `Analiza esta imagen de un resumen de tarjeta de crédito argentina y extrae los datos en formato JSON.

INSTRUCCIONES CRÍTICAS:
1. NÚMEROS: Sé EXTREMADAMENTE preciso. Formato argentino: punto para miles, coma para decimales (ej: 1.234.567,89)
   - Ejemplo: "440.531,89" = 440531.89 (cuatrocientos cuarenta mil)
   - NO confundas con números de cuenta o códigos
2. BANCO: Busca en el texto del documento menciones a "MACRO", "GALICIA", "BBVA", "SANTANDER", etc.
3. FECHAS (CRÍTICO - LEE CON CUIDADO):
   - BANCO MACRO tiene un cuadro con varias fechas:
     * "Cierre Ant." o "Cierre Anterior" = cierre del período anterior (IGNORAR)
     * "Vto. Ant." = vencimiento anterior (IGNORAR)
     * "CIERRE" (sin "Ant" ni "Prox") = CIERRE ACTUAL del resumen ← USA ESTA
     * "VENCIMIENTO" (sin "Ant" ni "Prox") = VENCIMIENTO ACTUAL ← USA ESTA
     * "Prox. Cierre" = próximo cierre (IGNORAR)
     * "Prox. Vto" = próximo vencimiento (IGNORAR)
   - Ejemplo: si dice "CIERRE 13 Nov 25" y "VENCIMIENTO 01 Dic 25":
     * fecha_cierre = 2025-11-13
     * fecha_vencimiento = 2025-12-01
   - En otros bancos busca "Fecha Cierre" y "Fecha Vencimiento"
   - Convierte SIEMPRE a formato YYYY-MM-DD
4. MÚLTIPLES TARJETAS: Un resumen puede tener consumos de varias tarjetas (ej: "Tarjeta 4246" y "Tarjeta 2734").
   - Extrae TODOS los movimientos de TODAS las tarjetas
   - NO incluyas las líneas de "Total Consumos de [nombre]" como movimientos
5. MOVIMIENTOS: Solo extrae las compras/consumos individuales, NO los subtotales ni totales
6. TOTAL A PAGAR (CRÍTICO para Banco Macro):
   - Busca el cuadro "OPCIONES DE PAGO" con columnas: Pago Mínimo | Pago Total | 1er Vto | 2do Vto
   - El valor bajo "Pago Total" o "1er Vto" es el total_a_pagar_pesos
   - EJEMPLO: Si ves "440.531,89" en esa fila, total_a_pagar_pesos = 440531.89
   - NUNCA uses estos como total: códigos de barra, números de referencia, números de cuenta
   - Los códigos de barra tienen 20+ dígitos seguidos (ej: 64008001234567890) - IGNORAR
   - El total REAL está entre $100.000 y $2.000.000 típicamente
   - Si calculas un total > 5.000.000, REVISA - probablemente estás usando un código

Responde SOLO con un JSON válido:
{
  "banco": "MACRO o GALICIA o BBVA o SANTANDER o nombre detectado",
  "tarjeta": "VISA o MASTERCARD",
  "periodo": {
    "mes": número 1-12 (del mes del resumen),
    "anio": número 4 dígitos,
    "fecha_cierre": "YYYY-MM-DD",
    "fecha_vencimiento": "YYYY-MM-DD"
  },
  "totales": {
    "total_consumos_pesos": número (suma de todos los consumos en pesos),
    "total_consumos_dolares": número,
    "total_a_pagar_pesos": número (el monto final a pagar),
    "total_a_pagar_dolares": número
  },
  "impuestos": {
    "iva": número,
    "sellos": número,
    "iibb": número,
    "percepciones": número,
    "impuesto_pais": número,
    "otros": número
  },
  "sub_tarjetas": ["4246", "2734"],
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "texto original de la compra",
      "monto_pesos": número o null,
      "monto_dolares": número o null,
      "cuota_actual": número o null,
      "total_cuotas": número o null,
      "sub_tarjeta": "4246 o 2734 si aplica"
    }
  ]
}

IMPORTANTE:
- NO incluyas como movimiento las líneas que dicen "Total Consumos de..." - esas son subtotales
- NO incluyas como movimiento: IVA, Impuesto de sellos, Intereses, Percepciones, IIBB - esos van en "impuestos"
- Solo incluye compras/consumos reales (comercios, servicios, etc.)

Si no puedes leer algún dato, usa null. NO inventes datos.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      const textoRespuesta = response.content[0].text;
      
      // Extraer JSON de la respuesta
      const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON en la respuesta');
      }
      
      return JSON.parse(jsonMatch[0]);
      
    } catch (error) {
      console.error('[Vision] Error procesando imagen:', error.message);
      throw error;
    }
  }

  /**
   * Procesa múltiples imágenes y combina resultados
   */
  async procesarMultiplesImagenes(imageBuffers, mediaType = 'image/png') {
    const resultados = [];
    
    for (let i = 0; i < imageBuffers.length; i++) {
      console.log(`[Vision] Procesando imagen ${i + 1}/${imageBuffers.length}...`);
      
      try {
        const resultado = await this.procesarImagen(imageBuffers[i], mediaType);
        resultados.push(resultado);
      } catch (error) {
        console.error(`[Vision] Error en imagen ${i + 1}:`, error.message);
      }
    }
    
    // Combinar resultados
    return this.combinarResultados(resultados);
  }

  /**
   * Combina resultados de múltiples páginas
   */
  combinarResultados(resultados) {
    if (resultados.length === 0) {
      return null;
    }
    
    if (resultados.length === 1) {
      return resultados[0];
    }
    
    // Tomar metadatos de la primera página
    const combinado = { ...resultados[0] };
    
    // Combinar movimientos de todas las páginas
    const todosMovimientos = [];
    const movimientosVistos = new Set();
    
    for (const resultado of resultados) {
      if (resultado.movimientos) {
        for (const mov of resultado.movimientos) {
          // Evitar duplicados
          const key = `${mov.fecha}-${mov.descripcion}-${mov.monto_pesos || mov.monto_dolares}`;
          if (!movimientosVistos.has(key)) {
            movimientosVistos.add(key);
            todosMovimientos.push(mov);
          }
        }
      }
      
      // Actualizar totales si la página tiene valores más completos
      if (resultado.totales?.total_a_pagar_pesos > (combinado.totales?.total_a_pagar_pesos || 0)) {
        combinado.totales = resultado.totales;
      }
    }
    
    combinado.movimientos = todosMovimientos;
    return combinado;
  }

  /**
   * Valida matemáticamente los datos extraídos
   */
  validarDatos(datos) {
    const errores = [];
    const advertencias = [];
    
    if (!datos.movimientos || datos.movimientos.length === 0) {
      errores.push('No se encontraron movimientos');
      return { valido: false, errores, advertencias };
    }
    
    // Sumar movimientos
    let sumaPesos = 0;
    let sumaDolares = 0;
    
    for (const mov of datos.movimientos) {
      if (mov.monto_pesos && mov.monto_pesos > 0) {
        sumaPesos += mov.monto_pesos;
      }
      if (mov.monto_dolares && mov.monto_dolares > 0) {
        sumaDolares += mov.monto_dolares;
      }
    }
    
    // Comparar con totales declarados
    const totalConsumosPesos = datos.totales?.total_consumos_pesos || 0;
    const totalConsumosDolares = datos.totales?.total_consumos_dolares || 0;
    
    const diferenciaPesos = Math.abs(sumaPesos - totalConsumosPesos);
    const diferenciaDolares = Math.abs(sumaDolares - totalConsumosDolares);
    
    // Tolerancia de 1% o $100
    const toleranciaPesos = Math.max(totalConsumosPesos * 0.01, 100);
    const toleranciaDolares = Math.max(totalConsumosDolares * 0.01, 1);
    
    if (diferenciaPesos > toleranciaPesos && totalConsumosPesos > 0) {
      advertencias.push(`Diferencia en pesos: suma=${sumaPesos.toFixed(2)}, total=${totalConsumosPesos.toFixed(2)}, dif=${diferenciaPesos.toFixed(2)}`);
    }
    
    if (diferenciaDolares > toleranciaDolares && totalConsumosDolares > 0) {
      advertencias.push(`Diferencia en dólares: suma=${sumaDolares.toFixed(2)}, total=${totalConsumosDolares.toFixed(2)}, dif=${diferenciaDolares.toFixed(2)}`);
    }
    
    return {
      valido: errores.length === 0,
      errores,
      advertencias,
      calculos: {
        suma_pesos: sumaPesos,
        suma_dolares: sumaDolares,
        diferencia_pesos: diferenciaPesos,
        diferencia_dolares: diferenciaDolares
      }
    };
  }

  /**
   * Genera hash único para identificar una compra en cuotas
   * Usa tolerancia de miles para evitar duplicados por diferencias de extracción
   */
  generarHashCompra(referencia, totalCuotas, monto) {
    const crypto = require('crypto');
    const montoTotal = monto * totalCuotas;
    const montoRedondeado = Math.round(montoTotal / 1000) * 1000;
    const refNormalizada = referencia.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
    const str = `${refNormalizada}-${montoRedondeado}-${totalCuotas}`;
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
  }

  /**
   * Convierte los datos extraídos al formato del sistema
   */
  convertirAFormatoSistema(datos, nombreArchivo) {
    const bancoRaw = datos.banco?.toUpperCase() || 'DESCONOCIDO';
    const tarjeta = datos.tarjeta?.toUpperCase() || 'VISA';

    // Normalizar nombre del banco
    let banco = 'Desconocido';
    if (bancoRaw.includes('GALICIA')) banco = 'Galicia';
    else if (bancoRaw.includes('BBVA')) banco = 'BBVA';
    else if (bancoRaw.includes('SANTANDER')) banco = 'Santander';
    else if (bancoRaw.includes('MACRO')) banco = 'Macro';

    // Determinar nombre de tarjeta
    const nombreTarjeta = `${tarjeta} ${banco}`;

    // Convertir movimientos
    const movimientos = (datos.movimientos || []).map((mov, idx) => {
      const esCuota = mov.total_cuotas && mov.total_cuotas > 1;
      return {
        fecha_compra: mov.fecha,
        referencia_original: mov.descripcion,
        referencia_limpia: mov.descripcion,
        monto_pesos: mov.monto_pesos || 0,
        monto_dolares: mov.monto_dolares || 0,
        cuota_actual: mov.cuota_actual,
        total_cuotas: mov.total_cuotas,
        cuota_texto: esCuota ? `${mov.cuota_actual || 1}/${mov.total_cuotas}` : null,
        es_cuota: esCuota
      };
    });

    // Agrupar compras en cuotas por referencia y total_cuotas (formato compatible con PDF parser)
    const comprasMap = new Map();
    movimientos.filter(m => m.es_cuota).forEach(mov => {
      const hashLogico = this.generarHashCompra(mov.referencia_limpia, mov.total_cuotas, mov.monto_pesos);

      if (!comprasMap.has(hashLogico)) {
        comprasMap.set(hashLogico, {
          hash_logico: hashLogico,
          referencia_limpia: mov.referencia_limpia,
          total_cuotas: mov.total_cuotas,
          monto_cuota: mov.monto_pesos,
          monto_total: mov.monto_pesos * mov.total_cuotas,
          fecha_primera_compra: mov.fecha_compra,
          cuotas: []
        });
      }

      const compra = comprasMap.get(hashLogico);
      compra.cuotas.push({
        numero_cuota: mov.cuota_actual || 1,
        fecha_cobro: mov.fecha_compra,
        monto: mov.monto_pesos
      });
    });

    // Validar y corregir total_a_pagar si es absurdo (> 5M probablemente es código de barras)
    let totalAPagar = datos.totales?.total_a_pagar_pesos || 0;
    const sumaMovimientos = movimientos.reduce((s, m) => s + (m.monto_pesos || 0), 0);

    if (totalAPagar > 5000000) {
      console.log(`[Vision] ⚠️ Total ${totalAPagar} parece código de barras, usando suma de movimientos + impuestos`);
      const totalImpuestos = Object.values(datos.impuestos || {}).reduce((s, v) => s + (v || 0), 0);
      totalAPagar = sumaMovimientos + totalImpuestos;
    }

    return {
      exito: true,
      tarjeta: nombreTarjeta,
      banco: banco,
      tipo: tarjeta,
      metodo: 'vision',
      resumen: {
        mes: datos.periodo?.mes,
        anio: datos.periodo?.anio,
        fecha_cierre: datos.periodo?.fecha_cierre,
        fecha_vencimiento: datos.periodo?.fecha_vencimiento,
        total_consumos_pesos: sumaMovimientos,
        total_consumos_dolares: datos.totales?.total_consumos_dolares || 0,
        total_a_pagar_pesos: totalAPagar,
        total_a_pagar_dolares: datos.totales?.total_a_pagar_dolares || 0,
        impuestos: datos.impuestos || {}
      },
      movimientos,
      compras: Array.from(comprasMap.values()),
      sub_tarjetas: datos.sub_tarjetas || []
    };
  }

  /**
   * Método principal: procesa archivo (PDF o imagen)
   */
  async procesarArchivo(buffer, nombreArchivo, mimeType) {
    console.log(`[Vision] Procesando: ${nombreArchivo} (${mimeType})`);
    
    try {
      let imageBuffers = [];
      let mediaType = 'image/png';
      
      if (mimeType === 'application/pdf') {
        // Verificar si el PDF tiene texto
        const tipoPDF = await this.detectarTipoPDF(buffer);
        console.log(`[Vision] Tipo PDF detectado: ${tipoPDF.tipo} (${tipoPDF.caracteres} chars)`);
        
        if (tipoPDF.tipo === 'texto') {
          return { 
            usarParserTradicional: true, 
            razon: 'PDF tiene texto extraíble' 
          };
        }
        
        // Convertir PDF a imágenes
        console.log('[Vision] Convirtiendo PDF a imágenes...');
        imageBuffers = await this.pdfToImages(buffer);
        
      } else if (mimeType.startsWith('image/')) {
        // Ya es una imagen
        imageBuffers = [buffer];
        mediaType = mimeType;
        
      } else {
        throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
      }
      
      if (imageBuffers.length === 0) {
        throw new Error('No se pudieron obtener imágenes del archivo');
      }
      
      console.log(`[Vision] Procesando ${imageBuffers.length} imagen(es) con Claude...`);
      
      // Procesar con Claude Vision
      const datosExtraidos = await this.procesarMultiplesImagenes(imageBuffers, mediaType);
      
      if (!datosExtraidos) {
        throw new Error('No se pudieron extraer datos de las imágenes');
      }
      
      // Validar
      const validacion = this.validarDatos(datosExtraidos);
      console.log('[Vision] Validación:', validacion);
      
      if (validacion.advertencias.length > 0) {
        validacion.advertencias.forEach(adv => console.log('[Vision] ⚠️', adv));
      }
      
      // Convertir al formato del sistema
      const resultado = this.convertirAFormatoSistema(datosExtraidos, nombreArchivo);
      resultado.validacion = validacion;
      
      console.log(`[Vision] ✓ Extraídos ${resultado.movimientos.length} movimientos`);
      
      return resultado;
      
    } catch (error) {
      console.error('[Vision] Error:', error.message);
      return {
        exito: false,
        error: error.message,
        metodo: 'vision'
      };
    }
  }
}

module.exports = VisionParserService;
