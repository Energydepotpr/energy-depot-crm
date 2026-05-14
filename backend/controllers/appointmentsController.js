'use strict';
const { pool } = require('../services/db');
const { getConfigValue } = require('../services/configService');

// Asegura la tabla en runtime — idempotente. Se llama una vez al levantar el server.
let _ensured = false;
async function ensureAppointmentsTable() {
  if (_ensured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
        contact_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        city VARCHAR(120),
        reason VARCHAR(40) NOT NULL,
        reason_other TEXT,
        type VARCHAR(20) NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        duration_min INT DEFAULT 30,
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    `);
    _ensured = true;
  } catch (e) { console.error('[appointments] ensure table:', e.message); }
}
ensureAppointmentsTable();

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Puerto Rico timezone: UTC-4 (sin DST). Trabajamos los slots en hora local PR
// y guardamos en UTC sumándole 4 horas.
const PR_OFFSET_HOURS = 4; // PR = UTC - 4 → para convertir PR local → UTC sumamos 4h

// Construye un Date ISO en UTC desde fecha YYYY-MM-DD + hora HH:MM en hora PR
function prLocalToUTC(dateStr, timeStr) {
  // dateStr: '2026-05-15', timeStr: '10:00'
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  // Date.UTC asume UTC, así que sumamos el offset
  return new Date(Date.UTC(y, m - 1, d, hh + PR_OFFSET_HOURS, mm, 0));
}

// Convierte un Date a string ISO en hora PR ('2026-05-15T10:00')
function utcToPrLocal(date) {
  const d = new Date(date);
  // Restamos el offset para llegar a hora PR
  const pr = new Date(d.getTime() - PR_OFFSET_HOURS * 3600 * 1000);
  const Y = pr.getUTCFullYear();
  const M = String(pr.getUTCMonth() + 1).padStart(2, '0');
  const D = String(pr.getUTCDate()).padStart(2, '0');
  const h = String(pr.getUTCHours()).padStart(2, '0');
  const m = String(pr.getUTCMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D}T${h}:${m}`;
}

const REASON_LABELS = {
  orientacion:    '🎓 Orientación sobre energía solar',
  dudas:          '❓ Aclarar dudas sobre el sistema',
  financiamiento: '💰 Opciones de financiamiento',
  cotizacion:     '📋 Cotización personalizada',
  otra:           '💬 Otra razón',
};
const REASON_KEYS = Object.keys(REASON_LABELS);
const TYPE_VALUES = ['llamada', 'visita'];

// ─── GET /api/public/agendar/slots ────────────────────────────────────────────
// Calcula slots de 30 min lun-vie 9:00-17:00 hora PR entre from y to.
// Devuelve { available: [...], taken: [...] } en hora PR (YYYY-MM-DDTHH:mm)
async function getPublicSlots(req, res) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from y to requeridos (YYYY-MM-DD)' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    const fromUtc = prLocalToUTC(from, '00:00');
    const toUtc   = prLocalToUTC(to,   '23:59');

    // Leer citas existentes en ese rango
    const r = await pool.query(
      `SELECT scheduled_at FROM appointments
       WHERE scheduled_at BETWEEN $1 AND $2
         AND status <> 'cancelled'`,
      [fromUtc.toISOString(), toUtc.toISOString()]
    );
    const taken = new Set(r.rows.map(row => utcToPrLocal(row.scheduled_at)));

    // Generar slots
    const available = [];
    const takenList = [];
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const fromDate = new Date(Date.UTC(fy, fm - 1, fd));
    const toDate   = new Date(Date.UTC(ty, tm - 1, td));
    // Punto "ahora" en hora PR
    const nowPr = new Date(Date.now() - PR_OFFSET_HOURS * 3600 * 1000);

    for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay(); // 0=dom 6=sab
      if (dow === 0 || dow === 6) continue;
      const Y = d.getUTCFullYear();
      const M = String(d.getUTCMonth() + 1).padStart(2, '0');
      const D = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${Y}-${M}-${D}`;
      // 9:00 → 16:30 (último slot inicia 16:30, termina 17:00)
      for (let h = 9; h < 17; h++) {
        for (let m = 0; m < 60; m += 30) {
          const hh = String(h).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          const iso = `${dateStr}T${hh}:${mm}`;
          // Excluir slots ya pasados (comparando en hora PR)
          const slotPr = new Date(Date.UTC(Y, d.getUTCMonth(), d.getUTCDate(), h, m));
          if (slotPr < nowPr) continue;
          if (taken.has(iso)) takenList.push(iso);
          else available.push(iso);
        }
      }
    }

    res.json({ available, taken: takenList });
  } catch (e) {
    console.error('[appointments slots]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── POST /api/public/agendar ─────────────────────────────────────────────────
async function createPublicAppointment(req, res) {
  try {
    const { name, email, phone, city, reason, reason_other, type, scheduled_at } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name requerido' });
    if (!email && !phone) return res.status(400).json({ error: 'email o phone requerido' });
    if (!REASON_KEYS.includes(reason)) return res.status(400).json({ error: 'reason inválido' });
    if (!TYPE_VALUES.includes(type)) return res.status(400).json({ error: 'type inválido' });
    if (!scheduled_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduled_at)) {
      return res.status(400).json({ error: 'scheduled_at inválido (YYYY-MM-DDTHH:mm en hora PR)' });
    }
    if (reason === 'otra' && !reason_other?.trim()) {
      return res.status(400).json({ error: 'Describe el motivo' });
    }

    const [datePart, timePart] = scheduled_at.split('T');
    const scheduledUtc = prLocalToUTC(datePart, timePart);

    // Validar slot disponible (lun-vie, 9-17, alineado 30 min, no tomado)
    const [hh, mm] = timePart.split(':').map(Number);
    const dow = scheduledUtc.getUTCDay(); // en UTC pero como sumamos +4h se conserva la fecha PR
    // Recalculamos dow en hora PR
    const prDate = new Date(scheduledUtc.getTime() - PR_OFFSET_HOURS * 3600 * 1000);
    const prDow = prDate.getUTCDay();
    if (prDow === 0 || prDow === 6) return res.status(400).json({ error: 'Solo lun-vie' });
    if (hh < 9 || hh >= 17 || (mm !== 0 && mm !== 30)) {
      return res.status(400).json({ error: 'Slot fuera de horario' });
    }
    if (scheduledUtc.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Slot ya pasó' });
    }

    // Verificar que el slot no esté tomado
    const taken = await pool.query(
      `SELECT id FROM appointments WHERE scheduled_at = $1 AND status <> 'cancelled' LIMIT 1`,
      [scheduledUtc.toISOString()]
    );
    if (taken.rows.length) {
      return res.status(409).json({ error: 'Ese horario ya fue reservado. Elige otro.' });
    }

    // Dedup contacto + lead (igual que publicLeadController)
    let contactId = null;
    if (email || phone) {
      const existing = await pool.query(
        `SELECT id FROM contacts WHERE email = $1 OR phone = $2 LIMIT 1`,
        [email || null, phone || null]
      );
      if (existing.rows[0]) {
        contactId = existing.rows[0].id;
      } else {
        const cR = await pool.query(
          `INSERT INTO contacts (name, email, phone) VALUES ($1,$2,$3) RETURNING id`,
          [name.trim(), email || null, phone || null]
        );
        contactId = cR.rows[0].id;
      }
    }

    // Buscar / crear lead
    let leadId = null;
    if (contactId) {
      const existing = await pool.query(
        `SELECT id FROM leads WHERE contact_id = $1
           AND (lost_reason IS NULL OR lost_reason = '')
         ORDER BY created_at DESC LIMIT 1`,
        [contactId]
      );
      if (existing.rows[0]) leadId = existing.rows[0].id;
    }
    if (!leadId) {
      const pipR = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
      const pid  = pipR.rows[0]?.id || null;
      let sid = null;
      if (pid) {
        const stR = await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position LIMIT 1', [pid]);
        sid = stR.rows[0]?.id || null;
      }
      const title = `${name.trim()} — Cita agendada`;
      const solarData = {
        email: email || null,
        telefono: phone || null,
        city: city || null,
        source: 'agendar-web',
        submittedAt: new Date().toISOString(),
      };
      const leadR = await pool.query(
        `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, value, solar_data, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [title, contactId, pid, sid, 0, JSON.stringify(solarData), 'agendar-web']
      );
      leadId = leadR.rows[0].id;
    }

    // Crear appointment
    const apptR = await pool.query(
      `INSERT INTO appointments
        (lead_id, contact_name, contact_email, contact_phone, city, reason, reason_other, type, scheduled_at, duration_min, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        leadId,
        name.trim(),
        email || null,
        phone || null,
        city || null,
        reason,
        reason === 'otra' ? (reason_other || '').trim().slice(0, 1000) : null,
        type,
        scheduledUtc.toISOString(),
        30,
        'pending',
      ]
    );
    const appointment = apptR.rows[0];

    const reasonLabel = REASON_LABELS[reason] || reason;
    const typeLabel = type === 'llamada' ? '📞 Llamada' : '🏠 Visita presencial';
    const fechaPr = new Date(scheduledUtc.getTime() - PR_OFFSET_HOURS * 3600 * 1000);
    const fechaStr = `${String(fechaPr.getUTCDate()).padStart(2,'0')}/${String(fechaPr.getUTCMonth()+1).padStart(2,'0')}/${fechaPr.getUTCFullYear()} ${timePart}`;

    // Tarea para el lead
    try {
      await pool.query(
        `INSERT INTO tasks (lead_id, title, due_date)
         VALUES ($1, $2, $3)`,
        [leadId, `${typeLabel} agendada — ${reasonLabel}`, scheduledUtc.toISOString()]
      );
    } catch (e) { console.error('[appointment task]', e.message); }

    // Alert in-app
    try {
      await pool.query(
        `INSERT INTO alerts (title, message, lead_id, seen, type) VALUES ($1,$2,$3,false,$4)`,
        [
          '📅 Nueva cita agendada',
          `${name.trim()} — ${reasonLabel} · ${typeLabel} · ${fechaStr} PR`,
          leadId,
          'info',
        ]
      );
    } catch (e) { console.error('[appointment alert]', e.message); }

    // Email interno
    try {
      const notifyTo = await getConfigValue('email_auto_bcc', 'gil.diaz@energydepotpr.com');
      if (notifyTo) {
        const { sendEmail } = require('../services/gmailService');
        const crmLink = `https://crm-energydepotpr.com/leads/${leadId}`;
        await sendEmail({
          from: '"Energy Depot CRM" <info@energydepotpr.com>',
          to: notifyTo,
          subject: `📅 Nueva cita — ${name.trim()} (${fechaStr})`,
          text: `${name.trim()}\nMotivo: ${reasonLabel}\nTipo: ${typeLabel}\nFecha: ${fechaStr} PR\nEmail: ${email || '-'}\nTel: ${phone || '-'}\nCiudad: ${city || '-'}\n${reason === 'otra' ? 'Detalle: ' + (reason_other || '') + '\n' : ''}Ver lead: ${crmLink}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a3c8f;margin:0 0 12px;">📅 Nueva cita agendada</h2>
  <table style="font-size:14px;color:#374151;border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Cliente:</td><td style="padding:4px 0;font-weight:600;">${name.trim()}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Motivo:</td><td style="padding:4px 0;">${reasonLabel}</td></tr>
    ${reason === 'otra' ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Detalle:</td><td style="padding:4px 0;">${(reason_other||'').replace(/</g,'&lt;')}</td></tr>` : ''}
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Tipo:</td><td style="padding:4px 0;">${typeLabel}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Fecha:</td><td style="padding:4px 0;font-weight:600;">${fechaStr} (hora PR)</td></tr>
    ${email ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Email:</td><td style="padding:4px 0;">${email}</td></tr>` : ''}
    ${phone ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Teléfono:</td><td style="padding:4px 0;">${phone}</td></tr>` : ''}
    ${city ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Ciudad:</td><td style="padding:4px 0;">${city}</td></tr>` : ''}
  </table>
  <a href="${crmLink}" style="display:inline-block;background:#1a3c8f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700;margin-top:8px;">Ver lead en el CRM →</a>
</div>`.trim(),
        }).catch(e => console.error('[appointment email interno]', e.message));
      }
    } catch (e) { console.error('[appointment notify]', e.message); }

    // Email de confirmación al cliente
    if (email) {
      try {
        const { sendEmail } = require('../services/gmailService');
        await sendEmail({
          from: '"Energy Depot LLC" <info@energydepotpr.com>',
          to: email,
          subject: `✅ Tu cita con Energy Depot — ${fechaStr}`,
          text: `Hola ${name.trim()},\n\nTu cita con Energy Depot quedó confirmada:\n\nMotivo: ${reasonLabel}\nTipo: ${typeLabel}\nFecha: ${fechaStr} (hora de Puerto Rico)\n\nTe contactaremos para confirmar los detalles. Si necesitas reprogramar, escríbenos al WhatsApp: 787-627-8585.\n\nGracias,\nEnergy Depot LLC`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;">
  <div style="background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.04);">
    <div style="background:linear-gradient(135deg,#1a3c8f,#0f2558);color:#fff;border-radius:10px;padding:20px;text-align:center;margin:-8px -8px 18px;">
      <h2 style="margin:0;font-size:22px;">✅ Tu cita está confirmada</h2>
    </div>
    <p style="color:#374151;font-size:15px;">Hola <strong>${name.trim()}</strong>,</p>
    <p style="color:#374151;font-size:14px;">Gracias por agendar con Energy Depot. Aquí están los detalles:</p>
    <table style="font-size:14px;color:#374151;border-collapse:collapse;margin:14px 0;width:100%;">
      <tr><td style="padding:6px 12px 6px 0;color:#6b7280;width:110px;">Motivo:</td><td style="padding:6px 0;">${reasonLabel}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Tipo:</td><td style="padding:6px 0;">${typeLabel}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Fecha:</td><td style="padding:6px 0;font-weight:600;color:#1a3c8f;">${fechaStr} (hora PR)</td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;">Te contactaremos antes para confirmar. Si necesitas reprogramar:</p>
    <div style="text-align:center;margin:18px 0;">
      <a href="https://wa.me/17876278585" style="display:inline-block;background:#25d366;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">💬 WhatsApp 787-627-8585</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">Energy Depot LLC · Puerto Rico</p>
  </div>
</div>`.trim(),
        }).catch(e => console.error('[appointment email cliente]', e.message));
      } catch (e) { console.error('[appointment cliente notify]', e.message); }
    }

    res.json({
      ok: true,
      appointment_id: appointment.id,
      lead_id: leadId,
      scheduled_at: scheduled_at,
      reason_label: reasonLabel,
      type_label: typeLabel,
    });
  } catch (err) {
    console.error('[appointments crear]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── GET /api/appointments (auth) ─────────────────────────────────────────────
async function listAppointments(req, res) {
  try {
    const { lead_id, status, from, to } = req.query;
    const cond = [];
    const params = [];
    if (lead_id) { params.push(lead_id); cond.push(`a.lead_id = $${params.length}`); }
    if (status)  { params.push(status);  cond.push(`a.status = $${params.length}`); }
    if (from)    { params.push(prLocalToUTC(from, '00:00').toISOString()); cond.push(`a.scheduled_at >= $${params.length}`); }
    if (to)      { params.push(prLocalToUTC(to,   '23:59').toISOString()); cond.push(`a.scheduled_at <= $${params.length}`); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

    const r = await pool.query(
      `SELECT a.*, l.title AS lead_title
       FROM appointments a
       LEFT JOIN leads l ON l.id = a.lead_id
       ${where}
       ORDER BY a.scheduled_at ASC`,
      params
    );
    const rows = r.rows.map(row => ({
      ...row,
      scheduled_at_pr: utcToPrLocal(row.scheduled_at),
      reason_label: REASON_LABELS[row.reason] || row.reason,
    }));
    res.json(rows);
  } catch (e) {
    console.error('[appointments listar]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── PATCH /api/appointments/:id ──────────────────────────────────────────────
async function updateAppointment(req, res) {
  try {
    const { status, notes } = req.body || {};
    const sets = ['updated_at = NOW()'];
    const params = [];
    if (status !== undefined) {
      if (!['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) {
        return res.status(400).json({ error: 'status inválido' });
      }
      params.push(status); sets.push(`status = $${params.length}`);
    }
    if (notes !== undefined) { params.push(String(notes).slice(0, 2000)); sets.push(`notes = $${params.length}`); }
    if (params.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(req.params.id);
    const r = await pool.query(
      `UPDATE appointments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrada' });
    const row = r.rows[0];
    res.json({ ...row, scheduled_at_pr: utcToPrLocal(row.scheduled_at), reason_label: REASON_LABELS[row.reason] || row.reason });
  } catch (e) {
    console.error('[appointments update]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ─── DELETE /api/appointments/:id (cancelar) ──────────────────────────────────
async function deleteAppointment(req, res) {
  try {
    const r = await pool.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[appointments delete]', e.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = {
  getPublicSlots,
  createPublicAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment,
  // helpers expuestos por si se quieren reusar
  _utcToPrLocal: utcToPrLocal,
  _prLocalToUTC: prLocalToUTC,
  REASON_LABELS,
};
