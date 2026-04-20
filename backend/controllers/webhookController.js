const { pool } = require('../services/db');
const { generarRespuesta, extraerIntento, extraerGrupoGrande, extraerGrupoPequeno } = require('../services/claudeService');
const { enviarSMS, enviarWhatsApp } = require('../services/twilioService');
const { sendToAll } = require('./pushController');
const sse = require('../services/sse');
const twilio = require('twilio');

// ── Welcome Email al cliente ─────────────────────────────────────────────────
async function sendWelcomeEmail(contactEmail, contactName) {
  if (!contactEmail) return;
  try {
    // Obtener template de la DB (o usar default)
    const { rows } = await pool.query(`SELECT value FROM config WHERE key='welcome_email_template' LIMIT 1`);
    const tpl = rows[0]?.value || {};
    if (tpl.enabled === false) return; // desactivado desde config

    const subject = tpl.subject || 'Welcome to Fix A Trip Puerto Rico! 🌴';
    const bodyHtml = tpl.body_html
      ? tpl.body_html.replace(/{{name}}/gi, contactName || 'there')
      : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);padding:40px 32px;text-align:center;">
          <img src="https://fixatrippr.com/logo.png" alt="Fix A Trip PR" style="height:50px;margin-bottom:16px;" onerror="this.style.display='none'"/>
          <h1 style="color:#fff;margin:0;font-size:26px;">Welcome to Fix A Trip Puerto Rico!</h1>
        </div>
        <div style="padding:32px;">
          <p style="font-size:16px;color:#333;">Hi <strong>${contactName || 'there'}</strong>,</p>
          <p style="font-size:15px;color:#555;line-height:1.6;">
            Thank you for reaching out! We've received your inquiry and one of our travel specialists will be in touch with you shortly to help plan your perfect Puerto Rico experience.
          </p>
          <p style="font-size:15px;color:#555;line-height:1.6;">
            In the meantime, feel free to browse our tours and experiences at our website.
          </p>
          <div style="background:#f0f9ff;border-radius:10px;padding:20px;margin:24px 0;">
            <p style="margin:0;font-size:14px;color:#0369a1;font-weight:bold;">📞 Questions? Reach us anytime:</p>
            <p style="margin:8px 0 0;font-size:14px;color:#555;">
              Phone / WhatsApp: <a href="tel:+17873700218" style="color:#0369a1;">(787) 370-0218</a><br/>
              Email: <a href="mailto:info@fixatrippr.com" style="color:#0369a1;">info@fixatrippr.com</a>
            </p>
          </div>
          <p style="font-size:15px;color:#555;">We look forward to making your trip unforgettable! 🌴</p>
          <p style="font-size:15px;color:#333;"><strong>The Fix A Trip Team</strong></p>
        </div>
        <div style="background:#f8fafc;padding:20px;text-align:center;font-size:12px;color:#999;">
          Fix A Trip Puerto Rico · <a href="https://fixatrippr.com" style="color:#0369a1;">fixatrippr.com</a><br/>
          Reply STOP to unsubscribe from emails.
        </div>
      </div>`;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'mail.fixatrippr.com',
      port: parseInt(process.env.MAIL_PORT || '587'),
      secure: false,
      tls: { rejectUnauthorized: false },
      auth: {
        user: process.env.BOOKINGS_EMAIL || 'bookings@fixatrippr.com',
        pass: process.env.BOOKINGS_PASS || '',
      },
    });
    await transporter.sendMail({
      from: '"Fix A Trip Puerto Rico" <bookings@fixatrippr.com>',
      to: contactEmail,
      subject,
      html: bodyHtml,
    });
    console.log(`[WELCOME EMAIL] Enviado a ${contactEmail}`);
  } catch (err) {
    console.warn('[WELCOME EMAIL] Error (non-fatal):', err.message);
  }
}

// Migration: add media_urls column to messages if not exists
(async () => {
  try {
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'`);
  } catch (err) {
    console.error('[WEBHOOK] Error adding media_urls column:', err.message);
  }
})();

function detectarEmail(texto) {
  const match = texto.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function extraerTags(texto) {
  const nombreMatch = texto.match(/\[NOMBRE:([^\]]+)\]/);
  const emailMatch  = texto.match(/\[EMAIL:([^\]]+)\]/);
  const intencion   = texto.includes('[INTENCION_COMPRA]');
  const limpio = texto
    .replace(/\[NOMBRE:[^\]]+\]/g, '')
    .replace(/\[EMAIL:[^\]]+\]/g, '')
    .replace(/\[TELEFONO:[^\]]+\]/g, '')
    .replace(/\[INTENCION_COMPRA\]/g, '')
    .replace(/\[GRUPO_GRANDE\]/g, '')
    .replace(/\[GRUPO_PEQUEÑO\]/g, '')
    .replace(/\[[^\]]+\]/g, '')          // catch-all: cualquier [TAG] restante
    .replace(/\*\*(.*?)\*\*/gs, '$1')    // **negrita** → texto plano
    .replace(/\*(.*?)\*/gs, '$1')        // *cursiva* → texto plano
    .replace(/_{2}(.*?)_{2}/gs, '$1')    // __negrita__ → texto plano
    .replace(/_(.*?)_/gs, '$1')          // _cursiva_ → texto plano
    .replace(/#{1,6}\s/g, '')            // # encabezados → sin símbolo
    .trim();
  return { nombre: nombreMatch?.[1].trim() || null, email: emailMatch?.[1].trim() || null, intencion, limpio };
}

// Lógica compartida para procesar cualquier mensaje entrante
async function procesarMensaje(from, body, sid, channel, mediaUrls = []) {
  // Buscar o crear contacto
  let contacto = (await pool.query('SELECT * FROM contacts WHERE phone = $1', [from])).rows[0];
  if (!contacto) {
    contacto = (await pool.query(
      `INSERT INTO contacts (name, phone, source) VALUES ($1,$2,$3) RETURNING *`,
      [from, from, channel]
    )).rows[0];
  }

  // Capturar email si viene en el texto
  const emailEnMensaje = detectarEmail(body);
  if (emailEnMensaje && !contacto.email) {
    await pool.query('UPDATE contacts SET email=$1, updated_at=NOW() WHERE id=$2', [emailEnMensaje, contacto.id]);
    contacto.email = emailEnMensaje;
  }

  // Buscar o crear lead
  let lead = (await pool.query(
    `SELECT l.* FROM leads l WHERE l.contact_id=$1 ORDER BY l.updated_at DESC LIMIT 1`, [contacto.id]
  )).rows[0];

  if (!lead) {
    const pip   = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
    const pipId = pip.rows[0]?.id || null;
    const stage = pipId
      ? (await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id=$1 ORDER BY position LIMIT 1', [pipId])).rows[0]
      : null;
    lead = (await pool.query(
      `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [`Conversación con ${contacto.name}`, contacto.id, pipId, stage?.id || null, channel]
    )).rows[0];
  }

  // Guardar mensaje entrante
  await pool.query(
    `INSERT INTO messages (lead_id, contact_id, direction, text, twilio_sid, channel, media_urls) VALUES ($1,$2,'inbound',$3,$4,$5,$6)`,
    [lead.id, contacto.id, body, sid || null, channel, JSON.stringify(mediaUrls)]
  );
  await pool.query('UPDATE leads SET updated_at=NOW() WHERE id=$1', [lead.id]);

  // Real-time SSE broadcast
  sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });

  // Push notification: new inbound message
  const contactName = contacto.name !== contacto.phone ? contacto.name : contacto.phone;
  sendToAll(
    `Nuevo mensaje de ${contactName}`,
    body.slice(0, 100),
    '/inbox'
  ).catch(() => {});

  return { contacto, lead };
}

// ── Webhook Twilio (SMS + WhatsApp) ─────────────────────────────────────────
async function twilioWebhook(req, res) {
  // Validate Twilio signature to prevent spoofed webhooks
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers['x-twilio-signature'] || '';
    // Build URL from env var (preferred) or reconstruct from request
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
    const webhookUrl = domain
      ? `https://${domain}/api/webhook/twilio`
      : `${req.protocol}://${req.get('host')}/api/webhook/twilio`;
    const valid = twilio.validateRequest(authToken, signature, webhookUrl, req.body || {});
    if (!valid) {
      // Try with HTTPS explicitly (Railway always uses HTTPS)
      const webhookUrlHttps = `https://${req.get('host')}/api/webhook/twilio`;
      const validHttps = twilio.validateRequest(authToken, signature, webhookUrlHttps, req.body || {});
      if (!validHttps) {
        if (process.env.TWILIO_SKIP_VALIDATION === 'true') {
          console.warn('[WEBHOOK] Invalid Twilio signature — skipping validation (TWILIO_SKIP_VALIDATION=true). URL tried:', webhookUrl);
        } else {
          console.warn('[WEBHOOK] Invalid Twilio signature — rejecting request. URL tried:', webhookUrl);
          return res.status(403).send('Forbidden');
        }
      }
    }
  }

  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');

  try {
    const raw  = req.body?.From || '';
    const body = req.body?.Body || '';
    const sid  = req.body?.MessageSid;
    if (!raw) return;

    // Extract media attachments (Twilio sends NumMedia, MediaUrl0, MediaContentType0, ...)
    const numMedia = parseInt(req.body?.NumMedia || '0', 10);
    const mediaUrls = [];
    for (let i = 0; i < numMedia; i++) {
      const url         = req.body?.[`MediaUrl${i}`];
      const contentType = req.body?.[`MediaContentType${i}`];
      if (url) mediaUrls.push({ url, contentType: contentType || 'application/octet-stream' });
    }

    // Allow messages with only media (no text body)
    if (!body && mediaUrls.length === 0) return;

    const channel = raw.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
    const from    = raw.replace('whatsapp:', '');

    // ── Reenviar a Kommo (espejo) ──────────────────────────────────────────
    // Kommo valida X-Twilio-Signature → firmamos con Auth Token y URL de Kommo.
    // También incluimos AccountSid para que Kommo identifique la integración.
    if (channel === 'sms' && process.env.KOMMO_TWILIO_WEBHOOK) {
      try {
        const https  = require('https');
        const crypto = require('crypto');
        const qs     = require('querystring');

        const kommoWebhookUrl = process.env.KOMMO_TWILIO_WEBHOOK;
        // Enviamos los mismos parámetros que Twilio enviaría normalmente
        const params = {
          AccountSid:  process.env.TWILIO_ACCOUNT_SID || '',  // crítico: Kommo lo usa para identificar la integración
          ApiVersion:  '2010-04-01',
          Body:        body,
          From:        raw,
          MessageSid:  sid || '',
          NumMedia:    req.body?.NumMedia || '0',
          NumSegments: req.body?.NumSegments || '1',
          SmsSid:      sid || '',
          SmsStatus:   'received',
          To:          process.env.KOMMO_TWILIO_NUMBER || '+17874880202',
        };

        // Twilio signature: HMAC-SHA1(url + sorted_key_value_pairs, authToken) → base64
        const authToken = process.env.TWILIO_AUTH_TOKEN || '';
        const sortedKeys = Object.keys(params).sort();
        const sigStr = kommoWebhookUrl + sortedKeys.map(k => k + params[k]).join('');
        const signature = crypto.createHmac('sha1', authToken).update(sigStr).digest('base64');

        const kommoPayload = qs.stringify(params);
        const kommoUrl = new URL(kommoWebhookUrl);
        const kommoReq = https.request({
          hostname: kommoUrl.hostname,
          path:     kommoUrl.pathname + kommoUrl.search,
          method:   'POST',
          headers:  {
            'Content-Type':        'application/x-www-form-urlencoded',
            'Content-Length':      Buffer.byteLength(kommoPayload),
            'X-Twilio-Signature':  signature,
          },
        }, res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            if (res.statusCode >= 400) {
              console.warn(`[WEBHOOK] Kommo mirror RECHAZADO ${res.statusCode}: ${body.slice(0, 200)}`);
            } else {
              console.log(`[WEBHOOK] Kommo mirror OK ${res.statusCode} desde ${from}`);
            }
          });
        });
        kommoReq.on('error', err => console.warn('[WEBHOOK] Kommo mirror error (non-fatal):', err.message));
        kommoReq.write(kommoPayload);
        kommoReq.end();
      } catch (mirrorErr) {
        console.warn('[WEBHOOK] Kommo mirror setup error:', mirrorErr.message);
      }
    }
    // ──────────────────────────────────────────────────────────────────────
    const bodyLog = body ? body.slice(0, 80) : `[${numMedia} media file(s)]`;
    console.log(`[WEBHOOK] ${channel.toUpperCase()} de ${from}: "${bodyLog}" | media: ${numMedia}`);

    // A2P compliance: Twilio maneja STOP/HELP automáticamente a nivel de red.
    // No respondemos con el bot para evitar conflictos.
    const bodyUpper = body.trim().toUpperCase();
    const stopKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    const helpKeywords = ['HELP', 'INFO'];
    if (stopKeywords.includes(bodyUpper)) {
      console.log(`[WEBHOOK] STOP recibido de ${from} — Twilio maneja el opt-out automáticamente`);
      return;
    }
    if (helpKeywords.includes(bodyUpper)) {
      console.log(`[WEBHOOK] HELP recibido de ${from} — Twilio maneja la respuesta automáticamente`);
      return;
    }

    const { contacto, lead } = await procesarMensaje(from, body || `[${numMedia} imagen(es)]`, sid, channel, mediaUrls);

    // Verificar bot activo
    const cfgs = await pool.query(`SELECT key, value FROM config WHERE key IN ('bot_activo','bot_hora_inicio','bot_hora_fin','bot_dias')`);
    const cfg = {};
    cfgs.rows.forEach(r => { cfg[r.key] = r.value; });

    if (cfg.bot_activo !== 'true') return;

    // Check per-lead bot disabled flag
    if (lead.bot_disabled) {
      console.log(`[WEBHOOK] Bot desactivado para lead ${lead.id} — sin respuesta automática`);
      return;
    }

    if (cfg.bot_hora_inicio && cfg.bot_hora_fin) {
      const horaActual = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
      if (horaActual < cfg.bot_hora_inicio || horaActual > cfg.bot_hora_fin) return;
    }

    if (cfg.bot_dias) {
      const diasPermitidos = cfg.bot_dias.split(',').map(Number);
      if (!diasPermitidos.includes(new Date().getDay() || 7)) return;
    }

    // Detectar si es el primer mensaje del bot en esta conversación
    const prevMsgs = await pool.query(
      `SELECT COUNT(*) FROM messages WHERE lead_id=$1 AND direction='outbound' AND is_bot=true`,
      [lead.id]
    );
    const esPrimerMensaje = parseInt(prevMsgs.rows[0].count) === 0;

    // Generar respuesta IA
    const stageR = await pool.query('SELECT name FROM pipeline_stages WHERE id=$1', [lead.stage_id]);
    const respuestaIA = await generarRespuesta(body, {
      nombre:            contacto.name,
      telefono:          contacto.phone,
      email:             contacto.email,
      leadId:            lead.id,
      leadTitulo:        lead.title,
      etapa:             stageR.rows[0]?.name || '',
      valor:             lead.value,
      tieneEmail:        !!contacto.email,
      tieneNombreReal:   contacto.name !== contacto.phone,
      cantidadPersonas:  lead.cantidad_personas ?? null,
      esPrimerMensaje,
    });

    const { nombre: nombreCapturado, email: emailCapturado, intencion: tieneIntento, limpio: textoSinDatos } = extraerTags(respuestaIA);
    const { texto: sinGrupoGrande, tieneGrupo } = extraerGrupoGrande(textoSinDatos);
    const { texto: respuestaLimpia, tieneGrupoPequeno } = extraerGrupoPequeno(sinGrupoGrande);

    if (nombreCapturado && /^[\d\s\+\-\(\)\.]{7,}$/.test(contacto.name)) {
      await pool.query('UPDATE contacts SET name=$1, updated_at=NOW() WHERE id=$2', [nombreCapturado, contacto.id]);
      await pool.query('UPDATE leads SET title=$1, updated_at=NOW() WHERE id=$2', [`Conversación con ${nombreCapturado}`, lead.id]);
    }
    if (emailCapturado && !contacto.email) {
      await pool.query('UPDATE contacts SET email=$1, updated_at=NOW() WHERE id=$2', [emailCapturado, contacto.id]);
    }
    if (tieneIntento) {
      const dupIntento = await pool.query(
        `SELECT 1 FROM alerts WHERE lead_id=$1 AND type='intencion_compra' AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
        [lead.id]
      ).catch(() => ({ rows: [] }));
      if (!dupIntento.rows.length) {
        await pool.query(`INSERT INTO alerts (lead_id, type, message) VALUES ($1,'intencion_compra',$2)`,
          [lead.id, `${contacto.name}: "${body.slice(0, 100)}"`]).catch(() => {});
      }
    }
    if (tieneGrupo) {
      const dupGrupo = await pool.query(
        `SELECT 1 FROM alerts WHERE lead_id=$1 AND type='grupo_grande' AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
        [lead.id]
      ).catch(() => ({ rows: [] }));
      if (!dupGrupo.rows.length) {
        await pool.query(`INSERT INTO alerts (lead_id, type, message) VALUES ($1,'grupo_grande',$2)`,
          [lead.id, `Grupo de 5+ personas: "${body.slice(0, 100)}"`]).catch(() => {});
      }
      await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Grupo Grande','#f59e0b') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
    }
    if (tieneGrupoPequeno) {
      await pool.query(`INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'Grupo Pequeño','#3b82f6') ON CONFLICT (lead_id, tag) DO NOTHING`, [lead.id]).catch(() => {});
    }

    // A2P compliance: agregar STOP disclaimer al primer mensaje SMS
    const mensajeFinal = (esPrimerMensaje && channel === 'sms')
      ? `${respuestaLimpia}\n\nReply STOP to unsubscribe. Msg&Data rates may apply.`
      : respuestaLimpia;

    // Enviar respuesta por el mismo canal
    if (channel === 'whatsapp') {
      await enviarWhatsApp(from, mensajeFinal);
    } else {
      await enviarSMS(from, mensajeFinal);
    }

    await pool.query(
      `INSERT INTO messages (lead_id, contact_id, direction, text, is_bot, channel) VALUES ($1,$2,'outbound',$3,true,$4)`,
      [lead.id, contacto.id, respuestaLimpia, channel]
    );
    sse.broadcast('new_message', { lead_id: lead.id, direction: 'outbound' });
    console.log(`[WEBHOOK] Respuesta ${channel} enviada — lead ${lead.id}`);
  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message);
  }
}

// Busca un valor de email en cualquier campo del body
function encontrarEmail(body) {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  // Primero busca en campos con nombres conocidos
  const camposEmail = ['email', 'correo', 'your-email', 'email_address', 'user_email', 'client_email', 'e-mail'];
  for (const campo of camposEmail) {
    const val = body[campo]?.toString().trim();
    if (val && emailRegex.test(val)) return val.toLowerCase();
  }
  // Si no, escanea todos los valores del body buscando un email
  for (const val of Object.values(body)) {
    const str = val?.toString().trim() || '';
    const match = str.match(emailRegex);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

// Busca teléfono en cualquier campo del body
function encontrarTelefono(body) {
  const camposTel = ['phone', 'telefono', 'tel', 'your-tel', 'phone_number', 'mobile', 'celular', 'whatsapp'];
  for (const campo of camposTel) {
    const val = body[campo]?.toString().trim();
    if (val && val.length >= 7) return val;
  }
  return null;
}

// Busca nombre en cualquier campo del body
function encontrarNombre(body) {
  const camposNombre = ['name', 'nombre', 'your-name', 'full_name', 'fullname', 'first_name', 'nombre_completo', 'client_name'];
  for (const campo of camposNombre) {
    const val = body[campo]?.toString().trim();
    if (val && val.length >= 2) return val;
  }
  return null;
}

// Busca plataforma de origen
function encontrarPlataforma(body) {
  const campos = ['source', 'platform', 'origen', 'app', 'integration', 'channel_source'];
  for (const campo of campos) {
    const val = body[campo]?.toString().trim();
    if (val) return val;
  }
  return null;
}

// Busca nombre de propiedad/tour/producto
function encontrarPropiedad(body) {
  const campos = ['property_name', 'property', 'listing_name', 'listing', 'unit_name', 'tour_name', 'tour', 'product_name', 'product', 'item_name', 'accommodation', 'rental_name'];
  for (const campo of campos) {
    const val = body[campo]?.toString().trim();
    if (val && val.length >= 2) return val;
  }
  return null;
}

// Busca mensaje en cualquier campo del body
function encontrarMensaje(body) {
  const camposMensaje = ['message', 'mensaje', 'your-message', 'comments', 'comment', 'texto', 'consulta', 'msg', 'body', 'content'];
  for (const campo of camposMensaje) {
    const val = body[campo]?.toString().trim();
    if (val && val.length >= 2) return val;
  }
  // Si no hay campo de mensaje, concatenar todos los valores restantes
  const excluir = new Set(['name','nombre','email','correo','phone','telefono','tel','your-name','your-email','your-tel','source','_wpcf7','_wpcf7_version','_wpcf7_locale','_wpcf7_unit_tag','_wpcf7_container_post','_wpnonce','action']);
  const extras = Object.entries(body)
    .filter(([k]) => !excluir.has(k) && !k.startsWith('_'))
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
  return extras || null;
}

// ── Webhook Formulario Web ───────────────────────────────────────────────────
async function webformWebhook(req, res) {
  try {
    console.log('[WEBFORM] Body recibido:', JSON.stringify(req.body).slice(0, 500));

    const nombre      = encontrarNombre(req.body);
    const emailLimpio = encontrarEmail(req.body);
    const telefono    = encontrarTelefono(req.body);
    const mensaje     = encontrarMensaje(req.body);
    const plataforma  = encontrarPlataforma(req.body);
    const propiedad   = encontrarPropiedad(req.body);

    if (!nombre && !emailLimpio && !telefono) {
      return res.status(400).json({ error: 'No se encontraron datos de contacto en el formulario' });
    }

    const nameUsado = nombre || emailLimpio?.split('@')[0] || telefono || 'Web Lead';

    // Buscar o crear contacto
    let contacto = null;
    if (emailLimpio) contacto = (await pool.query('SELECT * FROM contacts WHERE email=$1 LIMIT 1', [emailLimpio])).rows[0];
    if (!contacto && telefono) contacto = (await pool.query('SELECT * FROM contacts WHERE phone=$1 LIMIT 1', [telefono])).rows[0];
    if (!contacto) {
      contacto = (await pool.query(
        `INSERT INTO contacts (name, phone, email, source) VALUES ($1,$2,$3,'web') RETURNING *`,
        [nameUsado, telefono, emailLimpio]
      )).rows[0];
    } else {
      // Actualizar siempre con los datos más recientes del formulario
      await pool.query(
        `UPDATE contacts SET
           name  = COALESCE(NULLIF($1,''), name),
           phone = COALESCE(NULLIF($2,''), phone),
           email = COALESCE(NULLIF($3,''), email),
           updated_at = NOW()
         WHERE id = $4`,
        [nameUsado, telefono, emailLimpio, contacto.id]
      );
      contacto.email = emailLimpio || contacto.email;
      contacto.phone = telefono || contacto.phone;
    }

    // Crear lead nuevo por cada envío de formulario
    const pip   = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
    const pipId = pip.rows[0]?.id || null;
    const stage = pipId
      ? (await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id=$1 ORDER BY position LIMIT 1', [pipId])).rows[0]
      : null;

    // Construir título: "Lodgify — Casa Saffra: John" o "FareHarbor: John" o "John"
    let leadTitle = nameUsado;
    if (plataforma && propiedad) leadTitle = `${plataforma} — ${propiedad}: ${nameUsado}`;
    else if (plataforma) leadTitle = `${plataforma}: ${nameUsado}`;
    else if (propiedad) leadTitle = `${propiedad}: ${nameUsado}`;

    const leadSource = plataforma || 'web';

    const lead = (await pool.query(
      `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [leadTitle, contacto.id, pipId, stage?.id || null, leadSource]
    )).rows[0];

    // Guardar mensaje del formulario
    const textoMensaje = mensaje || `Formulario web de ${nameUsado}${emailLimpio ? ' — ' + emailLimpio : ''}${telefono ? ' — ' + telefono : ''}`;
    await pool.query(
      `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'web')`,
      [lead.id, contacto.id, textoMensaje]
    );
    sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });

    // Alerta para el agente
    await pool.query(
      `INSERT INTO alerts (lead_id, type, message) VALUES ($1,'web_form',$2)`,
      [lead.id, `Nuevo formulario web — ${nameUsado}${emailLimpio ? ' | ' + emailLimpio : ''}${telefono ? ' | ' + telefono : ''}`]
    ).catch(() => {});

    // Notificación por email a operations
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'mail.fixatrippr.com',
        port: parseInt(process.env.MAIL_PORT || '587'),
        secure: false,
        tls: { rejectUnauthorized: false },
        auth: {
          user: process.env.OPERATIONS_EMAIL || 'operations@fixatrippr.com',
          pass: process.env.OPERATIONS_PASS || '',
        },
      });
      const detalles = req.body;
      const htmlBody = `
        <h2 style="color:#1a73e8">Nueva Solicitud de Booking — Web</h2>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
          <tr><td style="padding:8px;color:#666;width:140px">Nombre</td><td style="padding:8px;font-weight:bold">${nameUsado}</td></tr>
          <tr style="background:#f5f5f5"><td style="padding:8px;color:#666">Email</td><td style="padding:8px">${emailLimpio || '—'}</td></tr>
          <tr><td style="padding:8px;color:#666">Teléfono</td><td style="padding:8px">${telefono || '—'}</td></tr>
          <tr style="background:#f5f5f5"><td style="padding:8px;color:#666">Tour</td><td style="padding:8px;font-weight:bold">${detalles.tour_name || detalles.propiedad || '—'}</td></tr>
          <tr><td style="padding:8px;color:#666">Fecha</td><td style="padding:8px">${detalles.date || '—'}</td></tr>
          <tr style="background:#f5f5f5"><td style="padding:8px;color:#666">Adultos</td><td style="padding:8px">${detalles.adults ?? '—'}</td></tr>
          <tr><td style="padding:8px;color:#666">Niños</td><td style="padding:8px">${detalles.children ?? '—'}</td></tr>
          <tr style="background:#f5f5f5"><td style="padding:8px;color:#666">Total estimado</td><td style="padding:8px;font-weight:bold;color:#1a73e8">$${detalles.estimated_total ?? '—'}</td></tr>
          <tr><td style="padding:8px;color:#666">Mensaje</td><td style="padding:8px">${mensaje || '—'}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#999">Lead #${lead.id} creado en el CRM</p>
      `;
      await transporter.sendMail({
        from: '"Fix A Trip Web" <operations@fixatrippr.com>',
        to: process.env.WEBFORM_NOTIFY_EMAIL || 'operations@fixatrippr.com',
        subject: `🏖️ Nueva solicitud de booking — ${detalles.tour_name || nameUsado}`,
        html: htmlBody,
      });
      console.log('[WEBFORM] Email de notificación enviado');
    } catch (mailErr) {
      console.warn('[WEBFORM] Email notification failed (non-fatal):', mailErr.message);
    }

    console.log(`[WEBFORM] Lead #${lead.id} — ${nameUsado} | email: ${emailLimpio} | tel: ${telefono}`);
    res.json({ ok: true, lead_id: lead.id });
  } catch (err) {
    console.error('[WEBFORM] Error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Webhook Email Inbound (SendGrid Inbound Parse) ───────────────────────────
async function emailWebhook(req, res) {
  // SendGrid requiere 200 inmediato o reintenta
  res.sendStatus(200);

  try {
    const fromRaw = req.body?.from || '';
    const subject = req.body?.subject || '(sin asunto)';
    const textBody = req.body?.text || req.body?.html?.replace(/<[^>]+>/g, ' ') || '';

    if (!fromRaw) return;

    // Parsear "Nombre <email@domain.com>" o solo "email@domain.com"
    const matchFull = fromRaw.match(/^(.*?)\s*<([^>]+)>/);
    const emailFrom = matchFull ? matchFull[2].trim().toLowerCase() : fromRaw.trim().toLowerCase();
    const nameFrom  = matchFull ? matchFull[1].trim().replace(/"/g, '') : emailFrom.split('@')[0];

    if (!emailFrom.includes('@')) return;

    console.log(`[EMAIL] De: ${emailFrom} | Asunto: ${subject}`);

    // Buscar o crear contacto
    let contacto = (await pool.query('SELECT * FROM contacts WHERE email=$1 LIMIT 1', [emailFrom])).rows[0];
    if (!contacto) {
      contacto = (await pool.query(
        `INSERT INTO contacts (name, email, source) VALUES ($1,$2,'email') RETURNING *`,
        [nameFrom, emailFrom]
      )).rows[0];
    }

    // Buscar lead activo o crear uno
    let lead = (await pool.query(
      `SELECT * FROM leads WHERE contact_id=$1 ORDER BY updated_at DESC LIMIT 1`, [contacto.id]
    )).rows[0];

    if (!lead) {
      const pip   = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
      const pipId = pip.rows[0]?.id || null;
      const stage = pipId
        ? (await pool.query('SELECT id FROM pipeline_stages WHERE pipeline_id=$1 ORDER BY position LIMIT 1', [pipId])).rows[0]
        : null;
      lead = (await pool.query(
        `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source) VALUES ($1,$2,$3,$4,'email') RETURNING *`,
        [`Email: ${subject.slice(0, 60)}`, contacto.id, pipId, stage?.id || null]
      )).rows[0];
    }

    // Guardar mensaje (primeras 2000 chars del body)
    const textoMensaje = textBody.trim().slice(0, 2000) || subject;
    await pool.query(
      `INSERT INTO messages (lead_id, contact_id, direction, text, channel) VALUES ($1,$2,'inbound',$3,'email')`,
      [lead.id, contacto.id, textoMensaje]
    );
    await pool.query('UPDATE leads SET updated_at=NOW() WHERE id=$1', [lead.id]);

    // Alerta para el agente (emails requieren respuesta manual)
    await pool.query(
      `INSERT INTO alerts (lead_id, type, message) VALUES ($1,'email',$2)`,
      [lead.id, `Email de ${nameFrom} (${emailFrom}): "${subject}"`]
    ).catch(() => {});

    console.log(`[EMAIL] Guardado — lead #${lead.id}`);
  } catch (err) {
    console.error('[EMAIL] Error:', err.message);
  }
}

// ── Webhook FareHarbor vía Zapier ────────────────────────────────────────────
// Zapier envía un POST aquí cada vez que hay un booking nuevo/actualizado en FH.
// Campos esperados (Zapier mapea los de FareHarbor a estos nombres):
//   booking_id, customer_name (o first_name + last_name), customer_email,
//   customer_phone, item_name (tour), availability_start_at, party_size,
//   amount_paid_total, booking_status
async function zapierFareharborWebhook(req, res) {
  // Responder 200 inmediatamente para que Zapier no reintente
  res.json({ ok: true });

  try {
    const b = req.body || {};
    console.log('[FAREHARBOR] Webhook recibido:', JSON.stringify(b).slice(0, 400));

    // ── Extraer campos ──────────────────────────────────────────────────────
    const bookingId = b.booking_id || b.id || b.fh_booking_id || '';

    // Nombre: acepta customer_name, o first_name + last_name, o name
    let nombre = b.customer_name || b.name || '';
    if (!nombre && (b.first_name || b.last_name)) {
      nombre = `${b.first_name || ''} ${b.last_name || ''}`.trim();
    }
    nombre = nombre || 'FareHarbor Guest';

    const email  = (b.customer_email || b.email || '').toLowerCase().trim() || null;
    const phone  = (b.customer_phone || b.phone || b.telephone || '').trim() || null;
    const tour   = b.item_name || b.tour_name || b.activity_name || b.product_name || 'Tour';
    const fecha  = b.availability_start_at || b.date || b.start_date || '';
    const guests = b.party_size || b.guests || b.num_guests || b.adults || '';
    const total  = b.amount_paid_total || b.total || b.amount || '';
    const status = b.booking_status || b.status || 'booked';

    // Ignorar cancelaciones si se prefiere (opcional — comentar si querés registrarlas)
    // if (status === 'cancelled' || status === 'canceled') return;

    // ── Buscar o crear contacto ─────────────────────────────────────────────
    let contacto = null;
    if (email)   contacto = (await pool.query('SELECT * FROM contacts WHERE email=$1 LIMIT 1', [email])).rows[0];
    if (!contacto && phone) contacto = (await pool.query('SELECT * FROM contacts WHERE phone=$1 LIMIT 1', [phone])).rows[0];

    if (!contacto) {
      contacto = (await pool.query(
        `INSERT INTO contacts (name, phone, email, source) VALUES ($1,$2,$3,'fareharbor') RETURNING *`,
        [nombre, phone, email]
      )).rows[0];
    } else {
      // Actualizar con datos más recientes
      await pool.query(
        `UPDATE contacts SET
           name  = COALESCE(NULLIF($1,''), name),
           phone = COALESCE(NULLIF($2,''), phone),
           email = COALESCE(NULLIF($3,''), email),
           updated_at = NOW()
         WHERE id = $4`,
        [nombre, phone, email, contacto.id]
      );
    }

    // ── Verificar duplicado (mismo booking_id ya importado) ─────────────────
    if (bookingId) {
      const dup = await pool.query(
        `SELECT id FROM leads WHERE source='fareharbor' AND title LIKE $1 LIMIT 1`,
        [`%#${bookingId}%`]
      );
      if (dup.rows.length) {
        console.log(`[FAREHARBOR] Booking #${bookingId} ya existe (lead ${dup.rows[0].id}) — ignorado`);
        return;
      }
    }

    // ── Obtener pipeline y etapa ────────────────────────────────────────────
    const pip   = await pool.query('SELECT id FROM pipelines ORDER BY position LIMIT 1');
    const pipId = pip.rows[0]?.id || null;

    // Buscar etapa que se llame "Reserva", "Booking", "Confirmado" o similar
    let stageId = null;
    if (pipId) {
      const stageR = await pool.query(
        `SELECT id FROM pipeline_stages WHERE pipeline_id=$1
         AND LOWER(name) IN ('reserva','reservas','booking','confirmado','confirmed','booked')
         ORDER BY position LIMIT 1`,
        [pipId]
      );
      if (stageR.rows.length) {
        stageId = stageR.rows[0].id;
      } else {
        // Si no existe, usar la primera etapa
        const first = await pool.query(
          'SELECT id FROM pipeline_stages WHERE pipeline_id=$1 ORDER BY position LIMIT 1',
          [pipId]
        );
        stageId = first.rows[0]?.id || null;
      }
    }

    // ── Crear lead ──────────────────────────────────────────────────────────
    const fechaCorta = fecha ? fecha.split('T')[0] : '';
    const leadTitle  = bookingId
      ? `FH #${bookingId} — ${nombre}`
      : `FareHarbor — ${nombre}`;

    const lead = (await pool.query(
      `INSERT INTO leads (title, contact_id, pipeline_id, stage_id, source, value, check_in)
       VALUES ($1,$2,$3,$4,'fareharbor',$5,$6) RETURNING *`,
      [leadTitle, contacto.id, pipId, stageId,
       total ? parseFloat(total.toString().replace(/[^0-9.]/g, '')) : null,
       fechaCorta || null]
    )).rows[0];

    // ── Nota con detalle del booking ────────────────────────────────────────
    const nota = [
      `📋 Booking FareHarbor${bookingId ? ` #${bookingId}` : ''}`,
      `👤 Cliente: ${nombre}`,
      email  ? `📧 Email: ${email}`  : null,
      phone  ? `📞 Tel: ${phone}`    : null,
      `🏝 Tour: ${tour}`,
      fechaCorta ? `📅 Fecha: ${fechaCorta}` : null,
      guests ? `👥 Pasajeros: ${guests}` : null,
      total  ? `💵 Total: $${total}` : null,
      `📌 Estado: ${status}`,
    ].filter(Boolean).join('\n');

    await pool.query(
      `INSERT INTO lead_notes (lead_id, text) VALUES ($1,$2)`,
      [lead.id, nota]
    ).catch(() => {});

    // ── Mensaje en el chat del lead ─────────────────────────────────────────
    await pool.query(
      `INSERT INTO messages (lead_id, contact_id, direction, text, channel)
       VALUES ($1,$2,'inbound',$3,'fareharbor')`,
      [lead.id, contacto.id, nota]
    );
    sse.broadcast('new_message', { lead_id: lead.id, direction: 'inbound' });

    // ── Alerta para el equipo ────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO alerts (lead_id, type, message)
       VALUES ($1,'fareharbor_booking',$2)`,
      [lead.id, `Nuevo booking FH — ${nombre} | ${tour}${fechaCorta ? ' | ' + fechaCorta : ''}${total ? ' | $' + total : ''}`]
    ).catch(() => {});

    // ── Tag "FareHarbor" ────────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO lead_tags (lead_id, tag, color) VALUES ($1,'FareHarbor','#f59e0b') ON CONFLICT (lead_id, tag) DO NOTHING`,
      [lead.id]
    ).catch(() => {});

    console.log(`[FAREHARBOR] Lead #${lead.id} creado — ${nombre} | ${tour} | $${total}`);
  } catch (err) {
    console.error('[FAREHARBOR] Error:', err.message);
  }
}

module.exports = { twilioWebhook, webformWebhook, emailWebhook, sendWelcomeEmail, zapierFareharborWebhook };
