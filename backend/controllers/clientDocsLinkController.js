'use strict';
// Public link para que el cliente suba documentos de financiamiento desde su celular,
// sin necesidad de loguearse en el CRM. Token único por lead, persistido en
// `client_doc_tokens (token, lead_id)`.

const crypto = require('crypto');
const { pool } = require('../services/db');
const { getConfigValue } = require('../services/configService');

const DEFAULT_COOPS = require('./financingController').DEFAULT_COOPS;

let _ensured = false;
async function ensureTokensTable() {
  if (_ensured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_doc_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cdt_lead ON client_doc_tokens(lead_id);
    `);
    // Tabla lead_financing_docs ya la asegura financingController; igual la garantizamos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_financing_docs (
        id SERIAL PRIMARY KEY,
        lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        doc_key VARCHAR(80) NOT NULL,
        filename VARCHAR(255),
        mime_type VARCHAR(80),
        file_base64 TEXT,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        uploaded_by INT,
        cooperativa VARCHAR(80) DEFAULT '',
        etapa_id VARCHAR(40) DEFAULT ''
      );
    `);
    _ensured = true;
  } catch (e) { console.error('[client_doc_tokens] ensure:', e.message); }
}

function deriveToken(leadId) {
  const SECRET = process.env.PUBLIC_LEAD_SECRET || 'energy-depot-public-2026';
  return crypto.createHash('sha256').update(`client-docs-${leadId}-${SECRET}`).digest('hex').slice(0, 40);
}

function publicBaseUrl(req) {
  // Preferimos FRONTEND_URL (donde corre el Next.js público); si tiene varios, usamos el primero
  const fe = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean)[0];
  if (fe) return fe.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

// ─── GET /api/leads/:id/financing/client-link (auth) ─────────────────────────
async function getOrCreateLink(req, res) {
  try {
    await ensureTokensTable();
    const leadId = Number(req.params.id);
    if (!leadId) return res.status(400).json({ error: 'lead id requerido' });

    const leadR = await pool.query(`SELECT id FROM leads WHERE id=$1`, [leadId]);
    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });

    // Upsert: si ya existe token para el lead, devolverlo; sino crearlo (determinístico)
    const exist = await pool.query(`SELECT token FROM client_doc_tokens WHERE lead_id=$1 LIMIT 1`, [leadId]);
    let token;
    if (exist.rows[0]) {
      token = exist.rows[0].token;
    } else {
      token = deriveToken(leadId);
      await pool.query(
        `INSERT INTO client_doc_tokens (token, lead_id) VALUES ($1, $2)
         ON CONFLICT (token) DO NOTHING`,
        [token, leadId]
      );
    }

    const url = `${publicBaseUrl(req)}/cliente/${token}`;
    res.json({ url, token });
  } catch (e) {
    console.error('[clientDocsLink getOrCreateLink]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function resolveLeadIdByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const r = await pool.query(
    `SELECT lead_id, expires_at FROM client_doc_tokens WHERE token=$1 LIMIT 1`,
    [token]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row.lead_id;
}

async function getCoopsFromConfig() {
  let raw;
  try { raw = await getConfigValue('cooperativas', null); } catch { raw = null; }
  let arr = null;
  try { if (raw) arr = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { arr = null; }
  if (!Array.isArray(arr) || !arr.length) return JSON.parse(JSON.stringify(DEFAULT_COOPS));
  return arr;
}

// ─── GET /api/public/client-docs/:token ──────────────────────────────────────
async function getPublic(req, res) {
  try {
    await ensureTokensTable();
    const leadId = await resolveLeadIdByToken(req.params.token);
    if (!leadId) return res.status(404).json({ error: 'Link inválido o expirado' });

    const leadR = await pool.query(
      `SELECT l.id, l.title, l.solar_data, c.name AS contact_name
         FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
        WHERE l.id=$1`, [leadId]
    );
    const lead = leadR.rows[0];
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const sd = lead.solar_data || {};
    const coopName = sd.financing_coop || '';
    const coops = await getCoopsFromConfig();
    const coop = coops.find(c => c.name === coopName) || null;

    if (!coopName || !coop) {
      return res.json({
        leadName: lead.contact_name || lead.title || 'Cliente',
        cooperativa: '',
        etapas: [],
        notReady: true,
      });
    }

    // Docs ya subidos (todas las etapas)
    const docsR = await pool.query(
      `SELECT etapa_id, doc_key, filename, uploaded_at
         FROM lead_financing_docs
        WHERE lead_id=$1 AND cooperativa=$2`,
      [leadId, coopName]
    );
    const uploadedMap = {};
    for (const d of docsR.rows) {
      uploadedMap[`${d.etapa_id}::${d.doc_key}`] = { filename: d.filename, uploaded_at: d.uploaded_at };
    }

    // Solicitud firmada electrónicamente cuenta como "subida" para doc_key 'solicitud'
    let hasSignedLoanApp = false;
    try {
      const la = await pool.query(
        `SELECT 1 FROM loan_applications WHERE lead_id=$1 AND signed_at IS NOT NULL LIMIT 1`,
        [leadId]
      );
      hasSignedLoanApp = la.rows.length > 0;
    } catch {}

    const etapas = (coop.etapas || []).map(e => ({
      id: e.id,
      name: e.name,
      docs: (e.docs || []).map(d => {
        const up = uploadedMap[`${e.id}::${d.key}`] || (d.key === 'solicitud' && hasSignedLoanApp ? { filename: 'solicitud-firmada.pdf', uploaded_at: null } : null);
        return {
          key: d.key,
          label: d.label,
          uploaded: !!up,
          filename: up?.filename || null,
        };
      }),
    }));

    res.json({
      leadName: lead.contact_name || lead.title || 'Cliente',
      cooperativa: coopName,
      etapas,
    });
  } catch (e) {
    console.error('[clientDocsLink getPublic]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── POST /api/public/client-docs/:token ─────────────────────────────────────
// body: { etapa_id, doc_key, filename, mime_type, base64 }
async function uploadPublic(req, res) {
  try {
    await ensureTokensTable();
    const leadId = await resolveLeadIdByToken(req.params.token);
    if (!leadId) return res.status(404).json({ error: 'Link inválido o expirado' });

    const { doc_key, filename, mime_type, base64 } = req.body || {};
    let etapa_id = String(req.body?.etapa_id || '');
    if (!doc_key || typeof doc_key !== 'string') return res.status(400).json({ error: 'doc_key requerido' });
    if (!base64 || typeof base64 !== 'string')  return res.status(400).json({ error: 'base64 requerido' });

    // Limitar tamaño (~8MB en base64 ≈ 6MB binario)
    if (base64.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Archivo demasiado grande (máx ~6MB). Toma una foto de menor calidad.' });
    }

    // Resolver cooperativa activa del lead
    const leadR = await pool.query(`SELECT solar_data FROM leads WHERE id=$1`, [leadId]);
    const sd = leadR.rows[0]?.solar_data || {};
    const cooperativa = String(sd.financing_coop || '');
    if (!cooperativa) {
      return res.status(400).json({ error: 'El asesor todavía no eligió cooperativa. Espera a que te confirme antes de subir documentos.' });
    }

    // Si no vino etapa_id, asumir primera etapa que contenga ese doc_key
    if (!etapa_id) {
      const coops = await getCoopsFromConfig();
      const coop = coops.find(c => c.name === cooperativa);
      const et = (coop?.etapas || []).find(e => (e.docs || []).some(d => d.key === doc_key));
      etapa_id = et?.id || 'etapa1';
    }

    await pool.query(
      `INSERT INTO lead_financing_docs (lead_id, cooperativa, etapa_id, doc_key, filename, mime_type, file_base64, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (lead_id, cooperativa, etapa_id, doc_key)
       DO UPDATE SET filename = EXCLUDED.filename,
                     mime_type = EXCLUDED.mime_type,
                     file_base64 = EXCLUDED.file_base64,
                     uploaded_at = NOW()`,
      [leadId, cooperativa, etapa_id, doc_key, filename || `${doc_key}.jpg`, mime_type || 'application/octet-stream', base64]
    );

    // Nota interna + alerta
    try {
      await pool.query(`INSERT INTO notes (lead_id, content) VALUES ($1, $2)`,
        [leadId, `📲 Cliente subió documento "${doc_key}" desde link público (${cooperativa} / ${etapa_id})`]);
    } catch {}
    try {
      await pool.query(
        `INSERT INTO alerts (title, message, lead_id, seen, type) VALUES ($1,$2,$3,false,'info')`,
        ['📲 Cliente subió documento', `${doc_key} → ${cooperativa}`, leadId]
      );
    } catch {}

    res.json({ ok: true });
  } catch (e) {
    console.error('[clientDocsLink uploadPublic]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { getOrCreateLink, getPublic, uploadPublic };
