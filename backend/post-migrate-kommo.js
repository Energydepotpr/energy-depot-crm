/**
 * Post-migración Kommo → CRM
 * 1. Asigna pipeline/stage a leads sin pipeline
 * 2. Actualiza nombres de contactos y leads desde el Excel
 * 3. Actualiza etapas según Kommo
 * 4. Actualiza campos de viaje (hotel, check-in, check-out, personas, etc.)
 * 5. Actualiza etiquetas
 *
 * Uso: node post-migrate-kommo.js
 */

require('dotenv').config();
const XLSX = require('xlsx');
const { Pool } = require('pg');

const EXCEL_FILE = 'C:/Users/Steven/Downloads/kommo_export_leads_2026-04-13.xlsx';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Mapeo de stages Kommo → stage_id en CRM ──────────────────────────────────
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
  // Sin match directo → OTROS
  'operations':       29,
  'reviews a revisar':29,
  'PENDIENTE':        29,
  'VENDORS':          29,
  "'-4":              29,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  if (!phone) return null;
  const d = phone.toString().replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-10) : null;
}

// Convierte "DD.MM.YYYY" → "YYYY-MM-DD" para SQL
function parseKommoDate(val) {
  if (!val) return null;
  const s = val.toString().trim();
  // DD.MM.YYYY
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // YYYY-MM-DD (ya en formato SQL)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}

function isPhoneLikeName(name) {
  if (!name) return true;
  // Si el nombre es solo dígitos/+/- o empieza con + es un teléfono
  return /^[\d\s\+\-\(\)]{7,}$/.test(name.toString().trim());
}

// ── PASO 1: Asignar pipeline a leads huérfanos ────────────────────────────────

async function fixLeadsSinPipeline() {
  console.log('\n══════════════════════════════════════════');
  console.log('PASO 1: Leads sin pipeline → pipeline 3 / stage 19');
  console.log('══════════════════════════════════════════');

  const r = await pool.query(`
    UPDATE leads
    SET pipeline_id = 3, stage_id = 19
    WHERE pipeline_id IS NULL
    RETURNING id
  `);
  console.log(`✅ ${r.rowCount} leads actualizados a pipeline 3 / stage 19`);
}

// ── PASO 2: Actualizar desde Excel ───────────────────────────────────────────

async function updateFromExcel() {
  console.log('\n══════════════════════════════════════════');
  console.log('PASO 2: Actualizar nombres, stages y campos desde Excel');
  console.log('══════════════════════════════════════════');

  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`${rows.length} filas en el Excel`);

  let updated = 0, skipped = 0, notFound = 0;

  for (const row of rows) {
    try {
      // ── Buscar lead por teléfono ──
      const phones = [
        row['Teléfono celular (contacto)'],
        row['Teléfono oficina (contacto)'],
        row['Teléfono oficina directo (contacto)'],
        row['Otro teléfono (contacto)'],
        row['Teléfono de casa (contacto)'],
      ].filter(Boolean).map(p => normalizePhone(p.toString())).filter(Boolean);

      let leadId = null;
      let contactId = null;

      for (const d10 of phones) {
        const r = await pool.query(
          `SELECT l.id, l.contact_id
           FROM leads l
           JOIN contacts c ON c.id = l.contact_id
           WHERE RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10) = $1
           ORDER BY l.updated_at DESC LIMIT 1`,
          [d10]
        );
        if (r.rows.length) {
          leadId    = r.rows[0].id;
          contactId = r.rows[0].contact_id;
          break;
        }
      }

      // Si no encontró por teléfono, intentar por nombre
      if (!leadId && row['Nombre del lead'] && row['Nombre del lead'].toString().trim()) {
        const nombre = row['Nombre del lead'].toString().trim();
        const r = await pool.query(
          `SELECT id, contact_id FROM leads
           WHERE title ILIKE $1
           ORDER BY updated_at DESC LIMIT 1`,
          [`%${nombre}%`]
        );
        if (r.rows.length) {
          leadId    = r.rows[0].id;
          contactId = r.rows[0].contact_id;
        }
      }

      if (!leadId) { notFound++; continue; }

      // ── Nombre del contacto ──
      const nombreContacto = (row['Contacto principal'] || row['Nombre del lead'] || '').toString().trim();
      if (nombreContacto && !isPhoneLikeName(nombreContacto) && contactId) {
        await pool.query(
          `UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2 AND (name IS NULL OR name ~ '^[\\d\\s\\+\\-\\(\\)]{7,}$')`,
          [nombreContacto, contactId]
        );
        // También actualizar email si existe
        const email = (row['Correo (contacto)'] || row['E-mail priv. (contacto)'] || '').toString().trim();
        if (email && email.includes('@')) {
          await pool.query(
            `UPDATE contacts SET email = $1 WHERE id = $2 AND (email IS NULL OR email = '')`,
            [email, contactId]
          );
        }
      }

      // ── Título del lead ──
      const nombreLead = (row['Nombre del lead'] || '').toString().trim();
      if (nombreLead && !isPhoneLikeName(nombreLead)) {
        await pool.query(
          `UPDATE leads SET title = $1 WHERE id = $2 AND title ILIKE 'Conversación con%'`,
          [nombreLead, leadId]
        );
      }

      // ── Stage según Kommo ──
      const kommoStage = (row['Estatus del lead'] || '').toString().trim();
      const stageId = STAGE_MAP[kommoStage];
      if (stageId) {
        await pool.query(
          `UPDATE leads SET stage_id = $1, pipeline_id = 3 WHERE id = $2`,
          [stageId, leadId]
        );
      }

      // ── Campos de viaje ──
      const checkIn  = parseKommoDate(row['Check In - DATE']);
      const checkOut = parseKommoDate(row['Check Out - Date.']);
      const hotel    = (row['Hotel - Airbnb'] || '').toString().trim() || null;
      const host     = (row['Host'] || '').toString().trim() || null;
      const personas = parseInt(row['People']) || null;
      const ninos    = row['Niños'] ? ['si','yes','true','1'].includes(row['Niños'].toString().toLowerCase()) : null;
      const edades   = (row['Edades Niños'] || row['Edades seniors'] || '').toString().trim() || null;

      const updates = [];
      const vals    = [];
      let   idx     = 1;

      if (checkIn)  { updates.push(`check_in = $${idx++}`);           vals.push(checkIn); }
      if (checkOut) { updates.push(`check_out = $${idx++}`);          vals.push(checkOut); }
      if (hotel)    { updates.push(`hotel_airbnb = $${idx++}`);       vals.push(hotel); }
      if (host)     { updates.push(`host_nombre = $${idx++}`);        vals.push(host); }
      if (personas) { updates.push(`cantidad_personas = $${idx++}`);  vals.push(personas); }
      if (ninos !== null) { updates.push(`ninos = $${idx++}`);        vals.push(ninos); }
      if (edades)   { updates.push(`edades = $${idx++}`);             vals.push(edades); }

      if (updates.length) {
        vals.push(leadId);
        await pool.query(
          `UPDATE leads SET ${updates.join(', ')} WHERE id = $${idx}`,
          vals
        );
      }

      // ── Etiquetas ──
      const tags = (row['Etiquetas del lead'] || '').toString().trim();
      if (tags) {
        const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
        for (const tag of tagList) {
          await pool.query(
            `INSERT INTO lead_tags (lead_id, tag) VALUES ($1, $2) ON CONFLICT (lead_id, tag) DO NOTHING`,
            [leadId, tag.substring(0, 50)]
          );
        }
      }

      updated++;
      if (updated % 50 === 0) console.log(`  ... ${updated} leads actualizados`);

    } catch (e) {
      console.error(`  [ERR] fila ${row['ID']}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n✅ Actualizados: ${updated} | No encontrados: ${notFound} | Errores: ${skipped}`);
}

// ── PASO 3: Resumen final ─────────────────────────────────────────────────────

async function resumenFinal() {
  console.log('\n══════════════════════════════════════════');
  console.log('RESUMEN FINAL');
  console.log('══════════════════════════════════════════');

  const [leads, sinPipeline, porStage, contactsConNombre] = await Promise.all([
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
    pool.query(`SELECT COUNT(*) FROM contacts WHERE name NOT ~ '^[\\d\\s\\+\\-\\(\\)]{7,}$' AND name IS NOT NULL`),
  ]);

  console.log('Leads totales:', leads.rows[0].count);
  console.log('Leads sin pipeline:', sinPipeline.rows[0].count);
  console.log('Contactos con nombre real:', contactsConNombre.rows[0].count);
  console.log('\nLeads por stage (pipeline 3):');
  porStage.rows.forEach(r => console.log(`  ${r.total.toString().padStart(4)} ${r.name}`));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Post-migración Kommo → CRM');
  console.log(`   Excel: ${EXCEL_FILE}`);
  try {
    await fixLeadsSinPipeline();
    await updateFromExcel();
    await resumenFinal();
    console.log('\n🎉 Post-migración completada');
  } catch (e) {
    console.error('\n❌ Error fatal:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
}

main();
