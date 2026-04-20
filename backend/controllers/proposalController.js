'use strict';
const { pool } = require('../services/db');

// ── Groq helper ───────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no configurado');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Extract valid JSON from AI response (handles markdown fences) ─────────────
function extractJSON(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Find first { and last } and try to extract
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── generarPropuesta — POST /api/proposals/generate ──────────────────────────
async function generarPropuesta(req, res) {
  try {
    const {
      destination,
      start_date,
      end_date,
      num_passengers = 2,
      budget,
      trip_type = 'tour',
      special_requests = '',
      lead_id,
      contact_id,
    } = req.body;

    if (!destination?.trim()) {
      return res.status(400).json({ ok: false, error: 'El destino es requerido' });
    }

    // ── Build trip context ──────────────────────────────────────────────────
    const tripTypeLabels = {
      playa: 'playa y relax',
      cultura: 'cultural y patrimonio',
      aventura: 'aventura y naturaleza',
      gastronomia: 'gastronómica y culinaria',
      romantico: 'romántico y luna de miel',
      familiar: 'familiar con niños',
      tour: 'tour completo',
    };
    const tripLabel = tripTypeLabels[trip_type] || trip_type;

    let dateContext = '';
    if (start_date && end_date) {
      const start = new Date(start_date + 'T12:00:00');
      const end   = new Date(end_date   + 'T12:00:00');
      const days  = Math.ceil((end - start) / 86400000) + 1;
      dateContext = `Fechas: del ${start_date} al ${end_date} (${days} días / ${days - 1} noches).`;
    }

    const budgetContext = budget
      ? `Presupuesto total aproximado: $${Number(budget).toLocaleString('en-US')} USD para ${num_passengers} pasajero(s).`
      : `Número de pasajeros: ${num_passengers}.`;

    const specialContext = special_requests?.trim()
      ? `Solicitudes especiales: ${special_requests}.`
      : '';

    // ── System prompt ────────────────────────────────────────────────────────
    const systemPrompt = `Eres un experto planificador de viajes de Fix A Trip, agencia de viajes en Puerto Rico.
Genera un itinerario de viaje completo y detallado en español.
Responde SOLO con un JSON válido con esta estructura exacta (sin texto adicional, sin explicaciones, sin markdown fuera del JSON):
{
  "title": "título atractivo del viaje",
  "summary": "resumen de 2-3 oraciones del viaje destacando lo mejor",
  "highlights": ["highlight1", "highlight2", "highlight3", "highlight4"],
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "title": "título descriptivo del día",
      "items": [
        {
          "type": "vuelo|hotel|actividad|traslado|restaurante",
          "time": "HH:MM",
          "title": "título del item",
          "description": "descripción detallada de 1-2 oraciones",
          "location": "lugar específico",
          "price_estimate": 100
        }
      ]
    }
  ],
  "included": ["item1", "item2", "item3"],
  "not_included": ["item1", "item2"],
  "total_estimate": 2800,
  "recommendations": ["tip1", "tip2", "tip3"]
}
Reglas importantes:
- Incluye AL MENOS 3 items por día (desayuno/hotel, actividad principal, cena mínimo)
- Los price_estimate deben ser realistas en USD para el destino
- total_estimate debe ser la suma aproximada de todos los price_estimate para TODOS los pasajeros
- Incluye vuelos de ida y vuelta si aplica
- Las fechas en "days" deben coincidir exactamente con el rango de viaje
- Incluye traslados aeropuerto cuando sea relevante`;

    // ── User prompt ──────────────────────────────────────────────────────────
    const userPrompt = `Destino: ${destination.trim()}.
${dateContext}
${budgetContext}
Tipo de viaje: ${tripLabel}.
${specialContext}
Genera el itinerario completo para este viaje. Responde SOLO con el JSON, sin texto adicional.`;

    // ── Call Groq ────────────────────────────────────────────────────────────
    let rawContent;
    try {
      rawContent = await callGroq(systemPrompt, userPrompt);
    } catch (groqErr) {
      console.error('[proposals] Groq call failed:', groqErr.message);
      return res.status(502).json({ ok: false, error: 'Error al contactar la IA. Intenta de nuevo.' });
    }

    const proposal = extractJSON(rawContent);

    if (!proposal || !proposal.title || !Array.isArray(proposal.days)) {
      console.error('[proposals] JSON parse failed. Raw:', rawContent.slice(0, 500));
      return res.status(422).json({ ok: false, error: 'No se pudo generar la propuesta. Por favor intenta de nuevo.' });
    }

    // ── Save itinerary to DB ─────────────────────────────────────────────────
    const { rows: iRows } = await pool.query(`
      INSERT INTO itineraries
        (title, destination, start_date, end_date, num_passengers, status, notes, lead_id, contact_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      proposal.title,
      destination.trim(),
      start_date  || null,
      end_date    || null,
      num_passengers,
      'draft',
      proposal.summary || null,
      lead_id    ? parseInt(lead_id,    10) : null,
      contact_id ? parseInt(contact_id, 10) : null,
      req.user?.id || null,
    ]);

    const itinerary_id = iRows[0].id;

    // ── Save each day ────────────────────────────────────────────────────────
    for (const d of proposal.days) {
      await pool.query(`
        INSERT INTO itinerary_days (itinerary_id, day_number, day_date, title, items, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        itinerary_id,
        d.day || 1,
        d.date || null,
        d.title || `Día ${d.day}`,
        JSON.stringify(d.items || []),
        null,
      ]);
    }

    return res.json({ ok: true, itinerary_id, proposal });
  } catch (err) {
    console.error('[proposals] generarPropuesta:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

// ── listar — GET /api/proposals ──────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        i.id,
        i.title,
        i.destination,
        i.start_date,
        i.end_date,
        i.num_passengers,
        i.status,
        i.notes,
        i.created_at,
        c.name  AS contact_name,
        l.title AS lead_title,
        u.name  AS agent_name
      FROM itineraries i
      LEFT JOIN contacts c ON i.contact_id = c.id
      LEFT JOIN leads    l ON i.lead_id    = l.id
      LEFT JOIN users    u ON i.created_by = u.id
      WHERE i.status IN ('draft', 'sent')
      ORDER BY i.created_at DESC
    `);

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[proposals] listar:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

module.exports = { generarPropuesta, listar };
