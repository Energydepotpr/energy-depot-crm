'use strict';
/**
 * POST /api/leads/:id/extract-factura
 * Body: { file: { name, mimeType, content (base64) } }
 * Llama a Claude Haiku con el PDF/imagen de factura LUMA y extrae 12 meses de kWh.
 * Devuelve: { meses: [number x 12], labels?: [string x 12], notes? }
 */

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de facturas de LUMA Energy en Puerto Rico.

EXTRAE estos campos SI aparecen en la factura:

1. **HISTORIAL DE CONSUMO** (página 3 o 4): gráfico de barras con 13 meses. Devuelve **LOS 13 VALORES** en orden cronológico (más antiguo → más reciente). Cada barra tiene un valor numérico arriba (ej: "3,084", "5,222") y un mes debajo (ej: "mar-25", "abr"). Convierte "3,084" → 3084. Si una barra es 0, pon 0.

2. **Nombre del cliente** (página 1, en mayúsculas, ej: "COLON MIRANDA,CARLOS R"). Devuélvelo en formato Title Case sin coma: "Carlos R Colon Miranda".

3. **Número de cuenta LUMA** (página 1, ej: "3601731000" — 10 dígitos).

4. **Dirección completa del servicio** (página 3, "Dirección del servicio:", ej: "A7 IMPERIO URB MANSIONES DE COAMO COAMO PR 00769"). Si tiene varias líneas en la página 1 ("MANS DE COAMO\\n231 CALLE IMPERIO\\nCOAMO PR 00769") únelo con comas.

5. **Email del cliente** y **teléfono del cliente**: extrae SOLO si aparecen claramente asociados al cliente (en la sección con su nombre y dirección, o etiquetados como "tel cliente", "email cliente", "celular", etc.).
   - **NUNCA** uses estos números (son de LUMA o agencias de gobierno):
     - 1-844-888-LUMA, 1-844-888-5862 (atención LUMA)
     - 787-523-6262, 787-523-6962, 787-523-6961 (NEPR, OIPC)
   - **NUNCA** uses estos correos (son institucionales):
     - cualquier @lumapr.com, nepr@jrsp.pr.gov, info@oipc.pr.gov, info@energia.pr.gov
     - cualquier dominio gubernamental (.pr.gov)
   - Si tienes duda de si el dato es del cliente, devuelve null. Mejor null que dato equivocado.

REGLAS:
- SOLO un JSON válido, sin markdown ni backticks.
- **13 valores** en \`meses\` en orden cronológico (antiguo → reciente). Es CRÍTICO devolver 13, no 12.
- Labels coinciden con los meses del gráfico ("mar-25","abr",...) — también 13.
- Si no encuentras un campo, ponlo como null.

Formato exacto:
{"meses":[756,759,922,778,1140,1360,1254,938,892,660,1031,658,758],"labels":["mar-22","abr","may","jun","jul","ago","sep","oct","nov","dic","ene","feb","mar-23"],"nombre":"Carlos R Colon Miranda","cuenta_luma":"3601731000","direccion":"A7 Imperio Urb Mansiones de Coamo, Coamo PR 00769","email":null,"telefono":null,"notes":"Histórico de página 4."}

Si no puedes extraer nada útil:
{"meses":[0,0,0,0,0,0,0,0,0,0,0,0,0],"labels":null,"nombre":null,"cuenta_luma":null,"direccion":null,"email":null,"telefono":null,"notes":"No pude leer la factura."}
`;

const MODEL = 'claude-haiku-4-5-20251001';

async function extractFactura(req, res) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY_COTIZAR || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });

    const file = req.body?.file;
    if (!file || !file.content) return res.status(400).json({ error: 'file requerido' });
    const mime = file.mimeType || 'application/pdf';
    const isPdf = mime === 'application/pdf';
    const isImg = mime.startsWith('image/');
    if (!isPdf && !isImg) return res.status(400).json({ error: 'Solo PDF o imagen' });

    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.content } }
      : { type: 'image',    source: { type: 'base64', media_type: mime,             data: file.content } };

    const payload = {
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: 'Extrae los kWh mensuales de esta factura. Devuelve solo el JSON sin nada más.' },
          ],
        },
      ],
    };

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('[extract-factura] Anthropic error:', data);
      return res.status(500).json({ error: data.error?.message || 'Error Anthropic' });
    }

    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    let parsed;
    try {
      // Strip code fences si vienen
      const clean = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('[extract-factura] parse fail. Text was:', text.slice(0, 300));
      return res.status(500).json({ error: 'Claude no devolvió JSON válido', raw: text });
    }

    // Validación + saneo — aceptar 12 o 13 meses
    const TARGET = 13;
    let meses = Array.isArray(parsed.meses) ? parsed.meses.slice(0, TARGET).map(v => Math.max(0, Math.round(Number(v) || 0))) : [];
    while (meses.length < TARGET) meses.push(0);
    const labels = Array.isArray(parsed.labels) && parsed.labels.length >= 12
      ? parsed.labels.slice(0, TARGET).map(s => String(s || '').slice(0, 16))
      : null;
    if (labels && labels.length < TARGET) while (labels.length < TARGET) labels.push('');

    // Safety: descartar emails/teléfonos institucionales aunque Claude los haya devuelto
    const blockedEmailDomains = ['lumapr.com', 'jrsp.pr.gov', 'oipc.pr.gov', 'energia.pr.gov', 'pr.gov'];
    const blockedPhones = ['18448885862','17875236262','17875236962','17875236961','8448885862','7875236262','7875236962','7875236961','844888luma','5188','LUMA'];
    const norm = (s) => String(s || '').replace(/[^0-9A-Za-z]/g, '').toLowerCase();
    const cleanEmail = (() => {
      const e = (parsed.email || '').trim();
      if (!e || !e.includes('@')) return null;
      const dom = e.split('@')[1].toLowerCase();
      if (blockedEmailDomains.some(b => dom === b || dom.endsWith('.' + b))) return null;
      return e;
    })();
    const cleanPhone = (() => {
      const p = (parsed.telefono || '').trim();
      if (!p) return null;
      const n = norm(p);
      if (blockedPhones.some(b => n.includes(norm(b)))) return null;
      return p;
    })();

    res.json({
      ok: true,
      meses,
      labels,
      nombre: parsed.nombre || null,
      cuenta_luma: parsed.cuenta_luma || null,
      direccion: parsed.direccion || null,
      email: cleanEmail,
      telefono: cleanPhone,
      notes: parsed.notes || '',
      usage: data.usage || null,
    });
  } catch (err) {
    console.error('[extract-factura]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// Endpoint público: extrae factura sin necesidad de un lead existente (para /cotizar form)
async function extractFacturaPublic(req, res) {
  // Reutilizamos extractFactura ignorando el req.params.id
  return extractFactura(req, res);
}

module.exports = { extractFactura, extractFacturaPublic };
