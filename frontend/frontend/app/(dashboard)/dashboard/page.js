'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import Link from 'next/link';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Number(n).toLocaleString()}`;
}

function timeAgo(dateStr, lang) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('time.now', lang);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function WeatherWidget({ weather, isMobile }) {
  if (!weather) return <span style={{ fontSize: 11, color: 'var(--muted)' }}>🌤 …</span>;
  if (weather.error) return null;
  const icon = weather.weather?.[0]?.icon;
  const tempF = Math.round(weather.main?.temp || 0);
  const tempC = Math.round((tempF - 32) * 5 / 9);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon && <img src={`https://openweathermap.org/img/wn/${icon}.png`} alt="" width={22} height={22} />}
      <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: 'var(--text)' }}>{tempF}°F</span>
      {!isMobile && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{tempC}°C · San Juan PR</span>}
    </div>
  );
}

function StatCard({ label, value, icon, color, href, compact }) {
  const inner = (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: compact ? '8px 10px' : '10px 14px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <div>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {value ?? <span style={{ color: 'var(--muted)', fontSize: 14 }}>—</span>}
          </div>
          <div style={{ fontSize: compact ? 9 : 10, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
        </div>
        <span style={{ fontSize: compact ? 15 : 18, opacity: 0.6 }}>{icon}</span>
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link> : inner;
}

function MiniRow({ left, title, subtitle, right, rightColor, href }) {
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 4px', borderRadius: 5 }}>
      {left && <span style={{ fontSize: 13, flexShrink: 0 }}>{left}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      {right && <span style={{ fontSize: 10, color: rightColor || 'var(--muted)', flexShrink: 0 }}>{right}</span>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link> : inner;
}

function SectionCard({ title, icon, href, children, loading, viewLabel }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{icon} {title}</span>
        {href && <Link href={href} style={{ fontSize: 10, color: '#1b9af5', textDecoration: 'none' }}>{viewLabel || 'Ver →'}</Link>}
      </div>
      {loading
        ? <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 12, height: 12, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        : children}
    </div>
  );
}

export default function InicioPage() {
  const { lang } = useLang();
  const [weather, setWeather]           = useState(null);
  const [stats, setStats]               = useState(null);
  const [revenue, setRevenue]           = useState(null);
  const [recentLeads, setRecentLeads]   = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [recentCalls, setRecentCalls]   = useState([]);
  const [recentEmails, setRecentEmails] = useState([]);
  const [loadingLeads, setLoadingLeads]   = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingCalls, setLoadingCalls]   = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    api.weather().then(setWeather).catch(() => setWeather({ error: true }));
    api.stats().then(setStats).catch(() => {});
    api.analyticsRevenue(30).then(setRevenue).catch(() => {});
    api.leads('?limit=5').then(r => {
      setRecentLeads((Array.isArray(r) ? r : (r?.data || [])).slice(0, 5));
    }).catch(() => {}).finally(() => setLoadingLeads(false));
    api.alerts('?limit=5').then(r => {
      setRecentAlerts((Array.isArray(r) ? r : (r?.data || [])).slice(0, 5));
    }).catch(() => {}).finally(() => setLoadingAlerts(false));
    api.callLogs(null).then(r => {
      setRecentCalls((Array.isArray(r) ? r : (r?.data || [])).slice(0, 5));
    }).catch(() => {}).finally(() => setLoadingCalls(false));
    api.emails('?limit=5').then(r => {
      setRecentEmails((Array.isArray(r) ? r : (r?.data || [])).slice(0, 5));
    }).catch(() => {}).finally(() => setLoadingEmails(false));
  }, []);

  const alertIcon = type => ({ follow_up:'🔔', no_response:'💬', inactivity:'😴', birthday:'🎂' }[type] || '⚠️');
  const callIcon  = d => d === 'outbound' ? '📞' : '📲';
  const emailIcon = type => type === 'sent' ? '📤' : '📥';

  const now = new Date();
  const greeting = now.getHours() < 12
    ? t('dash.greet.morning', lang)
    : now.getHours() < 19
      ? t('dash.greet.afternoon', lang)
      : t('dash.greet.evening', lang);
  const dateLabel = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PR', { weekday: 'long', month: 'long', day: 'numeric' });

  const limit = isMobile ? 3 : 5;
  const pad   = isMobile ? '10px 12px' : '16px 24px';
  const gap   = isMobile ? 8 : 10;

  return (
    <div style={{ padding: pad, background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 8 : 12 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text)' }}>{greeting} 👋</span>
          {!isMobile && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 10, textTransform: 'capitalize' }}>{dateLabel}</span>}
        </div>
        <WeatherWidget weather={weather} isMobile={isMobile} />
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap, marginBottom: gap }}>
        <StatCard label={t('dash.stat.activeLeads', lang)}  value={stats?.leads}         icon="🎯" color="#1b9af5" href="/leads"    compact={isMobile} />
        <StatCard label={t('dash.stat.noResponse', lang)}   value={stats?.sin_respuesta} icon="💬" color={stats?.sin_respuesta > 0 ? '#ef4444' : '#6b7280'} href="/inbox" compact={isMobile} />
        <StatCard label={t('dash.stat.alerts', lang)}       value={recentAlerts.filter(a => a.status !== 'resolved').length || stats?.alertas_sin_ver} icon="🔔" color="#f59e0b" href="/alerts" compact={isMobile} />
        <StatCard label={t('dash.stat.revenue', lang)}      value={revenue ? fmt(revenue.mes_actual) : null} icon="💰" color="#10b981" href="/facturas" compact={isMobile} />
      </div>

      {/* ── SECCIONES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap, marginBottom: gap }}>

        <SectionCard title={t('dash.section.leads', lang)} icon="🎯" href="/leads" loading={loadingLeads} viewLabel={t('common.viewMore', lang)}>
          {recentLeads.slice(0, limit).map(lead => (
            <MiniRow key={lead.id}
              left="🎯"
              title={lead.title || lead.name || t('common.noName', lang)}
              subtitle={lead.contact_name || lead.stage_name || ''}
              right={timeAgo(lead.created_at, lang)}
              href={`/leads/${lead.id}`}
            />
          ))}
          {!loadingLeads && recentLeads.length === 0 && <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '3px 0' }}>{t('dash.empty.leads', lang)}</div>}
        </SectionCard>

        <SectionCard title={t('dash.section.alerts', lang)} icon="🔔" href="/alerts" loading={loadingAlerts} viewLabel={t('common.viewMore', lang)}>
          {recentAlerts.slice(0, limit).map(alert => (
            <MiniRow key={alert.id}
              left={alertIcon(alert.type)}
              title={alert.title || alert.message || 'Alerta'}
              subtitle={alert.lead_name || alert.contact_name || ''}
              right={timeAgo(alert.created_at, lang)}
              rightColor={alert.status === 'resolved' ? '#10b981' : '#f59e0b'}
              href={alert.lead_id ? `/leads/${alert.lead_id}` : '/alerts'}
            />
          ))}
          {!loadingAlerts && recentAlerts.length === 0 && <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '3px 0' }}>{t('dash.empty.alerts', lang)}</div>}
        </SectionCard>

        <SectionCard title={t('dash.section.calls', lang)} icon="📞" href="/llamadas" loading={loadingCalls} viewLabel={t('common.viewMore', lang)}>
          {recentCalls.slice(0, limit).map(call => (
            <MiniRow key={call.id}
              left={callIcon(call.direction)}
              title={call.lead_name || call.to_number || call.from_number || t('common.unknown', lang)}
              subtitle={`${call.direction === 'outbound' ? t('dash.outbound', lang) : t('dash.inbound', lang)}${call.duration_seconds ? ` · ${Math.floor(call.duration_seconds/60)}m${call.duration_seconds%60}s` : ''}`}
              right={timeAgo(call.created_at, lang)}
              href={call.lead_id ? `/leads/${call.lead_id}` : '/llamadas'}
            />
          ))}
          {!loadingCalls && recentCalls.length === 0 && <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '3px 0' }}>{t('dash.empty.calls', lang)}</div>}
        </SectionCard>

        <SectionCard title={t('dash.section.emails', lang)} icon="📧" href="/email" loading={loadingEmails} viewLabel={t('common.viewMore', lang)}>
          {recentEmails.slice(0, limit).map(email => (
            <MiniRow key={email.id}
              left={emailIcon(email.direction || email.type)}
              title={email.subject || t('dash.noSubject', lang)}
              subtitle={email.from_email || email.to_email || ''}
              right={timeAgo(email.created_at || email.sent_at, lang)}
              href={email.lead_id ? `/leads/${email.lead_id}` : '/email'}
            />
          ))}
          {!loadingEmails && recentEmails.length === 0 && <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '3px 0' }}>{t('dash.empty.emails', lang)}</div>}
        </SectionCard>

      </div>

      {/* ── Métricas ── */}
      <div style={{ textAlign: 'center' }}>
        <Link href="/metricas" style={{
          fontSize: isMobile ? 11 : 12, color: '#1b9af5', textDecoration: 'none',
          padding: isMobile ? '5px 14px' : '6px 16px', borderRadius: 8,
          border: '1px solid rgba(59,130,246,0.25)',
          background: 'rgba(59,130,246,0.08)',
        }}>
          {t('dash.metrics', lang)}
        </Link>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
