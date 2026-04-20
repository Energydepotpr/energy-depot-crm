'use client';
import { useState, useEffect, useCallback } from 'react';

const C = {
  bg:       'var(--bg)',
  surface:  'var(--surface)',
  surface2: 'var(--surface2)',
  border:   'var(--border)',
  text:     'var(--text)',
  muted:    'var(--muted)',
  accent:   'var(--accent)',
  success:  'var(--success)',
  danger:   'var(--danger)',
};

const INTEGRATIONS = [
  // ── Activas ──────────────────────────────────────────────────────────────────
  {
    id: 'twilio',
    name: 'Twilio SMS',
    description: 'SMS entrantes y salientes, llamadas, voicemails y grabaciones integradas con el pipeline. Canal principal de mensajería.',
    category: 'Comunicación',
    icon: '📱',
    iconBg: '#F22F46',
  },
  {
    id: 'email',
    name: 'Email IMAP / SMTP',
    description: 'Sincronización de correos de operations@ y bookings@. Envío y recepción integrado con leads y contactos.',
    category: 'Comunicación',
    icon: '📧',
    iconBg: '#EA4335',
  },
  {
    id: 'groq',
    name: 'Groq — Llama 3.3 70B',
    description: 'IA del equipo: redacta emails, responde dudas, analiza clientes con contexto real del CRM. Transcribe llamadas con Whisper.',
    category: 'IA',
    icon: '🤖',
    iconBg: '#F55036',
  },
  {
    id: 'claude',
    name: 'Claude AI (Anthropic)',
    description: 'Genera resúmenes inteligentes de conversaciones y leads. Analiza el historial completo del cliente y extrae puntos clave.',
    category: 'IA',
    icon: '✦',
    iconBg: '#7C3AED',
  },
  {
    id: 'openweather',
    name: 'OpenWeatherMap',
    description: 'Muestra el clima actual de San Juan, PR en el dashboard. Temperatura, humedad y condiciones en tiempo real.',
    category: 'Productividad',
    icon: '🌤',
    iconBg: '#EB6E4B',
  },
  // ── Próximamente ─────────────────────────────────────────────────────────────
  {
    id: 'fareharbor',
    name: 'FareHarbor',
    description: 'Visualiza reservas, disponibilidad y clientes de FareHarbor dentro del CRM sin salir de la plataforma.',
    category: 'Productividad',
    icon: '⛵',
    iconBg: '#0066CC',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sincroniza reservas y eventos del CRM con tu Google Calendar. Crea y visualiza eventos directamente.',
    category: 'Productividad',
    icon: '📅',
    iconBg: '#4285F4',
    oauthFlow: true,
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Sube y accede a archivos de clientes, contratos y fotos directamente desde el CRM.',
    category: 'Productividad',
    icon: '📂',
    iconBg: '#34A853',
    oauthFlow: true,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sincroniza facturas, pagos y clientes entre tu CRM y QuickBooks automáticamente.',
    category: 'Pagos',
    icon: '📊',
    iconBg: '#2CA01C',
    oauthFlow: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Procesa pagos y visualiza el historial de transacciones de tus clientes en tiempo real.',
    category: 'Pagos',
    icon: '💳',
    iconBg: '#6772E5',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Acepta pagos internacionales y rastrea cobros asociados a leads y oportunidades.',
    category: 'Pagos',
    icon: '🅿️',
    iconBg: '#003087',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Integra tu bot de Telegram para gestionar conversaciones y notificaciones automáticas.',
    category: 'Mensajería',
    icon: '✈️',
    iconBg: '#2AABEE',
  },
  {
    id: 'instagram',
    name: 'Instagram DM',
    description: 'Centraliza los mensajes directos de Instagram en tu bandeja de entrada unificada.',
    category: 'Mensajería',
    icon: '📷',
    iconBg: '#E1306C',
  },
  {
    id: 'facebook',
    name: 'Facebook Messenger',
    description: 'Conecta tu página de Facebook y gestiona conversaciones de Messenger desde el CRM.',
    category: 'Mensajería',
    icon: '💙',
    iconBg: '#1877F2',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sincroniza contactos y segmentos con tus listas de Mailchimp para campañas de email.',
    category: 'Marketing',
    icon: '🐒',
    iconBg: '#FFE01B',
  },
  {
    id: 'tiktok',
    name: 'TikTok Ads',
    description: 'Importa leads de tus campañas de TikTok y haz seguimiento directo en el pipeline.',
    category: 'Marketing',
    icon: '🎵',
    iconBg: '#FF0050',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Conecta el CRM con más de 5,000 apps mediante flujos de automatización sin código.',
    category: 'Automatización',
    icon: '⚡',
    iconBg: '#FF4A00',
    readonlyUrl: true,
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Envía eventos en tiempo real a cualquier URL externa cuando ocurran acciones en el CRM.',
    category: 'Automatización',
    icon: '🔗',
    iconBg: '#6B46C1',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Recibe notificaciones de leads, tareas y alertas directamente en tus canales de Slack.',
    category: 'Automatización',
    icon: '💼',
    iconBg: '#4A154B',
  },
];

const CATEGORIES = ['Todos', 'IA', 'Comunicación', 'Mensajería', 'Pagos', 'Marketing', 'Automatización', 'Productividad'];

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts, onRemove }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: C.surface2, border: `1px solid ${t.type === 'error' ? C.danger + '60' : C.success + '60'}`,
          borderRadius: 12, padding: '13px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'slideUp 0.25s ease', minWidth: 300, maxWidth: 380,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{t.type === 'error' ? '❌' : '✅'}</span>
          <div style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 1.4 }}>{t.message}</div>
          <button onClick={() => onRemove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2, flexShrink: 0 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={{
      padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.border}`,
      background: copied ? C.success + '20' : C.surface,
      color: copied ? C.success : C.muted,
      fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
      transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {copied ? 'Copiado ✓' : 'Copiar'}
    </button>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────────────────
function Field({ label, children, note }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
      {note && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5, lineHeight: 1.5 }}>{note}</div>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', readOnly }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '9px 12px', background: readOnly ? C.bg : C.surface2,
        border: `1px solid ${C.border}`, borderRadius: 8,
        fontSize: 13, color: readOnly ? C.muted : C.text, outline: 'none',
        fontFamily: 'inherit',
      }}
    />
  );
}

function ReadonlyUrlRow({ url }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        readOnly
        value={url}
        style={{
          flex: 1, padding: '9px 12px', background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: 8,
          fontSize: 12, color: C.muted, outline: 'none', fontFamily: 'monospace',
        }}
      />
      <CopyButton value={url} />
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ integration, isConnected, onClose, children, footerLeft, footerRight }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 500, background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
          background: C.surface2, flexShrink: 0,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: integration.iconBg + '25', border: `1px solid ${integration.iconBg}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
          }}>
            {integration.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{integration.name}</div>
            <div style={{ fontSize: 12, color: isConnected ? C.success : C.muted, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              {isConnected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, display: 'inline-block' }} />}
              {isConnected ? 'Conectado' : 'Sin conectar'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 22px 0', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          {footerLeft}
          <div style={{ flex: 1 }} />
          {footerRight}
        </div>
      </div>
    </div>
  );
}

// ─── Instructions box ─────────────────────────────────────────────────────────
function Instructions({ steps }) {
  return (
    <div style={{ background: C.surface2, borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Instrucciones</div>
      {steps.map((step, i) => (
        <div key={i} style={{ fontSize: 12.5, color: C.muted, marginBottom: 4, lineHeight: 1.5 }}>
          <span style={{ color: C.accent, fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>{step}
        </div>
      ))}
    </div>
  );
}

// ─── Per-integration modal content ───────────────────────────────────────────
function ModalContent({ integration, isConnected, statusData, onSave, onDisconnect, onClose, addToast }) {
  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://your-crm.com';
  const webhookBase = `${domain}/backend/api`;

  // Local form states (only initialised for the specific integration)
  const [botToken, setBotToken] = useState(statusData?.config?.bot_token || '');
  const [metaAppId, setMetaAppId] = useState(statusData?.config?.meta_app_id || '');
  const [metaAppSecret, setMetaAppSecret] = useState(statusData?.config?.meta_app_secret || '');
  const [pageAccessToken, setPageAccessToken] = useState(statusData?.config?.page_access_token || '');
  const [pageId, setPageId] = useState(statusData?.config?.page_id || '');
  const [stripePk, setStripePk] = useState(statusData?.config?.publishable_key || '');
  const [stripeSk, setStripeSk] = useState(statusData?.config?.secret_key || '');
  const [ppClientId, setPpClientId] = useState(statusData?.config?.client_id || '');
  const [ppClientSecret, setPpClientSecret] = useState(statusData?.config?.client_secret || '');
  const [ppEnv, setPpEnv] = useState(statusData?.config?.environment || 'sandbox');
  const [mcApiKey, setMcApiKey] = useState(statusData?.config?.api_key || '');
  const [mcListId, setMcListId] = useState(statusData?.config?.list_id || '');
  const [sgApiKey, setSgApiKey] = useState(statusData?.config?.api_key || '');
  const [sgFromEmail, setSgFromEmail] = useState(statusData?.config?.from_email || '');
  const [sgFromName, setSgFromName] = useState(statusData?.config?.from_name || '');
  const [ttToken, setTtToken] = useState(statusData?.config?.access_token || '');
  const [whEndpoint, setWhEndpoint] = useState(statusData?.config?.endpoint_url || '');
  const [whSecret, setWhSecret] = useState(statusData?.config?.secret_token || '');
  const [whEvents, setWhEvents] = useState(statusData?.config?.events || ['lead_created', 'lead_won', 'lead_lost', 'message_received']);
  const [slackUrl, setSlackUrl] = useState(statusData?.config?.webhook_url || '');
  const [fhApiKey, setFhApiKey] = useState(statusData?.config?.api_key || '');
  const [fhShortname, setFhShortname] = useState(statusData?.config?.shortname || '');
  // Twilio
  const [twilioSid, setTwilioSid] = useState(statusData?.config?.account_sid || '');
  const [twilioToken, setTwilioToken] = useState(statusData?.config?.auth_token || '');
  const [twilioFrom, setTwilioFrom] = useState(statusData?.config?.from_number || '');
  // Email
  const [imapHost, setImapHost] = useState(statusData?.config?.imap_host || '');
  const [imapUser, setImapUser] = useState(statusData?.config?.imap_user || '');
  const [imapPass, setImapPass] = useState(statusData?.config?.imap_pass || '');
  const [smtpHost, setSmtpHost] = useState(statusData?.config?.smtp_host || '');
  const [smtpPort, setSmtpPort] = useState(statusData?.config?.smtp_port || '587');
  const [smtpUser, setSmtpUser] = useState(statusData?.config?.smtp_user || '');
  const [smtpPass, setSmtpPass] = useState(statusData?.config?.smtp_pass || '');
  // IA keys
  const [groqKey, setGroqKey] = useState(statusData?.config?.api_key || '');
  const [claudeKey, setClaudeKey] = useState(statusData?.config?.api_key || '');
  const [owKey, setOwKey] = useState(statusData?.config?.api_key || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const save = async (config) => {
    setSaving(true);
    try {
      const res = await fetch('/backend/api/integrations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: integration.id, config }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      onSave(integration.id, config);
      addToast(`${integration.name} conectado correctamente`, 'success');
      onClose();
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/backend/api/integrations/${integration.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error al desconectar');
      onDisconnect(integration.id);
      addToast(`${integration.name} desconectado`, 'success');
      onClose();
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const testSlack = async () => {
    setTesting(true);
    try {
      const res = await fetch('/backend/api/integrations/test/slack', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Test fallido');
      addToast('Mensaje de prueba enviado a Slack', 'success');
    } catch (e) {
      addToast(`Error al probar Slack: ${e.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const syncMailchimp = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/backend/api/integrations/mailchimp/sync', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error al sincronizar');
      addToast('Contactos sincronizados con Mailchimp', 'success');
    } catch (e) {
      addToast(`Error al sincronizar: ${e.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const Btn = ({ onClick, disabled, children, variant = 'primary' }) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      background: variant === 'primary' ? C.accent : variant === 'danger' ? C.danger + '20' : 'transparent',
      border: variant === 'danger' ? `1px solid ${C.danger}50` : variant === 'ghost' ? `1px solid ${C.border}` : 'none',
      color: variant === 'primary' ? '#fff' : variant === 'danger' ? C.danger : C.muted,
      opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
    }}>{children}</button>
  );

  const toggleEvent = (ev) => {
    setWhEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  // ── Twilio SMS ──
  if (integration.id === 'twilio') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ account_sid: twilioSid, auth_token: twilioToken, from_number: twilioFrom })} disabled={saving || !twilioSid || !twilioToken || !twilioFrom}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Btn>
          </div>
        }
      >
        <Instructions steps={[
          'Ve a console.twilio.com y copia tu Account SID y Auth Token',
          'En Phone Numbers → Manage → Active Numbers, copia tu número SMS',
          'Configura el webhook entrante: Messaging → el número → A message comes in → ' + `${webhookBase}/webhook/twilio`,
          'Guarda los datos abajo',
        ]} />
        <Field label="Account SID"><Input value={twilioSid} onChange={e => setTwilioSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" /></Field>
        <Field label="Auth Token"><Input value={twilioToken} onChange={e => setTwilioToken(e.target.value)} type="password" placeholder="tu_auth_token" /></Field>
        <Field label="Número de teléfono (SMS)" note="Formato E.164, ej: +17871234567">
          <Input value={twilioFrom} onChange={e => setTwilioFrom(e.target.value)} placeholder="+17871234567" />
        </Field>
        <Field label="Webhook entrante (configura esto en Twilio)">
          <ReadonlyUrlRow url={`${webhookBase}/webhook/twilio`} />
        </Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Email IMAP/SMTP ──
  if (integration.id === 'email') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ imap_host: imapHost, imap_user: imapUser, imap_pass: imapPass, smtp_host: smtpHost, smtp_port: smtpPort, smtp_user: smtpUser, smtp_pass: smtpPass })} disabled={saving || !imapHost || !imapUser || !smtpHost}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Btn>
          </div>
        }
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>IMAP (recibir correos)</div>
        <Field label="Servidor IMAP"><Input value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder="imap.gmail.com" /></Field>
        <Field label="Usuario / Email"><Input value={imapUser} onChange={e => setImapUser(e.target.value)} placeholder="operations@energydepotpr.com" /></Field>
        <Field label="Contraseña"><Input value={imapPass} onChange={e => setImapPass(e.target.value)} type="password" placeholder="Contraseña o app password" /></Field>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0' }}>SMTP (enviar correos)</div>
        <Field label="Servidor SMTP"><Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" /></Field>
        <Field label="Puerto" note="465 (SSL) o 587 (TLS)"><Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" /></Field>
        <Field label="Usuario SMTP"><Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="operations@energydepotpr.com" /></Field>
        <Field label="Contraseña SMTP"><Input value={smtpPass} onChange={e => setSmtpPass(e.target.value)} type="password" placeholder="Contraseña o app password" /></Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Groq ──
  if (integration.id === 'groq') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ api_key: groqKey })} disabled={saving || !groqKey}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        }
      >
        <Instructions steps={['Ve a console.groq.com', 'En API Keys, crea una nueva clave', 'Copia y pega la clave abajo']} />
        <Field label="Groq API Key"><Input value={groqKey} onChange={e => setGroqKey(e.target.value)} type="password" placeholder="gsk_..." /></Field>
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            Modelo activo: <code style={{ background: C.bg, borderRadius: 4, padding: '1px 5px', color: C.accent }}>llama-3.3-70b-versatile</code>.<br />
            Usado para el bot Gigi, asistente del equipo y transcripción de llamadas.
          </div>
        </div>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Claude AI ──
  if (integration.id === 'claude') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ api_key: claudeKey })} disabled={saving || !claudeKey}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        }
      >
        <Instructions steps={['Ve a console.anthropic.com', 'En API Keys, crea una nueva clave', 'Copia y pega la clave abajo']} />
        <Field label="Anthropic API Key"><Input value={claudeKey} onChange={e => setClaudeKey(e.target.value)} type="password" placeholder="sk-ant-..." /></Field>
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            Modelo activo: <code style={{ background: C.bg, borderRadius: 4, padding: '1px 5px', color: C.accent }}>claude-sonnet-4-6</code>.<br />
            Usado para resúmenes de leads y análisis inteligente de conversaciones.
          </div>
        </div>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── OpenWeatherMap ──
  if (integration.id === 'openweather') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ api_key: owKey })} disabled={saving || !owKey}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        }
      >
        <Instructions steps={['Ve a openweathermap.org → Sign in → API keys', 'Copia tu API key gratuita', 'Pégala abajo']} />
        <Field label="OpenWeatherMap API Key"><Input value={owKey} onChange={e => setOwKey(e.target.value)} type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" /></Field>
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            Ciudad configurada: <code style={{ background: C.bg, borderRadius: 4, padding: '1px 5px', color: C.accent }}>San Juan, PR</code>.<br />
            El clima aparece en el dashboard principal del CRM.
          </div>
        </div>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Telegram ──
  if (integration.id === 'telegram') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ bot_token: botToken })} disabled={saving || !botToken}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <Instructions steps={['Crea un bot en @BotFather con /newbot', 'Copia el token que BotFather te entrega', 'Pega el token aquí y haz clic en Conectar']} />
        <Field label="Bot Token">
          <Input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456789:ABCdef..." />
        </Field>
        <Field label="Webhook URL (tu CRM)">
          <ReadonlyUrlRow url={`${webhookBase}/webhook/telegram`} />
        </Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Instagram ──
  if (integration.id === 'instagram') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ meta_app_id: metaAppId, meta_app_secret: metaAppSecret, page_access_token: pageAccessToken })} disabled={saving || !metaAppId || !metaAppSecret || !pageAccessToken}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Requiere verificación de app en Meta for Developers antes de acceder a mensajes de producción.</span>
        </div>
        <Field label="Meta App ID"><Input value={metaAppId} onChange={e => setMetaAppId(e.target.value)} placeholder="1234567890" /></Field>
        <Field label="Meta App Secret"><Input value={metaAppSecret} onChange={e => setMetaAppSecret(e.target.value)} type="password" placeholder="abcdef1234..." /></Field>
        <Field label="Page Access Token"><Input value={pageAccessToken} onChange={e => setPageAccessToken(e.target.value)} type="password" placeholder="EAABsbCS..." /></Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Facebook ──
  if (integration.id === 'facebook') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ meta_app_id: metaAppId, page_id: pageId, page_access_token: pageAccessToken })} disabled={saving || !metaAppId || !pageId || !pageAccessToken}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Requiere verificación de app en Meta for Developers antes de acceder a mensajes de producción.</span>
        </div>
        <Field label="Meta App ID"><Input value={metaAppId} onChange={e => setMetaAppId(e.target.value)} placeholder="1234567890" /></Field>
        <Field label="Page ID"><Input value={pageId} onChange={e => setPageId(e.target.value)} placeholder="987654321" /></Field>
        <Field label="Page Access Token"><Input value={pageAccessToken} onChange={e => setPageAccessToken(e.target.value)} type="password" placeholder="EAABsbCS..." /></Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── QuickBooks ──
  if (integration.id === 'quickbooks') {
    const qbConnected = isConnected;
    return (
      <Modal integration={integration} isConnected={qbConnected} onClose={onClose}
        footerLeft={qbConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          qbConnected
            ? <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
            : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
                <Btn onClick={() => { window.location.href = '/backend/api/quickbooks/auth'; }}>Autorizar con QuickBooks</Btn>
              </div>
            )
        }
      >
        {qbConnected ? (
          <div>
            <div style={{ background: C.success + '15', border: `1px solid ${C.success}40`, borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ fontSize: 13, color: C.success, fontWeight: 600 }}>Sincronizado</div>
                {statusData?.connected_at && <div style={{ fontSize: 11.5, color: C.muted }}>Conectado el {new Date(statusData.connected_at).toLocaleDateString('es')}</div>}
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Las facturas, pagos y clientes se sincronizan automáticamente con QuickBooks. Para reautorizar, desconecta y vuelve a conectar.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 18 }}>
              Serás redirigido a QuickBooks para autorizar el acceso. Asegúrate de tener sesión activa en QuickBooks Online.
            </div>
            <div style={{ background: C.surface2, borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
              El proceso es 100% OAuth 2.0. No almacenamos tu contraseña de QuickBooks.
            </div>
          </div>
        )}
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Stripe ──
  if (integration.id === 'stripe') {
    const stripeValid = stripePk.startsWith('pk_') && stripeSk.startsWith('sk_');
    const stripeErrors = [];
    if (stripePk && !stripePk.startsWith('pk_')) stripeErrors.push('La clave publicable debe comenzar con pk_');
    if (stripeSk && !stripeSk.startsWith('sk_')) stripeErrors.push('La clave secreta debe comenzar con sk_');
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ publishable_key: stripePk, secret_key: stripeSk })} disabled={saving || !stripeValid}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Las facturas del CRM usarán este key para generar links de pago. Usa las claves de producción para cobros reales.</span>
        </div>
        <Field label="Clave Publicable (pk_...)"><Input value={stripePk} onChange={e => setStripePk(e.target.value)} placeholder="pk_live_..." /></Field>
        <Field label="Clave Secreta (sk_...)"><Input value={stripeSk} onChange={e => setStripeSk(e.target.value)} type="password" placeholder="sk_live_..." /></Field>
        {stripeErrors.map((err, i) => <div key={i} style={{ fontSize: 12, color: C.danger, marginBottom: 8, marginTop: -10 }}>⚠ {err}</div>)}
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── PayPal ──
  if (integration.id === 'paypal') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ client_id: ppClientId, client_secret: ppClientSecret, environment: ppEnv })} disabled={saving || !ppClientId || !ppClientSecret}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <Field label="Client ID"><Input value={ppClientId} onChange={e => setPpClientId(e.target.value)} placeholder="AXxx..." /></Field>
        <Field label="Client Secret"><Input value={ppClientSecret} onChange={e => setPpClientSecret(e.target.value)} type="password" placeholder="Exxx..." /></Field>
        <Field label="Entorno">
          <div style={{ display: 'flex', gap: 8 }}>
            {['sandbox', 'production'].map(env => (
              <button key={env} onClick={() => setPpEnv(env)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: ppEnv === env ? C.accent + '20' : C.surface2,
                border: `1px solid ${ppEnv === env ? C.accent : C.border}`,
                color: ppEnv === env ? C.accent : C.muted,
              }}>
                {env === 'sandbox' ? 'Sandbox' : 'Producción'}
              </button>
            ))}
          </div>
        </Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Mailchimp ──
  if (integration.id === 'mailchimp') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            {isConnected && <Btn variant="ghost" onClick={syncMailchimp} disabled={syncing}>{syncing ? 'Sincronizando...' : 'Sincronizar contactos'}</Btn>}
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ api_key: mcApiKey, list_id: mcListId })} disabled={saving || !mcApiKey || !mcListId}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <Field label="API Key"><Input value={mcApiKey} onChange={e => setMcApiKey(e.target.value)} type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1" /></Field>
        <Field label="Audience / List ID"><Input value={mcListId} onChange={e => setMcListId(e.target.value)} placeholder="a1b2c3d4e5" /></Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── SendGrid ──
  if (integration.id === 'sendgrid') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ api_key: sgApiKey, from_email: sgFromEmail, from_name: sgFromName })} disabled={saving || !sgApiKey || !sgFromEmail}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>El módulo de Correos usará esta configuración para enviar emails desde el CRM.</span>
        </div>
        <Field label="API Key"><Input value={sgApiKey} onChange={e => setSgApiKey(e.target.value)} type="password" placeholder="SG.xxxxxx..." /></Field>
        <Field label="Email remitente"><Input value={sgFromEmail} onChange={e => setSgFromEmail(e.target.value)} type="email" placeholder="noreply@tuempresa.com" /></Field>
        <Field label="Nombre remitente"><Input value={sgFromName} onChange={e => setSgFromName(e.target.value)} placeholder="Tu Empresa" /></Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── TikTok Ads ──
  if (integration.id === 'tiktok') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ access_token: ttToken })} disabled={saving || !ttToken}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <Instructions steps={['Ve a TikTok for Business → Tools → Lead Generation', 'Crea un webhook con la URL de abajo', 'Copia el Access Token y pégalo aquí']} />
        <Field label="Webhook URL del CRM (pega esto en TikTok)">
          <ReadonlyUrlRow url={`${webhookBase}/webhook/tiktok`} />
        </Field>
        <Field label="Access Token"><Input value={ttToken} onChange={e => setTtToken(e.target.value)} type="password" placeholder="tu_access_token_aquí" /></Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Zapier ──
  if (integration.id === 'zapier') {
    return (
      <Modal integration={integration} isConnected={true} onClose={onClose}
        footerLeft={null}
        footerRight={<Btn variant="ghost" onClick={onClose}>Cerrar</Btn>}
      >
        <Instructions steps={['Ve a zapier.com y crea un nuevo Zap', 'Elige "Webhooks by Zapier" como Trigger → Catch Hook', 'Pega la URL de abajo como webhook URL en tu Zap', 'Los leads enviados a esta URL entrarán automáticamente al CRM']} />
        <Field label="URL del webhook (pega esto en Zapier)">
          <ReadonlyUrlRow url={`${webhookBase}/webhook/webform`} />
        </Field>
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginTop: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            No se requieren credenciales. Cualquier POST a esta URL con los campos <code style={{ background: C.bg, borderRadius: 4, padding: '1px 5px', color: C.accent }}>name</code>, <code style={{ background: C.bg, borderRadius: 4, padding: '1px 5px', color: C.accent }}>email</code>, <code style={{ background: C.bg, borderRadius: 4, padding: '1px 5px', color: C.accent }}>phone</code> creará un lead.
          </div>
        </div>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Webhooks ──
  if (integration.id === 'webhooks') {
    const allEvents = ['lead_created', 'lead_won', 'lead_lost', 'message_received'];
    const [testingWh, setTestingWh] = useState(false);
    const testWebhook = async () => {
      if (!whEndpoint) return;
      setTestingWh(true);
      try {
        const res = await fetch('/backend/api/integrations/test/webhook', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ endpoint_url: whEndpoint, secret_token: whSecret }),
        });
        if (!res.ok) throw new Error('Test fallido');
        addToast('Evento de prueba enviado al webhook', 'success');
      } catch (e) {
        addToast(`Error: ${e.message}`, 'error');
      } finally {
        setTestingWh(false);
      }
    };
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            {whEndpoint && <Btn variant="ghost" onClick={testWebhook} disabled={testingWh}>{testingWh ? 'Enviando...' : 'Probar'}</Btn>}
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ endpoint_url: whEndpoint, secret_token: whSecret, events: whEvents })} disabled={saving || !whEndpoint || whEvents.length === 0}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        }
      >
        <Field label="Endpoint URL" note="El CRM enviará un POST a esta URL cuando ocurran los eventos seleccionados.">
          <Input value={whEndpoint} onChange={e => setWhEndpoint(e.target.value)} placeholder="https://mi-servidor.com/webhook" />
        </Field>
        <Field label="Secret Token (opcional)" note="Se enviará como cabecera X-CRM-Secret en cada solicitud.">
          <Input value={whSecret} onChange={e => setWhSecret(e.target.value)} placeholder="mi_secreto_seguro" />
        </Field>
        <Field label="Eventos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allEvents.map(ev => (
              <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={whEvents.includes(ev)} onChange={() => toggleEvent(ev)}
                  style={{ width: 15, height: 15, accentColor: C.accent }} />
                <span style={{ fontSize: 13, color: C.text, fontFamily: 'monospace' }}>{ev}</span>
              </label>
            ))}
          </div>
        </Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Slack ──
  if (integration.id === 'slack') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            {isConnected && <Btn variant="ghost" onClick={testSlack} disabled={testing}>{testing ? 'Enviando...' : 'Probar'}</Btn>}
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ webhook_url: slackUrl })} disabled={saving || !slackUrl}>{saving ? 'Guardando...' : 'Conectar'}</Btn>
          </div>
        }
      >
        <Instructions steps={['Ve a api.slack.com/apps y crea una nueva app', 'En "Features", activa Incoming Webhooks', 'Haz clic en "Add New Webhook to Workspace" y elige el canal', 'Copia la URL generada y pégala abajo']} />
        <Field label="Incoming Webhook URL">
          <Input value={slackUrl} onChange={e => setSlackUrl(e.target.value)} placeholder="https://hooks.slack.com/services/T.../B.../..." />
        </Field>
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Eventos notificados</div>
          {['lead_created', 'lead_won', 'lead_lost', 'message_received'].map(ev => (
            <div key={ev} style={{ fontSize: 12.5, color: C.muted, marginBottom: 3, fontFamily: 'monospace' }}>
              <span style={{ color: C.success, marginRight: 6 }}>✓</span>{ev}
            </div>
          ))}
        </div>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Google Calendar ──
  if (integration.id === 'google_calendar') {
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'https://crm-ia-production-c247.up.railway.app';
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={async () => { await fetch(`${backendBase}/api/calendar/google/disconnect`, { method: 'POST', headers: getAuthHeaders() }); onClose(); disconnect(); }} disabled={saving}>Desconectar</Btn>}
        footerRight={<Btn variant="ghost" onClick={onClose}>Cerrar</Btn>}
      >
        <Instructions steps={['Ve a console.cloud.google.com y crea un proyecto', 'Activa la API de Google Calendar', 'Crea credenciales OAuth 2.0 (tipo: Aplicación web)', `URI de redirección: ${backendBase}/api/auth/google/callback`, 'Copia el Client ID y Client Secret', 'Agrégalos en Railway como GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET', 'Haz clic en "Conectar con Google" abajo']} />
        {isConnected ? (
          <div style={{ background: '#10b98120', border: '1px solid #10b98140', borderRadius: 10, padding: '12px 16px', textAlign: 'center', marginTop: 8 }}>
            <div style={{ color: '#10b981', fontWeight: 600, fontSize: 14 }}>✅ Google Calendar conectado</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Tus eventos de Google Calendar se muestran en la sección Calendario del CRM.</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <a href={`${backendBase}/api/auth/google`} style={{ display: 'inline-block', background: '#4285F4', color: '#fff', padding: '11px 24px', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Conectar con Google
            </a>
          </div>
        )}
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── Google Drive ──
  if (integration.id === 'google_drive') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={null}
        footerRight={<Btn variant="ghost" onClick={onClose}>Cerrar</Btn>}
      >
        <Instructions steps={['Ve a console.cloud.google.com', 'En el mismo proyecto de Google Calendar, activa también la API de Google Drive', 'Usa el mismo Client ID / Client Secret', 'Próximamente disponible en el CRM']} />
        <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginTop: 4 }}>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Esta integración está en desarrollo. Usa el mismo proyecto OAuth que Google Calendar.</div>
        </div>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  // ── FareHarbor ──
  if (integration.id === 'fareharbor') {
    return (
      <Modal integration={integration} isConnected={isConnected} onClose={onClose}
        footerLeft={isConnected && <Btn variant="danger" onClick={disconnect} disabled={saving}>Desconectar</Btn>}
        footerRight={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => save({ ics_url: fhApiKey || '' })} disabled={saving}>{saving ? 'Guardando...' : isConnected ? 'Actualizar' : 'Conectar'}</Btn>
          </div>
        }
      >
        <div style={{ background: '#0066CC15', border: '1px solid #0066CC30', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
          <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Tu calendar ICS de FareHarbor ya está configurado. Las reservas aparecen automáticamente en el Calendario del CRM con el ícono ⛵.</span>
        </div>
        <Instructions steps={['En FareHarbor → Dashboard → Calendar → "Export/Subscribe"', 'Copia la URL del calendario ICS', 'Pégala abajo para actualizarla']} />
        <Field label="URL del Calendario ICS">
          <Input value={fhApiKey || ''} onChange={e => setFhApiKey(e.target.value)} placeholder="https://fareharbor.com/integrations/ics/..." />
        </Field>
        <div style={{ height: 8 }} />
      </Modal>
    );
  }

  return null;
}

// ─── Integration Card ─────────────────────────────────────────────────────────
function IntegrationCard({ integration, isConnected, enabled, onAction, onToggle, loading }) {
  const [hovered, setHovered] = useState(false);
  const [toggling, setToggling] = useState(false);

  const paused = isConnected && !enabled;
  const accentColor = paused ? '#F59E0B' : C.success;

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    try { await onToggle(integration.id, !enabled); } finally { setToggling(false); }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.surface2 : C.surface,
        border: `1px solid ${isConnected ? accentColor + '50' : C.border}`,
        borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column',
        gap: 12, cursor: 'default', transition: 'all 0.15s',
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.25)' : 'none',
        position: 'relative', overflow: 'hidden',
        opacity: paused ? 0.8 : 1,
      }}
    >
      {isConnected && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor, borderRadius: '14px 14px 0 0' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: integration.iconBg + '22', border: `1px solid ${integration.iconBg}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>
          {loading ? <span style={{ fontSize: 16, opacity: 0.4 }}>⟳</span> : integration.icon}
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: isConnected ? accentColor + '20' : C.surface2,
          color: isConnected ? accentColor : C.muted,
          border: `1px solid ${isConnected ? accentColor + '40' : C.border}`,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {isConnected && <span style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor, display: 'inline-block' }} />}
          {isConnected ? (paused ? 'Pausado' : 'Conectado') : 'Disponible'}
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>{integration.name}</div>
        <div style={{
          fontSize: 12.5, color: C.muted, lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {integration.description}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, color: C.muted, background: C.bg, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.border}` }}>
          {integration.category}
        </span>
        {isConnected && !integration.alwaysConnected && (
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={enabled ? 'Pausar integración' : 'Activar integración'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: toggling ? 'wait' : 'pointer',
              background: 'none', border: 'none', padding: 0,
            }}
          >
            <span style={{ fontSize: 10.5, color: enabled ? C.success : '#F59E0B', fontWeight: 600 }}>
              {enabled ? 'ON' : 'OFF'}
            </span>
            <div style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative',
              background: enabled ? C.success : '#F59E0B',
              transition: 'background 0.2s', opacity: toggling ? 0.6 : 1,
            }}>
              <div style={{
                position: 'absolute', top: 3, left: enabled ? 18 : 3,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </button>
        )}
      </div>

      <button
        onClick={() => onAction(integration)}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.15s',
          background: isConnected ? 'transparent' : C.accent,
          border: isConnected ? `1px solid ${C.border}` : 'none',
          color: isConnected ? C.text : '#fff',
        }}
      >
        {isConnected ? 'Configurar' : 'Conectar'}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // { integration }
  const [statuses, setStatuses] = useState({}); // { [id]: { is_active, config, connected_at } }
  const [loadingInit, setLoadingInit] = useState(true);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Load integration statuses on mount
  useEffect(() => {
    const load = async () => {
      setLoadingInit(true);
      try {
        const headers = getAuthHeaders();
        const [intRes, qbRes] = await Promise.allSettled([
          fetch('/backend/api/integrations', { headers }),
          fetch('/backend/api/quickbooks/status', { headers }),
        ]);

        const map = {};

        if (intRes.status === 'fulfilled' && intRes.value.ok) {
          const rows = await intRes.value.json();
          if (Array.isArray(rows)) {
            rows.forEach(r => { map[r.id] = r; });
          }
        }

        if (qbRes.status === 'fulfilled' && qbRes.value.ok) {
          const qb = await qbRes.value.json();
          if (qb.connected) {
            map['quickbooks'] = { ...map['quickbooks'], is_active: true };
          }
        }

        setStatuses(map);

        // Check for Google Calendar redirect
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('google_connected') === '1') {
            addToast('Google Calendar conectado correctamente', 'success');
            window.history.replaceState({}, '', '/integrations');
          }
          if (params.get('google_error')) {
            addToast('Error conectando Google: ' + decodeURIComponent(params.get('google_error')), 'error');
            window.history.replaceState({}, '', '/integrations');
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoadingInit(false);
      }
    };
    load();
  }, []);

  const isConnected = (id) => {
    const intg = INTEGRATIONS.find(i => i.id === id);
    if (intg?.alwaysConnected) return true;
    return !!(statuses[id]?.is_active);
  };

  const isEnabled = (id) => {
    const s = statuses[id];
    if (!s?.is_active) return false;
    return s.enabled !== false; // default true if not set
  };

  const handleToggle = async (id, newEnabled) => {
    try {
      const res = await fetch(`/backend/api/integrations/${id}/toggle`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      setStatuses(prev => ({
        ...prev,
        [id]: { ...(prev[id] || {}), enabled: newEnabled },
      }));
    } catch (e) {
      addToast('Error al cambiar estado de la integración', 'error');
    }
  };

  const handleSave = (id, config) => {
    setStatuses(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), is_active: true, config, connected_at: new Date().toISOString() },
    }));
  };

  const handleDisconnect = (id) => {
    setStatuses(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleAction = (integration) => {
    setModal({ integration });
  };

  const filtered = INTEGRATIONS.filter(i => {
    const matchCat = selectedCategory === 'Todos' || i.category === selectedCategory;
    const matchSearch = !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const connectedCount = INTEGRATIONS.filter(i => isConnected(i.id)).length;

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, padding: '28px 32px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: C.text,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>Integraciones</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: C.muted }}>Conecta tus herramientas favoritas con el CRM</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.success }}>{loadingInit ? '–' : connectedCount}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Conectadas</div>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{INTEGRATIONS.length}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Disponibles</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', minWidth: 220 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar integración..."
            style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9,
              paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
              fontSize: 13, color: C.text, outline: 'none', width: 220, boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4 }}>
          {CATEGORIES.map(cat => {
            const active = selectedCategory === cat;
            return (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none',
                background: active ? C.accent : 'transparent',
                color: active ? '#fff' : C.muted,
                fontSize: 12.5, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {cat}
                {cat !== 'Todos' && (
                  <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>({INTEGRATIONS.filter(i => i.category === cat).length})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading skeleton */}
      {loadingInit ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, height: 200, opacity: 0.5 + (i % 3) * 0.1 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: C.surface2, marginBottom: 12 }} />
              <div style={{ width: '60%', height: 14, background: C.surface2, borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: '90%', height: 11, background: C.surface2, borderRadius: 4, marginBottom: 6 }} />
              <div style={{ width: '75%', height: 11, background: C.surface2, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 32px', color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>Sin resultados</div>
          <div style={{ fontSize: 13 }}>No encontramos integraciones que coincidan con tu búsqueda.</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16, fontSize: 12.5, color: C.muted }}>
            {filtered.length} integración{filtered.length !== 1 ? 'es' : ''}
            {selectedCategory !== 'Todos' ? ` en ${selectedCategory}` : ''}
            {search ? ` para "${search}"` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {filtered.map(integration => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                isConnected={isConnected(integration.id)}
                enabled={isEnabled(integration.id)}
                onAction={handleAction}
                onToggle={handleToggle}
                loading={false}
              />
            ))}
          </div>
        </>
      )}

      {/* Footer banner */}
      <div style={{
        marginTop: 40, background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: C.accent + '20', border: `1px solid ${C.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          🚀
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>¿No encuentras tu integración?</div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Estamos agregando nuevas integraciones cada semana. También puedes conectar cualquier herramienta usando nuestra API o webhooks.</div>
        </div>
        <button
          onClick={() => {
            const wh = INTEGRATIONS.find(i => i.id === 'webhooks');
            if (wh) setModal({ integration: wh });
          }}
          style={{ padding: '9px 20px', background: C.accent, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          Usar Webhooks
        </button>
      </div>

      {/* Modal */}
      {modal && (
        <ModalContent
          integration={modal.integration}
          isConnected={isConnected(modal.integration.id)}
          statusData={statuses[modal.integration.id]}
          onSave={handleSave}
          onDisconnect={handleDisconnect}
          onClose={() => setModal(null)}
          addToast={addToast}
        />
      )}

      {/* Toasts */}
      {toasts.length > 0 && <Toast toasts={toasts} onRemove={removeToast} />}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: ${C.muted}; }
        input:focus { border-color: ${C.accent} !important; }
      `}</style>
    </div>
  );
}
