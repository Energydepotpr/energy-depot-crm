'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import Link from 'next/link';

const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Completada' };
const STATUS_COLOR = { pending: '#f59e0b', confirmed: '#10b981', cancelled: '#ef4444', completed: '#6b7280' };
const STATUS_BG    = { pending: 'rgba(245,158,11,0.12)', confirmed: 'rgba(16,185,129,0.12)', cancelled: 'rgba(239,68,68,0.12)', completed: 'rgba(107,114,128,0.12)' };

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
}
function isUpcoming(dt) { return dt && new Date(dt) > new Date(); }
function isToday(dt) {
  if (!dt) return false;
  const d = new Date(dt), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function StatusBadge({ status }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
      background: STATUS_BG[status] || 'rgba(255,255,255,0.06)',
      color: STATUS_COLOR[status] || 'var(--muted)',
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function BookingModal({ booking, onClose, onUpdated }) {
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes] = useState(booking.notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateBooking(booking.id, { status, notes });
      onUpdated();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', width: '100%', maxWidth: 480 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{booking.client_name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{booking.page_title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Fecha', value: fmtDate(booking.start_time) },
            { label: 'Hora', value: `${fmtTime(booking.start_time)} – ${fmtTime(booking.end_time)}` },
            { label: 'Email', value: booking.client_email || '—' },
            { label: 'Teléfono', value: booking.client_phone || '—' },
            { label: 'Agente', value: booking.agent_name || '—' },
            { label: 'SMS', value: booking.sms_consent ? '✅ Acepta' : '❌ No' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {booking.contact_id && (
            <Link href={`/contacts/${booking.contact_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1b9af5', textDecoration: 'none' }}>
              👤 Ver perfil →
            </Link>
          )}
          {booking.lead_id && (
            <Link href={`/leads/${booking.lead_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b5cf6', textDecoration: 'none' }}>
              🎯 Ver lead →
            </Link>
          )}
          <Link href={`/reservas/pasajeros/${booking.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981', textDecoration: 'none' }}>
            ✈️ Pasajeros →
          </Link>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Estado</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['pending', 'confirmed', 'completed', 'cancelled'].map(s => (
                <button key={s} onClick={() => setStatus(s)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: status === s ? STATUS_BG[s] : 'transparent',
                  color: status === s ? STATUS_COLOR[s] : 'var(--muted)',
                  border: `1px solid ${status === s ? STATUS_COLOR[s] : 'var(--border)'}`,
                }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Notas internas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              placeholder="Notas sobre esta reserva..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, background: '#1b9af5', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReservasPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('todas');
  const [selected, setSelected] = useState(null);
  const [search, setSearch]   = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cargar = () => {
    setLoading(true);
    api.bookings().then(r => {
      setBookings(Array.isArray(r) ? r : []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const TABS = [
    { k: 'todas',      l: 'Todas' },
    { k: 'hoy',        l: 'Hoy' },
    { k: 'pending',    l: 'Pendientes' },
    { k: 'confirmed',  l: 'Confirmadas' },
    { k: 'cancelled',  l: 'Canceladas' },
    { k: 'completed',  l: 'Completadas' },
  ];

  const filtered = bookings.filter(b => {
    if (tab === 'hoy') return isToday(b.start_time);
    if (tab !== 'todas') return b.status === tab;
    return true;
  }).filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (b.client_name || '').toLowerCase().includes(q)
      || (b.client_email || '').toLowerCase().includes(q)
      || (b.client_phone || '').toLowerCase().includes(q)
      || (b.page_title || '').toLowerCase().includes(q);
  });

  // Stats
  const counts = {
    total:     bookings.length,
    hoy:       bookings.filter(b => isToday(b.start_time)).length,
    pending:   bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    upcoming:  bookings.filter(b => isUpcoming(b.start_time) && b.status !== 'cancelled').length,
  };

  const pad = isMobile ? '10px 12px' : '16px 24px';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', padding: pad }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700 }}>📅 Reservas</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{counts.total} reservas · {counts.upcoming} próximas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => {
            const headers = ['Cliente','Email','Teléfono','Servicio','Fecha','Hora inicio','Hora fin','Estado','Agente','Notas'];
            const rows = filtered.map(b => [b.client_name, b.client_email||'', b.client_phone||'', b.page_title||'', fmtDate(b.start_time), fmtTime(b.start_time), fmtTime(b.end_time), STATUS_LABEL[b.status]||b.status, b.agent_name||'', b.notes||'']);
            const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})); a.download='reservas.csv'; a.click();
          }} style={{ fontSize: 12, color: '#10b981', padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', cursor: 'pointer' }}>
            ↓ Exportar CSV
          </button>
          <Link href="/agenda" style={{ fontSize: 12, color: '#1b9af5', textDecoration: 'none', padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)' }}>
            Ver agenda →
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: isMobile ? 6 : 10, marginBottom: 14 }}>
        {[
          { label: 'Total',      value: counts.total,     color: '#6b7280' },
          { label: 'Hoy',        value: counts.hoy,       color: '#1b9af5' },
          { label: 'Pendientes', value: counts.pending,   color: '#f59e0b' },
          { label: 'Confirmadas',value: counts.confirmed, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderLeft: `3px solid ${s.color}`, borderRadius: 8, padding: isMobile ? '8px 10px' : '10px 14px' }}>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: isMobile ? 9 : 10, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Tabs */}
      <div style={{ marginBottom: 12 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, teléfono..."
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
        />
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: tab === t.k ? 600 : 400,
              background: tab === t.k ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: tab === t.k ? '#1b9af5' : 'var(--muted)',
              border: tab === t.k ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{t.l}{t.k === 'pending' && counts.pending > 0 ? ` (${counts.pending})` : ''}</button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando reservas...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
          {search ? 'No hay reservas que coincidan con la búsqueda' : 'No hay reservas en esta categoría'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(b => (
            <div key={b.id} onClick={() => setSelected(b)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: isMobile ? '10px 12px' : '12px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#1b9af5'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Date block */}
                <div style={{ background: isToday(b.start_time) ? 'rgba(59,130,246,0.15)' : 'var(--bg)', borderRadius: 8, padding: '6px 10px', textAlign: 'center', flexShrink: 0, minWidth: 48 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: isToday(b.start_time) ? '#1b9af5' : 'var(--text)', lineHeight: 1 }}>
                    {new Date(b.start_time).getDate()}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    {new Date(b.start_time).toLocaleDateString('es-PR', { month: 'short' })}
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.client_name}</span>
                    <StatusBadge status={b.status} />
                    {isToday(b.start_time) && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#1b9af5', background: 'rgba(59,130,246,0.12)', padding: '1px 8px', borderRadius: 20 }}>HOY</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
                    🕐 {fmtTime(b.start_time)} – {fmtTime(b.end_time)} · {b.page_title}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {b.client_email && <span style={{ fontSize: 11, color: 'var(--muted)' }}>✉️ {b.client_email}</span>}
                    {b.client_phone && <span style={{ fontSize: 11, color: 'var(--muted)' }}>📱 {b.client_phone}</span>}
                    {b.agent_name   && <span style={{ fontSize: 11, color: 'var(--muted)' }}>👤 {b.agent_name}</span>}
                  </div>
                  {b.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {b.notes}</div>}
                </div>

                {/* Quick actions */}
                {!isMobile && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {b.status === 'pending' && (
                      <button onClick={async e => { e.stopPropagation(); await api.updateBooking(b.id, { status: 'confirmed' }); cargar(); }}
                        style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', fontWeight: 600 }}>
                        ✓ Confirmar
                      </button>
                    )}
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button onClick={async e => { e.stopPropagation(); if (!confirm('¿Cancelar esta reserva?')) return; await api.updateBooking(b.id, { status: 'cancelled' }); cargar(); }}
                        style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                        ✕ Cancelar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <BookingModal booking={selected} onClose={() => setSelected(null)} onUpdated={cargar} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
