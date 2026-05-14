'use strict';
const { pool } = require('../services/db');
const { getConfigValue } = require('../services/configService');

// Ensure emails table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      from_name VARCHAR(255),
      from_email VARCHAR(255),
      to_email VARCHAR(255),
      subject VARCHAR(500),
      body TEXT,
      body_html TEXT,
      direction VARCHAR(10) DEFAULT 'outbound',
      read BOOLEAN DEFAULT false,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      account VARCHAR(255),
      message_id VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  // Add columns if upgrading from old schema
  await pool.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS body_html TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS account VARCHAR(255)`).catch(() => {});
  await pool.query(`ALTER TABLE emails ADD COLUMN IF NOT EXISTS message_id VARCHAR(500)`).catch(() => {});
}
ensureTable();

// ─── SMTP config ──────────────────────────────────────────────────────────────
function getSmtpConfig(account) {
  // account: 'operations' | 'bookings'
  const base = {
    host: process.env.MAIL_HOST || 'mail.fixatrippr.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: false,
    tls: { rejectUnauthorized: false },
  };
  if (account === 'bookings') {
    return {
      ...base,
      auth: {
        user: process.env.BOOKINGS_EMAIL || 'bookings@fixatrippr.com',
        pass: process.env.BOOKINGS_PASS || '',
      },
    };
  }
  return {
    ...base,
    auth: {
      user: process.env.OPERATIONS_EMAIL || 'operations@fixatrippr.com',
      pass: process.env.OPERATIONS_PASS || '',
    },
  };
}

function getImapConfig(account) {
  if (account === 'bookings') {
    return {
      host: process.env.MAIL_HOST || 'mail.fixatrippr.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      secure: true,
      tls: { rejectUnauthorized: false },
      auth: {
        user: process.env.BOOKINGS_EMAIL || 'bookings@fixatrippr.com',
        pass: process.env.BOOKINGS_PASS || '',
      },
    };
  }
  return {
    host: process.env.MAIL_HOST || 'mail.fixatrippr.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: true,
    tls: { rejectUnauthorized: false },
    auth: {
      user: process.env.OPERATIONS_EMAIL || 'operations@fixatrippr.com',
      pass: process.env.OPERATIONS_PASS || '',
    },
  };
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { direction = '', page = 1, lead_id, contact_id, account } = req.query;
    const offset = (Number(page) - 1) * 30;
    const conditions = [];
    const params = [];

    if (direction) { params.push(direction); conditions.push(`e.direction = $${params.length}`); }
    if (lead_id)   { params.push(lead_id);   conditions.push(`e.lead_id = $${params.length}`); }
    if (contact_id){ params.push(contact_id); conditions.push(`e.contact_id = $${params.length}`); }
    if (account)   { params.push(account);   conditions.push(`e.account = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(30, offset);

    const { rows } = await pool.query(
      `SELECT e.*, c.name AS contact_name
       FROM emails e
       LEFT JOIN contacts c ON c.id = e.contact_id
       ${where}
       ORDER BY e.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ ok: true, emails: rows });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── SEND (Gmail API via Service Account) ────────────────────────────────────
async function enviar(req, res) {
  try {
    const { to_email, cc, bcc, subject, body, body_html, contact_id, lead_id, attachments } = req.body;
    if (!to_email || !subject || (!body && !body_html)) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    const agentId = req.user?.id;
    const fromEmail = 'info@energydepotpr.com';
    const fromName  = 'Energy Depot LLC';

    let sent = false;
    let sendError = null;
    let messageId = null;

    try {
      const { sendEmail } = require('../services/gmailService');
      const atts = Array.isArray(attachments)
        ? attachments
            .filter((a) => a && a.content)
            .map((a) => ({
              filename: a.filename || 'attachment',
              mimeType: a.mimeType || 'application/octet-stream',
              content: a.content, // base64 string
            }))
        : [];

      const AUTO_BCC = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');
      const bccList = bcc
        ? (Array.isArray(bcc) ? [...bcc, AUTO_BCC] : [bcc, AUTO_BCC])
        : AUTO_BCC;

      const result = await sendEmail({
        from: `"${fromName}" <${fromEmail}>`,
        to: to_email,
        cc: cc || undefined,
        bcc: bccList,
        subject,
        text: body || undefined,
        html: body_html || undefined,
        attachments: atts,
      });
      sent = true;
      messageId = result.id;
    } catch (e) {
      sendError = e.message;
      console.error('[Email] Gmail API error:', e.message);
    }

    // Save to DB
    const { rows } = await pool.query(
      `INSERT INTO emails (from_name, from_email, to_email, subject, body, body_html, direction, read, contact_id, lead_id, agent_id, account, message_id)
       VALUES ($1,$2,$3,$4,$5,$6,'outbound',true,$7,$8,$9,$10,$11) RETURNING *`,
      [fromName, fromEmail, to_email, subject, body || null, body_html || null,
       contact_id || null, lead_id || null, agentId, 'gmail', messageId]
    );

    if (!sent) return res.status(500).json({ ok: false, error: sendError, email: rows[0] });
    res.json({ ok: true, email: rows[0], sent, message_id: messageId });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
  }
}

// ─── SYNC via Gmail API ───────────────────────────────────────────────────────
async function sincronizar(req, res) {
  const USER = 'info@energydepotpr.com';
  try {
    const { listMessages, getMessage } = require('../services/gmailService');

    // Load contacts for email matching
    const contactsMap = {};
    const contactsRows = await pool.query(`SELECT id, email FROM contacts WHERE email IS NOT NULL`).catch(() => ({ rows: [] }));
    contactsRows.rows.forEach(r => { if (r.email) contactsMap[r.email.toLowerCase()] = r.id; });

    let savedInbox = 0;
    let savedSent = 0;

    async function syncLabel(labelId, direction) {
      const ids = await listMessages({ user: USER, labelId, sinceDays: 30, max: 100 });
      if (ids.length === 0) return 0;

      // Pre-check which gmail ids are already saved
      const existing = await pool.query(
        `SELECT message_id FROM emails WHERE message_id = ANY($1)`,
        [ids]
      ).catch(() => ({ rows: [] }));
      const known = new Set(existing.rows.map(r => r.message_id));

      let count = 0;
      for (const id of ids) {
        if (known.has(id)) continue;
        try {
          const m = await getMessage({ user: USER, messageId: id });
          const contactEmail = (direction === 'inbound' ? m.fromEmail : m.toEmail || '').toLowerCase();
          const contactId = contactsMap[contactEmail] || null;

          const ins = await pool.query(
            `INSERT INTO emails (from_name, from_email, to_email, subject, body, body_html, direction, read, contact_id, account, message_id, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT DO NOTHING RETURNING id`,
            [m.fromName, m.fromEmail, m.toEmail, m.subject,
             (m.text || '').substring(0, 5000), m.html,
             direction, direction === 'outbound', contactId,
             'gmail', id, m.date]
          );
          if (ins.rows.length > 0) {
            count++;
            if (direction === 'inbound') {
              // Buscar lead asociado al contacto (si existe) para deep-link en la alert
              let leadIdForAlert = null;
              if (contactId) {
                try {
                  const lr = await pool.query(
                    `SELECT id FROM leads WHERE contact_id=$1 ORDER BY updated_at DESC LIMIT 1`,
                    [contactId]
                  );
                  leadIdForAlert = lr.rows[0]?.id || null;
                } catch (_) {}
              }
              if (leadIdForAlert) {
                // Dispara helper compartido (dedup 5min + skip si remitente es agente)
                const { notifyClientContact } = require('./webhookController');
                notifyClientContact({
                  leadId: leadIdForAlert,
                  channel: 'email',
                  contactName: m.fromName || m.fromEmail,
                  preview: `${m.subject || ''} — ${(m.text || '').slice(0, 100)}`,
                  contactEmail: (m.fromEmail || '').toLowerCase(),
                }).catch(() => {});
              } else {
                await pool.query(
                  `INSERT INTO alerts (title, message, seen, type) VALUES ($1,$2,false,'info')`,
                  [`Nuevo correo (info@energydepotpr.com)`, `De: ${m.fromName || m.fromEmail} — ${m.subject}`]
                ).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.warn('[Gmail] msg', id, e.message);
        }
      }
      return count;
    }

    savedInbox = await syncLabel('INBOX', 'inbound');
    savedSent = await syncLabel('SENT', 'outbound');

    res.json({ ok: true, saved: savedInbox + savedSent, inbox: savedInbox, sent: savedSent });
    return;
  } catch (err) {
    console.error('[Gmail sync]', err.message);
    return res.status(500).json({ error: 'Error sincronizando: ' + err.message });
  }

}

// ─── MARK READ ────────────────────────────────────────────────────────────────
async function marcarLeido(req, res) {
  try {
    await pool.query('UPDATE emails SET read=true WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function eliminar(req, res) {
  try {
    await pool.query('DELETE FROM emails WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, enviar, marcarLeido, eliminar, sincronizar };
