const { pool } = require('../services/db');

// POST /api/contacts/import  — body: { rows: [{name,phone,email,company}] }
async function importarContactos(req, res) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows requerido' });
    if (rows.length > 1000) return res.status(400).json({ error: 'Máximo 1000 filas por importación' });

    let creados = 0, omitidos = 0;
    for (const r of rows) {
      if (!r.name?.trim()) { omitidos++; continue; }
      await pool.query(
        `INSERT INTO contacts (name, phone, email, company)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [r.name.trim(), r.phone?.trim() || null, r.email?.trim() || null, r.company?.trim() || null]
      );
      creados++;
    }
    res.json({ ok: true, creados, omitidos });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/contacts/export
async function exportarContactos(req, res) {
  try {
    const result = await pool.query(
      `SELECT c.name, c.phone, c.email, c.company, c.notes,
         (SELECT COUNT(*) FROM leads l WHERE l.contact_id = c.id) AS leads_count,
         TO_CHAR(c.created_at, 'YYYY-MM-DD') AS creado_en
       FROM contacts c ORDER BY c.name`
    );

    const headers = ['Nombre','Teléfono','Email','Empresa','Notas','Leads','Creado'];
    const csv = [
      headers.join(','),
      ...result.rows.map(r =>
        [r.name, r.phone, r.email, r.company, r.notes, r.leads_count, r.creado_en]
          .map(v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contactos.csv"');
    res.send('\uFEFF' + csv); // BOM para Excel
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// GET /api/leads/export
async function exportarLeads(req, res) {
  try {
    const result = await pool.query(
      `SELECT l.title, l.value,
         c.name AS contacto, c.phone AS telefono,
         p.name AS pipeline,
         ps.name AS etapa,
         u.name AS asignado,
         TO_CHAR(l.created_at, 'YYYY-MM-DD') AS creado_en,
         TO_CHAR(l.updated_at, 'YYYY-MM-DD') AS actualizado
       FROM leads l
       LEFT JOIN contacts c ON c.id = l.contact_id
       LEFT JOIN pipelines p ON p.id = l.pipeline_id
       LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
       LEFT JOIN users u ON u.id = l.assigned_to
       ORDER BY l.updated_at DESC`
    );

    const headers = ['Lead','Valor','Contacto','Teléfono','Pipeline','Etapa','Asignado','Creado','Actualizado'];
    const csv = [
      headers.join(','),
      ...result.rows.map(r =>
        [r.title, r.value, r.contacto, r.telefono, r.pipeline, r.etapa, r.asignado, r.creado_en, r.actualizado]
          .map(v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { importarContactos, exportarContactos, exportarLeads };
