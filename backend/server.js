require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB, pool: dbPool } = require('./services/db');
const { authMiddleware, requireAdmin } = require('./middleware/auth');

const auth         = require('./controllers/authController');
const contacts     = require('./controllers/contactsController');
const leads        = require('./controllers/leadsController');
const pipelines    = require('./controllers/pipelinesController');
const messages     = require('./controllers/messagesController');
const settings     = require('./controllers/settingsController');
const webhook      = require('./controllers/webhookController');
const notes        = require('./controllers/notesController');
const tasks        = require('./controllers/tasksController');
const alerts       = require('./controllers/alertsController');
const quickReplies  = require('./controllers/quickRepliesController');
const search        = require('./controllers/searchController');
const impexp        = require('./controllers/importExportController');
const customFields  = require('./controllers/customFieldsController');
const reports       = require('./controllers/reportsController');
const push          = require('./controllers/pushController');
const calls         = require('./controllers/callsController');
const invoices      = require('./controllers/invoicesController');
const quickbooks    = require('./controllers/quickbooksController');
const integrations  = require('./controllers/integrationsController');
const automations   = require('./controllers/automationsController');
const agentReport   = require('./controllers/agentReportController');
const contracts     = require('./controllers/contractsController');
const email         = require('./controllers/emailController');
const menuLinks     = require('./controllers/menuLinksController');
const translate     = require('./controllers/translateController');
const segments      = require('./controllers/segmentsController');
const campaigns     = require('./controllers/campaignsController');
const products         = require('./controllers/productsController');
const quotes           = require('./controllers/quotesController');
const callRecording    = require('./controllers/callRecordingController');
const permissionsCtrl  = require('./middleware/permissions');
const apiDocs          = require('./controllers/apiDocsController');
const sequences        = require('./controllers/sequencesController');
const analytics        = require('./controllers/analyticsController');
const goals            = require('./controllers/goalsController');
const timeline         = require('./controllers/timelineController');
const signatures       = require('./controllers/signaturesController');
const onboarding       = require('./controllers/onboardingController');
const teamChat         = require('./controllers/teamChatController');
const suppliers        = require('./controllers/suppliersController');
// const googleCal     = require('./controllers/googleCalendarController'); // disponible si se necesita
const sse              = require('./services/sse');
const { syncTwilioMessages } = require('./services/twilioSync');
const { enrichAllMissingNames, enqueueEnrich } = require('./services/leadEnrich');
const jwt           = require('jsonwebtoken');

const app = express();

// Trust Railway's reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
}));

// CORS — only allow known frontend origin
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, same-server SSR)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body size limit
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limit on login (max 10 attempts per minute per IP)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta en 1 minuto.' },
});

// Rate limit for AI endpoints (max 20 req/min per IP)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas solicitudes. Intenta en 1 minuto.' },
});

// Rate limit for public webhooks (max 60 req/min per IP)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas solicitudes.' },
});

// Rate limit for public token-gated endpoints (portal, signatures, onboarding)
const publicTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});

// SSE real-time events (token via query param — EventSource can't set headers)
app.get('/api/events', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try { jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).end(); }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');

  const heartbeat = setInterval(() => {
    try { res.write('event: ping\ndata: {}\n\n'); } catch { cleanup(); }
  }, 25000);

  sse.subscribe(res);
  const cleanup = () => { clearInterval(heartbeat); sse.unsubscribe(res); };
  req.on('close', cleanup);
  req.on('error', cleanup);
});

// Public
app.post('/api/auth/login', loginLimiter, auth.login);
// QuickBooks OAuth (públicos — Intuit hace GET aquí)
app.get('/api/quickbooks/auth',     quickbooks.authRedirect);
app.get('/api/quickbooks/callback', quickbooks.authCallback);
// QuickBooks Webhook (público — Intuit hace POST aquí cuando hay pagos)
app.post('/api/quickbooks/webhook', quickbooks.webhook);
app.post('/api/webhook/twilio',     webhookLimiter, webhook.twilioWebhook);
app.post('/api/webhook/webform',    webhookLimiter, webhook.webformWebhook);
app.post('/api/webhook/email',      webhook.emailWebhook);
app.get('/api/push/vapid-key',   push.getVapidKey);
// Twilio Voice public webhooks
app.post('/api/calls/twiml',     calls.twimlHandler);
app.post('/api/calls/status',    calls.statusCallback);

// Public menu routes (no auth) — rate limited
app.get('/api/public/menu/:token',         publicTokenLimiter, menuLinks.obtenerPublico);
app.post('/api/public/menu/:token/submit', publicTokenLimiter, menuLinks.submitPublico);

// Public — Twilio recording callback + API docs
app.post('/api/calls/recording-callback', callRecording.recordingCallback);
app.get('/api/docs', apiDocs.getDocs);

// Public e-signature routes — rate limited
app.get('/api/public/sign/:token',   publicTokenLimiter, signatures.obtenerParaFirma);
app.post('/api/public/sign/:token',  publicTokenLimiter, signatures.firmar);

// Public audio proxy (browser <audio> can't send JWT headers)
app.get('/api/recordings/:sid/audio', callRecording.proxyAudio);

// Protected
app.use('/api', authMiddleware);

app.get('/api/me', auth.me);
app.get('/api/stats', settings.stats);
app.get('/api/stats/chart', settings.statsChart);
app.get('/api/search', search.buscar);

// AI Assistant — Energy Depot PR
app.post('/api/assistant', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Asistente IA no configurado. Agrega ANTHROPIC_API_KEY.' });
    const { messages, leadId } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'messages requerido' });

    let contextBlock = '';

    // Opción A: contexto de un lead específico
    if (leadId) {
      try {
        const lr = await dbPool.query(`
          SELECT l.title, l.value, l.notes,
                 c.name AS contact_name, c.email, c.phone,
                 s.name AS stage_name,
                 (SELECT string_agg(n.content, ' | ' ORDER BY n.created_at DESC)
                  FROM notes n WHERE n.lead_id = l.id LIMIT 5) AS recent_notes,
                 (SELECT string_agg(m.content, ' | ' ORDER BY m.created_at DESC)
                  FROM messages m WHERE m.lead_id = l.id LIMIT 8) AS recent_msgs
          FROM leads l
          LEFT JOIN contacts c ON l.contact_id = c.id
          LEFT JOIN pipeline_stages s ON l.stage_id = s.id
          WHERE l.id = $1
        `, [leadId]);
        if (lr.rows[0]) {
          const d = lr.rows[0];
          contextBlock = `\n\n--- CONTEXTO DEL CLIENTE ACTUAL ---
Cliente: ${d.contact_name || 'Desconocido'}
Lead/Oportunidad: ${d.title || '—'}
Etapa: ${d.stage_name || '—'}
Email: ${d.email || '—'} | Teléfono: ${d.phone || '—'}
Valor: ${d.value ? '$' + Number(d.value).toLocaleString() : '—'}
Notas: ${d.recent_notes || 'ninguna'}
Últimos mensajes: ${d.recent_msgs || 'ninguno'}
--- FIN CONTEXTO ---`;
        }
      } catch (_) {}
    }

    // Opción B: RAG — buscar leads/contactos relevantes por palabras del último mensaje
    if (!leadId) {
      try {
        const lastText = messages[messages.length - 1]?.text || '';
        // Extraer palabras de 4+ chars como posibles nombres/términos
        const words = [...new Set(lastText.match(/\b[a-záéíóúñA-ZÁÉÍÓÚÑ]{4,}\b/g) || [])].slice(0, 5);
        if (words.length > 0) {
          const conditions = words.map((_, i) => `(c.name ILIKE $${i+1} OR l.title ILIKE $${i+1})`).join(' OR ');
          const params = words.map(w => `%${w}%`);
          const rr = await dbPool.query(`
            SELECT DISTINCT l.id, l.title, c.name AS contact_name, s.name AS stage_name, c.email, c.phone
            FROM leads l
            LEFT JOIN contacts c ON l.contact_id = c.id
            LEFT JOIN pipeline_stages s ON l.stage_id = s.id
            WHERE ${conditions}
            LIMIT 4
          `, params);
          if (rr.rows.length > 0) {
            contextBlock = `\n\n--- CLIENTES RELEVANTES EN EL CRM ---\n` +
              rr.rows.map(r => `• ${r.contact_name || r.title} | Etapa: ${r.stage_name || '—'} | ${r.email || ''} ${r.phone || ''}`).join('\n') +
              `\n--- FIN ---`;
          }
        }
      } catch (_) {}
    }

    const systemPrompt = `Eres un asistente de trabajo interno para el equipo de Energy Depot PR, una empresa de energía solar en Puerto Rico.
Ayudas a los asesores de ventas y servicio al cliente con:
- Redactar respuestas profesionales a clientes interesados en paneles solares
- Resolver dudas sobre procesos internos: cotizaciones, financiamiento, permisos LUMA, instalación
- Sugerir cómo manejar situaciones difíciles con clientes
- Resumir información, redactar emails, crear seguimientos
- Cualquier pregunta laboral o de trabajo relacionada con energía solar
Responde siempre en español, de forma clara y práctica. Si te piden redactar algo, dalo listo para usar.
IMPORTANTE: No uses asteriscos (*), markdown, ni negritas en tus respuestas. Solo texto plano.${contextBlock}`;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const anthropicMessages = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });
    const text = response.content[0].text;
    res.json({ text });
  } catch (e) {
    console.error('[ASSISTANT]', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Weather
app.get('/api/weather', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Weather API not configured' });
    // Default: San Juan, PR (lat/lon more reliable than city name)
    const lat = req.query.lat || '18.4655';
    const lon = req.query.lon || '-66.1057';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial&lang=es`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error('[WEATHER]', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Contacts
app.get('/api/contacts/export',           impexp.exportarContactos);
app.post('/api/contacts/import',          impexp.importarContactos);
app.get('/api/contacts/check-duplicate',  contacts.checkDuplicate);
app.get('/api/contacts/duplicates',       contacts.findDuplicates);
app.post('/api/contacts/merge',           contacts.mergeContacts);
app.get('/api/contacts',                  contacts.listar);
app.get('/api/contacts/:id',              contacts.obtener);
app.post('/api/contacts',                 contacts.crear);
app.patch('/api/contacts/:id',            contacts.actualizar);
app.delete('/api/contacts/:id',           contacts.eliminar);

// Leads
app.get('/api/leads/export',      impexp.exportarLeads);
app.post('/api/leads/bulk',       leads.bulkUpdate);
app.post('/api/leads/migrate-pipeline', async (req, res) => {
  // Mueve TODOS los leads de un pipeline a otro (o todos si no se especifica origen)
  const { from_pipeline_id, to_pipeline_id, to_stage_id } = req.body;
  if (!to_pipeline_id) return res.status(400).json({ error: 'to_pipeline_id requerido' });
  const { pool } = require('./services/db');
  let query, params;
  if (from_pipeline_id) {
    query = `UPDATE leads SET pipeline_id=$1, stage_id=COALESCE($2, stage_id), updated_at=NOW() WHERE pipeline_id=$3`;
    params = [to_pipeline_id, to_stage_id || null, from_pipeline_id];
  } else {
    query = `UPDATE leads SET pipeline_id=$1, stage_id=COALESCE($2, stage_id), updated_at=NOW()`;
    params = [to_pipeline_id, to_stage_id || null];
  }
  const result = await pool.query(query, params);
  res.json({ updated: result.rowCount });
});
app.post('/api/leads/merge',      leads.mergeLeads);
app.get('/api/leads',             leads.listar);
app.get('/api/leads/:id',         leads.obtener);
app.post('/api/leads',            leads.crear);
app.patch('/api/leads/:id',       leads.actualizar);
app.patch('/api/leads/:id/stage', leads.moverEtapa);
app.delete('/api/leads/:id',      leads.eliminar);
app.get('/api/leads/:id/resumen',      aiLimiter, leads.resumenIA);
app.post('/api/leads/:id/ai-chat',    aiLimiter, leads.aiChatLead);
app.post('/api/leads/:id/send-welcome', async (req, res) => {
  try {
    const { pool } = require('./services/db');
    const { sendWelcomeEmail } = require('./controllers/webhookController');
    const { rows } = await pool.query(
      `SELECT l.*, c.email, c.name as contact_name
       FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
       WHERE l.id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = rows[0];
    if (!lead.email) return res.status(400).json({ error: 'El contacto no tiene email' });
    await sendWelcomeEmail(lead.email, lead.contact_name);
    res.json({ ok: true, sent_to: lead.email });
  } catch (err) {
    console.error('[send-welcome]', err.message);
    res.status(500).json({ error: err.message });
  }
});
// Settings: get/update welcome email template
app.get('/api/settings/welcome-email', async (req, res) => {
  const { pool } = require('./services/db');
  const { rows } = await pool.query(`SELECT value FROM config WHERE key='welcome_email_template' LIMIT 1`);
  res.json(rows[0]?.value || { enabled: true, subject: '', body_html: '' });
});
app.put('/api/settings/welcome-email', async (req, res) => {
  const { pool } = require('./services/db');
  await pool.query(
    `INSERT INTO config (key, value) VALUES ('welcome_email_template', $1)
     ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
    [JSON.stringify(req.body)]
  );
  res.json({ ok: true });
});
app.get('/api/leads/:id/lead-contacts',                     leads.getLeadContacts);
app.post('/api/leads/:id/lead-contacts',                    leads.addLeadContact);
app.delete('/api/leads/:id/lead-contacts/:contactEntryId',  leads.removeLeadContact);
app.patch('/api/leads/:id/bot',                             leads.toggleBot);
app.patch('/api/leads/:id/follow-up',                       leads.setFollowUp);

// Lead notes
app.get('/api/leads/:leadId/notes',       notes.listarNotas);
app.post('/api/leads/:leadId/notes',      notes.crearNota);
app.delete('/api/leads/:leadId/notes/:noteId', notes.eliminarNota);

// Lead internal notes (team-only)
app.get('/api/leads/:id/internal-notes',             leads.listarNotasInternas);
app.post('/api/leads/:id/internal-notes',            leads.crearNotaInterna);
app.delete('/api/leads/:id/internal-notes/:noteId',  leads.eliminarNotaInterna);

// Team chat
app.get('/api/team-chat',                teamChat.listar);
app.post('/api/team-chat',               teamChat.enviar);
app.get('/api/team-chat/daily-summary',  teamChat.dailySummary);

// Team tasks
app.get('/api/team-tasks',        teamChat.listarTareas);
app.post('/api/team-tasks',       teamChat.crearTarea);
app.patch('/api/team-tasks/:id',  teamChat.actualizarTarea);
app.delete('/api/team-tasks/:id', teamChat.eliminarTarea);

// Lead tags
app.get('/api/leads/:leadId/tags',          notes.listarTags);
app.post('/api/leads/:leadId/tags',         notes.agregarTag);
app.delete('/api/leads/:leadId/tags/:tag',  notes.eliminarTag);

// Lead activity
app.get('/api/leads/:leadId/activity', notes.listarActividad);

// Automations
app.get('/api/automations',        automations.listar);
app.post('/api/automations',       automations.crear);
app.patch('/api/automations/:id',  automations.actualizar);
app.delete('/api/automations/:id', automations.eliminar);

// Agent report + bulk message
app.get('/api/reports/agents',     agentReport.reporteAgentes);
app.post('/api/reports/score',     agentReport.scoreLeads);
app.post('/api/leads/bulk-message', agentReport.bulkMessage);

// Analytics
app.get('/api/analytics/funnel',    analytics.funnel);
app.get('/api/analytics/win-rate',  analytics.winRate);
app.get('/api/analytics/revenue',   analytics.revenue);
app.get('/api/analytics/top-leads', analytics.topLeads);
app.get('/api/analytics/agents',    analytics.agentPerformance);

// Goals / Metas
app.get('/api/goals/forecast',  goals.forecast);
app.get('/api/goals',           goals.listar);
app.post('/api/goals',          requireAdmin, goals.crear);
app.patch('/api/goals/:id',     requireAdmin, goals.actualizar);
app.delete('/api/goals/:id',    requireAdmin, goals.eliminar);

// Pipelines
app.post('/api/pipelines/seed',     requireAdmin,      pipelines.seedDefaultPipelineHandler);
app.get('/api/pipelines',                              pipelines.listarPipelines);
app.post('/api/pipelines',          requireAdmin,      pipelines.crearPipeline);
app.put('/api/pipelines/:pipelineId',                  pipelines.actualizarPipeline);
app.delete('/api/pipelines/:pipelineId',               pipelines.eliminarPipeline);
app.post('/api/pipelines/:pipelineId/stages',               requireAdmin, pipelines.crearEtapa);
app.patch('/api/pipelines/:pipelineId/stages/:stageId',     requireAdmin, pipelines.actualizarEtapa);
app.delete('/api/pipelines/:pipelineId/stages/:stageId',    requireAdmin, pipelines.eliminarEtapa);

// Messages / Inbox
app.get('/api/inbox',                    messages.listarInbox);
app.get('/api/leads/:leadId/messages',   messages.listarMensajesLead);
app.post('/api/messages/send',           messages.enviarMensaje);

// Tasks
app.get('/api/tasks',        tasks.listar);
app.post('/api/tasks',       tasks.crear);
app.patch('/api/tasks/:id/complete', tasks.completar);
app.delete('/api/tasks/:id', tasks.eliminar);

// Alerts
app.get('/api/alerts',                alerts.listar);
app.patch('/api/alerts/:id/seen',     alerts.marcarVisto);
app.post('/api/alerts/seen-all',      alerts.marcarTodosVistos);
app.patch('/api/alerts/:id/status',   alerts.actualizarStatus);

// Quick replies
app.get('/api/quick-replies',        quickReplies.listar);
app.post('/api/quick-replies',       quickReplies.crear);
app.patch('/api/quick-replies/:id',  quickReplies.actualizar);
app.delete('/api/quick-replies/:id', quickReplies.eliminar);

// Custom fields
app.get('/api/custom-fields/values/:entity_type/:entity_id', customFields.getValues);
app.post('/api/custom-fields/values/:entity_type/:entity_id', customFields.saveValues);
app.get('/api/custom-fields',         customFields.listar);
app.post('/api/custom-fields',        customFields.crear);
app.delete('/api/custom-fields/:id',  customFields.eliminar);

// Settings
app.post('/api/settings/seed', requireAdmin, async (req, res) => {
  try { res.json(await settings.seedDefaultConfig()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/settings',       requireAdmin, settings.obtener);
app.post('/api/settings',      requireAdmin, settings.actualizar);
app.post('/api/settings/test-bot', settings.testBot);
app.post('/api/translate', authMiddleware, translate.translate);

// Reports
app.get('/api/reports/pdf', reports.generarReporte);

// Calls (click-to-call)
app.get('/api/calls/token',       calls.getToken);
app.post('/api/calls/start',      calls.iniciarLlamada);
app.patch('/api/calls/:id',       calls.actualizarLog);
app.get('/api/calls',             calls.listarLogs);

// Push notifications
app.post('/api/push/subscribe',    push.subscribe);
app.delete('/api/push/unsubscribe', push.unsubscribe);

// QuickBooks (protegidos)
app.get('/api/quickbooks/status',        quickbooks.status);
app.delete('/api/quickbooks/disconnect', quickbooks.disconnect);
app.post('/api/quickbooks/sync-invoice', quickbooks.syncInvoice);

// Integrations
app.get('/api/integrations',                    integrations.listar);
app.post('/api/integrations',                   integrations.guardar);
app.delete('/api/integrations/:id',             integrations.desconectar);
app.post('/api/integrations/test/slack',        integrations.testSlack);
app.patch('/api/integrations/:id/toggle',       integrations.toggleEnabled);

// Invoices / Facturación IA
app.post('/api/invoices/extract',       invoices.extractarDatos);
app.post('/api/invoices/generate',      invoices.generarPDF);
app.post('/api/invoices/from-lead',     invoices.invoiceFromLead);
app.get('/api/invoices',                invoices.listar);
app.get('/api/invoices/:id',            invoices.obtener);
app.patch('/api/invoices/:id',          invoices.actualizar);
app.patch('/api/invoices/:id/mark-paid', invoices.marcarPagada);
app.delete('/api/invoices/:id',         invoices.eliminar);
app.get('/api/invoices/:id/pdf',        invoices.descargar);

// Email
app.get('/api/emails',               email.listar);
app.post('/api/emails',              email.enviar);
app.post('/api/emails/sync',         email.sincronizar);
app.patch('/api/emails/:id/read',    email.marcarLeido);
app.delete('/api/emails/:id',        email.eliminar);

// Segments
app.get('/api/segments',                     segments.listar);
app.post('/api/segments/preview',            segments.preview);
app.post('/api/segments',                    segments.crear);
app.patch('/api/segments/:id',               segments.actualizar);
app.delete('/api/segments/:id',              segments.eliminar);
app.get('/api/segments/:id/contacts',        segments.contactsOfSegment);

// Campaigns
app.get('/api/campaigns',                    campaigns.listar);
app.post('/api/campaigns',                   campaigns.crear);
app.get('/api/campaigns/:id',                campaigns.obtener);
app.patch('/api/campaigns/:id',              campaigns.actualizar);
app.delete('/api/campaigns/:id',             campaigns.eliminar);
app.post('/api/campaigns/:id/send',          campaigns.enviar);
app.get('/api/campaigns/:id/stats',          campaigns.stats);

// Contracts
app.get('/api/contracts',        contracts.listar);
app.get('/api/contracts/:id',    contracts.obtener);
app.post('/api/contracts',       contracts.crear);
app.patch('/api/contracts/:id',  contracts.actualizar);
app.delete('/api/contracts/:id', contracts.eliminar);

// Menu links
app.get('/api/menu-links',        menuLinks.listar);
app.post('/api/menu-links',       menuLinks.crear);
app.delete('/api/menu-links/:id', menuLinks.eliminar);

// Products / Catalog
app.get('/api/products/categories', products.listarCategorias);
app.get('/api/products',            products.listar);
app.post('/api/products',           products.crear);
app.patch('/api/products/:id',      products.actualizar);
app.delete('/api/products/:id',     products.eliminar);

// Quotes / Cotizaciones
app.get('/api/quotes',              quotes.listar);
app.get('/api/quotes/:id',          quotes.obtener);
app.post('/api/quotes',             quotes.crear);
app.patch('/api/quotes/:id',        quotes.actualizar);
app.delete('/api/quotes/:id',       quotes.eliminar);
app.patch('/api/quotes/:id/status', quotes.cambiarStatus);
app.get('/api/quotes/:id/pdf',      quotes.generarPDF);

// Call recordings
app.get('/api/calls/:id/recording',    callRecording.obtenerGrabacion);
app.delete('/api/calls/:id/recording', callRecording.eliminarGrabacion);
app.get('/api/recordings',                    callRecording.listarGrabacionesTwilio);
app.post('/api/recordings/:sid/transcribe',   callRecording.transcribirGrabacion);

// Sequences (follow-up automations)
app.get('/api/sequences',                    sequences.listar);
app.get('/api/sequences/enrollments',        sequences.listarEnrollments);
app.post('/api/sequences',                   sequences.crear);
app.get('/api/sequences/:id',                sequences.obtener);
app.patch('/api/sequences/:id',              sequences.actualizar);
app.delete('/api/sequences/:id',             sequences.eliminar);
app.patch('/api/sequences/:id/toggle',       sequences.toggleActivo);
app.post('/api/sequences/:id/enroll',        sequences.enrollar);
app.delete('/api/sequences/enrollments/:id', sequences.cancelarEnrollment);

// Contact timeline & summary
app.get('/api/contacts/:id/timeline', timeline.timelineContacto);
app.get('/api/contacts/:id/summary',  timeline.resumenContacto);

// E-signatures (protected)
app.post('/api/contracts/:id/signature-request', signatures.solicitarFirma);
app.get('/api/contracts/:id/signature',          signatures.verFirma);

// Enrich admin endpoints
app.post('/api/admin/enrich/all',  authMiddleware, (req, res) => { enrichAllMissingNames(); res.json({ ok: true, msg: 'Batch encolado' }); });
app.post('/api/admin/enrich/:id',  authMiddleware, (req, res) => { enqueueEnrich(Number(req.params.id)); res.json({ ok: true, msg: `Lead ${req.params.id} encolado` }); });

// Permissions (admin only)
app.get('/api/permissions',  requireAdmin, permissionsCtrl.listarPermisos);
app.post('/api/permissions', requireAdmin, permissionsCtrl.actualizarPermiso);

// Agents (admin only)
app.get('/api/agents',         requireAdmin, auth.listarUsuarios);
app.post('/api/agents',        requireAdmin, auth.crearUsuario);
app.patch('/api/agents/:id',   requireAdmin, auth.actualizarUsuario);
app.delete('/api/agents/:id',  requireAdmin, auth.eliminarUsuario);

// Suppliers (proveedores)
app.get('/api/suppliers',      suppliers.listar);
app.get('/api/suppliers/:id',  suppliers.obtener);
app.post('/api/suppliers',     suppliers.crear);
app.patch('/api/suppliers/:id',suppliers.actualizar);
app.delete('/api/suppliers/:id',suppliers.eliminar);

// Onboarding
app.get('/api/contacts/:contactId/onboarding',                         onboarding.obtener);
app.patch('/api/contacts/:contactId/onboarding/:itemId',               onboarding.toggleItem);
app.post('/api/contacts/:contactId/onboarding/items',                  onboarding.addItem);
app.get('/api/public/onboarding/:token',                               publicTokenLimiter, onboarding.obtenerPublico);
app.patch('/api/public/onboarding/:token/toggle',                      publicTokenLimiter, onboarding.toggleItemPublico);

// Financial reports
const finReports = require('./controllers/financialReportController');
app.get('/api/reports/financial',        finReports.resumenFinanciero);
app.get('/api/reports/financial/excel',  finReports.exportarExcel);

// Global error handler — never expose internal error details to clients
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'CORS policy' });
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;

// ── Background job: alert for inactive leads (runs every 6 hours) ─────────────
async function checkLeadsInactivos() {
  try {
    console.log('[JOB] Checking inactive leads...');

    // Find leads not in terminal stages, inactive for 5+ days
    const leadsR = await dbPool.query(`
      SELECT l.id, l.title, c.name AS contact_name
      FROM leads l
      LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
      LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE ps.name NOT IN ('Completado', 'Perdido')
        AND l.updated_at < NOW() - INTERVAL '5 days'
        AND NOT EXISTS (
          SELECT 1 FROM alerts a
          WHERE a.lead_id = l.id
            AND a.title = 'Lead inactivo 5+ días'
            AND a.created_at > NOW() - INTERVAL '7 days'
        )
    `);

    for (const lead of leadsR.rows) {
      const mensaje = `${lead.title}${lead.contact_name ? ' — ' + lead.contact_name : ''}`;
      await dbPool.query(
        `INSERT INTO alerts (title, message, lead_id, seen, type) VALUES ($1, $2, $3, false, $4)`,
        ['Lead inactivo 5+ días', mensaje, lead.id, 'warning']
      );
      console.log(`[JOB] Alert created for inactive lead: ${lead.title}`);
    }

    if (leadsR.rows.length === 0) {
      console.log('[JOB] No inactive leads found.');
    }
  } catch (err) {
    console.error('[JOB] Error checking inactive leads:', err.message);
  }
}

const SIX_HOURS  = 6 * 60 * 60 * 1000;
const ONE_HOUR   = 60 * 60 * 1000;

async function checkFollowUps() {
  try {
    const r = await dbPool.query(`
      SELECT l.id, l.title, c.name AS contact_name
      FROM leads l
      LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE l.follow_up_at IS NOT NULL
        AND l.follow_up_at <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM alerts a
          WHERE a.lead_id = l.id
            AND a.title = 'Recordatorio de seguimiento'
            AND a.created_at > NOW() - INTERVAL '1 day'
        )
    `);
    for (const lead of r.rows) {
      const msg = `${lead.title}${lead.contact_name ? ' — ' + lead.contact_name : ''}`;
      await dbPool.query(
        `INSERT INTO alerts (title, message, lead_id, seen) VALUES ($1,$2,$3,false)`,
        ['Recordatorio de seguimiento', msg, lead.id]
      );
      await dbPool.query(`UPDATE leads SET follow_up_at=NULL WHERE id=$1`, [lead.id]);
      console.log(`[JOB] Follow-up alert created for lead: ${lead.title}`);
    }
  } catch (err) { console.error('[JOB] Error checking follow-ups:', err.message); }
}

// ── Email auto-sync (every 15 minutes) ────────────────────────────────────────
const emailCtrl = require('./controllers/emailController');
async function autoSyncEmails() {
  const accounts = ['operations'];
  if (process.env.BOOKINGS_PASS) accounts.push('bookings');
  for (const account of accounts) {
    try {
      const fakeReq = { query: { account } };
      const fakeRes = { json: (r) => console.log(`[EMAIL SYNC] ${account}: +${r.saved} (inbox:${r.inbox} sent:${r.sent})`) };
      await emailCtrl.sincronizar(fakeReq, fakeRes);
    } catch (e) {
      console.error(`[EMAIL SYNC] ${account} error:`, e.message);
    }
  }
}

const FIFTEEN_MIN = 15 * 60 * 1000;

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[SERVER] Energy Depot PR — Puerto ${PORT}`));
    // Run immediately on startup, then periodically
    checkLeadsInactivos();
    setInterval(checkLeadsInactivos, SIX_HOURS);
    checkFollowUps();
    setInterval(checkFollowUps, ONE_HOUR);
    // Update lead scores every 2 hours
    agentReport.scoreLeads({ body: {} }, { json: () => {} });
    setInterval(() => agentReport.scoreLeads({ body: {} }, { json: () => {} }), 2 * ONE_HOUR);
    // Process follow-up sequences every 5 minutes
    setInterval(() => sequences.procesarSecuencias().catch(e => console.error('[JOB] sequences:', e.message)), 5 * 60 * 1000);
    // Auto-sync emails every 15 minutes
    setTimeout(autoSyncEmails, 10000); // first run 10s after start
    setInterval(autoSyncEmails, FIFTEEN_MIN);
    // Twilio message sync every 30s + AI enrichment on new messages
    setTimeout(syncTwilioMessages, 15000);
    setInterval(syncTwilioMessages, 30 * 1000);
    // Enrich existing leads missing name/email (runs at startup + every 6 hours for new ones)
    enrichAllMissingNames();
    setInterval(enrichAllMissingNames, SIX_HOURS);
  })
  .catch(err => { console.error('[SERVER] Error iniciando DB:', err); process.exit(1); });
