/**
 * Import IGMS reservations CSV → CRM leads
 * Usage: node import-igms.js
 */
const fs   = require('fs');
const path = require('path');

const CSV_FILE   = 'C:/Users/alexa/Downloads/igms_reservations__2026_03_26.csv';
const API_BASE   = 'https://crm-ia-production-c247.up.railway.app';
const ADMIN_EMAIL = 'admin@crm.com';
const ADMIN_PASS  = 'stuar2525';

// ── helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const { default: fetch } = await import('node-fetch');
  const { headers: extraHeaders, ...restOpts } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...restOpts,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${path}: ${txt}`);
  }
  return res.json();
}

function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, '');
  if (p.length === 10) p = '1' + p;
  return '+' + p;
}

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = [];
    let inQuote = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔐 Logging in...');
  const auth = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const token = auth.token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('✅ Logged in\n');

  // Fetch existing contacts (phone → id map) to detect duplicates
  console.log('📋 Loading existing contacts...');
  const existingContacts = await apiFetch('/api/contacts?limit=9999', { headers });
  const phoneMap = {};
  const contactsList = existingContacts?.contacts || existingContacts?.data || existingContacts || [];
  contactsList.forEach(c => {
    if (c.phone) phoneMap[normalizePhone(c.phone)] = c.id;
  });
  console.log(`   ${contactsList.length} contacts loaded\n`);

  // Fetch existing leads (contact_id → lead) to detect duplicates
  console.log('📋 Loading existing leads...');
  const existingLeads = await apiFetch('/api/leads?limit=9999', { headers });
  const leadsByContact = {};
  const leadsList = existingLeads?.leads || existingLeads?.data || existingLeads || [];
  leadsList.forEach(l => {
    if (l.contact_id) leadsByContact[l.contact_id] = l;
  });
  console.log(`   ${Object.keys(leadsByContact).length} leads loaded\n`);

  const csv = fs.readFileSync(CSV_FILE, 'utf-8');
  const rows = parseCSV(csv);
  console.log(`📁 ${rows.length} reservations in CSV\n`);

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const platform    = (row['Plataforma'] || 'igms').toLowerCase();
    const guestName   = row['Nombre del huésped']?.trim();
    const rawPhone    = row['Número de Teléfono'];
    const property    = row['Nombre de la propiedad']?.trim();
    const checkIn     = row['Fecha de llegada'];
    const checkOut    = row['Fecha de salida'];
    const guests      = row['Invitados'];
    const total       = parseFloat(row['Pago Total Esperado'] || '0') || 0;
    const resCode     = row['Código de Reserva'];

    if (!guestName) { skipped++; continue; }

    const phone = normalizePhone(rawPhone);
    const leadTitle = `${platform.charAt(0).toUpperCase() + platform.slice(1)} — ${property}: ${guestName}`;

    try {
      let contactId = phone ? phoneMap[phone] : null;

      // Create contact if not exists
      if (!contactId) {
        const newContact = await apiFetch('/api/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: guestName, phone, source: platform }),
        });
        contactId = newContact.id;
        if (phone) phoneMap[phone] = contactId;
      }

      // Check if lead already exists for this contact
      const existingLead = leadsByContact[contactId];
      let leadId;

      if (existingLead) {
        // Update title and source if needed
        await apiFetch(`/api/leads/${existingLead.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ title: leadTitle, source: platform }),
        });
        leadId = existingLead.id;
        updated++;
      } else {
        // Create new lead
        const newLead = await apiFetch('/api/leads', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: leadTitle, contact_id: contactId, value: total, source: platform }),
        });
        leadId = newLead.id;
        leadsByContact[contactId] = newLead;
        created++;
      }

      // Save trip info (check_in, check_out, property, guests)
      await apiFetch(`/api/leads/${leadId}/trip`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          hotel_airbnb: property,
          check_in: checkIn || null,
          check_out: checkOut || null,
          cantidad_personas: guests ? parseInt(guests) : null,
          notas_especiales: resCode ? `Código de reserva: ${resCode}` : null,
        }),
      });

      const action = existingLead ? 'UPDATED' : 'CREATED';
      console.log(`[${i+1}/${rows.length}] ${action}: ${leadTitle}`);

    } catch (e) {
      console.error(`[${i+1}/${rows.length}] ERROR ${guestName}: ${e.message}`);
      errors++;
    }

    // Small delay to avoid overwhelming Railway
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✅ Done!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
