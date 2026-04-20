const { pool } = require('../services/db');

// Auto-create table on first use
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_goals (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period VARCHAR(7) NOT NULL,
      goal_type VARCHAR(30) NOT NULL CHECK (goal_type IN ('leads_closed','revenue','messages_sent')),
      target_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(agent_id, period, goal_type)
    )
  `);
}

// Helper: calculate progress for a single goal row
async function calcProgress(agentId, period, goalType) {
  const [year, month] = period.split('-').map(Number);
  const startOfMonth = `${period}-01`;
  const endOfMonth = `${year}-${String(month).padStart(2,'0')}-01`;

  let current = 0;

  if (goalType === 'leads_closed') {
    const r = await pool.query(`
      SELECT COUNT(DISTINCT l.id)::INTEGER AS val
      FROM leads l
      JOIN pipeline_stages ps ON ps.id = l.stage_id
      WHERE l.assigned_to = $1
        AND ps.name ILIKE '%ganad%'
        AND DATE_TRUNC('month', l.updated_at) = DATE_TRUNC('month', $2::DATE)
    `, [agentId, startOfMonth]);
    current = r.rows[0].val || 0;

  } else if (goalType === 'revenue') {
    const r = await pool.query(`
      SELECT COALESCE(SUM(total), 0)::NUMERIC AS val
      FROM invoices
      WHERE agent_id = $1
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $2::DATE)
    `, [agentId, startOfMonth]);
    current = Number(r.rows[0].val) || 0;

  } else if (goalType === 'messages_sent') {
    const r = await pool.query(`
      SELECT COUNT(*)::INTEGER AS val
      FROM messages
      WHERE sent_by = $1
        AND direction = 'outbound'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $2::DATE)
    `, [agentId, startOfMonth]);
    current = r.rows[0].val || 0;
  }

  return current;
}

// GET /api/goals?period=YYYY-MM
async function listar(req, res) {
  try {
    await ensureTable();

    const period = req.query.period || new Date().toISOString().slice(0, 7);

    // Admin sees all agents' goals; employee sees only their own
    let goalsQuery;
    let params;
    if (req.user.role === 'admin' || req.user.role === 'supervisor') {
      goalsQuery = await pool.query(`
        SELECT ag.*, u.name AS agent_name, u.email AS agent_email, u.role AS agent_role
        FROM agent_goals ag
        JOIN users u ON u.id = ag.agent_id
        WHERE ag.period = $1
        ORDER BY u.name, ag.goal_type
      `, [period]);
    } else {
      goalsQuery = await pool.query(`
        SELECT ag.*, u.name AS agent_name, u.email AS agent_email, u.role AS agent_role
        FROM agent_goals ag
        JOIN users u ON u.id = ag.agent_id
        WHERE ag.period = $1 AND ag.agent_id = $2
        ORDER BY ag.goal_type
      `, [period, req.user.id]);
    }

    const goals = goalsQuery.rows;

    // Calculate progress for each goal in parallel
    const withProgress = await Promise.all(goals.map(async g => {
      const current = await calcProgress(g.agent_id, g.period, g.goal_type);
      const target = Number(g.target_value);
      const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
      return {
        ...g,
        target_value: target,
        current_value: current,
        progress_pct: pct,
      };
    }));

    res.json(withProgress);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// POST /api/goals (requireAdmin)
async function crear(req, res) {
  try {
    await ensureTable();
    const { agent_id, period, goal_type, target_value } = req.body;
    if (!agent_id || !period || !goal_type || target_value == null)
      return res.status(400).json({ error: 'agent_id, period, goal_type, target_value requeridos' });
    if (!['leads_closed','revenue','messages_sent'].includes(goal_type))
      return res.status(400).json({ error: 'goal_type inválido' });
    if (!/^\d{4}-\d{2}$/.test(period))
      return res.status(400).json({ error: 'period debe ser YYYY-MM' });

    const r = await pool.query(`
      INSERT INTO agent_goals (agent_id, period, goal_type, target_value, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (agent_id, period, goal_type) DO UPDATE
        SET target_value = EXCLUDED.target_value
      RETURNING *
    `, [agent_id, period, goal_type, target_value, req.user.id]);

    res.json(r.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// PATCH /api/goals/:id (requireAdmin)
async function actualizar(req, res) {
  try {
    await ensureTable();
    const { id } = req.params;
    const { target_value } = req.body;
    if (target_value == null) return res.status(400).json({ error: 'target_value requerido' });

    const r = await pool.query(
      `UPDATE agent_goals SET target_value = $1 WHERE id = $2 RETURNING *`,
      [target_value, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Meta no encontrada' });
    res.json(r.rows[0]);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// DELETE /api/goals/:id (requireAdmin)
async function eliminar(req, res) {
  try {
    await ensureTable();
    const { id } = req.params;
    const r = await pool.query(`DELETE FROM agent_goals WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Meta no encontrada' });
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/goals/forecast
async function forecast(req, res) {
  try {
    await ensureTable();

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const remainingDays = daysInMonth - dayOfMonth;
    const elapsedFraction = dayOfMonth / daysInMonth;

    // Win rate histórico (últimos 90 días)
    const [winRateR, pipelineR, revenueR, agentsR] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ps.name ILIKE '%ganad%')::FLOAT AS ganados,
          COUNT(*) FILTER (WHERE ps.name ILIKE '%ganad%' OR ps.name ILIKE '%perdid%')::FLOAT AS cerrados
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE l.updated_at >= NOW() - INTERVAL '90 days'
      `),
      // Leads activos en pipeline (no ganados/perdidos)
      pool.query(`
        SELECT
          COUNT(l.id)::INTEGER AS leads_activos,
          COALESCE(AVG(l.value) FILTER (WHERE l.value > 0), 0)::NUMERIC AS valor_promedio
        FROM leads l
        JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE ps.name NOT ILIKE '%ganad%'
          AND ps.name NOT ILIKE '%perdid%'
      `),
      // Ingresos del mes actual
      pool.query(`
        SELECT COALESCE(SUM(total), 0)::NUMERIC AS total_mes
        FROM invoices
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      `),
      // Por agente: metas + progreso
      pool.query(`
        SELECT
          u.id, u.name,
          ag_rev.target_value AS meta_ingresos,
          ag_leads.target_value AS meta_leads,
          COALESCE(SUM(inv.total) FILTER (
            WHERE inv.created_at >= DATE_TRUNC('month', NOW())
          ), 0)::NUMERIC AS ingresos_mes,
          COUNT(DISTINCT l.id) FILTER (
            WHERE ps.name ILIKE '%ganad%'
              AND l.updated_at >= DATE_TRUNC('month', NOW())
          )::INTEGER AS leads_cerrados_mes
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id
        LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
        LEFT JOIN invoices inv ON inv.agent_id = u.id
        LEFT JOIN agent_goals ag_rev ON ag_rev.agent_id = u.id
          AND ag_rev.period = $1 AND ag_rev.goal_type = 'revenue'
        LEFT JOIN agent_goals ag_leads ON ag_leads.agent_id = u.id
          AND ag_leads.period = $1 AND ag_leads.goal_type = 'leads_closed'
        WHERE u.active = true
        GROUP BY u.id, u.name, ag_rev.target_value, ag_leads.target_value
      `, [period]),
    ]);

    const wl = winRateR.rows[0];
    const winRate = wl.cerrados > 0 ? wl.ganados / wl.cerrados : 0.3;
    const pipeline = pipelineR.rows[0];
    const ingresosMes = Number(revenueR.rows[0].total_mes);
    const valorPromedio = Number(pipeline.valor_promedio);
    const leadsActivos = pipeline.leads_activos;

    // Proyección: ingresos actuales + (leads en pipeline × win rate × valor promedio × fracción restante del mes)
    const proyeccionPipeline = leadsActivos * winRate * valorPromedio * (remainingDays / daysInMonth);
    const proyeccionTotal = ingresosMes + proyeccionPipeline;

    // Daily run rate
    const dailyRate = dayOfMonth > 0 ? ingresosMes / dayOfMonth : 0;
    const proyeccionRunRate = ingresosMes + dailyRate * remainingDays;

    const agentesConForecast = agentsR.rows.map(a => {
      const metaIngresos = Number(a.meta_ingresos) || 0;
      const metaLeads = Number(a.meta_leads) || 0;
      const ingresosMesAgente = Number(a.ingresos_mes);
      const leadsCerradosAgente = a.leads_cerrados_mes;

      const dailyRateA = dayOfMonth > 0 ? ingresosMesAgente / dayOfMonth : 0;
      const proyeccionA = ingresosMesAgente + dailyRateA * remainingDays;

      const dailyLeadsA = dayOfMonth > 0 ? leadsCerradosAgente / dayOfMonth : 0;
      const proyeccionLeadsA = leadsCerradosAgente + dailyLeadsA * remainingDays;

      return {
        id: a.id,
        name: a.name,
        meta_ingresos: metaIngresos,
        meta_leads: metaLeads,
        ingresos_actuales: ingresosMesAgente,
        leads_cerrados: leadsCerradosAgente,
        proyeccion_ingresos: Math.round(proyeccionA),
        proyeccion_leads: Math.round(proyeccionLeadsA),
        on_track_ingresos: metaIngresos > 0 ? proyeccionA >= metaIngresos * 0.8 : null,
        on_track_leads: metaLeads > 0 ? proyeccionLeadsA >= metaLeads * 0.8 : null,
      };
    });

    res.json({
      period,
      dia_del_mes: dayOfMonth,
      dias_en_mes: daysInMonth,
      dias_restantes: remainingDays,
      ingresos_actuales: ingresosMes,
      win_rate_pct: Math.round(winRate * 100),
      leads_activos_pipeline: leadsActivos,
      valor_promedio_lead: Math.round(valorPromedio),
      proyeccion_pipeline: Math.round(proyeccionPipeline),
      proyeccion_total: Math.round(proyeccionTotal),
      proyeccion_run_rate: Math.round(proyeccionRunRate),
      por_agente: agentesConForecast,
    });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { listar, crear, actualizar, eliminar, forecast };

/* ROUTES_TO_ADD_server.js
const goals = require('./controllers/goalsController');
app.get('/api/goals/forecast',  goals.forecast);
app.get('/api/goals',           goals.listar);
app.post('/api/goals',          requireAdmin, goals.crear);
app.patch('/api/goals/:id',     requireAdmin, goals.actualizar);
app.delete('/api/goals/:id',    requireAdmin, goals.eliminar);
*/

/* API_METHODS_TO_ADD_api.js
goalsForecast:  ()           => req('GET',    '/api/goals/forecast'),
goals:          (period)     => req('GET',    `/api/goals${period ? `?period=${period}` : ''}`),
createGoal:     (data)       => req('POST',   '/api/goals', data),
updateGoal:     (id, data)   => req('PATCH',  `/api/goals/${id}`, data),
deleteGoal:     (id)         => req('DELETE', `/api/goals/${id}`),
*/
