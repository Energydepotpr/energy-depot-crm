'use client';
import { useState, useEffect, useCallback } from 'react';

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

async function apiFetch(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* empty */ }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Palette ───────────────────────────────────────────────────────────────────
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
  warning:  'var(--warning)',
};

// ── Type icons ────────────────────────────────────────────────────────────────
const TYPE_ICONS = {
  vuelo:       '✈️',
  hotel:       '🏨',
  actividad:   '🎯',
  traslado:    '🚌',
  restaurante: '🍽️',
  otro:        '📌',
};
const TYPE_LABELS = {
  vuelo:       'Vuelo',
  hotel:       'Hotel',
  actividad:   'Actividad',
  traslado:    'Traslado',
  restaurante: 'Restaurante',
  otro:        'Otro',
};

// ── Status meta ───────────────────────────────────────────────────────────────
const STATUS_META = {
  draft:     { label: 'Borrador',   color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
  sent:      { label: 'Enviado',    color: '#60a5fa', bg: 'rgba(96,165,250,0.14)'  },
  confirmed: { label: 'Confirmado', color: '#34d399', bg: 'rgba(52,211,153,0.14)'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtPrice(n) {
  if (!n && n !== 0) return '';
  return `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function dateRangeLabel(start, end) {
  if (!start && !end) return '—';
  if (!end) return fmtDate(start);
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}
function numDays(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start), b = new Date(end);
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

// ── Reusable components ───────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: C.muted, bg: C.surface2 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: m.color, background: m.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function Btn({ onClick, children, style = {}, disabled = false, title, type = 'button', danger = false }) {
  const base = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 500,
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'opacity .15s',
    background: danger ? 'rgba(248,113,113,0.15)' : C.surface2,
    color: danger ? 'var(--danger)' : C.text,
    ...style,
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} style={base}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type = 'text', style = {}, placeholder = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</label>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '8px 12px', fontSize: 14, color: C.text, width: '100%', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</label>}
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '8px 12px', fontSize: 14, color: C.text, width: '100%', boxSizing: 'border-box',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3, style = {}, placeholder = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</label>}
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '8px 12px', fontSize: 14, color: C.text, width: '100%',
          boxSizing: 'border-box', resize: 'vertical',
        }}
      />
    </div>
  );
}

// ── Empty item template ───────────────────────────────────────────────────────
const EMPTY_ITEM = () => ({
  type: 'actividad', time: '', title: '', description: '', location: '', price: '',
});

// ── Activity Form (inline per day) ────────────────────────────────────────────
function ActivityForm({ onAdd, onCancel }) {
  const [item, setItem] = useState(EMPTY_ITEM());

  function upd(field, val) {
    setItem(prev => ({ ...prev, [field]: val }));
  }

  function handleAdd() {
    if (!item.title.trim()) return;
    onAdd({ ...item, price: item.price !== '' ? Number(item.price) : null });
  }

  const typeOpts = Object.entries(TYPE_LABELS).map(([v, l]) => ({
    value: v, label: `${TYPE_ICONS[v]} ${l}`,
  }));

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Select label="Tipo" value={item.type} onChange={v => upd('type', v)} options={typeOpts} />
        <Input label="Hora" value={item.time} onChange={v => upd('time', v)} type="time" />
      </div>
      <Input label="Título *" value={item.title} onChange={v => upd('title', v)} placeholder="Nombre de la actividad" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Ubicación" value={item.location} onChange={v => upd('location', v)} placeholder="Ciudad, lugar" />
        <Input label="Precio (USD)" value={item.price} onChange={v => upd('price', v)} type="number" placeholder="0.00" />
      </div>
      <Textarea label="Descripción" value={item.description} onChange={v => upd('description', v)} rows={2} placeholder="Detalles adicionales..." />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onCancel} style={{ background: 'transparent', border: `1px solid ${C.border}` }}>Cancelar</Btn>
        <Btn onClick={handleAdd} style={{ background: C.accent, color: '#fff' }}>Agregar actividad</Btn>
      </div>
    </div>
  );
}

// ── Day Card ──────────────────────────────────────────────────────────────────
function DayCard({ day, onSave, onDelete, isSaving }) {
  const [expanded, setExpanded]   = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(day.title || '');
  const [items, setItems] = useState(Array.isArray(day.items) ? day.items : []);

  // Sync external changes
  useEffect(() => {
    setLocalTitle(day.title || '');
    setItems(Array.isArray(day.items) ? day.items : []);
  }, [day]);

  function save(updatedItems, updatedTitle) {
    onSave(day.id, {
      title: updatedTitle !== undefined ? updatedTitle : localTitle,
      items: updatedItems !== undefined ? updatedItems : items,
    });
  }

  function addItem(item) {
    const next = [...items, item];
    setItems(next);
    setShowForm(false);
    save(next);
  }

  function removeItem(idx) {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    save(next);
  }

  function saveTitle() {
    setEditTitle(false);
    save(undefined, localTitle);
  }

  const totalCost = items.reduce((s, it) => s + (Number(it.price) || 0), 0);

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      marginBottom: 12, overflow: 'hidden',
    }}>
      {/* Day header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${C.border}` : 'none',
          background: C.surface2,
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 18, minWidth: 28, textAlign: 'center', fontWeight: 700, color: C.accent }}>
          {day.day_number}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editTitle ? (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditTitle(false); }}
                autoFocus
                style={{
                  background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 6,
                  padding: '4px 8px', fontSize: 14, color: C.text, flex: 1,
                }}
              />
              <Btn onClick={saveTitle} style={{ padding: '4px 10px', background: C.accent, color: '#fff', fontSize: 12 }}>OK</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, color: C.text, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {localTitle || `Día ${day.day_number}`}
              </span>
              {day.day_date && (
                <span style={{ fontSize: 12, color: C.muted }}>— {fmtDate(day.day_date)}</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); setEditTitle(true); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 13, padding: 0, lineHeight: 1 }}
                title="Editar título"
              >✏️</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {totalCost > 0 && (
            <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>{fmtPrice(totalCost)}</span>
          )}
          <span style={{ fontSize: 12, color: C.muted }}>{items.length} actividad{items.length !== 1 ? 'es' : ''}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(day.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, padding: 0 }}
            title="Eliminar día"
          >🗑️</button>
          <span style={{ color: C.muted, fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Day body */}
      {expanded && (
        <div style={{ padding: '12px 16px' }}>
          {/* Items list */}
          {items.length === 0 && !showForm && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 13 }}>
              Sin actividades aún. Agrega la primera.
            </div>
          )}
          {items.map((item, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 0', borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                {TYPE_ICONS[item.type] || '📌'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  {item.time && (
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, flexShrink: 0 }}>{item.time}</span>
                  )}
                  <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{item.title}</span>
                  {item.location && (
                    <span style={{ fontSize: 12, color: C.muted }}>📍 {item.location}</span>
                  )}
                </div>
                {item.description && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.4 }}>
                    {item.description}
                  </p>
                )}
                {item.price != null && item.price !== '' && Number(item.price) > 0 && (
                  <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>{fmtPrice(item.price)}</span>
                )}
              </div>
              <button
                onClick={() => removeItem(idx)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.muted, fontSize: 16, padding: 0, flexShrink: 0, lineHeight: 1,
                }}
                title="Eliminar actividad"
              >✕</button>
            </div>
          ))}

          {/* Inline form */}
          {showForm && (
            <ActivityForm onAdd={addItem} onCancel={() => setShowForm(false)} />
          )}

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                marginTop: 10, background: 'none', border: `1px dashed ${C.border}`,
                borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                color: C.muted, fontSize: 13, width: '100%',
              }}
            >
              + Agregar actividad
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Itinerary Modal ───────────────────────────────────────────────────────
function NewItineraryModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '', destination: '', start_date: '', end_date: '',
    num_passengers: 1, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function upd(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  async function handleCreate() {
    if (!form.title.trim()) { setError('El título es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const data = await apiFetch('POST', '/api/itineraries', {
        ...form,
        num_passengers: Number(form.num_passengers) || 1,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      });
      onCreate(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const nd = numDays(form.start_date, form.end_date);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: C.surface, borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 520, boxSizing: 'border-box',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: C.text }}>Nuevo itinerario</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.muted }}>✕</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Título *" value={form.title} onChange={v => upd('title', v)} placeholder="Ej: Viaje a París 2025" />
          <Input label="Destino" value={form.destination} onChange={v => upd('destination', v)} placeholder="Ej: París, Francia" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Fecha inicio" value={form.start_date} onChange={v => upd('start_date', v)} type="date" />
            <Input label="Fecha fin" value={form.end_date} onChange={v => upd('end_date', v)} type="date" />
          </div>
          {nd > 0 && (
            <div style={{ fontSize: 13, color: C.accent, background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '6px 12px' }}>
              Se crearán automáticamente <strong>{nd}</strong> días
            </div>
          )}
          <Input label="N° de pasajeros" value={form.num_passengers} onChange={v => upd('num_passengers', v)} type="number" />
          <Textarea label="Notas" value={form.notes} onChange={v => upd('notes', v)} rows={2} placeholder="Notas internas..." />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}` }}>Cancelar</Btn>
          <Btn onClick={handleCreate} disabled={saving} style={{ background: C.accent, color: '#fff' }}>
            {saving ? 'Creando...' : 'Crear itinerario'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Print area generator ──────────────────────────────────────────────────────
function triggerPrint(itinerary) {
  const days = itinerary.days || [];
  const totalCost = days.reduce((s, d) => {
    const items = Array.isArray(d.items) ? d.items : [];
    return s + items.reduce((s2, it) => s2 + (Number(it.price) || 0), 0);
  }, 0);

  const daysHtml = days.map(d => {
    const items = Array.isArray(d.items) ? d.items : [];
    const itemsHtml = items.length === 0
      ? '<p style="color:#888;font-style:italic;margin:0">Sin actividades registradas.</p>'
      : items.map(it => `
        <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #eee;align-items:flex-start">
          <span style="font-size:20px;min-width:28px">${TYPE_ICONS[it.type] || '📌'}</span>
          <div style="flex:1">
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
              ${it.time ? `<span style="font-size:12px;color:#666;font-weight:600">${it.time}</span>` : ''}
              <strong style="font-size:14px">${it.title || ''}</strong>
              ${it.location ? `<span style="font-size:12px;color:#888">📍 ${it.location}</span>` : ''}
              ${it.price != null && Number(it.price) > 0 ? `<span style="font-size:12px;color:#059669;font-weight:600;margin-left:auto">$${Number(it.price).toLocaleString('es',{minimumFractionDigits:2})}</span>` : ''}
            </div>
            ${it.description ? `<p style="margin:4px 0 0;font-size:13px;color:#555;line-height:1.4">${it.description}</p>` : ''}
          </div>
        </div>`).join('');

    const dayTotal = items.reduce((s, it) => s + (Number(it.price) || 0), 0);

    return `
      <div style="margin-bottom:24px;page-break-inside:avoid">
        <div style="background:#f8fafc;border-left:4px solid #1b9af5;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-size:15px;color:#1e293b">Día ${d.day_number}${d.day_date ? ` — ${fmtDate(d.day_date)}` : ''}</strong>
            ${d.title ? `<span style="margin-left:8px;color:#64748b;font-size:13px">${d.title}</span>` : ''}
          </div>
          ${dayTotal > 0 ? `<span style="font-size:13px;color:#059669;font-weight:600">$${dayTotal.toLocaleString('es',{minimumFractionDigits:2})}</span>` : ''}
        </div>
        ${itemsHtml}
        ${d.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b;font-style:italic">Notas: ${d.notes}</p>` : ''}
      </div>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Itinerario: ${itinerary.title}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none !important; }
          @page { margin: 20mm; }
        }
        @media screen {
          body { padding: 32px; max-width: 860px; margin: 0 auto; }
        }
        .print-btn {
          background: #1b9af5; color: #fff; border: none; border-radius: 8px;
          padding: 10px 22px; font-size: 14px; cursor: pointer; margin-bottom: 24px;
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <!-- Header -->
      <div style="border-bottom:3px solid #1b9af5;padding-bottom:16px;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
          <div>
            <h1 style="margin:0 0 4px;font-size:24px;color:#1e293b">${itinerary.title}</h1>
            ${itinerary.destination ? `<p style="margin:0;font-size:15px;color:#64748b">📍 ${itinerary.destination}</p>` : ''}
          </div>
          <div style="text-align:right;font-size:13px;color:#64748b">
            ${itinerary.start_date || itinerary.end_date
              ? `<div>📅 ${dateRangeLabel(itinerary.start_date, itinerary.end_date)}</div>` : ''}
            <div>👥 ${itinerary.num_passengers || 1} pasajero${(itinerary.num_passengers || 1) !== 1 ? 's' : ''}</div>
            <div style="margin-top:4px">
              <span style="background:${STATUS_META[itinerary.status]?.bg || '#eee'};color:${STATUS_META[itinerary.status]?.color || '#666'};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600">
                ${STATUS_META[itinerary.status]?.label || itinerary.status}
              </span>
            </div>
          </div>
        </div>
        ${itinerary.contact_name || itinerary.lead_title
          ? `<p style="margin:10px 0 0;font-size:13px;color:#475569">
              ${itinerary.contact_name ? `👤 ${itinerary.contact_name}` : ''}
              ${itinerary.lead_title ? `· Lead: ${itinerary.lead_title}` : ''}
            </p>` : ''}
        ${itinerary.notes ? `<p style="margin:10px 0 0;font-size:13px;color:#64748b;font-style:italic">${itinerary.notes}</p>` : ''}
      </div>

      <!-- Days -->
      ${daysHtml || '<p style="color:#888;font-style:italic">Este itinerario no tiene días registrados.</p>'}

      <!-- Cost summary -->
      ${totalCost > 0 ? `
      <div style="border-top:2px solid #e2e8f0;padding-top:16px;margin-top:8px;text-align:right">
        <strong style="font-size:18px;color:#1e293b">Costo total estimado:
          <span style="color:#059669">$${totalCost.toLocaleString('es',{minimumFractionDigits:2})}</span>
        </strong>
      </div>` : ''}

      <div style="margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px">
        Generado por Fix A Trip CRM · ${new Date().toLocaleDateString('es')}
      </div>
    </body>
    </html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Permite ventanas emergentes para exportar el PDF.'); return; }
  win.document.write(html);
  win.document.close();
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ItinerarioPage() {
  const [view, setView]           = useState('list'); // 'list' | 'detail'
  const [itineraries, setItineraries] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError]         = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [savingDay, setSavingDay] = useState(null); // dayId being saved
  const [headerEdit, setHeaderEdit] = useState(false);
  const [headerForm, setHeaderForm] = useState({});
  const [savingHeader, setSavingHeader] = useState(false);

  // ── Load list ──────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const data = await apiFetch('GET', `/api/itineraries${qs ? `?${qs}` : ''}`);
      setItineraries(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // ── Load detail ────────────────────────────────────────────────────────────
  async function openDetail(it) {
    setDetailLoading(true);
    setView('detail');
    try {
      const data = await apiFetch('GET', `/api/itineraries/${it.id}`);
      setSelected(data.data);
      setHeaderForm({
        title: data.data.title,
        destination: data.data.destination || '',
        start_date: data.data.start_date ? data.data.start_date.slice(0, 10) : '',
        end_date:   data.data.end_date   ? data.data.end_date.slice(0, 10)   : '',
        num_passengers: data.data.num_passengers || 1,
        status: data.data.status || 'draft',
        notes: data.data.notes || '',
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Delete itinerary ───────────────────────────────────────────────────────
  async function deleteItinerary(id) {
    if (!confirm('¿Eliminar este itinerario? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch('DELETE', `/api/itineraries/${id}`);
      setItineraries(prev => prev.filter(i => i.id !== id));
      if (selected?.id === id) { setView('list'); setSelected(null); }
    } catch (e) {
      alert(e.message);
    }
  }

  // ── Save header ────────────────────────────────────────────────────────────
  async function saveHeader() {
    if (!headerForm.title?.trim()) { alert('El título es requerido'); return; }
    setSavingHeader(true);
    try {
      const data = await apiFetch('PATCH', `/api/itineraries/${selected.id}`, {
        ...headerForm,
        num_passengers: Number(headerForm.num_passengers) || 1,
        start_date: headerForm.start_date || null,
        end_date:   headerForm.end_date   || null,
      });
      setSelected(prev => ({ ...prev, ...data.data }));
      setItineraries(prev => prev.map(i => i.id === selected.id ? { ...i, ...data.data } : i));
      setHeaderEdit(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingHeader(false);
    }
  }

  // ── Save day ───────────────────────────────────────────────────────────────
  async function saveDay(dayId, payload) {
    setSavingDay(dayId);
    try {
      const data = await apiFetch('PATCH', `/api/itineraries/${selected.id}/days/${dayId}`, payload);
      setSelected(prev => ({
        ...prev,
        days: prev.days.map(d => d.id === dayId ? data.data : d),
      }));
    } catch (e) {
      alert('Error guardando día: ' + e.message);
    } finally {
      setSavingDay(null);
    }
  }

  // ── Add day ────────────────────────────────────────────────────────────────
  async function addDay() {
    try {
      const data = await apiFetch('POST', `/api/itineraries/${selected.id}/days`, {});
      setSelected(prev => ({ ...prev, days: [...(prev.days || []), data.data] }));
    } catch (e) {
      alert(e.message);
    }
  }

  // ── Delete day ─────────────────────────────────────────────────────────────
  async function deleteDay(dayId) {
    if (!confirm('¿Eliminar este día?')) return;
    try {
      await apiFetch('DELETE', `/api/itineraries/${selected.id}/days/${dayId}`);
      setSelected(prev => ({ ...prev, days: prev.days.filter(d => d.id !== dayId) }));
    } catch (e) {
      alert(e.message);
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = itineraries.filter(it => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      it.title?.toLowerCase().includes(q) ||
      it.destination?.toLowerCase().includes(q) ||
      it.contact_name?.toLowerCase().includes(q) ||
      it.lead_title?.toLowerCase().includes(q)
    );
  });

  // ── RENDER: List ───────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: C.text }}>🗺️ Itinerarios</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>Constructor de itinerarios de viaje</p>
          </div>
          <Btn onClick={() => setShowNew(true)} style={{ background: C.accent, color: '#fff', padding: '9px 18px', fontSize: 14 }}>
            + Nuevo itinerario
          </Btn>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, destino, cliente..."
            style={{
              flex: '1 1 220px', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '8px 14px', fontSize: 13, color: C.text,
            }}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text,
            }}
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="sent">Enviado</option>
            <option value="confirmed">Confirmado</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>Cargando itinerarios...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 15 }}>No hay itinerarios aún.</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Crea el primero para empezar.</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(it => {
              const nd = numDays(it.start_date, it.end_date);
              return (
                <div
                  key={it.id}
                  style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
                    padding: 20, display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  {/* Card top */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 2, wordBreak: 'break-word' }}>
                        {it.title}
                      </div>
                      {it.destination && (
                        <div style={{ fontSize: 13, color: C.muted }}>📍 {it.destination}</div>
                      )}
                    </div>
                    <StatusBadge status={it.status} />
                  </div>

                  {/* Meta info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(it.start_date || it.end_date) && (
                      <div style={{ fontSize: 12, color: C.muted }}>
                        📅 {dateRangeLabel(it.start_date, it.end_date)}
                        {nd > 0 && ` · ${nd} día${nd !== 1 ? 's' : ''}`}
                      </div>
                    )}
                    {it.num_days > 0 && (
                      <div style={{ fontSize: 12, color: C.muted }}>
                        📋 {it.num_days} día{it.num_days !== 1 ? 's' : ''} en itinerario
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: C.muted }}>
                      👥 {it.num_passengers || 1} pasajero{(it.num_passengers || 1) !== 1 ? 's' : ''}
                    </div>
                    {(it.contact_name || it.lead_title) && (
                      <div style={{ fontSize: 12, color: C.muted }}>
                        👤 {it.contact_name || it.lead_title}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Btn
                      onClick={() => openDetail(it)}
                      style={{ flex: 1, justifyContent: 'center', background: C.accent, color: '#fff', fontSize: 13 }}
                    >
                      Abrir
                    </Btn>
                    <Btn
                      onClick={() => deleteItinerary(it.id)}
                      danger
                      style={{ fontSize: 13 }}
                      title="Eliminar"
                    >
                      🗑️
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New Itinerary Modal */}
        {showNew && (
          <NewItineraryModal
            onClose={() => setShowNew(false)}
            onCreate={it => {
              setShowNew(false);
              setItineraries(prev => [it, ...prev]);
              openDetail(it);
            }}
          />
        )}
      </div>
    );
  }

  // ── RENDER: Detail / Editor ────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 16px', maxWidth: 860, margin: '0 auto' }}>
      {/* Back */}
      <Btn
        onClick={() => { setView('list'); setSelected(null); setHeaderEdit(false); }}
        style={{ background: 'transparent', border: `1px solid ${C.border}`, marginBottom: 16 }}
      >
        ← Volver a la lista
      </Btn>

      {detailLoading || !selected ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>Cargando itinerario...</div>
      ) : (
        <>
          {/* Header card */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '20px 24px', marginBottom: 20,
          }}>
            {headerEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <h2 style={{ margin: 0, fontSize: 16, color: C.text }}>Editar información</h2>
                </div>
                <Input label="Título *" value={headerForm.title} onChange={v => setHeaderForm(p => ({ ...p, title: v }))} />
                <Input label="Destino" value={headerForm.destination} onChange={v => setHeaderForm(p => ({ ...p, destination: v }))} placeholder="Ej: Cancún, México" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input label="Fecha inicio" value={headerForm.start_date} onChange={v => setHeaderForm(p => ({ ...p, start_date: v }))} type="date" />
                  <Input label="Fecha fin" value={headerForm.end_date} onChange={v => setHeaderForm(p => ({ ...p, end_date: v }))} type="date" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input label="N° pasajeros" value={headerForm.num_passengers} onChange={v => setHeaderForm(p => ({ ...p, num_passengers: v }))} type="number" />
                  <Select
                    label="Estado"
                    value={headerForm.status}
                    onChange={v => setHeaderForm(p => ({ ...p, status: v }))}
                    options={[
                      { value: 'draft', label: '⬜ Borrador' },
                      { value: 'sent', label: '📤 Enviado' },
                      { value: 'confirmed', label: '✅ Confirmado' },
                    ]}
                  />
                </div>
                <Textarea label="Notas" value={headerForm.notes} onChange={v => setHeaderForm(p => ({ ...p, notes: v }))} rows={2} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Btn onClick={() => setHeaderEdit(false)} style={{ background: 'transparent', border: `1px solid ${C.border}` }}>Cancelar</Btn>
                  <Btn onClick={saveHeader} disabled={savingHeader} style={{ background: C.accent, color: '#fff' }}>
                    {savingHeader ? 'Guardando...' : 'Guardar cambios'}
                  </Btn>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <h1 style={{ margin: '0 0 4px', fontSize: 20, color: C.text }}>{selected.title}</h1>
                    {selected.destination && (
                      <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>📍 {selected.destination}</div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
                      {(selected.start_date || selected.end_date) && (
                        <span style={{ fontSize: 13, color: C.muted }}>📅 {dateRangeLabel(selected.start_date, selected.end_date)}</span>
                      )}
                      <span style={{ fontSize: 13, color: C.muted }}>👥 {selected.num_passengers || 1} pasajero{(selected.num_passengers || 1) !== 1 ? 's' : ''}</span>
                      {(selected.contact_name || selected.lead_title) && (
                        <span style={{ fontSize: 13, color: C.muted }}>👤 {selected.contact_name || selected.lead_title}</span>
                      )}
                    </div>
                    {selected.notes && (
                      <p style={{ margin: '10px 0 0', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{selected.notes}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <StatusBadge status={selected.status} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn
                        onClick={() => setHeaderEdit(true)}
                        style={{ fontSize: 12, padding: '5px 12px', background: C.surface2 }}
                      >
                        ✏️ Editar
                      </Btn>
                      <Btn
                        onClick={() => triggerPrint(selected)}
                        style={{ fontSize: 12, padding: '5px 12px', background: C.surface2 }}
                        title="Exportar PDF"
                      >
                        🖨️ PDF
                      </Btn>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary stats */}
          {(selected.days?.length > 0) && (() => {
            const allItems = (selected.days || []).flatMap(d => Array.isArray(d.items) ? d.items : []);
            const total = allItems.reduce((s, it) => s + (Number(it.price) || 0), 0);
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Días', value: selected.days.length },
                  { label: 'Actividades', value: allItems.length },
                  { label: 'Costo estimado', value: total > 0 ? fmtPrice(total) : '—' },
                  { label: 'Pasajeros', value: selected.num_passengers || 1 },
                ].map(s => (
                  <div key={s.label} style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
                    padding: '12px 18px', flex: '1 1 100px', minWidth: 100,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.accent }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Days */}
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 16, color: C.text }}>
              Días del itinerario
              {savingDay && <span style={{ fontSize: 12, color: C.muted, marginLeft: 10, fontWeight: 400 }}>Guardando...</span>}
            </h2>

            {(!selected.days || selected.days.length === 0) && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
                Sin días registrados. Agrega el primer día.
              </div>
            )}

            {(selected.days || []).map(day => (
              <DayCard
                key={day.id}
                day={day}
                onSave={saveDay}
                onDelete={deleteDay}
                isSaving={savingDay === day.id}
              />
            ))}

            <button
              onClick={addDay}
              style={{
                width: '100%', marginTop: 8,
                background: 'none', border: `2px dashed ${C.border}`,
                borderRadius: 12, padding: '14px 0', cursor: 'pointer',
                color: C.muted, fontSize: 14, fontWeight: 500,
                transition: 'border-color .15s, color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
            >
              + Agregar día
            </button>
          </div>
        </>
      )}
    </div>
  );
}
