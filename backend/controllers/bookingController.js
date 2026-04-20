const { pool } = require('../services/db');
const { enviarSMS } = require('../services/twilioService');

// ── Ensure tables exist ────────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_pages (
      id               SERIAL PRIMARY KEY,
      agent_id         INT          REFERENCES users(id) ON DELETE SET NULL,
      slug             VARCHAR(100) UNIQUE NOT NULL,
      title            VARCHAR(200) NOT NULL,
      description      TEXT,
      duration_minutes INT          NOT NULL DEFAULT 30,
      buffer_minutes   INT          NOT NULL DEFAULT 10,
      available_days   JSONB        NOT NULL DEFAULT '[1,2,3,4,5]',
      available_from   TIME         NOT NULL DEFAULT '09:00',
      available_to     TIME         NOT NULL DEFAULT '18:00',
      timezone         VARCHAR(60)  NOT NULL DEFAULT 'America/Mexico_City',
      is_active        BOOLEAN      NOT NULL DEFAULT true,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id               SERIAL PRIMARY KEY,
      booking_page_id  INT          NOT NULL REFERENCES booking_pages(id) ON DELETE CASCADE,
      lead_id          INT          REFERENCES leads(id) ON DELETE SET NULL,
      contact_id       INT          REFERENCES contacts(id) ON DELETE SET NULL,
      agent_id         INT          REFERENCES users(id) ON DELETE SET NULL,
      start_time       TIMESTAMPTZ  NOT NULL,
      end_time         TIMESTAMPTZ  NOT NULL,
      status           VARCHAR(20)  NOT NULL DEFAULT 'pending',
      client_name      VARCHAR(200) NOT NULL,
      client_email     VARCHAR(200),
      client_phone     VARCHAR(50),
      notes            TEXT,
      sms_consent      BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

ensureTables().catch(e => console.error('[BOOKING] ensureTables error:', e.message));

// ── Helper: generate slots for a date ─────────────────────────────────────────
function generateSlots(date, fromTime, toTime, durationMin, bufferMin) {
  const slots = [];
  const [fh, fm] = fromTime.split(':').map(Number);
  const [th, tm] = toTime.split(':').map(Number);

  const step = durationMin + bufferMin;
  let cursor = fh * 60 + fm;
  const end   = th * 60 + tm;

  while (cursor + durationMin <= end) {
    const hh  = Math.floor(cursor / 60).toString().padStart(2, '0');
    const mm  = (cursor % 60).toString().padStart(2, '0');
    const slotStart = new Date(`${date}T${hh}:${mm}:00`);
    slots.push({ time: `${hh}:${mm}`, datetime: slotStart.toISOString() });
    cursor += step;
  }
  return slots;
}

// ── Protected routes ──────────────────────────────────────────────────────────
async function listarPaginas(req, res) {
  try {
    const r = await pool.query(`
      SELECT bp.*, u.name AS agent_name,
        (SELECT COUNT(*) FROM bookings b WHERE b.booking_page_id = bp.id AND b.status IN ('pending','confirmed'))::int AS upcoming_count
      FROM booking_pages bp
      LEFT JOIN users u ON u.id = bp.agent_id
      WHERE bp.agent_id = $1
      ORDER BY bp.created_at DESC
    `, [req.user.id]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function crearPagina(req, res) {
  try {
    const {
      slug, title, description, duration_minutes, buffer_minutes,
      available_days, available_from, available_to, timezone, is_active,
    } = req.body;
    if (!slug?.trim() || !title?.trim()) return res.status(400).json({ error: 'slug y title requeridos' });

    const r = await pool.query(
      `INSERT INTO booking_pages
         (agent_id, slug, title, description, duration_minutes, buffer_minutes,
          available_days, available_from, available_to, timezone, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.user.id,
        slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        title.trim(),
        description || null,
        duration_minutes || 30,
        buffer_minutes   || 10,
        JSON.stringify(available_days ?? [1,2,3,4,5]),
        available_from  || '09:00',
        available_to    || '18:00',
        timezone        || 'America/Mexico_City',
        is_active !== false,
      ]
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'El slug ya existe, elige otro' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizarPagina(req, res) {
  try {
    const {
      title, description, duration_minutes, buffer_minutes,
      available_days, available_from, available_to, timezone, is_active,
    } = req.body;

    const r = await pool.query(
      `UPDATE booking_pages SET
        title            = COALESCE($1, title),
        description      = COALESCE($2, description),
        duration_minutes = COALESCE($3, duration_minutes),
        buffer_minutes   = COALESCE($4, buffer_minutes),
        available_days   = COALESCE($5, available_days),
        available_from   = COALESCE($6, available_from),
        available_to     = COALESCE($7, available_to),
        timezone         = COALESCE($8, timezone),
        is_active        = COALESCE($9, is_active)
       WHERE id = $10 AND agent_id = $11
       RETURNING *`,
      [
        title?.trim()    || null,
        description      ?? null,
        duration_minutes || null,
        buffer_minutes   || null,
        available_days   ? JSON.stringify(available_days) : null,
        available_from   || null,
        available_to     || null,
        timezone         || null,
        is_active        ?? null,
        req.params.id,
        req.user.id,
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrada o sin permisos' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function eliminarPagina(req, res) {
  try {
    await pool.query(`DELETE FROM booking_pages WHERE id = $1 AND agent_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function listarBookings(req, res) {
  try {
    const { status, agent_id, from, to, contact_id, lead_id } = req.query;
    const isAdmin = req.user.role === 'admin';
    const conditions = [];
    const params = [];

    // Admins see all; agents see only theirs (or filter by agent_id)
    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`b.agent_id = $${params.length}`);
    } else if (agent_id) {
      params.push(agent_id);
      conditions.push(`b.agent_id = $${params.length}`);
    }

    if (contact_id) { params.push(contact_id); conditions.push(`b.contact_id = $${params.length}`); }
    if (lead_id)    { params.push(lead_id);    conditions.push(`b.lead_id = $${params.length}`); }
    if (status)     { params.push(status);     conditions.push(`b.status = $${params.length}`); }
    if (from)       { params.push(from);       conditions.push(`b.start_time >= $${params.length}`); }
    if (to)         { params.push(to);         conditions.push(`b.start_time <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const r = await pool.query(`
      SELECT b.*, bp.title AS page_title, bp.slug,
        c.name AS contact_name_linked,
        u.name AS agent_name
      FROM bookings b
      JOIN booking_pages bp ON bp.id = b.booking_page_id
      LEFT JOIN contacts c  ON c.id  = b.contact_id
      LEFT JOIN users u     ON u.id  = b.agent_id
      ${where}
      ORDER BY b.start_time DESC
    `, params);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function actualizarBooking(req, res) {
  try {
    const { status, notes } = req.body;
    const r = await pool.query(
      `UPDATE bookings SET
        status = COALESCE($1, status),
        notes  = COALESCE($2, notes)
       WHERE id = $3 AND agent_id = $4
       RETURNING *`,
      [status || null, notes ?? null, req.params.id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Booking no encontrado o sin permisos' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// ── Public routes (no auth) ───────────────────────────────────────────────────
async function obtenerPublico(req, res) {
  try {
    const r = await pool.query(`
      SELECT bp.id, bp.slug, bp.title, bp.description,
        bp.duration_minutes, bp.buffer_minutes,
        bp.available_days, bp.available_from, bp.available_to,
        bp.timezone, bp.is_active,
        u.name AS agent_name
      FROM booking_pages bp
      LEFT JOIN users u ON u.id = bp.agent_id
      WHERE bp.slug = $1 AND bp.is_active = true
    `, [req.params.slug]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Página no encontrada' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function slotsDisponibles(req, res) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date requerido (YYYY-MM-DD)' });

    const pageR = await pool.query(
      `SELECT * FROM booking_pages WHERE slug = $1 AND is_active = true`,
      [req.params.slug]
    );
    if (!pageR.rows[0]) return res.status(404).json({ error: 'Página no encontrada' });
    const page = pageR.rows[0];

    // Check if date is an available day (0=Sunday,...,6=Saturday)
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const availableDays = Array.isArray(page.available_days) ? page.available_days : JSON.parse(page.available_days || '[1,2,3,4,5]');
    if (!availableDays.includes(dayOfWeek)) {
      return res.json({ date, slots: [] });
    }

    // Generate all possible slots
    const allSlots = generateSlots(date, page.available_from, page.available_to, page.duration_minutes, page.buffer_minutes);

    // Get confirmed bookings for that day
    const bookedR = await pool.query(`
      SELECT start_time FROM bookings
      WHERE booking_page_id = $1
        AND status IN ('pending','confirmed')
        AND DATE(start_time AT TIME ZONE 'UTC') = $2::date
    `, [page.id, date]);

    const bookedTimes = new Set(
      bookedR.rows.map(b => new Date(b.start_time).toISOString())
    );

    const slots = allSlots.map(s => ({
      time:      s.time,
      datetime:  s.datetime,
      available: !bookedTimes.has(s.datetime),
    }));

    res.json({ date, slots, page_id: page.id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function crearBooking(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { client_name, client_email, client_phone, notes, datetime, sms_consent } = req.body;
    if (!client_name?.trim() || !datetime) return res.status(400).json({ error: 'client_name y datetime requeridos' });

    const pageR = await client.query(
      `SELECT * FROM booking_pages WHERE slug = $1 AND is_active = true`,
      [req.params.slug]
    );
    if (!pageR.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Página no encontrada' }); }
    const page = pageR.rows[0];

    const startTime = new Date(datetime);
    const endTime   = new Date(startTime.getTime() + page.duration_minutes * 60 * 1000);

    // Check slot is not already taken
    const conflict = await client.query(`
      SELECT id FROM bookings
      WHERE booking_page_id = $1
        AND status IN ('pending','confirmed')
        AND start_time = $2
    `, [page.id, startTime]);
    if (conflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este horario ya fue reservado' });
    }

    // Create or find contact
    let contactId = null;
    let leadId    = null;

    if (client_email || client_phone) {
      const existingContact = await client.query(
        `SELECT id FROM contacts WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1`,
        [client_email || null, client_phone || null]
      );
      if (existingContact.rows[0]) {
        contactId = existingContact.rows[0].id;
      } else {
        const newContact = await client.query(
          `INSERT INTO contacts (name, email, phone) VALUES ($1,$2,$3) RETURNING id`,
          [client_name.trim(), client_email || null, client_phone || null]
        );
        contactId = newContact.rows[0].id;
      }

      // Create lead linked to booking
      const newLead = await client.query(
        `INSERT INTO leads (title, contact_id, assigned_to, source)
         VALUES ($1,$2,$3,'booking') RETURNING id`,
        [`Cita: ${client_name.trim()}`, contactId, page.agent_id]
      );
      leadId = newLead.rows[0].id;
    }

    // Create booking
    const bookingR = await client.query(
      `INSERT INTO bookings
         (booking_page_id, lead_id, contact_id, agent_id, start_time, end_time,
          status, client_name, client_email, client_phone, notes, sms_consent)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11)
       RETURNING *`,
      [page.id, leadId, contactId, page.agent_id, startTime, endTime,
       client_name.trim(), client_email || null, client_phone || null, notes || null, !!sms_consent]
    );

    await client.query('COMMIT');

    // Send SMS confirmation only if client opted in
    if (sms_consent && client_phone) {
      const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const smsText = `Fix A Trip PR: Your booking for "${page.title}" is confirmed for ${dateStr} at ${timeStr}. Reply STOP to opt out.`;
      enviarSMS(client_phone, smsText).catch(e => console.error('[Booking] SMS error:', e.message));
    }

    res.json({
      booking: bookingR.rows[0],
      lead_id: leadId,
      contact_id: contactId,
      message: '¡Reserva confirmada! Te esperamos.',
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

module.exports = {
  listarPaginas,
  crearPagina,
  actualizarPagina,
  eliminarPagina,
  obtenerPublico,
  slotsDisponibles,
  crearBooking,
  listarBookings,
  actualizarBooking,
};

/* ROUTES_TO_ADD_server.js
const booking = require('./controllers/bookingController');

// Public booking routes (no auth required — register BEFORE authMiddleware or use separate mount)
app.get('/api/public/booking/:slug',            booking.obtenerPublico);
app.get('/api/public/booking/:slug/slots',      booking.slotsDisponibles);
app.post('/api/public/booking/:slug/book',      booking.crearBooking);

// Protected booking routes (inside authMiddleware scope)
app.get('/api/booking/pages',                   booking.listarPaginas);
app.post('/api/booking/pages',                  booking.crearPagina);
app.patch('/api/booking/pages/:id',             booking.actualizarPagina);
app.delete('/api/booking/pages/:id',            booking.eliminarPagina);
app.get('/api/booking/bookings',                booking.listarBookings);
app.patch('/api/booking/bookings/:id',          booking.actualizarBooking);
*/

/* API_METHODS_TO_ADD_api.js
// Booking pages (protected)
bookingPages:       ()            => req('GET',    '/api/booking/pages'),
createBookingPage:  (data)        => req('POST',   '/api/booking/pages', data),
updateBookingPage:  (id, data)    => req('PATCH',  `/api/booking/pages/${id}`, data),
deleteBookingPage:  (id)          => req('DELETE', `/api/booking/pages/${id}`),
bookings:           (params = '') => req('GET',    `/api/booking/bookings${params}`),
updateBooking:      (id, data)    => req('PATCH',  `/api/booking/bookings/${id}`, data),

// Public booking (no token needed — use raw fetch or separate base)
publicBookingPage:  (slug)        => req('GET',    `/api/public/booking/${slug}`),
bookingSlots:       (slug, date)  => req('GET',    `/api/public/booking/${slug}/slots?date=${date}`),
createBooking:      (slug, data)  => req('POST',   `/api/public/booking/${slug}/book`, data),
*/
