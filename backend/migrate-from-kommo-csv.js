/**
 * Migración de leads desde CSV exportado de Kommo → nuevo CRM
 *
 * Uso:
 *   NEW_DB="postgresql://..." node migrate-from-kommo-csv.js
 */

try { require('dotenv').config(); } catch {}
const fs   = require('fs');
const { parse } = require('csv-parse/sync');
const { Pool }  = require('pg');

const CSV_PATH = process.argv[2] ||
  'C:/Users/alexa/OneDrive/Desktop/Nueva carpeta/kommo_export_leads_2026-03-09.csv';

const NEW_DB = process.env.NEW_DB || process.env.DATABASE_URL;

if (!NEW_DB) {
  console.error('\nFalta NEW_DB o DATABASE_URL\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: NEW_DB,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

function extraerTelefono(row) {
  const cols = [
    'Teléfono celular', 'Teléfono oficina', 'Teléfono oficina directo',
    'Teléfono de casa', 'Otro teléfono', 'Fax'
  ];
  for (const c of cols) {
    const v = (row[c] || '').trim().replace(/\D/g, '');
    if (v.length >= 7) return v;
  }
  return null;
}

function extraerEmail(row) {
  const cols = ['Correo', 'E-mail priv.', 'Otro e-mail'];
  for (const c of cols) {
    const v = (row[c] || '').trim().toLowerCase();
    if (v.includes('@')) return v;
  }
  return null;
}

function mapearEtapa(stages, statusName) {
  if (!statusName) return stages[0];
  const s = statusName.toLowerCase();
  if (s.includes('ganad') || s.includes('won') || s.includes('closed')) {
    return stages.find(x => x.name.toLowerCase().includes('ganad')) || stages[stages.length - 2] || stages[0];
  }
  if (s.includes('perdid') || s.includes('lost')) {
    return stages.find(x => x.name.toLowerCase().includes('perdid')) || stages[stages.length - 1] || stages[0];
  }
  for (const st of stages) {
    if (s.length >= 4 && st.name.toLowerCase().includes(s.slice(0, 4))) return st;
  }
  return stages[0];
}

async function run() {
  console.log('\n━━━ MIGRACIÓN CSV KOMMO → CRM ━━━\n');

  // Test connection
  try {
    await pool.query('SELECT 1');
    console.log('✓ Conexión a DB OK');
  } catch (e) {
    console.error('✗ Error conectando a DB:', e.message);
    process.exit(1);
  }

  if (!fs.existsSync(CSV_PATH)) {
    console.error('No se encontró:', CSV_PATH);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  let rows;
  try {
    rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true,
    });
  } catch (e) {
    console.error('Error parseando CSV:', e.message);
    process.exit(1);
  }
  console.log(`CSV cargado: ${rows.length} filas`);

  // Cargar etapas
  const stageRows = await pool.query(`
    SELECT ps.id, ps.name, ps.pipeline_id
    FROM pipeline_stages ps
    JOIN pipelines p ON p.id = ps.pipeline_id
    ORDER BY p.position, ps.position
  `);
  const stages = stageRows.rows;
  if (!stages.length) { console.error('No hay etapas en el CRM'); process.exit(1); }
  console.log(`Etapas: ${stages.map(s => s.name).join(', ')}\n`);

  let contactsCreados = 0, contactsActualizados = 0;
  let leadsCreados = 0, leadsOmitidos = 0, leadsError = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i % 100 === 0) process.stdout.write(`Procesando ${i}/${rows.length}...\r`);

    try {
      const leadTitle = (row['Nombre del lead'] || '').trim();
      const nombre    = (row['Nombre completo'] || row['Compañía del contracto'] || '').trim() || 'Sin nombre';
      const telefono  = extraerTelefono(row);
      const email     = extraerEmail(row);
      const status    = (row['Estatus del lead'] || '').trim();
      const etapa     = mapearEtapa(stages, status);
      const presup    = parseFloat((row['Presupuesto $'] || '0').replace(/[^0-9.]/g, '')) || 0;

      const titulo = leadTitle || `Lead Kommo ${row['ID'] || i}`;

      let fecha = new Date();
      const fechaStr = (row['Fecha de Creación'] || '').trim();
      if (fechaStr) {
        const m = fechaStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (m) fecha = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`);
      }

      // ── Buscar/crear contacto ──────────────────────────────────────────────
      let contactoId = null;
      let contacto = null;

      if (telefono) {
        const r = await pool.query('SELECT id FROM contacts WHERE phone=$1 LIMIT 1', [telefono]);
        contacto = r.rows[0];
      }
      if (!contacto && email) {
        const r = await pool.query('SELECT id FROM contacts WHERE email=$1 LIMIT 1', [email]);
        contacto = r.rows[0];
      }

      if (contacto) {
        await pool.query(
          `UPDATE contacts SET
             phone = COALESCE(NULLIF($1,''), phone),
             email = COALESCE(NULLIF($2,''), email),
             updated_at = NOW()
           WHERE id = $3`,
          [telefono, email, contacto.id]
        );
        contactoId = contacto.id;
        contactsActualizados++;
      } else {
        const ins = await pool.query(
          `INSERT INTO contacts (name, phone, email, source) VALUES ($1,$2,$3,'kommo') RETURNING id`,
          [nombre, telefono, email]
        );
        contactoId = ins.rows[0].id;
        contactsCreados++;
      }

      // ── Verificar lead duplicado ───────────────────────────────────────────
      const existe = await pool.query(
        `SELECT id FROM leads WHERE contact_id=$1 AND title=$2 LIMIT 1`,
        [contactoId, titulo]
      );
      if (existe.rows.length > 0) { leadsOmitidos++; continue; }

      // ── Crear lead ─────────────────────────────────────────────────────────
      const leadIns = await pool.query(
        `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, value, source, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'kommo',$6,$6) RETURNING id`,
        [titulo, contactoId, etapa.pipeline_id, etapa.id, presup, fecha]
      );

      // ── Tags ───────────────────────────────────────────────────────────────
      const etiquetas = (row['Etiquetas'] || '').split(',').map(t => t.trim()).filter(Boolean);
      for (const tag of etiquetas) {
        await pool.query(
          `INSERT INTO lead_tags (lead_id, tag) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [leadIns.rows[0].id, tag]
        ).catch(() => {});
      }

      leadsCreados++;
    } catch (err) {
      leadsError++;
      if (leadsError <= 3) console.error(`\nError en fila ${i}: ${err.message}`);
    }
  }

  console.log('\n\n━━━ RESULTADO ━━━');
  console.log(`  Contactos creados     : ${contactsCreados}`);
  console.log(`  Contactos actualizados: ${contactsActualizados}`);
  console.log(`  Leads creados         : ${leadsCreados}`);
  console.log(`  Leads omitidos (dup)  : ${leadsOmitidos}`);
  console.log(`  Errores               : ${leadsError}`);
  console.log('');

  await pool.end();
}

run().catch(err => {
  console.error('\n[ERROR FATAL]', err.message);
  process.exit(1);
});
