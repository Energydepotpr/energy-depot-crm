/**
 * twilioSync.js
 * Sincroniza mensajes nuevos de Twilio cada 5 minutos.
 * Solo descarga mensajes DESDE la última sincronización (no re-descarga todo).
 * Útil mientras Kommo sigue enviando mensajes por el mismo número de Twilio.
 */

const twilio = require('twilio');
const { pool } = require('./db');
const sse = require('./sse');
const { sendToAll } = require('../controllers/pushController');
const { enqueueEnrich } = require('./leadEnrich');

const OWN_NUMBER = '+17874880202';
const OWN_DIGITS = OWN_NUMBER.replace(/\D/g, '').slice(-10);
const SETTING_KEY = 'twilio_last_sync';

// ── Helpers ───────────────────────────────────────────────────────────────────

function last10(phone) {
  if (!phone) return null;
  const d = phone.toString().replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-10) : null;
}

function isOwnNumber(phone) {
  return last10(phone) === OWN_DIGITS;
}

function getCustomerPhone(msg) {
  const dir = msg.direction || '';
  return dir.startsWith('inbound') ? msg.from : msg.to;
}

// ── Leer / escribir last_sync en DB ──────────────────────────────────────────

async function getLastSync() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_settings (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const r = await pool.query(
      'SELECT value FROM crm_settings WHERE key = $1',
      [SETTING_KEY]
    );
    if (r.rows.length && r.rows[0].value) {
      return new Date(r.rows[0].value);
    }
  } catch (e) {
    console.error('[TWILIO_SYNC] getLastSync error:', e.message);
  }
  // Primera vez: sincroniza desde hace 24h (no re-importa todo el histórico)
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

async function setLastSync(date) {
  try {
    await pool.query(`
      INSERT INTO crm_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [SETTING_KEY, date.toISOString()]);
  } catch (e) {
    console.error('[TWILIO_SYNC] setLastSync error:', e.message);
  }
}

// ── Buscar o crear contacto ───────────────────────────────────────────────────

async function findOrCreateContact(phone) {
  const d10 = last10(phone);
  if (!d10) return null;

  const existing = await pool.query(
    `SELECT id FROM contacts
     WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $1
     ORDER BY id ASC LIMIT 1`,
    [d10]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const r = await pool.query(
    `INSERT INTO contacts (name, phone, source, created_at, updated_at)
     VALUES ($1, $2, 'sms', NOW(), NOW()) RETURNING id`,
    [phone, phone]
  );
  return r.rows[0].id;
}

// ── Buscar o crear lead ───────────────────────────────────────────────────────

async function findOrCreateLead(contactId, phone) {
  const existing = await pool.query(
    `SELECT id FROM leads WHERE contact_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [contactId]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const r = await pool.query(
    `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, created_at, updated_at)
     VALUES ($1, $2, 3, 19, NOW(), NOW()) RETURNING id`,
    [`Conversación con ${phone}`, contactId]
  );
  return r.rows[0].id;
}

// ── Función principal de sync ─────────────────────────────────────────────────

async function syncTwilioMessages() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return;

  const since = await getLastSync();
  const syncStart = new Date(); // marca el inicio ANTES de descargar
  console.log(`[TWILIO_SYNC] Descargando mensajes desde ${since.toISOString()}...`);

  try {
    const client = twilio(accountSid, authToken);

    // Inbound (cliente → nuestro número) y outbound (nosotros → cliente)
    const [inbound, outbound] = await Promise.all([
      client.messages.list({ to: OWN_NUMBER, dateSentAfter: since, limit: 1000 }),
      client.messages.list({ from: OWN_NUMBER, dateSentAfter: since, limit: 1000 }),
    ]);

    const all = [...inbound, ...outbound]
      .sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));

    if (all.length === 0) {
      console.log('[TWILIO_SYNC] Sin mensajes nuevos.');
      await setLastSync(syncStart);
      return;
    }

    let imported = 0, skipped = 0;

    for (const msg of all) {
      try {
        // Ya existe?
        const exists = await pool.query(
          'SELECT id FROM messages WHERE twilio_sid = $1',
          [msg.sid]
        );
        if (exists.rows.length) { skipped++; continue; }

        // Cuerpo vacío?
        if (!msg.body || !msg.body.trim()) { skipped++; continue; }

        const customerPhone = getCustomerPhone(msg);
        if (!customerPhone || isOwnNumber(customerPhone)) { skipped++; continue; }

        const contactId = await findOrCreateContact(customerPhone);
        if (!contactId) { skipped++; continue; }

        const leadId = await findOrCreateLead(contactId, customerPhone);
        if (!leadId) { skipped++; continue; }

        const direction = (msg.direction || '').startsWith('inbound') ? 'inbound' : 'outbound';

        await pool.query(
          `INSERT INTO messages (lead_id, contact_id, direction, text, twilio_sid, channel, created_at)
           VALUES ($1, $2, $3, $4, $5, 'sms', $6)`,
          [leadId, contactId, direction, msg.body, msg.sid, msg.dateCreated]
        );

        // Actualizar updated_at del lead para que aparezca activo
        await pool.query(
          'UPDATE leads SET updated_at = $1 WHERE id = $2',
          [msg.dateCreated, leadId]
        );

        // Notificar en tiempo real (igual que el webhook)
        sse.broadcast('new_message', { lead_id: leadId, direction });
        if (direction === 'inbound') {
          const contactRow = await pool.query('SELECT name, phone FROM contacts WHERE id = $1', [contactId]);
          const c = contactRow.rows[0];
          const contactName = c && c.name !== c.phone ? c.name : customerPhone;
          sendToAll(
            `Nuevo mensaje de ${contactName}`,
            msg.body.slice(0, 100),
            '/inbox'
          ).catch(() => {});
        }

        // Encolar para enriquecimiento con IA
        enqueueEnrich(leadId);

        imported++;
      } catch (e) {
        console.error(`[TWILIO_SYNC] Error msg ${msg.sid}:`, e.message);
      }
    }

    console.log(`[TWILIO_SYNC] ✓ ${imported} importados, ${skipped} ya existían.`);
    await setLastSync(syncStart);

  } catch (e) {
    console.error('[TWILIO_SYNC] Error general:', e.message);
  }
}

module.exports = { syncTwilioMessages };
