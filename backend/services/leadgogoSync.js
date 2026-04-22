const { pool } = require('./db');
const sse = require('./sse');

const LEADGOGO_API = 'https://web-api.services.leadgogo.com/v1';
const INSTITUTION_ID = parseInt(process.env.LEADGOGO_INSTITUTION_ID || '3475');
const LEADGOGO_USER = process.env.LEADGOGO_USER || 'Rock';
const LEADGOGO_PASS = process.env.LEADGOGO_PASS || 'Rock123!';

let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch(`${LEADGOGO_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: LEADGOGO_USER, password: LEADGOGO_PASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Leadgogo login failed');
  _token = data.token;
  _tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return _token;
}

async function graphql(query, variables = {}) {
  const token = await getToken();
  const res = await fetch(`${LEADGOGO_API}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

async function getConfig(key, defaultVal) {
  const r = await pool.query(`SELECT value FROM config WHERE key=$1 LIMIT 1`, [key]);
  return r.rows[0] ? r.rows[0].value : defaultVal;
}

async function setConfig(key, value) {
  await pool.query(
    `INSERT INTO config (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
    [key, String(value)]
  );
}

async function getPipelineStage() {
  const pip = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
  const pipId = pip.rows[0]?.id || null;
  const stage = pipId
    ? (await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id=$1 ORDER BY position LIMIT 1', [pipId])).rows[0]
    : null;
  return { pipId, stageId: stage?.id || null };
}

function parseFbAdFields(fields = []) {
  const result = { phone: null, email: null, notes: [] };
  for (const f of fields) {
    const key = (f.key || '').toLowerCase();
    const val = (f.value || '').trim();
    const label = f.label || f.key || '';
    if (!val || val.startsWith('<test lead')) continue;
    if (key.includes('tel') || key.includes('phone') || key === 'teléfono' || key === 'telefono') {
      result.phone = val.replace(/\D/g, '').length >= 7 ? val : null;
    } else if (key.includes('email') || key.includes('correo')) {
      result.email = val.includes('@') ? val : null;
    } else {
      result.notes.push(`${label}: ${val}`);
    }
  }
  return result;
}

// Parse phone/email from message content text (Messenger/Instagram form responses)
function parseMessageContent(content = '') {
  let phone = null, email = null;
  const phoneMatch = content.match(/(?:Phone number|Teléfono|Tel)[:\s]+([+\d\s()\-]{7,})/i);
  if (phoneMatch) phone = phoneMatch[1].trim();
  const emailMatch = content.match(/(?:Email|Correo)[:\s]+([^\s\n]+@[^\s\n]+)/i);
  if (emailMatch) email = emailMatch[1].trim();
  return { phone, email };
}

const CHANNEL_LABEL = {
  ContactInteractionFacebookAd: 'Facebook Lead Ad',
  ContactInteractionWhatsapp: 'WhatsApp',
  ContactInteractionSms: 'SMS',
  ContactInteractionFacebookMessenger: 'Facebook Messenger',
  ContactInteractionInstagram: 'Instagram',
  ContactInteractionPhoneCall: 'Llamada',
  ContactInteractionEmail: 'Email',
  ContactInteractionInPerson: 'Presencial',
};

const INTERACTION_FRAGMENT = `
  __typename
  ... on ContactInteractionFacebookAd {
    id createdAt
    campaign { id name }
    fields { key value label }
    contact { id fullName firstName lastName }
  }
  ... on ContactInteractionWhatsapp {
    id createdAt direction
    message { id content type }
    contact { id fullName firstName lastName }
    channel { id name }
  }
  ... on ContactInteractionSms {
    id createdAt direction
    message { id content type }
    contact { id fullName firstName lastName }
    channel { id name }
  }
  ... on ContactInteractionFacebookMessenger {
    id createdAt direction
    message { id content type }
    contact { id fullName firstName lastName }
  }
  ... on ContactInteractionInstagram {
    id createdAt direction
    message { id content type }
    contact { id fullName firstName lastName }
  }
  ... on ContactInteractionPhoneCall {
    id createdAt direction
    contact { id fullName firstName lastName }
  }
  ... on ContactInteractionEmail {
    id createdAt direction subject
    contact { id fullName firstName lastName }
  }
  ... on ContactInteractionInPerson {
    id createdAt
    contact { id fullName firstName lastName }
  }
`;

// Build human-readable message text from an interaction
function buildInteractionText(ia) {
  const type = ia.__typename;
  const label = CHANNEL_LABEL[type] || type;
  const dir = ia.direction === 'OUTBOUND' ? 'Saliente' : 'Entrante';
  const content = ia.message?.content;

  if (type === 'ContactInteractionFacebookAd') {
    const fb = parseFbAdFields(ia.fields || []);
    let text = `[Facebook Lead Ad]`;
    if (ia.campaign?.name) text += ` Campaña: ${ia.campaign.name}`;
    if (fb.phone)  text += `\nTeléfono: ${fb.phone}`;
    if (fb.email)  text += `\nEmail: ${fb.email}`;
    if (fb.notes.length) text += `\n${fb.notes.join('\n')}`;
    return text;
  }
  if (content) return `[${label} ${dir}]\n${content}`;
  if (type === 'ContactInteractionPhoneCall') return `[Llamada ${dir}]`;
  if (type === 'ContactInteractionEmail') return `[Email ${dir}]${ia.subject ? ` — ${ia.subject}` : ''}`;
  if (type === 'ContactInteractionInPerson') return `[Visita presencial]`;
  return `[${label} ${dir}]`;
}

// Map typename to DB channel value
function interactionChannel(type) {
  const map = {
    ContactInteractionWhatsapp: 'whatsapp',
    ContactInteractionSms: 'sms',
    ContactInteractionFacebookMessenger: 'messenger',
    ContactInteractionInstagram: 'instagram',
    ContactInteractionPhoneCall: 'phone',
    ContactInteractionEmail: 'email',
    ContactInteractionFacebookAd: 'leadgogo',
    ContactInteractionInPerson: 'leadgogo',
  };
  return map[type] || 'leadgogo';
}

// Ensure a lead exists for a LG contact, returns { lead, contacto, isNew }
async function upsertLeadForContact(lgContact, pipId, stageId) {
  const nombre = lgContact.fullName ||
    `${lgContact.firstName || ''} ${lgContact.lastName || ''}`.trim() ||
    `LG-${lgContact.id}`;

  // Check by LG contact ID in title
  const existing = await pool.query(
    `SELECT l.id, c.id as contact_id FROM leads l JOIN contacts c ON c.id=l.contact_id
     WHERE l.source='leadgogo' AND (l.title LIKE $1 OR l.title LIKE $2) LIMIT 1`,
    [`%LG-${lgContact.id}%`, `%LG-contact-${lgContact.id}%`]
  );
  if (existing.rows.length) {
    const row = existing.rows[0];
    return { leadId: row.id, contactId: row.contact_id, isNew: false };
  }

  // Create contact
  let contacto = (await pool.query(`SELECT * FROM contacts WHERE name=$1 LIMIT 1`, [nombre])).rows[0];
  if (!contacto) {
    contacto = (await pool.query(
      `INSERT INTO contacts (name, source) VALUES ($1,'leadgogo') RETURNING *`,
      [nombre]
    )).rows[0];
  }

  // Create lead
  const lead = (await pool.query(
    `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source) VALUES ($1,$2,$3,$4,'leadgogo') RETURNING *`,
    [`LG-${lgContact.id} — ${nombre}`, contacto.id, pipId, stageId]
  )).rows[0];

  await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Leadgogo','#8b5cf6') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
  await pool.query(`INSERT INTO alerts (lead_id, type, message) VALUES ($1,'leadgogo',$2)`, [lead.id, `Nuevo lead Leadgogo — ${nombre}`]).catch(() => {});
  sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });

  return { leadId: lead.id, contactId: contacto.id, isNew: true };
}

// ── Sync 1: New contacts by ID cursor ────────────────────────────────────────
async function syncNewContacts() {
  const lastId = parseInt(await getConfig('leadgogo_last_contact_id', '0'));

  const data = await graphql(`
    query ($inst: Int!) {
      contacts(institutionId: $inst, last: 50) {
        edges { node {
          id fullName firstName lastName createdAt
          stage { id name }
          assignee { id email username firstName lastName }
          lastConversation {
            id
            lastContactInteraction { ${INTERACTION_FRAGMENT} }
          }
        }}
      }
    }
  `, { inst: INSTITUTION_ID });

  const newContacts = data.contacts.edges.map(e => e.node).filter(c => c.id > lastId);
  if (!newContacts.length) return;

  console.log(`[LEADGOGO] ${newContacts.length} contacto(s) nuevo(s)`);
  const { pipId, stageId } = await getPipelineStage();
  let maxId = lastId;

  for (const c of newContacts) {
    try {
      const nombre = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || `LG-${c.id}`;
      const dup = await pool.query(`SELECT id FROM leads WHERE source='leadgogo' AND title LIKE $1 LIMIT 1`, [`%LG-${c.id}%`]);
      if (dup.rows.length) { if (c.id > maxId) maxId = c.id; continue; }

      const ia = c.lastConversation?.lastContactInteraction;
      const isFbAd = ia?.__typename === 'ContactInteractionFacebookAd';
      const fbData = isFbAd ? parseFbAdFields(ia.fields || []) : { phone: null, email: null, notes: [] };

      // Also parse phone/email from message content for Messenger/Instagram
      const msgParsed = ia?.message?.content ? parseMessageContent(ia.message.content) : { phone: null, email: null };
      const phone = fbData.phone || msgParsed.phone;
      const email = fbData.email || msgParsed.email;

      const assigneeName = c.assignee ? (c.assignee.firstName || c.assignee.username || c.assignee.email) : null;
      const campaignName = isFbAd ? ia.campaign?.name : null;

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
        `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source) VALUES ($1,$2,$3,$4,'leadgogo') RETURNING *`,
        [`LG-${c.id} — ${nombre}`, contacto.id, pipId, stageId]
      )).rows[0];

      let msgText = `Nuevo lead de Leadgogo — ${nombre}`;
      const channelLabel = CHANNEL_LABEL[ia?.__typename] || 'Leadgogo';
      msgText += `\nCanal: ${channelLabel}`;
      if (campaignName) msgText += `\nCampaña: ${campaignName}`;
      if (phone)  msgText += `\nTeléfono: ${phone}`;
      if (email)  msgText += `\nEmail: ${email}`;
      if (fbData.notes.length) msgText += `\n\n${fbData.notes.join('\n')}`;
      if (ia?.message?.content && !isFbAd) msgText += `\n\n${ia.message.content}`;
      if (assigneeName) msgText += `\nAsignado a: ${assigneeName}`;
      msgText += `\nEtapa: ${c.stage?.name || 'Lead'}`;

      await pool.query(
        `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'leadgogo')`,
        [lead.id, contacto.id, msgText]
      );
      await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Leadgogo','#8b5cf6') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
      if (isFbAd) {
        await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Facebook Ad','#1877f2') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
      }
      await pool.query(`INSERT INTO alerts (lead_id, type, message) VALUES ($1,'leadgogo',$2)`, [lead.id, `Nuevo lead Leadgogo — ${nombre}`]).catch(() => {});
      sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });

      console.log(`[LEADGOGO] Lead #${lead.id} — ${nombre} (LG-${c.id}) via ${channelLabel}${phone ? ' 📱' + phone : ''}`);
      if (c.id > maxId) maxId = c.id;
    } catch (err) {
      console.error(`[LEADGOGO] Error contacto ${c.id}:`, err.message);
    }
  }

  if (maxId > lastId) await setConfig('leadgogo_last_contact_id', maxId);
}

// ── Sync 2: Recent contact interactions (new messages on any channel) ─────────
async function syncRecentInteractions() {
  const lastInteractionId = parseInt(await getConfig('leadgogo_last_interaction_id', '0'));
  const { pipId, stageId } = await getPipelineStage();

  const data = await graphql(`
    query ($inst: Int!) {
      contactInteractions(institutionId: $inst, last: 50) {
        edges { node {
          ${INTERACTION_FRAGMENT}
          ... on ContactInteractionPhoneCall { conversation { id } }
          ... on ContactInteractionWhatsapp { conversation { id } }
          ... on ContactInteractionSms { conversation { id } }
          ... on ContactInteractionFacebookMessenger { conversation { id } }
          ... on ContactInteractionInstagram { conversation { id } }
          ... on ContactInteractionEmail { conversation { id } }
          ... on ContactInteractionFacebookAd { conversation { id } }
          ... on ContactInteractionInPerson { conversation { id } }
        }}
      }
    }
  `, { inst: INSTITUTION_ID });

  const interactions = data.contactInteractions.edges.map(e => e.node);
  const newOnes = interactions.filter(ia => parseInt(ia.id) > lastInteractionId);
  if (!newOnes.length) return;

  console.log(`[LEADGOGO] ${newOnes.length} interaccion(es) nueva(s)`);
  let maxId = lastInteractionId;

  for (const ia of newOnes) {
    try {
      const lgContact = ia.contact;
      if (!lgContact) { if (parseInt(ia.id) > maxId) maxId = parseInt(ia.id); continue; }

      const { leadId, contactId, isNew } = await upsertLeadForContact(lgContact, pipId, stageId);

      // Add Facebook Ad tag if applicable
      if (ia.__typename === 'ContactInteractionFacebookAd') {
        await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Facebook Ad','#1877f2') ON CONFLICT (lead_id, tag) DO NOTHING`, [leadId]).catch(() => {});
      }

      // Update phone/email from message content
      if (ia.message?.content) {
        const parsed = parseMessageContent(ia.message.content);
        if (parsed.phone) await pool.query(`UPDATE contacts SET phone=$1 WHERE id=$2 AND (phone IS NULL OR phone='')`, [parsed.phone, contactId]);
        if (parsed.email) await pool.query(`UPDATE contacts SET email=$1 WHERE id=$2 AND (email IS NULL OR email='')`, [parsed.email, contactId]);
      }
      if (ia.__typename === 'ContactInteractionFacebookAd') {
        const fb = parseFbAdFields(ia.fields || []);
        if (fb.phone) await pool.query(`UPDATE contacts SET phone=$1 WHERE id=$2 AND (phone IS NULL OR phone='')`, [fb.phone, contactId]);
        if (fb.email) await pool.query(`UPDATE contacts SET email=$1 WHERE id=$2 AND (email IS NULL OR email='')`, [fb.email, contactId]);
      }

      const msgText = buildInteractionText(ia);
      const direction = ia.direction === 'OUTBOUND' ? 'outbound' : 'inbound';
      const channel = interactionChannel(ia.__typename);

      await pool.query(
        `INSERT INTO messages (lead_id, contact_id, direction, text, channel, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [leadId, contactId, direction, msgText, channel, new Date(ia.createdAt)]
      );

      if (!isNew) {
        // Alert only for inbound messages on existing leads
        if (direction === 'inbound') {
          await pool.query(
            `INSERT INTO alerts (lead_id, type, message)
             SELECT $1,'leadgogo',$2
             WHERE NOT EXISTS (
               SELECT 1 FROM alerts WHERE lead_id=$1 AND type='leadgogo' AND created_at > NOW() - INTERVAL '1 hour'
             )`,
            [leadId, `Nuevo mensaje en Leadgogo — ${lgContact.fullName || 'contacto'}`]
          ).catch(() => {});
          sse.broadcast('new_message', { lead_id: leadId, direction: 'inbound' });
        }
      }

      if (parseInt(ia.id) > maxId) maxId = parseInt(ia.id);
    } catch (err) {
      console.error(`[LEADGOGO] Error interacción ${ia.id}:`, err.message);
    }
  }

  if (maxId > lastInteractionId) await setConfig('leadgogo_last_interaction_id', maxId);
}

// ── Sync 3: Full historical sync — all contacts paginated ─────────────────────
// Runs once; marks completion in config so it doesn't repeat
async function syncAllContactsOnce() {
  const done = await getConfig('leadgogo_bulk_sync_done', 'false');
  if (done === 'true') return;

  console.log('[LEADGOGO] Iniciando sync histórico completo...');
  const { pipId, stageId } = await getPipelineStage();
  let cursor = null;
  let total = 0;

  while (true) {
    const data = await graphql(`
      query ($inst: Int!, $after: String) {
        contacts(institutionId: $inst, first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node {
            id fullName firstName lastName createdAt
            stage { id name }
            assignee { id email username firstName lastName }
            lastConversation {
              id
              lastContactInteraction { ${INTERACTION_FRAGMENT} }
            }
          }}
        }
      }
    `, { inst: INSTITUTION_ID, after: cursor });

    const { edges, pageInfo } = data.contacts;

    for (const { node: c } of edges) {
      try {
        const nombre = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || `LG-${c.id}`;

        // Skip if already exists
        const dup = await pool.query(
          `SELECT id FROM leads WHERE source='leadgogo' AND (title LIKE $1 OR title LIKE $2) LIMIT 1`,
          [`%LG-${c.id}%`, `%LG-contact-${c.id}%`]
        );
        if (dup.rows.length) { total++; continue; }

        const ia = c.lastConversation?.lastContactInteraction;
        const isFbAd = ia?.__typename === 'ContactInteractionFacebookAd';
        const fbData = isFbAd ? parseFbAdFields(ia.fields || []) : { phone: null, email: null, notes: [] };
        const msgParsed = ia?.message?.content ? parseMessageContent(ia.message.content) : { phone: null, email: null };
        const phone = fbData.phone || msgParsed.phone;
        const email = fbData.email || msgParsed.email;
        const assigneeName = c.assignee ? (c.assignee.firstName || c.assignee.username || c.assignee.email) : null;

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
          `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source, created_at)
           VALUES ($1,$2,$3,$4,'leadgogo',$5) RETURNING *`,
          [`LG-${c.id} — ${nombre}`, contacto.id, pipId, stageId, new Date(c.createdAt)]
        )).rows[0];

        const channelLabel = CHANNEL_LABEL[ia?.__typename] || 'Leadgogo';
        let msgText = `Nuevo lead de Leadgogo — ${nombre}\nCanal: ${channelLabel}`;
        if (isFbAd && ia.campaign?.name) msgText += `\nCampaña: ${ia.campaign.name}`;
        if (phone)  msgText += `\nTeléfono: ${phone}`;
        if (email)  msgText += `\nEmail: ${email}`;
        if (fbData.notes.length) msgText += `\n\n${fbData.notes.join('\n')}`;
        if (ia?.message?.content && !isFbAd) msgText += `\n\n${ia.message.content}`;
        if (assigneeName) msgText += `\nAsignado a: ${assigneeName}`;
        if (c.stage?.name) msgText += `\nEtapa: ${c.stage.name}`;

        await pool.query(
          `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'leadgogo')`,
          [lead.id, contacto.id, msgText]
        );
        await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Leadgogo','#8b5cf6') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
        if (isFbAd) {
          await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Facebook Ad','#1877f2') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
        }
        total++;
      } catch (err) {
        console.error(`[LEADGOGO BULK] Error contacto ${c.id}:`, err.message);
      }
    }

    console.log(`[LEADGOGO BULK] ${total} contactos procesados...`);

    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 500));
  }

  await setConfig('leadgogo_bulk_sync_done', 'true');
  console.log(`[LEADGOGO BULK] Sync histórico completado — ${total} contactos`);
}

// ── Sync 4: Back-fill phone/email for existing leads missing contact data ──────
async function syncMissingContactData() {
  const leads = await pool.query(`
    SELECT l.id, l.title, c.id as contact_id, c.name, c.phone
    FROM leads l
    JOIN contacts c ON c.id = l.contact_id
    WHERE l.source = 'leadgogo' AND (c.phone IS NULL OR c.phone = '')
    ORDER BY l.id DESC LIMIT 20
  `);
  if (!leads.rows.length) return;

  for (const lead of leads.rows) {
    try {
      const match = lead.title.match(/LG-?contact-?(\d+)/i) || lead.title.match(/LG-(\d+)/i);
      if (!match) continue;
      const lgContactId = parseInt(match[1]);

      const data = await graphql(`
        query ($id: Int!) {
          contact(id: $id) {
            id fullName
            lastConversation { id lastContactInteraction {
              __typename
              ... on ContactInteractionFacebookAd { id fields { key value label } }
              ... on ContactInteractionFacebookMessenger { id message { id content } }
              ... on ContactInteractionSms { id message { id content } }
              ... on ContactInteractionWhatsapp { id message { id content } }
              ... on ContactInteractionInstagram { id message { id content } }
            }}
          }
        }
      `, { id: lgContactId });

      const ia = data?.contact?.lastConversation?.lastContactInteraction;
      if (!ia) continue;

      let phone = null, email = null;
      if (ia.__typename === 'ContactInteractionFacebookAd') {
        const fb = parseFbAdFields(ia.fields || []);
        phone = fb.phone; email = fb.email;
      } else if (ia.message?.content) {
        const parsed = parseMessageContent(ia.message.content);
        phone = parsed.phone; email = parsed.email;
      }
      if (!phone && !email) continue;

      if (phone) await pool.query(`UPDATE contacts SET phone=$1 WHERE id=$2 AND (phone IS NULL OR phone='')`, [phone, lead.contact_id]);
      if (email) await pool.query(`UPDATE contacts SET email=$1 WHERE id=$2 AND (email IS NULL OR email='')`, [email, lead.contact_id]);
      console.log(`[LEADGOGO] Back-fill #${lead.contact_id} — ${lead.name}: ${phone || ''} ${email || ''}`);
    } catch (err) {
      // Ignore individual errors
    }
  }
}

let _bulkSyncStarted = false;

async function syncLeadgogo() {
  try {
    // Run bulk historical sync once, in the background (non-blocking)
    if (!_bulkSyncStarted) {
      _bulkSyncStarted = true;
      syncAllContactsOnce().catch(err => console.error('[LEADGOGO BULK] Error:', err.message));
    }

    await syncNewContacts();
    await syncRecentInteractions();
    await syncMissingContactData();
  } catch (err) {
    console.error('[LEADGOGO SYNC] Error:', err.message);
    _token = null;
  }
}

module.exports = { syncLeadgogo };
