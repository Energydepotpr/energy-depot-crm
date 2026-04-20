'use strict';
const { pool } = require('../services/db');

// ── GET /api/contacts/:id/timeline?limit=50&offset=0 ────────────────────────
async function timelineContacto(req, res) {
  const contactId = parseInt(req.params.id, 10);
  if (isNaN(contactId)) return res.status(400).json({ error: 'ID inválido' });

  const limit  = Math.min(parseInt(req.query.limit  || 50,  10), 200);
  const offset = parseInt(req.query.offset || 0, 10);

  try {
    // Build unified timeline via UNION ALL across all activity tables
    const sql = `
      SELECT * FROM (

        -- Lead created
        SELECT
          'lead_created'                          AS type,
          l.created_at                            AS date,
          l.title                                 AS title,
          COALESCE(ps.name, 'Sin etapa')          AS subtitle,
          'lead'                                  AS icon,
          '#6366f1'                               AS color,
          json_build_object(
            'lead_id', l.id,
            'stage', ps.name,
            'value', l.value,
            'source', l.source
          )                                       AS meta
        FROM leads l
        LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE l.contact_id = $1

        UNION ALL

        -- Stage changes from activity_log
        SELECT
          'stage_change'                          AS type,
          al.created_at                           AS date,
          al.detail                               AS title,
          l.title                                 AS subtitle,
          'stage_change'                          AS icon,
          '#f59e0b'                               AS color,
          json_build_object(
            'lead_id', l.id,
            'action', al.action,
            'user_id', al.user_id
          )                                       AS meta
        FROM activity_log al
        JOIN leads l ON l.id = al.lead_id
        WHERE l.contact_id = $1
          AND al.action ILIKE '%stage%'

        UNION ALL

        -- Messages in
        SELECT
          'message_in'                            AS type,
          m.created_at                            AS date,
          LEFT(m.text, 120)                       AS title,
          COALESCE(l.title, 'Mensaje directo')    AS subtitle,
          'message_in'                            AS icon,
          '#3b82f6'                               AS color,
          json_build_object(
            'lead_id', m.lead_id,
            'channel', m.channel,
            'full_text', m.text
          )                                       AS meta
        FROM messages m
        LEFT JOIN leads l ON l.id = m.lead_id
        WHERE m.contact_id = $1
          AND m.direction = 'in'

        UNION ALL

        -- Messages out
        SELECT
          'message_out'                           AS type,
          m.created_at                            AS date,
          LEFT(m.text, 120)                       AS title,
          COALESCE(l.title, 'Mensaje directo')    AS subtitle,
          'message_out'                           AS icon,
          '#8b5cf6'                               AS color,
          json_build_object(
            'lead_id', m.lead_id,
            'channel', m.channel,
            'is_bot', m.is_bot,
            'full_text', m.text
          )                                       AS meta
        FROM messages m
        LEFT JOIN leads l ON l.id = m.lead_id
        WHERE m.contact_id = $1
          AND m.direction = 'out'

        UNION ALL

        -- Invoices
        SELECT
          'invoice'                               AS type,
          inv.created_at                          AS date,
          COALESCE(inv.invoice_number, 'Factura') AS title,
          '$' || inv.total::TEXT                  AS subtitle,
          'invoice'                               AS icon,
          '#10b981'                               AS color,
          json_build_object(
            'invoice_id', inv.id,
            'invoice_number', inv.invoice_number,
            'total', inv.total,
            'service_date', inv.service_date
          )                                       AS meta
        FROM invoices inv
        JOIN leads l2 ON l2.id = (
          SELECT id FROM leads WHERE contact_id = $1
          AND title ILIKE '%' || inv.client_name || '%'
          LIMIT 1
        )
        WHERE inv.client_name IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM leads lx
            WHERE lx.contact_id = $1
              AND lx.title ILIKE '%' || inv.client_name || '%'
            LIMIT 1
          )

        UNION ALL

        -- Contracts
        SELECT
          'contract'                              AS type,
          ct.created_at                           AS date,
          ct.title                                AS title,
          ct.status                               AS subtitle,
          'contract'                              AS icon,
          '#f97316'                               AS color,
          json_build_object(
            'contract_id', ct.id,
            'status', ct.status,
            'file_name', ct.file_name,
            'signed_at', ct.signed_at
          )                                       AS meta
        FROM contracts ct
        WHERE ct.contact_id = $1

        UNION ALL

        -- Notes from leads
        SELECT
          'note'                                  AS type,
          ln.created_at                           AS date,
          LEFT(ln.text, 120)                      AS title,
          l.title                                 AS subtitle,
          'note'                                  AS icon,
          '#64748b'                               AS color,
          json_build_object(
            'lead_id', l.id,
            'note_id', ln.id,
            'full_text', ln.text
          )                                       AS meta
        FROM lead_notes ln
        JOIN leads l ON l.id = ln.lead_id
        WHERE l.contact_id = $1

        UNION ALL

        -- Calls
        SELECT
          'call'                                  AS type,
          cl.created_at                           AS date,
          COALESCE('Llamada ' || cl.status, 'Llamada') AS title,
          CASE
            WHEN cl.duration > 0 THEN cl.duration || 's'
            ELSE cl.to_number
          END                                     AS subtitle,
          'call'                                  AS icon,
          '#06b6d4'                               AS color,
          json_build_object(
            'call_id', cl.id,
            'status', cl.status,
            'duration', cl.duration,
            'to_number', cl.to_number,
            'lead_id', cl.lead_id
          )                                       AS meta
        FROM call_logs cl
        JOIN leads l ON l.id = cl.lead_id
        WHERE l.contact_id = $1

      ) timeline
      ORDER BY date DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await pool.query(sql, [contactId, limit, offset]);
    res.json({ ok: true, data: rows, limit, offset });
  } catch (err) {
    console.error('[TIMELINE timelineContacto]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/contacts/:id/summary ────────────────────────────────────────────
async function resumenContacto(req, res) {
  const contactId = parseInt(req.params.id, 10);
  if (isNaN(contactId)) return res.status(400).json({ error: 'ID inválido' });

  try {
    // Contact base info
    const contactRes = await pool.query(
      `SELECT id, name, phone, email, company, source, created_at FROM contacts WHERE id = $1`,
      [contactId]
    );
    if (!contactRes.rows[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
    const contact = contactRes.rows[0];

    // Leads stats
    const leadsRes = await pool.query(
      `SELECT
        COUNT(*)                                          AS total_leads,
        COUNT(*) FILTER (WHERE l.stage_id IS NOT NULL)   AS leads_activos,
        MIN(l.created_at)                                AS primera_interaccion,
        MAX(l.created_at)                                AS ultima_interaccion
       FROM leads l WHERE l.contact_id = $1`,
      [contactId]
    );
    const leadsStats = leadsRes.rows[0];

    // Contracts count
    const contractsRes = await pool.query(
      `SELECT COUNT(*) AS total_contratos FROM contracts WHERE contact_id = $1`,
      [contactId]
    );

    // Messages count
    const messagesRes = await pool.query(
      `SELECT COUNT(*) AS total_mensajes FROM messages WHERE contact_id = $1`,
      [contactId]
    );

    // Invoices via lead-to-contact linkage (by contact name match in invoices)
    const invoicesRes = await pool.query(
      `SELECT
        COUNT(*)         AS total_facturas,
        COALESCE(SUM(inv.total), 0) AS valor_total_facturas
       FROM invoices inv
       WHERE EXISTS (
         SELECT 1 FROM leads lx
         WHERE lx.contact_id = $1
           AND lx.title ILIKE '%' || inv.client_name || '%'
         LIMIT 1
       )`,
      [contactId]
    );

    // Also try direct invoice match by contact email/phone
    const invoicesDirectRes = await pool.query(
      `SELECT
        COUNT(*)         AS total_facturas_direct,
        COALESCE(SUM(inv.total), 0) AS valor_direct
       FROM invoices inv
       JOIN contacts c ON c.id = $1
       WHERE (c.email IS NOT NULL AND inv.client_email = c.email)
          OR (c.phone IS NOT NULL AND inv.client_phone = c.phone)`,
      [contactId]
    );

    const totalFacturas = Math.max(
      parseInt(invoicesRes.rows[0].total_facturas || 0),
      parseInt(invoicesDirectRes.rows[0].total_facturas_direct || 0)
    );
    const valorTotal = Math.max(
      parseFloat(invoicesRes.rows[0].valor_total_facturas || 0),
      parseFloat(invoicesDirectRes.rows[0].valor_direct || 0)
    );

    // Update ultima_interaccion from messages
    const lastMsgRes = await pool.query(
      `SELECT MAX(created_at) AS last_msg FROM messages WHERE contact_id = $1`,
      [contactId]
    );
    const lastMsg = lastMsgRes.rows[0].last_msg;
    const ultimaInteraccion = lastMsg && lastMsg > leadsStats.ultima_interaccion
      ? lastMsg
      : leadsStats.ultima_interaccion;

    res.json({
      ok: true,
      data: {
        contact,
        total_leads:            parseInt(leadsStats.total_leads || 0),
        leads_activos:          parseInt(leadsStats.leads_activos || 0),
        total_facturas:         totalFacturas,
        total_contratos:        parseInt(contractsRes.rows[0].total_contratos || 0),
        total_mensajes:         parseInt(messagesRes.rows[0].total_mensajes || 0),
        primera_interaccion:    leadsStats.primera_interaccion || contact.created_at,
        ultima_interaccion:     ultimaInteraccion || contact.created_at,
        valor_total_facturas:   valorTotal,
      }
    });
  } catch (err) {
    console.error('[TIMELINE resumenContacto]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { timelineContacto, resumenContacto };

/* ROUTES_TO_ADD_server.js
const timeline = require('./controllers/timelineController');

// Contact timeline & summary (add near contact routes, before authMiddleware or after — auth protected)
app.get('/api/contacts/:id/timeline', timeline.timelineContacto);
app.get('/api/contacts/:id/summary',  timeline.resumenContacto);
*/

/* API_METHODS_TO_ADD_api.js
  contactTimeline: (id, params = '') => req('GET', `/api/contacts/${id}/timeline${params}`),
  contactSummary:  (id)              => req('GET', `/api/contacts/${id}/summary`),
*/
