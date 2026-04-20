'use strict';
const { pool } = require('../services/db');

// ── Auto-create tabla suppliers ───────────────────────────────────────────────
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(200) NOT NULL,
      type           VARCHAR(50),
      country        VARCHAR(100),
      city           VARCHAR(100),
      contact_name   VARCHAR(150),
      phone          VARCHAR(50),
      email          VARCHAR(150),
      website        VARCHAR(200),
      rating         SMALLINT DEFAULT 0,
      commission_pct DECIMAL(5,2) DEFAULT 0,
      notes          TEXT,
      active         BOOLEAN DEFAULT true,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

ensureTable().catch(err => console.error('[suppliers] ensureTable error:', err.message));

// ── listar ────────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { type = '', search = '', active = '' } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR contact_name ILIKE $${params.length} OR city ILIKE $${params.length} OR country ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`);
    }
    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (active !== '') {
      params.push(active === 'true' || active === '1');
      conditions.push(`active = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT * FROM suppliers ${where} ORDER BY name ASC`,
      params
    );

    res.json({ suppliers: rows, total: rows.length });
  } catch (err) {
    console.error('[suppliers listar]', err.message);
    res.status(500).json({ error: 'Error obteniendo proveedores' });
  }
}

// ── obtener ───────────────────────────────────────────────────────────────────
async function obtener(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM suppliers WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[suppliers obtener]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── crear ─────────────────────────────────────────────────────────────────────
async function crear(req, res) {
  try {
    const {
      name, type, country, city, contact_name, phone,
      email, website, rating, commission_pct, notes, active,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El campo name es requerido' });
    }

    const { rows } = await pool.query(
      `INSERT INTO suppliers
         (name, type, country, city, contact_name, phone, email, website, rating, commission_pct, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        name.trim(),
        type        || null,
        country     || null,
        city        || null,
        contact_name|| null,
        phone       || null,
        email       || null,
        website     || null,
        rating      != null ? Number(rating) : 0,
        commission_pct != null ? Number(commission_pct) : 0,
        notes       || null,
        active !== undefined ? Boolean(active) : true,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[suppliers crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── actualizar ────────────────────────────────────────────────────────────────
async function actualizar(req, res) {
  try {
    const {
      name, type, country, city, contact_name, phone,
      email, website, rating, commission_pct, notes, active,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE suppliers SET
        name           = COALESCE($1, name),
        type           = COALESCE($2, type),
        country        = COALESCE($3, country),
        city           = COALESCE($4, city),
        contact_name   = COALESCE($5, contact_name),
        phone          = COALESCE($6, phone),
        email          = COALESCE($7, email),
        website        = COALESCE($8, website),
        rating         = COALESCE($9, rating),
        commission_pct = COALESCE($10, commission_pct),
        notes          = COALESCE($11, notes),
        active         = COALESCE($12, active),
        updated_at     = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        name        ? name.trim()            : null,
        type        !== undefined ? type      : null,
        country     !== undefined ? country   : null,
        city        !== undefined ? city      : null,
        contact_name!== undefined ? contact_name : null,
        phone       !== undefined ? phone     : null,
        email       !== undefined ? email     : null,
        website     !== undefined ? website   : null,
        rating      != null ? Number(rating)  : null,
        commission_pct != null ? Number(commission_pct) : null,
        notes       !== undefined ? notes     : null,
        active      !== undefined ? Boolean(active) : null,
        req.params.id,
      ]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[suppliers actualizar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── eliminar (soft delete) ────────────────────────────────────────────────────
async function eliminar(req, res) {
  try {
    const { rows } = await pool.query(
      `UPDATE suppliers SET active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('[suppliers eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
