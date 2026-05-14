'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';

const STATUS_OPTS = [
  { v: '',          label: 'Todas' },
  { v: 'pending',   label: 'Pendientes' },
  { v: 'confirmed', label: 'Confirmadas' },
  { v: 'completed', label: 'Completadas' },
  { v: 'cancelled', label: 'Canceladas' },
  { v: 'no_show',   label: 'No vino' },
];

const STATUS_COLORS = {
  pending:   { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Pendiente' },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Confirmada' },
  completed: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Completada' },
  cancelled: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'Cancelada' },
  no_show:   { bg: 'rgba(107,114,128,0.20)',color: '#6b7280', label: 'No vino' },
};

export default function CitasPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  // Próximos 30 días por default
  function fmt(d) { return d.toISOString().slice(0,10); }
  const today = new Date();
  const in30 = new Date(today.getTime() + 30*86400000);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({
      from: fmt(today),
      to: fmt(in30),
      ...(status ? { status } : {}),
    }).toString();
    api.appointments(`?${q}`).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [status]);

  const updateStatus = async (id, s) => {
    try { await api.updateAppointment(id, { status: s }); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div style={{ padding: 24, color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📅 Citas</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Próximos 30 días</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={status} onChange={e => setStatus(e.target.value)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
            {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <a href="/agendar" target="_blank" rel="noopener" style={{ background: '#1a3c8f', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Ver página pública →
          </a>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div>No hay citas en este periodo.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 14px' }}>Fecha (PR)</th>
                <th style={{ padding: '12px 14px' }}>Cliente</th>
                <th style={{ padding: '12px 14px' }}>Motivo</th>
                <th style={{ padding: '12px 14px' }}>Tipo</th>
                <th style={{ padding: '12px 14px' }}>Estado</th>
                <th style={{ padding: '12px 14px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => {
                const st = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                const [dPart, tPart] = (a.scheduled_at_pr || '').split('T');
                const fecha = dPart ? `${dPart.split('-').reverse().join('/')} ${tPart}` : '—';
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{fecha}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <Link href={`/leads?id=${a.lead_id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {a.contact_name}
                      </Link>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.contact_phone || a.contact_email || ''}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{a.reason_label}</td>
                    <td style={{ padding: '12px 14px' }}>{a.type === 'llamada' ? '📞 Llamada' : '🏠 Visita'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {a.status === 'pending' && (
                          <button onClick={() => updateStatus(a.id, 'confirmed')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Confirmar</button>
                        )}
                        {(a.status === 'pending' || a.status === 'confirmed') && (
                          <>
                            <button onClick={() => updateStatus(a.id, 'completed')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✓</button>
                            <button onClick={() => { if (confirm('¿Cancelar?')) updateStatus(a.id, 'cancelled'); }} style={{ background: 'none', color: '#ef4444', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
