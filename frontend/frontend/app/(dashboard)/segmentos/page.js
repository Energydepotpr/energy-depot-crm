'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SOURCE_OPTIONS = [
  { value: '', label: '— Sin filtro —' },
  { value: 'manual', label: 'Manual' },
  { value: 'import', label: 'Importado' },
  { value: 'webhook', label: 'Web / Webhook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
];

const BOOL_OPTIONS = [
  { value: '', label: '— Sin filtro —' },
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
];

const FILTER_DEFS = [
  { key: 'source',         label: 'Fuente',           type: 'select', options: SOURCE_OPTIONS },
  { key: 'has_email',      label: 'Tiene email',       type: 'select', options: BOOL_OPTIONS },
  { key: 'has_phone',      label: 'Tiene teléfono',    type: 'select', options: BOOL_OPTIONS },
  { key: 'created_after',  label: 'Creado desde',      type: 'date'   },
  { key: 'created_before', label: 'Creado hasta',      type: 'date'   },
  { key: 'company',        label: 'Empresa (contiene)', type: 'text'  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:    { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'inherit' },
  topBar:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 },
  title:   { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' },
  badge:   { background: 'var(--surface)', color: 'var(--muted)', fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 8px' },
  btnPrimary: { background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' },
  card:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s' },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: '24px' },
  label:   { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:   { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' },
  select:  { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' },
  overlay: { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.6)' },
  modal:   { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' },
  row:     { display: 'flex', alignItems: 'center', gap: 8 },
};

// ─── Filter Builder Component ─────────────────────────────────────────────────

function FilterBuilder({ filters, onChange }) {
  const activeKeys = Object.keys(filters).filter(k => {
    const v = filters[k];
    return v !== '' && v !== null && v !== undefined;
  });

  const addFilter = (key) => {
    onChange({ ...filters, [key]: '' });
  };

  const removeFilter = (key) => {
    const next = { ...filters };
    delete next[key];
    onChange(next);
  };

  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const unusedDefs = FILTER_DEFS.filter(d => !(d.key in filters));

  return (
    <div>
      {/* Active filters */}
      {FILTER_DEFS.filter(d => d.key in filters).map(def => (
        <div key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ minWidth: 140, fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{def.label}</div>
          {def.type === 'select' ? (
            <select
              style={{ ...S.select, flex: 1 }}
              value={filters[def.key] || ''}
              onChange={e => updateFilter(def.key, e.target.value)}
            >
              {def.options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={def.type}
              style={{ ...S.input, flex: 1 }}
              value={filters[def.key] || ''}
              onChange={e => updateFilter(def.key, e.target.value)}
              placeholder={def.type === 'text' ? 'Escribir...' : undefined}
            />
          )}
          <button
            onClick={() => removeFilter(def.key)}
            title="Quitar filtro"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Add filter button */}
      {unusedDefs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <select
            style={{ ...S.select, color: 'var(--muted)' }}
            value=""
            onChange={e => { if (e.target.value) addFilter(e.target.value); }}
          >
            <option value="">+ Agregar condición...</option>
            {unusedDefs.map(d => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {Object.keys(filters).length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
          Sin filtros aplicados: incluirá todos los contactos.
        </p>
      )}
    </div>
  );
}

// ─── Segment Modal ────────────────────────────────────────────────────────────

function SegmentModal({ segment, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        segment?.name        || '',
    description: segment?.description || '',
    filters:     segment?.filters     || {},
  });
  const [preview, setPreview] = useState(null);  // { count, sample }
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-preview when filters change (debounced 600ms)
  useEffect(() => {
    const t = setTimeout(() => { runPreview(form.filters); }, 600);
    return () => clearTimeout(t);
  }, [JSON.stringify(form.filters)]);

  const runPreview = async (filters) => {
    setPreviewing(true);
    try {
      const r = await api.previewSegment(filters);
      setPreview(r);
    } catch {}
    setPreviewing(false);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (segment) {
        await api.updateSegment(segment.id, form);
      } else {
        await api.createSegment(form);
      }
      onSaved();
      onClose();
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {segment ? 'Editar segmento' : 'Nuevo segmento'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Nombre *</label>
          <input
            style={S.input}
            type="text"
            placeholder="Ej: Clientes con email activos"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>Descripción</label>
          <textarea
            style={{ ...S.input, resize: 'vertical', minHeight: 60 }}
            placeholder="Descripción opcional..."
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* Filters */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...S.label, marginBottom: 10 }}>Condiciones del segmento</label>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <FilterBuilder
              filters={form.filters}
              onChange={f => setForm(p => ({ ...p, filters: f }))}
            />
          </div>
        </div>

        {/* Preview */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 22 }}>
          {previewing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              Calculando...
            </div>
          ) : preview ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Este segmento contiene{' '}
                <span style={{ color: 'var(--accent)', fontSize: 16 }}>{preview.count}</span>{' '}
                contacto{preview.count !== 1 ? 's' : ''}
              </div>
              {preview.sample && preview.sample.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Muestra: {preview.sample.map(c => c.name).join(', ')}
                  {preview.count > preview.sample.length ? ` y ${preview.count - preview.sample.length} más...` : ''}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Vista previa del segmento aparecerá aquí</div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            style={{ ...S.btnPrimary, flex: 1, opacity: (!form.name.trim() || saving) ? 0.5 : 1 }}
          >
            {saving ? 'Guardando...' : 'Guardar segmento'}
          </button>
          <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Contacts Drawer ──────────────────────────────────────────────────────────

function ContactsDrawer({ segment, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.segmentContacts(segment.id)
      .then(r => setContacts(r.contacts || []))
      .catch(e => alert(e.message))
      .finally(() => setLoading(false));
  }, [segment.id]);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{segment.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '3px 0 0' }}>
              {loading ? 'Cargando...' : `${contacts.length} contacto${contacts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
            <div style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Cargando contactos...
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
            No hay contactos que coincidan con este segmento
          </div>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Nombre', 'Email', 'Teléfono', 'Empresa'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted)' }}>{c.email || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted)' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--muted)' }}>{c.company || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ ...S.btnGhost, width: '100%' }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SegmentosPage() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);         // null | 'new' | segment object
  const [drawer, setDrawer] = useState(null);        // segment object | null
  const [hoveredId, setHoveredId] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    api.segments()
      .then(r => setSegments(r.segments || []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (seg) => {
    if (!confirm(`¿Eliminar el segmento "${seg.name}"?`)) return;
    try {
      await api.deleteSegment(seg.id);
      setSegments(prev => prev.filter(s => s.id !== seg.id));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.title}>Segmentos</span>
          <span style={S.badge}>{loading ? '...' : segments.length}</span>
        </div>
        <button onClick={() => setModal('new')} style={S.btnPrimary}>
          + Nuevo Segmento
        </button>
      </div>

      {/* Description bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          Los segmentos agrupan contactos por criterios. Úsalos para enviar campañas dirigidas.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, color: 'var(--muted)', fontSize: 14 }}>
          <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Cargando segmentos...
        </div>
      ) : segments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No hay segmentos</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Crea tu primer segmento para organizar tus contactos</div>
          <button onClick={() => setModal('new')} style={S.btnPrimary}>+ Crear segmento</button>
        </div>
      ) : (
        <div style={S.grid}>
          {segments.map(seg => (
            <div
              key={seg.id}
              style={{
                ...S.card,
                borderColor: hoveredId === seg.id ? 'var(--accent)' : 'var(--border)',
              }}
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    onClick={() => setDrawer(seg)}
                    style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}
                  >
                    {seg.name}
                  </div>
                  {seg.description && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {seg.description}
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0, opacity: hoveredId === seg.id ? 1 : 0, transition: 'opacity 0.15s' }}>
                  <button
                    onClick={() => setModal(seg)}
                    title="Editar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = '#1b9af5'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => eliminar(seg)}
                    title="Eliminar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Contact count */}
              <div
                onClick={() => setDrawer(seg)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, cursor: 'pointer', marginBottom: 12 }}
              >
                <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{seg.contact_count}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>contacto{seg.contact_count !== 1 ? 's' : ''}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>Ver →</span>
              </div>

              {/* Filters preview */}
              {seg.filters && Object.keys(seg.filters).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {Object.entries(seg.filters).map(([k, v]) => {
                    if (!v && v !== false) return null;
                    const def = FILTER_DEFS.find(d => d.key === k);
                    const label = def?.label || k;
                    let valueLabel = String(v);
                    if (def?.type === 'select') {
                      const opt = def.options?.find(o => o.value === String(v));
                      if (opt) valueLabel = opt.label;
                    }
                    return (
                      <span key={k} style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>
                        {label}: {valueLabel}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sin filtros — todos los contactos</div>
              )}

              {/* Footer */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
                Creado {formatDate(seg.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <SegmentModal
          segment={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={cargar}
        />
      )}
      {drawer && (
        <ContactsDrawer
          segment={drawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
