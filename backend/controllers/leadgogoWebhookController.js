// leadgogoWebhookController.js — Recibe eventos en tiempo real de Leadgogo
// (contact.created, communication-interaction.received) y los refleja en el CRM.

const { pool } = require('../services/db');
const lg = require('../services/leadgogoApi');
const sse = require('../services/sse');

// Secret simple en la URL para validar que el webhook viene de nuestra config
const WEBHOOK_SECRET = process.env.LEADGOGO_WEBHOOK_SECRET || 'edpr-lg-hook-2026';

async function getPipelineStage() {
  const pip = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
  const pipId = pip.rows[0]?.id || null;
  const stage = pipId
    ? (await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id=$1 ORDER BY position LIMIT 1', [pipId])).rows[0]
    : null;
  return { pipId, stageId: stage?.id || null };
}

// Mapea source name de Leadgogo → utm_source normalizado
function normalizeSource(name) {
  const x = (name || '').toLowerCase();
  if (/facebook|fb/.test(x)) return 'facebook';
  if (/instagram|ig/.test(x)) return 'instagram';
  if (/google|adwords/.test(x)) return 'google';
  if (/tiktok/.test(x)) return 'tiktok';
  if (/787|tel|phone|llamada|call/.test(x)) return 'telefono';
  return x || null;
}

// ── contact.created → crea lead con atribución ──────────────────────────────
async function handleContactCreated(contactRef) {
  const contactId = contactRef?.id || contactRef;
  if (!contactId) return;

  // Traer detalle completo del contacto
  let c;
  try { c = await lg.getContact(contactId); }
  catch (e) { console.error('[LG webhook] getContact', e.message); return; }

  const nombre = c.first_name && c.last_name ? `${c.first_name} ${c.last_name}`
               : c.first_name || c.last_name || `LG-${contactId}`;
  const phone = c.primary_phone?.e164 || c.primary_phone?.national || c.secondary_phone?.e164 || null;
  const email = c.primary_email || null;

  // Resolver nombres de source/campaign para atribución
  const srcName = await lg.sourceName(c.source?.id);
  const campName = await lg.campaignName(c.campaign?.id);
  const utmSource = normalizeSource(srcName);
  const utmCampaign = campName || null;

  // Si ya existe (lo creó el polling viejo), solo ENRIQUECER atribución faltante
  const dup = await pool.query(`SELECT id, utm_source, utm_campaign FROM leads WHERE source='leadgogo' AND title LIKE $1 LIMIT 1`, [`%LG-${contactId}%`]);
  if (dup.rows.length) {
    const d = dup.rows[0];
    if ((!d.utm_source && utmSource) || (!d.utm_campaign && utmCampaign)) {
      await pool.query(
        `UPDATE leads SET utm_source = COALESCE(utm_source,$1), utm_medium = COALESCE(utm_medium,$2), utm_campaign = COALESCE(utm_campaign,$3) WHERE id=$4`,
        [utmSource, srcName ? 'social' : null, utmCampaign, d.id]
      );
      console.log(`[LG webhook] lead ${d.id} enriquecido src=${utmSource} camp=${utmCampaign}`);
    }
    return;
  }

  const { pipId, stageId } = await getPipelineStage();

  // Contacto en nuestra DB
  let contacto = (await pool.query(`SELECT * FROM contacts WHERE name=$1 LIMIT 1`, [nombre])).rows[0];
  if (!contacto) {
    contacto = (await pool.query(
      `INSERT INTO contacts (name, phone, email, source) VALUES ($1,$2,$3,'leadgogo') RETURNING *`,
      [nombre, phone, email]
    )).rows[0];
  } else {
    if (phone && !contacto.phone) await pool.query(`UPDATE contacts SET phone=$1 WHERE id=$2`, [phone, contacto.id]);
    if (email && !contacto.email) await pool.query(`UPDATE contacts SET email=$1 WHERE id=$2`, [email, contacto.id]);
  }

  const lead = (await pool.query(
    `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source, utm_source, utm_medium, utm_campaign)
     VALUES ($1,$2,$3,$4,'leadgogo',$5,$6,$7) RETURNING *`,
    [`LG-${contactId} — ${nombre}`, contacto.id, pipId, stageId, utmSource, srcName ? 'social' : null, utmCampaign]
  )).rows[0];

  await pool.query(
    `INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Leadgogo','#8b5cf6') ON CONFLICT (lead_id, tag) DO NOTHING`,
    [lead.id]
  ).catch(() => {});
  await pool.query(
    `INSERT INTO alerts (lead_id, type, message) VALUES ($1,'leadgogo',$2)`,
    [lead.id, `Nuevo lead Leadgogo — ${nombre}${campName ? ` (${campName})` : ''}`]
  ).catch(() => {});
  sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });
  console.log(`[LG webhook] lead creado ${lead.id} (${nombre}) src=${utmSource} camp=${utmCampaign}`);
}

// ── communication-interaction.received → adjunta mensaje al lead ────────────
async function handleInteraction(payload) {
  const contactId = payload?.contact_id || payload?.contact?.id;
  if (!contactId) return;
  const leadR = await pool.query(`SELECT id, contact_id FROM leads WHERE source='leadgogo' AND title LIKE $1 LIMIT 1`, [`%LG-${contactId}%`]);
  let lead = leadR.rows[0];
  if (!lead) { await handleContactCreated({ id: contactId }); return; } // crea si no existe

  // Texto del mensaje
  let text = '';
  if (payload.content?.fields) {
    text = payload.content.fields.map(f => `${f.label || f.key}: ${f.value}`).join('\n');
  } else if (typeof payload.content === 'string') {
    text = payload.content;
  } else if (payload.content?.text || payload.content?.body) {
    text = payload.content.text || payload.content.body;
  }
  if (!text) text = `[${payload.channel || 'mensaje'}]`;

  await pool.query(
    `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'leadgogo')`,
    [lead.id, lead.contact_id, text]
  ).catch(e => console.error('[LG webhook] msg', e.message));
  sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });
}

// ── Endpoint principal del webhook ──────────────────────────────────────────
async function receive(req, res) {
  // Validar secret en la URL
  if (req.params.secret !== WEBHOOK_SECRET) return res.status(403).json({ error: 'forbidden' });
  // Responder 200 rápido (Leadgogo reintenta si tarda) y procesar async
  res.json({ ok: true });

  try {
    const body = req.body || {};
    const event = body.event || body.type || '';
    const data = body.data || body.payload || body;
    console.log('[LG webhook] evento:', event);

    if (event === 'contact.created') {
      await handleContactCreated(data.contact || data);
    } else if (event === 'communication-interaction.received' || event === 'communication-interaction.sent') {
      await handleInteraction(data.interaction || data);
    }
  } catch (e) {
    console.error('[LG webhook] error procesando:', e.message);
  }
}

module.exports = { receive };
