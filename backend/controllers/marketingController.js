'use strict';
const { pool } = require('../services/db');

// Tablas
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      channel VARCHAR(50),
      start_date DATE,
      end_date DATE,
      budget NUMERIC(12,2) DEFAULT 0,
      total_spent NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_files (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
      file_base64 TEXT NOT NULL,
      file_name VARCHAR(255),
      mime_type VARCHAR(100),
      file_size INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS marketing_campaign_id INTEGER`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_marketing_campaign ON leads(marketing_campaign_id)`).catch(() => {});
}
ensureTables();

// ─── LIST campaigns con stats ───────────────────────────────────────────────
async function list(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT mc.*,
        (SELECT COUNT(*)::int FROM leads l WHERE l.marketing_campaign_id = mc.id) AS leads_count,
        (SELECT COALESCE(SUM(l.value),0)::float FROM leads l
          INNER JOIN pipeline_stages s ON s.id = l.stage_id
          WHERE l.marketing_campaign_id = mc.id
            AND (s.name ILIKE '%ganado%' OR s.name ILIKE '%cerrado%' OR s.name ILIKE '%complet%' OR s.name ILIKE '%instal%')
        ) AS revenue,
        (SELECT COUNT(*)::int FROM leads l
          INNER JOIN pipeline_stages s ON s.id = l.stage_id
          WHERE l.marketing_campaign_id = mc.id
            AND (s.name ILIKE '%ganado%' OR s.name ILIKE '%cerrado%' OR s.name ILIKE '%complet%' OR s.name ILIKE '%instal%')
        ) AS sales_count
      FROM marketing_campaigns mc
      ORDER BY mc.created_at DESC
    `);
    res.json({ ok: true, campaigns: rows });
  } catch (err) {
    console.error('[marketing list]', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function getOne(req, res) {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(`SELECT * FROM marketing_campaigns WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Campaña no encontrada' });
    const filesR = await pool.query(`
      SELECT id, file_name, mime_type, file_size, notes, created_at
      FROM marketing_files WHERE campaign_id = $1 ORDER BY created_at DESC
    `, [id]);
    const leadsR = await pool.query(`
      SELECT l.id, l.title, l.value, l.created_at, s.name AS stage_name, s.color AS stage_color, c.name AS contact_name
      FROM leads l
      LEFT JOIN pipeline_stages s ON s.id = l.stage_id
      LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE l.marketing_campaign_id = $1
      ORDER BY l.created_at DESC
    `, [id]);
    res.json({ ok: true, campaign: rows[0], files: filesR.rows, leads: leadsR.rows });
  } catch (err) {
    console.error('[marketing getOne]', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const { name, channel, start_date, end_date, budget, total_spent, notes, status } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });
    const { rows } = await pool.query(
      `INSERT INTO marketing_campaigns (name, channel, start_date, end_date, budget, total_spent, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'active')) RETURNING *`,
      [name, channel || null, start_date || null, end_date || null, Number(budget) || 0, Number(total_spent) || 0, notes || null, status]
    );
    res.json({ ok: true, campaign: rows[0] });
  } catch (err) {
    console.error('[marketing create]', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const { name, channel, start_date, end_date, budget, total_spent, notes, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE marketing_campaigns SET
        name = COALESCE($1, name),
        channel = COALESCE($2, channel),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        budget = COALESCE($5, budget),
        total_spent = COALESCE($6, total_spent),
        notes = COALESCE($7, notes),
        status = COALESCE($8, status),
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name || null, channel || null, start_date || null, end_date || null,
       budget !== undefined ? Number(budget) : null,
       total_spent !== undefined ? Number(total_spent) : null,
       notes || null, status || null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true, campaign: rows[0] });
  } catch (err) {
    console.error('[marketing update]', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function remove(req, res) {
  try {
    await pool.query(`DELETE FROM marketing_campaigns WHERE id = $1`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── FILES ──────────────────────────────────────────────────────────────────
async function uploadFile(req, res) {
  try {
    const campaignId = Number(req.params.id);
    const { file, notes } = req.body || {};
    if (!file?.content) return res.status(400).json({ error: 'file requerido' });
    const size = Math.round(file.content.length * 0.75);
    const { rows } = await pool.query(
      `INSERT INTO marketing_files (campaign_id, file_base64, file_name, mime_type, file_size, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, file_name, mime_type, file_size, notes, created_at`,
      [campaignId, file.content, file.name || 'archivo', file.mimeType || 'application/octet-stream', size, notes || null]
    );
    res.json({ ok: true, file: rows[0] });
  } catch (err) {
    console.error('[marketing uploadFile]', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function getFile(req, res) {
  try {
    const id = Number(req.params.fileId);
    const { rows } = await pool.query(`SELECT file_base64, mime_type, file_name FROM marketing_files WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.json({ ok: true, file: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteFile(req, res) {
  try {
    await pool.query(`DELETE FROM marketing_files WHERE id = $1`, [Number(req.params.fileId)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── DASHBOARD: totales ────────────────────────────────────────────────────
async function dashboard(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(total_spent),0)::float AS total_spent,
        COALESCE(SUM(budget),0)::float AS total_budget,
        COUNT(*)::int AS campaign_count
      FROM marketing_campaigns
    `);
    const leadsR = await pool.query(`SELECT COUNT(*)::int AS leads_attributed FROM leads WHERE marketing_campaign_id IS NOT NULL`);
    const revR = await pool.query(`
      SELECT COALESCE(SUM(l.value),0)::float AS revenue,
        COUNT(*)::int AS sales_count
      FROM leads l
      INNER JOIN pipeline_stages s ON s.id = l.stage_id
      WHERE l.marketing_campaign_id IS NOT NULL
        AND (s.name ILIKE '%ganado%' OR s.name ILIKE '%cerrado%' OR s.name ILIKE '%complet%' OR s.name ILIKE '%instal%')
    `);
    const totals = rows[0];
    const revenue = revR.rows[0].revenue;
    res.json({
      ok: true,
      total_spent: totals.total_spent,
      total_budget: totals.total_budget,
      campaign_count: totals.campaign_count,
      leads_attributed: leadsR.rows[0].leads_attributed,
      sales_count: revR.rows[0].sales_count,
      revenue,
      roi_pct: totals.total_spent > 0 ? Math.round(((revenue - totals.total_spent) / totals.total_spent) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, getOne, create, update, remove, uploadFile, getFile, deleteFile, dashboard };
