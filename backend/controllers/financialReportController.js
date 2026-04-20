'use strict';
const { pool } = require('../services/db');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/financial
// Query params: ?year=2026&month=3  (month is optional)
// ─────────────────────────────────────────────────────────────────────────────
async function resumenFinanciero(req, res) {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || null; // null = all months

    const isAdmin = req.user?.role === 'admin';
    const userId  = req.user?.id;

    // ── 1. Revenue by month (from won leads) ─────────────────────────────────
    let revenueByMonthQuery;
    let revenueByMonthParams;

    if (isAdmin) {
      const wheremonth = month ? `AND EXTRACT(MONTH FROM l.updated_at) = ${month}` : '';
      revenueByMonthQuery = `
        SELECT TO_CHAR(l.updated_at, 'YYYY-MM') AS month,
               SUM(COALESCE(l.value, 0))        AS total,
               COUNT(*)                          AS count
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE ps.name = 'Ganado'
          AND EXTRACT(YEAR FROM l.updated_at) = $1
          ${wheremonth}
        GROUP BY month ORDER BY month
      `;
      revenueByMonthParams = [year];
    } else {
      const wheremonth = month ? `AND EXTRACT(MONTH FROM l.updated_at) = ${month}` : '';
      revenueByMonthQuery = `
        SELECT TO_CHAR(l.updated_at, 'YYYY-MM') AS month,
               SUM(COALESCE(l.value, 0))        AS total,
               COUNT(*)                          AS count
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE ps.name = 'Ganado'
          AND EXTRACT(YEAR FROM l.updated_at) = $1
          AND l.assigned_to = $2
          ${wheremonth}
        GROUP BY month ORDER BY month
      `;
      revenueByMonthParams = [year, userId];
    }

    const revenueByMonthResult = await pool.query(revenueByMonthQuery, revenueByMonthParams);

    // ── 2. Revenue by agent ───────────────────────────────────────────────────
    let revenueByAgentQuery;
    let revenueByAgentParams;

    const agentYearFilter  = month
      ? `AND EXTRACT(YEAR FROM l.updated_at) = $1 AND EXTRACT(MONTH FROM l.updated_at) = $2`
      : `AND EXTRACT(YEAR FROM l.updated_at) = $1`;

    if (isAdmin) {
      revenueByAgentQuery = `
        SELECT
          COALESCE(u.name, 'Sin asignar')        AS agent_name,
          SUM(COALESCE(l.value, 0))              AS total,
          COUNT(*)                               AS count,
          ROUND(AVG(COALESCE(l.value, 0)), 2)   AS avg_deal
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN users u ON u.id = l.assigned_to
        WHERE ps.name = 'Ganado'
          ${agentYearFilter}
        GROUP BY u.name
        ORDER BY total DESC
      `;
      revenueByAgentParams = month ? [year, month] : [year];
    } else {
      revenueByAgentQuery = `
        SELECT
          COALESCE(u.name, 'Sin asignar')        AS agent_name,
          SUM(COALESCE(l.value, 0))              AS total,
          COUNT(*)                               AS count,
          ROUND(AVG(COALESCE(l.value, 0)), 2)   AS avg_deal
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN users u ON u.id = l.assigned_to
        WHERE ps.name = 'Ganado'
          AND l.assigned_to = $${month ? 3 : 2}
          ${agentYearFilter}
        GROUP BY u.name
        ORDER BY total DESC
      `;
      revenueByAgentParams = month ? [year, month, userId] : [year, userId];
    }

    const revenueByAgentResult = await pool.query(revenueByAgentQuery, revenueByAgentParams);

    // ── 3. Revenue by stage ───────────────────────────────────────────────────
    let revenueByStageQuery;
    let revenueByStageParams;

    if (isAdmin) {
      revenueByStageQuery = `
        SELECT
          ps.name  AS stage_name,
          SUM(COALESCE(l.value, 0)) AS total
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE EXTRACT(YEAR FROM l.updated_at) = $1
        GROUP BY ps.name
        ORDER BY total DESC
      `;
      revenueByStageParams = [year];
    } else {
      revenueByStageQuery = `
        SELECT
          ps.name  AS stage_name,
          SUM(COALESCE(l.value, 0)) AS total
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE EXTRACT(YEAR FROM l.updated_at) = $1
          AND l.assigned_to = $2
        GROUP BY ps.name
        ORDER BY total DESC
      `;
      revenueByStageParams = [year, userId];
    }

    const revenueByStageResult = await pool.query(revenueByStageQuery, revenueByStageParams);

    // ── 4. Top 10 deals ───────────────────────────────────────────────────────
    let topDealsQuery;
    let topDealsParams;

    const topYearFilter = month
      ? `AND EXTRACT(YEAR FROM l.updated_at) = $1 AND EXTRACT(MONTH FROM l.updated_at) = $2`
      : `AND EXTRACT(YEAR FROM l.updated_at) = $1`;

    if (isAdmin) {
      topDealsQuery = `
        SELECT
          l.title                              AS lead_title,
          COALESCE(c.name, '—')               AS contact_name,
          COALESCE(u.name, 'Sin asignar')     AS agent_name,
          COALESCE(l.value, 0)                AS value,
          l.updated_at                         AS closed_at
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN contacts c ON c.id = l.contact_id
        LEFT JOIN users   u ON u.id  = l.assigned_to
        WHERE ps.name = 'Ganado'
          ${topYearFilter}
        ORDER BY l.value DESC
        LIMIT 10
      `;
      topDealsParams = month ? [year, month] : [year];
    } else {
      topDealsQuery = `
        SELECT
          l.title                              AS lead_title,
          COALESCE(c.name, '—')               AS contact_name,
          COALESCE(u.name, 'Sin asignar')     AS agent_name,
          COALESCE(l.value, 0)                AS value,
          l.updated_at                         AS closed_at
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN contacts c ON c.id = l.contact_id
        LEFT JOIN users   u ON u.id  = l.assigned_to
        WHERE ps.name = 'Ganado'
          AND l.assigned_to = $${month ? 3 : 2}
          ${topYearFilter}
        ORDER BY l.value DESC
        LIMIT 10
      `;
      topDealsParams = month ? [year, month, userId] : [year, userId];
    }

    const topDealsResult = await pool.query(topDealsQuery, topDealsParams);

    // ── 5. Summary ────────────────────────────────────────────────────────────
    const rows = revenueByMonthResult.rows;
    const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
    const totalDeals   = rows.reduce((s, r) => s + parseInt(r.count  || 0), 0);
    const avgDealSize  = totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0;
    const bestMonthRow = rows.reduce((best, r) => (!best || parseFloat(r.total) > parseFloat(best.total)) ? r : best, null);

    const summary = {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_deals:   totalDeals,
      avg_deal_size: avgDealSize,
      best_month:    bestMonthRow ? bestMonthRow.month : null,
    };

    res.json({
      revenue_by_month: revenueByMonthResult.rows.map(r => ({
        month: r.month,
        total: parseFloat(r.total) || 0,
        count: parseInt(r.count)   || 0,
      })),
      revenue_by_agent: revenueByAgentResult.rows.map(r => ({
        agent_name: r.agent_name,
        total:      parseFloat(r.total)    || 0,
        count:      parseInt(r.count)      || 0,
        avg_deal:   parseFloat(r.avg_deal) || 0,
      })),
      revenue_by_stage: revenueByStageResult.rows.map(r => ({
        stage_name: r.stage_name,
        total:      parseFloat(r.total) || 0,
      })),
      top_deals: topDealsResult.rows.map(r => ({
        lead_title:   r.lead_title,
        contact_name: r.contact_name,
        agent_name:   r.agent_name,
        value:        parseFloat(r.value) || 0,
        closed_at:    r.closed_at,
      })),
      summary,
    });
  } catch (e) {
    console.error('[financialReport] resumenFinanciero:', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/financial/excel
// Returns CSV of won deals
// ─────────────────────────────────────────────────────────────────────────────
async function exportarExcel(req, res) {
  try {
    const year    = parseInt(req.query.year)  || new Date().getFullYear();
    const month   = parseInt(req.query.month) || null;
    const isAdmin = req.user?.role === 'admin';
    const userId  = req.user?.id;

    const monthFilter = month ? `AND EXTRACT(MONTH FROM l.updated_at) = $2` : '';

    let query;
    let params;

    if (isAdmin) {
      query = `
        SELECT
          l.title                              AS lead,
          COALESCE(c.name, '—')               AS contacto,
          COALESCE(u.name, 'Sin asignar')     AS agente,
          COALESCE(l.value, 0)                AS valor,
          TO_CHAR(l.updated_at, 'YYYY-MM-DD') AS fecha_cierre,
          ps.name                              AS etapa
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN contacts c ON c.id = l.contact_id
        LEFT JOIN users   u ON u.id  = l.assigned_to
        WHERE ps.name = 'Ganado'
          AND EXTRACT(YEAR FROM l.updated_at) = $1
          ${monthFilter}
        ORDER BY l.updated_at DESC
      `;
      params = month ? [year, month] : [year];
    } else {
      const agentIdx = month ? 3 : 2;
      query = `
        SELECT
          l.title                              AS lead,
          COALESCE(c.name, '—')               AS contacto,
          COALESCE(u.name, 'Sin asignar')     AS agente,
          COALESCE(l.value, 0)                AS valor,
          TO_CHAR(l.updated_at, 'YYYY-MM-DD') AS fecha_cierre,
          ps.name                              AS etapa
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN contacts c ON c.id = l.contact_id
        LEFT JOIN users   u ON u.id  = l.assigned_to
        WHERE ps.name = 'Ganado'
          AND l.assigned_to = $${agentIdx}
          AND EXTRACT(YEAR FROM l.updated_at) = $1
          ${monthFilter}
        ORDER BY l.updated_at DESC
      `;
      params = month ? [year, month, userId] : [year, userId];
    }

    const result = await pool.query(query, params);

    const escape = (v) => {
      const s = String(v == null ? '' : v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ['Lead', 'Contacto', 'Agente', 'Valor', 'Fecha Cierre', 'Etapa'];
    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      csvRows.push([
        escape(row.lead),
        escape(row.contacto),
        escape(row.agente),
        escape(row.valor),
        escape(row.fecha_cierre),
        escape(row.etapa),
      ].join(','));
    }

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-financiero.csv"');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  } catch (e) {
    console.error('[financialReport] exportarExcel:', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { resumenFinanciero, exportarExcel };
