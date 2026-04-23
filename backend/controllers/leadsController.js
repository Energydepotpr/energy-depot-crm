const { pool } = require('../services/db');
const { registrarActividad } = require('./notesController');
const Anthropic = require('@anthropic-ai/sdk');
const { fireEvent } = require('../services/integrationsService');
const { ejecutarAutomaciones } = require('./automationsController');

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function listar(req, res) {
  try {
    const { pipeline_id, stage_id, assigned_to, search = '', limit: qLimit, offset: qOffset } = req.query;
    const conditions = [];
    const params = [];

    if (pipeline_id) { params.push(pipeline_id); conditions.push(`l.pipeline_id = $${params.length}`); }
    if (stage_id)    { params.push(stage_id);    conditions.push(`l.stage_id = $${params.length}`); }
    if (assigned_to) { params.push(assigned_to); conditions.push(`l.assigned_to = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(l.title ILIKE $${idx} OR c.name ILIKE $${idx})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const pageLimit  = Math.min(Number(qLimit)  || 500, 1000);
    const pageOffset = Math.max(Number(qOffset) || 0,   0);
    params.push(pageLimit);  const limitIdx  = params.length;
    params.push(pageOffset); const offsetIdx = params.length;

    const result = await pool.query(`
      SELECT l.*,
        c.name AS contact_name, c.phone AS contact_phone,
        ps.name AS stage_name, ps.color AS stage_color,
        p.name AS pipeline_name,
        u.name AS assigned_name,
        l.check_in, l.check_out, l.cantidad_personas,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('tag', lt.tag, 'color', lt.color))
          FILTER (WHERE lt.tag IS NOT NULL), '[]'
        ) AS tags
      FROM leads l
      LEFT JOIN contacts c ON c.id = l.contact_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      LEFT JOIN pipelines p ON p.id = l.pipeline_id
      LEFT JOIN users u ON u.id = l.assigned_to
      LEFT JOIN lead_tags lt ON lt.lead_id = l.id
      ${where}
      GROUP BY l.id, c.name, c.phone, ps.name, ps.color, p.name, u.name
      ORDER BY l.updated_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('[LEADS listar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function obtener(req, res) {
  try {
    const [leadR, msgsR] = await Promise.all([
      pool.query(`
        SELECT l.*,
          c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email,
          ps.name AS stage_name, ps.color AS stage_color,
          p.name AS pipeline_name,
          u.name AS assigned_name
        FROM leads l
        LEFT JOIN contacts c ON c.id = l.contact_id
        LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN pipelines p ON p.id = l.pipeline_id
        LEFT JOIN users u ON u.id = l.assigned_to
        WHERE l.id = $1
      `, [req.params.id]),
      pool.query(`
        SELECT m.*, u.name AS sent_by_name
        FROM messages m
        LEFT JOIN users u ON u.id = m.sent_by
        WHERE m.lead_id = $1
        ORDER BY m.created_at ASC
      `, [req.params.id]),
    ]);

    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json({ ...leadR.rows[0], messages: msgsR.rows });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crear(req, res) {
  try {
    const { title, contact_id, pipeline_id, stage_id, value = 0, assigned_to } = req.body;
    if (!title) return res.status(400).json({ error: 'title requerido' });

    let pid = pipeline_id ? Number(pipeline_id) : null;
    let sid = stage_id ? Number(stage_id) : null;

    if (!pid) {
      const pip = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
      pid = pip.rows[0]?.id || null;
    }
    if (pid && !sid) {
      const st = await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position LIMIT 1', [pid]);
      sid = st.rows[0]?.id || null;
    }

    const result = await pool.query(
      `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, value, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, contact_id ? Number(contact_id) : null, pid, sid, value || 0, assigned_to ? Number(assigned_to) : null]
    );
    const lead = result.rows[0];
    res.json(lead);

    // Notify integrations (non-blocking)
    if (contact_id) {
      pool.query('SELECT name FROM contacts WHERE id = $1', [Number(contact_id)])
        .then(cr => {
          fireEvent('lead_created', {
            title: lead.title,
            contact_name: cr.rows[0]?.name || null,
            value: lead.value,
          }).catch(() => {});
        })
        .catch(() => {});
    } else {
      fireEvent('lead_created', {
        title: lead.title,
        contact_name: null,
        value: lead.value,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizar(req, res) {
  try {
    const { title, contact_id, pipeline_id, stage_id, value, assigned_to, lost_reason } = req.body;
    const result = await pool.query(
      `UPDATE leads SET
        title       = COALESCE($1, title),
        contact_id  = COALESCE($2, contact_id),
        pipeline_id = COALESCE($3, pipeline_id),
        stage_id    = COALESCE($4, stage_id),
        value       = COALESCE($5, value),
        assigned_to = COALESCE($6, assigned_to),
        lost_reason = COALESCE($7, lost_reason),
        updated_at  = NOW()
       WHERE id = $8 RETURNING *`,
      [
        title || null,
        contact_id ? Number(contact_id) : null,
        pipeline_id ? Number(pipeline_id) : null,
        stage_id ? Number(stage_id) : null,
        value !== undefined && value !== '' ? Number(value) : null,
        assigned_to ? Number(assigned_to) : null,
        lost_reason || null,
        req.params.id
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    autoSyncInvoice(req.params.id).catch(() => {});
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function moverEtapa(req, res) {
  try {
    const { stage_id, pipeline_id, lost_reason } = req.body;
    const stageR = await pool.query('SELECT name FROM pipeline_stages WHERE id = $1', [stage_id]);
    await pool.query(
      `UPDATE leads SET
        stage_id    = $1,
        pipeline_id = COALESCE($2, pipeline_id),
        lost_reason = COALESCE($3, lost_reason),
        updated_at  = NOW()
       WHERE id = $4`,
      [stage_id, pipeline_id || null, lost_reason || null, req.params.id]
    );
    await registrarActividad(req.params.id, req.user?.id || null, 'etapa_cambiada', stageR.rows[0]?.name || '');
    // Fire pipeline automations asynchronously
    ejecutarAutomaciones(req.params.id, stage_id).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminar(req, res) {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function resumenIA(req, res) {
  try {
    const { id } = req.params;

    // Get lead info
    const leadR = await pool.query(`
      SELECT l.title, c.name AS contact_name
      FROM leads l
      LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE l.id = $1
    `, [id]);

    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = leadR.rows[0];

    // Get last 20 messages
    const msgsR = await pool.query(`
      SELECT direction, text, created_at
      FROM messages
      WHERE lead_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [id]);

    const mensajes = msgsR.rows.reverse();

    if (mensajes.length < 3) {
      return res.status(400).json({ error: 'Se necesitan al menos 3 mensajes para generar un resumen' });
    }

    const conversacion = mensajes.map(m =>
      `[${m.direction === 'inbound' ? 'Cliente' : 'Agente'}]: ${m.text}`
    ).join('\n');

    const response = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Eres un asistente que resume conversaciones de CRM en español.
Genera un resumen conciso en exactamente 3 o 4 puntos usando el símbolo • (no markdown, no asteriscos, no guiones).
Cubre: quién es el cliente, qué quiere, estado actual, próxima acción recomendada.
Responde SOLO con los puntos, sin encabezado ni texto adicional.`,
      messages: [{
        role: 'user',
        content: `Lead: "${lead.title}" — Contacto: "${lead.contact_name || 'Desconocido'}"\n\nConversación:\n${conversacion}\n\nResume en 3-4 puntos con •`
      }],
    });

    const resumen = response.content[0].text.trim();
    res.json({ resumen });
  } catch (err) {
    console.error('[LEADS resumenIA]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function bulkUpdate(req, res) {
  try {
    const { ids, action, stage_id, assigned_to } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids requerido' });
    }
    if (action === 'delete') {
      await pool.query(`DELETE FROM leads WHERE id = ANY($1)`, [ids]);
      return res.json({ updated: ids.length });
    }
    if (action === 'move_stage') {
      if (!stage_id) return res.status(400).json({ error: 'stage_id requerido' });
      await pool.query(
        `UPDATE leads SET stage_id=$1, updated_at=NOW() WHERE id = ANY($2)`,
        [stage_id, ids]
      );
      return res.json({ updated: ids.length });
    }
    if (action === 'move_pipeline') {
      const { pipeline_id, stage_id: new_stage } = req.body;
      if (!pipeline_id) return res.status(400).json({ error: 'pipeline_id requerido' });
      await pool.query(
        `UPDATE leads SET pipeline_id=$1, stage_id=COALESCE($2, stage_id), updated_at=NOW() WHERE id = ANY($3)`,
        [pipeline_id, new_stage || null, ids]
      );
      return res.json({ updated: ids.length });
    }
    if (action === 'assign') {
      if (!assigned_to) return res.status(400).json({ error: 'assigned_to requerido' });
      await pool.query(
        `UPDATE leads SET assigned_to=$1, updated_at=NOW() WHERE id = ANY($2)`,
        [assigned_to, ids]
      );
      return res.json({ updated: ids.length });
    }
    res.status(400).json({ error: 'action inválida' });
  } catch (err) {
    console.error('[LEADS bulkUpdate]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getTripInfo(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT hotel_airbnb, check_in, check_out, host_nombre, cantidad_personas, edades, ninos, intereses, notas_especiales FROM leads WHERE id = $1`,
      [req.params.id]
    );
    res.json(rows[0] || {});
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function saveTripInfo(req, res) {
  try {
    const { hotel_airbnb, check_in, check_out, host_nombre, cantidad_personas, edades, ninos, intereses, notas_especiales } = req.body;
    await pool.query(
      `UPDATE leads SET hotel_airbnb=$1, check_in=$2, check_out=$3, host_nombre=$4, cantidad_personas=$5, edades=$6, ninos=$7, intereses=$8, notas_especiales=$9, updated_at=NOW() WHERE id=$10`,
      [hotel_airbnb||null, check_in||null, check_out||null, host_nombre||null, cantidad_personas||null, edades||null, ninos||false, intereses||null, notas_especiales||null, req.params.id]
    );
    // Auto-sync linked invoice if exists
    autoSyncInvoice(req.params.id).catch(() => {});
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// ── Auto-sync invoice when lead data changes ─────────────────────────────────
async function autoSyncInvoice(leadId) {
  const invCheck = await pool.query('SELECT id FROM invoices WHERE lead_id=$1 LIMIT 1', [leadId]);
  if (!invCheck.rows.length) return; // No linked invoice
  const { rows } = await pool.query(`
    SELECT l.*, c.name AS contact_name, c.phone AS contact_phone
    FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
    WHERE l.id = $1
  `, [leadId]);
  if (!rows.length) return;
  const lead = rows[0];
  const total = Number(lead.value) || 0;
  const ci = lead.check_in ? String(lead.check_in).slice(0,10) : null;
  const co = lead.check_out ? String(lead.check_out).slice(0,10) : null;
  const desc = `Viaje — ${lead.title}` +
    (ci ? ` · Check-in: ${ci}` : '') +
    (co ? ` → ${co}` : '') +
    (lead.cantidad_personas ? ` · ${lead.cantidad_personas} personas` : '');
  const items = total > 0 ? [{ description: desc, qty: 1, unit_price: total, total }] : [];
  await pool.query(
    `UPDATE invoices SET client_name=COALESCE($1,client_name), client_phone=COALESCE($2,client_phone),
     service_date=COALESCE($3::date,service_date), items=$4, subtotal=$5, total=$6, updated_at=NOW()
     WHERE lead_id=$7`,
    [lead.contact_name||null, lead.contact_phone||null, ci, JSON.stringify(items), total, total, leadId]
  );
}

async function getLeadContacts(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT lc.*, c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email
       FROM lead_contacts lc
       LEFT JOIN contacts c ON c.id = lc.contact_id
       WHERE lc.lead_id = $1 ORDER BY lc.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function addLeadContact(req, res) {
  try {
    const { contact_id, nombre, telefono, label } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO lead_contacts (lead_id, contact_id, nombre, telefono, label) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, contact_id||null, nombre||null, telefono||null, label||'adicional']
    );
    res.json(rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function removeLeadContact(req, res) {
  try {
    await pool.query(`DELETE FROM lead_contacts WHERE id=$1 AND lead_id=$2`, [req.params.contactEntryId, req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function mergeLeads(req, res) {
  const client = await pool.connect();
  try {
    const { source_id, target_id } = req.body;
    if (!source_id || !target_id || source_id === target_id) return res.status(400).json({ error: 'IDs inválidos' });
    await client.query('BEGIN');
    // Move messages
    await client.query(`UPDATE messages SET lead_id=$1 WHERE lead_id=$2`, [target_id, source_id]);
    // Move notes
    await client.query(`UPDATE lead_notes SET lead_id=$1 WHERE lead_id=$2`, [target_id, source_id]);
    // Move tags (ignore duplicates)
    await client.query(`INSERT INTO lead_tags (lead_id, tag, color) SELECT $1, tag, color FROM lead_tags WHERE lead_id=$2 ON CONFLICT DO NOTHING`, [target_id, source_id]);
    // Move tasks
    await client.query(`UPDATE tasks SET lead_id=$1 WHERE lead_id=$2`, [target_id, source_id]);
    // Move activity
    await client.query(`UPDATE activity_log SET lead_id=$1 WHERE lead_id=$2`, [target_id, source_id]);
    // Move lead_contacts (ignore duplicates)
    await client.query(`INSERT INTO lead_contacts (lead_id, contact_id, nombre, telefono, label) SELECT $1, contact_id, nombre, telefono, label FROM lead_contacts WHERE lead_id=$2 ON CONFLICT DO NOTHING`, [target_id, source_id]);
    // Add merge note
    const sourceR = await client.query(`SELECT title FROM leads WHERE id=$1`, [source_id]);
    await client.query(`INSERT INTO lead_notes (lead_id, user_id, text) VALUES ($1,$2,$3)`, [target_id, req.user?.id, `Lead fusionado desde: "${sourceR.rows[0]?.title || source_id}"`]);
    // Delete source
    await client.query(`DELETE FROM leads WHERE id=$1`, [source_id]);
    await client.query('COMMIT');
    res.json({ ok: true, target_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally { client.release(); }
}

async function toggleBot(req, res) {
  try {
    const { disabled } = req.body;
    const r = await pool.query(
      `UPDATE leads SET bot_disabled=$1, updated_at=NOW() WHERE id=$2 RETURNING id, bot_disabled`,
      [!!disabled, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

async function setFollowUp(req, res) {
  try {
    const { follow_up_at } = req.body;
    await pool.query(
      `UPDATE leads SET follow_up_at=$1, updated_at=NOW() WHERE id=$2`,
      [follow_up_at || null, req.params.id]
    );
    res.json({ ok: true, follow_up_at: follow_up_at || null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// ── Internal Notes ────────────────────────────────────────────────────────────

async function ensureInternalNotesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_internal_notes (
      id SERIAL PRIMARY KEY,
      lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      user_name VARCHAR(100),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureInternalNotesTable().catch(e => console.error('[INIT] lead_internal_notes:', e.message));

async function listarNotasInternas(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM lead_internal_notes WHERE lead_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[INTERNAL NOTES listar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crearNotaInterna(req, res) {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'content requerido' });
    const { rows } = await pool.query(
      `INSERT INTO lead_internal_notes (lead_id, user_id, user_name, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user?.id || null, req.user?.name || 'Desconocido', content.trim()]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[INTERNAL NOTES crear]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarNotaInterna(req, res) {
  try {
    const { noteId } = req.params;
    // Only own notes or admin can delete
    const noteR = await pool.query(`SELECT user_id FROM lead_internal_notes WHERE id = $1 AND lead_id = $2`, [noteId, req.params.id]);
    if (!noteR.rows[0]) return res.status(404).json({ error: 'Nota no encontrada' });
    if (req.user?.role !== 'admin' && noteR.rows[0].user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Sin permiso para eliminar esta nota' });
    }
    await pool.query(`DELETE FROM lead_internal_notes WHERE id = $1`, [noteId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[INTERNAL NOTES eliminar]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function aiChatLead(req, res) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'message requerido' });

    // Load lead + contact info
    const leadR = await pool.query(`
      SELECT l.*,
        c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email,
        ps.name AS stage_name, p.name AS pipeline_name,
        u.name AS assigned_name
      FROM leads l
      LEFT JOIN contacts c ON c.id = l.contact_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      LEFT JOIN pipelines p ON p.id = l.pipeline_id
      LEFT JOIN users u ON u.id = l.assigned_to
      WHERE l.id = $1
    `, [id]);
    if (!leadR.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = leadR.rows[0];

    // Load last 10 messages
    const msgsR = await pool.query(`
      SELECT direction, text, created_at FROM messages
      WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 10
    `, [id]);
    const mensajes = msgsR.rows.reverse();

    // Load internal notes
    const notesR = await pool.query(`
      SELECT content, user_name, created_at FROM lead_internal_notes
      WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 5
    `, [id]);

    // Build context string
    const lines = [];
    lines.push(`=== INFORMACIÓN DEL LEAD ===`);
    lines.push(`Título: ${lead.title}`);
    lines.push(`Cliente: ${lead.contact_name || 'Desconocido'}`);
    if (lead.contact_phone) lines.push(`Teléfono: ${lead.contact_phone}`);
    if (lead.contact_email) lines.push(`Email: ${lead.contact_email}`);
    lines.push(`Etapa: ${lead.stage_name || 'Sin etapa'}`);
    lines.push(`Pipeline: ${lead.pipeline_name || 'Sin pipeline'}`);
    if (lead.assigned_name) lines.push(`Asignado a: ${lead.assigned_name}`);
    if (lead.value) lines.push(`Valor: $${Number(lead.value).toLocaleString()}`);
    if (lead.check_in) lines.push(`Check-in: ${lead.check_in}`);
    if (lead.check_out) lines.push(`Check-out: ${lead.check_out}`);
    if (lead.cantidad_personas) lines.push(`Personas: ${lead.cantidad_personas}`);
    if (lead.intereses) lines.push(`Intereses/Servicios: ${lead.intereses}`);
    if (lead.notas_especiales) lines.push(`Notas especiales: ${lead.notas_especiales}`);

    if (mensajes.length > 0) {
      lines.push(`\n=== ÚLTIMOS MENSAJES (${mensajes.length}) ===`);
      mensajes.forEach(m => {
        const quien = m.direction === 'inbound' ? 'Cliente' : 'Agente';
        lines.push(`[${quien}]: ${m.text}`);
      });
    }

    if (notesR.rows.length > 0) {
      lines.push(`\n=== NOTAS INTERNAS DEL EQUIPO ===`);
      notesR.rows.forEach(n => lines.push(`[${n.user_name}]: ${n.content}`));
    }

    const contexto = lines.join('\n');

    const response = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Eres un coach de ventas experto con acceso completo al historial de este cliente específico.
Tu rol es ayudar al agente de ventas con estrategias, recomendaciones y respuestas concretas.
Responde en español, de forma clara, práctica y accionable.
Usa el contexto del cliente que tienes para dar consejos personalizados.
Sé directo y conciso. No uses markdown excesivo.`,
      messages: [{
        role: 'user',
        content: `CONTEXTO DEL CLIENTE:\n${contexto}\n\n---\n\nPREGUNTA DEL AGENTE: ${message.trim()}`
      }],
    });

    const reply = response.content[0].text.trim();
    res.json({ reply });
  } catch (err) {
    console.error('[LEADS aiChatLead]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, moverEtapa, eliminar, resumenIA, bulkUpdate, getTripInfo, saveTripInfo, getLeadContacts, addLeadContact, removeLeadContact, mergeLeads, toggleBot, setFollowUp, listarNotasInternas, crearNotaInterna, eliminarNotaInterna, aiChatLead, autoSyncInvoice };
