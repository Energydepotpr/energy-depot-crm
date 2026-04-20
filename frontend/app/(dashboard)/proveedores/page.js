'use client';
import { useState, useEffect, useCallback } from 'react';

const BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/backend')
  : '';

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

// ── Type config ───────────────────────────────────────────────────────────────
const TYPES = [
  { value: 'hotel',     label: 'Hotel',      color: '#10b981' },
  { value: 'aerolinea', label: 'Aerolínea',  color: '#1877f2' },
  { value: 'operador',  label: 'Operador',   color: '#f59e0b' },
  { value: 'traslado',  label: 'Traslado',   color: '#8b5cf6' },
  { value: 'seguro',    label: 'Seguro',     color: '#ef4444' },
  { value: 'otro',      label: 'Otro',       color: '#64748b' },
];

function typeInfo(value) {
  return TYPES.find(t => t.value === value) || { label: value || '—', color: '#64748b' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function Stars({ value, interactive = false, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={interactive ? () => onChange(n) : undefined}
          style={{
            fontSize: 16,
            color: n <= (value || 0) ? '#f59e0b' : '#374151',
            cursor: interactive ? 'pointer' : 'default',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title={interactive ? `${n} estrella${n > 1 ? 's' : ''}` : undefined}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function TypeBadge({ value }) {
  const info = typeInfo(value);
  if (!value) return <span style={{ color: C.muted, fontSize: 12 }}>—</span>;
  return (
    <span style={{
      background: `${info.color}22`,
      color: info.color,
      border: `1px solid ${info.color}44`,
      borderRadius: 20,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.3,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      {info.label}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: '14px 18px',
      flex: '1 1 120px',
      minWidth: 110,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Modal crear / editar ──────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', type: '', country: '', city: '', contact_name: '',
  phone: '', email: '', website: '', rating: 0, commission_pct: '',
  notes: '', active: true,
};

function SupplierModal({ supplier, onClose, onSaved }) {
  const isEdit = !!supplier;
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (supplier) {
      setForm({
        name:           supplier.name           || '',
        type:           supplier.type           || '',
        country:        supplier.country        || '',
        city:           supplier.city           || '',
        contact_name:   supplier.contact_name   || '',
        phone:          supplier.phone          || '',
        email:          supplier.email          || '',
        website:        supplier.website        || '',
        rating:         supplier.rating         || 0,
        commission_pct: supplier.commission_pct != null ? String(supplier.commission_pct) : '',
        notes:          supplier.notes          || '',
        active:         supplier.active !== false,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [supplier]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name:           form.name.trim(),
        type:           form.type           || null,
        country:        form.country        || null,
        city:           form.city           || null,
        contact_name:   form.contact_name   || null,
        phone:          form.phone          || null,
        email:          form.email          || null,
        website:        form.website        || null,
        rating:         Number(form.rating) || 0,
        commission_pct: form.commission_pct !== '' ? Number(form.commission_pct) : 0,
        notes:          form.notes          || null,
        active:         form.active,
      };
      const url  = isEdit ? `${BASE_URL}/api/suppliers/${supplier.id}` : `${BASE_URL}/api/suppliers`;
      const method = isEdit ? 'PATCH' : 'POST';
      const resp = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al guardar');
      onSaved();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', background: C.surface2, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.text,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, color: C.muted, marginBottom: 5, display: 'block', fontWeight: 500 };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
            {isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Nombre */}
          <div>
            <label style={labelStyle}>Nombre *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej: Hotel Barceló"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Tipo + País */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— Sin tipo —</option>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>País</label>
              <input value={form.country} onChange={e => set('country', e.target.value)} placeholder="México" style={inputStyle} />
            </div>
          </div>

          {/* Ciudad + Contacto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Ciudad</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Cancún" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Persona de contacto</label>
              <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="María García" style={inputStyle} />
            </div>
          </div>

          {/* Teléfono + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+52 555 123 4567" style={inputStyle} type="tel" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@hotel.com" style={inputStyle} type="email" />
            </div>
          </div>

          {/* Website */}
          <div>
            <label style={labelStyle}>Sitio web</label>
            <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://www.hotel.com" style={inputStyle} type="url" />
          </div>

          {/* Rating + Comisión */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Calificación</label>
              <div style={{ marginTop: 6 }}>
                <Stars value={form.rating} interactive onChange={v => set('rating', v)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Comisión (%)</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={form.commission_pct}
                  onChange={e => set('commission_pct', e.target.value)}
                  placeholder="10"
                  style={{ ...inputStyle, paddingRight: 32 }}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13, pointerEvents: 'none' }}>%</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={labelStyle}>Notas internas</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Observaciones, condiciones especiales, etc."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Activo */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 2 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => set('active', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.accent, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: C.text }}>Proveedor activo</span>
          </label>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
              {error}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 20px', fontSize: 14, color: C.text, cursor: 'pointer', fontWeight: 500 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ background: C.accent, border: 'none', borderRadius: 10, padding: '9px 24px', fontSize: 14, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm delete ────────────────────────────────────────────────────────────
function DeleteConfirm({ supplier, onClose, onConfirm }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 400 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Desactivar proveedor</div>
            <div style={{ fontSize: 13, color: C.muted }}>
              ¿Desactivar a <strong style={{ color: C.text }}>{supplier.name}</strong>? Podrás reactivarlo después.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 18px', fontSize: 13, color: C.text, cursor: 'pointer', fontWeight: 500 }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{ background: '#ef4444', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 13, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Desactivar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────
function SupplierCard({ s, onEdit, onDelete }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: '16px 16px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <TypeBadge value={s.type} />
            {!s.active && (
              <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Inactivo</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onEdit(s)} title="Editar" style={{ background: 'rgba(99,102,241,0.1)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" fill="none" stroke="#818cf8" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L18 8.625" /></svg>
          </button>
          <button onClick={() => onDelete(s)} title="Desactivar" style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
        {(s.country || s.city) && (
          <div style={{ color: C.muted }}>
            <span style={{ color: C.text, fontWeight: 500 }}>📍 </span>
            {[s.city, s.country].filter(Boolean).join(', ')}
          </div>
        )}
        {s.contact_name && (
          <div style={{ color: C.muted }}>
            <span style={{ color: C.text, fontWeight: 500 }}>👤 </span>
            {s.contact_name}
          </div>
        )}
        {s.phone && (
          <div style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: C.text, fontWeight: 500 }}>📞 </span>
            <a href={`tel:${s.phone}`} style={{ color: C.muted, textDecoration: 'none' }}>{s.phone}</a>
          </div>
        )}
        {s.email && (
          <div style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: C.text, fontWeight: 500 }}>✉️ </span>
            <a href={`mailto:${s.email}`} style={{ color: C.muted, textDecoration: 'none' }}>{s.email}</a>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <Stars value={s.rating} />
        {Number(s.commission_pct) > 0 && (
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
            {Number(s.commission_pct).toFixed(1)}% comisión
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [soloActivos, setSoloActivos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [delConfirm, setDelConfirm]     = useState(null);
  const [isMobile, setIsMobile]         = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)      params.set('search', search);
      if (typeFilter)  params.set('type', typeFilter);
      if (soloActivos) params.set('active', 'true');

      const resp = await fetch(`${BASE_URL}/api/suppliers?${params}`, { headers: authHeaders() });
      const data = await resp.json();
      setSuppliers(data.suppliers || []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, soloActivos]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  // Stats
  const total    = suppliers.length;
  const hoteles  = suppliers.filter(s => s.type === 'hotel').length;
  const aereos   = suppliers.filter(s => s.type === 'aerolinea').length;
  const operadores = suppliers.filter(s => s.type === 'operador').length;
  const activos  = suppliers.filter(s => s.active).length;

  const openCreate = () => { setEditSupplier(null); setModalOpen(true); };
  const openEdit   = (s) => { setEditSupplier(s);   setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditSupplier(null); };
  const handleSaved = () => { closeModal(); loadSuppliers(); };

  const handleDelete = async () => {
    if (!delConfirm) return;
    try {
      await fetch(`${BASE_URL}/api/suppliers/${delConfirm.id}`, { method: 'DELETE', headers: authHeaders() });
      setDelConfirm(null);
      loadSuppliers();
    } catch {
      alert('Error al desactivar proveedor');
    }
  };

  const inputStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    color: C.text,
    outline: 'none',
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: isMobile ? '16px 12px 60px' : '24px 24px 60px', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Proveedores</span>
          <span style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 12, color: C.muted, fontWeight: 600 }}>
            {total}
          </span>
        </div>
        <button
          onClick={openCreate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.accent, border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo proveedor
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedores..."
            style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">Todos los tipos</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Solo activos toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', background: soloActivos ? 'rgba(16,185,129,0.1)' : C.surface, border: `1px solid ${soloActivos ? '#10b98144' : C.border}`, borderRadius: 10, whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={e => setSoloActivos(e.target.checked)}
            style={{ accentColor: '#10b981', width: 14, height: 14, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: soloActivos ? '#10b981' : C.muted, fontWeight: soloActivos ? 600 : 400 }}>Solo activos</span>
        </label>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total"      value={total}      color={C.text} />
        <StatCard label="Activos"    value={activos}    color="#10b981" />
        <StatCard label="Hoteles"    value={hoteles}    color="#10b981" />
        <StatCard label="Aerolíneas" value={aereos}     color="#1877f2" />
        <StatCard label="Operadores" value={operadores} color="#f59e0b" />
      </div>

      {/* ── Content ── */}
      {loading && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: C.muted }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && suppliers.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: C.muted }}>
          <svg width="52" height="52" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ marginBottom: 14, opacity: 0.35 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
          </svg>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Sin proveedores</div>
          <div style={{ fontSize: 13 }}>Agrega tu primer proveedor con el botón "Nuevo proveedor"</div>
        </div>
      )}

      {/* Mobile: cards */}
      {!loading && suppliers.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suppliers.map(s => (
            <SupplierCard key={s.id} s={s} onEdit={openEdit} onDelete={setDelConfirm} />
          ))}
        </div>
      )}

      {/* Desktop: table */}
      {!loading && suppliers.length > 0 && !isMobile && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', overflowX: 'auto' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 160px 160px 100px 80px 90px 110px', borderBottom: `1px solid ${C.border}`, padding: '0 16px' }}>
            {['Nombre', 'Tipo', 'Ubicación', 'Contacto', 'Teléfono / Email', 'Rating', 'Comis.', 'Acciones'].map(h => (
              <div key={h} style={{ padding: '11px 8px', fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {suppliers.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 120px 160px 160px 100px 80px 90px 110px',
                padding: '0 16px',
                borderBottom: i < suppliers.length - 1 ? `1px solid ${C.border}` : 'none',
                background: 'transparent',
                transition: 'background 0.12s',
                opacity: s.active ? 1 : 0.6,
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Nombre */}
              <div style={{ padding: '13px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  {!s.active && (
                    <span style={{ flexShrink: 0, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>Inactivo</span>
                  )}
                </div>
                {s.website && (
                  <a href={s.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.muted, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {s.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>

              {/* Tipo */}
              <div style={{ padding: '13px 8px', display: 'flex', alignItems: 'center' }}>
                <TypeBadge value={s.type} />
              </div>

              {/* Ubicación */}
              <div style={{ padding: '13px 8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                </span>
              </div>

              {/* Contacto */}
              <div style={{ padding: '13px 8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.contact_name || '—'}
                </span>
              </div>

              {/* Teléfono / Email */}
              <div style={{ padding: '13px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                {s.phone && (
                  <a href={`tel:${s.phone}`} style={{ fontSize: 12, color: C.muted, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.phone}</a>
                )}
                {s.email && (
                  <a href={`mailto:${s.email}`} style={{ fontSize: 12, color: C.muted, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</a>
                )}
                {!s.phone && !s.email && <span style={{ fontSize: 13, color: C.muted }}>—</span>}
              </div>

              {/* Rating */}
              <div style={{ padding: '13px 8px', display: 'flex', alignItems: 'center' }}>
                <Stars value={s.rating} />
              </div>

              {/* Comisión */}
              <div style={{ padding: '13px 8px', display: 'flex', alignItems: 'center' }}>
                {Number(s.commission_pct) > 0 ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>{Number(s.commission_pct).toFixed(1)}%</span>
                ) : (
                  <span style={{ fontSize: 13, color: C.muted }}>—</span>
                )}
              </div>

              {/* Acciones */}
              <div style={{ padding: '13px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => openEdit(s)}
                  title="Editar"
                  style={{ background: 'rgba(99,102,241,0.1)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="14" height="14" fill="none" stroke="#818cf8" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L18 8.625" />
                  </svg>
                </button>
                <button
                  onClick={() => setDelConfirm(s)}
                  title="Desactivar"
                  style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modalOpen && (
        <SupplierModal
          supplier={editSupplier}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {delConfirm && (
        <DeleteConfirm
          supplier={delConfirm}
          onClose={() => setDelConfirm(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
