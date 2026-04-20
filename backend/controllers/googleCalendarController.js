'use strict';
const { pool } = require('../services/db');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CAL_BASE  = 'https://www.googleapis.com/calendar/v3';

function getCredentials() {
  return {
    clientId:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:  process.env.GOOGLE_REDIRECT_URI || 'https://crm-ia-production-c247.up.railway.app/api/auth/google/callback',
  };
}

async function getTokens() {
  const { rows } = await pool.query(`SELECT config FROM integrations WHERE id='google_calendar' AND is_active=true LIMIT 1`);
  if (!rows.length) return null;
  return typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
}

async function saveTokens(tokens) {
  await pool.query(
    `INSERT INTO integrations (id, config, is_active, connected_at, updated_at)
     VALUES ('google_calendar', $1, true, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET config=$1, is_active=true, connected_at=NOW(), updated_at=NOW()`,
    [JSON.stringify(tokens)]
  );
}

async function refreshAccessToken(tokens) {
  const { clientId, clientSecret } = getCredentials();
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });
  if (!resp.ok) throw new Error('No se pudo renovar el token de Google');
  const data = await resp.json();
  const updated = { ...tokens, access_token: data.access_token, expiry: Date.now() + data.expires_in * 1000 };
  await saveTokens(updated);
  return updated;
}

async function getValidToken() {
  let tokens = await getTokens();
  if (!tokens) throw new Error('Google Calendar no conectado');
  if (!tokens.expiry || Date.now() > tokens.expiry - 60000) {
    tokens = await refreshAccessToken(tokens);
  }
  return tokens.access_token;
}

// GET /api/auth/google — redirect to Google OAuth
async function authRedirect(req, res) {
  const { clientId, redirectUri } = getCredentials();
  if (!clientId) return res.status(503).json({ error: 'GOOGLE_CLIENT_ID no configurado en Railway' });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  res.redirect(url.toString());
}

// GET /api/auth/google/callback
async function authCallback(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código de autorización faltante');
  const { clientId, clientSecret, redirectUri } = getCredentials();
  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error_description || 'Error en OAuth');
    await saveTokens({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expiry:        Date.now() + (data.expires_in || 3600) * 1000,
    });
    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'https://crm-ia-nu.vercel.app';
    res.redirect(`${frontendUrl}/integrations?google_connected=1`);
  } catch (err) {
    res.redirect(`${(process.env.FRONTEND_URL?.split(',')[0] || 'https://crm-ia-nu.vercel.app')}/integrations?google_error=${encodeURIComponent(err.message)}`);
  }
}

// GET /api/calendar/google/status
async function status(req, res) {
  const tokens = await getTokens();
  res.json({ connected: !!tokens });
}

// GET /api/calendar/google/events?timeMin=...&timeMax=...
async function listEvents(req, res) {
  try {
    const accessToken = await getValidToken();
    const now = new Date();
    const timeMin = req.query.timeMin || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = req.query.timeMax || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
    const url = `${GOOGLE_CAL_BASE}/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) throw new Error('Error al obtener eventos de Google Calendar');
    const data = await resp.json();
    res.json({ ok: true, events: data.items || [] });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/calendar/google/events
async function createEvent(req, res) {
  try {
    const accessToken = await getValidToken();
    const { summary, description, start, end, location, colorId } = req.body;
    const body = {
      summary,
      description,
      location,
      colorId,
      start: start?.dateTime ? { dateTime: start.dateTime, timeZone: 'America/Puerto_Rico' } : { date: start?.date },
      end:   end?.dateTime   ? { dateTime: end.dateTime,   timeZone: 'America/Puerto_Rico' } : { date: end?.date },
    };
    const resp = await fetch(`${GOOGLE_CAL_BASE}/calendars/primary/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'Error al crear evento'); }
    const event = await resp.json();
    res.json({ ok: true, event });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /api/calendar/google/events/:eventId
async function deleteEvent(req, res) {
  try {
    const accessToken = await getValidToken();
    await fetch(`${GOOGLE_CAL_BASE}/calendars/primary/events/${req.params.eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/calendar/google/disconnect
async function disconnect(req, res) {
  try {
    await pool.query(`UPDATE integrations SET is_active=false, config='{}', updated_at=NOW() WHERE id='google_calendar'`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { authRedirect, authCallback, status, listEvents, createEvent, deleteEvent, disconnect };
