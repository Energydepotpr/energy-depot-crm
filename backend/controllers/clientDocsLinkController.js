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
    try {
      await pool.query(`ALTER TABLE client_doc_tokens ADD COLUMN IF NOT EXISTS slug VARCHAR(80)`);
    } catch (e) { /* ignore */ }
    try {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_cdt_slug ON client_doc_tokens(slug) WHERE slug IS NOT NULL`);
    } catch (e) { /* ignore */ }
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
  const SECRET = process.env.PUBLIC_LEAD_SECRET;
  if (!SECRET) throw new Error('PUBLIC_LEAD_SECRET no configurado');
  return crypto.createHash('sha256').update(`client-docs-${leadId}-${SECRET}`).digest('hex').slice(0, 40);
}

function kebabCase(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cliente';
}

async function generateUniqueSlug(leadId, token) {
  const nameR = await pool.query(
    `SELECT c.name FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id WHERE l.id = $1`,
    [leadId]
  );
  const name = nameR.rows[0]?.name || `lead-${leadId}`;
  const base = kebabCase(name);
  const code = String(token).slice(0, 4).toUpperCase();
  let candidate = `${base}-${code}`;
  let n = 2;
  // Garantizar unicidad (no choca con otro lead)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await pool.query(
      `SELECT lead_id FROM client_doc_tokens WHERE slug=$1 LIMIT 1`,
      [candidate]
    );
    if (!r.rows[0] || r.rows[0].lead_id === leadId) return candidate;
    candidate = `${base}-${code}-${n++}`;
    if (n > 50) return `${base}-${code}-${Date.now().toString(36)}`;
  }
}

function publicBaseUrl(req) {
  // Dominio público canónico, preferido por encima de los vercel.app
  const FORCE = 'https://crm-energydepotpr.com';
  // Si FRONTEND_URL tiene el dominio bueno, usalo. Si no, forzar el canónico.
  const candidates = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
  const good = candidates.find(u => /crm-energydepotpr\.com/i.test(u));
  if (good) return good.replace(/\/$/, '');
  return FORCE;
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
    const exist = await pool.query(`SELECT token, slug FROM client_doc_tokens WHERE lead_id=$1 LIMIT 1`, [leadId]);
    let token, slug;
    if (exist.rows[0]) {
      token = exist.rows[0].token;
      slug  = exist.rows[0].slug;
    } else {
      token = deriveToken(leadId);
      await pool.query(
        `INSERT INTO client_doc_tokens (token, lead_id) VALUES ($1, $2)
         ON CONFLICT (token) DO NOTHING`,
        [token, leadId]
      );
    }

    if (!slug) {
      slug = await generateUniqueSlug(leadId, token);
      try {
        await pool.query(`UPDATE client_doc_tokens SET slug=$1 WHERE lead_id=$2`, [slug, leadId]);
      } catch (e) { console.error('[clientDocsLink slug update]', e.message); }
    }

    const url = `${publicBaseUrl(req)}/cliente/${slug}`;
    res.json({ url, token, slug });
  } catch (e) {
    console.error('[clientDocsLink getOrCreateLink]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function resolveLeadIdByToken(tokenOrSlug) {
  if (!tokenOrSlug || typeof tokenOrSlug !== 'string') return null;
  // Probar slug primero, luego token
  let r = await pool.query(
    `SELECT lead_id, expires_at FROM client_doc_tokens WHERE slug=$1 LIMIT 1`,
    [tokenOrSlug]
  );
  if (!r.rows[0]) {
    r = await pool.query(
      `SELECT lead_id, expires_at FROM client_doc_tokens WHERE token=$1 LIMIT 1`,
      [tokenOrSlug]
    );
  }
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

    // Orden lógico forzado para Etapa 1 (mismo que el CRM): cotización → contrato → solicitud → resto
    const ORDER_E1 = ['cotizacion', 'contrato', 'solicitud'];
    const sortDocs = (etapaId, docs) => {
      if (etapaId !== 'etapa1') return docs;
      const byKey = Object.fromEntries(docs.map(d => [d.key, d]));
      const head = ORDER_E1.filter(k => byKey[k]).map(k => byKey[k]);
      const rest = docs.filter(d => !ORDER_E1.includes(d.key));
      return [...head, ...rest];
    };

    // Si la cotización ya fue elegida (financing_cotizacion_id) cuenta como subida
    const hasPickedQuotation = !!(sd.financing_cotizacion_id || sd.activeQuotationId);
    const pickedQ = (Array.isArray(sd.quotations) ? sd.quotations : []).find(
      q => q.id === (sd.financing_cotizacion_id || sd.activeQuotationId)
    );

    let etapas = (coop.etapas || []).map(e => ({
      id: e.id,
      name: e.name,
      docs: sortDocs(e.id, (e.docs || []).map(d => {
        let up = uploadedMap[`${e.id}::${d.key}`]
          || (d.key === 'solicitud' && hasSignedLoanApp ? { filename: 'solicitud-firmada.pdf', uploaded_at: null } : null)
          || (d.key === 'cotizacion' && e.id === 'etapa1' && hasPickedQuotation
              ? { filename: `Cotización: ${pickedQ?.name || 'elegida'}`, uploaded_at: null } : null);
        return {
          key: d.key,
          label: d.label,
          uploaded: !!up,
          filename: up?.filename || null,
        };
      })),
    }));

    // Filtro opcional: ?etapa=etapaX limita la respuesta a esa etapa
    const onlyEtapa = String(req.query?.etapa || '').trim();
    if (onlyEtapa) {
      etapas = etapas.filter(e => e.id === onlyEtapa);
    }

    // Cotizaciones existentes del lead para que el cliente las elija desde el link
    const quotations = (Array.isArray(sd.quotations) ? sd.quotations : []).map(q => {
      const bats = (q.batteries || []).filter(b => b?.qty > 0)
        .map(b => `${b.qty > 1 ? b.qty + '× ' : ''}${b.name}`).join(' + ') || 'Sin batería';
      const fv = Number(q?.calc?.costBase) || Number(sd?.calc?.costBase) || 0;
      const batsTotal = (q.batteries || []).reduce((s, b) => s + (Number(b.unitPrice) || 0) * (Number(b.qty) || 0), 0);
      const total = Number(q?.calc?.sub) || (fv + batsTotal);
      return {
        id: q.id,
        name: q.name || `Cotización ${bats}`,
        batteries: bats,
        total: Math.round(total),
      };
    });
    const activeQuotationId = sd.activeQuotationId || sd.financing_cotizacion_id || null;

    res.json({
      leadName: lead.contact_name || lead.title || 'Cliente',
      cooperativa: coopName,
      etapas,
      quotations,
      activeQuotationId,
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

    // Borrar versión previa de ese doc (replace pattern, no requiere unique constraint)
    await pool.query(
      `DELETE FROM lead_financing_docs
        WHERE lead_id=$1 AND cooperativa=$2 AND etapa_id=$3 AND doc_key=$4`,
      [leadId, cooperativa, etapa_id, doc_key]
    );
    await pool.query(
      `INSERT INTO lead_financing_docs
         (lead_id, cooperativa, etapa_id, doc_key, filename, mime_type, file_base64, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
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

// ─── POST /api/leads/:id/financing/client-link/send-email ────────────────────
// body: { to, subject, message }
async function sendLinkByEmail(req, res) {
  try {
    await ensureTokensTable();
    const leadId = Number(req.params.id);
    if (!leadId) return res.status(400).json({ error: 'lead id requerido' });

    const { to, subject, message } = req.body || {};
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json({ error: 'Email destino inválido' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }
    const subj = (subject && String(subject).trim()) ||
      'Energy Depot — Sube tus documentos para tu financiamiento';

    // Asegurar que exista el link (genera token+slug si no hay)
    const leadR = await pool.query(`SELECT id FROM leads WHERE id=$1`, [leadId]);
    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });

    const exist = await pool.query(
      `SELECT token, slug FROM client_doc_tokens WHERE lead_id=$1 LIMIT 1`,
      [leadId]
    );
    let token, slug;
    if (exist.rows[0]) { token = exist.rows[0].token; slug = exist.rows[0].slug; }
    else {
      token = deriveToken(leadId);
      await pool.query(
        `INSERT INTO client_doc_tokens (token, lead_id) VALUES ($1, $2)
         ON CONFLICT (token) DO NOTHING`, [token, leadId]
      );
    }
    if (!slug) {
      slug = await generateUniqueSlug(leadId, token);
      try { await pool.query(`UPDATE client_doc_tokens SET slug=$1 WHERE lead_id=$2`, [slug, leadId]); } catch {}
    }
    const url = `${publicBaseUrl(req)}/cliente/${slug}`;

    const toAddr = String(to).trim();
    const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;padding:20px;color:#1f2937;line-height:1.6;">
        <p>${String(message).replace(/{{\s*link\s*}}/gi, url).replace(/\n/g, '<br>')}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;">
        <div style="font-size:12px;color:#6b7280;">Energy Depot LLC · (787) 627-8585 · info@energydepotpr.com</div>
      </div>`;
    const textBody = String(message).replace(/{{\s*link\s*}}/gi, url);

    try {
      const { sendEmail } = require('../services/gmailService');
      await sendEmail({
        from: '"Energy Depot LLC" <info@energydepotpr.com>',
        to: [toAddr],
        subject: subj,
        text: textBody,
        html: htmlBody,
      });
    } catch (e) {
      console.error('[clientDocsLink sendEmail]', e.message);
      return res.status(500).json({ error: 'No se pudo enviar el email: ' + e.message });
    }

    try {
      const fecha = new Date().toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' });
      await pool.query(
        `INSERT INTO notes (lead_id, content) VALUES ($1, $2)`,
        [leadId, `📧 Link de subir documentos enviado a ${toAddr} el ${fecha}`]
      );
    } catch (e) { console.error('[clientDocsLink note]', e.message); }

    res.json({ ok: true, url, slug });
  } catch (e) {
    console.error('[clientDocsLink sendLinkByEmail]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── POST /api/public/client-docs/:token/pick-quotation ──────────────────────
// body: { quotation_id }
async function pickQuotation(req, res) {
  try {
    await ensureTokensTable();
    const leadId = await resolveLeadIdByToken(req.params.token);
    if (!leadId) return res.status(404).json({ error: 'Link inválido o expirado' });
    const { quotation_id } = req.body || {};
    if (!quotation_id) return res.status(400).json({ error: 'quotation_id requerido' });

    // Validar que la quotation existe en el lead
    const r = await pool.query(`SELECT solar_data FROM leads WHERE id=$1`, [leadId]);
    const sd = r.rows[0]?.solar_data || {};
    const qs = Array.isArray(sd.quotations) ? sd.quotations : [];
    const q = qs.find(x => x.id === quotation_id);
    if (!q) return res.status(404).json({ error: 'Cotización no encontrada' });

    const newSd = { ...sd, activeQuotationId: quotation_id, financing_cotizacion_id: quotation_id };
    await pool.query(`UPDATE leads SET solar_data=$1, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify(newSd), leadId]);

    try {
      await pool.query(`INSERT INTO notes (lead_id, content) VALUES ($1, $2)`,
        [leadId, `📲 Cliente eligió cotización "${q.name || quotation_id}" desde link público`]);
    } catch {}

    res.json({ ok: true });
  } catch (e) {
    console.error('[clientDocsLink pickQuotation]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { getOrCreateLink, getPublic, uploadPublic, sendLinkByEmail, pickQuotation };
