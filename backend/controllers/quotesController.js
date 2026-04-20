'use strict';
const PDFDocument = require('pdfkit');
const path = require('path');
const { pool } = require('../services/db');

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

// ── Auto-create tabla quotes ──────────────────────────────────────────────────
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id           SERIAL PRIMARY KEY,
      quote_number VARCHAR(30) NOT NULL UNIQUE,
      lead_id      INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      contact_id   INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      agent_id     INTEGER,
      items        JSONB NOT NULL DEFAULT '[]',
      subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
      discount     NUMERIC(5,2)  NOT NULL DEFAULT 0,
      tax          NUMERIC(5,2)  NOT NULL DEFAULT 0,
      total        NUMERIC(12,2) NOT NULL DEFAULT 0,
      status       VARCHAR(20)   NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','accepted','rejected','expired')),
      valid_until  DATE,
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

ensureTable().catch(err => console.error('[quotes] ensureTable error:', err.message));

// ── Generar número correlativo COT-001, COT-002... ────────────────────────────
async function nextQuoteNumber() {
  const { rows } = await pool.query(
    `SELECT quote_number FROM quotes ORDER BY id DESC LIMIT 1`
  );
  if (!rows.length) return 'COT-001';
  const last = rows[0].quote_number;
  const match = last.match(/(\d+)$/);
  if (!match) return 'COT-001';
  const next = parseInt(match[1], 10) + 1;
  return `COT-${String(next).padStart(3, '0')}`;
}

// ── Calcular totales ──────────────────────────────────────────────────────────
function calcularTotales(items = [], discount = 0, tax = 0) {
  const subtotal = items.reduce((sum, item) => {
    const qty  = Number(item.qty  || 1);
    const price = Number(item.unit_price || 0);
    return sum + qty * price;
  }, 0);
  const discountAmt = subtotal * (Number(discount) / 100);
  const taxableAmt  = subtotal - discountAmt;
  const taxAmt      = taxableAmt * (Number(tax) / 100);
  const total       = taxableAmt + taxAmt;
  return { subtotal: +subtotal.toFixed(2), total: +total.toFixed(2) };
}

// ── listar ────────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { status = '', lead_id = '', search = '' } = req.query;

    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`q.status = $${params.length}`);
    }
    if (lead_id) {
      params.push(Number(lead_id));
      conditions.push(`q.lead_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(q.quote_number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR l.title ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT q.*,
              c.name  AS contact_name,
              l.title AS lead_title
       FROM quotes q
       LEFT JOIN contacts c ON c.id = q.contact_id
       LEFT JOIN leads    l ON l.id = q.lead_id
       ${where}
       ORDER BY q.created_at DESC`,
      params
    );

    res.json({ quotes: rows, total: rows.length });
  } catch (err) {
    console.error('[quotes listar]', err.message);
    res.status(500).json({ error: 'Error obteniendo cotizaciones' });
  }
}

// ── obtener ───────────────────────────────────────────────────────────────────
async function obtener(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT q.*,
              c.name    AS contact_name,
              c.email   AS contact_email,
              c.phone   AS contact_phone,
              c.company AS contact_company,
              l.title   AS lead_title
       FROM quotes q
       LEFT JOIN contacts c ON c.id = q.contact_id
       LEFT JOIN leads    l ON l.id = q.lead_id
       WHERE q.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[quotes obtener]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── crear ─────────────────────────────────────────────────────────────────────
async function crear(req, res) {
  try {
    const {
      lead_id, contact_id, items = [],
      discount = 0, tax = 0,
      valid_until, notes, status = 'draft'
    } = req.body;

    const agent_id = req.user.id;
    const quote_number = await nextQuoteNumber();
    const { subtotal, total } = calcularTotales(items, discount, tax);

    // Enriquecer items con campo total por línea
    const enrichedItems = items.map(it => ({
      ...it,
      qty:        Number(it.qty || 1),
      unit_price: Number(it.unit_price || 0),
      total:      +(Number(it.qty || 1) * Number(it.unit_price || 0)).toFixed(2),
    }));

    const { rows } = await pool.query(
      `INSERT INTO quotes
         (quote_number, lead_id, contact_id, agent_id, items, subtotal, discount, tax, total, status, valid_until, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        quote_number,
        lead_id    || null,
        contact_id || null,
        agent_id,
        JSON.stringify(enrichedItems),
        subtotal,
        Number(discount),
        Number(tax),
        total,
        status,
        valid_until || null,
        notes      || null,
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('[quotes crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── actualizar ────────────────────────────────────────────────────────────────
async function actualizar(req, res) {
  try {
    const {
      lead_id, contact_id, items,
      discount, tax, valid_until, notes, status
    } = req.body;

    // Obtener cotización actual para usar valores existentes si no se envían
    const cur = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
    const q = cur.rows[0];

    const newItems    = items    !== undefined ? items    : q.items;
    const newDiscount = discount !== undefined ? Number(discount) : Number(q.discount);
    const newTax      = tax      !== undefined ? Number(tax)      : Number(q.tax);

    const { subtotal, total } = calcularTotales(newItems, newDiscount, newTax);

    const enrichedItems = newItems.map(it => ({
      ...it,
      qty:        Number(it.qty || 1),
      unit_price: Number(it.unit_price || 0),
      total:      +(Number(it.qty || 1) * Number(it.unit_price || 0)).toFixed(2),
    }));

    const { rows } = await pool.query(
      `UPDATE quotes SET
        lead_id     = COALESCE($1, lead_id),
        contact_id  = COALESCE($2, contact_id),
        items       = $3,
        subtotal    = $4,
        discount    = $5,
        tax         = $6,
        total       = $7,
        status      = COALESCE($8, status),
        valid_until = COALESCE($9, valid_until),
        notes       = COALESCE($10, notes),
        updated_at  = NOW()
       WHERE id = $11 RETURNING *`,
      [
        lead_id    !== undefined ? (lead_id    || null) : null,
        contact_id !== undefined ? (contact_id || null) : null,
        JSON.stringify(enrichedItems),
        subtotal,
        newDiscount,
        newTax,
        total,
        status     || null,
        valid_until !== undefined ? (valid_until || null) : null,
        notes      !== undefined ? (notes      || null) : null,
        req.params.id,
      ]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[quotes actualizar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── eliminar ──────────────────────────────────────────────────────────────────
async function eliminar(req, res) {
  try {
    const { rows } = await pool.query(
      `DELETE FROM quotes WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[quotes eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── cambiarStatus ─────────────────────────────────────────────────────────────
async function cambiarStatus(req, res) {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status inválido. Opciones: ${allowed.join(', ')}` });
    }
    const { rows } = await pool.query(
      `UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[quotes cambiarStatus]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── generarPDF ────────────────────────────────────────────────────────────────
async function generarPDF(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT q.*,
              c.name    AS contact_name,
              c.email   AS contact_email,
              c.phone   AS contact_phone,
              c.company AS contact_company,
              l.title   AS lead_title
       FROM quotes q
       LEFT JOIN contacts c ON c.id = q.contact_id
       LEFT JOIN leads    l ON l.id = q.lead_id
       WHERE q.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cotización no encontrada' });

    const q = rows[0];
    const items = Array.isArray(q.items) ? q.items : [];

    const blue     = '#1877f2';
    const darkGray = '#1e293b';
    const lightGray = '#f8fafc';
    const mutedGray = '#64748b';

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);

      // ── Header ──
      doc.rect(0, 0, 595, 110).fill(blue);

      try {
        doc.image(LOGO_PATH, 40, 18, { height: 54, fit: [220, 54] });
      } catch {
        doc.fill('#ffffff').fontSize(22).font('Helvetica-Bold').text('CRM IA Propio', 50, 30);
      }

      doc.fill('#ffffff').fontSize(9).font('Helvetica').fillOpacity(0.8)
        .text('CRM IA Propio · info@empresa.com', 40, 78);
      doc.fillOpacity(1);

      // Marca de agua
      doc.fontSize(28).font('Helvetica-Bold').fillOpacity(0.18)
        .fill('#ffffff')
        .text('COTIZACIÓN', 300, 28, { align: 'right', width: 255 });
      doc.fillOpacity(1);

      // ── Info cotización (arriba derecha) ──
      doc.fill(darkGray).fontSize(10).font('Helvetica-Bold')
        .text('N° Cotización:', 370, 125)
        .text('Fecha:',        370, 142)
        .text('Válida hasta:', 370, 159);

      doc.font('Helvetica')
        .text(q.quote_number, 460, 125, { align: 'right', width: 85 })
        .text(new Date(q.created_at).toLocaleDateString('es'), 460, 142, { align: 'right', width: 85 })
        .text(q.valid_until
          ? new Date(q.valid_until + 'T00:00:00').toLocaleDateString('es')
          : '—', 460, 159, { align: 'right', width: 85 });

      // ── Bloque cliente ──
      doc.rect(50, 120, 270, 80).fill(lightGray).stroke('#e2e8f0');
      doc.fill(mutedGray).fontSize(9).font('Helvetica-Bold').text('CLIENTE', 62, 130);
      doc.fill(darkGray).fontSize(12).font('Helvetica-Bold')
        .text(q.contact_name || q.lead_title || 'Sin cliente', 62, 145);

      let yC = 162;
      if (q.contact_company) {
        doc.fontSize(10).font('Helvetica').fill(mutedGray).text(q.contact_company, 62, yC);
        yC += 14;
      }
      if (q.contact_email) {
        doc.fontSize(10).font('Helvetica').fill(mutedGray).text(q.contact_email, 62, yC);
        yC += 14;
      }
      if (q.contact_phone) {
        doc.fontSize(10).font('Helvetica').fill(mutedGray).text(q.contact_phone, 62, yC);
      }

      // ── Tabla de items ──
      const tableTop  = 222;
      const colDesc   = 50;
      const colQty    = 310;
      const colPrice  = 380;
      const colTotal  = 460;
      const tableW    = 495;

      // Encabezado tabla
      doc.rect(colDesc, tableTop, tableW, 24).fill(darkGray);
      doc.fill('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text('Descripción',   colDesc + 8, tableTop + 7)
        .text('Cant.',         colQty,      tableTop + 7, { width: 60,  align: 'center' })
        .text('Precio unit.',  colPrice,    tableTop + 7, { width: 70,  align: 'right'  })
        .text('Total',         colTotal,    tableTop + 7, { width: 85,  align: 'right'  });

      let yRow = tableTop + 24;
      items.forEach((item, i) => {
        const rowBg = i % 2 === 0 ? '#ffffff' : lightGray;
        doc.rect(colDesc, yRow, tableW, 22).fill(rowBg);
        doc.fill(darkGray).fontSize(10).font('Helvetica')
          .text(item.description || '—',                   colDesc + 8, yRow + 6, { width: 250 })
          .text(String(item.qty || 1),                      colQty,      yRow + 6, { width: 60,  align: 'center' })
          .text(`$${Number(item.unit_price || 0).toFixed(2)}`, colPrice, yRow + 6, { width: 70,  align: 'right'  })
          .text(`$${Number(item.total      || 0).toFixed(2)}`, colTotal, yRow + 6, { width: 85,  align: 'right'  });
        yRow += 22;
      });

      // Borde general tabla
      doc.rect(colDesc, tableTop, tableW, yRow - tableTop).stroke('#e2e8f0');

      // ── Totales ──
      yRow += 14;
      const totX = 370;

      doc.fill(mutedGray).fontSize(10).font('Helvetica')
        .text('Subtotal:', totX, yRow)
        .text(`$${Number(q.subtotal).toFixed(2)}`, totX + 80, yRow, { width: 95, align: 'right' });
      yRow += 18;

      if (Number(q.discount) > 0) {
        doc.text(`Descuento (${q.discount}%):`, totX, yRow)
          .text(`-$${(Number(q.subtotal) * Number(q.discount) / 100).toFixed(2)}`, totX + 80, yRow, { width: 95, align: 'right' });
        yRow += 18;
      }

      if (Number(q.tax) > 0) {
        const taxable = Number(q.subtotal) * (1 - Number(q.discount) / 100);
        doc.text(`Impuesto (${q.tax}%):`, totX, yRow)
          .text(`$${(taxable * Number(q.tax) / 100).toFixed(2)}`, totX + 80, yRow, { width: 95, align: 'right' });
        yRow += 18;
      }

      // Total final
      doc.rect(totX - 10, yRow - 4, 195, 28).fill(blue);
      doc.fill('#ffffff').fontSize(13).font('Helvetica-Bold')
        .text('TOTAL:', totX, yRow + 4)
        .text(`$${Number(q.total).toFixed(2)}`, totX + 80, yRow + 4, { width: 95, align: 'right' });

      yRow += 44;

      // ── Notas ──
      if (q.notes) {
        doc.fill(mutedGray).fontSize(9).font('Helvetica-Bold').text('NOTAS:', 50, yRow);
        yRow += 14;
        doc.fill(darkGray).fontSize(9).font('Helvetica').text(q.notes, 50, yRow, { width: 495 });
        yRow += 30;
      }

      // ── Validez ──
      if (q.valid_until) {
        const validStr = `Esta cotización es válida hasta el ${new Date(q.valid_until + 'T00:00:00').toLocaleDateString('es')}.`;
        doc.fill(mutedGray).fontSize(9).font('Helvetica-Oblique').text(validStr, 50, yRow, { width: 495 });
        yRow += 20;
      }

      // ── Footer ──
      const footerY = 770;
      doc.rect(0, footerY, 595, 72).fill(darkGray);
      doc.fill('#9ca3af').fontSize(8).font('Helvetica')
        .text('Gracias por su confianza.', 50, footerY + 10, { align: 'center', width: 495 })
        .text(`Cotización ${q.quote_number} · generada el ${new Date().toLocaleString('es')}`, 50, footerY + 24, { align: 'center', width: 495 })
        .text(`ID interno: QUO-${q.id}`, 50, footerY + 38, { align: 'center', width: 495 });

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const base64 = pdfBuffer.toString('base64');

    res.json({ pdf: base64, filename: `${q.quote_number}.pdf` });
  } catch (err) {
    console.error('[quotes generarPDF]', err.message);
    res.status(500).json({ error: 'Error generando PDF: ' + err.message });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, cambiarStatus, generarPDF };

/* ROUTES_TO_ADD_server.js
const quotes = require('./controllers/quotesController');
app.get('/api/quotes',              quotes.listar);
app.get('/api/quotes/:id',          quotes.obtener);
app.post('/api/quotes',             quotes.crear);
app.patch('/api/quotes/:id',        quotes.actualizar);
app.delete('/api/quotes/:id',       quotes.eliminar);
app.patch('/api/quotes/:id/status', quotes.cambiarStatus);
app.get('/api/quotes/:id/pdf',      quotes.generarPDF);
*/

/* API_METHODS_TO_ADD_api.js
quotes:           (params = '') => req('GET',    `/api/quotes${params}`),
quote:            (id)          => req('GET',    `/api/quotes/${id}`),
createQuote:      (data)        => req('POST',   '/api/quotes', data),
updateQuote:      (id, data)    => req('PATCH',  `/api/quotes/${id}`, data),
deleteQuote:      (id)          => req('DELETE', `/api/quotes/${id}`),
quoteStatus:      (id, status)  => req('PATCH',  `/api/quotes/${id}/status`, { status }),
quotePdf:         (id)          => req('GET',    `/api/quotes/${id}/pdf`),
*/
