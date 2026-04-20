// ── Documentación de la API pública (estilo OpenAPI simplificado) ─────────────

const BASE_URL = process.env.API_BASE_URL || 'https://crm-ia-production-c247.up.railway.app';

const DOCS = {
  info: {
    title: 'CRM IA Propio — API',
    version: '1.0.0',
    description: 'API REST del CRM IA. Todas las rutas protegidas requieren un Bearer token JWT obtenido mediante POST /api/auth/login.',
    base_url: BASE_URL,
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer <token>',
      obtain: 'POST /api/auth/login con { email, password }',
      expiration: '7 días',
    },
  },
  resources: [
    {
      name: 'Autenticación',
      description: 'Obtener y gestionar tokens de acceso.',
      endpoints: [
        {
          method: 'POST',
          path: '/api/auth/login',
          description: 'Iniciar sesión y obtener token JWT',
          auth: false,
          body: { email: 'string', password: 'string' },
          response: { token: 'string', user: { id: 'number', name: 'string', email: 'string', role: 'string' } },
          example: `curl -X POST ${BASE_URL}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@ejemplo.com","password":"tu-password"}'`,
        },
        {
          method: 'GET',
          path: '/api/me',
          description: 'Obtener datos del usuario autenticado',
          auth: true,
          response: { id: 'number', name: 'string', email: 'string', role: 'string' },
          example: `curl ${BASE_URL}/api/me \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
      ],
    },
    {
      name: 'Contactos',
      description: 'Gestión del directorio de contactos.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/contacts',
          description: 'Listar contactos (soporta ?q=búsqueda&page=1&limit=50)',
          auth: true,
          params: [
            { name: 'q', type: 'string', required: false, description: 'Texto de búsqueda (nombre, email, teléfono)' },
            { name: 'page', type: 'number', required: false, description: 'Página (default 1)' },
            { name: 'limit', type: 'number', required: false, description: 'Resultados por página (default 50)' },
          ],
          response: [{ id: 'number', name: 'string', email: 'string', phone: 'string', company: 'string', created_at: 'ISO date' }],
          example: `curl "${BASE_URL}/api/contacts?q=Juan&limit=20" \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'GET',
          path: '/api/contacts/:id',
          description: 'Obtener un contacto por ID',
          auth: true,
          response: { id: 'number', name: 'string', email: 'string', phone: 'string', company: 'string' },
          example: `curl ${BASE_URL}/api/contacts/42 \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'POST',
          path: '/api/contacts',
          description: 'Crear un nuevo contacto',
          auth: true,
          body: { name: 'string (requerido)', email: 'string', phone: 'string', company: 'string', country: 'string', notes: 'string' },
          response: { id: 'number', name: 'string', email: 'string', phone: 'string' },
          example: `curl -X POST ${BASE_URL}/api/contacts \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Juan Pérez","email":"juan@ejemplo.com","phone":"+1787000000"}'`,
        },
        {
          method: 'PATCH',
          path: '/api/contacts/:id',
          description: 'Actualizar un contacto (solo campos enviados)',
          auth: true,
          body: { name: 'string', email: 'string', phone: 'string', company: 'string', country: 'string', notes: 'string' },
          response: { ok: true },
          example: `curl -X PATCH ${BASE_URL}/api/contacts/42 \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+1787111111"}'`,
        },
        {
          method: 'DELETE',
          path: '/api/contacts/:id',
          description: 'Eliminar un contacto',
          auth: true,
          response: { ok: true },
          example: `curl -X DELETE ${BASE_URL}/api/contacts/42 \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
      ],
    },
    {
      name: 'Leads',
      description: 'Gestión del pipeline de ventas.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/leads',
          description: 'Listar leads (soporta filtros por pipeline, etapa, agente, búsqueda)',
          auth: true,
          params: [
            { name: 'pipeline_id', type: 'number', required: false, description: 'Filtrar por pipeline' },
            { name: 'stage_id', type: 'number', required: false, description: 'Filtrar por etapa' },
            { name: 'agent_id', type: 'number', required: false, description: 'Filtrar por agente asignado' },
            { name: 'q', type: 'string', required: false, description: 'Búsqueda por nombre / teléfono' },
          ],
          response: [{ id: 'number', name: 'string', phone: 'string', stage: 'string', agent_name: 'string', value: 'number', created_at: 'ISO date' }],
          example: `curl "${BASE_URL}/api/leads?pipeline_id=1&q=Maria" \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'GET',
          path: '/api/leads/:id',
          description: 'Obtener un lead por ID (incluye contacto, etapa, mensajes recientes)',
          auth: true,
          response: { id: 'number', name: 'string', phone: 'string', stage: 'object', contact: 'object', agent: 'object' },
          example: `curl ${BASE_URL}/api/leads/15 \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'POST',
          path: '/api/leads',
          description: 'Crear un nuevo lead',
          auth: true,
          body: { name: 'string (requerido)', phone: 'string', pipeline_id: 'number', stage_id: 'number', agent_id: 'number', value: 'number' },
          response: { id: 'number', name: 'string' },
          example: `curl -X POST ${BASE_URL}/api/leads \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"María López","phone":"+1787222000","pipeline_id":1}'`,
        },
        {
          method: 'PATCH',
          path: '/api/leads/:id/stage',
          description: 'Mover un lead a otra etapa',
          auth: true,
          body: { stage_id: 'number (requerido)' },
          response: { ok: true },
          example: `curl -X PATCH ${BASE_URL}/api/leads/15/stage \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"stage_id":3}'`,
        },
        {
          method: 'DELETE',
          path: '/api/leads/:id',
          description: 'Eliminar un lead',
          auth: true,
          response: { ok: true },
          example: `curl -X DELETE ${BASE_URL}/api/leads/15 \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
      ],
    },
    {
      name: 'Mensajes',
      description: 'Envío y consulta de mensajes (SMS, WhatsApp, Email).',
      endpoints: [
        {
          method: 'GET',
          path: '/api/leads/:leadId/messages',
          description: 'Obtener historial de mensajes de un lead',
          auth: true,
          response: [{ id: 'number', body: 'string', direction: 'inbound|outbound', channel: 'sms|whatsapp|email', created_at: 'ISO date' }],
          example: `curl ${BASE_URL}/api/leads/15/messages \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'POST',
          path: '/api/messages/send',
          description: 'Enviar un mensaje a un lead',
          auth: true,
          body: { lead_id: 'number (requerido)', text: 'string (requerido)', channel: 'sms|whatsapp (opcional)' },
          response: { ok: true, message_id: 'number' },
          example: `curl -X POST ${BASE_URL}/api/messages/send \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"lead_id":15,"text":"Hola! Cómo puedo ayudarte?","channel":"sms"}'`,
        },
      ],
    },
    {
      name: 'Llamadas',
      description: 'Registro y grabaciones de llamadas (requiere Twilio configurado).',
      endpoints: [
        {
          method: 'GET',
          path: '/api/calls',
          description: 'Listar logs de llamadas (opcional: ?lead_id=X)',
          auth: true,
          params: [
            { name: 'lead_id', type: 'number', required: false, description: 'Filtrar por lead' },
          ],
          response: [{ id: 'number', call_sid: 'string', to_number: 'string', from_number: 'string', status: 'string', duration: 'number', agent_name: 'string', recording_url: 'string|null', created_at: 'ISO date' }],
          example: `curl "${BASE_URL}/api/calls?lead_id=15" \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'GET',
          path: '/api/calls/:id/recording',
          description: 'Obtener URL autenticada de la grabación de una llamada',
          auth: true,
          response: { recording_url: 'string (URL con auth)', recording_sid: 'string', original_url: 'string' },
          example: `curl ${BASE_URL}/api/calls/7/recording \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'DELETE',
          path: '/api/calls/:id/recording',
          description: 'Eliminar la grabación de una llamada (en Twilio y en el CRM)',
          auth: true,
          response: { ok: true },
          example: `curl -X DELETE ${BASE_URL}/api/calls/7/recording \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
      ],
    },
    {
      name: 'Facturas',
      description: 'Gestión de facturas.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/invoices',
          description: 'Listar todas las facturas',
          auth: true,
          response: [{ id: 'number', number: 'string', client_name: 'string', total: 'number', status: 'string', created_at: 'ISO date' }],
          example: `curl ${BASE_URL}/api/invoices \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'GET',
          path: '/api/invoices/:id',
          description: 'Obtener factura por ID (con líneas de detalle)',
          auth: true,
          response: { id: 'number', number: 'string', client_name: 'string', items: 'array', total: 'number', status: 'string' },
          example: `curl ${BASE_URL}/api/invoices/3 \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'DELETE',
          path: '/api/invoices/:id',
          description: 'Eliminar una factura',
          auth: true,
          response: { ok: true },
          example: `curl -X DELETE ${BASE_URL}/api/invoices/3 \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
      ],
    },
    {
      name: 'Contratos',
      description: 'Gestión de contratos.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/contracts',
          description: 'Listar contratos (opcional: ?lead_id=X&status=active)',
          auth: true,
          params: [
            { name: 'lead_id', type: 'number', required: false, description: 'Filtrar por lead' },
            { name: 'status', type: 'string', required: false, description: 'Filtrar por estado' },
          ],
          response: [{ id: 'number', title: 'string', lead_name: 'string', status: 'string', signed_at: 'ISO date|null', created_at: 'ISO date' }],
          example: `curl "${BASE_URL}/api/contracts?status=active" \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'POST',
          path: '/api/contracts',
          description: 'Crear un contrato',
          auth: true,
          body: { lead_id: 'number', title: 'string (requerido)', content: 'string', value: 'number' },
          response: { id: 'number', title: 'string' },
          example: `curl -X POST ${BASE_URL}/api/contracts \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"lead_id":15,"title":"Contrato de servicio","value":1500}'`,
        },
        {
          method: 'DELETE',
          path: '/api/contracts/:id',
          description: 'Eliminar un contrato',
          auth: true,
          response: { ok: true },
          example: `curl -X DELETE ${BASE_URL}/api/contracts/2 \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
      ],
    },
    {
      name: 'Tareas',
      description: 'Gestión de tareas y seguimientos.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/tasks',
          description: 'Listar tareas (opcional: ?lead_id=X&completed=false)',
          auth: true,
          params: [
            { name: 'lead_id', type: 'number', required: false, description: 'Filtrar por lead' },
            { name: 'completed', type: 'boolean', required: false, description: 'Filtrar por completadas/pendientes' },
          ],
          response: [{ id: 'number', title: 'string', lead_name: 'string', due_at: 'ISO date', completed: 'boolean', created_at: 'ISO date' }],
          example: `curl "${BASE_URL}/api/tasks?completed=false" \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'POST',
          path: '/api/tasks',
          description: 'Crear una tarea',
          auth: true,
          body: { lead_id: 'number', title: 'string (requerido)', due_at: 'ISO date', notes: 'string' },
          response: { id: 'number', title: 'string' },
          example: `curl -X POST ${BASE_URL}/api/tasks \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"lead_id":15,"title":"Llamar para seguimiento","due_at":"2026-03-20T10:00:00Z"}'`,
        },
        {
          method: 'PATCH',
          path: '/api/tasks/:id/complete',
          description: 'Marcar tarea como completada o pendiente',
          auth: true,
          body: { completed: 'boolean' },
          response: { ok: true },
          example: `curl -X PATCH ${BASE_URL}/api/tasks/8/complete \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"completed":true}'`,
        },
      ],
    },
    {
      name: 'Agentes',
      description: 'Gestión de usuarios/agentes del CRM (solo admin).',
      endpoints: [
        {
          method: 'GET',
          path: '/api/agents',
          description: 'Listar todos los agentes',
          auth: true,
          response: [{ id: 'number', name: 'string', email: 'string', role: 'string', active: 'boolean' }],
          example: `curl ${BASE_URL}/api/agents \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'POST',
          path: '/api/agents',
          description: 'Crear un nuevo agente (solo admin)',
          auth: true,
          body: { name: 'string (requerido)', email: 'string (requerido)', password: 'string (requerido)', role: 'admin|employee' },
          response: { id: 'number', name: 'string', email: 'string', role: 'string' },
          example: `curl -X POST ${BASE_URL}/api/agents \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Ana García","email":"ana@empresa.com","password":"pass123","role":"employee"}'`,
        },
        {
          method: 'PATCH',
          path: '/api/agents/:id',
          description: 'Actualizar un agente (solo admin)',
          auth: true,
          body: { name: 'string', role: 'string', active: 'boolean', password: 'string' },
          response: { ok: true },
          example: `curl -X PATCH ${BASE_URL}/api/agents/5 \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"active":false}'`,
        },
      ],
    },
    {
      name: 'Permisos',
      description: 'Sistema de permisos granulares por rol (solo admin).',
      endpoints: [
        {
          method: 'GET',
          path: '/api/permissions',
          description: 'Listar todos los permisos disponibles y los asignados por rol',
          auth: true,
          response: { all_permissions: ['string'], by_role: { admin: ['string'], employee: ['string'] } },
          example: `curl ${BASE_URL}/api/permissions \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'POST',
          path: '/api/permissions',
          description: 'Activar o desactivar un permiso para un rol',
          auth: true,
          body: { role: 'string (requerido)', permission: 'string (requerido)', granted: 'boolean' },
          response: { ok: true, role: 'string', permission: 'string', granted: 'boolean' },
          example: `curl -X POST ${BASE_URL}/api/permissions \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"role":"employee","permission":"leads.delete","granted":true}'`,
        },
      ],
    },
    {
      name: 'Reportes',
      description: 'Estadísticas y reportes del CRM.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/stats',
          description: 'Estadísticas generales del CRM (leads, mensajes, tareas pendientes)',
          auth: true,
          response: { total_leads: 'number', active_leads: 'number', total_messages: 'number', pending_tasks: 'number' },
          example: `curl ${BASE_URL}/api/stats \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'GET',
          path: '/api/stats/chart',
          description: 'Datos de gráfica de actividad por días',
          auth: true,
          params: [
            { name: 'days', type: 'number', required: false, description: 'Rango en días (default 30)' },
          ],
          response: [{ date: 'string', leads: 'number', messages: 'number' }],
          example: `curl "${BASE_URL}/api/stats/chart?days=14" \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
        {
          method: 'GET',
          path: '/api/reports/agents',
          description: 'Reporte de desempeño por agente',
          auth: true,
          params: [
            { name: 'days', type: 'number', required: false, description: 'Rango en días (default 30)' },
          ],
          response: [{ agent_name: 'string', leads: 'number', messages: 'number', calls: 'number', tasks_completed: 'number' }],
          example: `curl "${BASE_URL}/api/reports/agents?days=30" \\
  -H "Authorization: Bearer TU_TOKEN"`,
        },
      ],
    },
  ],
};

async function getDocs(req, res) {
  res.json(DOCS);
}

module.exports = { getDocs };

/* ROUTES_TO_ADD_server.js
app.get('/api/docs', apiDocs.getDocs);
*/
