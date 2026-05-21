'use strict';
/**
 * lumaBillsController.js
 * ----------------------------------------------------------
 * Facturas LUMA del cliente (las que el cliente envía a Energy Depot).
 * No confundir con project_invoices (facturas que la empresa emite).
 *
 * Endpoints:
 *   GET    /api/leads/:id/luma-bills
 *   POST   /api/leads/:id/luma-bills
 *   GET    /api/leads/:id/luma-bills/:bill_id/file
 *   PATCH  /api/leads/:id/luma-bills/:bill_id
 *   DELETE /api/leads/:id/luma-bills/:bill_id
 */

const { pool } = require('../services/db');

let _ensured = false;
async function ensureTable() {
  if (_ensured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_luma_bills (
        id SERIAL PRIMARY KEY,
        lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        filename VARCHAR(255),
        mime_type VARCHAR(80),
        file_base64 TEXT,
        periodo VARCHAR(40),
        monto NUMERIC(12,2),
        kwh NUMERIC(10,2),
        cta_aee VARCHAR(80),
        contador VARCHAR(80),
        uploaded_at TIMESTAMP DEFAULT NOW(),
        uploaded_by INT,
        notes TEXT
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_llb_lead ON lead_luma_bills(lead_id);`);
    _ensured = true;
  } catch (e) {
    console.error('[lumaBills ensure]', e.message);
  }
}

async function listBills(req, res) {
  try {
    await ensureTable();
    const r = await pool.query(
      `SELECT id, lead_id, filename, mime_type, periodo, monto, kwh, cta_aee, contador,
              uploaded_at, uploaded_by, notes
         FROM lead_luma_bills
        WHERE lead_id = $1
        ORDER BY uploaded_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('[lumaBills list]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function createBill(req, res) {
  try {
    await ensureTable();
    let {
      filename, mime_type, base64,
      periodo = null, monto = null, kwh = null,
      cta_aee = null, contador = null, notes = null,
    } = req.body || {};
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'base64 requerido' });
    }
    const mime = mime_type || 'application/pdf';

    // OCR opcional: si no vienen monto/kwh/periodo, intentar extraer con Claude.
    const needsOCR = (monto == null || monto === '' || kwh == null || kwh === '' || !periodo);
    if (needsOCR) {
      try {
        const ocr = await extractWithClaude({ base64, mime });
        if (ocr) {
          if ((monto == null || monto === '') && ocr.monto != null) monto = ocr.monto;
          if ((kwh   == null || kwh   === '') && ocr.kwh   != null) kwh   = ocr.kwh;
          if (!periodo  && ocr.periodo)   periodo  = ocr.periodo;
          if (!cta_aee  && ocr.cta_aee)   cta_aee  = ocr.cta_aee;
          if (!contador && ocr.contador)  contador = ocr.contador;
        }
      } catch (e) {
        console.error('[lumaBills ocr]', e.message);
      }
    }

    const userId = req.user?.id || null;
    const r = await pool.query(
      `INSERT INTO lead_luma_bills
         (lead_id, filename, mime_type, file_base64, periodo, monto, kwh, cta_aee, contador, notes, uploaded_by, uploaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
       RETURNING id, lead_id, filename, mime_type, periodo, monto, kwh, cta_aee, contador, uploaded_at, uploaded_by, notes`,
      [
        req.params.id,
        filename || 'factura-luma.pdf',
        mime,
        base64,
        periodo, monto === '' ? null : monto, kwh === '' ? null : kwh,
        cta_aee, contador, notes, userId,
      ]
    );
    res.json(r.rows[0]);
  } catch (e) {
    console.error('[lumaBills create]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function getFile(req, res) {
  try {
    const r = await pool.query(
      `SELECT filename, mime_type, file_base64
         FROM lead_luma_bills WHERE id = $1 AND lead_id = $2 LIMIT 1`,
      [req.params.bill_id, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json({
      filename: r.rows[0].filename,
      mime: r.rows[0].mime_type,
      base64: r.rows[0].file_base64,
    });
  } catch (e) {
    console.error('[lumaBills getFile]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function updateBill(req, res) {
  try {
    const allowed = ['periodo', 'monto', 'kwh', 'cta_aee', 'contador', 'notes', 'filename'];
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        params.push(req.body[k] === '' ? null : req.body[k]);
        sets.push(`${k} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    params.push(req.params.bill_id, req.params.id);
    const r = await pool.query(
      `UPDATE lead_luma_bills SET ${sets.join(', ')}
        WHERE id = $${params.length - 1} AND lead_id = $${params.length}
        RETURNING id, lead_id, filename, mime_type, periodo, monto, kwh, cta_aee, contador, uploaded_at, notes`,
      params
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('[lumaBills update]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function deleteBill(req, res) {
  try {
    const r = await pool.query(
      `DELETE FROM lead_luma_bills WHERE id = $1 AND lead_id = $2 RETURNING id`,
      [req.params.bill_id, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[lumaBills delete]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── OCR: extrae monto/kwh/periodo de la factura LUMA con Claude Haiku ──────
async function extractWithClaude({ base64, mime }) {
  const apiKey = process.env.ANTHROPIC_API_KEY_COTIZAR || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const isPdf = mime === 'application/pdf';
  const isImg = mime.startsWith('image/');
  if (!isPdf && !isImg) return null;

  const SYSTEM = `Eres un asistente que extrae datos clave de facturas de LUMA Energy en Puerto Rico.
Extrae:
- periodo: mes/año de la factura (ej: "Octubre 2025" o "10/2025"). Si solo aparece un rango, usa el mes de la factura actual.
- monto: total a pagar de ESTA factura en USD (número, sin símbolo $). Si hay varios, usa "Total a pagar" o "Balance actual".
- kwh: consumo en kWh del período actual (número entero).
- cta_aee: número de cuenta LUMA (10 dígitos típicamente).
- contador: número del contador / medidor.

REGLAS:
- SOLO JSON válido sin markdown.
- Si no encuentras un campo, ponlo como null.

Formato:
{"periodo":"Octubre 2025","monto":234.56,"kwh":890,"cta_aee":"3601731000","contador":"123456"}`;

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mime,             data: base64 } };

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'Extrae monto, kwh y periodo de esta factura LUMA. Solo JSON.' },
        ],
      }],
    }),
  });
  const data = await r.json();
  if (!r.ok) return null;
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  const clean = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '').trim();
  try {
    const j = JSON.parse(clean);
    return {
      periodo: j.periodo || null,
      monto: j.monto != null && j.monto !== '' ? Number(j.monto) : null,
      kwh:   j.kwh   != null && j.kwh   !== '' ? Number(j.kwh)   : null,
      cta_aee: j.cta_aee || null,
      contador: j.contador || null,
    };
  } catch {
    return null;
  }
}

module.exports = {
  listBills,
  createBill,
  getFile,
  updateBill,
  deleteBill,
};
