const { pool } = require('../services/db');

async function buscar(req, res) {
  try {
    const { q = '' } = req.query;
    if (q.trim().length < 2) return res.json({ contacts: [], leads: [], messages: [] });

    const s = `%${q.trim()}%`;

    const [contacts, leads, messages] = await Promise.all([
      pool.query(
        `SELECT id, name, phone, email, company FROM contacts
         WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1 OR company ILIKE $1
         ORDER BY name LIMIT 8`,
        [s]
      ),
      pool.query(
        `SELECT DISTINCT l.id, l.title, l.value,
           c.name AS contact_name, c.phone AS contact_phone,
           ps.name AS stage_name, ps.color AS stage_color
         FROM leads l
         LEFT JOIN contacts c ON c.id = l.contact_id
         LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
         LEFT JOIN lead_notes ln ON ln.lead_id = l.id
         WHERE l.title ILIKE $1 OR c.name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1 OR ln.text ILIKE $1
         ORDER BY l.updated_at DESC LIMIT 8`,
        [s]
      ),
      pool.query(
        `SELECT m.id, m.text, m.direction, m.created_at, m.lead_id,
           c.name AS contact_name
         FROM messages m
         LEFT JOIN leads l ON l.id = m.lead_id
         LEFT JOIN contacts c ON c.id = l.contact_id
         WHERE m.text ILIKE $1
         ORDER BY m.created_at DESC LIMIT 6`,
        [s]
      ),
    ]);

    res.json({
      contacts: contacts.rows,
      leads:    leads.rows,
      messages: messages.rows,
    });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { buscar };
