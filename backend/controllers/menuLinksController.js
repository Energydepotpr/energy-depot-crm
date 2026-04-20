const { pool } = require('../services/db');
const crypto = require('crypto');

// POST /api/menu-links (protected) — create shareable link
async function crear(req, res) {
  try {
    const { contact_id, lead_id, contact_name, menu_types, expires_hours } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + (expires_hours || 72) * 3600 * 1000);
    await pool.query(
      `INSERT INTO menu_links (token, lead_id, contact_id, contact_name, menu_types, expires_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [token, lead_id || null, contact_id || null, contact_name || '', JSON.stringify(menu_types || []), expires_at, req.user.id]
    );
    const frontendUrl = process.env.FRONTEND_URL || 'https://crm-ia-nu.vercel.app';
    res.json({ token, url: `${frontendUrl}/menu/${token}` });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/public/menu/:token — no auth
async function obtenerPublico(req, res) {
  try {
    const result = await pool.query(`SELECT * FROM menu_links WHERE token=$1`, [req.params.token]);
    if (!result.rows.length) return res.status(404).json({ error: 'Link no encontrado' });
    const link = result.rows[0];
    if (link.submitted) return res.status(410).json({ error: 'Este menú ya fue enviado' });
    if (new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado' });
    res.json({ contact_name: link.contact_name, menu_types: link.menu_types });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// POST /api/public/menu/:token/submit — no auth
async function submitPublico(req, res) {
  try {
    const { selections, client_notes } = req.body;
    const result = await pool.query(`SELECT * FROM menu_links WHERE token=$1`, [req.params.token]);
    if (!result.rows.length) return res.status(404).json({ error: 'Link no encontrado' });
    const link = result.rows[0];
    if (link.submitted) return res.status(410).json({ error: 'Ya enviado' });
    if (new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado' });

    await pool.query(
      `UPDATE menu_links SET submitted=true, selections=$1, client_notes=$2, submitted_at=NOW() WHERE token=$3`,
      [JSON.stringify(selections), client_notes || '', link.token]
    );

    // Add note to lead if linked
    if (link.lead_id) {
      const lines = [`Selección de menú enviada por ${link.contact_name || 'el cliente'}:`];
      for (const [menuId, sections] of Object.entries(selections)) {
        const menuLabels = { bbq: 'BBQ', chef: "Chef's", brunch: 'Brunch', kids: 'Kids', pr: 'Puerto Rican', desserts: 'Desserts' };
        lines.push(`\n▶ ${menuLabels[menuId] || menuId}`);
        for (const [sectionId, items] of Object.entries(sections)) {
          const itemEntries = Object.entries(items);
          if (!itemEntries.length) continue;
          itemEntries.forEach(([item, qty]) => {
            lines.push(`  • ${qty > 1 ? qty + 'x ' : ''}${item}`);
          });
        }
      }
      if (client_notes) lines.push(`\nNotas del cliente: ${client_notes}`);
      await pool.query(
        `INSERT INTO notes (lead_id, content, created_by) VALUES ($1, $2, $3)`,
        [link.lead_id, lines.join('\n'), link.created_by]
      );
    }

    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/menu-links (protected) — list submissions
async function listar(req, res) {
  try {
    const result = await pool.query(`
      SELECT ml.id, ml.token, ml.contact_name, ml.menu_types,
             ml.submitted, ml.selections, ml.client_notes, ml.submitted_at,
             ml.expires_at, ml.created_at,
             c.name AS contact_real_name, l.title AS lead_title
      FROM menu_links ml
      LEFT JOIN contacts c ON c.id = ml.contact_id
      LEFT JOIN leads l ON l.id = ml.lead_id
      ORDER BY ml.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// DELETE /api/menu-links/:id (protected) — delete any link
async function eliminar(req, res) {
  try {
    await pool.query(`DELETE FROM menu_links WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { crear, obtenerPublico, submitPublico, listar, eliminar };
