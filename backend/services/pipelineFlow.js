// Helper compartido: avanza un lead a la etapa que matchee keywords (case-insensitive).
// Nunca retrocede: si el lead ya está en una etapa posterior, no lo toca.
const { pool } = require('./db');

async function autoMoveStage(leadId, targetKeywords = []) {
  if (!leadId || !targetKeywords.length) return;
  try {
    const leadR = await pool.query(
      `SELECT l.pipeline_id, l.stage_id, ps.position AS cur_position
         FROM leads l LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE l.id = $1`, [leadId]
    );
    const lead = leadR.rows[0];
    if (!lead?.pipeline_id) return;

    const stagesR = await pool.query(
      `SELECT id, name, position FROM pipeline_stages
        WHERE pipeline_id=$1 ORDER BY position`, [lead.pipeline_id]
    );
    const target = stagesR.rows.find(s => {
      const n = (s.name || '').toLowerCase();
      return targetKeywords.some(k => n.includes(k.toLowerCase()));
    });
    if (!target) return;

    const curPos = lead.cur_position ?? -1;
    if (target.position <= curPos) return; // no retroceder

    await pool.query(
      `UPDATE leads SET stage_id=$1, updated_at=NOW() WHERE id=$2`,
      [target.id, leadId]
    );
    console.log(`[autoMoveStage] lead ${leadId} → ${target.name}`);
  } catch (e) {
    console.error('[autoMoveStage]', e.message);
  }
}

/**
 * Idempotente: garantiza que exista el pipeline "Instalaciones" con sus etapas.
 * Devuelve { pipelineId, stages: [{id,name,position}] }.
 */
async function ensureInstallationsPipeline() {
  // Asegurar columna parent_lead_id ANTES de cualquier insert
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS parent_lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL`);

  const STAGES = [
    { name: 'Instalación',    color: '#10b981', position: 0 },
    { name: 'Permisos LUMA',  color: '#f97316', position: 1 },
    { name: 'Inspección',     color: '#0ea5e9', position: 2 },
    { name: 'Net Metering',   color: '#8b5cf6', position: 3 },
    { name: 'Energizado',     color: '#06b6d4', position: 4 },
    { name: 'Completado',     color: '#00c9a7', position: 5 },
  ];

  let pip = await pool.query(`SELECT id FROM pipelines WHERE LOWER(name) LIKE '%instalac%' LIMIT 1`);
  let pipelineId;
  if (pip.rows.length === 0) {
    const nextPos = await pool.query(`SELECT COALESCE(MAX(position),0)+1 AS p FROM pipelines`);
    const r = await pool.query(
      `INSERT INTO pipelines (name, position) VALUES ('Instalaciones', $1) RETURNING id`,
      [nextPos.rows[0].p]
    );
    pipelineId = r.rows[0].id;
  } else {
    pipelineId = pip.rows[0].id;
  }

  // Upsert: si la etapa existe (case-insensitive) actualiza su position; si no, insertar.
  for (const s of STAGES) {
    const found = await pool.query(
      `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [pipelineId, s.name]
    );
    if (found.rows[0]) {
      await pool.query(
        `UPDATE pipeline_stages SET position = $1, color = $2 WHERE id = $3`,
        [s.position, s.color, found.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES ($1,$2,$3,$4)`,
        [pipelineId, s.name, s.color, s.position]
      );
    }
  }

  const stages = await pool.query(
    `SELECT id, name, position FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position, id`,
    [pipelineId]
  );
  return { pipelineId, stages: stages.rows };
}

/**
 * Duplica un lead al pipeline Instalaciones en la etapa "Instalación".
 * Si ya existe un lead-hijo de ese padre en Instalaciones, no crea otro (idempotente).
 */
async function duplicateLeadToInstallations(parentLeadId) {
  try {
    if (!parentLeadId) return null;
    const { pipelineId, stages } = await ensureInstallationsPipeline();
    const installStage = stages.find(s => /instalac/i.test(s.name)) || stages[0];

    // Si ya existe un hijo, no duplicar
    const dupCheck = await pool.query(
      `SELECT id FROM leads WHERE parent_lead_id = $1 AND pipeline_id = $2 LIMIT 1`,
      [parentLeadId, pipelineId]
    );
    if (dupCheck.rows[0]) {
      console.log(`[duplicateLead] lead ${parentLeadId} ya tiene hijo en Instalaciones`);
      return dupCheck.rows[0].id;
    }

    const src = await pool.query(`SELECT * FROM leads WHERE id = $1`, [parentLeadId]);
    const lead = src.rows[0];
    if (!lead) return null;

    const r = await pool.query(
      `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, value, solar_data, source, assigned_to, parent_lead_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        lead.title,
        lead.contact_id,
        pipelineId,
        installStage.id,
        lead.value,
        lead.solar_data ? JSON.stringify(lead.solar_data) : null,
        'instalacion-auto',
        lead.assigned_to,
        parentLeadId,
      ]
    );
    console.log(`[duplicateLead] lead ${parentLeadId} duplicado a Instalaciones como ${r.rows[0].id}`);
    return r.rows[0].id;
  } catch (e) {
    console.error('[duplicateLeadToInstallations]', e.message);
    return null;
  }
}

module.exports = { autoMoveStage, ensureInstallationsPipeline, duplicateLeadToInstallations };
