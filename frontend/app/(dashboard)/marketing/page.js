'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

const CHANNELS = [
  { v: 'facebook',  label: 'Facebook Ads',  color: '#1877f2' },
  { v: 'instagram', label: 'Instagram Ads', color: '#e1306c' },
  { v: 'google',    label: 'Google Ads',    color: '#4285f4' },
  { v: 'tiktok',    label: 'TikTok Ads',    color: '#000' },
  { v: 'whatsapp',  label: 'WhatsApp',      color: '#25d366' },
  { v: 'volantes',  label: 'Volantes',      color: '#f59e0b' },
  { v: 'referido',  label: 'Referido',      color: '#10b981' },
  { v: 'otro',      label: 'Otro',          color: '#64748b' },
];
const channelColor = (c) => CHANNELS.find(x => x.v === c)?.color || '#64748b';
const channelLabel = (c) => CHANNELS.find(x => x.v === c)?.label || (c || '—');
const fmt = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtDate = s => s ? new Date(s).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function MarketingPage() {
  const [dashboard, setDashboard] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([api.marketingDashboard(), api.marketingCampaigns()]);
      setDashboard(d);
      setCampaigns(c.campaigns || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a3c8f', letterSpacing: 2, marginBottom: 4 }}>MARKETING · ROI</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>Campañas e Inversión</h1>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ background: 'linear-gradient(135deg,#1a3c8f,#0f2558)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(26,60,143,0.25)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Nueva campaña
        </button>
      </div>

      {/* Dashboard cards */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <DashCard label="Inversión total" value={fmt(dashboard.total_spent)} color="#ef4444" sub={`${dashboard.campaign_count} campañas`} />
          <DashCard label="Leads atribuidos" value={dashboard.leads_attributed} color="#1a3c8f" sub="Con campaña asignada" />
          <DashCard label="Ventas cerradas" value={dashboard.sales_count} color="#10b981" sub={fmt(dashboard.revenue) + ' revenue'} />
          <DashCard label="ROI" value={dashboard.roi_pct + '%'} color={dashboard.roi_pct >= 0 ? '#10b981' : '#ef4444'} sub={dashboard.roi_pct >= 0 ? 'Ganancia' : 'Pérdida'} highlight />
        </div>
      )}

      {/* Campaigns list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Cargando…</div>
      ) : campaigns.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Aún no hay campañas</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Crea tu primera campaña para empezar a medir ROI.</div>
          <button onClick={() => setShowNew(true)} style={{ background: '#1a3c8f', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nueva campaña</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {campaigns.map(c => {
            const roi = c.total_spent > 0 ? Math.round(((c.revenue - c.total_spent) / c.total_spent) * 100) : null;
            return (
              <div key={c.id} onClick={() => setOpenId(c.id)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${channelColor(c.channel)}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#67e8f9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: channelColor(c.channel), flexShrink: 0 }} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <span style={{ fontSize: 11, color: channelColor(c.channel), background: channelColor(c.channel) + '15', padding: '2px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0 }}>{channelLabel(c.channel)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(c.start_date)}{c.end_date ? ` → ${fmtDate(c.end_date)}` : ''}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, fontSize: 12 }}>
                  <Stat label="Presupuesto" value={fmt(c.budget)} />
                  <Stat label="Gastado" value={fmt(c.total_spent)} color="#ef4444" />
                  <Stat label="Leads" value={c.leads_count} />
                  <Stat label="Ventas" value={`${c.sales_count} · ${fmt(c.revenue)}`} color="#10b981" />
                  {roi !== null && <Stat label="ROI" value={roi + '%'} color={roi >= 0 ? '#10b981' : '#ef4444'} bold />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <CampaignModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {openId && <CampaignDetail id={openId} onClose={() => { setOpenId(null); load(); }} onChanged={load} />}
    </div>
  );
}

function DashCard({ label, value, sub, color, highlight }) {
  return (
    <div style={{ background: highlight ? `linear-gradient(135deg, ${color}11, ${color}22)` : 'var(--surface)', border: highlight ? `1px solid ${color}55` : '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>
    </div>
  );
}
function Stat({ label, value, color, bold }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}

function CampaignModal({ campaign, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: campaign?.name || '',
    channel: campaign?.channel || 'facebook',
    start_date: campaign?.start_date?.slice(0,10) || '',
    end_date: campaign?.end_date?.slice(0,10) || '',
    budget: campaign?.budget || '',
    total_spent: campaign?.total_spent || '',
    notes: campaign?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return alert('Falta nombre');
    setSaving(true);
    try {
      if (campaign) await api.updateMarketingCampaign(campaign.id, form);
      else await api.createMarketingCampaign(form);
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{campaign ? 'Editar campaña' : 'Nueva campaña'}</div>
        <Field label="Nombre *" value={form.name} onChange={v => setForm(f => ({...f, name: v}))} placeholder="Facebook Ads — Marzo 2026" />
        <div style={{ marginBottom: 12 }}>
          <label style={lblStyle}>Canal</label>
          <select value={form.channel} onChange={e => setForm(f => ({...f, channel: e.target.value}))} style={inputStyle}>
            {CHANNELS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Inicio" value={form.start_date} onChange={v => setForm(f => ({...f, start_date: v}))} type="date" />
          <Field label="Fin" value={form.end_date} onChange={v => setForm(f => ({...f, end_date: v}))} type="date" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Presupuesto $" value={form.budget} onChange={v => setForm(f => ({...f, budget: v}))} type="number" />
          <Field label="Gastado $" value={form.total_spent} onChange={v => setForm(f => ({...f, total_spent: v}))} type="number" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lblStyle}>Notas</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={3} style={{...inputStyle, resize: 'vertical', fontFamily: 'inherit'}} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, background: '#1a3c8f', color: '#fff', border: 'none', borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function CampaignDetail({ id, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = async () => {
    try {
      const d = await api.marketingCampaign(id);
      setData(d);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, [id]);

  const onUpload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result || ''); const i = s.indexOf(','); res(i >= 0 ? s.slice(i + 1) : s); };
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      await api.uploadMarketingFile(id, { name: f.name, mimeType: f.type, content: b64 });
      load();
      onChanged?.();
    } catch (e) { alert(e.message); }
    setUploading(false);
  };

  const onDeleteCampaign = async () => {
    if (!confirm('¿Eliminar esta campaña? Los leads atribuidos perderán la asociación.')) return;
    try { await api.deleteMarketingCampaign(id); onClose(); }
    catch (e) { alert(e.message); }
  };

  const onDeleteFile = async (fid) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    try { await api.deleteMarketingFile(fid); load(); }
    catch (e) { alert(e.message); }
  };

  const viewFile = async (fid, name, mime) => {
    try {
      const r = await api.getMarketingFile(fid);
      const bytes = Uint8Array.from(atob(r.file.file_base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime || r.file.mime_type });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { alert(e.message); }
  };

  if (!data) return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>Cargando…</div>
    </div>
  );

  const c = data.campaign;
  const roi = c.total_spent > 0 ? Math.round(((data.leads.reduce((s,l) => /ganado|cerrado|complet|instal/i.test(l.stage_name||'') ? s + Number(l.value||0) : s, 0) - c.total_spent) / c.total_spent) * 100) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: channelColor(c.channel), flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{channelLabel(c.channel)} · {fmtDate(c.start_date)}{c.end_date ? ` → ${fmtDate(c.end_date)}` : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(true)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>Editar</button>
            <button onClick={onDeleteCampaign} style={{ background: 'transparent', border: '1px solid #ef4444', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: '#ef4444', cursor: 'pointer' }}>×</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, padding: '0 8px' }}>×</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14, borderBottom: '1px solid var(--border)' }}>
          <Stat label="Presupuesto" value={fmt(c.budget)} />
          <Stat label="Gastado" value={fmt(c.total_spent)} color="#ef4444" />
          <Stat label="Leads" value={data.leads.length} />
          <Stat label="Ventas" value={data.leads.filter(l => /ganado|cerrado|complet|instal/i.test(l.stage_name||'')).length} color="#10b981" />
          {roi !== null && <Stat label="ROI" value={roi + '%'} color={roi >= 0 ? '#10b981' : '#ef4444'} bold />}
        </div>

        {c.notes && (
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{c.notes}</div>
        )}

        {/* Files */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Capturas / archivos ({data.files.length})</div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#1a3c8f', color: '#fff', padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Subiendo…' : '+ Subir archivo'}
              <input type="file" onChange={onUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>
          {data.files.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 20, border: '1px dashed var(--border)', borderRadius: 8 }}>Sin archivos. Sube capturas de la campaña.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {data.files.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
                  <button onClick={() => viewFile(f.id, f.file_name, f.mime_type)} style={{ background: 'none', border: 'none', color: '#1a3c8f', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flex: 1, textAlign: 'left' }}>
                    📄 {f.file_name}
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {Math.round((f.file_size||0)/1024)} KB · {fmtDate(f.created_at)}</span>
                  </button>
                  <button onClick={() => onDeleteFile(f.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leads */}
        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Leads atribuidos ({data.leads.length})</div>
          {data.leads.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aún no hay leads asociados. Asigna leads a esta campaña desde su panel.</div>
          ) : (
            <div style={{ display: 'grid', gap: 5 }}>
              {data.leads.map(l => (
                <a key={l.id} href={`/leads?open=${l.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, textDecoration: 'none', color: 'var(--text)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{l.contact_name || l.title}</span>
                  <span style={{ color: l.stage_color || 'var(--muted)', background: (l.stage_color||'#64748b') + '15', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, marginLeft: 8 }}>{l.stage_name || '—'}</span>
                  <span style={{ marginLeft: 12, color: 'var(--text)', fontWeight: 700 }}>{fmt(l.value)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      {editing && <CampaignModal campaign={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged?.(); }} />}
    </div>
  );
}

const lblStyle = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 };
const inputStyle = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' };

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lblStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}
