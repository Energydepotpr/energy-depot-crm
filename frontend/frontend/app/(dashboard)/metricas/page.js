'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import Link from 'next/link';

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
      <div style={{
        width: 20, height: 20, border: '2px solid #1b9af5',
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  );
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Number(n).toLocaleString()}`;
}

function RevenueBarChart({ data }) {
  if (!data?.length) return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
      Sin datos de ingresos
    </div>
  );
  const max = Math.max(...data.map(d => d.ingresos), 1);
  const W = 400, H = 120, barW = 40;
  const gap = (W - barW * data.length) / (data.length + 1);
  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} style={{ width: '100%', height: 148 }}>
      {data.map((d, i) => {
        const barH = Math.max((d.ingresos / max) * H, 2);
        const x = gap + i * (barW + gap);
        const y = H - barH;
        return (
          <g key={d.mes}>
            <rect x={x} y={y} width={barW} height={barH} rx={4}
              fill={i === data.length - 1 ? '#1b9af5' : '#1b9af540'} />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle"
              style={{ fontSize: 9, fill: 'var(--muted)', fontFamily: 'inherit' }}>
              {d.ingresos > 0 ? fmt(d.ingresos) : ''}
            </text>
            <text x={x + barW / 2} y={H + 16} textAnchor="middle"
              style={{ fontSize: 9, fill: 'var(--muted)', fontFamily: 'inherit' }}>
              {d.mes_label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function FunnelBar({ etapa, color, total, pct, conversion, isFirst }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: color || '#1b9af5', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {etapa}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{total}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
        {!isFirst && (
          <span style={{ fontSize: 10, color: '#00c9a7', flexShrink: 0, minWidth: 52, textAlign: 'right' }}>
            ↓ {conversion}%
          </span>
        )}
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.max(pct, 1)}%`,
          background: color || '#1b9af5',
          borderRadius: 99,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function ProgressBar({ pct }) {
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 600, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function MsgBarChart({ data, colorKey, color, height = 80 }) {
  if (!data?.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>Sin datos</div>;
  const max = Math.max(...data.map(d => Number(d[colorKey]) || 0), 1);
  const last14 = data.slice(-14);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {last14.map((d, i) => {
        const val = Number(d[colorKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} title={`${d.fecha?.slice(5)}: ${val}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', borderRadius: 2, height: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ data }) {
  if (!data?.length) return <div style={{ height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>Sin datos</div>;
  const total = data.reduce((s, d) => s + Number(d.total), 0) || 1;
  let offset = 0;
  const r = 40, cx = 50, cy = 50, circumference = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, flexShrink: 0, transform: 'rotate(-90deg)' }}>
        {data.map((d, i) => {
          const pct = Number(d.total) / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color || '#1b9af5'} strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circumference}
            />
          );
          offset += pct;
          return el;
        })}
        <circle cx={cx} cy={cy} r={r - 9} style={{ fill: 'var(--surface)' }} />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        {data.map(d => (
          <div key={d.etapa} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: d.color || '#1b9af5' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.etapa}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{d.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPICard({ label, value, href, borderColor, suffix, badge, badgeColor, isMobile }) {
  const inner = (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: isMobile ? '12px 14px' : '18px 22px',
      borderLeft: `4px solid ${borderColor}`, cursor: href ? 'pointer' : 'default',
      transition: 'background 0.18s', height: '100%', boxSizing: 'border-box',
    }}
      onMouseEnter={e => { if (href) e.currentTarget.style.background = 'var(--surface2)'; }}
      onMouseLeave={e => { if (href) e.currentTarget.style.background = 'var(--surface)'; }}
    >
      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
        {value != null
          ? <>{value}{suffix && <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 2 }}>{suffix}</span>}</>
          : <span style={{ color: 'var(--muted)', fontSize: 18 }}>—</span>
        }
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
        {badge != null && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
            background: `${badgeColor || '#10b981'}22`, color: badgeColor || '#10b981',
          }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link> : inner;
}

export default function MetricasPage() {
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [winRate, setWinRate] = useState(null);
  const [topLeads, setTopLeads] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [goals, setGoals] = useState([]);
  const [dias, setDias] = useState(30);
  const [descargando, setDescargando] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, f, rev, wr, tl, ag, gl] = await Promise.all([
        api.stats().catch(() => null),
        api.analyticsFunnel().catch(() => []),
        api.analyticsRevenue(dias).catch(() => null),
        api.analyticsWinRate(dias).catch(() => null),
        api.analyticsTopLeads().catch(() => []),
        api.analyticsAgents(dias).catch(() => []),
        api.goals().catch(() => []),
      ]);
      setStats(s);
      setFunnel(Array.isArray(f) ? f : []);
      setRevenue(rev);
      setWinRate(wr);
      setTopLeads(Array.isArray(tl) ? tl : []);
      setAgentes(Array.isArray(ag) ? ag : []);
      setGoals(Array.isArray(gl) ? gl : []);
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    api.statsChart(dias).then(setChart).catch(() => {});
  }, [dias]);

  async function handleDescargarReporte() {
    setDescargando(true);
    try {
      const blob = await api.downloadReport(dias);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-crm-${dias}d-${Date.now()}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); } finally { setDescargando(false); }
  }

  const goalsByAgent = {};
  goals.forEach(g => {
    if (!goalsByAgent[g.agent_id]) goalsByAgent[g.agent_id] = {};
    goalsByAgent[g.agent_id][g.goal_type] = g;
  });

  const card = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: isMobile ? '14px' : '20px 24px',
  };
  const sectionTitle = { fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 };
  const sectionSub   = { fontSize: 12, color: 'var(--muted)', marginBottom: 16 };

  return (
    <div style={{ padding: isMobile ? '12px' : '24px 32px', background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--accent)', border: '1px solid var(--border)',
        borderRadius: 14, padding: isMobile ? '16px' : '24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Métricas</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            Análisis de rendimiento y métricas del negocio
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDias(d)} style={{
                padding: '5px 11px', borderRadius: 6, fontSize: 12,
                fontWeight: dias === d ? 600 : 400,
                background: dias === d ? '#1b9af5' : 'transparent',
                color: dias === d ? '#fff' : 'var(--muted)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>{d}d</button>
            ))}
          </div>
          <Link href="/metas" style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
            border: '1px solid rgba(139,92,246,0.3)', textDecoration: 'none',
          }}>
            Ver Metas
          </Link>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(6,1fr)',
        gap: isMobile ? 10 : 14,
        marginBottom: 20,
      }}>
        <KPICard label="Leads activos"   value={stats?.leads}        href="/leads"    borderColor="#1b9af5" isMobile={isMobile} />
        <KPICard label="Contactos"       value={stats?.contactos}    href="/contacts" borderColor="#00c9a7" isMobile={isMobile} />
        <KPICard label="Mensajes"        value={stats?.mensajes}     href="/inbox"    borderColor="#8b5cf6" isMobile={isMobile} />
        <KPICard
          label="Ingresos del mes"
          value={revenue ? fmt(revenue.mes_actual) : null}
          href="/facturas"
          borderColor="#10b981"
          badge={revenue?.variacion_pct != null
            ? `${revenue.variacion_pct > 0 ? '+' : ''}${revenue.variacion_pct}%`
            : null}
          badgeColor={revenue?.variacion_pct >= 0 ? '#10b981' : '#ef4444'}
          isMobile={isMobile}
        />
        <KPICard
          label="Win Rate"
          value={winRate ? winRate.win_rate_pct : null}
          suffix="%"
          borderColor="#f59e0b"
          isMobile={isMobile}
        />
        <KPICard
          label="Sin respuesta"
          value={stats?.sin_respuesta}
          href="/inbox"
          borderColor={stats?.sin_respuesta > 0 ? '#ef4444' : '#6b7280'}
          isMobile={isMobile}
        />
      </div>

      {/* ── FUNNEL ─────────────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ ...sectionTitle }}>Funnel de conversión</div>
        <div style={{ ...sectionSub }}>Leads activos por etapa del pipeline</div>
        {loading ? <Spinner /> : funnel.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
            No hay etapas configuradas
          </div>
        ) : (
          <>
            {funnel.map((stage, i) => (
              <FunnelBar
                key={stage.id}
                etapa={stage.etapa}
                color={stage.color}
                total={stage.total}
                pct={stage.pct_del_total}
                conversion={stage.conversion_desde_anterior}
                isFirst={i === 0}
              />
            ))}
            {winRate && (
              <div style={{
                display: 'flex', gap: isMobile ? 16 : 32, marginTop: 20,
                paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap',
              }}>
                {[
                  { label: 'Leads ganados',     value: winRate.ganados,                        color: '#10b981' },
                  { label: 'Leads perdidos',    value: winRate.perdidos,                       color: '#ef4444' },
                  { label: 'Win Rate',          value: `${winRate.win_rate_pct}%`,             color: '#1b9af5' },
                  { label: 'Días prom. cierre', value: winRate.dias_promedio_cierre ?? '—',    color: 'var(--muted)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Ingresos + Top Leads ────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? 12 : 20, marginBottom: 20,
      }}>
        <div style={{ ...card }}>
          <div style={{ ...sectionTitle }}>Ingresos por mes</div>
          <div style={{ ...sectionSub }}>Últimos 6 meses</div>
          {revenue ? (
            <>
              <RevenueBarChart data={revenue.por_mes} />
              <div style={{ display: 'flex', gap: 24, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Este mes',     value: fmt(revenue.mes_actual),    color: 'var(--text)' },
                  { label: 'Mes anterior', value: fmt(revenue.mes_anterior),  color: 'var(--muted)' },
                  { label: 'Variación',
                    value: `${revenue.variacion_pct > 0 ? '+' : ''}${revenue.variacion_pct}%`,
                    color: revenue.variacion_pct >= 0 ? '#10b981' : '#ef4444',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <Spinner />}
        </div>

        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ ...sectionTitle, marginBottom: 0 }}>Top Leads por valor</div>
            <Link href="/leads" style={{ fontSize: 12, color: '#1b9af5', textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          <div style={{ ...sectionSub }}>Leads con mayor valor en pipeline</div>
          {loading ? <Spinner /> : topLeads.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
              No hay leads con valor asignado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 280, overflowY: 'auto' }}>
              {topLeads.slice(0, 8).map((lead, i) => (
                <div key={lead.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', flexShrink: 0, minWidth: 18 }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{lead.contacto || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{fmt(lead.value)}</div>
                    {lead.etapa && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                        background: `${lead.etapa_color || '#1b9af5'}22`,
                        color: lead.etapa_color || '#1b9af5',
                      }}>
                        {lead.etapa}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Performance de agentes ──────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ ...sectionTitle, marginBottom: 0 }}>Performance del equipo</div>
          <Link href="/metas" style={{ fontSize: 12, color: '#8b5cf6', textDecoration: 'none' }}>Gestionar metas →</Link>
        </div>
        <div style={{ ...sectionSub }}>Últimos {dias} días</div>
        {loading ? <Spinner /> : agentes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Sin datos</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Agente', 'Leads asig.', 'Mensajes', 'Ganados', 'Ingresos', 'Meta ingresos'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentes.map((a, i) => {
                  const agGoals = goalsByAgent[a.id] || {};
                  const metaRev = agGoals.revenue;
                  const pctRev = metaRev
                    ? Math.min(Math.round((a.ingresos / Number(metaRev.target_value)) * 100), 100)
                    : null;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}>{medals[i] || '👤'}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{a.role}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{a.leads_asignados}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{a.mensajes_enviados}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 700, color: '#10b981' }}>{a.leads_ganados}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 700, color: a.ingresos > 0 ? '#10b981' : 'var(--muted)' }}>
                          {fmt(a.ingresos)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', minWidth: 150 }}>
                        {metaRev ? (
                          <div>
                            <ProgressBar pct={pctRev} />
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                              {fmt(a.ingresos)} / {fmt(Number(metaRev.target_value))}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sin meta</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Mensajes + Leads etapa + Acciones ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? 12 : 20 }}>
        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ ...sectionTitle, marginBottom: 0 }}>Actividad de mensajes</div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {[
              { key: 'entrantes', color: '#1b9af5', label: 'Entrantes' },
              { key: 'salientes', color: '#00c9a7', label: 'Salientes' },
            ].map(({ key, color, label }) => (
              <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
          {chart ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MsgBarChart data={chart.mensajes_dia} colorKey="entrantes" color="#1b9af5" height={80} />
              <MsgBarChart data={chart.mensajes_dia} colorKey="salientes" color="#00c9a7" height={50} />
            </div>
          ) : <Spinner />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card }}>
            <div style={{ ...sectionTitle }}>Leads por etapa</div>
            {chart ? <DonutChart data={chart.leads_por_etapa} /> : <Spinner />}
          </div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...sectionTitle }}>Acciones rápidas</div>
            <button onClick={handleDescargarReporte} disabled={descargando} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '9px 0', borderRadius: 8, border: 'none',
              cursor: descargando ? 'not-allowed' : 'pointer',
              background: descargando ? 'rgba(59,130,246,0.4)' : '#1b9af5',
              color: '#fff', fontSize: 13, fontWeight: 600,
              opacity: descargando ? 0.7 : 1, width: '100%',
            }}>
              {descargando
                ? <><span style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Generando...</>
                : 'Descargar Reporte PDF'
              }
            </button>
            <Link href="/leads" style={{
              display: 'block', textAlign: 'center', padding: '9px 0', borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}>
              Ver pipeline completo
            </Link>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
