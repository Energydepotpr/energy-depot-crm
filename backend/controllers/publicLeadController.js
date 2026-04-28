'use strict';
const path        = require('path');
const { pool }    = require('../services/db');
const { buildHTML } = require('../templates/propuesta.html.js');

// ─── Solar formula (Energy Depot PR — 1460 kWh/kW/año, $2150/kW, 0.26 $/kWh) ──
// months[] contiene kWh mensuales (lo que aparece en la factura LUMA)
function calcSolar(months) {
  const filled = (months || []).filter(v => Number(v) > 0).map(Number);
  if (filled.length < 1) return null;
  const avgKwh   = filled.reduce((a, b) => a + b, 0) / filled.length;
  const annCons  = Math.round(avgKwh * 12);
  const kwDC     = (annCons * 1.07) / 1460;
  const panels   = Math.round(kwDC * 1000 / 550);
  const systemKw = parseFloat(((panels * 550) / 1000).toFixed(2));
  const annProd  = Math.round(systemKw * 1460);
  const costBase = Math.round(systemKw * 2150);
  const annualSavings = Math.round(avgKwh * 0.26 * 12);
  const roi      = annualSavings > 0 ? Math.round(costBase / annualSavings) : 0;
  return { avg: Math.round(avgKwh), systemKw, panels, costBase, annualSavings, roi, annProd, annCons };
}

// PMT: Vega Coop 6.50%/15 años = 0.008711 | 4.99%/10 años = 0.010605
function pagoMensual(total, years, rate) {
  if (years === 15 && rate === 6.5)  return Math.round(total * 0.008711);
  if (years === 10 && rate === 4.99) return Math.round(total * 0.010605);
  const r = rate / 12 / 100;
  const n = years * 12;
  return Math.round(total * r / (1 - Math.pow(1 + r, -n)));
}

const fmt = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── POST /api/public/leads ───────────────────────────────────────────────────
async function createPublicLead(req, res) {
  try {
    const {
      name, email, phonenumber, address, city, zip,
      fuente, referido, meses = [], batteries, pagoLuz,
      propiedad, ingresos, credito, sistema, calc: clientCalc,
      source,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name requerido' });

    // Recalculate server-side (don't trust client calc)
    const calc = calcSolar(meses) || clientCalc || null;

    // Get default pipeline + first stage
    const pipR = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
    const pid  = pipR.rows[0]?.id || null;
    let sid = null;
    if (pid) {
      const stR = await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position LIMIT 1', [pid]);
      sid = stR.rows[0]?.id || null;
    }

    // Upsert contact
    let contactId = null;
    if (email || phonenumber) {
      const existing = await pool.query(
        `SELECT id FROM contacts WHERE email = $1 OR phone = $2 LIMIT 1`,
        [email || null, phonenumber || null]
      );
      if (existing.rows[0]) {
        contactId = existing.rows[0].id;
      } else {
        const cR = await pool.query(
          `INSERT INTO contacts (name, email, phone) VALUES ($1,$2,$3) RETURNING id`,
          [name, email || null, phonenumber || null]
        );
        contactId = cR.rows[0].id;
      }
    }

    const solarData = {
      meses,
      calc,
      batteries,
      pagoLuz,
      propiedad,
      ingresos,
      credito,
      sistema,
      fuente,
      referido,
      address,
      city,
      zip,
      email,
      telefono: phonenumber,
      submittedAt: new Date().toISOString(),
      source: source || 'cotizacion-web',
    };

    const title = `${name}${city ? ` — ${city}` : ''}`;
    const value = calc?.costBase || 0;

    const leadR = await pool.query(
      `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, value, solar_data)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [title, contactId, pid, sid, value, JSON.stringify(solarData)]
    );

    res.json({ ok: true, lead_id: leadR.rows[0].id });
  } catch (err) {
    console.error('[publicLead] crear:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── Shared: load lead data for proposal ─────────────────────────────────────
async function loadProposalData(leadId) {
  const leadR = await pool.query(
    `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
     FROM leads l
     LEFT JOIN contacts c ON c.id = l.contact_id
     WHERE l.id = $1`,
    [leadId]
  );
  if (!leadR.rows[0]) return null;

  const lead   = leadR.rows[0];
  const solar  = lead.solar_data || {};
  const calc   = solar.calc || calcSolar(solar.meses) || {};
  const meses  = solar.meses || [];

  const nombre  = lead.contact_name || lead.title;
  const email   = solar.email    || lead.contact_email || '';
  const tel     = solar.telefono || lead.contact_phone || '';
  const ciudad  = solar.city     || '';
  const zip     = solar.zip      || '';
  const pagoLuma = solar.pagoLuz || '';

  const batteries = Array.isArray(solar.batteries)
    ? solar.batteries
    : (solar.batteries ? [{ name: solar.batteries, qty: 1 }] : []);

  const BATT_PRICES = {
    'ESS SolaX Power 10.24 kWh': 11499,
    'ESS Solax Power 10.24kWh': 11499,
    'ESS SolaX Power 15.36 kWh': 14499,
    'ESS SolaX Power 20.48 kWh': 17499,
    'FranklinWH G2': 9999,
    'Tesla Powerwall 3': 12999,
    'Tesla PowerWall 3': 12999,
  };
  const battTotal  = batteries.reduce((s, b) => s + (b.unitPrice || BATT_PRICES[b.name] || 0) * (b.qty || 1), 0);
  const systemKw   = calc.systemKw || 0;
  const panels     = calc.panels   || 0;
  const costBase   = calc.costBase || 0;
  const subtotal   = costBase + battTotal;
  const credit30   = 0;
  const netCost    = subtotal;
  const annSav     = calc.annualSavings || 0;
  const roi        = calc.roi || 0;
  const annProd    = calc.annProd || Math.round(systemKw * 1460);
  const annCons    = calc.annCons || (calc.avg || 0) * 12;
  const offset     = annCons > 0 ? Math.min(Math.round(annProd / annCons * 100), 100) : 0;
  const pagoFV     = costBase > 0 ? pagoMensual(costBase, 15, 6.5) : 0;
  const pagoConBat = subtotal > 0 ? pagoMensual(subtotal, 15, 6.5) : 0;
  const today      = new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  const validUntil = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' }); })();
  const quoteNum   = `${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${lead.id.toString().padStart(4,'0')}`;

  return { nombre, email, tel, ciudad, zip, pagoLuma, batteries, BATT_PRICES,
           systemKw, panels, calc, meses, costBase, subtotal, credit30, netCost,
           annSav, roi, annProd, annCons, offset, pagoFV, pagoConBat,
           today, validUntil, quoteNum };
}

// ─── GET /api/leads/:id/propuesta/html — preview in browser ──────────────────
async function verPropuestaHTML(req, res) {
  try {
    const data = await loadProposalData(req.params.id);
    if (!data) return res.status(404).send('Lead no encontrado');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildHTML(data));
  } catch (err) {
    console.error('[propuesta HTML]', err.message);
    res.status(500).send('Error: ' + err.message);
  }
}

// ─── GET /api/leads/:id/propuesta ─────────────────────────────────────────────
async function generarPropuestaPDF(req, res) {
  try {
    const data = await loadProposalData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Lead no encontrado' });

    const puppeteer = require('puppeteer');
    const html = buildHTML(data);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    // Ensure CSS backgrounds and images are fully rendered
    await page.evaluate(() => document.fonts.ready);
    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      timeout: 60000,
    });
    await browser.close();

    const base64 = Buffer.from(pdfBuf).toString('base64');
    res.json({ pdf: base64, filename: `Propuesta-${data.quoteNum}.pdf` });
  } catch (err) {
    console.error('[propuesta PDF]', err.message);
    res.status(500).json({ error: 'Error generando propuesta: ' + err.message });
  }
}

module.exports = { createPublicLead, generarPropuestaPDF, verPropuestaHTML };
