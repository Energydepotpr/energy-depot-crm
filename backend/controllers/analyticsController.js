const { pool } = require('../services/db');

// GET /api/analytics/funnel
async function funnel(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        ps.id,
        ps.name AS etapa,
        ps.color,
        ps.position,
        COUNT(l.id)::INTEGER AS total,
        COALESCE(SUM(l.value), 0)::NUMERIC AS valor_total
      FROM pipeline_stages ps
      LEFT JOIN leads l ON l.stage_id = ps.id
      GROUP BY ps.id, ps.name, ps.color, ps.position
      ORDER BY ps.position ASC
    `);

    const rows = result.rows;
    const totalLeads = rows.reduce((s, r) => s + r.total, 0) || 1;

    const data = rows.map((r, i) => {
      const prevTotal = i === 0 ? totalLeads : (rows[i - 1]?.total || 1);
      const conversion = prevTotal > 0 ? Math.round((r.total / prevTotal) * 100) : 0;
      return {
        id: r.id,
        etapa: r.etapa,
        color: r.color,
        position: r.position,
        total: r.total,
        pct_del_total: totalLeads > 0 ? Math.round((r.total / totalLeads) * 100) : 0,
        conversion_desde_anterior: conversion,
        valor_total: Number(r.valor_total),
      };
    });

    res.json(data);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/analytics/win-rate?days=30
async function winRate(req, res) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const interval = `${days} days`;

    const [winLose, avgClose] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ps.name ILIKE '%ganad%')::INTEGER AS ganados,
          COUNT(*) FILTER (WHERE ps.name ILIKE '%perdid%')::INTEGER AS perdidos,
          COUNT(*)::INTEGER AS total_cerrados
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE (ps.name ILIKE '%ganad%' OR ps.name ILIKE '%perdid%')
          AND l.updated_at >= NOW() - $1::INTERVAL
      `, [interval]),
      pool.query(`
        SELECT
          ROUND(AVG(
            EXTRACT(EPOCH FROM (l.updated_at - l.created_at)) / 86400
          ))::INTEGER AS dias_promedio_cierre
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE ps.name ILIKE '%ganad%'
          AND l.updated_at >= NOW() - $1::INTERVAL
      `, [interval]),
    ]);

    const wl = winLose.rows[0];
    const winRate = wl.total_cerrados > 0
      ? Math.round((wl.ganados / wl.total_cerrados) * 100)
      : 0;

    res.json({
      ganados: wl.ganados,
      perdidos: wl.perdidos,
      total_cerrados: wl.total_cerrados,
      win_rate_pct: winRate,
      dias_promedio_cierre: avgClose.rows[0].dias_promedio_cierre || 0,
      periodo_dias: days,
    });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/analytics/revenue?days=30
async function revenue(req, res) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);

    const [porMes, mesActual, mesAnterior] = await Promise.all([
      // Ingresos por mes (últimos 6 meses)
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') AS mes_label,
          COALESCE(SUM(total), 0)::NUMERIC AS ingresos
        FROM invoices
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `),
      // Mes actual
      pool.query(`
        SELECT COALESCE(SUM(total), 0)::NUMERIC AS total
        FROM invoices
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      `),
      // Mes anterior
      pool.query(`
        SELECT COALESCE(SUM(total), 0)::NUMERIC AS total
        FROM invoices
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
      `),
    ]);

    const actualVal = Number(mesActual.rows[0].total);
    const anteriorVal = Number(mesAnterior.rows[0].total);
    const variacion = anteriorVal > 0
      ? Math.round(((actualVal - anteriorVal) / anteriorVal) * 100)
      : (actualVal > 0 ? 100 : 0);

    res.json({
      por_mes: porMes.rows.map(r => ({ mes: r.mes, mes_label: r.mes_label, ingresos: Number(r.ingresos) })),
      mes_actual: actualVal,
      mes_anterior: anteriorVal,
      variacion_pct: variacion,
    });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/analytics/top-leads
async function topLeads(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.title,
        l.value,
        c.name AS contacto,
        c.phone AS telefono,
        ps.name AS etapa,
        ps.color AS etapa_color,
        l.created_at
      FROM leads l
      LEFT JOIN contacts c ON c.id = l.contact_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      WHERE l.value > 0
        AND (ps.name NOT ILIKE '%ganad%' OR ps.name IS NULL)
      ORDER BY l.value DESC
      LIMIT 10
    `);

    res.json(result.rows.map(r => ({
      id: r.id,
      title: r.title,
      value: Number(r.value),
      contacto: r.contacto,
      telefono: r.telefono,
      etapa: r.etapa,
      etapa_color: r.etapa_color,
      created_at: r.created_at,
    })));
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/analytics/agents?days=30
async function agentPerformance(req, res) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const interval = `${days} days`;

    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_to = u.id)::INTEGER AS leads_asignados,
        COUNT(DISTINCT m.id) FILTER (
          WHERE m.direction = 'outbound' AND m.sent_by = u.id
            AND m.created_at >= NOW() - $1::INTERVAL
        )::INTEGER AS mensajes_enviados,
        COUNT(DISTINCT l.id) FILTER (
          WHERE l.assigned_to = u.id AND ps.name ILIKE '%ganad%'
            AND l.updated_at >= NOW() - $1::INTERVAL
        )::INTEGER AS leads_ganados,
        COALESCE(SUM(inv.total) FILTER (WHERE inv.agent_id = u.id
          AND inv.created_at >= NOW() - $1::INTERVAL), 0)::NUMERIC AS ingresos
      FROM users u
      LEFT JOIN leads l ON l.assigned_to = u.id
      LEFT JOIN messages m ON m.sent_by = u.id
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      LEFT JOIN invoices inv ON inv.agent_id = u.id
      WHERE u.active = true
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY leads_ganados DESC, mensajes_enviados DESC
    `, [interval]);

    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      leads_asignados: r.leads_asignados,
      mensajes_enviados: r.mensajes_enviados,
      leads_ganados: r.leads_ganados,
      ingresos: Number(r.ingresos),
    })));
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { funnel, winRate, revenue, topLeads, agentPerformance };

/* ROUTES_TO_ADD_server.js
const analytics = require('./controllers/analyticsController');
app.get('/api/analytics/funnel',    analytics.funnel);
app.get('/api/analytics/win-rate',  analytics.winRate);
app.get('/api/analytics/revenue',   analytics.revenue);
app.get('/api/analytics/top-leads', analytics.topLeads);
app.get('/api/analytics/agents',    analytics.agentPerformance);
*/

/* API_METHODS_TO_ADD_api.js
analyticsFunnel:      ()           => req('GET', '/api/analytics/funnel'),
analyticsWinRate:     (days = 30)  => req('GET', `/api/analytics/win-rate?days=${days}`),
analyticsRevenue:     (days = 30)  => req('GET', `/api/analytics/revenue?days=${days}`),
analyticsTopLeads:    ()           => req('GET', '/api/analytics/top-leads'),
analyticsAgents:      (days = 30)  => req('GET', `/api/analytics/agents?days=${days}`),
*/
