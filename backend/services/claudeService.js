const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

// ── Clasificador rápido (Haiku) ───────────────────────────────────────────────
// Devuelve { esImportante, razon }
// Un lead es "importante" si hay intención de compra clara, grupo grande,
// evento privado, solicitud de precio/disponibilidad, o conversación compleja.
async function clasificarLead(texto, historialPrevio = []) {
  const mensajesRecientes = historialPrevio.slice(-6).map(m => m.content).join('\n');

  const res = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 60,
    system: `Eres un clasificador de leads para una empresa de turismo en Puerto Rico.
Responde SOLO con JSON: {"importante": true/false, "razon": "string corta"}

Un lead es IMPORTANTE si el mensaje contiene alguno de estos:
- Intención clara de reservar o pagar
- Grupo de 5 o más personas
- Evento privado (cumpleaños, boda, despedida, corporativo)
- Pregunta específica sobre disponibilidad o fecha concreta
- Cliente que ya dio nombre + teléfono/email (listo para cerrar)
- Solicitud de cotización o presupuesto

Un lead NO es importante si:
- Solo pregunta qué tours existen de forma general
- Saluda o pregunta horarios vagamente
- Mensaje muy corto sin contexto de compra`,
    messages: [{ role: 'user', content: `Mensaje actual: "${texto}"\nContexto previo:\n${mensajesRecientes || 'Primer mensaje'}` }],
  });

  try {
    const json = JSON.parse(res.content[0].text.trim());
    return { esImportante: !!json.importante, razon: json.razon || '' };
  } catch {
    return { esImportante: false, razon: 'parse error' };
  }
}

// ── Respuesta principal ───────────────────────────────────────────────────────
async function generarRespuesta(texto, contexto = {}) {
  const cfgRow = await pool.query(`SELECT value FROM config WHERE key = 'prompt_sistema'`);
  const promptSistema = cfgRow.rows[0]?.value || 'Eres un asistente de ventas amable y profesional.';

  const nombreReal = contexto.tieneNombreReal ? contexto.nombre : null;

  const systemPrompt = `${promptSistema}

CONTEXTO DE ESTA CONVERSACIÓN:
- Nombre del cliente: ${nombreReal || 'Desconocido (aún no lo ha dado)'}
- Teléfono: ${contexto.telefono || 'No disponible'}
- Email: ${contexto.email || 'Aún no capturado'}
- Ya tenemos su nombre real: ${contexto.tieneNombreReal ? 'SÍ' : 'NO — pedirlo en este mensaje'}
- Ya tenemos su email: ${contexto.tieneEmail ? 'SÍ' : 'NO — pedirlo en este mensaje si ya tenemos el nombre'}
- Es el primer mensaje del bot: ${contexto.esPrimerMensaje ? 'SÍ — saluda, preséntate como Gigi de Fix A Trip Puerto Rico, y pide nombre y correo electrónico' : 'NO'}

INSTRUCCIÓN SOBRE IDIOMA: detecta el idioma en que escribe el cliente y responde SIEMPRE en ese mismo idioma. Si escribe en inglés, responde en inglés. Si escribe en español, responde en español. Mantén el idioma de forma consistente en toda la conversación.

INSTRUCCIÓN SOBRE NOMBRES: cuando el cliente mencione su nombre, captura SOLO el nombre de la persona con quien estás hablando (el contacto principal), no el de sus acompañantes, pareja o amigos. Si dice "me llamo Diana y mi pareja José", el nombre a capturar es solo "Diana". Si dice "my name is Sarah", captura "Sarah".

INSTRUCCIÓN SOBRE GRUPOS: si el cliente menciona 5 o más personas en su grupo, agrega el tag [GRUPO_GRANDE] al final — estos grupos reciben promociones especiales y es prioritario para el equipo de ventas.

INSTRUCCIÓN SOBRE GRUPOS PEQUEÑOS: ${(contexto.cantidadPersonas !== null && contexto.cantidadPersonas !== undefined && Number(contexto.cantidadPersonas) <= 4) ? `Este lead tiene un grupo PEQUEÑO de ${contexto.cantidadPersonas} persona(s). Adapta tu tono: sé más directo y eficiente, ofrece opciones de tours compartidos o en grupo en lugar de experiencias totalmente privadas, y menciona que las tarifas pueden ser diferentes para grupos pequeños. Agrega el tag [GRUPO_PEQUEÑO] al final de tu respuesta.` : 'Si el cliente menciona explícitamente que su grupo es de 4 personas o menos, agrega el tag [GRUPO_PEQUEÑO] al final.'}`;

  // Historial reciente
  let historial = [];
  if (contexto.leadId) {
    const rows = await pool.query(
      `SELECT direction, text FROM messages WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [contexto.leadId]
    );
    historial = rows.rows.reverse().map(r => ({
      role: r.direction === 'inbound' ? 'user' : 'assistant',
      content: r.text,
    }));
  }

  historial.push({ role: 'user', content: texto });

  // ── Decidir modelo ────────────────────────────────────────────────────────
  const { esImportante, razon } = await clasificarLead(texto, historial);
  const modelo = esImportante ? MODEL_SONNET : MODEL_HAIKU;

  if (esImportante) {
    console.log(`[BOT] Lead importante (${razon}) → usando Sonnet`);
  }

  const response = await client.messages.create({
    model: modelo,
    max_tokens: esImportante ? 220 : 140,
    system: systemPrompt + '\n\nREGLAS ABSOLUTAS DE FORMATO:\n- NUNCA uses markdown: sin **, sin *, sin _, sin #, sin listas con guiones\n- Escribe texto plano como si fuera un SMS real de una persona\n- Máximo 2 oraciones. Elige solo lo más importante\n- NUNCA incluyas tags como [TELEFONO:...] o [NOMBRE:...] en tu respuesta — son solo internos\n- Un mensaje, directo al punto',
    messages: historial,
  });

  // Guardar el modelo usado en la respuesta para trazabilidad (opcional)
  const respuestaTexto = response.content[0].text;
  return respuestaTexto;
}

function extraerIntento(texto) {
  const tieneIntento = texto.includes('[INTENCION_COMPRA]');
  return {
    texto: texto.replace('[INTENCION_COMPRA]', '').trim(),
    tieneIntento,
  };
}

function extraerGrupoGrande(texto) {
  const tieneGrupo = texto.includes('[GRUPO_GRANDE]');
  return {
    texto: texto.replace('[GRUPO_GRANDE]', '').trim(),
    tieneGrupo,
  };
}

function extraerGrupoPequeno(texto) {
  const tieneGrupoPequeno = texto.includes('[GRUPO_PEQUEÑO]');
  return {
    texto: texto.replace('[GRUPO_PEQUEÑO]', '').trim(),
    tieneGrupoPequeno,
  };
}

module.exports = { generarRespuesta, extraerIntento, extraerGrupoGrande, extraerGrupoPequeno };
