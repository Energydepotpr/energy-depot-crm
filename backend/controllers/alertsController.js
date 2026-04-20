const { pool } = require('../services/db');

async function initStatusColumn() {
  try {
    await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending'`);
  } catch (err) {
    console.error('[ALERTS] Error adding status column:', err.message);
  }
}
initStatusColumn();

async function listar(req, res) {
  try {
    const { seen } = req.query;
    const conditions = seen !== undefined ? [`a.seen = $1`] : [];
    const params = seen !== undefined ? [seen === 'true'] : [];

    const result = await pool.query(`
      SELECT a.*,
        l.title AS lead_title,
        c.name AS contact_name, c.phone AS contact_phone
      FROM alerts a
      LEFT JOIN leads l ON l.id = a.lead_id
      LEFT JOIN contacts c ON c.id = l.contact_id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY a.created_at DESC
      LIMIT 100
    `, params);

    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function marcarVisto(req, res) {
  try {
    await pool.query('UPDATE alerts SET seen = true WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function marcarTodosVistos(req, res) {
  try {
    await pool.query('UPDATE alerts SET seen = true WHERE seen = false');
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function actualizarStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status requerido' });
    await pool.query('UPDATE alerts SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { listar, marcarVisto, marcarTodosVistos, actualizarStatus };
