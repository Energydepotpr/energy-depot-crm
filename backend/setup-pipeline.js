require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const STAGES = [
  { name: 'Lead',           color: '#8b5cf6', position: 0 },
  { name: 'Contactado',     color: '#3b82f6', position: 1 },
  { name: 'Cotización',     color: '#06b6d4', position: 2 },
  { name: 'Financiamiento', color: '#f59e0b', position: 3 },
  { name: 'Permisos LUMA',  color: '#f97316', position: 4 },
  { name: 'Instalación',    color: '#10b981', position: 5 },
  { name: 'Completado',     color: '#00c9a7', position: 6 },
];

async function run() {
  const client = await pool.connect();
  try {
    let pip = await client.query(`SELECT id FROM pipelines LIMIT 1`);
    let pipId;
    if (pip.rows.length === 0) {
      const r = await client.query(`INSERT INTO pipelines (name, position) VALUES ('Ventas Solar', 0) RETURNING id`);
      pipId = r.rows[0].id;
    } else {
      pipId = pip.rows[0].id;
      await client.query(`UPDATE pipelines SET name = 'Ventas Solar' WHERE id = $1`, [pipId]);
    }

    await client.query(`DELETE FROM pipeline_stages WHERE pipeline_id = $1`, [pipId]);
    console.log('Etapas anteriores eliminadas');

    for (const s of STAGES) {
      await client.query(
        `INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES ($1, $2, $3, $4)`,
        [pipId, s.name, s.color, s.position]
      );
      console.log(`✓ ${s.name}`);
    }
    console.log('\nPipeline solar Energy Depot configurado correctamente.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
