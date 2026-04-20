const { pool } = require('../services/db');
const { registrarActividad } = require('./notesController');

async function listar(req, res) {
  try {
    const { lead_id, assigned_to, completed } = req.query;
    const conditions = [];
    const params = [];

    if (lead_id)     { params.push(lead_id);    conditions.push(`t.lead_id = $${params.length}`); }
    if (assigned_to) { params.push(assigned_to); conditions.push(`t.assigned_to = $${params.length}`); }
    if (completed !== undefined) {
      params.push(completed === 'true');
      conditions.push(`t.completed = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(`
      SELECT t.*,
        u.name AS assigned_name,
        cb.name AS created_by_name,
        l.title AS lead_title
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN users cb ON cb.id = t.created_by
      LEFT JOIN leads l ON l.id = t.lead_id
      ${where}
      ORDER BY t.completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC
    `, params);

    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function crear(req, res) {
  try {
    const { lead_id, title, due_date, assigned_to } = req.body;
    if (!lead_id || !title?.trim()) return res.status(400).json({ error: 'lead_id y title requeridos' });

    const result = await pool.query(
      `INSERT INTO tasks (lead_id, title, due_date, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [lead_id, title.trim(), due_date || null, assigned_to || req.user.id, req.user.id]
    );

    const task = await pool.query(
      `SELECT t.*, u.name AS assigned_name, cb.name AS created_by_name, l.title AS lead_title
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN users cb ON cb.id = t.created_by
       LEFT JOIN leads l ON l.id = t.lead_id
       WHERE t.id = $1`,
      [result.rows[0].id]
    );

    await registrarActividad(lead_id, req.user.id, 'tarea_creada', title.trim());
    res.json(task.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function completar(req, res) {
  try {
    const { completed } = req.body;
    const result = await pool.query(
      `UPDATE tasks SET
        completed = $1,
        completed_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END
       WHERE id = $2 RETURNING *`,
      [completed, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (completed) {
      await registrarActividad(result.rows[0].lead_id, req.user.id, 'tarea_completada', result.rows[0].title);
    }
    res.json(result.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function eliminar(req, res) {
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { listar, crear, completar, eliminar };
