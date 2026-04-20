'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const path = require('path');
const { pool } = require('../services/db');
const { createInvoice: syncToQB, getValidTokens } = require('../services/quickbooksService');

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Extraer datos de factura con Claude ─────────────────────────────────────
async function extractarDatos(req, res) {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Falta mensaje' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurada en Railway. Agrega la variable de entorno.' });
  }

  const messages = [
    ...history,
    { role: 'user', content: message }
  ];

  try {
    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Eres un asistente de facturación para Fix a Trip PR (turismo en Puerto Rico).
REGLA ABSOLUTA: responde ÚNICAMENTE con un bloque de código JSON. NUNCA uses tablas markdown, NUNCA uses texto fuera del JSON, NUNCA uses listas. Solo el bloque JSON.

Formato obligatorio:
\`\`\`json
{
  "action": "preview",
  "data": {
    "invoice_number": "FAT-001",
    "client_name": "Nombre del cliente",
    "client_email": null,
    "client_phone": null,
    "service_date": "2025-03-15",
    "items": [
      {"description": "BBQ Estándar (15 personas × $55)", "qty": 15, "unit_price": 55.00, "total": 825.00},
      {"description": "Cargo por servicio (20%)", "qty": 1, "unit_price": 210.00, "total": 210.00},
      {"description": "IVU (11.5%)", "qty": 1, "unit_price": 120.75, "total": 120.75}
    ],
    "subtotal": 1106.00,
    "tax": 0,
    "total": 1436.75,
    "payment_link": null,
    "notes": null
  },
  "missing": [],
  "message": "Factura lista para Sergio Nuevo — total $1,436.75. ¿Genero el PDF?"
}
\`\`\`

REGLAS DE CÁLCULO:
- Cargos de servicio e IVU van como líneas separadas en "items" (no en el campo "tax")
- El campo "tax" siempre es 0
- "subtotal" = suma de items de servicios reales (sin servicio/IVU)
- "total" = suma de TODOS los items incluyendo servicio e IVU
- Genera invoice_number automático si no se da (formato FAT-XXX)
- Si falta nombre del cliente o descripción del servicio, ponlos en "missing"
- "message" siempre breve y en español`,
      messages
    });

    const text = response.content[0].text;

    // Intentar extraer JSON del bloque
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        return res.json({ ok: true, parsed, raw: text });
      } catch {
        // JSON malformado, devolver como texto
      }
    }

    // Si no hay JSON, es una pregunta del bot
    return res.json({ ok: true, parsed: null, raw: text });
  } catch (err) {
    console.error('Invoice AI error:', err.message);
    const isAuthError = err.status === 401 || err.message?.includes('api-key') || err.message?.includes('authentication');
    const msg = isAuthError
      ? 'ANTHROPIC_API_KEY inválida. Actualízala en Railway → Variables.'
      : ('Error al procesar con IA: ' + err.message);
    res.status(isAuthError ? 503 : 500).json({ error: msg });
  }
}

// ── Generar PDF ──────────────────────────────────────────────────────────────
async function generarPDF(req, res) {
  const { data, agent_id } = req.body;
  if (!data) return res.status(400).json({ error: 'Falta data' });

  const {
    invoice_number, client_name, client_email, client_phone,
    service_date, items = [], subtotal, tax = 0, total,
    payment_link: rawPaymentLink, notes
  } = data;

  // Validate payment_link must be http/https if provided
  let payment_link = null;
  if (rawPaymentLink) {
    try {
      const u = new URL(rawPaymentLink);
      if (u.protocol === 'http:' || u.protocol === 'https:') payment_link = rawPaymentLink;
    } catch { /* invalid URL — ignore */ }
  }

  try {
    const agentId = agent_id || req.user?.id;

    // ── Crear/actualizar contacto y lead automáticamente ──────────────────
    let contactId = null;
    let leadId = null;
    try {
      if (client_name) {
        // Buscar contacto existente por nombre o teléfono/email
        let existing = null;
        if (client_phone) {
          const r = await pool.query(`SELECT id FROM contacts WHERE phone=$1 LIMIT 1`, [client_phone]);
          existing = r.rows[0];
        }
        if (!existing && client_email) {
          const r = await pool.query(`SELECT id FROM contacts WHERE email=$1 LIMIT 1`, [client_email]);
          existing = r.rows[0];
        }

        if (existing) {
          contactId = existing.id;
        } else {
          // Crear nuevo contacto
          const ins = await pool.query(
            `INSERT INTO contacts (name, email, phone, source) VALUES ($1,$2,$3,'invoice') RETURNING id`,
            [client_name, client_email || null, client_phone || null]
          );
          contactId = ins.rows[0].id;
        }

        // Buscar pipeline por defecto
        const pip = await pool.query(`SELECT ps.id FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id=p.id ORDER BY p.position, ps.position LIMIT 1`);
        const stageId = pip.rows[0]?.id;

        // Crear lead vinculado al contacto
        const serviceDesc = items.map(i => i.description).join(', ') || 'Servicio Fix a Trip';
        const leadTitle = `${client_name} — ${serviceDesc}`;
        const leadIns = await pool.query(
          `INSERT INTO leads (title, contact_id, stage_id, value, source) VALUES ($1,$2,$3,$4,'invoice') RETURNING id`,
          [leadTitle, contactId, stageId || null, total || 0]
        );
        leadId = leadIns.rows[0].id;
      }
    } catch (e) {
      console.error('[Invoice] Contact/lead creation error:', e.message);
      // No fallar el PDF por esto
    }

    // ── Guardar factura en DB ─────────────────────────────────────────────
    // Also add contact_id migration column if missing
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL`).catch(() => {});

    const { rows } = await pool.query(
      `INSERT INTO invoices (invoice_number, client_name, client_email, client_phone, service_date, items, subtotal, tax, total, payment_link, notes, agent_id, contact_id, lead_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft') RETURNING id`,
      [invoice_number, client_name, client_email, client_phone, service_date,
       JSON.stringify(items), subtotal, tax, total, payment_link, notes, agentId, contactId || null, leadId || null]
    );
    const invoiceId = rows[0].id;

    // ── Auto-sincronizar a QuickBooks (no bloqueante) ─────────────────────
    let qbResult = null;
    try {
      const qbTokens = await getValidTokens();
      if (qbTokens) {
        qbResult = await syncToQB({
          invoice_number, client_name, client_email, client_phone,
          service_date, items, total, payment_link
        });
        // Guardar datos QB en la factura + actualizar status a 'sent'
        await pool.query(
          `UPDATE invoices SET qb_invoice_id=$1, qb_doc_number=$2, qb_link=$3, qb_synced_at=NOW(),
           payment_link=COALESCE(payment_link, $4), status='sent', updated_at=NOW() WHERE id=$5`,
          [qbResult.qb_invoice_id, qbResult.qb_doc_number, qbResult.qb_link,
           qbResult.payment_link, invoiceId]
        );
        // Si el link de pago no estaba, usar el de QB
        if (!payment_link && qbResult.payment_link) {
          payment_link = qbResult.payment_link;
        }
      }
    } catch (qbErr) {
      console.warn('[Invoice] QB sync failed (non-fatal):', qbErr.message);
    }

    // Generar PDF en memoria
    const doc = new PDFDocument({ margin: 50, size: 'LETTER', autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);

      // ── Header ──
      const orange = '#f97316';
      const darkGray = '#1a1a1a';
      const lightGray = '#fff8f3';
      const mutedGray = '#64748b';

      // Fondo header naranja Fix a Trip
      doc.rect(0, 0, 595, 110).fill(darkGray);
      doc.rect(0, 106, 595, 4).fill(orange);

      // Logo texto: fix(blanco) a(naranja) trip(blanco)
      doc.fill('#ffffff').fontSize(28).font('Helvetica-Bold').text('fix', 40, 30, { continued: true, lineBreak: false });
      doc.fill(orange).fontSize(28).font('Helvetica-Bold').text('a', { continued: true, lineBreak: false });
      doc.fill('#ffffff').fontSize(28).font('Helvetica-Bold').text('trip', { lineBreak: false });

      // Info empresa debajo del logo
      doc.fill('#ffffff').fontSize(9).font('Helvetica').fillOpacity(0.6)
        .text('fixatrippuertorico.com  ·  fixatrippr@gmail.com  ·  Puerto Rico', 40, 78);
      doc.fillOpacity(1);

      // INVOICE label
      doc.fontSize(30).font('Helvetica-Bold').fillOpacity(0.12)
        .fill('#ffffff')
        .text('INVOICE', 350, 26, { align: 'right', width: 200 });
      doc.fillOpacity(1);

      // ── Info factura ──
      doc.fill(darkGray).fontSize(10).font('Helvetica-Bold')
        .text('N° Factura:', 370, 125)
        .text('Fecha:', 370, 142)
        .text('Vencimiento:', 370, 159);

      doc.font('Helvetica')
        .text(invoice_number || 'FAT-001', 450, 125, { align: 'right', width: 95 })
        .text(new Date().toLocaleDateString('es-PR'), 450, 142, { align: 'right', width: 95 })
        .text(service_date
          ? new Date(service_date + 'T00:00:00').toLocaleDateString('es-PR')
          : new Date().toLocaleDateString('es-PR'), 450, 159, { align: 'right', width: 95 });

      // ── Cliente ──
      doc.rect(50, 120, 270, 80).fill(lightGray).stroke('#e2e8f0');
      doc.fill(mutedGray).fontSize(9).font('Helvetica-Bold')
        .text('FACTURAR A', 62, 130);
      doc.fill(darkGray).fontSize(12).font('Helvetica-Bold')
        .text(client_name || 'Cliente', 62, 145);

      let yClient = 162;
      if (client_email) {
        doc.fontSize(10).font('Helvetica').fill(mutedGray)
          .text(client_email, 62, yClient);
        yClient += 14;
      }
      if (client_phone) {
        doc.fontSize(10).font('Helvetica').fill(mutedGray)
          .text(client_phone, 62, yClient);
      }

      // ── Tabla de items ──
      const tableTop = 220;
      const colDesc = 50;
      const colQty = 310;
      const colPrice = 380;
      const colTotal = 460;
      const tableWidth = 495;

      // Header tabla
      doc.rect(colDesc, tableTop, tableWidth, 24).fill(darkGray);
      doc.fill('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text('Descripción', colDesc + 8, tableTop + 7)
        .text('Cant.', colQty, tableTop + 7, { width: 60, align: 'center' })
        .text('Precio', colPrice, tableTop + 7, { width: 70, align: 'right' })
        .text('Total', colTotal, tableTop + 7, { width: 85, align: 'right' });

      let yRow = tableTop + 24;
      items.forEach((item, i) => {
        const rowColor = i % 2 === 0 ? '#ffffff' : lightGray;
        doc.rect(colDesc, yRow, tableWidth, 22).fill(rowColor);
        doc.fill(darkGray).fontSize(10).font('Helvetica')
          .text(item.description, colDesc + 8, yRow + 6, { width: 250 })
          .text(String(item.qty || 1), colQty, yRow + 6, { width: 60, align: 'center' })
          .text(`$${Number(item.unit_price || 0).toFixed(2)}`, colPrice, yRow + 6, { width: 70, align: 'right' })
          .text(`$${Number(item.total || 0).toFixed(2)}`, colTotal, yRow + 6, { width: 85, align: 'right' });
        yRow += 22;
      });

      // Borde tabla
      doc.rect(colDesc, tableTop, tableWidth, yRow - tableTop).stroke('#e2e8f0');

      // ── Totales ──
      yRow += 12;
      const totX = 370;

      doc.fill(mutedGray).fontSize(10).font('Helvetica')
        .text('Subtotal:', totX, yRow)
        .text(`$${Number(subtotal || total || 0).toFixed(2)}`, totX + 80, yRow, { width: 95, align: 'right' });
      yRow += 18;

      if (tax > 0) {
        doc.text(`IVU (${tax}%):`, totX, yRow)
          .text(`$${(Number(subtotal || 0) * tax / 100).toFixed(2)}`, totX + 80, yRow, { width: 95, align: 'right' });
        yRow += 18;
      }

      // Total final
      doc.rect(totX - 10, yRow - 4, 195, 28).fill(orange);
      doc.fill('#ffffff').fontSize(13).font('Helvetica-Bold')
        .text('TOTAL:', totX, yRow + 4)
        .text(`$${Number(total || 0).toFixed(2)}`, totX + 80, yRow + 4, { width: 95, align: 'right' });

      yRow += 40;

      // ── Link de pago ──
      if (payment_link) {
        doc.rect(50, yRow, 495, 44).fill('#fff8f3').stroke('#fed7aa');
        doc.fill(orange).fontSize(10).font('Helvetica-Bold')
          .text('ENLACE DE PAGO', 62, yRow + 8);
        doc.fill(orange).fontSize(10).font('Helvetica')
          .text(payment_link, 62, yRow + 22, { width: 471, link: payment_link });
        yRow += 56;
      }

      // ── Notas ──
      if (notes) {
        yRow += 8;
        doc.fill(mutedGray).fontSize(9).font('Helvetica-Bold').text('NOTAS:', 50, yRow);
        yRow += 14;
        doc.fill(darkGray).fontSize(9).font('Helvetica').text(notes, 50, yRow, { width: 495 });
        yRow += 28;
      }

      // ── Footer (LETTER = 792pt tall) ──
      const footerY = 716;
      doc.rect(0, footerY, 612, 4).fill(orange);
      doc.rect(0, footerY + 4, 612, 72).fill(darkGray);
      const footerText = `Gracias por elegir Fix a Trip Puerto Rico  ·  fixatrippuertorico.com\nFactura generada el ${new Date().toLocaleDateString('es-PR')}  ·  INV-${invoiceId}`;
      doc.fill('#9ca3af').fontSize(8).font('Helvetica')
        .text(footerText, 50, footerY + 20, { align: 'center', width: 512, lineGap: 6 });

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const base64 = pdfBuffer.toString('base64');

    res.json({
      ok: true,
      invoice_id: invoiceId,
      contact_id: contactId,
      lead_id: leadId,
      pdf_base64: base64,
      filename: `${invoice_number || 'factura'}.pdf`,
      qb_synced: !!qbResult,
      qb_invoice_id: qbResult?.qb_invoice_id || null,
      qb_doc_number: qbResult?.qb_doc_number || null,
      qb_link: qbResult?.qb_link || null,
      payment_link: payment_link || null,
    });

  } catch (err) {
    console.error('PDF gen error:', err.message);
    res.status(500).json({ error: 'Error generando PDF: ' + err.message });
  }
}

// ── Marcar factura como pagada ────────────────────────────────────────────────
async function marcarPagada(req, res) {
  const { id } = req.params;
  const { paid_at } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE invoices SET status='paid', paid_at=COALESCE($1::TIMESTAMP, NOW()), updated_at=NOW()
       WHERE id=$2 RETURNING id, status, paid_at`,
      [paid_at || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Listar facturas ──────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { lead_id } = req.query;
    let query = `SELECT id, invoice_number, client_name, total, service_date, created_at, agent_id,
              status, qb_invoice_id, qb_doc_number, qb_link, qb_synced_at, paid_at, payment_link, lead_id
       FROM invoices`;
    const params = [];
    if (lead_id) { params.push(lead_id); query += ` WHERE lead_id = $1`; }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const { rows } = await pool.query(query, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Generar/actualizar factura desde un lead ─────────────────────────────────
async function invoiceFromLead(req, res) {
  const { lead_id } = req.body;
  if (!lead_id) return res.status(400).json({ error: 'Falta lead_id' });
  try {
    const { rows } = await pool.query(`
      SELECT l.*, c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email
      FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE l.id = $1
    `, [lead_id]);
    if (!rows.length) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = rows[0];

    const total = Number(lead.value) || 0;
    const ci = lead.check_in ? String(lead.check_in).slice(0,10) : null;
    const co = lead.check_out ? String(lead.check_out).slice(0,10) : null;
    const desc = `Viaje — ${lead.title}` +
      (ci ? ` · Check-in: ${ci}` : '') +
      (co ? ` → ${co}` : '') +
      (lead.cantidad_personas ? ` · ${lead.cantidad_personas} personas` : '');
    const items = total > 0 ? [{ description: desc, qty: 1, unit_price: total, total }] : [];
    const invNum = `FAT-L${String(lead.id).padStart(4, '0')}`;

    // Check if invoice already linked
    const existing = await pool.query(
      'SELECT * FROM invoices WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1', [lead_id]
    );

    if (existing.rows.length) {
      // Update existing invoice with latest lead data
      await pool.query(
        `UPDATE invoices SET
          client_name=COALESCE($1, client_name),
          client_phone=COALESCE($2, client_phone),
          client_email=COALESCE($3, client_email),
          service_date=COALESCE($4::date, service_date),
          items=$5, subtotal=$6, total=$7, updated_at=NOW()
         WHERE id=$8`,
        [lead.contact_name || null, lead.contact_phone || null, lead.contact_email || null,
         ci, JSON.stringify(items), total, total, existing.rows[0].id]
      );
      const updated = await pool.query('SELECT * FROM invoices WHERE id=$1', [existing.rows[0].id]);
      return res.json({ ok: true, updated: true, data: updated.rows[0] });
    }

    // Create new invoice linked to lead
    const { rows: newInv } = await pool.query(
      `INSERT INTO invoices (invoice_number, client_name, client_email, client_phone, service_date, items, subtotal, tax, total, agent_id, contact_id, lead_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,'draft') RETURNING *`,
      [invNum, lead.contact_name || lead.title, lead.contact_email || null, lead.contact_phone || null,
       ci, JSON.stringify(items), total, total, req.user?.id || null, lead.contact_id || null, lead_id]
    );
    return res.json({ ok: true, created: true, data: newInv[0] });
  } catch (err) {
    console.error('[Invoice from lead]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── Descargar PDF de factura existente ──────────────────────────────────────
async function descargar(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM invoices WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    // Re-generar — reutilizar lógica anterior
    req.body = { data: { ...rows[0], items: rows[0].items || [] } };
    return generarPDF(req, res);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Obtener factura completa ─────────────────────────────────────────────────
async function obtener(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM invoices WHERE id=$1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Actualizar factura ───────────────────────────────────────────────────────
async function actualizar(req, res) {
  const { id } = req.params;
  const { invoice_number, client_name, client_email, client_phone, service_date, items, subtotal, tax, total, payment_link, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE invoices SET invoice_number=$1, client_name=$2, client_email=$3, client_phone=$4,
       service_date=$5, items=$6, subtotal=$7, tax=$8, total=$9, payment_link=$10, notes=$11
       WHERE id=$12 RETURNING id`,
      [invoice_number, client_name, client_email, client_phone, service_date,
       JSON.stringify(items || []), subtotal, tax, total, payment_link, notes, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Eliminar factura ─────────────────────────────────────────────────────────
async function eliminar(req, res) {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM invoices WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { extractarDatos, generarPDF, listar, obtener, actualizar, eliminar, descargar, marcarPagada, invoiceFromLead };
