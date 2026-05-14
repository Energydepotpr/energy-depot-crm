-- Migración: tabla de citas (reservas públicas via /agendar)
-- Aplicar manualmente contra la DB Railway:
--   psql $DATABASE_URL -f backend/scripts/migrate-appointments.sql

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE SET NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  city VARCHAR(120),
  reason VARCHAR(40) NOT NULL,
  reason_other TEXT,
  type VARCHAR(20) NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  duration_min INT DEFAULT 30,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
