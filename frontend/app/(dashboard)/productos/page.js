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
function fmtPrice(n) {
  return `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', flex: '1 1 140px', minWidth: 130 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Modal crear/editar producto ───────────────────────────────────────────────
const EMPTY_FORM = {
  name:        '',
  description: '',
  price:       '',
  category:    '',
  unit:        '',
  is_active:   true,
};

function ProductModal({ product, categories, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [customCat, setCustomCat] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name:        product.name        || '',
        description: product.description || '',
        price:       product.price       !== undefined ? String(product.price) : '',
        category:    product.category    || '',
        unit:        product.unit        || '',
        is_active:   product.is_active   !== false,
      });
      // Si la categoría no está en la lista, activar entrada manual
      if (product.category && !categories.includes(product.category)) {
        setCustomCat(true);
      }
    } else {
      setForm(EMPTY_FORM);
      setCustomCat(false);
    }
  }, [product, categories]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())  { setError('El nombre es requerido'); return; }
    if (form.price === '' || isNaN(Number(form.price))) { setError('El precio debe ser un número válido'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description || null,
        price:       Number(form.price),
        category:    form.category    || null,
        unit:        form.unit        || null,
        is_active:   form.is_active,
      };
      if (isEdit) {
        await api.updateProduct(product.id, payload);
      } else {
        await api.createProduct(payload);
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
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
            {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nombre */}
          <div>
            <label style={labelStyle}>Nombre *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej: Consultoría mensual"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label style={labelStyle}>Descripción</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Descripción opcional del producto o servicio"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Precio + Unidad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Precio * ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                placeholder="0.00"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Unidad</label>
              <input
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                placeholder="Ej: hora, mes, unidad"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Categoría</label>
              <button
                type="button"
                onClick={() => { setCustomCat(!customCat); set('category', ''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accent, padding: 0 }}
              >
                {customCat ? 'Seleccionar existente' : 'Nueva categoría'}
              </button>
            </div>
            {customCat || categories.length === 0 ? (
              <input
                value={form.category}
                onChange={e => set('category', e.target.value)}
                placeholder="Ej: Servicios, Software, Hardware"
                style={inputStyle}
              />
            ) : (
              <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
                <option value="">— Sin categoría —</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          {/* Activo toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: form.is_active ? C.success : C.muted,
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: form.is_active ? 22 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
            <span style={{ fontSize: 13, color: C.text }}>
              {form.is_active ? 'Activo' : 'Inactivo'}
            </span>
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
              {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear producto')}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProductosPage() {
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('');
  const [activeFilter, setActiveFilter] = useState('true');

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [delConfirm,  setDelConfirm]  = useState(null);

  // ── Cargar datos ────────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search)       q.set('search',    search);
      if (catFilter)    q.set('category',  catFilter);
      if (activeFilter) q.set('is_active', activeFilter);
      const qs = q.toString() ? `?${q.toString()}` : '';
      const data = await api.products(qs);
      setProducts(data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, catFilter, activeFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    api.productCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  // ── Estadísticas ────────────────────────────────────────────────────────────
  const total      = products.length;
  const activos    = products.filter(p => p.is_active).length;
  const inactivos  = products.filter(p => !p.is_active).length;
  const avgPrice   = total > 0
    ? (products.reduce((s, p) => s + Number(p.price), 0) / total)
    : 0;

  // ── Acciones ────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditProduct(null); setModalOpen(true); };
  const openEdit   = (p) => { setEditProduct(p);   setModalOpen(true); };
  const closeModal = () => { setModalOpen(false);  setEditProduct(null); };
  const handleSaved = () => { closeModal(); loadProducts(); api.productCategories().then(d => setCategories(d.categories || [])).catch(() => {}); };

  const toggleActive = async (product) => {
    try {
      await api.updateProduct(product.id, { is_active: !product.is_active });
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  };

  const doDelete = async () => {
    if (!delConfirm) return;
    try {
      await api.deleteProduct(delConfirm.id);
      setDelConfirm(null);
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 24px 60px', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Catálogo de Productos</span>
          <span style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 12, color: C.muted, fontWeight: 600 }}>
            {total}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, color: C.text, outline: 'none', width: 200 }}
            />
          </div>

          {/* Filtro activo */}
          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: C.text, outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>

          <Btn onClick={openCreate} style={{ background: C.accent, color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 14 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Nuevo Producto
          </Btn>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total"     value={total}              color={C.text} />
        <StatCard label="Activos"   value={activos}            color={C.success} />
        <StatCard label="Inactivos" value={inactivos}          color={C.muted} />
        <StatCard label="Precio promedio" value={fmtPrice(avgPrice)} color={C.accent} />
      </div>

      {/* ── Filtros de categoría (pills) ── */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            onClick={() => setCatFilter('')}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600,
              background: catFilter === '' ? C.accent : C.surface2,
              color: catFilter === '' ? '#fff' : C.muted,
              transition: 'all 0.15s',
            }}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(catFilter === cat ? '' : cat)}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                background: catFilter === cat ? C.accent : C.surface2,
                color: catFilter === cat ? '#fff' : C.muted,
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Tabla ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', overflowX: 'auto' }}>
        {/* Header tabla */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 160px 110px 120px 90px 120px', borderBottom: `1px solid ${C.border}`, padding: '0 16px' }}>
          {['#', 'Nombre', 'Categoría', 'Precio', 'Unidad', 'Estado', 'Acciones'].map(h => (
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
        {!loading && products.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.muted }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ marginBottom: 12, opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Sin productos</div>
            <div style={{ fontSize: 13 }}>Crea el primer producto con el botón "+ Nuevo Producto"</div>
          </div>
        )}

        {/* Rows */}
        {!loading && products.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 160px 110px 120px 90px 120px',
              padding: '0 16px',
              borderBottom: i < products.length - 1 ? `1px solid ${C.border}` : 'none',
              background: 'transparent',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surface2}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* ID */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ background: C.surface2, borderRadius: 6, padding: '2px 7px', fontSize: 11, color: C.muted, fontWeight: 600 }}>#{p.id}</span>
            </div>

            {/* Nombre + descripción */}
            <div style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              {p.description && (
                <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{p.description}</span>
              )}
            </div>

            {/* Categoría */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              {p.category ? (
                <span style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {p.category}
                </span>
              ) : (
                <span style={{ color: C.muted, fontSize: 13 }}>—</span>
              )}
            </div>

            {/* Precio */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmtPrice(p.price)}</span>
            </div>

            {/* Unidad */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: p.unit ? C.muted : C.muted }}>
                {p.unit || '—'}
              </span>
            </div>

            {/* Toggle activo */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => toggleActive(p)}
                title={p.is_active ? 'Desactivar' : 'Activar'}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: p.is_active ? C.success : C.muted,
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: p.is_active ? 20 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Acciones */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => openEdit(p)}
                title="Editar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, padding: 5, borderRadius: 6, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button
                onClick={() => setDelConfirm(p)}
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
        <ProductModal
          product={editProduct}
          categories={categories}
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
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Eliminar producto</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
              ¿Seguro que deseas desactivar <strong style={{ color: C.text }}>{delConfirm.name}</strong>? El producto quedará inactivo.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn onClick={() => setDelConfirm(null)} style={{ background: C.surface2, color: C.muted, padding: '9px 20px' }}>Cancelar</Btn>
              <Btn onClick={doDelete} style={{ background: C.danger, color: '#fff', padding: '9px 20px' }}>Desactivar</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
