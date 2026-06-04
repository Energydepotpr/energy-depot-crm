const { pool } = require('../services/db');
const { enviarSMS, enviarWhatsApp } = require('../services/twilioService');
const sse = require('../services/sse');

async function listarInbox(req, res) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (m.lead_id)
        m.*,
        l.title AS lead_title,
        c.name AS contact_name, c.phone AS contact_phone,
        ps.name AS stage_name, ps.color AS stage_color
      FROM messages m
      LEFT JOIN leads l ON l.id = m.lead_id
      LEFT JOIN contacts c ON c.id = l.contact_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      ORDER BY m.lead_id, m.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function enviarMensaje(req, res) {
  try {
    const { lead_id, text } = req.body;
    if (!lead_id || !text?.trim()) return res.status(400).json({ error: 'lead_id y text requeridos' });

    const leadR = await pool.query(
      `SELECT c.phone, l.contact_id, l.title, l.source FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id WHERE l.id = $1`,
      [lead_id]
    );
    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });

    const { phone: telefono, contact_id, title: leadTitle, source: leadSource } = leadR.rows[0];

    // Canal: usar el que manda el frontend, si no detectar del último mensaje entrante
    let canal = req.body.channel;
    if (!canal) {
      const canalR = await pool.query(
        `SELECT channel FROM messages WHERE lead_id=$1 AND direction='inbound' ORDER BY created_at DESC LIMIT 1`,
        [lead_id]
      );
      canal = canalR.rows[0]?.channel || 'sms';
    }

    // TODO el envío sale por Leadgogo — el número de Energy Depot (787-627-8585)
    // vive en Leadgogo, NO en Twilio. Buscamos el contacto de Leadgogo por:
    //   1) ID en el título (LG-<id>)   2) teléfono del lead (búsqueda)
    const lg = require('../services/leadgogoApi');
    const lgMatch = String(leadTitle || '').match(/LG-(\d+)/);
    let lgContactId = lgMatch ? lgMatch[1] : null;

    let twilio_sid = null;

    if (!lgContactId && telefono) {
      try { lgContactId = await lg.findContactByPhone(telefono); }
      catch (e) { console.error('[MSG] búsqueda Leadgogo', e.message); }
    }

    if (lgContactId) {
      try {
        const { channel: usedCh } = await lg.replyToContact(lgContactId, text.trim());
        canal = 'leadgogo';
        console.log(`[MSG] enviado a Leadgogo contacto ${lgContactId} via ${usedCh}`);
      } catch (e) {
        console.error('[MSG] Error Leadgogo:', e.message);
        return res.status(500).json({ error: 'Error enviando por Leadgogo: ' + e.message });
      }
    } else if (telefono && (canal === 'sms' || canal === 'whatsapp')) {
      // Fallback Twilio solo si NO se encontró el contacto en Leadgogo
      try {
        const result = await enviarSMS(telefono, text.trim());
        twilio_sid = result.sid;
      } catch (e) {
        console.error('[MSG] Error Twilio:', e.message);
        return res.status(500).json({ error: 'No se encontró el contacto en Leadgogo y Twilio falló: ' + e.message });
      }
    } else {
      return res.status(400).json({ error: 'No se pudo enviar: el lead no tiene contacto en Leadgogo ni teléfono válido' });
    }

    const msg = await pool.query(
      `INSERT INTO messages (lead_id, contact_id, direction, text, sent_by, is_bot, twilio_sid, channel)
       VALUES ($1,$2,'outbound',$3,$4,false,$5,$6) RETURNING *`,
      [lead_id, contact_id, text.trim(), req.user.id, twilio_sid, canal]
    );

    await pool.query(
      `UPDATE leads SET updated_at=NOW(),
        assigned_to = CASE WHEN assigned_to IS NULL THEN $2 ELSE assigned_to END
       WHERE id=$1`,
      [lead_id, req.user.id]
    );

    sse.broadcast('new_message', { lead_id: Number(lead_id), direction: 'outbound' });
    res.json({ ...msg.rows[0], canal });
  } catch (err) {
    console.error('[MSG enviar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listarMensajesLead(req, res) {
  try {
    const result = await pool.query(
      `SELECT m.*, u.name AS sent_by_name
       FROM messages m LEFT JOIN users u ON u.id = m.sent_by
       WHERE m.lead_id = $1 ORDER BY m.created_at ASC`,
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listarInbox, enviarMensaje, listarMensajesLead };
