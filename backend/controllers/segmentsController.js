'use strict';
const { pool } = require('../services/db');

// ─── Auto-create table ──────────────────────────────────────────────────────
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS segments (
      id           SERIAL PRIMARY KEY,
      name         VARCHAR(255) NOT NULL,
      description  TEXT,
      filters      JSONB NOT NULL DEFAULT '{}',
      contact_count INTEGER NOT NULL DEFAULT 0,
      created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMP DEFAULT NOW(),
      updated_at   TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureTable();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a parameterized WHERE clause from a filters object.
 * Supported keys: source, has_email, has_phone, created_after,
 *                 created_before, tag, city, company
 * Returns { where: string, params: any[] }
 */
function buildFilterQuery(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.source) {
    if (filters.source === 'manual') {
      conditions.push(`(source IS NULL OR source = 'manual')`);
    } else {
      params.push(filters.source);
      conditions.push(`source = $${params.length}`);
    }
  }

  if (filters.has_email === true || filters.has_email === 'true') {
    conditions.push(`(email IS NOT NULL AND email != '')`);
  } else if (filters.has_email === false || filters.has_email === 'false') {
    conditions.push(`(email IS NULL OR email = '')`);
  }

  if (filters.has_phone === true || filters.has_phone === 'true') {
    conditions.push(`(phone IS NOT NULL AND phone != '')`);
  } else if (filters.has_phone === false || filters.has_phone === 'false') {
    conditions.push(`(phone IS NULL OR phone = '')`);
  }

  if (filters.created_after) {
    params.push(filters.created_after);
    conditions.push(`created_at >= $${params.length}::timestamptz`);
  }

  if (filters.created_before) {
    params.push(filters.created_before);
    conditions.push(`created_at <= $${params.length}::timestamptz`);
  }

  if (filters.tag) {
    params.push(`%${filters.tag}%`);
    conditions.push(`(tags ILIKE $${params.length} OR tags::text ILIKE $${params.length})`);
  }

  if (filters.city) {
    params.push(`%${filters.city}%`);
    conditions.push(`city ILIKE $${params.length}`);
  }

  if (filters.company) {
    params.push(`%${filters.company}%`);
    conditions.push(`company ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

async function listar(req, res) {
  try {
    // Return all segments; update contact_count on the fly
    const { rows } = await pool.query(`
      SELECT id, name, description, filters, contact_count, created_by, created_at, updated_at
      FROM segments
      ORDER BY created_at DESC
    `);

    // Refresh contact_count for each segment asynchronously (best effort)
    const updated = await Promise.all(
      rows.map(async (seg) => {
        try {
          const { where, params } = buildFilterQuery(seg.filters || {});
          const r = await pool.query(`SELECT COUNT(*) FROM contacts ${where}`, params);
          const cnt = Number(r.rows[0].count);
          if (cnt !== seg.contact_count) {
            await pool.query(`UPDATE segments SET contact_count=$1 WHERE id=$2`, [cnt, seg.id]);
          }
          return { ...seg, contact_count: cnt };
        } catch {
          return seg;
        }
      })
    );

    res.json({ ok: true, segments: updated });
  } catch (err) {
    console.error('[SEGMENTS listar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crear(req, res) {
  try {
    const { name, description, filters } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name requerido' });

    const safeFilters = filters && typeof filters === 'object' ? filters : {};

    // Calculate initial contact_count
    const { where, params: filterParams } = buildFilterQuery(safeFilters);
    const countRow = await pool.query(`SELECT COUNT(*) FROM contacts ${where}`, filterParams);
    const contact_count = Number(countRow.rows[0].count);

    const { rows } = await pool.query(
      `INSERT INTO segments (name, description, filters, contact_count, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), description || null, JSON.stringify(safeFilters), contact_count, req.user?.id || null]
    );

    res.json({ ok: true, segment: rows[0] });
  } catch (err) {
    console.error('[SEGMENTS crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { name, description, filters } = req.body;

    const existing = await pool.query(`SELECT * FROM segments WHERE id=$1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Segmento no encontrado' });

    const newName = name !== undefined ? name.trim() : existing.rows[0].name;
    const newDesc = description !== undefined ? description : existing.rows[0].description;
    const newFilters = filters !== undefined
      ? (typeof filters === 'object' ? filters : existing.rows[0].filters)
      : existing.rows[0].filters;

    // Recalculate count with new filters
    const { where, params: filterParams } = buildFilterQuery(newFilters);
    const countRow = await pool.query(`SELECT COUNT(*) FROM contacts ${where}`, filterParams);
    const contact_count = Number(countRow.rows[0].count);

    const { rows } = await pool.query(
      `UPDATE segments
       SET name=$1, description=$2, filters=$3, contact_count=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [newName, newDesc, JSON.stringify(newFilters), contact_count, id]
    );

    res.json({ ok: true, segment: rows[0] });
  } catch (err) {
    console.error('[SEGMENTS actualizar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT id FROM segments WHERE id=$1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Segmento no encontrado' });

    // Check if any campaigns reference this segment
    const campaignCheck = await pool.query(
      `SELECT COUNT(*) FROM campaigns WHERE segment_id=$1`,
      [id]
    ).catch(() => ({ rows: [{ count: '0' }] }));
    if (Number(campaignCheck.rows[0].count) > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: hay campañas usando este segmento' });
    }

    await pool.query(`DELETE FROM segments WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[SEGMENTS eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function preview(req, res) {
  try {
    const { filters } = req.body;
    const safeFilters = filters && typeof filters === 'object' ? filters : {};

    const { where, params } = buildFilterQuery(safeFilters);

    const [countRow, contactsRow] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM contacts ${where}`, params),
      pool.query(
        `SELECT id, name, email, phone, company FROM contacts ${where} ORDER BY created_at DESC LIMIT 5`,
        params
      ),
    ]);

    res.json({
      ok: true,
      count: Number(countRow.rows[0].count),
      sample: contactsRow.rows,
    });
  } catch (err) {
    console.error('[SEGMENTS preview]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function contactsOfSegment(req, res) {
  try {
    const { id } = req.params;

    const segRow = await pool.query(`SELECT * FROM segments WHERE id=$1`, [id]);
    if (!segRow.rows[0]) return res.status(404).json({ error: 'Segmento no encontrado' });

    const filters = segRow.rows[0].filters || {};
    const { where, params } = buildFilterQuery(filters);

    const { rows } = await pool.query(
      `SELECT id, name, email, phone, company, source, created_at
       FROM contacts ${where}
       ORDER BY name ASC`,
      params
    );

    res.json({ ok: true, contacts: rows, total: rows.length });
  } catch (err) {
    console.error('[SEGMENTS contactsOfSegment]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, actualizar, eliminar, preview, contactsOfSegment };

/* ROUTES_TO_ADD_server.js
const segments = require('./controllers/segmentsController');
app.get('/api/segments',                      segments.listar);
app.post('/api/segments',                     segments.crear);
app.post('/api/segments/preview',             segments.preview);
app.patch('/api/segments/:id',                segments.actualizar);
app.delete('/api/segments/:id',               segments.eliminar);
app.get('/api/segments/:id/contacts',         segments.contactsOfSegment);
*/

/* API_METHODS_TO_ADD_api.js
// Segments
segments:             ()               => req('GET',    '/api/segments'),
createSegment:        (data)           => req('POST',   '/api/segments', data),
updateSegment:        (id, data)       => req('PATCH',  `/api/segments/${id}`, data),
deleteSegment:        (id)             => req('DELETE', `/api/segments/${id}`),
previewSegment:       (filters)        => req('POST',   '/api/segments/preview', { filters }),
segmentContacts:      (id)             => req('GET',    `/api/segments/${id}/contacts`),
*/
