const { pool } = require('../services/db');

async function listarPipelines(req, res) {
  const pips = await pool.query('SELECT * FROM pipelines ORDER BY position');
  const stages = await pool.query('SELECT * FROM pipeline_stages ORDER BY pipeline_id, position');
  const resultado = pips.rows.map(p => ({
    ...p,
    stages: stages.rows.filter(s => s.pipeline_id === p.id),
  }));
  res.json(resultado);
}

async function crearPipeline(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name requerido' });
  const count = await pool.query('SELECT COUNT(*) FROM pipelines');
  const result = await pool.query(
    'INSERT INTO pipelines (name, position) VALUES ($1, $2) RETURNING *',
    [name, Number(count.rows[0].count)]
  );
  res.json(result.rows[0]);
}

async function crearEtapa(req, res) {
  const { name, color = '#6366f1' } = req.body;
  const { pipelineId } = req.params;
  if (!name) return res.status(400).json({ error: 'name requerido' });
  const count = await pool.query('SELECT COUNT(*) FROM pipeline_stages WHERE pipeline_id = $1', [pipelineId]);
  const result = await pool.query(
    'INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES ($1,$2,$3,$4) RETURNING *',
    [pipelineId, name, color, Number(count.rows[0].count)]
  );
  res.json(result.rows[0]);
}

async function actualizarEtapa(req, res) {
  const { name, color, position } = req.body;
  const result = await pool.query(
    `UPDATE pipeline_stages SET
      name     = COALESCE($1, name),
      color    = COALESCE($2, color),
      position = COALESCE($3, position)
     WHERE id = $4 RETURNING *`,
    [name || null, color || null, position ?? null, req.params.stageId]
  );
  res.json(result.rows[0]);
}

async function eliminarEtapa(req, res) {
  await pool.query('DELETE FROM pipeline_stages WHERE id = $1', [req.params.stageId]);
  res.json({ ok: true });
}

async function actualizarPipeline(req, res) {
  const { name, position } = req.body;
  const result = await pool.query(
    `UPDATE pipelines SET
      name     = COALESCE($1, name),
      position = COALESCE($2, position)
     WHERE id = $3 RETURNING *`,
    [name || null, position ?? null, req.params.pipelineId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Pipeline no encontrado' });
  res.json(result.rows[0]);
}

async function eliminarPipeline(req, res) {
  await pool.query('DELETE FROM pipelines WHERE id = $1', [req.params.pipelineId]);
  res.json({ ok: true });
}

// ── Energy Depot PR — Pipeline por defecto ────────────────────────────────────
// Crea el pipeline "Ventas Solar" con las 7 etapas si no existe ningún pipeline.
// Llamar desde initDB o desde una ruta admin: POST /api/pipelines/seed
async function seedDefaultPipeline() {
  const existing = await pool.query('SELECT COUNT(*) FROM pipelines');
  if (Number(existing.rows[0].count) > 0) return { ok: true, message: 'Pipeline ya existe, seed omitido.' };

  const etapas = [
    { name: 'Lead',            color: '#6366f1' },
    { name: 'Contactado',      color: '#3b82f6' },
    { name: 'Cotización',      color: '#f59e0b' },
    { name: 'Financiamiento',  color: '#10b981' },
    { name: 'Permisos LUMA',   color: '#8b5cf6' },
    { name: 'Instalación',     color: '#f97316' },
    { name: 'Completado',      color: '#22c55e' },
  ];

  const pipeline = await pool.query(
    'INSERT INTO pipelines (name, position) VALUES ($1, $2) RETURNING *',
    ['Ventas Solar', 0]
  );
  const pipelineId = pipeline.rows[0].id;

  for (let i = 0; i < etapas.length; i++) {
    await pool.query(
      'INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES ($1,$2,$3,$4)',
      [pipelineId, etapas[i].name, etapas[i].color, i]
    );
  }

  return { ok: true, pipeline_id: pipelineId, etapas: etapas.length };
}

async function seedDefaultPipelineHandler(req, res) {
  try {
    const result = await seedDefaultPipeline();
    res.json(result);
  } catch (err) {
    console.error('[PIPELINE SEED]', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listarPipelines, crearPipeline, crearEtapa, actualizarEtapa, eliminarEtapa, actualizarPipeline, eliminarPipeline, seedDefaultPipeline, seedDefaultPipelineHandler };
