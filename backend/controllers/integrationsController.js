const { pool } = require('../services/db');
const axios = require('axios');

// GET /api/integrations - list all integration statuses
async function listar(req, res) {
  try {
    const result = await pool.query('SELECT id, config, is_active, enabled, connected_at FROM integrations');
    res.json(result.rows);
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// PATCH /api/integrations/:id/toggle - enable/disable without disconnecting
async function toggleEnabled(req, res) {
  try {
    const { enabled } = req.body;
    await pool.query(
      `INSERT INTO integrations (id, config, is_active, enabled, updated_at)
       VALUES ($1, '{}', false, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET enabled = $2, updated_at = NOW()`,
      [req.params.id, !!enabled]
    );
    res.json({ ok: true, enabled: !!enabled });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// POST /api/integrations - save/update integration config
async function guardar(req, res) {
  try {
    const { id, config } = req.body;
    if (!id) return res.status(400).json({ error: 'id requerido' });
    await pool.query(
      `INSERT INTO integrations (id, config, is_active, connected_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET config = $2, is_active = true, connected_at = NOW(), updated_at = NOW()`,
      [id, JSON.stringify(config || {})]
    );
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// DELETE /api/integrations/:id - disconnect
async function desconectar(req, res) {
  try {
    await pool.query(
      `UPDATE integrations SET is_active = false, config = '{}', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

// POST /api/integrations/test/slack - test Slack webhook
async function testSlack(req, res) {
  try {
    const result = await pool.query(`SELECT config FROM integrations WHERE id = 'slack' AND is_active = true`);
    if (!result.rows.length) return res.status(400).json({ error: 'Slack no conectado' });
    const { webhook_url } = result.rows[0].config;
    if (!webhook_url) return res.status(400).json({ error: 'webhook_url no configurado' });

    await axios.post(webhook_url, { text: '✅ Fix A Trip CRM conectado a Slack correctamente' });
    res.json({ ok: true });
  } catch (err) { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Error interno del servidor' }); }
}

module.exports = { listar, guardar, desconectar, testSlack, toggleEnabled };
