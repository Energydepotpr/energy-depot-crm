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

function costoItems(items, catalog) {
  if (!Array.isArray(items)) return 0;
  const cat = catalog || {};
  return items.reduce((s, it) => {
    let unit = Number(it.unit_cost || it.costo || 0);
    if (!unit) unit = cat[String(it.description || '').trim().toLowerCase()] || 0; // fallback por nombre
    return s + unit * Number(it.qty || 1);
  }, 0);
}

// Carga config solar (costo por panel + costos de baterías) una vez por request.
async function loadSolarCostConfig() {
  const { getConfigValue } = require('../services/configService');
  let pricing = await getConfigValue('solar_pricing', {});
  if (typeof pricing === 'string') { try { pricing = JSON.parse(pricing); } catch { pricing = {}; } }
  let bats = await getConfigValue('solar_batteries', []);
  if (typeof bats === 'string') { try { bats = JSON.parse(bats); } catch { bats = []; } }
  const battCost = {};
  (Array.isArray(bats) ? bats : []).forEach(b => { if (b && b.name) battCost[b.name] = Number(b.costo) || 0; });
  // Catálogo de items de factura → costo por nombre (fallback)
  let invItems = await getConfigValue('invoice_items', []);
  if (typeof invItems === 'string') { try { invItems = JSON.parse(invItems); } catch { invItems = []; } }
  const itemCost = {};
  (Array.isArray(invItems) ? invItems : []).forEach(i => { if (i && i.name) itemCost[String(i.name).trim().toLowerCase()] = Number(i.costo) || 0; });
  return {
    panelCost: Number(pricing.panelCost) || 0,
    panelWatts: Number(pricing.panelWatts) || 550,
    battCost,
    itemCost,
  };
}

// Costo estimado del proyecto solar a partir de su cotización (placas + baterías).
function solarProjectCost(sd, cfg) {
  if (!sd) return 0;
  const q = (Array.isArray(sd.quotations) && sd.quotations.length)
    ? (sd.quotations.find(x => x.id === sd.activeQuotationId) || sd.quotations[0])
    : null;
  let panels = 0, battCosto = 0;
  if (q) {
    const meses = Array.isArray(q.meses) ? q.meses : [];
    const last12 = meses.length > 12 ? meses.slice(-12) : meses;
    const filled = last12.map(Number).filter(v => v > 0);
    if (filled.length) {
      const avg = filled.reduce((a, b) => a + b, 0) / filled.length;
      panels = 2 * Math.ceil(((avg / 30 / 4.5) * 1000 / cfg.panelWatts) / 2);
    }
    (q.batteries || []).forEach(b => { battCosto += (cfg.battCost[b.name] || 0) * (b.qty || 0); });
  }
  if (!panels && sd.calc?.panels) panels = Number(sd.calc.panels) || 0;
  return Math.round(panels * cfg.panelCost + battCosto);
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
    const cfg = await loadSolarCostConfig();
    const r = await pool.query(`
      SELECT pi.id, pi.numero, pi.monto, pi.items, pi.costo_manual, pi.status,
             pi.fecha_emision, pi.cliente_nombre, pi.lead_id,
             COALESCE(c.name, l.title) AS lead_nombre, l.solar_data
        FROM project_invoices pi
        LEFT JOIN leads l ON l.id = pi.lead_id
        LEFT JOIN contacts c ON c.id = l.contact_id
       WHERE pi.status <> 'cancelada'
         AND pi.fecha_emision >= $1::date AND pi.fecha_emision <= $2::date
       ORDER BY pi.fecha_emision DESC, pi.id DESC
    `, [from, to]);

    // Costo solar por lead, distribuido entre sus facturas por proporción de monto
    // (evita contar el costo de las placas varias veces si hay varias facturas del mismo proyecto).
    const leadGroups = {};
    for (const row of r.rows) {
      if (!row.lead_id) continue;
      (leadGroups[row.lead_id] = leadGroups[row.lead_id] || []).push(row);
    }
    const solarShare = {}; // invoiceId → costo solar asignado
    for (const lid of Object.keys(leadGroups)) {
      const grp = leadGroups[lid];
      const sd = grp[0].solar_data;
      const sc = solarProjectCost(sd, cfg);
      if (sc <= 0) continue;
      const totalMonto = grp.reduce((s, g) => s + (Number(g.monto) || 0), 0);
      grp.forEach(g => {
        // solo asignar costo solar si la factura no tiene costo propio
        const propio = g.costo_manual != null || costoItems(g.items, cfg.itemCost) > 0;
        if (propio) return;
        solarShare[g.id] = totalMonto > 0 ? Math.round(sc * (Number(g.monto) || 0) / totalMonto) : (grp.length === 1 ? sc : Math.round(sc / grp.length));
      });
    }

    let totalIngreso = 0, totalCosto = 0;
    const projects = r.rows.map(row => {
      const ingreso = Number(row.monto) || 0;
      const costoItm = costoItems(row.items, cfg.itemCost);
      const costo = row.costo_manual != null ? Number(row.costo_manual)
                  : (costoItm > 0 ? costoItm : (solarShare[row.id] || 0));
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

    // Ingreso y costo de proyectos (incluye costo solar de placas+baterías)
    const cfg = await loadSolarCostConfig();
    const inv = await pool.query(`
      SELECT pi.id, pi.monto, pi.items, pi.costo_manual, pi.lead_id, l.solar_data
        FROM project_invoices pi LEFT JOIN leads l ON l.id = pi.lead_id
       WHERE pi.status <> 'cancelada' AND pi.fecha_emision >= $1::date AND pi.fecha_emision <= $2::date
    `, [from, to]);
    // Distribuir costo solar por lead
    const grp = {};
    for (const row of inv.rows) { if (row.lead_id) (grp[row.lead_id] = grp[row.lead_id] || []).push(row); }
    const solarShare = {};
    for (const lid of Object.keys(grp)) {
      const g = grp[lid]; const sc = solarProjectCost(g[0].solar_data, cfg);
      if (sc <= 0) continue;
      const tot = g.reduce((s, x) => s + (Number(x.monto) || 0), 0);
      g.forEach(x => { if (x.costo_manual == null && costoItems(x.items, cfg.itemCost) === 0) solarShare[x.id] = tot > 0 ? Math.round(sc * (Number(x.monto)||0) / tot) : Math.round(sc / g.length); });
    }
    let ingreso = 0, costoProyectos = 0;
    for (const row of inv.rows) {
      ingreso += Number(row.monto) || 0;
      const ci = costoItems(row.items, cfg.itemCost);
      costoProyectos += row.costo_manual != null ? Number(row.costo_manual) : (ci > 0 ? ci : (solarShare[row.id] || 0));
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
