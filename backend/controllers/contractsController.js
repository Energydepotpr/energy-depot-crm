const { pool } = require('../services/db');

// List all contracts with contact/lead name joined
async function listar(req, res) {
  try {
    const { search = '', status = '' } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (ct.title ILIKE $${params.length} OR c.name ILIKE $${params.length} OR l.title ILIKE $${params.length})`;
    }
    if (status) {
      params.push(status);
      where += ` AND ct.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
        ct.id,
        ct.title,
        ct.contact_id,
        ct.lead_id,
        ct.notes,
        ct.file_name,
        ct.file_size,
        ct.signed_at,
        ct.status,
        ct.created_by,
        ct.created_at,
        ct.updated_at,
        c.name AS contact_name,
        l.title AS lead_title,
        u.name AS created_by_name
       FROM contracts ct
       LEFT JOIN contacts c ON c.id = ct.contact_id
       LEFT JOIN leads l ON l.id = ct.lead_id
       LEFT JOIN users u ON u.id = ct.created_by
       ${where}
       ORDER BY ct.created_at DESC`,
      params
    );

    res.json({ contracts: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[CONTRACTS listar]', err.message);
    res.status(500).json({ error: 'Error obteniendo contratos' });
  }
}

// Get single contract (includes file_base64)
async function obtener(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        ct.*,
        c.name AS contact_name,
        l.title AS lead_title,
        u.name AS created_by_name
       FROM contracts ct
       LEFT JOIN contacts c ON c.id = ct.contact_id
       LEFT JOIN leads l ON l.id = ct.lead_id
       LEFT JOIN users u ON u.id = ct.created_by
       WHERE ct.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Create contract
// Body: { title, contact_id, lead_id, notes, file_base64, file_name, file_size, signed_at, status }
async function crear(req, res) {
  try {
    const {
      title,
      contact_id,
      lead_id,
      notes,
      file_base64,
      file_name,
      file_size,
      signed_at,
      status = 'pending',
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title requerido' });

    const created_by = req.user?.id || null;

    const result = await pool.query(
      `INSERT INTO contracts
        (title, contact_id, lead_id, notes, file_base64, file_name, file_size, signed_at, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, title, contact_id, lead_id, notes, file_name, file_size, signed_at, status, created_by, created_at, updated_at`,
      [
        title,
        contact_id || null,
        lead_id || null,
        notes || null,
        file_base64 || null,
        file_name || null,
        file_size || null,
        signed_at || null,
        status,
        created_by,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CONTRACTS crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Update contract
async function actualizar(req, res) {
  try {
    const {
      title,
      contact_id,
      lead_id,
      notes,
      file_base64,
      file_name,
      file_size,
      signed_at,
      status,
    } = req.body;

    // Build dynamic update to avoid overwriting file_base64 when not provided
    const fields = [];
    const params = [];

    const set = (col, val) => {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    };

    if (title      !== undefined) set('title',       title);
    if (contact_id !== undefined) set('contact_id',  contact_id || null);
    if (lead_id    !== undefined) set('lead_id',     lead_id || null);
    if (notes      !== undefined) set('notes',       notes || null);
    if (status     !== undefined) set('status',      status);
    if (signed_at  !== undefined) set('signed_at',   signed_at || null);
    if (file_name  !== undefined) set('file_name',   file_name || null);
    if (file_size  !== undefined) set('file_size',   file_size || null);
    if (file_base64 !== undefined) set('file_base64', file_base64 || null);

    if (fields.length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

    params.push(req.params.id);
    fields.push('updated_at = NOW()');

    const result = await pool.query(
      `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, title, contact_id, lead_id, notes, file_name, file_size, signed_at, status, created_by, created_at, updated_at`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[CONTRACTS actualizar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Delete contract
async function eliminar(req, res) {
  try {
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Download contract — returns the full row including file_base64
async function descargar(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, title, file_base64, file_name, file_size FROM contracts WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contrato no encontrado' });
    const contract = result.rows[0];
    if (!contract.file_base64) return res.status(404).json({ error: 'Este contrato no tiene archivo adjunto' });
    res.json({ file_base64: contract.file_base64, file_name: contract.file_name });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, descargar };
