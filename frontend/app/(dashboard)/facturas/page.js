'use client';
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api';
import NewInvoiceModal from '../../components/NewInvoiceModal';

const fmtMoney = n => `$${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('es-PR', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const STATUS_OPTIONS = [
  { key: 'pendiente', label: 'Pendiente', color: '#b45309', bg: 'rgba(180,83,9,0.12)' },
  { key: 'enviada',   label: 'Enviada',   color: '#1d4ed8', bg: 'rgba(29,78,216,0.12)' },
  { key: 'pagada',    label: 'Pagada',    color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  { key: 'vencida',   label: 'Vencida',   color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  { key: 'cancelada', label: 'Cancelada', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
];

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const f = () => setM(window.innerWidth < bp);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [bp]);
  return m;
}

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
      padding:'14px 18px', minWidth: 0,
    }}>
      <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.2, fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, color, marginTop:4, wordBreak:'break-word' }}>{fmtMoney(value)}</div>
    </div>
  );
}

export default function FacturasPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState([]);
  const [kpi, setKpi] = useState({ total:0, cobrado:0, pendiente:0, vencido:0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modal, setModal] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

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

  async function eliminarFactura(r) {
    if (!confirm(`¿Eliminar la factura ${r.numero}? Esta acción no se puede deshacer.`)) return;
    try { await api.projectInvoiceDelete(r.id + '?hard=1'); load(); }
    catch (e) { alert('Error: ' + e.message); }
  }

  function applyFilters() { load(); if (isMobile) setShowFilters(false); }
  function clearFilters() {
    setStatusFilter([]); setSearch(''); setFrom(''); setTo('');
    setTimeout(load, 0);
  }

  const activeFilterCount = (statusFilter.length ? 1 : 0) + (search ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  const FiltersInner = (
    <>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ flex:'1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>BÚSQUEDA</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="# factura, lead, cliente…"
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)' }} />
        </div>
        <div style={{ flex: isMobile ? '1 1 45%' : '0 0 auto' }}>
          <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>DESDE</div>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)' }} />
        </div>
        <div style={{ flex: isMobile ? '1 1 45%' : '0 0 auto' }}>
          <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>HASTA</div>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)}
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)' }} />
        </div>
        <button onClick={applyFilters} style={{ background:'#1a3c8f', color:'#fff', border:'none', borderRadius:8, padding:'11px 16px', fontSize:13, fontWeight:700, cursor:'pointer', minHeight:40 }}>Aplicar</button>
        <button onClick={clearFilters} style={{ background:'transparent', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:13, cursor:'pointer', minHeight:40 }}>Limpiar</button>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
        {STATUS_OPTIONS.map(o => (
          <button key={o.key} onClick={() => toggleStatus(o.key)}
            style={{
              background: statusFilter.includes(o.key) ? o.color : o.bg,
              color: statusFilter.includes(o.key) ? '#fff' : o.color,
              border:'none', borderRadius:99, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:0.5, minHeight:36,
            }}>{o.label}</button>
        ))}
      </div>
    </>
  );

  return (
    <div style={{ padding: isMobile ? '14px 14px 90px' : '18px 22px', maxWidth: 1400, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, gap: 10, flexWrap:'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin:0, fontSize: isMobile ? 18 : 22, fontWeight:800, color:'var(--text)' }}>Facturas por proyecto</h1>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>
            Facturas generadas automáticamente desde los contratos firmados.
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button onClick={() => setModal({ type:'new' })}
            style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', minHeight:38, display:'inline-flex', alignItems:'center', gap:6 }}>
            + Nueva Factura
          </button>
          {isMobile && (
            <button onClick={() => setShowFilters(true)}
              style={{ background:'#1a3c8f', color:'#fff', border:'none', borderRadius:8, padding:'9px 14px', fontSize:13, fontWeight:700, cursor:'pointer', minHeight:38, display:'inline-flex', alignItems:'center', gap:6 }}>
              Filtros{activeFilterCount > 0 && <span style={{ background:'#67e8f9', color:'#0f2558', borderRadius:99, padding:'1px 7px', fontSize:11 }}>{activeFilterCount}</span>}
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div style={{
        display:'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap:12, marginBottom:16,
      }}>
        <KpiCard label="Total facturado" value={kpi.total} color="#1a3c8f" />
        <KpiCard label="Cobrado" value={kpi.cobrado} color="#16a34a" />
        <KpiCard label="Pendiente" value={kpi.pendiente} color="#b45309" />
        <KpiCard label="Vencido" value={kpi.vencido} color="#dc2626" />
      </div>

      {/* Filtros - desktop inline, mobile bottom sheet */}
      {!isMobile && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
          {FiltersInner}
        </div>
      )}

      {isMobile && showFilters && (
        <div onClick={() => setShowFilters(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:998 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position:'fixed', left:0, right:0, bottom:0,
            background:'var(--surface)', borderTopLeftRadius:16, borderTopRightRadius:16,
            padding:'18px 16px 24px', maxHeight:'85vh', overflowY:'auto', zIndex:999,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text)' }}>Filtros</h3>
              <button onClick={() => setShowFilters(false)} style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:22, cursor:'pointer', lineHeight:1, padding:4 }}>✕</button>
            </div>
            {FiltersInner}
          </div>
        </div>
      )}

      {/* Lista: tabla en desktop, cards en mobile */}
      {isMobile ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {loading && <div style={{ padding:30, textAlign:'center', color:'var(--muted)' }}>Cargando…</div>}
          {!loading && rows.length === 0 && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:30, textAlign:'center', color:'var(--muted)', fontSize:13 }}>
              Sin facturas. Las facturas se crean automáticamente al generar un contrato.
            </div>
          )}
          {rows.map(r => (
            <div key={r.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontWeight:800, color:'var(--text)', fontSize:14 }}>{r.numero}</div>
                  <div style={{ fontSize:13, color:'var(--text)', marginTop:2, fontWeight:600 }}>{r.contact_name || r.lead_title || `Lead #${r.lead_id}`}</div>
                  {r.contact_email && <div style={{ fontSize:11, color:'var(--muted)' }}>{r.contact_email}</div>}
                </div>
                <StatusBadge status={r.status} vencimiento={r.fecha_vencimiento} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12, color:'var(--muted)', marginBottom:10, paddingTop:8, borderTop:'1px dashed var(--border)' }}>
                <div>
                  <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:0.5 }}>Etapa</div>
                  <div style={{ color:'var(--text)', fontWeight:600, marginTop:2 }}>{r.etapa}{r.porcentaje != null && ` (${Math.round(r.porcentaje)}%)`}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:0.5 }}>Monto</div>
                  <div style={{ color:'var(--text)', fontWeight:800, marginTop:2 }}>{fmtMoney(r.monto)}</div>
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:0.5 }}>Vence</div>
                  <div style={{ color:'var(--text)', marginTop:2 }}>{fmtDate(r.fecha_vencimiento)}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button onClick={async () => {
                  try { const d = await api.downloadProjectInvoicePdf(r.id); window.open(d.url, '_blank'); }
                  catch(e){ alert('Error: ' + e.message); }
                }}
                style={{ background:'#1a3c8f', color:'#fff', textDecoration:'none', borderRadius:6, padding:'8px 12px', fontSize:12, fontWeight:700, minHeight:36, display:'inline-flex', alignItems:'center' , border:'none', cursor:'pointer'}}>PDF</button>
                {r.status !== 'pagada' && r.status !== 'cancelada' && (
                  <button onClick={() => setModal({ type:'pay', invoice: r })}
                    style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:6, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:36 }}>Marcar pagada</button>
                )}
                <button onClick={() => setModal({ type:'send', invoice: r })}
                  style={{ background:'#67e8f9', color:'#0f2558', border:'none', borderRadius:6, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:36 }}>Enviar</button>
                <button onClick={() => setModal({ type:'edit', invoice: r })}
                  style={{ background:'rgba(245,158,11,0.15)', color:'#b45309', border:'1px solid rgba(245,158,11,0.4)', borderRadius:6, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:36 }}>Editar</button>
                <button onClick={() => eliminarFactura(r)}
                  style={{ background:'rgba(239,68,68,0.12)', color:'#dc2626', border:'1px solid rgba(239,68,68,0.35)', borderRadius:6, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', minHeight:36 }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                      <button onClick={async () => {
                  try { const d = await api.downloadProjectInvoicePdf(r.id); window.open(d.url, '_blank'); }
                  catch(e){ alert('Error: ' + e.message); }
                }}
                style={{ background:'#1a3c8f', color:'#fff', textDecoration:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700 , border:'none', cursor:'pointer'}}>PDF</button>
                      {r.status !== 'pagada' && r.status !== 'cancelada' && (
                        <button onClick={() => setModal({ type:'pay', invoice: r })}
                          style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Marcar pagada</button>
                      )}
                      <button onClick={() => setModal({ type:'send', invoice: r })}
                        style={{ background:'#67e8f9', color:'#0f2558', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Enviar</button>
                      <button onClick={() => setModal({ type:'edit', invoice: r })}
                        style={{ background:'rgba(245,158,11,0.15)', color:'#b45309', border:'1px solid rgba(245,158,11,0.4)', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Editar</button>
                      <button onClick={() => eliminarFactura(r)}
                        style={{ background:'rgba(239,68,68,0.12)', color:'#dc2626', border:'1px solid rgba(239,68,68,0.35)', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'pay' && (
        <MarkPaidModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} isMobile={isMobile} />
      )}
      {modal?.type === 'send' && (
        <SendModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} isMobile={isMobile} />
      )}
      {modal?.type === 'new' && (
        <NewInvoiceModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} isMobile={isMobile} />
      )}
      {modal?.type === 'edit' && (
        <NewInvoiceModal invoice={modal.invoice} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} isMobile={isMobile} />
      )}
    </div>
  );
}


function ModalShell({ title, children, onClose, isMobile }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center', zIndex:999, padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--surface)',
        border: isMobile ? 'none' : '1px solid var(--border)',
        borderTopLeftRadius: isMobile ? 16 : 12,
        borderTopRightRadius: isMobile ? 16 : 12,
        borderBottomLeftRadius: isMobile ? 0 : 12,
        borderBottomRightRadius: isMobile ? 0 : 12,
        padding:'18px 22px',
        width:'100%',
        maxWidth: isMobile ? '100%' : 460,
        maxHeight: isMobile ? '92vh' : '90vh',
        overflowY:'auto',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text)' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:22, cursor:'pointer', padding:4, lineHeight:1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MarkPaidModal({ invoice, onClose, isMobile }) {
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
    <ModalShell title={`Marcar pagada — ${invoice.numero}`} onClose={onClose} isMobile={isMobile}>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>
        Cliente: <strong style={{ color:'var(--text)' }}>{invoice.contact_name || `Lead #${invoice.lead_id}`}</strong> · Monto: <strong style={{ color:'var(--text)' }}>{fmtMoney(invoice.monto)}</strong>
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:4 }}>MÉTODO DE PAGO</div>
        <select value={method} onChange={e=>setMethod(e.target.value)}
          style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)' }}>
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
          style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)' }} />
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
        <button onClick={onClose} style={{ flex:1, background:'transparent', color:'var(--text)', border:'1px solid var(--border)', borderRadius:8, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', minHeight:42 }}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{ flex:2, background:'#16a34a', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', opacity: loading?0.6:1, minHeight:42 }}>
          {loading ? 'Guardando…' : '✓ Marcar pagada'}
        </button>
      </div>
    </ModalShell>
  );
}

function SendModal({ invoice, onClose, isMobile }) {
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
    <ModalShell title={`Enviar factura ${invoice.numero}`} onClose={onClose} isMobile={isMobile}>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>
        Cliente: <strong style={{ color:'var(--text)' }}>{invoice.contact_name || `Lead #${invoice.lead_id}`}</strong>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <label style={{ display:'flex', gap:8, fontSize:14, color:'var(--text)', cursor:'pointer', padding:'6px 0' }}>
          <input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)} /> Email{invoice.contact_email ? ` (${invoice.contact_email})` : ''}
        </label>
        <label style={{ display:'flex', gap:8, fontSize:14, color:'var(--text)', cursor:'pointer', padding:'6px 0' }}>
          <input type="checkbox" checked={whatsapp} onChange={e=>setWhatsapp(e.target.checked)} /> WhatsApp{invoice.contact_phone ? ` (${invoice.contact_phone})` : ''}
        </label>
        <label style={{ display:'flex', gap:8, fontSize:14, color:'var(--text)', cursor:'pointer', padding:'6px 0' }}>
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
        <button onClick={onClose} style={{ flex:1, background:'transparent', color:'var(--text)', border:'1px solid var(--border)', borderRadius:8, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', minHeight:42 }}>Cerrar</button>
        <button onClick={submit} disabled={loading || (!email && !whatsapp && !sms)}
          style={{ flex:2, background:'#1a3c8f', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', opacity:(loading||(!email && !whatsapp && !sms))?0.6:1, minHeight:42 }}>
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
  const isMobile = useIsMobile();

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
                  <button onClick={async () => {
                  try { const d = await api.downloadProjectInvoicePdf(r.id); window.open(d.url, '_blank'); }
                  catch(e){ alert('Error: ' + e.message); }
                }}
                style={{ background:'#1a3c8f', color:'#fff', textDecoration:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700 , border:'none', cursor:'pointer'}}>PDF</button>
                  {r.status !== 'pagada' && r.status !== 'cancelada' && (
                    <button onClick={() => setModal({ type:'pay', invoice: r })}
                      style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Pagada</button>
                  )}
                  <button onClick={() => setModal({ type:'send', invoice: r })}
                    style={{ background:'#67e8f9', color:'#0f2558', border:'none', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Enviar</button>
                  {isFirstStageInvoice(r) && (
                    <UseInFinancingInvoiceButton invoice={r} leadId={leadId} />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal?.type === 'pay' && <MarkPaidModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} isMobile={isMobile} />}
      {modal?.type === 'send' && <SendModal invoice={modal.invoice} onClose={() => { setModal(null); load(); }} isMobile={isMobile} />}
    </div>
  );
}

// Identifica factura de etapa 1 por porcentaje (40 o 45) o nombre de etapa
function isFirstStageInvoice(r) {
  const pct = Number(r?.porcentaje);
  if (pct === 40 || pct === 45) return true;
  const e = String(r?.etapa || '').toLowerCase();
  if (e.includes('firmar') || e.includes('firma de contrato') || e.includes('inicial')) return true;
  return false;
}

function UseInFinancingInvoiceButton({ invoice, leadId }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      // 1. Descargar PDF
      const d = await api.downloadProjectInvoicePdf(invoice.id);
      const blob = d.blob;
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      const b64 = btoa(bin);

      // 2. Determinar coop (preguntar) y doc_key
      const coops = await api.cooperativas().catch(() => []);
      const names = (Array.isArray(coops) ? coops : []).map(c => c.name);
      if (!names.length) { alert('No hay cooperativas configuradas'); return; }
      let coopName = names[0];
      // Tomar de solar_data si existe
      try {
        const lead = await api.lead(leadId);
        if (lead?.solar_data?.financing_coop && names.includes(lead.solar_data.financing_coop)) {
          coopName = lead.solar_data.financing_coop;
        }
      } catch {}
      if (names.length > 1) {
        const choice = prompt('¿En qué cooperativa? (' + names.join(' / ') + ')', coopName);
        if (!choice) return;
        const found = names.find(n => n.toLowerCase() === choice.toLowerCase());
        if (!found) { alert('Cooperativa no válida'); return; }
        coopName = found;
      }
      const docKey = /tu\s*coop/i.test(coopName) ? 'factura_40' : 'factura_45';
      await api.uploadFinancingDocFromBase64(
        leadId, coopName, 'etapa1', docKey, b64, d.filename || `Factura-${invoice.id}.pdf`, 'application/pdf'
      );
      alert(`✓ Factura guardada en Financiamiento (${coopName} · ${docKey})`);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setBusy(false); }
  };
  return (
    <button onClick={onClick} disabled={busy}
      style={{ background:'transparent', color:'#0891b2', border:'1px solid #67e8f9', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? '…' : '📎 Usar en Financiamiento'}
    </button>
  );
}
