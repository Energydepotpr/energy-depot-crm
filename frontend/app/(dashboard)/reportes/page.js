'use client';
import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : '/backend'
    : '';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('crm_token') || '';
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

function money(v) {
  return `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-PR', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// Expand sparse month array to all 12 months for a given year
function fillMonths(rows, year) {
  const map = {};
  (rows || []).forEach(r => { map[r.month] = r; });
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const key = `${year}-${m}`;
    return map[key] || { month: key, total: 0, count: 0 };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div style={{
        width: 28, height: 28,
        border: '3px solid #1877f240',
        borderTop: '3px solid #1877f2',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--surface, #1e293b)',
      border: '1px solid var(--border, #334155)',
      borderRadius: 12,
      padding: '20px 22px',
      flex: '1 1 180px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent || 'var(--text, #f1f5f9)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function BarChart({ bars, maxVal }) {
  if (!bars || bars.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, padding: '0 4px', overflowX: 'auto' }}>
      {bars.map(b => (
        <div
          key={b.label}
          style={{ flex: '1 1 0', minWidth: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
        >
          <div style={{ fontSize: 9, color: '#64748b', whiteSpace: 'nowrap' }}>
            {b.value > 0 ? `$${(b.value / 1000).toFixed(1)}k` : ''}
          </div>
          <div
            title={`${b.label}: ${money(b.value)}`}
            style={{
              width: '100%',
              background: b.value > 0 ? '#1877f2' : '#334155',
              borderRadius: '4px 4px 0 0',
              height: maxVal > 0 ? `${Math.max((b.value / maxVal) * 120, b.value > 0 ? 4 : 2)}px` : '2px',
              minHeight: 2,
              transition: 'height 0.4s ease',
              cursor: 'default',
            }}
          />
          <div style={{
            fontSize: 9,
            color: '#94a3b8',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            maxHeight: 40,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}>
            {b.label.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--text, #f1f5f9)',
      marginBottom: 14,
      paddingBottom: 8,
      borderBottom: '1px solid var(--border, #334155)',
    }}>
      {children}
    </div>
  );
}

function SortIcon({ dir }) {
  if (!dir) return <span style={{ color: '#475569', marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: '#1877f2', marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportesFinancierosPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear]       = useState(currentYear);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Agent table sort
  const [agentSort, setAgentSort] = useState({ col: 'total', dir: 'desc' });

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (y) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/reports/financial?year=${y}`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(year); }, [year, fetchData]);

  // ── Excel export ───────────────────────────────────────────────────────────
  const exportExcel = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/reports/financial/excel?year=${year}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `reporte-financiero-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al exportar: ' + e.message);
    }
  }, [year]);

  // ── Agent sort logic ───────────────────────────────────────────────────────
  const handleAgentSort = (col) => {
    setAgentSort(prev => ({
      col,
      dir: prev.col === col && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortedAgents = [...(data?.revenue_by_agent || [])].sort((a, b) => {
    const va = a[agentSort.col] ?? 0;
    const vb = b[agentSort.col] ?? 0;
    if (typeof va === 'string') return agentSort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return agentSort.dir === 'asc' ? va - vb : vb - va;
  });

  // ── Chart bars ─────────────────────────────────────────────────────────────
  const allMonths   = fillMonths(data?.revenue_by_month, year);
  const chartBars   = allMonths.map(m => ({ label: m.month, value: m.total }));
  const chartMaxVal = Math.max(...chartBars.map(b => b.value), 1);

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = data?.summary || {};

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .fin-table th, .fin-table td {
          padding: 10px 14px;
          text-align: left;
          border-bottom: 1px solid var(--border, #334155);
          font-size: 13px;
          white-space: nowrap;
        }
        .fin-table th {
          background: var(--bg, #0f172a);
          color: var(--muted, #94a3b8);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          position: sticky;
          top: 0;
          cursor: pointer;
          user-select: none;
        }
        .fin-table th:hover { color: var(--text, #f1f5f9); }
        .fin-table tr:last-child td { border-bottom: none; }
        .fin-table tbody tr:hover { background: var(--bg, #0f172a); }
        .fin-table .num { text-align: right; font-variant-numeric: tabular-nums; }
        @media (max-width: 640px) {
          .fin-kpi-row { flex-direction: column !important; }
          .fin-header-row { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .fin-table-wrap { overflow-x: auto; }
        }
      `}</style>

      <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="fin-header-row"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text, #f1f5f9)', margin: 0 }}>
              Reportes Financieros
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted, #94a3b8)', margin: '4px 0 0' }}>
              Deals ganados · ingresos y rendimiento por agente
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Year selector */}
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              style={{
                background: 'var(--surface, #1e293b)',
                color: 'var(--text, #f1f5f9)',
                border: '1px solid var(--border, #334155)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {/* Export button */}
            <button
              onClick={exportExcel}
              style={{
                background: '#1877f2',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#450a0a',
            border: '1px solid #b91c1c',
            color: '#fca5a5',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 13,
          }}>
            Error al cargar datos: {error}
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && <Spinner />}

        {!loading && data && (
          <>
            {/* ── KPI cards ─────────────────────────────────────────────── */}
            <div
              className="fin-kpi-row"
              style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}
            >
              <KpiCard
                label="Total Revenue"
                value={money(summary.total_revenue)}
                sub={`Año ${year}`}
                accent="#22c55e"
              />
              <KpiCard
                label="Total Deals"
                value={summary.total_deals ?? 0}
                sub="Deals ganados"
              />
              <KpiCard
                label="Promedio por deal"
                value={money(summary.avg_deal_size)}
                sub="Valor promedio"
              />
              <KpiCard
                label="Mejor mes"
                value={summary.best_month ? summary.best_month.slice(5) + '/' + summary.best_month.slice(0, 4) : '—'}
                sub="Mayor ingreso"
                accent="#f59e0b"
              />
            </div>

            {/* ── Bar chart ─────────────────────────────────────────────── */}
            <div style={{
              background: 'var(--surface, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: 12,
              padding: '20px 16px',
              marginBottom: 20,
            }}>
              <SectionTitle>Ingresos por mes — {year}</SectionTitle>
              {chartBars.every(b => b.value === 0) ? (
                <div style={{ textAlign: 'center', color: 'var(--muted, #94a3b8)', fontSize: 13, padding: '24px 0' }}>
                  Sin datos de ingresos para {year}
                </div>
              ) : (
                <BarChart bars={chartBars} maxVal={chartMaxVal} />
              )}
            </div>

            {/* ── Agent performance table ───────────────────────────────── */}
            <div style={{
              background: 'var(--surface, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: 12,
              marginBottom: 20,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 16px 0' }}>
                <SectionTitle>Rendimiento por agente</SectionTitle>
              </div>
              <div className="fin-table-wrap">
                <table className="fin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th onClick={() => handleAgentSort('agent_name')}>
                        Agente <SortIcon dir={agentSort.col === 'agent_name' ? agentSort.dir : null} />
                      </th>
                      <th className="num" onClick={() => handleAgentSort('count')}>
                        Ventas # <SortIcon dir={agentSort.col === 'count' ? agentSort.dir : null} />
                      </th>
                      <th className="num" onClick={() => handleAgentSort('total')}>
                        Revenue $ <SortIcon dir={agentSort.col === 'total' ? agentSort.dir : null} />
                      </th>
                      <th className="num" onClick={() => handleAgentSort('avg_deal')}>
                        Promedio $ <SortIcon dir={agentSort.col === 'avg_deal' ? agentSort.dir : null} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgents.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted, #94a3b8)', padding: '24px 0' }}>
                          Sin datos de agentes para {year}
                        </td>
                      </tr>
                    ) : sortedAgents.map((agent, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: '#1877f220',
                              color: '#1877f2',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, flexShrink: 0,
                            }}>
                              {(agent.agent_name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ color: 'var(--text, #f1f5f9)', fontWeight: 500 }}>
                              {agent.agent_name}
                            </span>
                          </div>
                        </td>
                        <td className="num" style={{ color: 'var(--text, #f1f5f9)' }}>
                          {agent.count}
                        </td>
                        <td className="num" style={{ color: '#22c55e', fontWeight: 600 }}>
                          {money(agent.total)}
                        </td>
                        <td className="num" style={{ color: 'var(--muted, #94a3b8)' }}>
                          {money(agent.avg_deal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Top 10 deals table ────────────────────────────────────── */}
            <div style={{
              background: 'var(--surface, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: 12,
              marginBottom: 20,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 16px 0' }}>
                <SectionTitle>Top 10 deals</SectionTitle>
              </div>
              <div className="fin-table-wrap">
                <table className="fin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Deal</th>
                      <th>Contacto</th>
                      <th>Agente</th>
                      <th className="num">Valor</th>
                      <th>Fecha cierre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!data.top_deals || data.top_deals.length === 0) ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted, #94a3b8)', padding: '24px 0' }}>
                          Sin deals ganados para {year}
                        </td>
                      </tr>
                    ) : data.top_deals.map((deal, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--muted, #94a3b8)', fontWeight: 600, width: 36 }}>
                          {i === 0
                            ? <span title="Top deal" style={{ color: '#f59e0b' }}>1</span>
                            : i + 1
                          }
                        </td>
                        <td>
                          <span style={{
                            color: 'var(--text, #f1f5f9)',
                            fontWeight: 500,
                            maxWidth: 200,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {deal.lead_title || '—'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--muted, #94a3b8)' }}>
                          {deal.contact_name}
                        </td>
                        <td>
                          <span style={{
                            background: '#1877f215',
                            color: '#1877f2',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {deal.agent_name}
                          </span>
                        </td>
                        <td className="num" style={{ color: '#22c55e', fontWeight: 700 }}>
                          {money(deal.value)}
                        </td>
                        <td style={{ color: 'var(--muted, #94a3b8)', fontSize: 12 }}>
                          {fmtDate(deal.closed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Revenue by stage ──────────────────────────────────────── */}
            {data.revenue_by_stage && data.revenue_by_stage.length > 0 && (
              <div style={{
                background: 'var(--surface, #1e293b)',
                border: '1px solid var(--border, #334155)',
                borderRadius: 12,
                padding: '18px 16px',
                marginBottom: 20,
              }}>
                <SectionTitle>Valor de deals por etapa</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(() => {
                    const maxStage = Math.max(...data.revenue_by_stage.map(s => s.total), 1);
                    return data.revenue_by_stage.map((stage, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: 'var(--text, #f1f5f9)', fontWeight: 500 }}>{stage.stage_name}</span>
                          <span style={{ color: '#22c55e', fontWeight: 600 }}>{money(stage.total)}</span>
                        </div>
                        <div style={{ background: 'var(--bg, #0f172a)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.max((stage.total / maxStage) * 100, stage.total > 0 ? 1 : 0)}%`,
                            background: stage.stage_name === 'Ganado' ? '#22c55e' : '#1877f2',
                            borderRadius: 4,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

          </>
        )}

        {/* Empty state when no data and no loading */}
        {!loading && !data && !error && (
          <div style={{ textAlign: 'center', color: 'var(--muted, #94a3b8)', padding: 48, fontSize: 14 }}>
            Sin datos disponibles.
          </div>
        )}

      </div>
    </>
  );
}
