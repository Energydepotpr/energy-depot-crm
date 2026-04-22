'use strict';
const PDFDocument = require('pdfkit');
const path        = require('path');
const { pool }    = require('../services/db');

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

// ─── Solar formula (Puerto Rico 4.5 peak sun hours) ──────────────────────────
function calcSolar(months) {
  const filled = (months || []).filter(v => Number(v) > 0).map(Number);
  if (filled.length < 1) return null;
  const avg      = filled.reduce((a, b) => a + b, 0) / filled.length;
  const daily    = avg / 30;
  const systemKw = parseFloat(((daily / 4.5) * 1.25).toFixed(1));
  const panels   = Math.ceil(systemKw / 0.4);
  const costBase = Math.round(systemKw * 2800);
  const annualSavings = Math.round(avg * 12 * 0.27);
  const roi      = Math.round(costBase / annualSavings);
  return { avg: Math.round(avg), systemKw, panels, costBase, annualSavings, roi };
}

function pagoMensual(total, years, rate) {
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
          `INSERT INTO contacts (name, email, phone, city) VALUES ($1,$2,$3,$4) RETURNING id`,
          [name, email || null, phonenumber || null, city || null]
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

// ─── GET /api/leads/:id/propuesta ─────────────────────────────────────────────
async function generarPropuestaPDF(req, res) {
  try {
    const leadR = await pool.query(
      `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
       FROM leads l
       LEFT JOIN contacts c ON c.id = l.contact_id
       WHERE l.id = $1`,
      [req.params.id]
    );
    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });

    const lead   = leadR.rows[0];
    const solar  = lead.solar_data || {};
    const calc   = solar.calc || calcSolar(solar.meses) || {};
    const meses  = solar.meses || [];

    const nombre = lead.contact_name || lead.title;
    const email  = solar.email  || lead.contact_email || '';
    const tel    = solar.telefono || lead.contact_phone || '';
    const ciudad = solar.city   || '';
    const zip    = solar.zip    || '';
    const dir    = solar.address || '';
    const sistema = solar.sistema || 'Solar';
    const pagoLuma = solar.pagoLuz || '';

    const batteries = Array.isArray(solar.batteries)
      ? solar.batteries
      : (solar.batteries ? [{ name: solar.batteries, qty: 1 }] : []);

    // Prices
    const BATT_PRICES = {
      'ESS SolaX Power 10.24 kWh': 11499,
      'ESS Solax Power 10.24kWh': 11499,
      'ESS SolaX Power 15.36 kWh': 14499,
      'ESS SolaX Power 20.48 kWh': 17499,
      'FranklinWH G2': 9999,
      'Tesla Powerwall 3': 12999,
      'Tesla PowerWall 3': 12999,
    };
    const battTotal = batteries.reduce((s, b) => {
      const price = b.unitPrice || BATT_PRICES[b.name] || 0;
      return s + price * (b.qty || 1);
    }, 0);

    const systemKw  = calc.systemKw || 0;
    const panels    = calc.panels || 0;
    const costBase  = calc.costBase || 0;
    const subtotal  = costBase + battTotal;
    const credit30  = Math.round(subtotal * 0.3);
    const netCost   = subtotal - credit30;
    const annSav    = calc.annualSavings || 0;
    const roi       = calc.roi || 0;
    const annProd   = Math.round(systemKw * 4.5 * 365);
    const annCons   = (calc.avg || 0) * 12;
    const offset    = annCons > 0 ? Math.min(Math.round(annProd / annCons * 100), 100) : 0;
    const pagoFV    = subtotal > 0 ? pagoMensual(subtotal, 15, 6.5) : 0;
    const pagoConBat = netCost > 0 ? pagoMensual(netCost, 15, 6.5) : 0;
    const today     = new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
    const validUntil = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' }); })();
    const quoteNum  = `${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${lead.id.toString().padStart(4,'0')}`;

    // ── Colors ──
    const BLUE    = '#1877f2';
    const DARK    = '#0f172a';
    const GRAY    = '#f1f5f9';
    const MUTED   = '#64748b';
    const GREEN   = '#16a34a';
    const W       = 595;  // A4 width pts

    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);

      // ═══════════════════════════════════════════════
      // PÁGINA 1 — PORTADA
      // ═══════════════════════════════════════════════
      // Dark background
      doc.rect(0, 0, W, 842).fill(DARK);

      // Blue accent circle top-right
      doc.circle(W + 60, -60, 220).fill(BLUE).fillOpacity(0.2);
      doc.circle(-60, 700, 160).fill(BLUE).fillOpacity(0.12);
      doc.fillOpacity(1);

      // Logo
      try {
        doc.image(LOGO_PATH, 50, 50, { height: 40, fit: [180, 40] });
      } catch {
        doc.fill('#fff').fontSize(18).font('Helvetica-Bold').text('ENERGY DEPOT PR', 50, 55);
      }

      // Label
      doc.fill('rgba(255,255,255,0.4)').fontSize(9).font('Helvetica')
        .text(`PROPUESTA PERSONALIZADA · ${quoteNum}`, 50, 140, { letterSpacing: 2 });

      // Greeting
      doc.fill('rgba(255,255,255,0.55)').fontSize(13).font('Helvetica')
        .text(`¡Hola, ${nombre.split(' ')[0]}!`, 50, 165);

      // Main headline
      doc.fill('#ffffff').fontSize(34).font('Helvetica-Bold')
        .text('Esta es la propuesta que\npuede cambiar la forma\nen que tu hogar', 50, 188, { lineGap: 4 });
      doc.fill(BLUE).fontSize(34).font('Helvetica-Bold')
        .text('vive la energía.', 50, 302);

      // Tagline
      doc.fill('rgba(255,255,255,0.6)').fontSize(13).font('Helvetica')
        .text('Una inversión diseñada según tu consumo real, para darte\nEnergía Estable, Control y Tranquilidad.', 50, 360, { lineGap: 3, width: 450 });

      // Meta row
      let mx = 50;
      const metaItems = [ciudad ? `${ciudad}, PR ${zip}` : 'Puerto Rico', tel, email, today].filter(Boolean);
      doc.fill('rgba(255,255,255,0.35)').fontSize(9).font('Helvetica');
      metaItems.forEach((m, i) => {
        doc.text(m, mx, 430);
        mx += doc.widthOfString(m) + 20;
        if (i < metaItems.length - 1) {
          doc.fill('rgba(255,255,255,0.15)').text('·', mx - 12, 430);
          doc.fill('rgba(255,255,255,0.35)');
        }
      });

      // Footer bar
      doc.rect(0, 790, W, 52).fill('#0a0f1e');
      doc.fill('rgba(255,255,255,0.25)').fontSize(8).font('Helvetica')
        .text('Energy Depot PR LLC · energydepotpr.com · (787) 627-8585 · info@energydepotpr.com', 50, 810, { align: 'center', width: W - 100 });

      // ═══════════════════════════════════════════════
      // PÁGINA 2 — COMPARACIÓN ACTUAL vs OFERTA
      // ═══════════════════════════════════════════════
      doc.addPage();
      doc.rect(0, 0, W, 842).fill('#fff');

      // Header stripe
      doc.rect(0, 0, W, 72).fill(BLUE);
      doc.fill('#fff').fontSize(18).font('Helvetica-Bold')
        .text('Compara tu situación actual vs nuestra oferta', 40, 22, { width: W - 80 });
      doc.fill('rgba(255,255,255,0.7)').fontSize(9).font('Helvetica')
        .text('Esta propuesta fue creada según tu historial de consumo y tu selección de respaldo energético.', 40, 48, { width: W - 80 });

      let y = 98;

      // 3 comparison cards
      const cards = [
        {
          label: 'Tu pago actual de luz',
          value: pagoLuma || `~${fmt(Math.round(annSav / 12))}/mes`,
          sub: 'Pago variable que sigue aumentando cada año.',
          blue: false,
          rec: false,
        },
        {
          label: 'Solo Placas Solares',
          value: pagoFV > 0 ? `${fmt(pagoFV)}/mes` : '—',
          sub: 'Pago fijo que reemplaza tu factura. (15 años · 6.50%)',
          blue: false,
          rec: false,
        },
        {
          label: 'Placas + Batería',
          value: pagoConBat > 0 ? `${fmt(pagoConBat)}/mes` : '—',
          sub: 'Elimina factura y apagones. (15 años · 6.50% tras incentivo 30%)',
          blue: true,
          rec: true,
        },
      ];

      const cw = (W - 80 - 20) / 3;
      cards.forEach((card, i) => {
        const cx = 40 + i * (cw + 10);
        if (card.blue) {
          doc.rect(cx, y, cw, 120).fill('#eff6ff').stroke(BLUE);
          doc.fill(BLUE).fontSize(8).font('Helvetica-Bold')
            .text('RECOMENDADO', cx, y - 8, { width: cw, align: 'center' });
        } else {
          doc.rect(cx, y, cw, 120).fill(GRAY).stroke('#e2e8f0');
        }
        doc.fill(MUTED).fontSize(9).font('Helvetica-Bold')
          .text(card.label.toUpperCase(), cx + 12, y + 14, { width: cw - 24, letterSpacing: 0.5 });
        doc.fill(card.blue ? BLUE : DARK).fontSize(20).font('Helvetica-Bold')
          .text(card.value, cx + 12, y + 34, { width: cw - 24 });
        doc.fill(MUTED).fontSize(9).font('Helvetica')
          .text(card.sub, cx + 12, y + 68, { width: cw - 24, lineGap: 2 });
      });

      y += 140;

      // Stats bar: consumo / producción / cobertura
      doc.rect(40, y, W - 80, 64).fill(DARK);
      const sw = (W - 80) / 3;
      [
        [annCons.toLocaleString() + ' kWh', 'Consumo anual actual'],
        [annProd.toLocaleString() + ' kWh', 'Producción anual promedio'],
        [offset + '%', 'Cobertura de tu consumo'],
      ].forEach(([val, lbl], i) => {
        const sx = 40 + i * sw;
        if (i > 0) doc.moveTo(sx, y + 12).lineTo(sx, y + 52).stroke('rgba(255,255,255,0.12)');
        doc.fill('#fff').fontSize(18).font('Helvetica-Bold')
          .text(val, sx + 20, y + 12, { width: sw - 20 });
        doc.fill('rgba(255,255,255,0.45)').fontSize(9).font('Helvetica')
          .text(lbl, sx + 20, y + 36, { width: sw - 20 });
      });

      y += 90;

      // Why it makes sense
      doc.fill(DARK).fontSize(14).font('Helvetica-Bold').text('¿Por qué esto tiene sentido?', 40, y);
      y += 22;

      const benefits = [
        ['Respaldo en Apagones', 'Luces y equipos encendidos incluso cuando se va la luz.'],
        ['Ahorro Económico', 'Pago fijo que reemplaza una factura que nunca para.'],
        ['Protección ante aumentos', 'Te blindas ante futuros aumentos de LUMA.'],
        ['Valor de propiedad', 'Incremento de 4%-6% sobre la tasación de mercado.'],
        ['Garantías reales', 'Equipos certificados con garantías de fabricantes.'],
        ['Energía Limpia', 'Reduces tu huella de carbono y apoyas al medioambiente.'],
      ];
      const bw = (W - 80 - 12) / 2;
      benefits.forEach((b, i) => {
        const bx = 40 + (i % 2) * (bw + 12);
        const by = y + Math.floor(i / 2) * 56;
        doc.rect(bx, by, bw, 48).fill(GRAY);
        doc.rect(bx, by, 4, 48).fill(BLUE);
        doc.fill(DARK).fontSize(11).font('Helvetica-Bold').text(b[0], bx + 14, by + 8, { width: bw - 20 });
        doc.fill(MUTED).fontSize(9).font('Helvetica').text(b[1], bx + 14, by + 24, { width: bw - 20 });
      });

      // Footer
      doc.rect(0, 810, W, 32).fill('#0a0f1e');
      doc.fill('rgba(255,255,255,0.25)').fontSize(7).font('Helvetica')
        .text(`Propuesta ${quoteNum} · Energy Depot PR LLC · energydepotpr.com`, 40, 820, { align: 'center', width: W - 80 });

      // ═══════════════════════════════════════════════
      // PÁGINA 3 — SISTEMA + DESGLOSE FINANCIERO
      // ═══════════════════════════════════════════════
      doc.addPage();
      doc.rect(0, 0, W, 842).fill('#fff');

      // Header
      doc.rect(0, 0, W, 72).fill(DARK);
      doc.fill('#fff').fontSize(18).font('Helvetica-Bold')
        .text('Tu sistema solar recomendado', 40, 18, { width: W - 80 });
      doc.fill(BLUE).fontSize(9).font('Helvetica-Bold')
        .text('¿QUÉ SISTEMA TE RECOMENDAMOS Y POR QUÉ?', 40, 48, { letterSpacing: 1.5 });

      y = 90;

      // System dark box
      doc.rect(40, y, W - 80, 90).fill(DARK);
      doc.fill('rgba(255,255,255,0.4)').fontSize(8).font('Helvetica-Bold')
        .text('CARACTERÍSTICAS DEL SISTEMA SOLAR', 60, y + 12, { letterSpacing: 1.5 });

      const specs = [
        [panels + ' paneles', 'Módulos 400W'],
        [systemKw + ' kW DC', 'Capacidad del sistema'],
        [Math.round(annProd / 12).toLocaleString() + ' kWh', 'Producción mensual'],
        [roi + ' años', 'Retorno de inversión'],
      ];
      const sw2 = (W - 100) / 4;
      specs.forEach(([val, lbl], i) => {
        const sx = 60 + i * sw2;
        if (i > 0) doc.moveTo(sx, y + 26).lineTo(sx, y + 78).stroke('rgba(255,255,255,0.1)');
        doc.fill('#fff').fontSize(20).font('Helvetica-Bold').text(val, sx, y + 28, { width: sw2 - 10 });
        doc.fill('rgba(255,255,255,0.4)').fontSize(8).font('Helvetica').text(lbl, sx, y + 54, { width: sw2 - 10 });
      });

      if (batteries.length > 0) {
        y += 98;
        doc.rect(40, y, W - 80, 36).fill('#1e293b');
        doc.fill('rgba(255,255,255,0.4)').fontSize(8).font('Helvetica-Bold')
          .text('SISTEMA DE ALMACENAMIENTO SELECCIONADO', 60, y + 6, { letterSpacing: 1 });
        const battNames = batteries.map(b => `${b.qty > 1 ? b.qty + '× ' : ''}${b.name}`).join('  ·  ');
        doc.fill('rgba(255,255,255,0.8)').fontSize(11).font('Helvetica-Bold')
          .text(battNames, 60, y + 18, { width: W - 120 });
        y += 50;
      } else {
        y += 100;
      }

      // Desglose tabla
      doc.fill(DARK).fontSize(13).font('Helvetica-Bold').text('Desglose de inversión', 40, y);
      y += 18;

      // Table header
      doc.rect(40, y, W - 80, 24).fill(DARK);
      doc.fill('#fff').fontSize(9).font('Helvetica-Bold')
        .text('Descripción', 52, y + 8)
        .text('Cant.', 330, y + 8, { width: 50, align: 'center' })
        .text('Precio unit.', 390, y + 8, { width: 80, align: 'right' })
        .text('Total', 478, y + 8, { width: 77, align: 'right' });
      y += 24;

      // Row: solar system
      doc.rect(40, y, W - 80, 36).fill(GRAY);
      doc.fill(DARK).fontSize(11).font('Helvetica-Bold')
        .text(`Sistema solar fotovoltaico ${systemKw} kW`, 52, y + 6, { width: 270 });
      doc.fill(MUTED).fontSize(8).font('Helvetica')
        .text(`${panels} paneles 400W · inversor · estructura · instalación · permisos LUMA`, 52, y + 20, { width: 270 });
      doc.fill(DARK).fontSize(11).font('Helvetica')
        .text('1', 330, y + 12, { width: 50, align: 'center' })
        .text(fmt(costBase), 390, y + 12, { width: 80, align: 'right' })
        .text(fmt(costBase), 478, y + 12, { width: 77, align: 'right' });
      y += 36;

      // Battery rows
      batteries.forEach((b, i) => {
        const price = b.unitPrice || BATT_PRICES[b.name] || 0;
        doc.rect(40, y, W - 80, 36).fill(i % 2 === 0 ? '#fff' : GRAY);
        doc.fill(DARK).fontSize(11).font('Helvetica-Bold').text(b.name, 52, y + 6, { width: 270 });
        doc.fill(MUTED).fontSize(8).font('Helvetica').text('Sistema de almacenamiento de energía', 52, y + 20, { width: 270 });
        doc.fill(DARK).fontSize(11).font('Helvetica')
          .text(String(b.qty || 1), 330, y + 12, { width: 50, align: 'center' })
          .text(fmt(price), 390, y + 12, { width: 80, align: 'right' })
          .text(fmt(price * (b.qty || 1)), 478, y + 12, { width: 77, align: 'right' });
        y += 36;
      });

      // Subtotal / Credit / Total
      doc.moveTo(40, y).lineTo(W - 40, y).stroke('#e2e8f0');
      y += 6;

      doc.fill(MUTED).fontSize(11).font('Helvetica')
        .text('Subtotal', 390, y, { width: 80 })
        .text(fmt(subtotal), 478, y, { width: 77, align: 'right' });
      y += 18;

      doc.fill(GREEN).fontSize(11).font('Helvetica-Bold')
        .text('Crédito Federal 25D (30%)', 300, y, { width: 170 })
        .text(`(${fmt(credit30)})`, 478, y, { width: 77, align: 'right' });
      y += 12;

      // Total box
      doc.rect(40, y, W - 80, 30).fill(BLUE);
      doc.fill('#fff').fontSize(13).font('Helvetica-Bold')
        .text('TOTAL TRAS INCENTIVO FEDERAL', 52, y + 8, { width: 380 })
        .text(fmt(netCost), 390, y + 8, { width: 165, align: 'right' });
      y += 42;

      // Financial summary grid
      const fgw = (W - 80 - 15) / 3;
      const fgItems = [
        ['Ahorro mensual est.', fmt(Math.round(annSav / 12))],
        ['Ahorro anual est.', fmt(annSav)],
        ['Retorno de inversión', `${roi} años`],
      ];
      fgItems.forEach((fg, i) => {
        const fx = 40 + i * (fgw + 7.5);
        doc.rect(fx, y, fgw, 46).fill(i === 0 ? DARK : GRAY);
        doc.fill(i === 0 ? 'rgba(255,255,255,0.5)' : MUTED).fontSize(8).font('Helvetica').text(fg[0], fx + 12, y + 8, { width: fgw - 20 });
        doc.fill(i === 0 ? '#fff' : DARK).fontSize(16).font('Helvetica-Bold').text(fg[1], fx + 12, y + 22, { width: fgw - 20 });
      });
      y += 62;

      // Months table if available
      const filledMonths = meses.filter(v => Number(v) > 0);
      if (filledMonths.length >= 3) {
        doc.fill(DARK).fontSize(11).font('Helvetica-Bold').text('Historial de consumo LUMA (kWh)', 40, y);
        y += 14;
        const mw = (W - 80) / 13;
        meses.forEach((v, i) => {
          const mx2 = 40 + i * mw;
          doc.rect(mx2, y, mw - 2, 36).fill(Number(v) > 0 ? GRAY : '#f9fafb').stroke('#e2e8f0');
          doc.fill(MUTED).fontSize(7).font('Helvetica-Bold').text(`M${i + 1}`, mx2 + 2, y + 4, { width: mw - 6, align: 'center' });
          doc.fill(Number(v) > 0 ? DARK : '#cbd5e1').fontSize(9).font('Helvetica-Bold')
            .text(Number(v) > 0 ? String(v) : '—', mx2 + 2, y + 18, { width: mw - 6, align: 'center' });
        });
        y += 50;
        doc.fill(MUTED).fontSize(9).font('Helvetica')
          .text(`Promedio mensual: ${calc.avg} kWh  ·  Consumo diario estimado: ${(calc.avg / 30).toFixed(1)} kWh`, 40, y);
        y += 20;
      }

      // Legal note
      const legalY = Math.max(y + 10, 660);
      doc.rect(40, legalY, W - 80, 100).fill(GRAY);
      doc.fill(MUTED).fontSize(7).font('Helvetica')
        .text(
          'El historial de consumo debe ser obtenido de su factura provista por LUMA. El cálculo de generación de kWh es basado en la información provista por el cliente. ' +
          'La instalación incluye el sistema de almacenamiento hasta 10\' del medidor; el excedente tiene un costo adicional de $3.33/pie. ' +
          'Los equipos pueden variar sujeto a disponibilidad. El Crédito 25D aplica a residencias primarias/secundarias, consulte su asesor fiscal. ' +
          'Cotización válida por 30 días. Financiamiento ejemplo Vega Coop al 6.50%, sujeto a aprobación. Precio no incluye remoción de AC, cisternas u otras obstrucciones.',
          52, legalY + 8,
          { width: W - 104, lineGap: 2 }
        );

      // ═══════════════════════════════════════════════
      // PÁGINA 4 — CTA
      // ═══════════════════════════════════════════════
      doc.addPage();
      doc.rect(0, 0, W, 842).fill(BLUE);
      doc.circle(W + 80, -80, 280).fill('#1251b5').fillOpacity(0.5);
      doc.circle(-80, 842 + 80, 220).fill('#1251b5').fillOpacity(0.4);
      doc.fillOpacity(1);

      doc.fill('#fff').fontSize(32).font('Helvetica-Bold')
        .text('Tu decisión inteligente\ncomienza hoy.', 60, 180, { lineGap: 6, width: W - 120 });
      doc.fill('rgba(255,255,255,0.75)').fontSize(14).font('Helvetica')
        .text(
          'No se trata solo de energía. Se trata de proteger tu hogar, tu familia y tu tranquilidad.\nEl próximo paso es simple. Nosotros te acompañamos.',
          60, 290, { lineGap: 4, width: W - 120 }
        );

      // Contact items
      const contacts = [
        ['🌐', 'energydepotpr.com'],
        ['✉', 'info@energydepotpr.com'],
        ['📞', '(787) 627-8585'],
      ];
      contacts.forEach((c, i) => {
        doc.fill('rgba(255,255,255,0.9)').fontSize(14).font('Helvetica-Bold')
          .text(`${c[0]}  ${c[1]}`, 60, 380 + i * 32, { width: W - 120 });
      });

      try {
        doc.image(LOGO_PATH, 60, 680, { height: 36, fit: [160, 36], opacity: 0.35 });
      } catch {}

      doc.fill('rgba(255,255,255,0.3)').fontSize(8).font('Helvetica')
        .text(
          `Propuesta ${quoteNum} · ${today} · Válida hasta ${validUntil}\nGLOBAL PLAZA 322 SUITE 204 CLL JOHN A. ERNOT, SAN JUAN, PR 00920`,
          60, 750, { align: 'center', width: W - 120, lineGap: 3 }
        );

      doc.end();
    });

    const buf    = Buffer.concat(chunks);
    const base64 = buf.toString('base64');
    res.json({ pdf: base64, filename: `Propuesta-${quoteNum}.pdf` });
  } catch (err) {
    console.error('[propuesta PDF]', err.message);
    res.status(500).json({ error: 'Error generando propuesta: ' + err.message });
  }
}

module.exports = { createPublicLead, generarPropuestaPDF };
