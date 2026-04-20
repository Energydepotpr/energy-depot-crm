const { pool } = require('../services/db');

// ── Ensure table exists ───────────────────────────────────────────────────────
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_passengers (
      id               SERIAL PRIMARY KEY,
      booking_id       INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
      name             VARCHAR(200) NOT NULL,
      email            VARCHAR(150),
      phone            VARCHAR(50),
      passport_number  VARCHAR(100),
      passport_expiry  DATE,
      notes            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

ensureTable().catch(e => console.error('[PASSENGERS] ensureTable error:', e.message));

// ── GET /api/bookings/:bookingId/passengers ───────────────────────────────────
async function listar(req, res) {
  try {
    const { bookingId } = req.params;
    const result = await pool.query(
      `SELECT * FROM booking_passengers WHERE booking_id = $1 ORDER BY created_at ASC`,
      [bookingId]
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error('[PASSENGERS] listar error:', e.message);
    res.status(500).json({ error: 'Error al listar pasajeros' });
  }
}

// ── POST /api/bookings/:bookingId/passengers ──────────────────────────────────
async function crear(req, res) {
  try {
    const { bookingId } = req.params;
    const { name, email, phone, passport_number, passport_expiry, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del pasajero es requerido' });
    }

    const result = await pool.query(
      `INSERT INTO booking_passengers
         (booking_id, name, email, phone, passport_number, passport_expiry, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        bookingId,
        name.trim(),
        email || null,
        phone || null,
        passport_number || null,
        passport_expiry || null,
        notes || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[PASSENGERS] crear error:', e.message);
    res.status(500).json({ error: 'Error al crear pasajero' });
  }
}

// ── PATCH /api/bookings/:bookingId/passengers/:id ─────────────────────────────
async function actualizar(req, res) {
  try {
    const { bookingId, id } = req.params;
    const { name, email, phone, passport_number, passport_expiry, notes } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined)            { fields.push(`name = $${idx++}`);            values.push(name.trim()); }
    if (email !== undefined)           { fields.push(`email = $${idx++}`);           values.push(email || null); }
    if (phone !== undefined)           { fields.push(`phone = $${idx++}`);           values.push(phone || null); }
    if (passport_number !== undefined) { fields.push(`passport_number = $${idx++}`); values.push(passport_number || null); }
    if (passport_expiry !== undefined) { fields.push(`passport_expiry = $${idx++}`); values.push(passport_expiry || null); }
    if (notes !== undefined)           { fields.push(`notes = $${idx++}`);           values.push(notes || null); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(id, bookingId);
    const result = await pool.query(
      `UPDATE booking_passengers
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND booking_id = $${idx + 1}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pasajero no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[PASSENGERS] actualizar error:', e.message);
    res.status(500).json({ error: 'Error al actualizar pasajero' });
  }
}

// ── DELETE /api/bookings/:bookingId/passengers/:id ────────────────────────────
async function eliminar(req, res) {
  try {
    const { bookingId, id } = req.params;
    const result = await pool.query(
      `DELETE FROM booking_passengers WHERE id = $1 AND booking_id = $2`,
      [id, bookingId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pasajero no encontrado' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('[PASSENGERS] eliminar error:', e.message);
    res.status(500).json({ error: 'Error al eliminar pasajero' });
  }
}

// ── GET /api/bookings/:bookingId/passengers/manifesto ─────────────────────────
async function exportarManifiesto(req, res) {
  try {
    const { bookingId } = req.params;

    // Fetch booking title for filename
    const bookingRes = await pool.query(
      `SELECT bp.title AS page_title, b.client_name, b.start_time
       FROM bookings b
       JOIN booking_pages bp ON b.booking_page_id = bp.id
       WHERE b.id = $1`,
      [bookingId]
    );

    const passRes = await pool.query(
      `SELECT name, email, phone, passport_number, passport_expiry, notes
       FROM booking_passengers
       WHERE booking_id = $1
       ORDER BY created_at ASC`,
      [bookingId]
    );

    const bookingInfo = bookingRes.rows[0];
    const safeTitle = bookingInfo
      ? (bookingInfo.page_title || bookingInfo.client_name || `booking-${bookingId}`)
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
      : `booking-${bookingId}`;

    const filename = `manifiesto_${safeTitle}_${bookingId}.csv`;

    // UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const headers = ['Nombre', 'Email', 'Teléfono', 'Pasaporte', 'Vence Pasaporte', 'Notas'];

    function escapeCSV(val) {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    function fmtDate(val) {
      if (!val) return '';
      try {
        const d = new Date(val);
        return d.toISOString().slice(0, 10);
      } catch { return String(val); }
    }

    const rows = passRes.rows.map(p => [
      escapeCSV(p.name),
      escapeCSV(p.email),
      escapeCSV(p.phone),
      escapeCSV(p.passport_number),
      escapeCSV(fmtDate(p.passport_expiry)),
      escapeCSV(p.notes),
    ].join(','));

    const csv = BOM + [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    console.error('[PASSENGERS] exportarManifiesto error:', e.message);
    res.status(500).json({ error: 'Error al exportar manifiesto' });
  }
}

module.exports = { listar, crear, actualizar, eliminar, exportarManifiesto };
