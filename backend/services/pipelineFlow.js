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

module.exports = { autoMoveStage };
