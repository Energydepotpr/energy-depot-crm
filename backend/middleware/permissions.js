const { pool } = require('../services/db');

// ── Todos los permisos disponibles en el sistema ──────────────────────────────
const ALL_PERMISSIONS = [
  'contacts.view',
  'contacts.create',
  'contacts.edit',
  'contacts.delete',
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.delete',
  'leads.view_all',
  'invoices.view',
  'invoices.create',
  'invoices.delete',
  'contracts.view',
  'contracts.create',
  'contracts.edit',
  'contracts.delete',
  'reports.view',
  'settings.edit',
  'agents.manage',
];

// Permisos por defecto para el rol 'employee'
const EMPLOYEE_DEFAULT_PERMISSIONS = [
  'contacts.view',
  'contacts.create',
  'contacts.edit',
  'leads.view',
  'leads.create',
  'leads.edit',
  'invoices.view',
  'invoices.create',
  'contracts.view',
  'reports.view',
];

// ── Crear tabla e inicializar permisos por defecto ────────────────────────────
async function initPermissions() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id         SERIAL PRIMARY KEY,
        role       TEXT NOT NULL,
        permission TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(role, permission)
      )
    `);

    // Insertar permisos de admin (todos)
    for (const perm of ALL_PERMISSIONS) {
      await pool.query(`
        INSERT INTO role_permissions (role, permission)
        VALUES ('admin', $1)
        ON CONFLICT (role, permission) DO NOTHING
      `, [perm]);
    }

    // Insertar permisos de employee (subset por defecto)
    for (const perm of EMPLOYEE_DEFAULT_PERMISSIONS) {
      await pool.query(`
        INSERT INTO role_permissions (role, permission)
        VALUES ('employee', $1)
        ON CONFLICT (role, permission) DO NOTHING
      `, [perm]);
    }
  } catch (err) {
    console.error('[permissions] Init error:', err.message);
  }
}

// Ejecutar al cargar el módulo
initPermissions();

// ── Cache simple en memoria para evitar consultas repetidas ──────────────────
const permCache = new Map(); // key: role, value: { perms: Set, ts: number }
const CACHE_TTL = 30000; // 30 segundos

async function getPermissionsForRole(role) {
  const cached = permCache.get(role);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.perms;
  }

  const result = await pool.query(
    'SELECT permission FROM role_permissions WHERE role = $1',
    [role]
  );
  const perms = new Set(result.rows.map(r => r.permission));
  permCache.set(role, { perms, ts: Date.now() });
  return perms;
}

function invalidateCache(role) {
  permCache.delete(role);
}

// ── Middleware de verificación de permiso ─────────────────────────────────────
function checkPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Token requerido' });
      }

      // Admin siempre tiene acceso a todo
      if (req.user.role === 'admin') {
        return next();
      }

      const perms = await getPermissionsForRole(req.user.role);
      if (perms.has(permission)) {
        return next();
      }

      return res.status(403).json({
        error: 'No tienes permiso para realizar esta acción',
        required: permission,
      });
    } catch (err) {
      console.error('[checkPermission]', err.message);
      return res.status(500).json({ error: 'Error verificando permisos' });
    }
  };
}

// ── Listar permisos por rol (solo admin) ──────────────────────────────────────
async function listarPermisos(req, res) {
  try {
    const result = await pool.query(
      'SELECT role, permission FROM role_permissions ORDER BY role, permission'
    );

    // Agrupar por rol
    const byRole = {};
    for (const row of result.rows) {
      if (!byRole[row.role]) byRole[row.role] = [];
      byRole[row.role].push(row.permission);
    }

    // Devolver también la lista completa de permisos disponibles
    res.json({
      all_permissions: ALL_PERMISSIONS,
      by_role: byRole,
    });
  } catch (err) {
    console.error('[listarPermisos]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── Actualizar permiso de un rol (solo admin) ─────────────────────────────────
async function actualizarPermiso(req, res) {
  try {
    const { role, permission, granted } = req.body;

    if (!role || !permission) {
      return res.status(400).json({ error: 'role y permission son requeridos' });
    }

    // No permitir modificar permisos del admin
    if (role === 'admin') {
      return res.status(400).json({ error: 'Los permisos del administrador no se pueden modificar' });
    }

    if (!ALL_PERMISSIONS.includes(permission)) {
      return res.status(400).json({ error: `Permiso inválido: ${permission}` });
    }

    if (granted) {
      await pool.query(`
        INSERT INTO role_permissions (role, permission)
        VALUES ($1, $2)
        ON CONFLICT (role, permission) DO NOTHING
      `, [role, permission]);
    } else {
      await pool.query(
        'DELETE FROM role_permissions WHERE role = $1 AND permission = $2',
        [role, permission]
      );
    }

    // Invalidar caché del rol modificado
    invalidateCache(role);

    res.json({ ok: true, role, permission, granted: !!granted });
  } catch (err) {
    console.error('[actualizarPermiso]', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  checkPermission,
  listarPermisos,
  actualizarPermiso,
  ALL_PERMISSIONS,
  EMPLOYEE_DEFAULT_PERMISSIONS,
};

/* ROUTES_TO_ADD_server.js
app.get('/api/permissions', authMiddleware, requireAdmin, permissions.listarPermisos);
app.post('/api/permissions', authMiddleware, requireAdmin, permissions.actualizarPermiso);
*/

/* API_METHODS_TO_ADD_api.js
permissions: () => req('GET', '/api/permissions'),
updatePermission: (data) => req('POST', '/api/permissions', data),
*/
