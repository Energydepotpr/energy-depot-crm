/**
 * Generador de documentación PDF del CRM Fix A Trip PR
 * node generar-doc.js
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join('C:/Users/alexa/OneDrive/Desktop', 'CRM-FixATrip-Documentacion.pdf');

const C = {
  navy:    '#0f2744',
  blue:    '#1a3a5c',
  accent:  '#6366f1',
  teal:    '#0891b2',
  green:   '#059669',
  orange:  '#d97706',
  red:     '#dc2626',
  white:   '#ffffff',
  light:   '#f1f5f9',
  muted:   '#64748b',
  dark:    '#1e293b',
  border:  '#cbd5e1',
};

const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'CRM Fix A Trip PR — Documentación', Author: 'LoVirtual LLC' } });
doc.pipe(fs.createWriteStream(OUT));

const W = 595.28;
const H = 841.89;
const M = 48; // margin

// ── Helpers ────────────────────────────────────────────────────────────────────
function rect(x, y, w, h, color, radius = 0) {
  doc.save().roundedRect(x, y, w, h, radius).fill(color).restore();
}
function line(x1, y1, x2, y2, color = C.border, width = 0.5) {
  doc.save().moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(width).stroke().restore();
}
function badge(x, y, text, bg, fg = C.white) {
  const tw = doc.widthOfString(text, { size: 8 }) + 14;
  rect(x, y - 1, tw, 16, bg, 8);
  doc.fillColor(fg).fontSize(8).font('Helvetica-Bold').text(text, x + 7, y + 3, { lineBreak: false });
  return tw;
}
function sectionTitle(y, text, color = C.accent) {
  rect(M, y, 4, 22, color, 2);
  doc.fillColor(color).fontSize(13).font('Helvetica-Bold').text(text, M + 12, y + 4);
  return y + 34;
}
function subTitle(y, text) {
  doc.fillColor(C.dark).fontSize(10).font('Helvetica-Bold').text(text, M, y);
  return y + 16;
}
function bodyText(y, text, indent = 0) {
  doc.fillColor(C.dark).fontSize(9).font('Helvetica').text(text, M + indent, y, { width: W - M * 2 - indent, lineBreak: true });
  return y + doc.heightOfString(text, { width: W - M * 2 - indent, fontSize: 9 }) + 4;
}
function bullet(y, text, color = C.accent, indent = 0) {
  rect(M + indent, y + 4, 5, 5, color, 2);
  doc.fillColor(C.dark).fontSize(9).font('Helvetica').text(text, M + indent + 12, y, { width: W - M * 2 - indent - 12 });
  return y + doc.heightOfString(text, { width: W - M * 2 - indent - 12, fontSize: 9 }) + 5;
}
function infoBox(x, y, w, h, title, value, color = C.accent) {
  rect(x, y, w, h, C.light, 8);
  doc.save().roundedRect(x, y, w, h, 8).strokeColor(color).lineWidth(1).stroke().restore();
  doc.fillColor(color).fontSize(8).font('Helvetica-Bold').text(title, x + 10, y + 8, { width: w - 20 });
  doc.fillColor(C.dark).fontSize(11).font('Helvetica-Bold').text(value, x + 10, y + 20, { width: w - 20 });
}
function newPage() {
  doc.addPage({ size: 'A4', margin: 0 });
  // top bar
  rect(0, 0, W, 8, C.accent);
  return 28;
}
function footer(pageNum) {
  rect(0, H - 28, W, 28, C.navy);
  doc.fillColor(C.white).fontSize(8).font('Helvetica')
    .text('CRM Fix A Trip PR — Documentación Técnica & Operativa', M, H - 18, { width: W - M * 2 - 40 })
    .text(`Pág. ${pageNum}`, W - M - 20, H - 18, { lineBreak: false });
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 1 — PORTADA
// ══════════════════════════════════════════════════════════════════════════════
rect(0, 0, W, H, C.navy);
rect(0, 0, W, 6, C.accent);
rect(0, H - 6, W, 6, C.accent);

// Diagonal accent
doc.save().polygon([W * 0.55, 0], [W, 0], [W, H * 0.5]).fill(C.blue).restore();
doc.save().polygon([W * 0.65, H], [W, H], [W, H * 0.6]).fill(C.blue).restore();

// Logo area
rect(M, 120, 280, 6, C.accent, 3);
doc.fillColor(C.white).fontSize(38).font('Helvetica-Bold').text('Fix A Trip PR', M, 140);
doc.fillColor(C.accent).fontSize(22).font('Helvetica-Bold').text('CRM Inteligente', M, 186);
doc.fillColor('#94a3b8').fontSize(13).font('Helvetica').text('Sistema de Gestión de Clientes', M, 214);
doc.fillColor('#94a3b8').fontSize(13).font('Helvetica').text('con Inteligencia Artificial', M, 232);

// Version badge
rect(M, 280, 160, 32, C.accent, 6);
doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold').text('Versión 1.0 — Marzo 2026', M + 12, 291);

// Info cards
const cards = [
  { label: 'Frontend', val: 'Next.js 14' },
  { label: 'Backend', val: 'Node.js + Express' },
  { label: 'Base de datos', val: 'PostgreSQL' },
  { label: 'IA', val: 'Claude (Anthropic)' },
  { label: 'Hosting', val: 'Vercel + Railway' },
  { label: 'Mensajería', val: 'Twilio' },
];
cards.forEach((c, i) => {
  const cx = M + (i % 2) * 240;
  const cy = 360 + Math.floor(i / 2) * 60;
  rect(cx, cy, 220, 48, '#1a2744', 8);
  doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(c.label, cx + 12, cy + 10);
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold').text(c.val, cx + 12, cy + 24);
});

doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Desarrollado por LoVirtual, LLC  ·  www.lovirtual.com  ·  +1 (787) 985-7485', M, H - 80, { width: W - M * 2, align: 'center' });
doc.fillColor('#94a3b8').fontSize(8).text('Guaynabo, Puerto Rico, 00969', M, H - 62, { width: W - M * 2, align: 'center' });
footer(1);

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 2 — RESUMEN Y ACCESO
// ══════════════════════════════════════════════════════════════════════════════
let y = newPage();
rect(0, 8, W, 50, C.light);
doc.fillColor(C.navy).fontSize(20).font('Helvetica-Bold').text('¿Qué es este CRM?', M, 20);
doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Resumen ejecutivo del sistema', M, 44);
y = 76;

y = bodyText(y, 'El CRM de Fix A Trip Puerto Rico es un sistema completo de gestión de clientes e inteligencia artificial diseñado específicamente para el negocio de tours y experiencias en Puerto Rico. Centraliza todas las comunicaciones (WhatsApp, SMS, web y email) en un solo lugar, automatiza respuestas con la bot Gigi, y organiza el pipeline de ventas desde el primer contacto hasta el cierre.');
y += 6;

y = sectionTitle(y, 'Acceso al Sistema');
const access = [
  ['CRM (Frontend)', 'https://crm-ia-nu.vercel.app', C.accent],
  ['Backend API', 'https://crm-ia-production-c247.up.railway.app', C.teal],
  ['GitHub (código fuente)', 'https://github.com/Bleutonik/CRM-IA-', C.muted],
];
access.forEach(([label, url, color]) => {
  rect(M, y, W - M * 2, 32, C.light, 6);
  doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(label, M + 12, y + 7);
  doc.fillColor(color).fontSize(10).font('Helvetica-Bold').text(url, M + 12, y + 18);
  y += 38;
});
y += 6;

y = sectionTitle(y, 'Credenciales de Acceso');
const creds = [
  ['Administrador', 'admin', 'admin123', C.red],
  ['Agente de ventas', 'rock', '123456', C.green],
];
creds.forEach(([role, user, pass, color]) => {
  rect(M, y, (W - M * 2) / 2 - 8, 52, C.light, 8);
  badge(M + 10, y + 8, role.toUpperCase(), color);
  doc.fillColor(C.muted).fontSize(8).font('Helvetica').text('Usuario', M + 10, y + 27);
  doc.fillColor(C.dark).fontSize(11).font('Helvetica-Bold').text(user, M + 10, y + 37);
  doc.fillColor(C.muted).fontSize(8).font('Helvetica').text('Contraseña', M + (W - M * 2) / 4, y + 27);
  doc.fillColor(C.dark).fontSize(11).font('Helvetica-Bold').text(pass, M + (W - M * 2) / 4, y + 37);
  y += 58;
});
y += 4;

y = sectionTitle(y, 'Funcionalidades Principales');
const features = [
  [C.accent,  'Pipeline Kanban',        'Vista de leads por etapas arrastrable. También vista lista y tabla.'],
  [C.teal,    'Inbox multicanal',       'Conversaciones de WhatsApp, SMS, web y email en una sola bandeja.'],
  [C.green,   'Bot Gigi (IA)',          'Responde automáticamente 24/7, captura nombre, teléfono y email.'],
  [C.orange,  'Dashboard analytics',   'Métricas de mensajes, leads por etapa, tasa de respuesta del bot.'],
  [C.red,     'Alertas automáticas',   'Notifica leads inactivos, grupos grandes y prospectos calificados.'],
  [C.muted,   'Campos personalizados', 'Agrega campos propios a leads y contactos desde Ajustes.'],
  [C.accent,  'Calendario',            'Vista mensual de leads y tareas pendientes por fecha.'],
  [C.teal,    'Reportes PDF',          'Descarga resumen mensual con estadísticas de ventas.'],
];
features.forEach(([color, title, desc]) => {
  rect(M, y, 8, 8, color, 4);
  doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold').text(title, M + 16, y - 1, { continued: true }).font('Helvetica').fillColor(C.muted).text(`  —  ${desc}`);
  y += 18;
});
footer(2);

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 3 — EL BOT GIGI
// ══════════════════════════════════════════════════════════════════════════════
y = newPage();
rect(0, 8, W, 50, C.light);
doc.fillColor(C.navy).fontSize(20).font('Helvetica-Bold').text('El Bot Gigi — Inteligencia Artificial', M, 20);
doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Cómo funciona el asistente virtual', M, 44);
y = 76;

y = sectionTitle(y, 'Motor de IA — Sistema Híbrido');
y = bodyText(y, 'El bot usa dos modelos de Claude (Anthropic) en una arquitectura inteligente que optimiza costo y calidad:');
y += 4;

rect(M, y, W - M * 2, 80, C.light, 10);
doc.save().roundedRect(M, y, W - M * 2, 80, 10).strokeColor(C.accent).lineWidth(1).stroke().restore();

const col = (W - M * 2 - 40) / 2;
rect(M + 10, y + 10, col, 60, '#e0e7ff', 8);
doc.fillColor(C.accent).fontSize(9).font('Helvetica-Bold').text('PASO 1 — CLASIFICADOR', M + 18, y + 18);
doc.fillColor(C.dark).fontSize(8).font('Helvetica').text('Claude Haiku 4.5\n(rápido y económico)\nAnaliza si el lead es importante', M + 18, y + 30, { width: col - 16 });

rect(M + col + 30, y + 10, col, 60, '#dcfce7', 8);
doc.fillColor(C.green).fontSize(9).font('Helvetica-Bold').text('PASO 2 — RESPUESTA', M + col + 38, y + 18);
doc.fillColor(C.dark).fontSize(8).font('Helvetica').text('Lead importante → Claude Sonnet 4.6\nLead general → Claude Haiku 4.5\nRespuesta personalizada', M + col + 38, y + 30, { width: col - 16 });

// Arrow
doc.fillColor(C.accent).fontSize(16).text('→', M + col + 10, y + 26, { lineBreak: false });
y += 92;

y = sectionTitle(y, 'Criterios de Lead "Importante" (usa Sonnet)');
const important = [
  'Intención clara de reservar o pagar',
  'Grupo de 5 o más personas',
  'Evento privado (cumpleaños, boda, despedida, corporativo)',
  'Pregunta específica sobre disponibilidad o fecha concreta',
  'Cliente que ya dio nombre + teléfono o email',
  'Solicitud de cotización o presupuesto',
];
important.forEach(item => { y = bullet(y, item, C.accent); });
y += 8;

y = sectionTitle(y, 'Reglas del Bot (configuradas en Ajustes)');
const rules = [
  [C.red,    'NUNCA menciona precios — siempre redirige a un agente para cotizar'],
  [C.accent, 'Captura nombre SOLO del contacto principal (no de acompañantes)'],
  [C.green,  'Siempre intenta obtener teléfono o email para seguimiento'],
  [C.teal,   'Responde en el idioma del cliente (español o inglés)'],
  [C.orange, 'Sin asteriscos ni markdown — escribe como mensajes de WhatsApp'],
  [C.accent, 'Grupos 5+ personas → tag [GRUPO_GRANDE] → prioridad en ventas'],
];
rules.forEach(([color, text]) => { y = bullet(y, text, color); });
y += 8;

y = sectionTitle(y, 'Tags Internos del Bot');
y = bodyText(y, 'El bot agrega tags invisibles al final de sus respuestas que el sistema extrae automáticamente:');
const tags = [
  ['[NOMBRE:X]', 'Nombre del cliente detectado', C.accent],
  ['[EMAIL:X]', 'Email detectado en la conversación', C.teal],
  ['[INTENCION_COMPRA]', 'Cliente muestra intención clara de comprar', C.green],
  ['[GRUPO_GRANDE]', 'Grupo de 5 o más personas mencionado', C.orange],
];
tags.forEach(([tag, desc, color]) => {
  rect(M, y, W - M * 2, 26, C.light, 6);
  doc.fillColor(color).fontSize(9).font('Helvetica-Bold').text(tag, M + 10, y + 8);
  doc.fillColor(C.muted).fontSize(9).font('Helvetica').text(desc, M + 150, y + 8);
  y += 32;
});
footer(3);

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 4 — CANALES DE COMUNICACIÓN
// ══════════════════════════════════════════════════════════════════════════════
y = newPage();
rect(0, 8, W, 50, C.light);
doc.fillColor(C.navy).fontSize(20).font('Helvetica-Bold').text('Canales de Comunicación', M, 20);
doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Cómo llegan los mensajes al CRM', M, 44);
y = 76;

const channels = [
  {
    name: 'WhatsApp Business', color: '#25d366', icon: '💬',
    desc: 'Los clientes escriben al número de WhatsApp Business de Fix A Trip. Twilio recibe el mensaje y lo envía al CRM vía webhook.',
    webhook: 'https://crm-ia-production-c247.up.railway.app/api/webhook/twilio',
    status: 'REQUIERE CONFIGURACIÓN',
    statusColor: C.orange,
  },
  {
    name: 'SMS', color: C.teal, icon: '📱',
    desc: 'Mensajes de texto al número Twilio. Mismo webhook que WhatsApp — el sistema detecta automáticamente el tipo por el prefijo "whatsapp:".',
    webhook: 'https://crm-ia-production-c247.up.railway.app/api/webhook/twilio',
    status: 'REQUIERE CONFIGURACIÓN',
    statusColor: C.orange,
  },
  {
    name: 'Formulario Web (WordPress)', color: C.accent, icon: '🌐',
    desc: 'Cuando alguien llena el formulario de contacto en fixatrippuertorico.com, el plugin Contact Form 7 envía los datos al CRM.',
    webhook: 'https://crm-ia-production-c247.up.railway.app/api/webhook/webform',
    status: 'ACTIVO — Ver instrucciones',
    statusColor: C.green,
  },
  {
    name: 'Email (SendGrid Inbound)', color: C.orange, icon: '📧',
    desc: 'Emails enviados a inbound@fixatrippuertorico.com llegan al CRM como leads. Requiere configuración de MX record en DNS.',
    webhook: 'https://crm-ia-production-c247.up.railway.app/api/webhook/email',
    status: 'REQUIERE CONFIGURACIÓN',
    statusColor: C.orange,
  },
];

channels.forEach(ch => {
  rect(M, y, W - M * 2, 88, C.light, 10);
  doc.save().roundedRect(M, y, W - M * 2, 88, 10).strokeColor(ch.color).lineWidth(1.5).stroke().restore();
  rect(M, y, 6, 88, ch.color, 0);

  doc.fillColor(ch.color).fontSize(12).font('Helvetica-Bold').text(`${ch.icon}  ${ch.name}`, M + 16, y + 10);
  badge(W - M - (ch.status.length * 5.5), y + 10, ch.status, ch.statusColor);
  doc.fillColor(C.dark).fontSize(8.5).font('Helvetica').text(ch.desc, M + 16, y + 28, { width: W - M * 2 - 24 });
  doc.fillColor(C.muted).fontSize(7.5).font('Helvetica').text('Webhook URL:', M + 16, y + 60);
  doc.fillColor(C.teal).fontSize(7.5).font('Courier').text(ch.webhook, M + 72, y + 60);
  y += 96;
});
footer(4);

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 5 — LO QUE NECESITAS (TWILIO)
// ══════════════════════════════════════════════════════════════════════════════
y = newPage();
rect(0, 8, W, 50, '#fff7ed');
doc.fillColor(C.orange).fontSize(20).font('Helvetica-Bold').text('Lo que necesitas contratar', M, 20);
doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Servicios y credenciales requeridos para activar todos los canales', M, 44);
y = 76;

// TWILIO
rect(M, y, W - M * 2, 14, C.teal, 4);
doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold').text('1. TWILIO — WhatsApp Business + SMS', M + 10, y + 2);
y += 22;

y = subTitle(y, '¿Qué es Twilio?');
y = bodyText(y, 'Twilio es la plataforma de comunicaciones que conecta tu número de teléfono con el CRM. Maneja tanto WhatsApp Business como SMS desde un solo número y una sola cuenta.');
y += 4;

y = subTitle(y, 'Pasos para configurar:');
const twilioSteps = [
  'Crear cuenta en twilio.com (prueba gratis con $15 de crédito)',
  'Comprar un número de teléfono con capacidad SMS (~$1.15/mes)',
  'Para WhatsApp Business: solicitar acceso en Twilio Console → Messaging → WhatsApp',
  'Conectar tu número de WhatsApp Business verificado (Meta Business Manager)',
  'En Twilio Console → Phone Numbers → tu número → Messaging Webhook:',
  '    URL: https://crm-ia-production-c247.up.railway.app/api/webhook/twilio',
  '    Método: HTTP POST',
  'Agregar en Railway estas variables de entorno:',
  '    TWILIO_ACCOUNT_SID = (tu Account SID de Twilio)',
  '    TWILIO_AUTH_TOKEN = (tu Auth Token de Twilio)',
  '    TWILIO_PHONE_NUMBER = (tu número, ej: +17875551234)',
  '    TWILIO_WHATSAPP_NUMBER = whatsapp:+14155238886 (sandbox) o tu número aprobado',
];
twilioSteps.forEach((step, i) => {
  const isCode = step.startsWith('    ');
  if (isCode) {
    rect(M + 16, y, W - M * 2 - 16, 16, '#f0f9ff', 4);
    doc.fillColor(C.teal).fontSize(8).font('Courier').text(step.trim(), M + 24, y + 4);
  } else {
    rect(M, y + 3, 16, 16, C.teal, 8);
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold').text(String(i < 8 ? i + 1 : ''), M + 5, y + 5, { lineBreak: false });
    doc.fillColor(C.dark).fontSize(8.5).font('Helvetica').text(step, M + 22, y + 4, { width: W - M * 2 - 28 });
  }
  y += 20;
});

y += 4;
y = subTitle(y, 'Costos aproximados de Twilio:');
const costs = [
  ['Número de teléfono', '~$1.15 / mes'],
  ['SMS enviado (EE.UU.)', '~$0.0079 / mensaje'],
  ['SMS recibido', '~$0.0075 / mensaje'],
  ['WhatsApp (conversación 24h)', '~$0.005 - $0.05 / conversación'],
];
costs.forEach(([item, cost]) => {
  rect(M, y, (W - M * 2) * 0.65, 20, C.light, 4);
  rect(M + (W - M * 2) * 0.65 + 4, y, (W - M * 2) * 0.33, 20, '#dcfce7', 4);
  doc.fillColor(C.dark).fontSize(8.5).font('Helvetica').text(item, M + 8, y + 5);
  doc.fillColor(C.green).fontSize(8.5).font('Helvetica-Bold').text(cost, M + (W - M * 2) * 0.65 + 12, y + 5);
  y += 26;
});
footer(5);

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 6 — LO QUE NECESITAS (EMAIL + VARIABLES DE ENTORNO)
// ══════════════════════════════════════════════════════════════════════════════
y = newPage();
rect(0, 8, W, 50, '#fff7ed');
doc.fillColor(C.orange).fontSize(20).font('Helvetica-Bold').text('Email, Variables de Entorno & Checklist', M, 20);
doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Todo lo que necesitas para que el sistema funcione al 100%', M, 44);
y = 76;

// SENDGRID
rect(M, y, W - M * 2, 14, C.orange, 4);
doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold').text('2. SENDGRID — Email Inbound (opcional)', M + 10, y + 2);
y += 22;

const sgSteps = [
  'Crear cuenta gratis en sendgrid.com (100 emails/día gratis)',
  'Ir a Settings → Inbound Parse → Add Host & URL',
  'Hostname: inbound.fixatrippuertorico.com',
  'URL de destino: https://crm-ia-production-c247.up.railway.app/api/webhook/email',
  'En tu proveedor de DNS (GoDaddy / Cloudflare), agregar registro MX:',
  '    Nombre: inbound.fixatrippuertorico.com',
  '    Valor: mx.sendgrid.net   Prioridad: 10',
  'Guardar cambios — puede tardar hasta 24h en propagarse',
];
sgSteps.forEach((step, i) => {
  const isCode = step.startsWith('    ');
  if (isCode) {
    rect(M + 16, y, W - M * 2 - 16, 16, '#fff7ed', 4);
    doc.fillColor(C.orange).fontSize(8).font('Courier').text(step.trim(), M + 24, y + 4);
  } else {
    rect(M, y + 2, 16, 14, C.orange, 7);
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold').text(String(i + 1), M + 5, y + 4, { lineBreak: false });
    doc.fillColor(C.dark).fontSize(8.5).font('Helvetica').text(step, M + 22, y + 3, { width: W - M * 2 - 28 });
  }
  y += 18;
});
y += 8;

// VARIABLES DE ENTORNO
rect(M, y, W - M * 2, 14, C.navy, 4);
doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold').text('3. Variables de Entorno en Railway (Backend)', M + 10, y + 2);
y += 20;

y = bodyText(y, 'En Railway → tu proyecto → Variables, agrega estas claves:');
y += 4;

const envVars = [
  ['DATABASE_URL',           'postgresql://...  (Railway te la da automáticamente)', C.green],
  ['JWT_SECRET',             'Clave secreta para tokens de sesión (cualquier string largo)', C.accent],
  ['ANTHROPIC_API_KEY',      'sk-ant-...  (desde console.anthropic.com)', C.accent],
  ['TWILIO_ACCOUNT_SID',     'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  (Twilio Console)', C.teal],
  ['TWILIO_AUTH_TOKEN',      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  (Twilio Console)', C.teal],
  ['TWILIO_PHONE_NUMBER',    '+1787XXXXXXX  (tu número Twilio con SMS)', C.teal],
  ['TWILIO_WHATSAPP_NUMBER', 'whatsapp:+1787XXXXXXX  (tu número WhatsApp aprobado)', C.teal],
];
envVars.forEach(([key, desc, color]) => {
  rect(M, y, W - M * 2, 22, C.light, 4);
  doc.fillColor(color).fontSize(8).font('Courier-Bold').text(key, M + 8, y + 4);
  doc.fillColor(C.muted).fontSize(7.5).font('Helvetica').text(desc, M + 8, y + 14, { width: W - M * 2 - 16 });
  y += 28;
});
y += 4;

// CHECKLIST FINAL
rect(M, y, W - M * 2, 14, C.accent, 4);
doc.fillColor(C.white).fontSize(10).font('Helvetica-Bold').text('✓ Checklist de Activación', M + 10, y + 2);
y += 20;

const checklist = [
  ['Cuenta Twilio creada y número comprado', C.teal],
  ['Webhook de Twilio apuntando al backend', C.teal],
  ['Variables de entorno cargadas en Railway', C.accent],
  ['WhatsApp Business aprobado por Meta (vía Twilio)', C.orange],
  ['Formulario WordPress enviando al webhook /webform', C.green],
  ['Cuenta SendGrid creada y MX record configurado (email)', C.orange],
  ['Agentes creados en CRM con sus accesos', C.green],
  ['Prompt del bot actualizado en Ajustes → Bot', C.accent],
  ['Probar bot en Ajustes → Test Bot', C.green],
];
checklist.forEach(([task, color]) => {
  rect(M, y + 1, 14, 14, C.light, 3);
  doc.save().rect(M + 2, y + 3, 10, 10).strokeColor(color).lineWidth(1).stroke().restore();
  doc.fillColor(C.dark).fontSize(8.5).font('Helvetica').text(task, M + 22, y + 3);
  y += 20;
});
footer(6);

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 7 — ARQUITECTURA TÉCNICA
// ══════════════════════════════════════════════════════════════════════════════
y = newPage();
rect(0, 8, W, 50, C.light);
doc.fillColor(C.navy).fontSize(20).font('Helvetica-Bold').text('Arquitectura Técnica', M, 20);
doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Cómo están conectados todos los componentes', M, 44);
y = 76;

y = sectionTitle(y, 'Stack Tecnológico');
const stack = [
  { layer: 'Frontend (UI)', tech: 'Next.js 14 App Router', host: 'Vercel', url: 'crm-ia-nu.vercel.app', color: C.accent },
  { layer: 'Backend (API)', tech: 'Node.js + Express.js', host: 'Railway', url: 'crm-ia-production-c247.up.railway.app', color: C.teal },
  { layer: 'Base de datos', tech: 'PostgreSQL', host: 'Railway (addon)', url: 'gondola.proxy.rlwy.net:21608', color: C.green },
  { layer: 'IA / Chatbot', tech: 'Anthropic Claude API', host: 'Cloud (Anthropic)', url: 'api.anthropic.com', color: C.orange },
  { layer: 'Mensajería', tech: 'Twilio SDK', host: 'Cloud (Twilio)', url: 'api.twilio.com', color: C.teal },
];
stack.forEach(s => {
  rect(M, y, W - M * 2, 36, C.light, 6);
  rect(M, y, 5, 36, s.color, 0);
  doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(s.layer, M + 14, y + 6);
  doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold').text(s.tech, M + 14, y + 17);
  badge(W - M - 120, y + 8, s.host, s.color);
  doc.fillColor(C.muted).fontSize(7.5).font('Courier').text(s.url, W - M - 240, y + 22, { width: 220, align: 'right' });
  y += 42;
});
y += 8;

y = sectionTitle(y, 'Flujo de un mensaje entrante');
const flow = [
  ['Cliente escribe', 'WhatsApp / SMS / Web / Email', C.teal],
  ['Twilio / SendGrid', 'Recibe y reenvía vía HTTP POST', C.orange],
  ['Backend /api/webhook', 'Crea contacto + lead si no existen', C.accent],
  ['Claude Haiku', 'Clasifica si es lead importante', C.green],
  ['Claude Haiku o Sonnet', 'Genera respuesta personalizada', C.green],
  ['Backend', 'Guarda mensaje + extrae tags + envía respuesta', C.accent],
  ['CRM Frontend', 'Muestra en Inbox + crea alertas si aplica', C.accent],
];
const bw = (W - M * 2 - 12) / flow.length - 2;
flow.forEach((step, i) => {
  const bx = M + i * (bw + 4);
  rect(bx, y, bw, 52, step[2] + '20', 6);
  doc.save().roundedRect(bx, y, bw, 52, 6).strokeColor(step[2]).lineWidth(0.8).stroke().restore();
  doc.fillColor(step[2]).fontSize(7).font('Helvetica-Bold').text(step[0], bx + 4, y + 6, { width: bw - 8, align: 'center' });
  doc.fillColor(C.dark).fontSize(6.5).font('Helvetica').text(step[1], bx + 4, y + 22, { width: bw - 8, align: 'center' });
  if (i < flow.length - 1) doc.fillColor(C.muted).fontSize(12).text('›', bx + bw - 2, y + 18, { lineBreak: false });
});
y += 64;

y = sectionTitle(y, 'Estructura del código fuente');
const structure = [
  ['frontend/app/(dashboard)/', 'Páginas del CRM: leads, inbox, contacts, calendar, settings...'],
  ['frontend/lib/api.js', 'Todas las llamadas al backend centralizadas'],
  ['frontend/public/sw.js', 'Service Worker para push notifications'],
  ['backend/controllers/', 'Lógica de negocio: leads, contacts, messages, webhooks...'],
  ['backend/services/claudeService.js', 'Motor IA — clasificador Haiku + respuesta Sonnet/Haiku'],
  ['backend/services/db.js', 'Conexión PostgreSQL + inicialización de tablas'],
  ['backend/controllers/webhookController.js', 'Recibe mensajes de Twilio, web form y email'],
  ['backend/update-prompt.js', 'Script para actualizar el prompt del bot Gigi'],
];
structure.forEach(([file, desc]) => {
  rect(M, y, W - M * 2, 22, C.light, 4);
  doc.fillColor(C.teal).fontSize(8).font('Courier').text(file, M + 8, y + 4, { width: (W - M * 2) * 0.45 });
  doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(desc, M + (W - M * 2) * 0.48, y + 6, { width: (W - M * 2) * 0.5 });
  y += 28;
});
footer(7);

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 8 — CONTACTO & SOPORTE
// ══════════════════════════════════════════════════════════════════════════════
y = newPage();
rect(0, 8, W, H - 8, C.navy);

doc.fillColor(C.white).fontSize(28).font('Helvetica-Bold').text('Soporte & Contacto', M, 100, { width: W - M * 2, align: 'center' });
line(M + 80, 140, W - M - 80, 140, C.accent, 2);

doc.fillColor('#94a3b8').fontSize(11).font('Helvetica').text('Este sistema fue desarrollado por', M, 160, { width: W - M * 2, align: 'center' });
doc.fillColor(C.white).fontSize(22).font('Helvetica-Bold').text('LoVirtual, LLC', M, 182, { width: W - M * 2, align: 'center' });

const contacts = [
  ['🌐 Web', 'www.lovirtual.com'],
  ['📞 Teléfono', '+1 (787) 985-7485'],
  ['📍 Dirección', 'Guaynabo, Puerto Rico, 00969'],
];
contacts.forEach(([label, value], i) => {
  rect((W - 340) / 2, 240 + i * 52, 340, 42, '#1a2744', 10);
  doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text(label, (W - 340) / 2 + 16, 252 + i * 52);
  doc.fillColor(C.white).fontSize(13).font('Helvetica-Bold').text(value, (W - 340) / 2 + 16, 264 + i * 52);
});

rect((W - 200) / 2, 420, 200, 2, C.accent, 1);

doc.fillColor('#64748b').fontSize(10).font('Helvetica').text('Para modificaciones al sistema, nuevas funcionalidades,\no soporte técnico, contactar directamente a LoVirtual.', M, 440, { width: W - M * 2, align: 'center' });

doc.fillColor('#1e3a5f').fontSize(9).font('Helvetica').text('Documento generado automáticamente — ' + new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' }), M, H - 80, { width: W - M * 2, align: 'center' });

doc.end();
console.log('✓ PDF generado en:', OUT);
