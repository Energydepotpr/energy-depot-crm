'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';
import { useAuth } from '../../../lib/auth';

const BG   = 'var(--bg)';
const SURF = 'var(--surface)';
const SURF2= 'var(--surface2)';
const BRD  = 'var(--border)';
const TEXT = 'var(--text)';
const MUTED= 'var(--muted)';
const ACCENT= 'var(--accent)';

function tiempoRelativo(ts, lang = 'es') {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diff = now - date;
  const min = Math.floor(diff / 60000);
  // Same day: show "Hoy H:MMam/pm" like Kommo
  if (date.toDateString() === now.toDateString()) {
    return 'Hoy ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  const d = Math.floor(diff / 86400000);
  if (d === 1) return 'Ayer';
  if (d < 7) return date.toLocaleDateString('es', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
}

function channelIcon(ch) {
  if (ch === 'whatsapp') return { icon: '●', color: '#25d366' };
  if (ch === 'web')      return { icon: '●', color: '#1b9af5' };
  if (ch === 'email')    return { icon: '●', color: '#f97316' };
  return { icon: '●', color: '#7880a0' };
}

function SidebarField({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, color: MUTED, lineHeight: 1 }}>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange?.(e.target.value)}
        style={{ background: 'var(--bg)', border: `1px solid ${BRD}`, borderRadius: 5, padding: '4px 6px', fontSize: 12, color: TEXT, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
      />
    </div>
  );
}

// ── Panel de chat derecho (estilo Kommo) ─────────────────────────────────────
function ChatRight({ item, onClose, showBack = false, onSent, onRead }) {
  const { lang } = useLang();
  const [messages, setMessages] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState('auto');
  const [showQR, setShowQR] = useState(false);
  const [qrFilter, setQrFilter] = useState('');
  const [translating, setTranslating] = useState(false);
  const [wasTranslated, setWasTranslated] = useState(false);
  const [translations, setTranslations] = useState({});
  const [resumen, setResumen] = useState(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [showResumen, setShowResumen] = useState(false);
  const [showAsistente, setShowAsistente] = useState(false);
  const [asistenteMessages, setAsistenteMessages] = useState([]);
  const [asistenteInput, setAsistenteInput] = useState('');
  const [asistenteLoading, setAsistenteLoading] = useState(false);
  const asistenteBottomRef = useRef(null);
  const asistenteInputRef = useRef(null);
  const [leadInfoOpen, setLeadInfoOpen] = useState(true);
  const [leadData, setLeadData] = useState(null);
  const [tripData, setTripData] = useState({});
  const [tagsData, setTagsData] = useState([]);
  const [notesData, setNotesData] = useState([]);
  const [tripDirty, setTripDirty] = useState(false);
  const tripSaveTimer = useRef(null);

  const generarResumen = async () => {
    if (resumenLoading) return;
    if (resumen) { setShowResumen(p => !p); return; }
    setResumenLoading(true);
    setShowResumen(true);
    try {
      const data = await api.leadResumen(item.lead_id);
      setResumen(data.resumen);
    } catch (e) {
      setResumen('Error: ' + (e.message || 'No se pudo generar el resumen'));
    } finally {
      setResumenLoading(false);
    }
  };

  const enviarAsistente = async (txt) => {
    const msg = (txt || asistenteInput).trim();
    if (!msg || asistenteLoading) return;
    const newMsgs = [...asistenteMessages, { role: 'user', text: msg }];
    setAsistenteMessages(newMsgs);
    setAsistenteInput('');
    setAsistenteLoading(true);
    try {
      const { text: reply } = await api.assistant(newMsgs, item.lead_id);
      setAsistenteMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (e) {
      setAsistenteMessages(prev => [...prev, { role: 'model', text: '⚠️ ' + (e.message || 'Error') }]);
    } finally {
      setAsistenteLoading(false);
      setTimeout(() => asistenteInputRef.current?.focus(), 50);
    }
  };

  useEffect(() => { asistenteBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [asistenteMessages]);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const cargar = (silent = false) => {
    if (!silent) setMessages(null);
    api.messages(item.lead_id).then(setMessages).catch(() => setMessages([]));
  };

  useEffect(() => {
    cargar();
    api.quickReplies().then(setQuickReplies).catch(() => {});
    setResumen(null);
    setShowResumen(false);
    setShowAsistente(false);
    setAsistenteMessages([]);
    setAsistenteInput('');
  }, [item.lead_id]);
  // Real-time chat updates via SSE + 60s fallback
  useEffect(() => {
    const poll = setInterval(() => cargar(true), 60000);
    let es;
    try {
      const token = localStorage.getItem('crm_token');
      const base = typeof window !== 'undefined' ? '/backend' : '';
      es = new EventSource(`${base}/api/events?token=${encodeURIComponent(token)}`);
      es.addEventListener('new_message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.lead_id === item.lead_id) cargar(true);
        } catch {}
      });
    } catch {}
    return () => { clearInterval(poll); es?.close(); };
  }, [item.lead_id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load lead info when conversation changes
  useEffect(() => {
    if (!item.lead_id) return;
    setLeadData(null);
    setTripData({});
    setTagsData([]);
    setNotesData([]);
    setTripDirty(false);
    api.lead(item.lead_id).then(d => setLeadData(d?.data || d)).catch(() => {});
    api.tripInfo(item.lead_id).then(d => { setTripData(d || {}); setTripDirty(false); }).catch(() => {});
    api.tags(item.lead_id).then(d => setTagsData(d || [])).catch(() => {});
    api.notes(item.lead_id).then(d => setNotesData(d || [])).catch(() => {});
  }, [item.lead_id]);

  // Auto-save trip info with 1.5s debounce
  useEffect(() => {
    if (!tripDirty || !item.lead_id) return;
    clearTimeout(tripSaveTimer.current);
    tripSaveTimer.current = setTimeout(async () => {
      try { await api.saveTripInfo(item.lead_id, tripData); setTripDirty(false); } catch {}
    }, 1500);
    return () => clearTimeout(tripSaveTimer.current);
  }, [tripData, tripDirty, item.lead_id]);

  const enviar = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const ch = channel === 'auto' ? null : channel;
      const msg = await api.sendMessage(item.lead_id, text.trim(), ch);
      setMessages(prev => [...(prev || []), msg]);
      setText('');
      setWasTranslated(false);
      onSent?.(item.lead_id);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) { alert(e.message); }
    finally { setSending(false); }
  };

  const insertarRespuesta = (r) => {
    let txt = r.text;
    const nombre = item.contact_name || '';
    txt = txt
      .replace(/\{\{nombre\}\}/gi, nombre)
      .replace(/\{\{telefono\}\}/gi, item.contact_phone || '')
      .replace(/\{\{fecha\}\}/gi, '')
      .replace(/\{\{checkin\}\}/gi, '');
    setText(txt);
    setShowQR(false);
    setQrFilter('');
  };

  const traducir = async () => {
    if (!text.trim() || translating) return;
    setTranslating(true);
    try {
      const { translated } = await api.translate(text.trim(), 'en');
      setText(translated);
      setWasTranslated(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) { alert('Error al traducir: ' + e.message); }
    finally { setTranslating(false); }
  };

  const initials = (name) => (name || '?')[0].toUpperCase();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'row', background: BG, minWidth: 0, overflow: 'hidden' }}>

      {/* ── LEFT: Lead Info Panel ─────────────────────────────────────────────── */}
      <div style={{ width: leadInfoOpen ? 280 : 0, overflowY: leadInfoOpen ? 'auto' : 'hidden', overflowX: 'hidden', flexShrink: 0, background: SURF, borderRight: leadInfoOpen ? `1px solid ${BRD}` : 'none', transition: 'width 0.2s ease' }}>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Panel header */}
          <div style={{ padding: '0 14px', height: 56, borderBottom: `1px solid ${BRD}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxSizing: 'border-box' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Lead Info</span>
            {item.lead_id && (
              <a href={`/leads?open=${item.lead_id}`} style={{ fontSize: 10, color: ACCENT, textDecoration: 'none' }}>
                Full lead →
              </a>
            )}
          </div>

          {!leadData ? (
            <div style={{ padding: 16, color: MUTED, fontSize: 12 }}>Loading...</div>
          ) : (
            <>
              {/* Contact */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BRD}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Contact</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{leadData.contact_name || '—'}</div>
                  {leadData.contact_phone && (
                    <a href={`tel:${leadData.contact_phone}`} style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      📞 {leadData.contact_phone}
                    </a>
                  )}
                  {leadData.contact_email && (
                    <div style={{ fontSize: 11, color: MUTED, wordBreak: 'break-all' }}>{leadData.contact_email}</div>
                  )}
                  {leadData.value > 0 && (
                    <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>${Number(leadData.value).toLocaleString()}</div>
                  )}
                </div>
              </div>

              {/* Trip Info */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BRD}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Trip Info</span>
                  {tripDirty && <span style={{ fontSize: 9, color: MUTED, fontWeight: 400 }}>● saving...</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SidebarField label="Hotel / Airbnb" value={tripData.hotel} onChange={v => { setTripData(p => ({...p, hotel: v})); setTripDirty(true); }} />
                  <SidebarField label="Host" value={tripData.host} onChange={v => { setTripData(p => ({...p, host: v})); setTripDirty(true); }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <SidebarField label="Check-in" type="date" value={tripData.check_in} onChange={v => { setTripData(p => ({...p, check_in: v})); setTripDirty(true); }} />
                    <SidebarField label="Check-out" type="date" value={tripData.check_out} onChange={v => { setTripData(p => ({...p, check_out: v})); setTripDirty(true); }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <SidebarField label="People" type="number" value={tripData.people} onChange={v => { setTripData(p => ({...p, people: v})); setTripDirty(true); }} />
                    <SidebarField label="Adults" type="number" value={tripData.adults} onChange={v => { setTripData(p => ({...p, adults: v})); setTripDirty(true); }} />
                  </div>
                  <SidebarField label="Kids" type="number" value={tripData.kids} onChange={v => { setTripData(p => ({...p, kids: v})); setTripDirty(true); }} />
                  <SidebarField label="Interests" value={tripData.interests} onChange={v => { setTripData(p => ({...p, interests: v})); setTripDirty(true); }} />
                  <SidebarField label="Special Notes" value={tripData.special_notes} onChange={v => { setTripData(p => ({...p, special_notes: v})); setTripDirty(true); }} />
                </div>
              </div>

              {/* Tags */}
              {tagsData.length > 0 && (
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Tags</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tagsData.map(tag => (
                      <span key={tag.tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: tag.color ? `${tag.color}22` : 'rgba(27,154,245,0.15)', color: tag.color || ACCENT, border: `1px solid ${tag.color ? tag.color + '44' : 'rgba(27,154,245,0.3)'}` }}>
                        {tag.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setLeadInfoOpen(o => !o)}
        title={leadInfoOpen ? 'Collapse info' : 'Expand info'}
        style={{ flexShrink: 0, width: 14, border: 'none', background: SURF, borderRight: `1px solid ${BRD}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
        onMouseLeave={e => e.currentTarget.style.background = SURF}
      >
        <svg width="8" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 8 12">
          {leadInfoOpen ? <path d="M6 2L2 6L6 10"/> : <path d="M2 2L6 6L2 10"/>}
        </svg>
      </button>

      {/* ── RIGHT: Chat ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Chat header */}
      <div style={{ padding: '0 20px', height: 56, borderBottom: `1px solid ${BRD}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: SURF }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showBack && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
          )}
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#2a3a6e', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
            {initials(item.contact_name)}
          </div>
          <div>
            <div style={{ color: TEXT, fontWeight: 600, fontSize: 14 }}>{item.contact_name || 'Sin nombre'}</div>
            <div style={{ color: MUTED, fontSize: 11 }}>{item.lead_title || `Conversación Nº ${item.lead_id}`}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Toggle lead info panel */}
          {item.lead_id && (
            <button onClick={() => setLeadInfoOpen(o => !o)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${leadInfoOpen ? 'rgba(0,201,167,0.6)' : 'rgba(0,201,167,0.3)'}`,
              background: leadInfoOpen ? 'rgba(0,201,167,0.18)' : 'rgba(0,201,167,0.07)',
              color: '#00c9a7', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
            }}>👤 {leadInfoOpen ? 'Hide Info' : 'Lead Info'}</button>
          )}
          {/* Mark as read */}
          {item.lead_id && (
            <button onClick={() => onRead?.(item.lead_id)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid rgba(16,185,129,0.35)`,
              background: 'rgba(16,185,129,0.08)',
              color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
            }}>✓ Mark as read</button>
          )}
          {/* Resumen IA */}
          <button onClick={generarResumen} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${showResumen ? '#8b5cf6' : BRD}`,
            background: showResumen ? 'rgba(139,92,246,0.15)' : 'transparent',
            color: showResumen ? '#8b5cf6' : MUTED,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {resumenLoading
              ? <span style={{ width: 10, height: 10, border: `1.5px solid #8b5cf6`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
              : '✦'
            }
            Resumen IA
          </button>
          {/* Asistente IA */}
          <button onClick={() => { setShowAsistente(p => !p); setShowResumen(false); }} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${showAsistente ? '#1b9af5' : BRD}`,
            background: showAsistente ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: showAsistente ? '#1b9af5' : MUTED,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>✦ Asistente</button>
          {/* Canal selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ k: 'auto', l: 'Auto' }, { k: 'sms', l: 'SMS' }, { k: 'whatsapp', l: 'WA' }].map(c => (
              <button key={c.k} onClick={() => setChannel(c.k)} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 4, border: `1px solid ${channel === c.k ? ACCENT : BRD}`,
                background: channel === c.k ? `rgba(59,130,246,0.15)` : 'transparent',
                color: channel === c.k ? ACCENT : MUTED, cursor: 'pointer',
              }}>{c.l}</button>
            ))}
          </div>
          {!showBack && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 20, lineHeight: 1 }}>✕</button>}
        </div>
      </div>

      {/* Panel resumen IA */}
      {showResumen && (
        <div style={{
          borderBottom: `1px solid rgba(139,92,246,0.3)`,
          background: 'rgba(139,92,246,0.08)',
          padding: '10px 20px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', letterSpacing: 0.5 }}>✦ RESUMEN IA</span>
            <button onClick={() => { setResumen(null); setShowResumen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 14, padding: 0 }}>↺ Regenerar</button>
          </div>
          {resumenLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, border: `2px solid #8b5cf6`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
              Analizando conversación...
            </div>
          ) : (
            <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{resumen}</div>
          )}
        </div>
      )}

      {/* Panel Asistente IA */}
      {showAsistente && (
        <div style={{ borderBottom: `1px solid rgba(59,130,246,0.3)`, background: 'rgba(59,130,246,0.05)', flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 6px', borderBottom: `1px solid rgba(59,130,246,0.15)` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1b9af5', letterSpacing: 0.5 }}>✦ ASISTENTE IA — {item.contact_name}</span>
            <button onClick={() => setAsistenteMessages([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 11, padding: 0 }}>Limpiar</button>
          </div>
          {/* Mensajes asistente */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {asistenteMessages.length === 0 && (
              <div style={{ fontSize: 11, color: MUTED, textAlign: 'center', paddingTop: 8 }}>
                Pregúntame sobre {item.contact_name} — ya tengo el contexto de este cliente.
              </div>
            )}
            {asistenteMessages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? 'rgba(59,130,246,0.2)' : SURF,
                  border: m.role === 'user' ? '1px solid rgba(59,130,246,0.35)' : `1px solid ${BRD}`,
                  borderRadius: m.role === 'user' ? '12px 3px 12px 12px' : '3px 12px 12px 12px',
                  padding: '7px 11px', color: TEXT,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {asistenteLoading && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: MUTED, animation: `bounce 1s ${i*0.15}s infinite` }} />)}
              </div>
            )}
            <div ref={asistenteBottomRef} />
          </div>
          {/* Input asistente */}
          <div style={{ display: 'flex', gap: 8, padding: '6px 20px 10px', alignItems: 'center' }}>
            <input
              ref={asistenteInputRef}
              value={asistenteInput}
              onChange={e => setAsistenteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarAsistente(); } }}
              placeholder="Pregunta sobre este cliente..."
              style={{ flex: 1, background: SURF, border: `1px solid ${BRD}`, borderRadius: 8, padding: '6px 12px', color: TEXT, fontSize: 12, outline: 'none' }}
            />
            <button onClick={() => enviarAsistente()} disabled={!asistenteInput.trim() || asistenteLoading} style={{
              background: asistenteInput.trim() && !asistenteLoading ? '#1b9af5' : BRD,
              border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: asistenteInput.trim() && !asistenteLoading ? 'pointer' : 'not-allowed',
            }}>Enviar</button>
          </div>
        </div>
      )}

      {/* Mensajes + Notas (timeline combinado) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages === null && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: MUTED, fontSize: 13, gap: 8 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${ACCENT}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            Cargando...
          </div>
        )}
        {messages?.length === 0 && notesData.length === 0 && <div style={{ color: MUTED, textAlign: 'center', marginTop: 40, fontSize: 13 }}>Sin mensajes</div>}
        {messages && (() => {
          const timeline = [
            ...messages.map(m => ({ ...m, _type: 'msg' })),
            ...notesData.map(n => ({ ...n, _type: 'note' })),
          ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          return timeline.map((entry) => {
            if (entry._type === 'note') {
              return (
                <div key={`note-${entry.id}`} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                  <div style={{ width: '82%', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)', borderLeft: '3px solid #f59e0b', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706' }}>📝 Nota</span>
                      {entry.user_name && <span style={{ fontSize: 10, color: MUTED }}>— {entry.user_name}</span>}
                      <span style={{ fontSize: 10, color: MUTED, marginLeft: 'auto' }}>{tiempoRelativo(entry.created_at, lang)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{entry.text}</div>
                  </div>
                </div>
              );
            }
            const m = entry;
            const msgKey = m.id || m.twilio_sid;
            const entrante = m.direction === 'inbound';
            const tr = translations[msgKey];
            const toggleTranslate = async () => {
              if (tr?.text) { setTranslations(p => { const n = {...p}; delete n[msgKey]; return n; }); return; }
              setTranslations(p => ({ ...p, [msgKey]: { loading: true } }));
              try {
                const { translated } = await api.translate(m.text, 'es');
                setTranslations(p => ({ ...p, [msgKey]: { text: translated } }));
              } catch { setTranslations(p => { const n = {...p}; delete n[msgKey]; return n; }); }
            };
            return (
            <div key={`msg-${msgKey}`} style={{ display: 'flex', justifyContent: entrante ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '72%',
                background: entrante ? SURF2 : m.is_bot ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.25)',
                border: entrante ? `1px solid ${BRD}` : m.is_bot ? '1px solid rgba(139,92,246,0.4)' : `1px solid rgba(59,130,246,0.4)`,
                borderRadius: entrante ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                padding: '10px 14px',
              }}>
                <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                {/* Media thumbnails */}
                {Array.isArray(m.media_urls) && m.media_urls.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {m.media_urls.map((media, mi) => {
                      const isImage = (media.contentType || '').startsWith('image/');
                      if (isImage) {
                        return (
                          <a key={mi} href={media.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={media.url}
                              alt={`media-${mi}`}
                              style={{
                                maxWidth: 200, maxHeight: 200, borderRadius: 8,
                                cursor: 'pointer', display: 'block',
                                border: `1px solid rgba(255,255,255,0.1)`,
                              }}
                            />
                          </a>
                        );
                      }
                      // Non-image media: show a download link
                      return (
                        <a key={mi} href={media.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: ACCENT, textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4 }}>
                          📎 Archivo adjunto ({media.contentType || 'archivo'})
                        </a>
                      );
                    })}
                  </div>
                )}
                {/* Translation block */}
                {entrante && tr?.loading && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BRD}`, fontSize: 11, color: MUTED, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, border: `1.5px solid ${MUTED}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                    Traduciendo...
                  </div>
                )}
                {entrante && tr?.text && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BRD}` }}>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>🌐 Traducción (ES)</div>
                    <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{tr.text}</div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: entrante ? 'flex-start' : 'flex-end', gap: 6, marginTop: 4 }}>
                  {!entrante && (
                    <span style={{ fontSize: 10, color: m.is_bot ? 'rgba(139,92,246,0.7)' : 'rgba(59,130,246,0.7)' }}>
                      {m.is_bot ? 'Bot IA' : (m.sent_by_name || 'Agente')} ✓ Entregado
                    </span>
                  )}
                  {entrante && m.channel && (
                    <span style={{ fontSize: 10, color: channelIcon(m.channel).color }}>{m.channel}</span>
                  )}
                  {entrante && (
                    <button onClick={toggleTranslate} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: tr?.text ? ACCENT : MUTED, padding: '0 2px' }}>
                      🌐 {tr?.text ? 'Ocultar' : 'Traducir'}
                    </button>
                  )}
                  <span style={{ fontSize: 10, color: MUTED }}>{tiempoRelativo(m.created_at, lang)}</span>
                </div>
              </div>
            </div>
          );
          });
        })()}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQR && quickReplies.length > 0 && (
        <div style={{ borderTop: `1px solid ${BRD}`, background: SURF, maxHeight: 220, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${BRD}`, flexShrink: 0 }}>
            <input
              autoFocus
              value={qrFilter}
              onChange={e => setQrFilter(e.target.value)}
              placeholder="Buscar... (variables: {{nombre}}, {{fecha}}, {{telefono}})"
              style={{ width: '100%', background: 'var(--surface2)', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, color: TEXT, outline: 'none' }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {(() => {
              const filtered = quickReplies.filter(r => !qrFilter || r.title.toLowerCase().includes(qrFilter.toLowerCase()) || r.text.toLowerCase().includes(qrFilter.toLowerCase()));
              const categories = [...new Set(filtered.map(r => r.category || 'General'))];
              return categories.map(cat => (
                <div key={cat}>
                  <div style={{ padding: '4px 12px 2px', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</div>
                  {filtered.filter(r => (r.category || 'General') === cat).map(r => (
                    <button key={r.id} onClick={() => insertarRespuesta(r)} style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${BRD}` }}>
                      <div style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{r.title}</div>
                      <div style={{ color: MUTED, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text.slice(0, 80)}</div>
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Input — estilo Kommo */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${BRD}`, background: SURF }}>
        <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${BRD}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: ACCENT, fontSize: 12, fontWeight: 500 }}>Chat</span>
          <span style={{ color: MUTED, fontSize: 12 }}>para</span>
          <span style={{ color: ACCENT, fontSize: 12, fontWeight: 500 }}>{item.contact_name} ({item.lead_id})</span>
          {quickReplies.length > 0 && (
            <button onClick={() => setShowQR(p => !p)} style={{ marginLeft: 4, background: showQR ? `rgba(59,130,246,0.15)` : 'none', border: `1px solid ${showQR ? ACCENT : BRD}`, borderRadius: 4, padding: '2px 6px', color: showQR ? ACCENT : MUTED, fontSize: 11, cursor: 'pointer' }}>
              ⚡ Plantillas
            </button>
          )}
          <button
            onClick={traducir}
            disabled={translating || !text.trim()}
            title="Traducir al inglés (ES → EN)"
            style={{ marginLeft: 4, background: wasTranslated ? 'rgba(16,185,129,0.15)' : 'none', border: `1px solid ${wasTranslated ? '#10b981' : BRD}`, borderRadius: 4, padding: '2px 8px', color: wasTranslated ? '#10b981' : MUTED, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: (!text.trim() || translating) ? 0.5 : 1 }}
          >
            {translating
              ? <span style={{ width: 10, height: 10, border: `1.5px solid ${MUTED}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
              : '🌐'
            }
            {wasTranslated ? 'Traducido ✓' : 'ES → EN'}
          </button>
          <span style={{ marginLeft: 'auto', color: MUTED, fontSize: 11 }}>Conversación Nº {item.lead_id}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 12px 12px', gap: 8 }}>
          <textarea
            ref={inputRef}
            rows={2}
            value={text}
            onChange={e => { setText(e.target.value); setWasTranslated(false); }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }}
            placeholder="Escribe en español y usa 🌐 ES→EN para traducir..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: TEXT, fontSize: 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              placeholder: MUTED,
            }}
          />
          <button onClick={enviar} disabled={sending || !text.trim()} style={{
            background: text.trim() && !sending ? ACCENT : BRD,
            border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}>
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>{/* end RIGHT Chat */}
    </div>
  );
}

// ── Team Chat Panel ──────────────────────────────────────────────────────────
function TeamChatPanel({ onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const cargar = useCallback((silent = false) => {
    api.teamChat().then(msgs => setMessages(msgs)).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    const poll = setInterval(cargar, 15000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const enviar = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api.sendTeamMessage(text.trim());
      setMessages(prev => [...prev, msg]);
      setText('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) { alert(e.message); }
    finally { setSending(false); }
  };

  const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const AVATAR_COLORS = ['#1b9af5', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  const avatarColor = (name) => AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, minWidth: 0 }}>
      {/* Header */}
      <div style={{ height: 56, padding: '0 20px', borderBottom: `1px solid ${BRD}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: SURF }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(27,154,245,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" fill="none" stroke={ACCENT} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <div>
            <div style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>Menciones &amp; Chats de Equipo</div>
            <div style={{ color: MUTED, fontSize: 11 }}>Chat interno del equipo Fix A Trip</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 20, lineHeight: 1 }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ color: MUTED, textAlign: 'center', marginTop: 60, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
            Sin mensajes aún. ¡Sé el primero en escribir!
          </div>
        )}
        {messages.map((m, i) => {
          const isMe = m.user_id === user?.id || m.user_name === user?.name;
          const showAvatar = i === 0 || messages[i - 1]?.user_name !== m.user_name;
          const showName = showAvatar && !isMe;
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
              {/* Avatar */}
              {!isMe && (
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(m.user_name), flexShrink: 0, display: showAvatar ? 'flex' : 'block', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, opacity: showAvatar ? 1 : 0 }}>
                  {showAvatar ? initials(m.user_name) : ''}
                </div>
              )}
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {showName && <span style={{ fontSize: 10, color: MUTED, marginBottom: 2, paddingLeft: 4 }}>{m.user_name}</span>}
                <div style={{
                  background: isMe ? 'rgba(27,154,245,0.25)' : SURF2,
                  border: isMe ? '1px solid rgba(27,154,245,0.4)' : `1px solid ${BRD}`,
                  borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  padding: '9px 13px',
                  color: TEXT, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
                <span style={{ fontSize: 10, color: MUTED, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                  {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${BRD}`, background: SURF, padding: '10px 16px 12px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }}
            placeholder="Escribe un mensaje al equipo... (Ctrl+Enter para enviar)"
            style={{ flex: 1, background: SURF2, border: `1px solid ${BRD}`, borderRadius: 10, padding: '8px 12px', color: TEXT, fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <button onClick={enviar} disabled={!text.trim() || sending} style={{
            background: text.trim() && !sending ? ACCENT : BRD,
            border: 'none', borderRadius: 10, padding: '8px 16px', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: text.trim() && !sending ? 'pointer' : 'not-allowed', flexShrink: 0,
          }}>
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Solo visible para el equipo</div>
      </div>
    </div>
  );
}

// ── Item de conversación (estilo Kommo) ──────────────────────────────────────
function ConvItem({ item, active, onClick, isUnread, lang = 'es' }) {
  const initial = (item.contact_name || '?')[0].toUpperCase();
  const ch = channelIcon(item.channel);

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
      cursor: 'pointer', borderBottom: `1px solid ${BRD}`,
      background: active ? SURF2 : isUnread ? 'rgba(0,201,167,0.06)' : 'transparent',
      borderLeft: isUnread && !active ? '3px solid #00c9a7' : '3px solid transparent',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = isUnread ? 'rgba(0,201,167,0.1)' : 'rgba(255,255,255,0.03)'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = isUnread ? 'rgba(0,201,167,0.06)' : 'transparent'; }}
    >
      {/* Avatar con canal badge */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#2a3a6e', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
          {initial}
        </div>
        {item.channel && (
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: '50%', background: SURF, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: ch.color, border: `1px solid ${BRD}` }}>
            {item.channel === 'whatsapp' ? '●' : item.channel === 'web' ? '●' : '●'}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badge + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ color: TEXT, fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.contact_name || 'Sin nombre'}
          </span>
          {/* Unread indicator */}
          {isUnread && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00c9a7', flexShrink: 0, display: 'inline-block' }} />
          )}
          {/* Lead badge estilo Kommo */}
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,201,167,0.15)', color: '#00c9a7', flexShrink: 0, letterSpacing: 0.5 }}>
            A{String(item.lead_id).padStart(4, '0')}
          </span>
          <span style={{ color: MUTED, fontSize: 10, flexShrink: 0 }}>{tiempoRelativo(item.created_at, lang)}</span>
        </div>
        {/* Preview */}
        <div style={{ color: MUTED, fontSize: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
          {item.direction === 'outbound' && <span style={{ color: item.is_bot ? 'rgba(139,92,246,0.8)' : 'rgba(59,130,246,0.8)', marginRight: 4, fontSize: 11 }}>{item.is_bot ? 'Bot IA' : 'Tú'}:</span>}
          {item.text || 'Sin mensajes'}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function InboxPage() {
  const { lang } = useLang();
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('reciente');
  const [filterChannel, setFilterChannel] = useState('all'); // all | whatsapp | web | email
  // Track leads marked as read — persisted in localStorage
  const [respondedLeads, setRespondedLeads] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('crm_read_leads') || '[]')); } catch { return new Set(); }
  });
  const markRead = (leadId) => {
    setRespondedLeads(prev => {
      const next = new Set([...prev, leadId]);
      try { localStorage.setItem('crm_read_leads', JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const [teamChatOpen, setTeamChatOpen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cargar = () => {
    api.inbox().then(d => { setInbox(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    const handler = () => cargar();
    window.addEventListener('crm:refresh', handler);
    return () => window.removeEventListener('crm:refresh', handler);
  }, []);

  useEffect(() => {
    cargar();
    // Fallback polling every 60s
    const poll = setInterval(() => api.inbox().then(setInbox).catch(() => {}), 60000);
    // SSE for instant inbox updates
    let es;
    try {
      const token = localStorage.getItem('crm_token');
      const base = typeof window !== 'undefined' ? '/backend' : '';
      es = new EventSource(`${base}/api/events?token=${encodeURIComponent(token)}`);
      es.addEventListener('new_message', () => {
        clearTimeout(window._crmInboxRefreshTimeout);
        window._crmInboxRefreshTimeout = setTimeout(() => {
          api.inbox().then(setInbox).catch(() => {});
        }, 500);
      });
    } catch {}
    return () => { clearInterval(poll); es?.close(); };
  }, []);

  let filtrados = inbox.filter(m =>
    (!search || m.contact_name?.toLowerCase().includes(search.toLowerCase()) || m.lead_title?.toLowerCase().includes(search.toLowerCase()) || m.text?.toLowerCase().includes(search.toLowerCase())) &&
    (sort !== 'entrantes' || m.direction === 'inbound') &&
    (sort !== 'salientes' || m.direction === 'outbound') &&
    (filterChannel === 'all' || m.channel === filterChannel)
  );
  if (sort === 'reciente' || sort === 'entrantes' || sort === 'salientes') filtrados = [...filtrados].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === 'antiguo') filtrados = [...filtrados].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else if (sort === 'az') filtrados = [...filtrados].sort((a, b) => (a.contact_name || '').localeCompare(b.contact_name || ''));
  else if (sort === 'za') filtrados = [...filtrados].sort((a, b) => (b.contact_name || '').localeCompare(a.contact_name || ''));

  const selectedItem = selected ? inbox.find(i => i.lead_id === selected) : null;

  // On mobile: show list OR chat, not both
  const showList = !isMobile || !selectedItem;
  const showChat = !isMobile || !!selectedItem;

  return (
    <div style={{ display: 'flex', height: isMobile ? 'calc(100vh - 52px)' : '100vh', background: BG, overflow: 'hidden' }}>

      {/* ── Panel izquierdo — lista de conversaciones ── */}
      <div style={{
        width: isMobile ? '100%' : (listCollapsed ? 0 : 380),
        maxWidth: isMobile ? '100%' : (listCollapsed ? 0 : 380),
        flexShrink: 0,
        display: showList ? 'flex' : 'none',
        flexDirection: 'column',
        borderRight: listCollapsed ? 'none' : `1px solid ${BRD}`,
        background: SURF,
        overflow: 'hidden',
        transition: 'width 0.2s ease, max-width 0.2s ease',
      }}>

        {/* Header lista */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BRD}`, flexShrink: 0 }}>
          {/* Buscar */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: MUTED }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('inbox.search', lang)}
              style={{ width: '100%', background: SURF2, border: `1px solid ${BRD}`, borderRadius: 8, padding: '7px 12px 7px 30px', fontSize: 13, color: TEXT, outline: 'none' }}
            />
          </div>
          {/* ENTRADAS */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{t('inbox.title', lang)}</span>
            <span style={{ background: ACCENT, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
              {filtrados.length}
            </span>
          </div>
          {/* Filter tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSort('reciente')} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: 'none', background: sort === 'reciente' ? 'rgba(0,201,167,0.15)' : 'transparent', color: sort === 'reciente' ? '#00c9a7' : MUTED, cursor: 'pointer', fontWeight: 600 }}>
                {t('common.all', lang)}
              </button>
              <button onClick={() => setSort('entrantes')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: 'none', background: sort === 'entrantes' ? `rgba(59,130,246,0.15)` : 'transparent', color: sort === 'entrantes' ? ACCENT : MUTED, cursor: 'pointer' }}>
                {t('inbox.inbound', lang)}
              </button>
            </div>
            <span style={{ color: MUTED, fontSize: 11 }}>{t('common.total', lang)}: {inbox.length}</span>
          </div>
          {/* Channel filter */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {[
              { k: 'all',       l: 'Todos',     color: MUTED },
              { k: 'whatsapp',  l: '● WA',      color: '#25d366' },
              { k: 'web',       l: '● Web',     color: '#1b9af5' },
              { k: 'email',     l: '● Email',   color: '#f97316' },
            ].map(c => (
              <button key={c.k} onClick={() => setFilterChannel(c.k)} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4, border: `1px solid ${filterChannel === c.k ? c.color : 'transparent'}`,
                background: filterChannel === c.k ? `${c.color}18` : 'transparent',
                color: filterChannel === c.k ? c.color : MUTED, cursor: 'pointer',
              }}>{c.l}</button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40, color: MUTED, gap: 8, fontSize: 13 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${ACCENT}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              Cargando...
            </div>
          )}
          {!loading && filtrados.length === 0 && (
            <div style={{ color: MUTED, textAlign: 'center', padding: 40, fontSize: 13 }}>Sin conversaciones</div>
          )}
          {filtrados.map(item => (
            <ConvItem
              key={item.lead_id}
              item={item}
              active={selected === item.lead_id}
              onClick={() => setSelected(item.lead_id)}
              isUnread={item.direction === 'inbound' && !respondedLeads.has(item.lead_id)}
              lang={lang}
            />
          ))}
        </div>

        {/* Menciones & Chats de Equipo — botón funcional */}
        <button
          onClick={() => { setTeamChatOpen(v => !v); setSelected(null); }}
          style={{
            padding: '11px 16px', borderTop: `1px solid ${BRD}`,
            color: teamChatOpen ? ACCENT : MUTED,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: teamChatOpen ? 'rgba(27,154,245,0.08)' : 'transparent',
            border: 'none', borderTop: `1px solid ${BRD}`, width: '100%', textAlign: 'left',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <span>MENCIONES &amp; CHATS DE EQUIPO</span>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={teamChatOpen ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'} />
          </svg>
        </button>
      </div>

      {/* ── Botón colapsar/expandir lista (solo desktop) ── */}
      {!isMobile && (
        <button
          onClick={() => setListCollapsed(c => !c)}
          title={listCollapsed ? 'Mostrar conversaciones' : 'Ocultar conversaciones'}
          style={{
            width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface2)', borderLeft: listCollapsed ? 'none' : 'none',
            borderRight: `1px solid ${BRD}`, border: 'none', cursor: 'pointer',
            color: 'var(--muted)', transition: 'background 0.15s',
            fontSize: 10,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
        >
          {listCollapsed ? '›' : '‹'}
        </button>
      )}

      {/* ── Panel derecho — chat cliente / equipo / vacío ── */}
      {showChat && (teamChatOpen ? (
        <TeamChatPanel onClose={() => setTeamChatOpen(false)} />
      ) : selectedItem ? (
        <ChatRight
          item={selectedItem}
          onClose={() => setSelected(null)}
          showBack={isMobile}
          onSent={(leadId) => {
            markRead(leadId);
            api.inbox().then(setInbox).catch(() => {});
          }}
          onRead={markRead}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14, flexDirection: 'column', gap: 12 }}>
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
          Selecciona una conversación
        </div>
      ))}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}
