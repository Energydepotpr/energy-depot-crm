const https = require('https');
const jwt = require('jsonwebtoken');

const TOKEN = jwt.sign(
  { id: 1, name: 'Admin', email: 'admin@crm.com', role: 'admin' },
  'fixatrip-crm-2026-secret-xyz',
  { expiresIn: '2h' }
);

const BASE = 'crm-ia-production-c247.up.railway.app';

const guests = [
  { name: 'Sara',     phone: '+15854021201', date: '2026-03-07', code: 'HMBWBAQY8D' },
  { name: 'Gloria',   phone: '+19175574518', date: '2026-02-21', code: 'HMYTCRFSQR' },
  { name: 'Jessica',  phone: '+12103814524', date: '2026-03-22', code: 'HMHNFPM2PT' },
  { name: 'Amanda',   phone: '+17049991800', date: '2026-02-10', code: 'HM55Z9MCA5' },
  { name: 'Tayler',   phone: '+13307868326', date: '2026-01-14', code: 'HMAFH585KP' },
  { name: 'Maricela', phone: '+15034130403', date: '2026-02-25', code: 'HMZM9DR2FF' },
  { name: 'John',     phone: '+16462764086', date: '2026-02-28', code: 'HMJMYJXPBK' },
  { name: 'Sharvari', phone: '+18583195800', date: '2026-02-27', code: 'HMHE3...' },
  { name: 'Lauren',   phone: '+19146109735', date: '2026-02-09', code: 'HMZW35CR59' },
  { name: 'Kenzie',   phone: '+19796391729', date: '2026-01-12', code: 'HMBTTCA5SH' },
  { name: 'Erica',    phone: '+17179827466', date: '2026-03-03', code: 'HMNJFRNQDE' },
  { name: 'Rick',     phone: '+15748495673', date: '2025-11-27', code: 'HM5DBW4WP5' },
  { name: 'Vincent',  phone: '+17863616668', date: '2026-02-03', code: 'HMCTH8MM39' },
  { name: 'Blake',    phone: '+15128261071', date: '2026-01-24', code: 'HMWNRRHRBT' },
  { name: 'Johnny',   phone: '+18604287862', date: '2026-03-02', code: 'HMSR8MZHTB' },
  { name: 'Tulsi',    phone: '+19373806483', date: '2026-01-07', code: 'HMMRWYZR3B' },
];

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: BASE, port: 443, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  let ok = 0, skip = 0, fail = 0;

  for (const g of guests) {
    // 1. Check duplicate
    const check = await request('GET', `/api/contacts/check-duplicate?phone=${encodeURIComponent(g.phone)}`);
    if (check.exists) {
      console.log(`⚠️  SKIP (ya existe): ${g.name} ${g.phone}`);
      skip++;
      continue;
    }

    // 2. Create contact
    const notes = `Airbnb | Llegada: ${g.date} | Código: ${g.code}`;
    const contact = await request('POST', '/api/contacts', {
      name: g.name,
      phone: g.phone,
      notes,
      source: 'airbnb'
    });

    if (!contact.id) {
      console.log(`❌ ERROR creando contacto: ${g.name}`, contact);
      fail++;
      continue;
    }

    // 3. Create lead
    const lead = await request('POST', '/api/leads', {
      title: `${g.name} — Airbnb ${g.date}`,
      contact_id: contact.id,
      value: 0,
    });

    if (lead.id) {
      console.log(`✅ ${g.name} | ${g.phone} | ${g.date} | ${g.code}`);
      ok++;
    } else {
      console.log(`⚠️  Contacto creado pero lead falló: ${g.name}`, lead);
      ok++;
    }
  }

  console.log(`\nResultado: ${ok} agregados, ${skip} duplicados, ${fail} errores`);
}

main().catch(console.error);
