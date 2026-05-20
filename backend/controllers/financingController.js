'use strict';
const { pool } = require('../services/db');
const { getConfigValue } = require('../services/configService');

// ─── Defaults por cooperativa (con etapas) ───────────────────────────────────
const VEGA_ETAPA1_DOCS = [
  { key: 'solicitud',                 label: 'Solicitud de préstamo llena y firmada' },
  { key: 'id',                        label: 'ID Vigente' },
  { key: 'ss',                        label: 'Tarjeta de Seguro Social' },
  { key: 'luma',                      label: 'Última factura de LUMA' },
  { key: 'talonarios',                label: 'Últimos 3 talonarios o estado bancario' },
  { key: 'carta_empleo',              label: 'Carta de empleo' },
  { key: 'escrituras',                label: 'Escrituras de la propiedad' },
  { key: 'cotizacion',                label: 'Cotización elegida' },
  { key: 'contrato',                  label: 'Contrato de compra-venta' },
  { key: 'factura_45',                label: 'Factura de 45% del precio total' },
  { key: 'autorizacion_desembolso',   label: 'Autorización de desembolso firmada' },
];
const VEGA_ETAPA2_DOCS = [
  { key: 'fotos_instalacion',         label: 'Fotos de instalación' },
  { key: 'serie_equipos',             label: 'Lista de números de serie de equipos' },
  { key: 'cert_instalacion',          label: 'Certificación de Instalación eléctrica' },
  { key: 'plano',                     label: 'Diseño de plano' },
  { key: 'poliza_seguro',             label: 'Póliza de seguros con Vega Coop como acreedor' },
  { key: 'autorizacion_desembolso_2', label: 'Autorización de desembolso firmada' },
];

const DEFAULT_COOPS = [
  {
    name: 'Vega Coop',
    emails: ['ldelgado@vegacoop.com', 'vguzman@vegacoop.com'],
    etapas: [
      { id: 'etapa1', name: 'Etapa 1 - Solicitud de préstamo', docs: VEGA_ETAPA1_DOCS },
      { id: 'etapa2', name: 'Etapa 2 - Instalación',           docs: VEGA_ETAPA2_DOCS },
    ],
  },
  {
    name: 'Tu Coop',
    emails: ['sfranco@tucooppr.com', 'jsuarez@tucooppr.com', 'lmatos@tucooppr.com'],
    etapas: [
      { id: 'etapa1', name: 'Etapa 1 - Solicitud de préstamo',
        docs: [
          { key: 'solicitud',               label: 'Solicitud de préstamo llena y firmada' },
          { key: 'id',                      label: 'ID Vigente' },
          { key: 'ss',                      label: 'Tarjeta de Seguro Social' },
          { key: 'luma',                    label: 'Última factura de LUMA' },
          { key: 'talonarios',              label: 'Últimos 3 talonarios o estado bancario' },
          { key: 'carta_empleo',            label: 'Carta de empleo' },
          { key: 'escrituras',              label: 'Escrituras de la propiedad' },
          { key: 'cotizacion',              label: 'Cotización elegida' },
          { key: 'contrato',                label: 'Contrato de compra-venta' },
          { key: 'factura_40',              label: 'Factura de 40% del precio total' },
          { key: 'autorizacion_desembolso', label: 'Autorización de desembolso firmada' },
        ] },
      { id: 'etapa2', name: 'Etapa 2 - Instalación',
        docs: [
          { key: 'fotos_instalacion',         label: 'Fotos de instalación' },
          { key: 'serie_equipos',             label: 'Lista de números de serie de equipos' },
          { key: 'cert_instalacion',          label: 'Certificación de Instalación eléctrica' },
          { key: 'plano',                     label: 'Diseño de plano' },
          { key: 'factura_50',                label: 'Factura de 50% del precio total' },
          { key: 'autorizacion_desembolso_2', label: 'Autorización de desembolso firmada' },
        ] },
      { id: 'etapa3', name: 'Etapa 3 - Certificación',
        docs: [
          { key: 'poliza_seguro',             label: 'Póliza de seguros con Tu Coop como acreedor' },
          { key: 'carta_pago_seguro',         label: 'Carta de pago de seguro' },
          { key: 'factura_10',                label: 'Factura de 10% del precio total' },
          { key: 'autorizacion_desembolso_3', label: 'Autorización de desembolso firmada' },
        ] },
    ],
  },
  {
    name: 'Coop Oriental',
    emails: ['lserrano@cooporiental.com'],
    etapas: [
      { id: 'etapa1', name: 'Etapa 1 - Solicitud de préstamo', docs: VEGA_ETAPA1_DOCS },
      { id: 'etapa2', name: 'Etapa 2 - Instalación',           docs: VEGA_ETAPA2_DOCS },
    ],
  },
];

function defaultsForName(name) {
  const d = DEFAULT_COOPS.find(c => c.name === name);
  if (d) return JSON.parse(JSON.stringify(d.etapas));
  // Fallback: estructura Vega
  return [
    { id: 'etapa1', name: 'Etapa 1 - Solicitud de préstamo', docs: VEGA_ETAPA1_DOCS },
    { id: 'etapa2', name: 'Etapa 2 - Instalación',           docs: VEGA_ETAPA2_DOCS },
  ];
}

function migrateCoop(c) {
  const next = { name: c.name || '', emails: Array.isArray(c.emails) ? c.emails : [] };
  if (Array.isArray(c.etapas) && c.etapas.length) {
    next.etapas = c.etapas.map(e => ({
      id: e.id || 'etapa1',
      name: e.name || 'Etapa',
      docs: Array.isArray(e.docs) ? e.docs.map(d => ({ key: String(d.key || ''), label: String(d.label || d.key || '') })) : [],
    }));
  } else {
    next.etapas = defaultsForName(c.name);
  }
  return next;
}

async function getCoopsFromConfig() {
  let raw;
  try { raw = await getConfigValue('cooperativas', null); } catch { raw = null; }
  let arr = null;
  try {
    if (raw) arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { arr = null; }
  if (!Array.isArray(arr) || !arr.length) return JSON.parse(JSON.stringify(DEFAULT_COOPS));
  return arr.map(migrateCoop);
}

async function saveCoopsToConfig(arr) {
  // Usar misma capa que /api/settings (set key=cooperativas)
  const { pool } = require('../services/db');
  const val = JSON.stringify(arr);
  await pool.query(
    `INSERT INTO config (key, value, updated_at) VALUES ('cooperativas', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [val]
  );
}

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
    // Migración a etapas/cooperativa
    try {
      await pool.query(`ALTER TABLE lead_financing_docs ADD COLUMN IF NOT EXISTS cooperativa VARCHAR(80) DEFAULT ''`);
    } catch (e) { /* ignore */ }
    try {
      await pool.query(`ALTER TABLE lead_financing_docs ADD COLUMN IF NOT EXISTS etapa_id VARCHAR(40) DEFAULT ''`);
    } catch (e) { /* ignore */ }
    // Permitir doc_key más largo
    try {
      await pool.query(`ALTER TABLE lead_financing_docs ALTER COLUMN doc_key TYPE VARCHAR(80)`);
    } catch (e) { /* ignore */ }
    // Drop unique viejo y crear nuevo
    try {
      await pool.query(`ALTER TABLE lead_financing_docs DROP CONSTRAINT IF EXISTS lead_financing_docs_lead_id_doc_key_key`);
    } catch (e) { /* ignore */ }
    try {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_lfd_lead_coop_etapa_doc
                        ON lead_financing_docs(lead_id, cooperativa, etapa_id, doc_key)`);
    } catch (e) { /* ignore */ }
    _ensured = true;
  } catch (e) { console.error('[financing] ensure table:', e.message); }
}

// ─── GET /api/cooperativas ────────────────────────────────────────────────────
async function listCoops(req, res) {
  try {
    const arr = await getCoopsFromConfig();
    res.json(arr);
  } catch (e) {
    console.error('[coops list]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── PUT /api/cooperativas ────────────────────────────────────────────────────
async function saveCoops(req, res) {
  try {
    const arr = Array.isArray(req.body) ? req.body : req.body?.cooperativas;
    if (!Array.isArray(arr)) return res.status(400).json({ error: 'Se espera array' });
    const clean = arr.map(migrateCoop);
    await saveCoopsToConfig(clean);
    res.json(clean);
  } catch (e) {
    console.error('[coops save]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── GET /api/leads/:id/financing-docs ────────────────────────────────────────
async function listDocs(req, res) {
  try {
    await ensureFinancingTable();
    const r = await pool.query(
      `SELECT cooperativa, etapa_id, doc_key, filename, mime_type, uploaded_at, uploaded_by
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
    const cooperativa = String(req.body?.cooperativa || '');
    const etapa_id = String(req.body?.etapa_id || '');
    if (!doc_key || typeof doc_key !== 'string') {
      return res.status(400).json({ error: 'doc_key requerido' });
    }
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'base64 requerido' });
    }
    const userId = req.user?.id || null;
    const r = await pool.query(
      `INSERT INTO lead_financing_docs (lead_id, cooperativa, etapa_id, doc_key, filename, mime_type, file_base64, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (lead_id, cooperativa, etapa_id, doc_key)
       DO UPDATE SET filename = EXCLUDED.filename,
                     mime_type = EXCLUDED.mime_type,
                     file_base64 = EXCLUDED.file_base64,
                     uploaded_by = EXCLUDED.uploaded_by,
                     uploaded_at = NOW()
       RETURNING cooperativa, etapa_id, doc_key, filename, mime_type, uploaded_at`,
      [req.params.id, cooperativa, etapa_id, doc_key, filename || `${doc_key}.pdf`, mime_type || 'application/octet-stream', base64, userId]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error('[financing upload]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── GET file (query params) ──────────────────────────────────────────────────
// GET /api/leads/:id/financing-docs/file?cooperativa=&etapa_id=&doc_key=
// Legacy GET /api/leads/:id/financing-docs/:doc_key/file
async function getFile(req, res) {
  try {
    const cooperativa = req.query.cooperativa != null ? String(req.query.cooperativa) : '';
    const etapa_id   = req.query.etapa_id   != null ? String(req.query.etapa_id)   : '';
    const doc_key    = req.query.doc_key || req.params.doc_key;
    if (!doc_key) return res.status(400).json({ error: 'doc_key requerido' });

    // Si vinieron filtros explícitos, usarlos; si no, fallback legacy (cualquier fila con ese doc_key)
    const usingFilters = (req.query.cooperativa != null) || (req.query.etapa_id != null);
    const sql = usingFilters
      ? `SELECT filename, mime_type, file_base64 FROM lead_financing_docs
           WHERE lead_id=$1 AND cooperativa=$2 AND etapa_id=$3 AND doc_key=$4 LIMIT 1`
      : `SELECT filename, mime_type, file_base64 FROM lead_financing_docs
           WHERE lead_id=$1 AND doc_key=$2 LIMIT 1`;
    const params = usingFilters ? [req.params.id, cooperativa, etapa_id, doc_key] : [req.params.id, doc_key];
    const r = await pool.query(sql, params);
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json({ filename: r.rows[0].filename, mime: r.rows[0].mime_type, base64: r.rows[0].file_base64 });
  } catch (e) {
    console.error('[financing getFile]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── DELETE doc (query params) ────────────────────────────────────────────────
// DELETE /api/leads/:id/financing-docs?cooperativa=&etapa_id=&doc_key=
// Legacy DELETE /api/leads/:id/financing-docs/:doc_key
async function deleteDoc(req, res) {
  try {
    const cooperativa = req.query.cooperativa != null ? String(req.query.cooperativa) : '';
    const etapa_id   = req.query.etapa_id   != null ? String(req.query.etapa_id)   : '';
    const doc_key    = req.query.doc_key || req.params.doc_key;
    if (!doc_key) return res.status(400).json({ error: 'doc_key requerido' });
    const usingFilters = (req.query.cooperativa != null) || (req.query.etapa_id != null);
    const sql = usingFilters
      ? `DELETE FROM lead_financing_docs WHERE lead_id=$1 AND cooperativa=$2 AND etapa_id=$3 AND doc_key=$4 RETURNING id`
      : `DELETE FROM lead_financing_docs WHERE lead_id=$1 AND doc_key=$2 RETURNING id`;
    const params = usingFilters ? [req.params.id, cooperativa, etapa_id, doc_key] : [req.params.id, doc_key];
    const r = await pool.query(sql, params);
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
    const { cooperativa, etapa_id, emails, message, move_stage } = req.body || {};
    if (!cooperativa) return res.status(400).json({ error: 'cooperativa requerida' });
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails requerido' });
    }

    // Resolver etapa desde config
    const coops = await getCoopsFromConfig();
    const coopCfg = coops.find(c => c.name === cooperativa);
    let etapaCfg = null;
    if (coopCfg && etapa_id) {
      etapaCfg = (coopCfg.etapas || []).find(e => e.id === etapa_id) || null;
    }

    // Cargar docs (solo de esta cooperativa + etapa si vienen)
    let docsR;
    if (etapa_id) {
      docsR = await pool.query(
        `SELECT doc_key, filename, mime_type, file_base64
           FROM lead_financing_docs WHERE lead_id=$1 AND cooperativa=$2 AND etapa_id=$3`,
        [leadId, cooperativa, etapa_id]
      );
    } else {
      // Legacy: todos los docs sin etapa
      docsR = await pool.query(
        `SELECT doc_key, filename, mime_type, file_base64
           FROM lead_financing_docs WHERE lead_id=$1`,
        [leadId]
      );
    }

    // Validar que esten todos los docs de la etapa
    if (etapaCfg) {
      const have = new Set(docsR.rows.map(r => r.doc_key));
      const missing = (etapaCfg.docs || []).filter(d => !have.has(d.key));
      if (missing.length) {
        return res.status(400).json({
          error: `Faltan documentos: ${missing.map(m => m.label).join(', ')}`,
        });
      }
    } else if (docsR.rows.length < 7) {
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

    const attachments = docsR.rows.map(d => ({
      filename: d.filename || `${d.doc_key}.pdf`,
      mimeType: d.mime_type || 'application/octet-stream',
      content: d.file_base64,
    }));

    const bcc = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');

    const etapaLabel = etapaCfg ? etapaCfg.name : 'Solicitud financiamiento';
    const subject = etapaCfg
      ? `Solicitud financiamiento ${etapaCfg.name} - ${clientName} - Energy Depot`
      : `Solicitud de financiamiento - ${clientName} - Energy Depot`;
    const bodyText = message?.trim() ||
      `Buenas tardes, adjuntamos los documentos de ${etapaLabel.toLowerCase()} para nuestro cliente ${clientName}. ` +
      `Cualquier información adicional, no duden en contactarnos. Saludos, Energy Depot LLC. (787) 627-8585`;

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

    const fecha = new Date().toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' });
    const notaText = `📤 ${etapaLabel} enviada a ${cooperativa} (${emails.join(', ')}) el ${fecha}`;
    try {
      await pool.query(`INSERT INTO notes (lead_id, content) VALUES ($1, $2)`, [leadId, notaText]);
    } catch (e) { console.error('[financing note]', e.message); }

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

    try {
      await pool.query(
        `INSERT INTO alerts (title, message, lead_id, seen, type) VALUES ($1,$2,$3,false,'info')`,
        ['📤 Solicitud enviada', `${clientName} → ${cooperativa} (${etapaLabel})`, leadId]
      );
    } catch (e) { console.error('[financing alert]', e.message); }

    try {
      const { sendToAll } = require('./pushController');
      sendToAll('📤 Solicitud enviada', `${clientName} → ${cooperativa}`, `/leads?id=${leadId}`);
    } catch (e) { console.error('[financing push]', e.message); }

    res.json({ ok: true, sent_to: emails, cooperativa, etapa_id: etapa_id || null, moved_stage: movedStage });
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
  listCoops,
  saveCoops,
  DEFAULT_COOPS,
};
