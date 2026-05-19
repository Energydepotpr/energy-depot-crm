'use client';
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api';

const fmtMoney = n => `$${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('es-PR', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const STATUS_OPTIONS = [
  { key: 'pendiente', label: 'Pendiente', color: '#b45309', bg: 'rgba(180,83,9,0.12)' },
  { key: 'enviada',   label: 'Enviada',   color: '#1d4ed8', bg: 'rgba(29,78,216,0.12)' },
  { key: 'pagada',    label: 'Pagada',    color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  { key: 'vencida',   label: 'Vencida',   color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  { key: 'cancelada', label: 'Cancelada', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
];

function StatusBadge({ status, vencimiento }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const vence = vencimiento ? new Date(vencimiento) : null;
  let st = status;
  if ((status === 'pendiente' || status === 'enviada') && vence && vence < today) st = 'vencida';
  const meta = STATUS_OPTIONS.find(o => o.key === st) || STATUS_OPTIONS[0];
  return (
    <span style={{
      display:'inline-block', padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
      color: meta.color, background: meta.bg, textTransform:'uppercase', letterSpacing:0.4,
    }}>{meta.label}</span>
  );
}

function KpiCard({ label, value, color = '#1a3c8f' }) {
  return (
    <div style={{
      background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
      padding:'14px 18px', minWidth: 160, flex:1,
    }}>
      <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.2, fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color, marginTop:4 }}>{fmtMoney(value)}</div>
    </div>
  );
}

export default function FacturasPage() {
  const [rows, setRows] = useState([]);
  const [kpi, setKpi] = useState({ total:0, cobrado:0, pendiente:0, vencido:0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modal, setModal] = useState(null); // { type, invoice }

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter.length) q.set('status', statusFilter.join(','));
      if (search) q.set('search', search);
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const qs = q.toString() ? `?${q.toString()}` : '';
      const data = await api.projectInvoices(qs);
      setRows(data?.data || []);
      setKpi(data?.kpi || { total:0, cobrado:0, pendiente:0, vencido:0 });
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function toggleStatus(s) {
    setStatusFilter(arr => arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s]);
  }

  function applyFilters() { load(); }
  function clearFilters() {
    setStatusFilter([]); setSearch(''); setFrom(''); setTo('');
    setTimeout(load, 0);
  }

  return (
    <div style={{ padding:'18px 22px', maxWidth: 1400, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text)' }}>Facturas por proyecto</h1>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>
            Facturas generadas automáticamente desde los contratos firmados.
          </div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <KpiCard label="Total facturado" value={kpi.total} color="#1a3c8f" />
        <KpiCard label="Cobrado" value={kpi.cobrado} color="#16a34a" />
        <KpiCard label="Pendiente" value={kpi.pendiente} color="#b45309" />
        <KpiCard label="Vencido" value={kpi.vencido} color="#dc2626" />
      </div>

      {/* Filtros */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:'1 1 200px' }}>
            <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>BÚSQUEDA</div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="# factura, lead, cliente…"
              style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:13, color:'var(--text)' }} />
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>DESDE</div>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
              style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:13, color:'var(--text)' }} />
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>HASTA</div>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)}
              style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:13, color:'var(--text)' }} />
          </div>
          <button onClick={applyFilters} style={{ background:'#1a3c8f', color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Aplicar</button>
          <button onClick={clearFilters} style={{ background:'transparent', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 14px', fontSize:13, cursor:'pointer' }}>Limpiar</button>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          {STATUS_OPTIONS.map(o => (
            <button key={o.key} onClick={() => toggleStatus(o.key)}
              style={{
                background: statusFilter.includes(o.key) ? o.color : o.bg,
                color: statusFilter.includes(o.key) ? '#fff' : o.color,
                border:'none', borderRadius:99, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:0.5,
              }}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead style={{ background:'var(--bg)' }}>
            <tr style={{ color:'var(--muted)', fontSize:11, textTransform:'uppercase', letterSpacing:0.6 }}>
              <th style={{ textAlign:'left',  padding:'10px 14px' }}># Factura</th>
              <th style={{ textAlign:'left',  padding:'10px 14px' }}>Cliente</th>
              <th style={{ textAlign:'left',  padding:'10px 14px' }}>Etapa</th>
              <th style={{ textAlign:'right', padding:'10px 14px' }}>Monto</th>
              <th style={{ textAlign:'center',padding:'10px 14px' }}>Estado</th>
              <th style={{ textAlign:'left',  padding:'10px 14px' }}>Vence</th>
              <th style={{ textAlign:'right', padding:'10px 14px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding:30, textAlign:'center', color:'var(--muted)' }}>Cargando…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding:30, textAlign:'center', color:'var(--muted)' }}>
                Sin facturas. Las facturas se crean automáticamente al generar un contrato.
              </td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 14px', fontWeight:700, color:'var(--text)' }}>{r.numero}</td>
                <td style={{ padding:'10px 14px', color:'var(--text)' }}>
                  <div style={{ fontWeight:600 }}>{r.contact_name || r.lead_title || `Lead #${r.lead_id}`}</div>
                  {r.contact_email && <div style={{ fontSize:11, color:'var(--muted)' }}>{r.contact_email}</div>}
                </td>
                <td style={{ padding:'10px 14px', color:'var(--text)' }}>
                  {r.etapa}{r.porcentaje != null && <span style={{ color:'var(--muted)', marginLeft:6 }}>({Math.round(r.porcentaje)}%)</span>}
                </td>
                <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:'var(--text)' }}>{fmtMoney(r.monto)}</td>
                <td style={{ padding:'10px 14px', textAlign:'center' }}>
                  <StatusBadge status={r.status} vencimiento={r.fecha_vencimiento} />
                </td>
                <td style={{ padding:'10px 14px', color:'var(--muted)', fontSize:12 }}>{fmtDate(r.fecha_vencimiento)}</td>
                <td style={{ padding:'10px 14px', textAlign:'right' }}>
                  <div style={{ display:'inline-flex', gap:6 }}>
                    <a href={api.projectInvoicePdfUrl(r.id)} target="_blank" rel="noopener noreferrer"
                       style={{ background:'#1a3c8f', color:'#fff', textDecoration:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700 }}>PDF</a>
                    {r.status !== 'pagada' && r.status !== 'cancelada' && (
                      <button onClick={() => setModal({ type:'pay', invoice: r })}
                        style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Marcar pagada</button>
                    )}
                    <button onClick={() => setModal({ type:'send', invoice: r })}
                      style={{ background:'#67e8f9', color:'#0f2558', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Enviar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.type === 'pay' && (
        <MarkPaidModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} />
      )}
      {modal?.type === 'send' && (
        <SendModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:20 }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 22px', width:'100%', maxWidth:460 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text)' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MarkPaidModal({ invoice, onClose }) {
  const [method, setMethod] = useState('transferencia');
  const [ref, setRef] = useState('');
  const [sendToClient, setSendToClient] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [sms, setSms] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.projectInvoiceMarkPaid(invoice.id, {
        paid_method: method, paid_reference: ref, send_to_client: sendToClient,
        whatsapp, sms,
      });
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally { setLoading(false); }
  }

  return (
    <ModalShell title={`Marcar pagada — ${invoice.numero}`} onClose={onClose}>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>
        Cliente: <strong style={{ color:'var(--text)' }}>{invoice.contact_name || `Lead #${invoice.lead_id}`}</strong> · Monto: <strong style={{ color:'var(--text)' }}>{fmtMoney(invoice.monto)}</strong>
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>MÉTODO DE PAGO</div>
        <select value={method} onChange={e=>setMethod(e.target.value)}
          style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:13, color:'var(--text)' }}>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia bancaria</option>
          <option value="ach">ACH</option>
          <option value="tarjeta">Tarjeta de crédito</option>
          <option value="cheque">Cheque</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>REFERENCIA / # CONFIRMACIÓN</div>
        <input value={ref} onChange={e=>setRef(e.target.value)} placeholder="opcional"
          style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:13, color:'var(--text)' }} />
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text)', marginTop:14, cursor:'pointer' }}>
        <input type="checkbox" checked={sendToClient} onChange={e=>setSendToClient(e.target.checked)} />
        Enviar PDF al cliente con sello PAGADO
      </label>
      {sendToClient && (
        <div style={{ marginLeft:24, marginTop:8, display:'flex', gap:14, flexWrap:'wrap' }}>
          <label style={{ display:'flex', gap:6, fontSize:12, color:'var(--muted)' }}>
            <input type="checkbox" checked disabled /> Email
          </label>
          <label style={{ display:'flex', gap:6, fontSize:12, color:'var(--text)' }}>
            <input type="checkbox" checked={whatsapp} onChange={e=>setWhatsapp(e.target.checked)} /> WhatsApp
          </label>
          <label style={{ display:'flex', gap:6, fontSize:12, color:'var(--text)' }}>
            <input type="checkbox" checked={sms} onChange={e=>setSms(e.target.checked)} /> SMS
          </label>
        </div>
      )}
      <div style={{ display:'flex', gap:8, marginTop:18 }}>
        <button onClick={onClose} style={{ flex:1, background:'transparent', color:'var(--text)', border:'1px solid var(--border)', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{ flex:2, background:'#16a34a', color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', opacity: loading?0.6:1 }}>
          {loading ? 'Guardando…' : '✓ Marcar pagada'}
        </button>
      </div>
    </ModalShell>
  );
}

function SendModal({ invoice, onClose }) {
  const [email, setEmail] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [sms, setSms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  async function submit() {
    setLoading(true);
    try {
      const r = await api.projectInvoiceSend(invoice.id, { email, whatsapp, sms });
      setDone(r?.results || {});
    } catch (e) {
      alert('Error: ' + e.message);
    } finally { setLoading(false); }
  }

  return (
    <ModalShell title={`Enviar factura ${invoice.numero}`} onClose={onClose}>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>
        Cliente: <strong style={{ color:'var(--text)' }}>{invoice.contact_name || `Lead #${invoice.lead_id}`}</strong>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <label style={{ display:'flex', gap:8, fontSize:13, color:'var(--text)', cursor:'pointer' }}>
          <input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)} /> Email{invoice.contact_email ? ` (${invoice.contact_email})` : ''}
        </label>
        <label style={{ display:'flex', gap:8, fontSize:13, color:'var(--text)', cursor:'pointer' }}>
          <input type="checkbox" checked={whatsapp} onChange={e=>setWhatsapp(e.target.checked)} /> WhatsApp{invoice.contact_phone ? ` (${invoice.contact_phone})` : ''}
        </label>
        <label style={{ display:'flex', gap:8, fontSize:13, color:'var(--text)', cursor:'pointer' }}>
          <input type="checkbox" checked={sms} onChange={e=>setSms(e.target.checked)} /> SMS{invoice.contact_phone ? ` (${invoice.contact_phone})` : ''}
        </label>
      </div>
      {done && (
        <div style={{ marginTop:14, padding:'10px 12px', background:'var(--bg)', borderRadius:8, fontSize:12, color:'var(--text)' }}>
          {Object.entries(done).map(([k,v]) => v && (
            <div key={k}>{k}: <strong style={{ color: v === 'ok' ? '#16a34a' : '#dc2626' }}>{v}</strong></div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:8, marginTop:18 }}>
        <button onClick={onClose} style={{ flex:1, background:'transparent', color:'var(--text)', border:'1px solid var(--border)', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Cerrar</button>
        <button onClick={submit} disabled={loading || (!email && !whatsapp && !sms)}
          style={{ flex:2, background:'#1a3c8f', color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:(loading||(!email && !whatsapp && !sms))?0.6:1 }}>
          {loading ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </ModalShell>
  );
}

// Export a reusable Tab component for the lead panel
export function ProjectInvoicesLeadTab({ leadId }) {
  const [rows, setRows] = useState(null);
  const [modal, setModal] = useState(null);

  async function load() {
    try {
      const d = await api.projectInvoicesByLead(leadId);
      setRows(d?.data || []);
    } catch { setRows([]); }
  }
  useEffect(() => { if (leadId) load(); /* eslint-disable-next-line */ }, [leadId]);

  if (rows === null) return <div style={{ padding:16, color:'var(--muted)', fontSize:13 }}>Cargando…</div>;
  if (!rows.length) return (
    <div style={{ padding:16, color:'var(--muted)', fontSize:13, fontStyle:'italic' }}>
      Sin facturas para este lead. Genera un contrato y las facturas se crearán automáticamente.
    </div>
  );

  return (
    <div style={{ padding:'12px 16px' }}>
      <div style={{ display:'grid', gap:10 }}>
        {rows.map(r => (
          <div key={r.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontWeight:800, color:'var(--text)' }}>{r.numero} <span style={{ marginLeft:8 }}><StatusBadge status={r.status} vencimiento={r.fecha_vencimiento} /></span></div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{r.etapa}{r.porcentaje != null ? ` · ${Math.round(r.porcentaje)}%` : ''}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Vence: {fmtDate(r.fecha_vencimiento)}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{fmtMoney(r.monto)}</div>
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  <a href={api.projectInvoicePdfUrl(r.id)} target="_blank" rel="noopener noreferrer"
                     style={{ background:'#1a3c8f', color:'#fff', textDecoration:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700 }}>PDF</a>
                  {r.status !== 'pagada' && r.status !== 'cancelada' && (
                    <button onClick={() => setModal({ type:'pay', invoice: r })}
                      style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Pagada</button>
                  )}
                  <button onClick={() => setModal({ type:'send', invoice: r })}
                    style={{ background:'#67e8f9', color:'#0f2558', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Enviar</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal?.type === 'pay' && <MarkPaidModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} />}
      {modal?.type === 'send' && <SendModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} />}
    </div>
  );
}
