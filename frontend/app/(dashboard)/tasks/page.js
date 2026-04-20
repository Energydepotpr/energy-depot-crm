'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

function formatFecha(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const ahora = new Date();
  const diff = d - ahora;
  const dias = Math.ceil(diff / 86400000);
  const str = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  if (dias < 0) return { str, color: 'text-danger' };
  if (dias === 0) return { str: 'Hoy', color: 'text-amber-400' };
  if (dias === 1) return { str: 'Mañana', color: 'text-warning' };
  return { str, color: 'text-muted' };
}

function TaskModal({ agents, onClose, onSaved }) {
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState({ lead_id: '', title: '', due_date: '', assigned_to: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.leads().then(setLeads).catch(() => {});
  }, []);

  const save = async () => {
    if (!form.lead_id || !form.title.trim()) return;
    setSaving(true);
    try {
      await api.createTask({
        lead_id:     Number(form.lead_id),
        title:       form.title.trim(),
        due_date:    form.due_date || null,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      });
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-white mb-5">Nueva tarea</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Lead *</label>
            <select className="input" value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
              <option value="">Seleccionar lead...</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.title} {l.contact_name ? `(${l.contact_name})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Tarea *</label>
            <input className="input" placeholder="Descripción de la tarea" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Fecha límite</label>
              <input type="datetime-local" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Asignar a</label>
              <select className="input" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">A mí mismo</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={saving || !form.lead_id || !form.title.trim()} className="btn-primary px-4 py-2 text-sm flex-1 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Crear tarea'}
          </button>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pending');
  const [modal, setModal] = useState(false);

  const cargar = () => {
    setLoading(true);
    const params = filtro === 'pending' ? '?completed=false' : filtro === 'done' ? '?completed=true' : '';
    api.tasks(params).then(setTasks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [filtro]);
  useEffect(() => { api.agents().then(setAgents).catch(() => {}); }, []);

  const completar = async (id, completed) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    await api.completeTask(id, completed).catch(() => cargar());
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    await api.deleteTask(id).catch(() => cargar());
  };

  const pendientes = tasks.filter(t => !t.completed).length;
  const vencidas   = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < new Date()).length;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Tareas</h1>
          <p className="text-sm text-muted mt-1">
            {loading ? 'Cargando...' : `${pendientes} pendientes${vencidas > 0 ? ` · ${vencidas} vencidas` : ''}`}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary px-4 py-2 text-sm">+ Nueva tarea</button>
      </div>

      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {[
          { key: 'pending', label: 'Pendientes' },
          { key: 'all',     label: 'Todas' },
          { key: 'done',    label: 'Completadas' },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filtro === f.key ? 'bg-accent text-white' : 'text-muted hover:text-white'
            }`}
          >{f.label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && (
          <div className="flex justify-center py-12 text-muted text-sm gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Cargando...
          </div>
        )}
        {!loading && tasks.length === 0 && (
          <div className="card p-8 text-center text-muted text-sm">Sin tareas</div>
        )}
        {tasks.map(t => {
          const fecha = formatFecha(t.due_date);
          return (
            <div key={t.id} className={`card px-4 py-3 flex items-center gap-3 ${t.completed ? 'opacity-50' : ''}`}>
              <button
                onClick={() => completar(t.id, !t.completed)}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  t.completed ? 'border-success bg-success' : 'border-border hover:border-success'
                }`}
              >
                {t.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${t.completed ? 'line-through text-muted' : 'text-white'}`}>{t.title}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {t.lead_title && <span className="text-xs text-accent">#{t.lead_title}</span>}
                  {t.assigned_name && <span className="text-xs text-muted">→ {t.assigned_name}</span>}
                  {fecha && <span className={`text-xs ${fecha.color}`}>{fecha.str}</span>}
                </div>
              </div>
              <button onClick={() => eliminar(t.id)} className="text-muted hover:text-danger transition-colors p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {modal && <TaskModal agents={agents} onClose={() => setModal(false)} onSaved={cargar} />}
    </div>
  );
}
