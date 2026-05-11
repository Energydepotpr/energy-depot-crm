'use strict';
const path        = require('path');
const { pool }    = require('../services/db');
const { getConfigValue } = require('../services/configService');
const { buildHTML } = require('../templates/propuesta.html.js');

// ─── Solar formula (Energy Depot PR — 1460 kWh/kW/año, $2150/kW, 0.26 $/kWh) ──
// months[] contiene kWh mensuales (lo que aparece en la factura LUMA)
function calcSolar(months, pricing) {
  const p = pricing || { panelPrice: 1084, panelWatts: 550, factorProduccion: 1460, tarifaLuma: 0.26 };
  // Si hay 13 meses, usa los últimos 12 (excluye el más antiguo)
  const inputMonths = (months && months.length > 12) ? months.slice(-12) : (months || []);
  const filled = inputMonths.filter(v => Number(v) > 0).map(Number);
  if (filled.length < 1) return null;
  const avgKwh   = filled.reduce((a, b) => a + b, 0) / filled.length;
  const annCons  = Math.round(avgKwh * 12);
  let panels   = Math.round((annCons * 1.07) / p.factorProduccion * 1000 / p.panelWatts);
  if (panels % 2 !== 0) panels += 1; // siempre par
  const systemKw = parseFloat(((panels * p.panelWatts) / 1000).toFixed(2));
  const annProd  = Math.round(systemKw * p.factorProduccion);
  const costBase = Math.round(panels * p.panelPrice);
  const annualSavings = Math.round(avgKwh * p.tarifaLuma * 12);
  const roi      = annualSavings > 0 ? Math.round(costBase / annualSavings) : 0;
  return { avg: Math.round(avgKwh), systemKw, panels, costBase, annualSavings, roi, annProd, annCons };
}

async function loadPricingFromConfig() {
  try {
    const r = await pool.query(`SELECT value FROM config WHERE key = 'solar_pricing' LIMIT 1`);
    if (r.rows[0]?.value) {
      const v = typeof r.rows[0].value === 'string' ? JSON.parse(r.rows[0].value) : r.rows[0].value;
      return { panelPrice: 1084, panelWatts: 550, factorProduccion: 1460, tarifaLuma: 0.26, pmt15: 0.008711, ...v };
    }
  } catch {}
  return { panelPrice: 1084, panelWatts: 550, factorProduccion: 1460, tarifaLuma: 0.26, pmt15: 0.008711 };
}

async function loadBateriasCatalog() {
  try {
    const r = await pool.query(`SELECT value FROM config WHERE key = 'solar_batteries' LIMIT 1`);
    if (r.rows[0]?.value) {
      const v = typeof r.rows[0].value === 'string' ? JSON.parse(r.rows[0].value) : r.rows[0].value;
      if (Array.isArray(v)) return v;
    }
  } catch {}
  return [];
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

    // Construir nombre de cotización: "Cliente — Batería"
    const battSummary = Array.isArray(batteries) && batteries.length > 0
      ? batteries.filter(b => b?.qty > 0).map(b => `${b.qty > 1 ? b.qty + '× ' : ''}${b.name}`).join(' · ') || 'Sin batería'
      : 'Sin batería';
    const quotationName = `${name} — ${battSummary}`;

    // Crear quotation entry compatible con el formato del CRM
    const newQuotation = {
      id: 'q' + Math.random().toString(36).slice(2, 9),
      name: quotationName,
      createdAt: new Date().toISOString(),
      meses: meses || [],
      batteries: batteries || [],
    };

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
      quotations: [newQuotation],
      activeQuotationId: newQuotation.id,
    };

    const title = quotationName;
    const value = (calc?.costBase || 0) + (batteries || []).reduce((s, b) => s + (b?.unitPrice || 0) * (b?.qty || 0), 0);

    // Dedup: si el contacto ya tiene un lead abierto (no perdido/ganado), actualizar en vez de crear
    let leadId = null;
    let updated = false;
    if (contactId) {
      // Buscar lead abierto del contacto, O lead sin contact_id pero cuya solar_data.email/telefono coincida
      const existing = await pool.query(
        `SELECT id FROM leads
         WHERE (
           contact_id = $1
           OR ((contact_id IS NULL) AND (
                solar_data->>'email' = $2
             OR solar_data->>'telefono' = $3
           ))
         )
           AND (lost_reason IS NULL OR lost_reason = '')
         ORDER BY created_at DESC LIMIT 1`,
        [contactId, email || '', phonenumber || '']
      );
      if (existing.rows[0]) {
        leadId = existing.rows[0].id;
        // Merge solar_data — agregar nueva quotation a las existentes (NO sobrescribir title)
        const oldR = await pool.query(`SELECT solar_data, title, value FROM leads WHERE id = $1`, [leadId]);
        const oldRow = oldR.rows[0] || {};
        const oldSd = oldRow.solar_data || {};
        const oldQuotations = Array.isArray(oldSd.quotations) ? oldSd.quotations : [];
        const mergedSd = {
          ...oldSd,
          // Solo merge campos de identidad si el viejo NO los tenía (no sobrescribir)
          email: oldSd.email || solarData.email,
          telefono: oldSd.telefono || solarData.telefono,
          address: oldSd.address || solarData.address,
          city: oldSd.city || solarData.city,
          zip: oldSd.zip || solarData.zip,
          // Sí merge data nueva de cotización
          meses: solarData.meses,
          calc: solarData.calc,
          batteries: solarData.batteries,
          pagoLuz: solarData.pagoLuz,
          submittedAt: solarData.submittedAt,
          source: oldSd.source || solarData.source,
          quotations: [...oldQuotations, newQuotation],
          activeQuotationId: newQuotation.id,
        };
        // Mantener el title viejo (no sobrescribir con el nuevo nombre del form)
        const keepTitle = oldRow.title || title;
        // Value: usar el mayor (cotización con más equipos)
        const keepValue = Math.max(Number(oldRow.value || 0), Number(value || 0));
        await pool.query(
          `UPDATE leads SET title = $1, value = $2, solar_data = $3, updated_at = NOW()
           WHERE id = $4`,
          [keepTitle, keepValue, JSON.stringify(mergedSd), leadId]
        );
        updated = true;
      }
    }

    if (!leadId) {
      const leadSource = source || 'autocotizar-web';
      const leadR = await pool.query(
        `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, value, solar_data, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [title, contactId, pid, sid, value, JSON.stringify(solarData), leadSource]
      );
      leadId = leadR.rows[0].id;
    }

    // Anti-abuso: máx 10 cotizaciones por lead
    const checkR = await pool.query(`SELECT solar_data FROM leads WHERE id = $1`, [leadId]);
    const sd = checkR.rows[0]?.solar_data || {};
    const qCount = Array.isArray(sd.quotations) ? sd.quotations.length : 0;
    if (qCount > 10) {
      return res.status(429).json({ error: 'Has alcanzado el límite de cotizaciones para este cliente. Contacta a un asesor: 787-627-8585.' });
    }

    // Token simple para sesión cliente (sha256 del lead_id + secret)
    const crypto = require('crypto');
    const SECRET = process.env.PUBLIC_LEAD_SECRET || 'energy-depot-public-2026';
    const token = crypto.createHash('sha256').update(`${leadId}-${SECRET}`).digest('hex').slice(0, 32);

    res.json({ ok: true, lead_id: leadId, token, updated });
  } catch (err) {
    console.error('[publicLead] crear:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── Shared: load lead data for proposal ─────────────────────────────────────
async function loadProposalData(leadId, quotationId) {
  const leadR = await pool.query(
    `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
     FROM leads l
     LEFT JOIN contacts c ON c.id = l.contact_id
     WHERE l.id = $1`,
    [leadId]
  );
  if (!leadR.rows[0]) return null;

  const lead   = leadR.rows[0];
  const sd     = lead.solar_data || {};
  // Si se pidió una cotización específica, sobreescribe meses/batteries con las suyas
  let solar = sd;
  let quotationName = null;
  let activeQuotation = null;
  if (Array.isArray(sd.quotations) && sd.quotations.length > 0) {
    const targetId = quotationId || sd.activeQuotationId;
    const q = sd.quotations.find(x => x.id === targetId) || sd.quotations[0];
    if (q) {
      activeQuotation = q;
      quotationName = q.name || null;
      const qMeses = (Array.isArray(q.meses) && q.meses.some(v => Number(v) > 0)) ? q.meses : sd.meses;
      const qBatts = (Array.isArray(q.batteries) && q.batteries.length > 0) ? q.batteries : sd.batteries;
      solar = { ...sd, meses: qMeses, batteries: qBatts };
    }
  }
  const descuentoPct = Math.max(0, Math.min(100, Number(activeQuotation?.descuentoPct ?? sd.descuentoPct ?? 0)));
  const pricing = await loadPricingFromConfig();
  const calc   = (quotationId ? calcSolar(solar.meses, pricing) : null) || sd.calc || calcSolar(solar.meses, pricing) || {};
  const meses  = solar.meses || [];

  const nombre  = lead.contact_name || lead.title;
  const email   = solar.email    || lead.contact_email || '';
  const tel     = solar.telefono || lead.contact_phone || '';
  const ciudad  = solar.city     || '';
  const zip     = solar.zip      || '';
  // pagoLuma: SIEMPRE recompute desde avg de meses disponibles × tarifa LUMA actual del settings
  // (ignora el valor viejo guardado para que cambios de tarifa se reflejen al regenerar PDF)
  let pagoLuma = '';
  if (Array.isArray(solar.meses)) {
    const filledM = solar.meses.map(Number).filter(v => v > 0);
    if (filledM.length) {
      const avg = filledM.reduce((a,b) => a+b, 0) / filledM.length;
      pagoLuma = Math.round(avg * (pricing.tarifaLuma || 0.26));
    }
  }
  if (!pagoLuma) pagoLuma = solar.pagoLuz || '';

  let batteries = Array.isArray(solar.batteries)
    ? solar.batteries
    : (solar.batteries ? [{ name: solar.batteries, qty: 1 }] : []);

  // Si la batería no tiene description guardada, busca en el catálogo de Settings
  const battCatalog = await loadBateriasCatalog();
  batteries = batteries.map(b => {
    if (b.description) return b;
    const found = battCatalog.find(c => c.name === b.name);
    return found?.description ? { ...b, description: found.description } : b;
  });

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
  const subtotalRaw = costBase + battTotal;
  const descuentoAmt = Math.round(subtotalRaw * descuentoPct / 100);
  const subtotal   = subtotalRaw - descuentoAmt; // total final con descuento
  const credit30   = 0;
  const netCost    = subtotal;
  const annSav     = calc.annualSavings || 0;
  const roi        = calc.roi || 0;
  const annProd    = calc.annProd || Math.round(systemKw * 1460);
  const annCons    = calc.annCons || (calc.avg || 0) * 12;
  const offset     = annCons > 0 ? Math.round(annProd / annCons * 100) : 0;
  const pagoFV     = costBase > 0 ? pagoMensual(costBase, 15, 6.5) : 0;
  const pagoConBat = subtotal > 0 ? pagoMensual(subtotal, 15, 6.5) : 0;
  const today      = new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
  const validUntil = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' }); })();
  const quoteNum   = `${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${lead.id.toString().padStart(4,'0')}`;

  const panelPrice = panels > 0 ? +(costBase / panels).toFixed(2) : 1184;
  const panelWatts = panels > 0 && systemKw > 0 ? Math.round((systemKw * 1000) / panels) : 550;
  // Si no hay quotationName explícito, construir uno: "Cliente · Batería"
  let displayQuotationName = quotationName;
  if (!displayQuotationName) {
    const battSummary = (batteries || []).filter(b => b?.qty > 0)
      .map(b => `${b.qty > 1 ? b.qty + '× ' : ''}${b.name}`).join(' · ') || 'Sin batería';
    displayQuotationName = `${nombre} — ${battSummary}`;
  }

  // mesLabels: del quotation activo si tiene
  const mesLabels = (activeQuotation?.mesLabels && activeQuotation.mesLabels.length)
    ? activeQuotation.mesLabels
    : (sd.mesLabels || null);

  return { nombre, email, tel, ciudad, zip, pagoLuma, batteries, BATT_PRICES,
           systemKw, panels, panelPrice, panelWatts,
           calc, meses, mesLabels, tarifaLuma: pricing.tarifaLuma,
           costBase, subtotal, credit30, netCost,
           annSav, roi, annProd, annCons, offset, pagoFV, pagoConBat,
           today, validUntil, quoteNum, quotationName: displayQuotationName,
           descuentoPct, descuentoAmt };
}

// ─── GET /api/leads/:id/propuesta/html — preview in browser ──────────────────
async function verPropuestaHTML(req, res) {
  try {
    const data = await loadProposalData(req.params.id, req.query.quotation_id);
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
    const data = await loadProposalData(req.params.id, req.query.quotation_id);
    if (!data) return res.status(404).json({ error: 'Lead no encontrado' });

    const { generatePDF } = require('../services/puppeteerPool');
    const html = buildHTML(data);
    const pdfBuf = await generatePDF(html);

    const base64 = Buffer.from(pdfBuf).toString('base64');
    const safe = s => String(s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
    const clientePart = safe(data.nombre);
    const bateriaPart = safe((data.batteries || []).filter(b => b?.qty > 0).map(b => `${b.qty > 1 ? b.qty + 'x' : ''}${b.name}`).join('-')) || 'Sin-bateria';
    const filename = `Cotizacion-${clientePart || 'Cliente'}-${bateriaPart}.pdf`;
    res.json({ pdf: base64, filename });
  } catch (err) {
    console.error('[propuesta PDF]', err.message);
    res.status(500).json({ error: 'Error generando propuesta: ' + err.message });
  }
}

// Public: genera PDF + opcionalmente lo envía por correo desde info@energydepotpr.com
// Body: { action: 'email' | 'download', email? }
async function publicPropuestaAction(req, res) {
  try {
    const leadId = Number(req.params.id);
    const { action, email } = req.body || {};
    if (!leadId) return res.status(400).json({ error: 'lead_id requerido' });
    if (!['email','download'].includes(action)) return res.status(400).json({ error: 'action inválido' });

    // Solo permitir si el lead fue creado en las últimas 24 horas (anti-abuso)
    const r = await pool.query(`SELECT id, contact_id, created_at FROM leads WHERE id = $1`, [leadId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const ageHours = (Date.now() - new Date(r.rows[0].created_at).getTime()) / 3600000;
    if (ageHours > 24) return res.status(403).json({ error: 'Acción no disponible para este lead' });

    const data = await loadProposalData(leadId);
    if (!data) return res.status(404).json({ error: 'Lead no encontrado' });

    const { generatePDF } = require('../services/puppeteerPool');
    const html = buildHTML(data);
    const pdfBuf = await generatePDF(html);

    const base64 = Buffer.from(pdfBuf).toString('base64');
    const safe = s => String(s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
    const clientePart = safe(data.nombre);
    const bateriaPart = safe((data.batteries || []).filter(b => b?.qty > 0).map(b => `${b.qty > 1 ? b.qty + 'x' : ''}${b.name}`).join('-')) || 'Sin-bateria';
    const filename = `Cotizacion-${clientePart || 'Cliente'}-${bateriaPart}.pdf`;

    if (action === 'download') {
      return res.json({ ok: true, pdf: base64, filename });
    }

    // action === 'email'
    const to = (email || data.email || '').trim();
    if (!to) return res.status(400).json({ error: 'email requerido' });

    const { sendEmail } = require('../services/gmailService');
    const autoBcc = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');
    // TODO(empresa_info): merge config.empresa_info (JSON: name/phone/email/address...) sobre
    // los valores hardcoded de abajo ("Energy Depot LLC", "787-627-8585", "info@energydepotpr.com").
    // Por ahora se deja literal porque está embebido en el template HTML del email; refactor pendiente.
    await sendEmail({
      from: '"Energy Depot LLC" <info@energydepotpr.com>',
      to,
      bcc: autoBcc,
      subject: `Tu propuesta solar — Energy Depot${data.nombre ? ' · ' + data.nombre : ''}`,
      text: `Hola ${data.nombre || ''},\n\nAdjuntamos tu propuesta solar personalizada en PDF.\n\nCualquier duda contáctanos al 787-627-8585.\n\n— Energy Depot LLC`,
      html: `<div style="font-family: Arial, sans-serif; max-width:560px; margin:0 auto; padding:24px;">
        <h2 style="color:#1a3c8f; margin:0 0 12px;">Hola ${data.nombre || ''},</h2>
        <p style="color:#374151; line-height:1.6;">Aquí tienes tu <strong>propuesta solar personalizada</strong> en PDF.</p>
        <p style="color:#374151; line-height:1.6;">Si tienes preguntas, escríbenos a <a href="mailto:info@energydepotpr.com">info@energydepotpr.com</a> o llámanos al <strong>787-627-8585</strong>.</p>
        <p style="margin-top:24px; color:#6b7280; font-size:13px;">— Energy Depot LLC</p>
      </div>`,
      attachments: [{ filename, mimeType: 'application/pdf', content: base64 }],
    });

    res.json({ ok: true, sent: true, to });
  } catch (err) {
    console.error('[publicPropuestaAction]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/public/leads/:id/session?token=xxx — devuelve cotizaciones del lead (sesión cliente)
async function publicLeadLookup(req, res) {
  try {
    const leadId = Number(req.params.id);
    const token = String(req.query.token || '');
    if (!leadId || !token) return res.status(400).json({ error: 'lead_id y token requeridos' });

    const crypto = require('crypto');
    const SECRET = process.env.PUBLIC_LEAD_SECRET || 'energy-depot-public-2026';
    const expected = crypto.createHash('sha256').update(`${leadId}-${SECRET}`).digest('hex').slice(0, 32);
    if (token !== expected) return res.status(403).json({ error: 'Token inválido' });

    const r = await pool.query(
      `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
       FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id WHERE l.id = $1`,
      [leadId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = r.rows[0];
    const sd = lead.solar_data || {};
    const quotations = (sd.quotations || []).map(q => ({
      id: q.id, name: q.name, createdAt: q.createdAt,
      meses: q.meses || [],
      batteries: (q.batteries || []).map(b => ({ name: b.name, qty: b.qty })),
      descuentoPct: q.descuentoPct || 0,
    }));
    res.json({
      ok: true,
      lead_id: lead.id,
      contact_name: lead.contact_name || '',
      email: sd.email || lead.contact_email || '',
      phone: sd.telefono || lead.contact_phone || '',
      address: sd.address || '',
      city: sd.city || '',
      meses: sd.meses || [],
      mesLabels: sd.mesLabels || null,
      quotations,
    });
  } catch (e) {
    console.error('[publicLeadLookup]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/public/leads/:id/propuesta?token=xxx&q=xxx → renderiza la propuesta como HTML público
async function publicPropuestaHTML(req, res) {
  try {
    const leadId = Number(req.params.id);
    const token = String(req.query.token || '');
    const quotationId = req.query.q || req.query.quotation_id;
    if (!leadId || !token) return res.status(400).send('Link inválido');
    const crypto = require('crypto');
    const SECRET = process.env.PUBLIC_LEAD_SECRET || 'energy-depot-public-2026';
    const expected = crypto.createHash('sha256').update(`${leadId}-${SECRET}`).digest('hex').slice(0, 32);
    if (token !== expected) return res.status(403).send('Link inválido o expirado');

    const data = await loadProposalData(leadId, quotationId);
    if (!data) return res.status(404).send('Propuesta no encontrada');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildHTML(data));
  } catch (e) {
    console.error('[publicPropuestaHTML]', e.message);
    res.status(500).send('Error generando propuesta');
  }
}

// GET /api/leads/:id/share-link → devuelve URL pública firmada (auth)
async function getShareLink(req, res) {
  try {
    const leadId = Number(req.params.id);
    const quotationId = req.query.quotation_id;
    const crypto = require('crypto');
    const SECRET = process.env.PUBLIC_LEAD_SECRET || 'energy-depot-public-2026';
    const token = crypto.createHash('sha256').update(`${leadId}-${SECRET}`).digest('hex').slice(0, 32);
    const baseFront = process.env.PUBLIC_FRONTEND_URL || `https://crm-energydepotpr.com`;
    const qParam = quotationId ? `&q=${encodeURIComponent(quotationId)}` : '';
    const url = `${baseFront}/p/${leadId}?token=${token}${qParam}`;
    res.json({ ok: true, token, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { createPublicLead, generarPropuestaPDF, verPropuestaHTML, publicPropuestaAction, publicLeadLookup, publicPropuestaHTML, getShareLink };
