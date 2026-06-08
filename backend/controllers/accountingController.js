'use strict';
// accountingController.js — Contabilidad de Energy Depot.
// Ganancia por proyecto (ingreso - costo de items), reportes por período y
// gastos operacionales (fijos recurrentes + variables puntuales).

const { pool } = require('../services/db');

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS operating_expenses (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(10) NOT NULL DEFAULT 'fijo',   -- 'fijo' | 'variable'
      concepto TEXT NOT NULL,
      categoria VARCHAR(60),                       -- renta, salario, publicidad, almacenamiento, comision...
      monto NUMERIC(12,2) NOT NULL DEFAULT 0,
      recurrente BOOLEAN NOT NULL DEFAULT false,   -- true = se repite cada mes
      fecha DATE,                                  -- para gastos puntuales (variables)
      activo BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // costo manual por factura (override del costo calculado de items)
  await pool.query(`ALTER TABLE project_invoices ADD COLUMN IF NOT EXISTS costo_manual NUMERIC(12,2)`);
}
ensureTables().catch(e => console.error('[accounting tables]', e.message));

// ── Período → rango (PR UTC-4) ──────────────────────────────────────────────
function resolvePeriod(period, fromStr, toStr) {
  const now = new Date();
  let from, to = new Date(now);
  if (period === 'custom' && fromStr) {
    from = new Date(fromStr);
    if (toStr) to = new Date(toStr);
  } else if (period === 'mes') {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 4, 0, 0));
  } else if (period === 'trimestre') {
    const q = Math.floor(now.getUTCMonth() / 3) * 3;
    from = new Date(Date.UTC(now.getUTCFullYear(), q, 1, 4, 0, 0));
  } else if (period === 'semestre') {
    const s = now.getUTCMonth() < 6 ? 0 : 6;
    from = new Date(Date.UTC(now.getUTCFullYear(), s, 1, 4, 0, 0));
  } else if (period === 'anio' || period === 'año') {
    from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 4, 0, 0));
  } else {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 4, 0, 0));
  }
  return { from, to };
}

function costoItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, it) => s + (Number(it.unit_cost || it.costo || 0) * Number(it.qty || 1)), 0);
}

// Meses (calendario) que toca un rango — para sumar gastos fijos recurrentes
function monthsInRange(from, to) {
  let n = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (d <= end) { n++; d.setUTCMonth(d.getUTCMonth() + 1); }
  return Math.max(1, n);
}

// ── Ganancia por proyecto (facturas no canceladas en el período) ────────────
async function profitByProject(req, res) {
  try {
    await ensureTables();
    const { period = 'mes', from: f, to: t } = req.query;
    const { from, to } = resolvePeriod(period, f, t);
    const r = await pool.query(`
      SELECT pi.id, pi.numero, pi.monto, pi.items, pi.costo_manual, pi.status,
             pi.fecha_emision, pi.cliente_nombre, pi.lead_id,
             COALESCE(c.name, l.title) AS lead_nombre
        FROM project_invoices pi
        LEFT JOIN leads l ON l.id = pi.lead_id
        LEFT JOIN contacts c ON c.id = l.contact_id
       WHERE pi.status <> 'cancelada'
         AND pi.fecha_emision >= $1::date AND pi.fecha_emision <= $2::date
       ORDER BY pi.fecha_emision DESC, pi.id DESC
    `, [from, to]);

    let totalIngreso = 0, totalCosto = 0;
    const projects = r.rows.map(row => {
      const ingreso = Number(row.monto) || 0;
      const costo = row.costo_manual != null ? Number(row.costo_manual) : costoItems(row.items);
      const ganancia = ingreso - costo;
      totalIngreso += ingreso; totalCosto += costo;
      return {
        id: row.id, numero: row.numero,
        cliente: row.cliente_nombre || row.lead_nombre || 'Cliente',
        lead_id: row.lead_id, status: row.status, fecha: row.fecha_emision,
        ingreso, costo, ganancia,
        margen: ingreso > 0 ? +(ganancia / ingreso * 100).toFixed(1) : 0,
        costo_manual: row.costo_manual != null,
      };
    });
    res.json({
      period, range: { from, to },
      totales: { ingreso: totalIngreso, costo: totalCosto, ganancia: totalIngreso - totalCosto },
      projects,
    });
  } catch (e) { console.error('[profitByProject]', e.message); res.status(500).json({ error: e.message }); }
}

// Editar costo manual de una factura
async function setProjectCost(req, res) {
  try {
    const { costo_manual } = req.body;
    const val = costo_manual === null || costo_manual === '' ? null : Number(costo_manual);
    const r = await pool.query(
      `UPDATE project_invoices SET costo_manual=$1, updated_at=NOW() WHERE id=$2 RETURNING id`,
      [val, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Reporte de ganancia neta ajustada ───────────────────────────────────────
async function report(req, res) {
  try {
    await ensureTables();
    const { period = 'mes', from: f, to: t } = req.query;
    const { from, to } = resolvePeriod(period, f, t);

    // Ingreso y costo de proyectos
    const inv = await pool.query(`
      SELECT monto, items, costo_manual FROM project_invoices
       WHERE status <> 'cancelada' AND fecha_emision >= $1::date AND fecha_emision <= $2::date
    `, [from, to]);
    let ingreso = 0, costoProyectos = 0;
    for (const row of inv.rows) {
      ingreso += Number(row.monto) || 0;
      costoProyectos += row.costo_manual != null ? Number(row.costo_manual) : costoItems(row.items);
    }
    const gananciaBruta = ingreso - costoProyectos;

    // Gastos operacionales
    const meses = monthsInRange(from, to);
    const exp = await pool.query(`SELECT tipo, concepto, categoria, monto, recurrente, fecha FROM operating_expenses WHERE activo = true`);
    let gastosFijos = 0, gastosVariables = 0;
    const detalle = [];
    for (const g of exp.rows) {
      const monto = Number(g.monto) || 0;
      if (g.recurrente) {
        // se repite cada mes del rango
        const total = monto * meses;
        if (g.tipo === 'fijo') gastosFijos += total; else gastosVariables += total;
        detalle.push({ concepto: g.concepto, categoria: g.categoria, tipo: g.tipo, recurrente: true, monto_mensual: monto, meses, total });
      } else if (g.fecha) {
        const d = new Date(g.fecha);
        if (d >= from && d <= to) {
          if (g.tipo === 'fijo') gastosFijos += monto; else gastosVariables += monto;
          detalle.push({ concepto: g.concepto, categoria: g.categoria, tipo: g.tipo, recurrente: false, fecha: g.fecha, total: monto });
        }
      }
    }
    const gastosOperacionales = gastosFijos + gastosVariables;
    res.json({
      period, range: { from, to }, meses,
      ingreso, costoProyectos, gananciaBruta,
      gastosFijos, gastosVariables, gastosOperacionales,
      gananciaNetaAjustada: gananciaBruta - gastosOperacionales,
      detalleGastos: detalle,
    });
  } catch (e) { console.error('[accounting report]', e.message); res.status(500).json({ error: e.message }); }
}

// ── CRUD gastos operacionales ───────────────────────────────────────────────
async function listExpenses(req, res) {
  try {
    await ensureTables();
    const r = await pool.query(`SELECT * FROM operating_expenses ORDER BY recurrente DESC, tipo, concepto`);
    res.json({ items: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
async function createExpense(req, res) {
  try {
    await ensureTables();
    const { tipo = 'fijo', concepto, categoria, monto, recurrente = false, fecha, notes } = req.body || {};
    if (!concepto) return res.status(400).json({ error: 'Concepto requerido' });
    const r = await pool.query(
      `INSERT INTO operating_expenses (tipo, concepto, categoria, monto, recurrente, fecha, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tipo, concepto.trim(), categoria || null, Number(monto) || 0, !!recurrente, recurrente ? null : (fecha || null), notes || null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
async function updateExpense(req, res) {
  try {
    const allowed = ['tipo','concepto','categoria','monto','recurrente','fecha','activo','notes'];
    const sets = [], params = [];
    for (const k of allowed) if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${k}=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE operating_expenses SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
async function deleteExpense(req, res) {
  try {
    await pool.query(`DELETE FROM operating_expenses WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { profitByProject, setProjectCost, report, listExpenses, createExpense, updateExpense, deleteExpense };
