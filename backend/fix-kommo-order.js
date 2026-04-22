/**
 * Fix orden y stages Kommo → CRM
 * 1. Agrega columna kommo_position a leads (para preservar orden del kanban)
 * 2. Fuerza stage correcto en todos los leads del Excel
 * 3. Asigna posición según orden del Excel por stage
 * 4. Mueve SMS-only con mensajes a QUICK ADD (al final)
 * 5. Elimina leads vacíos (sin mensajes, notas, tareas)
 *
 * Uso: node fix-kommo-order.js
 */

require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const EXCEL_FILE = 'C:/Users/Steven/Downloads/kommo_export_leads_2026-04-13.xlsx';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const STAGE_MAP = {
  'QUICK ADD':                          18,
  'Incoming leads':                     19,
  'FORMS':                              20,
  'AIRBNB WELCOME EMAIL':               21,
  'AIRBNB PENDING CALL':                22,
  'AWAITING RESPONSE / FOLLOW-UP (4+)': 23,
  'POST CALL - FOLLOW UP':              24,
  'IN PROGRESS (AWAITING PAYMENT)':     25,
  'FAREHARBOR BOOKINGS':                26,
  'PAID - READY TO OPERATIONS':         27,
  'URGENT ARRIVAL 30 DAYS':             28,
  'operations':        29,
  'reviews a revisar': 29,
  'PENDIENTE':         29,
  'VENDORS':           29,
  "'-4":               29,
};

function normalizePhone(p) {
  if (!p) return null;
  const d = p.toString().replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-10) : null;
}

// ── PASO 1: Agregar columna kommo_position ────────────────────────────────────

async function agregarColumnaPosition() {
  console.log('\n══════════════════════════════════════════');
  console.log('PASO 1: Agregar columna kommo_position');
  console.log('══════════════════════════════════════════');
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS kommo_position INTEGER DEFAULT 9999`);
  console.log('✅ Columna kommo_position lista');
}

// ── PASO 2: Forzar stage + posición desde Excel ───────────────────────────────

async function forzarStagesYOrden() {
  console.log('\n══════════════════════════════════════════');
  console.log('PASO 2: Forzar stages y orden desde Excel');
  console.log('══════════════════════════════════════════');

  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`${rows.length} filas en Excel`);

  // Contar posición por stage para respetar el orden del Excel
  const stageCounter = {};

  let actualizados = 0, noEncontrados = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const phones = [
        row['Teléfono celular (contacto)'],
        row['Teléfono oficina (contacto)'],
        row['Teléfono oficina directo (contacto)'],
        row['Otro teléfono (contacto)'],
        row['Teléfono de casa (contacto)'],
      ].filter(Boolean).map(p => normalizePhone(p.toString())).filter(Boolean);

      let leadId = null;

      // Buscar por teléfono (todos los leads del contacto, no solo el más reciente)
      for (const d10 of phones) {
        const r = await pool.query(
          `SELECT l.id FROM leads l
           JOIN contacts c ON c.id = l.contact_id
           WHERE RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10) = $1
             AND l.pipeline_id = 3
           ORDER BY l.id ASC LIMIT 1`,
          [d10]
        );
        if (r.rows.length) { leadId = r.rows[0].id; break; }
      }

      // Si no encontró por teléfono, buscar por nombre exacto del lead
      if (!leadId && row['Nombre del lead']) {
        const nombre = row['Nombre del lead'].toString().trim();
        const r = await pool.query(
          `SELECT id FROM leads WHERE title = $1 AND pipeline_id = 3 ORDER BY id ASC LIMIT 1`,
          [nombre]
        );
        if (r.rows.length) leadId = r.rows[0].id;
      }

      if (!leadId) { noEncontrados++; continue; }

      // Stage del Excel
      const kommoStage = (row['Estatus del lead'] || '').toString().trim();
      const stageId = STAGE_MAP[kommoStage] ?? 19;

      // Posición dentro del stage (orden del Excel = orden de Kommo)
      stageCounter[stageId] = (stageCounter[stageId] || 0) + 1;
      const position = stageCounter[stageId];

      // Forzar actualización sin condiciones
      await pool.query(
        `UPDATE leads SET stage_id = $1, pipeline_id = 3, kommo_position = $2 WHERE id = $3`,
        [stageId, position, leadId]
      );

      actualizados++;
      if (actualizados % 100 === 0) console.log(`  ... ${actualizados} leads actualizados`);

    } catch (e) {
      console.error(`  [ERR] fila ${row['ID']}: ${e.message}`);
    }
  }

  console.log(`\n✅ Actualizados: ${actualizados} | No encontrados: ${noEncontrados}`);
}

// ── PASO 3: Mover SMS-only (con mensajes) a QUICK ADD ─────────────────────────

async function moverSMSOnlyAQuickAdd() {
  console.log('\n══════════════════════════════════════════');
  console.log('PASO 3: SMS-only con mensajes → QUICK ADD');
  console.log('══════════════════════════════════════════');

  // Leads en stage 19 o "Quick Add" de pipeline 1, con al menos 1 mensaje
  const r = await pool.query(`
    UPDATE leads SET stage_id = 18, pipeline_id = 3, kommo_position = 9000 + id
    WHERE id IN (
      SELECT DISTINCT l.id FROM leads l
      JOIN pipeline_stages ps ON ps.id = l.stage_id
      JOIN messages m ON m.lead_id = l.id
      WHERE l.pipeline_id = 3
        AND (l.stage_id = 19 OR ps.name = 'Quick Add')
        AND l.kommo_position = 9999
    )
    RETURNING id
  `);
  console.log(`✅ ${r.rowCount} leads SMS movidos a QUICK ADD`);
}

// ── PASO 4: Eliminar leads vacíos ─────────────────────────────────────────────

async function eliminarLeadsVacios() {
  console.log('\n══════════════════════════════════════════');
  console.log('PASO 4: Eliminar leads vacíos (sin actividad)');
  console.log('══════════════════════════════════════════');

  // Solo eliminar leads sin mensajes, notas, tareas NI en el Excel (kommo_position=9999)
  const r = await pool.query(`
    DELETE FROM leads
    WHERE id IN (
      SELECT l.id FROM leads l
      WHERE l.kommo_position = 9999
        AND NOT EXISTS (SELECT 1 FROM messages   m WHERE m.lead_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM lead_notes n WHERE n.lead_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM tasks      t WHERE t.lead_id = l.id)
    )
    RETURNING id
  `);
  console.log(`✅ ${r.rowCount} leads vacíos eliminados`);
}

// ── PASO 5: Resumen final ─────────────────────────────────────────────────────

async function resumen() {
  console.log('\n══════════════════════════════════════════');
  console.log('RESUMEN FINAL');
  console.log('══════════════════════════════════════════');

  const [total, sinPipeline, porStage] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM leads'),
    pool.query('SELECT COUNT(*) FROM leads WHERE pipeline_id IS NULL'),
    pool.query(`
      SELECT ps.name, COUNT(l.id) as total
      FROM leads l
      JOIN pipeline_stages ps ON ps.id = l.stage_id
      WHERE l.pipeline_id = 3
      GROUP BY ps.name, ps.position
      ORDER BY ps.position
    `),
  ]);

  console.log('Leads totales:', total.rows[0].count);
  console.log('Leads sin pipeline:', sinPipeline.rows[0].count);
  console.log('\nLeads por stage (pipeline 3):');
  porStage.rows.forEach(r => console.log(' ', String(r.total).padStart(4), r.name));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Fix orden y stages Kommo');
  try {
    await agregarColumnaPosition();
    await forzarStagesYOrden();
    await moverSMSOnlyAQuickAdd();
    await eliminarLeadsVacios();
    await resumen();
    console.log('\n🎉 Fix completado');
  } catch (e) {
    console.error('\n❌ Error fatal:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
}

main();
