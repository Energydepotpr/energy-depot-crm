'use strict';
const { pool } = require('../services/db');
const crypto   = require('crypto');

// Auto-create table on first use
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contract_signatures (
      id            SERIAL PRIMARY KEY,
      contract_id   INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
      signer_name   VARCHAR(255),
      signer_email  VARCHAR(255),
      signed_at     TIMESTAMP,
      signature_data TEXT,
      ip_address    VARCHAR(60),
      token         VARCHAR(128) UNIQUE NOT NULL,
      status        VARCHAR(20) DEFAULT 'pending',
      expires_at    TIMESTAMP NOT NULL,
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);
}

// ── POST /api/contracts/:id/signature-request ────────────────────────────────
async function solicitarFirma(req, res) {
  const contractId = parseInt(req.params.id, 10);
  if (isNaN(contractId)) return res.status(400).json({ error: 'ID inválido' });

  try {
    await ensureTable();

    // Verify contract exists
    const ctRes = await pool.query(`SELECT id, title, contact_id FROM contracts WHERE id = $1`, [contractId]);
    if (!ctRes.rows[0]) return res.status(404).json({ error: 'Contrato no encontrado' });

    // Expire any previous pending tokens for this contract
    await pool.query(
      `UPDATE contract_signatures SET status = 'expired' WHERE contract_id = $1 AND status = 'pending'`,
      [contractId]
    );

    // Generate unique secure token
    const token    = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days

    await pool.query(
      `INSERT INTO contract_signatures (contract_id, token, status, expires_at)
       VALUES ($1, $2, 'pending', $3)`,
      [contractId, token, expiresAt]
    );

    const baseUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000';
    const link = `${baseUrl}/sign/${token}`;

    res.json({ ok: true, token, link, expires_at: expiresAt });
  } catch (err) {
    console.error('[SIGNATURES solicitarFirma]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/public/sign/:token ───────────────────────────────────────────────
async function obtenerParaFirma(req, res) {
  const { token } = req.params;
  try {
    await ensureTable();

    const sigRes = await pool.query(
      `SELECT cs.*, ct.title, ct.notes, ct.file_name, ct.file_base64, ct.status AS contract_status
       FROM contract_signatures cs
       JOIN contracts ct ON ct.id = cs.contract_id
       WHERE cs.token = $1`,
      [token]
    );

    if (!sigRes.rows[0]) return res.status(404).json({ error: 'Enlace no encontrado' });
    const sig = sigRes.rows[0];

    if (sig.status === 'expired' || new Date(sig.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }
    if (sig.status === 'signed') {
      return res.status(200).json({
        ok: true,
        already_signed: true,
        signer_name:  sig.signer_name,
        signed_at:    sig.signed_at,
        contract: { title: sig.title, notes: sig.notes, file_name: sig.file_name }
      });
    }

    res.json({
      ok: true,
      already_signed: false,
      contract: {
        id:         sig.contract_id,
        title:      sig.title,
        notes:      sig.notes,
        file_name:  sig.file_name,
        file_base64: sig.file_base64, // include so client can render PDF
      },
      expires_at: sig.expires_at,
    });
  } catch (err) {
    console.error('[SIGNATURES obtenerParaFirma]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/public/sign/:token ──────────────────────────────────────────────
async function firmar(req, res) {
  const { token } = req.params;
  const { signer_name, signer_email, signature_data } = req.body;

  if (!signer_name || !signature_data) {
    return res.status(400).json({ error: 'Nombre y firma son requeridos' });
  }

  try {
    await ensureTable();

    const sigRes = await pool.query(
      `SELECT * FROM contract_signatures WHERE token = $1`,
      [token]
    );
    if (!sigRes.rows[0]) return res.status(404).json({ error: 'Enlace no encontrado' });
    const sig = sigRes.rows[0];

    if (sig.status === 'expired' || new Date(sig.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }
    if (sig.status === 'signed') {
      return res.status(409).json({ error: 'Este contrato ya fue firmado' });
    }

    // Capture IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    const now = new Date();

    // Save signature
    await pool.query(
      `UPDATE contract_signatures
       SET signer_name = $1, signer_email = $2, signature_data = $3,
           ip_address = $4, signed_at = $5, status = 'signed'
       WHERE token = $6`,
      [signer_name, signer_email || null, signature_data, ip, now, token]
    );

    // Update contract status to 'signed'
    await pool.query(
      `UPDATE contracts SET status = 'signed', signed_at = $1, updated_at = NOW() WHERE id = $2`,
      [now, sig.contract_id]
    );

    res.json({ ok: true, signed_at: now, message: 'Contrato firmado exitosamente' });
  } catch (err) {
    console.error('[SIGNATURES firmar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/contracts/:id/signature ─────────────────────────────────────────
async function verFirma(req, res) {
  const contractId = parseInt(req.params.id, 10);
  if (isNaN(contractId)) return res.status(400).json({ error: 'ID inválido' });

  try {
    await ensureTable();

    const { rows } = await pool.query(
      `SELECT id, contract_id, signer_name, signer_email, signed_at,
              ip_address, token, status, expires_at, created_at
       FROM contract_signatures
       WHERE contract_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [contractId]
    );

    if (!rows[0]) return res.json({ ok: true, data: null });

    const baseUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000';
    const sig = rows[0];
    sig.link = `${baseUrl}/sign/${sig.token}`;

    res.json({ ok: true, data: sig });
  } catch (err) {
    console.error('[SIGNATURES verFirma]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { solicitarFirma, obtenerParaFirma, firmar, verFirma };

/* ROUTES_TO_ADD_server.js
const signatures = require('./controllers/signaturesController');

// Public signature routes (BEFORE authMiddleware)
app.get('/api/public/sign/:token',  signatures.obtenerParaFirma);
app.post('/api/public/sign/:token', signatures.firmar);

// Protected signature routes (AFTER authMiddleware)
app.post('/api/contracts/:id/signature-request', signatures.solicitarFirma);
app.get('/api/contracts/:id/signature',          signatures.verFirma);
*/

/* API_METHODS_TO_ADD_api.js
  signatureRequest: (contractId)        => req('POST', `/api/contracts/${contractId}/signature-request`),
  signatureStatus:  (contractId)        => req('GET',  `/api/contracts/${contractId}/signature`),
  publicSignGet:    (token)             => fetch(`/backend/api/public/sign/${token}`).then(r => r.json()),
  publicSignPost:   (token, data)       => fetch(`/backend/api/public/sign/${token}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
*/
