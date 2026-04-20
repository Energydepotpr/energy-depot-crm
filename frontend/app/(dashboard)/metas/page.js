'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
      <div style={{ width: 20, height: 20, border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
}

// ─── Formatear valores ────────────────────────────────────────────────────────
function fmt(n, type) {
  if (n == null) return '—';
  if (type === 'revenue') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${Number(n).toLocaleString()}`;
  }
  return Number(n).toLocaleString();
}

const GOAL_TYPES = [
  { value: 'leads_closed',   label: 'Leads cerrados',  icon: '🎯', unit: 'leads'    },
  { value: 'revenue',        label: 'Ingresos',         icon: '💰', unit: '$'        },
  { value: 'messages_sent',  label: 'Mensajes enviados',icon: '💬', unit: 'mensajes' },
];

function goalTypeLabel(type) {
  return GOAL_TYPES.find(g => g.value === type)?.label || type;
}
function goalTypeIcon(type) {
  return GOAL_TYPES.find(g => g.value === type)?.icon || '📊';
}

// ─── Progress bar visual ──────────────────────────────────────────────────────
function GoalProgressBar({ pct, current, target, type }) {
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const isRevenue = type === 'revenue';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.min(pct, 100)}%`,
            background: color, borderRadius: 99, transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
          {pct}%
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
        <span>Actual: <strong style={{ color: 'var(--text)' }}>{isRevenue ? fmt(current, 'revenue') : fmt(current)}</strong></span>
        <span>Meta: <strong style={{ color: 'var(--text)' }}>{isRevenue ? fmt(target, 'revenue') : fmt(target)}</strong></span>
      </div>
    </div>
  );
}

// ─── Modal para crear / editar meta ──────────────────────────────────────────
function GoalModal({ agents, period, editing, onSave, onClose }) {
  const [form, setForm] = useState({
    agent_id: editing?.agent_id || (agents[0]?.id || ''),
    goal_type: editing?.goal_type || 'leads_closed',
    target_value: editing?.target_value || '',
    period: editing?.period || period,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.agent_id || !form.target_value) {
      setError('Todos los campos son requeridos'); return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.updateGoal(editing.id, { target_value: Number(form.target_value) });
      } else {
        await api.createGoal({
          agent_id: Number(form.agent_id),
          period: form.period,
          goal_type: form.goal_type,
          target_value: Number(form.target_value),
        });
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Error guardando meta');
    } finally {
      setSaving(false);
    }
  }

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  };
  const modal = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '28px', width: '100%', maxWidth: 420,
  };
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
    outline: 'none',
  };
  const labelStyle = { fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {editing ? 'Editar meta' : 'Nueva meta'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!editing && (
            <div>
              <label style={labelStyle}>Agente</label>
              <select
                value={form.agent_id}
                onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}
                style={inputStyle}
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                ))}
              </select>
            </div>
          )}

          {!editing && (
            <div>
              <label style={labelStyle}>Tipo de meta</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {GOAL_TYPES.map(gt => (
                  <button
                    key={gt.value} type="button"
                    onClick={() => setForm(f => ({ ...f, goal_type: gt.value }))}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8, border: '1px solid',
                      borderColor: form.goal_type === gt.value ? '#8b5cf6' : 'var(--border)',
                      background: form.goal_type === gt.value ? 'rgba(139,92,246,0.15)' : 'transparent',
                      color: form.goal_type === gt.value ? '#8b5cf6' : 'var(--muted)',
                      cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{gt.icon}</div>
                    {gt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>
              Período (YYYY-MM)
            </label>
            <input
              type="month"
              value={form.period}
              onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
              style={inputStyle}
              disabled={!!editing}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Valor objetivo {form.goal_type === 'revenue' ? '($)' : ''}
            </label>
            <input
              type="number"
              min="0"
              step={form.goal_type === 'revenue' ? '0.01' : '1'}
              value={form.target_value}
              onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
              placeholder={form.goal_type === 'revenue' ? 'Ej: 5000' : 'Ej: 10'}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: saving ? 'rgba(139,92,246,0.5)' : '#8b5cf6',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Forecast Card ────────────────────────────────────────────────────────────
function ForecastCard({ forecast, isMobile }) {
  if (!forecast) return null;
  const {
    ingresos_actuales, proyeccion_run_rate, proyeccion_total,
    win_rate_pct, leads_activos_pipeline, dia_del_mes, dias_en_mes,
  } = forecast;

  const fmt$ = n => {
    if (!n) return '$0';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${Number(n).toLocaleString()}`;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))',
      border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: 12, padding: isMobile ? '16px' : '20px 24px',
      marginBottom: 20,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#8b5cf6', marginBottom: 12 }}>
        Forecast del mes — Día {dia_del_mes} de {dias_en_mes}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16 }}>
        {[
          { label: 'Ingresos actuales', value: fmt$(ingresos_actuales), color: '#10b981' },
          { label: 'Proyección (run rate)', value: fmt$(proyeccion_run_rate), color: '#1b9af5' },
          { label: 'Proyección (pipeline)', value: fmt$(proyeccion_total), color: '#8b5cf6' },
          { label: 'Win Rate histórico', value: `${win_rate_pct}%`, color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
      {leads_activos_pipeline > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          {leads_activos_pipeline} lead{leads_activos_pipeline !== 1 ? 's' : ''} activo{leads_activos_pipeline !== 1 ? 's' : ''} en pipeline
          · Win rate {win_rate_pct}%
        </div>
      )}
    </div>
  );
}

// ─── Goal Card (vista agente o admin por agente) ──────────────────────────────
function GoalCard({ goal, onEdit, onDelete, isAdmin, forecastAgent }) {
  const { goal_type, target_value, current_value, progress_pct, period } = goal;
  const color = progress_pct >= 80 ? '#10b981' : progress_pct >= 50 ? '#f59e0b' : '#ef4444';
  const isRevenue = goal_type === 'revenue';

  // Forecast "a este ritmo cerrarás X"
  let forecastMsg = null;
  if (forecastAgent) {
    if (goal_type === 'revenue' && forecastAgent.proyeccion_ingresos != null) {
      const onTrack = forecastAgent.on_track_ingresos;
      forecastMsg = `A este ritmo: ${fmt(forecastAgent.proyeccion_ingresos, 'revenue')} ${onTrack ? '✓ En camino' : '⚠ Por debajo'}`;
    } else if (goal_type === 'leads_closed' && forecastAgent.proyeccion_leads != null) {
      const onTrack = forecastAgent.on_track_leads;
      forecastMsg = `A este ritmo: ${forecastAgent.proyeccion_leads} leads ${onTrack ? '✓ En camino' : '⚠ Por debajo'}`;
    }
  }

  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${color}`, borderRadius: 10, padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{goalTypeIcon(goal_type)}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{goalTypeLabel(goal_type)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{period}</div>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onEdit(goal)} style={{
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#1b9af5', cursor: 'pointer',
            }}>
              Editar
            </button>
            <button onClick={() => onDelete(goal.id)} style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#ef4444', cursor: 'pointer',
            }}>
              Eliminar
            </button>
          </div>
        )}
      </div>
      <GoalProgressBar
        pct={progress_pct}
        current={current_value}
        target={Number(target_value)}
        type={goal_type}
      />
      {forecastMsg && (
        <div style={{
          marginTop: 10, fontSize: 11, padding: '6px 10px', borderRadius: 6,
          background: forecastMsg.includes('En camino') ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          color: forecastMsg.includes('En camino') ? '#10b981' : '#f59e0b',
          fontWeight: 600,
        }}>
          {forecastMsg}
        </div>
      )}
    </div>
  );
}

// ─── Main Metas Page ──────────────────────────────────────────────────────────
export default function MetasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor';

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [period, setPeriod] = useState(defaultPeriod);
  const [goals, setGoals] = useState([]);
  const [agents, setAgents] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [g, fc] = await Promise.all([
        api.goals(period).catch(() => []),
        api.goalsForecast().catch(() => null),
      ]);
      setGoals(Array.isArray(g) ? g : []);
      setForecast(fc);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (isAdmin) {
      api.agents().catch(() => []).then(a => setAgents(Array.isArray(a) ? a : []));
    }
  }, [isAdmin]);

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta meta?')) return;
    setDeleting(id);
    try {
      await api.deleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      alert(err.message || 'Error eliminando meta');
    } finally {
      setDeleting(null);
    }
  }

  function handleEdit(goal) {
    setEditing(goal);
    setShowModal(true);
  }

  function handleNew() {
    setEditing(null);
    setShowModal(true);
  }

  async function handleSaved() {
    setShowModal(false);
    setEditing(null);
    await loadData();
  }

  // Group goals by agent for admin view
  const goalsByAgent = {};
  goals.forEach(g => {
    const key = g.agent_id;
    if (!goalsByAgent[key]) goalsByAgent[key] = { name: g.agent_name, email: g.agent_email, role: g.agent_role, goals: [] };
    goalsByAgent[key].goals.push(g);
  });

  // Forecast per agent map
  const forecastByAgent = {};
  (forecast?.por_agente || []).forEach(a => { forecastByAgent[a.id] = a; });

  const card = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: isMobile ? '14px' : '20px 24px',
  };

  return (
    <div style={{ padding: isMobile ? '12px' : '24px 32px', background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between', marginBottom: 20,
        flexDirection: isMobile ? 'column' : 'row', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Metas por agente
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            {isAdmin ? 'Gestiona y monitorea las metas del equipo' : 'Tu progreso y proyección del mes'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
            }}
          />
          {isAdmin && (
            <button onClick={handleNew} style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: '#8b5cf6', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              + Nueva meta
            </button>
          )}
        </div>
      </div>

      {/* ── FORECAST ─────────────────────────────────────────────────────────── */}
      <ForecastCard forecast={forecast} isMobile={isMobile} />

      {/* ── VISTA AGENTE (solo sus metas) ────────────────────────────────────── */}
      {!isAdmin && (
        <div>
          {loading ? <Spinner /> : goals.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Sin metas asignadas
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Tu supervisor asignará metas para el período {period}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {goals.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  isAdmin={false}
                  forecastAgent={forecastByAgent[g.agent_id]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA ADMIN: tabla de agentes ────────────────────────────────────── */}
      {isAdmin && (
        <div>
          {loading ? <Spinner /> : Object.keys(goalsByAgent).length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Sin metas para {period}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                Crea metas para los agentes del equipo
              </div>
              <button onClick={handleNew} style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#8b5cf6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                + Crear primera meta
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {Object.entries(goalsByAgent).map(([agentId, agentData]) => {
                const fc = forecastByAgent[Number(agentId)];
                return (
                  <div key={agentId} style={{ ...card }}>
                    {/* Agent header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #8b5cf6, #1b9af5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {agentData.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{agentData.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{agentData.email} · {agentData.role}</div>
                        </div>
                      </div>
                      {fc && (
                        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                          {[
                            { label: 'Ingresos actuales', value: fmt(fc.ingresos_actuales, 'revenue'), color: '#10b981' },
                            { label: 'Leads cerrados', value: fc.leads_cerrados, color: '#1b9af5' },
                          ].map(({ label, value, color }) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Goals grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                      {agentData.goals.map(g => (
                        <GoalCard
                          key={g.id}
                          goal={g}
                          isAdmin={true}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          forecastAgent={fc}
                        />
                      ))}
                    </div>

                    {/* Forecast on-track summary */}
                    {fc && (fc.on_track_ingresos != null || fc.on_track_leads != null) && (
                      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {fc.on_track_ingresos != null && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                            background: fc.on_track_ingresos ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: fc.on_track_ingresos ? '#10b981' : '#ef4444',
                          }}>
                            {fc.on_track_ingresos ? '✓' : '⚠'} Ingresos proyectados: {fmt(fc.proyeccion_ingresos, 'revenue')}
                          </span>
                        )}
                        {fc.on_track_leads != null && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                            background: fc.on_track_leads ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: fc.on_track_leads ? '#10b981' : '#ef4444',
                          }}>
                            {fc.on_track_leads ? '✓' : '⚠'} Leads proyectados: {fc.proyeccion_leads}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ─────────────────────────────────────────────────────────────── */}
      {showModal && (
        <GoalModal
          agents={agents}
          period={period}
          editing={editing}
          onSave={handleSaved}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
