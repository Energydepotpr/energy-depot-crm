const { pool } = require('../services/db');

async function listar(req, res) {
  try {
    const { pipeline_id } = req.query;
    const result = await pool.query(`
      SELECT pa.*,
        ps.name AS trigger_stage_name, ps.color AS trigger_stage_color
      FROM pipeline_automations pa
      LEFT JOIN pipeline_stages ps ON ps.id = pa.trigger_stage_id
      ${pipeline_id ? 'WHERE pa.pipeline_id = $1' : ''}
      ORDER BY pa.created_at ASC
    `, pipeline_id ? [pipeline_id] : []);
    res.json(result.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function crear(req, res) {
  try {
    const { pipeline_id, trigger_stage_id, action_type, action_data } = req.body;
    if (!pipeline_id || !trigger_stage_id || !action_type)
      return res.status(400).json({ error: 'pipeline_id, trigger_stage_id y action_type requeridos' });
    const r = await pool.query(
      `INSERT INTO pipeline_automations (pipeline_id, trigger_stage_id, action_type, action_data)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [pipeline_id, trigger_stage_id, action_type, action_data || {}]
    );
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function actualizar(req, res) {
  try {
    const { active, action_data } = req.body;
    const r = await pool.query(
      `UPDATE pipeline_automations SET
        active      = COALESCE($1, active),
        action_data = COALESCE($2, action_data)
       WHERE id = $3 RETURNING *`,
      [active ?? null, action_data || null, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function eliminar(req, res) {
  try {
    await pool.query('DELETE FROM pipeline_automations WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// Called internally when a lead changes stage
async function ejecutarAutomaciones(lead_id, stage_id) {
  try {
    const autos = await pool.query(
      `SELECT * FROM pipeline_automations WHERE trigger_stage_id = $1 AND active = true`,
      [stage_id]
    );
    for (const auto of autos.rows) {
      if (auto.action_type === 'create_task') {
        const { title = 'Seguimiento', days = 1 } = auto.action_data || {};
        const due = new Date();
        due.setDate(due.getDate() + Number(days));
        await pool.query(
          `INSERT INTO tasks (lead_id, title, due_date) VALUES ($1,$2,$3)`,
          [lead_id, title, due.toISOString()]
        );
      } else if (auto.action_type === 'send_message') {
        const { text } = auto.action_data || {};
        if (!text) continue;
        const leadR = await pool.query(`SELECT contact_id FROM leads WHERE id=$1`, [lead_id]);
        if (!leadR.rows[0]) continue;
        await pool.query(
          `INSERT INTO messages (lead_id, contact_id, direction, text, is_bot) VALUES ($1,$2,'outbound',$3,true)`,
          [lead_id, leadR.rows[0].contact_id, text]
        );
      }
    }
  } catch (e) {
    console.error('[AUTOMATION] Error ejecutando automaciones:', e.message);
  }
}

module.exports = { listar, crear, actualizar, eliminar, ejecutarAutomaciones };
