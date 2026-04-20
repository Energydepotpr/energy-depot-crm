'use strict';
const { pool } = require('../services/db');

const DEFAULT_ICS = 'https://fareharbor.com/integrations/ics/fixatrippuertorico/calendar/?token=2ae82eb0-39bd-4494-a041-8e9d1759003c';

async function getIcsUrl() {
  try {
    const { rows } = await pool.query(`SELECT config FROM integrations WHERE id='fareharbor' AND is_active=true LIMIT 1`);
    if (rows.length) {
      const cfg = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
      if (cfg?.ics_url) return cfg.ics_url;
    }
  } catch {}
  return DEFAULT_ICS;
}

function parseICS(text) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key) => {
      const rx = new RegExp(`${key}[^:]*:([^\r\n]+)`, 'i');
      const m = block.match(rx);
      return m ? m[1].trim() : '';
    };
    const parseDate = (str) => {
      if (!str) return null;
      // Format: 20250320T140000Z or 20250320
      const clean = str.replace('Z', '').replace(/T/, 'T');
      if (str.length === 8) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
      return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T${str.slice(9,11)}:${str.slice(11,13)}:${str.slice(13,15)}Z`;
    };

    const uid     = get('UID');
    const summary = get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const dtstart = get('DTSTART');
    const dtend   = get('DTEND');
    const desc    = get('DESCRIPTION').replace(/\\,/g, ',').replace(/\\n/g, '\n');
    const location= get('LOCATION').replace(/\\,/g, ',');

    if (!uid || !summary) continue;
    events.push({
      id:          uid,
      summary,
      description: desc,
      location,
      start:       parseDate(dtstart),
      end:         parseDate(dtend),
      _source:     'fareharbor',
    });
  }
  return events;
}

// GET /api/fareharbor/events
async function listEvents(req, res) {
  try {
    const icsUrl = await getIcsUrl();
    const resp = await fetch(icsUrl, { headers: { 'User-Agent': 'CRM/1.0' } });
    if (!resp.ok) throw new Error(`FareHarbor ICS responded ${resp.status}`);
    const text = await resp.text();
    const events = parseICS(text);

    // Optional time filter
    const { timeMin, timeMax } = req.query;
    const filtered = events.filter(ev => {
      if (!ev.start) return false;
      if (timeMin && ev.start < timeMin) return false;
      if (timeMax && ev.start > timeMax) return false;
      return true;
    });

    res.json({ ok: true, events: filtered, total: filtered.length });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/fareharbor/config — save ICS URL
async function saveConfig(req, res) {
  try {
    const { ics_url } = req.body;
    if (!ics_url) return res.status(400).json({ error: 'ics_url requerido' });
    await pool.query(
      `INSERT INTO integrations (id, config, is_active, connected_at, updated_at)
       VALUES ('fareharbor', $1, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET config=$1, is_active=true, connected_at=NOW(), updated_at=NOW()`,
      [JSON.stringify({ ics_url })]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/fareharbor/status
async function status(req, res) {
  try {
    const { rows } = await pool.query(`SELECT config, is_active FROM integrations WHERE id='fareharbor' LIMIT 1`);
    const connected = rows.length > 0 && rows[0].is_active;
    res.json({ connected, ics_url: connected ? (JSON.parse(rows[0].config || '{}').ics_url || DEFAULT_ICS) : '' });
  } catch {
    res.json({ connected: true, ics_url: DEFAULT_ICS }); // default is already configured
  }
}

module.exports = { listEvents, saveConfig, status };
