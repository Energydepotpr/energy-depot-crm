'use strict';
const crypto = require('crypto');
const { pool } = require('../services/db');
const { generatePDF } = require('../services/puppeteerPool');
const { getConfigValue } = require('../services/configService');
const { buildSolicitudHTML } = require('../templates/solicitudPrestamo.html.js');
const { LOAN_FORM_SECTIONS, LOAN_FORM_FIELDS, LOAN_REQUIRED_KEYS } = require('../templates/solicitudPrestamoForm');
const { generateTuCoopPdf } = require('../services/tuCoopPdf');

let _ensured = false;
async function ensureLoanApplicationsTable() {
  if (_ensured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loan_applications (
        id SERIAL PRIMARY KEY,
        lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        cooperativa VARCHAR(80),
        token VARCHAR(64) UNIQUE NOT NULL,
        form_data JSONB,
        signature_base64 TEXT,
        signed_name VARCHAR(255),
        signed_at TIMESTAMP,
        signed_ip VARCHAR(64),
        pdf_base64 TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_la_lead  ON loan_applications(lead_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_la_token ON loan_applications(token)`);
    // Columna para variantes específicas por cooperativa (tu_coop, etc.)
    try {
      await pool.query(`ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS coop_template VARCHAR(40)`);
    } catch (e) { /* noop */ }
    _ensured = true;
  } catch (e) { console.error('[loan_apps] ensure:', e.message); }
}

// POST /api/leads/:id/loan-applications/tu-coop-draft
// Body: { form_data }
// Crea (o actualiza) un borrador Tu Coop SIN firma. Devuelve token + signing_url
// para enviarle al cliente para que edite y firme remotamente.
async function createTuCoopDraft(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const leadId = Number(req.params.id);
    if (!leadId) return res.status(400).json({ error: 'lead inválido' });
    const { form_data } = req.body || {};
    const fd = form_data && typeof form_data === 'object' ? form_data : {};

    // Reusar borrador Tu Coop sin firmar si existe
    const ex = await pool.query(
      `SELECT * FROM loan_applications
        WHERE lead_id=$1 AND cooperativa=$2 AND signed_at IS NULL
        ORDER BY id DESC LIMIT 1`,
      [leadId, 'Tu Coop']
    );

    let row;
    if (ex.rows[0]) {
      const u = await pool.query(
        `UPDATE loan_applications
            SET form_data=$1, coop_template='tu_coop',
                expires_at = NOW() + INTERVAL '30 days'
          WHERE id=$2 RETURNING *`,
        [fd, ex.rows[0].id]
      );
      row = u.rows[0];
    } else {
      const token = genToken(leadId);
      const ins = await pool.query(
        `INSERT INTO loan_applications (lead_id, cooperativa, token, form_data, coop_template)
         VALUES ($1,$2,$3,$4,'tu_coop') RETURNING *`,
        [leadId, 'Tu Coop', token, fd]
      );
      row = ins.rows[0];
    }

    res.json({
      id: row.id,
      token: row.token,
      cooperativa: row.cooperativa,
      coop_template: 'tu_coop',
      created_at: row.created_at,
      expires_at: row.expires_at,
      signing_url: `${frontendBase()}/solicitud/${row.token}`,
    });
  } catch (e) {
    console.error('[loan_apps createTuCoopDraft]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// POST /api/leads/:id/loan-applications/tu-coop-pdf
// Body: { form_data, signature_base64 }
// Genera el PDF Tu Coop (template específico) firmado, lo guarda como
// financing-doc (etapa1 / solicitud_prestamo) y persiste en loan_applications
// con coop_template='tu_coop'.
async function generateTuCoopSigned(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const leadId = Number(req.params.id);
    if (!leadId) return res.status(400).json({ error: 'lead inválido' });
    const { form_data, signature_base64 } = req.body || {};
    const fd = form_data && typeof form_data === 'object' ? form_data : {};
    if (!signature_base64) return res.status(400).json({ error: 'Firma requerida' });

    const pdfBuf = await generateTuCoopPdf(fd, signature_base64);
    const pdfB64 = pdfBuf.toString('base64');
    const signedAt = new Date();
    const ip = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '').toString().split(',')[0].trim();
    const signedName = (fd.nombre_completo || '').toString().trim();

    // Persistir como loan_application firmada
    const token = genToken(leadId);
    const ins = await pool.query(
      `INSERT INTO loan_applications
         (lead_id, cooperativa, token, form_data, signature_base64, signed_name, signed_at, signed_ip, pdf_base64, coop_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'tu_coop') RETURNING id`,
      [leadId, 'Tu Coop', token, fd, signature_base64, signedName, signedAt, ip, pdfB64]
    );

    // Subir como financing-doc (doc_key='solicitud_prestamo' para Tu Coop)
    const fname = `Solicitud-TuCoop-${(signedName || 'cliente').replace(/\s+/g,'-')}.pdf`;
    try {
      await pool.query(
        `INSERT INTO lead_financing_docs
           (lead_id, cooperativa, etapa_id, doc_key, filename, mime_type, file_base64, uploaded_at)
         VALUES ($1,'Tu Coop','etapa1','solicitud_prestamo',$2,'application/pdf',$3, NOW())
         ON CONFLICT (lead_id, cooperativa, etapa_id, doc_key)
         DO UPDATE SET filename=EXCLUDED.filename, mime_type=EXCLUDED.mime_type,
                       file_base64=EXCLUDED.file_base64, uploaded_at=NOW()`,
        [leadId, fname, pdfB64]
      );
    } catch (e) {
      // Fallback: si doc_key 'solicitud_prestamo' no existe en constraint, usar 'solicitud'
      console.error('[tuCoop financing-doc]', e.message);
      try {
        await pool.query(
          `INSERT INTO lead_financing_docs
             (lead_id, cooperativa, etapa_id, doc_key, filename, mime_type, file_base64, uploaded_at)
           VALUES ($1,'Tu Coop','etapa1','solicitud',$2,'application/pdf',$3, NOW())
           ON CONFLICT (lead_id, cooperativa, etapa_id, doc_key)
           DO UPDATE SET filename=EXCLUDED.filename, mime_type=EXCLUDED.mime_type,
                         file_base64=EXCLUDED.file_base64, uploaded_at=NOW()`,
          [leadId, fname, pdfB64]
        );
      } catch (e2) { console.error('[tuCoop financing-doc fallback]', e2.message); }
    }

    res.json({
      ok: true,
      id: ins.rows[0].id,
      filename: fname,
      pdf: pdfB64,
      signed_at: signedAt,
    });
  } catch (e) {
    console.error('[loan_apps generateTuCoopSigned]', e.message);
    res.status(500).json({ error: e.message });
  }
}

function frontendBase() {
  const fromEnv = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  const isUgly = !fromEnv || fromEnv.includes('localhost') || fromEnv.includes('vercel.app');
  return isUgly ? 'https://crm-energydepotpr.com' : fromEnv;
}

function genToken(leadId) {
  return crypto.createHash('sha256')
    .update(crypto.randomBytes(32).toString('hex') + ':la:' + leadId + ':' + Date.now())
    .digest('hex').slice(0, 64);
}

async function generatePdfForApp(row) {
  const html = buildSolicitudHTML({
    cooperativa: row.cooperativa,
    form_data: row.form_data || {},
    signatureDataUrl: row.signature_base64 || null,
    signedName: row.signed_name || null,
    signedAt: row.signed_at || null,
    createdAt: row.created_at || new Date(),
  });
  const buf = await generatePDF(html, {
    format: 'Legal', // 8.5" × 14" — tamaño oficial cooperativas
    printBackground: true,
    margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
  });
  return Buffer.from(buf).toString('base64');
}

// POST /api/leads/:id/loan-application
// Body: { cooperativa, form_data }
// Si hay una pendiente (sin firma) para esa coop → actualiza. Si está firmada → crea nueva.
async function createOrUpdate(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const leadId = Number(req.params.id);
    const { cooperativa, form_data } = req.body || {};
    if (!leadId) return res.status(400).json({ error: 'lead inválido' });
    const coop = String(cooperativa || '');
    const fd = form_data && typeof form_data === 'object' ? form_data : {};

    // Buscar existente sin firmar para esta coop
    const ex = await pool.query(
      `SELECT * FROM loan_applications
        WHERE lead_id=$1 AND cooperativa=$2 AND signed_at IS NULL
        ORDER BY id DESC LIMIT 1`,
      [leadId, coop]
    );

    let row;
    if (ex.rows[0]) {
      const u = await pool.query(
        `UPDATE loan_applications
            SET form_data=$1, expires_at = NOW() + INTERVAL '30 days'
          WHERE id=$2 RETURNING *`,
        [fd, ex.rows[0].id]
      );
      row = u.rows[0];
    } else {
      const token = genToken(leadId);
      const ins = await pool.query(
        `INSERT INTO loan_applications (lead_id, cooperativa, token, form_data)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [leadId, coop, token, fd]
      );
      row = ins.rows[0];
    }

    res.json({
      id: row.id,
      token: row.token,
      cooperativa: row.cooperativa,
      signed_at: row.signed_at,
      created_at: row.created_at,
      expires_at: row.expires_at,
      signing_url: `${frontendBase()}/solicitud/${row.token}`,
    });
  } catch (e) {
    console.error('[loan_apps createOrUpdate]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/leads/:id/loan-applications/latest-form-data — devuelve form_data más reciente de cualquier coop (para auto-fill)
async function latestFormData(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const leadId = Number(req.params.id);
    // Tomar la solicitud con MÁS campos llenos (no la más reciente con vacíos).
    const r = await pool.query(
      `SELECT id, form_data, cooperativa, signed_at, created_at
         FROM loan_applications
        WHERE lead_id=$1 AND form_data IS NOT NULL AND form_data <> '{}'::jsonb
        ORDER BY (
          SELECT COUNT(*) FROM jsonb_each_text(form_data) WHERE value IS NOT NULL AND value <> ''
        ) DESC,
        signed_at DESC NULLS LAST,
        id DESC LIMIT 1`,
      [leadId]
    );
    res.json(r.rows[0] || null);
  } catch (e) {
    console.error('[loan_apps latest]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/leads/:id/loan-applications?cooperativa=X
async function listForLead(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const leadId = Number(req.params.id);
    const coop = req.query.cooperativa != null ? String(req.query.cooperativa) : null;
    const params = [leadId];
    let sql = `SELECT id, cooperativa, token, signed_at, signed_name, created_at, expires_at,
                      (signature_base64 IS NOT NULL) AS has_signature
                 FROM loan_applications WHERE lead_id=$1`;
    if (coop !== null) { sql += ` AND cooperativa=$2`; params.push(coop); }
    sql += ` ORDER BY id DESC`;
    const r = await pool.query(sql, params);
    const base = frontendBase();
    res.json(r.rows.map(row => ({
      ...row,
      signing_url: `${base}/solicitud/${row.token}`,
    })));
  } catch (e) {
    console.error('[loan_apps list]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/leads/:id/loan-applications/:la_id/pdf (auth)
async function downloadPdf(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const r = await pool.query(`SELECT * FROM loan_applications WHERE id=$1 AND lead_id=$2`,
      [Number(req.params.la_id), Number(req.params.id)]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const row = r.rows[0];
    let pdfB64 = row.pdf_base64;
    if (!pdfB64) {
      pdfB64 = await generatePdfForApp(row);
      try { await pool.query(`UPDATE loan_applications SET pdf_base64=$1 WHERE id=$2`, [pdfB64, row.id]); } catch {}
    }
    const fname = `Solicitud-Prestamo-${(row.form_data?.nombre_completo || 'cliente').toString().replace(/\s+/g,'-')}.pdf`;
    res.json({ ok: true, pdf: pdfB64, filename: fname, signed_at: row.signed_at });
  } catch (e) {
    console.error('[loan_apps pdf]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/public/solicitud/:token  (sin auth)
// GET /api/public/solicitud/:token/pdf — PDF firmado como binario inline
async function getSolicitudPdfPublic(req, res) {
  try {
    const r = await pool.query(
      `SELECT pdf_base64, signed_name FROM loan_applications WHERE token=$1`,
      [req.params.token]
    );
    const row = r.rows[0];
    if (!row || !row.pdf_base64) return res.status(404).send('No encontrado');
    const buf = Buffer.from(row.pdf_base64, 'base64');
    const nombre = (row.signed_name || 'cliente').replace(/\s+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Solicitud-${nombre}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (e) {
    console.error('[getSolicitudPdfPublic]', e.message);
    res.status(500).send('Error');
  }
}

async function getPublic(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const r = await pool.query(`SELECT * FROM loan_applications WHERE token=$1`, [req.params.token]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Enlace no encontrado' });
    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }
    const isTuCoop = row.coop_template === 'tu_coop';
    res.json({
      cooperativa: row.cooperativa,
      template: isTuCoop ? 'tu_coop' : 'generic',
      // Para template genérico mandamos las secciones; para tu_coop, el frontend
      // renderiza su propio set de campos (mismos que el modal CRM).
      form_sections: isTuCoop ? null : LOAN_FORM_SECTIONS,
      form_data: row.form_data || {},
      already_signed: !!row.signed_at,
      signed_at: row.signed_at,
      signed_name: row.signed_name,
      expires_at: row.expires_at,
      // why: en lugar de devolver el base64 en JSON (iOS Safari muestra pantalla
      // negra al abrir data:// URLs grandes), exponemos un endpoint público que
      // sirve el PDF binario directo.
      pdfUrl: row.signed_at ? `/backend/api/public/solicitud/${row.token}/pdf` : null,
      clientLinkSlug: await (async () => {
        try {
          const cl = await pool.query(
            `SELECT slug FROM client_doc_tokens WHERE lead_id=$1 AND slug IS NOT NULL LIMIT 1`,
            [row.lead_id]
          );
          return cl.rows[0]?.slug || null;
        } catch { return null; }
      })(),
    });
  } catch (e) {
    console.error('[loan_apps getPublic]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// POST /api/public/solicitud/:token  (sin auth)
// Body: { signature, signed_name, form_data?: {} }
async function signPublic(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const { signature, signed_name, form_data } = req.body || {};
    if (!signature) return res.status(400).json({ error: 'Firma requerida' });
    if (!signed_name || !String(signed_name).trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const r = await pool.query(`SELECT * FROM loan_applications WHERE token=$1`, [req.params.token]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Enlace no encontrado' });
    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Enlace expirado' });
    if (row.signed_at) return res.status(409).json({ error: 'Esta solicitud ya fue firmada' });

    const isTuCoop = row.coop_template === 'tu_coop';

    // why: shallow merge sobreescribía valores ya guardados con strings vacíos del
    // form de firma (campos opcionales que el cliente dejó en blanco). Solo
    // pisamos un campo si el cliente envió un valor no-vacío.
    let fdFinal = { ...(row.form_data || {}) };
    if (form_data && typeof form_data === 'object') {
      for (const [k, v] of Object.entries(form_data)) {
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        fdFinal[k] = v;
      }
    }
    // Validar required solo para template genérico (tu_coop tiene su propio set)
    if (!isTuCoop) {
      const missing = LOAN_REQUIRED_KEYS.filter(k => !fdFinal[k] || String(fdFinal[k]).trim() === '');
      if (missing.length) {
        return res.status(400).json({ error: 'Faltan campos requeridos: ' + missing.join(', ') });
      }
    } else {
      if (!fdFinal.nombre_completo || !String(fdFinal.nombre_completo).trim()) {
        fdFinal.nombre_completo = String(signed_name).trim();
      }
    }

    const signedAt = new Date();
    const ip = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '').toString().split(',')[0].trim();

    const u = await pool.query(
      `UPDATE loan_applications
          SET form_data=$1, signature_base64=$2, signed_name=$3, signed_at=$4, signed_ip=$5
        WHERE id=$6 RETURNING *`,
      [fdFinal, signature, String(signed_name).trim(), signedAt, ip, row.id]
    );
    const finalRow = u.rows[0];

    // Generar PDF firmado (Tu Coop vs genérico)
    let pdfB64;
    if (isTuCoop) {
      const pdfBuf = await generateTuCoopPdf(fdFinal, signature);
      pdfB64 = Buffer.from(pdfBuf).toString('base64');
    } else {
      pdfB64 = await generatePdfForApp(finalRow);
    }
    await pool.query(`UPDATE loan_applications SET pdf_base64=$1 WHERE id=$2`, [pdfB64, finalRow.id]);

    // Registrarla como financing-doc en etapa1 de la cooperativa
    // Tu Coop usa doc_key='solicitud_prestamo'; genérico usa 'solicitud'
    try {
      const docKey = isTuCoop ? 'solicitud_prestamo' : 'solicitud';
      const fname = isTuCoop
        ? `Solicitud-TuCoop-${(fdFinal.nombre_completo || 'cliente').toString().replace(/\s+/g,'-')}.pdf`
        : `Solicitud-Prestamo-${(fdFinal.nombre_completo || 'cliente').toString().replace(/\s+/g,'-')}.pdf`;
      await pool.query(
        `INSERT INTO lead_financing_docs (lead_id, cooperativa, etapa_id, doc_key, filename, mime_type, file_base64, uploaded_at)
         VALUES ($1,$2,'etapa1',$3,$4,'application/pdf',$5, NOW())
         ON CONFLICT (lead_id, cooperativa, etapa_id, doc_key)
         DO UPDATE SET filename=EXCLUDED.filename, mime_type=EXCLUDED.mime_type,
                       file_base64=EXCLUDED.file_base64, uploaded_at=NOW()`,
        [finalRow.lead_id, finalRow.cooperativa || '', docKey, fname, pdfB64]
      );
    } catch (errDoc) {
      console.error('[loan_apps→financing-doc]', errDoc.message);
      // Fallback Tu Coop: si doc_key 'solicitud_prestamo' no existe en constraint, intentar 'solicitud'
      if (isTuCoop) {
        try {
          const fname = `Solicitud-TuCoop-${(fdFinal.nombre_completo || 'cliente').toString().replace(/\s+/g,'-')}.pdf`;
          await pool.query(
            `INSERT INTO lead_financing_docs (lead_id, cooperativa, etapa_id, doc_key, filename, mime_type, file_base64, uploaded_at)
             VALUES ($1,$2,'etapa1','solicitud',$3,'application/pdf',$4, NOW())
             ON CONFLICT (lead_id, cooperativa, etapa_id, doc_key)
             DO UPDATE SET filename=EXCLUDED.filename, mime_type=EXCLUDED.mime_type,
                           file_base64=EXCLUDED.file_base64, uploaded_at=NOW()`,
            [finalRow.lead_id, finalRow.cooperativa || '', fname, pdfB64]
          );
        } catch (e2) { console.error('[loan_apps→financing-doc fallback]', e2.message); }
      }
    }

    // Email al cliente (best-effort)
    try {
      const email = fdFinal.email || fdFinal.correo;
      if (email) {
        const { sendEmail } = require('../services/gmailService');
        const from = await getConfigValue('email_from', 'info@energydepotpr.com');
        const bcc  = await getConfigValue('email_auto_bcc', '');
        await sendEmail({
          from, to: email, bcc: bcc || undefined,
          subject: `Solicitud de Préstamo firmada — Energy Depot LLC`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:20px;color:#1f2937;line-height:1.6">
            <h2 style="color:#1a3c8f">¡Gracias! Hemos recibido tu solicitud.</h2>
            <p>Hola <strong>${(fdFinal.nombre_completo || 'Cliente')}</strong>, adjuntamos copia de tu solicitud de préstamo firmada${finalRow.cooperativa ? ` para <strong>${finalRow.cooperativa}</strong>` : ''}.</p>
            <p>Nuestro equipo continuará con el proceso y te contactará pronto.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0">
            <div style="font-size:12px;color:#6b7280">Energy Depot LLC · (787) 627-8585 · info@energydepotpr.com</div>
          </div>`,
          attachments: [{
            filename: `Solicitud-Prestamo-${(fdFinal.nombre_completo || 'cliente').toString().replace(/\s+/g,'-')}.pdf`,
            content: pdfB64, encoding: 'base64', contentType: 'application/pdf',
          }],
        });
      }
    } catch (errMail) { console.error('[loan_apps email]', errMail.message); }

    // Auto-mover lead a etapa "Financiamiento" al firmar solicitud
    try {
      const leadR = await pool.query(
        `SELECT l.pipeline_id, l.stage_id, ps.position AS cur_position
           FROM leads l LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
          WHERE l.id = $1`, [finalRow.lead_id]
      );
      const lead = leadR.rows[0];
      if (lead?.pipeline_id) {
        const sR = await pool.query(
          `SELECT id, name, position FROM pipeline_stages
            WHERE pipeline_id=$1 ORDER BY position`, [lead.pipeline_id]
        );
        const target = sR.rows.find(s => /financ/i.test(s.name || ''));
        if (target && target.position > (lead.cur_position ?? -1)) {
          await pool.query(`UPDATE leads SET stage_id=$1, updated_at=NOW() WHERE id=$2`, [target.id, finalRow.lead_id]);
        }
      }
    } catch (eMove) { console.error('[loan_apps auto-move]', eMove.message); }

    res.json({ ok: true, signed_at: signedAt });
  } catch (e) {
    console.error('[loan_apps signPublic]', e.message);
    res.status(500).json({ error: e.message });
  }
}

async function deleteLoanApp(req, res) {
  try {
    await ensureLoanApplicationsTable();
    const r = await pool.query(
      `DELETE FROM loan_applications WHERE id=$1 AND lead_id=$2 RETURNING id`,
      [req.params.la_id, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[loanApp delete]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = {
  createOrUpdate,
  listForLead,
  latestFormData,
  downloadPdf,
  getPublic,
  getSolicitudPdfPublic,
  signPublic,
  generateTuCoopSigned,
  createTuCoopDraft,
  deleteLoanApp,
  ensureLoanApplicationsTable,
};
