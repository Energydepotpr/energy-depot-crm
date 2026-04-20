const { pool } = require('./db');
const axios = require('axios');

// Fire event to all active outgoing integrations
async function fireEvent(eventType, data) {
  try {
    const result = await pool.query(
      `SELECT id, config FROM integrations WHERE is_active = true AND id IN ('slack', 'webhooks')`
    );

    for (const row of result.rows) {
      if (row.id === 'slack') {
        await fireSlack(row.config, eventType, data).catch(e => console.error('[Slack]', e.message));
      } else if (row.id === 'webhooks') {
        await fireWebhook(row.config, eventType, data).catch(e => console.error('[Webhook]', e.message));
      }
    }
  } catch (err) {
    console.error('[IntegrationsService] Error firing event:', err.message);
  }
}

async function fireSlack(config, eventType, data) {
  if (!config.webhook_url) return;

  let text = '';
  switch (eventType) {
    case 'lead_created':
      text = `🆕 *Nuevo lead creado*: ${data.title}${data.contact_name ? ' — ' + data.contact_name : ''}${data.value > 0 ? ' — $' + data.value : ''}`;
      break;
    case 'lead_won':
      text = `🏆 *Lead ganado*: ${data.title}${data.value > 0 ? ' — $' + data.value : ''}`;
      break;
    case 'lead_lost':
      text = `❌ *Lead perdido*: ${data.title}`;
      break;
    case 'message_received':
      text = `💬 *Nuevo mensaje* de ${data.contact_name || 'desconocido'}: ${data.text?.slice(0, 100)}`;
      break;
    default:
      text = `📋 CRM Event: ${eventType}`;
  }

  await axios.post(config.webhook_url, { text });
}

async function fireWebhook(config, eventType, data) {
  if (!config.url) return;

  const events = config.events || [];
  if (events.length > 0 && !events.includes(eventType) && !events.includes('*')) return;

  await axios.post(config.url, {
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
  }, {
    headers: {
      'Content-Type': 'application/json',
      ...(config.secret ? { 'X-CRM-Secret': config.secret } : {}),
    },
  });
}

module.exports = { fireEvent };
