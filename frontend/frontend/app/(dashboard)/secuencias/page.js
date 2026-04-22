'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:      'var(--bg)',
  surface: 'var(--surface)',
  surface2:'var(--surface2)',
  border:  'var(--border)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  accent:  'var(--accent)',
  success: 'var(--success)',
  danger:  'var(--danger)',
  warning: 'var(--warning)',
};

// ── Constants ─────────────────────────────────────────────────────────────────
const TRIGGER_OPTIONS = [
  { value: 'lead_created',   label: 'Al crear lead' },
  { value: 'stage_changed',  label: 'Al cambiar etapa' },
  { value: 'no_response',    label: 'Sin respuesta X días' },
  { value: 'manual',         label: 'Manual' },
];

const ACTION_OPTIONS = [
  { value: 'send_sms',      label: 'Enviar SMS' },
  { value: 'create_task',   label: 'Crear tarea' },
  { value: 'add_tag',       label: 'Agregar tag' },
];

const ACTION_ICONS = {
  send_whatsapp: '💬',
  send_sms:      '📱',
  create_task:   '✅',
  add_tag:       '🏷️',
};

const TRIGGER_LABEL = Object.fromEntries(TRIGGER_OPTIONS.map(t => [t.value, t.label]));
const ACTION_LABEL  = Object.fromEntries(ACTION_OPTIONS.map(a => [a.value, a.label]));

const VARIABLES_HINT = '{{nombre}}, {{telefono}}, {{agente}}';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', background: C.surface2, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.text,
  outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 12, color: C.muted, marginBottom: 5, display: 'block', fontWeight: 500 };

function Btn({ onClick, children, style = {}, disabled = false, title, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'opacity 0.15s', ...style }}>
      {children}
    </button>
  );
}

function Badge({ children, color = C.accent, bg }) {
  const bgColor = bg || `${color}22`;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bgColor }}>
      {children}
    </span>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', padding: 0, position: 'relative', background: value ? C.accent : C.border, transition: 'background 0.2s' }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ── Step builder item ─────────────────────────────────────────────────────────
function StepItem({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const set = (k, v) => onChange({ ...step, [k]: v });
  const setConfig = (k, v) => onChange({ ...step, action_config: { ...step.action_config, [k]: v } });

  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', position: 'relative' }}>
      {/* Step number + order controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {index + 1}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {ACTION_ICONS[step.action_type]} {ACTION_LABEL[step.action_type] || step.action_type}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={onMoveUp}   disabled={index === 0}         title="Subir"   style={{ background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: C.muted, padding: 4, borderRadius: 6, fontSize: 16, opacity: index === 0 ? 0.3 : 1 }}>↑</button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} title="Bajar"   style={{ background: 'none', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', color: C.muted, padding: 4, borderRadius: 6, fontSize: 16, opacity: index === total - 1 ? 0.3 : 1 }}>↓</button>
          <button type="button" onClick={onRemove}   title="Eliminar paso"         style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, padding: 4, borderRadius: 6, fontSize: 14 }}>✕</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Delay days */}
        <div>
          <label style={labelStyle}>Esperar días</label>
          <input type="number" min="0" value={step.delay_days ?? 0}
            onChange={e => set('delay_days', parseInt(e.target.value) || 0)}
            style={inputStyle} />
        </div>
        {/* Delay hours */}
        <div>
          <label style={labelStyle}>y horas</label>
          <input type="number" min="0" max="23" value={step.delay_hours ?? 1}
            onChange={e => set('delay_hours', parseInt(e.target.value) || 0)}
            style={inputStyle} />
        </div>
        {/* Action type */}
        <div>
          <label style={labelStyle}>Acción</label>
          <select value={step.action_type} onChange={e => set('action_type', e.target.value)} style={inputStyle}>
            {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
      </div>

      {/* Action config */}
      {(step.action_type === 'send_whatsapp' || step.action_type === 'send_sms') && (
        <div>
          <label style={labelStyle}>Mensaje <span style={{ color: C.muted, fontSize: 11 }}>— variables: {VARIABLES_HINT}</span></label>
          <textarea value={step.action_config?.message || ''} rows={3}
            onChange={e => setConfig('message', e.target.value)}
            placeholder={`Hola {{nombre}}, te escribimos para...`}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </div>
      )}
      {step.action_type === 'create_task' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
          <div>
            <label style={labelStyle}>Título de la tarea</label>
            <input value={step.action_config?.title || ''} onChange={e => setConfig('title', e.target.value)}
              placeholder="Dar seguimiento a {{nombre}}" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Vence en (días)</label>
            <input type="number" min="1" value={step.action_config?.due_days || 1}
              onChange={e => setConfig('due_days', parseInt(e.target.value) || 1)}
              style={{ ...inputStyle, width: 80 }} />
          </div>
        </div>
      )}
      {step.action_type === 'add_tag' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
          <div>
            <label style={labelStyle}>Nombre del tag</label>
            <input value={step.action_config?.tag || ''} onChange={e => setConfig('tag', e.target.value)}
              placeholder="seguimiento" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <input type="color" value={step.action_config?.color || '#1b9af5'}
              onChange={e => setConfig('color', e.target.value)}
              style={{ ...inputStyle, width: 60, padding: '4px 6px', cursor: 'pointer' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sequence modal ─────────────────────────────────────────────────────────────
const EMPTY_SEQ = { name: '', description: '', trigger_event: 'manual', trigger_stage_id: '', is_active: true };
const EMPTY_STEP = { delay_days: 0, delay_hours: 1, action_type: 'send_sms', action_config: { message: '' } };

function SequenceModal({ sequence, onClose, onSaved }) {
  const isEdit = !!sequence;
  const [form, setForm]     = useState(EMPTY_SEQ);
  const [steps, setSteps]   = useState([]);
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [tab, setTab]       = useState('config'); // 'config' | 'steps' | 'preview'

  useEffect(() => {
    // Load stages for trigger_stage_id
    fetch('/backend/api/pipelines', { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json())
      .then(data => {
        const allStages = [];
        (Array.isArray(data) ? data : []).forEach(p => (p.stages || []).forEach(s => allStages.push({ ...s, pipeline_name: p.name })));
        setStages(allStages);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (sequence) {
      setForm({
        name:             sequence.name             || '',
        description:      sequence.description      || '',
        trigger_event:    sequence.trigger_event    || 'manual',
        trigger_stage_id: sequence.trigger_stage_id || '',
        is_active:        sequence.is_active        !== false,
      });
      // Load steps
      fetch(`/backend/api/sequences/${sequence.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
        .then(r => r.json())
        .then(d => setSteps(d.steps || []))
        .catch(() => {});
    } else {
      setForm(EMPTY_SEQ);
      setSteps([]);
    }
  }, [sequence]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addStep = () => setSteps(prev => [...prev, { ...EMPTY_STEP, action_config: { message: '' } }]);

  const updateStep = (i, updated) => setSteps(prev => prev.map((s, idx) => idx === i ? updated : s));

  const removeStep = (i) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  const moveStep = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const arr = [...steps];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSteps(arr);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        trigger_stage_id: form.trigger_stage_id || null,
        steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
      };
      if (isEdit) {
        await api.updateSequence(sequence.id, payload);
      } else {
        await api.createSequence(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const tabStyle = (active) => ({
    padding: '8px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? C.accent : C.muted, background: 'none', border: 'none',
    borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
    cursor: 'pointer',
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 680 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700, color: C.text }}>
            {isEdit ? 'Editar secuencia' : 'Nueva secuencia'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, marginBottom: 14 }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
          <button style={tabStyle(tab === 'config')}  onClick={() => setTab('config')}>Configuración</button>
          <button style={tabStyle(tab === 'steps')}   onClick={() => setTab('steps')}>Pasos ({steps.length})</button>
          <button style={tabStyle(tab === 'preview')} onClick={() => setTab('preview')}>Preview</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', minHeight: 300 }}>

            {/* ── Config tab ── */}
            {tab === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nombre *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Ej: Follow-up post consulta" style={inputStyle} autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Descripción</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)}
                    placeholder="Describe el objetivo de esta secuencia..." rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Trigger</label>
                    <select value={form.trigger_event} onChange={e => set('trigger_event', e.target.value)} style={inputStyle}>
                      {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {form.trigger_event === 'stage_changed' && (
                    <div>
                      <label style={labelStyle}>Etapa</label>
                      <select value={form.trigger_stage_id} onChange={e => set('trigger_stage_id', e.target.value)} style={inputStyle}>
                        <option value="">— Seleccionar etapa —</option>
                        {stages.map(s => (
                          <option key={s.id} value={s.id}>{s.pipeline_name} › {s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle value={form.is_active} onChange={v => set('is_active', v)} />
                  <span style={{ fontSize: 13, color: C.text }}>{form.is_active ? 'Activa' : 'Inactiva'}</span>
                </div>
              </div>
            )}

            {/* ── Steps tab ── */}
            {tab === 'steps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {steps.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                    <div style={{ fontSize: 14 }}>Sin pasos aún. Agrega el primero.</div>
                  </div>
                )}
                {steps.map((step, i) => (
                  <StepItem key={i} step={step} index={i} total={steps.length}
                    onChange={updated => updateStep(i, updated)}
                    onRemove={() => removeStep(i)}
                    onMoveUp={() => moveStep(i, -1)}
                    onMoveDown={() => moveStep(i, 1)}
                  />
                ))}
                <Btn onClick={addStep} style={{ background: `${C.accent}22`, color: C.accent, border: `1px dashed ${C.accent}`, justifyContent: 'center' }}>
                  + Agregar paso
                </Btn>
              </div>
            )}

            {/* ── Preview tab ── */}
            {tab === 'preview' && (
              <div style={{ padding: '8px 0' }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
                  Flujo de la secuencia <strong style={{ color: C.text }}>{form.name || '(sin nombre)'}</strong> · Trigger: <strong style={{ color: C.text }}>{TRIGGER_LABEL[form.trigger_event]}</strong>
                </div>
                {steps.length === 0 ? (
                  <div style={{ color: C.muted, fontSize: 13 }}>Sin pasos configurados.</div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    {steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                        {/* Timeline line */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C.accent}22`, border: `2px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.accent, fontWeight: 700, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          {i < steps.length - 1 && (
                            <div style={{ width: 2, flex: 1, minHeight: 24, background: C.border, marginTop: 4 }} />
                          )}
                        </div>
                        {/* Step card */}
                        <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', flex: 1, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14 }}>{ACTION_ICONS[step.action_type]}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ACTION_LABEL[step.action_type]}</span>
                            <span style={{ fontSize: 11, color: C.muted }}>
                              — esperar {step.delay_days}d {step.delay_hours}h
                            </span>
                          </div>
                          {(step.action_type === 'send_whatsapp' || step.action_type === 'send_sms') && step.action_config?.message && (
                            <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', lineHeight: 1.4, marginTop: 4, padding: '6px 10px', background: C.surface, borderRadius: 8 }}>
                              "{step.action_config.message}"
                            </div>
                          )}
                          {step.action_type === 'create_task' && step.action_config?.title && (
                            <div style={{ fontSize: 12, color: C.muted }}>Tarea: {step.action_config.title}</div>
                          )}
                          {step.action_type === 'add_tag' && step.action_config?.tag && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: step.action_config.color || '#1b9af5' }} />
                              <span style={{ fontSize: 12, color: C.muted }}>{step.action_config.tag}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C.success}22`, border: `2px solid ${C.success}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</div>
                      </div>
                      <div style={{ flex: 1, padding: '8px 14px', fontSize: 12, color: C.success, fontWeight: 600 }}>Completado</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div style={{ margin: '0 24px', background: 'rgba(255,91,91,0.1)', border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.danger }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px 20px', borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
            <Btn onClick={onClose} style={{ background: C.surface2, color: C.muted }}>Cancelar</Btn>
            <Btn type="submit" disabled={saving} style={{ background: C.accent, color: '#fff' }}>
              {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear secuencia')}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Enrollments modal ─────────────────────────────────────────────────────────
function EnrollmentsModal({ sequence, onClose }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sequence) return;
    setLoading(true);
    api.sequenceEnrollments(`?sequence_id=${sequence.id}`)
      .then(d => setEnrollments(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sequence]);

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar este enrollment?')) return;
    await api.cancelEnrollment(id);
    setEnrollments(prev => prev.map(e => e.id === id ? { ...e, status: 'cancelled' } : e));
  };

  const STATUS_COLOR = { active: C.accent, paused: C.warning, completed: C.success, cancelled: C.muted };
  const STATUS_LABEL = { active: 'Activo', paused: 'Pausado', completed: 'Completado', cancelled: 'Cancelado' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 540, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Enrollments</div>
            <div style={{ fontSize: 12, color: C.muted }}>{sequence?.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>}
          {!loading && enrollments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div>Sin enrollments en esta secuencia</div>
            </div>
          )}
          {!loading && enrollments.map(e => (
            <div key={e.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{e.contact_name || e.lead_title}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  Paso {e.current_step} · {e.next_run_at ? `Próximo: ${fmtDate(e.next_run_at)}` : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge color={STATUS_COLOR[e.status]}>{STATUS_LABEL[e.status] || e.status}</Badge>
                {e.status === 'active' && (
                  <Btn onClick={() => handleCancel(e.id)} style={{ background: 'rgba(255,91,91,0.1)', color: C.danger, padding: '4px 10px', fontSize: 12 }}>
                    Cancelar
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SecuenciasPage() {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSeq, setEditSeq]     = useState(null);
  const [enrollSeq, setEnrollSeq] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);

  const loadSequences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.sequences();
      setSequences(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSequences(); }, [loadSequences]);

  const openCreate = () => { setEditSeq(null); setModalOpen(true); };
  const openEdit   = (s) => { setEditSeq(s);   setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditSeq(null); };
  const handleSaved = () => { closeModal(); loadSequences(); };

  const handleToggle = async (seq) => {
    try {
      const updated = await api.toggleSequence(seq.id);
      setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, is_active: updated.is_active } : s));
    } catch (e) { alert(e.message); }
  };

  const doDelete = async () => {
    if (!delConfirm) return;
    try {
      await api.deleteSequence(delConfirm.id);
      setDelConfirm(null);
      loadSequences();
    } catch (e) { alert(e.message); }
  };

  const total   = sequences.length;
  const active  = sequences.filter(s => s.is_active).length;
  const enrolled = sequences.reduce((sum, s) => sum + (s.active_enrollments || 0), 0);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 24px 60px', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Secuencias Automáticas</span>
          <span style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 12, color: C.muted, fontWeight: 600 }}>{total}</span>
        </div>
        <Btn onClick={openCreate} style={{ background: C.accent, color: '#fff', padding: '8px 18px', fontSize: 14, borderRadius: 10 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nueva Secuencia
        </Btn>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total secuencias', value: total },
          { label: 'Activas',          value: active,   color: C.success },
          { label: 'Leads en curso',   value: enrolled, color: C.accent  },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', flex: '1 1 140px', minWidth: 130 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color || C.text, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── List ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && sequences.length === 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '60px 24px', textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🔄</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Sin secuencias</div>
          <div style={{ fontSize: 13 }}>Crea tu primera secuencia automática de follow-up</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!loading && sequences.map(seq => (
          <div key={seq.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>

            {/* Toggle */}
            <Toggle value={seq.is_active} onChange={() => handleToggle(seq)} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: seq.is_active ? C.text : C.muted }}>{seq.name}</span>
                <Badge color={seq.is_active ? C.success : C.muted}>{seq.is_active ? 'Activa' : 'Inactiva'}</Badge>
              </div>
              {seq.description && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{seq.description}</div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: C.muted }}>
                  🎯 {TRIGGER_LABEL[seq.trigger_event] || seq.trigger_event}
                  {seq.trigger_stage_name ? ` (${seq.trigger_stage_name})` : ''}
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>📋 {seq.steps_count || 0} pasos</span>
                <span style={{ fontSize: 11, color: seq.active_enrollments > 0 ? C.accent : C.muted }}>
                  👥 {seq.active_enrollments || 0} leads activos
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>🗓 {fmtDate(seq.created_at)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {seq.active_enrollments > 0 && (
                <Btn onClick={() => setEnrollSeq(seq)} style={{ background: `${C.accent}22`, color: C.accent, fontSize: 12, padding: '6px 12px' }}>
                  Ver enrollments
                </Btn>
              )}
              <Btn onClick={() => openEdit(seq)} style={{ background: C.surface2, color: C.text }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Editar
              </Btn>
              <Btn onClick={() => setDelConfirm(seq)} style={{ background: 'rgba(255,91,91,0.1)', color: C.danger }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </Btn>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modals ── */}
      {modalOpen && (
        <SequenceModal sequence={editSeq} onClose={closeModal} onSaved={handleSaved} />
      )}
      {enrollSeq && (
        <EnrollmentsModal sequence={enrollSeq} onClose={() => setEnrollSeq(null)} />
      )}

      {/* ── Delete confirm ── */}
      {delConfirm && (
        <div onClick={() => setDelConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,91,91,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Eliminar secuencia</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
              ¿Eliminar <strong style={{ color: C.text }}>{delConfirm.name}</strong>? Se cancelarán todos los enrollments activos.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn onClick={() => setDelConfirm(null)} style={{ background: C.surface2, color: C.muted, padding: '9px 20px' }}>Cancelar</Btn>
              <Btn onClick={doDelete} style={{ background: C.danger, color: '#fff', padding: '9px 20px' }}>Eliminar</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
