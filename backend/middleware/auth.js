const jwt  = require('jsonwebtoken');
const { pool } = require('../services/db');

// In-memory revocation cache: userId → deactivated timestamp
// Cleared every hour to avoid stale entries
const revokedUsers = new Map();
setInterval(() => revokedUsers.clear(), 60 * 60 * 1000);

async function authMiddleware(req, res, next) {
  // Rutas públicas — no requieren token
  if (req.path.startsWith('/public/')) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);

    // Check in-memory revocation cache first (fast path)
    if (revokedUsers.has(payload.id)) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    // Validate active status from DB (catches deactivated users with live tokens)
    const { rows } = await pool.query('SELECT active FROM users WHERE id = $1', [payload.id]);
    if (!rows[0] || rows[0].active === false) {
      revokedUsers.set(payload.id, Date.now()); // cache the revocation
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  }
  next();
}

module.exports = { authMiddleware, requireAdmin };
