const twilio = require('twilio');
const { pool } = require('../services/db');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
const callerNumber = process.env.TWILIO_PHONE_NUMBER;

// ── Access Token (navegador → Twilio Voice) ───────────────────────────────────
async function getToken(req, res) {
  try {
    if (!accountSid || !twimlAppSid) {
      return res.status(503).json({ error: 'Twilio no configurado. Verifica TWILIO_ACCOUNT_SID y TWILIO_TWIML_APP_SID.' });
    }

    const { AccessToken } = twilio.jwt;
    const { VoiceGrant } = AccessToken;

    // Prefer API Key (SK...) + Secret; fall back to Account SID + Auth Token
    const apiKeySid    = process.env.TWILIO_API_KEY_SID    || accountSid;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || authToken;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: `agent_${req.user.id}`,
      ttl: 3600,
    });
    token.addGrant(new VoiceGrant({ outgoingApplicationSid: twimlAppSid, incomingAllow: false }));

    res.json({ token: token.toJwt(), identity: `agent_${req.user.id}` });
  } catch (err) {
    console.error('[CALLS token]', err.message);
    res.status(500).json({ error: 'Error generando token de llamada' });
  }
}

// ── TwiML webhook: Twilio llama a este endpoint para saber qué hacer ──────────
// PUBLIC — no requiere auth
async function twimlHandler(req, res) {
  const to = req.body.To || req.query.To;
  const twiml = new twilio.twiml.VoiceResponse();

  if (to) {
    const dial = twiml.dial({
      callerId: callerNumber,
      timeout: 30,
      record: 'record-from-answer',
      recordingStatusCallback: '/api/calls/recording-callback',
      recordingStatusCallbackMethod: 'POST',
    });
    if (to.startsWith('client:')) {
      dial.client(to.replace('client:', ''));
    } else {
      dial.number(to);
    }
  } else {
    twiml.say({ language: 'es-US' }, 'No se especificó un número de destino.');
  }

  res.type('text/xml').send(twiml.toString());
}

// ── Status callback: Twilio nos avisa cuando termina la llamada ───────────────
// PUBLIC — no requiere auth
async function statusCallback(req, res) {
  try {
    const { CallSid, CallStatus, CallDuration, To, From } = req.body;

    await pool.query(`
      UPDATE call_logs
      SET status = $1, duration = $2, updated_at = NOW()
      WHERE call_sid = $3
    `, [CallStatus, parseInt(CallDuration) || 0, CallSid]);

    // Si no existe el registro aún (llamada iniciada desde fuera), crearlo
    const exists = await pool.query('SELECT id FROM call_logs WHERE call_sid = $1', [CallSid]);
    if (exists.rows.length === 0 && CallStatus !== 'initiated') {
      await pool.query(`
        INSERT INTO call_logs (call_sid, to_number, from_number, status, duration)
        VALUES ($1, $2, $3, $4, $5)
      `, [CallSid, To, From, CallStatus, parseInt(CallDuration) || 0]);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[CALLS status]', err.message);
    res.sendStatus(200); // siempre 200 a Twilio
  }
}

// ── Iniciar llamada y registrar en log ────────────────────────────────────────
async function iniciarLlamada(req, res) {
  try {
    const { lead_id, to_number } = req.body;
    if (!to_number) return res.status(400).json({ error: 'to_number requerido' });

    // Limpiar número (solo dígitos + +)
    const numero = to_number.replace(/[^\d+]/g, '');

    // Registrar en call_logs antes de iniciar
    const log = await pool.query(`
      INSERT INTO call_logs (lead_id, agent_id, to_number, from_number, status)
      VALUES ($1, $2, $3, $4, 'initiated') RETURNING id
    `, [lead_id || null, req.user.id, numero, callerNumber]);

    res.json({ ok: true, log_id: log.rows[0].id, to_number: numero });
  } catch (err) {
    console.error('[CALLS iniciar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Actualizar log cuando la llamada termina (llamado desde frontend) ─────────
async function actualizarLog(req, res) {
  try {
    const { call_sid, duration, status } = req.body;
    await pool.query(`
      UPDATE call_logs SET call_sid = $1, duration = $2, status = $3, updated_at = NOW()
      WHERE id = $4
    `, [call_sid || null, duration || 0, status || 'completed', req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Listar logs de un lead ────────────────────────────────────────────────────
async function listarLogs(req, res) {
  try {
    const { lead_id } = req.query;
    const where = lead_id ? 'WHERE cl.lead_id = $1' : '';
    const params = lead_id ? [lead_id] : [];
    const limit = lead_id ? 50 : 200;

    const ownDigits = (process.env.TWILIO_PHONE_NUMBER || '').replace(/\D/g,'').slice(-10);

    const result = await pool.query(`
      SELECT
        cl.id, cl.call_sid, cl.to_number, cl.from_number, cl.status,
        cl.duration, cl.recording_url, cl.recording_sid, cl.agent_id,
        cl.created_at, cl.updated_at,
        u.name AS agent_name,
        COALESCE(cl.lead_id, phone_lead.lead_id) AS lead_id,
        COALESCE(
          COALESCE(l.title, c.name),
          phone_lead.lead_name
        ) AS lead_name
      FROM call_logs cl
      LEFT JOIN users u ON u.id = cl.agent_id
      LEFT JOIN leads l ON l.id = cl.lead_id
      LEFT JOIN contacts c ON c.id = l.contact_id
      LEFT JOIN LATERAL (
        SELECT l2.id AS lead_id, COALESCE(l2.title, c2.name) AS lead_name
        FROM contacts c2
        JOIN leads l2 ON l2.contact_id = c2.id
        WHERE cl.lead_id IS NULL
          AND c2.phone IS NOT NULL
          -- Excluir el propio número de Twilio de los contactos
          AND RIGHT(REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g'), 10) != $${params.length + 1}
          AND RIGHT(REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g'), 10) =
              CASE
                WHEN cl.from_number IS NOT NULL
                     AND RIGHT(REGEXP_REPLACE(cl.from_number, '[^0-9]', '', 'g'), 10) != $${params.length + 1}
                THEN RIGHT(REGEXP_REPLACE(cl.from_number, '[^0-9]', '', 'g'), 10)
                WHEN cl.to_number IS NOT NULL
                     AND RIGHT(REGEXP_REPLACE(cl.to_number, '[^0-9]', '', 'g'), 10) != $${params.length + 1}
                THEN RIGHT(REGEXP_REPLACE(cl.to_number, '[^0-9]', '', 'g'), 10)
                ELSE NULL
              END
        ORDER BY l2.id DESC
        LIMIT 1
      ) phone_lead ON cl.lead_id IS NULL
      ${where}
      ORDER BY cl.created_at DESC
      LIMIT ${limit}
    `, [...params, ownDigits]);

    res.json(result.rows);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getToken, twimlHandler, statusCallback, iniciarLlamada, actualizarLog, listarLogs };
