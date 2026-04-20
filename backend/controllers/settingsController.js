const { pool } = require('../services/db');
const { generarRespuesta, extraerIntento } = require('../services/claudeService');

async function obtener(req, res) {
  try {
    const result = await pool.query('SELECT key, value FROM config');
    const config = {};
    result.rows.forEach(r => { config[r.key] = r.value; });
    res.json(config);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function actualizar(req, res) {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key requerido' });
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value ?? '']
    );
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function stats(req, res) {
  try {
    const [leads, contactos, mensajes, sinRespuesta, alertas, tareasPendientes] = await Promise.all([
      pool.query(`
        SELECT (
          COUNT(*) FILTER (WHERE contact_id IS NULL) +
          COUNT(DISTINCT contact_id) FILTER (WHERE contact_id IS NOT NULL)
        ) AS count FROM leads
      `),
      pool.query('SELECT COUNT(*) FROM contacts'),
      pool.query('SELECT COUNT(*) FROM messages'),
      pool.query(`
        SELECT COUNT(DISTINCT m.lead_id) FROM messages m
        WHERE m.direction = 'inbound'
          AND NOT EXISTS (
            SELECT 1 FROM messages m2
            WHERE m2.lead_id = m.lead_id AND m2.direction = 'outbound'
              AND m2.created_at > m.created_at
          )
      `),
      pool.query(`SELECT COUNT(*) FROM alerts WHERE seen = false`),
      pool.query(`SELECT COUNT(*) FROM tasks WHERE completed = false`),
    ]);
    res.json({
      leads:             Number(leads.rows[0].count),
      contactos:         Number(contactos.rows[0].count),
      mensajes:          Number(mensajes.rows[0].count),
      sin_respuesta:     Number(sinRespuesta.rows[0].count),
      alertas_sin_ver:   Number(alertas.rows[0].count),
      tareas_pendientes: Number(tareasPendientes.rows[0].count),
    });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function statsChart(req, res) {
  try {
    const dias = Math.min(Number(req.query.days) || 30, 90);

    const [mensajesDia, leadsPorEtapa, leadsPorDia, tasaRespuesta] = await Promise.all([
      // Mensajes por día (últimos N días)
      pool.query(`
        SELECT DATE(created_at) AS fecha,
          COUNT(*) FILTER (WHERE direction = 'inbound')  AS entrantes,
          COUNT(*) FILTER (WHERE direction = 'outbound') AS salientes
        FROM messages
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY DATE(created_at)
        ORDER BY fecha ASC
      `, [dias]),
      // Leads por etapa
      pool.query(`
        SELECT ps.name AS etapa, ps.color, COUNT(l.id) AS total
        FROM pipeline_stages ps
        LEFT JOIN leads l ON l.stage_id = ps.id
        GROUP BY ps.id, ps.name, ps.color
        ORDER BY ps.position
      `),
      // Leads creados por día
      pool.query(`
        SELECT DATE(created_at) AS fecha, COUNT(*) AS total
        FROM leads
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY DATE(created_at)
        ORDER BY fecha ASC
      `, [dias]),
      // Tasa de respuesta del bot
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE direction = 'inbound')  AS total_entrantes,
          COUNT(*) FILTER (WHERE direction = 'outbound' AND is_bot = true) AS respondidos_bot
        FROM messages
        WHERE created_at >= NOW() - make_interval(days => $1)
      `, [dias]),
    ]);

    const tr = tasaRespuesta.rows[0];
    const tasa = tr.total_entrantes > 0
      ? Math.round((tr.respondidos_bot / tr.total_entrantes) * 100)
      : 0;

    res.json({
      mensajes_dia:    mensajesDia.rows,
      leads_por_etapa: leadsPorEtapa.rows,
      leads_dia:       leadsPorDia.rows,
      tasa_respuesta:  tasa,
      periodo_dias:    dias,
    });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function testBot(req, res) {
  try {
    const { mensaje, historial = [] } = req.body;
    if (!mensaje?.trim()) return res.status(400).json({ error: 'mensaje requerido' });

    const cfgRow = await pool.query(`SELECT value FROM config WHERE key = 'prompt_sistema'`);
    const promptSistema = cfgRow.rows[0]?.value || 'Eres un asistente de ventas amable y profesional.';

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages = [
      ...historial.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: mensaje },
    ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: promptSistema + '\n\nSi detectas intención clara de compra, incluye el tag [INTENCION_COMPRA] al final.',
      messages,
    });

    const raw = response.content[0].text;
    const { texto, tieneIntento } = extraerIntento(raw);
    res.json({ respuesta: texto, intencion_compra: tieneIntento });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// ── Energy Depot PR — Valores por defecto ─────────────────────────────────────
const DEFAULT_CONFIG = {
  company_name:  'Energy Depot PR',
  company_phone: '+17876278585',
  company_email: 'info@energydepotpr.com',
  prompt_sistema: 'Eres un asistente de ventas de Energy Depot PR, empresa de energía solar en Puerto Rico. Ayuda a los clientes con información sobre paneles solares, financiamiento y el proceso de instalación. Sé amable, profesional y responde en español.',
};

async function seedDefaultConfig() {
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
  return { ok: true, seeded: Object.keys(DEFAULT_CONFIG).length };
}

module.exports = { obtener, actualizar, stats, statsChart, testBot, seedDefaultConfig };
