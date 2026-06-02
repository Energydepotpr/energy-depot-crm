// leadgogoApi.js — Cliente de la API pública REST de Leadgogo (api.leadgogo.com/v1).
// Reemplaza el GraphQL interno por el endpoint oficial documentado.
// Auth: API key como Bearer token (Profile Settings → API Key en Leadgogo).

// BASE sin /v1 (los paths ya lo incluyen)
const BASE = (process.env.LEADGOGO_API_BASE || 'https://api.leadgogo.com').replace(/\/v1\/?$/, '');
const API_KEY = process.env.LEADGOGO_API_KEY || '';
const COMPANY_ID = parseInt(process.env.LEADGOGO_COMPANY_ID || '3475', 10);

function headers() {
  return { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
}

async function api(path, opts = {}) {
  if (!API_KEY) throw new Error('LEADGOGO_API_KEY no configurada');
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(`Leadgogo API ${path}: ${msg}`);
  }
  return data;
}

// ── Lecturas ──────────────────────────────────────────────────────────────
const getContact   = (id) => api(`/v1/contacts/${id}`);
const getCampaign  = (id) => api(`/v1/campaigns/${id}`);
const getSource    = (id) => api(`/v1/sources/${id}`);
const listContacts = (limit = 50, after) =>
  api(`/v1/company/${COMPANY_ID}/contacts?limit=${limit}${after ? `&after=${encodeURIComponent(after)}` : ''}`);
const getContactInteractions = (contactId, limit = 20) =>
  api(`/v1/contacts/${contactId}/communication-interactions?limit=${limit}`);
const listCampaigns = () => api(`/v1/company/${COMPANY_ID}/campaigns`);
const listSources   = () => api(`/v1/company/${COMPANY_ID}/sources`);

// ── Escritura: mandar mensaje a un contacto ────────────────────────────────
const getSendOptions = (contactId) =>
  api(`/v1/contacts/${contactId}/communication-interactions/messages/options`);

async function sendMessage(contactId, body) {
  return api(`/v1/contacts/${contactId}/communication-interactions/messages`, {
    method: 'POST', body: JSON.stringify(body),
  });
}

// Responde por el mejor canal de TEXTO disponible (SMS > Facebook > Instagram).
// WhatsApp se omite porque requiere plantilla aprobada (no texto libre).
async function replyToContact(contactId, text) {
  const opts = await getSendOptions(contactId);
  const list = opts?.data || [];
  const order = ['SMS', 'FACEBOOK', 'INSTAGRAM'];
  let chosen = null;
  for (const ch of order) {
    chosen = list.find(o => o.channel === ch && (o.message_type === 'TEXT' || /TEXT/.test(o.type || '')));
    if (chosen) break;
  }
  if (!chosen) {
    const e = new Error('Sin canal de texto disponible en Leadgogo para este contacto');
    e.code = 'NO_TEXT_CHANNEL';
    throw e;
  }
  const sent = await sendMessage(contactId, {
    channel: chosen.channel,
    from: chosen.from,
    to: chosen.to,
    content: { type: 'TEXT', message: text },
  });
  return { sent, channel: chosen.channel };
}

// ── Webhooks ────────────────────────────────────────────────────────────────
const listWebhooks = () => api('/v1/webhooks');
async function createWebhook(url, events = null) {
  const subscribed_events = events
    ? events.map(e => ({ event: e }))
    : [
        { event: 'contact.created' },
        { event: 'communication-interaction.received' },
      ];
  return api('/v1/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Energy Depot CRM Sync',
      url,
      subscribed_events,
      company_ids: [COMPANY_ID],
      status: 'ACTIVE',
    }),
  });
}
const deleteWebhook = (id) => api(`/v1/webhooks/${id}`, { method: 'DELETE' });

// Caché simple de nombres de source/campaign (evita N llamadas)
const _cache = { sources: new Map(), campaigns: new Map() };
async function sourceName(id) {
  if (!id) return null;
  if (_cache.sources.has(id)) return _cache.sources.get(id);
  try { const s = await getSource(id); _cache.sources.set(id, s.name); return s.name; }
  catch { return null; }
}
async function campaignName(id) {
  if (!id) return null;
  if (_cache.campaigns.has(id)) return _cache.campaigns.get(id);
  try { const c = await getCampaign(id); _cache.campaigns.set(id, c.name); return c.name; }
  catch { return null; }
}

module.exports = {
  COMPANY_ID, isConfigured: () => !!API_KEY,
  getContact, getCampaign, getSource, listContacts, getContactInteractions,
  listCampaigns, listSources, sendMessage, getSendOptions, replyToContact,
  listWebhooks, createWebhook, deleteWebhook, sourceName, campaignName,
};
