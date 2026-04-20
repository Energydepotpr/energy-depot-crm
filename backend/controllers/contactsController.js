const { pool } = require('../services/db');

async function checkDuplicate(req, res) {
  try {
    const { phone, email } = req.query;
    if (!phone && !email) return res.json({ duplicate: false });

    if (phone && phone.trim()) {
      const r = await pool.query(
        `SELECT id, name FROM contacts WHERE phone = $1 AND phone IS NOT NULL AND phone != ''`,
        [phone.trim()]
      );
      if (r.rows[0]) return res.json({ duplicate: true, existing: { id: r.rows[0].id, name: r.rows[0].name } });
    }
    if (email && email.trim()) {
      const r = await pool.query(
        `SELECT id, name FROM contacts WHERE email = $1 AND email IS NOT NULL AND email != ''`,
        [email.trim()]
      );
      if (r.rows[0]) return res.json({ duplicate: true, existing: { id: r.rows[0].id, name: r.rows[0].name } });
    }
    res.json({ duplicate: false });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listar(req, res) {
  try {
    const { search = '', page = 1, source = '' } = req.query;
    const offset = (Number(page) - 1) * 50;

    const conditions = [];
    const params = [];

    if (search) {
      const s = `%${search}%`;
      params.push(s);
      conditions.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`);
    }
    if (source) {
      if (source === 'manual') {
        conditions.push(`(source IS NULL OR source = 'manual')`);
      } else {
        params.push(source);
        conditions.push(`source = $${params.length}`);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataParams  = [...params, 50, offset];
    const countParams = [...params];

    const [rows, count] = await Promise.all([
      pool.query(`SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`, dataParams),
      pool.query(`SELECT COUNT(*) FROM contacts ${where}`, countParams),
    ]);

    res.json({ contacts: rows.rows, total: Number(count.rows[0].count) });
  } catch (err) {
    console.error('[CONTACTS listar]', err.message);
    res.status(500).json({ error: 'Error obteniendo contactos' });
  }
}

async function obtener(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM leads l WHERE l.contact_id = c.id) AS leads_count
       FROM contacts c WHERE c.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crear(req, res) {
  try {
    const { name, phone, email, company, notes, force } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });

    if (!force) {
      if (phone && phone.trim()) {
        const r = await pool.query(
          `SELECT id, name FROM contacts WHERE phone = $1 AND phone IS NOT NULL AND phone != ''`,
          [phone.trim()]
        );
        if (r.rows[0]) {
          return res.status(409).json({
            error: 'duplicate',
            message: 'Ya existe un contacto con ese teléfono/email',
            existing: { id: r.rows[0].id, name: r.rows[0].name },
          });
        }
      }
      if (email && email.trim()) {
        const r = await pool.query(
          `SELECT id, name FROM contacts WHERE email = $1 AND email IS NOT NULL AND email != ''`,
          [email.trim()]
        );
        if (r.rows[0]) {
          return res.status(409).json({
            error: 'duplicate',
            message: 'Ya existe un contacto con ese teléfono/email',
            existing: { id: r.rows[0].id, name: r.rows[0].name },
          });
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO contacts (name, phone, email, company, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, phone || null, email || null, company || null, notes || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizar(req, res) {
  try {
    const { name, phone, email, company, notes } = req.body;
    const result = await pool.query(
      `UPDATE contacts SET
        name    = COALESCE($1, name),
        phone   = COALESCE($2, phone),
        email   = COALESCE($3, email),
        company = COALESCE($4, company),
        notes   = COALESCE($5, notes),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name || null, phone || null, email || null, company || null, notes || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminar(req, res) {
  try {
    const countR = await pool.query('SELECT COUNT(*) FROM leads WHERE contact_id = $1', [req.params.id]);
    const count = Number(countR.rows[0].count);
    if (count > 0) {
      return res.status(409).json({
        error: `Este contacto tiene ${count} lead${count !== 1 ? 's' : ''} activo${count !== 1 ? 's' : ''}. Elimínalos primero o reasígnalos.`,
        leads_count: count,
      });
    }
    await pool.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function findDuplicates(req, res) {
  try {
    // Contacts sharing same phone OR identical normalized name
    const r = await pool.query(`
      SELECT c1.id AS id1, c1.name AS name1, c1.phone AS phone1, c1.email AS email1,
             c2.id AS id2, c2.name AS name2, c2.phone AS phone2, c2.email AS email2,
             CASE
               WHEN TRIM(COALESCE(c1.phone,'')) != '' AND TRIM(c1.phone) = TRIM(c2.phone) THEN 'phone'
               ELSE 'name'
             END AS reason
      FROM contacts c1
      JOIN contacts c2 ON c1.id < c2.id
      WHERE (
        (TRIM(COALESCE(c1.phone,'')) != '' AND TRIM(c1.phone) = TRIM(c2.phone))
        OR LOWER(REGEXP_REPLACE(TRIM(c1.name), '\\s+', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM(c2.name), '\\s+', ' ', 'g'))
      )
      ORDER BY c1.name
      LIMIT 100
    `);
    res.json(r.rows);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function mergeContacts(req, res) {
  const client = await pool.connect();
  try {
    const { keep_id, discard_id } = req.body;
    if (!keep_id || !discard_id) return res.status(400).json({ error: 'keep_id y discard_id requeridos' });
    await client.query('BEGIN');
    // Move leads from discarded contact to kept contact
    await client.query(`UPDATE leads SET contact_id = $1 WHERE contact_id = $2`, [keep_id, discard_id]);
    // Delete discarded contact
    await client.query(`DELETE FROM contacts WHERE id = $1`, [discard_id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, checkDuplicate, findDuplicates, mergeContacts };
