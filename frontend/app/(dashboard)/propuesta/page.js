'use client';
import { useState, useRef } from 'react';

// ── API base + auth ───────────────────────────────────────────────────────────
const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : '/backend'
    : '';

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TRIP_TYPES = [
  { value: 'playa',       label: '🏖️ Playa',         color: '#0ea5e9' },
  { value: 'cultura',     label: '🏛️ Cultura',        color: '#8b5cf6' },
  { value: 'aventura',    label: '🗻 Aventura',        color: '#10b981' },
  { value: 'gastronomia', label: '🍷 Gastronomía',    color: '#f59e0b' },
  { value: 'romantico',   label: '💑 Romántico',       color: '#ec4899' },
  { value: 'familiar',    label: '👨‍👩‍👧 Familiar',    color: '#1b9af5' },
  { value: 'tour',        label: '🌐 Tour completo',   color: '#1877f2' },
];

const TYPE_ICONS = {
  vuelo:       '✈️',
  hotel:       '🏨',
  actividad:   '🎯',
  traslado:    '🚌',
  restaurante: '🍽️',
  otro:        '📌',
};

const TYPE_COLORS = {
  vuelo:       '#1b9af5',
  hotel:       '#8b5cf6',
  actividad:   '#10b981',
  traslado:    '#f59e0b',
  restaurante: '#ec4899',
  otro:        '#94a3b8',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtPrice(n) {
  if (!n && n !== 0) return '';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getTripColor(tripType) {
  return TRIP_TYPES.find(t => t.value === tripType)?.color || '#1877f2';
}

function buildPlainText(proposal, formData) {
  if (!proposal) return '';
  const lines = [];
  lines.push('═══════════════════════════════════════════════════');
  lines.push('                   FIX A TRIP');
  lines.push('         Agencia de Viajes • Puerto Rico');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');
  lines.push(`✈  ${proposal.title}`);
  lines.push('');
  lines.push(`Destino: ${formData.destination}`);
  if (formData.start_date && formData.end_date) {
    lines.push(`Fechas: ${fmtDateShort(formData.start_date)} → ${fmtDateShort(formData.end_date)}`);
  }
  lines.push(`Pasajeros: ${formData.num_passengers}`);
  if (formData.budget) lines.push(`Presupuesto: ${fmtPrice(formData.budget)}`);
  lines.push('');
  lines.push('RESUMEN');
  lines.push('───────────────────────────────────────────────────');
  lines.push(proposal.summary || '');
  lines.push('');

  if (proposal.highlights?.length) {
    lines.push('DESTACADOS');
    lines.push('───────────────────────────────────────────────────');
    proposal.highlights.forEach(h => lines.push(`• ${h}`));
    lines.push('');
  }

  if (proposal.days?.length) {
    lines.push('ITINERARIO DETALLADO');
    lines.push('───────────────────────────────────────────────────');
    proposal.days.forEach(day => {
      lines.push('');
      lines.push(`DÍA ${day.day}${day.date ? ' — ' + fmtDate(day.date) : ''}`);
      lines.push(`${day.title}`);
      (day.items || []).forEach(item => {
        const icon = TYPE_ICONS[item.type] || '📌';
        const timeStr = item.time ? `[${item.time}] ` : '';
        const priceStr = item.price_estimate ? ` (${fmtPrice(item.price_estimate)})` : '';
        lines.push(`  ${icon} ${timeStr}${item.title}${priceStr}`);
        if (item.description) lines.push(`     ${item.description}`);
        if (item.location) lines.push(`     📍 ${item.location}`);
      });
    });
    lines.push('');
  }

  if (proposal.included?.length) {
    lines.push('INCLUYE');
    lines.push('───────────────────────────────────────────────────');
    proposal.included.forEach(i => lines.push(`✓ ${i}`));
    lines.push('');
  }

  if (proposal.not_included?.length) {
    lines.push('NO INCLUYE');
    lines.push('───────────────────────────────────────────────────');
    proposal.not_included.forEach(i => lines.push(`✗ ${i}`));
    lines.push('');
  }

  if (proposal.total_estimate) {
    lines.push('───────────────────────────────────────────────────');
    lines.push(`ESTIMADO TOTAL: ${fmtPrice(proposal.total_estimate)} USD`);
    lines.push('');
  }

  if (proposal.recommendations?.length) {
    lines.push('RECOMENDACIONES');
    lines.push('───────────────────────────────────────────────────');
    proposal.recommendations.forEach(r => lines.push(`💡 ${r}`));
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════');
  lines.push('Energy Depot PR | energydepotpr.com | Puerto Rico');
  lines.push('═══════════════════════════════════════════════════');
  return lines.join('\n');
}

// ── Spinner component ─────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite', verticalAlign: 'middle', marginRight: 8 }} />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PropuestaPage() {
  const [form, setForm] = useState({
    destination: '',
    start_date: '',
    end_date: '',
    num_passengers: 2,
    budget: '',
    trip_type: 'tour',
    special_requests: '',
    lead_ref: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef(null);

  const tripColor = getTripColor(form.trip_type);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!form.destination.trim()) {
      setError('Por favor ingresa un destino.');
      return;
    }
    setError('');
    setLoading(true);
    setProposal(null);
    setSavedId(null);

    try {
      const body = {
        destination:      form.destination.trim(),
        start_date:       form.start_date   || undefined,
        end_date:         form.end_date     || undefined,
        num_passengers:   Number(form.num_passengers) || 2,
        budget:           form.budget ? Number(form.budget) : undefined,
        trip_type:        form.trip_type,
        special_requests: form.special_requests || '',
      };

      const res = await fetch(`${BASE_URL}/api/proposals/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      setProposal(data.proposal);
      setSavedId(data.itinerary_id);

      // Scroll to result on mobile
      setTimeout(() => {
        if (resultRef.current) {
          resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      setError(err.message || 'Error al generar la propuesta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleCopy() {
    const text = buildPlainText(proposal, form);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  // ── Input style ─────────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };
  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };
  const fieldStyle = { marginBottom: 16 };

  return (
    <>
      {/* Print + animation styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .proposal-animate { animation: fadeIn 0.4s ease; }
        .proposal-input:focus { border-color: ${tripColor} !important; }

        @media print {
          body * { visibility: hidden; }
          #proposal-print-area, #proposal-print-area * { visibility: visible; }
          #proposal-print-area { position: fixed; top: 0; left: 0; width: 100%; padding: 32px; background: #fff; color: #000; }
          .no-print { display: none !important; }
          .print-agency-header { display: block !important; }
          .day-card { break-inside: avoid; page-break-inside: avoid; }
        }

        .print-agency-header { display: none; }

        @media (max-width: 768px) {
          .proposal-layout { flex-direction: column !important; }
          .proposal-panel { width: 100% !important; }
          .include-cols { flex-direction: column !important; }
          .dates-row { flex-direction: column !important; }
          .action-buttons { flex-direction: column !important; }
        }
      `}</style>

      <div style={{ padding: '24px 20px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ marginBottom: 24 }} className="no-print">
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            ✨ Generador de Propuesta IA
          </h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 14 }}>
            Crea itinerarios completos y personalizados en segundos con inteligencia artificial.
          </p>
        </div>

        {/* Two-panel layout */}
        <div className="proposal-layout" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* ── LEFT PANEL: Form ─────────────────────────────────────────────── */}
          <div className="proposal-panel no-print" style={{ width: 380, flexShrink: 0, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px' }}>
              Detalles del viaje
            </h2>

            <form onSubmit={handleGenerate}>
              {/* Destination */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Destino *</label>
                <input
                  className="proposal-input"
                  style={inputStyle}
                  type="text"
                  name="destination"
                  value={form.destination}
                  onChange={handleChange}
                  placeholder="Cancún, París, Roma..."
                  required
                  disabled={loading}
                />
              </div>

              {/* Dates */}
              <div className="dates-row" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha salida</label>
                  <input
                    className="proposal-input"
                    style={inputStyle}
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha regreso</label>
                  <input
                    className="proposal-input"
                    style={inputStyle}
                    type="date"
                    name="end_date"
                    value={form.end_date}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Passengers + Budget */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}># Pasajeros</label>
                  <input
                    className="proposal-input"
                    style={inputStyle}
                    type="number"
                    name="num_passengers"
                    value={form.num_passengers}
                    onChange={handleChange}
                    min={1}
                    max={99}
                    disabled={loading}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Presupuesto USD</label>
                  <input
                    className="proposal-input"
                    style={inputStyle}
                    type="number"
                    name="budget"
                    value={form.budget}
                    onChange={handleChange}
                    placeholder="3000"
                    min={0}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Trip type */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Tipo de viaje</label>
                <select
                  className="proposal-input"
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  name="trip_type"
                  value={form.trip_type}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {TRIP_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Special requests */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Solicitudes especiales</label>
                <textarea
                  className="proposal-input"
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  name="special_requests"
                  value={form.special_requests}
                  onChange={handleChange}
                  placeholder="luna de miel, sin gluten, accesibilidad..."
                  disabled={loading}
                />
              </div>

              {/* Lead ref */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Lead asociado (opcional)</label>
                <input
                  className="proposal-input"
                  style={inputStyle}
                  type="text"
                  name="lead_ref"
                  value={form.lead_ref}
                  onChange={handleChange}
                  placeholder="Nombre del lead o referencia..."
                  disabled={loading}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: loading ? 'rgba(99,102,241,0.5)' : `linear-gradient(135deg, ${tripColor}, ${tripColor}cc)`,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  boxShadow: loading ? 'none' : `0 4px 14px ${tripColor}44`,
                }}
              >
                {loading ? (
                  <>
                    <Spinner />
                    Generando...
                  </>
                ) : (
                  '✨ Generar propuesta con IA'
                )}
              </button>

              {/* Loading hint */}
              {loading && (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                  La IA está diseñando tu itinerario...<br />
                  (esto puede tomar unos segundos)
                </p>
              )}
            </form>

            {/* Saved indicator */}
            {savedId && !loading && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span>
                <span>Guardado en CRM (itinerario #{savedId})</span>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL: Result ───────────────────────────────────────────── */}
          <div
            ref={resultRef}
            className="proposal-panel"
            style={{ flex: 1, minWidth: 0 }}
          >
            {!proposal && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: 'var(--muted)', textAlign: 'center', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)', padding: 40 }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>✈️</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Tu propuesta aparecerá aquí
                </h3>
                <p style={{ fontSize: 14, maxWidth: 340, lineHeight: 1.6 }}>
                  Completa el formulario de la izquierda y presiona "Generar propuesta con IA" para crear un itinerario completo y personalizado.
                </p>
              </div>
            )}

            {loading && !proposal && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 40 }}>
                <div style={{ width: 56, height: 56, border: '4px solid rgba(99,102,241,0.2)', borderTopColor: tripColor, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 24 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  La IA está diseñando tu itinerario...
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Esto puede tomar unos segundos
                </p>
              </div>
            )}

            {proposal && (
              <div id="proposal-print-area" className="proposal-animate">
                {/* Print header (hidden on screen) */}
                <div className="print-agency-header" style={{ textAlign: 'center', marginBottom: 32, paddingBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1877f2' }}>FIX A TRIP</div>
                  <div style={{ fontSize: 13, color: '#666' }}>Agencia de Viajes • Puerto Rico</div>
                </div>

                {/* Branded header */}
                <div style={{ background: `linear-gradient(135deg, ${tripColor}22, ${tripColor}08)`, border: `1px solid ${tripColor}33`, borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                        {proposal.title}
                      </h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          📍 {form.destination}
                        </span>
                        {form.start_date && form.end_date && (
                          <span style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📅 {fmtDateShort(form.start_date)} → {fmtDateShort(form.end_date)}
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          👤 {form.num_passengers} pasajero{form.num_passengers !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div style={{ background: tripColor, color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                      {TRIP_TYPES.find(t => t.value === form.trip_type)?.label || form.trip_type}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {proposal.summary && (
                  <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '18px 22px', marginBottom: 20 }}>
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--text)', lineHeight: 1.7, fontStyle: 'italic' }}>
                      "{proposal.summary}"
                    </p>
                  </div>
                )}

                {/* Highlights */}
                {proposal.highlights?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      ⭐ Destacados
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {proposal.highlights.map((h, i) => (
                        <span key={i} style={{ background: `${tripColor}18`, color: tripColor, border: `1px solid ${tripColor}33`, borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 500 }}>
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Included / Not included */}
                {(proposal.included?.length > 0 || proposal.not_included?.length > 0) && (
                  <div className="include-cols" style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                    {proposal.included?.length > 0 && (
                      <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', padding: '16px 20px' }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#10b981', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          ✓ Lo que incluye
                        </h4>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {proposal.included.map((item, i) => (
                            <li key={i} style={{ fontSize: 13, color: 'var(--text)', padding: '3px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }}>✓</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {proposal.not_included?.length > 0 && (
                      <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', padding: '16px 20px' }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          ✗ No incluye
                        </h4>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {proposal.not_included.map((item, i) => (
                            <li key={i} style={{ fontSize: 13, color: 'var(--text)', padding: '3px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }}>✗</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Day-by-day itinerary */}
                {proposal.days?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                      📋 Itinerario día a día
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {proposal.days.map((day, di) => (
                        <div key={di} className="day-card" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                          {/* Day header */}
                          <div style={{ background: `linear-gradient(135deg, ${tripColor}22, ${tripColor}0a)`, borderBottom: `1px solid ${tripColor}22`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: tripColor, color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                              DÍA {day.day}
                            </div>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{day.title}</div>
                              {day.date && (
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{fmtDate(day.date)}</div>
                              )}
                            </div>
                          </div>

                          {/* Day items */}
                          <div style={{ padding: '4px 0' }}>
                            {(day.items || []).map((item, ii) => {
                              const icon = TYPE_ICONS[item.type] || '📌';
                              const typeColor = TYPE_COLORS[item.type] || '#94a3b8';
                              const isLast = ii === (day.items || []).length - 1;
                              return (
                                <div key={ii} style={{ padding: '12px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                  {/* Left: time + icon */}
                                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 50 }}>
                                    {item.time && (
                                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{item.time}</span>
                                    )}
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${typeColor}18`, border: `1px solid ${typeColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                      {icon}
                                    </div>
                                  </div>
                                  {/* Center: content */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                                      <div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                                        {item.location && (
                                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>📍 {item.location}</div>
                                        )}
                                      </div>
                                      {item.price_estimate > 0 && (
                                        <span style={{ fontSize: 13, fontWeight: 700, color: tripColor, flexShrink: 0, background: `${tripColor}14`, borderRadius: 6, padding: '2px 8px' }}>
                                          {fmtPrice(item.price_estimate)}
                                        </span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.5 }}>
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total estimate */}
                {proposal.total_estimate > 0 && (
                  <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Estimado total del viaje
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        para {form.num_passengers} pasajero{form.num_passengers !== 1 ? 's' : ''}
                        {form.budget ? ` · Presupuesto: ${fmtPrice(form.budget)}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 800, color: '#10b981', letterSpacing: '-0.5px' }}>
                      {fmtPrice(proposal.total_estimate)} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>USD</span>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {proposal.recommendations?.length > 0 && (
                  <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)', padding: '18px 22px', marginBottom: 20 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      💡 Recomendaciones
                    </h4>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {proposal.recommendations.map((tip, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
                          <span style={{ color: '#f59e0b', flexShrink: 0 }}>💡</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="action-buttons no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                  <button
                    onClick={handlePrint}
                    style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    📄 Exportar PDF
                  </button>
                  <button
                    onClick={handleCopy}
                    style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border)', background: copied ? 'rgba(16,185,129,0.1)' : 'var(--surface2)', color: copied ? '#10b981' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
                  >
                    {copied ? '✓ Copiado!' : '📋 Copiar texto'}
                  </button>
                  {savedId && (
                    <a
                      href={`/itinerario?id=${savedId}`}
                      style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#1b9af5', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                    >
                      📂 Ver en itinerarios
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setProposal(null);
                      setSavedId(null);
                      setError('');
                    }}
                    style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
                  >
                    ↺ Nueva propuesta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
