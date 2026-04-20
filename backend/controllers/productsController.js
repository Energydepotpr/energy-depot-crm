'use strict';
const { pool } = require('../services/db');

// ── Auto-create tabla products ────────────────────────────────────────────────
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      price       NUMERIC(12,2) NOT NULL DEFAULT 0,
      category    VARCHAR(100),
      unit        VARCHAR(50),
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

ensureTable().catch(err => console.error('[products] ensureTable error:', err.message));

// ── listar ────────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { search = '', category = '', is_active = '' } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length} OR category ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (is_active !== '') {
      params.push(is_active === 'true' || is_active === '1');
      conditions.push(`is_active = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT * FROM products ${where} ORDER BY name ASC`,
      params
    );

    res.json({ products: rows, total: rows.length });
  } catch (err) {
    console.error('[products listar]', err.message);
    res.status(500).json({ error: 'Error obteniendo productos' });
  }
}

// ── crear ─────────────────────────────────────────────────────────────────────
async function crear(req, res) {
  try {
    const { name, description, price, category, unit } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'name es requerido' });
    if (price === undefined || price === null || price === '') return res.status(400).json({ error: 'price es requerido' });

    const { rows } = await pool.query(
      `INSERT INTO products (name, description, price, category, unit)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), description || null, Number(price), category || null, unit || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[products crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── actualizar ────────────────────────────────────────────────────────────────
async function actualizar(req, res) {
  try {
    const { name, description, price, category, unit, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE products SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        price       = COALESCE($3, price),
        category    = COALESCE($4, category),
        unit        = COALESCE($5, unit),
        is_active   = COALESCE($6, is_active),
        updated_at  = NOW()
       WHERE id = $7 RETURNING *`,
      [
        name        ? name.trim()   : null,
        description !== undefined   ? description  : null,
        price       !== undefined   ? Number(price): null,
        category    !== undefined   ? category     : null,
        unit        !== undefined   ? unit         : null,
        is_active   !== undefined   ? Boolean(is_active) : null,
        req.params.id
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[products actualizar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── eliminar (soft delete) ────────────────────────────────────────────────────
async function eliminar(req, res) {
  try {
    const { rows } = await pool.query(
      `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[products eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── listarCategorias ──────────────────────────────────────────────────────────
async function listarCategorias(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`
    );
    res.json({ categories: rows.map(r => r.category) });
  } catch (err) {
    console.error('[products listarCategorias]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, actualizar, eliminar, listarCategorias };

/* ROUTES_TO_ADD_server.js
const products = require('./controllers/productsController');
app.get('/api/products/categories', products.listarCategorias);
app.get('/api/products',            products.listar);
app.post('/api/products',           products.crear);
app.patch('/api/products/:id',      products.actualizar);
app.delete('/api/products/:id',     products.eliminar);
*/

/* API_METHODS_TO_ADD_api.js
products:           (params = '') => req('GET',    `/api/products${params}`),
productCategories:  ()            => req('GET',    '/api/products/categories'),
createProduct:      (data)        => req('POST',   '/api/products', data),
updateProduct:      (id, data)    => req('PATCH',  `/api/products/${id}`, data),
deleteProduct:      (id)          => req('DELETE', `/api/products/${id}`),
*/
