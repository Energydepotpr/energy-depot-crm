'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : '/backend'
    : '';

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Passport expiry color helper ──────────────────────────────────────────────
function passportExpiryStyle(expiryDate) {
  if (!expiryDate) return { color: 'var(--muted)', label: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)   return { color: '#ef4444', label: 'Vencido' };
  if (diffDays < 30)  return { color: '#ef4444', label: `Vence en ${diffDays}d` };
  if (diffDays < 90)  return { color: '#f59e0b', label: `Vence en ${diffDays}d` };
  return { color: '#10b981', label: null };
}

function fmtDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleDateString('es-PR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return val; }
}

function fmtDateInput(val) {
  // Returns YYYY-MM-DD from ISO string or date object for <input type="date">
  if (!val) return '';
  try { return new Date(val).toISOString().slice(0, 10); } catch { return ''; }
}

// ── Empty passenger form state ────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  passport_number: '',
  passport_expiry: '',
  notes: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function PassengerForm({ initial = EMPTY_FORM, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 11,
    color: 'var(--muted)',
    display: 'block',
    marginBottom: 4,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '16px 18px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px 16px' }}>
        {/* Name */}
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Nombre *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Nombre completo"
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="email@ejemplo.com"
            style={inputStyle}
          />
        </div>

        {/* Phone */}
        <div>
          <label style={labelStyle}>Teléfono</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+1 787 000 0000"
            style={inputStyle}
          />
        </div>

        {/* Passport number */}
        <div>
          <label style={labelStyle}>Pasaporte</label>
          <input
            type="text"
            value={form.passport_number}
            onChange={e => set('passport_number', e.target.value)}
            placeholder="Número de pasaporte"
            style={inputStyle}
          />
        </div>

        {/* Passport expiry */}
        <div>
          <label style={labelStyle}>Vence pasaporte</label>
          <input
            type="date"
            value={form.passport_expiry}
            onChange={e => set('passport_expiry', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Notas</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="Requerimientos especiales, alergias, etc."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px', borderRadius: 8, background: 'none',
            border: '1px solid var(--border)', color: 'var(--muted)',
            fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          style={{
            padding: '8px 18px', borderRadius: 8, background: '#1b9af5',
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !form.name.trim() ? 0.6 : 1,
          }}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function PassengerCard({ passenger, onEdit, onDelete, deleting }) {
  const expiry = passportExpiryStyle(passenger.passport_expiry);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 10,
    }}>
      {/* Top row: name + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0 }}>
          {passenger.name}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onEdit(passenger)}
            style={{
              padding: '5px 12px', borderRadius: 7,
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
              color: '#1b9af5', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Editar
          </button>
          <button
            onClick={() => onDelete(passenger.id)}
            disabled={deleting === passenger.id}
            style={{
              padding: '5px 12px', borderRadius: 7,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', fontSize: 12, fontWeight: 600,
              cursor: deleting === passenger.id ? 'not-allowed' : 'pointer',
              opacity: deleting === passenger.id ? 0.6 : 1,
            }}
          >
            {deleting === passenger.id ? '...' : 'Eliminar'}
          </button>
        </div>
      </div>

      {/* Details grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '8px 16px',
        marginTop: 10,
      }}>
        {passenger.email && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Email</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{passenger.email}</div>
          </div>
        )}
        {passenger.phone && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Teléfono</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{passenger.phone}</div>
          </div>
        )}
        {(passenger.passport_number || passenger.passport_expiry) && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Pasaporte</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {passenger.passport_number || '—'}
            </div>
          </div>
        )}
        {passenger.passport_expiry && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Vence pasaporte</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: expiry.color, fontWeight: 600 }}>
                {fmtDate(passenger.passport_expiry)}
              </span>
              {expiry.label && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                  background: expiry.color + '22', color: expiry.color,
                }}>
                  {expiry.label}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {passenger.notes && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 7 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Notas</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{passenger.notes}</div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PasajerosPage() {
  const { bookingId } = useParams();
  const router = useRouter();

  const [passengers, setPassengers] = useState([]);
  const [bookingTitle, setBookingTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState(null); // passenger object
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // passenger id
  const [exporting, setExporting] = useState(false);

  // ── Fetch passengers ────────────────────────────────────────────────────────
  const fetchPassengers = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/passengers`, {
        headers: getHeaders(),
      });
      if (res.status === 401) {
        localStorage.removeItem('crm_token');
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPassengers(data.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [bookingId]);

  // ── Fetch booking info for the header title ─────────────────────────────────
  const fetchBookingInfo = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/booking/bookings`, {
        headers: getHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.data || data || [];
      const found = list.find(b => String(b.id) === String(bookingId));
      if (found) {
        setBookingTitle(found.page_title || found.client_name || `Reserva #${bookingId}`);
      } else {
        setBookingTitle(`Reserva #${bookingId}`);
      }
    } catch {
      setBookingTitle(`Reserva #${bookingId}`);
    }
  }, [bookingId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPassengers(), fetchBookingInfo()]).finally(() => setLoading(false));
  }, [fetchPassengers, fetchBookingInfo]);

  // ── Add passenger ───────────────────────────────────────────────────────────
  const handleAdd = async (form) => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/passengers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear pasajero');
      setPassengers(prev => [...prev, data.data]);
      setShowAddForm(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Update passenger ────────────────────────────────────────────────────────
  const handleUpdate = async (form) => {
    if (!editingPassenger) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${BASE_URL}/api/bookings/${bookingId}/passengers/${editingPassenger.id}`,
        {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar pasajero');
      setPassengers(prev => prev.map(p => p.id === editingPassenger.id ? data.data : p));
      setEditingPassenger(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete passenger ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este pasajero?')) return;
    setDeleting(id);
    try {
      const res = await fetch(
        `${BASE_URL}/api/bookings/${bookingId}/passengers/${id}`,
        { method: 'DELETE', headers: getHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      setPassengers(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  // ── Export manifesto ────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(
        `${BASE_URL}/api/bookings/${bookingId}/passengers/manifesto`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al exportar');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `manifiesto_${bookingId}.csv`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Open edit form ──────────────────────────────────────────────────────────
  const openEdit = (passenger) => {
    setShowAddForm(false);
    setEditingPassenger({
      ...passenger,
      passport_expiry: fmtDateInput(passenger.passport_expiry),
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const btnBase = {
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', padding: '8px 16px',
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 12px 48px' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap',
        justifyContent: 'space-between', marginBottom: 20,
      }}>
        {/* Left: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <button
            onClick={() => router.push('/reservas')}
            style={{
              ...btnBase, background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--muted)', padding: '7px 12px', fontSize: 14, flexShrink: 0,
            }}
          >
            ← Volver
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              Pasajeros
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {loading ? '...' : bookingTitle}
            </div>
          </div>
        </div>

        {/* Right: badge + export + add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
            background: 'rgba(59,130,246,0.12)', color: '#1b9af5',
            border: '1px solid rgba(59,130,246,0.25)',
          }}>
            {passengers.length} {passengers.length === 1 ? 'pasajero' : 'pasajeros'}
          </span>

          <button
            onClick={handleExport}
            disabled={exporting || passengers.length === 0}
            style={{
              ...btnBase,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', opacity: exporting || passengers.length === 0 ? 0.5 : 1,
              cursor: exporting || passengers.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? 'Exportando...' : '⬇ Manifiesto CSV'}
          </button>

          <button
            onClick={() => { setShowAddForm(v => !v); setEditingPassenger(null); }}
            style={{ ...btnBase, background: '#1b9af5', color: '#fff' }}
          >
            {showAddForm ? '✕ Cancelar' : '+ Agregar pasajero'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 14,
        }}>
          Error: {error}
        </div>
      )}

      {/* ── Add form ── */}
      {showAddForm && (
        <PassengerForm
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          saving={saving}
        />
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 14 }}>
          Cargando pasajeros...
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && passengers.length === 0 && !showAddForm && (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✈️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Sin pasajeros registrados
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 320, margin: '0 auto' }}>
            Agrega los viajeros de este grupo para generar el manifiesto de pasajeros.
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            style={{ ...btnBase, background: '#1b9af5', color: '#fff', marginTop: 18 }}
          >
            + Agregar primer pasajero
          </button>
        </div>
      )}

      {/* ── Passenger list ── */}
      {!loading && passengers.map(passenger => (
        <div key={passenger.id}>
          {/* Inline edit form replaces the card */}
          {editingPassenger?.id === passenger.id ? (
            <PassengerForm
              initial={editingPassenger}
              onSave={handleUpdate}
              onCancel={() => setEditingPassenger(null)}
              saving={saving}
            />
          ) : (
            <PassengerCard
              passenger={passenger}
              onEdit={openEdit}
              onDelete={handleDelete}
              deleting={deleting}
            />
          )}
        </div>
      ))}
    </div>
  );
}
