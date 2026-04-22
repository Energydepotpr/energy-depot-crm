'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';

// ── CSS palette ───────────────────────────────────────────────────────────────
const C = {
  bg:      'var(--bg)',
  surface: 'var(--surface)',
  surface2:'var(--surface2)',
  border:  'var(--border)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  accent:  'var(--accent)',
  success: 'var(--success)',
  danger:  'var(--danger)',
  warning: 'var(--warning)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora mismo';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7)   return `hace ${days}d`;
  return fmtDate(d);
}

// ── Icon per timeline type ────────────────────────────────────────────────────
function TimelineIcon({ type, color }) {
  const icons = {
    lead_created: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    stage_change: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    message_in: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    message_out: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
    invoice: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    contract: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    note: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    call: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  };
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%',
      background: color + '22', color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icons[type] || icons.note}
    </div>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  if (!source) return null;
  return (
    <span style={{
      background: 'rgba(99,102,241,0.12)', color: '#1b9af5',
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
    }}>{source}</span>
  );
}

// ── Status badge for contracts/leads ─────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending:  { color: C.warning, bg: 'rgba(245,158,11,0.12)',  label: 'Pendiente' },
    signed:   { color: C.success, bg: 'rgba(0,201,167,0.12)',   label: 'Firmado' },
    expired:  { color: C.danger,  bg: 'rgba(255,91,91,0.12)',   label: 'Vencido' },
    paid:     { color: C.success, bg: 'rgba(0,201,167,0.12)',   label: 'Pagada' },
    draft:    { color: C.muted,   bg: 'rgba(120,128,160,0.12)', label: 'Borrador' },
  };
  const s = map[status] || { color: C.muted, bg: 'rgba(120,128,160,0.12)', label: status };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 16px', fontSize: 13, fontWeight: 600,
            color: active === t.id ? C.accent : C.muted,
            borderBottom: active === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>
          {t.label} {t.count != null ? <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>({t.count})</span> : null}
        </button>
      ))}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '16px 20px', flex: '1 1 120px', minWidth: 110,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || C.text, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ContactDetailPage() {
  const { id } = useParams();
  const router  = useRouter();

  const [summary,  setSummary]  = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [leads,    setLeads]    = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [contracts,setContracts]= useState([]);
  const [bookings, setBookings] = useState([]);
  const [travelDocs, setTravelDocs] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [tab,      setTab]      = useState('timeline');
  const [docModal, setDocModal] = useState(null); // null | 'new' | {doc}
  const [docForm,  setDocForm]  = useState({ type:'passport',holder_name:'',doc_number:'',country:'',expiry_date:'',notes:'' });
  const [docSaving,setDocSaving]= useState(false);
  const [loading,  setLoading]  = useState(true);
  const [tlLoading,setTlLoading]= useState(false);
  const [tlOffset, setTlOffset] = useState(0);
  const [tlHasMore,setTlHasMore]= useState(true);

  const LIMIT = 30;

  // Load summary
  const loadSummary = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.contactSummary(id);
      setSummary(data.data || data);
    } catch (err) {
      console.error('summary error', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load timeline
  const loadTimeline = useCallback(async (reset = false) => {
    if (!id) return;
    const offs = reset ? 0 : tlOffset;
    setTlLoading(true);
    try {
      const data = await api.contactTimeline(id, `?limit=${LIMIT}&offset=${offs}`);
      const rows = data.data || [];
      if (reset) {
        setTimeline(rows);
        setTlOffset(rows.length);
      } else {
        setTimeline(prev => [...prev, ...rows]);
        setTlOffset(prev => prev + rows.length);
      }
      setTlHasMore(rows.length === LIMIT);
    } catch (err) {
      console.error('timeline error', err);
    } finally {
      setTlLoading(false);
    }
  }, [id, tlOffset]);

  // Load leads for this contact
  const loadLeads = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.leads(`?contact_id=${id}&page=1`);
      setLeads(data.leads || []);
    } catch (_) {}
  }, [id]);

  // Load contracts
  const loadContracts = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.contracts(`?contact_id=${id}`);
      setContracts(data.contracts || []);
    } catch (_) {}
  }, [id]);

  // Load bookings
  const loadBookings = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.bookings(`?contact_id=${id}`);
      setBookings(Array.isArray(data) ? data : []);
    } catch (_) {}
  }, [id]);

  // Load travel documents
  const loadTravelDocs = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.travelDocs(id);
      setTravelDocs(data.docs || []);
    } catch (_) {}
  }, [id]);

  // Load onboarding
  const loadOnboarding = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.onboarding(id);
      setOnboarding(data.onboarding || null);
    } catch (_) {}
  }, [id]);

  useEffect(() => {
    loadSummary();
    loadTimeline(true);
    loadLeads();
    loadContracts();
    loadBookings();
    loadTravelDocs();
    loadOnboarding();
  }, [id]); // eslint-disable-line

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: C.muted }}>
      <div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!summary) return (
    <div style={{ padding: 40, color: C.danger, textAlign: 'center' }}>Contacto no encontrado</div>
  );

  const contact = summary.contact || {};
  const initials = (contact.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const tabs = [
    { id: 'timeline',  label: 'Timeline',   count: timeline.length },
    { id: 'leads',     label: 'Leads',      count: summary.total_leads },
    { id: 'bookings',  label: 'Reservas',   count: bookings.length },
    { id: 'invoices',  label: 'Facturas',   count: summary.total_facturas },
    { id: 'contracts', label: 'Contratos',  count: summary.total_contratos },
    { id: 'docs',      label: 'Documentos', count: travelDocs.length },
    { id: 'onboarding',label: 'Onboarding', count: onboarding ? onboarding.items?.filter(i=>i.completed).length : 0 },
  ];

  const DOC_TYPES = [
    { value: 'passport',   label: 'Pasaporte' },
    { value: 'visa',       label: 'Visa' },
    { value: 'id',         label: 'ID / Cédula' },
    { value: 'insurance',  label: 'Seguro de viaje' },
    { value: 'ticket',     label: 'Tiquete / Boleto' },
    { value: 'other',      label: 'Otro' },
  ];

  const DOC_TYPE_COLORS = {
    passport: '#1b9af5', visa: '#f59e0b', id: '#10b981',
    insurance: '#1b9af5', ticket: '#8b5cf6', other: '#64748b',
  };

  const saveDoc = async () => {
    setDocSaving(true);
    try {
      if (docModal === 'new') {
        await api.createTravelDoc(id, docForm);
      } else {
        await api.updateTravelDoc(id, docModal.id, docForm);
      }
      setDocModal(null);
      setDocForm({ type:'passport',holder_name:'',doc_number:'',country:'',expiry_date:'',notes:'' });
      loadTravelDocs();
    } catch (e) {
      alert(e.message);
    } finally {
      setDocSaving(false);
    }
  };

  const deleteDoc = async (docId) => {
    if (!confirm('¿Eliminar documento?')) return;
    try {
      await api.deleteTravelDoc(id, docId);
      loadTravelDocs();
    } catch (e) { alert(e.message); }
  };

  const toggleOnboarding = async (itemId, completed) => {
    try {
      const data = await api.toggleOnboarding(id, itemId, completed);
      setOnboarding(data.onboarding);
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 24px 60px', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Back button */}
      <button onClick={() => router.back()}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 20, padding: 0 }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a contactos
      </button>

      {/* ── Header card ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1b9af5, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>{initials}</div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>{contact.name}</h1>
            <SourceBadge source={contact.source} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: C.muted }}>
            {contact.phone && (
              <a href={`tel:${contact.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.muted, textDecoration: 'none' }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.muted, textDecoration: 'none' }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {contact.email}
              </a>
            )}
            {contact.company && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                {contact.company}
              </span>
            )}
          </div>
        </div>

        {/* Dates */}
        <div style={{ textAlign: 'right', fontSize: 12, color: C.muted, flexShrink: 0 }}>
          <div>Primera interacción: <strong style={{ color: C.text }}>{fmtDate(summary.primera_interaccion)}</strong></div>
          <div style={{ marginTop: 4 }}>Última actividad: <strong style={{ color: C.text }}>{timeAgo(summary.ultima_interaccion)}</strong></div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard label="Leads totales"  value={summary.total_leads}     color={C.accent} />
        <SummaryCard label="Facturas"       value={summary.total_facturas}  color={C.success} />
        <SummaryCard label="Contratos"      value={summary.total_contratos} color={C.warning} />
        <SummaryCard label="Mensajes"       value={summary.total_mensajes}  color={'#8b5cf6'} />
        {summary.valor_total_facturas > 0 && (
          <SummaryCard
            label="Valor facturas"
            value={`$${Number(summary.valor_total_facturas).toLocaleString('es', { minimumFractionDigits: 2 })}`}
            color={C.success}
          />
        )}
      </div>

      {/* ── Tabs + content ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />

        {/* Timeline tab */}
        {tab === 'timeline' && (
          <div>
            {timeline.length === 0 && !tlLoading && (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 14 }}>Sin actividad registrada</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {timeline.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: i < timeline.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 2 }}>
                    <TimelineIcon type={item.type} color={item.color} />
                    {i < timeline.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: C.border, marginTop: 4, minHeight: 16 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{item.title || '—'}</span>
                      <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(item.date)}</span>
                    </div>
                    {item.subtitle && (
                      <div style={{ fontSize: 12, color: C.muted }}>{item.subtitle}</div>
                    )}
                    {/* Extra meta for messages */}
                    {(item.type === 'message_in' || item.type === 'message_out') && item.meta?.full_text && item.meta.full_text !== item.title && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                        {item.meta.full_text}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {tlHasMore && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  onClick={() => loadTimeline(false)}
                  disabled={tlLoading}
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 20px', fontSize: 13, color: C.muted, cursor: 'pointer' }}>
                  {tlLoading ? 'Cargando...' : 'Ver más'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leads tab */}
        {tab === 'leads' && (
          <div>
            {leads.length === 0 && (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 14 }}>Sin leads</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leads.map(l => (
                <div key={l.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{l.stage_name || '—'} · {fmtDate(l.created_at)}</div>
                  </div>
                  {l.value > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.success }}>
                      ${Number(l.value).toLocaleString('es', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoices tab */}
        {tab === 'invoices' && (
          <div>
            {invoices.length === 0 && summary.total_facturas === 0 && (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 14 }}>Sin facturas asociadas</div>
            )}
            {summary.total_facturas > 0 && invoices.length === 0 && (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 14 }}>
                Las facturas se asocian por nombre del cliente. <br />
                <span style={{ fontSize: 12 }}>Hay {summary.total_facturas} factura(s) detectada(s) via timeline.</span>
              </div>
            )}
          </div>
        )}

        {/* Bookings tab */}
        {tab === 'bookings' && (
          <div>
            {bookings.length === 0 && (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 14 }}>Sin reservas registradas</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bookings.map(b => {
                const sColor = { pending: '#f59e0b', confirmed: '#10b981', cancelled: '#ef4444', completed: '#6b7280' }[b.status] || '#6b7280';
                const sBg    = { pending: 'rgba(245,158,11,0.1)', confirmed: 'rgba(16,185,129,0.1)', cancelled: 'rgba(239,68,68,0.1)', completed: 'rgba(107,114,128,0.1)' }[b.status] || '';
                const sLabel = { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada' }[b.status] || b.status;
                const d = new Date(b.start_time);
                const isUpcoming = d > new Date();
                return (
                  <div key={b.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sColor}`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{b.page_title}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {isUpcoming && <span style={{ fontSize: 10, fontWeight: 600, color: '#1b9af5', background: 'rgba(59,130,246,0.12)', padding: '1px 8px', borderRadius: 20 }}>PRÓXIMA</span>}
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: sBg, color: sColor }}>{sLabel}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      📅 {d.toLocaleDateString('es-PR', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      {' · '}🕐 {d.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {b.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>📝 {b.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contracts tab */}
        {tab === 'contracts' && (
          <div>
            {contracts.length === 0 && (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 14 }}>Sin contratos</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contracts.map(c => (
                <div key={c.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fmtDate(c.created_at)}{c.signed_at ? ` · Firmado ${fmtDate(c.signed_at)}` : ''}</div>
                  </div>
                  <StatusBadge status={c.status} />
                  {c.file_name && (
                    <svg width="14" height="14" fill="none" stroke={C.danger} strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documentos del viajero tab */}
        {tab === 'docs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => { setDocForm({ type:'passport',holder_name:'',doc_number:'',country:'',expiry_date:'',notes:'' }); setDocModal('new'); }}
                style={{ background: C.accent, color:'#fff', border:'none', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                + Agregar documento
              </button>
            </div>
            {travelDocs.length === 0 && (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 14 }}>
                Sin documentos registrados. Agrega pasaporte, visa, seguro, etc.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {travelDocs.map(doc => {
                const exp = doc.expiry_date ? new Date(doc.expiry_date) : null;
                const daysLeft = exp ? Math.ceil((exp - new Date()) / 86400000) : null;
                const expColor = daysLeft == null ? C.muted : daysLeft < 0 ? C.danger : daysLeft < 90 ? C.warning : C.success;
                return (
                  <div key={doc.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${DOC_TYPE_COLORS[doc.type] || '#64748b'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: DOC_TYPE_COLORS[doc.type] + '22', color: DOC_TYPE_COLORS[doc.type] || '#64748b' }}>
                          {DOC_TYPES.find(t=>t.value===doc.type)?.label || doc.type}
                        </span>
                        {doc.holder_name && <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{doc.holder_name}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {doc.doc_number && <span>N°: {doc.doc_number}</span>}
                        {doc.country && <span>🌎 {doc.country}</span>}
                        {exp && (
                          <span style={{ color: expColor, fontWeight: 600 }}>
                            {daysLeft < 0 ? '⚠️ Expirado' : daysLeft < 90 ? `⚠️ Vence en ${daysLeft}d` : `✓ Vence: ${fmtDate(doc.expiry_date)}`}
                          </span>
                        )}
                      </div>
                      {doc.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>{doc.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setDocForm({ type: doc.type, holder_name: doc.holder_name||'', doc_number: doc.doc_number||'', country: doc.country||'', expiry_date: doc.expiry_date?.slice(0,10)||'', notes: doc.notes||'' }); setDocModal(doc); }}
                        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, color: C.muted, cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => deleteDoc(doc.id)}
                        style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: C.danger, cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Doc modal */}
            {docModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
                <div style={{ background: C.surface, borderRadius: 18, padding: 28, width: '100%', maxWidth: 480 }}>
                  <h3 style={{ margin: '0 0 20px', color: C.text }}>{docModal === 'new' ? 'Agregar documento' : 'Editar documento'}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Tipo</label>
                      <select value={docForm.type} onChange={e => setDocForm(p=>({...p,type:e.target.value}))}
                        style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:`1px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:13 }}>
                        {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    {[['holder_name','Nombre del titular'],['doc_number','Número de documento'],['country','País emisor']].map(([k,l]) => (
                      <div key={k}>
                        <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>{l}</label>
                        <input value={docForm[k]} onChange={e=>setDocForm(p=>({...p,[k]:e.target.value}))}
                          style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:`1px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:13 }} />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Fecha de vencimiento</label>
                      <input type="date" value={docForm.expiry_date} onChange={e=>setDocForm(p=>({...p,expiry_date:e.target.value}))}
                        style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:`1px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Notas</label>
                      <textarea value={docForm.notes} onChange={e=>setDocForm(p=>({...p,notes:e.target.value}))} rows={2}
                        style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:`1px solid ${C.border}`, background:C.surface2, color:C.text, fontSize:13, resize:'vertical' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button onClick={() => setDocModal(null)} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 18px', fontSize: 13, color: C.muted, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={saveDoc} disabled={docSaving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{docSaving ? 'Guardando...' : 'Guardar'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Onboarding tab */}
        {tab === 'onboarding' && (
          <div>
            {!onboarding ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0' }}>Cargando...</div>
            ) : (
              <div>
                {/* Progress bar */}
                {(() => {
                  const total = onboarding.items?.length || 0;
                  const done = onboarding.items?.filter(i=>i.completed).length || 0;
                  const pct = total > 0 ? Math.round((done/total)*100) : 0;
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Progreso del onboarding</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? C.success : C.accent }}>{pct}% ({done}/{total})</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: C.border }}>
                        <div style={{ height: '100%', borderRadius: 4, background: pct===100 ? C.success : C.accent, width: `${pct}%`, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(onboarding.items || []).map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer' }}
                      onClick={() => toggleOnboarding(item.id, !item.completed)}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: item.completed ? C.success : 'transparent',
                        border: `2px solid ${item.completed ? C.success : C.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: item.completed ? C.muted : C.text, textDecoration: item.completed ? 'line-through' : 'none' }}>
                          {item.label}
                          {item.required && <span style={{ marginLeft: 6, fontSize: 10, color: C.danger }}>*requerido</span>}
                        </div>
                        {item.completed_at && (
                          <div style={{ fontSize: 11, color: C.muted }}>Completado {fmtDate(item.completed_at)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
