'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { loadBaterias, DEFAULT_BATERIAS, loadPricing, DEFAULT_PRICING } from '../../../lib/baterias';
import { EMAIL_TEMPLATES } from '../../../lib/email-templates';
import { useAuth } from '../../../lib/auth';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tiempoRelativo(ts, lang = 'es') {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('time.now', lang);
  if (min < 60) return t('time.min', lang).replace('{n}', min);
  const h = Math.floor(min / 60);
  if (h < 24) return t('time.hours', lang).replace('{n}', h);
  return t('time.days', lang).replace('{n}', Math.floor(h / 24));
}

const TAG_COLORS = ['#1b9af5','#f59e0b','#10b981','#ef4444','#1b9af5','#8b5cf6','#ec4899','#14b8a6'];

const ACTIVITY_LABELS = {
  etapa_cambiada:    { icon: '→', label: 'Etapa cambiada a' },
  nota_agregada:     { icon: '📝', label: 'Nota agregada' },
  tag_agregado:      { icon: '🏷', label: 'Tag agregado' },
  tarea_creada:      { icon: '✓', label: 'Tarea creada' },
  tarea_completada:  { icon: '✅', label: 'Tarea completada' },
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.65)' }} onClick={onCancel}>
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

// ─── Sidebar Field Helper ─────────────────────────────────────────────────────

function SidebarField({ label, type = 'text', value, onChange, onBlur, placeholder }) {
  const saveTimer = useRef(null);
  const handleChange = (v) => {
    onChange?.(v);
    if (onBlur) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onBlur(v), 800);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1 }}>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => handleChange(e.target.value)}
        onBlur={e => { clearTimeout(saveTimer.current); onBlur?.(e.target.value); }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 5, padding: '5px 7px', fontSize: 12, color: 'var(--text)',
          outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

function SidebarContratoBtn({ leadId }) {
  const [show, setShow]         = useState(false);
  const [modalidad, setMod]     = useState('efectivo');
  const [pronto, setPronto]     = useState('');
  const [loading, setLoading]   = useState(false);

  const generar = async () => {
    setLoading(true);
    try {
      const data = await api.generarContrato(leadId, { modalidad, prontoDado: Number(pronto)||0 });
      if (!data.pdf) throw new Error('Sin PDF');
      const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type:'application/pdf' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a'); a.href=url; a.download=data.filename||`Contrato-${leadId}.pdf`; a.click();
      URL.revokeObjectURL(url);
      setShow(false);
    } catch(e) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setShow(true)}
        style={{ width:'100%', background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        Generar Contrato
      </button>
      {show && (
        <div style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShow(false)}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:28, width:340 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:20 }}>📄 Generar Contrato Solar</div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:8 }}>Modalidad de Pago</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['efectivo','💵 Efectivo (50/50)'],['financiamiento','🏦 Financiamiento']].map(([v,l]) => (
                  <button key={v} onClick={() => setMod(v)} style={{ border: modalidad===v?'2px solid #10b981':'1px solid var(--border)', borderRadius:8, padding:'10px 8px', background: modalidad===v?'rgba(16,185,129,0.12)':'var(--bg)', cursor:'pointer', fontSize:12, fontWeight:600, color: modalidad===v?'#10b981':'var(--text)' }}>{l}</button>
                ))}
              </div>
            </div>
            {modalidad === 'financiamiento' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6 }}>Pronto Dado ($)</label>
                <input type="number" value={pronto} onChange={e => setPronto(e.target.value)} placeholder="ej: 5000"
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13, color:'var(--text)', outline:'none' }} />
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button onClick={() => setShow(false)} style={{ flex:1, background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'9px', fontSize:13, color:'var(--muted)', cursor:'pointer' }}>Cancelar</button>
              <button onClick={generar} disabled={loading} style={{ flex:2, background:'#10b981', border:'none', borderRadius:8, padding:'9px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', opacity:loading?0.6:1 }}>
                {loading ? 'Generando…' : '✓ Generar y Descargar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SidebarEmailBtn({ leadId, lead }) {
  const [show, setShow] = useState(false);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');  // when a template is selected
  const [tpl, setTpl] = useState('custom');
  const [files, setFiles] = useState([]); // { name, mime, base64 }
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState(false);
  // Overrides desde el config table (Settings page). Si están vacíos se usa el default del archivo.
  const [tplOverrides, setTplOverrides] = useState({}); // { email_tpl_modern_html, email_tpl_modern_subject, email_tpl_classic_html, email_tpl_classic_subject }

  useEffect(() => {
    if (!show) return;
    api.get('/api/settings')
      .then(d => {
        if (d && typeof d === 'object') {
          setTplOverrides({
            email_tpl_modern_html:    d.email_tpl_modern_html    || '',
            email_tpl_modern_subject: d.email_tpl_modern_subject || '',
            email_tpl_classic_html:   d.email_tpl_classic_html   || '',
            email_tpl_classic_subject:d.email_tpl_classic_subject|| '',
          });
        }
      })
      .catch(() => {});
  }, [show]);

  useEffect(() => {
    if (show) {
      const email = lead?.contact_email || lead?.email || '';
      // Extract name from title if contact_name is missing (titles often "LG-XXXX — Name" or "Name — City")
      const rawTitle = lead?.title || '';
      const titleName = rawTitle.replace(/^[A-Z]{2,3}-\d+\s*[—–-]\s*/, '').split(/\s*[—–]\s*/)[0].trim();
      const name = lead?.contact_name || titleName || '';
      setTo(email);
      setCc('');
      setTpl('custom');
      setSubject(`Propuesta Solar — ${name || 'Energy Depot'}`);
      setBody(`Hola ${name},\n\nAdjunto la propuesta de tu sistema solar.\n\nCualquier duda, estoy a tus órdenes.\n\n— Energy Depot LLC\n(787) 627-8585\ninfo@energydepotpr.com`);
      setBodyHtml('');
      setFiles([]);
    }
  }, [show, lead?.contact_email, lead?.email, lead?.contact_name, lead?.title]);

  const aplicarTemplate = (key) => {
    setTpl(key);
    if (key === 'custom') {
      setBodyHtml('');
      return;
    }
    const t = EMAIL_TEMPLATES[key];
    if (!t) return;
    const rawTitle = lead?.title || '';
    const titleName = rawTitle.replace(/^[A-Z]{2,3}-\d+\s*[—–-]\s*/, '').split(/\s*[—–]\s*/)[0].trim();
    const enriched = { ...lead, contact_name: lead?.contact_name || titleName };

    // Override desde config table (Settings). Solo se usa si la key existe y no está vacía.
    const interp = (s) => String(s || '')
      .replace(/\{\{\s*contact_name\s*\}\}/g, enriched.contact_name || '')
      .replace(/\{\{\s*email\s*\}\}/g, enriched.contact_email || enriched.email || '');
    const ovSubjectKey = key === 'cotizaciones_pdf' ? 'email_tpl_modern_subject'
                      : key === 'cotizacion_clasica' ? 'email_tpl_classic_subject' : null;
    const ovHtmlKey    = key === 'cotizaciones_pdf' ? 'email_tpl_modern_html'
                      : key === 'cotizacion_clasica' ? 'email_tpl_classic_html' : null;
    const ovSubject = ovSubjectKey && tplOverrides[ovSubjectKey] ? interp(tplOverrides[ovSubjectKey]) : null;
    const ovHtml    = ovHtmlKey    && tplOverrides[ovHtmlKey]    ? interp(tplOverrides[ovHtmlKey])    : null;

    setSubject(ovSubject || t.subject(enriched));
    setBody(t.text(enriched));
    setBodyHtml(ovHtml || t.html(enriched));
  };

  const onPickFiles = async (e) => {
    const list = Array.from(e.target.files || []);
    const next = [];
    for (const f of list) {
      try {
        // Lee como DataURL y extrae solo la parte base64 — funciona con archivos grandes
        const b64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const s = String(reader.result || '');
            const i = s.indexOf(',');
            resolve(i >= 0 ? s.slice(i + 1) : s);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(f);
        });
        next.push({ name: f.name, mime: f.type || 'application/octet-stream', base64: b64 });
      } catch (err) {
        alert(`Error leyendo "${f.name}": ${err.message}`);
      }
    }
    setFiles(prev => [...prev, ...next]);
    e.target.value = '';
  };

  const adjuntarPropuesta = async (quotationId) => {
    setAttaching(true);
    try {
      const data = await api.leadPropuesta(leadId, quotationId);
      if (!data?.pdf) throw new Error('Sin PDF');
      setFiles(prev => [...prev, {
        name: data.filename || `Propuesta-${leadId}.pdf`,
        mime: 'application/pdf',
        base64: data.pdf,
      }]);
    } catch (e) { alert('Error generando propuesta: ' + e.message); }
    finally { setAttaching(false); }
  };

  // Cotizaciones disponibles para adjuntar
  const quotationsList = (() => {
    const sd = lead?.solar_data || {};
    if (Array.isArray(sd.quotations) && sd.quotations.length > 0) return sd.quotations;
    return [];
  })();

  const enviar = async () => {
    if (!to.trim()) { alert('Falta destinatario'); return; }
    if (!subject.trim()) { alert('Falta asunto'); return; }
    if (!body.trim()) { alert('Falta mensaje'); return; }
    setLoading(true);
    try {
      const html = bodyHtml || body.replace(/\n/g, '<br>');
      const r = await api.sendEmail({
        to_email: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        body,
        body_html: html,
        lead_id: leadId,
        contact_id: lead?.contact_id,
        attachments: files.map(f => ({ filename: f.name, mimeType: f.mime, content: f.base64 })),
      });
      if (!r.ok) throw new Error(r.error || 'Error desconocido');
      setShow(false);
      alert('✓ Correo enviado');
    } catch (e) { alert('Error enviando: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setShow(true)}
        style={{ width:'100%', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        Enviar Email
      </button>
      {show && (
        <div style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setShow(false)}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:24, width:560, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:4 }}>✉️ Enviar Email</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:18 }}>De: <strong>info@energydepotpr.com</strong></div>

            <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6 }}>Plantilla</label>
            <select value={tpl} onChange={e => aplicarTemplate(e.target.value)}
              style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', fontSize:13, color:'var(--text)', outline:'none', marginBottom:10 }}>
              <option value="custom">Personalizado (texto plano)</option>
              {Object.entries(EMAIL_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
            </select>

            <Field label="Para" value={to} onChange={setTo} placeholder="cliente@correo.com" />
            <Field label="CC (opcional)" value={cc} onChange={setCc} placeholder="otra@correo.com" />
            <Field label="Asunto" value={subject} onChange={setSubject} />

            <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6, marginTop:12 }}>
              Mensaje {tpl !== 'custom' && <span style={{ color:'#7c3aed', textTransform:'none', letterSpacing:0 }}>(usando plantilla — el texto plano es para fallback)</span>}
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={tpl !== 'custom' ? 4 : 9}
              style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'10px 12px', fontSize:13, color:'var(--text)', outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.5 }} />

            {tpl !== 'custom' && bodyHtml && (
              <div style={{ marginTop:10 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6 }}>Vista previa</label>
                <div style={{ border:'1px solid var(--border)', borderRadius:6, maxHeight:280, overflowY:'auto', background:'#fff' }}>
                  <iframe srcDoc={bodyHtml} style={{ width:'100%', minHeight:280, border:'none' }} title="preview" />
                </div>
              </div>
            )}

            <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6, marginTop:14 }}>Adjuntos</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
              <label style={{ background:'var(--bg)', border:'1px dashed var(--border)', borderRadius:6, padding:'8px 12px', fontSize:12, color:'var(--text)', cursor:'pointer' }}>
                📎 Subir archivo
                <input type="file" multiple onChange={onPickFiles} style={{ display:'none' }} />
              </label>
              {quotationsList.length === 0 ? (
                <button onClick={() => adjuntarPropuesta()} disabled={attaching}
                  style={{ background:'#1a3c8f', color:'#fff', border:'none', borderRadius:6, padding:'8px 12px', fontSize:12, fontWeight:600, cursor:'pointer', opacity:attaching?0.6:1 }}>
                  {attaching ? 'Generando…' : '☀️ Adjuntar Propuesta'}
                </button>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>☀️ Adjuntar:</span>
                  {quotationsList.map(q => (
                    <button key={q.id} onClick={() => adjuntarPropuesta(q.id)} disabled={attaching}
                      style={{ background:'#1a3c8f', color:'#fff', border:'none', borderRadius:6, padding:'7px 10px', fontSize:11, fontWeight:600, cursor:'pointer', opacity:attaching?0.6:1 }}>
                      {q.name || 'Cotización'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {files.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:6 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', fontSize:12 }}>
                    <span style={{ color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📄 {f.name} <span style={{ color:'var(--muted)', fontSize:11 }}>({Math.round(f.base64.length*0.75/1024)} KB)</span></span>
                    <button onClick={() => setFiles(files.filter((_,j) => j!==i))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button onClick={() => setShow(false)} style={{ flex:1, background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'9px', fontSize:13, color:'var(--muted)', cursor:'pointer' }}>Cancelar</button>
              <button onClick={enviar} disabled={loading} style={{ flex:2, background:'#7c3aed', border:'none', borderRadius:8, padding:'9px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', opacity:loading?0.6:1 }}>
                {loading ? 'Enviando…' : '✉️ Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', fontSize:13, color:'var(--text)', outline:'none' }} />
    </div>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────

function LeadPanel({ leadId, pipelines, agents, onClose, onUpdated, leads = [], onNavigate, lang = 'es', isMobile = false }) {
  const { user: currentUser } = useAuth();
  const [lead, setLead] = useState(null);
  const [tab, setTab] = useState('chat');
  const [mobileTab, setMobileTab] = useState('chat'); // 'chat' | 'info'
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [notes, setNotes] = useState([]);
  const [internalNotes, setInternalNotes] = useState([]);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [tags, setTags] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState('#1b9af5');
  const [chatText, setChatText] = useState('');
  const [newTask, setNewTask] = useState({ title: '', due_date: '' });
  const [showReplies, setShowReplies] = useState(false);
  const [repliesFilter, setRepliesFilter] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatChannel, setChatChannel] = useState('auto'); // auto | sms | whatsapp
  const [inputMode, setInputMode] = useState('chat'); // chat | nota | tarea | email
  const [leadEmails, setLeadEmails] = useState([]);
  const [emailDraft, setEmailDraft] = useState({ to_email: '', subject: '', body: '', account: 'operations' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailReplies, setShowEmailReplies] = useState(false);
  const [emailRepliesFilter, setEmailRepliesFilter] = useState('');
  const [infoOpen, setInfoOpen] = useState(true);
  const [infoTab, setInfoTab] = useState('principal');
  const [quickTask, setQuickTask] = useState({ title: '', due_date: '', full_day: false, assigned_to: '' });
  const [savingQuickTask, setSavingQuickTask] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [translating, setTranslating] = useState(false);
  const [wasTranslated, setWasTranslated] = useState(false);
  const [chatTranslations, setChatTranslations] = useState({});
  // AI summary state
  const [resumen, setResumen] = useState(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  // Custom fields state
  const [customFields, setCustomFields] = useState([]);
  const [customValues, setCustomValues] = useState({}); // { field_id: value }
  const [savingExtra, setSavingExtra] = useState(false);
  // Call state
  const [callLogs, setCallLogs] = useState([]);
  const [callDevice, setCallDevice] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle | connecting | active | ended
  const [callTimer, setCallTimer] = useState(0);
  const [activeCall, setActiveCall] = useState(null);
  const [logId, setLogId] = useState(null);
  const callIntervalRef = useRef(null);
  const bottomRef = useRef(null);
  const tripSaveTimer = useRef(null);
  // Trip info state
  const [tripInfo, setTripInfo] = useState({});
  const [tripDirty, setTripDirty] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);
  // Lead extra contacts state
  const [leadContacts, setLeadContacts] = useState([]);
  const [newContact, setNewContact] = useState({ nombre: '', telefono: '' });
  // Merge state
  const [showMerge, setShowMerge] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeResults, setMergeResults] = useState([]);
  const [merging, setMerging] = useState(false);
  // Stage chip dropdown
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  // Marketing campaigns
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  useEffect(() => { api.marketingCampaigns().then(d => setMarketingCampaigns(d.campaigns || [])).catch(() => {}); }, []);
  // AI Assistant state
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef(null);
  // Invoice state
  const [leadInvoice, setLeadInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);

  // Merge: search leads when query changes
  useEffect(() => {
    if (!mergeQuery.trim()) { setMergeResults([]); return; }
    api.leads(`?search=${encodeURIComponent(mergeQuery)}`).then(l => {
      setMergeResults((Array.isArray(l) ? l : []).filter(x => x.id !== leadId).slice(0, 8));
    }).catch(() => {});
  }, [mergeQuery]);

  const cargarTodo = () => {
    Promise.all([
      api.lead(leadId),
      api.notes(leadId),
      api.tags(leadId),
      api.activity(leadId),
      api.tasks(`?lead_id=${leadId}`),
      api.messages(leadId),
      api.quickReplies(),
    ]).then(([l, n, tg, act, tk, msg, qr]) => {
      setLead(l); setNotes(n); setTags(tg); setActivity(act);
      setTasks(tk); setMessages(msg); setQuickReplies(qr);
      if (l?.contact_email) setEmailDraft(p => ({ ...p, to_email: l.contact_email }));
    }).catch(() => {});
    // Load custom fields + values
    Promise.all([
      api.customFields('lead'),
      api.getCustomValues('lead', leadId),
    ]).then(([fields, vals]) => {
      setCustomFields(fields);
      const map = {};
      vals.forEach(v => { map[v.field_id] = v.value ?? ''; });
      setCustomValues(map);
    }).catch(() => {});
    // Load call logs
    api.callLogs(leadId).then(setCallLogs).catch(() => {});
    // Load trip info + extra contacts
    api.tripInfo(leadId).then(d => { setTripInfo(d || {}); setTripDirty(false); }).catch(() => {});
    api.leadContacts(leadId).then(setLeadContacts).catch(() => {});
    // Load internal notes
    api.leadInternalNotes(leadId).then(n => setInternalNotes(Array.isArray(n) ? n : [])).catch(() => {});
    // Load emails for this lead
    api.emails(`?lead_id=${leadId}&page=1`).then(d => setLeadEmails(Array.isArray(d?.emails) ? d.emails : [])).catch(() => {});
    // Load linked invoice
    setInvoiceLoading(true);
    api.invoices(`?lead_id=${leadId}`).then(d => {
      setLeadInvoice(d?.data?.[0] || null);
    }).catch(() => {}).finally(() => setInvoiceLoading(false));
  };

  useEffect(() => { cargarTodo(); }, [leadId]);

  // Auto-save trip info with 1.5s debounce
  useEffect(() => {
    if (!tripDirty || !leadId) return;
    clearTimeout(tripSaveTimer.current);
    tripSaveTimer.current = setTimeout(async () => {
      try { await api.saveTripInfo(leadId, tripInfo); setTripDirty(false); } catch {}
    }, 1500);
    return () => clearTimeout(tripSaveTimer.current);
  }, [tripInfo, tripDirty, leadId]);

  // Pre-cargar SDK de Twilio al abrir el panel (para que esté listo cuando se pulse Llamar)
  useEffect(() => {
    import('@twilio/voice-sdk').catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  // Chat real-time via SSE + 60s fallback polling
  useEffect(() => {
    if (tab !== 'chat') return;

    // Fallback polling every 60s (in case SSE drops)
    const poll = setInterval(() => {
      api.messages(leadId).then(setMessages).catch(() => {});
    }, 60000);

    // SSE for instant updates
    let es;
    try {
      const token = localStorage.getItem('crm_token');
      const base = typeof window !== 'undefined' ? '/backend' : '';
      es = new EventSource(`${base}/api/events?token=${encodeURIComponent(token)}`);
      es.addEventListener('new_message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.lead_id === leadId) {
            api.messages(leadId).then(setMessages).catch(() => {});
          }
        } catch {}
      });
      es.addEventListener('error', () => {
        // SSE error — will retry automatically; fallback poll covers it
      });
    } catch {}

    return () => {
      clearInterval(poll);
      es?.close();
    };
  }, [leadId, tab]);

  const enviarMensaje = async () => {
    if (!chatText.trim() || sending) return;
    setSending(true);
    try {
      const channel = chatChannel === 'auto' ? null : chatChannel;
      const msg = await api.sendMessage(leadId, chatText.trim(), channel);
      setMessages(prev => [...prev, msg]);
      setChatText('');
      setWasTranslated(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  // Insert a quick reply with variable substitution
  const insertarRespuesta = (r) => {
    let txt = r.text;
    const nombre   = lead?.contact_name || lead?.title || '';
    const telefono = lead?.contact_phone || '';
    const fecha    = tripInfo?.check_in ? new Date(tripInfo.check_in + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    txt = txt
      .replace(/\{\{nombre\}\}/gi, nombre)
      .replace(/\{\{telefono\}\}/gi, telefono)
      .replace(/\{\{fecha\}\}/gi, fecha)
      .replace(/\{\{checkin\}\}/gi, fecha);
    setChatText(txt);
    setShowReplies(false);
    setRepliesFilter('');
  };

  const guardarFollowUp = async () => {
    if (!followUpDate || savingFollowUp) return;
    setSavingFollowUp(true);
    try {
      await api.setFollowUp(leadId, new Date(followUpDate).toISOString());
      setLead(prev => ({ ...prev, follow_up_at: followUpDate }));
      setShowFollowUp(false);
      setFollowUpDate('');
    } catch (e) { alert('Error al guardar recordatorio: ' + e.message); }
    finally { setSavingFollowUp(false); }
  };

  const traducirChat = async () => {
    if (!chatText.trim() || translating) return;
    setTranslating(true);
    try {
      const { translated } = await api.translate(chatText.trim(), 'en');
      setChatText(translated);
      setWasTranslated(true);
    } catch (e) { alert('Error al traducir: ' + e.message); }
    finally { setTranslating(false); }
  };

  const agregarNota = async () => {
    if (!newNote.trim()) return;
    try {
      const nota = await api.createNote(leadId, newNote.trim());
      setNotes(prev => [...prev, nota]);
      setNewNote('');
      api.activity(leadId).then(setActivity).catch(() => {});
    } catch (e) { alert(e.message); }
  };

  const eliminarNota = async (noteId) => {
    await api.deleteNote(leadId, noteId).catch(e => alert(e.message));
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const agregarTag = async () => {
    if (!newTag.trim()) return;
    try {
      const tag = await api.addTag(leadId, newTag.trim(), newTagColor);
      setTags(prev => [...prev.filter(t => t.tag !== tag.tag), tag]);
      setNewTag('');
    } catch (e) { alert(e.message); }
  };

  const eliminarTag = async (tag) => {
    await api.deleteTag(leadId, tag).catch(e => alert(e.message));
    setTags(prev => prev.filter(t => t.tag !== tag));
  };

  const crearTarea = async () => {
    if (!newTask.title.trim()) return;
    try {
      const task = await api.createTask({ lead_id: leadId, title: newTask.title.trim(), due_date: newTask.due_date || null });
      setTasks(prev => [...prev, task]);
      setNewTask({ title: '', due_date: '' });
      api.activity(leadId).then(setActivity).catch(() => {});
    } catch (e) { alert(e.message); }
  };

  const completarTarea = async (id, completed) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    await api.completeTask(id, completed).catch(() => {});
    api.activity(leadId).then(setActivity).catch(() => {});
  };

  const moverEtapa = async (stageId) => {
    const pip = pipelines.find(p => p.stages.some(s => s.id === Number(stageId)));
    await api.moveLead(leadId, { stage_id: Number(stageId), pipeline_id: pip?.id });
    setLead(prev => ({
      ...prev,
      stage_id: Number(stageId),
      stage_name: pip?.stages.find(s => s.id === Number(stageId))?.name,
      stage_color: pip?.stages.find(s => s.id === Number(stageId))?.color,
    }));
    api.activity(leadId).then(setActivity).catch(() => {});
    onUpdated?.();
  };

  const generarResumen = async () => {
    // Toggle: si ya hay resumen, cerrarlo
    if (resumen) { setResumen(null); return; }
    setResumenLoading(true);
    try {
      const data = await api.leadResumen(leadId);
      setResumen(data.resumen);
    } catch (e) {
      alert('Error al generar resumen: ' + e.message);
    }
    setResumenLoading(false);
  };

  if (!lead) return (
    <div style={{ position: 'fixed', top: 0, bottom: 0, left: isMobile ? 0 : 68, right: 0, zIndex: isMobile ? 200 : 50, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', background: isMobile ? 'var(--bg)' : undefined }}>
      {!isMobile && <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />}
      <div className="relative w-full max-w-xl bg-surface border-l border-border flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const allStages = pipelines.flatMap(p => p.stages);

  return (
    <div
      className="lead-panel-overlay"
      style={{
        position: 'fixed',
        top: 0, left: isMobile ? 0 : 68, right: 0,
        bottom: 0,
        zIndex: isMobile ? 250 : 50,
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
    >
      <div
        className="relative bg-surface flex flex-col"
        style={{ width: '100%' }}
      >

        {/* Header — always dark navy (Kommo style) */}
        <div className={isMobile ? "flex-shrink-0" : "px-4 py-2 flex-shrink-0"} style={{ background: '#1c2d3e', borderBottom: '1px solid #253b4f', paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 10px)' : undefined, paddingLeft: isMobile ? 8 : undefined, paddingRight: isMobile ? 8 : undefined, paddingBottom: isMobile ? 10 : undefined }}>
          {/* Fila 1: título + cerrar */}
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: isMobile ? 0 : 4 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: isMobile ? 14 : 14, fontWeight: 600, color: '#e0eaf5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.title}</div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {onNavigate && leads.length > 1 && (() => {
                const idx = leads.findIndex(l => l.id === leadId);
                return (<>
                  <button onClick={() => idx > 0 && onNavigate(leads[idx - 1].id)} disabled={idx <= 0}
                    style={{ background: 'none', border: 'none', cursor: idx > 0 ? 'pointer' : 'default', color: idx > 0 ? 'var(--text)' : 'var(--muted)', padding: '4px 6px', borderRadius: 6, fontSize: 16, lineHeight: 1 }}>‹</button>
                  <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 32, textAlign: 'center' }}>{idx + 1}/{leads.length}</span>
                  <button onClick={() => idx < leads.length - 1 && onNavigate(leads[idx + 1].id)} disabled={idx >= leads.length - 1}
                    style={{ background: 'none', border: 'none', cursor: idx < leads.length - 1 ? 'pointer' : 'default', color: idx < leads.length - 1 ? 'var(--text)' : 'var(--muted)', padding: '4px 6px', borderRadius: 6, fontSize: 16, lineHeight: 1 }}>›</button>
                </>);
              })()}
              {isMobile ? (
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e0eaf5', minWidth: 40, minHeight: 40, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, borderRadius: 10 }}>
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
              ) : (
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a9ab8', padding: 4 }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {/* Fila 2: contacto + teléfono — oculto si el nombre del contacto ya está en el title */}
          {(lead.contact_name || lead.contact_phone) && (() => {
            // Si title contiene contact_name, no repetimos el nombre
            const titleHasName = lead.contact_name && lead.title?.toLowerCase().includes(lead.contact_name.toLowerCase());
            const showName = lead.contact_name && lead.contact_name !== lead.contact_phone && !titleHasName;
            const showPhone = !!lead.contact_phone;
            if (!showName && !showPhone) return null;
            return (
              <div className="truncate" style={{ color: '#7a9ab8', fontSize: isMobile ? 11 : 12, marginBottom: 2, lineHeight: 1.3 }}>
                {showName ? lead.contact_name : ''}{showPhone ? `${showName ? ' · ' : ''}${lead.contact_phone}` : ''}
              </div>
            );
          })()}
          {/* Fila 3: etapa + valor + acciones — desktop only */}
          {!isMobile && <div className="flex items-center gap-2 flex-wrap">
            {lead.stage_name && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: `${lead.stage_color}20`, color: lead.stage_color }}>
                {lead.stage_name}
              </span>
            )}
            {lead.value > 0 && <span className="text-xs text-emerald-400 flex-shrink-0">${Number(lead.value).toLocaleString()}</span>}
            {tags.map(t => (
              <span key={t.tag} onClick={() => eliminarTag(t.tag)}
                className="text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-70 flex-shrink-0"
                style={{ backgroundColor: `${t.color}20`, color: t.color }}>
                {t.tag} ×
              </span>
            ))}
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              {lead.contact_phone && (
                <button
                  onClick={() => setTab('llamadas')}
                  style={{ background: callStatus === 'active' ? '#ef4444' : '#10b981', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontSize: 11, fontWeight: 600 }}
                >
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                  </svg>
                  {callStatus === 'active' ? `${Math.floor(callTimer/60).toString().padStart(2,'0')}:${(callTimer%60).toString().padStart(2,'0')}` : 'Llamar'}
                </button>
              )}
              <button
                onClick={() => setTab('cotizar')}
                title="Cotizar"
                style={{ background: '#1a3c8f', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontSize: 11, fontWeight: 600 }}
              >
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                Cotizar
              </button>
              <button
                onClick={() => setShowMerge(true)}
                title="Unir leads"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4"/></svg>
              </button>
            </div>
          </div>}
          {/* Mobile: subtitle row with stage chip + value */}
          {isMobile && (lead.stage_name || lead.value > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {lead.stage_name && (
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 600, backgroundColor: `${lead.stage_color}25`, color: lead.stage_color }}>
                  {lead.stage_name}
                </span>
              )}
              {lead.value > 0 && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>${Number(lead.value).toLocaleString()}</span>}
            </div>
          )}
        </div>

        {/* Mobile tabs — Chat | Info | More */}
        {isMobile && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 5 }}>
            {[
              { k: 'chat', l: 'Chat', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> },
              { k: 'info', l: 'Info', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            ].map(({ k, l, icon }) => {
              const sel = mobileTab === k && !showMoreSheet;
              return (
                <button key={k} onClick={() => { setMobileTab(k); setShowMoreSheet(false); }} style={{
                  flex: 1, minHeight: 46, padding: '0', border: 'none', cursor: 'pointer',
                  background: 'none', fontSize: 13, fontWeight: sel ? 700 : 500,
                  color: sel ? '#1a3c8f' : 'var(--muted)',
                  borderBottom: sel ? '2px solid #1a3c8f' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>{icon}{l}</button>
              );
            })}
            <button onClick={() => setShowMoreSheet(v => !v)} style={{
              width: 56, minHeight: 46, padding: 0, border: 'none', cursor: 'pointer',
              background: 'none',
              color: showMoreSheet ? '#1a3c8f' : 'var(--muted)',
              borderBottom: showMoreSheet ? '2px solid #1a3c8f' : '2px solid transparent',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} aria-label="Más">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
            </button>
          </div>
        )}
        {/* More sheet — small floating panel from bottom inside the lead panel */}
        {isMobile && showMoreSheet && (
          <>
            <div onClick={() => setShowMoreSheet(false)} style={{ position: 'absolute', inset: 0, zIndex: 60 }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 61,
              background: 'var(--surface)', borderTop: '1px solid var(--border)',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--border)' }} />
              </div>
              {(() => {
                const iconWrap = (path) => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ color: '#1a3c8f' }}>{path}</svg>;
                const items = [
                  { key: 'cotizar',   icon: iconWrap(<><circle cx="12" cy="12" r="4"/><path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>), label: 'Cotizar', count: lead.solar_data?.calc ? 1 : 0 },
                  { key: 'notas',     icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>), label: 'Notas', count: notes.length },
                  { key: 'tareas',    icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>), label: 'Tareas', count: tasks.filter(tk => !tk.completed).length },
                  { key: 'llamadas',  icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>), label: 'Llamadas', count: callLogs.length },
                  { key: 'actividad', icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>), label: 'Actividad', count: 0 },
                  { key: 'factura',   icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-3-7 3V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>), label: 'Factura', count: leadInvoice ? 1 : 0 },
                  { key: 'contactos', icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8z"/>), label: 'Contactos', count: leadContacts.length },
                  { key: 'notas-int', icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>), label: 'Notas internas', count: internalNotes.length },
                  { key: 'ai',        icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>), label: 'Bot IA', count: 0 },
                  { key: 'extra',     icon: iconWrap(<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>), label: 'Extras', count: customFields.length },
                ];
                return items.map(item => (
                  <button key={item.key} onClick={() => { setTab(item.key); setMobileTab('chat'); setShowMoreSheet(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{item.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.count > 0 && <span style={{ fontSize: 11, background: '#1a3c8f', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.count}</span>}
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--muted)', opacity: 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </div>
                  </button>
                ));
              })()}
              <div style={{ height: 16 }} />
            </div>
          </>
        )}

        {/* Body: two-column Kommo layout */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>

        {/* LEFT: Info sidebar — Kommo style */}
        <div style={{ width: isMobile ? (mobileTab === 'info' ? '100%' : '0') : (infoOpen ? 300 : 0), overflowY: (isMobile ? mobileTab === 'info' : infoOpen) ? 'auto' : 'hidden', overflowX: 'hidden', flexShrink: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column', borderRight: (!isMobile && infoOpen) ? '1px solid var(--border)' : 'none', transition: isMobile ? 'none' : 'width 0.2s ease' }}>
          <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>

            {/* Info tabs bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #253b4f', flexShrink: 0, overflowX: 'auto', background: '#162435' }}>
              {[
                { key: 'principal', label: 'Principal' },
              ].map(it => (
                <button key={it.key} onClick={() => setInfoTab(it.key)} style={{
                  flexShrink: 0, padding: '8px 12px', fontSize: 11, fontWeight: infoTab === it.key ? 700 : 400,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: infoTab === it.key ? '#1b9af5' : '#6a8fa8',
                  borderBottom: `2px solid ${infoTab === it.key ? '#1b9af5' : 'transparent'}`,
                  marginBottom: -1, whiteSpace: 'nowrap',
                }}>{it.label}</button>
              ))}
            </div>

            {/* PRINCIPAL tab */}
            {infoTab === 'principal' && (<>
              {/* Management */}
              <div style={{ padding: isMobile ? '18px 18px' : '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: isMobile ? 12 : 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: isMobile ? 14 : 10 }}>Management</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 10, color: 'var(--muted)' }}>Stage</label>
                    <select value={lead.stage_id || ''} onChange={e => moverEtapa(e.target.value)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 7px', fontSize: 12, color: 'var(--text)', cursor: 'pointer', outline: 'none', width: '100%' }}>
                      <option value="">No stage</option>
                      {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 10, color: 'var(--muted)' }}>Responsible</label>
                    <select value={lead.assigned_to || ''} onChange={async e => { const v = e.target.value; setLead(p => ({...p, assigned_to: v})); try { await api.updateLead(leadId, { assigned_to: v || null }); if (onUpdated) onUpdated(); } catch (err) { alert('Error: ' + err.message); } }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 7px', fontSize: 12, color: 'var(--text)', cursor: 'pointer', outline: 'none', width: '100%' }}>
                      <option value="">Unassigned</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 10, color: 'var(--muted)' }}>Budget</label>
                    <input type="number" value={lead.value || ''} placeholder="$0" onChange={e => setLead(p => ({...p, value: e.target.value}))} onBlur={async e => { try { await api.moveLead(leadId, { value: e.target.value || null }); } catch {} }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 7px', fontSize: 12, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 10, color: 'var(--muted)' }}>Campaña Marketing</label>
                    <select
                      value={lead.marketing_campaign_id || ''}
                      onChange={async e => {
                        const v = e.target.value;
                        setLead(p => ({...p, marketing_campaign_id: v ? Number(v) : null}));
                        try { await api.updateLead(leadId, { marketing_campaign_id: v ? Number(v) : null }); if (onUpdated) onUpdated(); } catch (err) { alert('Error: ' + err.message); }
                      }}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 7px', fontSize: 12, color: 'var(--text)', cursor: 'pointer', outline: 'none', width: '100%' }}>
                      <option value="">— Sin campaña —</option>
                      {marketingCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {/* Solar Data block */}
              {lead.solar_data?.calc && (
                <div style={{ padding: isMobile ? '18px 18px' : '12px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: isMobile ? 12 : 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: isMobile ? 14 : 10 }}>Sistema Solar</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    {[
                      ['Sistema', `${lead.solar_data.calc.systemKw} kW`],
                      ['Paneles', `${lead.solar_data.calc.panels} unidades`],
                      ['Prom. mensual', `${lead.solar_data.calc.avg} kWh`],
                      ['Ahorro anual', `$${(lead.solar_data.calc.annualSavings||0).toLocaleString()}`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600 }}>{k}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginTop: 1 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    <button
                      onClick={async () => {
                        try {
                          const data = await api.leadPropuesta(lead.id);
                          if (!data.pdf) throw new Error('Sin PDF');
                          const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
                          const blob  = new Blob([bytes], { type: 'application/pdf' });
                          const url   = URL.createObjectURL(blob);
                          const a     = document.createElement('a');
                          a.href = url; a.download = data.filename || `Propuesta-${lead.id}.pdf`; a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) { alert('Error: ' + err.message); }
                      }}
                      style={{ width:'100%', background:'#1a3c8f', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      Propuesta PDF
                    </button>
                    <SidebarContratoBtn leadId={lead.id} />
                    <SidebarEmailBtn leadId={lead.id} lead={lead} />
                    <button
                      onClick={async () => {
                        try {
                          const sd = lead.solar_data || {};
                          const qid = sd.activeQuotationId;
                          const r = await api.leadShareLink(lead.id, qid);
                          if (!r?.url) throw new Error('Sin link');
                          await navigator.clipboard.writeText(r.url);
                          alert('✓ Link copiado al portapapeles:\n\n' + r.url + '\n\nMándaselo al cliente — verá la propuesta como página web.');
                        } catch (e) { alert('Error: ' + e.message); }
                      }}
                      style={{ width:'100%', background:'transparent', color:'#0ea5e9', border:'1px solid #0ea5e9', borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                      Copiar link propuesta
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`¿Eliminar este lead "${lead.title || lead.contact_name || ''}"? Esta acción no se puede deshacer.`)) return;
                        try {
                          await api.deleteLead(lead.id);
                          if (onClose) onClose();
                          if (onUpdated) onUpdated();
                        } catch (e) { alert('Error: ' + e.message); }
                      }}
                      style={{ width:'100%', background:'transparent', color:'#ef4444', border:'1px solid #ef4444', borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
                      Eliminar Lead
                    </button>
                  </div>
                </div>
              )}
              {/* Contact */}
              <div style={{ padding: isMobile ? '18px 18px' : '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: isMobile ? 12 : 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: isMobile ? 14 : 10 }}>Contact</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SidebarField label="Name" value={lead.contact_name || ''} onChange={v => setLead(p => ({...p, contact_name: v}))} onBlur={async v => { try { if (lead.contact_id) await api.updateContact(lead.contact_id, { name: v }); } catch {} }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 10, color: 'var(--muted)' }}>Phone</label>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <input value={lead.contact_phone || ''} onChange={e => setLead(p => ({...p, contact_phone: e.target.value}))} onBlur={async e => { try { if (lead.contact_id) await api.updateContact(lead.contact_id, { phone: e.target.value }); } catch {} }} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 7px', fontSize: 12, color: 'var(--text)', outline: 'none', minWidth: 0 }} />
                      {lead.contact_phone && (
                        <button onClick={() => setTab('llamadas')} title="Call" style={{ flexShrink: 0, background: '#10b981', border: 'none', borderRadius: 5, padding: '5px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <SidebarField label="Email" value={lead.contact_email || ''} onChange={v => setLead(p => ({...p, contact_email: v}))} onBlur={async v => { try { if (lead.contact_id) await api.updateContact(lead.contact_id, { email: v }); } catch {} }} />
                  <SidebarField
                    label="Dirección"
                    value={lead.solar_data?.address || ''}
                    onChange={v => setLead(p => ({...p, solar_data: { ...(p.solar_data || {}), address: v }}))}
                    onBlur={async v => { try { await api.saveSolarData(leadId, { solar_data: { ...(lead.solar_data || {}), address: v } }); } catch {} }}
                    placeholder="Calle, ciudad, ZIP"
                  />
                  <button
                    onClick={async () => {
                      try {
                        let cid = lead.contact_id;
                        if (!cid) {
                          // Crear contacto si no existe
                          const c = await api.createContact({
                            name: lead.contact_name || lead.title || '',
                            email: lead.contact_email || null,
                            phone: lead.contact_phone || null,
                          });
                          cid = c.id || c.contact?.id;
                          if (cid) await api.updateLead(leadId, { contact_id: cid });
                          setLead(p => ({ ...p, contact_id: cid }));
                        } else {
                          await api.updateContact(cid, {
                            name: lead.contact_name || null,
                            email: lead.contact_email || null,
                            phone: lead.contact_phone || null,
                          });
                        }
                        if (onUpdated) onUpdated();
                        alert('✓ Contacto guardado');
                      } catch (e) { alert('Error: ' + e.message); }
                    }}
                    style={{ marginTop:8, width:'100%', background:'#10b981', color:'#fff', border:'none', borderRadius:6, padding:'7px 10px', fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Guardar contacto
                  </button>
                </div>
              </div>
              {/* Tags */}
              <div style={{ padding: isMobile ? '18px 18px' : '12px 14px' }}>
                <div style={{ fontSize: isMobile ? 12 : 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: isMobile ? 12 : 8 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {tags.length === 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>No tags</span>}
                  {tags.map(t => (
                    <span key={t.tag} onClick={() => eliminarTag(t.tag)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}30`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {t.tag} <span style={{ opacity: 0.7 }}>×</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarTag()} placeholder="+ add tag..." style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 7px', fontSize: 11, color: 'var(--text)', outline: 'none', minWidth: 0 }} />
                  <div style={{ display: 'flex', gap: 2 }}>
                    {TAG_COLORS.slice(0,5).map(c => (
                      <button key={c} onClick={() => setNewTagColor(c)} style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: newTagColor === c ? '2px solid white' : '1px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                    ))}
                  </div>
                  {newTag.trim() && <button onClick={agregarTag} style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>+</button>}
                </div>
              </div>
            </>)}


          </div>
        </div>{/* end LEFT info sidebar */}

        {/* Toggle button — only on desktop */}
        {!isMobile && <button
          onClick={() => setInfoOpen(o => !o)}
          title={infoOpen ? 'Hide info' : 'Show info'}
          style={{
            flexShrink: 0, width: 16, border: 'none', cursor: 'pointer',
            background: 'var(--surface)', borderRight: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {infoOpen ? <path d="M6 2L2 6L6 10"/> : <path d="M2 2L6 6L2 10"/>}
          </svg>
        </button>}

        {/* RIGHT: Chat + Tabs */}
        <div style={{ flex: isMobile && mobileTab === 'info' ? 0 : 1, display: isMobile && mobileTab === 'info' ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0 overflow-x-auto scrollbar-hide" style={{ display: isMobile ? 'none' : undefined }}>
          {[
            { key: 'chat',      label: '💬', full: t('leads.tab.chat', lang), count: messages.length },
            { key: 'notas',     label: '📝', full: t('leads.tab.notes', lang), count: notes.length },
            { key: 'tareas',    label: '✓', full: t('leads.tab.tasks', lang), count: tasks.filter(tk => !tk.completed).length },
            { key: 'llamadas',  label: '📞', full: t('leads.tab.calls', lang), count: callLogs.length },
            { key: 'actividad', label: '📋', full: t('leads.tab.activity', lang), count: 0 },
            { key: 'extra',     label: '＋', full: t('leads.tab.extra', lang), count: customFields.length },
            { key: 'factura',   label: '🧾', full: 'Factura', count: leadInvoice ? 1 : 0 },
            { key: 'contactos', label: '👥', full: t('leads.tab.contacts', lang), count: leadContacts.length },
            { key: 'notas-int', label: '🔒', full: t('leads.tab.intNotes', lang), count: internalNotes.length },
            { key: 'ai',        label: '🤖', full: t('leads.tab.ai', lang), count: 0 },
            { key: 'cotizar',   label: '☀️', full: 'Cotizar', count: lead.solar_data?.calc ? 1 : 0 },
          ].map(tab_item => (
            <button key={tab_item.key} onClick={() => setTab(tab_item.key)}
              className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 flex flex-col items-center gap-0.5 ${
                tab === tab_item.key ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-white'
              }`}
            >
              <span>{tab_item.label}</span>
              <span style={{ fontSize: 9 }}>{tab_item.count > 0 ? tab_item.count : tab_item.full}</span>
            </button>
          ))}
        </div>

        {/* Merge overlay */}
        {showMerge && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', padding: 24 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, maxHeight: '80%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('leads.mergeTitle', lang)}</div>
                <button onClick={() => { setShowMerge(false); setMergeQuery(''); setMergeResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                El lead <strong style={{ color: 'var(--text)' }}>{lead.title}</strong> se mantendrá. Los mensajes, notas, tareas y contactos del otro lead se transferirán aquí y ese lead será eliminado.
              </div>
              <input
                className="input text-sm"
                style={{ marginBottom: 8 }}
                placeholder={t('leads.mergeSearch', lang)}
                value={mergeQuery}
                onChange={e => setMergeQuery(e.target.value)}
                autoFocus
              />
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {mergeResults.length === 0 && mergeQuery.trim() && (
                  <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Sin resultados</p>
                )}
                {mergeResults.map(r => (
                  <button
                    key={r.id}
                    disabled={merging}
                    onClick={async () => {
                      if (!confirm(`¿Unir "${r.title}" → "${lead.title}"?\nTodos los datos de "${r.title}" se moverán aquí y ese lead se eliminará.`)) return;
                      setMerging(true);
                      try {
                        await api.mergeLeads(r.id, leadId);
                        setShowMerge(false);
                        setMergeQuery('');
                        setMergeResults([]);
                        cargarTodo();
                        onUpdated?.();
                      } catch (e) { alert(e.message); }
                      setMerging(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${r.stage_color || '#1b9af5'}20`, color: r.stage_color || '#1b9af5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {(r.contact_name || r.title || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
                      {r.contact_name && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{r.contact_name}</div>}
                    </div>
                    {r.stage_name && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${r.stage_color}20`, color: r.stage_color, flexShrink: 0 }}>{r.stage_name}</span>
                    )}
                  </button>
                ))}
                {merging && <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>Uniendo leads...</p>}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* CHAT */}
          {tab === 'chat' && (
            <div className="flex flex-col h-full">
              {/* Bot toggle + AI summary bar */}
              <div className="px-4 pt-3 pb-1 flex-shrink-0 flex items-center gap-2 flex-wrap">
                {/* Bot on/off toggle */}
                <button
                  onClick={async () => {
                    const newVal = !lead.bot_disabled;
                    try {
                      await api.toggleLeadBot(leadId, newVal);
                      setLead(prev => ({ ...prev, bot_disabled: newVal }));
                    } catch (e) { alert(e.message); }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: lead.bot_disabled ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                    color: lead.bot_disabled ? '#ef4444' : '#10b981',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{lead.bot_disabled ? '🤖' : '🤖'}</span>
                  <span>Bot: {lead.bot_disabled ? t('leads.botOff', lang) : t('leads.botOn', lang)}</span>
                  {/* Toggle pill */}
                  <div style={{ width: 28, height: 16, borderRadius: 8, background: lead.bot_disabled ? '#ef444440' : '#10b98140', position: 'relative', border: `1px solid ${lead.bot_disabled ? '#ef4444' : '#10b981'}` }}>
                    <div style={{ position: 'absolute', top: 2, left: lead.bot_disabled ? 2 : 12, width: 10, height: 10, borderRadius: '50%', background: lead.bot_disabled ? '#ef4444' : '#10b981', transition: 'left 0.2s' }} />
                  </div>
                </button>
                {/* AI Summary button — only if 3+ messages */}
                {messages.length >= 3 && (
                  <button
                    onClick={generarResumen}
                    disabled={resumenLoading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-60"
                  >
                    {resumenLoading
                      ? <span className="w-3 h-3 border border-purple-300 border-t-transparent rounded-full animate-spin" />
                      : <span>✨</span>
                    }
                    {resumenLoading ? t('leads.summarizing', lang) : t('leads.summarize', lang)}
                  </button>
                )}
              </div>

              {/* Bot disabled banner */}
              {lead.bot_disabled && (
                <div style={{ margin: '0 16px 4px', padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🤖 El bot está <strong>desactivado</strong> — no responderá automáticamente a este lead.
                </div>
              )}

              {/* AI Summary box */}
              {resumen && (
                <div className="mx-4 mt-2 mb-1 flex-shrink-0 bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="text-xs font-semibold text-purple-300">✨ Resumen IA</div>
                    <button
                      onClick={() => setResumen(null)}
                      style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: '#c084fc', cursor: 'pointer', lineHeight: 1.4 }}
                    >✕ Cerrar</button>
                  </div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{resumen}</div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 && notes.length === 0 && leadEmails.length === 0 && <p className="text-muted text-sm text-center py-8">Sin mensajes aún</p>}
                {[
                  ...messages.map(m => ({ ...m, _type: 'msg' })),
                  ...notes.map(n => ({ ...n, _type: 'note' })),
                  ...leadEmails.map(e => ({ ...e, _type: 'email' })),
                ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((item, i) => {
                  if (item._type === 'note') {
                    return (
                      <div key={`note_${item.id}`} className="flex justify-center">
                        <div style={{ maxWidth: '80%', borderRadius: 12, padding: '8px 14px', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 3, letterSpacing: 0.5 }}>🔒 Nota interna</div>
                          <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{item.text}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{item.user_name} · {tiempoRelativo(item.created_at, lang)}</div>
                        </div>
                      </div>
                    );
                  }
                  if (item._type === 'email') {
                    const esEnviado = item.direction === 'outbound';
                    return (
                      <div key={`email_${item.id}`} className={`flex ${esEnviado ? 'justify-end' : 'justify-start'}`}>
                        <div style={{ maxWidth: '82%', borderRadius: 12, padding: '10px 14px',
                          background: esEnviado ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${esEnviado ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.12)'}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: esEnviado ? '#818cf8' : 'var(--muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span>✉️</span>
                            <span>{esEnviado ? `${item.from_email} → ${item.to_email}` : `De: ${item.from_email}`}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{item.subject}</div>
                          <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.45, maxHeight: 120, overflowY: 'auto' }}>{item.body}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, textAlign: esEnviado ? 'right' : 'left' }}>
                            {tiempoRelativo(item.created_at, lang)}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const m = item;
                  const esCliente = m.direction === 'inbound';
                  const trKey = `msg_${leadId}_${i}`;
                  const tr = chatTranslations[trKey];
                  const toggleTr = async () => {
                    if (tr?.text) { setChatTranslations(p => { const n={...p}; delete n[trKey]; return n; }); return; }
                    setChatTranslations(p => ({ ...p, [trKey]: { loading: true } }));
                    try {
                      const { translated } = await api.translate(m.text, 'es');
                      setChatTranslations(p => ({ ...p, [trKey]: { text: translated } }));
                    } catch { setChatTranslations(p => { const n={...p}; delete n[trKey]; return n; }); }
                  };
                  return (
                    <div key={`msg_${i}`} className={`flex ${esCliente ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        esCliente ? 'bg-white/10 text-slate-200 rounded-tl-sm'
                          : m.is_bot ? 'bg-purple-500/20 border border-purple-500/30 text-white rounded-tr-sm'
                          : 'bg-accent/20 border border-accent/30 text-white rounded-tr-sm'
                      }`}>
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</div>
                        {esCliente && tr?.loading && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-muted flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 border border-muted border-t-transparent rounded-full animate-spin inline-block" />
                            Traduciendo...
                          </div>
                        )}
                        {esCliente && tr?.text && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <div className="text-[10px] text-muted mb-1">🌐 Traducción (ES)</div>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed italic text-slate-300">{tr.text}</div>
                          </div>
                        )}
                        <div className={`text-[10px] mt-1 flex items-center gap-2 ${esCliente ? 'text-muted' : 'justify-end text-accent/60'}`}>
                          {!esCliente && <span>{m.is_bot ? 'Bot IA' : (m.sent_by_name || 'Agente')} ·</span>}
                          <span>{tiempoRelativo(m.created_at, lang)}</span>
                          {esCliente && (
                            <button onClick={toggleTr} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: tr?.text ? 'var(--accent)' : 'var(--muted)' }}>
                              🌐 {tr?.text ? 'Ocultar' : 'Traducir'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* ── Compositor inferior (position: relative para el picker flotante) ── */}
              <div style={{ position: 'relative', flexShrink: 0 }}>

                {/* ── Template picker: flota hacia ARRIBA como un panel ── */}
                {showReplies && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'var(--surface)', borderTop: '1px solid var(--border)',
                    borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                    borderRadius: '12px 12px 0 0', boxShadow: '0 -6px 24px rgba(0,0,0,0.35)',
                    maxHeight: 260, display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>⚡</span>
                      <input
                        autoFocus
                        value={repliesFilter}
                        onChange={e => setRepliesFilter(e.target.value)}
                        placeholder="Buscar plantilla... (variables: {{nombre}}, {{fecha}}, {{telefono}})"
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text)', fontFamily: 'inherit' }}
                      />
                      <button onClick={() => setShowReplies(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {quickReplies.length === 0 ? (
                        <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                          Sin plantillas aún — créalas en Configuración → Respuestas rápidas
                        </div>
                      ) : (() => {
                        const filtered = quickReplies.filter(r =>
                          !repliesFilter || r.title.toLowerCase().includes(repliesFilter.toLowerCase()) || r.text.toLowerCase().includes(repliesFilter.toLowerCase())
                        );
                        const categories = [...new Set(filtered.map(r => r.category || 'General'))];
                        return categories.map(cat => (
                          <div key={cat}>
                            <div style={{ padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{cat}</div>
                            {filtered.filter(r => (r.category || 'General') === cat).map(r => (
                              <button key={r.id} onClick={() => insertarRespuesta(r)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                className="hover:bg-white/5 transition-colors">
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{r.title}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.text.slice(0, 80)}</div>
                              </button>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

              {/* ── Selector de modo: Chat / Nota / Tarea / Email | Auto / SMS ── */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px 0', display: 'flex', gap: 2, alignItems: 'center' }}>
                {[
                  { key: 'chat',  label: '💬 Chat' },
                  { key: 'nota',  label: '📝 Nota' },
                  { key: 'tarea', label: '✓ Tarea' },
                  { key: 'email', label: '✉️ Email' },
                ].map(m => (
                  <button key={m.key} onClick={() => setInputMode(m.key)} style={{
                    fontSize: 12, padding: '5px 12px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer',
                    background: inputMode === m.key ? 'var(--surface2)' : 'transparent',
                    color: inputMode === m.key ? 'var(--text)' : 'var(--muted)',
                    fontWeight: inputMode === m.key ? 600 : 400,
                    borderBottom: inputMode === m.key ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'all 0.12s',
                  }}>{m.label}</button>
                ))}
                <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
                {[
                  { key: 'auto', label: 'Auto' },
                  { key: 'sms',  label: '💬 SMS' },
                ].map(c => (
                  <button key={c.key} onClick={() => { setChatChannel(c.key); setInputMode('chat'); }} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 12, border: `1px solid ${chatChannel === c.key ? 'var(--accent)' : 'var(--border)'}`,
                    background: chatChannel === c.key ? 'rgba(45,212,191,0.12)' : 'transparent',
                    color: chatChannel === c.key ? 'var(--accent)' : 'var(--muted)',
                    cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
                  }}>{c.label}</button>
                ))}
              </div>

              <div className="border-t border-border p-4 flex-shrink-0" style={{ borderTop: 'none' }}>

                {/* ── MODO NOTA ── */}
                {inputMode === 'nota' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      rows={3}
                      value={quickNote}
                      onChange={e => setQuickNote(e.target.value)}
                      placeholder="Escribe una nota interna..."
                      style={{ width: '100%', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.30)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (quickNote.trim()) { agregarNota().then ? null : null; api.createNote(leadId, quickNote.trim()).then(n => { setNotes(p => [...p, n]); setQuickNote(''); }).catch(e => alert(e.message)); } } }}
                    />
                    <button
                      disabled={!quickNote.trim()}
                      onClick={() => {
                        if (!quickNote.trim()) return;
                        api.createNote(leadId, quickNote.trim())
                          .then(n => { setNotes(p => [...p, n]); setQuickNote(''); api.activity(leadId).then(setActivity).catch(() => {}); })
                          .catch(e => alert(e.message));
                      }}
                      style={{ alignSelf: 'flex-end', fontSize: 13, fontWeight: 600, padding: '7px 18px', borderRadius: 8, border: 'none', background: quickNote.trim() ? 'var(--accent)' : 'var(--border)', color: '#fff', cursor: quickNote.trim() ? 'pointer' : 'not-allowed' }}
                    >
                      Agregar nota
                    </button>
                  </div>
                )}

                {/* ── MODO TAREA ── */}
                {inputMode === 'tarea' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      className="input text-sm"
                      placeholder="Descripción de la tarea (ej: Follow up, recordar algo...)"
                      value={quickTask.title}
                      onChange={e => setQuickTask(p => ({ ...p, title: e.target.value }))}
                    />
                    {/* Quick date chips */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { label: 'Hoy', getDue: () => { const d = new Date(); d.setHours(9,0,0,0); return d.toISOString().slice(0,16); } },
                        { label: 'Mañana', getDue: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d.toISOString().slice(0,16); } },
                        { label: '+1 semana', getDue: () => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(9,0,0,0); return d.toISOString().slice(0,16); } },
                      ].map(chip => (
                        <button key={chip.label}
                          onClick={() => setQuickTask(p => ({ ...p, due_date: chip.getDue(), full_day: false }))}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', cursor: 'pointer' }}>
                          {chip.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Full day toggle */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
                        <div
                          onClick={() => setQuickTask(p => ({ ...p, full_day: !p.full_day, due_date: p.full_day ? p.due_date : p.due_date?.slice(0, 10) || '' }))}
                          style={{ width: 32, height: 18, borderRadius: 9, background: quickTask.full_day ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
                        >
                          <div style={{ position: 'absolute', top: 3, left: quickTask.full_day ? 16 : 3, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                        </div>
                        Todo el día
                      </label>
                      {/* Date/time picker */}
                      <input
                        type={quickTask.full_day ? 'date' : 'datetime-local'}
                        className="input text-sm"
                        style={{ flex: 1, minWidth: 160 }}
                        value={quickTask.due_date}
                        onChange={e => setQuickTask(p => ({ ...p, due_date: e.target.value }))}
                      />
                    </div>
                    {/* Assigned to */}
                    <select
                      className="input text-sm"
                      value={quickTask.assigned_to}
                      onChange={e => setQuickTask(p => ({ ...p, assigned_to: e.target.value }))}
                    >
                      <option value="">Asignar a... (yo por defecto)</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <button
                      disabled={!quickTask.title.trim() || savingQuickTask}
                      onClick={async () => {
                        if (!quickTask.title.trim() || savingQuickTask) return;
                        setSavingQuickTask(true);
                        try {
                          const dueDate = quickTask.due_date
                            ? (quickTask.full_day ? quickTask.due_date + 'T00:00:00' : quickTask.due_date)
                            : null;
                          const task = await api.createTask({
                            lead_id: leadId,
                            title: quickTask.title.trim(),
                            due_date: dueDate,
                            assigned_to: quickTask.assigned_to || undefined,
                          });
                          setTasks(p => [...p, task]);
                          setQuickTask({ title: '', due_date: '', full_day: false, assigned_to: '' });
                          api.activity(leadId).then(setActivity).catch(() => {});
                        } catch (e) { alert(e.message); }
                        finally { setSavingQuickTask(false); }
                      }}
                      style={{ alignSelf: 'flex-end', fontSize: 13, fontWeight: 600, padding: '7px 18px', borderRadius: 8, border: 'none', background: quickTask.title.trim() && !savingQuickTask ? 'var(--accent)' : 'var(--border)', color: '#fff', cursor: quickTask.title.trim() && !savingQuickTask ? 'pointer' : 'not-allowed' }}
                    >
                      {savingQuickTask ? 'Creando...' : '✓ Crear tarea'}
                    </button>
                  </div>
                )}

                {/* ── MODO EMAIL (estilo Kommo) ── */}
                {inputMode === 'email' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface2)' }}>

                    {/* ── Fila 1: Plantilla (siempre visible, como en Kommo) ── */}
                    <div style={{ borderBottom: '1px solid var(--border)', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, width: 52 }}>Plantilla:</span>
                        <input
                          value={emailRepliesFilter}
                          onChange={e => { setEmailRepliesFilter(e.target.value); setShowEmailReplies(true); }}
                          onFocus={() => setShowEmailReplies(true)}
                          placeholder="Buscar plantilla..."
                          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}
                        />
                        {emailRepliesFilter && (
                          <button onClick={() => { setEmailRepliesFilter(''); setShowEmailReplies(false); }}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                        )}
                      </div>
                      {/* Dropdown de resultados */}
                      {showEmailReplies && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                          background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none',
                          borderRadius: '0 0 8px 8px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                          maxHeight: 200, overflowY: 'auto' }}>
                          {quickReplies.length === 0 ? (
                            <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                              Sin plantillas — créalas en Configuración → Respuestas rápidas
                            </div>
                          ) : (() => {
                            const filtered = quickReplies.filter(r =>
                              !emailRepliesFilter || r.title.toLowerCase().includes(emailRepliesFilter.toLowerCase()) || r.text.toLowerCase().includes(emailRepliesFilter.toLowerCase())
                            );
                            if (filtered.length === 0) return (
                              <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Sin resultados</div>
                            );
                            return filtered.map(r => (
                              <button key={r.id}
                                onMouseDown={e => e.preventDefault()} // evita que el onBlur cierre antes del click
                                onClick={() => {
                                  let txt = r.text;
                                  const nombre   = lead?.contact_name || lead?.title || '';
                                  const telefono = lead?.contact_phone || '';
                                  const fecha    = tripInfo?.check_in ? new Date(tripInfo.check_in + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
                                  txt = txt.replace(/\{\{nombre\}\}/gi, nombre).replace(/\{\{telefono\}\}/gi, telefono).replace(/\{\{fecha\}\}/gi, fecha).replace(/\{\{checkin\}\}/gi, fecha);
                                  setEmailDraft(p => ({ ...p, body: txt, subject: p.subject || r.title }));
                                  setEmailRepliesFilter(r.title);
                                  setShowEmailReplies(false);
                                }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                                  background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                className="hover:bg-white/5 transition-colors">
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{r.text.slice(0, 75)}…</div>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>

                    {/* ── Fila 2: De ── */}
                    <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '7px 12px', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, width: 52 }}>De:</span>
                      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>info@energydepotpr.com</span>
                    </div>

                    {/* ── Fila 3: Para ── */}
                    <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '7px 12px', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, width: 52 }}>Para:</span>
                      <input value={emailDraft.to_email} onChange={e => setEmailDraft(p => ({ ...p, to_email: e.target.value }))}
                        placeholder="correo@cliente.com"
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }} />
                    </div>

                    {/* ── Fila 4: Asunto ── */}
                    <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '7px 12px', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, width: 52 }}>Asunto:</span>
                      <input value={emailDraft.subject} onChange={e => setEmailDraft(p => ({ ...p, subject: e.target.value }))}
                        placeholder="Escribe el asunto..."
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }} />
                    </div>

                    {/* ── Cuerpo ── */}
                    <textarea rows={4} value={emailDraft.body} onChange={e => setEmailDraft(p => ({ ...p, body: e.target.value }))}
                      placeholder="Escribe el cuerpo del correo..."
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                        padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }} />

                    {/* ── Footer: Enviar / Cancelar ── */}
                    <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', gap: 8, background: 'rgba(0,0,0,0.10)' }}>
                      <button
                        disabled={!emailDraft.to_email.trim() || !emailDraft.subject.trim() || !emailDraft.body.trim() || sendingEmail}
                        onClick={async () => {
                          if (sendingEmail) return;
                          setSendingEmail(true);
                          try {
                            const result = await api.sendEmail({
                              to_email: emailDraft.to_email.trim(),
                              subject: emailDraft.subject.trim(),
                              body: emailDraft.body.trim(),
                              lead_id: leadId,
                              contact_id: lead?.contact_id || undefined,
                              account: emailDraft.account,
                            });
                            setLeadEmails(p => [result.email, ...p]);
                            setEmailDraft(p => ({ ...p, subject: '', body: '' }));
                            setEmailRepliesFilter('');
                            if (!result.sent) alert('Email guardado pero no pudo enviarse (revisar credenciales SMTP).');
                          } catch (e) { alert('Error al enviar email: ' + e.message); }
                          finally { setSendingEmail(false); }
                        }}
                        style={{ fontSize: 13, fontWeight: 600, padding: '7px 20px', borderRadius: 8, border: 'none',
                          background: (!emailDraft.to_email.trim() || !emailDraft.subject.trim() || !emailDraft.body.trim() || sendingEmail) ? 'var(--border)' : 'var(--accent)',
                          color: '#fff', cursor: (!emailDraft.to_email.trim() || !emailDraft.subject.trim() || !emailDraft.body.trim() || sendingEmail) ? 'not-allowed' : 'pointer' }}
                      >
                        {sendingEmail ? 'Enviando...' : 'Enviar'}
                      </button>
                      <button onClick={() => { setEmailDraft(p => ({ ...p, subject: '', body: '' })); setEmailRepliesFilter(''); setShowEmailReplies(false); }}
                        style={{ fontSize: 13, padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* ── MODO CHAT (default) ── */}
                {inputMode === 'chat' && (<>
                {/* Follow-up date picker inline */}
                {showFollowUp && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, padding: '6px 8px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', flexShrink: 0 }}>📅 Recordatorio:</span>
                    <input
                      type="datetime-local"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, outline: 'none' }}
                    />
                    <button onClick={guardarFollowUp} disabled={!followUpDate || savingFollowUp}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!followUpDate || savingFollowUp) ? 0.5 : 1 }}>
                      Guardar
                    </button>
                    <button onClick={() => setShowFollowUp(false)} style={{ fontSize: 14, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </div>
                )}
                {lead?.follow_up_at && (
                  <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    📅 Recordatorio: {new Date(lead.follow_up_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    <button onClick={async () => { await api.setFollowUp(leadId, null); setLead(p => ({ ...p, follow_up_at: null })); }}
                      style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', marginLeft: 4 }}>✕ quitar</button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <button onClick={() => setShowReplies(p => !p)} title="Plantillas de respuesta"
                    className={`flex-shrink-0 self-end transition-colors`}
                    style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${showReplies ? 'var(--accent)' : 'var(--border)'}`, background: showReplies ? 'rgba(45,212,191,0.12)' : 'none', cursor: 'pointer', fontSize: 15, color: showReplies ? 'var(--accent)' : 'var(--muted)', lineHeight: 1 }}>
                    ⚡
                  </button>
                  <div className="flex-1 relative" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <textarea rows={2} value={chatText} onChange={e => { setChatText(e.target.value); setWasTranslated(false); }}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviarMensaje(); }}
                      placeholder="Escribe en español, usa 🌐 para traducir... (Ctrl+Enter)"
                      className="input resize-none w-full text-sm" style={{ position: 'relative' }} />
                    {wasTranslated && (
                      <span style={{ position: 'absolute', bottom: chatChannel === 'sms' ? 22 : 4, right: 8, fontSize: 10, color: '#10b981', pointerEvents: 'none' }}>Traducido ✓</span>
                    )}
                    {chatChannel === 'sms' && (
                      <div style={{ fontSize: 10, color: chatText.length > 160 ? 'var(--danger)' : 'var(--muted)', textAlign: 'right', lineHeight: 1 }}>
                        {chatText.length}/160{chatText.length > 160 ? ` · ${Math.ceil(chatText.length / 153)} SMS` : ''}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFollowUp(p => !p)}
                    title="Agregar recordatorio de seguimiento"
                    style={{ flexShrink: 0, alignSelf: 'flex-end', padding: '9px 10px', borderRadius: 8, border: `1px solid ${(showFollowUp || lead?.follow_up_at) ? '#f59e0b' : 'var(--border)'}`, background: (showFollowUp || lead?.follow_up_at) ? 'rgba(245,158,11,0.12)' : 'none', cursor: 'pointer', fontSize: 13 }}
                  >
                    📅
                  </button>
                  <button
                    onClick={traducirChat}
                    disabled={translating || !chatText.trim()}
                    title="Traducir al inglés"
                    style={{ flexShrink: 0, alignSelf: 'flex-end', padding: '9px 10px', borderRadius: 8, border: `1px solid ${wasTranslated ? '#10b981' : 'var(--border)'}`, background: wasTranslated ? 'rgba(16,185,129,0.12)' : 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: wasTranslated ? '#10b981' : 'var(--muted)', opacity: (!chatText.trim() || translating) ? 0.5 : 1 }}
                  >
                    {translating
                      ? <span style={{ width: 12, height: 12, border: '1.5px solid var(--muted)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                      : '🌐'
                    }
                  </button>
                  <button onClick={enviarMensaje} disabled={sending || !chatText.trim()}
                    className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50 self-end">
                    {sending ? <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin block" /> : 'Enviar'}
                  </button>
                </div>
                </>)}
              </div>
              </div>{/* /relative wrapper */}
            </div>
          )}

          {/* NOTAS */}
          {tab === 'notas' && (
            <div className="p-4 space-y-3">
              {notes.length === 0 && <p className="text-muted text-sm text-center py-6">Sin notas</p>}
              {notes.map(n => (
                <div key={n.id} className="bg-bg border border-border rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap flex-1">{n.text}</p>
                    <button onClick={() => eliminarNota(n.id)} className="text-muted hover:text-danger transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-[10px] text-muted mt-2">{n.user_name} · {tiempoRelativo(n.created_at, lang)}</div>
                </div>
              ))}
              <div className="border-t border-border pt-3">
                <textarea rows={3} value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Agregar nota interna..." className="input resize-none text-sm mb-2" />
                <button onClick={agregarNota} disabled={!newNote.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  Agregar nota
                </button>
              </div>
            </div>
          )}

          {/* TAREAS */}
          {tab === 'tareas' && (
            <div className="p-4 space-y-2">
              {tasks.length === 0 && <p className="text-muted text-sm text-center py-6">Sin tareas</p>}
              {tasks.map(t => (
                <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 bg-bg border border-border rounded-lg ${t.completed ? 'opacity-50' : ''}`}>
                  <button onClick={() => completarTarea(t.id, !t.completed)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      t.completed ? 'border-success bg-success' : 'border-border hover:border-success'
                    }`}>
                    {t.completed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.completed ? 'line-through text-muted' : 'text-white'}`}>{t.title}</div>
                    {t.due_date && (
                      <div className={`text-xs mt-0.5 ${new Date(t.due_date) < new Date() && !t.completed ? 'text-danger' : 'text-muted'}`}>
                        {new Date(t.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-2">
                <input className="input text-sm" placeholder="Nueva tarea..." value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))} />
                <input type="datetime-local" className="input text-sm" value={newTask.due_date} onChange={e => setNewTask(f => ({ ...f, due_date: e.target.value }))} />
                <button onClick={crearTarea} disabled={!newTask.title.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  Crear tarea
                </button>
              </div>
            </div>
          )}

          {/* ACTIVIDAD */}
          {tab === 'actividad' && (
            <div className="p-4 space-y-2">
              {activity.length === 0 && <p className="text-muted text-sm text-center py-6">Sin actividad registrada</p>}
              {activity.map(a => {
                const tipo = ACTIVITY_LABELS[a.action] || { icon: '•', label: a.action };
                return (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm flex-shrink-0 mt-0.5">{tipo.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-white">{tipo.label}</span>
                      {a.detail && <span className="text-xs text-muted ml-1">"{a.detail}"</span>}
                      <div className="text-[10px] text-muted mt-0.5">{a.user_name} · {tiempoRelativo(a.created_at, lang)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAGS */}
          {tab === 'tags' && (
            <div className="p-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.length === 0 && <p className="text-muted text-sm">Sin tags</p>}
                {tags.map(t => (
                  <span key={t.tag} className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full"
                    style={{ backgroundColor: `${t.color}20`, color: t.color, border: `1px solid ${t.color}30` }}>
                    {t.tag}
                    <button onClick={() => eliminarTag(t.tag)} className="opacity-60 hover:opacity-100">×</button>
                  </span>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <input className="input text-sm" placeholder="Nuevo tag..." value={newTag} onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && agregarTag()} />
                <div className="flex gap-1.5 flex-wrap">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setNewTagColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${newTagColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-surface scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button onClick={agregarTag} disabled={!newTag.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                  Agregar tag
                </button>
              </div>
            </div>
          )}

          {/* LLAMADAS */}
          {tab === 'llamadas' && (
            <LlamadasTab
              lead={lead}
              leadId={leadId}
              callLogs={callLogs}
              setCallLogs={setCallLogs}
              callStatus={callStatus}
              setCallStatus={setCallStatus}
              callTimer={callTimer}
              setCallTimer={setCallTimer}
              activeCall={activeCall}
              setActiveCall={setActiveCall}
              logId={logId}
              setLogId={setLogId}
              callDevice={callDevice}
              setCallDevice={setCallDevice}
              callIntervalRef={callIntervalRef}
            />
          )}

          {/* VIAJE - Trip Info */}
          {tab === 'viaje' && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Airbnb / Hotel</label>
                  <input className="input text-sm" placeholder="Nombre del lugar" value={tripInfo.hotel_airbnb || ''} onChange={e => { setTripInfo(t => ({...t, hotel_airbnb: e.target.value})); setTripDirty(true); }} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Host</label>
                  <input className="input text-sm" placeholder="Nombre del host" value={tripInfo.host_nombre || ''} onChange={e => { setTripInfo(t => ({...t, host_nombre: e.target.value})); setTripDirty(true); }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Check in</label>
                  <input type="date" className="input text-sm" value={tripInfo.check_in ? tripInfo.check_in.slice(0,10) : ''} onChange={e => { setTripInfo(t => ({...t, check_in: e.target.value})); setTripDirty(true); }} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Check out</label>
                  <input type="date" className="input text-sm" value={tripInfo.check_out ? tripInfo.check_out.slice(0,10) : ''} onChange={e => { setTripInfo(t => ({...t, check_out: e.target.value})); setTripDirty(true); }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Personas</label>
                  <input type="number" className="input text-sm" placeholder="0" min="1" value={tripInfo.cantidad_personas || ''} onChange={e => { setTripInfo(t => ({...t, cantidad_personas: e.target.value})); setTripDirty(true); }} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Niños</label>
                  <input type="number" className="input text-sm" placeholder="0" min="0" value={tripInfo.ninos || ''} onChange={e => { setTripInfo(t => ({...t, ninos: e.target.value})); setTripDirty(true); }} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Edades</label>
                  <input className="input text-sm" placeholder="35,38,8" value={tripInfo.edades || ''} onChange={e => { setTripInfo(t => ({...t, edades: e.target.value})); setTripDirty(true); }} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Intereses</label>
                <input className="input text-sm" placeholder="museos, gastronomía, aventura..." value={tripInfo.intereses || ''} onChange={e => { setTripInfo(t => ({...t, intereses: e.target.value})); setTripDirty(true); }} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Notas especiales</label>
                <textarea rows={3} className="input resize-none text-sm" placeholder="ej: cliente en silla de ruedas, alergias..." value={tripInfo.notas_especiales || ''} onChange={e => { setTripInfo(t => ({...t, notas_especiales: e.target.value})); setTripDirty(true); }} />
              </div>
              <button
                onClick={async () => {
                  setSavingTrip(true);
                  try {
                    await api.saveTripInfo(leadId, tripInfo);
                    setTripDirty(false);
                    onUpdated?.();
                  } catch (e) { alert(e.message); }
                  setSavingTrip(false);
                }}
                disabled={!tripDirty || savingTrip}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {savingTrip ? 'Guardando...' : 'Guardar info viaje'}
              </button>
            </div>
          )}

          {/* FACTURA */}
          {tab === 'factura' && (
            <div className="p-4 space-y-4">
              {invoiceLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32, color: 'var(--muted)', gap: 8 }}>
                  <div style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  Cargando...
                </div>
              ) : leadInvoice ? (
                <div>
                  {/* Invoice card */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{leadInvoice.invoice_number}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: leadInvoice.status === 'paid' ? 'rgba(16,185,129,0.15)' : leadInvoice.status === 'sent' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                        color: leadInvoice.status === 'paid' ? '#10b981' : leadInvoice.status === 'sent' ? '#1b9af5' : '#f59e0b',
                      }}>
                        {leadInvoice.status === 'paid' ? '✓ Pagada' : leadInvoice.status === 'sent' ? '📤 Enviada' : '📋 Borrador'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{leadInvoice.client_name}</div>
                    {leadInvoice.service_date && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        📅 {new Date(leadInvoice.service_date).toLocaleDateString('es-PR')}
                      </div>
                    )}
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#00c9a7', marginTop: 8 }}>
                      ${Number(leadInvoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    {leadInvoice.payment_link && (
                      <a href={leadInvoice.payment_link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#1b9af5', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.25)' }}>
                        💳 Link de pago
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        setInvoiceGenerating(true);
                        try {
                          const r = await api.invoiceFromLead(leadId);
                          setLeadInvoice(r.data);
                          alert('Factura actualizada con los datos más recientes del lead.');
                        } catch (e) { alert(e.message); }
                        setInvoiceGenerating(false);
                      }}
                      disabled={invoiceGenerating}
                      style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#1b9af5', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {invoiceGenerating ? <span style={{ width: 10, height: 10, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> : '🔄'}
                      Actualizar factura
                    </button>
                    <a href="/facturas" style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#00c9a7', textDecoration: 'none', fontWeight: 600 }}>
                      🧾 Ver en Facturas
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                  <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>🧾</div>
                  <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
                    Este lead no tiene una factura generada aún.
                  </p>
                  <button
                    onClick={async () => {
                      setInvoiceGenerating(true);
                      try {
                        const r = await api.invoiceFromLead(leadId);
                        setLeadInvoice(r.data);
                      } catch (e) { alert(e.message); }
                      setInvoiceGenerating(false);
                    }}
                    disabled={invoiceGenerating}
                    style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, color: '#fff', cursor: invoiceGenerating ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: invoiceGenerating ? 0.7 : 1 }}
                  >
                    {invoiceGenerating ? <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> : '🧾'}
                    {invoiceGenerating ? 'Generando...' : 'Generar Factura'}
                  </button>
                  <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 10 }}>
                    Se usarán los datos del lead: cliente, check-in, valor total.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CONTACTOS - Extra Contacts */}
          {tab === 'contactos' && (
            <div className="p-4 space-y-3">
              {lead.contact_name && (
                <div className="bg-bg border border-border rounded-lg px-4 py-3">
                  <div className="text-[10px] text-muted uppercase tracking-wide mb-1">Contacto principal</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{lead.contact_name}</div>
                  {lead.contact_phone && <div className="text-xs text-muted mt-0.5">{lead.contact_phone}</div>}
                </div>
              )}
              {leadContacts.length === 0 && !lead.contact_name && <p className="text-muted text-sm text-center py-4">Sin contactos</p>}
              {leadContacts.map(lc => (
                <div key={lc.id} className="flex items-center gap-3 bg-bg border border-border rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{lc.nombre}</div>
                    {lc.telefono && <div className="text-xs text-muted mt-0.5">{lc.telefono}</div>}
                  </div>
                  <button
                    onClick={async () => {
                      await api.removeLeadContact(leadId, lc.id).catch(e => alert(e.message));
                      setLeadContacts(prev => prev.filter(c => c.id !== lc.id));
                    }}
                    className="text-muted hover:text-danger transition-colors flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="text-xs text-muted font-medium">Agregar contacto adicional</div>
                <input className="input text-sm" placeholder="Nombre" value={newContact.nombre} onChange={e => setNewContact(f => ({...f, nombre: e.target.value}))} />
                <input className="input text-sm" placeholder="Teléfono" value={newContact.telefono} onChange={e => setNewContact(f => ({...f, telefono: e.target.value}))} />
                <button
                  onClick={async () => {
                    if (!newContact.nombre.trim()) return;
                    try {
                      const lc = await api.addLeadContact(leadId, newContact);
                      setLeadContacts(prev => [...prev, lc]);
                      setNewContact({ nombre: '', telefono: '' });
                    } catch (e) { alert(e.message); }
                  }}
                  disabled={!newContact.nombre.trim()}
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  Agregar contacto
                </button>
              </div>
            </div>
          )}

          {/* NOTAS INTERNAS - Team Only */}
          {tab === 'notas-int' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header warning */}
              <div style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Notas internas del equipo — no visibles para el cliente
              </div>

              {/* Notes list */}
              {internalNotes.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sin notas internas</p>
              )}
              {internalNotes.map(n => {
                const isOwn = currentUser && (n.user_id === currentUser.id || n.user_name === currentUser.name);
                const isAdmin = currentUser?.role === 'admin';
                return (
                  <div key={n.id} style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ color: 'var(--text)', fontSize: 13, whiteSpace: 'pre-wrap', flex: 1, margin: 0, lineHeight: 1.5 }}>{n.content}</p>
                      {(isOwn || isAdmin) && (
                        <button
                          onClick={async () => {
                            try {
                              await api.deleteInternalNote(leadId, n.id);
                              setInternalNotes(prev => prev.filter(x => x.id !== n.id));
                            } catch (e) { alert(e.message); }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0, lineHeight: 1 }}
                          title="Eliminar nota"
                        >
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                      {n.user_name} · {tiempoRelativo(n.created_at, lang)}
                    </div>
                  </div>
                );
              })}

              {/* Add note input */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  rows={3}
                  value={newInternalNote}
                  onChange={e => setNewInternalNote(e.target.value)}
                  placeholder="Agregar nota interna del equipo..."
                  style={{
                    width: '100%',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--text)',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={async () => {
                    if (!newInternalNote.trim()) return;
                    try {
                      const nota = await api.addInternalNote(leadId, newInternalNote.trim());
                      setInternalNotes(prev => [nota, ...prev]);
                      setNewInternalNote('');
                    } catch (e) { alert(e.message); }
                  }}
                  disabled={!newInternalNote.trim()}
                  style={{
                    background: '#1b9af5',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: !newInternalNote.trim() ? 'not-allowed' : 'pointer',
                    opacity: !newInternalNote.trim() ? 0.5 : 1,
                    alignSelf: 'flex-start',
                  }}
                >
                  Agregar nota interna
                </button>
              </div>
            </div>
          )}

          {/* AI ASSISTANT */}
          {tab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              {/* Context banner */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,0.06)', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#1b9af5', fontWeight: 600, marginBottom: 4 }}>Contexto del cliente cargado</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  {lead.contact_name && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cliente: <span style={{ color: 'var(--text)' }}>{lead.contact_name}</span></span>
                  )}
                  {(lead.check_in || lead.tripInfo?.check_in) && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Check-in: <span style={{ color: 'var(--text)' }}>{lead.check_in}</span></span>
                  )}
                  {lead.intereses && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Intereses: <span style={{ color: 'var(--text)' }}>{lead.intereses}</span></span>
                  )}
                  {lead.stage_name && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Etapa: <span style={{ color: 'var(--text)' }}>{lead.stage_name}</span></span>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {aiMessages.length === 0 && (
                  <div style={{ textAlign: 'center', paddingTop: 24 }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
                    <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Asistente de Ventas IA</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                      Tengo acceso al historial completo de este cliente. Pregúntame lo que necesitas.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16, alignItems: 'center' }}>
                      {['¿Qué le recomiendo a este cliente?', '¿Cómo cierro esta venta?', '¿Cuál es el próximo paso?'].map(q => (
                        <button key={q} onClick={() => setAiInput(q)}
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {aiMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, paddingLeft: 4 }}>🤖 Asistente IA</div>
                    )}
                    <div style={{
                      maxWidth: '85%',
                      background: msg.role === 'user' ? 'rgba(59,130,246,0.18)' : 'var(--bg)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '10px 14px',
                    }}>
                      <div style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                    <div style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                    Pensando...
                  </div>
                )}
                <div ref={aiBottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: 'var(--surface)' }}>
                <textarea
                  rows={2}
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (!aiInput.trim() || aiLoading) return;
                      const msg = aiInput.trim();
                      setAiInput('');
                      setAiMessages(prev => [...prev, { role: 'user', content: msg }]);
                      setAiLoading(true);
                      try {
                        const data = await api.leadAiChat(leadId, msg);
                        setAiMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
                      } catch (e) {
                        setAiMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + e.message }]);
                      } finally {
                        setAiLoading(false);
                        setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                      }
                    }
                  }}
                  placeholder="Pregunta al asistente... (Ctrl+Enter para enviar)"
                  style={{
                    flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)',
                    outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                  }}
                />
                <button
                  onClick={async () => {
                    if (!aiInput.trim() || aiLoading) return;
                    const msg = aiInput.trim();
                    setAiInput('');
                    setAiMessages(prev => [...prev, { role: 'user', content: msg }]);
                    setAiLoading(true);
                    try {
                      const data = await api.leadAiChat(leadId, msg);
                      setAiMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
                    } catch (e) {
                      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + e.message }]);
                    } finally {
                      setAiLoading(false);
                      setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    }
                  }}
                  disabled={!aiInput.trim() || aiLoading}
                  style={{
                    background: '#1b9af5', border: 'none', borderRadius: 8, padding: '8px 14px',
                    color: '#fff', fontSize: 13, fontWeight: 600, cursor: (!aiInput.trim() || aiLoading) ? 'not-allowed' : 'pointer',
                    opacity: (!aiInput.trim() || aiLoading) ? 0.5 : 1, flexShrink: 0, alignSelf: 'flex-end',
                  }}
                >
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* EXTRA - Custom Fields */}
          {tab === 'extra' && (
            <div className="p-4 space-y-4">
              {customFields.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted text-sm">Sin campos personalizados configurados.</p>
                  <p className="text-xs text-muted mt-1">Ve a Ajustes → Campos personalizados para crear campos para leads.</p>
                </div>
              )}
              {customFields.length > 0 && (
                <>
                  <div className="space-y-3">
                    {customFields.map(field => (
                      <div key={field.id}>
                        <label className="block text-xs text-muted mb-1">{field.field_label}</label>
                        {field.field_type === 'select' ? (
                          <select
                            className="input text-sm"
                            value={customValues[field.id] ?? ''}
                            onChange={e => setCustomValues(v => ({ ...v, [field.id]: e.target.value }))}
                          >
                            <option value="">— Seleccionar —</option>
                            {(field.options || []).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input text-sm"
                            type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                            value={customValues[field.id] ?? ''}
                            onChange={e => setCustomValues(v => ({ ...v, [field.id]: e.target.value }))}
                            placeholder={field.field_label}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      setSavingExtra(true);
                      try {
                        await api.saveCustomValues('lead', leadId, customValues);
                      } catch (e) { alert(e.message); }
                      setSavingExtra(false);
                    }}
                    disabled={savingExtra}
                    className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {savingExtra ? 'Guardando...' : 'Guardar campos'}
                  </button>
                </>
              )}
            </div>
          )}
          {/* ─── TAB: COTIZAR ─── */}
          {tab === 'cotizar' && <CotizarTab lead={lead} leadId={leadId} isMobile={isMobile} onLeadUpdate={() => api.lead(leadId).then(setLead).catch(()=>{})} />}

        </div>{/* end Content */}
        </div>{/* end RIGHT Chat */}
        </div>{/* end body flex-row */}

      </div>
    </div>
  );
}

// ─── Cotizar Tab ──────────────────────────────────────────────────────────────
const MESES_L_DEFAULT = ['Mes 1','Mes 2','Mes 3','Mes 4','Mes 5','Mes 6','Mes 7','Mes 8','Mes 9','Mes 10','Mes 11','Mes 12','Mes 13'];
const MESES_LEN = 13;
const cotFmt  = n => `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const cotFmtK = n => Number(n).toLocaleString('en-US');

function cotCalc(meses, batPrecio, pricing = DEFAULT_PRICING, descuentoPct = 0) {
  const { panelPrice, panelWatts, tarifaLuma, factorProduccion, pmt15 } = pricing;
  // Si hay 13 meses, usa los últimos 12 (excluye el más antiguo)
  const last12 = meses.length > 12 ? meses.slice(-12) : meses;
  const filled = last12.map(Number).filter(v=>v>0);
  if (!filled.length) return null;
  const avg=filled.reduce((a,b)=>a+b,0)/filled.length, annCons=Math.round(avg*12);
  let panels=Math.round(annCons*1.07/factorProduccion*1000/panelWatts);
  if (panels % 2 !== 0) panels += 1; // siempre par
  const kw=parseFloat((panels*panelWatts/1000).toFixed(2));
  const annProd=Math.round(kw*factorProduccion);
  // costBase = sistema FV completo (NO se descuenta). El descuento es una línea aparte.
  const costBase=Math.round(panels*panelPrice);
  const subPreDescuento=costBase+batPrecio;
  const dPct = Math.max(0, Math.min(100, Number(descuentoPct) || 0));
  const descuentoAmt = Math.round(subPreDescuento * (dPct / 100));
  const sub = subPreDescuento - descuentoAmt; // total final con descuento aplicado
  const pagoLuma=Math.round(avg*tarifaLuma);
  const offset=annCons>0?Math.round(annProd/annCons*100):0;
  return { avg:Math.round(avg), annCons, panels, kw, annProd, costBase, sub, subPreDescuento, descuentoPct: dPct, descuentoAmt, pagoLuma, annSav:pagoLuma*12, roi:pagoLuma*12>0?Math.round(costBase/(pagoLuma*12)):0, offset, pagoFV:Math.round(costBase*pmt15), pagoBat:Math.round(sub*pmt15) };
}

function CotizarTab({ lead, leadId, onLeadUpdate, isMobile = false }) {
  const sd = lead?.solar_data || {};
  const [BATERIAS_COT, setBateriasList] = useState(DEFAULT_BATERIAS);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  useEffect(() => {
    loadBaterias().then(b => setBateriasList(b.filter(x => x.active !== false)));
    loadPricing().then(setPricing);
  }, []);

  // ── Multi-cotizaciones ──────────────────────────────────────────────────────
  const initQuotations = () => {
    if (Array.isArray(sd.quotations) && sd.quotations.length > 0) {
      return sd.quotations.map(q => ({
        id: q.id || ('q'+Math.random().toString(36).slice(2,9)),
        name: q.name || 'Cotización',
        createdAt: q.createdAt || new Date().toISOString(),
        meses: Array.isArray(q.meses) ? Array(MESES_LEN).fill('').map((_,i)=>q.meses[i]||'') : Array(MESES_LEN).fill(''),
        mesLabels: Array.isArray(q.mesLabels) && q.mesLabels.length >= 12 ? q.mesLabels : null,
        batteries: Array.isArray(q.batteries) ? q.batteries : [],
        descuentoPct: Number(q.descuentoPct) || 0,
      }));
    }
    // Migración: legacy fields → 1 cotización
    if (sd.meses || sd.batteries || sd.calc) {
      return [{
        id: 'q'+Math.random().toString(36).slice(2,9),
        name: 'Cotización 1',
        createdAt: new Date().toISOString(),
        meses: Array(MESES_LEN).fill('').map((_,i)=>(sd.meses||[])[i]||''),
        batteries: Array.isArray(sd.batteries) ? sd.batteries : [],
      }];
    }
    return [{
      id: 'q'+Math.random().toString(36).slice(2,9),
      name: 'Cotización 1',
      createdAt: new Date().toISOString(),
      meses: Array(MESES_LEN).fill(''),
      batteries: [],
    }];
  };
  const [quotations, setQuotations] = useState(initQuotations);
  const [activeId, setActiveId] = useState(() => {
    const qs = initQuotations();
    return (sd.activeQuotationId && qs.find(q=>q.id===sd.activeQuotationId)) ? sd.activeQuotationId : qs[0]?.id;
  });
  const active = quotations.find(q => q.id === activeId) || quotations[0];
  const meses = active?.meses || Array(MESES_LEN).fill('');
  const mesLabels = (active?.mesLabels && active.mesLabels.length >= 12) ? active.mesLabels : MESES_L_DEFAULT;
  const setMesLabel = (i, v) => updateActive({ mesLabels: mesLabels.map((x,j) => j===i ? v : x) });
  const batQty = (() => {
    const arr = Array(BATERIAS_COT.length).fill(0);
    (active?.batteries||[]).forEach(b => { const i = BATERIAS_COT.findIndex(x => x.name === b.name); if (i>=0) arr[i] = b.qty || 0; });
    return arr;
  })();
  // Solo cuenta baterías cuyo nombre exista en el catálogo actual (ignora "fantasma" de catálogos viejos)
  const batTotal = (active?.batteries||[])
    .filter(b => BATERIAS_COT.some(c => c.name === b.name))
    .reduce((s,b)=>s+(b.qty||0)*(b.unitPrice||0),0);

  const updateActive = (patch) => setQuotations(prev => prev.map(q => q.id === activeId ? { ...q, ...patch } : q));
  const setMeses = (newM) => updateActive({ meses: typeof newM === 'function' ? newM(meses) : newM });
  const setQ = (i, delta) => {
    const battName = BATERIAS_COT[i].name;
    const battPrice = BATERIAS_COT[i].precio;
    const cur = active?.batteries || [];
    const found = cur.find(b => b.name === battName);
    const newQty = Math.max(0, (found?.qty || 0) + delta);
    let newBatts;
    if (newQty === 0) newBatts = cur.filter(b => b.name !== battName);
    else if (found) newBatts = cur.map(b => b.name === battName ? { ...b, qty: newQty } : b);
    else newBatts = [...cur, { name: battName, qty: newQty, unitPrice: battPrice, description: BATERIAS_COT[i]?.description || '' }];
    updateActive({ batteries: newBatts });
  };
  const newQuotation = () => {
    const id = 'q'+Math.random().toString(36).slice(2,9);
    // Hereda meses de la cotización activa (consumo es del lead, no de la cotización)
    const inheritedMeses = (active?.meses && active.meses.some(v => v)) ? [...active.meses] : Array(MESES_LEN).fill('');
    const inheritedLabels = (active?.mesLabels && active.mesLabels.length >= 12) ? [...active.mesLabels] : [...MESES_L_DEFAULT];
    setQuotations(prev => [...prev, { id, name: `Cotización ${prev.length+1}`, createdAt: new Date().toISOString(), meses: inheritedMeses, mesLabels: inheritedLabels, batteries: [] }]);
    setActiveId(id);
  };
  const deleteQuotation = (id) => {
    if (quotations.length <= 1) { showMsg('Debe quedar al menos una'); return; }
    if (!confirm('¿Eliminar esta cotización?')) return;
    const next = quotations.filter(q => q.id !== id);
    setQuotations(next);
    if (activeId === id) setActiveId(next[0].id);
  };
  const renameActive = (newName) => updateActive({ name: newName });

  const [calc, setCalc] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [pdfLoad, setPdfLoad]     = useState(false);
  const [contratoLoad, setContratoLoad] = useState(false);
  const [showContrato, setShowContrato] = useState(false);
  const [modalidad, setModalidad] = useState('efectivo');
  const [prontoDado, setProntoDado] = useState('');
  const [msg, setMsg]             = useState('');

  const [extractingFactura, setExtractingFactura] = useState(false);
  const onSubirFactura = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setExtractingFactura(true);
    try {
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result || ''); const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s); };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      const data = await api.extractFactura(leadId, { name: f.name, mimeType: f.type || 'application/pdf', content: b64 });
      const newMeses = (data.meses || []).map(v => v ? String(v) : '');
      while (newMeses.length < 12) newMeses.push('');
      const patch = { meses: newMeses.slice(0, 12) };
      if (data.labels && Array.isArray(data.labels) && data.labels.length >= 12) patch.mesLabels = data.labels;
      updateActive(patch);

      // Auto-llenar info del cliente si la factura la trae
      const updates = {};
      if (data.nombre && (!lead.contact_name || lead.contact_name.length < 3)) updates.name = data.nombre;
      if (data.email && !lead.contact_email) updates.email = data.email;
      if (data.telefono && !lead.contact_phone) updates.phone = data.telefono;
      if (data.direccion) {
        const newSd = { ...(lead.solar_data || {}), address: data.direccion };
        if (data.cuenta_luma) newSd.cuenta_luma = data.cuenta_luma;
        try { await api.saveSolarData(leadId, { solar_data: newSd }); } catch {}
      }
      if (Object.keys(updates).length && lead.contact_id) {
        try { await api.updateContact(lead.contact_id, updates); } catch {}
      }
      if (onLeadUpdate) onLeadUpdate();

      const extras = [];
      if (data.nombre) extras.push(`Cliente: ${data.nombre}`);
      if (data.email) extras.push(`Email: ${data.email}`);
      if (data.telefono) extras.push(`Tel: ${data.telefono}`);
      if (data.direccion) extras.push('Dirección guardada');
      if (data.cuenta_luma) extras.push(`Cuenta LUMA: ${data.cuenta_luma}`);
      const summary = extras.length ? ` (${extras.join(' · ')})` : '';
      showMsg('✓ Datos extraídos' + summary + (data.notes ? ` — ${data.notes}` : ''));
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setExtractingFactura(false);
  };

  const descuentoPct = Number(active?.descuentoPct) || 0;
  const setDescuentoPct = (v) => updateActive({ descuentoPct: v === '' ? 0 : Math.max(0, Math.min(100, Number(v) || 0)) });
  useEffect(() => { setCalc(cotCalc(meses, batTotal, pricing, descuentoPct)); }, [meses, batTotal, pricing, descuentoPct]);

  const showMsg = t => { setMsg(t); setTimeout(()=>setMsg(''),3000); };

  const guardar = async () => {
    if (!calc) return;
    setSaving(true);
    try {
      // Limpia baterías que ya no están en el catálogo
      const battActive = (active?.batteries || []).filter(b => BATERIAS_COT.some(c => c.name === b.name));
      const cleanedQuotations = quotations.map(q => ({
        ...q,
        batteries: (q.batteries || []).filter(b => BATERIAS_COT.some(c => c.name === b.name)),
      }));
      // Mirror active al solar_data legacy para que el PDF (publicLeadController) siga funcionando
      await api.saveSolarData(leadId, {
        solar_data: { ...sd,
          meses,
          batteries: battActive,
          calc: { avg:calc.avg, systemKw:calc.kw, panels:calc.panels, costBase:calc.costBase, annualSavings:calc.annSav, roi:calc.roi, annProd:calc.annProd, annCons:calc.annCons },
          pagoLuz: calc.pagoLuma,
          quotations: cleanedQuotations,
          activeQuotationId: activeId,
        },
        value: calc.costBase,
      });
      showMsg('✓ Guardado');
      if (onLeadUpdate) onLeadUpdate();
    } catch(e) { showMsg('Error: '+e.message); }
    finally { setSaving(false); }
  };

  const generarContrato = async () => {
    setContratoLoad(true);
    try {
      await guardar();
      const data = await api.generarContrato(leadId, { modalidad, prontoDado: Number(prontoDado)||0 });
      if (!data.pdf) throw new Error('Sin PDF');
      const bytes = Uint8Array.from(atob(data.pdf), c=>c.charCodeAt(0));
      const blob  = new Blob([bytes],{type:'application/pdf'});
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a'); a.href=url; a.download=data.filename||`Contrato-${leadId}.pdf`; a.click();
      URL.revokeObjectURL(url);
      setShowContrato(false);
      showMsg('✓ Contrato generado y guardado');
    } catch(e) { showMsg('Error: '+e.message); }
    finally { setContratoLoad(false); }
  };

  const generarPDF = async () => {
    setPdfLoad(true);
    try {
      await guardar();
      const data = await api.leadPropuesta(leadId);
      if (!data.pdf) throw new Error('Sin PDF');
      const bytes=Uint8Array.from(atob(data.pdf),c=>c.charCodeAt(0));
      const blob=new Blob([bytes],{type:'application/pdf'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=data.filename||`Propuesta-${leadId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch(e) { showMsg('Error PDF: '+e.message); }
    finally { setPdfLoad(false); }
  };

  const inp = { width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:5, padding:'6px 8px', fontSize:12, color:'var(--text)', outline:'none', boxSizing:'border-box', textAlign:'center' };

  return (
    <div style={{ padding: isMobile ? 14 : 16, display:'flex', flexDirection:'column', gap: isMobile ? 18 : 14, paddingBottom: isMobile ? 28 : 16 }}>
      {/* Tabs de cotizaciones */}
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', borderBottom:'1px solid var(--border)', paddingBottom:10, overflowX: isMobile ? 'auto' : undefined }}>
        {quotations.map(q => (
          <button key={q.id} onClick={()=>setActiveId(q.id)} style={{
            background: q.id===activeId ? '#1a3c8f' : 'var(--bg)',
            color: q.id===activeId ? '#fff' : 'var(--muted)',
            border: q.id===activeId ? '1px solid #1a3c8f' : '1px solid var(--border)',
            borderRadius:16, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
          }}>{q.name}{q.id===activeId && quotations.length>1 ? ' ✓' : ''}</button>
        ))}
        <button onClick={newQuotation} style={{
          background:'var(--bg)', color:'#1a3c8f', border:'1px dashed #1a3c8f',
          borderRadius:16, padding:'5px 12px', fontSize:12, fontWeight:700, cursor:'pointer',
        }}>+ Nueva</button>
      </div>

      {/* Header de la cotización activa */}
      {active && (
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input
            value={active.name}
            onChange={e=>renameActive(e.target.value)}
            style={{ flex:1, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', fontSize:13, fontWeight:600, color:'var(--text)', outline:'none' }}
            placeholder="Nombre de la cotización"
          />
          {quotations.length>1 && (
            <button onClick={()=>deleteQuotation(active.id)} title="Eliminar esta cotización" style={{
              background:'transparent', border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px',
              fontSize:13, color:'#ef4444', cursor:'pointer',
            }}>🗑</button>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap: isMobile ? 8 : 8, alignItems:'center', flexWrap:'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
        {msg && <span style={{ fontSize: isMobile ? 13 : 12, color: msg.startsWith('✓')?'#10b981':'#ef4444', fontWeight:600, alignSelf: isMobile ? 'flex-start' : 'auto' }}>{msg}</span>}
        {!isMobile && <div style={{ flex:1 }} />}
        <button onClick={guardar} disabled={saving||!calc} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius: isMobile ? 10 : 6, padding: isMobile ? '12px 14px' : '6px 14px', fontSize: isMobile ? 14 : 12, fontWeight:600, color:'var(--text)', cursor:'pointer', opacity:!calc||saving?0.5:1, width: isMobile ? '100%' : 'auto' }}>
          {saving?'Guardando…':'Guardar Cotización'}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--surface)', border:'1px solid var(--border)', borderRadius: isMobile ? 10 : 6, padding: isMobile ? '6px 10px' : '4px 10px', width: isMobile ? '100%' : 'auto' }}>
          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>Descuento</span>
          <input
            type="number" min="0" max="100" step="0.5"
            value={descuentoPct || ''}
            onChange={e => setDescuentoPct(e.target.value)}
            placeholder="0"
            style={{ width: 50, background:'transparent', border:'none', outline:'none', fontSize: isMobile ? 14 : 13, fontWeight:700, color:'#1a3c8f', textAlign:'right' }} />
          <span style={{ fontSize:13, color:'#1a3c8f', fontWeight:700 }}>%</span>
        </div>
        <button onClick={generarPDF} disabled={!calc||pdfLoad} style={{ background:'#1a3c8f', border:'none', borderRadius: isMobile ? 10 : 6, padding: isMobile ? '12px 14px' : '6px 14px', fontSize: isMobile ? 14 : 12, fontWeight:700, color:'#fff', cursor:calc?'pointer':'default', opacity:!calc||pdfLoad?0.5:1, display:'flex', alignItems:'center', justifyContent: 'center', gap:6, width: isMobile ? '100%' : 'auto' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          {pdfLoad?'Generando…':'Propuesta PDF'}
        </button>
        <button onClick={()=>setShowContrato(true)} disabled={!calc} style={{ background:'#10b981', border:'none', borderRadius: isMobile ? 10 : 6, padding: isMobile ? '12px 14px' : '6px 14px', fontSize: isMobile ? 14 : 12, fontWeight:700, color:'#fff', cursor:calc?'pointer':'default', opacity:!calc?0.5:1, display:'flex', alignItems:'center', justifyContent: 'center', gap:6, width: isMobile ? '100%' : 'auto' }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
          Generar Contrato
        </button>

        {/* Modal contrato */}
        {showContrato && (
          <div style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>setShowContrato(false)}>
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:24, width:'calc(100vw - 32px)', maxWidth:360 }} onClick={e=>e.stopPropagation()}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:20 }}>📄 Generar Contrato Solar</div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6 }}>Modalidad de Pago</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[['efectivo','💵 Efectivo (50/50)'],['financiamiento','🏦 Financiamiento']].map(([v,l])=>(
                    <button key={v} onClick={()=>setModalidad(v)} style={{ border: modalidad===v?'2px solid #10b981':'1px solid var(--border)', borderRadius:8, padding:'10px 12px', background: modalidad===v?'rgba(16,185,129,0.12)':'var(--bg)', cursor:'pointer', fontSize:12, fontWeight:600, color: modalidad===v?'#10b981':'var(--text)' }}>{l}</button>
                  ))}
                </div>
              </div>
              {modalidad==='financiamiento' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:6 }}>Pronto Dado ($)</label>
                  <input type="number" value={prontoDado} onChange={e=>setProntoDado(e.target.value)} placeholder="ej: 5000" style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13, color:'var(--text)', outline:'none' }} />
                </div>
              )}
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button onClick={()=>setShowContrato(false)} style={{ flex:1, background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'9px', fontSize:13, color:'var(--muted)', cursor:'pointer' }}>Cancelar</button>
                <button onClick={generarContrato} disabled={contratoLoad} style={{ flex:2, background:'#10b981', border:'none', borderRadius:8, padding:'9px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', opacity:contratoLoad?0.6:1 }}>
                  {contratoLoad?'Generando…':'✓ Generar y Descargar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* kWh inputs */}
      <div style={{ background:'var(--surface)', border: isMobile ? 'none' : '1px solid var(--border)', borderRadius: isMobile ? 12 : 8, padding: isMobile ? '16px 16px' : '14px 16px', boxShadow: isMobile ? '0 1px 2px rgba(0,0,0,0.04)' : 'none' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isMobile ? 14 : 10, gap: 8, flexWrap:'wrap' }}>
          <div style={{ fontSize: isMobile ? 12 : 11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Consumo Mensual (kWh)</div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#1a3c8f', cursor: extractingFactura ? 'default' : 'pointer', background:'rgba(26,60,143,0.08)', padding:'6px 12px', borderRadius:8, opacity: extractingFactura ? 0.6 : 1 }}>
            {extractingFactura ? (
              <span style={{ width:12, height:12, border:'2px solid #1a3c8f', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }} />
            ) : (
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            )}
            {extractingFactura ? 'Leyendo factura…' : 'Subir factura (auto)'}
            <input type="file" accept="application/pdf,image/*" onChange={onSubirFactura} disabled={extractingFactura} style={{ display:'none' }} />
          </label>
          <button onClick={() => {
            const filled = meses.map(Number).filter(v => v > 0);
            if (filled.length === 0) { showMsg('Llena al menos 1 mes primero'); return; }
            const avg = Math.round(filled.reduce((a,b)=>a+b,0) / filled.length);
            const next = meses.map(v => Number(v) > 0 ? v : String(avg));
            setMeses(next);
            showMsg(`✓ Meses faltantes llenados con promedio ${avg} kWh`);
          }} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#10b981', background:'rgba(16,185,129,0.10)', border:'none', padding:'6px 12px', borderRadius:8, cursor:'pointer' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-7 5l2 2 4-4"/></svg>
            Auto-completar
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(auto-fit, minmax(56px, 1fr))', gap: isMobile ? 10 : 7 }}>
          {mesLabels.map((m,i) => (
            <div key={i} style={{ minWidth:0 }}>
              <input value={m} onChange={e => setMesLabel(i, e.target.value)} tabIndex={-1}
                style={{ width:'100%', background:'transparent', border:'none', borderBottom:'1px dashed var(--border)', outline:'none', fontSize: isMobile ? 11 : 9, color:'var(--muted)', fontWeight:600, textAlign:'center', marginBottom:4, padding:'0 2px' }} />
              <input type="number" min="0" value={meses[i]} onChange={e=>{ const n=[...meses]; n[i]=e.target.value; setMeses(n); }}
                style={{ ...inp, padding: isMobile ? '10px 6px' : '6px 8px', fontSize: isMobile ? 14 : 12, color:Number(meses[i])>0?'#1a3c8f':'var(--text)', fontWeight:Number(meses[i])>0?700:400 }} />
            </div>
          ))}
        </div>
        {calc && (
          <div style={{ marginTop:10, fontSize:11, color:'var(--muted)', display:'flex', gap:14, flexWrap:'wrap' }}>
            <span>Prom: <strong style={{color:'var(--text)'}}>{cotFmtK(calc.avg)} kWh/mes</strong></span>
            <span>Anual: <strong style={{color:'#1a3c8f'}}>{cotFmtK(calc.annCons)} kWh/año</strong></span>
            <span>LUMA est.: <strong style={{color:'#ef4444'}}>{cotFmt(calc.pagoLuma)}/mes</strong></span>
          </div>
        )}
      </div>

      {/* Batería */}
      <div style={{ background:'var(--surface)', border: isMobile ? 'none' : '1px solid var(--border)', borderRadius: isMobile ? 12 : 8, padding: isMobile ? '16px 16px' : '14px 16px', boxShadow: isMobile ? '0 1px 2px rgba(0,0,0,0.04)' : 'none' }}>
        <div style={{ fontSize: isMobile ? 12 : 11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom: isMobile ? 14 : 10 }}>Baterías</div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: isMobile ? 10 : 7 }}>
          {BATERIAS_COT.map((b,i) => {
            const active = batQty[i]>0;
            const qbtn = isMobile
              ? { width:36, height:36, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
              : { width:26, height:26, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 };
            return (
              <div key={i} style={{ border:active?'2px solid #1a3c8f':'1px solid var(--border)', borderRadius: isMobile ? 10 : 7, padding: isMobile ? '12px 14px' : '8px 10px', background:active?'rgba(26,60,143,0.10)':'var(--bg)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize: isMobile ? 14 : 11, fontWeight:700, color:active?'#1a3c8f':'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.name}</div>
                  <div style={{ fontSize: isMobile ? 12 : 10, color:'var(--muted)', marginTop:2 }}>{cotFmt(b.precio)}</div>
                  {b.description && <div title={b.description} style={{ fontSize: isMobile ? 11 : 9.5, color:'var(--muted)', marginTop:3, lineHeight:1.35, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{b.description}</div>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 8 : 4 }}>
                  <button onClick={()=>setQ(i,-1)} disabled={batQty[i]===0} style={{ ...qbtn, opacity:batQty[i]===0?0.4:1 }}>−</button>
                  <div style={{ minWidth: isMobile ? 28 : 22, textAlign:'center', fontSize: isMobile ? 16 : 13, fontWeight:800, color:active?'#1a3c8f':'var(--muted)' }}>{batQty[i]}</div>
                  <button onClick={()=>setQ(i,+1)} style={qbtn}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resultados */}
      {calc && (
        <div style={{ display:'flex', flexDirection:'column', gap: isMobile ? 14 : 10 }}>
          {/* Sistema */}
          <div style={{ background:'var(--surface)', border: isMobile ? 'none' : '1px solid var(--border)', borderRadius: isMobile ? 12 : 8, padding: isMobile ? '16px 16px' : '14px 16px', boxShadow: isMobile ? '0 1px 2px rgba(0,0,0,0.04)' : 'none' }}>
            <div style={{ fontSize: isMobile ? 12 : 11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom: isMobile ? 14 : 10 }}>Sistema Recomendado</div>
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(80px, 1fr))', gap: isMobile ? 10 : 8 }}>
              {[['kW DC',calc.kw],['Paneles',calc.panels+' unidades'],['Prod/año',cotFmtK(calc.annProd)+' kWh'],['Cobertura',calc.offset+'%']].map(([k,v])=>(
                <div key={k} style={{ background:'var(--bg)', borderRadius: isMobile ? 10 : 6, padding: isMobile ? '14px 8px' : '8px', textAlign:'center' }}>
                  <div style={{ fontSize: isMobile ? 11 : 9, color:'var(--muted)', fontWeight:600, textTransform: isMobile ? 'uppercase' : 'none', letterSpacing: isMobile ? '0.4px' : 0 }}>{k}</div>
                  <div style={{ fontSize: isMobile ? 17 : 13, fontWeight:800, color:'#1a3c8f', marginTop: isMobile ? 6 : 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Pagos */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 9 }}>
            <div style={{ background:'#fee2e2', border: isMobile ? 'none' : '1px solid #fca5a5', borderRadius: isMobile ? 12 : 8, padding: isMobile ? '14px 16px' : '10px 14px', display: isMobile ? 'flex' : 'block', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: isMobile ? 13 : 10, fontWeight:600, color:'#991b1b' }}>LUMA Actual</div>
              <div style={{ fontSize: isMobile ? 22 : 20, fontWeight:900, color:'#dc2626' }}>{cotFmt(calc.pagoLuma)}</div>
            </div>
            <div style={{ background:'#dbeafe', border: isMobile ? 'none' : '1px solid #93c5fd', borderRadius: isMobile ? 12 : 8, padding: isMobile ? '14px 16px' : '10px 14px', display: isMobile ? 'flex' : 'block', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: isMobile ? 13 : 10, fontWeight:600, color:'#1e40af' }}>Solo Placas · 15a</div>
              <div style={{ fontSize: isMobile ? 22 : 20, fontWeight:900, color:'#1d4ed8' }}>{cotFmt(calc.pagoFV)}</div>
            </div>
            {batTotal>0 && (
              <div style={{ background:'#ede9fe', border: isMobile ? 'none' : '1px solid #c4b5fd', borderRadius: isMobile ? 12 : 8, padding: isMobile ? '14px 16px' : '10px 14px', gridColumn: isMobile ? 'auto' : '1/-1', display: isMobile ? 'flex' : 'block', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: isMobile ? 13 : 10, fontWeight:600, color:'#5b21b6' }}>Placas + Batería · 15a</div>
                <div style={{ fontSize: isMobile ? 22 : 20, fontWeight:900, color:'#6d28d9' }}>{cotFmt(calc.pagoBat)}</div>
              </div>
            )}
          </div>
          {/* Precios */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', fontSize:12 }}>
            {[['Sistema FV',cotFmt(calc.costBase),''],
              ...BATERIAS_COT.map((b,i)=>batQty[i]>0?[`${b.name} ×${batQty[i]}`,cotFmt(b.precio*batQty[i]),'']:null).filter(Boolean),
              ...(calc.descuentoAmt > 0 ? [[`Descuento (${calc.descuentoPct}%)`, '-' + cotFmt(calc.descuentoAmt), 'discount']] : []),
              ['Total',cotFmt(calc.sub),'bold'],
            ].map(([k,v,st])=>(
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderTop:st==='bold'?'1px solid var(--border)':undefined, marginTop:st==='bold'?4:0 }}>
                <span style={{ color:st==='discount'?'#10b981':st==='green'?'#10b981':'var(--muted)', fontWeight:st==='discount'?600:400 }}>{k}</span>
                <span style={{ fontWeight:st==='bold'?800:st==='discount'?700:500, color:st==='discount'?'#10b981':st==='green'?'#10b981':'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:'#1a3c8f', borderRadius: isMobile ? 12 : 8, padding: isMobile ? '18px 16px' : '12px 16px', display:'flex', justifyContent:'space-around' }}>
            <div style={{ textAlign:'center' }}><div style={{ fontSize: isMobile ? 11 : 9, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>Ahorro anual</div><div style={{ fontSize: isMobile ? 22 : 16, fontWeight:900, color:'#fff', marginTop: isMobile ? 6 : 0 }}>{cotFmt(calc.annSav)}</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize: isMobile ? 11 : 9, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>ROI estimado</div><div style={{ fontSize: isMobile ? 22 : 16, fontWeight:900, color:'#fff', marginTop: isMobile ? 6 : 0 }}>{calc.roi} años</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Llamadas Tab ─────────────────────────────────────────────────────────────

function LlamadasTab({ lead, leadId, callLogs, setCallLogs, callStatus, setCallStatus,
  callTimer, setCallTimer, activeCall, setActiveCall, logId, setLogId,
  callDevice, setCallDevice, callIntervalRef }) {

  const phoneNumber = lead?.contact_phone || '';

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatDurationLog = (secs) => {
    if (!secs) return '—';
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const statusLabel = {
    completed:  { label: 'Completada', color: '#10b981' },
    'no-answer':{ label: 'Sin respuesta', color: '#f59e0b' },
    busy:       { label: 'Ocupado', color: '#f59e0b' },
    failed:     { label: 'Fallida', color: '#ef4444' },
    initiated:  { label: 'Iniciada', color: '#1b9af5' },
    ringing:    { label: 'Timbrando', color: '#1b9af5' },
    'in-progress':{ label: 'En curso', color: '#10b981' },
    canceled:   { label: 'Cancelada', color: '#94a3b8' },
  };

  const iniciarLlamada = async () => {
    if (!phoneNumber) return alert('Este lead no tiene número de teléfono.');
    if (callStatus !== 'idle') return;

    try {
      setCallStatus('connecting');

      // 1. Importar SDK de Twilio (ya instalado como npm, sin CDN)
      const { Device } = await import('@twilio/voice-sdk');

      // 2. Get access token from backend
      const tokenData = await api.callToken();
      if (!tokenData?.token) throw new Error('No se pudo obtener el token de llamada. Verifica la configuración de Twilio.');
      const { token } = tokenData;

      // 3. Create a call log entry
      const { log_id } = await api.startCall({ lead_id: leadId, to_number: phoneNumber });
      setLogId(log_id);

      // 4. Create Twilio Device
      const device = new Device(token, { edge: 'ashburn' });
      await device.register();
      setCallDevice(device);

      // 5. Place outbound call
      const call = await device.connect({ params: { To: phoneNumber } });
      setActiveCall(call);
      setCallStatus('active');
      setCallTimer(0);

      // Timer
      callIntervalRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);

      call.on('disconnect', async () => {
        clearInterval(callIntervalRef.current);
        const dur = callTimer;
        setCallStatus('ended');
        try {
          await api.updateCall(log_id, { call_sid: call.parameters?.CallSid, duration: dur, status: 'completed' });
          api.callLogs(leadId).then(setCallLogs).catch(() => {});
        } catch {}
        setTimeout(() => { setCallStatus('idle'); setCallTimer(0); }, 2000);
        device.destroy();
        setCallDevice(null);
        setActiveCall(null);
      });

      call.on('cancel', () => { call.emit('disconnect'); });
      call.on('reject', () => { call.emit('disconnect'); });

    } catch (err) {
      console.error('[CALL]', err);
      setCallStatus('idle');
      const msg = err?.message || err?.toString() || JSON.stringify(err) || 'Error desconocido';
      alert('Error al iniciar llamada: ' + msg);
    }
  };

  const colgarLlamada = () => {
    activeCall?.disconnect();
  };

  const callBtnStyle = {
    idle:       { bg: '#10b981', text: 'Llamar' },
    connecting: { bg: '#1b9af5', text: 'Conectando...' },
    active:     { bg: '#ef4444', text: `Colgar ${formatDuration(callTimer)}` },
    ended:      { bg: '#94a3b8', text: 'Terminada' },
  }[callStatus];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Call button */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Número de destino</div>
        <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, marginBottom: 12 }}>
          {phoneNumber || <span style={{ color: '#ef4444', fontSize: 13 }}>Sin número de teléfono</span>}
        </div>
        <button
          onClick={callStatus === 'active' ? colgarLlamada : iniciarLlamada}
          disabled={callStatus === 'connecting' || callStatus === 'ended' || !phoneNumber}
          style={{
            background: callBtnStyle.bg,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: callStatus === 'connecting' || callStatus === 'ended' || !phoneNumber ? 'not-allowed' : 'pointer',
            opacity: callStatus === 'connecting' || callStatus === 'ended' ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {callStatus === 'active' ? (
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          ) : (
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
            </svg>
          )}
          {callBtnStyle.text}
        </button>
      </div>

      {/* Call history */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Historial de llamadas
        </div>
        {callLogs.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Sin llamadas registradas</p>
        )}
        {callLogs.map(log => {
          const st = statusLabel[log.status] || { label: log.status, color: '#94a3b8' };
          return (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: 6,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${st.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" fill="none" stroke={st.color} strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{log.to_number}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {log.agent_name ? `${log.agent_name} · ` : ''}
                  {new Date(log.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{st.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{formatDurationLog(log.duration)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lead Form Modal ──────────────────────────────────────────────────────────

function LeadModal({ lead, pipelines, agents, onClose, onSaved }) {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({
    title:         lead?.title         || '',
    contact_name:  lead?.contact_name  || '',
    contact_email: lead?.contact_email || '',
    contact_phone: lead?.contact_phone || '',
    address:       lead?.solar_data?.address || '',
    cuenta_luma:   lead?.solar_data?.cuenta_luma || '',
    value:         lead?.value         || '',
    pipeline_id:   lead?.pipeline_id   || '',
    stage_id:      lead?.stage_id      || '',
    assigned_to:   lead?.assigned_to   || '',
    contact_id:    lead?.contact_id    || '',
  });
  const [extractedMeses, setExtractedMeses] = useState(null);
  const [extractedLabels, setExtractedLabels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');

  const onSubirFactura = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setExtracting(true);
    setExtractMsg('');
    try {
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result || ''); const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s); };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      // Si lead existe usa el endpoint con auth; si no, el público
      const data = lead?.id
        ? await api.extractFactura(lead.id, { name: f.name, mimeType: f.type || 'application/pdf', content: b64 })
        : await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app') + '/api/public/extract-factura', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file: { name: f.name, mimeType: f.type || 'application/pdf', content: b64 } }) }).then(r => r.json());
      if (!data.ok && data.error) throw new Error(data.error);
      setForm(f => ({
        ...f,
        contact_name: data.nombre || f.contact_name,
        contact_email: data.email || f.contact_email,
        contact_phone: data.telefono || f.contact_phone,
        title: f.title || data.nombre || '',
        address: data.direccion || f.address,
        cuenta_luma: data.cuenta_luma || f.cuenta_luma,
      }));
      if (Array.isArray(data.meses) && data.meses.some(v => v > 0)) {
        setExtractedMeses(data.meses);
        if (Array.isArray(data.labels) && data.labels.length >= 12) setExtractedLabels(data.labels);
      }
      const parts = [];
      if (data.nombre) parts.push('Nombre');
      if (data.direccion) parts.push('Dirección');
      if (Array.isArray(data.meses) && data.meses.some(v => v > 0)) parts.push('12 meses de consumo');
      setExtractMsg('✓ Datos extraídos: ' + (parts.join(' · ') || 'OK'));
    } catch (err) {
      setExtractMsg('Error: ' + err.message);
    }
    setExtracting(false);
  };

  useEffect(() => {
    api.contacts('?page=1').then(d => setContacts(d.contacts || [])).catch(() => {});
  }, []);

  const stages = pipelines.find(p => p.id === Number(form.pipeline_id))?.stages || [];

  const save = async () => {
    const titleFinal = (form.title || form.contact_name || '').trim();
    if (!titleFinal) return;
    setSaving(true);
    try {
      let leadId = lead?.id;
      if (lead) {
        await api.updateLead(lead.id, { ...form, title: titleFinal });
      } else {
        const created = await api.createLead({ ...form, title: titleFinal });
        leadId = created?.id || created?.lead?.id;
      }
      // Guardar dirección y meses extraídos en solar_data si tenemos algo
      if (leadId && (form.address || form.cuenta_luma || extractedMeses)) {
        const sd = { ...(lead?.solar_data || {}) };
        if (form.address) sd.address = form.address;
        if (form.cuenta_luma) sd.cuenta_luma = form.cuenta_luma;
        if (extractedMeses) {
          // Crear quotation con los meses extraídos
          const q = {
            id: 'q' + Math.random().toString(36).slice(2,9),
            name: form.contact_name ? `${form.contact_name} — Cotización inicial` : 'Cotización inicial',
            createdAt: new Date().toISOString(),
            meses: extractedMeses.map(v => v ? String(v) : ''),
            mesLabels: extractedLabels || null,
            batteries: [],
          };
          sd.quotations = [...(sd.quotations || []), q];
          sd.activeQuotationId = q.id;
        }
        try { await api.saveSolarData(leadId, { solar_data: sd }); } catch {}
      }
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-white mb-4">{lead ? 'Editar lead' : 'Nuevo lead'}</h2>

        {/* Upload factura */}
        {!lead && (
          <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1px dashed #93c5fd', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'#1a3c8f', marginBottom:6 }}>⚡ Subir factura LUMA → auto-llenar</div>
            <label style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#1a3c8f', color:'#fff', padding:'7px 12px', borderRadius:7, fontSize:12, fontWeight:700, cursor: extracting ? 'default' : 'pointer', opacity: extracting ? 0.6 : 1 }}>
              {extracting ? 'Leyendo…' : 'Subir factura PDF'}
              <input type="file" accept="application/pdf,image/*" onChange={onSubirFactura} disabled={extracting} style={{ display:'none' }} />
            </label>
            {extractMsg && <div style={{ marginTop:6, fontSize:11.5, fontWeight:600, color: extractMsg.startsWith('✓') ? '#10b981' : '#ef4444' }}>{extractMsg}</div>}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Nombre del cliente</label>
            <input className="input" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value, title: f.title || e.target.value }))} placeholder="Carlos Pérez" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Email</label>
              <input className="input" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="cliente@correo.com" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Teléfono</label>
              <input className="input" type="tel" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="787-555-0000" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Dirección</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Calle, ciudad, ZIP" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Cuenta LUMA (opcional)</label>
            <input className="input" value={form.cuenta_luma} onChange={e => setForm(f => ({ ...f, cuenta_luma: e.target.value }))} placeholder="3601731000" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Título del lead</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Auto: nombre del cliente" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Contacto existente</label>
            <select className="input" value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}>
              <option value="">Sin contacto</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Pipeline</label>
              <select className="input" value={form.pipeline_id} onChange={e => setForm(f => ({ ...f, pipeline_id: e.target.value, stage_id: '' }))}>
                <option value="">—</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Etapa</label>
              <select className="input" value={form.stage_id} onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}>
                <option value="">—</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Valor ($)</label>
              <input className="input" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Asignado a</label>
              <select className="input" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={saving || !form.title.trim()} className="btn-primary px-4 py-2 text-sm flex-1 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ stage, leads, onMove, onEdit, onDelete, onOpen, selectMode, selectedIds, onToggleSelect, unreadByLead }) {
  const [over, setOver] = useState(false);
  const total = leads.reduce((s, l) => s + (Number(l.value) || 0), 0);
  const stageColor = stage.color || '#1a3c8f';
  return (
    <div
      data-stage-id={stage.id}
      style={{
        flexShrink: 0, width: 280, display: 'flex', flexDirection: 'column',
        background: over ? 'rgba(103,232,249,0.06)' : 'transparent',
        borderRadius: 12,
        transition: 'background 0.18s',
      }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { setOver(false); const id = e.dataTransfer.getData('lead_id'); if (id) onMove(Number(id), stage.id); }}
    >
      {/* Sticky column header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        background: 'var(--surface)',
        padding: '12px 14px 10px',
        borderRadius: '10px 10px 0 0',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        marginBottom: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: stageColor, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stage.name}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'rgba(26,60,143,0.10)', borderRadius: 999, padding: '2px 8px', minWidth: 22, textAlign: 'center' }}>
            {leads.length}
          </span>
        </div>
        {total > 0 && (
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, letterSpacing: '0.01em' }}>
            ${total.toLocaleString()}
          </div>
        )}
      </div>
      {/* Stage accent bar under header */}
      <div style={{ height: 2, background: stageColor, opacity: 0.85 }} />

      {/* Cards */}
      <div style={{
        flex: 1, padding: '8px 6px 6px', overflowY: 'auto',
        maxHeight: 'calc(100dvh - 220px)',
        display: 'flex', flexDirection: 'column', gap: 8,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
      }}>
        {leads.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '28px 12px', textAlign: 'center', gap: 6,
            border: '1px dashed var(--border)', borderRadius: 10, margin: 4,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: 'var(--muted)', opacity: 0.6 }}>
              <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Arrastra leads aquí</span>
          </div>
        )}
        {leads.map(lead => {
          const isSelected = selectedIds.has(lead.id);
          const displayName = lead.contact_name || lead.title || 'Sin nombre';
          const tags = Array.isArray(lead.tags) ? lead.tags.filter(t => t && t.tag) : [];
          const fecha = lead.updated_at
            ? new Date(lead.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
          return (
            <div
              key={lead.id}
              draggable={!selectMode}
              onDragStart={e => e.dataTransfer.setData('lead_id', String(lead.id))}
              onClick={selectMode ? () => onToggleSelect(lead.id) : () => onOpen(lead.id)}
              onTouchStart={e => {
                if (selectMode) return;
                e.currentTarget.dataset.draggingLead = lead.id;
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.transform = 'scale(0.97)';
              }}
              onTouchEnd={e => {
                e.currentTarget.style.opacity = '';
                e.currentTarget.style.transform = '';
                const touch = e.changedTouches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                const col = el?.closest('[data-stage-id]');
                if (col) {
                  const stageId = Number(col.dataset.stageId);
                  if (stageId && stageId !== lead.stage_id) onMove(lead.id, stageId);
                }
              }}
              style={{
                position: 'relative',
                background: 'var(--surface)',
                border: isSelected ? '1px solid #67e8f9' : '1px solid var(--border)',
                borderLeft: `3px solid ${stageColor || '#cbd5e1'}`,
                borderRadius: 8,
                padding: '11px 12px 10px 13px',
                cursor: 'pointer',
                transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
                boxShadow: isSelected ? '0 0 0 3px rgba(103,232,249,0.18)' : '0 1px 2px rgba(15,42,92,0.04)',
              }}
              onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#67e8f9'; e.currentTarget.style.boxShadow = '0 6px 14px -4px rgba(26,60,143,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,42,92,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              {/* Select checkbox (select mode) */}
              {selectMode && (
                <div style={{ width: 17, height: 17, borderRadius: 5, border: `2px solid ${isSelected ? '#67e8f9' : 'var(--muted)'}`, background: isSelected ? '#67e8f9' : 'transparent', boxShadow: isSelected ? '0 0 0 3px rgba(103,232,249,0.25)' : 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                  {isSelected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0f2a5c" strokeWidth="3.5"><path d="M5 13l4 4L19 7" /></svg>}
                </div>
              )}

              {/* Name + unread badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a3c8f', lineHeight: 1.35, flex: 1, minWidth: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {displayName}
                </span>
                {unreadByLead?.[lead.id] > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: '2px 6px', flexShrink: 0, marginTop: 1 }}>
                    {unreadByLead[lead.id]}
                  </span>
                )}
              </div>

              {/* Value pill */}
              {lead.value > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.10)', borderRadius: 6, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    ${Number(lead.value).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Contact info — siempre visible (fuente + fecha si no hay phone) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                {lead.contact_phone ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {lead.contact_phone}
                  </span>
                ) : lead.source ? (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'rgba(26,60,143,0.08)', color: '#1a3c8f', fontWeight: 600, textTransform: 'capitalize' }}>{lead.source}</span>
                ) : null}
                {fecha && <span style={{ marginLeft: 'auto' }}>{fecha}</span>}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
                  {tags.slice(0, 3).map((tg, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: `${tg.color || '#1a3c8f'}18`, color: tg.color || '#1a3c8f', fontWeight: 600, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tg.tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom row: personas + assigned agent */}
              {(lead.cantidad_personas || lead.assigned_name) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 7, borderTop: '1px dashed var(--border)' }}>
                  {lead.cantidad_personas ? (
                    <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {lead.cantidad_personas}
                    </span>
                  ) : <span />}
                  {lead.assigned_name && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#1a3c8f,#67e8f9)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                        {lead.assigned_name[0].toUpperCase()}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.assigned_name.split(' ')[0]}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add lead button at bottom of column */}
        <button
          style={{ width: '100%', padding: '8px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', background: 'none', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', marginTop: 2, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a3c8f'; e.currentTarget.style.color = '#1a3c8f'; e.currentTarget.style.background = 'rgba(26,60,143,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Agregar lead
        </button>
      </div>
    </div>
  );
}

// ─── Desktop Lista View ───────────────────────────────────────────────────────

function LeadRow({ lead, onOpen, onEdit, onDelete, selectMode, selectedIds, onToggleSelect, isLast }) {
  const isSelected = selectedIds.has(lead.id);
  const initial    = (lead.contact_name || lead.title || '?')[0].toUpperCase();
  const avatarColor = lead.stage_color || '#1a3c8f';
  const createdDate = lead.created_at ? new Date(lead.created_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' }) : '';
  const sd_        = lead.solar_data || {};
  const hasSolar   = !!(sd_ && (sd_.meses?.some(v => Number(v) > 0) || sd_.calc?.systemKw > 0 || sd_.pagoLuz || sd_.batteries?.length));
  const hasCalc    = !!(sd_.calc?.systemKw > 0);
  return (
    <div
      onClick={selectMode ? () => onToggleSelect(lead.id) : () => onOpen(lead.id)}
      style={{ position:'relative', display:'flex', alignItems:'center', gap:12, padding:'12px 16px 12px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor:'pointer', background: isSelected ? 'rgba(103,232,249,0.08)' : 'transparent', transition:'background 0.15s' }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(26,60,143,0.04)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'rgba(103,232,249,0.08)' : 'transparent'; }}
    >
      {/* Stage accent strip */}
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:avatarColor }} />
      {selectMode && (
        <div style={{ width:17, height:17, borderRadius:5, border:`2px solid ${isSelected?'#67e8f9':'var(--muted)'}`, background:isSelected?'#67e8f9':'transparent', boxShadow: isSelected ? '0 0 0 3px rgba(103,232,249,0.25)' : 'none', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isSelected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0f2a5c" strokeWidth="3.5"><path d="M5 13l4 4L19 7"/></svg>}
        </div>
      )}
      <div style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg, ${avatarColor}, #67e8f9)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0, boxShadow:'0 2px 4px rgba(15,42,92,0.15)' }}>
        {initial}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:13.5, fontWeight:700, color:'#1a3c8f', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:240 }} title={lead.title}>{lead.title}</span>
          {lead.stage_name && <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:999, background:`${lead.stage_color||'#1a3c8f'}18`, color:lead.stage_color||'#1a3c8f', whiteSpace:'nowrap' }}>{lead.stage_name}</span>}
          {lead.value > 0 && <span style={{ fontSize:11, fontWeight:700, color:'#10b981', background:'rgba(16,185,129,0.10)', borderRadius:6, padding:'2px 7px' }}>${Number(lead.value).toLocaleString()}</span>}
          {hasSolar && !hasCalc && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#d97706', whiteSpace:'nowrap' }}>Sin cotizar</span>}
          {hasCalc && <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:999, background:'rgba(26,60,143,0.10)', color:'#1a3c8f', whiteSpace:'nowrap' }}>{lead.solar_data.calc.systemKw} kW</span>}
        </div>
        {lead.tags?.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:5 }}>
            {lead.tags.slice(0,4).map((tag,ti) => {
              const tg = typeof tag==='string' ? { tag, color: '#1a3c8f' } : tag;
              return <span key={ti} style={{ fontSize:10, padding:'1px 7px', borderRadius:999, background:`${tg.color||'#1a3c8f'}15`, color:tg.color||'#1a3c8f', fontWeight:600 }}>{tg.tag}</span>;
            })}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:5, flexWrap:'wrap' }}>
          {createdDate && <span style={{ fontSize:10.5, color:'var(--muted)' }}>{createdDate}</span>}
          {lead.assigned_name && <span style={{ fontSize:10.5, color:'var(--text)', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}><span style={{ width:16, height:16, borderRadius:'50%', background:'linear-gradient(135deg,#1a3c8f,#67e8f9)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>{lead.assigned_name[0].toUpperCase()}</span>{lead.assigned_name}</span>}
          {lead.contact_phone && <span style={{ fontSize:10.5, color:'var(--muted)', display:'inline-flex', alignItems:'center', gap:4 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{lead.contact_phone}</span>}
        </div>
      </div>
      <div style={{ flexShrink:0, textAlign:'right' }}>
        <span style={{ fontSize:10.5, color:'var(--muted)', whiteSpace:'nowrap' }}>{tiempoRelativo(lead.updated_at)}</span>
        {!selectMode && (
          <div style={{ display:'flex', gap:2, justifyContent:'flex-end', marginTop:5 }}>
            <button onClick={e=>{ e.stopPropagation(); onEdit(lead); }} style={{ fontSize:10.5, fontWeight:600, color:'var(--muted)', background:'none', border:'1px solid var(--border)', cursor:'pointer', padding:'3px 9px', borderRadius:6, transition:'all 0.15s' }} onMouseEnter={e=>{ e.currentTarget.style.color='#1a3c8f'; e.currentTarget.style.borderColor='#1a3c8f'; }} onMouseLeave={e=>{ e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)'; }}>Editar</button>
            <button onClick={e=>{ e.stopPropagation(); onDelete(lead.id); }} style={{ fontSize:10.5, fontWeight:600, color:'var(--muted)', background:'none', border:'1px solid var(--border)', cursor:'pointer', padding:'3px 9px', borderRadius:6, transition:'all 0.15s' }} onMouseEnter={e=>{ e.currentTarget.style.color='#ef4444'; e.currentTarget.style.borderColor='#ef4444'; }} onMouseLeave={e=>{ e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)'; }}>Eliminar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ListaView({ leads, onOpen, onEdit, onDelete, selectMode, selectedIds, onToggleSelect }) {
  if (leads.length === 0) return <p className="text-muted text-sm text-center py-12">Sin leads</p>;

  const tieneSolar = l => { const s = l.solar_data || {}; return !!(s.meses?.some(v=>Number(v)>0) || s.calc?.systemKw > 0 || s.pagoLuz || s.batteries?.length); };
  const listos    = leads.filter(tieneSolar);
  const sinDatos  = leads.filter(l => !tieneSolar(l));

  const Section = ({ title, color, bg, items, accent }) => items.length === 0 ? null : (
    <div style={{ marginBottom:20 }}>
      <div style={{ padding:'10px 16px', background:bg, borderRadius:'10px 10px 0 0', display:'flex', alignItems:'center', gap:10, border:'1px solid var(--border)', borderBottom:'none' }}>
        {accent && <span style={{ width:8, height:8, borderRadius:2, background:accent }} />}
        <span style={{ fontSize:11.5, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.06em' }}>{title}</span>
        <span style={{ fontSize:11, fontWeight:600, color, background:'rgba(255,255,255,0.5)', borderRadius:999, padding:'1px 8px' }}>{items.length}</span>
      </div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', boxShadow:'0 1px 3px rgba(15,42,92,0.04)' }}>
        {items.map((lead,i) => <LeadRow key={lead.id} lead={lead} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect} isLast={i===items.length-1} />)}
      </div>
    </div>
  );

  return (
    <div>
      <Section title="Listos para cotizar" color="#b45309" bg="rgba(245,158,11,0.10)" accent="#f59e0b" items={listos} />
      <Section title="Todos los leads" color="#1a3c8f" bg="rgba(26,60,143,0.06)" accent="#1a3c8f" items={sinDatos} />
    </div>
  );
}

// ─── Desktop Tabla View ───────────────────────────────────────────────────────

function TablaView({ leads, onOpen, onEdit, onDelete, selectMode, selectedIds, onToggleSelect }) {
  if (leads.length === 0) return <p className="text-muted text-sm text-center py-12">Sin leads</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {selectMode && <th className="px-4 py-3 w-10"></th>}
            <th className="text-left px-4 py-3 text-xs font-medium text-muted">Título</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted">Contacto</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted">Etapa</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted">Valor</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted">Asignado</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => {
            const isSelected = selectedIds.has(lead.id);
            return (
              <tr key={lead.id}
                onClick={selectMode ? () => onToggleSelect(lead.id) : () => onOpen(lead.id)}
                className={`border-b border-border/50 last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-accent/5' : i % 2 === 0 ? 'bg-bg/30 hover:bg-white/3' : 'hover:bg-white/3'}`}>
                {selectMode && (
                  <td className="px-4 py-3">
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? '#1b9af5' : 'var(--muted)'}`, background: isSelected ? '#1b9af5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{lead.title}</div>
                </td>
                <td className="px-4 py-3 text-muted text-xs">{lead.contact_name || '—'}</td>
                <td className="px-4 py-3">
                  {lead.stage_name
                    ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${lead.stage_color}20`, color: lead.stage_color }}>
                        {lead.stage_name}
                      </span>
                    : <span className="text-muted text-xs">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {lead.value > 0
                    ? <span className="text-emerald-400 text-xs font-medium">${Number(lead.value).toLocaleString()}</span>
                    : <span className="text-muted text-xs">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-muted text-xs">{lead.assigned_name || '—'}</td>
                <td className="px-4 py-3 text-muted text-xs">{tiempoRelativo(lead.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Mobile Lead Card ─────────────────────────────────────────────────────────

function MobileLeadCard({ lead, onOpen, onEdit, onDelete }) {
  const [pressed, setPressed] = useState(false);
  const initial = (lead.contact_name || lead.title || '?').trim()[0].toUpperCase();
  const stageColor = lead.stage_color || '#1a3c8f';
  return (
    <div
      onClick={() => onOpen(lead)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        minHeight: 76,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 0.12s ease, background 0.12s ease',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Avatar gradient */}
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: 'linear-gradient(135deg, #1a3c8f 0%, #67e8f9 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 17, fontWeight: 700, flexShrink: 0,
        boxShadow: '0 2px 8px rgba(26,60,143,0.25)',
        letterSpacing: 0.5,
      }}>{initial}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a3c8f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.title || lead.contact_name || 'Sin nombre'}
          </span>
          {lead.value > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981', flexShrink: 0 }}>
              ${Number(lead.value).toLocaleString()}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.contact_phone || lead.contact_email || lead.contact_name || 'Sin contacto'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {lead.stage_name && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              backgroundColor: `${stageColor}1f`, color: stageColor,
              border: `1px solid ${stageColor}40`,
              textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              {lead.stage_name}
            </span>
          )}
          {lead.follow_up_at && (() => {
            const diffH = (new Date(lead.follow_up_at) - new Date()) / 3600000;
            if (diffH < -1) return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z"/></svg>
                Vencido
              </span>
            );
            if (diffH < 24) return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                Hoy
              </span>
            );
            return null;
          })()}
        </div>
      </div>

      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--muted)', flexShrink: 0, opacity: 0.6 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

// ─── View Toggle Icons ────────────────────────────────────────────────────────

function IconKanban({ active }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-accent' : 'text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="5" height="18" rx="1" strokeWidth={2} />
      <rect x="10" y="3" width="5" height="12" rx="1" strokeWidth={2} />
      <rect x="17" y="3" width="5" height="15" rx="1" strokeWidth={2} />
    </svg>
  );
}

function IconLista({ active }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-accent' : 'text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="10" height="8" rx="1" strokeWidth={2} />
      <rect x="14" y="3" width="7" height="8" rx="1" strokeWidth={2} />
      <rect x="3" y="13" width="10" height="8" rx="1" strokeWidth={2} />
      <rect x="14" y="13" width="7" height="8" rx="1" strokeWidth={2} />
    </svg>
  );
}

function IconTabla({ active }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-accent' : 'text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [panelLeadId, setPanelLeadId] = useState(null);
  const [previewLead, setPreviewLead] = useState(null); // quick preview sheet on mobile
  const [activePipeline, setActivePipeline] = useState(null);
  const [activeStage, setActiveStage] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileFilterSheet, setMobileFilterSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [desktopView, setDesktopView] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('crm_leads_view') || 'kanban';
    }
    return 'kanban';
  });
  // Bulk selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStageId, setBulkStageId] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  // Drag-to-scroll (kanban hand/grab)
  const kanbanRef = useRef(null);
  const kanbanDrag = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const onKanbanMouseDown = (e) => {
    if (e.button !== 0) return;
    // Don't interfere with clicks on cards or buttons
    if (e.target.closest('button, a, input, select, [data-nodrag]')) return;
    kanbanDrag.current = { active: true, startX: e.clientX, scrollLeft: kanbanRef.current.scrollLeft };
    kanbanRef.current.style.cursor = 'grabbing';
    kanbanRef.current.style.userSelect = 'none';
  };
  const onKanbanMouseMove = (e) => {
    if (!kanbanDrag.current.active) return;
    e.preventDefault();
    const dx = e.clientX - kanbanDrag.current.startX;
    kanbanRef.current.scrollLeft = kanbanDrag.current.scrollLeft - dx;
  };
  const onKanbanMouseUp = () => {
    kanbanDrag.current.active = false;
    if (kanbanRef.current) {
      kanbanRef.current.style.cursor = 'grab';
      kanbanRef.current.style.userSelect = '';
    }
  };
  const [bulkMsgModal, setBulkMsgModal] = useState(false);
  const [bulkMsgText, setBulkMsgText] = useState('');
  const [bulkMsgSending, setBulkMsgSending] = useState(false);
  // Lost reason modal
  const [lostModal, setLostModal] = useState(null); // { leadId, stageId, pipId }
  const [lostReason, setLostReason] = useState('');
  // Small group filter (≤4 people)
  const [filterSmallGroup, setFilterSmallGroup] = useState(false);
  // Tag filter
  const [filterTags, setFilterTags] = useState(new Set());
  // Confirm modal
  const [confirmDialog, setConfirmDialog] = useState(null);
  // Dormidos filter (no activity > 7 days)
  const [filterDormidos, setFilterDormidos] = useState(false);
  // Unread message counts per lead
  const [unreadByLead, setUnreadByLead] = useState({});
  // Filter panel (Kommo-style)
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterResponsable, setFilterResponsable] = useState(''); // agent id or ''
  const [filterEtapas, setFilterEtapas] = useState(new Set()); // stage ids

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    api.inbox().then(items => {
      const map = {};
      items.filter(i => i.direction === 'inbound').forEach(i => {
        if (i.lead_id) map[i.lead_id] = (map[i.lead_id] || 0) + 1;
      });
      setUnreadByLead(map);
    }).catch(() => {});
  }, []);

  const changeView = (view) => {
    setDesktopView(view);
    localStorage.setItem('crm_leads_view', view);
  };

  const cargar = (pipId) => {
    setLoading(true);
    const pid = pipId || activePipeline;

    if (!pid) {
      // Initial load: get pipelines first so we can filter leads correctly
      api.pipelines().then(p => {
        setPipelines(p);
        const firstPid = p[0]?.id;
        if (firstPid) setActivePipeline(firstPid);
        return api.leads(firstPid ? `?pipeline_id=${firstPid}&limit=1000` : `?limit=1000`);
      }).then(setLeads).catch(() => {}).finally(() => setLoading(false));
      api.agents().then(setAgents).catch(() => {});
      return;
    }

    Promise.all([api.leads(`?pipeline_id=${pid}&limit=1000`), api.pipelines()])
      .then(([l, p]) => { setLeads(l); setPipelines(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
    api.agents().then(setAgents).catch(() => {});
  };

  useEffect(() => { cargar(); }, []);

  // Auto-open lead from URL param ?open=ID (e.g., from llamadas page)
  useEffect(() => {
    const openId = searchParams?.get('open');
    if (openId) {
      setPanelLeadId(Number(openId));
      router.replace('/leads');
    }
  }, [searchParams]);

  // Real-time: refresh leads list when new message arrives
  useEffect(() => {
    let es;
    try {
      const token = localStorage.getItem('crm_token');
      if (!token) return;
      const base = typeof window !== 'undefined' ? '/backend' : '';
      es = new EventSource(`${base}/api/events?token=${encodeURIComponent(token)}`);
      es.addEventListener('new_message', () => {
        // Debounce: wait 500ms to avoid hammering on rapid messages
        clearTimeout(window._crmLeadRefreshTimeout);
        window._crmLeadRefreshTimeout = setTimeout(() => {
          api.leads().then(setLeads).catch(() => {});
        }, 500);
      });
    } catch {}
    return () => es?.close();
  }, []);

  const mover = async (leadId, stageId, lost_reason = null) => {
    const pip = pipelines.find(p => p.stages.some(s => s.id === stageId));
    const stage = pip?.stages.find(s => s.id === stageId);
    // Ask for lost reason before moving
    if (!lost_reason && stage && /perdid|lost/i.test(stage.name)) {
      setLostModal({ leadId, stageId, pipId: pip?.id });
      return;
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: stageId, pipeline_id: pip?.id } : l));
    await api.moveLead(leadId, { stage_id: stageId, pipeline_id: pip?.id, lost_reason }).catch(() => cargar());
  };

  const confirmarLost = async () => {
    if (!lostModal) return;
    const { leadId, stageId, pipId } = lostModal;
    const pip = pipelines.find(p => p.stages.some(s => s.id === stageId));
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: stageId, pipeline_id: pipId } : l));
    await api.moveLead(leadId, { stage_id: stageId, pipeline_id: pipId, lost_reason: lostReason || 'Sin especificar' }).catch(() => cargar());
    setLostModal(null);
    setLostReason('');
  };

  const enviarMensajeMasivo = async () => {
    if (!bulkMsgText.trim() || bulkMsgSending) return;
    setBulkMsgSending(true);
    try {
      const r = await api.bulkMessage(selectedIds, bulkMsgText.trim());
      setBulkMsgModal(false);
      setBulkMsgText('');
      setSelectMode(false);
      setSelectedIds(new Set());
      alert(`Mensaje enviado a ${r.enviados} leads`);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setBulkMsgSending(false); }
  };

  const eliminar = (id) => {
    setConfirmDialog({
      message: '¿Eliminar este lead? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setConfirmDialog(null);
        setLeads(prev => prev.filter(l => l.id !== id));
        await api.deleteLead(id).catch(() => cargar());
      },
    });
  };

  const toggleSelectMode = () => {
    setSelectMode(s => !s);
    setSelectedIds(new Set());
    setBulkStageId('');
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkMoveStage = async () => {
    if (!bulkStageId || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await api.bulkLeads({ ids: Array.from(selectedIds), action: 'move_stage', stage_id: Number(bulkStageId) });
      setSelectedIds(new Set());
      setBulkStageId('');
      setSelectMode(false);
      cargar();
    } catch (e) { alert(e.message); }
    setBulkLoading(false);
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      message: `¿Eliminar ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setBulkLoading(true);
        try {
          await api.bulkLeads({ ids: Array.from(selectedIds), action: 'delete' });
          setSelectedIds(new Set());
          setSelectMode(false);
          cargar();
        } catch (e) { alert(e.message); }
        setBulkLoading(false);
      },
    });
  };

  // Pull-to-refresh
  useEffect(() => {
    const handler = () => cargar();
    window.addEventListener('crm:refresh', handler);
    return () => window.removeEventListener('crm:refresh', handler);
  }, []);

  // Export leads to CSV
  const exportCSV = () => {
    const cols = ['Título','Contacto','Teléfono','Email','Etapa','Pipeline','Valor','Check-in','Check-out','Follow-up','Asignado','Tags'];
    const rows = leadsFiltrados.map(l => [
      l.title || '',
      l.contact_name || '',
      l.contact_phone || '',
      l.contact_email || '',
      l.stage_name || '',
      pipelines.find(p => p.id === l.pipeline_id)?.name || '',
      l.value || '',
      l.check_in || '',
      l.check_out || '',
      l.follow_up_at || '',
      l.assigned_name || '',
      (l.tags || []).map(t => t.tag).join('; '),
    ]);
    const csv = [cols, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const pipeline = pipelines.find(p => p.id === activePipeline);
  const leadsDelPipeline = leads.filter(l => l.pipeline_id === activePipeline);

  // Collect all unique tags across all leads in this pipeline
  const allTags = [...new Map(
    leadsDelPipeline.flatMap(l => (l.tags || []).map(t => [t.tag, t]))
  ).values()].sort((a, b) => a.tag.localeCompare(b.tag));

  const toggleFilterTag = (tag) => {
    setFilterTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  // Apply all filters except stage (used for kanban where stage=column)
  const applyCommonFilters = (list) => list
    .filter(l => !search || l.title?.toLowerCase().includes(search.toLowerCase()) || l.contact_name?.toLowerCase().includes(search.toLowerCase()))
    .filter(l => !filterSmallGroup || !l.cantidad_personas || Number(l.cantidad_personas) <= 4)
    .filter(l => filterTags.size === 0 || (l.tags || []).some(t => filterTags.has(t.tag)))
    .filter(l => !filterDormidos || !l.updated_at || ((Date.now() - new Date(l.updated_at).getTime()) / 86400000) > 7)
    .filter(l => !filterResponsable || (filterResponsable === 'none' ? !l.assigned_to : String(l.assigned_to) === String(filterResponsable)))
    .filter(l => filterEtapas.size === 0 || filterEtapas.has(l.stage_id));

  const activeFilterCount = [
    filterResponsable ? 1 : 0,
    filterEtapas.size > 0 ? 1 : 0,
    filterSmallGroup ? 1 : 0,
    filterDormidos ? 1 : 0,
    filterTags.size > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const leadsParaKanban = applyCommonFilters(leadsDelPipeline);

  const leadsVisibles = activeStage
    ? leadsDelPipeline.filter(l => l.stage_id === activeStage)
    : leadsDelPipeline;
  const leadsAfterFilters = applyCommonFilters(leadsVisibles);

  // Sort by check_in asc (soonest first); leads without check_in go to end
  const leadsFiltrados = [...leadsAfterFilters].sort((a, b) => {
    if (!a.check_in && !b.check_in) return 0;
    if (!a.check_in) return 1;
    if (!b.check_in) return -1;
    return new Date(a.check_in) - new Date(b.check_in);
  });

  // ── MOBILE VIEW ─────────────────────────────────────────────────────────────
  if (isMobile) {
    const activeFilterCount = (filterDormidos ? 1 : 0) + (filterSmallGroup ? 1 : 0) + (filterTags.size > 0 ? 1 : 0);
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--bg)', position: 'relative' }}>
        {confirmDialog && <ConfirmModal message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
        {/* Header móvil */}
        <div style={{ padding: '12px 16px 8px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
                <circle cx="11" cy="11" r="7"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text" placeholder={t('common.search', lang)} value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', minHeight: 42,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '0 12px 0 38px', fontSize: 14, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
            <button
              onClick={() => setMobileFilterSheet(true)}
              style={{
                position: 'relative', width: 42, height: 42, flexShrink: 0,
                borderRadius: 12, border: '1px solid var(--border)',
                background: activeFilterCount > 0 ? '#1a3c8f' : 'var(--bg)',
                color: activeFilterCount > 0 ? '#fff' : 'var(--text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
              aria-label="Filtros"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
              </svg>
              {activeFilterCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: '#67e8f9', color: '#1a3c8f', fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
            {loading ? '...' : `${leadsFiltrados.length} leads`}
          </div>
        </div>

        {/* Filtro por etapa (chips horizontales) */}
        {pipeline?.stages && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="scrollbar-hide">
            <button
              onClick={() => setActiveStage(null)}
              style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 999, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: !activeStage ? '#1a3c8f' : 'rgba(26,60,143,0.08)',
                color: !activeStage ? '#fff' : '#1a3c8f',
              }}
            >
              {t('common.all', lang)} ({leadsDelPipeline.length})
            </button>
            {pipeline.stages.map(s => {
              const count = leadsDelPipeline.filter(l => l.stage_id === s.id).length;
              const sel = activeStage === s.id;
              return (
                <button key={s.id}
                  onClick={() => setActiveStage(sel ? null : s.id)}
                  style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 999, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: sel ? s.color : `${s.color}14`,
                    color: sel ? '#fff' : s.color,
                  }}
                >
                  {s.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Filter bottom sheet */}
        {mobileFilterSheet && (
          <>
            <div onClick={() => setMobileFilterSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.5)' }} />
            <div style={{ position: 'fixed', bottom: 60, left: 0, right: 0, zIndex: 200, background: 'var(--surface)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border)', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
              </div>
              <div style={{ padding: '8px 20px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a3c8f', margin: 0 }}>Filtros</h3>
                  {activeFilterCount > 0 && (
                    <button onClick={() => { setFilterDormidos(false); setFilterSmallGroup(false); setFilterTags(new Set()); }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Limpiar
                    </button>
                  )}
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Estado</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => setFilterDormidos(f => !f)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${filterDormidos ? '#ef4444' : 'var(--border)'}`, background: filterDormidos ? 'rgba(239,68,68,0.1)' : 'var(--bg)', color: filterDormidos ? '#ef4444' : 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      <span>Sin actividad +7 días</span>
                      <span style={{ fontSize: 18 }}>{filterDormidos ? '✓' : ''}</span>
                    </button>
                    <button onClick={() => setFilterSmallGroup(f => !f)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${filterSmallGroup ? '#f59e0b' : 'var(--border)'}`, background: filterSmallGroup ? 'rgba(245,158,11,0.1)' : 'var(--bg)', color: filterSmallGroup ? '#f59e0b' : 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      <span>Grupos pequeños (≤4)</span>
                      <span style={{ fontSize: 18 }}>{filterSmallGroup ? '✓' : ''}</span>
                    </button>
                  </div>
                </div>
                {allTags.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Tags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {allTags.map(tg => {
                        const sel = filterTags.has(tg.tag);
                        return (
                          <button key={tg.tag} onClick={() => toggleFilterTag(tg.tag)}
                            style={{
                              minHeight: 36, padding: '0 14px', borderRadius: 999,
                              border: `1px solid ${sel ? (tg.color || '#1a3c8f') : 'var(--border)'}`,
                              background: sel ? `${tg.color || '#1a3c8f'}20` : 'var(--bg)',
                              color: sel ? (tg.color || '#1a3c8f') : 'var(--text)',
                              fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}>
                            {tg.tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button onClick={exportCSV}
                  style={{ width: '100%', minHeight: 48, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                  Exportar CSV
                </button>
                <button onClick={() => setMobileFilterSheet(false)}
                  style={{ marginTop: 12, width: '100%', minHeight: 48, borderRadius: 12, border: 'none', background: '#1a3c8f', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  Aplicar
                </button>
              </div>
            </div>
          </>
        )}

        {/* Lista de leads */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          {loading && (
            <div className="flex justify-center py-12 text-muted text-sm gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              {t('common.loading', lang)}
            </div>
          )}
          {!loading && leadsFiltrados.length === 0 && (
            <p className="text-muted text-sm text-center py-12">{t('dash.empty.leads', lang)}</p>
          )}
          {leadsFiltrados.map(lead => (
            <MobileLeadCard
              key={lead.id}
              lead={lead}
              onOpen={lead => setPanelLeadId(lead.id)}
              onEdit={lead => setModal(lead)}
              onDelete={eliminar}
            />
          ))}
          <div style={{ height: 100 }} />
        </div>

        {/* FAB nuevo lead */}
        {!panelLeadId && !modal && (
          <button
            onClick={() => setModal('new')}
            aria-label="Nuevo lead"
            style={{
              position: 'fixed', right: 18, bottom: 80,
              width: 56, height: 56, borderRadius: '50%',
              background: '#1a3c8f', color: '#fff', border: 'none',
              boxShadow: '0 8px 24px rgba(26,60,143,0.45), 0 0 0 4px rgba(103,232,249,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 90,
            }}
          >
            <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        )}

        {modal && (
          <LeadModal lead={modal === 'new' ? null : modal} pipelines={pipelines} agents={agents}
            onClose={() => setModal(null)} onSaved={cargar} />
        )}
        {/* Quick preview sheet */}
        {previewLead && !panelLeadId && (
          <>
            <div onClick={() => setPreviewLead(null)} style={{ position: 'fixed', inset: 0, zIndex: 179, background: 'rgba(0,0,0,0.45)' }} />
            <div style={{ position: 'fixed', bottom: 60, left: 0, right: 0, zIndex: 180, background: 'var(--surface)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border)' }}>
              {/* Grab handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', backgroundColor: `${previewLead.stage_color || '#1b9af5'}20`, color: previewLead.stage_color || '#1b9af5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                    {(previewLead.contact_name || previewLead.title || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{previewLead.title}</div>
                    {previewLead.contact_name && previewLead.contact_name !== previewLead.title && (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{previewLead.contact_name}</div>
                    )}
                  </div>
                  {previewLead.value > 0 && (
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981', flexShrink: 0 }}>${Number(previewLead.value).toLocaleString()}</div>
                  )}
                </div>
                {/* Stage + phone row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {previewLead.stage_name && (
                    <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 12, backgroundColor: `${previewLead.stage_color}20`, color: previewLead.stage_color, fontWeight: 600 }}>
                      {previewLead.stage_name}
                    </span>
                  )}
                  {previewLead.contact_phone && (
                    <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      📞 {previewLead.contact_phone}
                    </span>
                  )}
                </div>
                {/* Open button */}
                <button
                  onClick={() => { setPanelLeadId(previewLead.id); setPreviewLead(null); }}
                  style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                  Abrir lead →
                </button>
              </div>
            </div>
          </>
        )}
        {panelLeadId && (
          <LeadPanel leadId={panelLeadId} pipelines={pipelines} agents={agents}
            onClose={() => setPanelLeadId(null)} onUpdated={cargar}
            leads={leadsFiltrados} onNavigate={id => setPanelLeadId(id)} lang={lang} isMobile={true} />
        )}
      </div>
    );
  }

  // ── DESKTOP VIEW ─────────────────────────────────────────────────────────────
  const allPipelineStages = pipelines.flatMap(p => p.stages);
  const totalValue = leadsDelPipeline.reduce((s, l) => s + (Number(l.value) || 0), 0);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {confirmDialog && <ConfirmModal message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {/* Top toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '0 18px',
        height: 60,
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(15,42,92,0.03)',
      }}>
        {/* Pipeline selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 22, paddingRight: 18, borderRight: '1px solid var(--border)', height: 40 }}>
          <span style={{ width: 6, height: 24, borderRadius: 3, background: 'linear-gradient(180deg, #1a3c8f, #67e8f9)' }} />
          {pipelines.length > 1 ? (
            <select
              value={activePipeline || ''}
              onChange={e => { const pid = Number(e.target.value); setActivePipeline(pid); cargar(pid); }}
              style={{ background: 'none', border: 'none', outline: 'none', color: '#1a3c8f', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {pipelines.map(p => <option key={p.id} value={p.id} style={{ background: 'var(--surface)', color: 'var(--text)' }}>{p.name}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1a3c8f', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {pipeline?.name || 'VENTAS SOLAR'}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          )}
        </div>

        {/* View toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 14, padding: 3, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {[
            { v: 'kanban', icon: <IconKanban active={desktopView === 'kanban'} /> },
            { v: 'lista', icon: <IconLista active={desktopView === 'lista'} /> },
            { v: 'tabla', icon: <IconTabla active={desktopView === 'tabla'} /> },
          ].map(({ v, icon }) => (
            <button key={v} onClick={() => changeView(v)}
              style={{ padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: desktopView === v ? '#1a3c8f' : 'transparent', color: desktopView === v ? '#fff' : 'var(--muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginRight: 10 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search', lang)}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px 7px 30px', fontSize: 12.5, color: 'var(--text)', outline: 'none', width: 220, transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#1a3c8f'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,60,143,0.10)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Filtros button */}
        <button
          onClick={() => setFilterOpen(f => !f)}
          title="Filtros avanzados"
          style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 12px', borderRadius: 8, border: `1px solid ${filterOpen || activeFilterCount > 0 ? '#1a3c8f' : 'var(--border)'}`, background: filterOpen || activeFilterCount > 0 ? 'rgba(26,60,143,0.10)' : 'var(--bg)', color: filterOpen || activeFilterCount > 0 ? '#1a3c8f' : 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginRight: 14, transition: 'all 0.15s' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2"/></svg>
          Filtros
          {activeFilterCount > 0 && (
            <span style={{ background: '#1a3c8f', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>
          )}
        </button>

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginRight: 'auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 11px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a3c8f" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span style={{ color: '#1a3c8f', fontWeight: 700 }}>{leadsDelPipeline.length}</span> leads
          </span>
          {totalValue > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 999, padding: '4px 11px' }}>
              <span style={{ color: '#10b981', fontWeight: 700 }}>${totalValue.toLocaleString()}</span> total
            </span>
          )}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleSelectMode}
            style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: `1px solid ${selectMode ? '#67e8f9' : 'var(--border)'}`, background: selectMode ? 'rgba(103,232,249,0.15)' : 'var(--bg)', color: selectMode ? '#0e7490' : 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
            {selectMode ? `× ${t('common.cancel', lang)}` : t('leads.select', lang)}
          </button>
          <button onClick={exportCSV}
            title="Exportar CSV"
            style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            CSV
          </button>
          <button onClick={() => setModal('new')}
            style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #1a3c8f, #0f2a5c)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(26,60,143,0.25)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(26,60,143,0.32)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(26,60,143,0.25)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            {t('leads.newLead', lang)}
          </button>
        </div>
      </div>

      {/* Content area (filter panel + main) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

      {/* ─── Kommo-style filter panel ─────────────────────────────────── */}
      {filterOpen && (
        <div style={{
          width: 240, flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Panel header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filtros</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setFilterResponsable(''); setFilterEtapas(new Set()); setFilterSmallGroup(false); setFilterDormidos(false); setFilterTags(new Set()); }}
                  style={{ fontSize: 11, color: '#1b9af5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Limpiar
                </button>
              )}
              <button onClick={() => setFilterOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          </div>

          {/* Nombre del lead */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Nombre del lead</div>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px 6px 24px', fontSize: 12, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Responsable */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Responsable del lead</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="resp" checked={filterResponsable === ''} onChange={() => setFilterResponsable('')} style={{ accentColor: '#1b9af5' }} />
                <span style={{ fontSize: 12, color: 'var(--text)' }}>Todos</span>
              </label>
              {agents.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="resp" checked={String(filterResponsable) === String(a.id)} onChange={() => setFilterResponsable(a.id)} style={{ accentColor: '#1b9af5' }} />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{a.name}</span>
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="resp" checked={filterResponsable === 'none'} onChange={() => setFilterResponsable('none')} style={{ accentColor: '#1b9af5' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin responsable</span>
              </label>
            </div>
          </div>

          {/* Etapa */}
          {pipeline?.stages && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Etapa</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pipeline.stages.map(s => {
                  const cnt = leadsDelPipeline.filter(l => l.stage_id === s.id).length;
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={filterEtapas.has(s.id)}
                        onChange={() => {
                          setFilterEtapas(prev => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                            return next;
                          });
                        }}
                        style={{ accentColor: '#1b9af5' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{cnt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {allTags.length > 0 && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Etiquetas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allTags.map(tag => (
                  <label key={tag.tag} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filterTags.has(tag.tag)}
                      onChange={() => toggleFilterTag(tag.tag)}
                      style={{ accentColor: tag.color || '#1b9af5' }}
                    />
                    <span style={{ fontSize: 12, color: tag.color || 'var(--text)', flex: 1 }}>🏷 {tag.tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Otros filtros rápidos */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Otros</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={filterSmallGroup} onChange={() => setFilterSmallGroup(f => !f)} style={{ accentColor: '#f59e0b' }} />
                <span style={{ fontSize: 12, color: 'var(--text)' }}>👥 Grupos ≤4 personas</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={filterDormidos} onChange={() => setFilterDormidos(f => !f)} style={{ accentColor: '#ef4444' }} />
                <span style={{ fontSize: 12, color: 'var(--text)' }}>😴 Sin actividad +7 días</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Main content wrapper */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={desktopView === 'kanban' ? kanbanRef : null}
        className={`${desktopView === 'kanban' ? 'flex gap-3 overflow-x-auto pb-4' : 'overflow-y-auto pb-4'} flex-1`}
        style={{
          padding: desktopView === 'kanban' ? '16px 16px 80px' : '16px',
          paddingBottom: selectMode && selectedIds.size > 0 ? 80 : undefined,
          cursor: desktopView === 'kanban' ? 'grab' : undefined,
          WebkitOverflowScrolling: desktopView === 'kanban' ? 'touch' : undefined,
        }}
        onMouseDown={desktopView === 'kanban' ? onKanbanMouseDown : undefined}
        onMouseMove={desktopView === 'kanban' ? onKanbanMouseMove : undefined}
        onMouseUp={desktopView === 'kanban' ? onKanbanMouseUp : undefined}
        onMouseLeave={desktopView === 'kanban' ? onKanbanMouseUp : undefined}
      >
        {loading ? (
          <div className="flex items-center justify-center w-full text-muted text-sm gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            {t('common.loading', lang)}
          </div>
        ) : desktopView === 'kanban' ? (
          pipeline?.stages?.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsParaKanban.filter(l => l.stage_id === stage.id)}
              onMove={mover}
              onEdit={lead => setModal(lead)}
              onDelete={eliminar}
              onOpen={id => setPanelLeadId(id)}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              unreadByLead={unreadByLead}
            />
          ))
        ) : desktopView === 'lista' ? (
          <ListaView
            leads={leadsFiltrados}
            onOpen={id => setPanelLeadId(id)}
            onEdit={lead => setModal(lead)}
            onDelete={eliminar}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ) : (
          <TablaView
            leads={leadsFiltrados}
            onOpen={id => setPanelLeadId(id)}
            onEdit={lead => setModal(lead)}
            onDelete={eliminar}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>
      </div>{/* end main content wrapper */}
      </div>{/* end content area flex row */}

      {/* Bulk action floating pill */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 90,
          background: 'linear-gradient(135deg, #0f2a5c, #1a3c8f)',
          borderRadius: 999, padding: '8px 10px 8px 22px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 12px 32px -6px rgba(15,42,92,0.45), 0 2px 6px rgba(15,42,92,0.18)',
          border: '1px solid rgba(103,232,249,0.25)',
          maxWidth: '95vw', flexWrap: 'wrap',
        }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ background: '#67e8f9', color: '#0f2a5c', borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 800 }}>{selectedIds.size}</span>
            seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.15)' }} />
          <select
            value={bulkStageId}
            onChange={e => setBulkStageId(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '6px 12px', color: '#fff', fontSize: 12.5, outline: 'none', cursor: 'pointer' }}
          >
            <option value="" style={{ color: '#1a3c8f' }}>Mover a etapa...</option>
            {allPipelineStages.map(s => <option key={s.id} value={s.id} style={{ color: '#1a3c8f' }}>{s.name}</option>)}
          </select>
          <button
            onClick={bulkMoveStage}
            disabled={!bulkStageId || bulkLoading}
            style={{ background: '#67e8f9', border: 'none', borderRadius: 999, padding: '7px 14px', color: '#0f2a5c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: (!bulkStageId || bulkLoading) ? 0.5 : 1 }}
          >
            {bulkLoading ? 'Moviendo...' : 'Mover'}
          </button>
          <button
            onClick={() => setBulkMsgModal(true)}
            style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '7px 14px', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Mensaje
          </button>
          <button
            onClick={bulkDelete}
            disabled={bulkLoading}
            style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 999, padding: '7px 14px', color: '#fecaca', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            {bulkLoading ? '...' : 'Eliminar'}
          </button>
          <button
            onClick={toggleSelectMode}
            title="Cancelar"
            style={{ background: 'none', border: 'none', borderRadius: 999, padding: '6px 8px', color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}
          >×</button>
        </div>
      )}

      {modal && (
        <LeadModal lead={modal === 'new' ? null : modal} pipelines={pipelines} agents={agents}
          onClose={() => setModal(null)} onSaved={cargar} />
      )}
      {panelLeadId && (
        <LeadPanel leadId={panelLeadId} pipelines={pipelines} agents={agents}
          onClose={() => setPanelLeadId(null)} onUpdated={cargar} />
      )}

      {/* ── Lost Reason Modal ─────────────────────────────────────────────── */}
      {lostModal && (
        <div onClick={() => setLostModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 'min(400px, 92vw)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>¿Por qué se perdió este lead?</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>Esta información ayuda a mejorar el proceso de ventas.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {['Precio muy alto','Sin presupuesto','Eligió competencia','No respondió','Fecha no disponible','Cambió de planes'].map(r => (
                <button key={r} onClick={() => setLostReason(r)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: `1px solid ${lostReason === r ? '#ef4444' : 'var(--border)'}`, background: lostReason === r ? 'rgba(239,68,68,0.15)' : 'var(--bg)', color: lostReason === r ? '#ef4444' : 'var(--muted)', cursor: 'pointer' }}>
                  {r}
                </button>
              ))}
            </div>
            <input value={lostReason} onChange={e => setLostReason(e.target.value)}
              placeholder="O escribe tu propio motivo..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setLostModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={confirmarLost} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Confirmar pérdida</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Message Modal ────────────────────────────────────────────── */}
      {bulkMsgModal && (
        <div onClick={() => setBulkMsgModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 'min(440px, 92vw)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Enviar mensaje masivo</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>Se enviará a <strong style={{ color: 'var(--text)' }}>{selectedIds.size}</strong> leads seleccionados.</div>
            <textarea value={bulkMsgText} onChange={e => setBulkMsgText(e.target.value)} rows={4}
              placeholder="Escribe el mensaje aquí..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setBulkMsgModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={enviarMensajeMasivo} disabled={!bulkMsgText.trim() || bulkMsgSending}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (!bulkMsgText.trim() || bulkMsgSending) ? 0.5 : 1 }}>
                {bulkMsgSending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
