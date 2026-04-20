'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

// ── Palette ───────────────────────────────────────────────────────────────────
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
function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })} ${dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
}

const DAYS_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90];

const BOOKING_STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada' };
const BOOKING_STATUS_COLOR = { pending: C.warning, confirmed: C.success, cancelled: C.muted, completed: C.accent };
const BOOKING_STATUS_BG    = { pending: 'rgba(245,158,11,0.12)', confirmed: 'rgba(0,201,167,0.12)', cancelled: 'rgba(120,128,160,0.12)', completed: 'rgba(99,102,241,0.12)' };

// ── Shared UI ─────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', background: C.surface2, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.text,
  outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 12, color: C.muted, marginBottom: 5, display: 'block', fontWeight: 500 };

function Btn({ onClick, children, style = {}, disabled = false, title, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      {children}
    </button>
  );
}

function Badge({ status }) {
  const label = BOOKING_STATUS_LABEL[status] || status;
  const color = BOOKING_STATUS_COLOR[status] || C.muted;
  const bg    = BOOKING_STATUS_BG[status]    || 'rgba(120,128,160,0.12)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', padding: 0, position: 'relative', background: value ? C.accent : C.border, transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </button>
  );
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  return (
    <button onClick={doCopy} type="button"
      style={{ background: copied ? `${C.success}22` : C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 10px', fontSize: 11, color: copied ? C.success : C.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {copied ? '✓ Copiado' : '📋 Copiar link'}
    </button>
  );
}

// ── Booking page modal ─────────────────────────────────────────────────────────
const EMPTY_PAGE = {
  slug: '', title: '', description: '',
  duration_minutes: 30, buffer_minutes: 10,
  available_days: [1,2,3,4,5],
  available_from: '09:00', available_to: '18:00',
  timezone: 'America/Mexico_City', is_active: true,
};

function BookingPageModal({ page, onClose, onSaved }) {
  const isEdit = !!page;
  const [form, setForm]   = useState(EMPTY_PAGE);
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState('');

  useEffect(() => {
    if (page) {
      setForm({
        slug:             page.slug             || '',
        title:            page.title            || '',
        description:      page.description      || '',
        duration_minutes: page.duration_minutes || 30,
        buffer_minutes:   page.buffer_minutes   || 10,
        available_days:   Array.isArray(page.available_days) ? page.available_days : JSON.parse(page.available_days || '[1,2,3,4,5]'),
        available_from:   page.available_from   ? page.available_from.slice(0,5) : '09:00',
        available_to:     page.available_to     ? page.available_to.slice(0,5)   : '18:00',
        timezone:         page.timezone         || 'America/Mexico_City',
        is_active:        page.is_active        !== false,
      });
    } else {
      setForm(EMPTY_PAGE);
    }
  }, [page]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleDay = (day) => {
    const days = form.available_days.includes(day)
      ? form.available_days.filter(d => d !== day)
      : [...form.available_days, day].sort((a,b) => a - b);
    set('available_days', days);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('El título es requerido'); return; }
    if (!form.slug.trim() && !isEdit) { setError('El slug es requerido'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await api.updateBookingPage(page.id, form);
      } else {
        await api.createBookingPage(form);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
            {isEdit ? 'Editar página' : 'Nueva página de booking'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Título *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Ej: Consulta de 30 minutos" style={inputStyle} autoFocus />
          </div>

          {!isEdit && (
            <div>
              <label style={labelStyle}>Slug (URL) * <span style={{ color: C.muted, fontSize: 11 }}>— solo letras, números y guiones</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>/booking/</span>
                <input value={form.slug}
                  onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="mi-consulta" style={{ ...inputStyle }} />
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Descripción</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Describe qué incluye esta cita..." rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Duración (minutos)</label>
              <select value={form.duration_minutes} onChange={e => set('duration_minutes', parseInt(e.target.value))} style={inputStyle}>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Buffer entre citas (min)</label>
              <input type="number" min="0" max="60" value={form.buffer_minutes}
                onChange={e => set('buffer_minutes', parseInt(e.target.value) || 0)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Horario desde</label>
              <input type="time" value={form.available_from} onChange={e => set('available_from', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hasta</label>
              <input type="time" value={form.available_to} onChange={e => set('available_to', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Días disponibles</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAYS_OPTIONS.map(d => {
                const active = form.available_days.includes(d.value);
                return (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${active ? C.accent : C.border}`, background: active ? `${C.accent}22` : C.surface2, color: active ? C.accent : C.muted, fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer' }}>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Zona horaria</label>
            <select value={form.timezone} onChange={e => set('timezone', e.target.value)} style={inputStyle}>
              <option value="America/Mexico_City">América/Ciudad de México (GMT-6)</option>
              <option value="America/New_York">América/Nueva York (GMT-5)</option>
              <option value="America/Los_Angeles">América/Los Ángeles (GMT-8)</option>
              <option value="America/Bogota">América/Bogotá (GMT-5)</option>
              <option value="America/Buenos_Aires">América/Buenos Aires (GMT-3)</option>
              <option value="America/Santiago">América/Santiago (GMT-4)</option>
              <option value="Europe/Madrid">Europa/Madrid (GMT+1)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle value={form.is_active} onChange={v => set('is_active', v)} />
            <span style={{ fontSize: 13, color: C.text }}>Página {form.is_active ? 'activa' : 'inactiva'}</span>
          </div>

          {error && (
            <div style={{ background: 'rgba(255,91,91,0.1)', border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.danger }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn onClick={onClose} style={{ background: C.surface2, color: C.muted }}>Cancelar</Btn>
            <Btn type="submit" disabled={saving} style={{ background: C.accent, color: '#fff' }}>
              {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear página')}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [pages,    setPages]    = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadingB, setLoadingB] = useState(true);
  const [section,  setSection]  = useState('pages'); // 'pages' | 'bookings'

  const [modalOpen, setModalOpen] = useState(false);
  const [editPage,  setEditPage]  = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.bookingPages();
      setPages(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadBookings = useCallback(async () => {
    setLoadingB(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await api.bookings(params);
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoadingB(false); }
  }, [statusFilter]);

  useEffect(() => { loadPages(); }, [loadPages]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  const openCreate = () => { setEditPage(null); setModalOpen(true); };
  const openEdit   = (p) => { setEditPage(p);   setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditPage(null); };
  const handleSaved = () => { closeModal(); loadPages(); };

  const doDelete = async () => {
    if (!delConfirm) return;
    try {
      await api.deleteBookingPage(delConfirm.id);
      setDelConfirm(null);
      loadPages();
    } catch (e) { alert(e.message); }
  };

  const handleBookingStatus = async (booking, status) => {
    try {
      const updated = await api.updateBooking(booking.id, { status });
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, ...updated } : b));
    } catch (e) { alert(e.message); }
  };

  const handleTogglePage = async (page) => {
    try {
      const updated = await api.updateBookingPage(page.id, { is_active: !page.is_active });
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, is_active: updated.is_active } : p));
    } catch (e) { alert(e.message); }
  };

  const upcomingCount = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length;

  const sectionTabStyle = (active) => ({
    padding: '10px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
    color: active ? C.accent : C.muted, background: active ? `${C.accent}15` : 'none',
    border: 'none', borderRadius: 10, cursor: 'pointer',
  });

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 24px 60px', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Agenda & Booking</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>Citas</div>
        </div>
        {section === 'pages' && (
          <Btn onClick={openCreate} style={{ background: C.accent, color: '#fff', padding: '9px 18px', fontSize: 14, borderRadius: 10 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Nueva página
          </Btn>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Páginas activas',  value: pages.filter(p => p.is_active).length,  color: C.success },
          { label: 'Citas próximas',   value: upcomingCount,                            color: C.accent  },
          { label: 'Total páginas',    value: pages.length,                             color: C.text    },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', flex: '1 1 140px', minWidth: 130 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button style={sectionTabStyle(section === 'pages')}   onClick={() => setSection('pages')}>Mis páginas</button>
        <button style={sectionTabStyle(section === 'bookings')} onClick={() => setSection('bookings')}>
          Próximas citas {upcomingCount > 0 && <span style={{ background: C.accent, color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{upcomingCount}</span>}
        </button>
      </div>

      {/* ── Pages section ── */}
      {section === 'pages' && (
        <>
          {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}><div style={{ display: 'inline-block', width: 24, height: 24, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>}

          {!loading && pages.length === 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '60px 24px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📅</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Sin páginas de booking</div>
              <div style={{ fontSize: 13 }}>Crea tu primera página para que los clientes agenden citas contigo</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!loading && pages.map(page => {
              const bookingUrl = `${origin}/booking/${page.slug}`;
              const days = Array.isArray(page.available_days) ? page.available_days : JSON.parse(page.available_days || '[1,2,3,4,5]');
              const dayLabels = days.map(d => DAYS_OPTIONS.find(o => o.value === d)?.label).filter(Boolean).join(', ');
              return (
                <div key={page.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                    <Toggle value={page.is_active} onChange={() => handleTogglePage(page)} />
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: page.is_active ? C.text : C.muted }}>{page.title}</span>
                        <span style={{ fontSize: 11, color: C.muted, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px' }}>/booking/{page.slug}</span>
                      </div>
                      {page.description && (
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{page.description}</div>
                      )}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: C.muted }}>
                        <span>⏱ {page.duration_minutes} min</span>
                        <span>🔄 Buffer: {page.buffer_minutes} min</span>
                        <span>📅 {dayLabels}</span>
                        <span>🕐 {page.available_from?.slice(0,5)} – {page.available_to?.slice(0,5)}</span>
                        <span>📆 {page.upcoming_count || 0} citas</span>
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: C.muted, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bookingUrl}
                        </span>
                        <CopyBtn text={bookingUrl} />
                        <a href={bookingUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: C.accent, textDecoration: 'none', background: `${C.accent}15`, border: `1px solid ${C.accent}`, borderRadius: 8, padding: '4px 10px' }}>
                          Abrir ↗
                        </a>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn onClick={() => openEdit(page)} style={{ background: C.surface2, color: C.text }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Editar
                      </Btn>
                      <Btn onClick={() => setDelConfirm(page)} style={{ background: 'rgba(255,91,91,0.1)', color: C.danger }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </Btn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Bookings section ── */}
      {section === 'bookings' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { value: '',           label: 'Todas' },
              { value: 'pending',    label: 'Pendientes' },
              { value: 'confirmed',  label: 'Confirmadas' },
              { value: 'completed',  label: 'Completadas' },
              { value: 'cancelled',  label: 'Canceladas' },
            ].map(f => (
              <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${statusFilter === f.value ? C.accent : C.border}`, background: statusFilter === f.value ? `${C.accent}22` : C.surface, color: statusFilter === f.value ? C.accent : C.muted, fontSize: 12, fontWeight: statusFilter === f.value ? 700 : 400, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>

          {loadingB && <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}><div style={{ display: 'inline-block', width: 24, height: 24, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>}

          {!loadingB && bookings.length === 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '60px 24px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Sin citas</div>
            </div>
          )}

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {!loadingB && bookings.map((b, i) => (
              <div key={b.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 160px 140px 180px',
                gap: 0, padding: '0 20px',
                borderBottom: i < bookings.length - 1 ? `1px solid ${C.border}` : 'none',
                background: 'transparent', transition: 'background 0.12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Client */}
                <div style={{ padding: '14px 8px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{b.client_name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {b.client_email && <span>{b.client_email} · </span>}
                    {b.client_phone && <span>{b.client_phone}</span>}
                  </div>
                  {b.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontStyle: 'italic' }}>{b.notes}</div>}
                </div>

                {/* Page */}
                <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{b.page_title || '—'}</span>
                </div>

                {/* Date/time */}
                <div style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{fmtDate(b.start_time)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</div>
                </div>

                {/* Status */}
                <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                  <Badge status={b.status} />
                </div>

                {/* Actions */}
                <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {b.status === 'pending' && (
                    <Btn onClick={() => handleBookingStatus(b, 'confirmed')}
                      style={{ background: `${C.success}22`, color: C.success, fontSize: 11, padding: '5px 10px' }}>
                      Confirmar
                    </Btn>
                  )}
                  {(b.status === 'pending' || b.status === 'confirmed') && (
                    <Btn onClick={() => handleBookingStatus(b, 'completed')}
                      style={{ background: `${C.accent}22`, color: C.accent, fontSize: 11, padding: '5px 10px' }}>
                      Completar
                    </Btn>
                  )}
                  {b.status !== 'cancelled' && b.status !== 'completed' && (
                    <Btn onClick={() => { if (confirm('¿Cancelar esta cita?')) handleBookingStatus(b, 'cancelled'); }}
                      style={{ background: 'rgba(255,91,91,0.1)', color: C.danger, fontSize: 11, padding: '5px 10px' }}>
                      Cancelar
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {modalOpen && (
        <BookingPageModal page={editPage} onClose={closeModal} onSaved={handleSaved} />
      )}

      {/* ── Delete confirm ── */}
      {delConfirm && (
        <div onClick={() => setDelConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Eliminar página</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
              ¿Eliminar <strong style={{ color: C.text }}>{delConfirm.title}</strong>? Se eliminarán todas las citas asociadas.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn onClick={() => setDelConfirm(null)} style={{ background: C.surface2, color: C.muted, padding: '9px 20px' }}>Cancelar</Btn>
              <Btn onClick={doDelete} style={{ background: C.danger, color: '#fff', padding: '9px 20px' }}>Eliminar</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
