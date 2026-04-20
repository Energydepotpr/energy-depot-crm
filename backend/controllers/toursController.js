'use strict';
const { pool } = require('../services/db');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS website_tours (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      slug        VARCHAR(255) UNIQUE NOT NULL,
      price       NUMERIC(10,2) DEFAULT 0,
      duration    VARCHAR(100),
      location    VARCHAR(255),
      rating      NUMERIC(3,1) DEFAULT 5,
      rating_count INTEGER DEFAULT 0,
      age         VARCHAR(50),
      image       TEXT,
      gallery     JSONB DEFAULT '[]',
      category    VARCHAR(100),
      description TEXT,
      highlights  JSONB DEFAULT '[]',
      experience  TEXT,
      included    JSONB DEFAULT '[]',
      not_included JSONB DEFAULT '[]',
      featured    BOOLEAN DEFAULT false,
      item_code   VARCHAR(100),
      fareharbor_item_id TEXT,
      active      BOOLEAN DEFAULT true,
      sort_order  INTEGER DEFAULT 0,
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )
  `);
}

// Migration: widen fareharbor_item_id to TEXT
pool.query(`ALTER TABLE website_tours ALTER COLUMN fareharbor_item_id TYPE TEXT`).catch(() => {});

// GET /api/public/tours  — público, para el sitio web
async function listarPublico(req, res) {
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM website_tours WHERE active = true ORDER BY sort_order ASC, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[TOURS] listarPublico:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// GET /api/public/tours/:slug — público
async function obtenerPublico(req, res) {
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM website_tours WHERE slug = $1 AND active = true`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tour no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[TOURS] obtenerPublico:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// GET /api/tours — admin
async function listar(req, res) {
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM website_tours ORDER BY sort_order ASC, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[TOURS] listar:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// POST /api/tours — crear
async function crear(req, res) {
  try {
    await ensureTable();
    const {
      name, slug, price, duration, location, rating, rating_count, age,
      image, gallery, category, description, highlights, experience,
      included, not_included, featured, item_code, fareharbor_item_id,
      active, sort_order
    } = req.body;

    if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });

    const { rows } = await pool.query(
      `INSERT INTO website_tours
        (name, slug, price, duration, location, rating, rating_count, age,
         image, gallery, category, description, highlights, experience,
         included, not_included, featured, item_code, fareharbor_item_id, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        name, slug, price || 0, duration || '', location || '', rating || 5, rating_count || 0, age || '',
        image || '', JSON.stringify(gallery || []), category || '', description || '',
        JSON.stringify(highlights || []), experience || '',
        JSON.stringify(included || []), JSON.stringify(not_included || []),
        featured || false, item_code || '', fareharbor_item_id || '',
        active !== false, sort_order || 0
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un tour con ese slug' });
    console.error('[TOURS] crear:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// PATCH /api/tours/:id — partial update (only provided fields)
async function actualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const body = req.body;

    // Build SET clause dynamically from provided fields
    const allowed = [
      'name','slug','price','duration','location','rating','rating_count','age',
      'image','gallery','category','description','highlights','experience',
      'included','not_included','featured','item_code','fareharbor_item_id',
      'active','sort_order'
    ];
    const jsonFields = new Set(['gallery','highlights','included','not_included']);

    const sets = [];
    const vals = [];
    let idx = 1;
    for (const field of allowed) {
      if (!(field in body)) continue;
      let val = body[field];
      if (jsonFields.has(field) && typeof val !== 'string') val = JSON.stringify(val);
      sets.push(`${field}=$${idx++}`);
      vals.push(val);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    sets.push(`updated_at=NOW()`);
    vals.push(id);

    const { rows } = await pool.query(
      `UPDATE website_tours SET ${sets.join(', ')} WHERE id=$${idx} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tour no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[TOURS] actualizar:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// DELETE /api/tours/:id
async function eliminar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(`DELETE FROM website_tours WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TOURS] eliminar:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// POST /api/tours/seed — importar tours desde el archivo estático (una sola vez)
async function seed(req, res) {
  try {
    await ensureTable();
    const tours = req.body.tours;
    if (!Array.isArray(tours)) return res.status(400).json({ error: 'Se esperaba un array de tours' });

    let inserted = 0;
    for (const t of tours) {
      await pool.query(
        `INSERT INTO website_tours
          (name, slug, price, duration, location, rating, rating_count, age,
           image, gallery, category, description, highlights, experience,
           included, not_included, featured, item_code, fareharbor_item_id, active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (slug) DO NOTHING`,
        [
          t.name, t.slug, t.price || 0, t.duration || '', t.location || '',
          t.rating || 5, t.ratingCount || 0, t.age || '',
          t.image || '', JSON.stringify(t.gallery || []), t.category || '',
          t.description || '', JSON.stringify(t.highlights || []), t.experience || '',
          JSON.stringify(t.included || []), JSON.stringify(t.notIncluded || []),
          t.featured || false, t.itemCode || '', t.fareHarborItemId || '',
          true, 0
        ]
      ).catch(() => {});
      inserted++;
    }
    res.json({ ok: true, inserted });
  } catch (err) {
    console.error('[TOURS] seed:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { listar, listarPublico, obtenerPublico, crear, actualizar, eliminar, seed };
