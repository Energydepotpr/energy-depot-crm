'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../../lib/api';
import PermissionsPanel from './PermissionsPanel';
import { loadBaterias, saveBaterias, DEFAULT_BATERIAS, loadPricing, savePricing, DEFAULT_PRICING } from '../../../lib/baterias';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';
import { EMAIL_TEMPLATES } from '../../../lib/email-templates';

const DIAS = [
  { num: 1, label: 'Lun' }, { num: 2, label: 'Mar' }, { num: 3, label: 'Mié' },
  { num: 4, label: 'Jue' }, { num: 5, label: 'Vie' }, { num: 6, label: 'Sáb' },
  { num: 7, label: 'Dom' },
];

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.65)' }} onClick={onCancel}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, maxWidth: 340, width: '100%' }} onClick={e => e.stopPropagation()}>
        <p style={{ color: 'var(--text)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onConfirm} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            Confirmar
          </button>
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const REPLY_VARIABLES = [
  '{{nombre}}', '{{telefono}}', '{{fecha}}', '{{fecha_checkin}}', '{{monto}}', '{{agente}}',
];

function SeccionCard({ title, desc, children }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-medium text-white mb-0.5">{title}</div>
      {desc && <div className="text-xs text-muted mb-4">{desc}</div>}
      {children}
    </div>
  );
}

function QuickRepliesSection() {
  const [replies, setReplies] = useState([]);
  const [form, setForm] = useState({ title: '', text: '', category: '' });
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const textareaRef = useRef(null);

  const cargar = () => api.quickReplies().then(setReplies).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!form.title.trim() || !form.text.trim()) return;
    setGuardando(true);
    try {
      if (editando) {
        await api.updateQuickReply(editando, form);
        setEditando(null);
      } else {
        await api.createQuickReply(form);
      }
      setForm({ title: '', text: '', category: '' });
      cargar();
    } catch (e) { alert(e.message); }
    setGuardando(false);
  };

  const eliminar = (id) => {
    setConfirmDialog({
      message: '¿Eliminar esta plantilla?',
      onConfirm: async () => {
        setConfirmDialog(null);
        await api.deleteQuickReply(id).catch(e => alert(e.message));
        cargar();
      },
    });
  };

  const insertVariable = (v) => {
    const el = textareaRef.current;
    if (!el) { setForm(f => ({ ...f, text: f.text + v })); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newText = form.text.slice(0, start) + v + form.text.slice(end);
    setForm(f => ({ ...f, text: newText }));
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
  };

  // Group by category for display
  const categories = [...new Set(replies.map(r => r.category || 'General'))];

  return (
    <SeccionCard title="Plantillas de respuesta rápida" desc="Respuestas predefinidas para usar en el inbox. Variables: {{nombre}}, {{telefono}}, {{fecha}}, {{fecha_checkin}}, {{monto}}, {{agente}}">
      {confirmDialog && <ConfirmModal message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      <div className="space-y-4 mb-4">
        {categories.map(cat => (
          <div key={cat}>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 px-1">{cat}</div>
            {replies.filter(r => (r.category || 'General') === cat).map(r => (
              <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 bg-bg rounded-lg border border-border mb-1">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">{r.title}</div>
                  <div className="text-xs text-muted mt-0.5 truncate">{r.text}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setEditando(r.id); setForm({ title: r.title, text: r.text, category: r.category || '' }); }}
                    className="text-xs text-muted hover:text-white transition-colors">Editar</button>
                  <button onClick={() => eliminar(r.id)}
                    className="text-xs text-muted hover:text-danger transition-colors">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        ))}
        {replies.length === 0 && <p className="text-xs text-muted text-center py-3">Sin plantillas aún</p>}
      </div>
      <div className="border-t border-border pt-4 space-y-2">
        <div className="text-xs text-muted mb-2">{editando ? 'Editando plantilla' : 'Nueva plantilla'}</div>
        <div className="flex gap-2">
          <input className="input text-sm flex-1" placeholder="Título (ej: Bienvenida)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <input className="input text-sm" style={{ width: 130 }} placeholder="Categoría (ej: Ventas)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </div>
        <div className="flex flex-wrap gap-1 mb-1">
          {REPLY_VARIABLES.map(v => (
            <button key={v} type="button" onClick={() => insertVariable(v)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted hover:text-accent hover:border-accent transition-colors bg-bg font-mono">
              {v}
            </button>
          ))}
        </div>
        <textarea ref={textareaRef} className="input resize-none text-sm" rows={3} placeholder="Texto... puedes usar las variables de arriba" value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} />
        <div className="flex gap-2">
          <button onClick={guardar} disabled={guardando || !form.title.trim() || !form.text.trim()} className="btn-primary px-4 py-2 text-xs disabled:opacity-50">
            {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Agregar'}
          </button>
          {editando && <button onClick={() => { setEditando(null); setForm({ title: '', text: '', category: '' }); }} className="btn-ghost px-3 py-2 text-xs">Cancelar</button>}
        </div>
      </div>
    </SeccionCard>
  );
}

function CustomFieldsSection() {
  const [activeTab, setActiveTab] = useState('lead');
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState({ field_label: '', field_type: 'text', options: '' });
  const [guardando, setGuardando] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const cargar = (entity_type) => {
    api.customFields(entity_type).then(setFields).catch(() => {});
  };

  useEffect(() => { cargar(activeTab); }, [activeTab]);

  const agregar = async () => {
    if (!form.field_label.trim()) return;
    setGuardando(true);
    try {
      const options = form.field_type === 'select'
        ? form.options.split(',').map(o => o.trim()).filter(Boolean)
        : [];
      await api.createCustomField({ entity_type: activeTab, field_label: form.field_label.trim(), field_type: form.field_type, options });
      setForm({ field_label: '', field_type: 'text', options: '' });
      cargar(activeTab);
    } catch (e) { alert(e.message); }
    setGuardando(false);
  };

  const eliminar = (id) => {
    setConfirmDialog({
      message: '¿Eliminar este campo personalizado? Se perderán todos los valores guardados.',
      onConfirm: async () => {
        setConfirmDialog(null);
        await api.deleteCustomField(id).catch(e => alert(e.message));
        cargar(activeTab);
      },
    });
  };

  const TYPE_LABELS = { text: 'Texto', number: 'Número', date: 'Fecha', select: 'Selección' };
  const TYPE_COLORS = { text: 'text-blue-400', number: 'text-emerald-400', date: 'text-amber-400', select: 'text-purple-400' };

  return (
    <SeccionCard title="Campos personalizados" desc="Agrega campos extra a leads y contactos">
      {confirmDialog && <ConfirmModal message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border pb-3">
        {[{ key: 'lead', label: 'Leads' }, { key: 'contact', label: 'Contactos' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === t.key ? 'bg-accent text-white' : 'text-muted hover:text-white bg-white/5'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Field list */}
      <div className="space-y-2 mb-4">
        {fields.length === 0 && <p className="text-xs text-muted text-center py-3">Sin campos personalizados aún</p>}
        {fields.map(f => (
          <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 bg-bg rounded-lg border border-border">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-white">{f.field_label}</span>
              {f.options && f.options.length > 0 && (
                <span className="text-xs text-muted ml-2">({f.options.join(', ')})</span>
              )}
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 ${TYPE_COLORS[f.field_type] || 'text-muted'}`}>
              {TYPE_LABELS[f.field_type] || f.field_type}
            </span>
            <button onClick={() => eliminar(f.id)} className="text-xs text-muted hover:text-danger transition-colors flex-shrink-0">
              Eliminar
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="border-t border-border pt-4 space-y-2">
        <div className="text-xs text-muted mb-2">Nuevo campo</div>
        <input
          className="input text-sm"
          placeholder="Etiqueta del campo (ej: Presupuesto, Cargo)"
          value={form.field_label}
          onChange={e => setForm(f => ({ ...f, field_label: e.target.value }))}
        />
        <select
          className="input text-sm"
          value={form.field_type}
          onChange={e => setForm(f => ({ ...f, field_type: e.target.value }))}
        >
          <option value="text">Texto</option>
          <option value="number">Número</option>
          <option value="date">Fecha</option>
          <option value="select">Selección</option>
        </select>
        {form.field_type === 'select' && (
          <input
            className="input text-sm"
            placeholder="Opciones separadas por coma (ej: Opción 1, Opción 2)"
            value={form.options}
            onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
          />
        )}
        <button
          onClick={agregar}
          disabled={guardando || !form.field_label.trim()}
          className="btn-primary px-4 py-2 text-xs disabled:opacity-50"
        >
          {guardando ? 'Agregando...' : 'Agregar campo'}
        </button>
      </div>
    </SeccionCard>
  );
}

const RAILWAY_URL = 'https://crm-ia-production-c247.up.railway.app';

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <div className="flex gap-2">
        <input readOnly value={value} className="input flex-1 text-xs font-mono text-muted" />
        <button onClick={copy} className="btn-ghost border border-border px-3 py-2 text-xs flex-shrink-0">
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

function IntegracionesSection() {
  const [open, setOpen] = useState(null);
  const toggle = (k) => setOpen(p => p === k ? null : k);

  const integraciones = [
    {
      key: 'whatsapp',
      icon: '💬',
      title: 'WhatsApp',
      color: 'text-green-400',
      desc: 'Recibe y responde mensajes de WhatsApp Business',
      pasos: [
        'En tu cuenta de Twilio, ve a Messaging → Senders → WhatsApp Senders',
        'Si no tienes número de WhatsApp Business aprobado, usa el Sandbox: Messaging → Try it out → Send a WhatsApp message',
        'En la configuración del número/sandbox, busca "A message comes in" y pega la URL del webhook',
        'Agrega en Railway la variable: TWILIO_WHATSAPP_NUMBER = tu número de WhatsApp (ej: +14155238886)',
        'Los mensajes de WhatsApp llegarán al Inbox con el ícono 💬',
      ],
      url: { label: 'Webhook URL (mismo que SMS)', value: `${RAILWAY_URL}/api/webhook/twilio` },
    },
    {
      key: 'webform',
      icon: '🌐',
      title: 'Formulario Web',
      color: 'text-blue-400',
      desc: 'Captura leads del formulario de contacto de tu sitio web',
      pasos: [
        'En WordPress, instala el plugin WPForms Lite (gratis) o usa el formulario que ya tienes',
        'En el formulario, activa la opción de enviar a webhook/URL externa, o agrega el script de abajo en tu tema (Appearance → Theme Editor → footer.php)',
        'Los campos que se envían: name, email, phone, message',
        'Cada envío crea un lead nuevo con la etiqueta "Web" en el Inbox',
        'Se genera una alerta automática para que el agente haga seguimiento',
      ],
      url: { label: 'Endpoint del formulario', value: `${RAILWAY_URL}/api/webhook/webform` },
      extra: `<script>
// Pegar antes de </body> en tu WordPress
// Cambia 'your-form-id' por el ID real de tu formulario
document.addEventListener('submit', async function(e) {
  const form = e.target.closest('form');
  if (!form) return;
  const fields = Object.fromEntries(new FormData(form));
  if (!fields.your_name_field) return;
  fetch('${RAILWAY_URL}/api/webhook/webform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:    fields.your_name_field,
      email:   fields.your_email_field,
      phone:   fields.your_phone_field || '',
      message: fields.your_message_field || '',
    })
  });
});
</script>`,
    },
    {
      key: 'email',
      icon: '📧',
      title: 'Email',
      color: 'text-orange-400',
      desc: 'Captura leads cuando clientes escriben a info@fixatrippuertorico.com',
      pasos: [
        'Crea una cuenta gratis en sendgrid.com',
        'Ve a Settings → Inbound Parse → Add Host & URL',
        'Hostname: inbound.fixatrippuertorico.com | URL: pega el endpoint de abajo',
        'En el DNS de tu dominio (GoDaddy, Namecheap, etc.), agrega: Tipo MX | Host: inbound | Valor: mx.sendgrid.net | Prioridad: 10',
        'En tu proveedor de email (G Suite, GoDaddy Email), crea un reenvío: info@fixatrippuertorico.com → info@inbound.fixatrippuertorico.com',
        'Los emails llegan al Inbox con ícono 📧 y generan alerta para respuesta manual',
      ],
      url: { label: 'Endpoint SendGrid Inbound Parse', value: `${RAILWAY_URL}/api/webhook/email` },
    },
  ];

  return (
    <SeccionCard title="Integraciones de canales" desc="Conecta WhatsApp, formulario web y email al CRM">
      <div className="space-y-3">
        {integraciones.map(integ => (
          <div key={integ.key} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(integ.key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
            >
              <span className="text-lg">{integ.icon}</span>
              <div className="flex-1">
                <div className={`text-sm font-medium ${integ.color}`}>{integ.title}</div>
                <div className="text-xs text-muted">{integ.desc}</div>
              </div>
              <svg className={`w-4 h-4 text-muted transition-transform ${open === integ.key ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open === integ.key && (
              <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                <CopyField label={integ.url.label} value={integ.url.value} />

                <div>
                  <div className="text-xs text-muted mb-2">Pasos de configuración:</div>
                  <ol className="space-y-1.5">
                    {integ.pasos.map((paso, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-300">
                        <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span>
                        <span>{paso}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {integ.extra && (
                  <div>
                    <div className="text-xs text-muted mb-2">Script para WordPress:</div>
                    <pre className="bg-bg border border-border rounded-lg p-3 text-[10px] text-muted font-mono overflow-x-auto whitespace-pre-wrap">{integ.extra}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </SeccionCard>
  );
}

function TestBotSection() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || enviando) return;
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', content: texto }]);
    setEnviando(true);
    try {
      const historial = msgs.map(m => ({ role: m.role, content: m.content }));
      const data = await api.testBot(texto, historial);
      setMsgs(prev => [
        ...prev,
        { role: 'assistant', content: data.respuesta, intencion: data.intencion_compra },
      ]);
    } catch (e) {
      setMsgs(prev => [...prev, { role: 'error', content: e.message }]);
    }
    setEnviando(false);
  };

  const limpiar = () => setMsgs([]);

  return (
    <SeccionCard title="Probar bot IA" desc="Simula una conversación con el bot usando el prompt actual">
      <div className="bg-bg rounded-xl border border-border overflow-hidden">
        {/* Chat area */}
        <div className="h-72 overflow-y-auto p-4 space-y-3">
          {msgs.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-muted text-center">Escribe un mensaje para probar cómo responde el bot</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'error' ? (
                <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 max-w-xs">
                  Error: {m.content}
                </div>
              ) : (
                <div className={`max-w-xs lg:max-w-sm rounded-2xl px-3.5 py-2.5 text-xs ${
                  m.role === 'user'
                    ? 'bg-accent text-white rounded-tr-sm'
                    : 'bg-surface border border-border text-slate-200 rounded-tl-sm'
                }`}>
                  {m.content}
                  {m.intencion && (
                    <div className="mt-1.5 flex items-center gap-1 text-amber-400 text-[10px] font-medium">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      Intención de compra detectada
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {enviando && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Escribe un mensaje..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            disabled={enviando}
          />
          <button onClick={enviar} disabled={!input.trim() || enviando}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            Enviar
          </button>
          {msgs.length > 0 && (
            <button onClick={limpiar} className="btn-ghost border border-border px-3 py-2 text-xs text-muted hover:text-white">
              Limpiar
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted mt-2">Esta prueba usa el prompt guardado actualmente. No envía SMS reales ni guarda mensajes.</p>
    </SeccionCard>
  );
}

function AutomationsSection() {
  const [pipelines, setPipelines] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [selPipeline, setSelPipeline] = useState('');
  const [form, setForm] = useState({ trigger_stage_id: '', action_type: 'create_task', action_data: { title: '', days: 1, text: '' } });
  const [guardando, setGuardando] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const cargar = async () => {
    const [pips, autos] = await Promise.all([api.pipelines(), api.automations(selPipeline || undefined)]);
    setPipelines(pips);
    setAutomations(Array.isArray(autos) ? autos : []);
    if (!selPipeline && pips.length) setSelPipeline(String(pips[0].id));
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (selPipeline) api.automations(selPipeline).then(a => setAutomations(Array.isArray(a) ? a : [])).catch(() => {}); }, [selPipeline]);

  const stages = pipelines.find(p => String(p.id) === String(selPipeline))?.stages || [];

  const guardar = async () => {
    if (!form.trigger_stage_id || !selPipeline) return;
    setGuardando(true);
    try {
      await api.createAutomation({ pipeline_id: Number(selPipeline), trigger_stage_id: Number(form.trigger_stage_id), action_type: form.action_type, action_data: form.action_data });
      setForm({ trigger_stage_id: '', action_type: 'create_task', action_data: { title: '', days: 1, text: '' } });
      api.automations(selPipeline).then(a => setAutomations(Array.isArray(a) ? a : []));
    } catch (e) { alert(e.message); }
    setGuardando(false);
  };

  const toggleActive = async (id, active) => {
    await api.updateAutomation(id, { active }).catch(() => {});
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active } : a));
  };

  const eliminar = (id) => {
    setConfirmDialog({
      message: '¿Eliminar esta automatización?',
      onConfirm: async () => {
        setConfirmDialog(null);
        await api.deleteAutomation(id).catch(() => {});
        setAutomations(prev => prev.filter(a => a.id !== id));
      },
    });
  };

  const ACTION_LABELS = { create_task: '✅ Crear tarea', send_message: '💬 Enviar mensaje' };

  return (
    <SeccionCard title="Automatizaciones de pipeline" desc="Acciones automáticas cuando un lead cambia de etapa">
      {confirmDialog && <ConfirmModal message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      <div className="flex gap-2 mb-4">
        {pipelines.map(p => (
          <button key={p.id} onClick={() => setSelPipeline(String(p.id))}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${String(selPipeline) === String(p.id) ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:text-white'}`}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Existing automations */}
      <div className="space-y-2 mb-4">
        {automations.map(a => (
          <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 bg-bg rounded-lg border border-border">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.trigger_stage_color || '#1b9af5', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white">
                Cuando llega a <span style={{ color: a.trigger_stage_color || '#1b9af5' }}>{a.trigger_stage_name}</span>
                <span className="text-muted"> → </span>
                {ACTION_LABELS[a.action_type] || a.action_type}
              </div>
              <div className="text-xs text-muted mt-0.5 truncate">
                {a.action_type === 'create_task'
                  ? `"${a.action_data?.title}" en ${a.action_data?.days} día(s)`
                  : `"${String(a.action_data?.text || '').slice(0, 50)}"`
                }
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => toggleActive(a.id, !a.active)}
                style={{ width: 32, height: 18, borderRadius: 9, background: a.active ? 'var(--success)' : 'var(--border)', position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: a.active ? 15 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
              <button onClick={() => eliminar(a.id)} className="text-xs text-muted hover:text-danger transition-colors">Eliminar</button>
            </div>
          </div>
        ))}
        {automations.length === 0 && <p className="text-xs text-muted text-center py-3">Sin automatizaciones aún</p>}
      </div>

      {/* Add form */}
      <div className="border-t border-border pt-4 space-y-3">
        <div className="text-xs text-muted">Nueva automatización</div>
        <div className="flex gap-2">
          <select value={form.trigger_stage_id} onChange={e => setForm(f => ({ ...f, trigger_stage_id: e.target.value }))}
            className="input text-sm flex-1">
            <option value="">Cuando llega a la etapa...</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
            className="input text-sm" style={{ width: 160 }}>
            <option value="create_task">✅ Crear tarea</option>
            <option value="send_message">💬 Enviar mensaje</option>
          </select>
        </div>
        {form.action_type === 'create_task' && (
          <div className="flex gap-2">
            <input className="input text-sm flex-1" placeholder="Título de la tarea (ej: Llamar al cliente)"
              value={form.action_data.title} onChange={e => setForm(f => ({ ...f, action_data: { ...f.action_data, title: e.target.value } }))} />
            <div className="flex items-center gap-1">
              <input type="number" min="0" max="30" className="input text-sm" style={{ width: 60 }}
                value={form.action_data.days} onChange={e => setForm(f => ({ ...f, action_data: { ...f.action_data, days: e.target.value } }))} />
              <span className="text-xs text-muted whitespace-nowrap">días</span>
            </div>
          </div>
        )}
        {form.action_type === 'send_message' && (
          <textarea className="input resize-none text-sm" rows={2} placeholder="Mensaje automático a enviar al cliente..."
            value={form.action_data.text} onChange={e => setForm(f => ({ ...f, action_data: { ...f.action_data, text: e.target.value } }))} />
        )}
        <button onClick={guardar} disabled={guardando || !form.trigger_stage_id || (form.action_type === 'create_task' && !form.action_data.title) || (form.action_type === 'send_message' && !form.action_data.text)}
          className="btn-primary px-4 py-2 text-xs disabled:opacity-50">
          {guardando ? 'Guardando...' : 'Agregar automatización'}
        </button>
      </div>
    </SeccionCard>
  );
}

function ParametrosSolaresSection() {
  const [p, setP] = useState(DEFAULT_PRICING);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => { loadPricing().then(v => { setP(v); setLoaded(true); }); }, []);

  const guardar = async (next) => {
    setSaving(true); setOk(false);
    try {
      await savePricing(next);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const onChange = (k, v) => {
    const n = Number(v);
    setP(prev => ({ ...prev, [k]: isNaN(n) ? prev[k] : n }));
  };

  const restaurar = () => {
    if (!confirm('¿Restaurar parámetros al default de fábrica?')) return;
    setP(DEFAULT_PRICING);
    guardar(DEFAULT_PRICING);
  };

  if (!loaded) return null;

  const fields = [
    { key: 'panelPrice',       label: 'Precio por panel solar', unit: '$ / panel',  step: 0.5,   desc: 'Costo unitario instalado de cada panel fotovoltaico' },
    { key: 'panelWatts',       label: 'Vatios por panel',       unit: 'W',          step: 5,     desc: 'Potencia nominal de cada panel (típicamente 550W)' },
    { key: 'tarifaLuma',       label: 'Tarifa LUMA',            unit: '$ / kWh',    step: 0.01,  desc: 'Tarifa actual de LUMA Energy por kilovatio-hora' },
    { key: 'factorProduccion', label: 'Factor de producción',   unit: 'kWh / kW año', step: 10,  desc: 'Producción anual estimada por cada kW instalado en PR' },
    { key: 'pmt15',            label: 'Factor PMT 15 años',     unit: '× monto',    step: 0.0001, desc: 'Factor de pago mensual Vega Coop 6.5% / 15 años' },
  ];

  return (
    <SeccionCard title="Parámetros de Cotización" desc="Constantes usadas en todas las cotizaciones solares. Cambios aplican inmediato a leads nuevos y existentes.">
      <div className="space-y-3">
        {fields.map(f => (
          <div key={f.key} className="flex items-center gap-3 px-3 py-2.5 bg-bg rounded-lg border border-border">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white">{f.label}</div>
              <div className="text-[10px] text-muted">{f.desc}</div>
            </div>
            <input
              type="number"
              step={f.step}
              className="input text-xs"
              style={{ width: 110, textAlign: 'right' }}
              value={p[f.key]}
              onChange={e => onChange(f.key, e.target.value)}
              onBlur={() => guardar(p)}
            />
            <span className="text-[10px] text-muted whitespace-nowrap" style={{ width: 90 }}>{f.unit}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <button onClick={restaurar} className="text-[11px] text-muted hover:text-warning transition-colors">
          Restaurar default
        </button>
        <span className="text-[11px] text-muted">
          {saving ? 'Guardando…' : ok ? <span className="text-success">✓ Guardado</span> : 'Auto-guarda al salir del campo'}
        </span>
      </div>
    </SeccionCard>
  );
}

function BateriasSolaresSection() {
  const [list, setList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevaDesc, setNuevaDesc] = useState('');

  useEffect(() => {
    loadBaterias().then(b => { setList(b); setLoaded(true); });
  }, []);

  const guardar = async (next) => {
    setSaving(true); setOk(false);
    try {
      await saveBaterias(next);
      setList(next);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const editar = (i, campo, valor) => {
    const next = list.map((b, idx) => idx === i ? { ...b, [campo]: campo === 'precio' ? Number(valor) || 0 : valor } : b);
    setList(next);
  };

  const eliminar = (i) => {
    if (!confirm('¿Eliminar esta batería?')) return;
    guardar(list.filter((_, idx) => idx !== i));
  };

  const mover = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    guardar(next);
  };

  const agregar = () => {
    const name = nuevoNombre.trim();
    const precio = Number(nuevoPrecio) || 0;
    if (!name) return alert('Nombre requerido');
    guardar([...list, { name, precio, description: nuevaDesc.trim() }]);
    setNuevoNombre(''); setNuevoPrecio(''); setNuevaDesc('');
  };

  const restaurar = () => {
    if (!confirm('¿Restaurar lista de baterías al default de fábrica?')) return;
    guardar(DEFAULT_BATERIAS);
  };

  if (!loaded) return null;

  return (
    <SeccionCard title="Baterías solares" desc="Catálogo de baterías que aparecen en cotizaciones. Cambios se reflejan en todos los leads.">
      <div className="space-y-2 mb-4">
        {list.length === 0 && <p className="text-xs text-muted text-center py-3">No hay baterías. Agrega una abajo.</p>}
        {list.map((b, i) => (
          <div key={i} className="px-3 py-2 bg-bg rounded-lg border border-border" style={{ opacity: b.active === false ? 0.55 : 1 }}>
            <div className="flex items-center gap-2">
              <div className="flex flex-col flex-shrink-0">
                <button
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="text-xs text-muted hover:text-white transition-colors disabled:opacity-30"
                  style={{ lineHeight: 1, padding: '0 4px' }}
                  title="Subir"
                >▲</button>
                <button
                  onClick={() => mover(i, +1)}
                  disabled={i === list.length - 1}
                  className="text-xs text-muted hover:text-white transition-colors disabled:opacity-30"
                  style={{ lineHeight: 1, padding: '0 4px' }}
                  title="Bajar"
                >▼</button>
              </div>
              <button
                onClick={() => guardar(list.map((x, j) => j === i ? { ...x, active: x.active === false } : x))}
                title={b.active === false ? 'Activar (visible en cotizador)' : 'Desactivar (oculta en cotizador)'}
                style={{
                  width: 36, height: 20, borderRadius: 999,
                  background: b.active === false ? '#475569' : '#10b981',
                  border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                  transition: 'background 0.15s',
                }}>
                <span style={{
                  position: 'absolute', top: 2, left: b.active === false ? 2 : 18,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }} />
              </button>
              <input
                className="input text-xs flex-1"
                value={b.name}
                onChange={e => editar(i, 'name', e.target.value)}
                onBlur={() => guardar(list)}
                placeholder="Nombre"
                style={{ textDecoration: b.active === false ? 'line-through' : 'none' }}
              />
              <div className="flex items-center gap-1">
                <span className="text-muted text-xs">$</span>
                <input
                  className="input text-xs"
                  style={{ width: 100, textAlign: 'right' }}
                  type="number"
                  value={b.precio}
                  onChange={e => editar(i, 'precio', e.target.value)}
                  onBlur={() => guardar(list)}
                  placeholder="0"
                />
              </div>
              <button
                onClick={() => eliminar(i)}
                className="text-xs text-muted hover:text-danger transition-colors flex-shrink-0 px-2"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
            <textarea
              value={b.description || ''}
              onChange={e => editar(i, 'description', e.target.value)}
              onBlur={() => guardar(list)}
              placeholder="Descripción (opcional): capacidad, garantía, características…"
              rows={2}
              style={{ width:'100%', marginTop:6, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 9px', fontSize:11, color:'var(--text)', outline:'none', resize:'vertical', fontFamily:'inherit' }}
            />
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4">
        <div className="text-xs text-muted mb-2">Agregar nueva batería</div>
        <div className="flex items-center gap-2">
          <input
            className="input text-xs flex-1"
            placeholder="Ej: EG4 LifePower 14.3 kWh"
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
          />
          <div className="flex items-center gap-1">
            <span className="text-muted text-xs">$</span>
            <input
              className="input text-xs"
              style={{ width: 100, textAlign: 'right' }}
              type="number"
              placeholder="Precio"
              value={nuevoPrecio}
              onChange={e => setNuevoPrecio(e.target.value)}
            />
          </div>
          <button onClick={agregar} className="btn-primary text-xs px-4 py-2 flex-shrink-0">
            + Agregar
          </button>
        </div>
        <textarea
          value={nuevaDesc}
          onChange={e => setNuevaDesc(e.target.value)}
          placeholder="Descripción (opcional): capacidad, garantía, ciclos, etc."
          rows={2}
          style={{ width:'100%', marginTop:8, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 9px', fontSize:11, color:'var(--text)', outline:'none', resize:'vertical', fontFamily:'inherit' }}
        />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <button onClick={restaurar} className="text-[11px] text-muted hover:text-warning transition-colors">
          Restaurar default
        </button>
        <span className="text-[11px] text-muted">
          {saving ? 'Guardando…' : ok ? <span className="text-success">✓ Guardado</span> : `${list.length} baterías`}
        </span>
      </div>
    </SeccionCard>
  );
}

// ====== NUEVAS SECCIONES ======

function useSetting(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.settings().then(c => {
      if (c && c[key] !== undefined && c[key] !== null && c[key] !== '') {
        setValue(c[key]);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [key]);

  const save = async (v) => {
    setSaving(true); setOk(false);
    try {
      await api.saveSetting(key, String(v ?? value));
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return { value, setValue, save, loaded, saving, ok };
}

function EmpresaInfoSection() {
  const DEFAULT = {
    name: 'Energy Depot LLC',
    phone: '787-627-8585',
    email: 'info@energydepotpr.com',
    address1: 'Global Plaza Suite 204',
    address2: 'Cll John A. Ernot',
    city: 'San Juan',
    zip: '00920',
    website: 'www.energydepotpr.com',
  };
  const [data, setData] = useState(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.settings().then(c => {
      if (c?.empresa_info) {
        try { setData({ ...DEFAULT, ...JSON.parse(c.empresa_info) }); } catch {}
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async (next) => {
    try {
      await api.saveSetting('empresa_info', JSON.stringify(next));
      setOk(true); setTimeout(() => setOk(false), 2000);
    } catch (e) { alert(e.message); }
  };

  const onBlur = () => save(data);
  const set = (k, v) => setData(p => ({ ...p, [k]: v }));

  if (!loaded) return null;

  const fields = [
    { k: 'name', label: 'Nombre legal' },
    { k: 'phone', label: 'Teléfono' },
    { k: 'email', label: 'Email', type: 'email' },
    { k: 'address1', label: 'Dirección línea 1' },
    { k: 'address2', label: 'Dirección línea 2' },
    { k: 'city', label: 'Ciudad' },
    { k: 'zip', label: 'ZIP' },
    { k: 'website', label: 'Sitio web' },
  ];

  return (
    <SeccionCard title="Información de la empresa" desc="Datos que aparecen en cotizaciones, contratos y correos.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.k}>
            <label className="block text-xs text-muted mb-1">{f.label}</label>
            <input
              type={f.type || 'text'}
              className="input text-sm w-full"
              value={data[f.k] || ''}
              onChange={e => set(f.k, e.target.value)}
              onBlur={onBlur}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-muted">
        {ok ? <span className="text-success">✓ Guardado</span> : 'Auto-guarda al salir del campo'}
      </div>
    </SeccionCard>
  );
}

function AutoBccSection() {
  const { value, setValue, save, loaded, ok } = useSetting('email_auto_bcc', 'gil.diaz@energydepotpr.com');
  if (!loaded) return null;
  return (
    <SeccionCard title="Auto-BCC de correos" desc="Recibirás copia oculta de cada correo enviado desde el CRM.">
      <input
        type="email"
        className="input text-sm w-full"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => save()}
        placeholder="correo@empresa.com"
      />
      <div className="mt-2 text-[11px] text-muted">
        {ok ? <span className="text-success">✓ Guardado</span> : 'Auto-guarda al salir del campo'}
      </div>
    </SeccionCard>
  );
}

function MensajeCotizadorSection() {
  const { value, setValue, save, loaded, ok } = useSetting('cotizar_welcome_msg', 'Tus datos para preparar la propuesta personalizada.');
  if (!loaded) return null;
  return (
    <SeccionCard title="Mensaje del autocotizador" desc="Este texto se muestra al cliente cuando abre el link de autocotización.">
      <textarea
        className="input text-sm w-full resize-none"
        rows={4}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => save()}
      />
      <div className="mt-2 text-[11px] text-muted">
        {ok ? <span className="text-success">✓ Guardado</span> : 'Auto-guarda al salir del campo'}
      </div>
    </SeccionCard>
  );
}

function PlantillasEmailSection() {
  const TEMPLATES = [
    {
      id: 'modern',
      label: 'Cotizaciones en PDF (moderno)',
      subjectKey: 'email_tpl_modern_subject',
      htmlKey: 'email_tpl_modern_html',
      tpl: EMAIL_TEMPLATES.cotizaciones_pdf,
    },
    {
      id: 'classic',
      label: 'Cotización (tradicional)',
      subjectKey: 'email_tpl_classic_subject',
      htmlKey: 'email_tpl_classic_html',
      tpl: EMAIL_TEMPLATES.cotizacion_clasica,
    },
  ];

  const [tab, setTab] = useState('modern');
  const [config, setConfig] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [ok, setOk] = useState(null);

  useEffect(() => {
    api.settings().then(c => { setConfig(c || {}); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const get = (key, fallback) => config[key] ?? fallback;

  const save = async (key, val) => {
    try {
      await api.saveSetting(key, val);
      setConfig(p => ({ ...p, [key]: val }));
      setOk(key); setTimeout(() => setOk(null), 2000);
    } catch (e) { alert(e.message); }
  };

  if (!loaded) return null;
  const active = TEMPLATES.find(t => t.id === tab);
  const defSubject = active.tpl.subject({ contact_name: 'CLIENTE' });
  const defHtml = active.tpl.html({ contact_name: 'CLIENTE' });

  return (
    <SeccionCard title="Plantillas de correo" desc="HTML que se envía con las cotizaciones. Usa {{cliente_nombre}} como variable.">
      <div className="flex gap-1 mb-4 border-b border-border pb-3">
        {TEMPLATES.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-accent text-white' : 'text-muted hover:text-white bg-white/5'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1">Asunto del correo</label>
          <input
            className="input text-sm w-full"
            value={get(active.subjectKey, defSubject)}
            onChange={e => setConfig(p => ({ ...p, [active.subjectKey]: e.target.value }))}
            onBlur={e => save(active.subjectKey, e.target.value)}
            placeholder={defSubject}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">HTML del correo</label>
          <textarea
            className="input text-xs w-full font-mono resize-none"
            rows={18}
            value={get(active.htmlKey, defHtml)}
            onChange={e => setConfig(p => ({ ...p, [active.htmlKey]: e.target.value }))}
            onBlur={e => save(active.htmlKey, e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (!confirm('¿Restaurar al template original?')) return;
              save(active.subjectKey, defSubject);
              save(active.htmlKey, defHtml);
            }}
            className="text-[11px] text-muted hover:text-warning transition-colors">
            Reset a default
          </button>
          <span className="text-[11px] text-muted">
            {ok ? <span className="text-success">✓ Guardado</span> : 'Auto-guarda al salir del campo'}
          </span>
        </div>
      </div>
    </SeccionCard>
  );
}

function PipelinesEditorSection() {
  const [pipelines, setPipelines] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const cargar = () => api.pipelines().then(p => setPipelines(Array.isArray(p) ? p : [])).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const crearPipeline = async () => {
    const n = nuevoNombre.trim();
    if (!n) return;
    try {
      await api.createPipeline(n);
      setNuevoNombre('');
      cargar();
    } catch (e) { alert(e.message); }
  };

  const renombrarPipeline = async (id, name) => {
    if (!name?.trim()) return;
    try { await api.updatePipeline(id, { name }); cargar(); }
    catch (e) { alert(e.message); }
  };

  const eliminarPipeline = (id) => {
    setConfirmDialog({
      message: '¿Eliminar este pipeline? Se perderán todas sus etapas.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try { await api.deletePipeline(id); cargar(); }
        catch (e) { alert(e.message); }
      },
    });
  };

  const crearEtapa = async (pipelineId) => {
    const name = prompt('Nombre de la nueva etapa:');
    if (!name?.trim()) return;
    try {
      await api.createStage(pipelineId, { name: name.trim(), color: '#1a3c8f' });
      cargar();
    } catch (e) { alert(e.message); }
  };

  const actualizarEtapa = async (pipelineId, stageId, data) => {
    try { await api.updateStage(pipelineId, stageId, data); cargar(); }
    catch (e) { alert(e.message); }
  };

  const moverEtapa = async (pipeline, idx, delta) => {
    const stages = pipeline.stages || [];
    const j = idx + delta;
    if (j < 0 || j >= stages.length) return;
    const a = stages[idx], b = stages[j];
    await actualizarEtapa(pipeline.id, a.id, { order_index: b.order_index ?? j });
    await actualizarEtapa(pipeline.id, b.id, { order_index: a.order_index ?? idx });
  };

  const eliminarEtapa = (pipelineId, stageId) => {
    setConfirmDialog({
      message: '¿Eliminar esta etapa?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try { await api.deleteStage(pipelineId, stageId); cargar(); }
        catch (e) { alert(e.message); }
      },
    });
  };

  return (
    <SeccionCard title="Pipelines y etapas" desc="Configura los flujos de trabajo y sus etapas.">
      {confirmDialog && <ConfirmModal message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}

      <div className="space-y-2 mb-4">
        {pipelines.length === 0 && <p className="text-xs text-muted text-center py-3">Sin pipelines aún</p>}
        {pipelines.map(p => (
          <div key={p.id} className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-bg">
              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="text-xs text-muted hover:text-white">
                {expanded === p.id ? '▼' : '▶'}
              </button>
              <input
                defaultValue={p.name}
                onBlur={e => { if (e.target.value !== p.name) renombrarPipeline(p.id, e.target.value); }}
                className="input text-xs flex-1"
              />
              <span className="text-[10px] text-muted whitespace-nowrap">{(p.stages || []).length} etapas</span>
              <button onClick={() => eliminarPipeline(p.id)} className="text-xs text-muted hover:text-danger transition-colors">Eliminar</button>
            </div>

            {expanded === p.id && (
              <div className="px-3 py-3 border-t border-border space-y-2">
                {(p.stages || []).map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 bg-surface rounded-lg border border-border">
                    <div className="flex flex-col">
                      <button onClick={() => moverEtapa(p, idx, -1)} disabled={idx === 0}
                        className="text-xs text-muted hover:text-white disabled:opacity-30" style={{ lineHeight: 1, padding: '0 4px' }}>▲</button>
                      <button onClick={() => moverEtapa(p, idx, +1)} disabled={idx === (p.stages.length - 1)}
                        className="text-xs text-muted hover:text-white disabled:opacity-30" style={{ lineHeight: 1, padding: '0 4px' }}>▼</button>
                    </div>
                    <input type="color"
                      defaultValue={s.color || '#1a3c8f'}
                      onChange={e => actualizarEtapa(p.id, s.id, { color: e.target.value })}
                      style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                    <input
                      defaultValue={s.name}
                      onBlur={e => { if (e.target.value !== s.name) actualizarEtapa(p.id, s.id, { name: e.target.value }); }}
                      className="input text-xs flex-1"
                    />
                    <button onClick={() => eliminarEtapa(p.id, s.id)}
                      className="text-xs text-muted hover:text-danger transition-colors px-2">✕</button>
                  </div>
                ))}
                <button onClick={() => crearEtapa(p.id)} className="btn-ghost border border-border px-3 py-1.5 text-xs">
                  + Nueva etapa
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4">
        <div className="text-xs text-muted mb-2">Nuevo pipeline</div>
        <div className="flex gap-2">
          <input className="input text-sm flex-1" placeholder="Nombre del pipeline"
            value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
          <button onClick={crearPipeline} disabled={!nuevoNombre.trim()}
            className="btn-primary px-4 py-2 text-xs disabled:opacity-50">
            + Nuevo pipeline
          </button>
        </div>
      </div>
    </SeccionCard>
  );
}

// ====== SECCIONES BOT IA (extraídas de page original) ======

function BotAutomaticoSection({ botActivo, setBotActivo, guardar, ok }) {
  return (
    <SeccionCard title="Bot IA automático" desc="Responde automáticamente los SMS entrantes">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{botActivo ? 'Activo' : 'Inactivo'}</span>
        <button
          onClick={async () => { const n = !botActivo; setBotActivo(n); await guardar('bot_activo', n); }}
          className={`relative w-11 h-6 rounded-full transition-colors ${botActivo ? 'bg-accent' : 'bg-white/10'}`}
        >
          <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: botActivo ? '22px' : '2px' }} />
        </button>
      </div>
      {ok === 'bot_activo' && <p className="text-success text-xs mt-2">Guardado</p>}
    </SeccionCard>
  );
}

function BotHorarioSection({ horaInicio, setHoraInicio, horaFin, setHoraFin, dias, setDias, guardar, guardando, ok }) {
  const toggleDia = (num) => {
    setDias(prev => prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num].sort());
  };
  return (
    <SeccionCard title="Horario del bot" desc="El bot solo responderá automáticamente en el horario configurado">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Hora inicio</label>
            <input type="time" className="input" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Hora fin</label>
            <input type="time" className="input" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted mb-2">Días activos</label>
          <div className="flex gap-1.5 flex-wrap">
            {DIAS.map(d => (
              <button key={d.num} onClick={() => toggleDia(d.num)}
                className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                  dias.includes(d.num) ? 'bg-accent text-white' : 'bg-white/5 text-muted hover:text-white'
                }`}
              >{d.label}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              await guardar('bot_hora_inicio', horaInicio);
              await guardar('bot_hora_fin', horaFin);
              await guardar('bot_dias', dias.join(','));
            }}
            disabled={guardando !== null}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar horario'}
          </button>
          <button onClick={async () => {
            setHoraInicio(''); setHoraFin(''); setDias([1,2,3,4,5,6,7]);
            await guardar('bot_hora_inicio', '');
            await guardar('bot_hora_fin', '');
            await guardar('bot_dias', '1,2,3,4,5,6,7');
          }} className="text-xs text-muted hover:text-white transition-colors">
            Sin restricción horaria
          </button>
          {ok === 'bot_dias' && <span className="text-success text-xs">Guardado</span>}
        </div>
      </div>
    </SeccionCard>
  );
}

function BotPromptSection({ prompt, setPrompt, guardar, guardando, ok, promptTextareaRef, insertVar }) {
  const PROMPT_TEMPLATES = [
    { label: 'Solar', text: 'Eres un asistente de ventas de Energy Depot PR. Ayuda a clientes con preguntas sobre sistemas solares, baterías y financiamiento. Responde siempre en español.' },
    { label: 'Ventas', text: 'Eres un agente de ventas profesional. Tu objetivo es calificar leads, resolver dudas sobre productos/servicios y guiar al cliente hacia una compra.' },
    { label: 'Soporte', text: 'Eres un agente de soporte al cliente. Ayuda a resolver problemas, responde preguntas frecuentes y escala al equipo humano cuando sea necesario.' },
  ];
  return (
    <SeccionCard title="Prompt del asistente IA" desc="Define la personalidad y comportamiento del bot">
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-[10px] text-muted self-center mr-1">Plantillas:</span>
        {PROMPT_TEMPLATES.map(t => (
          <button key={t.label} type="button"
            onClick={() => setPrompt(t.text)}
            className="text-[10px] px-2.5 py-1 rounded-full bg-bg border border-border text-muted hover:text-accent hover:border-accent transition-colors">
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {['{{nombre}}', '{{telefono}}', '{{empresa}}', '{{pais}}', '{{fecha}}', '{{agente}}'].map(v => (
          <button key={v} type="button"
            onClick={() => insertVar(' ' + v)}
            className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted hover:text-accent hover:border-accent transition-colors bg-bg font-mono">
            {v}
          </button>
        ))}
      </div>
      <textarea
        ref={promptTextareaRef}
        rows={8}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        className="input resize-none font-mono text-xs"
        placeholder="Eres un asistente de ventas de Energy Depot PR..."
      />
      <div className="flex justify-between items-center text-[10px] text-muted mt-1 mb-2">
        <span>{prompt.length} caracteres {prompt.length > 800 ? <span className="text-yellow-400">(muy largo)</span> : prompt.length < 50 && prompt.length > 0 ? <span className="text-yellow-400">(muy corto)</span> : prompt.length > 0 ? <span className="text-green-400">✓ buena longitud</span> : ''}</span>
        <button type="button" onClick={() => setPrompt('')} className="text-[10px] text-muted hover:text-danger transition-colors">Limpiar</button>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => guardar('prompt_sistema', prompt)}
          disabled={guardando === 'prompt_sistema'}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {guardando === 'prompt_sistema' ? 'Guardando...' : 'Guardar prompt'}
        </button>
        {ok === 'prompt_sistema' && <span className="text-success text-xs">Guardado</span>}
      </div>
    </SeccionCard>
  );
}

// ====== SHELL ======

const TABS = [
  { id: 'general',      label: 'General',       icon: '⚙' },
  { id: 'cotizaciones', label: 'Cotizaciones',  icon: '☀' },
  { id: 'bot',          label: 'Bot IA',        icon: '🤖' },
  { id: 'comunicacion', label: 'Comunicación',  icon: '📨' },
  { id: 'pipeline',     label: 'Pipeline',      icon: '🔧' },
  { id: 'permisos',     label: 'Permisos',      icon: '👥' },
];

export default function SettingsPage() {
  const { lang } = useLang();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [botActivo, setBotActivo] = useState(true);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [dias, setDias] = useState([1,2,3,4,5]);
  const [guardando, setGuardando] = useState(null);
  const [ok, setOk] = useState(null);
  const promptTextareaRef = useRef(null);
  const [activeTab, setActiveTab] = useState('general');
  const [search, setSearch] = useState('');

  const filteredTabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TABS;
    return TABS.filter(t => t.label.toLowerCase().includes(q));
  }, [search]);

  const insertVar = (v) => {
    const el = promptTextareaRef.current;
    if (!el) { setPrompt(p => p + v); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = prompt.slice(0, start) + v + prompt.slice(end);
    setPrompt(newVal);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
  };

  useEffect(() => {
    api.settings().then(c => {
      setConfig(c);
      setPrompt(c.prompt_sistema || '');
      setBotActivo(c.bot_activo === 'true');
      setHoraInicio(c.bot_hora_inicio || '');
      setHoraFin(c.bot_hora_fin || '');
      setDias(c.bot_dias ? c.bot_dias.split(',').map(Number) : [1,2,3,4,5]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const guardar = async (key, value) => {
    setGuardando(key); setOk(null);
    try {
      await api.saveSetting(key, String(value));
      setOk(key);
      setTimeout(() => setOk(null), 2500);
    } catch (e) { alert(e.message); }
    setGuardando(null);
  };

  const toggleDia = (num) => {
    setDias(prev => prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num].sort());
  };

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <EmpresaInfoSection />
          </div>
        );
      case 'cotizaciones':
        return (
          <div className="space-y-6">
            <ParametrosSolaresSection />
            <BateriasSolaresSection />
            <MensajeCotizadorSection />
          </div>
        );
      case 'bot':
        return (
          <div className="space-y-6">
            <BotAutomaticoSection botActivo={botActivo} setBotActivo={setBotActivo} guardar={guardar} ok={ok} />
            <BotHorarioSection horaInicio={horaInicio} setHoraInicio={setHoraInicio} horaFin={horaFin} setHoraFin={setHoraFin} dias={dias} setDias={setDias} guardar={guardar} guardando={guardando} ok={ok} />
            <BotPromptSection prompt={prompt} setPrompt={setPrompt} guardar={guardar} guardando={guardando} ok={ok} promptTextareaRef={promptTextareaRef} insertVar={insertVar} />
            <TestBotSection />
          </div>
        );
      case 'comunicacion':
        return (
          <div className="space-y-6">
            <QuickRepliesSection />
            <PlantillasEmailSection />
            <AutoBccSection />
            <IntegracionesSection />
          </div>
        );
      case 'pipeline':
        return (
          <div className="space-y-6">
            <PipelinesEditorSection />
            <AutomationsSection />
            <CustomFieldsSection />
          </div>
        );
      case 'permisos':
        return (
          <div className="space-y-6">
            <PermissionsWrapper />
          </div>
        );
      default:
        return null;
    }
  };

  const activeMeta = TABS.find(x => x.id === activeTab) || TABS[0];

  return (
    <div className="flex-col md:flex-row" style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar - desktop */}
      <aside
        className="hidden md:flex"
        style={{
          width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
          background: 'var(--surface)', flexDirection: 'column', padding: '20px 12px',
        }}
      >
        <div style={{ padding: '0 8px 12px' }}>
          <h1 className="text-base font-semibold text-white" style={{ marginBottom: 12 }}>
            {t('nav.settings', lang)}
          </h1>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-xs w-full"
            placeholder="Buscar sección..."
            style={{ padding: '7px 10px' }}
          />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {filteredTabs.map(tb => {
            const active = activeTab === tb.id;
            return (
              <button key={tb.id} onClick={() => setActiveTab(tb.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, border: 'none',
                  background: active ? 'rgba(26, 60, 143, 0.18)' : 'transparent',
                  color: active ? '#67e8f9' : 'var(--muted)',
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  borderLeft: active ? '2px solid #67e8f9' : '2px solid transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 18, textAlign: 'center' }}>{tb.icon}</span>
                <span>{tb.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile tab bar */}
      <div className="md:hidden" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '1px solid var(--border)', width: '100%' }}>
        <div style={{ padding: '12px 16px' }}>
          <h1 className="text-base font-semibold text-white">{t('nav.settings', lang)}</h1>
        </div>
        <div style={{ display: 'flex', overflowX: 'auto', gap: 4, padding: '0 12px 10px', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(tb => {
            const active = activeTab === tb.id;
            return (
              <button key={tb.id} onClick={() => setActiveTab(tb.id)}
                style={{
                  flex: '0 0 auto', padding: '7px 12px', borderRadius: 999, border: '1px solid var(--border)',
                  background: active ? '#1a3c8f' : 'transparent',
                  color: active ? '#fff' : 'var(--muted)',
                  fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
                }}>
                {tb.icon} {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content panel */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div className="hidden md:block" style={{ marginBottom: 24 }}>
            <h2 className="text-xl font-semibold text-white" style={{ marginBottom: 4 }}>
              <span style={{ marginRight: 8 }}>{activeMeta.icon}</span>{activeMeta.label}
            </h2>
          </div>
          {renderTab()}
        </div>
      </main>
    </div>
  );
}


function PermissionsWrapper() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      }
    } catch {}
  }, []);

  if (!user || user.role !== 'admin') return null;

  return (
    <SeccionCard title="Permisos por rol" desc="Configura qué acciones puede realizar cada rol en el CRM. Los cambios se guardan automáticamente.">
      <PermissionsPanel />
    </SeccionCard>
  );
}
