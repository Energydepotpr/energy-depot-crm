'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';

const NAVY = '#1a3c8f';
const NAVY_DARK = '#0f2a5c';
const CYAN = '#67e8f9';
const GREEN = '#10b981';
const ORANGE = '#f59e0b';
const RED = '#ef4444';
const PURPLE = '#8b5cf6';

const CURRENCY = new Intl.NumberFormat('es-PR', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const fmt$ = (n) => CURRENCY.format(Number(n) || 0);
const fmtN = (n) => new Intl.NumberFormat('es-PR').format(Number(n) || 0);

const PERIODS = [
  { key: 'mes', label: 'Mes actual' },
  { key: '60',  label: '60 días' },
  { key: '90',  label: '90 días' },
  { key: '180', label: '6 meses' },
  { key: '365', label: '1 año' },
  { key: 'custom', label: 'Personalizado' },
];

const SOURCE_LABELS = {
  'autocotizar-web': 'Auto-cotizador web',
  'web-form':        'Formulario web',
  'leadsgogo':       'Leadgogo',
  'leadgogo':        'Leadgogo',
  'perfex':          'Perfex / WordPress',
  'manual':          'Creado manual',
  'twilio':          'SMS entrante',
  'sms':             'SMS',
};

// ─── ICONS ───
const I = {
  users: (c, s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  dollar: (c, s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  bank: (c, s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21V13h6v8"/></svg>,
  check: (c, s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  clock: (c, s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  up: (c) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  down: (c) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
};

function Delta({ value }) {
  if (value == null) return null;
  const positive = value >= 0;
  const color = positive ? GREEN : RED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 700, color,
      background: positive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      padding: '3px 8px', borderRadius: 999,
    }}>
      {positive ? I.up(color) : I.down(color)}{Math.abs(value)}%
    </span>
  );
}

function KpiCard({ label, value, monto, delta, icon, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon(color)}
        </div>
        <Delta value={delta} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {value != null ? fmtN(value) : '—'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      {monto != null && monto > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', fontSize: 14, fontWeight: 700, color: color }}>
          {fmt$(monto)}
        </div>
      )}
    </div>
  );
}

function Funnel({ funnel, conversions }) {
  if (!funnel?.length) return null;
  const max = Math.max(1, ...funnel.map(f => f.count));
  const colors = [NAVY, ORANGE, PURPLE, GREEN];
  const conv = [
    null,
    conversions?.leadToCotiz,
    conversions?.cotizToFin,
    conversions?.finToVenta,
  ];
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Funnel de conversión
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {funnel.map((f, i) => {
          const pct = (f.count / max) * 100;
          return (
            <div key={f.name}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.name}</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {conv[i] != null && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>
                      conv. {conv[i]}%
                    </span>
                  )}
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtN(f.count)}</span>
                  {f.monto > 0 && <span style={{ color: colors[i], fontWeight: 600 }}>{fmt$(f.monto)}</span>}
                </span>
              </div>
              <div style={{ height: 10, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(2, pct)}%`, height: '100%',
                  background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}cc)`,
                  borderRadius: 6,
                  transition: 'width .4s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TtfcBar({ minutes }) {
  if (minutes == null) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Tiempo al primer contacto
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sin datos suficientes</div>
      </div>
    );
  }
  const color = minutes < 5 ? GREEN : minutes < 30 ? ORANGE : RED;
  const label = minutes < 60 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} h`;
  // Bar: 0..60 min mapping
  const pct = Math.min(100, (minutes / 60) * 100);
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Tiempo promedio al 1er contacto
        </div>
        {I.clock(color)}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{label}</div>
      <div style={{ marginTop: 10, height: 8, background: 'var(--border)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
        <span>Meta: &lt;5 min</span>
        <span>30 min</span>
        <span>60 min+</span>
      </div>
    </div>
  );
}

function BySource({ bySource }) {
  if (!bySource?.length) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Leads por canal</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sin datos</div>
      </div>
    );
  }
  const max = Math.max(1, ...bySource.map(b => b.n));
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Leads por canal
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bySource.map(b => (
          <div key={b.source}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {SOURCE_LABELS[b.source] || b.source}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtN(b.n)}</span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${(b.n / max) * 100}%`, height: '100%',
                background: `linear-gradient(90deg, ${NAVY}, ${CYAN})`,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendientesTable({ pendientes }) {
  if (!pendientes?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Top leads sin respuesta
        </div>
        <Link href="/leads" style={{ fontSize: 11, color: NAVY, fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pendientes.map(p => {
          const dias = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
          return (
            <Link key={p.id} href={`/leads/${p.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 8px', borderRadius: 8,
                transition: 'background .15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,60,143,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {(p.contact_name || p.title || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.contact_name || p.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {p.stage_name || '—'} · {p.phone || p.email || 'sin contacto'}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: dias > 3 ? RED : ORANGE }}>
                  {dias === 0 ? 'hoy' : `${dias}d`}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAGE ───
export default function DashboardPage() {
  const [period, setPeriod] = useState('mes');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 720);
      setIsNarrow(window.innerWidth < 480);
    };
    check();
    window.addEventListener('resize', check);
    try {
      const u = JSON.parse(localStorage.getItem('crm_user') || localStorage.getItem('user') || 'null');
      if (u?.name) setUserName(u.name.split(' ')[0]);
      else if (u?.email) setUserName(u.email.split('@')[0]);
    } catch {}
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setLoading(true);
    let qs = `?period=${period}`;
    if (period === 'custom' && customFrom) {
      qs += `&from=${encodeURIComponent(customFrom)}`;
      if (customTo) qs += `&to=${encodeURIComponent(customTo)}`;
    }
    api.statsOverview(qs)
      .then(setData)
      .catch(e => setData({ error: e.message }))
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Buenos días'
                 : now.getHours() < 19 ? 'Buenas tardes'
                 : 'Buenas noches';

  const isEmpty = !loading && data && !data.error &&
                  (data.kpis?.leads?.count || 0) === 0 &&
                  (data.kpis?.cotizaciones?.count || 0) === 0;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100%' }}>
      {/* HERO */}
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
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, color: CYAN, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Energy Depot CRM · Executive Dashboard
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            {greeting}{userName ? `, ${userName}` : ''}
          </h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
            Cómo va el negocio hoy
          </div>

          {/* Period selector - scrollable horizontally on mobile */}
          <div style={{
            marginTop: 18,
            display: 'flex',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            gap: 8,
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? 4 : 0,
            marginLeft: isMobile ? -4 : 0,
            marginRight: isMobile ? -4 : 0,
            paddingLeft: isMobile ? 4 : 0,
            paddingRight: isMobile ? 4 : 0,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}>
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: '8px 14px', borderRadius: 999,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (period === p.key ? CYAN : 'rgba(255,255,255,0.25)'),
                  background: period === p.key ? CYAN : 'rgba(255,255,255,0.10)',
                  color: period === p.key ? NAVY_DARK : '#fff',
                  transition: 'all .15s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minHeight: 36,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ flex: isMobile ? '1 1 45%' : '0 0 auto', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.10)', color: '#fff', fontSize: 14, minHeight: 36 }} />
              <span style={{ color: '#fff', fontSize: 12 }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ flex: isMobile ? '1 1 45%' : '0 0 auto', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.10)', color: '#fff', fontSize: 14, minHeight: 36 }} />
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{
        padding: isMobile ? '0 14px 40px' : '0 32px 48px',
        marginTop: isMobile ? -40 : -52,
        position: 'relative',
      }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && data?.error && !data.kpis && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: RED, fontWeight: 600 }}>Error: {data.error}</div>
          </div>
        )}

        {!loading && isEmpty && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 40, textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Sin datos en este período
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Prueba un período más amplio para ver actividad.
            </div>
            <button onClick={() => setPeriod('365')} style={{
              padding: '10px 22px', borderRadius: 999,
              border: 'none', background: NAVY, color: '#fff',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              Ver último año
            </button>
          </div>
        )}

        {!loading && data?.kpis && !isEmpty && (
          <>
            {/* KPI CARDS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: 14, marginBottom: 18,
            }}>
              <KpiCard label="Leads reales"
                       value={data.kpis.leads.count}
                       delta={data.kpis.leads.delta}
                       icon={I.users} color={NAVY} />
              <KpiCard label="Cotizaciones"
                       value={data.kpis.cotizaciones.count}
                       monto={data.kpis.cotizaciones.monto}
                       delta={data.kpis.cotizaciones.delta}
                       icon={I.dollar} color={ORANGE} />
              <KpiCard label="Financiamiento"
                       value={data.kpis.financiamiento.count}
                       monto={data.kpis.financiamiento.monto}
                       delta={data.kpis.financiamiento.delta}
                       icon={I.bank} color={PURPLE} />
              <KpiCard label="Ventas cerradas"
                       value={data.kpis.ventas.count}
                       monto={data.kpis.ventas.monto}
                       delta={data.kpis.ventas.delta}
                       icon={I.check} color={GREEN} />
            </div>

            {/* FUNNEL + TTFC */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
              gap: 14, marginBottom: 18,
            }}>
              <Funnel funnel={data.funnel} conversions={data.conversions} />
              <TtfcBar minutes={data.timeToFirstContactMin} />
            </div>

            {/* SOURCE + PENDIENTES */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 14, marginBottom: 18,
            }}>
              <BySource bySource={data.bySource} />
              <PendientesTable pendientes={data.pendientes} />
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
              Datos del {data.range?.from ? new Date(data.range.from).toLocaleDateString('es-PR') : '—'} al {data.range?.to ? new Date(data.range.to).toLocaleDateString('es-PR') : '—'}
              {data.error && <span style={{ color: RED, marginLeft: 10 }}>· {data.error}</span>}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
