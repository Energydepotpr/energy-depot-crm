const { pool } = require('../services/db');

// Helper: generate field_name from label
function toFieldName(label) {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

async function listar(req, res) {
  try {
    const { entity_type = 'lead' } = req.query;
    const result = await pool.query(
      `SELECT * FROM custom_fields WHERE entity_type = $1 ORDER BY position ASC, id ASC`,
      [entity_type]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[CUSTOM_FIELDS listar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crear(req, res) {
  try {
    const { entity_type = 'lead', field_label, field_type = 'text', options = [] } = req.body;
    if (!field_label) return res.status(400).json({ error: 'field_label requerido' });

    const field_name = toFieldName(field_label);
    if (!field_name) return res.status(400).json({ error: 'field_label inválido' });

    // Get max position
    const posR = await pool.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM custom_fields WHERE entity_type = $1`,
      [entity_type]
    );
    const position = posR.rows[0].next_pos;

    const result = await pool.query(
      `INSERT INTO custom_fields (entity_type, field_name, field_label, field_type, options, position)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [entity_type, field_name, field_label, field_type, JSON.stringify(options), position]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CUSTOM_FIELDS crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminar(req, res) {
  try {
    await pool.query('DELETE FROM custom_fields WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CUSTOM_FIELDS eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getValues(req, res) {
  try {
    const { entity_type, entity_id } = req.params;
    const result = await pool.query(
      `SELECT cf.id AS field_id, cf.field_label, cf.field_type, cf.options, cfv.value
       FROM custom_fields cf
       LEFT JOIN custom_field_values cfv ON cfv.field_id = cf.id AND cfv.entity_id = $1
       WHERE cf.entity_type = $2
       ORDER BY cf.position ASC, cf.id ASC`,
      [entity_id, entity_type]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[CUSTOM_FIELDS getValues]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function saveValues(req, res) {
  try {
    const { entity_type, entity_id } = req.params;
    const { values = {} } = req.body; // { field_id: value }

    for (const [field_id, value] of Object.entries(values)) {
      await pool.query(
        `INSERT INTO custom_field_values (field_id, entity_id, value, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (field_id, entity_id) DO UPDATE SET value = $3, updated_at = NOW()`,
        [field_id, entity_id, value !== null && value !== undefined ? String(value) : null]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[CUSTOM_FIELDS saveValues]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, eliminar, getValues, saveValues };
