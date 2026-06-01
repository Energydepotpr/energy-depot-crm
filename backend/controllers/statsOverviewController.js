// statsOverviewController.js — Executive overview KPIs para el Dashboard Fase 2
// Energy Depot CRM. Devuelve métricas reales por período seleccionable.

const { pool } = require('../services/db');

// ── Período → rango (timezone PR = UTC-4, sin DST) ────────────────────────────
function resolvePeriod(period, fromStr, toStr) {
  const now = new Date();
  const to = new Date(now); // ahora
  let from;

  if (period === 'custom' && fromStr) {
    from = new Date(fromStr);
    if (toStr) to.setTime(new Date(toStr).getTime());
  } else if (period === 'hoy') {
    // Día calendario actual en PR (UTC-4)
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0));
  } else if (period === 'mes') {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 4, 0, 0));
  } else if (period === 'anio' || period === 'año') {
    from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 4, 0, 0));
  } else {
    const days = ({ '60': 60, '90': 90, '180': 180, '365': 365 })[String(period)] || 30;
    from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  // Período anterior (mismo largo, justo antes del actual)
  const length = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - length);

  return { from, to, prevFrom, prevTo, days: Math.max(1, Math.round(length / 86400000)) };
}

function safeNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Para un row con solar_data.quotations[], devolver el monto de la cotización más baja
function lowestQuotationAmount(solarData) {
  if (!solarData) return 0;
  const qs = solarData.quotations || [];
  let lowest = null;
  for (const q of qs) {
    const c = q?.calc || q || {};
    // Prioridad: sub (costBase + batterías), luego costBase, luego value
    const amt = safeNum(c.sub) || safeNum(c.costBase) || safeNum(q.value);
    if (amt > 0 && (lowest === null || amt < lowest)) lowest = amt;
  }
  // Si no hay quotations[] pero hay calc principal, usarlo
  if (lowest === null && solarData.calc) {
    const c = solarData.calc;
    const amt = safeNum(c.sub) || safeNum(c.costBase);
    if (amt > 0) lowest = amt;
  }
  return lowest || 0;
}

function hasQuotation(solarData) {
  if (!solarData) return false;
  const qs = solarData.quotations;
  if (Array.isArray(qs) && qs.length > 0) return true;
  // fallback: lead con calc.costBase también cuenta
  if (solarData.calc && safeNum(solarData.calc.costBase) > 0) return true;
  return false;
}

// ── Conteo de leads reales en un rango ────────────────────────────────────────
// Lead real = nombre completo + (email O teléfono con 7+ dígitos)
async function countLeadsReales(from, to) {
  const q = `
    SELECT COUNT(*)::int AS n
    FROM leads l
    LEFT JOIN contacts c ON c.id = l.contact_id
    WHERE l.created_at >= $1 AND l.created_at < $2
      AND COALESCE(c.name, l.title) IS NOT NULL
      AND length(COALESCE(c.name, l.title)) > 2
      AND (
        (c.email IS NOT NULL AND length(c.email) > 3 AND c.email ILIKE '%@%')
        OR
        (c.phone IS NOT NULL AND length(regexp_replace(c.phone, '\\D', '', 'g')) >= 7)
      )
  `;
  const r = await pool.query(q, [from, to]);
  return r.rows[0]?.n || 0;
}

// ── Tiempo promedio al primer contacto (minutos) ──────────────────────────────
async function avgTimeToFirstContact(from, to) {
  const q = `
    SELECT AVG(diff_min)::numeric AS avg_min
    FROM (
      SELECT EXTRACT(EPOCH FROM (MIN(m.created_at) - l.created_at)) / 60 AS diff_min
      FROM leads l
      JOIN messages m ON m.lead_id = l.id
      WHERE l.created_at >= $1 AND l.created_at < $2
        AND m.direction = 'outbound'
        AND COALESCE(m.is_bot, false) = false
        AND m.created_at >= l.created_at
      GROUP BY l.id, l.created_at
    ) t
    WHERE diff_min IS NOT NULL AND diff_min >= 0 AND diff_min < 60 * 24 * 30
  `;
  const r = await pool.query(q, [from, to]);
  return r.rows[0]?.avg_min != null ? Math.round(Number(r.rows[0].avg_min)) : null;
}

// ── Leads por fuente ──────────────────────────────────────────────────────────
async function leadsBySource(from, to) {
  const q = `
    SELECT COALESCE(NULLIF(source, ''), 'manual') AS source, COUNT(*)::int AS n
    FROM leads
    WHERE created_at >= $1 AND created_at < $2
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 12
  `;
  const r = await pool.query(q, [from, to]);
  return r.rows;
}

// ── Top leads sin respuesta (orden por antiguedad sin outbound) ───────────────
async function topLeadsSinRespuesta(limit = 5) {
  const q = `
    SELECT l.id, l.title, l.created_at,
           c.name AS contact_name, c.phone, c.email,
           ps.name AS stage_name
    FROM leads l
    LEFT JOIN contacts c ON c.id = l.contact_id
    LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
    WHERE NOT EXISTS (
      SELECT 1 FROM messages m
      WHERE m.lead_id = l.id AND m.direction = 'outbound'
    )
    AND (ps.name IS NULL OR (ps.name NOT ILIKE '%complet%' AND ps.name NOT ILIKE '%perdid%' AND ps.name NOT ILIKE '%ganad%'))
    ORDER BY l.created_at ASC
    LIMIT $1
  `;
  const r = await pool.query(q, [limit]);
  return r.rows;
}

// ── KPIs de pipeline en JS (por flexibilidad con solar_data JSONB) ────────────
async function pipelineKpis(from, to) {
  // Obtenemos leads del período con stage + solar_data
  const q = `
    SELECT l.id, l.solar_data, l.value, l.created_at,
           ps.name AS stage_name
    FROM leads l
    LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
    WHERE l.created_at >= $1 AND l.created_at < $2
  `;
  const r = await pool.query(q, [from, to]);

  let cotizCount = 0, cotizMonto = 0;
  let finCount = 0, finMonto = 0;
  let ventaCount = 0, ventaMonto = 0;
  const stages = {};

  for (const row of r.rows) {
    const stage = (row.stage_name || '').toLowerCase();
    stages[row.stage_name || '—'] = (stages[row.stage_name || '—'] || 0) + 1;

    const sd = row.solar_data || {};
    const tieneCotiz = hasQuotation(sd);
    const lowest = lowestQuotationAmount(sd);

    if (tieneCotiz || stage.includes('cotiz')) {
      cotizCount++;
      cotizMonto += lowest;
    }

    if (stage.includes('financ') || sd.financiamiento_iniciado_at) {
      finCount++;
      finMonto += lowest || safeNum(row.value);
    }

    const isVenta = stage.includes('complet') ||
                    stage.includes('ganad') ||
                    stage.includes('instal') ||
                    !!sd.contrato_firmado_at;
    if (isVenta) {
      ventaCount++;
      // Para ventas preferimos precio de contrato firmado si existe
      const contratoPrecio = safeNum(sd?.contrato_config?.precio) ||
                             safeNum(sd?.contrato_config?.total) ||
                             lowest || safeNum(row.value);
      ventaMonto += contratoPrecio;
    }
  }

  return { cotizCount, cotizMonto, finCount, finMonto, ventaCount, ventaMonto, stages };
}

// ── Ventas confirmadas (contratos_firma con signed_at), desglosadas por modalidad ──
async function ventasFirmadas(from, to) {
  try {
    const q = `
      SELECT
        cf.contrato_data->>'modalidad' AS modalidad,
        COUNT(DISTINCT cf.lead_id)::int AS n,
        COALESCE(SUM(
          COALESCE(
            (cf.contrato_data->>'precio')::numeric,
            (cf.contrato_data->>'total')::numeric,
            0
          )
        ), 0)::numeric AS monto
      FROM contratos_firma cf
      WHERE cf.signed_at IS NOT NULL
        AND cf.signed_at >= $1 AND cf.signed_at < $2
      GROUP BY 1
    `;
    const r = await pool.query(q, [from, to]);
    let totalCount = 0, totalMonto = 0;
    let efectivoCount = 0, efectivoMonto = 0;
    let financCount = 0, financMonto = 0;
    for (const row of r.rows) {
      const n = row.n || 0;
      const m = Number(row.monto) || 0;
      totalCount += n;
      totalMonto += m;
      if ((row.modalidad || '').toLowerCase() === 'efectivo') {
        efectivoCount += n;
        efectivoMonto += m;
      } else {
        financCount += n;
        financMonto += m;
      }
    }
    return {
      count: totalCount, monto: totalMonto,
      efectivo: { count: efectivoCount, monto: efectivoMonto },
      financiamiento: { count: financCount, monto: financMonto },
    };
  } catch (e) {
    return { count: 0, monto: 0, efectivo: { count: 0, monto: 0 }, financiamiento: { count: 0, monto: 0 } };
  }
}

// ── Endpoint principal ────────────────────────────────────────────────────────
async function overview(req, res) {
  try {
    const { period = 'mes', from: fromStr, to: toStr } = req.query;
    const range = resolvePeriod(period, fromStr, toStr);

    const [
      leadsReales,
      leadsRealesPrev,
      kpis,
      kpisPrev,
      ventasFirma,
      ttfc,
      bySource,
      pendientes,
    ] = await Promise.all([
      countLeadsReales(range.from, range.to),
      countLeadsReales(range.prevFrom, range.prevTo),
      pipelineKpis(range.from, range.to),
      pipelineKpis(range.prevFrom, range.prevTo),
      ventasFirmadas(range.from, range.to),
      avgTimeToFirstContact(range.from, range.to),
      leadsBySource(range.from, range.to),
      topLeadsSinRespuesta(5),
    ]);

    // Si hay contratos firmados, preferir esa cifra para "ventas"
    const ventasCount = Math.max(kpis.ventaCount, ventasFirma.count);
    const ventasMonto = Math.max(kpis.ventaMonto, ventasFirma.monto);

    // Conversiones
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

    const funnel = [
      { name: 'Leads',          count: leadsReales,      monto: 0 },
      { name: 'Cotización',     count: kpis.cotizCount,  monto: kpis.cotizMonto },
      { name: 'Financiamiento', count: kpis.finCount,    monto: kpis.finMonto },
      { name: 'Ventas',         count: ventasCount,      monto: ventasMonto },
    ];
    const conversions = {
      leadToCotiz:    pct(kpis.cotizCount, leadsReales),
      cotizToFin:     pct(kpis.finCount, kpis.cotizCount),
      finToVenta:     pct(ventasCount, kpis.finCount),
      leadToVenta:    pct(ventasCount, leadsReales),
    };

    // Deltas (% vs período anterior)
    const delta = (a, b) => {
      if (b === 0) return a > 0 ? 100 : 0;
      return Math.round(((a - b) / b) * 100);
    };

    res.json({
      period,
      range: { from: range.from, to: range.to, days: range.days },
      kpis: {
        leads:           { count: leadsReales,   delta: delta(leadsReales, leadsRealesPrev) },
        cotizaciones:    { count: kpis.cotizCount, monto: kpis.cotizMonto, delta: delta(kpis.cotizCount, kpisPrev.cotizCount) },
        financiamiento:  { count: kpis.finCount,   monto: kpis.finMonto,   delta: delta(kpis.finCount, kpisPrev.finCount) },
        ventas:          { count: ventasCount,    monto: ventasMonto,     delta: delta(ventasCount, kpisPrev.ventaCount) },
        // Desglose de cierres firmados por modalidad
        efectivo:        ventasFirma.efectivo,
        financiamientoFirmado: ventasFirma.financiamiento,
      },
      conversions,
      funnel,
      timeToFirstContactMin: ttfc,
      bySource,
      stagesBreakdown: kpis.stages,
      pendientes: pendientes.map(p => ({
        id: p.id,
        title: p.title,
        contact_name: p.contact_name,
        phone: p.phone,
        email: p.email,
        stage_name: p.stage_name,
        created_at: p.created_at,
      })),
    });
  } catch (e) {
    console.error('[STATS OVERVIEW]', e.message);
    res.status(200).json({
      error: e.message,
      kpis: {
        leads:          { count: 0, delta: 0 },
        cotizaciones:   { count: 0, monto: 0, delta: 0 },
        financiamiento: { count: 0, monto: 0, delta: 0 },
        ventas:         { count: 0, monto: 0, delta: 0 },
      },
      conversions: { leadToCotiz: 0, cotizToFin: 0, finToVenta: 0, leadToVenta: 0 },
      funnel: [], bySource: [], stagesBreakdown: {}, pendientes: [],
      timeToFirstContactMin: null,
    });
  }
}

// ── Breakdown: leads detrás de cada KPI ───────────────────────────────────────
async function breakdown(req, res) {
  try {
    const { kind = 'ventas', period = 'mes', from: fromStr, to: toStr } = req.query;
    const range = resolvePeriod(period, fromStr, toStr);

    const q = `
      SELECT l.id, l.title, l.value, l.solar_data, l.created_at,
             c.name AS contact_name, c.phone, c.email,
             ps.name AS stage_name, ps.color AS stage_color
      FROM leads l
      LEFT JOIN contacts c ON c.id = l.contact_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      WHERE l.created_at >= $1 AND l.created_at < $2
      ORDER BY l.created_at DESC
    `;
    const r = await pool.query(q, [range.from, range.to]);

    const out = [];
    for (const row of r.rows) {
      const sd = row.solar_data || {};
      const stage = (row.stage_name || '').toLowerCase();
      const tieneCotiz = hasQuotation(sd);
      const lowest = lowestQuotationAmount(sd);

      let include = false;
      let monto = 0;

      if (kind === 'leads') {
        const name = row.contact_name || row.title || '';
        const hasContact = (row.email && row.email.includes('@')) ||
                           (row.phone && row.phone.replace(/\D/g, '').length >= 7);
        include = !!(name && name.length > 2 && hasContact);
        monto = 0;
      } else if (kind === 'cotizaciones') {
        include = tieneCotiz || stage.includes('cotiz');
        monto = lowest;
      } else if (kind === 'financiamiento') {
        include = stage.includes('financ') || !!sd.financiamiento_iniciado_at;
        monto = lowest || safeNum(row.value);
      } else if (kind === 'ventas') {
        include = stage.includes('complet') || stage.includes('ganad') ||
                  stage.includes('instal') || !!sd.contrato_firmado_at;
        monto = safeNum(sd?.contrato_config?.precio) ||
                safeNum(sd?.contrato_config?.total) ||
                lowest || safeNum(row.value);
      }

      if (include) {
        out.push({
          id: row.id,
          title: row.title,
          contact_name: row.contact_name,
          phone: row.phone,
          email: row.email,
          stage_name: row.stage_name,
          stage_color: row.stage_color,
          created_at: row.created_at,
          monto,
        });
      }
    }

    const total = out.reduce((s, x) => s + (Number(x.monto) || 0), 0);
    res.json({ kind, count: out.length, monto: total, items: out });
  } catch (e) {
    console.error('[STATS BREAKDOWN]', e.message);
    res.status(200).json({ kind: req.query.kind, count: 0, monto: 0, items: [], error: e.message });
  }
}

module.exports = { overview, breakdown, resolvePeriod };
