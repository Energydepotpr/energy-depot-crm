'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:       'var(--bg)',
  surface:  'var(--surface)',
  surface2: 'var(--surface2)',
  border:   'var(--border)',
  text:     'var(--text)',
  muted:    'var(--muted)',
  accent:   'var(--accent)',
  success:  'var(--success)',
  danger:   'var(--danger)',
  warning:  'var(--warning)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtPrice(n) {
  return `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_META = {
  draft:    { label: 'Borrador',  color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
  sent:     { label: 'Enviada',   color: '#60a5fa', bg: 'rgba(96,165,250,0.14)'  },
  accepted: { label: 'Aceptada', color: '#34d399', bg: 'rgba(52,211,153,0.14)'  },
  rejected: { label: 'Rechazada',color: '#f87171', bg: 'rgba(248,113,113,0.14)' },
  expired:  { label: 'Vencida',  color: '#fb923c', bg: 'rgba(251,146,60,0.14)'  },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: C.muted, bg: C.surface2 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: m.color, background: m.bg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function Btn({ onClick, children, style = {}, disabled = false, title, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 500, opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      {children}
    </button>
  );
}

function StatCard({ label, value, color = C.text }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', flex: '1 1 130px', minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Items editor ──────────────────────────────────────────────────────────────
const EMPTY_ITEM = { description: '', qty: 1, unit_price: '', total: 0, product_id: null };

function ItemsEditor({ items, setItems, catalogProducts }) {
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      const qty   = Number(field === 'qty'        ? value : next[idx].qty)        || 0;
      const price = Number(field === 'unit_price'  ? value : next[idx].unit_price) || 0;
      next[idx].total = +(qty * price).toFixed(2);
      return next;
    });
  };

  const selectProduct = (idx, productId) => {
    const product = catalogProducts.find(p => String(p.id) === String(productId));
    if (!product) return;
    setItems(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        description: product.name,
        unit_price:  String(product.price),
        product_id:  product.id,
        total:       +(Number(next[idx].qty || 1) * Number(product.price)).toFixed(2),
      };
      return next;
    });
  };

  const inputStyle = {
    background: C.surface2, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '7px 10px', fontSize: 13, color: C.text,
    outline: 'none', boxSizing: 'border-box', width: '100%',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>ITEMS</span>
        <Btn onClick={addItem} style={{ background: C.surface2, color: C.accent, padding: '4px 10px', fontSize: 12 }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Agregar item
        </Btn>
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 13, background: C.surface2, borderRadius: 10 }}>
          Sin items. Haz clic en "Agregar item".
        </div>
      )}

      {items.map((item, idx) => (
        <div key={idx} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px', marginBottom: 8 }}>
          {/* Selector de producto del catálogo */}
          {catalogProducts.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <select
                value={item.product_id || ''}
                onChange={e => selectProduct(idx, e.target.value)}
                style={{ ...inputStyle, color: item.product_id ? C.text : C.muted, fontSize: 12 }}
              >
                <option value="">— Seleccionar del catálogo (opcional) —</option>
                {catalogProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmtPrice(p.price)}{p.unit ? ` / ${p.unit}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 80px 30px', gap: 8, alignItems: 'center', minWidth: 360 }}>
            {/* Descripción */}
            <input
              value={item.description}
              onChange={e => updateItem(idx, 'description', e.target.value)}
              placeholder="Descripción"
              style={inputStyle}
            />
            {/* Cantidad */}
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={item.qty}
              onChange={e => updateItem(idx, 'qty', e.target.value)}
              placeholder="Cant."
              style={{ ...inputStyle, textAlign: 'center' }}
            />
            {/* Precio unitario */}
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.unit_price}
              onChange={e => updateItem(idx, 'unit_price', e.target.value)}
              placeholder="Precio"
              style={inputStyle}
            />
            {/* Total línea */}
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'right' }}>
              {fmtPrice(item.total)}
            </div>
            {/* Eliminar */}
            <button
              type="button"
              onClick={() => removeItem(idx)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Panel de totales ──────────────────────────────────────────────────────────
function TotalesPanel({ items, discount, tax }) {
  const subtotal    = items.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.unit_price || 0)), 0);
  const discountAmt = subtotal * (Number(discount) / 100);
  const taxable     = subtotal - discountAmt;
  const taxAmt      = taxable * (Number(tax) / 100);
  const total       = taxable + taxAmt;

  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Row2 label="Subtotal" value={fmtPrice(subtotal)} />
      {Number(discount) > 0 && <Row2 label={`Descuento (${discount}%)`} value={`-${fmtPrice(discountAmt)}`} color={C.danger} />}
      {Number(tax) > 0      && <Row2 label={`Impuesto (${tax}%)`}      value={fmtPrice(taxAmt)} />}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>TOTAL</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{fmtPrice(total)}</span>
      </div>
    </div>
  );
}

function Row2({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: color || C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── Modal crear/editar cotización ─────────────────────────────────────────────
const EMPTY_QUOTE = {
  lead_id:     '',
  contact_id:  '',
  items:       [],
  discount:    0,
  tax:         0,
  valid_until: '',
  notes:       '',
  status:      'draft',
};

function QuoteModal({ quote, leads, catalogProducts, onClose, onSaved }) {
  const isEdit = !!quote;
  const [form,    setForm]    = useState(EMPTY_QUOTE);
  const [items,   setItems]   = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [showLeadDrop, setShowLeadDrop] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    if (quote) {
      setForm({
        lead_id:     quote.lead_id     || '',
        contact_id:  quote.contact_id  || '',
        items:       [],
        discount:    quote.discount    || 0,
        tax:         quote.tax         || 0,
        valid_until: quote.valid_until ? quote.valid_until.slice(0, 10) : '',
        notes:       quote.notes       || '',
        status:      quote.status      || 'draft',
      });
      const existingItems = Array.isArray(quote.items) ? quote.items : [];
      setItems(existingItems.map(it => ({
        description: it.description || '',
        qty:         Number(it.qty || 1),
        unit_price:  String(it.unit_price || 0),
        total:       Number(it.total || 0),
        product_id:  it.product_id || null,
      })));
      if (quote.lead_id && quote.lead_title) {
        setSelectedLead({ id: quote.lead_id, title: quote.lead_title });
        setLeadSearch(quote.lead_title);
      }
    } else {
      setForm(EMPTY_QUOTE);
      setItems([]);
      setSelectedLead(null);
      setLeadSearch('');
    }
  }, [quote]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Buscar leads
  useEffect(() => {
    if (!leadSearch.trim() || selectedLead) {
      setLeadResults([]);
      setShowLeadDrop(false);
      return;
    }
    const filtered = leads.filter(l =>
      l.title.toLowerCase().includes(leadSearch.toLowerCase())
    ).slice(0, 8);
    setLeadResults(filtered);
    setShowLeadDrop(filtered.length > 0);
  }, [leadSearch, leads, selectedLead]);

  const selectLead = (lead) => {
    setSelectedLead(lead);
    setLeadSearch(lead.title);
    set('lead_id', lead.id);
    if (lead.contact_id) set('contact_id', lead.contact_id);
    setShowLeadDrop(false);
  };

  const clearLead = () => {
    setSelectedLead(null);
    setLeadSearch('');
    set('lead_id', '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { setError('Agrega al menos un item'); return; }
    for (const it of items) {
      if (!it.description.trim()) { setError('Todos los items deben tener descripción'); return; }
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        lead_id:     form.lead_id     || null,
        contact_id:  form.contact_id  || null,
        items:       items.map(it => ({
          description: it.description,
          qty:         Number(it.qty),
          unit_price:  Number(it.unit_price),
          total:       Number(it.total),
          product_id:  it.product_id || null,
        })),
        discount:    Number(form.discount) || 0,
        tax:         Number(form.tax)      || 0,
        valid_until: form.valid_until || null,
        notes:       form.notes       || null,
        status:      form.status,
      };
      if (isEdit) {
        await api.updateQuote(quote.id, payload);
      } else {
        await api.createQuote(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', background: C.surface2, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.text,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, color: C.muted, marginBottom: 5, display: 'block', fontWeight: 500 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '93vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.surface, zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
            {isEdit ? `Editar Cotización ${quote.quote_number}` : 'Nueva Cotización'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Lead + Estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
            {/* Buscador de Lead */}
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Lead asociado</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); if (selectedLead) clearLead(); }}
                  placeholder="Buscar lead por nombre..."
                  style={{ ...inputStyle, paddingRight: selectedLead ? 32 : 12 }}
                  autoComplete="off"
                />
                {selectedLead && (
                  <button type="button" onClick={clearLead}
                    style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2, display: 'flex' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              {/* Dropdown leads */}
              {showLeadDrop && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden', marginTop: 2 }}>
                  {leadResults.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => selectLead(l)}
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {l.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Estado */}
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="accepted">Aceptada</option>
                <option value="rejected">Rechazada</option>
                <option value="expired">Vencida</option>
              </select>
            </div>
          </div>

          {/* Válida hasta + Notas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Válida hasta</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={e => set('valid_until', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Descuento (%) / Impuesto (%)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.discount}
                  onChange={e => set('discount', e.target.value)}
                  placeholder="Desc %"
                  style={inputStyle}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.tax}
                  onChange={e => set('tax', e.target.value)}
                  placeholder="IVA %"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <ItemsEditor items={items} setItems={setItems} catalogProducts={catalogProducts} />
          </div>

          {/* Totales en tiempo real */}
          {items.length > 0 && (
            <TotalesPanel items={items} discount={form.discount} tax={form.tax} />
          )}

          {/* Notas */}
          <div>
            <label style={labelStyle}>Notas</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Condiciones, observaciones, términos..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(255,91,91,0.1)', border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.danger }}>
              {error}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn onClick={onClose} style={{ background: C.surface2, color: C.muted }}>Cancelar</Btn>
            <Btn type="submit" disabled={saving} style={{ background: C.accent, color: '#fff' }}>
              {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear cotización')}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: '',         label: 'Todas'     },
  { key: 'draft',    label: 'Borrador'  },
  { key: 'sent',     label: 'Enviadas'  },
  { key: 'accepted', label: 'Aceptadas' },
  { key: 'rejected', label: 'Rechazadas'},
  { key: 'expired',  label: 'Vencidas'  },
];

export default function CotizacionesPage() {
  const [quotes,   setQuotes]   = useState([]);
  const [leads,    setLeads]    = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [tabStatus, setTabStatus] = useState('');

  const [modalOpen,  setModalOpen]  = useState(false);
  const [editQuote,  setEditQuote]  = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [changingStatus, setChangingStatus] = useState(null); // { quoteId, status }

  // ── Cargar datos ────────────────────────────────────────────────────────────
  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search)    q.set('search', search);
      if (tabStatus) q.set('status', tabStatus);
      const qs = q.toString() ? `?${q.toString()}` : '';
      const data = await api.quotes(qs);
      setQuotes(data.quotes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, tabStatus]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  useEffect(() => {
    api.leads('?page=1').then(d => setLeads(d.leads || [])).catch(() => {});
    api.products('?is_active=true').then(d => setProducts(d.products || [])).catch(() => {});
  }, []);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalCount    = quotes.length;
  const draftCount    = quotes.filter(q => q.status === 'draft').length;
  const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
  const totalValue    = quotes.reduce((s, q) => s + Number(q.total || 0), 0);

  // ── Acciones ────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditQuote(null); setModalOpen(true); };
  const openEdit   = (q) => { setEditQuote(q);   setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditQuote(null); };
  const handleSaved = () => { closeModal(); loadQuotes(); };

  const doDelete = async () => {
    if (!delConfirm) return;
    try {
      await api.deleteQuote(delConfirm.id);
      setDelConfirm(null);
      loadQuotes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownloadPdf = async (quote) => {
    setDownloading(quote.id);
    try {
      const data = await api.quotePdf(quote.id);
      if (!data.pdf) throw new Error('No se recibió PDF');
      const bytes  = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
      const blob   = new Blob([bytes], { type: 'application/pdf' });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement('a');
      a.href       = url;
      a.download   = data.filename || `${quote.quote_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleChangeStatus = async (quoteId, newStatus) => {
    setChangingStatus({ quoteId, status: newStatus });
    try {
      await api.quoteStatus(quoteId, newStatus);
      loadQuotes();
    } catch (err) {
      alert(err.message);
    } finally {
      setChangingStatus(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 24px 60px', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Cotizaciones</span>
          <span style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 12, color: C.muted, fontWeight: 600 }}>
            {totalCount}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Búsqueda */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cotizaciones..."
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, color: C.text, outline: 'none', width: 210 }}
            />
          </div>

          <Btn onClick={openCreate} style={{ background: C.accent, color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 14 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Nueva Cotización
          </Btn>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total"    value={totalCount}       color={C.text}    />
        <StatCard label="Borrador" value={draftCount}       color={C.muted}   />
        <StatCard label="Aceptadas" value={acceptedCount}   color={C.success} />
        <StatCard label="Valor total" value={fmtPrice(totalValue)} color={C.accent} />
      </div>

      {/* ── Tabs de estado ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTabStatus(tab.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              color: tabStatus === tab.key ? C.accent : C.muted,
              borderBottom: tabStatus === tab.key ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {tab.key === '' && totalCount > 0 && (
              <span style={{ marginLeft: 6, background: C.surface2, borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>{totalCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tabla ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', overflowX: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 110px 110px 130px 150px', borderBottom: `1px solid ${C.border}`, padding: '0 16px' }}>
          {['Número', 'Lead / Cliente', 'Total', 'Estado', 'Válida hasta', 'Creada', 'Acciones'].map(h => (
            <div key={h} style={{ padding: '12px 8px', fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: C.muted }}>
            <div style={{ display: 'inline-block', width: 22, height: 22, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Empty */}
        {!loading && quotes.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.muted }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ marginBottom: 12, opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V6a2 2 0 012-2h2a2 2 0 012 2v1M9 7h6" />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Sin cotizaciones</div>
            <div style={{ fontSize: 13 }}>Crea la primera cotización con el botón "+ Nueva Cotización"</div>
          </div>
        )}

        {/* Rows */}
        {!loading && quotes.map((q, i) => (
          <div
            key={q.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 140px 110px 110px 130px 150px',
              padding: '0 16px',
              borderBottom: i < quotes.length - 1 ? `1px solid ${C.border}` : 'none',
              background: 'transparent',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surface2}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* Número */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{q.quote_number}</span>
            </div>

            {/* Lead / Cliente */}
            <div style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {q.lead_title || q.contact_name || <span style={{ color: C.muted }}>Sin lead</span>}
              </span>
              {q.lead_title && q.contact_name && (
                <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {q.contact_name}
                </span>
              )}
            </div>

            {/* Total */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmtPrice(q.total)}</span>
            </div>

            {/* Estado */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <StatusBadge status={q.status} />
              </div>
            </div>

            {/* Válida hasta */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.muted }}>{fmtDate(q.valid_until)}</span>
            </div>

            {/* Fecha creación */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.muted }}>{fmtDate(q.created_at)}</span>
            </div>

            {/* Acciones */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Cambiar estado (select rápido) */}
              <select
                value={q.status}
                onChange={e => handleChangeStatus(q.id, e.target.value)}
                disabled={changingStatus?.quoteId === q.id}
                title="Cambiar estado"
                style={{
                  background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6,
                  padding: '4px 6px', fontSize: 11, color: C.text, cursor: 'pointer', outline: 'none',
                  opacity: changingStatus?.quoteId === q.id ? 0.5 : 1,
                }}
              >
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="accepted">Aceptada</option>
                <option value="rejected">Rechazada</option>
                <option value="expired">Vencida</option>
              </select>

              {/* Descargar PDF */}
              <button
                onClick={() => handleDownloadPdf(q)}
                disabled={downloading === q.id}
                title="Descargar PDF"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, padding: 5, borderRadius: 6, display: 'flex', opacity: downloading === q.id ? 0.5 : 1 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>

              {/* Editar */}
              <button
                onClick={() => openEdit(q)}
                title="Editar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, padding: 5, borderRadius: 6, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>

              {/* Eliminar */}
              <button
                onClick={() => setDelConfirm(q)}
                title="Eliminar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, padding: 5, borderRadius: 6, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,91,91,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modals ── */}
      {modalOpen && (
        <QuoteModal
          quote={editQuote}
          leads={leads}
          catalogProducts={products}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {/* ── Delete confirm ── */}
      {delConfirm && (
        <div onClick={() => setDelConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,91,91,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" fill="none" stroke={C.danger} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Eliminar cotización</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
              ¿Seguro que deseas eliminar <strong style={{ color: C.text }}>{delConfirm.quote_number}</strong>? Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn onClick={() => setDelConfirm(null)} style={{ background: C.surface2, color: C.muted, padding: '9px 20px' }}>Cancelar</Btn>
              <Btn onClick={doDelete} style={{ background: C.danger, color: '#fff', padding: '9px 20px' }}>Eliminar</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
