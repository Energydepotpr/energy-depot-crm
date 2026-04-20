'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import Link from 'next/link';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';

function tiempoRelativo(ts, lang) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('time.now', lang);
  if (min < 60) return t('time.min', lang).replace('{n}', min);
  const h = Math.floor(min / 60);
  if (h < 24) return t('time.hours', lang).replace('{n}', h);
  return t('time.days', lang).replace('{n}', Math.floor(h / 24));
}

const ICONS = {
  intencion_compra: { icon: '⚡', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', typeKey: 'alerts.type.intencion_compra' },
  grupo_grande:     { icon: '👥', color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',   typeKey: 'alerts.type.grupo_grande' },
  web_form:         { icon: '🌐', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', typeKey: 'alerts.type.web_form' },
  email:            { icon: '📧', color: 'text-orange-400',bg: 'bg-orange-500/10 border-orange-500/20',typeKey: 'alerts.type.email' },
  default:          { icon: '🔔', color: 'text-accent',    bg: 'bg-accent/10 border-accent/20',       typeKey: 'alerts.type.default' },
};

const STATUS_VALUES = ['pending', 'en_proceso', 'cotizado', 'confirmado', 'pagado'];
const STATUS_COLORS = {
  pending:    { color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
  en_proceso: { color: '#1b9af5', bg: 'rgba(59,130,246,0.15)'  },
  cotizado:   { color: '#a855f7', bg: 'rgba(168,85,247,0.15)'  },
  confirmado: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  pagado:     { color: '#14b8a6', bg: 'rgba(20,184,166,0.15)'  },
};

function StatusBadge({ status, lang }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: c.bg, color: c.color, border: `1px solid ${c.color}44`,
      whiteSpace: 'nowrap',
    }}>
      {t('alerts.status.' + status, lang)}
    </span>
  );
}

function StatusDropdown({ alertId, currentStatus, onChange, lang }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSelect = async (value) => {
    setOpen(false);
    if (value === currentStatus) return;
    setLoading(true);
    try {
      await api.updateAlertStatus(alertId, value);
      onChange(alertId, value);
    } catch (e) {
      alert(t('common.error', lang) + ': ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const c = STATUS_COLORS[currentStatus] || STATUS_COLORS.pending;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        disabled={loading}
        style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
          background: c.bg, color: c.color, border: `1px solid ${c.color}66`,
          cursor: loading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {loading ? '...' : t('alerts.status.' + currentStatus, lang)}
        {!loading && <span style={{ fontSize: 8, opacity: 0.7 }}>▼</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 20,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden', minWidth: 130,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {STATUS_VALUES.map(s => {
              const sc = STATUS_COLORS[s];
              return (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 14px', background: currentStatus === s ? sc.bg : 'none',
                    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: sc.color, borderBottom: '1px solid var(--border)',
                  }}
                >
                  {t('alerts.status.' + s, lang)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const { lang } = useLang();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seenFiltro, setSeenFiltro] = useState('unseen');
  const [statusFiltro, setStatusFiltro] = useState('all');
  const [dismissed, setDismissed] = useState(new Set());

  const cargar = (filtro = seenFiltro) => {
    setLoading(true);
    const params = filtro === 'unseen' ? '?seen=false' : filtro === 'seen' ? '?seen=true' : '';
    api.alerts(params).then(setAlerts).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(seenFiltro); }, [seenFiltro]);

  const marcarVisto = async (id) => {
    try {
      await api.seenAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, seen: true } : a));
      setTimeout(() => cargar(), 500);
    } catch (e) { console.error(e.message); }
  };

  const marcarTodos = async () => {
    try {
      await api.seenAllAlerts();
      setAlerts(prev => prev.map(a => ({ ...a, seen: true })));
      setTimeout(() => cargar(), 500);
    } catch (e) { console.error(e.message); }
  };

  const handleStatusChange = (id, newStatus) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    if (newStatus === 'pagado') setDismissed(prev => new Set([...prev, id]));
  };

  const dismiss = (id) => setDismissed(prev => new Set([...prev, id]));

  const displayed = alerts.filter(a => {
    if (dismissed.has(a.id) && statusFiltro !== 'pagado') return false;
    if (seenFiltro === 'unseen' && a.seen) return false;
    if (seenFiltro === 'seen' && !a.seen) return false;
    const ef = a.status || 'pending';
    if (statusFiltro !== 'all' && ef !== statusFiltro) return false;
    return true;
  });

  const sinVer = alerts.filter(a => !a.seen).length;
  const pendingCount = alerts.filter(a => !dismissed.has(a.id) && (a.status === 'pending' || !a.status)).length;

  const seenTabs = [
    { key: 'unseen', label: t('alerts.tab.unseen', lang) },
    { key: 'all',    label: t('alerts.tab.all',    lang) },
    { key: 'seen',   label: t('alerts.tab.seen',   lang) },
  ];

  const statusTabs = [
    { key: 'all', label: t('alerts.filter.all', lang) },
    ...STATUS_VALUES.map(v => ({ key: v, label: t('alerts.status.' + v, lang) })),
  ];

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('alerts.title', lang)}</h1>
          <p className="text-sm text-muted mt-1">
            {loading
              ? t('common.loading', lang)
              : `${displayed.length} ${t('alerts.title', lang).toLowerCase()}${pendingCount > 0 ? ` · ${pendingCount} ${t('alerts.status.pending', lang).toLowerCase()}` : ''}${sinVer > 0 ? ` · ${sinVer} ${t('alerts.tab.unseen', lang).toLowerCase()}` : ''}`}
          </p>
        </div>
        {sinVer > 0 && (
          <button onClick={marcarTodos} className="text-xs text-muted hover:text-white border border-border px-3 py-1.5 rounded-lg transition-colors">
            {t('alerts.markAllSeen', lang)}
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4 bg-surface border border-border rounded-xl p-1 w-fit">
        {seenTabs.map(f => (
          <button key={f.key} onClick={() => setSeenFiltro(f.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${seenFiltro === f.key ? 'bg-accent text-white' : 'text-muted hover:text-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {statusTabs.map(f => {
          const sc = STATUS_COLORS[f.key];
          const isActive = statusFiltro === f.key;
          return (
            <button key={f.key} onClick={() => setStatusFiltro(f.key)}
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                border: isActive ? `1px solid ${sc?.color || 'var(--accent)'}` : '1px solid var(--border)',
                background: isActive ? (sc?.bg || 'rgba(99,102,241,0.15)') : 'transparent',
                color: isActive ? (sc?.color || 'var(--accent)') : 'var(--muted)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="flex justify-center py-12 text-muted text-sm gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            {t('common.loading', lang)}
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div className="card p-8 text-center text-muted text-sm">{t('alerts.empty', lang)}</div>
        )}
        {displayed.map(alert => {
          const tipo = ICONS[alert.type] || ICONS.default;
          const effectiveStatus = alert.status || 'pending';
          return (
            <div key={alert.id}
              className={`card border px-5 py-4 flex items-start gap-4 transition-opacity ${alert.seen ? 'opacity-60' : ''} ${tipo.bg}`}>
              <span className="text-xl flex-shrink-0 mt-0.5">{tipo.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${tipo.color}`}>{t(tipo.typeKey, lang)}</span>
                  {alert.contact_name && <span className="text-xs text-white font-medium">{alert.contact_name}</span>}
                  {alert.lead_id && <Link href={`/leads`} className="text-xs text-accent hover:underline">Lead #{alert.lead_id}</Link>}
                  <StatusBadge status={effectiveStatus} lang={lang} />
                </div>
                {alert.message && <p className="text-sm text-slate-300 mt-1">{alert.message}</p>}
                <p className="text-xs text-muted mt-1">{tiempoRelativo(alert.created_at, lang)}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <StatusDropdown alertId={alert.id} currentStatus={effectiveStatus} onChange={handleStatusChange} lang={lang} />
                <div className="flex gap-2">
                  {!alert.seen && (
                    <button onClick={() => marcarVisto(alert.id)} className="text-xs text-muted hover:text-white transition-colors">
                      {t('alerts.markSeen', lang)}
                    </button>
                  )}
                  <button onClick={() => dismiss(alert.id)} className="text-xs text-muted hover:text-red-400 transition-colors" title={t('alerts.hide', lang)}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
