// node scripts/createAdmin.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const name     = process.argv[2] || 'Admin';
  const email    = process.argv[3] || 'admin@crm.com';
  const password = process.argv[4] || 'admin123';

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = 'admin'`,
    [name, email, hash]
  );
  console.log(`Admin creado: ${email} / ${password}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
