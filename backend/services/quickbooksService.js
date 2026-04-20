'use strict';
const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const { pool } = require('./db');

// ── Cliente OAuth ────────────────────────────────────────────────────────────
function getOAuthClient() {
  return new OAuthClient({
    clientId:     process.env.QB_CLIENT_ID,
    clientSecret: process.env.QB_CLIENT_SECRET,
    environment:  process.env.QB_ENV || 'sandbox', // 'sandbox' | 'production'
    redirectUri:  process.env.QB_REDIRECT_URI,
  });
}

// ── Leer tokens desde DB ─────────────────────────────────────────────────────
async function getTokens() {
  const { rows } = await pool.query(`SELECT value FROM config WHERE key='quickbooks_tokens' LIMIT 1`);
  if (!rows.length || !rows[0].value) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

// ── Guardar tokens en DB ─────────────────────────────────────────────────────
async function saveTokens(tokens) {
  await pool.query(
    `INSERT INTO config (key, value) VALUES ('quickbooks_tokens', $1)
     ON CONFLICT (key) DO UPDATE SET value=$1`,
    [JSON.stringify(tokens)]
  );
}

// ── Verificar y refrescar token si expiró ────────────────────────────────────
async function getValidTokens() {
  const tokens = await getTokens();
  if (!tokens) return null;

  const oauthClient = getOAuthClient();
  oauthClient.setToken(tokens);

  // Si el access_token expiró, refrescar con refresh_token
  if (!oauthClient.isAccessTokenValid()) {
    try {
      const refreshed = await oauthClient.refresh();
      const newTokens = { ...refreshed.getJson(), realmId: tokens.realmId };
      await saveTokens(newTokens);
      return newTokens;
    } catch (e) {
      console.error('[QB] Token refresh failed:', e.message);
      return null;
    }
  }
  return tokens;
}

// ── Instancia de QuickBooks API ───────────────────────────────────────────────
async function getQBClient() {
  if (!process.env.QB_CLIENT_ID || !process.env.QB_CLIENT_SECRET) {
    throw new Error('QB_CLIENT_ID y QB_CLIENT_SECRET no configurados en Railway');
  }
  const tokens = await getValidTokens();
  if (!tokens) throw new Error('QuickBooks no conectado — autoriza primero en Configuración > Integraciones');

  const isSandbox = (process.env.QB_ENV || 'sandbox') === 'sandbox';
  return new QuickBooks(
    process.env.QB_CLIENT_ID,
    process.env.QB_CLIENT_SECRET,
    tokens.access_token,
    false,           // no token secret (OAuth2)
    tokens.realmId,
    isSandbox,       // useSandbox
    false,           // debug
    null,            // minorversion
    '2.0',           // oauthversion
    tokens.refresh_token
  );
}

// ── Buscar o crear cliente en QB ─────────────────────────────────────────────
async function findOrCreateCustomer(qb, name, email, phone) {
  return new Promise((resolve, reject) => {
    // Buscar por nombre
    qb.findCustomers([{ field: 'DisplayName', value: name, operator: '=' }], (err, customers) => {
      if (!err && customers?.QueryResponse?.Customer?.length > 0) {
        return resolve(customers.QueryResponse.Customer[0]);
      }
      // Crear nuevo
      const customer = {
        DisplayName: name,
        ...(email && { PrimaryEmailAddr: { Address: email } }),
        ...(phone && { PrimaryPhone: { FreeFormNumber: phone } }),
      };
      qb.createCustomer(customer, (err2, created) => {
        if (err2) return reject(new Error('Error creando cliente QB: ' + JSON.stringify(err2.Fault || err2)));
        resolve(created);
      });
    });
  });
}

// ── Buscar cuenta de ingresos en QB ──────────────────────────────────────────
async function findIncomeAccount(qb) {
  return new Promise((resolve) => {
    qb.findAccounts([{ field: 'AccountType', value: 'Income', operator: '=' }], (err, result) => {
      if (!err && result?.QueryResponse?.Account?.length > 0) {
        const acct = result.QueryResponse.Account[0];
        return resolve({ value: String(acct.Id), name: acct.Name });
      }
      // Fallback: Services account common ID
      resolve({ value: '1', name: 'Services' });
    });
  });
}

// ── Buscar o crear Item/Servicio en QB ───────────────────────────────────────
async function findOrCreateServiceItem(qb, name) {
  return new Promise((resolve, reject) => {
    qb.findItems([{ field: 'Name', value: name, operator: '=' }], async (err, items) => {
      if (!err && items?.QueryResponse?.Item?.length > 0) {
        return resolve(items.QueryResponse.Item[0]);
      }
      // Buscar cuenta de ingresos real
      const incomeAccountRef = await findIncomeAccount(qb);
      const item = {
        Name: name.substring(0, 100),
        Type: 'Service',
        IncomeAccountRef: incomeAccountRef,
      };
      qb.createItem(item, (err2, created) => {
        if (err2) {
          console.warn('[QB] createItem failed, using default item:', JSON.stringify(err2.Fault || err2));
          return resolve({ Id: incomeAccountRef.value });
        }
        resolve(created);
      });
    });
  });
}

// ── Crear factura en QuickBooks ───────────────────────────────────────────────
async function createInvoice(invoiceData) {
  const { client_name, client_email, client_phone, items = [], total, payment_link, service_date, invoice_number } = invoiceData;

  const qb = await getQBClient();
  const tokens = await getValidTokens();

  // 1. Buscar/crear cliente
  const customer = await findOrCreateCustomer(qb, client_name || 'Cliente Fix a Trip', client_email, client_phone);

  // 2. Construir líneas de la factura
  const lineItems = await Promise.all(items.map(async (item, idx) => {
    let itemRef = { value: '1', name: 'Services' };
    try {
      const svcItem = await findOrCreateServiceItem(qb, item.description);
      if (svcItem?.Id) itemRef = { value: String(svcItem.Id), name: item.description };
    } catch {}

    return {
      Id: String(idx + 1),
      LineNum: idx + 1,
      Description: item.description,
      Amount: Number(item.total || 0),
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: itemRef,
        Qty: Number(item.qty || 1),
        UnitPrice: Number(item.unit_price || 0),
      },
    };
  }));

  // 3. Crear factura — habilitar pago en línea si QB Payments está activo
  const invoicePayload = {
    Line: lineItems,
    CustomerRef: { value: String(customer.Id) },
    AllowOnlineCreditCardPayment: true,
    AllowOnlineACHPayment: true,
    ...(service_date && { TxnDate: service_date.split('T')[0] }),
    ...(invoice_number && { DocNumber: invoice_number }),
    ...(client_email && { BillEmail: { Address: client_email } }),
  };

  return new Promise((resolve, reject) => {
    qb.createInvoice(invoicePayload, (err, created) => {
      if (err) return reject(new Error('Error QB: ' + JSON.stringify(err.Fault || err)));
      const isSandbox = (process.env.QB_ENV || 'sandbox') === 'sandbox';
      const qbBase = isSandbox
        ? 'https://sandbox.qbo.intuit.com'
        : 'https://app.qbo.intuit.com';
      resolve({
        qb_invoice_id: created.Id,
        qb_doc_number: created.DocNumber,
        qb_link: `${qbBase}/app/invoice?txnId=${created.Id}`,
        // Link de pago que el cliente puede abrir (requiere QB Payments activo)
        payment_link: `${qbBase}/app/viewinvoice?invoiceId=${created.Id}`,
      });
    });
  });
}

// ── Obtener factura de QB (para verificar si fue pagada) ─────────────────────
async function getQBInvoice(qbInvoiceId) {
  const qb = await getQBClient();
  return new Promise((resolve, reject) => {
    qb.getInvoice(qbInvoiceId, (err, invoice) => {
      if (err) return reject(new Error('Error QB getInvoice: ' + JSON.stringify(err.Fault || err)));
      resolve(invoice);
    });
  });
}

// ── Marcar factura QB como pagada (crear Payment en QB) ──────────────────────
async function recordPaymentInQB(qbInvoiceId, amount, realmId) {
  const qb = await getQBClient();
  return new Promise((resolve, reject) => {
    // Primero obtener la factura para sacar el CustomerRef
    qb.getInvoice(qbInvoiceId, (err, invoice) => {
      if (err) return reject(new Error('Error obteniendo factura QB: ' + JSON.stringify(err.Fault || err)));

      const payment = {
        TotalAmt: Number(amount),
        CustomerRef: invoice.CustomerRef,
        Line: [{
          Amount: Number(amount),
          LinkedTxn: [{ TxnId: qbInvoiceId, TxnType: 'Invoice' }],
        }],
      };

      qb.createPayment(payment, (err2, created) => {
        if (err2) return reject(new Error('Error registrando pago QB: ' + JSON.stringify(err2.Fault || err2)));
        resolve({ qb_payment_id: created.Id });
      });
    });
  });
}

module.exports = { getOAuthClient, getTokens, saveTokens, getValidTokens, createInvoice, getQBInvoice, recordPaymentInQB };
