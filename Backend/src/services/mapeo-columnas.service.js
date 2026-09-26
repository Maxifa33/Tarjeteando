/**
 * Mapeo de columnas de "Últimos consumos" con Claude, para bancos cuyo formato
 * la app todavía no conoce. Recibe SOLO encabezados + hasta 8 filas de muestra
 * (nunca el archivo entero) y devuelve qué columna es cada dato. El frontend
 * guarda la respuesta como plantilla: la próxima vez no se llama a la IA.
 */
const Anthropic = require('@anthropic-ai/sdk');

const CAMPOS = ['fecha', 'descripcion', 'cuotas', 'comprobante', 'monto_ars', 'monto_usd', 'ult4'];

class MapeoColumnasService {
  constructor(apiKey, model = process.env.MAPEO_MODEL || 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async mapear({ encabezados, filas_muestra = [], texto_cabecera = '' }) {
    const tabla = [encabezados, ...filas_muestra.slice(0, 8)]
      .map((fila, i) => `${i === 0 ? 'ENCABEZADOS' : `fila ${i}`}: ${fila.map((c, j) => `[${j}] ${c ?? ''}`).join(' | ')}`)
      .join('\n');

    const prompt = `Sos un lector de exportaciones de "Últimos consumos" de tarjetas de crédito de bancos argentinos.
Texto que aparece arriba de la tabla:
"""${String(texto_cabecera).slice(0, 1500)}"""

Tabla (índice de columna entre corchetes):
${tabla}

Devolvé SOLO un JSON, sin texto adicional, con esta forma:
{"mapeo":{"fecha":n,"descripcion":n,"cuotas":n|null,"comprobante":n|null,"monto_ars":n,"monto_usd":n|null,"ult4":n|null},
 "formato_numero":"es"|"en","cuotas_en_descripcion":true|false,"banco_detectado":string|null,"red_detectada":"Visa"|"Mastercard"|"Amex"|"Cabal"|null,"confianza":0..1}
Reglas: n es el índice de columna. monto_ars = importe en pesos; monto_usd = importe en dólares.
ult4 = columna con los últimos 4 dígitos de la tarjeta, si existe. banco y red solo si el texto los nombra; si no, null.
Si no estás seguro de una columna obligatoria (fecha, descripcion, monto_ars), bajá la confianza.`;

    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const texto = resp.content.map((b) => b.text || '').join('');
    const json = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1));
    return this.validar(json, encabezados.length);
  }

  validar(json, nCols) {
    const mapeo = {};
    for (const k of CAMPOS) {
      const v = json?.mapeo?.[k];
      mapeo[k] = Number.isInteger(v) && v >= 0 && v < nCols ? v : null;
    }
    const obligatoriosOk = mapeo.fecha != null && mapeo.descripcion != null && mapeo.monto_ars != null;
    const confianza = Math.max(0, Math.min(1, Number(json?.confianza) || 0));
    return {
      mapeo,
      formato_numero: json?.formato_numero === 'en' ? 'en' : 'es',
      cuotas_en_descripcion: !!json?.cuotas_en_descripcion,
      banco_detectado: typeof json?.banco_detectado === 'string' ? json.banco_detectado : null,
      red_detectada: typeof json?.red_detectada === 'string' ? json.red_detectada : null,
      confianza: obligatoriosOk ? confianza : 0,
    };
  }
}

module.exports = MapeoColumnasService;
