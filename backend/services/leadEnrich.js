/**
 * leadEnrich.js
 * Usa Claude Haiku para extraer información del historial de mensajes
 * y enriquecer el lead/contacto con los datos encontrados.
 * Solo actualiza campos que están vacíos — nunca sobreescribe datos existentes.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Cola simple para no saturar la API (1 lead a la vez)
const queue = [];
let running = false;

async function processQueue() {
  if (running || queue.length === 0) return;
  running = true;
  while (queue.length > 0) {
    const leadId = queue.shift();
    try {
      await enrichLead(leadId);
    } catch (e) {
      console.error(`[ENRICH] Error lead ${leadId}:`, e.message);
    }
    // Pequeña pausa para no saturar Anthropic
    await new Promise(r => setTimeout(r, 500));
  }
  running = false;
}

/**
 * Encola un lead para enriquecimiento.
 * Se llama desde twilioSync cuando llega un mensaje nuevo.
 */
function enqueueEnrich(leadId) {
  if (!leadId || queue.includes(leadId)) return;
  queue.push(leadId);
  processQueue();
}

/**
 * Enriquece un lead leyendo sus mensajes con Claude Haiku.
 */
async function enrichLead(leadId) {
  // Obtener datos actuales del lead y contacto
  const leadRow = await pool.query(
    `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
     FROM leads l
     LEFT JOIN contacts c ON c.id = l.contact_id
     WHERE l.id = $1`,
    [leadId]
  );
  if (!leadRow.rows.length) return;
  const lead = leadRow.rows[0];

  // Obtener últimos 40 mensajes de la conversación
  const msgRows = await pool.query(
    `SELECT direction, text, created_at FROM messages
     WHERE lead_id = $1 ORDER BY created_at ASC LIMIT 40`,
    [leadId]
  );
  if (!msgRows.rows.length) return;

  const conversation = msgRows.rows
    .map(m => `[${m.direction === 'inbound' ? 'Cliente' : 'Agente'}]: ${m.text}`)
    .join('\n');

  // Solo enriquecer si falta algo útil
  const needsName  = !lead.contact_name || lead.contact_name === lead.contact_phone;
  const needsEmail = !lead.contact_email;
  const needsTrip  = !lead.check_in || !lead.cantidad_personas || !lead.hotel_airbnb || !lead.intereses;

  if (!needsName && !needsEmail && !needsTrip) return; // ya tiene todo

  const prompt = `Eres un asistente que extrae información de conversaciones SMS de una agencia de turismo en Puerto Rico (Fix a Trip).

En esta conversación, [Cliente] es el cliente (inbound) y [Agente] es el agente de Fix a Trip (outbound).

CONVERSACIÓN:
${conversation}

Extrae la información del CLIENTE. Si el agente saluda al cliente por su nombre (ej: "Hi Michelle", "Good morning Rebecca", "Hola Juan"), ese ES el nombre del cliente.

Responde ÚNICAMENTE con este JSON (sin texto extra, sin markdown):
{
  "nombre": null,
  "email": null,
  "check_in": null,
  "check_out": null,
  "hotel": null,
  "cantidad_personas": null,
  "tiene_ninos": null,
  "intereses": null,
  "notas": null
}

Reglas:
- nombre: nombre del cliente — búscalo tanto en lo que dice el cliente como en cómo el agente lo saluda (ej "Hi Michelle" → "Michelle")
- email: cualquier dirección de email en la conversación
- check_in / check_out: fechas de llegada/salida en formato YYYY-MM-DD
- hotel: nombre del hotel, Airbnb, o marina donde se hospedan
- cantidad_personas: número total de personas del grupo
- tiene_ninos: true si hay niños, false si explícitamente no hay, null si no se sabe
- intereses: tours, actividades o experiencias que buscan (string corto)
- notas: información especial (cumpleaños, boda, alergias, celebración, etc.)`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  let extracted;
  try {
    const text = res.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('[ENRICH] JSON parse error:', e.message);
    return;
  }
  if (!extracted) return;

  // ── Actualizar contacto (nombre y email) ──────────────────────────────────
  const contactUpdates = [];
  const contactValues = [];
  let ci = 1;

  if (needsName && extracted.nombre) {
    contactUpdates.push(`name = $${ci++}`);
    contactValues.push(extracted.nombre);
  }
  if (needsEmail && extracted.email) {
    contactUpdates.push(`email = $${ci++}`);
    contactValues.push(extracted.email);
  }

  if (contactUpdates.length > 0) {
    contactValues.push(lead.contact_id);
    await pool.query(
      `UPDATE contacts SET ${contactUpdates.join(', ')}, updated_at = NOW() WHERE id = $${ci}`,
      contactValues
    );
    console.log(`[ENRICH] Lead ${leadId} — contacto actualizado: ${contactUpdates.join(', ')}`);
  }

  // ── Actualizar lead (info del viaje) ─────────────────────────────────────
  const leadUpdates = [];
  const leadValues = [];
  let li = 1;

  if (!lead.check_in && extracted.check_in) {
    leadUpdates.push(`check_in = $${li++}`);
    leadValues.push(extracted.check_in);
  }
  if (!lead.check_out && extracted.check_out) {
    leadUpdates.push(`check_out = $${li++}`);
    leadValues.push(extracted.check_out);
  }
  if (!lead.hotel_airbnb && extracted.hotel) {
    leadUpdates.push(`hotel_airbnb = $${li++}`);
    leadValues.push(extracted.hotel);
  }
  if (!lead.cantidad_personas && extracted.cantidad_personas) {
    leadUpdates.push(`cantidad_personas = $${li++}`);
    leadValues.push(Number(extracted.cantidad_personas));
  }
  if (lead.ninos === null && extracted.tiene_ninos !== null) {
    leadUpdates.push(`ninos = $${li++}`);
    leadValues.push(extracted.tiene_ninos);
  }
  if (!lead.intereses && extracted.intereses) {
    leadUpdates.push(`intereses = $${li++}`);
    leadValues.push(extracted.intereses);
  }
  if (!lead.notas_especiales && extracted.notas) {
    leadUpdates.push(`notas_especiales = $${li++}`);
    leadValues.push(extracted.notas);
  }

  if (leadUpdates.length > 0) {
    leadValues.push(leadId);
    await pool.query(
      `UPDATE leads SET ${leadUpdates.join(', ')}, updated_at = NOW() WHERE id = $${li}`,
      leadValues
    );
    console.log(`[ENRICH] Lead ${leadId} — lead actualizado: ${leadUpdates.join(', ')}`);
  }
}

/**
 * Batch: enriquece todos los leads que tienen nombre = teléfono (sin nombre real).
 * Se puede llamar una vez al inicio para procesar el histórico.
 */
async function enrichAllMissingNames() {
  const rows = await pool.query(
    `SELECT l.id FROM leads l
     JOIN contacts c ON c.id = l.contact_id
     WHERE c.name = c.phone OR c.name IS NULL OR c.email IS NULL
     GROUP BY l.id
     ORDER BY MAX(l.updated_at) DESC`
  );
  console.log(`[ENRICH] Batch: ${rows.rows.length} leads sin nombre completo...`);
  for (const r of rows.rows) {
    enqueueEnrich(r.id);
  }
}

module.exports = { enqueueEnrich, enrichAllMissingNames };
