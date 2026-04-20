const { pool } = require('../services/db');

async function reporteAgentes(req, res) {
  try {
    const { days = 30 } = req.query;
    const interval = `${Number(days)} days`;

    const result = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.role,
        COUNT(DISTINCT m.id)  FILTER (WHERE m.direction = 'outbound' AND m.sent_by = u.id
                                       AND m.created_at > NOW() - $1::INTERVAL)  AS mensajes_enviados,
        COUNT(DISTINCT l.id)  FILTER (WHERE l.assigned_to = u.id)                AS leads_asignados,
        COUNT(DISTINCT l.id)  FILTER (WHERE l.assigned_to = u.id
                                       AND ps.name ILIKE '%ganad%')              AS leads_ganados,
        COUNT(DISTINCT l.id)  FILTER (WHERE l.assigned_to = u.id
                                       AND l.created_at > NOW() - $1::INTERVAL)  AS leads_nuevos,
        ROUND(AVG(
          EXTRACT(EPOCH FROM (
            SELECT MIN(m2.created_at) FROM messages m2
            WHERE m2.lead_id = l.id AND m2.direction = 'outbound' AND m2.sent_by = u.id
          ) - (
            SELECT MIN(m3.created_at) FROM messages m3
            WHERE m3.lead_id = l.id AND m3.direction = 'inbound'
          ))
        ) / 60)::INTEGER AS avg_resp_min
      FROM users u
      LEFT JOIN messages m ON m.sent_by = u.id
      LEFT JOIN leads l ON l.assigned_to = u.id
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      WHERE u.active = true
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY mensajes_enviados DESC
    `, [interval]);

    res.json(result.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function scoreLeads(req, res) {
  try {
    // Update score for all leads based on activity
    await pool.query(`
      UPDATE leads l SET score = (
        SELECT LEAST(100, GREATEST(0,
          (SELECT COUNT(*) FROM messages m WHERE m.lead_id = l.id) * 5 +
          CASE WHEN l.check_in IS NOT NULL THEN 20 ELSE 0 END +
          CASE WHEN l.value > 0 THEN 10 ELSE 0 END +
          CASE WHEN l.updated_at > NOW() - INTERVAL '3 days' THEN 15 ELSE 0 END -
          GREATEST(0, EXTRACT(DAY FROM NOW() - l.updated_at)::INTEGER - 7) * 2
        ))
      )
    `);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function bulkMessage(req, res) {
  try {
    const { lead_ids, text } = req.body;
    if (!Array.isArray(lead_ids) || !lead_ids.length || !text?.trim())
      return res.status(400).json({ error: 'lead_ids y text requeridos' });

    const sse = require('../services/sse');
    let enviados = 0, errores = 0;

    for (const lead_id of lead_ids) {
      try {
        const leadR = await pool.query('SELECT contact_id FROM leads WHERE id=$1', [lead_id]);
        if (!leadR.rows[0]) { errores++; continue; }

        await pool.query(
          `INSERT INTO messages (lead_id, contact_id, direction, text, sent_by)
           VALUES ($1,$2,'outbound',$3,$4)`,
          [lead_id, leadR.rows[0].contact_id, text.trim(), req.user.id]
        );
        sse.broadcast('new_message', { lead_id: Number(lead_id), direction: 'outbound' });
        enviados++;
      } catch { errores++; }
    }

    res.json({ ok: true, enviados, errores });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { reporteAgentes, scoreLeads, bulkMessage };
