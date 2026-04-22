/**
 * Corrige las etapas de los leads importados desde Kommo CSV
 * Uso: NEW_DB="postgresql://..." node fix-kommo-stages.js
 */

try { require('dotenv').config(); } catch {}
const fs   = require('fs');
const { parse } = require('csv-parse/sync');
const { Pool }  = require('pg');

const CSV_PATH = process.argv[2] ||
  'C:/Users/alexa/OneDrive/Desktop/Nueva carpeta/kommo_export_leads_2026-03-09.csv';

const NEW_DB = process.env.NEW_DB || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });

// Mapeo manual de etapas Kommo → etapas del nuevo CRM
function mapearEtapa(stages, kommoStatus) {
  const s = (kommoStatus || '').trim();

  // IDs especiales de Kommo: -4 = perdido, -3 = ganado
  if (s === '-4' || s === "'-4") return stages.find(x => x.name.toLowerCase().includes('perdid')) || stages[stages.length - 1];
  if (s === '-3' || s === "'-3") return stages.find(x => x.name.toLowerCase().includes('ganad')) || stages[stages.length - 2];

  const sl = s.toLowerCase();

  // Ganado
  if (sl.includes('paid') || sl.includes('fareharbor') || sl.includes('booking')) {
    return stages.find(x => x.name.toLowerCase().includes('ganad')) || stages[stages.length - 2];
  }
  // Negociación
  if (sl.includes('awaiting payment') || sl.includes('in progress') || sl.includes('post call') || sl.includes('urgent arrival')) {
    return stages.find(x => x.name.toLowerCase().includes('negoc')) || stages[3] || stages[0];
  }
  // Propuesta enviada
  if (sl.includes('welcome email') || sl.includes('airbnb')) {
    return stages.find(x => x.name.toLowerCase().includes('propuesta') || x.name.toLowerCase().includes('enviada')) || stages[2] || stages[0];
  }
  // Contactado
  if (sl.includes('follow-up') || sl.includes('follow up') || sl.includes('awaiting response') || sl.includes('pending call')) {
    return stages.find(x => x.name.toLowerCase().includes('contact')) || stages[1] || stages[0];
  }
  // Nuevo (forms, quick add, leads entrantes)
  return stages[0];
}

async function run() {
  console.log('\n━━━ FIX ETAPAS KOMMO → CRM ━━━\n');

  await pool.query('SELECT 1');
  console.log('✓ DB conectada');

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
  console.log(`CSV: ${rows.length} filas`);

  const stageRows = await pool.query(`
    SELECT ps.id, ps.name, ps.pipeline_id
    FROM pipeline_stages ps
    JOIN pipelines p ON p.id = ps.pipeline_id
    ORDER BY p.position, ps.position
  `);
  const stages = stageRows.rows;
  console.log(`Etapas: ${stages.map(s => `[${s.id}]${s.name}`).join(', ')}\n`);

  let actualizados = 0, noEncontrados = 0;

  // Estadísticas por etapa
  const porEtapa = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const titulo  = (row['Nombre del lead'] || `Lead Kommo ${row['ID'] || i}`).trim();
    const status  = (row['Estatus del lead'] || '').trim();
    const etapa   = mapearEtapa(stages, status);

    if (!etapa) continue;

    // Buscar lead por título (puede haber varios con mismo título, actualizamos todos)
    const r = await pool.query(
      `UPDATE leads SET stage_id=$1, pipeline_id=$2, updated_at=updated_at
       WHERE title=$3 AND source='kommo'
       RETURNING id`,
      [etapa.id, etapa.pipeline_id, titulo]
    );

    if (r.rowCount > 0) {
      actualizados += r.rowCount;
      porEtapa[etapa.name] = (porEtapa[etapa.name] || 0) + r.rowCount;
    } else {
      noEncontrados++;
    }

    if (i % 200 === 0) process.stdout.write(`${i}/${rows.length}...\r`);
  }

  console.log('\n\n━━━ RESULTADO ━━━');
  console.log(`  Leads actualizados: ${actualizados}`);
  console.log(`  No encontrados   : ${noEncontrados}`);
  console.log('\n  Distribución por etapa:');
  Object.entries(porEtapa).forEach(([e, n]) => console.log(`    ${e}: ${n}`));
  console.log('');

  await pool.end();
}

run().catch(err => {
  console.error('\n[ERROR]', err.message);
  process.exit(1);
});
