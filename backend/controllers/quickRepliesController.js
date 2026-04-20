const { pool } = require('../services/db');

async function listar(req, res) {
  try {
    const result = await pool.query(
      `SELECT qr.*, u.name AS created_by_name FROM quick_replies qr
       LEFT JOIN users u ON u.id = qr.created_by
       ORDER BY COALESCE(qr.category, 'zzz') ASC, qr.title ASC`
    );
    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function crear(req, res) {
  try {
    const { title, text, category } = req.body;
    if (!title?.trim() || !text?.trim()) return res.status(400).json({ error: 'title y text requeridos' });
    const result = await pool.query(
      `INSERT INTO quick_replies (title, text, category, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [title.trim(), text.trim(), category?.trim() || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function actualizar(req, res) {
  try {
    const { title, text, category } = req.body;
    const result = await pool.query(
      `UPDATE quick_replies SET
        title    = COALESCE($1, title),
        text     = COALESCE($2, text),
        category = COALESCE($3, category)
       WHERE id = $4 RETURNING *`,
      [title || null, text || null, category || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json(result.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function eliminar(req, res) {
  try {
    await pool.query('DELETE FROM quick_replies WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { listar, crear, actualizar, eliminar };
