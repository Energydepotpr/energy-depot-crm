const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../services/db');

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = true', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

async function me(req, res) {
  res.json(req.user);
}

const VALID_ROLES = ['admin', 'agent'];

async function crearUsuario(req, res) {
  const { name, email, password, role = 'agent' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email y password requeridos' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${VALID_ROLES.join(', ')}` });

  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
      [name, email, hash, role]
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email ya registrado' });
    console.error('[AUTH crearUsuario]', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listarUsuarios(req, res) {
  const result = await pool.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at');
  res.json(result.rows);
}

async function actualizarUsuario(req, res) {
  const { id } = req.params;
  const { name, email, role, active, password } = req.body;

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
  }
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${VALID_ROLES.join(', ')}` });
  }
  if (name || email || role !== undefined || active !== undefined) {
    await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        active = COALESCE($4, active)
       WHERE id = $5`,
      [name || null, email || null, role || null, active ?? null, id]
    );
  }
  res.json({ ok: true });
}

async function eliminarUsuario(req, res) {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login, me, crearUsuario, listarUsuarios, actualizarUsuario, eliminarUsuario };
