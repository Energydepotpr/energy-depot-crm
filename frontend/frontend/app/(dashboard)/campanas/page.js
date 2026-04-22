'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG = {
  draft:      { label: 'Borrador',  bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  scheduled:  { label: 'Programada', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  sending:    { label: 'Enviando',  bg: 'rgba(59,130,246,0.15)',  color: '#1b9af5', blink: true },
  sent:       { label: 'Enviada',   bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
  failed:     { label: 'Fallida',   bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:     { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'inherit' },
  topBar:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 },
  title:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' },
  badge:    { background: 'var(--surface)', color: 'var(--muted)', fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 8px' },
  btnPrimary: { background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' },
  btnDanger:{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: '#ef4444', cursor: 'pointer', fontWeight: 600 },
  label:    { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:    { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' },
  select:   { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' },
  overlay:  { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.65)' },
  modal:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' },
  tableWrap:{ margin: '0 24px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  th:       { padding: '10px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg)' },
  td:       { padding: '0 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)', height: 54, verticalAlign: 'middle' },
  tdMuted:  { padding: '0 16px', fontSize: 13, color: 'var(--muted)', borderBottom: '1px solid var(--border)', height: 54, verticalAlign: 'middle' },
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '3px 10px',
      background: cfg.bg, color: cfg.color,
      animation: cfg.blink ? 'pulse 1.5s ease-in-out infinite' : 'none',
    }}>
      {cfg.blink && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
      )}
      {cfg.label}
    </span>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ sent, failed, total }) {
  if (!total || total === 0) return <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>;
  const sentPct = (sent / total) * 100;
  const failedPct = (failed / total) * 100;
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--border)', marginBottom: 4 }}>
        <div style={{ width: `${sentPct}%`, background: '#10b981', transition: 'width 0.3s' }} />
        <div style={{ width: `${failedPct}%`, background: '#ef4444', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        <span style={{ color: '#10b981' }}>{sent} ok</span>
        {failed > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>{failed} fallidos</span>}
        <span style={{ marginLeft: 6 }}>/ {total}</span>
      </div>
    </div>
  );
}

// ─── Confirm Send Modal ───────────────────────────────────────────────────────

function ConfirmSendModal({ campaign, segmentContactCount, onConfirm, onClose, sending }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📧</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Confirmar envío</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            ¿Enviar la campaña <strong style={{ color: 'var(--text)' }}>"{campaign.name}"</strong>?
          </p>
        </div>

        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Asunto</span>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, maxWidth: 220, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.subject}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Segmento</span>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{campaign.segment_name || '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Destinatarios (con email)</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
              {segmentContactCount !== null ? segmentContactCount : '...'}
            </span>
          </div>
        </div>

        {segmentContactCount === 0 && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#f59e0b' }}>
            El segmento no tiene contactos con email. El envío se simulará sin destinatarios reales.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onConfirm}
            disabled={sending}
            style={{ ...S.btnPrimary, flex: 1, opacity: sending ? 0.6 : 1, background: '#10b981' }}
          >
            {sending ? 'Enviando...' : 'Enviar ahora'}
          </button>
          <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Modal (Create / Edit) ──────────────────────────────────────────

function CampaignModal({ campaign, segments, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:       campaign?.name       || '',
    subject:    campaign?.subject    || '',
    segment_id: campaign?.segment_id || '',
    body_html:  campaign?.body_html  || '',
    body_text:  campaign?.body_text  || '',
  });
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const save = async () => {
    if (!form.name.trim()) return;
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        segment_id: form.segment_id ? Number(form.segment_id) : null,
      };
      if (campaign) {
        await api.updateCampaign(campaign.id, payload);
      } else {
        await api.createCampaign(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  const canSave = form.name.trim() && form.subject.trim();

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {campaign ? 'Editar campaña' : 'Nueva campaña'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {/* Name */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Nombre de la campaña *</label>
            <input style={S.input} type="text" placeholder="Ej: Newsletter Marzo 2026"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          {/* Subject */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Asunto del email *</label>
            <input style={S.input} type="text" placeholder="Ej: Novedades de este mes 🎉"
              value={form.subject} onChange={e => set('subject', e.target.value)} />
          </div>

          {/* Segment */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Segmento</label>
            <select style={S.select} value={form.segment_id} onChange={e => set('segment_id', e.target.value)}>
              <option value="">— Sin segmento —</option>
              {segments.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.contact_count} contactos)</option>
              ))}
            </select>
            {!form.segment_id && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0' }}>Sin segmento, la campaña no tendrá destinatarios</p>
            )}
          </div>
        </div>

        {/* HTML Body */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <label style={{ ...S.label, margin: 0 }}>Contenido HTML del email</label>
            <button
              onClick={() => setPreviewHtml(p => !p)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}
            >
              {previewHtml ? 'Editar' : 'Vista previa'}
            </button>
          </div>
          {previewHtml ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', minHeight: 200, maxHeight: 300, overflowY: 'auto', padding: 12 }}>
              {form.body_html ? (
                <div dangerouslySetInnerHTML={{ __html: form.body_html }} style={{ color: '#111' }} />
              ) : (
                <p style={{ color: '#666', fontSize: 13 }}>Sin contenido HTML</p>
              )}
            </div>
          ) : (
            <textarea
              style={{ ...S.input, resize: 'vertical', minHeight: 160, fontFamily: 'monospace', fontSize: 12 }}
              placeholder={'<h1>Hola {{nombre}}</h1>\n<p>Contenido del email...</p>'}
              value={form.body_html}
              onChange={e => set('body_html', e.target.value)}
            />
          )}
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 0' }}>
            HTML completo. Si está vacío, se usará el texto plano como fallback.
          </p>
        </div>

        {/* Plain Text Body */}
        <div style={{ marginBottom: 22 }}>
          <label style={S.label}>Texto plano alternativo</label>
          <textarea
            style={{ ...S.input, resize: 'vertical', minHeight: 80 }}
            placeholder="Versión sin formato del email para clientes que no soportan HTML..."
            value={form.body_text}
            onChange={e => set('body_text', e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={save}
            disabled={saving || !canSave}
            style={{ ...S.btnPrimary, flex: 1, opacity: (!canSave || saving) ? 0.5 : 1 }}
          >
            {saving ? 'Guardando...' : (campaign ? 'Actualizar campaña' : 'Crear campaña')}
          </button>
          <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);          // null | 'new' | campaign obj
  const [confirmSend, setConfirmSend] = useState(null); // campaign obj
  const [segContactCount, setSegContactCount] = useState(null);
  const [sending, setSending] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.campaigns(),
      api.segments(),
    ])
      .then(([campData, segData]) => {
        setCampaigns(campData.campaigns || []);
        setSegments(segData.segments || []);
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Poll campaigns that are 'sending' every 4 seconds
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === 'sending');
    if (!hasSending) return;
    const t = setInterval(() => {
      api.campaigns().then(r => setCampaigns(r.campaigns || [])).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [campaigns]);

  const openConfirmSend = async (camp) => {
    setConfirmSend(camp);
    setSegContactCount(null);
    if (camp.segment_id) {
      try {
        // Get contacts WITH email for confirmation count
        const r = await api.previewSegment({ ...(camp.segment_filters || {}), has_email: 'true' });
        setSegContactCount(r.count);
      } catch {
        setSegContactCount(0);
      }
    } else {
      setSegContactCount(0);
    }
  };

  const doSend = async () => {
    if (!confirmSend) return;
    setSending(true);
    try {
      await api.sendCampaign(confirmSend.id);
      setConfirmSend(null);
      cargar();
    } catch (e) {
      alert(e.message);
    }
    setSending(false);
  };

  const eliminar = async (camp) => {
    if (!confirm(`¿Eliminar la campaña "${camp.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteCampaign(camp.id);
      setCampaigns(prev => prev.filter(c => c.id !== camp.id));
    } catch (e) {
      alert(e.message);
    }
  };

  const totalSent = campaigns.filter(c => c.status === 'sent').length;

  return (
    <div style={S.page}>
      {/* CSS animations injected via style tag */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin  { to { transform: rotate(360deg); } }
      `}</style>

      {/* Top bar */}
      <div style={{ ...S.topBar, padding: isMobile ? '10px 12px' : '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.title}>Campañas</span>
          <span style={S.badge}>{loading ? '...' : campaigns.length}</span>
          {totalSent > 0 && !loading && (
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>
              {totalSent} enviada{totalSent !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={() => setModal('new')} style={{ ...S.btnPrimary, fontSize: isMobile ? 12 : 13, padding: isMobile ? '7px 12px' : '7px 16px' }}>
          + Nueva campaña
        </button>
      </div>

      {/* Summary stats */}
      {!loading && campaigns.length > 0 && (
        <div style={{ display: 'flex', gap: 1, padding: '0 24px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {[
            { label: 'Total', value: campaigns.length, color: 'var(--muted)' },
            { label: 'Borradores', value: campaigns.filter(c => c.status === 'draft').length, color: '#94a3b8' },
            { label: 'Enviadas', value: campaigns.filter(c => c.status === 'sent').length, color: '#10b981' },
            { label: 'Fallidas', value: campaigns.filter(c => c.status === 'failed').length, color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} style={{ padding: '12px 20px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, color: 'var(--muted)', fontSize: 14 }}>
          <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Cargando campañas...
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No hay campañas</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Crea tu primera campaña de email masivo</div>
          <button onClick={() => setModal('new')} style={S.btnPrimary}>+ Crear campaña</button>
        </div>
      ) : (
        <div style={{ ...S.tableWrap, margin: isMobile ? '16px 0' : '16px 24px 24px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 'auto' : 700 }}>
              <thead>
                <tr>
                  <th style={S.th}>Nombre</th>
                  {!isMobile && <th style={S.th}>Asunto</th>}
                  {!isMobile && <th style={S.th}>Segmento</th>}
                  <th style={S.th}>Estado</th>
                  {!isMobile && <th style={S.th}>Resultados</th>}
                  {!isMobile && <th style={S.th}>Fecha</th>}
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((camp, idx) => {
                  const isHovered = hoveredId === camp.id;
                  const total = (camp.sent_count || 0) + (camp.failed_count || 0);
                  const rowBg = isHovered ? 'rgba(255,255,255,0.03)' : idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent';

                  return (
                    <tr
                      key={camp.id}
                      onMouseEnter={() => setHoveredId(camp.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{ background: rowBg, transition: 'background 0.1s' }}
                    >
                      {/* Name */}
                      <td style={{ ...S.td, paddingLeft: isMobile ? 12 : 16 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 160 : 220 }}>
                          {camp.name}
                        </div>
                        {isMobile && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                            {camp.subject}
                          </div>
                        )}
                      </td>

                      {/* Subject — desktop only */}
                      {!isMobile && (
                        <td style={{ ...S.tdMuted, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {camp.subject}
                        </td>
                      )}

                      {/* Segment — desktop only */}
                      {!isMobile && (
                        <td style={S.tdMuted}>
                          {camp.segment_name
                            ? <span style={{ fontSize: 12, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderRadius: 20, padding: '2px 9px', fontWeight: 500 }}>{camp.segment_name}</span>
                            : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                          }
                        </td>
                      )}

                      {/* Status */}
                      <td style={S.td}>
                        <StatusBadge status={camp.status} />
                      </td>

                      {/* Results — desktop only */}
                      {!isMobile && (
                        <td style={S.td}>
                          <ProgressBar sent={camp.sent_count || 0} failed={camp.failed_count || 0} total={total} />
                        </td>
                      )}

                      {/* Date — desktop only */}
                      {!isMobile && (
                        <td style={S.tdMuted}>
                          {camp.sent_at ? formatDateShort(camp.sent_at) : formatDateShort(camp.created_at)}
                        </td>
                      )}

                      {/* Actions */}
                      <td style={{ ...S.td, width: isMobile ? 80 : 120, paddingRight: isMobile ? 8 : 16 }}>
                        <div style={{ display: 'flex', gap: 4, opacity: isMobile ? 1 : (isHovered ? 1 : 0), transition: 'opacity 0.15s', justifyContent: 'flex-end' }}>
                          {/* Send button */}
                          {(camp.status === 'draft' || camp.status === 'failed') && (
                            <button
                              onClick={() => openConfirmSend(camp)}
                              title="Enviar campaña"
                              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, color: '#10b981', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Enviar
                            </button>
                          )}
                          {camp.status === 'sending' && (
                            <span style={{ fontSize: 11, color: '#1b9af5', animation: 'pulse 1.5s ease-in-out infinite' }}>Enviando...</span>
                          )}

                          {/* Edit */}
                          {camp.status === 'draft' && (
                            <button
                              onClick={() => setModal(camp)}
                              title="Editar"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', borderRadius: 5, display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = '#1b9af5'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}

                          {/* Delete */}
                          {camp.status === 'draft' && (
                            <button
                              onClick={() => eliminar(camp)}
                              title="Eliminar"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 6px', borderRadius: 5, display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal && (
        <CampaignModal
          campaign={modal === 'new' ? null : modal}
          segments={segments}
          onClose={() => setModal(null)}
          onSaved={cargar}
        />
      )}

      {confirmSend && (
        <ConfirmSendModal
          campaign={confirmSend}
          segmentContactCount={segContactCount}
          onConfirm={doSend}
          onClose={() => setConfirmSend(null)}
          sending={sending}
        />
      )}
    </div>
  );
}
