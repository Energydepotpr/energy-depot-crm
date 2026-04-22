/**
 * Migración completa Kommo → CRM propio
 * 1. Importa TODOS los mensajes SMS históricos desde Twilio
 * 2. Importa notas del Excel de Kommo (Nota 1-5, Note Gigi, Notas Llamada)
 *
 * Uso: node migrate-kommo-full.js
 */

require('dotenv').config();
const XLSX   = require('xlsx');
const twilio = require('twilio');
const { Pool } = require('pg');

const EXCEL_FILE     = 'C:/Users/alexa/Downloads/kommo_export_leads_2026-04-13.xlsx';
const OWN_NUMBER     = '+17874880202';
const OWN_DIGITS     = OWN_NUMBER.replace(/\D/g, '').slice(-10);
const ACCOUNT_SID    = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN     = process.env.TWILIO_AUTH_TOKEN;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  if (!phone) return null;
  const d = phone.toString().replace(/\D/g, '');
  return d.length >= 7 ? d : null;
}

function last10(phone) {
  const d = normalizePhone(phone);
  return d ? d.slice(-10) : null;
}

function isOwnNumber(phone) {
  const d = last10(phone);
  return d === OWN_DIGITS;
}

function getCustomerPhone(msg) {
  // Para inbound: from = cliente, to = nosotros
  // Para outbound: from = nosotros, to = cliente
  const dir = msg.direction || '';
  if (dir.startsWith('inbound')) return msg.from;
  return msg.to;
}

// ── Buscar o crear contacto por teléfono ──────────────────────────────────────

async function findOrCreateContact(phone) {
  const d10 = last10(phone);
  if (!d10) return null;

  // Buscar por últimos 10 dígitos
  const existing = await pool.query(
    `SELECT id FROM contacts
     WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $1
     ORDER BY id ASC LIMIT 1`,
    [d10]
  );
  if (existing.rows.length) return existing.rows[0].id;

  // Crear nuevo contacto
  const r = await pool.query(
    `INSERT INTO contacts (name, phone, source, created_at, updated_at)
     VALUES ($1, $2, 'sms', NOW(), NOW()) RETURNING id`,
    [phone, phone]
  );
  console.log(`  [+] Contacto creado: ${phone}`);
  return r.rows[0].id;
}

// ── Buscar o crear lead para un contacto ──────────────────────────────────────

async function findOrCreateLead(contactId, phone) {
  const existing = await pool.query(
    `SELECT id FROM leads WHERE contact_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [contactId]
  );
  if (existing.rows.length) return existing.rows[0].id;

  // Crear lead nuevo en pipeline 3 "Kommo - Fix A Trip PR", etapa 19 "Leads Entrantes"
  const r = await pool.query(
    `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, created_at, updated_at)
     VALUES ($1, $2, 3, 19, NOW(), NOW()) RETURNING id`,
    [`Conversación con ${phone}`, contactId]
  );
  console.log(`  [+] Lead creado: Conversación con ${phone}`);
  return r.rows[0].id;
}

// ── PARTE 1: Importar mensajes SMS desde Twilio ───────────────────────────────

async function importTwilioMessages() {
  console.log('\n══════════════════════════════════════════');
  console.log('PARTE 1: Mensajes SMS desde Twilio');
  console.log('══════════════════════════════════════════');

  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    console.log('⚠ Twilio no configurado, saltando...');
    return;
  }

  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

  console.log('Descargando mensajes inbound...');
  const inbound  = await client.messages.list({ to: OWN_NUMBER, limit: 10000 });
  console.log(`  ${inbound.length} mensajes inbound`);

  console.log('Descargando mensajes outbound...');
  const outbound = await client.messages.list({ from: OWN_NUMBER, limit: 10000 });
  console.log(`  ${outbound.length} mensajes outbound`);

  const all = [...inbound, ...outbound];
  // Ordenar por fecha ascendente
  all.sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));

  let imported = 0, skipped = 0, errors = 0;

  for (const msg of all) {
    try {
      // Skip si ya existe por twilio_sid
      const exists = await pool.query(
        'SELECT id FROM messages WHERE twilio_sid = $1',
        [msg.sid]
      );
      if (exists.rows.length) { skipped++; continue; }

      // Skip mensajes vacíos
      if (!msg.body || msg.body.trim() === '') { skipped++; continue; }

      const customerPhone = getCustomerPhone(msg);
      if (!customerPhone || isOwnNumber(customerPhone)) { skipped++; continue; }

      const contactId = await findOrCreateContact(customerPhone);
      if (!contactId) { skipped++; continue; }

      const leadId = await findOrCreateLead(contactId, customerPhone);
      if (!leadId) { skipped++; continue; }

      const direction = (msg.direction || '').startsWith('inbound') ? 'inbound' : 'outbound';

      await pool.query(
        `INSERT INTO messages (lead_id, contact_id, direction, text, twilio_sid, channel, created_at)
         VALUES ($1, $2, $3, $4, $5, 'sms', $6)`,
        [leadId, contactId, direction, msg.body, msg.sid, msg.dateCreated]
      );
      imported++;

      if (imported % 100 === 0) console.log(`  ... ${imported} mensajes importados`);

    } catch (e) {
      errors++;
      if (errors <= 5) console.error(`  [ERR] ${msg.sid}: ${e.message}`);
    }
  }

  console.log(`\n✅ Mensajes: ${imported} importados, ${skipped} saltados, ${errors} errores`);
}

// ── PARTE 2: Importar notas desde Excel ──────────────────────────────────────

async function importExcelNotes() {
  console.log('\n══════════════════════════════════════════');
  console.log('PARTE 2: Notas desde Excel de Kommo');
  console.log('══════════════════════════════════════════');

  const wb   = XLSX.readFile(EXCEL_FILE);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`${rows.length} filas en el Excel`);

  const NOTE_COLS = ['Notas Llamada', 'Note Gigi', 'Nota 1', 'Nota 2', 'Nota 3', 'Nota 4', 'Nota 5'];

  let imported = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    try {
      // Buscar el lead en el CRM
      // Primero intentar por teléfono del contacto
      const phones = [
        row['Teléfono celular (contacto)'],
        row['Teléfono oficina (contacto)'],
        row['Otro teléfono (contacto)'],
        row['Teléfono oficina directo (contacto)'],
      ].filter(Boolean);

      let leadId = null;

      // Buscar por teléfono
      for (const phone of phones) {
        const d10 = last10(phone.toString());
        if (!d10) continue;
        const r = await pool.query(
          `SELECT l.id FROM leads l
           JOIN contacts c ON c.id = l.contact_id
           WHERE RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 10) = $1
           ORDER BY l.updated_at DESC LIMIT 1`,
          [d10]
        );
        if (r.rows.length) { leadId = r.rows[0].id; break; }
      }

      // Si no encontró por teléfono, buscar por título/nombre
      if (!leadId && row['Nombre del lead']) {
        const r = await pool.query(
          `SELECT id FROM leads WHERE title ILIKE $1 ORDER BY updated_at DESC LIMIT 1`,
          [`%${row['Nombre del lead'].trim()}%`]
        );
        if (r.rows.length) leadId = r.rows[0].id;
      }

      // Si no encontró, buscar por Kommo ID en el título
      if (!leadId && row['ID']) {
        const r = await pool.query(
          `SELECT id FROM leads WHERE title ILIKE $1 ORDER BY id ASC LIMIT 1`,
          [`%#${row['ID']}%`]
        );
        if (r.rows.length) leadId = r.rows[0].id;
      }

      if (!leadId) { skipped++; continue; }

      // Importar cada columna de nota que tenga contenido
      for (const col of NOTE_COLS) {
        const texto = row[col];
        if (!texto || texto.toString().trim() === '') continue;

        // Skip si ya existe una nota igual en este lead
        const dupCheck = await pool.query(
          `SELECT id FROM lead_notes WHERE lead_id = $1 AND text = $2 LIMIT 1`,
          [leadId, texto.toString().trim()]
        );
        if (dupCheck.rows.length) continue;

        await pool.query(
          `INSERT INTO lead_notes (lead_id, text, created_at)
           VALUES ($1, $2, NOW())`,
          [leadId, `[${col}] ${texto.toString().trim()}`]
        );
        imported++;
      }

    } catch (e) {
      errors++;
      if (errors <= 5) console.error(`  [ERR] fila ${row['ID']}: ${e.message}`);
    }
  }

  console.log(`\n✅ Notas: ${imported} importadas, ${skipped} leads no encontrados, ${errors} errores`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando migración Kommo → CRM');
  console.log(`   Número Twilio: ${OWN_NUMBER}`);
  console.log(`   Excel: ${EXCEL_FILE}`);

  try {
    await importTwilioMessages();
    await importExcelNotes();
    console.log('\n🎉 Migración completada');
  } catch (e) {
    console.error('\n❌ Error fatal:', e.message);
  } finally {
    await pool.end();
  }
}

main();
