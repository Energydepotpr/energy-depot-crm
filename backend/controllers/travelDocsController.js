'use strict';
const { pool } = require('../services/db');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS travel_documents (
      id           SERIAL PRIMARY KEY,
      contact_id   INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      type         VARCHAR(50) NOT NULL DEFAULT 'passport',
      holder_name  VARCHAR(200),
      doc_number   VARCHAR(100),
      country      VARCHAR(100),
      expiry_date  DATE,
      notes        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /api/contacts/:contactId/travel-docs
async function listar(req, res) {
  const contactId = parseInt(req.params.contactId, 10);
  if (isNaN(contactId)) return res.status(400).json({ error: 'ID inválido' });
  try {
    await ensureTable();
    const r = await pool.query(
      `SELECT * FROM travel_documents WHERE contact_id = $1 ORDER BY expiry_date ASC NULLS LAST`,
      [contactId]
    );
    res.json({ ok: true, docs: r.rows });
  } catch (err) {
    console.error('[TRAVEL_DOCS listar]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// POST /api/contacts/:contactId/travel-docs
async function crear(req, res) {
  const contactId = parseInt(req.params.contactId, 10);
  if (isNaN(contactId)) return res.status(400).json({ error: 'ID inválido' });
  const { type, holder_name, doc_number, country, expiry_date, notes } = req.body;
  try {
    await ensureTable();
    const r = await pool.query(
      `INSERT INTO travel_documents (contact_id, type, holder_name, doc_number, country, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [contactId, type || 'passport', holder_name || null, doc_number || null,
       country || null, expiry_date || null, notes || null]
    );
    res.json({ ok: true, doc: r.rows[0] });
  } catch (err) {
    console.error('[TRAVEL_DOCS crear]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// PATCH /api/contacts/:contactId/travel-docs/:docId
async function actualizar(req, res) {
  const { contactId, docId } = req.params;
  const { type, holder_name, doc_number, country, expiry_date, notes } = req.body;
  try {
    const r = await pool.query(
      `UPDATE travel_documents
       SET type=$1, holder_name=$2, doc_number=$3, country=$4, expiry_date=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 AND contact_id=$8
       RETURNING *`,
      [type, holder_name || null, doc_number || null, country || null,
       expiry_date || null, notes || null, docId, contactId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ ok: true, doc: r.rows[0] });
  } catch (err) {
    console.error('[TRAVEL_DOCS actualizar]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// DELETE /api/contacts/:contactId/travel-docs/:docId
async function eliminar(req, res) {
  const { contactId, docId } = req.params;
  try {
    await pool.query(
      `DELETE FROM travel_documents WHERE id=$1 AND contact_id=$2`,
      [docId, contactId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[TRAVEL_DOCS eliminar]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// GET /api/travel-docs/expiring — alert for passports expiring in <90 days (admin/system use)
async function expirandoPronto(req, res) {
  try {
    await ensureTable();
    const r = await pool.query(`
      SELECT td.*, c.name AS contact_name, c.phone AS contact_phone
      FROM travel_documents td
      JOIN contacts c ON c.id = td.contact_id
      WHERE td.expiry_date IS NOT NULL
        AND td.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
      ORDER BY td.expiry_date ASC
    `);
    res.json({ ok: true, docs: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { listar, crear, actualizar, eliminar, expirandoPronto };
