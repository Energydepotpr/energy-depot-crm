const BASE = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('crm_token');
}

async function req(method, path, body) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && path !== '/api/auth/login') {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    window.location.href = '/login';
    return;
  }

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`);
    err.code = data.error;
    err.status = res.status;
    if (data.leads_count !== undefined) err.leads_count = data.leads_count;
    if (data.existing !== undefined) err.existing = data.existing;
    throw err;
  }
  return data;
}

export const api = {
  login:        (email, password)    => req('POST', '/api/auth/login', { email, password }),
  me:           ()                   => req('GET',  '/api/me'),
  stats:        ()                   => req('GET',  '/api/stats'),
  weather:      (city = 'San Juan,PR,US') => req('GET', `/api/weather?city=${encodeURIComponent(city)}`),
  assistant:    (messages, leadId) => req('POST', '/api/assistant', { messages, ...(leadId ? { leadId } : {}) }),

  // Contacts
  contacts:           (params = '')  => req('GET',  `/api/contacts${params}`),
  contact:            (id)           => req('GET',  `/api/contacts/${id}`),
  createContact:      (data)         => req('POST', '/api/contacts', data),
  updateContact:      (id, data)     => req('PATCH',`/api/contacts/${id}`, data),
  deleteContact:      (id)           => req('DELETE',`/api/contacts/${id}`),
  checkDuplicate:     (params = '')  => req('GET',  `/api/contacts/check-duplicate${params}`),
  findDuplicates:     ()             => req('GET',  '/api/contacts/duplicates'),
  mergeContacts:      (keep_id, discard_id) => req('POST', '/api/contacts/merge', { keep_id, discard_id }),

  // Leads
  leads:        (params = '')        => req('GET',  `/api/leads${params}`),
  lead:         (id)                 => req('GET',  `/api/leads/${id}`),
  createLead:   (data)               => req('POST', '/api/leads', data),
  updateLead:   (id, data)           => req('PATCH',`/api/leads/${id}`, data),
  moveLead:     (id, data)           => req('PATCH',`/api/leads/${id}/stage`, data),
  deleteLead:   (id)                 => req('DELETE',`/api/leads/${id}`),
  bulkLeads:        (data)                 => req('POST', '/api/leads/bulk', data),
  bulkMessage:      (lead_ids, text)       => req('POST', '/api/leads/bulk-message', { lead_ids: [...lead_ids], text }),
  mergeLeads:       (source_id, target_id) => req('POST', '/api/leads/merge', { source_id, target_id }),
  toggleLeadBot:(id, disabled)         => req('PATCH', `/api/leads/${id}/bot`, { disabled }),
  setFollowUp:  (id, follow_up_at)     => req('PATCH', `/api/leads/${id}/follow-up`, { follow_up_at }),
  translate:    (text, to = 'en')      => req('POST',  '/api/translate', { text, to }),

  // Trip info
  tripInfo:         (leadId)       => req('GET',   `/api/leads/${leadId}/trip`),
  saveTripInfo:     (leadId, data) => req('PATCH', `/api/leads/${leadId}/trip`, data),

  // Lead extra contacts
  leadContacts:     (leadId)       => req('GET',   `/api/leads/${leadId}/lead-contacts`),
  addLeadContact:   (leadId, data) => req('POST',  `/api/leads/${leadId}/lead-contacts`, data),
  removeLeadContact:(leadId, cId)  => req('DELETE', `/api/leads/${leadId}/lead-contacts/${cId}`),

  // Pipelines
  pipelines:        ()                        => req('GET',    '/api/pipelines'),
  createPipeline:   (name)                    => req('POST',   '/api/pipelines', { name }),
  createStage:      (pipelineId, data)        => req('POST',   `/api/pipelines/${pipelineId}/stages`, data),
  updateStage:      (pipelineId, stageId, d)  => req('PATCH',  `/api/pipelines/${pipelineId}/stages/${stageId}`, d),
  deleteStage:      (pipelineId, stageId)     => req('DELETE', `/api/pipelines/${pipelineId}/stages/${stageId}`),

  // Messages
  inbox:        ()                   => req('GET',  '/api/inbox'),
  messages:     (leadId)             => req('GET',  `/api/leads/${leadId}/messages`),
  sendMessage:  (lead_id, text, channel) => req('POST', '/api/messages/send', { lead_id, text, ...(channel ? { channel } : {}) }),

  // Search
  search:       (q)                  => req('GET', `/api/search?q=${encodeURIComponent(q)}`),

  // Stats
  statsChart:   (days = 30)          => req('GET', `/api/stats/chart?days=${days}`),

  // Import / Export (export abre URL directa)
  importContacts: (rows)             => req('POST', '/api/contacts/import', { rows }),

  // Lead AI summary
  leadResumen:  (leadId)             => req('GET',    `/api/leads/${leadId}/resumen`),

  // Notes
  notes:        (leadId)             => req('GET',    `/api/leads/${leadId}/notes`),
  createNote:   (leadId, text)       => req('POST',   `/api/leads/${leadId}/notes`, { text }),
  deleteNote:   (leadId, noteId)     => req('DELETE', `/api/leads/${leadId}/notes/${noteId}`),

  // Internal notes (team-only)
  leadInternalNotes:   (id)              => req('GET',    `/api/leads/${id}/internal-notes`),
  addInternalNote:     (id, content)     => req('POST',   `/api/leads/${id}/internal-notes`, { content }),
  deleteInternalNote:  (leadId, noteId)  => req('DELETE', `/api/leads/${leadId}/internal-notes/${noteId}`),

  // Team chat
  teamChat:         ()        => req('GET',  '/api/team-chat'),
  sendTeamMessage:  (content) => req('POST', '/api/team-chat', { content }),
  teamChatSummary:  ()        => req('GET',  '/api/team-chat/daily-summary'),

  // Team tasks
  teamTasks:        ()              => req('GET',    '/api/team-tasks'),
  createTeamTask:   (data)          => req('POST',   '/api/team-tasks', data),
  updateTeamTask:   (id, data)      => req('PATCH',  `/api/team-tasks/${id}`, data),
  deleteTeamTask:   (id)            => req('DELETE', `/api/team-tasks/${id}`),

  // Lead AI Chat
  leadAiChat:       (id, message)   => req('POST',   `/api/leads/${id}/ai-chat`, { message }),

  // Tags
  tags:         (leadId)             => req('GET',    `/api/leads/${leadId}/tags`),
  addTag:       (leadId, tag, color) => req('POST',   `/api/leads/${leadId}/tags`, { tag, color }),
  deleteTag:    (leadId, tag)        => req('DELETE', `/api/leads/${leadId}/tags/${encodeURIComponent(tag)}`),

  // Activity
  activity:     (leadId)             => req('GET',    `/api/leads/${leadId}/activity`),

  // Tasks
  tasks:        (params = '')        => req('GET',    `/api/tasks${params}`),
  createTask:   (data)               => req('POST',   '/api/tasks', data),
  completeTask: (id, completed)      => req('PATCH',  `/api/tasks/${id}/complete`, { completed }),
  deleteTask:   (id)                 => req('DELETE', `/api/tasks/${id}`),

  // Alerts
  alertsUnseen:      ()              => req('GET',    '/api/alerts?seen=false'),
  alerts:            (params = '')   => req('GET',    `/api/alerts${params}`),
  seenAlert:         (id)            => req('PATCH',  `/api/alerts/${id}/seen`),
  seenAllAlerts:     ()              => req('POST',   '/api/alerts/seen-all'),
  updateAlertStatus: (id, status)    => req('PATCH',  `/api/alerts/${id}/status`, { status }),

  // Quick replies
  quickReplies:       ()             => req('GET',    '/api/quick-replies'),
  createQuickReply:   (data)         => req('POST',   '/api/quick-replies', data),
  updateQuickReply:   (id, data)     => req('PATCH',  `/api/quick-replies/${id}`, data),
  deleteQuickReply:   (id)           => req('DELETE', `/api/quick-replies/${id}`),

  // Settings
  settings:     ()                   => req('GET',  '/api/settings'),
  saveSetting:  (key, value)         => req('POST', '/api/settings', { key, value }),
  testBot:      (mensaje, historial) => req('POST', '/api/settings/test-bot', { mensaje, historial }),

  // Biblioteca GIGI
  seedKnowledgeBase: (data, force)   => req('POST', '/api/biblioteca-gigi/seed', { data, force }),

  // Custom fields
  customFields:       (entity_type)              => req('GET',    `/api/custom-fields?entity_type=${entity_type}`),
  createCustomField:  (data)                     => req('POST',   '/api/custom-fields', data),
  deleteCustomField:  (id)                       => req('DELETE', `/api/custom-fields/${id}`),
  getCustomValues:    (entity_type, entity_id)   => req('GET',    `/api/custom-fields/values/${entity_type}/${entity_id}`),
  saveCustomValues:   (entity_type, entity_id, values) => req('POST', `/api/custom-fields/values/${entity_type}/${entity_id}`, { values }),

  // Agents
  agents:       ()                   => req('GET',    '/api/agents'),
  createAgent:  (data)               => req('POST',   '/api/agents', data),
  updateAgent:  (id, data)           => req('PATCH',  `/api/agents/${id}`, data),
  deleteAgent:  (id)                 => req('DELETE', `/api/agents/${id}`),

  // Calls
  callToken:      ()             => req('GET',   '/api/calls/token'),
  startCall:      (data)         => req('POST',  '/api/calls/start', data),
  updateCall:     (id, data)     => req('PATCH', `/api/calls/${id}`, data),
  callLogs:       (lead_id)      => req('GET',   lead_id ? `/api/calls?lead_id=${lead_id}` : '/api/calls'),

  // Invoices
  // QuickBooks
  qbStatus:       ()           => req('GET',    '/api/quickbooks/status'),
  qbDisconnect:   ()           => req('DELETE', '/api/quickbooks/disconnect'),
  qbSyncInvoice:  (data)       => req('POST',   '/api/quickbooks/sync-invoice', { invoiceData: data }),

  invoiceExtract:   (message, history) => req('POST',   '/api/invoices/extract', { message, history }),
  invoiceGenerate:  (data)             => req('POST',   '/api/invoices/generate', { data }),
  invoiceFromLead:  (lead_id)          => req('POST',   '/api/invoices/from-lead', { lead_id }),
  invoices:         (q = '')           => req('GET',    `/api/invoices${q}`),
  invoice:          (id)               => req('GET',    `/api/invoices/${id}`),
  invoiceUpdate:    (id, data)         => req('PATCH',  `/api/invoices/${id}`, data),
  invoiceMarkPaid:  (id, paid_at)      => req('PATCH',  `/api/invoices/${id}/mark-paid`, { paid_at }),
  invoiceDelete:    (id)               => req('DELETE', `/api/invoices/${id}`),

  // Contracts
  contracts:        (q = '')    => req('GET',    `/api/contracts${q}`),
  contract:         (id)        => req('GET',    `/api/contracts/${id}`),
  createContract:   (data)      => req('POST',   '/api/contracts', data),
  updateContract:   (id, data)  => req('PATCH',  `/api/contracts/${id}`, data),
  deleteContract:   (id)        => req('DELETE', `/api/contracts/${id}`),

  // E-signatures
  signatureRequest: (contractId)       => req('POST', `/api/contracts/${contractId}/signature-request`),
  signatureStatus:  (contractId)       => req('GET',  `/api/contracts/${contractId}/signature`),

  // Contact timeline & summary
  contactTimeline:  (id, params = '')  => req('GET',  `/api/contacts/${id}/timeline${params}`),
  contactSummary:   (id)               => req('GET',  `/api/contacts/${id}/summary`),

  // Client portal token (auth-protected)
  portalToken:      (contactId)        => req('POST', `/api/contacts/${contactId}/portal-token`),

  // Automations
  automations:        (pipeline_id)    => req('GET',    `/api/automations${pipeline_id ? `?pipeline_id=${pipeline_id}` : ''}`),
  createAutomation:   (data)           => req('POST',   '/api/automations', data),
  updateAutomation:   (id, data)       => req('PATCH',  `/api/automations/${id}`, data),
  deleteAutomation:   (id)             => req('DELETE', `/api/automations/${id}`),

  // Agent report
  agentReport:        (days = 30)      => req('GET', `/api/reports/agents?days=${days}`),

  // Email
  emails:       (params = '') => req('GET',    `/api/emails${params}`),
  sendEmail:    (data)        => req('POST',   '/api/emails', data),
  syncEmails:   (account = 'operations') => req('POST', `/api/emails/sync?account=${account}`),
  markEmailRead:(id)          => req('PATCH',  `/api/emails/${id}/read`),
  deleteEmail:  (id)          => req('DELETE', `/api/emails/${id}`),

  // FareHarbor
  fareharborEvents: (params) => req('GET', `/api/fareharbor/events${params || ''}`),
  fareharborStatus: ()       => req('GET', '/api/fareharbor/status'),

  // Google Calendar
  googleCalStatus:       ()       => req('GET',    '/api/calendar/google/status'),
  googleCalEvents:       (params) => req('GET',    `/api/calendar/google/events${params || ''}`),
  googleCalCreate:       (data)   => req('POST',   '/api/calendar/google/events', data),
  googleCalDelete:       (id)     => req('DELETE', `/api/calendar/google/events/${id}`),
  googleCalDisconnect:   ()       => req('POST',   '/api/calendar/google/disconnect'),

  // Segments
  segments:             ()               => req('GET',    '/api/segments'),
  createSegment:        (data)           => req('POST',   '/api/segments', data),
  updateSegment:        (id, data)       => req('PATCH',  `/api/segments/${id}`, data),
  deleteSegment:        (id)             => req('DELETE', `/api/segments/${id}`),
  previewSegment:       (filters)        => req('POST',   '/api/segments/preview', { filters }),
  segmentContacts:      (id)             => req('GET',    `/api/segments/${id}/contacts`),

  // Campaigns
  campaigns:            ()               => req('GET',    '/api/campaigns'),
  campaign:             (id)             => req('GET',    `/api/campaigns/${id}`),
  createCampaign:       (data)           => req('POST',   '/api/campaigns', data),
  updateCampaign:       (id, data)       => req('PATCH',  `/api/campaigns/${id}`, data),
  deleteCampaign:       (id)             => req('DELETE', `/api/campaigns/${id}`),
  sendCampaign:         (id)             => req('POST',   `/api/campaigns/${id}/send`),
  campaignStats:        (id)             => req('GET',    `/api/campaigns/${id}/stats`),

  // Sequences
  sequences:              ()              => req('GET',    '/api/sequences'),
  sequence:               (id)            => req('GET',    `/api/sequences/${id}`),
  createSequence:         (data)          => req('POST',   '/api/sequences', data),
  updateSequence:         (id, data)      => req('PATCH',  `/api/sequences/${id}`, data),
  deleteSequence:         (id)            => req('DELETE', `/api/sequences/${id}`),
  toggleSequence:         (id)            => req('PATCH',  `/api/sequences/${id}/toggle`),
  enrollSequence:         (id, lead_id)   => req('POST',   `/api/sequences/${id}/enroll`, { lead_id }),
  cancelEnrollment:       (id)            => req('DELETE', `/api/sequences/enrollments/${id}`),
  sequenceEnrollments:    (params = '')   => req('GET',    `/api/sequences/enrollments${params}`),

  // Booking / Citas
  bookingPages:           ()              => req('GET',    '/api/booking/pages'),
  createBookingPage:      (data)          => req('POST',   '/api/booking/pages', data),
  updateBookingPage:      (id, data)      => req('PATCH',  `/api/booking/pages/${id}`, data),
  deleteBookingPage:      (id)            => req('DELETE', `/api/booking/pages/${id}`),
  bookings:               (params = '')   => req('GET',    `/api/booking/bookings${params}`),
  updateBooking:          (id, data)      => req('PATCH',  `/api/booking/bookings/${id}`, data),

  // Call recordings
  callRecording:        (id)            => req('GET',    `/api/calls/${id}/recording`),
  deleteRecording:      (id)            => req('DELETE', `/api/calls/${id}/recording`),
  twilioRecordings:     ()              => req('GET',    `/api/recordings`),
  recordingAudioUrl:    (sid, fmt='mp3')=> `${typeof window!=='undefined'?'/backend':''}` + `/api/recordings/${sid}/audio?format=${fmt}`,
  transcribeRecording:  (sid, translate=false) => req('POST', `/api/recordings/${sid}/transcribe?translate=${translate}`),

  // Permissions
  permissions:          ()              => req('GET',    '/api/permissions'),
  updatePermission:     (data)          => req('POST',   '/api/permissions', data),

  // Products / Catalog
  products:             (params = '')   => req('GET',    `/api/products${params}`),
  productCategories:    ()              => req('GET',    '/api/products/categories'),
  createProduct:        (data)          => req('POST',   '/api/products', data),
  updateProduct:        (id, data)      => req('PATCH',  `/api/products/${id}`, data),
  deleteProduct:        (id)            => req('DELETE', `/api/products/${id}`),

  // Quotes / Cotizaciones
  quotes:               (params = '')   => req('GET',    `/api/quotes${params}`),
  quote:                (id)            => req('GET',    `/api/quotes/${id}`),
  createQuote:          (data)          => req('POST',   '/api/quotes', data),
  updateQuote:          (id, data)      => req('PATCH',  `/api/quotes/${id}`, data),
  deleteQuote:          (id)            => req('DELETE', `/api/quotes/${id}`),
  updateQuoteStatus:    (id, status)    => req('PATCH',  `/api/quotes/${id}/status`, { status }),
  quotePDF:             (id)            => req('GET',    `/api/quotes/${id}/pdf`),

  // Analytics
  analyticsFunnel:   ()          => req('GET', '/api/analytics/funnel'),
  analyticsWinRate:  (days = 30) => req('GET', `/api/analytics/win-rate?days=${days}`),
  analyticsRevenue:  (days = 30) => req('GET', `/api/analytics/revenue?days=${days}`),
  analyticsTopLeads: ()          => req('GET', '/api/analytics/top-leads'),
  analyticsAgents:   (days = 30) => req('GET', `/api/analytics/agents?days=${days}`),

  // Goals / Metas
  goalsForecast: ()           => req('GET',    '/api/goals/forecast'),
  goals:         (period)     => req('GET',    `/api/goals${period ? `?period=${period}` : ''}`),
  createGoal:    (data)       => req('POST',   '/api/goals', data),
  updateGoal:    (id, data)   => req('PATCH',  `/api/goals/${id}`, data),
  deleteGoal:    (id)         => req('DELETE', `/api/goals/${id}`),

  // AI Proposals
  generateProposal:   (data)         => req('POST',   '/api/proposals/generate', data),
  proposals:          (params = '')  => req('GET',    `/api/proposals${params}`),

  // Booking passengers
  passengers:         (bookingId)    => req('GET',    `/api/bookings/${bookingId}/passengers`),
  createPassenger:    (bookingId, d) => req('POST',   `/api/bookings/${bookingId}/passengers`, d),
  updatePassenger:    (bookingId, id, d) => req('PATCH', `/api/bookings/${bookingId}/passengers/${id}`, d),
  deletePassenger:    (bookingId, id) => req('DELETE', `/api/bookings/${bookingId}/passengers/${id}`),
  passengerManifesto: (bookingId) => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : '';
    const B = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');
    return fetch(`${B}/api/bookings/${bookingId}/passengers/manifesto`, { headers: { Authorization: `Bearer ${t}` }}).then(r=>r.blob());
  },

  // Travel documents
  travelDocs:         (contactId)              => req('GET',    `/api/contacts/${contactId}/travel-docs`),
  createTravelDoc:    (contactId, data)        => req('POST',   `/api/contacts/${contactId}/travel-docs`, data),
  updateTravelDoc:    (contactId, docId, data) => req('PATCH',  `/api/contacts/${contactId}/travel-docs/${docId}`, data),
  deleteTravelDoc:    (contactId, docId)       => req('DELETE', `/api/contacts/${contactId}/travel-docs/${docId}`),
  expiringDocs:       ()                       => req('GET',    '/api/travel-docs/expiring'),

  // Onboarding
  onboarding:         (contactId)              => req('GET',   `/api/contacts/${contactId}/onboarding`),
  toggleOnboarding:   (contactId, itemId, completed) => req('PATCH', `/api/contacts/${contactId}/onboarding/${itemId}`, { completed }),
  addOnboardingItem:  (contactId, label)       => req('POST',  `/api/contacts/${contactId}/onboarding/items`, { label }),

  // Suppliers
  suppliers:          (params = '')  => req('GET',    `/api/suppliers${params}`),
  supplier:           (id)           => req('GET',    `/api/suppliers/${id}`),
  createSupplier:     (data)         => req('POST',   '/api/suppliers', data),
  updateSupplier:     (id, data)     => req('PATCH',  `/api/suppliers/${id}`, data),
  deleteSupplier:     (id)           => req('DELETE', `/api/suppliers/${id}`),

  // Itineraries
  itineraries:        (params = '')  => req('GET',    `/api/itineraries${params}`),
  itinerary:          (id)           => req('GET',    `/api/itineraries/${id}`),
  createItinerary:    (data)         => req('POST',   '/api/itineraries', data),
  updateItinerary:    (id, data)     => req('PATCH',  `/api/itineraries/${id}`, data),
  deleteItinerary:    (id)           => req('DELETE', `/api/itineraries/${id}`),
  updateItineraryDay: (id, dayId, data) => req('PATCH', `/api/itineraries/${id}/days/${dayId}`, data),
  addItineraryDay:    (id, data)     => req('POST',   `/api/itineraries/${id}/days`, data),
  deleteItineraryDay: (id, dayId)    => req('DELETE', `/api/itineraries/${id}/days/${dayId}`),

  // Financial reports
  financialReport:    (year)         => req('GET', `/api/reports/financial${year ? `?year=${year}` : ''}`),
  financialReportCSV: (year) => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : '';
    const B = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');
    return fetch(`${B}/api/reports/financial/excel${year?`?year=${year}`:''}`, { headers: { Authorization: `Bearer ${t}` }}).then(r=>r.blob());
  },

  // Solar proposal
  leadPropuesta:     (id, quotationId) => req('GET', `/api/leads/${id}/propuesta${quotationId ? `?quotation_id=${encodeURIComponent(quotationId)}` : ''}`),
  saveSolarData:     (id, data) => req('PATCH', `/api/leads/${id}/solar`, data),
  generarContrato:   (id, data) => req('POST',  `/api/leads/${id}/contrato-solar`, data),

  // Reports
  downloadReport: (period = 30) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : '';
    const BASE = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');
    return fetch(`${BASE}/api/reports/pdf?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.blob());
  },
};
