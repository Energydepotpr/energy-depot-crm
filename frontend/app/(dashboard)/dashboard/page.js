'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import Link from 'next/link';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';

const NAVY = '#1a3c8f';
const NAVY_DARK = '#0f2a5c';
const CYAN = '#67e8f9';
const GREEN = '#10b981';
const ORANGE = '#f59e0b';
const RED = '#ef4444';

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

// ─── ICONS ───
const Icon = {
  target: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  chat: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  bell: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  dollar: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  phone: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  mail: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  user: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  arrow: (c) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  trendUp: (c) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  inbox: (c) => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  sun: (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
};

// ─── STAGE COLORS ───
const stageColor = (name) => {
  if (!name) return { bg: 'rgba(107,114,128,0.12)', fg: '#6b7280' };
  const n = name.toLowerCase();
  if (n.includes('lead') || n.includes('nuevo')) return { bg: 'rgba(26,60,143,0.10)', fg: NAVY };
  if (n.includes('contact')) return { bg: 'rgba(103,232,249,0.18)', fg: '#0891b2' };
  if (n.includes('cotiz')) return { bg: 'rgba(245,158,11,0.12)', fg: ORANGE };
  if (n.includes('financ')) return { bg: 'rgba(139,92,246,0.12)', fg: '#8b5cf6' };
  if (n.includes('permis') || n.includes('luma')) return { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' };
  if (n.includes('instal')) return { bg: 'rgba(16,185,129,0.12)', fg: GREEN };
  if (n.includes('complet') || n.includes('cerrad')) return { bg: 'rgba(16,185,129,0.18)', fg: '#059669' };
  return { bg: 'rgba(107,114,128,0.12)', fg: '#6b7280' };
};

function StageBadge({ name }) {
  if (!name) return null;
  const c = stageColor(name);
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 600,
      padding: '3px 8px', borderRadius: 999,
      background: c.bg, color: c.fg, whiteSpace: 'nowrap',
    }}>{name}</span>
  );
}

// ─── METRIC CARD ───
function MetricCard({ label, value, icon, color, href, trend }) {
  const card = (
    <div
      className="metric-card"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 18,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        transition: 'transform .18s ease, box-shadow .18s ease',
        height: '100%',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `${color}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon(color)}
        </div>
        {trend != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 600, color: GREEN,
            background: 'rgba(16,185,129,0.10)', padding: '3px 8px', borderRadius: 999,
          }}>
            {Icon.trendUp(GREEN)} {trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {value ?? <span style={{ color: 'var(--muted)', fontSize: 18 }}>—</span>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link> : card;
}

// ─── SECTION ───
function Section({ title, icon, href, children, loading, viewLabel }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `${NAVY}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{icon}</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
        </div>
        {href && (
          <Link href={href} style={{
            fontSize: 11, color: NAVY, textDecoration: 'none', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {viewLabel || 'Ver'} {Icon.arrow(NAVY)}
          </Link>
        )}
      </div>
      {loading ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 22, height: 22, border: `2px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '28px 12px', gap: 10,
    }}>
      <div style={{ opacity: 0.35 }}>{Icon.inbox('var(--muted)')}</div>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{text}</span>
    </div>
  );
}

function LeadRow({ lead, lang }) {
  return (
    <Link href={`/leads/${lead.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="row-hover" style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px',
        borderRadius: 8, transition: 'background .15s ease',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {(lead.title || lead.name || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.title || lead.name || t('common.noName', lang)}
          </div>
          <div style={{ marginTop: 3 }}>
            {lead.stage_name ? <StageBadge name={lead.stage_name} /> : (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{lead.contact_name || ''}</span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{timeAgo(lead.created_at, lang)}</span>
      </div>
    </Link>
  );
}

function AlertRow({ alert, lang }) {
  const resolved = alert.status === 'resolved';
  const color = resolved ? GREEN : ORANGE;
  return (
    <Link href={alert.lead_id ? `/leads/${alert.lead_id}` : '/alerts'} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="row-hover" style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px',
        borderRadius: 8, transition: 'background .15s ease',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {Icon.bell(color)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alert.title || alert.message || 'Alerta'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alert.lead_name || alert.contact_name || ''}
          </div>
        </div>
        <span style={{ fontSize: 11, color, flexShrink: 0, fontWeight: 600 }}>{timeAgo(alert.created_at, lang)}</span>
      </div>
    </Link>
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
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 720);
    check();
    window.addEventListener('resize', check);
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      if (u?.name) setUserName(u.name.split(' ')[0]);
      else if (u?.email) setUserName(u.email.split('@')[0]);
    } catch {}
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

  const now = new Date();
  const greeting = now.getHours() < 12
    ? t('dash.greet.morning', lang)
    : now.getHours() < 19
      ? t('dash.greet.afternoon', lang)
      : t('dash.greet.evening', lang);
  const dateLabel = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PR', { weekday: 'long', month: 'long', day: 'numeric' });

  const tempF = weather && !weather.error ? Math.round(weather.main?.temp || 0) : null;

  const cotizacionLeads = recentLeads.filter(l => (l.stage_name || '').toLowerCase().includes('cotiz')).length;
  const activeAlerts = recentAlerts.filter(a => a.status !== 'resolved').length || stats?.alertas_sin_ver;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100%' }}>

      {/* ── HERO HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
        padding: isMobile ? '24px 18px 56px' : '32px 32px 72px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -60, top: -60, width: 240, height: 240,
          background: `radial-gradient(circle, ${CYAN}33 0%, transparent 70%)`,
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: CYAN, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Energy Depot CRM
            </div>
            <h1 style={{
              margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#fff',
              letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              {greeting}{userName ? `, ${userName}` : ''}
            </h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6, textTransform: 'capitalize' }}>
              {dateLabel}
            </div>
          </div>
          {tempF != null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '10px 14px', borderRadius: 12,
            }}>
              {Icon.sun(CYAN)}
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{tempF}°F</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>San Juan, PR</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{
        padding: isMobile ? '0 14px 32px' : '0 32px 40px',
        marginTop: isMobile ? -40 : -52,
        position: 'relative',
      }}>

        {/* ── METRICS ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16, marginBottom: 22,
        }}>
          <MetricCard
            label={t('dash.stat.activeLeads', lang)}
            value={stats?.leads}
            icon={Icon.target}
            color={NAVY}
            href="/leads"
          />
          <MetricCard
            label="En cotización"
            value={cotizacionLeads || stats?.en_cotizacion}
            icon={Icon.dollar}
            color={ORANGE}
            href="/leads"
          />
          <MetricCard
            label={t('dash.stat.alerts', lang)}
            value={activeAlerts}
            icon={Icon.bell}
            color={activeAlerts > 0 ? RED : '#6b7280'}
            href="/alerts"
          />
          <MetricCard
            label={t('dash.stat.revenue', lang)}
            value={revenue ? fmt(revenue.mes_actual) : null}
            icon={Icon.dollar}
            color={GREEN}
            href="/facturas"
          />
        </div>

        {/* ── 2-COL SECTIONS ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16, marginBottom: 16,
        }}>
          <Section
            title={t('dash.section.leads', lang)}
            icon={Icon.target(NAVY)}
            href="/leads"
            loading={loadingLeads}
            viewLabel={t('common.viewMore', lang)}
          >
            {recentLeads.length === 0 && !loadingLeads
              ? <EmptyState text={t('dash.empty.leads', lang)} />
              : recentLeads.slice(0, 5).map(lead => <LeadRow key={lead.id} lead={lead} lang={lang} />)
            }
          </Section>

          <Section
            title={t('dash.section.alerts', lang)}
            icon={Icon.bell(NAVY)}
            href="/alerts"
            loading={loadingAlerts}
            viewLabel={t('common.viewMore', lang)}
          >
            {recentAlerts.length === 0 && !loadingAlerts
              ? <EmptyState text={t('dash.empty.alerts', lang)} />
              : recentAlerts.slice(0, 5).map(alert => <AlertRow key={alert.id} alert={alert} lang={lang} />)
            }
          </Section>
        </div>

        {/* ── ACTIVITY ROW ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16, marginBottom: 22,
        }}>
          <Section
            title={t('dash.section.calls', lang)}
            icon={Icon.phone(NAVY)}
            href="/llamadas"
            loading={loadingCalls}
            viewLabel={t('common.viewMore', lang)}
          >
            {recentCalls.length === 0 && !loadingCalls
              ? <EmptyState text={t('dash.empty.calls', lang)} />
              : recentCalls.slice(0, 4).map(call => (
                <Link key={call.id} href={call.lead_id ? `/leads/${call.lead_id}` : '/llamadas'} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${NAVY}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {Icon.phone(NAVY)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {call.lead_name || call.to_number || call.from_number || t('common.unknown', lang)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {call.direction === 'outbound' ? t('dash.outbound', lang) : t('dash.inbound', lang)}
                        {call.duration_seconds ? ` · ${Math.floor(call.duration_seconds/60)}m${call.duration_seconds%60}s` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(call.created_at, lang)}</span>
                  </div>
                </Link>
              ))
            }
          </Section>

          <Section
            title={t('dash.section.emails', lang)}
            icon={Icon.mail(NAVY)}
            href="/email"
            loading={loadingEmails}
            viewLabel={t('common.viewMore', lang)}
          >
            {recentEmails.length === 0 && !loadingEmails
              ? <EmptyState text={t('dash.empty.emails', lang)} />
              : recentEmails.slice(0, 4).map(email => (
                <Link key={email.id} href={email.lead_id ? `/leads/${email.lead_id}` : '/email'} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${NAVY}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {Icon.mail(NAVY)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.subject || t('dash.noSubject', lang)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.from_email || email.to_email || ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(email.created_at || email.sent_at, lang)}</span>
                  </div>
                </Link>
              ))
            }
          </Section>
        </div>

        {/* ── METRICS LINK ── */}
        <div style={{ textAlign: 'center' }}>
          <Link href="/metricas" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 600, color: NAVY, textDecoration: 'none',
            padding: '10px 22px', borderRadius: 999,
            border: `1px solid ${NAVY}33`,
            background: `${NAVY}0d`,
            transition: 'background .15s ease',
          }}>
            {t('dash.metrics', lang)} {Icon.arrow(NAVY)}
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26,60,143,0.12) !important; }
        .row-hover:hover { background: rgba(26,60,143,0.05); }
      `}</style>
    </div>
  );
}
