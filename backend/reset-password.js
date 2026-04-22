// Ejecutar: node reset-password.js [email] [nueva_clave]
// Ejemplo:  node reset-password.js admin@crm.com admin123

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function reset() {
  const email    = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Uso: node reset-password.js <email> <nueva_clave>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'UPDATE users SET password_hash = $1, active = true WHERE email = $2 RETURNING id, name, email',
    [hash, email]
  );

  if (result.rows.length === 0) {
    console.log(`❌ No se encontró usuario con email: ${email}`);
    // Listar usuarios disponibles
    const todos = await pool.query('SELECT id, name, email, active FROM users');
    console.log('\nUsuarios en la DB:');
    todos.rows.forEach(u => console.log(`  - [${u.active ? 'activo' : 'inactivo'}] ${u.email} (${u.name})`));
  } else {
    console.log(`✅ Password actualizado para: ${result.rows[0].name} (${result.rows[0].email})`);
  }

  await pool.end();
}

reset().catch(err => { console.error('Error:', err.message); process.exit(1); });
