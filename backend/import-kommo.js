/**
 * Import Kommo leads XLSX → CRM
 * node import-kommo.js
 */
const xlsx = require('xlsx');

const XLSX_FILE  = 'C:/Users/alexa/Downloads/kommo_export_leads_2026-03-26.xlsx';
const API_BASE   = 'https://crm-ia-production-c247.up.railway.app';
const ADMIN_EMAIL = 'admin@crm.com';
const ADMIN_PASS  = 'stuar2525';

async function apiFetch(path, opts = {}) {
  const { default: fetch } = await import('node-fetch');
  const { headers: extraHeaders, ...restOpts } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...restOpts,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${path}: ${txt.slice(0,200)}`);
  }
  return res.json();
}

function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('1') && p.length === 11) return '+' + p;
  if (p.length === 10) return '+1' + p;
  if (p.length > 10) return '+' + p;
  return null;
}

async function main() {
  console.log('🔐 Logging in...');
  const auth = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const token = auth.token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('✅ Logged in\n');

  // ── Read XLSX ──────────────────────────────────────────────────────────────
  const wb   = xlsx.readFile(XLSX_FILE);
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`📁 ${data.length} leads in Kommo export\n`);

  // ── Load existing contacts (phone → id) ────────────────────────────────────
  console.log('📋 Loading existing contacts...');
  let allContacts = [];
  let page = 1;
  while (true) {
    const r = await apiFetch(`/api/contacts?limit=1000&offset=${(page-1)*1000}`, { headers });
    const batch = r?.contacts || r?.data || r || [];
    allContacts = [...allContacts, ...batch];
    if (batch.length < 1000) break;
    page++;
  }
  const phoneMap = {};  // normalized phone → contact id
  allContacts.forEach(c => {
    const p = normalizePhone(c.phone);
    if (p) phoneMap[p] = c.id;
  });
  console.log(`   ${allContacts.length} contacts loaded\n`);

  // ── Load existing leads (contact_id → lead) ────────────────────────────────
  console.log('📋 Loading existing leads...');
  let allLeads = [];
  page = 1;
  while (true) {
    const r = await apiFetch(`/api/leads?limit=1000&offset=${(page-1)*1000}`, { headers });
    const batch = r?.leads || r?.data || r || [];
    allLeads = [...allLeads, ...batch];
    if (batch.length < 1000) break;
    page++;
  }
  const leadByContact = {};
  allLeads.forEach(l => { if (l.contact_id) leadByContact[l.contact_id] = l; });
  console.log(`   ${allLeads.length} leads loaded\n`);

  // ── Find or create Kommo pipeline ─────────────────────────────────────────
  console.log('🔧 Finding/creating Kommo pipeline...');
  const allPipelines = await apiFetch('/api/pipelines', { headers });
  let existing = allPipelines.find(p => p.name === 'Kommo - Fix A Trip PR');
  let pipelineId, existingStages = [];
  if (existing) {
    pipelineId = existing.id;
    existingStages = existing.stages || [];
    console.log(`   Found existing pipeline: id=${pipelineId}\n`);
  } else {
    const pip = await apiFetch('/api/pipelines', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Kommo - Fix A Trip PR' }),
    });
    pipelineId = pip.id;
    console.log(`   Pipeline created: id=${pipelineId}\n`);
  }

  // Unique stages in order of appearance
  const stageOrder = [
    'QUICK ADD',
    'Leads Entrantes',
    'FORMS',
    'AIRBNB WELCOME EMAIL',
    'AIRBNB PENDING CALL',
    'AWAITING RESPONSE / FOLLOW-UP (4+)',
    'POST CALL - FOLLOW UP',
    'IN PROGRESS (AWAITING PAYMENT)',
    'FAREHARBOR BOOKINGS',
    'PAID - READY TO OPERATIONS',
    'URGENT ARRIVAL 30 DAYS',
    'OTROS',
  ];
  const stageColors = {
    'QUICK ADD':                          '#6366f1',
    'Leads Entrantes':                    '#8b5cf6',
    'FORMS':                              '#3b82f6',
    'AIRBNB WELCOME EMAIL':               '#06b6d4',
    'AIRBNB PENDING CALL':                '#f59e0b',
    'AWAITING RESPONSE / FOLLOW-UP (4+)': '#ef4444',
    'POST CALL - FOLLOW UP':              '#f97316',
    'IN PROGRESS (AWAITING PAYMENT)':     '#10b981',
    'FAREHARBOR BOOKINGS':                '#14b8a6',
    'PAID - READY TO OPERATIONS':         '#22c55e',
    'URGENT ARRIVAL 30 DAYS':             '#dc2626',
    'OTROS':                              '#9ca3af',
  };

  const stageMap = {}; // stage name → id
  // Use existing stages if pipeline already existed
  existingStages.forEach(s => { stageMap[s.name] = s.id; });
  for (let i = 0; i < stageOrder.length; i++) {
    const name = stageOrder[i];
    if (stageMap[name]) { console.log(`   Stage (existing): ${name} (id=${stageMap[name]})`); continue; }
    const stage = await apiFetch(`/api/pipelines/${pipelineId}/stages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, color: stageColors[name] || '#6b7280', position: i + 1 }),
    });
    stageMap[name] = stage.id;
    console.log(`   Stage: ${name} (id=${stage.id})`);
  }
  console.log('');

  // ── Import leads ───────────────────────────────────────────────────────────
  let created = 0, updated = 0, duplicates = 0, errors = 0;
  const dupLog = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const name    = row['Nombre del lead']?.toString().trim();
    const status  = row['Estatus del lead']?.toString().trim() || 'OTROS';
    const budget  = parseFloat(row['Presupuesto'] || '0') || 0;
    const rawPhone = row['Teléfono oficina (contacto)'] || row['Teléfono de casa (contacto)'] || '';
    const email   = row['Correo (contacto)']?.toString().trim() || null;
    const tags    = row['Etiquetas del lead']?.toString().trim() || null;
    const checkin = row['Check In - DATE']?.toString().trim() || null;
    const property = row['Hotel - Airbnb']?.toString().trim() || row['Note Gigi']?.toString().trim() || null;
    const guests  = row['Number of Passengers']?.toString().trim() || null;
    const kommoId = row['ID'];

    if (!name) continue;

    const phone = normalizePhone(rawPhone);

    // Map stage name (handle corrupted "-4" entries)
    let stageName = status;
    if (status === "'-4" || status === '-4' || !stageMap[status]) stageName = 'OTROS';
    const stageId = stageMap[stageName] || stageMap['OTROS'];

    try {
      // Check duplicate by phone
      let contactId = phone ? phoneMap[phone] : null;
      let isDuplicate = false;

      if (contactId) {
        isDuplicate = true;
        duplicates++;
        dupLog.push(`  [DUP] ${name} — ${phone} (already exists)`);
      } else {
        // Create contact — handle 409 duplicate gracefully
        try {
          const newContact = await apiFetch('/api/contacts', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name, phone, email, source: 'kommo' }),
          });
          contactId = newContact.id;
          if (phone) phoneMap[phone] = contactId;
        } catch (e) {
          // Extract existing contact id from 409 response
          const match = e.message.match(/"id":(\d+)/);
          if (match) {
            contactId = parseInt(match[1]);
            if (phone) phoneMap[phone] = contactId;
            isDuplicate = true;
            duplicates++;
            dupLog.push(`  [DUP] ${name} — ${phone} (existing id=${contactId})`);
          } else {
            throw e;
          }
        }
      }

      // Check if lead exists for this contact
      const existingLead = leadByContact[contactId];
      let leadId;

      if (existingLead && isDuplicate) {
        // Update existing lead with Kommo data
        await apiFetch(`/api/leads/${existingLead.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ pipeline_id: pipelineId, stage_id: stageId, value: budget }),
        });
        leadId = existingLead.id;
        updated++;
      } else {
        const newLead = await apiFetch('/api/leads', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: name,
            contact_id: contactId,
            pipeline_id: pipelineId,
            stage_id: stageId,
            value: budget,
          }),
        });
        leadId = newLead.id;
        leadByContact[contactId] = newLead;
        created++;
      }

      // Save trip info if available
      if (property || checkin || guests) {
        await apiFetch(`/api/leads/${leadId}/trip`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            hotel_airbnb: property || null,
            check_in: checkin || null,
            cantidad_personas: guests ? parseInt(guests) : null,
            notas_especiales: kommoId ? `Kommo ID: ${kommoId}` : null,
          }),
        }).catch(() => {});
      }

      const action = (existingLead && isDuplicate) ? 'UPDATED(dup)' : 'CREATED';
      if ((i+1) % 50 === 0 || isDuplicate) {
        console.log(`[${i+1}/${data.length}] ${action}: ${name}${isDuplicate ? ' ⚠️ DUP' : ''}`);
      }

    } catch (e) {
      console.error(`[${i+1}/${data.length}] ERROR ${name}: ${e.message}`);
      errors++;
    }

    if (i % 10 === 9) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Done!`);
  console.log(`   Created:    ${created}`);
  console.log(`   Updated:    ${updated}`);
  console.log(`   Duplicates: ${duplicates}`);
  console.log(`   Errors:     ${errors}`);

  if (dupLog.length > 0) {
    console.log(`\n⚠️  Duplicates found (${dupLog.length}):`);
    dupLog.forEach(l => console.log(l));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
