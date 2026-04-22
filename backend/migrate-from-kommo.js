/**
 * Migración: crm-ai-bot (Kommo) → crm-propio
 * Uso: OLD_DB="postgres://..." NEW_DB="postgres://..." node migrate-from-kommo.js
 */

try { require('dotenv').config(); } catch {}
const { Pool } = require('pg');

const OLD_DB = process.env.OLD_DB;
const NEW_DB = process.env.NEW_DB;

if (!OLD_DB || !NEW_DB) {
  console.error('\nFaltan variables:\n  OLD_DB="..." NEW_DB="..." node migrate-from-kommo.js\n');
  process.exit(1);
}

const oldPool = new Pool({ connectionString: OLD_DB, ssl: { rejectUnauthorized: false } });
const newPool = new Pool({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });

async function run() {
  const oldClient = await oldPool.connect();
  const newClient = await newPool.connect();

  try {
    console.log('\n━━━ MIGRACIÓN KOMMO → CRM ━━━\n');

    // ─── 1. Pipeline/etapa por defecto ───────────────────────────────────────
    const stageRow = await newClient.query(
      `SELECT ps.id, ps.name, ps.pipeline_id FROM pipeline_stages ps
       JOIN pipelines p ON p.id = ps.pipeline_id
       ORDER BY p.position, ps.position LIMIT 1`
    );
    const defaultStageId    = stageRow.rows[0]?.id ?? null;
    const defaultPipelineId = stageRow.rows[0]?.pipeline_id ?? null;
    console.log(`Pipeline por defecto: id=${defaultPipelineId} | Etapa: ${stageRow.rows[0]?.name} (id=${defaultStageId})`);

    let contactsCreados = 0, leadsCreados = 0, mensajesCreados = 0;

    // ─── 2. Leer leads del bot viejo (pueden ser 0) ──────────────────────────
    const { rows: oldLeads } = await oldClient.query(
      `SELECT id, nombre, contacto_nombre, contacto_email, contacto_telefono, creado_en FROM leads ORDER BY id ASC`
    );
    console.log(`\nLeads en tabla leads (Kommo DB): ${oldLeads.length}`);

    const leadMap = {};

    for (const ol of oldLeads) {
      const nombre   = ol.contacto_nombre || ol.nombre || 'Sin nombre';
      const telefono = ol.contacto_telefono || null;
      const email    = ol.contacto_email || null;

      let contactId;
      const cSearch = telefono
        ? await newClient.query(`SELECT id FROM contacts WHERE phone=$1 LIMIT 1`, [telefono])
        : await newClient.query(`SELECT id FROM contacts WHERE name=$1 LIMIT 1`, [nombre]);

      if (cSearch.rows.length > 0) {
        contactId = cSearch.rows[0].id;
      } else {
        const ins = await newClient.query(
          `INSERT INTO contacts (name, phone, email, created_at, updated_at) VALUES ($1,$2,$3,$4,$4) RETURNING id`,
          [nombre, telefono, email, ol.creado_en || new Date()]
        );
        contactId = ins.rows[0].id;
        contactsCreados++;
      }

      const lSearch = await newClient.query(
        `SELECT id FROM leads WHERE contact_id=$1 LIMIT 1`, [contactId]
      );
      let newLeadId;
      if (lSearch.rows.length > 0) {
        newLeadId = lSearch.rows[0].id;
      } else {
        const ins = await newClient.query(
          `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
          [ol.nombre || nombre, contactId, defaultPipelineId, defaultStageId, ol.creado_en || new Date()]
        );
        newLeadId = ins.rows[0].id;
        leadsCreados++;
      }
      leadMap[ol.id] = { newLeadId, contactId };
    }

    // ─── 3. Mensajes via tabla mensajes+conversaciones ───────────────────────
    const { rows: oldMsgs } = await oldClient.query(`
      SELECT m.contenido, m.rol, m.creado_en, l.id AS old_lead_id
      FROM mensajes m
      JOIN conversaciones c ON c.id = m.conversacion_id
      JOIN leads l ON l.id = c.lead_id
      WHERE m.rol IN ('cliente', 'asistente')
      ORDER BY m.creado_en ASC
    `);
    console.log(`Mensajes (tabla mensajes): ${oldMsgs.length}`);

    for (const m of oldMsgs) {
      const mapped = leadMap[m.old_lead_id];
      if (!mapped) continue;
      const direction = m.rol === 'cliente' ? 'inbound' : 'outbound';
      const exists = await newClient.query(
        `SELECT id FROM messages WHERE lead_id=$1 AND text=$2 AND created_at=$3 LIMIT 1`,
        [mapped.newLeadId, m.contenido, m.creado_en]
      );
      if (exists.rows.length > 0) continue;
      await newClient.query(
        `INSERT INTO messages (lead_id, contact_id, direction, text, is_bot, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [mapped.newLeadId, mapped.contactId, direction, m.contenido, m.rol === 'asistente', m.creado_en]
      );
      mensajesCreados++;
    }

    // ─── 4. Tabla conversations (pares cliente/bot sin leads locales) ────────
    const { rows: oldConvs } = await oldClient.query(`
      SELECT contact_name, contact_phone, mensaje_cliente, respuesta_bot, timestamp
      FROM conversations ORDER BY timestamp ASC
    `);
    console.log(`Mensajes (tabla conversations): ${oldConvs.length}`);

    // Cache teléfono/nombre → { contactId, newLeadId }
    const phoneMap = {};

    for (const cv of oldConvs) {
      const phone  = cv.contact_phone?.trim() || null;
      const nombre = cv.contact_name?.trim()  || phone || 'Sin nombre';
      const key    = phone || nombre;

      if (!phoneMap[key]) {
        // Buscar o crear contacto
        let contactId;
        const cSearch = phone
          ? await newClient.query(`SELECT id FROM contacts WHERE phone=$1 LIMIT 1`, [phone])
          : await newClient.query(`SELECT id FROM contacts WHERE name=$1 LIMIT 1`, [nombre]);

        if (cSearch.rows.length > 0) {
          contactId = cSearch.rows[0].id;
        } else {
          const ins = await newClient.query(
            `INSERT INTO contacts (name, phone, created_at, updated_at) VALUES ($1,$2,$3,$3) RETURNING id`,
            [nombre, phone, cv.timestamp || new Date()]
          );
          contactId = ins.rows[0].id;
          contactsCreados++;
        }

        // Buscar o crear lead
        const lSearch = await newClient.query(
          `SELECT id FROM leads WHERE contact_id=$1 ORDER BY created_at ASC LIMIT 1`, [contactId]
        );
        let newLeadId;
        if (lSearch.rows.length > 0) {
          newLeadId = lSearch.rows[0].id;
        } else {
          const ins = await newClient.query(
            `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
            [nombre, contactId, defaultPipelineId, defaultStageId, cv.timestamp || new Date()]
          );
          newLeadId = ins.rows[0].id;
          leadsCreados++;
        }

        phoneMap[key] = { contactId, newLeadId };
      }

      const { contactId, newLeadId } = phoneMap[key];

      // Insertar mensaje del cliente
      if (cv.mensaje_cliente) {
        const exists = await newClient.query(
          `SELECT id FROM messages WHERE lead_id=$1 AND text=$2
           AND ABS(EXTRACT(EPOCH FROM (created_at - $3::timestamp))) < 10 LIMIT 1`,
          [newLeadId, cv.mensaje_cliente, cv.timestamp]
        );
        if (exists.rows.length === 0) {
          await newClient.query(
            `INSERT INTO messages (lead_id, contact_id, direction, text, is_bot, created_at)
             VALUES ($1,$2,'inbound',$3,false,$4)`,
            [newLeadId, contactId, cv.mensaje_cliente, cv.timestamp]
          );
          mensajesCreados++;
        }
      }

      // Insertar respuesta del bot
      if (cv.respuesta_bot) {
        const ts = new Date(cv.timestamp);
        ts.setSeconds(ts.getSeconds() + 1);
        const exists = await newClient.query(
          `SELECT id FROM messages WHERE lead_id=$1 AND text=$2
           AND ABS(EXTRACT(EPOCH FROM (created_at - $3::timestamp))) < 10 LIMIT 1`,
          [newLeadId, cv.respuesta_bot, ts]
        );
        if (exists.rows.length === 0) {
          await newClient.query(
            `INSERT INTO messages (lead_id, contact_id, direction, text, is_bot, created_at)
             VALUES ($1,$2,'outbound',$3,true,$4)`,
            [newLeadId, contactId, cv.respuesta_bot, ts]
          );
          mensajesCreados++;
        }
      }
    }

    // ─── 5. Prompt viejo ─────────────────────────────────────────────────────
    const { rows: promptRows } = await oldClient.query(
      `SELECT valor FROM configuracion WHERE clave='prompt_sistema' LIMIT 1`
    );
    if (promptRows.length > 0 && promptRows[0].valor) {
      await newClient.query(
        `INSERT INTO config (key, value, updated_at) VALUES ('prompt_sistema_kommo',$1,NOW())
         ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
        [promptRows[0].valor]
      );
      console.log('\nPrompt del bot viejo guardado como "prompt_sistema_kommo" en config.');
    }

    console.log('\n━━━ MIGRACIÓN COMPLETA ━━━\n');
    console.log(`  Contactos creados : ${contactsCreados}`);
    console.log(`  Leads creados     : ${leadsCreados}`);
    console.log(`  Mensajes creados  : ${mensajesCreados}`);
    console.log('');

  } finally {
    oldClient.release();
    newClient.release();
    await oldPool.end();
    await newPool.end();
  }
}

run().catch(err => {
  console.error('\n[ERROR]', err.message);
  process.exit(1);
});
