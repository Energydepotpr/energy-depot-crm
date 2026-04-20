'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

const S = {
  bg: 'var(--bg)', surf: 'var(--surface)', surf2: 'var(--surface2)',
  brd: 'var(--border)', txt: 'var(--text)', muted: 'var(--muted)',
  accent: '#1b9af5', danger: '#ff5b5b', warn: '#f59e0b', success: '#00c9a7',
};

function startOfDay(d) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function fmt(ts, fullDay) {
  if (!ts) return 'Sin fecha';
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' });
  if (fullDay) return `${date} · Todo el día`;
  const time = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
  return `${date} · ${time}`;
}

// ── Modal nueva tarea ─────────────────────────────────────────────────────────
function NuevaTareaModal({ onClose, onCreated, agents }) {
  const [form, setForm] = useState({ title:'', due_date:'', full_day:false, assigned_to:'', lead_search:'' });
  const [leadResults, setLeadResults] = useState([]);
  const [leadSelected, setLeadSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);

  const buscarLead = (q) => {
    setForm(p => ({ ...p, lead_search: q }));
    clearTimeout(timer.current);
    if (!q.trim()) { setLeadResults([]); return; }
    timer.current = setTimeout(() => {
      api.leads(`?search=${encodeURIComponent(q)}&limit=8`).then(r => setLeadResults(Array.isArray(r) ? r.slice(0,8) : [])).catch(() => {});
    }, 300);
  };

  const crear = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const dueDate = form.due_date
        ? (form.full_day ? form.due_date + 'T00:00:00' : form.due_date)
        : null;
      const task = await api.createTask({
        lead_id: leadSelected?.id || null,
        title: form.title.trim(),
        due_date: dueDate,
        assigned_to: form.assigned_to || undefined,
      });
      onCreated(task);
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:S.surf, border:`1px solid ${S.brd}`, borderRadius:14, padding:24, width:'100%', maxWidth:420, display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:S.txt, fontSize:15, fontWeight:700 }}>Nueva Tarea</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:20, lineHeight:1 }}>×</button>
        </div>

        {/* Descripción */}
        <div>
          <label style={{ fontSize:11, color:S.muted, fontWeight:600, display:'block', marginBottom:4 }}>DESCRIPCIÓN *</label>
          <input
            autoFocus
            value={form.title}
            onChange={e => setForm(p => ({...p, title:e.target.value}))}
            placeholder="ej: Follow up, recordar algo..."
            style={{ width:'100%', background:S.surf2, border:`1px solid ${S.brd}`, borderRadius:8, padding:'8px 12px', color:S.txt, fontSize:13, outline:'none', boxSizing:'border-box' }}
            onKeyDown={e => e.key==='Enter' && crear()}
          />
        </div>

        {/* Lead */}
        <div style={{ position:'relative' }}>
          <label style={{ fontSize:11, color:S.muted, fontWeight:600, display:'block', marginBottom:4 }}>LEAD (opcional)</label>
          {leadSelected ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, background:S.surf2, border:`1px solid ${S.accent}40`, borderRadius:8, padding:'7px 12px' }}>
              <span style={{ color:S.txt, fontSize:13, flex:1 }}>{leadSelected.contact_name || leadSelected.title}</span>
              <button onClick={() => { setLeadSelected(null); setForm(p=>({...p,lead_search:''})); }} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:16 }}>×</button>
            </div>
          ) : (
            <>
              <input
                value={form.lead_search}
                onChange={e => buscarLead(e.target.value)}
                placeholder="Buscar lead..."
                style={{ width:'100%', background:S.surf2, border:`1px solid ${S.brd}`, borderRadius:8, padding:'8px 12px', color:S.txt, fontSize:13, outline:'none', boxSizing:'border-box' }}
              />
              {leadResults.length > 0 && (
                <div style={{ position:'absolute', left:0, right:0, top:'100%', marginTop:4, background:S.surf, border:`1px solid ${S.brd}`, borderRadius:8, zIndex:10, maxHeight:160, overflowY:'auto' }}>
                  {leadResults.map(l => (
                    <button key={l.id} onClick={() => { setLeadSelected(l); setLeadResults([]); setForm(p=>({...p,lead_search:''})); }}
                      style={{ width:'100%', textAlign:'left', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', color:S.txt, fontSize:13, borderBottom:`1px solid ${S.brd}` }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}
                    >
                      {l.contact_name || l.title}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Fecha */}
        <div>
          <label style={{ fontSize:11, color:S.muted, fontWeight:600, display:'block', marginBottom:4 }}>FECHA Y HORA</label>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:S.muted, cursor:'pointer', flexShrink:0 }}>
              <div
                onClick={() => setForm(p=>({...p, full_day:!p.full_day}))}
                style={{ width:30, height:17, borderRadius:9, background:form.full_day ? S.accent : S.brd, position:'relative', cursor:'pointer', transition:'background 0.2s' }}
              >
                <div style={{ position:'absolute', top:2.5, left:form.full_day?14:2.5, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
              </div>
              Todo el día
            </label>
            <input
              type={form.full_day ? 'date' : 'datetime-local'}
              value={form.due_date}
              onChange={e => setForm(p=>({...p, due_date:e.target.value}))}
              style={{ flex:1, background:S.surf2, border:`1px solid ${S.brd}`, borderRadius:8, padding:'7px 10px', color:S.txt, fontSize:13, outline:'none' }}
            />
          </div>
        </div>

        {/* Asignado */}
        <div>
          <label style={{ fontSize:11, color:S.muted, fontWeight:600, display:'block', marginBottom:4 }}>ASIGNAR A</label>
          <select
            value={form.assigned_to}
            onChange={e => setForm(p=>({...p, assigned_to:e.target.value}))}
            style={{ width:'100%', background:S.surf2, border:`1px solid ${S.brd}`, borderRadius:8, padding:'7px 12px', color:S.txt, fontSize:13, outline:'none' }}
          >
            <option value="">Yo (por defecto)</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Botones */}
        <div style={{ display:'flex', gap:8, paddingTop:4 }}>
          <button
            onClick={crear}
            disabled={!form.title.trim() || saving}
            style={{ flex:1, background:form.title.trim()&&!saving ? S.accent : S.brd, color:'#fff', border:'none', borderRadius:8, padding:'10px 0', fontSize:13, fontWeight:600, cursor:form.title.trim()&&!saving?'pointer':'not-allowed' }}
          >
            {saving ? 'Creando...' : '✓ Crear tarea'}
          </button>
          <button onClick={onClose} style={{ background:'none', border:`1px solid ${S.brd}`, borderRadius:8, padding:'10px 16px', color:S.muted, fontSize:13, cursor:'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de tarea ──────────────────────────────────────────────────────────
function TaskCard({ task, onComplete, onDelete, isOverdue }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: S.surf, border:`1px solid ${isOverdue ? S.danger+'40' : S.brd}`,
        borderLeft:`3px solid ${isOverdue ? S.danger : task.due_date ? S.accent : S.muted}`,
        borderRadius:8, padding:'10px 12px', marginBottom:8,
        transition:'border-color 0.15s, background 0.15s',
        background: hover ? S.surf2 : S.surf,
      }}
    >
      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
        {/* Checkbox */}
        <button
          onClick={() => onComplete(task.id)}
          style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${isOverdue ? S.danger : S.accent}`, background:'transparent', flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}
        >
          {hover && <div style={{ width:8, height:8, borderRadius:'50%', background:isOverdue?S.danger:S.accent }} />}
        </button>

        <div style={{ flex:1, minWidth:0 }}>
          {/* Lead name */}
          {task.lead_title && (
            <a href={`/leads?open=${task.lead_id}`} style={{ display:'block', color: S.accent, fontSize:12, fontWeight:700, textDecoration:'none', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
              onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
              onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}
            >
              {task.lead_title}
            </a>
          )}
          {/* Fecha */}
          <div style={{ fontSize:11, color:isOverdue?S.danger:S.muted, marginBottom:5 }}>
            {fmt(task.due_date, task.full_day)}
          </div>
          {/* Descripción */}
          <div style={{ color:S.txt, fontSize:13, lineHeight:1.4 }}>
            {task.title}
          </div>
          {/* Assigned */}
          {task.assigned_name && (
            <div style={{ fontSize:10, color:S.muted, marginTop:4 }}>
              Para: <span style={{ color:S.txt }}>{task.assigned_name}</span>
            </div>
          )}
        </div>

        {/* Delete */}
        {hover && (
          <button onClick={() => onDelete(task.id)} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, fontSize:14, padding:'0 2px', lineHeight:1, flexShrink:0 }}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ── Columna ───────────────────────────────────────────────────────────────────
function Column({ title, tasks, color, emptyMsg, onComplete, onDelete }) {
  return (
    <div style={{ flexShrink:0, width:280, display:'flex', flexDirection:'column', background:'transparent' }}>
      {/* Header */}
      <div style={{ padding:'10px 4px 10px', borderBottom:`2px solid ${color}`, marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{title}</span>
        <span style={{ fontSize:11, color:S.muted, background:'rgba(255,255,255,0.06)', borderRadius:10, padding:'1px 8px' }}>{tasks.length}</span>
      </div>
      {/* Cards */}
      <div style={{ flex:1, overflowY:'auto', maxHeight:'calc(100vh - 160px)' }}>
        {tasks.length === 0 && (
          <div style={{ color:S.muted, fontSize:12, textAlign:'center', padding:'24px 8px', opacity:0.6 }}>{emptyMsg}</div>
        )}
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onComplete={onComplete} onDelete={onDelete} isOverdue={color === S.danger} />
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [soloMias, setSoloMias] = useState(false);

  const cargar = () => {
    api.tasks('?completed=false').then(t => { setTasks(Array.isArray(t) ? t : []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
    api.agents().then(setAgents).catch(() => {});
    const poll = setInterval(cargar, 60000);
    return () => clearInterval(poll);
  }, []);

  const completar = async (id) => {
    await api.completeTask(id, true).catch(() => {});
    setTasks(p => p.filter(t => t.id !== id));
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await api.deleteTask(id).catch(() => {});
    setTasks(p => p.filter(t => t.id !== id));
  };

  // Group tasks
  const now = new Date();
  const hoy = startOfDay(now);
  const manana = addDays(hoy, 1);
  const en7dias = addDays(hoy, 7);

  const lista = soloMias ? tasks.filter(t => !t.assigned_to || t.assigned_to === user?.id || t.assigned_name === user?.name) : tasks;

  const vencidas      = lista.filter(t => t.due_date && new Date(t.due_date) < hoy);
  const hoyTasks      = lista.filter(t => t.due_date && isSameDay(new Date(t.due_date), hoy));
  const mananaTasks   = lista.filter(t => t.due_date && isSameDay(new Date(t.due_date), manana));
  const semana        = lista.filter(t => t.due_date && new Date(t.due_date) > manana && new Date(t.due_date) <= en7dias);
  const futuro        = lista.filter(t => !t.due_date || new Date(t.due_date) > en7dias);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:S.bg, overflow:'hidden' }}>
      {showModal && <NuevaTareaModal onClose={() => setShowModal(false)} onCreated={t => { setTasks(p => [...p, t]); }} agents={agents} />}

      {/* Top bar */}
      <div style={{ padding:'0 20px', height:52, borderBottom:`1px solid ${S.brd}`, background:S.surf, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <span style={{ fontSize:14, fontWeight:700, color:S.txt }}>Calendario de Tareas</span>
        <span style={{ fontSize:12, color:S.muted }}>{lista.length} tarea{lista.length !== 1 ? 's' : ''} pendiente{lista.length !== 1 ? 's' : ''}</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {/* Solo mis tareas toggle */}
          <button
            onClick={() => setSoloMias(v => !v)}
            style={{ fontSize:12, padding:'5px 12px', borderRadius:7, border:`1px solid ${soloMias ? S.accent : S.brd}`, background:soloMias?`${S.accent}20`:'transparent', color:soloMias?S.accent:S.muted, cursor:'pointer' }}
          >
            Solo mis tareas
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ fontSize:12, fontWeight:600, padding:'6px 16px', borderRadius:7, border:'none', background:S.accent, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}
          >
            + Nueva tarea
          </button>
        </div>
      </div>

      {/* Columns */}
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, color:S.muted, gap:10, fontSize:14 }}>
          <div style={{ width:20, height:20, border:`2px solid ${S.accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
          Cargando tareas...
        </div>
      ) : (
        <div style={{ display:'flex', gap:16, padding:'20px 20px 80px', overflowX:'auto', overflowY:'hidden', flex:1 }}>
          <Column title="Eventos Vencidos"    tasks={vencidas}    color={S.danger}  emptyMsg="Sin tareas vencidas ✓" onComplete={completar} onDelete={eliminar} />
          <Column title="Hoy"                  tasks={hoyTasks}    color={S.accent}  emptyMsg="Sin tareas para hoy"   onComplete={completar} onDelete={eliminar} />
          <Column title="Mañana"               tasks={mananaTasks} color={S.warn}    emptyMsg="Sin tareas para mañana" onComplete={completar} onDelete={eliminar} />
          <Column title="Próxima Semana"       tasks={semana}      color={S.success} emptyMsg="Sin tareas esta semana" onComplete={completar} onDelete={eliminar} />
          <Column title="Tareas para el Futuro" tasks={futuro}     color={S.muted}   emptyMsg="Sin tareas futuras"    onComplete={completar} onDelete={eliminar} />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
