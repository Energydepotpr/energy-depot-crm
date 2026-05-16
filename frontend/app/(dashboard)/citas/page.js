'use client';
import { useEffect, useMemo, useState } from 'react';
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
  pending:   { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b', label: 'Pendiente' },
  confirmed: { bg: 'rgba(59,130,246,0.18)', color: '#3b82f6', label: 'Confirmada' },
  completed: { bg: 'rgba(16,185,129,0.18)', color: '#10b981', label: 'Completada' },
  cancelled: { bg: 'rgba(239,68,68,0.18)',  color: '#ef4444', label: 'Cancelada' },
  no_show:   { bg: 'rgba(107,114,128,0.22)',color: '#6b7280', label: 'No vino' },
};

const MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIA_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const sameDay = (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

export default function CitasPage() {
  const [view, setView] = useState('cal'); // cal | list
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [appts, setAppts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  // Rango: del 1ro del mes - 7 días al último del mes + 7 días (para cubrir semanas que salen del mes)
  const rangeFrom = useMemo(() => {
    const d = new Date(cursor); d.setDate(1); d.setDate(d.getDate() - 7); return d;
  }, [cursor]);
  const rangeTo = useMemo(() => {
    const d = new Date(cursor); d.setMonth(d.getMonth()+1); d.setDate(0); d.setDate(d.getDate() + 7); return d;
  }, [cursor]);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({
      from: fmtDate(rangeFrom),
      to: fmtDate(rangeTo),
      ...(status ? { status } : {}),
    }).toString();
    Promise.all([
      api.appointments(`?${q}`).catch(() => []),
      api.tasks(`?completed=false`).catch(() => []),
    ]).then(([a, t]) => {
      setAppts(Array.isArray(a) ? a : (a?.items || []));
      setTasks(Array.isArray(t) ? t : (t?.items || []));
    }).finally(() => setLoading(false));
  };
  useEffect(load, [cursor, status]);

  const updateStatus = async (id, s) => {
    try { await api.updateAppointment(id, { status: s }); load(); }
    catch (e) { alert(e.message); }
  };

  // Grilla del mes: 6 semanas × 7 días
  const grid = useMemo(() => {
    const first = new Date(cursor); first.setDate(1);
    const startOffset = first.getDay(); // 0 = Dom
    const start = new Date(first); start.setDate(first.getDate() - startOffset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  // Eventos del mes indexados por YYYY-MM-DD
  const eventsByDay = useMemo(() => {
    const map = {};
    const push = (key, ev) => { (map[key] = map[key] || []).push(ev); };
    appts.forEach(a => {
      const [d, t] = (a.scheduled_at_pr || '').split('T');
      if (!d) return;
      push(d, { kind: 'cita', time: t || '', appt: a });
    });
    tasks.forEach(tk => {
      if (!tk.due_date) return;
      const d = new Date(tk.due_date);
      const key = fmtDate(d);
      push(key, { kind: 'tarea', time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`, task: tk });
    });
    // Orden por hora
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    return map;
  }, [appts, tasks]);

  const dayEvents = eventsByDay[fmtDate(selectedDay)] || [];

  const today = new Date();
  const isCurrentMonth = (d) => d.getMonth() === cursor.getMonth();

  return (
    <div style={{ padding: 24, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📅 Calendario</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Citas y tareas pendientes</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
            <button onClick={() => setView('cal')} style={{ background: view==='cal' ? '#1a3c8f' : 'transparent', color: view==='cal' ? '#fff' : 'var(--muted)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📅 Calendario</button>
            <button onClick={() => setView('list')} style={{ background: view==='list' ? '#1a3c8f' : 'transparent', color: view==='list' ? '#fff' : 'var(--muted)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📋 Lista</button>
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 8, fontSize: 13 }}>
            {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <a href="/agendar" target="_blank" rel="noopener" style={{ background: '#1a3c8f', color: '#fff', padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Página pública →</a>
        </div>
      </div>

      {view === 'cal' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
          {/* Calendar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => setCursor(d => { const x = new Date(d); x.setMonth(x.getMonth()-1); return x; })}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>←</button>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{MES[cursor.getMonth()]} {cursor.getFullYear()}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelectedDay(new Date()); }}
                  style={{ background: '#1a3c8f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Hoy</button>
                <button onClick={() => setCursor(d => { const x = new Date(d); x.setMonth(x.getMonth()+1); return x; })}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>→</button>
              </div>
            </div>
            {/* Weekday header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
              {DIA_SHORT.map(d => (
                <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{d}</div>
              ))}
            </div>
            {/* Days grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {grid.map((d, i) => {
                const key = fmtDate(d);
                const evts = eventsByDay[key] || [];
                const inMonth = isCurrentMonth(d);
                const isToday = sameDay(d, today);
                const isSel = sameDay(d, selectedDay);
                return (
                  <div key={i} onClick={() => setSelectedDay(d)}
                    style={{
                      minHeight: 92, borderRight: (i % 7 !== 6) ? '1px solid var(--border)' : 'none',
                      borderBottom: i < 35 ? '1px solid var(--border)' : 'none',
                      padding: 6, cursor: 'pointer',
                      background: isSel ? 'rgba(26,60,143,0.10)' : (isToday ? 'rgba(103,232,249,0.07)' : 'transparent'),
                      opacity: inMonth ? 1 : 0.4,
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: isToday ? '#1a3c8f' : 'var(--text)',
                        background: isToday ? '#67e8f9' : 'transparent',
                        width: isToday ? 22 : 'auto', height: isToday ? 22 : 'auto',
                        borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>{d.getDate()}</span>
                      {evts.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#1a3c8f', background: 'rgba(26,60,143,0.10)', borderRadius: 8, padding: '1px 5px' }}>{evts.length}</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {evts.slice(0, 3).map((e, j) => {
                        if (e.kind === 'cita') {
                          const st = STATUS_COLORS[e.appt.status] || STATUS_COLORS.pending;
                          return <div key={j} title={`${e.time} — ${e.appt.contact_name}`} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.time} {e.appt.contact_name}</div>;
                        }
                        return <div key={j} title={`Tarea: ${e.task.title}`} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✓ {e.task.title}</div>;
                      })}
                      {evts.length > 3 && <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600 }}>+{evts.length - 3} más</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day panel */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'sticky', top: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{DIA_SHORT[selectedDay.getDay()]}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{selectedDay.getDate()} de {MES[selectedDay.getMonth()].toLowerCase()}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}</div>
            {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando…</div>}
            {!loading && dayEvents.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin eventos este día.</div>
            )}
            {!loading && dayEvents.map((e, i) => {
              if (e.kind === 'cita') {
                const a = e.appt;
                const st = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                return (
                  <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{e.time} {a.type === 'llamada' ? '📞' : '🏠'}</div>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{st.label}</span>
                    </div>
                    <Link href={`/leads?id=${a.lead_id}`} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{a.contact_name}</Link>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{a.reason_label}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {a.status === 'pending' && <button onClick={() => updateStatus(a.id, 'confirmed')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Confirmar</button>}
                      {(a.status === 'pending' || a.status === 'confirmed') && <>
                        <button onClick={() => updateStatus(a.id, 'completed')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>✓ Listo</button>
                        <button onClick={() => { if (confirm('¿Cancelar?')) updateStatus(a.id, 'cancelled'); }} style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>✕</button>
                      </>}
                    </div>
                  </div>
                );
              }
              const tk = e.task;
              return (
                <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}>{e.time} ✓ Tarea</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 4 }}>{tk.title}</div>
                  {tk.lead_id && <Link href={`/leads?id=${tk.lead_id}`} style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>Ver lead →</Link>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ListView items={appts} loading={loading} updateStatus={updateStatus} />
      )}
    </div>
  );
}

function ListView({ items, loading, updateStatus }) {
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>;
  if (items.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
      <div>No hay citas en este periodo.</div>
    </div>
  );
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <th style={{ padding: '12px 14px' }}>Fecha</th>
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
                  <Link href={`/leads?id=${a.lead_id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{a.contact_name}</Link>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.contact_phone || a.contact_email || ''}</div>
                </td>
                <td style={{ padding: '12px 14px' }}>{a.reason_label}</td>
                <td style={{ padding: '12px 14px' }}>{a.type === 'llamada' ? '📞 Llamada' : '🏠 Visita'}</td>
                <td style={{ padding: '12px 14px' }}><span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{st.label}</span></td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {a.status === 'pending' && <button onClick={() => updateStatus(a.id, 'confirmed')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Confirmar</button>}
                    {(a.status === 'pending' || a.status === 'confirmed') && <>
                      <button onClick={() => updateStatus(a.id, 'completed')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✓</button>
                      <button onClick={() => { if (confirm('¿Cancelar?')) updateStatus(a.id, 'cancelled'); }} style={{ background: 'none', color: '#ef4444', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>✕</button>
                    </>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
