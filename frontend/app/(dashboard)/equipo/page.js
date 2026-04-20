'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function tiempoRelativo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export default function EquipoPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  // Summary modal
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  // Team tasks
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('media');
  const [newTaskAssigned, setNewTaskAssigned] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const cargar = () => {
    api.teamChat()
      .then(msgs => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const cargarTareas = () => {
    setTasksLoading(true);
    api.teamTasks()
      .then(t => setTasks(Array.isArray(t) ? t : []))
      .catch(() => {})
      .finally(() => setTasksLoading(false));
  };

  const abrirResumen = async () => {
    setSummaryOpen(true);
    setSummaryLoading(true);
    try {
      const data = await api.teamChatSummary();
      setSummaryData(data);
    } catch (e) {
      setSummaryData({ error: e.message });
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    cargarTareas();
    const interval = setInterval(cargar, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const enviar = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api.sendTeamMessage(content.trim());
      setMessages(prev => [...prev, msg]);
      setContent('');
      inputRef.current?.focus();
    } catch (e) {
      alert('Error al enviar: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar();
  };

  const PRIORITY_COLOR = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(59,130,246,0.15)',
          color: '#1b9af5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Equipo</div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Solo visible para el equipo interno</div>
        </div>
        <button
          onClick={abrirResumen}
          style={{
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 8, padding: '6px 12px', color: '#1b9af5',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span>📋</span> Resumen del día
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {[{ key: 'chat', label: `Chat (${messages.length})` }, { key: 'tareas', label: `Tareas (${tasks.filter(t => t.status !== 'hecho').length})` }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? 'var(--accent)' : 'var(--muted)',
            background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? 'var(--accent)' : 'transparent'}`,
            cursor: 'pointer', transition: 'color 0.12s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Summary Modal */}
      {summaryOpen && (
        <div onClick={() => setSummaryOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>📋 Resumen del día</div>
              <button onClick={() => setSummaryOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            {summaryLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}
            {!summaryLoading && summaryData && summaryData.error && (
              <p style={{ color: '#ef4444', fontSize: 13 }}>{summaryData.error}</p>
            )}
            {!summaryLoading && summaryData && !summaryData.error && (
              <>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                  {formatDate(summaryData.date + 'T12:00:00')} — {summaryData.total} mensaje{summaryData.total !== 1 ? 's' : ''}
                </div>
                {Object.keys(summaryData.groups || {}).length === 0 && (
                  <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sin mensajes hoy.</p>
                )}
                {Object.entries(summaryData.groups || {}).map(([hour, msgs]) => (
                  <div key={hour} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{hour}</div>
                    {msgs.map(m => (
                      <div key={m.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.user_name}: </span>
                        <span style={{ fontSize: 12, color: 'var(--text)' }}>{m.content}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && <><div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, paddingTop: 60 }}>
            Sin mensajes aún. Sé el primero en escribir.
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = user && (msg.user_id === user.id || msg.user_name === user.name);
          return (
            <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {/* Sender name for others */}
              {!isMe && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, paddingLeft: 4 }}>
                  {msg.user_name}
                </div>
              )}
              <div style={{
                maxWidth: '70%',
                background: isMe ? 'rgba(59,130,246,0.18)' : 'var(--surface)',
                border: `1px solid ${isMe ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
              }}>
                <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                {isMe ? 'Tú · ' : ''}{formatTime(msg.created_at)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Chat Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          rows={2}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje al equipo... (Ctrl+Enter para enviar)"
          style={{
            flex: 1,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
            color: 'var(--text)',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={enviar}
          disabled={sending || !content.trim()}
          style={{
            background: '#1b9af5',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: sending || !content.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !content.trim() ? 0.5 : 1,
            flexShrink: 0,
            alignSelf: 'flex-end',
          }}
        >
          {sending
            ? <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            : 'Enviar'
          }
        </button>
      </div></>}

      {/* Tasks Tab */}
      {activeTab === 'tareas' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Add task button */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowAddTask(v => !v)}
              style={{ background: '#1b9af5', border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <span>+</span> Nueva tarea
            </button>
          </div>

          {/* Add task form */}
          {showAddTask && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <textarea
                rows={2}
                value={newTaskContent}
                onChange={e => setNewTaskContent(e.target.value)}
                placeholder="Descripción de la tarea..."
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none', flex: 1 }}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
                <input
                  value={newTaskAssigned}
                  onChange={e => setNewTaskAssigned(e.target.value)}
                  placeholder="Asignado a..."
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none', flex: 2 }}
                />
                <button
                  disabled={!newTaskContent.trim() || addingTask}
                  onClick={async () => {
                    if (!newTaskContent.trim() || addingTask) return;
                    setAddingTask(true);
                    try {
                      const t = await api.createTeamTask({ content: newTaskContent.trim(), priority: newTaskPriority, assigned_to: newTaskAssigned.trim() || null });
                      setTasks(prev => [t, ...prev]);
                      setNewTaskContent(''); setNewTaskAssigned(''); setNewTaskPriority('media');
                      setShowAddTask(false);
                    } catch (e) { alert(e.message); }
                    setAddingTask(false);
                  }}
                  style={{ background: '#1b9af5', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !newTaskContent.trim() || addingTask ? 0.5 : 1, flexShrink: 0 }}
                >
                  Crear
                </button>
              </div>
            </div>
          )}

          {/* Tasks list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasksLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 32 }}>
                <div style={{ width: 22, height: 22, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}
            {!tasksLoading && tasks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, paddingTop: 40 }}>
                Sin tareas aún. Crea la primera.
              </div>
            )}
            {tasks.map(task => (
              <div key={task.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '12px 14px', opacity: task.status === 'hecho' ? 0.55 : 1,
                borderLeft: `3px solid ${PRIORITY_COLOR[task.priority] || 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <button
                    onClick={async () => {
                      const nuevoStatus = task.status === 'hecho' ? 'pendiente' : 'hecho';
                      try {
                        const updated = await api.updateTeamTask(task.id, { status: nuevoStatus });
                        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
                      } catch (e) { alert(e.message); }
                    }}
                    title={task.status === 'hecho' ? 'Marcar pendiente' : 'Marcar hecho'}
                    style={{ background: task.status === 'hecho' ? '#10b981' : 'var(--bg)', border: `2px solid ${task.status === 'hecho' ? '#10b981' : 'var(--border)'}`, borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, padding: 0 }}
                  >
                    {task.status === 'hecho' && <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, textDecoration: task.status === 'hecho' ? 'line-through' : 'none', wordBreak: 'break-word' }}>
                      {task.content}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[task.priority], textTransform: 'uppercase', letterSpacing: '0.05em' }}>{task.priority}</span>
                      {task.assigned_to && <span style={{ fontSize: 10, color: 'var(--muted)' }}>→ {task.assigned_to}</span>}
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>por {task.created_by_name}</span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('¿Eliminar esta tarea?')) return;
                      try {
                        await api.deleteTeamTask(task.id);
                        setTasks(prev => prev.filter(t => t.id !== task.id));
                      } catch (e) { alert(e.message); }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0, lineHeight: 1 }}
                    title="Eliminar tarea"
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
