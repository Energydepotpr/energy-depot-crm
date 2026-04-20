'use strict';
const { pool } = require('../services/db');

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

// ─── SEND ─────────────────────────────────────────────────────────────────────
async function enviar(req, res) {
  try {
    const { to_email, subject, body, body_html, contact_id, lead_id, account = 'operations' } = req.body;
    if (!to_email || !subject || (!body && !body_html)) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    const agentId = req.user?.id;
    const smtpCfg = getSmtpConfig(account);
    const fromEmail = smtpCfg.auth.user;
    const fromName  = account === 'bookings' ? 'Fix A Trip Bookings' : 'Fix A Trip Operations';

    let sent = false;
    let sendError = null;

    // Try SMTP first
    if (smtpCfg.auth.pass) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport(smtpCfg);
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: to_email,
          subject,
          text: body || undefined,
          html: body_html || undefined,
        });
        sent = true;
      } catch (e) {
        sendError = e.message;
        console.warn('[Email] SMTP error:', e.message);
      }
    }

    // Fallback: try SendGrid
    if (!sent) {
      try {
        const { rows: cfg } = await pool.query(
          `SELECT config FROM integrations WHERE id='sendgrid' AND is_active=true LIMIT 1`
        );
        if (cfg.length > 0) {
          const config = typeof cfg[0].config === 'string' ? JSON.parse(cfg[0].config) : cfg[0].config;
          const apiKey = config?.api_key;
          if (apiKey) {
            const content = [];
            if (body)      content.push({ type: 'text/plain', value: body });
            if (body_html) content.push({ type: 'text/html',  value: body_html });
            const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: to_email }] }],
                from: { email: config.from_email || fromEmail, name: config.from_name || fromName },
                subject,
                content,
              }),
            });
            if (sgRes.ok || sgRes.status === 202) sent = true;
          }
        }
      } catch (e) {
        console.warn('[Email] SendGrid fallback error:', e.message);
      }
    }

    // Save to DB
    const { rows } = await pool.query(
      `INSERT INTO emails (from_name, from_email, to_email, subject, body, body_html, direction, read, contact_id, lead_id, agent_id, account)
       VALUES ($1,$2,$3,$4,$5,$6,'outbound',true,$7,$8,$9,$10) RETURNING *`,
      [fromName, fromEmail, to_email, subject, body || null, body_html || null,
       contact_id || null, lead_id || null, agentId, account]
    );

    res.json({ ok: true, email: rows[0], sent, send_error: sendError });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── SYNC (IMAP receive + sent) ───────────────────────────────────────────────
async function sincronizar(req, res) {
  const account = req.query.account || 'operations';
  const imapCfg = getImapConfig(account);

  if (!imapCfg.auth.pass) {
    return res.status(400).json({ error: `Sin contraseña configurada para ${account}` });
  }

  try {
    const { ImapFlow }     = require('imapflow');
    const { simpleParser } = require('mailparser');
    const client = new ImapFlow({ ...imapCfg, logger: false });

    await client.connect();

    let savedInbox = 0;
    let savedSent  = 0;

    // Helper: sync one mailbox folder (fast: only last 30 days, batch dedup check)
    async function syncFolder(folderName, direction) {
      let lock;
      try {
        lock = await client.getMailboxLock(folderName);
      } catch (e) {
        console.warn(`[IMAP] folder "${folderName}" not found:`, e.message);
        return 0;
      }
      let count = 0;
      try {
        // Only fetch last 30 days
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const uids = await client.search({ since }, { uid: true });
        if (!uids || uids.length === 0) return 0;

        // Step 1: fetch envelopes only (fast, no body download)
        const envelopes = [];
        for await (const msg of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
          envelopes.push({ uid: msg.uid, messageId: msg.envelope?.messageId || null });
        }

        // Step 2: batch check which message_ids are already in DB
        const knownIds = new Set();
        const msgIds = envelopes.map(e => e.messageId).filter(Boolean);
        if (msgIds.length > 0) {
          const existing = await pool.query(
            `SELECT message_id FROM emails WHERE message_id = ANY($1)`, [msgIds]
          ).catch(() => ({ rows: [] }));
          existing.rows.forEach(r => knownIds.add(r.message_id));
        }

        // Step 3: only download source for new messages
        const newUids = envelopes
          .filter(e => !e.messageId || !knownIds.has(e.messageId))
          .map(e => e.uid);

        if (newUids.length === 0) return 0;

        // Batch-load all contacts emails for matching (avoid per-message queries)
        const contactsMap = {};
        const contactsRows = await pool.query(`SELECT id, email FROM contacts WHERE email IS NOT NULL`).catch(() => ({ rows: [] }));
        contactsRows.rows.forEach(r => { if (r.email) contactsMap[r.email.toLowerCase()] = r.id; });

        for await (const msg of client.fetch(newUids, { uid: true, source: true, envelope: true }, { uid: true })) {
          let parsed;
          try { parsed = await simpleParser(msg.source); }
          catch (e) { continue; }

          const messageId = msg.envelope?.messageId || parsed.messageId || null;
          if (messageId && knownIds.has(messageId)) continue;

          const fromAddr  = parsed.from?.value?.[0];
          const fromEmail = fromAddr?.address || '';
          const fromName  = fromAddr?.name    || fromEmail;
          const toAddr    = parsed.to?.value?.[0];
          const toEmail   = toAddr?.address   || imapCfg.auth.user;
          const subject   = parsed.subject    || '(sin asunto)';
          const date      = parsed.date       || new Date();
          const bodyText  = parsed.text       || '';
          const bodyHtml  = parsed.html       || null;
          const isRead    = direction === 'outbound';

          const contactEmail = (direction === 'inbound' ? fromEmail : toEmail).toLowerCase();
          const contactId    = contactsMap[contactEmail] || null;

          const insertResult = await pool.query(
            `INSERT INTO emails (from_name, from_email, to_email, subject, body, body_html, direction, read, contact_id, account, message_id, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT DO NOTHING RETURNING id`,
            [fromName, fromEmail, toEmail, subject, bodyText.substring(0, 5000), bodyHtml,
             direction, isRead, contactId, account, messageId, date]
          );

          if (insertResult.rows.length > 0 && direction === 'inbound') {
            const alertMsg = `De: ${fromName || fromEmail} — ${subject}`;
            await pool.query(
              `INSERT INTO alerts (title, message, seen, type) VALUES ($1,$2,false,'info')`,
              [`Nuevo correo (${account}@fixatrippr.com)`, alertMsg]
            ).catch(() => {});
          }
          if (messageId) knownIds.add(messageId);
          count++;
        }
      } finally {
        lock.release();
      }
      return count;
    }

    // Sync INBOX (inbound)
    savedInbox = await syncFolder('INBOX', 'inbound');

    // Sync Sent folder — try common folder names
    const sentFolders = ['Sent', 'Sent Messages', 'Sent Items', 'INBOX.Sent'];
    for (const folder of sentFolders) {
      try {
        const n = await syncFolder(folder, 'outbound');
        savedSent += n;
        if (n >= 0) break; // found a valid folder
      } catch (e) { /* try next */ }
    }

    await client.logout();
    res.json({ ok: true, saved: savedInbox + savedSent, inbox: savedInbox, sent: savedSent, account });
  } catch (err) {
    console.error('[IMAP]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
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
