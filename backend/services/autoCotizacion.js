'use strict';
/**
 * Auto-cotización: cuando llega un mensaje inbound con una imagen/PDF (foto de
 * factura LUMA por WhatsApp/SMS) este módulo:
 *   1) Descarga el media (Twilio URL → base64).
 *   2) Llama a Claude Haiku (mismo SYSTEM_PROMPT de extractFacturaController).
 *   3) Si extrae meses válidos, guarda en solar_data, genera cotización + PDF,
 *      manda por email + WhatsApp con media_url y notifica al equipo.
 *   4) Pausa la secuencia welcome con motivo `cotizacion_enviada`.
 */

const axios = require('axios');
const { pool } = require('./db');
const { getConfigValue } = require('./configService');
const { pauseSequence } = require('./sequenceEngine');

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de facturas de LUMA Energy en Puerto Rico.
Devuelve SOLO un JSON con: meses (array 13 números kWh cronológicos), nombre, cuenta_luma, direccion, email, telefono.
Si no es factura LUMA o no encuentras datos, devuelve meses=[0,0,0,0,0,0,0,0,0,0,0,0,0].
Formato: {"meses":[...],"nombre":null,"cuenta_luma":null,"direccion":null,"email":null,"telefono":null}`;

async function downloadTwilioMedia(url) {
  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOK = process.env.TWILIO_AUTH_TOKEN;
  const r = await axios.get(url, {
    auth: SID && TOK ? { username: SID, password: TOK } : undefined,
    responseType: 'arraybuffer',
    timeout: 30000,
    maxRedirects: 5,
  });
  const contentType = r.headers['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(r.data).toString('base64');
  return { base64, contentType };
}

async function extractFromMedia(base64, mime) {
  const apiKey = process.env.ANTHROPIC_API_KEY_COTIZAR || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');
  const isPdf = mime === 'application/pdf';
  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mime || 'image/jpeg', data: base64 } };
  const r = await axios.post('https://api.anthropic.com/v1/messages', {
    model: HAIKU_MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: 'Extrae JSON.' }] }],
  }, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    timeout: 60000,
  });
  const text = (r.data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  const clean = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '').trim();
  return JSON.parse(clean);
}

/**
 * Procesa media de un mensaje inbound. mediaUrls: [{url, contentType}, ...]
 * Devuelve { ok, quotation_id, calc } o { ok:false, reason }.
 */
async function tryAutoCotizar({ leadId, mediaUrls }) {
  if (!Array.isArray(mediaUrls) || !mediaUrls.length) return { ok: false, reason: 'no_media' };
  // Tomar el primer media que sea imagen o PDF
  const media = mediaUrls.find(m => /^image\//.test(m.contentType) || m.contentType === 'application/pdf');
  if (!media) return { ok: false, reason: 'media_no_compatible' };

  try {
    console.log(`[autoCotizacion] lead=${leadId} descargando media ${media.contentType}`);
    const { base64, contentType } = await downloadTwilioMedia(media.url);
    const parsed = await extractFromMedia(base64, contentType);
    const meses = Array.isArray(parsed.meses) ? parsed.meses.map(v => Math.max(0, Math.round(Number(v) || 0))) : [];
    const valid = meses.filter(v => v > 0);
    if (valid.length < 1) {
      console.log(`[autoCotizacion] lead=${leadId} sin meses válidos — no es factura LUMA o ilegible`);
      return { ok: false, reason: 'no_meses' };
    }

    // Calc + guardar quotation usando la lógica de publicLeadController
    const { calcSolar, _ } = pickCalcSolar();
    const calc = calcSolar(meses);
    if (!calc) return { ok: false, reason: 'calc_failed' };

    const leadR = await pool.query(
      `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
       FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id WHERE l.id=$1`,
      [leadId]
    );
    if (!leadR.rows[0]) return { ok: false, reason: 'lead_missing' };
    const lead = leadR.rows[0];
    const sd = lead.solar_data || {};
    const qId = 'q' + Math.random().toString(36).slice(2, 9);
    const nombre = lead.contact_name || parsed.nombre || lead.title || 'Cliente';
    const newQuotation = {
      id: qId,
      name: `${nombre} — Auto (factura por WhatsApp)`,
      createdAt: new Date().toISOString(),
      meses,
      batteries: [],
      calc,
    };
    const quotations = Array.isArray(sd.quotations) ? [...sd.quotations, newQuotation] : [newQuotation];
    const newSd = {
      ...sd,
      meses: sd.meses?.length ? sd.meses : meses,
      calc: sd.calc || calc,
      address: sd.address || parsed.direccion || '',
      cuenta_luma: sd.cuenta_luma || parsed.cuenta_luma || '',
      source: sd.source || 'auto-wa-factura',
      quotations,
      activeQuotationId: qId,
      auto_cotizacion_at: new Date().toISOString(),
    };
    await pool.query(
      `UPDATE leads SET solar_data=$1, value=GREATEST(COALESCE(value,0), $2), updated_at=NOW() WHERE id=$3`,
      [JSON.stringify(newSd), calc.costBase || 0, leadId]
    );

    // Generar PDF
    const { loadProposalData } = pickProposalLoader();
    const { buildHTML } = require('../templates/propuesta.html.js');
    const { generatePDF } = require('./puppeteerPool');
    const data = await loadProposalData(leadId, qId);
    const pdfBuf = await generatePDF(buildHTML(data));
    const base64Pdf = Buffer.from(pdfBuf).toString('base64');
    const filename = `Cotizacion-${(data.nombre || 'Cliente').replace(/[^\w-]+/g, '-')}.pdf`;

    // Enviar email al cliente con PDF (si tiene email)
    const cliEmail = data.email;
    if (cliEmail) {
      try {
        const { sendEmail } = require('./gmailService');
        const autoBcc = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');
        await sendEmail({
          from: '"Energy Depot LLC" <info@energydepotpr.com>',
          to: cliEmail,
          bcc: autoBcc || undefined,
          subject: `${data.nombre}, aquí está tu cotización solar ☀️`,
          text: `Hola ${data.nombre},\n\nAdjunto encuentras tu cotización personalizada basada en tu factura LUMA.\nSistema recomendado: ${data.systemKw}kW con ${data.panels} paneles.\nPago mensual estimado: $${data.pagoFV}/mes.\n\nCualquier pregunta, contéstanos este correo o llámanos al 787-627-8585.\n\nEquipo Energy Depot LLC`,
          html: `<p>Hola ${data.nombre},</p><p>Adjunto encuentras tu cotización personalizada basada en tu factura LUMA.</p><ul><li>Sistema recomendado: <b>${data.systemKw}kW</b> con <b>${data.panels}</b> paneles</li><li>Pago mensual estimado: <b>$${data.pagoFV}/mes</b></li></ul><p>Cualquier pregunta, contéstanos este correo o llama 787-627-8585.</p><p>Equipo Energy Depot LLC</p>`,
          attachments: [{ filename, mimeType: 'application/pdf', content: base64Pdf }],
        });
      } catch (e) {
        console.warn('[autoCotizacion] email cliente falló:', e.message);
      }
    }

    // Enviar WhatsApp con resumen + (opcional) link a propuesta pública
    const phone = data.tel;
    if (phone) {
      try {
        const { enviarWhatsApp } = require('./twilioService');
        const crypto = require('crypto');
        const SECRET = process.env.PUBLIC_LEAD_SECRET || 'energy-depot-public-2026';
        const token = crypto.createHash('sha256').update(`${leadId}-${SECRET}`).digest('hex').slice(0, 32);
        const baseFront = process.env.PUBLIC_FRONTEND_URL || 'https://crm-energydepotpr.com';
        const propUrl = `${baseFront}/p/${leadId}?token=${token}&q=${qId}`;
        const pagoLuma = data.pagoLuma || Math.round((calc.avg || 0) * 0.26);
        const primer_nombre = String(data.nombre || 'amigo').trim().split(/\s+/)[0];
        const msg = `¡Listo ${primer_nombre}! 🌞 Aquí tienes tu cotización personalizada según tu consumo. Te recomiendo un sistema de ${data.systemKw}kW con ${data.panels} paneles.\n\nPago mensual estimado: $${data.pagoFV}/mes (vs $${pagoLuma}/mes que pagas ahora a LUMA).\n\nVer propuesta completa: ${propUrl}\n\nCualquier pregunta, contéstame este mensaje.`;
        await enviarWhatsApp(phone, msg);
      } catch (e) {
        console.warn('[autoCotizacion] WhatsApp cliente falló:', e.message);
      }
    }

    // Alert + email al equipo
    try {
      await pool.query(
        `INSERT INTO alerts (lead_id, type, title, message, seen) VALUES ($1,'info',$2,$3,false)`,
        [leadId, '⚡ Cotización auto-enviada', `Auto-cotización generada para ${nombre} desde factura LUMA por WhatsApp. Sistema ${calc.systemKw}kW · $${calc.costBase}`]
      ).catch(async () => {
        // fallback si schema de alerts no tiene title
        await pool.query(
          `INSERT INTO alerts (lead_id, type, message) VALUES ($1,'info',$2)`,
          [leadId, `⚡ Cotización auto-enviada a ${nombre} (${calc.systemKw}kW · $${calc.costBase})`]
        ).catch(() => {});
      });
      const notifyTo = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');
      if (notifyTo) {
        const { sendEmail } = require('./gmailService');
        await sendEmail({
          from: '"Energy Depot CRM" <info@energydepotpr.com>',
          to: notifyTo,
          subject: `⚡ Auto-cotización enviada a ${nombre}`,
          text: `Se generó y envió cotización automática a ${nombre} desde factura LUMA recibida por WhatsApp.\nSistema: ${calc.systemKw}kW · ${calc.panels} paneles · $${calc.costBase}.\nLead #${leadId}`,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[autoCotizacion] notify equipo falló:', e.message);
    }

    await pauseSequence(leadId, 'cotizacion_enviada');
    console.log(`[autoCotizacion] lead=${leadId} cotización auto OK qId=${qId}`);
    return { ok: true, quotation_id: qId, calc };
  } catch (e) {
    console.error(`[autoCotizacion] lead=${leadId} error:`, e.message);
    return { ok: false, reason: 'error', error: e.message };
  }
}

// ─── Helpers para reusar la lógica del publicLeadController sin importar circular
function pickCalcSolar() {
  const mod = require('../controllers/publicLeadController');
  return {
    calcSolar: mod.calcSolar || _internalCalcSolar,
  };
}
function pickProposalLoader() {
  const mod = require('../controllers/publicLeadController');
  return { loadProposalData: mod.loadProposalData || _internalLoadProposalData };
}

// Reimplementación local fallback (en caso que publicLeadController no exporte calcSolar)
function _internalCalcSolar(months) {
  const p = { panelPrice: 1084, panelWatts: 550, factorProduccion: 1460, tarifaLuma: 0.26 };
  const inputMonths = (months && months.length > 12) ? months.slice(-12) : (months || []);
  const filled = inputMonths.filter(v => Number(v) > 0).map(Number);
  if (filled.length < 1) return null;
  const avgKwh = filled.reduce((a, b) => a + b, 0) / filled.length;
  const annCons = Math.round(avgKwh * 12);
  const panels = 2 * Math.ceil(((avgKwh / 30 / 4.5) * 1000 / p.panelWatts) / 2);
  const systemKw = parseFloat(((panels * p.panelWatts) / 1000).toFixed(2));
  const annProd = Math.round(panels * 2.5 * 365);
  const costBase = Math.round(panels * p.panelPrice);
  const annualSavings = Math.round(avgKwh * p.tarifaLuma * 12);
  const roi = annualSavings > 0 ? Math.round(costBase / annualSavings) : 0;
  return { avg: Math.round(avgKwh), systemKw, panels, costBase, annualSavings, roi, annProd, annCons };
}
async function _internalLoadProposalData() { throw new Error('loadProposalData no exportado desde publicLeadController'); }

module.exports = { tryAutoCotizar };
