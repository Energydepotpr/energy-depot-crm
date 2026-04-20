'use strict';
const { pool } = require('../services/db');

// ─── Auto-create tables ──────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id           SERIAL PRIMARY KEY,
      name         VARCHAR(255) NOT NULL,
      subject      VARCHAR(500) NOT NULL,
      body_html    TEXT,
      body_text    TEXT,
      segment_id   INTEGER REFERENCES segments(id) ON DELETE SET NULL,
      status       VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','scheduled','sending','sent','failed')),
      scheduled_at TIMESTAMP,
      sent_at      TIMESTAMP,
      sent_count   INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_sends (
      id          SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_id  INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      email       VARCHAR(255) NOT NULL,
      status      VARCHAR(10) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed','bounced')),
      sent_at     TIMESTAMP,
      error       TEXT
    )
  `).catch(() => {});
}
ensureTables();

// ─── Helper: get SendGrid config ─────────────────────────────────────────────
async function getSendGridConfig() {
  try {
    const { rows } = await pool.query(
      `SELECT config FROM integrations WHERE provider='sendgrid' AND is_active=true LIMIT 1`
    );
    if (!rows[0]) return null;
    const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
    return config?.api_key ? config : null;
  } catch {
    return null;
  }
}

// ─── Helper: build segment filter WHERE clause ───────────────────────────────
function buildFilterQuery(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.source) {
    if (filters.source === 'manual') {
      conditions.push(`(source IS NULL OR source = 'manual')`);
    } else {
      params.push(filters.source);
      conditions.push(`source = $${params.length}`);
    }
  }

  if (filters.has_email === true || filters.has_email === 'true') {
    conditions.push(`(email IS NOT NULL AND email != '')`);
  } else if (filters.has_email === false || filters.has_email === 'false') {
    conditions.push(`(email IS NULL OR email = '')`);
  }

  if (filters.has_phone === true || filters.has_phone === 'true') {
    conditions.push(`(phone IS NOT NULL AND phone != '')`);
  } else if (filters.has_phone === false || filters.has_phone === 'false') {
    conditions.push(`(phone IS NULL OR phone = '')`);
  }

  if (filters.created_after) {
    params.push(filters.created_after);
    conditions.push(`created_at >= $${params.length}::timestamptz`);
  }

  if (filters.created_before) {
    params.push(filters.created_before);
    conditions.push(`created_at <= $${params.length}::timestamptz`);
  }

  if (filters.tag) {
    params.push(`%${filters.tag}%`);
    conditions.push(`(tags ILIKE $${params.length} OR tags::text ILIKE $${params.length})`);
  }

  if (filters.city) {
    params.push(`%${filters.city}%`);
    conditions.push(`city ILIKE $${params.length}`);
  }

  if (filters.company) {
    params.push(`%${filters.company}%`);
    conditions.push(`company ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// ─── Helper: send one email via SendGrid ─────────────────────────────────────
async function sendViaSendGrid(apiKey, fromEmail, fromName, toEmail, subject, html, text) {
  const content = [];
  if (text) content.push({ type: 'text/plain', value: text });
  if (html) content.push({ type: 'text/html', value: html });
  if (content.length === 0) content.push({ type: 'text/plain', value: subject });

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content,
    }),
  });
  if (!res.ok && res.status !== 202) {
    const errText = await res.text().catch(() => res.status.toString());
    throw new Error(`SendGrid ${res.status}: ${errText}`);
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

async function listar(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.subject, c.status, c.scheduled_at, c.sent_at,
             c.sent_count, c.failed_count, c.created_at,
             s.name AS segment_name,
             c.segment_id
      FROM campaigns c
      LEFT JOIN segments s ON s.id = c.segment_id
      ORDER BY c.created_at DESC
    `);
    res.json({ ok: true, campaigns: rows });
  } catch (err) {
    console.error('[CAMPAIGNS listar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function obtener(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
      SELECT c.*, s.name AS segment_name, s.filters AS segment_filters
      FROM campaigns c
      LEFT JOIN segments s ON s.id = c.segment_id
      WHERE c.id = $1
    `, [id]);

    if (!rows[0]) return res.status(404).json({ error: 'Campaña no encontrada' });
    res.json({ ok: true, campaign: rows[0] });
  } catch (err) {
    console.error('[CAMPAIGNS obtener]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crear(req, res) {
  try {
    const { name, subject, body_html, body_text, segment_id, scheduled_at } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name requerido' });
    if (!subject || !subject.trim()) return res.status(400).json({ error: 'subject requerido' });

    const { rows } = await pool.query(
      `INSERT INTO campaigns (name, subject, body_html, body_text, segment_id, status, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7) RETURNING *`,
      [
        name.trim(),
        subject.trim(),
        body_html || null,
        body_text || null,
        segment_id || null,
        scheduled_at || null,
        req.user?.id || null,
      ]
    );

    res.json({ ok: true, campaign: rows[0] });
  } catch (err) {
    console.error('[CAMPAIGNS crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT * FROM campaigns WHERE id=$1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (existing.rows[0].status !== 'draft') {
      return res.status(409).json({ error: 'Solo se pueden editar campañas en estado draft' });
    }

    const { name, subject, body_html, body_text, segment_id, scheduled_at } = req.body;
    const c = existing.rows[0];

    const { rows } = await pool.query(
      `UPDATE campaigns SET
         name         = COALESCE($1, name),
         subject      = COALESCE($2, subject),
         body_html    = COALESCE($3, body_html),
         body_text    = COALESCE($4, body_text),
         segment_id   = COALESCE($5, segment_id),
         scheduled_at = COALESCE($6, scheduled_at)
       WHERE id = $7 RETURNING *`,
      [
        name?.trim() || null,
        subject?.trim() || null,
        body_html !== undefined ? body_html : null,
        body_text !== undefined ? body_text : null,
        segment_id !== undefined ? segment_id : null,
        scheduled_at !== undefined ? scheduled_at : null,
        id,
      ]
    );

    res.json({ ok: true, campaign: rows[0] });
  } catch (err) {
    console.error('[CAMPAIGNS actualizar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT status FROM campaigns WHERE id=$1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (existing.rows[0].status !== 'draft') {
      return res.status(409).json({ error: 'Solo se pueden eliminar campañas en estado draft' });
    }

    await pool.query(`DELETE FROM campaigns WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[CAMPAIGNS eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function enviar(req, res) {
  const { id } = req.params;
  let campaign;

  try {
    // 1. Load campaign and validate status
    const campRow = await pool.query(`SELECT * FROM campaigns WHERE id=$1`, [id]);
    if (!campRow.rows[0]) return res.status(404).json({ error: 'Campaña no encontrada' });
    campaign = campRow.rows[0];

    if (!['draft', 'failed'].includes(campaign.status)) {
      return res.status(409).json({ error: `No se puede enviar: estado actual es '${campaign.status}'` });
    }

    if (!campaign.segment_id) {
      return res.status(400).json({ error: 'La campaña no tiene un segmento asignado' });
    }

    // 2. Load segment and its contacts (must have email)
    const segRow = await pool.query(`SELECT * FROM segments WHERE id=$1`, [campaign.segment_id]);
    if (!segRow.rows[0]) return res.status(404).json({ error: 'Segmento del campaña no encontrado' });

    const filters = segRow.rows[0].filters || {};
    const { where, params: filterParams } = buildFilterQuery({
      ...filters,
      has_email: true, // override: campaigns require email
    });

    const contactsRow = await pool.query(
      `SELECT id, name, email FROM contacts ${where} ORDER BY id ASC`,
      filterParams
    );
    const contacts = contactsRow.rows;

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'El segmento no tiene contactos con email' });
    }

    // 3. Mark as 'sending'
    await pool.query(`UPDATE campaigns SET status='sending' WHERE id=$1`, [id]);

    // 4. Insert campaign_sends records (clear old ones if retry)
    await pool.query(`DELETE FROM campaign_sends WHERE campaign_id=$1 AND status='pending'`, [id]);
    const insertValues = contacts
      .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}, 'pending')`)
      .join(', ');
    const insertParams = [id, ...contacts.flatMap(c => [c.id, c.email])];
    await pool.query(
      `INSERT INTO campaign_sends (campaign_id, contact_id, email, status) VALUES ${insertValues}`,
      insertParams
    );

    // 5. Respond immediately — sending happens async
    res.json({ ok: true, message: `Enviando a ${contacts.length} contactos...`, total: contacts.length });

    // 6. Send emails in the background
    const sgConfig = await getSendGridConfig();
    const fromEmail = process.env.FROM_EMAIL || 'noreply@crm.com';
    const fromName = 'CRM';
    let sentCount = 0;
    let failedCount = 0;

    const BATCH_SIZE = 50;
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (contact) => {
        const sendRow = await pool.query(
          `SELECT id FROM campaign_sends WHERE campaign_id=$1 AND contact_id=$2 LIMIT 1`,
          [id, contact.id]
        );
        const sendId = sendRow.rows[0]?.id;

        try {
          if (sgConfig) {
            await sendViaSendGrid(
              sgConfig.api_key,
              fromEmail,
              fromName,
              contact.email,
              campaign.subject,
              campaign.body_html,
              campaign.body_text
            );
          }
          // If no SendGrid, simulate success (log only)
          if (!sgConfig) {
            console.log(`[CAMPAIGNS] Simulated send to ${contact.email} (no SendGrid configured)`);
          }

          if (sendId) {
            await pool.query(
              `UPDATE campaign_sends SET status='sent', sent_at=NOW() WHERE id=$1`,
              [sendId]
            );
          }
          sentCount++;
        } catch (sendErr) {
          console.warn(`[CAMPAIGNS] Failed to send to ${contact.email}:`, sendErr.message);
          if (sendId) {
            await pool.query(
              `UPDATE campaign_sends SET status='failed', error=$1 WHERE id=$2`,
              [sendErr.message, sendId]
            );
          }
          failedCount++;
        }
      }));
    }

    // 7. Update campaign final status
    const finalStatus = failedCount === contacts.length ? 'failed' : 'sent';
    await pool.query(
      `UPDATE campaigns SET status=$1, sent_at=NOW(), sent_count=$2, failed_count=$3 WHERE id=$4`,
      [finalStatus, sentCount, failedCount, id]
    );

    console.log(`[CAMPAIGNS] Campaign #${id} finished: ${sentCount} sent, ${failedCount} failed`);
  } catch (err) {
    console.error('[CAMPAIGNS enviar]', err.message);
    // Mark campaign as failed if something went wrong
    try {
      await pool.query(`UPDATE campaigns SET status='failed' WHERE id=$1`, [id]);
    } catch {}
    // Response already sent above, so only log
  }
}

async function stats(req, res) {
  try {
    const { id } = req.params;
    const campRow = await pool.query(`SELECT * FROM campaigns WHERE id=$1`, [id]);
    if (!campRow.rows[0]) return res.status(404).json({ error: 'Campaña no encontrada' });

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')     AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')   AS failed,
        COUNT(*) FILTER (WHERE status = 'bounced')  AS bounced,
        COUNT(*)                                     AS total
      FROM campaign_sends
      WHERE campaign_id = $1
    `, [id]);

    const s = rows[0];
    res.json({
      ok: true,
      stats: {
        pending:  Number(s.pending),
        sent:     Number(s.sent),
        failed:   Number(s.failed),
        bounced:  Number(s.bounced),
        total:    Number(s.total),
      },
      campaign: campRow.rows[0],
    });
  } catch (err) {
    console.error('[CAMPAIGNS stats]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, enviar, stats };

/* ROUTES_TO_ADD_server.js
const campaigns = require('./controllers/campaignsController');
app.get('/api/campaigns',                campaigns.listar);
app.post('/api/campaigns',               campaigns.crear);
app.get('/api/campaigns/:id',            campaigns.obtener);
app.patch('/api/campaigns/:id',          campaigns.actualizar);
app.delete('/api/campaigns/:id',         campaigns.eliminar);
app.post('/api/campaigns/:id/send',      campaigns.enviar);
app.get('/api/campaigns/:id/stats',      campaigns.stats);
*/

/* API_METHODS_TO_ADD_api.js
// Campaigns
campaigns:            ()               => req('GET',    '/api/campaigns'),
campaign:             (id)             => req('GET',    `/api/campaigns/${id}`),
createCampaign:       (data)           => req('POST',   '/api/campaigns', data),
updateCampaign:       (id, data)       => req('PATCH',  `/api/campaigns/${id}`, data),
deleteCampaign:       (id)             => req('DELETE', `/api/campaigns/${id}`),
sendCampaign:         (id)             => req('POST',   `/api/campaigns/${id}/send`),
campaignStats:        (id)             => req('GET',    `/api/campaigns/${id}/stats`),
*/
