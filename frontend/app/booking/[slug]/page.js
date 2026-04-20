'use client';
import { useState, useEffect } from 'react';

// ── Palette (public, standalone — no CSS vars) ────────────────────────────────
const T = {
  bg:       '#0f1117',
  surface:  '#1a1d27',
  surface2: '#22263a',
  border:   '#2d3148',
  text:     '#e8eaf6',
  muted:    '#7b82a8',
  accent:   '#1b9af5',
  success:  '#22c55e',
  danger:   '#ef4444',
  warning:  '#f59e0b',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const API_BASE = typeof window !== 'undefined' ? '/backend' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

async function publicReq(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES   = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('es', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', background: T.surface2, border: `1px solid ${T.border}`,
  borderRadius: 10, padding: '11px 14px', fontSize: 14, color: T.text,
  outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 12, color: T.muted, marginBottom: 6, display: 'block', fontWeight: 500, letterSpacing: 0.3 };

function Btn({ onClick, children, style = {}, disabled = false, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.15s, transform 0.1s', ...style }}>
      {children}
    </button>
  );
}

// ── Mini calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ value, onChange, availableDays, disabledBefore }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [view, setView] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const firstOfMonth = new Date(view.year, view.month, 1);
  const lastOfMonth  = new Date(view.year, view.month + 1, 0);
  const startPad     = firstOfMonth.getDay(); // 0=Sun
  const totalCells   = startPad + lastOfMonth.getDate();
  const rows         = Math.ceil(totalCells / 7);

  const prevMonth = () => {
    if (view.month === 0) setView({ year: view.year - 1, month: 11 });
    else setView({ year: view.year, month: view.month - 1 });
  };
  const nextMonth = () => {
    if (view.month === 11) setView({ year: view.year + 1, month: 0 });
    else setView({ year: view.year, month: view.month + 1 });
  };

  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > lastOfMonth.getDate()) return null;
    return new Date(view.year, view.month, dayNum);
  });

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, userSelect: 'none' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} type="button"
          style={{ background: T.surface2, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: T.muted, fontSize: 16 }}>‹</button>
        <span style={{ fontWeight: 700, color: T.text, fontSize: 15 }}>
          {MONTH_NAMES[view.month]} {view.year}
        </span>
        <button onClick={nextMonth} type="button"
          style={{ background: T.surface2, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: T.muted, fontSize: 16 }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: T.muted, fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const dateStr     = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
          const isToday     = date.getTime() === today.getTime();
          const isPast      = date < today;
          const dayOfWeek   = date.getDay();
          const isAvailable = availableDays?.includes(dayOfWeek);
          const isSelected  = value === dateStr;
          const isDisabled  = isPast || !isAvailable;

          return (
            <button key={i} type="button"
              onClick={() => !isDisabled && onChange(dateStr)}
              disabled={isDisabled}
              style={{
                padding: '8px 0', borderRadius: 8, border: 'none',
                fontSize: 13, fontWeight: isToday ? 700 : 400,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: isSelected ? T.accent : isToday ? `${T.accent}22` : 'transparent',
                color: isDisabled ? `${T.muted}55` : isSelected ? '#fff' : T.text,
                transition: 'background 0.12s',
              }}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PublicBookingPage({ params }) {
  const { slug } = params;

  const [pageData, setPageData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedDate, setSelectedDate] = useState('');
  const [slots,        setSlots]        = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [step, setStep] = useState('date'); // 'date' | 'form' | 'confirm'

  const [form, setForm]       = useState({ client_name: '', client_email: '', client_phone: '', notes: '', sms_consent: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(null);
  const [formError,  setFormError]  = useState('');

  // Load page info
  useEffect(() => {
    setLoading(true);
    publicReq('GET', `/api/public/booking/${slug}`)
      .then(data => { setPageData(data); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate || !slug) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    publicReq('GET', `/api/public/booking/${slug}/slots?date=${selectedDate}`)
      .then(data => { setSlots(data.slots || []); })
      .catch(() => { setSlots([]); })
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, slug]);

  const setFormField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_name.trim()) { setFormError('El nombre es requerido'); return; }
    if (!selectedSlot) { setFormError('Selecciona un horario'); return; }
    setSubmitting(true); setFormError('');
    try {
      const result = await publicReq('POST', `/api/public/booking/${slug}/book`, {
        ...form,
        datetime: selectedSlot.datetime,
      });
      setSubmitted(result);
      setStep('confirm');
    } catch (err) {
      setFormError(err.message || 'Error al reservar');
    } finally {
      setSubmitting(false);
    }
  };

  const availableDays = pageData?.available_days
    ? (Array.isArray(pageData.available_days) ? pageData.available_days : JSON.parse(pageData.available_days))
    : [1,2,3,4,5];

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${T.border}`, borderTop: `3px solid ${T.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !pageData) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 8 }}>Página no encontrada</div>
          <div style={{ fontSize: 14 }}>El enlace de booking no existe o está inactivo</div>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (step === 'confirm' && submitted) {
    const { booking } = submitted;
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 24, padding: '48px 40px', maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${T.success}22`, border: `3px solid ${T.success}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 24px' }}>✓</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 10px' }}>¡Reserva confirmada!</h1>
          <p style={{ fontSize: 14, color: T.muted, margin: '0 0 28px', lineHeight: 1.6 }}>
            {submitted.message || 'Tu cita ha sido agendada exitosamente.'}
          </p>
          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, padding: '18px 22px', textAlign: 'left', marginBottom: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}>{pageData.title}</div>
            {[
              { label: 'Nombre',  value: booking?.client_name },
              { label: 'Fecha',   value: fmtDate(booking?.start_time) },
              { label: 'Horario', value: booking?.start_time ? new Date(booking.start_time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '' },
              { label: 'Email',   value: booking?.client_email },
              { label: 'Teléfono',value: booking?.client_phone },
            ].filter(r => r.value).map(r => (
              <div key={r.label} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.muted, width: 70, flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: 13, color: T.text }}>{r.value}</span>
              </div>
            ))}
          </div>
          <Btn onClick={() => { setStep('date'); setSubmitted(null); setSelectedDate(''); setSelectedSlot(null); setForm({ client_name: '', client_email: '', client_phone: '', notes: '' }); }}
            style={{ background: T.accent, color: '#fff', width: '100%' }}>
            Agendar otra cita
          </Btn>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '40px 16px 60px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.accent}22`, border: `2px solid ${T.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>📅</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: '0 0 6px' }}>{pageData.title}</h1>
          {pageData.agent_name && (
            <p style={{ fontSize: 13, color: T.muted, margin: '0 0 6px' }}>con {pageData.agent_name}</p>
          )}
          {pageData.description && (
            <p style={{ fontSize: 14, color: T.muted, margin: '0 auto', maxWidth: 500, lineHeight: 1.6 }}>{pageData.description}</p>
          )}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              ⏱ {pageData.duration_minutes} minutos
            </span>
            <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              🌐 {pageData.timezone}
            </span>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {[
            { key: 'date', label: '1. Fecha y hora' },
            { key: 'form', label: '2. Tus datos' },
          ].map((s, i) => {
            const done = (s.key === 'date' && step === 'form') || false;
            const active = step === s.key;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <div style={{ width: 40, height: 1, background: T.border }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: active ? T.accent : done ? T.success : T.surface2, border: `2px solid ${active ? T.accent : done ? T.success : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: active || done ? '#fff' : T.muted }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: active ? T.text : T.muted, fontWeight: active ? 600 : 400 }}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Step: date + time ── */}
        {step === 'date' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 24, alignItems: 'start' }}>
            {/* Calendar */}
            <MiniCalendar
              value={selectedDate}
              onChange={setSelectedDate}
              availableDays={availableDays}
            />

            {/* Slots */}
            <div>
              {!selectedDate && (
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '40px 20px', textAlign: 'center', color: T.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>👆</div>
                  <div style={{ fontSize: 14 }}>Selecciona una fecha en el calendario</div>
                </div>
              )}

              {selectedDate && (
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16, textTransform: 'capitalize' }}>
                    {fmtDate(selectedDate + 'T12:00:00')}
                  </div>

                  {loadingSlots && (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: T.muted }}>
                      <div style={{ display: 'inline-block', width: 22, height: 22, border: `2px solid ${T.border}`, borderTop: `2px solid ${T.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  )}

                  {!loadingSlots && slots.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: T.muted, fontSize: 13 }}>
                      No hay horarios disponibles para este día
                    </div>
                  )}

                  {!loadingSlots && slots.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                      {slots.map((slot, i) => {
                        const isSelected = selectedSlot?.time === slot.time;
                        return (
                          <button key={i} type="button"
                            onClick={() => slot.available && setSelectedSlot(slot)}
                            disabled={!slot.available}
                            style={{
                              padding: '10px 8px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                              border: `2px solid ${isSelected ? T.accent : slot.available ? T.border : T.surface2}`,
                              background: isSelected ? T.accent : slot.available ? T.surface2 : T.surface,
                              color: isSelected ? '#fff' : slot.available ? T.text : `${T.muted}55`,
                              cursor: slot.available ? 'pointer' : 'not-allowed',
                              transition: 'all 0.12s',
                            }}>
                            {slot.time}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlot && (
                    <div style={{ marginTop: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
                        Seleccionaste: <strong style={{ color: T.text }}>{selectedSlot.time}</strong>
                      </div>
                      <Btn onClick={() => setStep('form')} style={{ background: T.accent, color: '#fff', minWidth: 180 }}>
                        Continuar →
                      </Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step: form ── */}
        {step === 'form' && (
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            {/* Summary */}
            <div style={{ background: `${T.accent}15`, border: `1px solid ${T.accent}`, borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ fontSize: 28 }}>📅</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{pageData.title}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2, textTransform: 'capitalize' }}>
                  {fmtDate(selectedDate + 'T12:00:00')} · {selectedSlot?.time} · {pageData.duration_minutes} min
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input value={form.client_name} onChange={e => setFormField('client_name', e.target.value)}
                  placeholder="Tu nombre" style={inputStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.client_email} onChange={e => setFormField('client_email', e.target.value)}
                  placeholder="tu@email.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input type="tel" value={form.client_phone} onChange={e => setFormField('client_phone', e.target.value)}
                  placeholder="+52 55 1234 5678" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notas adicionales</label>
                <textarea value={form.notes} onChange={e => setFormField('notes', e.target.value)}
                  placeholder="Cuéntanos en qué podemos ayudarte..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* SMS Opt-in — required for Twilio 10DLC compliance */}
              <div style={{ background: 'rgba(99,102,241,0.08)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <label style={{ display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={form.sms_consent}
                    onChange={e => setFormField('sms_consent', e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: T.accent, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                    I agree to receive SMS text messages from <strong style={{ color: T.text }}>Energy Depot PR</strong> regarding my appointment confirmation, installation reminders, real-time project updates, and post-installation feedback requests. Message frequency varies. Message &amp; data rates may apply. Reply <strong style={{ color: T.text }}>STOP</strong> to opt out at any time. Reply <strong style={{ color: T.text }}>HELP</strong> for help.
                  </span>
                </label>
                <div style={{ marginTop: 8, fontSize: 11, color: `${T.muted}88`, paddingLeft: 28 }}>
                  SMS consent is optional. Opting out will not affect your booking.
                </div>
              </div>

              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: `1px solid ${T.danger}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: T.danger }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <Btn onClick={() => setStep('date')} style={{ background: T.surface2, color: T.muted, flex: 1 }}>
                  ← Volver
                </Btn>
                <Btn type="submit" disabled={submitting} style={{ background: T.accent, color: '#fff', flex: 2 }}>
                  {submitting ? 'Reservando...' : 'Confirmar reserva'}
                </Btn>
              </div>
            </form>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        @media (max-width: 640px) {
          div[style*="grid-template-columns: minmax(280px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
