'use strict';
const crypto = require('crypto');
const { getOAuthClient, getTokens, saveTokens, getValidTokens, createInvoice, getQBInvoice } = require('../services/quickbooksService');
const { pool } = require('../services/db');

// ── Estado de conexión ───────────────────────────────────────────────────────
async function status(req, res) {
  try {
    const tokens = await getValidTokens();
    if (!tokens) return res.json({ connected: false });
    res.json({ connected: true, realmId: tokens.realmId });
  } catch {
    res.json({ connected: false });
  }
}

// ── Iniciar flujo OAuth — redirige a Intuit ──────────────────────────────────
async function authRedirect(req, res) {
  if (!process.env.QB_CLIENT_ID || !process.env.QB_CLIENT_SECRET) {
    return res.status(400).json({ error: 'QB_CLIENT_ID y QB_CLIENT_SECRET no configurados en las variables de entorno de Railway.' });
  }
  const oauthClient = getOAuthClient();
  const authUri = oauthClient.authorizeUri({
    scope: [
      'com.intuit.quickbooks.accounting',
    ],
    state: 'fixatrip-crm',
  });
  res.redirect(authUri);
}

// ── Callback OAuth — Intuit redirige aquí con el código ─────────────────────
async function authCallback(req, res) {
  try {
    const oauthClient = getOAuthClient();
    const tokenResponse = await oauthClient.createToken(req.url);
    const tokenData = tokenResponse.getJson();

    // Guardar tokens + realmId
    const realmId = req.query.realmId;
    await saveTokens({ ...tokenData, realmId });

    // Mark QuickBooks integration as active
    const { pool } = require('../services/db');
    await pool.query(
      `INSERT INTO integrations (id, config, is_active, connected_at, updated_at)
       VALUES ('quickbooks', '{}', true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET is_active = true, connected_at = NOW(), updated_at = NOW()`
    );

    // Redirigir al frontend con éxito (usar solo el primer origen si hay varios)
    const frontendUrl = (process.env.FRONTEND_URL || 'https://crm-ia.vercel.app').split(',')[0].trim();
    res.redirect(`${frontendUrl}/settings?qb=connected`);
  } catch (err) {
    console.error('[QB] Callback error:', err.message);
    const frontendUrl = (process.env.FRONTEND_URL || 'https://crm-ia.vercel.app').split(',')[0].trim();
    res.redirect(`${frontendUrl}/settings?qb=error&msg=${encodeURIComponent(err.message)}`);
  }
}

// ── Desconectar QuickBooks ───────────────────────────────────────────────────
async function disconnect(req, res) {
  try {
    const { pool } = require('../services/db');
    await pool.query(`DELETE FROM config WHERE key='quickbooks_tokens'`);
    await pool.query(`UPDATE integrations SET is_active = false WHERE id = 'quickbooks'`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Sincronizar factura a QuickBooks (llamado desde invoicesController) ──────
async function syncInvoice(req, res) {
  const { invoiceData } = req.body;
  if (!invoiceData) return res.status(400).json({ error: 'Falta invoiceData' });

  try {
    const result = await createInvoice(invoiceData);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Webhook de QuickBooks (pago recibido) ────────────────────────────────────
// QB envía POST a este endpoint cuando hay cambios en facturas/pagos
// Registrar en: developer.intuit.com → tu app → Webhooks → URL: /api/quickbooks/webhook
async function webhook(req, res) {
  // Verificar firma HMAC (QB firma con QB_WEBHOOK_TOKEN)
  const webhookToken = process.env.QB_WEBHOOK_TOKEN;
  if (webhookToken) {
    const signature = req.headers['intuit-signature'];
    const payload = JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', webhookToken)
      .update(payload)
      .digest('base64');
    if (signature !== expected) {
      return res.status(401).json({ error: 'Firma inválida' });
    }
  }

  // QB siempre espera 200 inmediatamente
  res.status(200).json({ ok: true });

  // Procesar eventos en background
  try {
    const notifications = req.body?.eventNotifications || [];
    for (const notif of notifications) {
      const entities = notif?.dataChangeEvent?.entities || [];
      for (const entity of entities) {
        // Solo nos interesan cambios en Invoice o Payment
        if (!['Invoice', 'Payment'].includes(entity.name)) continue;
        if (entity.operation !== 'Update' && entity.operation !== 'Create') continue;

        if (entity.name === 'Invoice') {
          // Buscar la factura en nuestra DB por qb_invoice_id
          const { rows } = await pool.query(
            `SELECT id, status, total FROM invoices WHERE qb_invoice_id=$1 LIMIT 1`,
            [entity.id]
          );
          if (!rows.length) continue;
          const inv = rows[0];
          if (inv.status === 'paid') continue; // ya estaba pagada

          // Consultar el estado actual en QB
          try {
            const qbInvoice = await getQBInvoice(entity.id);
            const balance = Number(qbInvoice.Balance || 0);
            if (balance === 0 && Number(qbInvoice.TotalAmt) > 0) {
              // Balance = 0 significa pagada completamente
              await pool.query(
                `UPDATE invoices SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1`,
                [inv.id]
              );
              console.log(`[QB Webhook] Factura ${inv.id} marcada como pagada`);
            }
          } catch (e) {
            console.warn('[QB Webhook] Error verificando factura:', e.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[QB Webhook] Error procesando:', err.message);
  }
}

module.exports = { status, authRedirect, authCallback, disconnect, syncInvoice, webhook };
