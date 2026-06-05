'use client';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const fmtMoney = n => `$${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// Modal de Nueva/Editar factura con items del catálogo.
// Props:
//   onClose(), onSaved()
//   isMobile
//   lockedLead  = { id, contact_name, title }  → fija el cliente a ese lead (desde el panel del lead)
//   invoice     = factura existente para EDITAR (con items[], cliente_nombre, etc.)
export default function NewInvoiceModal({ onClose, onSaved, isMobile, lockedLead = null, invoice = null }) {
  const editMode = !!invoice;
  const [catalog, setCatalog] = useState([]);
  const [cliente, setCliente] = useState(invoice?.cliente_nombre || '');
  const [email, setEmail] = useState(invoice?.cliente_email || '');
  const [phone, setPhone] = useState(invoice?.cliente_telefono || '');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [selectedLead, setSelectedLead] = useState(
    lockedLead ? lockedLead : null
  );
  const [items, setItems] = useState(
    (Array.isArray(invoice?.items) && invoice.items.length)
      ? invoice.items.map(it => ({ description: it.description || it.concepto || '', qty: Number(it.qty)||1, unit_price: Number(it.unit_price)||0 }))
      : [{ description:'', qty:1, unit_price:0 }]
  );
  const [vencimiento, setVencimiento] = useState(invoice?.fecha_vencimiento ? String(invoice.fecha_vencimiento).slice(0,10) : '');
  const [notes, setNotes] = useState(invoice?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings().then(cfg => {
      let inv = cfg?.invoice_items;
      if (typeof inv === 'string') { try { inv = JSON.parse(inv); } catch { inv = []; } }
      setCatalog((Array.isArray(inv) ? inv : []).filter(i => i && i.name && i.active !== false));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (lockedLead) return; // cliente fijo
    if (!leadSearch.trim() || selectedLead) { setLeadResults([]); return; }
    const t = setTimeout(() => {
      api.leads(`?search=${encodeURIComponent(leadSearch)}&limit=6`)
        .then(r => setLeadResults(Array.isArray(r) ? r.slice(0,6) : [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [leadSearch, selectedLead, lockedLead]);

  const setItem = (i, campo, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [campo]: (campo==='description') ? val : (Number(val)||0) } : it));
  const addItem = () => setItems([...items, { description:'', qty:1, unit_price:0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const pickCatalog = (i, name) => {
    const c = catalog.find(x => x.name === name);
    if (c) setItems(items.map((it, idx) => idx === i ? { ...it, description: c.name, unit_price: Number(c.precio)||0 } : it));
  };

  const total = items.reduce((s, it) => s + (Number(it.qty)||0) * (Number(it.unit_price)||0), 0);

  const guardar = async () => {
    const clean = items.filter(it => it.description.trim());
    if (!clean.length) return alert('Agrega al menos un item con descripción');
    if (!selectedLead && !cliente.trim()) return alert('Selecciona un lead o escribe el nombre del cliente');
    setSaving(true);
    try {
      const payload = {
        items: clean,
        fecha_vencimiento: vencimiento || undefined,
        notes: notes.trim() || undefined,
      };
      if (editMode) {
        await api.projectInvoiceUpdate(invoice.id, payload);
      } else {
        await api.createProjectInvoice({
          ...payload,
          lead_id: selectedLead?.id || null,
          cliente_nombre: selectedLead ? (selectedLead.contact_name || selectedLead.title) : cliente.trim(),
          cliente_email: email.trim() || undefined,
          cliente_telefono: phone.trim() || undefined,
        });
      }
      onSaved();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const inp = { width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 11px', fontSize:14, color:'var(--text)', outline:'none', boxSizing:'border-box' };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center', zIndex:1000, padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--surface)', border: isMobile ? 'none' : '1px solid var(--border)',
        borderRadius: isMobile ? '16px 16px 0 0' : 12, width:'100%', maxWidth: 540,
        maxHeight: isMobile ? '92vh' : '88vh', overflowY:'auto', padding: isMobile ? '18px 16px 28px' : 24,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{editMode ? `Editar ${invoice.numero}` : 'Nueva factura'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Cliente */}
          <div>
            <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:5 }}>CLIENTE</div>
            {(selectedLead || lockedLead) ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 11px' }}>
                <span style={{ fontSize:14, color:'var(--text)', fontWeight:600 }}>👤 {(selectedLead||lockedLead).contact_name || (selectedLead||lockedLead).title}</span>
                {!lockedLead && !editMode && <button onClick={() => { setSelectedLead(null); setLeadSearch(''); }} style={{ background:'none', border:'none', color:'#ef4444', fontSize:12, cursor:'pointer' }}>cambiar</button>}
              </div>
            ) : editMode ? (
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 11px', fontSize:14, color:'var(--text)', fontWeight:600 }}>👤 {invoice.cliente_nombre || 'Cliente'}</div>
            ) : (
              <>
                <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Buscar lead existente…" style={inp} />
                {leadResults.length > 0 && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:8, marginTop:4, overflow:'hidden' }}>
                    {leadResults.map(l => (
                      <button key={l.id} onClick={() => { setSelectedLead(l); setLeadResults([]); setLeadSearch(''); }}
                        style={{ display:'block', width:'100%', textAlign:'left', padding:'9px 11px', background:'var(--surface)', border:'none', borderBottom:'1px solid var(--border)', color:'var(--text)', fontSize:13, cursor:'pointer' }}>
                        {l.contact_name || l.title}{l.contact_phone ? ` · ${l.contact_phone}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:11, color:'var(--muted)', margin:'8px 0 4px' }}>…o cliente manual:</div>
                <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre del cliente" style={inp} />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (opcional)" style={inp} />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono (opcional)" style={inp} />
                </div>
              </>
            )}
          </div>

          {/* Items */}
          <div>
            <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:5 }}>ITEMS</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {items.map((it, i) => (
                <div key={i} style={{ border:'1px solid var(--border)', borderRadius:8, padding:10, background:'var(--bg)' }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                    {catalog.length > 0 && (
                      <select onChange={e => pickCatalog(i, e.target.value)} value=""
                        style={{ ...inp, width:'auto', flex:'0 0 auto', padding:'7px 8px', fontSize:12 }}>
                        <option value="">📋 Catálogo…</option>
                        {catalog.map(c => <option key={c.name} value={c.name}>{c.name} (${Number(c.precio).toLocaleString()})</option>)}
                      </select>
                    )}
                    <input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="Descripción" style={{ ...inp, flex:1 }} />
                    {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background:'none', border:'none', color:'#ef4444', fontSize:16, cursor:'pointer', flexShrink:0 }}>✕</button>}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                    <div style={{ flex:'0 0 90px' }}>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>Cant.</div>
                      <input type="number" min="0" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} style={inp} />
                    </div>
                    <div style={{ flex:'1' }}>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>Precio unitario</div>
                      <input type="number" min="0" step="0.01" value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} style={inp} />
                    </div>
                    <div style={{ flex:'0 0 auto', textAlign:'right', paddingBottom:8 }}>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>Total</div>
                      <div style={{ fontSize:14, fontWeight:800, color:'#1a3c8f' }}>{fmtMoney((Number(it.qty)||0)*(Number(it.unit_price)||0))}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addItem} style={{ marginTop:8, background:'rgba(26,60,143,0.1)', color:'#1a3c8f', border:'1px dashed #1a3c8f', borderRadius:8, padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer', width:'100%' }}>+ Agregar item</button>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700, marginBottom:5 }}>VENCIMIENTO</div>
              <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} style={inp} />
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>TOTAL</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#10b981' }}>{fmtMoney(total)}</div>
            </div>
          </div>

          <button onClick={guardar} disabled={saving}
            style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:800, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Generando…' : (editMode ? '✓ Guardar cambios' : '✓ Crear factura y generar PDF')}
          </button>
        </div>
      </div>
    </div>
  );
}
