'use client';
import { useState, useEffect, useMemo } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app';
const LOGO = 'https://energy-depot-web.vercel.app/logo.png';

const NAVY = '#1a3c8f';
const NAVY_DARK = '#0f2558';
const CYAN = '#67e8f9';

const REASONS = [
  { key: 'orientacion',    icon: '🎓', title: 'Orientación',     desc: 'Quiero conocer cómo funciona la energía solar' },
  { key: 'dudas',          icon: '❓', title: 'Aclarar dudas',   desc: 'Tengo preguntas específicas sobre el sistema' },
  { key: 'financiamiento', icon: '💰', title: 'Financiamiento',  desc: 'Quiero saber opciones de financiamiento' },
  { key: 'cotizacion',     icon: '📋', title: 'Cotización',      desc: 'Quiero una cotización personalizada' },
  { key: 'otra',           icon: '💬', title: 'Otra razón',      desc: 'Cuéntanos en qué te podemos ayudar' },
];

const DOW_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fmtDateLabel(d) {
  return `${DOW_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function todayPR() {
  // Aproximación: usar hora local del navegador. Para PR (UTC-4) basta para mostrar el día.
  return new Date();
}

// Genera próximos N días hábiles (lun-vie) desde mañana
function getBusinessDays(count = 14) {
  const out = [];
  const d = todayPR();
  d.setDate(d.getDate() + 1);
  while (out.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </div>
      {children}
    </label>
  );
}
const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #e5e7eb', fontSize: 15, outline: 'none',
  fontFamily: 'inherit', background: '#fff', color: '#1f2937',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

function ProgressBar({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 5, borderRadius: 3,
          background: i < step ? `linear-gradient(90deg,${NAVY},${CYAN})` : '#e5e7eb',
          transition: 'background 0.3s',
        }}/>
      ))}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '13px 18px', borderRadius: 12,
      background: disabled ? '#cbd5e1' : `linear-gradient(135deg,${NAVY},${NAVY_DARK})`,
      color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 14px rgba(26,60,143,0.30)',
      transition: 'transform 0.12s, box-shadow 0.12s',
    }}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '11px 18px', borderRadius: 10,
      background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`,
      fontSize: 14, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AgendarPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', city: '',
    reason: '', reason_other: '',
    type: '',
    scheduled_at: '', // 'YYYY-MM-DDTHH:mm' hora PR
  });
  const [busyDays, setBusyDays] = useState(getBusinessDays(14));
  const [selectedDay, setSelectedDay] = useState(null); // isoDate
  const [slots, setSlots] = useState({ available: [], taken: [] });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // datos cita confirmada

  // Cargar slots cuando entramos al step 4
  useEffect(() => {
    if (step !== 4) return;
    const from = isoDate(busyDays[0]);
    const to = isoDate(busyDays[busyDays.length - 1]);
    setLoadingSlots(true);
    fetch(`${API}/api/public/agendar/slots?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(data => {
        setSlots({
          available: new Set(data.available || []),
          taken: new Set(data.taken || []),
        });
      })
      .catch(() => setSlots({ available: new Set(), taken: new Set() }))
      .finally(() => setLoadingSlots(false));
  }, [step]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canStep1 = form.name.trim() && form.email.trim() && form.phone.trim();
  const canStep2 = form.reason && (form.reason !== 'otra' || form.reason_other.trim());
  const canStep3 = form.type;
  const canStep4 = !!form.scheduled_at;

  // Slots del día seleccionado
  const daySlots = useMemo(() => {
    if (!selectedDay) return [];
    const out = [];
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        out.push(`${selectedDay}T${pad(h)}:${pad(m)}`);
      }
    }
    return out;
  }, [selectedDay]);

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim() || undefined,
        reason: form.reason,
        reason_other: form.reason === 'otra' ? form.reason_other.trim() : undefined,
        type: form.type,
        scheduled_at: form.scheduled_at,
      };
      const r = await fetch(`${API}/api/public/agendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error agendando');
      setDone(data);
    } catch (e) {
      setError(e.message || 'Error agendando');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Pantalla final ──────────────────────────────────────────────────────────
  if (done) {
    const [dPart, tPart] = (done.scheduled_at || '').split('T');
    const [y, m, d] = (dPart || '').split('-');
    const fechaTexto = dPart ? `${d}/${m}/${y} a las ${tPart}` : '';
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%',
            background: 'linear-gradient(135deg,#10b981,#059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
          }}>
            <svg width="44" height="44" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 style={{ color: NAVY, fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>¡Tu cita está agendada!</h2>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 22px' }}>Te confirmaremos por email muy pronto.</p>

          <div style={{ background: '#f8fafc', borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 22 }}>
            <Row label="Motivo"  value={done.reason_label} />
            <Row label="Tipo"    value={done.type_label} />
            <Row label="Fecha"   value={`${fechaTexto} (hora PR)`} bold />
            <Row label="Cliente" value={form.name} />
            <Row label="Email"   value={form.email} />
          </div>

          <a href="https://wa.me/17876278585" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: '#25d366', color: '#fff', padding: '13px 18px',
            borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 15,
            marginBottom: 10,
          }}>💬 ¿Necesitas reprogramar? Escríbenos al WhatsApp</a>
          <a href="tel:+17876278585" style={{
            display: 'block', textAlign: 'center', color: NAVY,
            textDecoration: 'none', fontWeight: 600, fontSize: 14, padding: '8px',
          }}>📞 787-627-8585</a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ProgressBar step={step} total={4} />

      {/* ── STEP 1: Datos ────────────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <H1>Agenda tu cita</H1>
          <Sub>Cuéntanos quién eres para coordinar tu llamada o visita.</Sub>
          <Field label="Nombre completo" required>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Tu nombre" />
          </Field>
          <Field label="Email" required>
            <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="tu@email.com" />
          </Field>
          <Field label="Teléfono" required>
            <input type="tel" style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="787-555-1234" />
          </Field>
          <Field label="Ciudad">
            <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Bayamón, San Juan..." />
          </Field>
          <PrimaryBtn disabled={!canStep1} onClick={() => setStep(2)}>Continuar →</PrimaryBtn>
        </>
      )}

      {/* ── STEP 2: Motivo ────────────────────────────────────────────────── */}
      {step === 2 && (
        <>
          <H1>¿Cuál es el motivo?</H1>
          <Sub>Selecciona la razón que mejor describe lo que buscas.</Sub>
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            {REASONS.map(r => {
              const active = form.reason === r.key;
              return (
                <button key={r.key} onClick={() => set('reason', r.key)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                  background: active ? `${NAVY}` : '#fff',
                  color: active ? '#fff' : '#1f2937',
                  border: `1.5px solid ${active ? NAVY : '#e5e7eb'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: active ? '0 6px 18px rgba(26,60,143,0.25)' : 'none',
                }}>
                  <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{r.title}</div>
                    <div style={{ fontSize: 13, color: active ? 'rgba(255,255,255,0.85)' : '#6b7280' }}>{r.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {form.reason === 'otra' && (
            <Field label="Cuéntanos brevemente" required>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={form.reason_other}
                onChange={e => set('reason_other', e.target.value)}
                placeholder="Describe tu necesidad..." />
            </Field>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <GhostBtn onClick={() => setStep(1)}>← Atrás</GhostBtn>
            <div style={{ flex: 1 }}>
              <PrimaryBtn disabled={!canStep2} onClick={() => setStep(3)}>Continuar →</PrimaryBtn>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 3: Tipo ──────────────────────────────────────────────────── */}
      {step === 3 && (
        <>
          <H1>¿Cómo prefieres conectar?</H1>
          <Sub>Elige el tipo de cita.</Sub>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            {[
              { v: 'llamada', icon: '📞', label: 'Llamada' },
              { v: 'visita',  icon: '🏠', label: 'Visita presencial' },
            ].map(o => {
              const active = form.type === o.v;
              return (
                <button key={o.v} onClick={() => set('type', o.v)} style={{
                  padding: '22px 14px', borderRadius: 14,
                  background: active ? NAVY : '#fff',
                  color: active ? '#fff' : '#1f2937',
                  border: `1.5px solid ${active ? NAVY : '#e5e7eb'}`,
                  cursor: 'pointer', textAlign: 'center',
                  boxShadow: active ? '0 6px 18px rgba(26,60,143,0.25)' : 'none',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>{o.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{o.label}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={() => setStep(2)}>← Atrás</GhostBtn>
            <div style={{ flex: 1 }}>
              <PrimaryBtn disabled={!canStep3} onClick={() => setStep(4)}>Continuar →</PrimaryBtn>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 4: Calendario ────────────────────────────────────────────── */}
      {step === 4 && (
        <>
          <H1>Elige fecha y hora</H1>
          <Sub>Próximos días disponibles (hora de Puerto Rico).</Sub>

          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>Cargando horarios...</div>
          ) : (
            <>
              {/* Grid de días */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))',
                gap: 8, marginBottom: 18,
              }}>
                {busyDays.map(d => {
                  const iso = isoDate(d);
                  // ¿Tiene al menos un slot disponible?
                  const hasFree = Array.from(slots.available || []).some(s => s.startsWith(iso));
                  const active = selectedDay === iso;
                  return (
                    <button key={iso} disabled={!hasFree} onClick={() => { setSelectedDay(iso); set('scheduled_at', ''); }} style={{
                      padding: '10px 4px', borderRadius: 10,
                      background: active ? NAVY : (hasFree ? '#fff' : '#f1f5f9'),
                      color: active ? '#fff' : (hasFree ? '#1f2937' : '#cbd5e1'),
                      border: `1.5px solid ${active ? NAVY : '#e5e7eb'}`,
                      cursor: hasFree ? 'pointer' : 'not-allowed',
                      textAlign: 'center', fontWeight: 600,
                    }}>
                      <div style={{ fontSize: 11, opacity: 0.85 }}>{DOW_LABELS[d.getDay()]}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>{MONTH_NAMES[d.getMonth()].slice(0,3)}</div>
                    </button>
                  );
                })}
              </div>

              {/* Slots del día seleccionado */}
              {selectedDay && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                    Horarios disponibles
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                    {daySlots.map(s => {
                      const time = s.split('T')[1];
                      const available = slots.available?.has(s);
                      const taken = slots.taken?.has(s);
                      const active = form.scheduled_at === s;
                      return (
                        <button key={s} disabled={!available} onClick={() => set('scheduled_at', s)} style={{
                          padding: '10px 6px', borderRadius: 8,
                          background: active ? NAVY : (available ? '#fff' : '#f1f5f9'),
                          color: active ? '#fff' : (available ? NAVY : '#cbd5e1'),
                          border: `1.5px solid ${active ? NAVY : (available ? NAVY : '#e5e7eb')}`,
                          cursor: available ? 'pointer' : 'not-allowed',
                          fontWeight: 600, fontSize: 13,
                          textDecoration: taken ? 'line-through' : 'none',
                        }}>
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Resumen */}
          {form.scheduled_at && (
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>RESUMEN</div>
              <Row label="Motivo" value={REASONS.find(r => r.key === form.reason)?.title || ''} />
              <Row label="Tipo"   value={form.type === 'llamada' ? '📞 Llamada' : '🏠 Visita'} />
              <Row label="Fecha"  value={`${form.scheduled_at.replace('T', ' a las ')} (hora PR)`} bold />
            </div>
          )}

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={() => setStep(3)}>← Atrás</GhostBtn>
            <div style={{ flex: 1 }}>
              <PrimaryBtn disabled={!canStep4 || submitting} onClick={submit}>
                {submitting ? 'Agendando...' : 'Confirmar y agendar ✓'}
              </PrimaryBtn>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

// ─── Layout shell ─────────────────────────────────────────────────────────────
function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)',
      padding: '32px 16px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header con logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={LOGO} alt="Energy Depot" style={{ height: 44, marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>
            ENERGY DEPOT · PUERTO RICO
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 18, padding: '28px 26px',
          boxShadow: '0 10px 40px rgba(15,37,88,0.10)',
        }}>
          {children}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: '#94a3b8', fontSize: 12 }}>
          Si tienes problemas, llámanos al 787-627-8585
        </div>
      </div>
    </div>
  );
}

function H1({ children }) {
  return <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{children}</h1>;
}
function Sub({ children }) {
  return <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 22px' }}>{children}</p>;
}
function Row({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 14 }}>
      <div style={{ color: '#6b7280', width: 90, flexShrink: 0 }}>{label}:</div>
      <div style={{ color: '#1f2937', fontWeight: bold ? 700 : 500, flex: 1 }}>{value}</div>
    </div>
  );
}
