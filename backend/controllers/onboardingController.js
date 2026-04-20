'use strict';
const { pool } = require('../services/db');

const DEFAULT_ITEMS = [
  { id: 'passport',  label: 'Subir copia del pasaporte',       required: true },
  { id: 'insurance', label: 'Confirmar seguro de viaje',        required: true },
  { id: 'contract',  label: 'Firmar contrato de servicios',     required: true },
  { id: 'deposit',   label: 'Pagar depósito inicial',           required: true },
  { id: 'itinerary', label: 'Revisar y aprobar itinerario',     required: false },
  { id: 'emergency', label: 'Proveer contacto de emergencia',   required: false },
];

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_onboarding (
      id           SERIAL PRIMARY KEY,
      contact_id   INTEGER UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
      items        JSONB DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /api/contacts/:contactId/onboarding
async function obtener(req, res) {
  const contactId = parseInt(req.params.contactId, 10);
  if (isNaN(contactId)) return res.status(400).json({ error: 'ID inválido' });
  try {
    await ensureTable();
    let r = await pool.query(`SELECT * FROM client_onboarding WHERE contact_id = $1`, [contactId]);
    if (!r.rows[0]) {
      // Auto-create with defaults
      const items = DEFAULT_ITEMS.map(i => ({ ...i, completed: false, completed_at: null }));
      r = await pool.query(
        `INSERT INTO client_onboarding (contact_id, items) VALUES ($1,$2) RETURNING *`,
        [contactId, JSON.stringify(items)]
      );
    }
    res.json({ ok: true, onboarding: r.rows[0] });
  } catch (err) {
    console.error('[ONBOARDING obtener]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// PATCH /api/contacts/:contactId/onboarding/:itemId — toggle item complete
async function toggleItem(req, res) {
  const contactId = parseInt(req.params.contactId, 10);
  const { itemId } = req.params;
  const { completed } = req.body;
  try {
    await ensureTable();
    let r = await pool.query(`SELECT * FROM client_onboarding WHERE contact_id = $1`, [contactId]);
    if (!r.rows[0]) {
      const items = DEFAULT_ITEMS.map(i => ({ ...i, completed: false, completed_at: null }));
      r = await pool.query(
        `INSERT INTO client_onboarding (contact_id, items) VALUES ($1,$2) RETURNING *`,
        [contactId, JSON.stringify(items)]
      );
    }
    const row = r.rows[0];
    const items = (row.items || []).map(i =>
      i.id === itemId
        ? { ...i, completed: !!completed, completed_at: completed ? new Date().toISOString() : null }
        : i
    );
    const updated = await pool.query(
      `UPDATE client_onboarding SET items=$1, updated_at=NOW() WHERE contact_id=$2 RETURNING *`,
      [JSON.stringify(items), contactId]
    );
    res.json({ ok: true, onboarding: updated.rows[0] });
  } catch (err) {
    console.error('[ONBOARDING toggleItem]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// POST /api/contacts/:contactId/onboarding/items — add custom item
async function addItem(req, res) {
  const contactId = parseInt(req.params.contactId, 10);
  const { label } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'label requerido' });
  try {
    await ensureTable();
    let r = await pool.query(`SELECT * FROM client_onboarding WHERE contact_id = $1`, [contactId]);
    if (!r.rows[0]) {
      const items = DEFAULT_ITEMS.map(i => ({ ...i, completed: false, completed_at: null }));
      r = await pool.query(
        `INSERT INTO client_onboarding (contact_id, items) VALUES ($1,$2) RETURNING *`,
        [contactId, JSON.stringify(items)]
      );
    }
    const row = r.rows[0];
    const newItem = {
      id: `custom_${Date.now()}`, label: label.trim(),
      required: false, completed: false, completed_at: null
    };
    const items = [...(row.items || []), newItem];
    const updated = await pool.query(
      `UPDATE client_onboarding SET items=$1, updated_at=NOW() WHERE contact_id=$2 RETURNING *`,
      [JSON.stringify(items), contactId]
    );
    res.json({ ok: true, onboarding: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
}

// GET /api/public/onboarding/:token — public portal endpoint
async function obtenerPublico(req, res) {
  // Called from portal — validates token via portal token table
  const { token } = req.params;
  try {
    await ensureTable();
    const tokRes = await pool.query(
      `SELECT cpt.contact_id FROM client_portal_tokens cpt WHERE cpt.token = $1 AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())`,
      [token]
    );
    if (!tokRes.rows[0]) return res.status(404).json({ error: 'Token inválido' });
    const contactId = tokRes.rows[0].contact_id;
    let r = await pool.query(`SELECT * FROM client_onboarding WHERE contact_id = $1`, [contactId]);
    if (!r.rows[0]) {
      const items = DEFAULT_ITEMS.map(i => ({ ...i, completed: false, completed_at: null }));
      r = await pool.query(
        `INSERT INTO client_onboarding (contact_id, items) VALUES ($1,$2) RETURNING *`,
        [contactId, JSON.stringify(items)]
      );
    }
    res.json({ ok: true, onboarding: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
}

// PATCH /api/public/onboarding/:token/toggle — client toggles own checklist item
async function toggleItemPublico(req, res) {
  const { token } = req.params;
  const { itemId, completed } = req.body;
  try {
    await ensureTable();
    const tokRes = await pool.query(
      `SELECT contact_id FROM client_portal_tokens WHERE token = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [token]
    );
    if (!tokRes.rows[0]) return res.status(404).json({ error: 'Token inválido' });
    const contactId = tokRes.rows[0].contact_id;
    let r = await pool.query(`SELECT * FROM client_onboarding WHERE contact_id = $1`, [contactId]);
    if (!r.rows[0]) {
      const items = DEFAULT_ITEMS.map(i => ({ ...i, completed: false, completed_at: null }));
      r = await pool.query(`INSERT INTO client_onboarding (contact_id, items) VALUES ($1,$2) RETURNING *`, [contactId, JSON.stringify(items)]);
    }
    const row = r.rows[0];
    const items = (row.items || []).map(i =>
      i.id === itemId ? { ...i, completed: !!completed, completed_at: completed ? new Date().toISOString() : null } : i
    );
    const updated = await pool.query(
      `UPDATE client_onboarding SET items=$1, updated_at=NOW() WHERE contact_id=$2 RETURNING *`,
      [JSON.stringify(items), contactId]
    );
    res.json({ ok: true, onboarding: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { obtener, toggleItem, addItem, obtenerPublico, toggleItemPublico };
