'use strict';
const path        = require('path');
const { pool }    = require('../services/db');
const { getConfigValue } = require('../services/configService');
const { buildHTML } = require('../templates/propuesta.html.js');
const { buildModernEmail } = require('../templates/emailModerno');

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
  let panels   = Math.round(annCons / p.factorProduccion * 1000 / p.panelWatts);
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
      quotation_id,        // si viene → REEMPLAZAR esa quotation (Feature 2: editar)
      quotations: multiQuotations, // si viene array → crear N cotizaciones (Feature 1)
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

    // Helper para resumen de batería
    const battSummaryOf = (bs) => Array.isArray(bs) && bs.length > 0
      ? (bs.filter(b => b?.qty > 0).map(b => `${b.qty > 1 ? b.qty + '× ' : ''}${b.name}`).join(' · ') || 'Sin batería')
      : 'Sin batería';

    const newId = () => 'q' + Math.random().toString(36).slice(2, 9);

    // Construir lista de nuevas cotizaciones a guardar
    let newQuotations;
    if (Array.isArray(multiQuotations) && multiQuotations.length > 0) {
      newQuotations = multiQuotations.map(q => {
        const qBatts = q.batteries || [];
        const qMeses = (Array.isArray(q.meses) && q.meses.length) ? q.meses : (meses || []);
        const qCalc  = q.calc || calcSolar(qMeses) || clientCalc || null;
        return {
          id: newId(),
          name: q.name || `${name} — ${battSummaryOf(qBatts)}`,
          createdAt: new Date().toISOString(),
          meses: qMeses,
          batteries: qBatts,
          calc: qCalc,
        };
      });
    } else {
      newQuotations = [{
        id: newId(),
        name: `${name} — ${battSummaryOf(batteries)}`,
        createdAt: new Date().toISOString(),
        meses: meses || [],
        batteries: batteries || [],
      }];
    }
    const newQuotation = newQuotations[newQuotations.length - 1]; // compat
    const quotationName = newQuotation.name;

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
      quotations: newQuotations,
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
        // Feature 2: si viene quotation_id y existe → REEMPLAZAR esa quotation
        let mergedQuotations;
        let mergedActiveId;
        if (quotation_id && oldQuotations.find(q => q.id === quotation_id)) {
          const replacement = { ...newQuotations[0], id: quotation_id };
          mergedQuotations = oldQuotations.map(q => q.id === quotation_id ? replacement : q);
          mergedActiveId = quotation_id;
        } else {
          mergedQuotations = [...oldQuotations, ...newQuotations];
          mergedActiveId = newQuotation.id;
        }
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
          quotations: mergedQuotations,
          activeQuotationId: mergedActiveId,
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

    // IDs reales que quedaron persistidos (replace mantiene id original; append usa nuevos)
    const persistedR = await pool.query(`SELECT solar_data FROM leads WHERE id = $1`, [leadId]);
    const persistedSd = persistedR.rows[0]?.solar_data || {};
    const allIds = (persistedSd.quotations || []).map(q => q.id);
    let quotation_ids;
    if (quotation_id && allIds.includes(quotation_id)) {
      quotation_ids = [quotation_id];
    } else {
      // últimas N (cantidad creada)
      quotation_ids = allIds.slice(-newQuotations.length);
    }
    res.json({ ok: true, lead_id: leadId, token, updated, quotation_ids });
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
    const { action, email, quotation_ids } = req.body || {};
    if (!leadId) return res.status(400).json({ error: 'lead_id requerido' });
    if (!['email','download'].includes(action)) return res.status(400).json({ error: 'action inválido' });

    // Solo permitir si el lead fue creado en las últimas 24 horas (anti-abuso)
    const r = await pool.query(`SELECT id, contact_id, created_at FROM leads WHERE id = $1`, [leadId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const ageHours = (Date.now() - new Date(r.rows[0].created_at).getTime()) / 3600000;
    if (ageHours > 24) return res.status(403).json({ error: 'Acción no disponible para este lead' });

    const { generatePDF } = require('../services/puppeteerPool');
    const safe = s => String(s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
    const buildPdfFor = async (qid) => {
      const data = await loadProposalData(leadId, qid);
      if (!data) return null;
      const html = buildHTML(data);
      const pdfBuf = await generatePDF(html);
      const base64 = Buffer.from(pdfBuf).toString('base64');
      const clientePart = safe(data.nombre);
      const bateriaPart = safe((data.batteries || []).filter(b => b?.qty > 0).map(b => `${b.qty > 1 ? b.qty + 'x' : ''}${b.name}`).join('-')) || 'Sin-bateria';
      const filename = `Cotizacion-${clientePart || 'Cliente'}-${bateriaPart}.pdf`;
      return { pdf: base64, filename, data };
    };

    // Multi-quotation mode (Feature 1)
    if (Array.isArray(quotation_ids) && quotation_ids.length > 1) {
      const results = [];
      for (const qid of quotation_ids) {
        const r2 = await buildPdfFor(qid);
        if (r2) results.push(r2);
      }
      if (!results.length) return res.status(404).json({ error: 'Sin cotizaciones' });

      if (action === 'download') {
        return res.json({ ok: true, pdfs: results.map(r2 => ({ pdf: r2.pdf, filename: r2.filename })) });
      }
      // email — un solo correo con N adjuntos
      const firstData = results[0].data;
      const to = (email || firstData.email || '').trim();
      if (!to) return res.status(400).json({ error: 'email requerido' });
      const { sendEmail } = require('../services/gmailService');
      const autoBcc = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');
      const options = results.map((r2, i) => {
        const batt = (r2.data?.baterias?.[0]?.name) || null;
        return batt ? `Opción ${String.fromCharCode(65 + i)} — ${batt}` : `Opción ${String.fromCharCode(65 + i)} — Sistema solar`;
      });
      const mail = await buildModernEmail({ name: firstData.nombre, email: to, count: results.length, options, getConfigValue });
      await sendEmail({
        from: '"Energy Depot LLC" <info@energydepotpr.com>',
        to,
        bcc: autoBcc,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: results.map(r2 => ({ filename: r2.filename, mimeType: 'application/pdf', content: r2.pdf })),
      });
      return res.json({ ok: true, sent: true, to, count: results.length });
    }

    // Single quotation (modo legacy / compat)
    const onlyId = Array.isArray(quotation_ids) ? quotation_ids[0] : undefined;
    const single = await buildPdfFor(onlyId);
    if (!single) return res.status(404).json({ error: 'Lead no encontrado' });
    const { pdf: base64, filename, data } = single;

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
    const battName = data?.baterias?.[0]?.name;
    const singleOptions = battName ? [`Sistema solar + ${battName}`] : ['Tu propuesta solar personalizada'];
    const mailSingle = await buildModernEmail({ name: data.nombre, email: to, count: 1, options: singleOptions, getConfigValue });
    await sendEmail({
      from: '"Energy Depot LLC" <info@energydepotpr.com>',
      to,
      bcc: autoBcc,
      subject: mailSingle.subject,
      text: mailSingle.text,
      html: mailSingle.html,
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
      batteries: (q.batteries || []).map(b => ({ name: b.name, qty: b.qty, unitPrice: b.unitPrice })),
      calc: q.calc || null,
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
