'use strict';
/**
 * projectInvoicesController.js
 * ----------------------------------------------------------
 * Facturas por proyecto generadas desde el contrato solar.
 * Endpoints listados en server.js bajo /api/project-invoices y
 * /api/leads/:id/project-invoices.
 */

const { pool } = require('../services/db');
const { generatePDF } = require('../services/puppeteerPool');
const { getConfigValue } = require('../services/configService');
const { sendEmail } = require('../services/gmailService');
const { enviarSMS, enviarWhatsApp } = require('../services/twilioService');
const { ensureProjectInvoicesTable } = require('../services/projectInvoices');
const { buildFacturaHTML } = require('../templates/facturaProyecto');

const fmtMoney = n => `$${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function publicBase(req) {
  const fromEnv = (process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  // Fallback al propio request
  return `${req.protocol}://${req.get('host')}`;
}

async function getEmpresa() {
  let info = await getConfigValue('empresa_info', null);
  if (info && typeof info === 'string') {
    try { info = JSON.parse(info); } catch { info = null; }
  }
  return {
    nombre:    info?.nombre   || 'Energy Depot LLC',
    direccion: info?.direccion|| 'Global Plaza Suite 204\nSan Juan, PR 00920',
    ein:       info?.ein      || '',
    telefono:  info?.telefono || '(787) 627-8585',
    email:     info?.email    || 'info@energydepotpr.com',
  };
}

async function getLeadCliente(leadId) {
  const r = await pool.query(
    `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
       FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE l.id = $1`, [leadId]
  );
  if (!r.rows[0]) return null;
  const lead = r.rows[0];
  const sd = lead.solar_data || {};
  const direccion = [sd.address, sd.city ? `${sd.city}${sd.zip ? ', PR ' + sd.zip : ''}` : '']
    .filter(Boolean).join('\n');
  return {
    leadId: lead.id,
    nombre:  lead.contact_name || lead.title || 'Cliente',
    email:   sd.email    || lead.contact_email || '',
    telefono:sd.telefono || lead.contact_phone || '',
    direccion,
  };
}

async function fetchInvoice(id) {
  const r = await pool.query(`SELECT * FROM project_invoices WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function renderAndStorePDF(invoice) {
  let cliente = invoice.lead_id ? await getLeadCliente(invoice.lead_id) : null;
  // Factura manual sin lead: usar los datos de cliente guardados en la propia factura
  if (!cliente) {
    cliente = {
      nombre:   invoice.cliente_nombre   || 'Cliente',
      email:    invoice.cliente_email    || '',
      telefono: invoice.cliente_telefono || '',
      direccion: '',
    };
  }
  const empresa = await getEmpresa();
  const banco   = await getConfigValue('invoice_banco_info', '');
  const html = buildFacturaHTML({
    invoice,
    cliente,
    empresa,
    banco,
  });
  const pdfBuf = await generatePDF(html, {
    format: 'Letter',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  const b64 = Buffer.from(pdfBuf).toString('base64');
  await pool.query(
    `UPDATE project_invoices SET pdf_base64=$1, updated_at=NOW() WHERE id=$2`,
    [b64, invoice.id]
  );
  return { pdfBuf, b64 };
}

// GET /api/leads/:id/project-invoices
async function listForLead(req, res) {
  try {
    await ensureProjectInvoicesTable();
    const { rows } = await pool.query(
      `SELECT id, lead_id, contrato_firma_id, numero, etapa, concepto, monto, porcentaje,
              fecha_emision, fecha_vencimiento, status, paid_at, paid_method, paid_reference,
              notes, created_at, updated_at
         FROM project_invoices
        WHERE lead_id = $1
        ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error('[projectInvoices listForLead]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/project-invoices
async function listAll(req, res) {
  try {
    await ensureProjectInvoicesTable();
    const { status, from, to, lead_id, search } = req.query;
    const where = [];
    const params = [];
    if (status) {
      const arr = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) {
        params.push(arr);
        where.push(`pi.status = ANY($${params.length}::text[])`);
      }
    }
    if (from) { params.push(from); where.push(`pi.fecha_emision >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`pi.fecha_emision <= $${params.length}`); }
    if (lead_id) { params.push(lead_id); where.push(`pi.lead_id = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(pi.numero ILIKE $${params.length} OR l.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT pi.id, pi.lead_id, pi.numero, pi.etapa, pi.concepto, pi.monto, pi.porcentaje,
              pi.fecha_emision, pi.fecha_vencimiento, pi.status, pi.paid_at, pi.paid_method,
              pi.contrato_firma_id, pi.created_at,
              l.title AS lead_title, c.name AS contact_name, c.email AS contact_email,
              c.phone AS contact_phone
         FROM project_invoices pi
         LEFT JOIN leads l ON l.id = pi.lead_id
         LEFT JOIN contacts c ON c.id = l.contact_id
         ${w}
        ORDER BY pi.created_at DESC
        LIMIT 500`,
      params
    );

    // KPIs
    const { rows: kpi } = await pool.query(
      `SELECT
         COALESCE(SUM(monto),0)::float AS total,
         COALESCE(SUM(CASE WHEN status='pagada' THEN monto ELSE 0 END),0)::float AS cobrado,
         COALESCE(SUM(CASE WHEN status IN ('pendiente','enviada') THEN monto ELSE 0 END),0)::float AS pendiente,
         COALESCE(SUM(CASE WHEN status IN ('pendiente','enviada') AND fecha_vencimiento < CURRENT_DATE THEN monto ELSE 0 END),0)::float AS vencido
       FROM project_invoices`
    );
    res.json({ ok: true, data: rows, kpi: kpi[0] });
  } catch (e) {
    console.error('[projectInvoices listAll]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/project-invoices/:id
async function getOne(req, res) {
  try {
    const inv = await fetchInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true, data: inv });
  } catch (e) {
    console.error('[projectInvoices getOne]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/project-invoices/:id/pdf
async function downloadPDF(req, res) {
  try {
    const inv = await fetchInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'No encontrada' });
    let b64 = inv.pdf_base64;
    if (!b64) {
      const r = await renderAndStorePDF(inv);
      b64 = r.b64;
    }
    const buf = Buffer.from(b64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Factura-${inv.numero}.pdf"`);
    res.send(buf);
  } catch (e) {
    console.error('[projectInvoices downloadPDF]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/public/project-invoices/:token/pdf  (sin auth — usado por SMS/WhatsApp)
async function publicPDF(req, res) {
  try {
    const { token } = req.params;
    const r = await pool.query(`SELECT * FROM project_invoices WHERE public_token = $1`, [token]);
    const inv = r.rows[0];
    if (!inv) return res.status(404).send('No encontrada');
    let b64 = inv.pdf_base64;
    if (!b64) {
      const r2 = await renderAndStorePDF(inv);
      b64 = r2.b64;
    }
    const buf = Buffer.from(b64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Factura-${inv.numero}.pdf"`);
    res.send(buf);
  } catch (e) {
    console.error('[projectInvoices publicPDF]', e.message);
    res.status(500).send('Error');
  }
}

// PATCH /api/project-invoices/:id
async function update(req, res) {
  try {
    // Si vienen items[], recalcular monto, concepto y guardar JSONB
    let body = { ...req.body };
    if (Array.isArray(body.items)) {
      const cleanItems = body.items
        .filter(it => it && (it.description || it.concepto))
        .map(it => {
          const qty = Number(it.qty || 1);
          const unit = Number(it.unit_price || 0);
          return { description: String(it.description || it.concepto).trim(), qty, unit_price: unit, unit_cost: Number(it.unit_cost || 0), total: +(qty*unit).toFixed(2) };
        });
      body.items = JSON.stringify(cleanItems);
      body.monto = cleanItems.reduce((s, it) => s + it.total, 0);
      body.concepto = cleanItems.map(i => i.description).join(', ').slice(0, 200);
    }
    const allowed = ['monto','etapa','concepto','items','cliente_nombre','cliente_email','cliente_telefono','fecha_emision','fecha_vencimiento','status','notes','paid_method','paid_reference'];
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (body[k] !== undefined) {
        params.push(body[k]);
        sets.push(`${k} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE project_invoices SET ${sets.join(', ')}, updated_at=NOW(), pdf_base64=NULL
        WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    // Regenerar PDF con los datos nuevos
    try { await renderAndStorePDF(rows[0]); } catch (e) { console.error('[invoice update PDF]', e.message); }
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    console.error('[projectInvoices update]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// DELETE /api/project-invoices/:id
// ?hard=1 → borrado real; por defecto cancela (soft)
async function softDelete(req, res) {
  try {
    if (req.query.hard === '1') {
      const { rows } = await pool.query(`DELETE FROM project_invoices WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
      return res.json({ ok: true, deleted: true });
    }
    const { rows } = await pool.query(
      `UPDATE project_invoices SET status='cancelada', updated_at=NOW() WHERE id=$1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[projectInvoices softDelete]', e.message);
    res.status(500).json({ error: e.message });
  }
}

function emailHTMLFactura({ cliente, invoice, viewUrl, isPaid }) {
  const top = isPaid
    ? `<div style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;text-align:center;margin-bottom:18px">✓ PAGADO — Recibimos tu pago. Gracias.</div>`
    : '';
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
    <div style="max-width:600px;margin:0 auto;background:#fff">
      <div style="background:linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%);padding:26px 32px;color:#fff">
        <div style="font-size:11pt;color:#bfdbfe;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Energy Depot LLC</div>
        <div style="font-size:18pt;font-weight:800;margin-top:6px">Factura ${invoice.numero}</div>
      </div>
      <div style="height:5px;background:#67e8f9"></div>
      <div style="padding:28px 32px;font-size:11pt;line-height:1.6">
        ${top}
        <p style="margin:0 0 14px">Hola <strong>${cliente.nombre || 'Cliente'}</strong>,</p>
        <p style="margin:0 0 14px">${isPaid ? 'Te enviamos copia de tu factura con sello PAGADO para tus registros.' : 'Te enviamos la factura correspondiente a la etapa <strong>'+(invoice.etapa||'')+'</strong> de tu proyecto.'}</p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:10.5pt">
          <tr><td style="padding:8px 0;color:#64748b">Número</td><td style="padding:8px 0;font-weight:700;text-align:right">${invoice.numero}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Etapa</td><td style="padding:8px 0;font-weight:700;text-align:right">${invoice.etapa||''}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Monto</td><td style="padding:8px 0;font-weight:800;text-align:right;font-size:14pt;color:#1a3c8f">${fmtMoney(invoice.monto)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Vencimiento</td><td style="padding:8px 0;font-weight:700;text-align:right">${invoice.fecha_vencimiento || ''}</td></tr>
        </table>
        ${viewUrl ? `<div style="text-align:center;margin:26px 0">
          <a href="${viewUrl}" style="display:inline-block;background:#1a3c8f;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:700;font-size:12pt">Ver factura en PDF →</a>
        </div>` : ''}
        <p style="margin:18px 0 0;font-size:10.5pt;color:#475569">Para preguntas o coordinar el pago contáctanos al (787) 627-8585.</p>
        <p style="margin:14px 0 0;font-size:10.5pt"><strong>Equipo Energy Depot LLC</strong></p>
      </div>
      <div style="background:#0f2558;color:#bfdbfe;padding:14px 32px;font-size:9pt;text-align:center">
        Global Plaza Suite 204 &middot; San Juan, PR 00920 &middot; (787) 627-8585 &middot; info@energydepotpr.com
      </div>
    </div>
  </body></html>`;
}

async function sendToClient(req, invoice, channels) {
  const cliente = await getLeadCliente(invoice.lead_id);
  if (!cliente) throw new Error('Lead no encontrado');

  // Asegura PDF
  let b64 = invoice.pdf_base64;
  if (!b64) {
    const r = await renderAndStorePDF(invoice);
    b64 = r.b64;
    invoice.pdf_base64 = b64;
  }

  const isPaid = invoice.status === 'pagada';
  const base = publicBase(req);
  const viewUrl = `${base}/api/public/project-invoices/${invoice.public_token}/pdf`;
  const prefix = isPaid ? '✓ PAGADO - Recibimos tu pago. ' : '';
  const fname = `Factura-${invoice.numero}.pdf`;

  const results = { email: null, whatsapp: null, sms: null };

  if (channels.email && cliente.email) {
    try {
      const from = await getConfigValue('email_from', 'info@energydepotpr.com');
      const bcc  = await getConfigValue('email_auto_bcc', '');
      await sendEmail({
        from, to: cliente.email, bcc: bcc || undefined,
        subject: `${isPaid ? '[PAGADO] ' : ''}Factura ${invoice.numero} - Energy Depot LLC`,
        html: emailHTMLFactura({ cliente, invoice, viewUrl, isPaid }),
        attachments: [{ filename: fname, content: b64, encoding: 'base64', contentType: 'application/pdf' }],
      });
      results.email = 'ok';
    } catch (e) { results.email = 'err:' + e.message; }
  }

  if (channels.whatsapp && cliente.telefono) {
    try {
      const txt = `${prefix}Hola ${cliente.nombre || ''}, te enviamos la factura ${invoice.numero} por ${invoice.etapa || 'tu proyecto'} - ${fmtMoney(invoice.monto)}. PDF: ${viewUrl}`;
      await enviarWhatsApp(cliente.telefono, txt);
      results.whatsapp = 'ok';
    } catch (e) { results.whatsapp = 'err:' + e.message; }
  }

  if (channels.sms && cliente.telefono) {
    try {
      const txt = `${prefix}Energy Depot: Factura ${invoice.numero} por ${fmtMoney(invoice.monto)} - ver PDF: ${viewUrl}`;
      await enviarSMS(cliente.telefono, txt);
      results.sms = 'ok';
    } catch (e) { results.sms = 'err:' + e.message; }
  }

  // Marca como 'enviada' si estaba pendiente
  if (invoice.status === 'pendiente' && (results.email === 'ok' || results.whatsapp === 'ok' || results.sms === 'ok')) {
    await pool.query(`UPDATE project_invoices SET status='enviada', updated_at=NOW() WHERE id=$1`, [invoice.id]);
  }

  return results;
}

// POST /api/project-invoices/:id/send
async function send(req, res) {
  try {
    const inv = await fetchInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'No encontrada' });
    const channels = {
      email:    req.body?.email    !== false,
      whatsapp: !!req.body?.whatsapp,
      sms:      !!req.body?.sms,
    };
    const results = await sendToClient(req, inv, channels);
    res.json({ ok: true, results });
  } catch (e) {
    console.error('[projectInvoices send]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// POST /api/project-invoices/:id/mark-paid
async function markPaid(req, res) {
  try {
    const { paid_method = 'otro', paid_reference = '', send_to_client = false } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE project_invoices
          SET status='pagada', paid_at=NOW(), paid_method=$1, paid_reference=$2,
              pdf_base64=NULL, updated_at=NOW()
        WHERE id=$3 RETURNING *`,
      [paid_method, paid_reference, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    let inv = rows[0];
    // Regenera PDF con sello PAGADO
    await renderAndStorePDF(inv);
    inv = await fetchInvoice(inv.id);

    let sendResults = null;
    if (send_to_client) {
      sendResults = await sendToClient(req, inv, { email: true, whatsapp: !!req.body.whatsapp, sms: !!req.body.sms });
    }
    res.json({ ok: true, data: inv, send: sendResults });
  } catch (e) {
    console.error('[projectInvoices markPaid]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// POST /api/project-invoices — crear factura manual con items
async function create(req, res) {
  try {
    const { ensureProjectInvoicesTable } = require('../services/projectInvoices');
    await ensureProjectInvoicesTable();
    const {
      lead_id, cliente_nombre, cliente_email, cliente_telefono,
      items = [], fecha_vencimiento, notes,
    } = req.body || {};

    const cleanItems = (Array.isArray(items) ? items : [])
      .filter(it => it && (it.description || it.concepto))
      .map(it => {
        const qty = Number(it.qty || 1);
        const unit = Number(it.unit_price || 0);
        return {
          description: String(it.description || it.concepto).trim(),
          qty,
          unit_price: unit,
          unit_cost: Number(it.unit_cost || 0),
          total: +(qty * unit).toFixed(2),
        };
      });
    if (!cleanItems.length) return res.status(400).json({ error: 'Agrega al menos un item' });

    // Resolver nombre del cliente: del lead o manual
    let nombre = cliente_nombre, email = cliente_email, telefono = cliente_telefono;
    if (lead_id) {
      const c = await getLeadCliente(lead_id);
      if (c) { nombre = nombre || c.nombre; email = email || c.email; telefono = telefono || c.telefono; }
    }
    if (!nombre) return res.status(400).json({ error: 'Falta el nombre del cliente' });

    const monto = cleanItems.reduce((s, it) => s + it.total, 0);

    // Número consecutivo
    const { rows: nr } = await pool.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '\\d+$') AS INT)),0)+1 AS n
         FROM project_invoices WHERE numero LIKE $1`,
      [`ED-INV-${new Date().getFullYear()}-%`]
    );
    const numero = `ED-INV-${new Date().getFullYear()}-${String(nr[0].n).padStart(5,'0')}`;

    const ins = await pool.query(
      `INSERT INTO project_invoices
         (lead_id, numero, concepto, monto, items, cliente_nombre, cliente_email, cliente_telefono,
          fecha_vencimiento, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10) RETURNING *`,
      [lead_id || null, numero, cleanItems.map(i=>i.description).join(', ').slice(0,200),
       monto, JSON.stringify(cleanItems), nombre, email || null, telefono || null,
       fecha_vencimiento || null, notes || null]
    );
    const invoice = ins.rows[0];
    try { await renderAndStorePDF(invoice); } catch (e) { console.error('[invoice PDF]', e.message); }
    res.json({ ok: true, invoice });
  } catch (e) {
    console.error('[project-invoice create]', e.message);
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  listForLead,
  listAll,
  getOne,
  downloadPDF,
  publicPDF,
  update,
  softDelete,
  send,
  markPaid,
  create,
};
