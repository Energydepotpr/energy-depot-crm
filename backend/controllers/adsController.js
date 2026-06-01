// adsController.js — Métricas de inversión publicitaria (Meta, Google, etc).
// Phase 1: ingreso manual + cálculo de ROI cruzando con leads via UTM.
// Phase 2 (futuro): sync automático desde Meta Marketing API y Google Ads API.

const { pool } = require('../services/db');

// ── Asegurar schema ──────────────────────────────────────────────────────────
async function ensureSchema() {
  // Columnas UTM en leads
  await pool.query(`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS utm_source   TEXT,
      ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
      ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
      ADD COLUMN IF NOT EXISTS utm_content  TEXT,
      ADD COLUMN IF NOT EXISTS utm_term     TEXT,
      ADD COLUMN IF NOT EXISTS fbclid       TEXT,
      ADD COLUMN IF NOT EXISTS gclid        TEXT
  `);
  // Tabla ad_spend: una fila por día/network/campaña
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_spend (
      id          SERIAL PRIMARY KEY,
      network     TEXT        NOT NULL,
      campaign_id TEXT,
      campaign    TEXT        NOT NULL,
      adset       TEXT,
      ad_name     TEXT,
      date        DATE        NOT NULL,
      spend       NUMERIC(12,2) NOT NULL DEFAULT 0,
      impressions INTEGER     DEFAULT 0,
      clicks      INTEGER     DEFAULT 0,
      source      TEXT        DEFAULT 'manual',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (network, COALESCE(campaign_id,''), date)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ad_spend_date_idx ON ad_spend (date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ad_spend_network_idx ON ad_spend (network)`);
}
ensureSchema().catch(e => console.error('[ads schema]', e.message));

// ── Listar / Crear / Actualizar / Eliminar gastos ────────────────────────────
async function listar(req, res) {
  try {
    const { network, from, to, campaign } = req.query;
    const conds = []; const params = [];
    if (network)  { params.push(network);  conds.push(`network = $${params.length}`); }
    if (from)     { params.push(from);     conds.push(`date >= $${params.length}`); }
    if (to)       { params.push(to);       conds.push(`date <= $${params.length}`); }
    if (campaign) { params.push(`%${campaign}%`); conds.push(`campaign ILIKE $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT id, network, campaign, campaign_id, adset, ad_name, date, spend, impressions, clicks, source, created_at
         FROM ad_spend ${where} ORDER BY date DESC, id DESC LIMIT 500`, params
    );
    res.json({ items: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function crear(req, res) {
  try {
    const { network, campaign, campaign_id, adset, ad_name, date, spend, impressions, clicks } = req.body || {};
    if (!network || !campaign || !date) return res.status(400).json({ error: 'network, campaign, date requeridos' });
    const r = await pool.query(
      `INSERT INTO ad_spend (network, campaign, campaign_id, adset, ad_name, date, spend, impressions, clicks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (network, COALESCE(campaign_id,''), date) DO UPDATE
         SET spend = EXCLUDED.spend,
             impressions = EXCLUDED.impressions,
             clicks = EXCLUDED.clicks,
             campaign = EXCLUDED.campaign,
             updated_at = NOW()
       RETURNING *`,
      [network, campaign, campaign_id || null, adset || null, ad_name || null, date, Number(spend)||0, Number(impressions)||0, Number(clicks)||0]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function actualizar(req, res) {
  try {
    const sets = []; const params = [];
    for (const k of ['network','campaign','campaign_id','adset','ad_name','date','spend','impressions','clicks']) {
      if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'sin cambios' });
    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);
    const r = await pool.query(`UPDATE ad_spend SET ${sets.join(',')} WHERE id = $${params.length} RETURNING *`, params);
    if (!r.rows[0]) return res.status(404).json({ error: 'no encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function eliminar(req, res) {
  try {
    await pool.query(`DELETE FROM ad_spend WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── ROI: cruza gasto con leads (atribuídos por utm_campaign / utm_source) ────
async function roi(req, res) {
  try {
    const { period = 'mes', from: fromStr, to: toStr } = req.query;
    const now = new Date();
    let from, to = new Date(now);
    if (period === 'custom' && fromStr) {
      from = new Date(fromStr);
      if (toStr) to = new Date(toStr);
    } else if (period === 'hoy') {
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0));
    } else if (period === 'mes') {
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 4, 0, 0));
    } else if (period === 'anio' || period === 'año') {
      from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 4, 0, 0));
    } else {
      const days = ({ '60': 60, '90': 90, '180': 180, '365': 365 })[String(period)] || 30;
      from = new Date(now.getTime() - days * 86400000);
    }

    // Spend total por network y por campaign en el rango
    const spendByNet = await pool.query(
      `SELECT network, COALESCE(SUM(spend),0)::numeric AS spend,
              COALESCE(SUM(impressions),0)::int       AS impressions,
              COALESCE(SUM(clicks),0)::int            AS clicks
         FROM ad_spend
        WHERE date >= $1::date AND date <= $2::date
        GROUP BY network ORDER BY spend DESC`,
      [from, to]
    );
    const spendByCampaign = await pool.query(
      `SELECT network, campaign, campaign_id,
              COALESCE(SUM(spend),0)::numeric AS spend,
              COALESCE(SUM(impressions),0)::int AS impressions,
              COALESCE(SUM(clicks),0)::int AS clicks
         FROM ad_spend
        WHERE date >= $1::date AND date <= $2::date
        GROUP BY network, campaign, campaign_id
        ORDER BY spend DESC LIMIT 100`,
      [from, to]
    );

    // Leads atribuidos por source+campaña, contando cuántos firmaron
    const leadsByCampaign = await pool.query(`
      SELECT
        l.utm_source AS network,
        l.utm_campaign AS campaign,
        COUNT(*)::int AS leads,
        COUNT(*) FILTER (WHERE cf.signed_at IS NOT NULL)::int AS firmados,
        COALESCE(SUM(
          CASE WHEN cf.signed_at IS NOT NULL THEN
            COALESCE((cf.contrato_data->>'precio')::numeric, (cf.contrato_data->>'total')::numeric, 0)
          ELSE 0 END
        ), 0)::numeric AS ventas_monto
      FROM leads l
      LEFT JOIN contratos_firma cf ON cf.lead_id = l.id AND cf.signed_at IS NOT NULL
      WHERE l.created_at >= $1 AND l.created_at < $2
        AND l.utm_source IS NOT NULL
      GROUP BY l.utm_source, l.utm_campaign
    `, [from, to]);

    // Normalizar network names (facebook = meta, instagram = meta, google_ads = google)
    const normalize = (s) => {
      const x = (s || '').toLowerCase();
      if (/facebook|instagram|meta|fb|ig/.test(x)) return 'meta';
      if (/google|adwords|gads/.test(x)) return 'google';
      if (/tiktok|tt/.test(x)) return 'tiktok';
      return x || 'desconocido';
    };

    // Index leads por (network, campaign)
    const leadsMap = new Map();
    for (const row of leadsByCampaign.rows) {
      const key = `${normalize(row.network)}|${(row.campaign||'').toLowerCase()}`;
      leadsMap.set(key, { leads: row.leads, firmados: row.firmados, ventas_monto: Number(row.ventas_monto) });
    }

    // Aggregar por network y total
    const networks = {};
    for (const r of spendByNet.rows) {
      networks[normalize(r.network)] = {
        spend: Number(r.spend), impressions: r.impressions, clicks: r.clicks,
        leads: 0, firmados: 0, ventas_monto: 0,
      };
    }
    for (const [k, v] of leadsMap.entries()) {
      const net = k.split('|')[0];
      if (!networks[net]) networks[net] = { spend: 0, impressions: 0, clicks: 0, leads: 0, firmados: 0, ventas_monto: 0 };
      networks[net].leads += v.leads;
      networks[net].firmados += v.firmados;
      networks[net].ventas_monto += v.ventas_monto;
    }

    // Calcular CPL, CPS, ROAS por network
    const byNetwork = Object.entries(networks).map(([net, d]) => ({
      network: net,
      spend: d.spend,
      impressions: d.impressions,
      clicks: d.clicks,
      leads: d.leads,
      firmados: d.firmados,
      ventas_monto: d.ventas_monto,
      cpl: d.leads > 0 ? +(d.spend / d.leads).toFixed(2) : null,
      cps: d.firmados > 0 ? +(d.spend / d.firmados).toFixed(2) : null,
      roas: d.spend > 0 ? +(d.ventas_monto / d.spend).toFixed(2) : null,
    }));

    // Campañas individuales (combina spend y leads)
    const byCampaign = spendByCampaign.rows.map(r => {
      const key = `${normalize(r.network)}|${(r.campaign||'').toLowerCase()}`;
      const lm = leadsMap.get(key) || { leads: 0, firmados: 0, ventas_monto: 0 };
      const spend = Number(r.spend);
      return {
        network: normalize(r.network),
        campaign: r.campaign,
        campaign_id: r.campaign_id,
        spend, impressions: r.impressions, clicks: r.clicks,
        leads: lm.leads,
        firmados: lm.firmados,
        ventas_monto: lm.ventas_monto,
        cpl: lm.leads > 0 ? +(spend / lm.leads).toFixed(2) : null,
        cps: lm.firmados > 0 ? +(spend / lm.firmados).toFixed(2) : null,
        roas: spend > 0 ? +(lm.ventas_monto / spend).toFixed(2) : null,
      };
    });

    // Totales
    const total = byNetwork.reduce((acc, n) => ({
      spend: acc.spend + n.spend,
      leads: acc.leads + n.leads,
      firmados: acc.firmados + n.firmados,
      ventas_monto: acc.ventas_monto + n.ventas_monto,
      impressions: acc.impressions + n.impressions,
      clicks: acc.clicks + n.clicks,
    }), { spend: 0, leads: 0, firmados: 0, ventas_monto: 0, impressions: 0, clicks: 0 });
    total.cpl = total.leads > 0 ? +(total.spend / total.leads).toFixed(2) : null;
    total.cps = total.firmados > 0 ? +(total.spend / total.firmados).toFixed(2) : null;
    total.roas = total.spend > 0 ? +(total.ventas_monto / total.spend).toFixed(2) : null;

    res.json({
      period,
      range: { from, to },
      total,
      byNetwork,
      byCampaign,
    });
  } catch (e) {
    console.error('[ads roi]', e.message);
    res.status(500).json({ error: e.message });
  }
}

module.exports = { listar, crear, actualizar, eliminar, roi };
