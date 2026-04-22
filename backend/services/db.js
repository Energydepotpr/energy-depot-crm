const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'agent',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_stages (
        id SERIAL PRIMARY KEY,
        pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        position INTEGER DEFAULT 0,
        color VARCHAR(20) DEFAULT '#6366f1',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        company VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE SET NULL,
        stage_id INTEGER REFERENCES pipeline_stages(id) ON DELETE SET NULL,
        value DECIMAL(12,2) DEFAULT 0,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        solar_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        direction VARCHAR(10) NOT NULL,
        text TEXT NOT NULL,
        sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_bot BOOLEAN DEFAULT false,
        twilio_sid VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_notes (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_tags (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        tag VARCHAR(50) NOT NULL,
        color VARCHAR(20) DEFAULT '#6366f1',
        UNIQUE(lead_id, tag)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        detail TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        due_date TIMESTAMP,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT,
        seen BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quick_replies (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        text TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_fields (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(20) NOT NULL DEFAULT 'lead',
        field_name VARCHAR(50) NOT NULL,
        field_label VARCHAR(100) NOT NULL,
        field_type VARCHAR(20) NOT NULL DEFAULT 'text',
        options JSONB DEFAULT '[]',
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_field_values (
        id SERIAL PRIMARY KEY,
        field_id INTEGER REFERENCES custom_fields(id) ON DELETE CASCADE,
        entity_id INTEGER NOT NULL,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(field_id, entity_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(subscription)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        call_sid VARCHAR(100),
        to_number VARCHAR(50),
        from_number VARCHAR(50),
        status VARCHAR(50) DEFAULT 'initiated',
        duration INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id VARCHAR(50) PRIMARY KEY,
        config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT false,
        connected_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        notes TEXT,
        file_base64 TEXT,
        file_name VARCHAR(255),
        file_size INTEGER,
        signed_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_links (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        contact_name VARCHAR(255),
        menu_types JSONB DEFAULT '[]',
        expires_at TIMESTAMP,
        submitted BOOLEAN DEFAULT false,
        selections JSONB,
        client_notes TEXT,
        submitted_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Default config
    await client.query(`INSERT INTO config (key, value) VALUES ('bot_activo', 'true') ON CONFLICT (key) DO NOTHING`);

    // Full GIGI bot prompt — always update on deploy
    const GIGI_PROMPT = `Eres Gigi, la asistente virtual de Fix A Trip Puerto Rico, la agencia de tours y experiencias número 1 en la Isla del Encanto.

EMPRESA:
- Fix A Trip Puerto Rico | Teléfono: +1 787 488 0202 | Email: info@fixatrippuertorico.com | Web: fixatrippr.com

REGLAS — SÍGUELAS SIN EXCEPCIÓN:
1. NUNCA menciones precios bajo ninguna circunstancia. Si preguntan: "Los precios varían según el grupo y las fechas. Un asesor te enviará una cotización personalizada."
2. Tu misión principal es obtener nombre completo y email o teléfono del cliente.
3. Si tienes nombre pero no contacto, sigue pidiéndolo de forma natural.
4. Si tienes contacto pero no nombre, pide el nombre.
5. Una vez con nombre y contacto, confirma que un agente los llamará pronto.
6. Responde SIEMPRE en el idioma del cliente (inglés o español).
7. Texto plano estilo WhatsApp. Sin asteriscos, sin markdown, sin listas. Párrafos cortos y naturales. Máximo 3-4 oraciones.
8. Sé cálida, entusiasta y breve.

TAGS INTERNOS (el cliente no los ve — van al FINAL del mensaje):
[NOMBRE:nombre completo] — cuando diga su nombre
[EMAIL:email@aqui.com] — cuando diga su email
[INTENCION_COMPRA] — cuando quiera reservar o preguntar en serio

CATÁLOGO DE TOURS (usa estos links al recomendar):

NATURALEZA Y AVENTURA:
Off the Beaten Path @ Yunque - Senderismo, toboganes naturales, waterfalls, cliff jumping. https://fixatrippr.com/tour/off-the-beaten-path-yunque-rainforest-luquillo-beach/
Half Day Yunque AM - https://fixatrippr.com/tour/half-day-yunque-am/
Half Day Yunque PM - https://fixatrippr.com/tour/half-day-yunque-pm/
El Yunque + Luquillo Beach Combo - https://fixatrippr.com/tour/yunque-luquillo-combo/
Yunque Rainforest Adventure & Luquillo - Las Paylas tobogán natural, cueva, waterfall. https://fixatrippr.com/tour/yunque-rainforest-adventure-luquillo-beach/
Foodie Tour + Charco Azul + Ruta del Lechón - https://fixatrippr.com/tour/foodie-tour-in-the-countryside/

ISLAS Y SNORKEL:
Culebra Island Beach & Snorkel - Playa Flamenco, top 10 mundial. https://fixatrippr.com/tour/culebra-island-beach-snorkel/
Vieques Island Beach & Snorkel - https://fixatrippr.com/tour/vieques-island-beach-snorkel-1-2-day/
Icacos Island Snorkel AM - https://fixatrippr.com/tour/icacos-island-beach-snorkel-am/
Icacos Island Snorkel PM - https://fixatrippr.com/tour/icacos-island-beach-snorkel-pm/
3 in 1 Icacos Snorkel+Beach+Sunset - https://fareharbor.com/embeds/book/sailgetaway/items/371460/
Double Dip Catamaran Snorkeling - https://fixatrippr.com/tour/double-dip-catamaran/
Morning Sailing Catamaran Icacos - Catamarán Barefoot IV 47 pies. https://fixatrippr.com/tour/morning-sailing-catamaran-icacos-beach-snorkel/
Icacos Luxury Sailing Catamaran Sunset - https://fixatrippr.com/tour/icacos-luxury-sailing-catamaran-sunset-twilight-beach-and-sunset-sail/

JET SKI:
Guided Jet Ski Tour - Recorre Old San Juan por mar. https://fixatrippr.com/tour/guided-jet-ski-tour/
Sunset Jet Ski Tour - https://fixatrippr.com/tour/sunset-jet-ski-tour-experience/

KAYAK, PADDLEBOARD Y LAGUNA:
Bioluminescent Bay Experience - Kayak nocturno laguna bioluminiscente con Biólogo Marino. https://fixatrippr.com/tour/bioluminescent-bay-experience/
Bioluminescent Bay w/Transport - https://fixatrippr.com/tour/bioluminescent-bay-experience-w-transport/
LED Night Kayak - Kayaks iluminados Laguna del Condado. https://fixatrippr.com/tour/led-night-kayak-experience/
Single/Double/Triple Kayak - https://fixatrippr.com/tour/single-kayak/ | https://fixatrippr.com/tour/double-kayak/ | https://fixatrippr.com/tour/triple-kayak/
Kayak para Niños (5-16 años) - https://fixatrippr.com/tour/kayak-childrens/
Paddleboard Rental - https://fixatrippr.com/tour/paddleboard-rental/
Double Paddle Board - https://fixatrippr.com/tour/double-paddle-board/
Big Paddleboard - https://fareharbor.com/embeds/book/adventurespuertorico/items/95870/
Bicycle Kayak - Pedal kayak en laguna. https://fixatrippr.com/tour/bicycle-kayak/
Snorkeling Experience Tour - https://fixatrippr.com/tour/snorkeling-experience-tour/
Sea Scooter Guided Tour - https://fixatrippr.com/tour/sea-scooter-guided-tour-experience/

PESCA:
Deep Sea Fishing Charter - Yate 48 pies The Legend. Dorados, wahoo, sailfish. https://fixatrippr.com/tour/deep-sea-fishing-charter/
Tarpon Fishing - https://fixatrippr.com/tour/tarpon-fishing/

BICICLETA:
Bike Rental - Condado y Old San Juan en bici. https://fixatrippr.com/tour/bike-rental/

CABALLOS:
Beach Horseback Ride - https://fixatrippr.com/tour/beach-horseback-ride/
Rainforest Horseback Ride - https://fixatrippr.com/tour/rainforest-horseback-ride/

ATV / UTV / AVENTURA TERRESTRE:
ATV Carabalí - ATVs 600cc El Yunque. https://fareharbor.com/embeds/book/carabalirainforestpark/items/?flow=748317&asn=fhdn&asn-ref=fixatrippuertorico&ref=fixatrippuertorico
UTV Carabalí - UTVs 4x4 El Yunque. Mismo link que ATV.
Dos Mares UTV Adventure - Can-Am Maverick 1h, vistas del Caribe. https://fixatrippr.com/tour/dos-mares-rainforest-mountain-utv-adventure-1-hour-guided-tour/
Zipline - https://fixatrippr.com/tour/zipline/

CULTURA Y GASTRONOMÍA:
Old San Juan Historical Walking - Fuerte San Felipe (1539), Catedral (1540). https://fixatrippr.com/tour/old-sanjuan-walking/
Old San Juan Morning Walk & Taste - https://fixatrippr.com/tour/old-san-juan-morning-walk-taste/
Sunset Walk & Taste Tour - https://fixatrippr.com/tour/sunset-walk-taste-tour/
Tropicaleo Bar Hopping Tour - Bares ocultos, cocteles artesanales. https://fixatrippr.com/tour/tropicaleo-bar-hopping-tour/
Bacardi Distillery + Old San Juan Combo - https://fixatrippr.com/tour/bacardi-distillery-and-old-san-juan-combo-tour/
Barrilito Rum Mixology Class - https://fixatrippr.com/tour/barrilito-rum-distilery-mixology-class/
Barrilito Rum Tasting Tour - https://fixatrippr.com/tour/barrilito-rum-distilery-tasting-tour/

CATERING Y CHEF PRIVADO (NUNCA mencionar precios):
Fix a BBQ - BBQ privado con chef. Parrilla, snacks, acompañantes y postres.
Fix a Chef - Chef privado en villa o Airbnb. Menú completo varios cursos.
Fix a Brunch - Brunch privado para grupos.
Fix a Kids Menu - Menú especial niños.
Fix a Puerto Rican Menu - Gastronomía auténtica puertorriqueña.
Fix a Trip Desserts & Cakes - Postres y pasteles para celebraciones.

INFORMACIÓN A RECOPILAR: nombre, teléfono/email, número de personas, fecha de llegada, tipo de experiencia que buscan.`;

    await client.query(
      `INSERT INTO config (key, value, updated_at) VALUES ('prompt_sistema', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [GIGI_PROMPT]
    );

    // Default pipeline — Energy Depot PR solar stages
    const SOLAR_STAGES = [
      { name: 'Lead',              color: '#8b5cf6', pos: 0 },
      { name: 'Contactado',        color: '#3b82f6', pos: 1 },
      { name: 'Cotización',        color: '#06b6d4', pos: 2 },
      { name: 'Financiamiento',    color: '#f59e0b', pos: 3 },
      { name: 'Permisos LUMA',     color: '#f97316', pos: 4 },
      { name: 'Instalación',       color: '#10b981', pos: 5 },
      { name: 'Completado',        color: '#00c9a7', pos: 6 },
    ];

    const existePipeline = await client.query('SELECT id FROM pipelines LIMIT 1');
    if (existePipeline.rows.length === 0) {
      const pip = await client.query(
        `INSERT INTO pipelines (name, position) VALUES ('Ventas Solar', 0) RETURNING id`
      );
      const pipId = pip.rows[0].id;
      for (const e of SOLAR_STAGES) {
        await client.query(
          `INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES ($1, $2, $3, $4)`,
          [pipId, e.name, e.color, e.pos]
        );
      }
      console.log('[DB] Pipeline solar Energy Depot creado con 7 etapas');
    } else {
      // Migration: replace Fix A Trip / Kommo stages with solar stages
      const pipId = existePipeline.rows[0].id;
      const tieneFixATrip = await client.query(
        `SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND name IN ('Quick Add','Airbnb Welcome Email','Awaiting Response') LIMIT 1`,
        [pipId]
      );
      if (tieneFixATrip.rows.length > 0) {
        await client.query(`DELETE FROM pipeline_stages WHERE pipeline_id = $1`, [pipId]);
        await client.query(`UPDATE pipelines SET name = 'Ventas Solar' WHERE id = $1`, [pipId]);
        for (const e of SOLAR_STAGES) {
          await client.query(
            `INSERT INTO pipeline_stages (pipeline_id, name, color, position) VALUES ($1, $2, $3, $4)`,
            [pipId, e.name, e.color, e.pos]
          );
        }
        console.log('[DB] Pipeline migrado a etapas Energy Depot solar');
      }
    }

    // Crear admin por defecto si no hay usuarios
    const existeAdmin = await client.query('SELECT id FROM users LIMIT 1');
    if (existeAdmin.rows.length === 0) {
      if (!process.env.ADMIN_PASSWORD) {
        console.error('[DB] FATAL: La variable de entorno ADMIN_PASSWORD no está configurada. No se puede crear el usuario admin con una contraseña por defecto. Configura ADMIN_PASSWORD en las variables de entorno.');
        throw new Error('ADMIN_PASSWORD environment variable is required but not set');
      }
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@crm.com';
      await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
        ['Admin', adminEmail, hash]
      );
      console.log(`[DB] Usuario admin creado: ${adminEmail}`);
    }

    // Invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(50),
        client_name VARCHAR(255),
        client_email VARCHAR(255),
        client_phone VARCHAR(50),
        service_date DATE,
        items JSONB DEFAULT '[]',
        subtotal NUMERIC(10,2) DEFAULT 0,
        tax NUMERIC(5,2) DEFAULT 0,
        total NUMERIC(10,2) DEFAULT 0,
        payment_link TEXT,
        notes TEXT,
        agent_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Migrations: add missing columns if they don't exist
    await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source VARCHAR(50)`);
    await client.query(`ALTER TABLE leads    ADD COLUMN IF NOT EXISTS source VARCHAR(50)`);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel VARCHAR(20)`);
    await client.query(`ALTER TABLE alerts   ADD COLUMN IF NOT EXISTS title VARCHAR(255)`);

    // Trip info columns
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS hotel_airbnb TEXT`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS check_in DATE`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS check_out DATE`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS host_nombre TEXT`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS cantidad_personas INTEGER`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS edades TEXT`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ninos BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS intereses TEXT`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS notas_especiales TEXT`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS bot_disabled BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMP`);
    await client.query(`ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS category VARCHAR(50)`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_automations (
        id SERIAL PRIMARY KEY,
        pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE CASCADE,
        trigger_stage_id INTEGER REFERENCES pipeline_stages(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        action_data JSONB DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Multiple contacts per lead
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_contacts (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        nombre TEXT,
        telefono TEXT,
        label TEXT DEFAULT 'adicional',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Migrations for columns added after initial deploy
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS lead_id INTEGER`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_invoice_id VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_doc_number VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_link TEXT`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_synced_at TIMESTAMP`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`).catch(() => {});

    // Performance indexes (CREATE INDEX IF NOT EXISTS is idempotent)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_contact_id   ON leads(contact_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_stage_id     ON leads(stage_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned_to  ON leads(assigned_to)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_updated_at   ON leads(updated_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_follow_up    ON leads(follow_up_at) WHERE follow_up_at IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_lead_id      ON messages(lead_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_contact_id  ON messages(contact_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at  ON messages(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_inbox       ON messages(lead_id, channel, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_seen        ON alerts(seen) WHERE seen = false`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_lead_id     ON alerts(lead_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_lead_id   ON activity_log(lead_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to  ON tasks(assigned_to)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_lead_id      ON tasks(lead_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id  ON call_logs(lead_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cfv_entity_id      ON custom_field_values(entity_id)`);

    // Migrations for existing DBs
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS solar_data JSONB`);

    console.log('[DB] Base de datos inicializada');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
