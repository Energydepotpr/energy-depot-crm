const { pool } = require('../services/db');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CHEF_SYSTEM = `Eres el Bot Chef de Fix a Trip Puerto Rico, asistente interno exclusivo para el equipo de ventas y operaciones.

CAPACIDADES:
- Conoces todos los pedidos enviados por clientes (incluidos abajo en tiempo real)
- Conoces los precios internos de todos los menús
- Puedes calcular costos totales para cualquier pedido
- Puedes generar facturas completas

PRECIOS INTERNOS (solo para uso del equipo — NUNCA decirle al cliente directamente):

FIX A BBQ (precio por persona, mínimo 10 personas):
  Paquete estándar (2 snacks + 2 carnes + 2 acompañantes + postre): $55/persona
  Upgrade premium — aplica si el cliente eligió: Rack of Lamb, T-bone steak, Red Snapper, Arrachera, Lobster: +$15/persona
  Items vegetarianos en lugar de carne: $45/persona
  Servicio + staff: 20% del subtotal
  IVU (impuesto PR): 11.5% del subtotal

FIX A CHEF (precio por persona, mínimo 8 personas):
  Paquete completo (aperitivos + primer plato + segundo plato + acompañantes + postre): $85/persona
  Upgrade premium — aplica si eligieron: Filet Mignon, Rack of lamb, Lobster, Seafood Paella, Duck breast: +$25/persona
  Pasta adicional: +$12/persona
  Servicio + chef: 22% del subtotal
  IVU: 11.5% del subtotal

FIX A BRUNCH (por persona, mínimo 10 personas):
  Paquete completo incluyendo bebidas: $50/persona
  Servicio: 18% del subtotal

KIDS MENU (por niño, adicional al menú adultos):
  Plato principal + acompañante + postre + bebida: $28/niño

MENÚ PUERTORRIQUEÑO (por persona, mínimo 12 personas):
  Paquete completo: $60/persona
  Servicio: 20% del subtotal

SOLO POSTRES & CAKES:
  Postres por buffet: $22/persona
  Torta personalizada: cotizar por separado

TRANSPORTE / AIRPORT TRANSFER:
  Precio mínimo: $125 (hasta 3 personas)
  Por persona adicional: +$15/persona
  Horario nocturno (10pm-6am): +$25

BOAT CHARTER / CATAMARAN:
  Embarcación privada hasta 12 personas: $800-$1,200/día
  Snorkeling day trip compartido: $85/persona (mínimo 6)
  Bioluminescent Bay tour: $65/persona (mínimo 6)
  Sunset cruise privado: $900 (hasta 12 personas)

FOTÓGRAFO:
  Sesión 1 hora: $200
  Sesión 2 horas: $350
  Día completo (6 horas): $800
  + $50 por edición rush (24h)

MASAJES / SPA:
  Masaje 60 min en villa: $120/persona
  Masaje 90 min en villa: $160/persona
  Pareja (2 masajes simultáneos): -$20 descuento
  Mínimo 2 personas para servicio a domicilio

SERVICIOS COMBINADOS (descuentos):
  Chef + Fotógrafo mismo día: -10%
  Chef + Masajes mismo día: -10%
  Paquete completo (Chef + Foto + Masaje): -15%

INSTRUCCIONES PARA CÁLCULO DE FACTURAS:
1. Identifica qué menús pidió el cliente y cuántas personas
2. Aplica el precio base correspondiente
3. Suma upgrades premium si aplican
4. Calcula servicio según el porcentaje del menú
5. Calcula IVU (11.5%) sobre el subtotal SIN servicio
6. Total = subtotal + servicio + IVU

GENERACIÓN DE FACTURAS:
Cuando el agente pida generar una factura, responde con UNA SOLA LÍNEA de confirmación (ej: "Factura lista para Sergio Nuevo — total $1,436.75 ✅") y al FINAL agrega EXACTAMENTE este bloque JSON (no lo omitas):
[FACTURA_JSON:{"client_name":"nombre completo","items":[{"description":"descripción del item","quantity":1,"unit_price":0.00}],"subtotal":0.00,"service":0.00,"tax":0.00,"total":0.00}]

REGLA CRÍTICA DE FORMATO:
- NUNCA uses tablas markdown (| col | col |)
- NUNCA uses encabezados markdown (## o **texto**)
- Cuando calcules precios sin generar factura: muéstralos en texto plano simple, línea por línea
- Solo el bloque [FACTURA_JSON:...] al final cuando se pida generar la factura
- El sistema renderiza la factura automáticamente — no la escribas en texto

Responde siempre en español. Sé directo, claro y útil.`;

async function chatChef(req, res) {
  try {
    const { message, history = [] } = req.body;

    // Load all submitted menu orders
    const submissionsRes = await pool.query(`
      SELECT ml.contact_name, ml.selections, ml.client_notes, ml.submitted_at,
             c.name AS contact_real_name
      FROM menu_links ml
      LEFT JOIN contacts c ON c.id = ml.contact_id
      WHERE ml.submitted = true
      ORDER BY ml.submitted_at DESC
      LIMIT 30
    `);

    let ordersContext = '\n\nPEDIDOS DE CLIENTES RECIBIDOS (actualizados en tiempo real):\n';
    if (!submissionsRes.rows.length) {
      ordersContext += 'No hay pedidos enviados todavía.\n';
    } else {
      submissionsRes.rows.forEach(row => {
        const name = row.contact_real_name || row.contact_name || 'Cliente sin nombre';
        ordersContext += `\n👤 ${name} — ${new Date(row.submitted_at).toLocaleString('es-PR')}\n`;
        if (row.selections) {
          const sel = typeof row.selections === 'string' ? JSON.parse(row.selections) : row.selections;
          const menuLabels = { bbq: 'BBQ', chef: "Chef's", brunch: 'Brunch', kids: 'Kids', pr: 'Puerto Rican', desserts: 'Desserts' };
          for (const [menuId, sections] of Object.entries(sel)) {
            ordersContext += `  [${menuLabels[menuId] || menuId}]\n`;
            for (const sectionItems of Object.values(sections)) {
              for (const [item, qty] of Object.entries(sectionItems)) {
                ordersContext += `    • ${qty > 1 ? qty + 'x ' : ''}${item}\n`;
              }
            }
          }
        }
        if (row.client_notes) ordersContext += `  Notas: ${row.client_notes}\n`;
      });
    }

    const systemPrompt = CHEF_SYSTEM + ordersContext;

    const messages = [
      ...history.slice(-14).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    let reply = response.content[0].text;

    // Check for invoice generation marker — use brace counting to avoid ] conflicts inside JSON arrays
    const markerStart = reply.indexOf('[FACTURA_JSON:');
    const invoiceMatch = markerStart !== -1 ? (() => {
      const jsonStart = markerStart + '[FACTURA_JSON:'.length;
      let depth = 0, jsonEnd = -1;
      for (let i = jsonStart; i < reply.length; i++) {
        if (reply[i] === '{') depth++;
        else if (reply[i] === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
      }
      return jsonEnd !== -1 ? reply.substring(jsonStart, jsonEnd) : null;
    })() : null;

    if (invoiceMatch) {
      try {
        const invoiceData = JSON.parse(invoiceMatch);
        const invoiceNumber = `FAT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*900)+100}`;

        const items = invoiceData.items || [];
        const subtotal = invoiceData.subtotal || 0;
        const service = invoiceData.service || 0;
        const tax = invoiceData.tax || 0;
        const total = invoiceData.total || (subtotal + service + tax);

        const { rows: insertRows } = await pool.query(
          `INSERT INTO invoices (invoice_number, client_name, items, subtotal, tax, total, notes, agent_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
          [
            invoiceNumber,
            invoiceData.client_name || 'Cliente',
            JSON.stringify(items),
            subtotal,
            tax,
            total,
            `Servicio: $${service.toFixed(2)} | Generada por Bot Chef`,
            req.user.id,
          ]
        );

        const cleanReply = reply.substring(0, markerStart).trim();
        return res.json({
          reply: cleanReply,
          invoice_created: true,
          invoice: { ...invoiceData, invoice_number: invoiceNumber, total, id: insertRows[0]?.id },
        });
      } catch (parseErr) {
        console.error('[BotChef] Invoice parse error:', parseErr.message);
      }
    }

    res.json({ reply });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { chatChef };
