'use strict';
/**
 * projectInvoices.js
 * ------------------------------------------------------------------
 * Generación automática de facturas por proyecto a partir del
 * contrato de Energy Depot. Una factura por cada etapa de desembolso
 * (Pronto / Firma / Instalación / Certificación).
 */

const { pool } = require('./db');

async function ensureProjectInvoicesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_invoices (
      id SERIAL PRIMARY KEY,
      lead_id INT NOT NULL,
      contrato_firma_id INT REFERENCES contratos_firma(id) ON DELETE SET NULL,
      numero VARCHAR(40) UNIQUE,
      etapa VARCHAR(80),
      concepto TEXT,
      monto NUMERIC(12,2) NOT NULL,
      porcentaje NUMERIC(5,2),
      fecha_emision DATE DEFAULT CURRENT_DATE,
      fecha_vencimiento DATE,
      status VARCHAR(20) DEFAULT 'pendiente',
      paid_at TIMESTAMP,
      paid_method VARCHAR(40),
      paid_reference VARCHAR(120),
      pdf_base64 TEXT,
      public_token VARCHAR(64),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Soporte de facturas manuales con múltiples líneas + cliente sin lead
  await pool.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS items JSONB`);
  await pool.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS cliente_nombre TEXT`);
  await pool.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS cliente_email TEXT`);
  await pool.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS cliente_telefono TEXT`);
  await pool.query(`ALTER TABLE project_invoices ALTER COLUMN lead_id DROP NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pi_lead     ON project_invoices(lead_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pi_contrato ON project_invoices(contrato_firma_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pi_status   ON project_invoices(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pi_token    ON project_invoices(public_token)`);
}

/**
 * Próximo número consecutivo global del año (ej. ED-INV-2026-00123).
 * Uso un client con BEGIN; SELECT FOR UPDATE no aplica directo a una
 * agregación, así que utilizo advisory lock para serializar.
 */
async function nextInvoiceNumber(client) {
  const year = new Date().getFullYear();
  // Lock global para evitar colisiones cuando dos contratos se generan a la vez
  await client.query(`SELECT pg_advisory_xact_lock(982341)`);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '\\d+$') AS INT)), 0) AS max
       FROM project_invoices
      WHERE numero LIKE $1`,
    [`ED-INV-${year}-%`]
  );
  const next = (Number(rows[0]?.max) || 0) + 1;
  return `ED-INV-${year}-${String(next).padStart(5, '0')}`;
}

/**
 * Construye el desglose de facturas a partir de contrato_data.
 * Devuelve un array de { etapa, concepto, monto, porcentaje }.
 */
function buildBreakdown(cd = {}) {
  const items = [];
  const esEfectivo = cd.modalidad === 'efectivo';
  const pronto = Number(cd.prontoDado || cd.pronto || 0);
  const precioTotal = Number(cd.precioTotal || 0);
  const pcts = Array.isArray(cd.pcts) ? cd.pcts : (esEfectivo ? [50,50] : [45,45,10]);

  if (pronto > 0) {
    items.push({
      etapa: 'Pronto pago',
      concepto: 'Pronto pago acordado al firmar el contrato',
      monto: pronto,
      porcentaje: precioTotal > 0 ? +(pronto * 100 / precioTotal).toFixed(2) : null,
    });
  }

  if (esEfectivo) {
    if (Number(cd.pct45a) > 0) items.push({
      etapa: 'Firma de contrato',
      concepto: `Primer pago (${Math.round(pcts[0]||50)}%) al firmar el contrato`,
      monto: Number(cd.pct45a),
      porcentaje: Math.round(pcts[0]||50),
    });
    if (Number(cd.pct45b) > 0) items.push({
      etapa: 'Conclusión',
      concepto: `Pago final (${Math.round(pcts[1]||50)}%) a la entrega/conclusión del proyecto`,
      monto: Number(cd.pct45b),
      porcentaje: Math.round(pcts[1]||50),
    });
  } else {
    if (Number(cd.pct45a) > 0) items.push({
      etapa: 'Firma de contrato',
      concepto: `Primer desembolso (${Math.round(pcts[0]||45)}%) al firmar el contrato`,
      monto: Number(cd.pct45a),
      porcentaje: Math.round(pcts[0]||45),
    });
    if (Number(cd.pct45b) > 0) items.push({
      etapa: 'Instalación',
      concepto: `Segundo desembolso (${Math.round(pcts[1]||45)}%) al completar la instalación`,
      monto: Number(cd.pct45b),
      porcentaje: Math.round(pcts[1]||45),
    });
    if (Number(cd.pct10) > 0) items.push({
      etapa: 'Certificación LUMA',
      concepto: `Pago final (${Math.round(pcts[2]||10)}%) al obtener la certificación de interconexión LUMA`,
      monto: Number(cd.pct10),
      porcentaje: Math.round(pcts[2]||10),
    });
  }

  return items;
}

const crypto = require('crypto');
function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Crea (o re-crea) las facturas de un contrato.
 * Conserva las que ya están pagadas. Borra las pendientes/enviadas previas.
 */
async function generateInvoicesFromContract(contratoFirmaId, leadId, contratoData) {
  await ensureProjectInvoicesTable();
  const items = buildBreakdown(contratoData || {});
  if (!items.length) return { created: [], skipped: 'sin etapas calculables' };

  const client = await pool.connect();
  const created = [];
  try {
    await client.query('BEGIN');

    // Borrar las viejas no-pagadas asociadas al contrato (si existe)
    if (contratoFirmaId) {
      await client.query(
        `DELETE FROM project_invoices
          WHERE contrato_firma_id = $1
            AND status NOT IN ('pagada')`,
        [contratoFirmaId]
      );
    }

    for (const it of items) {
      const numero = await nextInvoiceNumber(client);
      const token  = makeToken();
      const due = new Date();
      due.setDate(due.getDate() + 30);

      const ins = await client.query(
        `INSERT INTO project_invoices
           (lead_id, contrato_firma_id, numero, etapa, concepto, monto, porcentaje,
            fecha_emision, fecha_vencimiento, status, public_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE, $8, 'pendiente', $9)
         RETURNING id, numero, etapa, monto, porcentaje, status, fecha_vencimiento`,
        [leadId, contratoFirmaId || null, numero, it.etapa, it.concepto,
         it.monto, it.porcentaje, due.toISOString().slice(0,10), token]
      );
      created.push(ins.rows[0]);
    }
    await client.query('COMMIT');
    return { created };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[projectInvoices.generate]', e.message);
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureProjectInvoicesTable,
  generateInvoicesFromContract,
  buildBreakdown,
};
