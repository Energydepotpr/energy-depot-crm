const { pool } = require('./db');
const sse = require('./sse');

const LEADGOGO_API = 'https://web-api.services.leadgogo.com/v1';
const INSTITUTION_ID = 3475;

let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch(`${LEADGOGO_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Rock', password: 'Rock123!' }),
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

// ── Sync 1: New contacts by ID cursor ────────────────────────────────────────
async function syncNewContacts() {
  const lastId = parseInt(await getConfig('leadgogo_last_contact_id', '0'));

  const data = await graphql(`
    query ($inst: Int!) {
      contacts(institutionId: $inst, last: 50) {
        edges { node { id fullName firstName lastName createdAt stage { id name } } }
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

      let contacto = (await pool.query(`SELECT * FROM contacts WHERE name=$1 LIMIT 1`, [nombre])).rows[0];
      if (!contacto) {
        contacto = (await pool.query(`INSERT INTO contacts (name, source) VALUES ($1,'leadgogo') RETURNING *`, [nombre])).rows[0];
      }

      const lead = (await pool.query(
        `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source) VALUES ($1,$2,$3,$4,'leadgogo') RETURNING *`,
        [`LG-${c.id} — ${nombre}`, contacto.id, pipId, stageId]
      )).rows[0];

      await pool.query(
        `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'leadgogo')`,
        [lead.id, contacto.id, `Nuevo lead de Leadgogo — ${nombre} | Etapa: ${c.stage?.name || 'Lead'}`]
      );
      await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Leadgogo','#8b5cf6') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
      await pool.query(`INSERT INTO alerts (lead_id, type, message) VALUES ($1,'leadgogo',$2)`, [lead.id, `Nuevo lead Leadgogo — ${nombre}`]).catch(() => {});
      sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });
      console.log(`[LEADGOGO] Lead #${lead.id} — ${nombre} (LG-${c.id})`);
      if (c.id > maxId) maxId = c.id;
    } catch (err) {
      console.error(`[LEADGOGO] Error contacto ${c.id}:`, err.message);
    }
  }

  if (maxId > lastId) await setConfig('leadgogo_last_contact_id', maxId);
}

// ── Sync 2: Recent conversations (new leads from conversations) ───────────────
async function syncRecentConversations() {
  const lastSync = await getConfig('leadgogo_last_conv_sync', new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const data = await graphql(`
    query ($inst: Int!) {
      conversations(institutionId: $inst, last: 30) {
        edges { node { id createdAt updatedAt contact { id fullName firstName lastName stage { name } } } }
      }
    }
  `, { inst: INSTITUTION_ID });

  const cutoff = new Date(lastSync);
  const recent = data.conversations.edges
    .map(e => e.node)
    .filter(c => new Date(c.updatedAt) > cutoff);

  if (!recent.length) return;

  console.log(`[LEADGOGO] ${recent.length} conversacion(es) reciente(s)`);
  const { pipId, stageId } = await getPipelineStage();

  for (const conv of recent) {
    try {
      const c = conv.contact;
      if (!c) continue;
      const nombre = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || `LG-contact-${c.id}`;

      const existing = await pool.query(
        `SELECT l.id FROM leads l WHERE l.source='leadgogo' AND (l.title LIKE $1 OR l.title LIKE $2) LIMIT 1`,
        [`%LG-${c.id}%`, `%LG-contact-${c.id}%`]
      );

      if (existing.rows.length) {
        const isNewConv = new Date(conv.createdAt) > cutoff;
        if (!isNewConv) {
          await pool.query(
            `INSERT INTO alerts (lead_id, type, message)
             SELECT $1, 'leadgogo', $2
             WHERE NOT EXISTS (
               SELECT 1 FROM alerts WHERE lead_id=$1 AND type='leadgogo' AND created_at > NOW() - INTERVAL '1 hour'
             )`,
            [existing.rows[0].id, `Nuevo mensaje en Leadgogo — ${nombre}`]
          ).catch(() => {});
          sse.broadcast('new_message', { lead_id: existing.rows[0].id, direction: 'inbound' });
        }
        continue;
      }

      let contacto = (await pool.query(`SELECT * FROM contacts WHERE name=$1 LIMIT 1`, [nombre])).rows[0];
      if (!contacto) {
        contacto = (await pool.query(`INSERT INTO contacts (name, source) VALUES ($1,'leadgogo') RETURNING *`, [nombre])).rows[0];
      }

      const lead = (await pool.query(
        `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source) VALUES ($1,$2,$3,$4,'leadgogo') RETURNING *`,
        [`LG-contact-${c.id} — ${nombre}`, contacto.id, pipId, stageId]
      )).rows[0];

      await pool.query(
        `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'leadgogo')`,
        [lead.id, contacto.id, `Conversación activa en Leadgogo — ${nombre}`]
      );
      await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Leadgogo','#8b5cf6') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
      await pool.query(`INSERT INTO alerts (lead_id, type, message) VALUES ($1,'leadgogo',$2)`, [lead.id, `Nuevo lead Leadgogo — ${nombre}`]).catch(() => {});
      sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });
      console.log(`[LEADGOGO] Lead desde conversación — ${nombre} (conv ${conv.id})`);
    } catch (err) {
      console.error(`[LEADGOGO] Error conv ${conv.id}:`, err.message);
    }
  }

  await setConfig('leadgogo_last_conv_sync', new Date().toISOString());
}

// ── Sync 3: Interaction messages within conversations ─────────────────────────
// Captures WhatsApp, Facebook Messenger, Instagram, Email, Lead Ads, Calls
async function syncConversationMessages() {
  const lastSync = await getConfig('leadgogo_last_msg_sync', new Date(Date.now() - 10 * 60 * 1000).toISOString());

  const data = await graphql(`
    query ($inst: Int!) {
      conversations(institutionId: $inst, last: 20) {
        edges { node { id updatedAt contact { id fullName firstName lastName } } }
      }
    }
  `, { inst: INSTITUTION_ID });

  const cutoff = new Date(lastSync);
  const recent = data.conversations.edges
    .map(e => e.node)
    .filter(c => new Date(c.updatedAt) > cutoff);

  if (!recent.length) return;

  for (const conv of recent) {
    try {
      const contact = conv.contact;
      if (!contact) continue;

      const existing = await pool.query(
        `SELECT l.id, l.contact_id FROM leads l
         WHERE l.source='leadgogo' AND (l.title LIKE $1 OR l.title LIKE $2) LIMIT 1`,
        [`%LG-${contact.id}%`, `%LG-contact-${contact.id}%`]
      );
      if (!existing.rows.length) continue;

      const { id: leadId, contact_id: contactId } = existing.rows[0];

      const convData = await graphql(`
        query ($id: Int!) {
          conversation(id: $id) {
            interactions(last: 10) {
              edges { node {
                __typename id createdAt
                ... on ContactInteraction { text }
                ... on ContactInteractionFacebookMessenger { text }
                ... on ContactInteractionInstagram { text }
                ... on ContactInteractionEmail { subject body }
                ... on ContactInteractionFacebookAd { adName formName }
                ... on ContactInteractionPhoneCall { duration }
              }}
            }
          }
        }
      `, { id: conv.id });

      const interactions = convData?.conversation?.interactions?.edges?.map(e => e.node) || [];

      for (const ia of interactions) {
        if (!ia || new Date(ia.createdAt) <= cutoff) continue;

        const dup = await pool.query(
          `SELECT 1 FROM messages WHERE lead_id=$1 AND text LIKE $2 LIMIT 1`,
          [leadId, `%[lg:${ia.id}]`]
        );
        if (dup.rows.length) continue;

        let text;
        switch (ia.__typename) {
          case 'ContactInteractionFacebookMessenger': text = `[Messenger] ${ia.text || ''}`.trim(); break;
          case 'ContactInteractionInstagram':         text = `[Instagram] ${ia.text || ''}`.trim(); break;
          case 'ContactInteractionEmail':             text = `[Email] ${ia.subject || ''}: ${ia.body || ''}`.trim(); break;
          case 'ContactInteractionFacebookAd':        text = `[Lead Ad] ${ia.adName || ''} / ${ia.formName || ''}`.trim(); break;
          case 'ContactInteractionPhoneCall':         text = `[Llamada] ${ia.duration ? ia.duration + 's' : 'perdida'}`; break;
          default:                                    text = ia.text || '(interacción Leadgogo)';
        }

        await pool.query(
          `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'leadgogo')`,
          [leadId, contactId, `${text} [lg:${ia.id}]`]
        );
        sse.broadcast('new_message', { lead_id: leadId, direction: 'inbound' });
        console.log(`[LEADGOGO] Interacción #${ia.id} (${ia.__typename}) → lead #${leadId}`);
      }
    } catch (err) {
      // Graceful fallback — API may not expose conversation.interactions on all plans
      if (!err.message.includes('Cannot query field')) {
        console.error(`[LEADGOGO] Error msgs conv ${conv.id}:`, err.message);
      }
    }
  }

  await setConfig('leadgogo_last_msg_sync', new Date().toISOString());
}

async function syncLeadgogo() {
  try {
    await syncNewContacts();
    await syncRecentConversations();
    await syncConversationMessages();
  } catch (err) {
    console.error('[LEADGOGO SYNC] Error:', err.message);
    _token = null;
  }
}

module.exports = { syncLeadgogo };
