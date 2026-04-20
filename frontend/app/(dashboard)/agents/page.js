'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';

const AVATAR_COLORS = ['#1b9af5','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function AgentModal({ agent, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: agent?.name || '',
    email: agent?.email || '',
    password: '',
    role: agent?.role || 'agent',
    active: agent?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name || !form.email || (!agent && !form.password)) return;
    setSaving(true);
    try {
      if (agent) {
        const data = { name: form.name, role: form.role, active: form.active };
        if (form.password) data.password = form.password;
        await api.updateAgent(agent.id, data);
      } else {
        await api.createAgent(form);
      }
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-white mb-5">{agent ? 'Editar agente' : 'Nuevo agente'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre completo" />
          </div>
          {!agent && (
            <div>
              <label className="block text-xs text-muted mb-1">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" />
            </div>
          )}
          <div>
            <label className="block text-xs text-muted mb-1">{agent ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña *'}</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Rol</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="agent">Agente</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {agent && (
            <div className="flex items-center gap-3 pt-1">
              <label className="text-xs text-muted">Activo</label>
              <button
                onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-accent' : 'bg-white/10'}`}
              >
                <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: form.active ? '22px' : '2px' }} />
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={saving || !form.name || !form.email || (!agent && !form.password)}
            className="btn-primary px-4 py-2 text-sm flex-1 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Asistente IA ──────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  '¿Cómo manejo a un cliente que quiere cancelar su reserva?',
  'Redacta un email de seguimiento para un lead que no ha respondido',
  '¿Qué información debo pedir para una reserva de villa?',
  'Ayúdame a responder a un cliente insatisfecho con el servicio',
  'Crea un mensaje de bienvenida para un nuevo cliente',
];

function AssistantTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedLead, setAttachedLead] = useState(null); // { id, name }
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!leadSearch.trim()) { setLeadResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await api.leads(`?search=${encodeURIComponent(leadSearch)}&limit=5`);
        setLeadResults((Array.isArray(r) ? r : (r?.data || [])).slice(0, 5));
      } catch { setLeadResults([]); }
      setSearchLoading(false);
    }, 350);
  }, [leadSearch]);

  const send = async (text) => {
    const txt = (text || input).trim();
    if (!txt || loading) return;
    const newMessages = [...messages, { role: 'user', text: txt }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const { text: reply } = await api.assistant(newMessages, attachedLead?.id);
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: '⚠️ ' + (e.message || 'Error al conectar con el asistente') }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const hPad = isMobile ? '0 12px 12px' : '0 24px 24px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: hPad }}>

      {/* Header info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '10px 0 8px' : '16px 0 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: 'var(--text)' }}>Asistente IA</div>
          {!isMobile && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pregúntame cualquier cosa sobre tu trabajo, clientes o redacción</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Lead adjunto */}
          {attachedLead ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, padding: '3px 8px 3px 7px' }}>
              <span style={{ fontSize: 10, color: '#60a5fa' }}>📋 {attachedLead.name.slice(0, isMobile ? 12 : 20)}{attachedLead.name.length > (isMobile ? 12 : 20) ? '…' : ''}</span>
              <button onClick={() => { setAttachedLead(null); setLeadSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                placeholder="Adjuntar lead..."
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', width: isMobile ? 110 : 150 }}
              />
              {leadSearch && (
                <div style={{ position: 'absolute', top: '100%', right: 0, width: isMobile ? 200 : 'auto', minWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, zIndex: 10, overflow: 'hidden' }}>
                  {searchLoading && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Buscando...</div>}
                  {!searchLoading && leadResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Sin resultados</div>}
                  {leadResults.map(l => (
                    <button key={l.id} onClick={() => { setAttachedLead({ id: l.id, name: l.title || l.contact_name || 'Lead' }); setLeadSearch(''); setLeadResults([]); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {l.title || l.contact_name || 'Sin nombre'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setAttachedLead(null); }} style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: isMobile ? '3px 7px' : '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {isMobile ? 'Limpiar' : 'Nueva conversación'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20 }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>✦</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 340 }}>
              Tu asistente de trabajo. Pregunta sobre clientes, redacta mensajes o resuelve dudas del día a día.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 480 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  textAlign: 'left', padding: '9px 14px', borderRadius: 8, fontSize: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text)', cursor: 'pointer', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'model' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginRight: 8, marginTop: 2 }}>✦</div>
            )}
            <div style={{
              maxWidth: '75%',
              background: m.role === 'user' ? 'rgba(59,130,246,0.2)' : 'var(--surface)',
              border: m.role === 'user' ? '1px solid rgba(59,130,246,0.35)' : '1px solid var(--border)',
              borderRadius: m.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
              padding: '10px 14px',
              fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>✦</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px 16px 16px 16px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: `bounce 1s ${i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? '8px 10px' : '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          rows={isMobile ? 1 : 2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={isMobile ? 'Escribe tu pregunta...' : 'Escribe tu pregunta... (Enter para enviar, Shift+Enter para nueva línea)'}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: isMobile ? 13 : 13, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{
          background: input.trim() && !loading ? '#1b9af5' : 'var(--border)',
          border: 'none', borderRadius: 8, padding: isMobile ? '7px 12px' : '8px 16px',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
          flexShrink: 0, transition: 'background 0.15s',
        }}>
          {isMobile ? '↑' : 'Enviar'}
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-6px) } }
      `}</style>
    </div>
  );
}

export default function AgentsPage() {
  const [tab, setTab] = useState('equipo');
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cargar = () => {
    setLoading(true);
    Promise.all([
      api.agents(),
      api.agentReport(30).catch(() => []),
    ]).then(([a, s]) => {
      setAgents(Array.isArray(a) ? a : []);
      setStats(Array.isArray(s) ? s : []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const totalMsgs  = stats.reduce((s, a) => s + (Number(a.messages_sent) || 0), 0);
  const totalLeads = stats.reduce((s, a) => s + (Number(a.leads_assigned) || 0), 0);
  const totalWon   = stats.reduce((s, a) => s + (Number(a.leads_won) || 0), 0);
  const getStats   = id => stats.find(s => s.agent_id === id);

  const th = { padding: '10px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', whiteSpace: 'nowrap' };
  const td = { padding: '0 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)', height: 52, verticalAlign: 'middle', whiteSpace: 'nowrap' };

  const pad = isMobile ? '12px 16px' : '16px 24px';
  const padStats = isMobile ? '12px 16px 0' : '16px 24px 0';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar con tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: pad, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ k: 'equipo', l: '👥 Equipo' }, { k: 'asistente', l: '✦ Asistente IA' }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: tab === t.k ? 600 : 400,
              background: tab === t.k ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: tab === t.k ? '#1b9af5' : 'var(--muted)',
              border: tab === t.k ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              cursor: 'pointer',
            }}>{t.l}</button>
          ))}
        </div>
        {tab === 'equipo' && (
          <button onClick={() => setModal('new')}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            + Nuevo agente
          </button>
        )}
      </div>

      {tab === 'asistente' && <AssistantTab />}

      {tab === 'equipo' && (<>
      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 12, padding: padStats }}>
        {[
          { label: 'Agentes activos',    value: agents.filter(a => a.active !== false).length, color: '#1b9af5', icon: '👥' },
          { label: 'Mensajes (30d)',      value: totalMsgs,  color: '#10b981', icon: '💬' },
          { label: 'Leads asignados',     value: totalLeads, color: '#8b5cf6', icon: '📋' },
          { label: 'Leads ganados',       value: totalWon,   color: '#f59e0b', icon: '🏆' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: isMobile ? '12px 14px' : '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ margin: isMobile ? '12px 0 24px' : '16px 24px 24px', background: 'var(--surface)', border: isMobile ? 'none' : '1px solid var(--border)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: isMobile ? 0 : 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Agente</th>
                <th style={th}>Email</th>
                <th style={th}>Rol</th>
                <th style={th}>Estado</th>
                <th style={{ ...th, textAlign: 'right' }}>Mensajes</th>
                <th style={{ ...th, textAlign: 'right' }}>Leads</th>
                <th style={{ ...th, textAlign: 'right' }}>Ganados</th>
                <th style={{ ...th, textAlign: 'right' }}>Conversión</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} style={{ ...td, textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Cargando...
                    </div>
                  </td>
                </tr>
              )}
              {!loading && agents.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...td, textAlign: 'center', color: 'var(--muted)', padding: '48px 0' }}>
                    No hay agentes. Crea el primero.
                  </td>
                </tr>
              )}
              {agents.map((a, idx) => {
                const color = avatarColor(a.name);
                const st = getStats(a.id);
                const medals = ['🥇','🥈','🥉'];
                return (
                  <tr key={a.id}
                    style={{ cursor: 'default', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Nombre */}
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '22', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {a.name[0]?.toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>
                          {a.name}
                          {idx < 3 && <span style={{ marginLeft: 4 }}>{medals[idx]}</span>}
                        </span>
                      </div>
                    </td>
                    {/* Email */}
                    <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{a.email}</td>
                    {/* Rol */}
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                        background: a.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
                        color: a.role === 'admin' ? '#60a5fa' : 'var(--muted)',
                      }}>
                        {a.role === 'admin' ? 'Admin' : 'Agente'}
                      </span>
                    </td>
                    {/* Estado */}
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                        background: a.active !== false ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                        color: a.active !== false ? '#34d399' : 'var(--muted)',
                      }}>
                        {a.active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {/* Mensajes */}
                    <td style={{ ...td, textAlign: 'right', color: st?.messages_sent > 0 ? '#10b981' : 'var(--muted)', fontWeight: st?.messages_sent > 0 ? 600 : 400 }}>
                      {st ? Number(st.messages_sent || 0).toLocaleString() : '—'}
                    </td>
                    {/* Leads */}
                    <td style={{ ...td, textAlign: 'right', color: st?.leads_assigned > 0 ? '#8b5cf6' : 'var(--muted)', fontWeight: st?.leads_assigned > 0 ? 600 : 400 }}>
                      {st ? (st.leads_assigned || 0) : '—'}
                    </td>
                    {/* Ganados */}
                    <td style={{ ...td, textAlign: 'right', color: st?.leads_won > 0 ? '#f59e0b' : 'var(--muted)', fontWeight: st?.leads_won > 0 ? 600 : 400 }}>
                      {st ? (st.leads_won || 0) : '—'}
                    </td>
                    {/* Conversión */}
                    {(() => {
                      const rate = st && (st.leads_assigned > 0) ? Math.round((st.leads_won / st.leads_assigned) * 100) : null;
                      return (
                        <td style={{ ...td, textAlign: 'right', color: rate > 0 ? '#10b981' : 'var(--muted)', fontWeight: rate > 0 ? 600 : 400 }}>
                          {st ? (rate !== null ? `${rate}%` : '0%') : '—'}
                        </td>
                      );
                    })()}
                    {/* Acciones */}
                    <td style={{ ...td, paddingRight: 12 }}>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button onClick={() => setModal(a)}
                          style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                        >Editar</button>
                        <button onClick={async () => {
                          if (!confirm(`¿Eliminar a ${a.name}?`)) return;
                          await api.deleteAgent(a.id).catch(e => alert(e.message));
                          cargar();
                        }}
                          style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                        >Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <AgentModal agent={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={cargar} />
      )}
      </>)}
    </div>
  );
}
