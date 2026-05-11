'use strict';
const { pool } = require('./db');

/**
 * Lee un valor del config table por key. Si la fila no existe o el valor es
 * vacío/nulo devuelve `fallback`. Errores de DB también devuelven `fallback`
 * para no romper paths críticos (envío de email, PDFs, etc.).
 */
async function getConfigValue(key, fallback = '') {
  try {
    const { rows } = await pool.query('SELECT value FROM config WHERE key = $1', [key]);
    if (!rows.length) return fallback;
    const v = rows[0].value;
    if (v === null || v === undefined || v === '') return fallback;
    return v;
  } catch (e) {
    console.error('[configService] getConfigValue error:', e.message);
    return fallback;
  }
}

module.exports = { getConfigValue };
