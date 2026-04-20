const { pool } = require('../services/db');

async function ensureTeamMessagesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_messages (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      user_name VARCHAR(100),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureTeamMessagesTable().catch(e => console.error('[INIT] team_messages:', e.message));

async function listar(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM team_messages ORDER BY created_at DESC LIMIT 100`
    );
    res.json(rows.reverse());
  } catch (err) {
    console.error('[TEAM CHAT listar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function enviar(req, res) {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'content requerido' });
    const { rows } = await pool.query(
      `INSERT INTO team_messages (user_id, user_name, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user?.id || null, req.user?.name || 'Desconocido', content.trim()]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[TEAM CHAT enviar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function dailySummary(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM team_messages
       WHERE created_at >= NOW()::date
       ORDER BY created_at ASC`
    );
    // Group messages by hour
    const groups = {};
    rows.forEach(msg => {
      const hour = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
      const key = hour.slice(0, 2) + ':00';
      if (!groups[key]) groups[key] = [];
      groups[key].push(msg);
    });
    res.json({ date: new Date().toISOString().slice(0, 10), groups, total: rows.length });
  } catch (err) {
    console.error('[TEAM CHAT dailySummary]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function ensureTeamTasksTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_tasks (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      priority VARCHAR(10) NOT NULL DEFAULT 'media',
      status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      assigned_to VARCHAR(100),
      created_by_name VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureTeamTasksTable().catch(e => console.error('[INIT] team_tasks:', e.message));

async function listarTareas(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM team_tasks ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[TEAM TASKS listar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crearTarea(req, res) {
  try {
    const { content, priority = 'media', assigned_to } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'content requerido' });
    const { rows } = await pool.query(
      `INSERT INTO team_tasks (content, priority, status, assigned_to, created_by_name)
       VALUES ($1, $2, 'pendiente', $3, $4) RETURNING *`,
      [content.trim(), priority, assigned_to || null, req.user?.name || 'Desconocido']
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[TEAM TASKS crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizarTarea(req, res) {
  try {
    const { status, priority, assigned_to, content } = req.body;
    const { rows } = await pool.query(
      `UPDATE team_tasks SET
        status      = COALESCE($1, status),
        priority    = COALESCE($2, priority),
        assigned_to = COALESCE($3, assigned_to),
        content     = COALESCE($4, content)
       WHERE id = $5 RETURNING *`,
      [status || null, priority || null, assigned_to || null, content || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[TEAM TASKS actualizar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarTarea(req, res) {
  try {
    await pool.query(`DELETE FROM team_tasks WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TEAM TASKS eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, enviar, dailySummary, listarTareas, crearTarea, actualizarTarea, eliminarTarea };
