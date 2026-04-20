const { pool } = require('../services/db');

// --- NOTAS INTERNAS ---

async function listarNotas(req, res) {
  try {
    const result = await pool.query(
      `SELECT n.*, u.name AS user_name FROM lead_notes n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.lead_id = $1 ORDER BY n.created_at ASC`,
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function crearNota(req, res) {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text requerido' });
    const result = await pool.query(
      `INSERT INTO lead_notes (lead_id, user_id, text) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.leadId, req.user.id, text.trim()]
    );
    await registrarActividad(req.params.leadId, req.user.id, 'nota_agregada', text.trim().slice(0, 80));
    const nota = await pool.query(
      `SELECT n.*, u.name AS user_name FROM lead_notes n LEFT JOIN users u ON u.id = n.user_id WHERE n.id = $1`,
      [result.rows[0].id]
    );
    res.json(nota.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function eliminarNota(req, res) {
  try {
    await pool.query('DELETE FROM lead_notes WHERE id = $1 AND user_id = $2', [req.params.noteId, req.user.id]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// --- TAGS ---

async function listarTags(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM lead_tags WHERE lead_id = $1 ORDER BY tag`,
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function agregarTag(req, res) {
  try {
    const { tag, color = '#6366f1' } = req.body;
    if (!tag?.trim()) return res.status(400).json({ error: 'tag requerido' });
    const result = await pool.query(
      `INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,$2,$3)
       ON CONFLICT (lead_id, tag) DO UPDATE SET color = $3 RETURNING *`,
      [req.params.leadId, tag.trim().toLowerCase(), color]
    );
    await registrarActividad(req.params.leadId, req.user.id, 'tag_agregado', tag.trim());
    res.json(result.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function eliminarTag(req, res) {
  try {
    await pool.query('DELETE FROM lead_tags WHERE lead_id = $1 AND tag = $2', [req.params.leadId, req.params.tag]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// --- ACTIVIDAD ---

async function registrarActividad(leadId, userId, action, detail = null) {
  await pool.query(
    `INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES ($1,$2,$3,$4)`,
    [leadId, userId, action, detail]
  ).catch(() => {});
}

async function listarActividad(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name AS user_name FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.lead_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = {
  listarNotas, crearNota, eliminarNota,
  listarTags, agregarTag, eliminarTag,
  listarActividad, registrarActividad,
};
