/**
 * Migración de leads desde Kommo API → nuevo CRM
 *
 * Uso:
 *   KOMMO_URL="https://TUSUBDOMINIO.kommo.com" \
 *   KOMMO_TOKEN="tu_access_token" \
 *   NEW_DB="postgresql://..." \
 *   node migrate-from-kommo-leads.js
 */

try { require('dotenv').config(); } catch {}
const axios  = require('axios');
const { Pool } = require('pg');

const KOMMO_URL   = process.env.KOMMO_URL;
const KOMMO_TOKEN = process.env.KOMMO_TOKEN;
const NEW_DB      = process.env.NEW_DB || process.env.DATABASE_URL;

if (!KOMMO_URL || !KOMMO_TOKEN || !NEW_DB) {
  console.error('\nFaltan variables:\n  KOMMO_URL="https://sub.kommo.com" KOMMO_TOKEN="..." NEW_DB="postgresql://..." node migrate-from-kommo-leads.js\n');
  process.exit(1);
}

const pool = new Pool({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });
const headers = { Authorization: `Bearer ${KOMMO_TOKEN}`, 'Content-Type': 'application/json' };

async function kommoGet(path) {
  const r = await axios.get(`${KOMMO_URL}${path}`, { headers, timeout: 15000 });
  return r.data;
}

// Obtiene todos los items de una lista paginada
async function getAllPages(path, entity) {
  const items = [];
  let page = 1;
  while (true) {
    try {
      const data = await kommoGet(`${path}&page=${page}&limit=250`);
      const rows = data?._embedded?.[entity] || [];
      if (!rows.length) break;
      items.push(...rows);
      if (rows.length < 250) break;
      page++;
    } catch (e) {
      if (e.response?.status === 204) break; // sin más datos
      throw e;
    }
  }
  return items;
}

async function run() {
  console.log('\n━━━ MIGRACIÓN LEADS KOMMO → CRM ━━━\n');

  // ── 1. Obtener etapas del pipeline por defecto del nuevo CRM ───────────────
  const stageRows = await pool.query(`
    SELECT ps.id, ps.name, ps.pipeline_id
    FROM pipeline_stages ps
    JOIN pipelines p ON p.id = ps.pipeline_id
    ORDER BY p.position, ps.position
  `);
  const stages = stageRows.rows;
  const defaultStage = stages[0];
  const ganadoStage  = stages.find(s => s.name.toLowerCase().includes('ganad')) || stages[stages.length - 2] || defaultStage;
  const perdidoStage = stages.find(s => s.name.toLowerCase().includes('perdid')) || stages[stages.length - 1] || defaultStage;

  console.log('Etapas disponibles en nuevo CRM:');
  stages.forEach(s => console.log(`  [${s.id}] ${s.name}`));

  // ── 2. Obtener etapas de Kommo para mapear ─────────────────────────────────
  console.log('\nObteniendo pipelines de Kommo...');
  let kommoStages = {};
  try {
    const pipData = await kommoGet('/api/v4/leads/pipelines?limit=50');
    const pips = pipData?._embedded?.pipelines || [];
    for (const pip of pips) {
      for (const st of pip._embedded?.statuses || []) {
        kommoStages[st.id] = st.name;
      }
    }
    console.log(`  ${Object.keys(kommoStages).length} etapas de Kommo obtenidas`);
  } catch (e) {
    console.log('  No se pudieron obtener etapas de Kommo:', e.message);
  }

  // Mapeo de nombre de etapa Kommo → etapa del nuevo CRM
  function mapearEtapa(kommoStatusId) {
    const nombreKommo = (kommoStages[kommoStatusId] || '').toLowerCase();
    if (nombreKommo.includes('ganad') || nombreKommo.includes('won') || nombreKommo.includes('closed')) return ganadoStage;
    if (nombreKommo.includes('perdid') || nombreKommo.includes('lost')) return perdidoStage;
    // Intentar match por nombre similar
    for (const s of stages) {
      if (s.name.toLowerCase().includes(nombreKommo.slice(0, 5))) return s;
    }
    return defaultStage;
  }

  // ── 3. Obtener contactos de Kommo ──────────────────────────────────────────
  console.log('\nObteniendo contactos de Kommo...');
  const kommoContactos = await getAllPages('/api/v4/contacts?with=leads', 'contacts');
  console.log(`  ${kommoContactos.length} contactos encontrados`);

  // Mapa kommo_contact_id → new_contact_id
  const contactMap = {};
  let contactsCreados = 0, contactsExistentes = 0;

  for (const kc of kommoContactos) {
    const nombre = kc.name || 'Sin nombre';
    let telefono = null, email = null;

    // Extraer teléfono y email de custom_fields_values
    for (const field of kc.custom_fields_values || []) {
      if (field.field_code === 'PHONE' || field.field_name?.toLowerCase().includes('phone') || field.field_name?.toLowerCase().includes('tel')) {
        telefono = field.values?.[0]?.value || null;
      }
      if (field.field_code === 'EMAIL' || field.field_name?.toLowerCase().includes('email') || field.field_name?.toLowerCase().includes('correo')) {
        email = field.values?.[0]?.value?.toLowerCase() || null;
      }
    }

    // Buscar contacto existente
    let contacto = null;
    if (telefono) contacto = (await pool.query('SELECT id FROM contacts WHERE phone=$1 LIMIT 1', [telefono])).rows[0];
    if (!contacto && email) contacto = (await pool.query('SELECT id FROM contacts WHERE email=$1 LIMIT 1', [email])).rows[0];

    if (contacto) {
      // Actualizar datos que falten
      await pool.query(
        `UPDATE contacts SET
           phone = COALESCE(NULLIF($1,''), phone),
           email = COALESCE(NULLIF($2,''), email),
           updated_at = NOW()
         WHERE id = $3`,
        [telefono, email, contacto.id]
      );
      contactMap[kc.id] = contacto.id;
      contactsExistentes++;
    } else {
      const ins = await pool.query(
        `INSERT INTO contacts (name, phone, email, source) VALUES ($1,$2,$3,'kommo') RETURNING id`,
        [nombre, telefono, email]
      );
      contactMap[kc.id] = ins.rows[0].id;
      contactsCreados++;
    }
  }
  console.log(`Contactos creados: ${contactsCreados} | actualizados: ${contactsExistentes}`);

  // ── 4. Obtener leads de Kommo ──────────────────────────────────────────────
  console.log('\nObteniendo leads de Kommo...');
  const kommoLeads = await getAllPages('/api/v4/leads?with=contacts,pipeline', 'leads');
  console.log(`  ${kommoLeads.length} leads encontrados`);

  let leadsCreados = 0, leadsExistentes = 0;

  for (const kl of kommoLeads) {
    // Obtener contact_id del nuevo CRM
    const kommoContactId = kl._embedded?.contacts?.[0]?.id;
    const newContactId   = kommoContactId ? contactMap[kommoContactId] : null;

    if (!newContactId) continue; // sin contacto no podemos crear el lead

    // Mapear etapa
    const etapa = mapearEtapa(kl.status_id);

    const titulo = kl.name || 'Lead Kommo';
    const valor  = kl.price || 0;
    const fecha  = kl.created_at ? new Date(kl.created_at * 1000) : new Date();

    // Verificar si ya existe un lead con este título y contacto
    const existe = await pool.query(
      `SELECT id FROM leads WHERE contact_id=$1 AND title=$2 LIMIT 1`,
      [newContactId, titulo]
    );

    if (existe.rows.length > 0) {
      leadsExistentes++;
      continue;
    }

    await pool.query(
      `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, value, source, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'kommo',$6,$6)`,
      [titulo, newContactId, etapa.pipeline_id, etapa.id, valor, fecha]
    );
    leadsCreados++;
  }

  console.log(`Leads creados: ${leadsCreados} | ya existían: ${leadsExistentes}`);

  console.log('\n━━━ MIGRACIÓN COMPLETA ━━━\n');
  console.log(`  Contactos creados  : ${contactsCreados}`);
  console.log(`  Leads creados      : ${leadsCreados}`);
  console.log('');

  await pool.end();
}

run().catch(err => {
  console.error('\n[ERROR]', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data).slice(0, 300));
  process.exit(1);
});
