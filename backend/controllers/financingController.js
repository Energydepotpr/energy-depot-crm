'use strict';
const { pool } = require('../services/db');
const { getConfigValue } = require('../services/configService');

// ─── Auto-ensure table (idempotente) ──────────────────────────────────────────
let _ensured = false;
async function ensureFinancingTable() {
  if (_ensured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_financing_docs (
        id SERIAL PRIMARY KEY,
        lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        doc_key VARCHAR(50) NOT NULL,
        filename VARCHAR(255),
        mime_type VARCHAR(80),
        file_base64 TEXT,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        uploaded_by INT,
        UNIQUE(lead_id, doc_key)
      );
      CREATE INDEX IF NOT EXISTS idx_lfd_lead ON lead_financing_docs(lead_id);
    `);
    _ensured = true;
  } catch (e) { console.error('[financing] ensure table:', e.message); }
}
ensureFinancingTable();

const DOC_KEYS = ['solicitud', 'id', 'ss', 'luma', 'talonarios', 'carta_empleo', 'escrituras'];

// ─── GET /api/leads/:id/financing-docs ────────────────────────────────────────
async function listDocs(req, res) {
  try {
    await ensureFinancingTable();
    const r = await pool.query(
      `SELECT doc_key, filename, mime_type, uploaded_at, uploaded_by
         FROM lead_financing_docs WHERE lead_id = $1 ORDER BY uploaded_at ASC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('[financing list]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── POST /api/leads/:id/financing-docs ───────────────────────────────────────
async function uploadDoc(req, res) {
  try {
    await ensureFinancingTable();
    const { doc_key, filename, mime_type, base64 } = req.body || {};
    if (!doc_key || !DOC_KEYS.includes(doc_key)) {
      return res.status(400).json({ error: 'doc_key inválido' });
    }
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'base64 requerido' });
    }
    const userId = req.user?.id || null;
    const r = await pool.query(
      `INSERT INTO lead_financing_docs (lead_id, doc_key, filename, mime_type, file_base64, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (lead_id, doc_key)
       DO UPDATE SET filename = EXCLUDED.filename,
                     mime_type = EXCLUDED.mime_type,
                     file_base64 = EXCLUDED.file_base64,
                     uploaded_by = EXCLUDED.uploaded_by,
                     uploaded_at = NOW()
       RETURNING doc_key, filename, mime_type, uploaded_at`,
      [req.params.id, doc_key, filename || `${doc_key}.pdf`, mime_type || 'application/octet-stream', base64, userId]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error('[financing upload]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── GET /api/leads/:id/financing-docs/:doc_key/file ──────────────────────────
async function getFile(req, res) {
  try {
    const r = await pool.query(
      `SELECT filename, mime_type, file_base64 FROM lead_financing_docs
        WHERE lead_id = $1 AND doc_key = $2 LIMIT 1`,
      [req.params.id, req.params.doc_key]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json({ filename: r.rows[0].filename, mime: r.rows[0].mime_type, base64: r.rows[0].file_base64 });
  } catch (e) {
    console.error('[financing getFile]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── DELETE /api/leads/:id/financing-docs/:doc_key ────────────────────────────
async function deleteDoc(req, res) {
  try {
    const r = await pool.query(
      `DELETE FROM lead_financing_docs WHERE lead_id = $1 AND doc_key = $2 RETURNING id`,
      [req.params.id, req.params.doc_key]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[financing delete]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── POST /api/leads/:id/financing/send ───────────────────────────────────────
async function sendToCoop(req, res) {
  try {
    await ensureFinancingTable();
    const leadId = req.params.id;
    const { cooperativa, emails, message, move_stage } = req.body || {};
    if (!cooperativa) return res.status(400).json({ error: 'cooperativa requerida' });
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails requerido' });
    }

    // Cargar docs (con base64 para adjuntar)
    const docsR = await pool.query(
      `SELECT doc_key, filename, mime_type, file_base64
         FROM lead_financing_docs WHERE lead_id = $1`,
      [leadId]
    );
    if (docsR.rows.length < 7) {
      return res.status(400).json({ error: `Faltan documentos (${docsR.rows.length}/7)` });
    }

    // Cargar lead
    const leadR = await pool.query(
      `SELECT l.id, l.title, l.pipeline_id, c.name AS contact_name
         FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
        WHERE l.id = $1`,
      [leadId]
    );
    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = leadR.rows[0];
    const clientName = lead.contact_name || lead.title || 'Cliente';

    // Construir attachments
    const attachments = docsR.rows.map(d => ({
      filename: d.filename || `${d.doc_key}.pdf`,
      mimeType: d.mime_type || 'application/octet-stream',
      content: d.file_base64,
    }));

    // BCC
    const bcc = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');

    const subject = `Solicitud de financiamiento - ${clientName} - Energy Depot`;
    const bodyText = message?.trim() ||
      `Buenas tardes, adjuntamos los documentos de solicitud de financiamiento para nuestro cliente ${clientName}. ` +
      `Cualquier información adicional, no duden en contactarnos. Saludos, Energy Depot LLC. (787) 627-8585`;

    // Enviar email
    try {
      const { sendEmail } = require('../services/gmailService');
      await sendEmail({
        from: '"Energy Depot LLC" <info@energydepotpr.com>',
        to: emails,
        bcc: bcc || undefined,
        subject,
        text: bodyText,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:20px;color:#1f2937;line-height:1.6;">
          <p>${bodyText.replace(/\n/g, '<br>')}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;">
          <div style="font-size:12px;color:#6b7280;">Energy Depot LLC · (787) 627-8585 · info@energydepotpr.com</div>
        </div>`,
        attachments,
      });
    } catch (e) {
      console.error('[financing send email]', e.message);
      return res.status(500).json({ error: 'No se pudo enviar el email: ' + e.message });
    }

    // Crear nota
    const fecha = new Date().toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' });
    const notaText = `📤 Solicitud enviada a ${cooperativa} (${emails.join(', ')}) el ${fecha}`;
    try {
      await pool.query(
        `INSERT INTO notes (lead_id, content) VALUES ($1, $2)`,
        [leadId, notaText]
      );
    } catch (e) { console.error('[financing note]', e.message); }

    // Mover stage si pedido
    let movedStage = null;
    if (move_stage) {
      try {
        const stR = await pool.query(
          `SELECT id, name FROM pipeline_stages
            WHERE pipeline_id = $1 AND LOWER(name) LIKE '%financiamiento%'
            ORDER BY position LIMIT 1`,
          [lead.pipeline_id]
        );
        if (stR.rows[0]) {
          await pool.query(
            `UPDATE leads SET stage_id = $1, updated_at = NOW() WHERE id = $2`,
            [stR.rows[0].id, leadId]
          );
          movedStage = stR.rows[0].name;
        }
      } catch (e) { console.error('[financing move stage]', e.message); }
    }

    // Alert
    try {
      await pool.query(
        `INSERT INTO alerts (title, message, lead_id, seen, type) VALUES ($1,$2,$3,false,'info')`,
        ['📤 Solicitud enviada', `${clientName} → ${cooperativa}`, leadId]
      );
    } catch (e) { console.error('[financing alert]', e.message); }

    // Push
    try {
      const { sendToAll } = require('./pushController');
      sendToAll('📤 Solicitud enviada', `${clientName} → ${cooperativa}`, `/leads?id=${leadId}`);
    } catch (e) { console.error('[financing push]', e.message); }

    res.json({ ok: true, sent_to: emails, cooperativa, moved_stage: movedStage });
  } catch (e) {
    console.error('[financing send]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = {
  listDocs,
  uploadDoc,
  getFile,
  deleteDoc,
  sendToCoop,
  DOC_KEYS,
};
