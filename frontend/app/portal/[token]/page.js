'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/backend')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

async function apiGet(path) {
  const r = await fetch(`${BASE_URL}${path}`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return {}; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(v) {
  return `$${Number(v || 0).toLocaleString('es', { minimumFractionDigits: 2 })}`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Pendiente' },
    signed:   { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Firmado' },
    expired:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Vencido' },
    paid:     { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Pagada' },
    draft:    { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'Borrador' },
  };
  const s = map[status] || { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, icon, children, empty }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{title}</h2>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {empty ? (
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>{empty}</p>
        ) : children}
      </div>
    </div>
  );
}

// ── Invoice row ───────────────────────────────────────────────────────────────
function InvoiceRow({ inv, token }) {
  const printInvoice = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const items = Array.isArray(inv.items) ? inv.items : [];
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Factura ${inv.invoice_number || inv.id}</title>
    <style>body{font-family:Arial,sans-serif;max-width:680px;margin:40px auto;color:#1e293b}h2{color:#1877f2}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#1877f2;color:#fff;padding:8px 12px;text-align:left}td{padding:8px 12px;border-bottom:1px solid #e2e8f0}.total{font-weight:700;font-size:18px;color:#1877f2}.muted{color:#64748b;font-size:13px}@media print{button{display:none}}</style>
    </head><body>
    <h2>Factura ${inv.invoice_number || '#' + inv.id}</h2>
    <p class="muted">Fecha: ${inv.service_date ? new Date(inv.service_date + 'T00:00:00').toLocaleDateString('es-PR') : new Date(inv.created_at).toLocaleDateString('es-PR')}</p>
    ${inv.notes ? `<p class="muted">Notas: ${inv.notes}</p>` : ''}
    <table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>
    ${items.length > 0 ? items.map(it => `<tr><td>${it.description || '—'}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">$${Number(it.unit_price||0).toFixed(2)}</td><td style="text-align:right">$${Number(it.total||0).toFixed(2)}</td></tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:#64748b;padding:16px">—</td></tr>`}
    </tbody></table>
    <div style="text-align:right;margin-top:8px">
    ${inv.subtotal && inv.tax > 0 ? `<p class="muted" style="margin:4px 0">Subtotal: $${Number(inv.subtotal).toFixed(2)}</p><p class="muted" style="margin:4px 0">IVU (${inv.tax}%): $${(Number(inv.subtotal)*Number(inv.tax)/100).toFixed(2)}</p>` : ''}
    <p class="total">TOTAL: $${Number(inv.total||0).toLocaleString('en-US',{minimumFractionDigits:2})}</p>
    </div>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#1877f2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px">Imprimir / Guardar PDF</button>
    </body></html>`);
    win.document.close();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
          {inv.invoice_number || `Factura #${inv.id}`}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {fmtDate(inv.service_date || inv.created_at)}
          {inv.notes && <> · {inv.notes.slice(0, 50)}{inv.notes.length > 50 ? '…' : ''}</>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{fmtMoney(inv.total)}</span>
        {/* payment_link removed from public portal for security */}
        <button onClick={printInvoice}
          style={{ background: 'rgba(16,185,129,0.08)', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          PDF
        </button>
      </div>
    </div>
  );
}

// ── Contract row ──────────────────────────────────────────────────────────────
function ContractRow({ ct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{ct.title}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {fmtDate(ct.created_at)}
          {ct.signed_at && <> · Firmado {fmtDate(ct.signed_at)}</>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusBadge status={ct.status} />
      </div>
    </div>
  );
}

// ── Booking row ───────────────────────────────────────────────────────────────
function BookingRow({ b, past }) {
  const fmtDateTime = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', opacity: past ? 0.7 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{b.title || 'Reserva'}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {fmtDateTime(b.start_time)}
          {b.end_time && <> – {fmtDateTime(b.end_time)}</>}
        </div>
        {b.agent_name && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Asesor: {b.agent_name}</div>
        )}
        {b.notes && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>{b.notes.slice(0, 80)}{b.notes.length > 80 ? '…' : ''}</div>
        )}
      </div>
      {b.status && <StatusBadge status={b.status} />}
    </div>
  );
}

// ── Main portal page ──────────────────────────────────────────────────────────
export default function ClientPortalPage() {
  const { token } = useParams();

  const [state,      setState]      = useState('loading');
  const [data,       setData]       = useState(null);
  const [errMsg,     setErrMsg]     = useState('');
  const [onboarding, setOnboarding] = useState(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiGet(`/api/public/portal/${token}`),
      apiGet(`/api/public/onboarding/${token}`).catch(() => ({})),
    ]).then(([res, obRes]) => {
        if (res.error) {
          if (res.error.includes('expirado')) setState('expired');
          else { setState('error'); setErrMsg(res.error); }
          return;
        }
        if (!res.ok) { setState('error'); setErrMsg('Portal no disponible.'); return; }
        setData(res.data);
        if (obRes.ok) setOnboarding(obRes.onboarding);
        setState('ready');
      })
      .catch(err => { setState('error'); setErrMsg(err.message); });
  }, [token]);

  const toggleOnboarding = async (itemId, completed) => {
    try {
      const res = await fetch(`${BASE_URL}/api/public/onboarding/${token}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, completed }),
      });
      const r = await res.json();
      if (r.ok) setOnboarding(r.onboarding);
    } catch (_) {}
  };

  // Loading
  if (state === 'loading') return (
    <div style={styles.page}>
      <div style={{ textAlign: 'center', color: '#64748b', padding: '80px 20px' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #e2e8f0', borderTop: '2px solid #1877f2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        Cargando portal...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (state === 'expired') return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
          <h2 style={{ color: '#ef4444' }}>Portal expirado</h2>
          <p style={{ color: '#64748b' }}>Este enlace del portal ya no está disponible. Contacta a tu asesor.</p>
        </div>
      </div>
    </div>
  );

  if (state === 'error') return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <h2 style={{ color: '#ef4444' }}>Portal no encontrado</h2>
          <p style={{ color: '#64748b' }}>{errMsg || 'Este enlace no es válido.'}</p>
        </div>
      </div>
    </div>
  );

  const { contact, invoices, contracts, bookings, company } = data;
  const now = new Date();
  const upcomingBookings = bookings.filter(b => b.start_time && new Date(b.start_time) >= now);
  const pastBookings     = bookings.filter(b => !b.start_time || new Date(b.start_time) < now);

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* ── Header ── */}
      <div style={{ background: '#1877f2', padding: '0 0 60px' }}>
        <div style={styles.container}>
          <div style={{ paddingTop: 24, paddingBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            {company?.logo ? (
              <img src={company.logo} alt="Logo" style={{ height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            ) : (
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>{company?.name || 'CRM IA'}</span>
            )}
            <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
              Portal del cliente
            </span>
          </div>

          {/* Contact info */}
          <div style={{ color: '#fff', paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                {(contact.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>Portal de {contact.name}</h1>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.8)', flexWrap: 'wrap' }}>
                  {contact.phone && <span>📞 {contact.phone}</span>}
                  {contact.email && <span>✉ {contact.email}</span>}
                  {contact.company && <span>🏢 {contact.company}</span>}
                </div>
                {contact.phone && (
                  <a
                    href={`sms:${contact.phone}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: '#2563eb', color: '#fff', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
                    Enviar mensaje de texto
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ ...styles.container, marginTop: -32 }}>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Facturas',  value: invoices.length,        color: '#10b981' },
            { label: 'Contratos', value: contracts.length,       color: '#f59e0b' },
            { label: 'Próximas',  value: upcomingBookings.length, color: '#1877f2' },
            { label: 'Historial', value: pastBookings.length,    color: '#64748b' },
          ].map(c => (
            <div key={c.label} style={{ flex: '1 1 80px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Próximas citas */}
        <Section title="Próximas reservas" icon="📅" empty={upcomingBookings.length === 0 ? 'No hay reservas próximas.' : null}>
          {upcomingBookings.map(b => <BookingRow key={b.id} b={b} />)}
        </Section>

        {/* Facturas */}
        <Section title="Facturas" icon="🧾" empty={invoices.length === 0 ? 'No hay facturas registradas.' : null}>
          {invoices.map(inv => <InvoiceRow key={inv.id} inv={inv} token={token} />)}
        </Section>

        {/* Contratos */}
        <Section title="Contratos" icon="📄" empty={contracts.length === 0 ? 'No hay contratos registrados.' : null}>
          {contracts.map(ct => <ContractRow key={ct.id} ct={ct} />)}
        </Section>

        {/* Historial de viajes */}
        {pastBookings.length > 0 && (
          <Section title="Historial de viajes" icon="🗺️">
            {pastBookings.map(b => <BookingRow key={b.id} b={b} past />)}
          </Section>
        )}

        {/* Onboarding checklist */}
        {onboarding && onboarding.items?.length > 0 && (
          <Section title="Lista de tareas pendientes" icon="✅">
            {(() => {
              const total = onboarding.items.length;
              const done  = onboarding.items.filter(i => i.completed).length;
              const pct   = Math.round((done / total) * 100);
              return (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#64748b' }}>
                      <span>Completado</span>
                      <span style={{ fontWeight: 700, color: pct === 100 ? '#10b981' : '#1877f2' }}>{pct}% ({done}/{total})</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: pct === 100 ? '#10b981' : '#1877f2', width: `${pct}%`, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {onboarding.items.map(item => (
                      <div key={item.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: item.completed ? 'rgba(16,185,129,0.06)' : '#f8fafc', border: `1px solid ${item.completed ? 'rgba(16,185,129,0.2)' : '#e2e8f0'}`, borderRadius: 12, cursor: 'pointer' }}
                        onClick={() => toggleOnboarding(item.id, !item.completed)}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: item.completed ? '#10b981' : 'transparent', border: `2px solid ${item.completed ? '#10b981' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.completed && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, color: item.completed ? '#94a3b8' : '#1e293b', textDecoration: item.completed ? 'line-through' : 'none' }}>
                            {item.label}
                            {item.required && !item.completed && <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444', fontWeight: 600 }}>requerido</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Section>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 11, paddingTop: 20, paddingBottom: 40 }}>
          Portal seguro · {company?.name || 'CRM IA'} · Todos los derechos reservados
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '0 16px',
  },
};
