-- Migration: contratos_firma
-- Tabla para flujo de firma electrónica del cliente sobre el contrato solar.

CREATE TABLE IF NOT EXISTS contratos_firma (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  pdf_base64 TEXT NOT NULL,
  contrato_data JSONB,
  signature_base64 TEXT,
  signed_at TIMESTAMP,
  signed_ip VARCHAR(64),
  signed_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_contratos_firma_lead  ON contratos_firma(lead_id);
CREATE INDEX IF NOT EXISTS idx_contratos_firma_token ON contratos_firma(token);
