const { pool } = require('../services/db');
const { enviarWhatsApp, enviarSMS } = require('../services/twilioService');

// ── Ensure tables exist ────────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sequences (
      id              SERIAL PRIMARY KEY,
      name            VARCHAR(200) NOT NULL,
      description     TEXT,
      trigger_event   VARCHAR(50)  NOT NULL DEFAULT 'manual',
      trigger_stage_id INT REFERENCES pipeline_stages(id) ON DELETE SET NULL,
      is_active       BOOLEAN      NOT NULL DEFAULT true,
      created_by      INT          REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sequence_steps (
      id            SERIAL PRIMARY KEY,
      sequence_id   INT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
      step_order    INT NOT NULL DEFAULT 1,
      delay_days    INT NOT NULL DEFAULT 0,
      delay_hours   INT NOT NULL DEFAULT 1,
      action_type   VARCHAR(50) NOT NULL DEFAULT 'send_whatsapp',
      action_config JSONB       NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id            SERIAL PRIMARY KEY,
      sequence_id   INT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
      lead_id       INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      current_step  INT NOT NULL DEFAULT 1,
      status        VARCHAR(20) NOT NULL DEFAULT 'active',
      enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      next_run_at   TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ,
      UNIQUE(sequence_id, lead_id)
    );
  `);
}

ensureTables().catch(e => console.error('[SEQUENCES] ensureTables error:', e.message));

// ── Helpers ───────────────────────────────────────────────────────────────────
function interpolate(text, lead, contact, agent) {
  if (!text) return text;
  return text
    .replace(/\{\{nombre\}\}/gi,   contact?.name   || lead?.title || '')
    .replace(/\{\{telefono\}\}/gi, contact?.phone  || '')
    .replace(/\{\{agente\}\}/gi,   agent?.name     || '');
}

function calcNextRunAt(delayDays, delayHours) {
  const d = new Date();
  d.setDate(d.getDate() + (delayDays || 0));
  d.setHours(d.getHours() + (delayHours || 0));
  return d;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const seqs = await pool.query(`
      SELECT s.*,
        u.name AS created_by_name,
        ps.name AS trigger_stage_name,
        (SELECT COUNT(*) FROM sequence_steps ss WHERE ss.sequence_id = s.id)::int AS steps_count,
        (SELECT COUNT(*) FROM sequence_enrollments se WHERE se.sequence_id = s.id AND se.status = 'active')::int AS active_enrollments
      FROM sequences s
      LEFT JOIN users u ON u.id = s.created_by
      LEFT JOIN pipeline_stages ps ON ps.id = s.trigger_stage_id
      ORDER BY s.created_at DESC
    `);
    res.json(seqs.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function obtener(req, res) {
  try {
    const seqR = await pool.query(`
      SELECT s.*, u.name AS created_by_name, ps.name AS trigger_stage_name
      FROM sequences s
      LEFT JOIN users u ON u.id = s.created_by
      LEFT JOIN pipeline_stages ps ON ps.id = s.trigger_stage_id
      WHERE s.id = $1
    `, [req.params.id]);
    if (!seqR.rows[0]) return res.status(404).json({ error: 'Secuencia no encontrada' });

    const stepsR = await pool.query(
      `SELECT * FROM sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC`,
      [req.params.id]
    );
    res.json({ ...seqR.rows[0], steps: stepsR.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function crear(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, trigger_event, trigger_stage_id, is_active, steps = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name requerido' });

    const seqR = await client.query(
      `INSERT INTO sequences (name, description, trigger_event, trigger_stage_id, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), description || null, trigger_event || 'manual', trigger_stage_id || null, is_active !== false, req.user.id]
    );
    const seq = seqR.rows[0];

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await client.query(
        `INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, action_type, action_config)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [seq.id, i + 1, s.delay_days || 0, s.delay_hours || 1, s.action_type || 'send_whatsapp', s.action_config || {}]
      );
    }

    await client.query('COMMIT');
    res.json(seq);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

async function actualizar(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, description, trigger_event, trigger_stage_id, is_active, steps } = req.body;

    const seqR = await client.query(
      `UPDATE sequences SET
        name             = COALESCE($1, name),
        description      = COALESCE($2, description),
        trigger_event    = COALESCE($3, trigger_event),
        trigger_stage_id = $4,
        is_active        = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [name?.trim() || null, description ?? null, trigger_event || null, trigger_stage_id || null, is_active ?? null, req.params.id]
    );
    if (!seqR.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No encontrada' }); }

    if (Array.isArray(steps)) {
      await client.query(`DELETE FROM sequence_steps WHERE sequence_id = $1`, [req.params.id]);
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await client.query(
          `INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, action_type, action_config)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.params.id, i + 1, s.delay_days || 0, s.delay_hours || 1, s.action_type || 'send_whatsapp', s.action_config || {}]
        );
      }
    }

    await client.query('COMMIT');
    res.json(seqR.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

async function eliminar(req, res) {
  try {
    await pool.query('DELETE FROM sequences WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function toggleActivo(req, res) {
  try {
    const r = await pool.query(
      `UPDATE sequences SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// ── Enrollments ───────────────────────────────────────────────────────────────
async function enrollar(req, res) {
  try {
    const { lead_id } = req.body;
    if (!lead_id) return res.status(400).json({ error: 'lead_id requerido' });

    const seqR = await pool.query(`SELECT * FROM sequences WHERE id = $1 AND is_active = true`, [req.params.id]);
    if (!seqR.rows[0]) return res.status(404).json({ error: 'Secuencia no encontrada o inactiva' });

    // Get first step to set next_run_at
    const firstStep = await pool.query(
      `SELECT * FROM sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC LIMIT 1`,
      [req.params.id]
    );

    const nextRunAt = firstStep.rows[0]
      ? calcNextRunAt(firstStep.rows[0].delay_days, firstStep.rows[0].delay_hours)
      : new Date();

    const r = await pool.query(
      `INSERT INTO sequence_enrollments (sequence_id, lead_id, current_step, status, next_run_at)
       VALUES ($1,$2,1,'active',$3)
       ON CONFLICT (sequence_id, lead_id) DO UPDATE
         SET status = 'active', current_step = 1, next_run_at = $3, completed_at = NULL
       RETURNING *`,
      [req.params.id, lead_id, nextRunAt]
    );
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function cancelarEnrollment(req, res) {
  try {
    await pool.query(
      `UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function listarEnrollments(req, res) {
  try {
    const { lead_id, sequence_id } = req.query;
    const conditions = [];
    const params = [];

    if (lead_id)     { params.push(lead_id);     conditions.push(`se.lead_id = $${params.length}`); }
    if (sequence_id) { params.push(sequence_id); conditions.push(`se.sequence_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const r = await pool.query(`
      SELECT se.*,
        s.name AS sequence_name,
        l.title AS lead_title,
        c.name  AS contact_name,
        c.phone AS contact_phone
      FROM sequence_enrollments se
      JOIN sequences s ON s.id = se.sequence_id
      JOIN leads l     ON l.id = se.lead_id
      LEFT JOIN contacts c ON c.id = l.contact_id
      ${where}
      ORDER BY se.enrolled_at DESC
    `, params);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// ── Background job ────────────────────────────────────────────────────────────
async function procesarSecuencias(req, res) {
  const results = { processed: 0, errors: [] };

  try {
    // Find active enrollments where next_run_at is due
    const enrollments = await pool.query(`
      SELECT se.*,
        l.title AS lead_title, l.contact_id,
        c.name  AS contact_name,
        c.phone AS contact_phone,
        u.name  AS agent_name
      FROM sequence_enrollments se
      JOIN leads l    ON l.id = se.lead_id
      LEFT JOIN contacts c ON c.id = l.contact_id
      LEFT JOIN users u    ON u.id = l.assigned_to
      WHERE se.status = 'active'
        AND se.next_run_at <= NOW()
    `);

    for (const enrollment of enrollments.rows) {
      try {
        // Get current step
        const stepR = await pool.query(
          `SELECT * FROM sequence_steps WHERE sequence_id = $1 AND step_order = $2`,
          [enrollment.sequence_id, enrollment.current_step]
        );
        if (!stepR.rows[0]) {
          // No step found — complete enrollment
          await pool.query(
            `UPDATE sequence_enrollments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
            [enrollment.id]
          );
          continue;
        }
        const step = stepR.rows[0];
        const cfg = step.action_config || {};
        const lead = { title: enrollment.lead_title };
        const contact = { name: enrollment.contact_name, phone: enrollment.contact_phone };
        const agent = { name: enrollment.agent_name };

        // Execute action
        if (step.action_type === 'send_whatsapp') {
          // Puerto Rico usa SMS — redirigir a SMS aunque el paso diga WhatsApp
          const phone = cfg.phone || contact.phone;
          const msg   = interpolate(cfg.message || '', lead, contact, agent);
          if (phone && msg) await enviarSMS(phone, msg);

        } else if (step.action_type === 'send_sms') {
          const phone = cfg.phone || contact.phone;
          const msg   = interpolate(cfg.message || '', lead, contact, agent);
          if (phone && msg) await enviarSMS(phone, msg);

        } else if (step.action_type === 'create_task') {
          const title = interpolate(cfg.title || 'Seguimiento automático', lead, contact, agent);
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (cfg.due_days || 1));
          await pool.query(
            `INSERT INTO tasks (lead_id, title, due_date) VALUES ($1,$2,$3)`,
            [enrollment.lead_id, title, dueDate.toISOString()]
          );

        } else if (step.action_type === 'add_tag') {
          const tag   = interpolate(cfg.tag || 'auto', lead, contact, agent);
          const color = cfg.color || '#6366f1';
          await pool.query(
            `INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [enrollment.lead_id, tag, color]
          );
        }

        // Advance to next step
        const nextStepR = await pool.query(
          `SELECT * FROM sequence_steps WHERE sequence_id = $1 AND step_order > $2 ORDER BY step_order ASC LIMIT 1`,
          [enrollment.sequence_id, enrollment.current_step]
        );

        if (nextStepR.rows[0]) {
          const nextStep = nextStepR.rows[0];
          const nextRunAt = calcNextRunAt(nextStep.delay_days, nextStep.delay_hours);
          await pool.query(
            `UPDATE sequence_enrollments SET current_step = $1, next_run_at = $2 WHERE id = $3`,
            [nextStep.step_order, nextRunAt, enrollment.id]
          );
        } else {
          // No more steps — complete
          await pool.query(
            `UPDATE sequence_enrollments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
            [enrollment.id]
          );
        }

        results.processed++;
      } catch (stepErr) {
        console.error(`[SEQUENCES] Error en enrollment ${enrollment.id}:`, stepErr.message);
        results.errors.push({ enrollment_id: enrollment.id, error: stepErr.message });
      }
    }

    if (res) res.json({ ok: true, ...results });
    return results;
  } catch (e) {
    console.error('[SEQUENCES] Error en procesarSecuencias:', e.message);
    if (res) res.status(500).json({ error: 'Error interno del servidor' });
    return results;
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  toggleActivo,
  enrollar,
  cancelarEnrollment,
  listarEnrollments,
  procesarSecuencias,
};

/* ROUTES_TO_ADD_server.js
const sequences = require('./controllers/sequencesController');

// Sequences
app.get('/api/sequences',                          sequences.listar);
app.get('/api/sequences/enrollments',              sequences.listarEnrollments);
app.get('/api/sequences/:id',                      sequences.obtener);
app.post('/api/sequences',                         sequences.crear);
app.patch('/api/sequences/:id',                    sequences.actualizar);
app.delete('/api/sequences/:id',                   sequences.eliminar);
app.patch('/api/sequences/:id/toggle',             sequences.toggleActivo);
app.post('/api/sequences/:id/enroll',              sequences.enrollar);
app.delete('/api/sequences/enrollments/:id',       sequences.cancelarEnrollment);
app.post('/api/sequences/process',                 sequences.procesarSecuencias);

// Background job (add after app is ready):
// const { procesarSecuencias } = require('./controllers/sequencesController');
// setInterval(() => procesarSecuencias(), 5 * 60 * 1000); // every 5 minutes
*/

/* API_METHODS_TO_ADD_api.js
// Sequences
sequences:              ()            => req('GET',    '/api/sequences'),
sequence:               (id)          => req('GET',    `/api/sequences/${id}`),
createSequence:         (data)        => req('POST',   '/api/sequences', data),
updateSequence:         (id, data)    => req('PATCH',  `/api/sequences/${id}`, data),
deleteSequence:         (id)          => req('DELETE', `/api/sequences/${id}`),
toggleSequence:         (id)          => req('PATCH',  `/api/sequences/${id}/toggle`),
enrollSequence:         (id, lead_id) => req('POST',   `/api/sequences/${id}/enroll`, { lead_id }),
cancelEnrollment:       (id)          => req('DELETE', `/api/sequences/enrollments/${id}`),
sequenceEnrollments:    (params = '') => req('GET',    `/api/sequences/enrollments${params}`),
processSequences:       ()            => req('POST',   '/api/sequences/process'),
*/
