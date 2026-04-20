'use strict';
const { pool } = require('../services/db');

// ── Auto-create tables ────────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS itineraries (
      id            SERIAL PRIMARY KEY,
      lead_id       INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      title         VARCHAR(200) NOT NULL,
      destination   VARCHAR(200),
      start_date    DATE,
      end_date      DATE,
      num_passengers INTEGER DEFAULT 1,
      status        VARCHAR(50) DEFAULT 'draft',
      notes         TEXT,
      created_by    INTEGER REFERENCES users(id),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS itinerary_days (
      id            SERIAL PRIMARY KEY,
      itinerary_id  INTEGER REFERENCES itineraries(id) ON DELETE CASCADE,
      day_number    INTEGER NOT NULL,
      day_date      DATE,
      title         VARCHAR(200),
      items         JSONB DEFAULT '[]',
      notes         TEXT
    )
  `);
}

ensureTables().catch(err => console.error('[itineraries] ensureTables error:', err.message));

// ── Helper: build days array from date range ──────────────────────────────────
function buildDays(startDate, endDate) {
  const days = [];
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) return days;
  let cur = new Date(start);
  let num = 1;
  while (cur <= end) {
    days.push({
      day_number: num,
      day_date:   cur.toISOString().slice(0, 10),
      title:      `Día ${num}`,
      items:      [],
      notes:      null,
    });
    cur.setDate(cur.getDate() + 1);
    num++;
  }
  return days;
}

// ── listar ────────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { lead_id, contact_id, status } = req.query;
    const isAdmin = req.user.role === 'admin';

    const conditions = [];
    const params = [];

    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`i.created_by = $${params.length}`);
    }
    if (lead_id) {
      params.push(lead_id);
      conditions.push(`i.lead_id = $${params.length}`);
    }
    if (contact_id) {
      params.push(contact_id);
      conditions.push(`i.contact_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT
        i.*,
        c.name  AS contact_name,
        l.title AS lead_title,
        u.name  AS agent_name,
        (SELECT COUNT(*) FROM itinerary_days d WHERE d.itinerary_id = i.id)::int AS num_days
      FROM itineraries i
      LEFT JOIN contacts c ON i.contact_id = c.id
      LEFT JOIN leads    l ON i.lead_id    = l.id
      LEFT JOIN users    u ON i.created_by = u.id
      ${where}
      ORDER BY i.created_at DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[itineraries] listar:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── obtener ───────────────────────────────────────────────────────────────────
async function obtener(req, res) {
  try {
    const { id } = req.params;

    const { rows: iRows } = await pool.query(`
      SELECT
        i.*,
        c.name  AS contact_name,
        l.title AS lead_title,
        u.name  AS agent_name
      FROM itineraries i
      LEFT JOIN contacts c ON i.contact_id = c.id
      LEFT JOIN leads    l ON i.lead_id    = l.id
      LEFT JOIN users    u ON i.created_by = u.id
      WHERE i.id = $1
    `, [id]);

    if (!iRows.length) return res.status(404).json({ error: 'Itinerario no encontrado' });

    const itinerary = iRows[0];

    // Visibility check
    if (req.user.role !== 'admin' && itinerary.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin acceso a este itinerario' });
    }

    const { rows: days } = await pool.query(`
      SELECT * FROM itinerary_days
      WHERE itinerary_id = $1
      ORDER BY day_number ASC
    `, [id]);

    itinerary.days = days;
    res.json({ success: true, data: itinerary });
  } catch (err) {
    console.error('[itineraries] obtener:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── crear ─────────────────────────────────────────────────────────────────────
async function crear(req, res) {
  try {
    const {
      title, destination, start_date, end_date,
      num_passengers, status, notes, lead_id, contact_id,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'El título es requerido' });

    const { rows } = await pool.query(`
      INSERT INTO itineraries
        (title, destination, start_date, end_date, num_passengers, status, notes, lead_id, contact_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      title.trim(),
      destination || null,
      start_date  || null,
      end_date    || null,
      num_passengers || 1,
      status || 'draft',
      notes  || null,
      lead_id    || null,
      contact_id || null,
      req.user.id,
    ]);

    const itinerary = rows[0];

    // Auto-create days if date range provided
    if (start_date && end_date) {
      const days = buildDays(start_date, end_date);
      for (const d of days) {
        await pool.query(`
          INSERT INTO itinerary_days (itinerary_id, day_number, day_date, title, items, notes)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [itinerary.id, d.day_number, d.day_date, d.title, JSON.stringify(d.items), d.notes]);
      }
    }

    // Return with days
    const { rows: days } = await pool.query(`
      SELECT * FROM itinerary_days WHERE itinerary_id = $1 ORDER BY day_number ASC
    `, [itinerary.id]);
    itinerary.days = days;

    res.status(201).json({ success: true, data: itinerary });
  } catch (err) {
    console.error('[itineraries] crear:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── actualizar ────────────────────────────────────────────────────────────────
async function actualizar(req, res) {
  try {
    const { id } = req.params;

    // Fetch existing to check ownership
    const { rows: existing } = await pool.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Itinerario no encontrado' });
    if (req.user.role !== 'admin' && existing[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    const allowed = ['title', 'destination', 'start_date', 'end_date', 'num_passengers', 'status', 'notes', 'lead_id', 'contact_id'];
    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }

    if (!sets.length) return res.status(400).json({ error: 'No hay campos para actualizar' });

    params.push(id);
    sets.push('updated_at = NOW()');

    const { rows } = await pool.query(`
      UPDATE itineraries SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *
    `, params);

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[itineraries] actualizar:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── eliminar ──────────────────────────────────────────────────────────────────
async function eliminar(req, res) {
  try {
    const { id } = req.params;

    const { rows: existing } = await pool.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Itinerario no encontrado' });
    if (req.user.role !== 'admin' && existing[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    await pool.query('DELETE FROM itineraries WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[itineraries] eliminar:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── actualizarDia ─────────────────────────────────────────────────────────────
async function actualizarDia(req, res) {
  try {
    const { id, dayId } = req.params;

    // Ownership check via itinerary
    const { rows: iRows } = await pool.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    if (!iRows.length) return res.status(404).json({ error: 'Itinerario no encontrado' });
    if (req.user.role !== 'admin' && iRows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    const { title, items, notes, day_date } = req.body;
    const sets = [];
    const params = [];

    if ('title'    in req.body) { params.push(title);    sets.push(`title = $${params.length}`); }
    if ('items'    in req.body) { params.push(JSON.stringify(items || [])); sets.push(`items = $${params.length}`); }
    if ('notes'    in req.body) { params.push(notes || null); sets.push(`notes = $${params.length}`); }
    if ('day_date' in req.body) { params.push(day_date || null); sets.push(`day_date = $${params.length}`); }

    if (!sets.length) return res.status(400).json({ error: 'No hay campos para actualizar' });

    params.push(dayId);
    params.push(id);

    const { rows } = await pool.query(`
      UPDATE itinerary_days SET ${sets.join(', ')}
      WHERE id = $${params.length - 1} AND itinerary_id = $${params.length}
      RETURNING *
    `, params);

    if (!rows.length) return res.status(404).json({ error: 'Día no encontrado' });

    // Touch itinerary updated_at
    await pool.query('UPDATE itineraries SET updated_at = NOW() WHERE id = $1', [id]);

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[itineraries] actualizarDia:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── agregarDia ────────────────────────────────────────────────────────────────
async function agregarDia(req, res) {
  try {
    const { id } = req.params;

    const { rows: iRows } = await pool.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    if (!iRows.length) return res.status(404).json({ error: 'Itinerario no encontrado' });
    if (req.user.role !== 'admin' && iRows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    // Determine next day_number
    const { rows: last } = await pool.query(`
      SELECT COALESCE(MAX(day_number), 0) AS max_num FROM itinerary_days WHERE itinerary_id = $1
    `, [id]);
    const nextNum = (last[0].max_num || 0) + 1;

    const { title, day_date, notes } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO itinerary_days (itinerary_id, day_number, day_date, title, items, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      id,
      nextNum,
      day_date || null,
      title    || `Día ${nextNum}`,
      JSON.stringify([]),
      notes    || null,
    ]);

    await pool.query('UPDATE itineraries SET updated_at = NOW() WHERE id = $1', [id]);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[itineraries] agregarDia:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── eliminarDia ───────────────────────────────────────────────────────────────
async function eliminarDia(req, res) {
  try {
    const { id, dayId } = req.params;

    const { rows: iRows } = await pool.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    if (!iRows.length) return res.status(404).json({ error: 'Itinerario no encontrado' });
    if (req.user.role !== 'admin' && iRows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM itinerary_days WHERE id = $1 AND itinerary_id = $2',
      [dayId, id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Día no encontrado' });

    await pool.query('UPDATE itineraries SET updated_at = NOW() WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('[itineraries] eliminarDia:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  actualizarDia,
  agregarDia,
  eliminarDia,
};
