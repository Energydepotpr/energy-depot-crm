'use strict';
/**
 * Energy Depot — Welcome 7-Touch Sequence Engine
 *
 * Tabla: lead_sequences (separada de la tabla `sequences` admin-driven)
 * Hardcoded flow: pide factura LUMA por WhatsApp/SMS/Email, escala con prueba social
 * y cierre suave. Pausa al primer responder. Idempotente y recuperable.
 *
 * Ejecutar tick cada 60s desde server.js.
 */

const { pool } = require('./db');
const { enviarSMS, enviarWhatsApp } = require('./twilioService');
const { getConfigValue } = require('./configService');

// ─── Constants ────────────────────────────────────────────────────────────────
const SEQUENCE_NAME = 'welcome_7touches';
const MAX_ATTEMPTS  = 3;
const COTIZAR_LINK_DEFAULT = 'https://crm-energydepotpr.com/cotizar';

// ─── Sequence definition (delays son acumulables — delay desde el paso ANTERIOR)
const STEPS = [
  // T+0: WhatsApp bienvenida
  { step: 1, channel: 'whatsapp', delay: 0,
    text: ({ primer_nombre, cotizar_link }) =>
`¡Hola ${primer_nombre}! 👋 Soy del equipo Energy Depot. Vi que te interesa salir de los apagones y los aumentos de LUMA 🌞

Si me envías una FOTO de tu última factura LUMA, en 5 minutos te mando tu cotización personalizada (sin compromiso).

O si prefieres, hazla tú mismo aquí: ${cotizar_link}` },

  // T+1 min: SMS espejo
  { step: 2, channel: 'sms', delay: 60 * 1000,
    text: ({ primer_nombre, cotizar_link }) =>
`Energy Depot: ${primer_nombre}, te escribí por WhatsApp. Si prefieres SMS, contesta esta línea con foto de tu factura LUMA y en 5 min te mando tu cotización. O: ${cotizar_link}` },

  // T+1h: Email seguimiento
  { step: 3, channel: 'email', delay: 60 * 60 * 1000,
    template: 'welcome_followup',
    subject: ({ primer_nombre }) => `${primer_nombre}, tu cotización solar en 5 minutos` },

  // Día 1 (~+18h): WhatsApp prueba social
  { step: 4, channel: 'whatsapp', delay: 18 * 60 * 60 * 1000,
    text: ({ primer_nombre, cotizar_link }) =>
`${primer_nombre}, mira esta foto 👇 Así quedó la casa de una familia en tu zona. Llevan meses pagando $0 a LUMA. ¿Te paso tu cotización para que veas cuánto ahorrarías? Solo necesito tu factura: ${cotizar_link}` },

  // Día 2 (~+16h después): SMS reframe financiero
  { step: 5, channel: 'sms', delay: 16 * 60 * 60 * 1000,
    text: ({ cotizar_link }) =>
`Energy Depot: La cuota mensual del sistema suele ser MENOR que tu recibo de LUMA actual. No es un gasto extra, es cambiar un pago por uno más bajo. Mándame tu factura y te muestro con tus números: ${cotizar_link}` },

  // Día 4 (+2d): WhatsApp con incentivo
  { step: 6, channel: 'whatsapp', delay: 2 * 24 * 60 * 60 * 1000,
    text: ({ primer_nombre }) =>
`${primer_nombre}, este mes hay cupos limitados de instalación para tu zona. Si me envías tu factura LUMA hoy, tu cotización entra con beneficio adicional aplicado. ¿Lo aprovechamos? 📸` },

  // Día 7 (+3d): cierre suave
  { step: 7, channel: 'whatsapp', delay: 3 * 24 * 60 * 60 * 1000,
    text: ({ primer_nombre, cotizar_link }) =>
`Hola ${primer_nombre}, último mensaje por ahora. Si en algún momento quieres tu cotización gratis, aquí estoy: ${cotizar_link}. Si NO te interesa, contéstame "no" y dejo de escribirte 🙏` },
];

function getStep(stepNum) {
  return STEPS.find(s => s.step === stepNum) || null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
let ensured = false;
async function ensureLeadSequencesTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_sequences (
      id              SERIAL PRIMARY KEY,
      lead_id         INT NOT NULL,
      sequence_name   VARCHAR(80) DEFAULT 'welcome_7touches',
      current_step    INT DEFAULT 0,
      status          VARCHAR(30) DEFAULT 'active',
      paused_reason   VARCHAR(160),
      next_send_at    TIMESTAMP,
      last_event_at   TIMESTAMP DEFAULT NOW(),
      attempts        INT DEFAULT 0,
      meta            JSONB DEFAULT '{}'::jsonb,
      created_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_lead_sequences_lead ON lead_sequences(lead_id);
    CREATE INDEX IF NOT EXISTS idx_lead_sequences_next ON lead_sequences(next_send_at) WHERE status='active';
  `);
  ensured = true;
}
ensureLeadSequencesTable().catch(e => console.error('[sequenceEngine] ensure table:', e.message));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function firstName(name) {
  if (!name) return 'amigo';
  return String(name).trim().split(/\s+/)[0];
}

async function loadLeadContext(leadId) {
  const r = await pool.query(
    `SELECT l.id, l.title, l.solar_data, c.name AS contact_name, c.phone, c.email
     FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
     WHERE l.id = $1`,
    [leadId]
  );
  if (!r.rows[0]) return null;
  const lead = r.rows[0];
  const sd = lead.solar_data || {};
  const nombre = lead.contact_name || sd.nombre || lead.title || '';
  const phone  = lead.phone || sd.telefono || null;
  const email  = lead.email || sd.email || null;
  const cotizarLink = await getConfigValue('public_cotizar_url', COTIZAR_LINK_DEFAULT);
  return {
    nombre,
    primer_nombre: firstName(nombre),
    phone, email,
    municipio: sd.city || '',
    cotizar_link: cotizarLink,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
async function startSequence(leadId, sequenceName = SEQUENCE_NAME) {
  await ensureLeadSequencesTable();
  if (!leadId) return null;
  // Idempotente: si ya hay activa, no duplicar
  const dup = await pool.query(
    `SELECT id FROM lead_sequences WHERE lead_id=$1 AND status='active' LIMIT 1`,
    [leadId]
  );
  if (dup.rows[0]) {
    console.log(`[sequenceEngine] lead ${leadId} ya tiene secuencia activa #${dup.rows[0].id}`);
    return dup.rows[0].id;
  }
  const first = STEPS[0];
  const nextAt = new Date(Date.now() + (first.delay || 0));
  const r = await pool.query(
    `INSERT INTO lead_sequences (lead_id, sequence_name, current_step, status, next_send_at)
     VALUES ($1, $2, 1, 'active', $3) RETURNING id`,
    [leadId, sequenceName, nextAt]
  );
  console.log(`[sequenceEngine] startSequence lead=${leadId} id=${r.rows[0].id} next=${nextAt.toISOString()}`);
  return r.rows[0].id;
}

async function pauseSequence(leadId, reason = 'responded') {
  await ensureLeadSequencesTable();
  if (!leadId) return;
  const newStatus = /^(no|stop|baja|unsubscribe)/i.test(reason) ? 'unsubscribed' : 'paused';
  const r = await pool.query(
    `UPDATE lead_sequences
       SET status = $1, paused_reason = $2, last_event_at = NOW()
     WHERE lead_id = $3 AND status = 'active'
     RETURNING id`,
    [newStatus, String(reason).slice(0, 160), leadId]
  );
  if (r.rowCount > 0) {
    console.log(`[sequenceEngine] pauseSequence lead=${leadId} status=${newStatus} reason="${reason}"`);
  }
}

// ─── Step execution ───────────────────────────────────────────────────────────
async function executeStep(row, step, ctx) {
  if (step.channel === 'whatsapp') {
    if (!ctx.phone) throw new Error('sin teléfono');
    const body = step.text(ctx);
    try {
      await enviarWhatsApp(ctx.phone, body);
    } catch (e) {
      // Fallback a SMS si falla WhatsApp (típico: lead sin WA)
      console.warn(`[sequenceEngine] WA falló para lead ${row.lead_id}, fallback SMS: ${e.message}`);
      await enviarSMS(ctx.phone, body);
    }
  } else if (step.channel === 'sms') {
    if (!ctx.phone) throw new Error('sin teléfono');
    await enviarSMS(ctx.phone, step.text(ctx));
  } else if (step.channel === 'email') {
    if (!ctx.email) throw new Error('sin email');
    const { sendEmail } = require('./gmailService');
    const tmpl = require('../templates/emailWelcomeFollowup');
    const built = tmpl.build(ctx);
    const autoBcc = await getConfigValue('email_auto_bcc', '');
    await sendEmail({
      from: '"Energy Depot LLC" <info@energydepotpr.com>',
      to: ctx.email,
      bcc: autoBcc || undefined,
      subject: step.subject(ctx),
      text: built.text,
      html: built.html,
    });
  } else {
    throw new Error('canal desconocido: ' + step.channel);
  }
  // Log outbound message
  await pool.query(
    `INSERT INTO messages (lead_id, direction, text, channel, is_bot)
     VALUES ($1, 'outbound', $2, $3, true)`,
    [row.lead_id, (step.text ? step.text(ctx) : `[email] ${step.subject(ctx)}`), step.channel]
  ).catch(() => {});
}

// ─── Tick (cron 60s) ──────────────────────────────────────────────────────────
let tickRunning = false;
async function tick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    await ensureLeadSequencesTable();
    const due = await pool.query(
      `SELECT * FROM lead_sequences
        WHERE status = 'active' AND next_send_at IS NOT NULL AND next_send_at <= NOW()
        ORDER BY next_send_at ASC LIMIT 50`
    );
    if (!due.rows.length) return;
    console.log(`[sequenceEngine] tick: ${due.rows.length} fila(s) due`);

    for (const row of due.rows) {
      const step = getStep(row.current_step);
      if (!step) {
        await pool.query(
          `UPDATE lead_sequences SET status='completed', last_event_at=NOW() WHERE id=$1`,
          [row.id]
        );
        continue;
      }
      const ctx = await loadLeadContext(row.lead_id);
      if (!ctx) {
        await pool.query(
          `UPDATE lead_sequences SET status='completed', paused_reason='lead_missing', last_event_at=NOW() WHERE id=$1`,
          [row.id]
        );
        continue;
      }
      try {
        await executeStep(row, step, ctx);
        // Avanzar al siguiente paso
        const next = getStep(row.current_step + 1);
        if (next) {
          const nextAt = new Date(Date.now() + (next.delay || 0));
          await pool.query(
            `UPDATE lead_sequences
               SET current_step=$1, next_send_at=$2, attempts=0, last_event_at=NOW()
             WHERE id=$3`,
            [next.step, nextAt, row.id]
          );
          console.log(`[sequenceEngine] lead=${row.lead_id} paso ${step.step}→${next.step} (${step.channel}) next=${nextAt.toISOString()}`);
        } else {
          await pool.query(
            `UPDATE lead_sequences SET status='completed', last_event_at=NOW() WHERE id=$1`,
            [row.id]
          );
          console.log(`[sequenceEngine] lead=${row.lead_id} secuencia completada`);
        }
      } catch (err) {
        const attempts = (row.attempts || 0) + 1;
        console.warn(`[sequenceEngine] lead=${row.lead_id} paso ${step.step} (${step.channel}) FALLÓ intento ${attempts}/${MAX_ATTEMPTS}: ${err.message}`);
        if (attempts >= MAX_ATTEMPTS) {
          // Saltar canal y avanzar al siguiente paso
          const next = getStep(row.current_step + 1);
          if (next) {
            const nextAt = new Date(Date.now() + (next.delay || 0));
            await pool.query(
              `UPDATE lead_sequences
                 SET current_step=$1, next_send_at=$2, attempts=0,
                     meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('skipped_step_'||$3::text, $4::text),
                     last_event_at=NOW()
               WHERE id=$5`,
              [next.step, nextAt, step.step, err.message.slice(0, 120), row.id]
            );
          } else {
            await pool.query(
              `UPDATE lead_sequences SET status='failed_channel', paused_reason=$1, last_event_at=NOW() WHERE id=$2`,
              [err.message.slice(0, 160), row.id]
            );
          }
        } else {
          // Reintentar en 5 min × intento
          const retryAt = new Date(Date.now() + 5 * 60 * 1000 * attempts);
          await pool.query(
            `UPDATE lead_sequences SET attempts=$1, next_send_at=$2, last_event_at=NOW() WHERE id=$3`,
            [attempts, retryAt, row.id]
          );
        }
      }
    }
  } catch (e) {
    console.error('[sequenceEngine] tick error:', e.message);
  } finally {
    tickRunning = false;
  }
}

module.exports = {
  ensureLeadSequencesTable,
  startSequence,
  pauseSequence,
  tick,
  STEPS,
};
