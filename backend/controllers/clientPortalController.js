'use strict';
const { pool } = require('../services/db');
const crypto   = require('crypto');

// Auto-create table on first use
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_portal_tokens (
      id          SERIAL PRIMARY KEY,
      contact_id  INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      token       VARCHAR(128) UNIQUE NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW(),
      last_access TIMESTAMP,
      expires_at  TIMESTAMP
    )
  `);
}

// ── POST /api/contacts/:id/portal-token ──────────────────────────────────────
async function generarToken(req, res) {
  const contactId = parseInt(req.params.id, 10);
  if (isNaN(contactId)) return res.status(400).json({ error: 'ID inválido' });

  try {
    await ensureTable();

    // Verify contact exists
    const ctRes = await pool.query(`SELECT id, name FROM contacts WHERE id = $1`, [contactId]);
    if (!ctRes.rows[0]) return res.status(404).json({ error: 'Contacto no encontrado' });

    // Invalidate old tokens
    await pool.query(
      `UPDATE client_portal_tokens SET expires_at = NOW() WHERE contact_id = $1`,
      [contactId]
    );

    const token     = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    await pool.query(
      `INSERT INTO client_portal_tokens (contact_id, token, expires_at) VALUES ($1, $2, $3)`,
      [contactId, token, expiresAt]
    );

    const baseUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000';
    const link = `${baseUrl}/portal/${token}`;

    res.json({ ok: true, token, link, expires_at: expiresAt });
  } catch (err) {
    console.error('[PORTAL generarToken]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/public/portal/:token ─────────────────────────────────────────────
async function portalInfo(req, res) {
  const { token } = req.params;
  try {
    await ensureTable();

    const tokRes = await pool.query(
      `SELECT cpt.*, c.id AS cid, c.name, c.phone, c.email, c.company, c.source
       FROM client_portal_tokens cpt
       JOIN contacts c ON c.id = cpt.contact_id
       WHERE cpt.token = $1`,
      [token]
    );
    if (!tokRes.rows[0]) return res.status(404).json({ error: 'Portal no encontrado' });
    const row = tokRes.rows[0];

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }

    // Update last_access
    await pool.query(
      `UPDATE client_portal_tokens SET last_access = NOW() WHERE token = $1`,
      [token]
    );

    const contactId = row.cid;

    // Contracts
    const contractsRes = await pool.query(
      `SELECT id, title, status, signed_at, file_name, notes, created_at
       FROM contracts WHERE contact_id = $1 ORDER BY created_at DESC`,
      [contactId]
    );

    // Invoices — scoped strictly to this contact_id, payment_link intentionally excluded
    const invoicesRes = await pool.query(
      `SELECT id, invoice_number, client_name, total, subtotal, tax, service_date, notes, items, created_at
       FROM invoices
       WHERE contact_id = $1
       ORDER BY created_at DESC`,
      [contactId]
    );

    // Bookings / calendar (if table exists)
    let bookings = [];
    try {
      const bookRes = await pool.query(
        `SELECT b.id, bp.title AS title, b.start_time, b.end_time, b.status, b.notes,
                u.name AS agent_name
         FROM bookings b
         LEFT JOIN booking_pages bp ON bp.id = b.booking_page_id
         LEFT JOIN users u ON u.id = b.agent_id
         WHERE b.contact_id = $1
         ORDER BY b.start_time DESC LIMIT 20`,
        [contactId]
      );
      bookings = bookRes.rows;
    } catch (_) {
      // Table doesn't exist yet — ignore
    }

    // Company info for branding
    let companyName = 'CRM IA';
    let companyLogo = null;
    try {
      const cfgRes = await pool.query(`SELECT value FROM config WHERE key = 'company_name'`);
      if (cfgRes.rows[0]) companyName = cfgRes.rows[0].value;
      const logoRes = await pool.query(`SELECT value FROM config WHERE key = 'company_logo'`);
      if (logoRes.rows[0]) companyLogo = logoRes.rows[0].value;
    } catch (_) { /* ignore */ }

    res.json({
      ok: true,
      data: {
        contact: {
          id:      contactId,
          name:    row.name,
          phone:   row.phone,
          email:   row.email,
          company: row.company,
        },
        invoices:   invoicesRes.rows,
        contracts:  contractsRes.rows,
        bookings,
        company: { name: companyName, logo: companyLogo },
      }
    });
  } catch (err) {
    console.error('[PORTAL portalInfo]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { generarToken, portalInfo };

/* ROUTES_TO_ADD_server.js
const clientPortal = require('./controllers/clientPortalController');

// Public portal route (BEFORE authMiddleware)
app.get('/api/public/portal/:token', clientPortal.portalInfo);

// Protected portal route (AFTER authMiddleware)
app.post('/api/contacts/:id/portal-token', clientPortal.generarToken);
*/

/* API_METHODS_TO_ADD_api.js
  portalToken:    (contactId)  => req('POST', `/api/contacts/${contactId}/portal-token`),
  publicPortal:   (token)      => fetch(`/backend/api/public/portal/${token}`).then(r => r.json()),
*/
