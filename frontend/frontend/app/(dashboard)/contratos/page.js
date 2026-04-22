'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import SignaturePanel from './SignaturePanel';

// ── Palette ──────────────────────────────────────────────────────────────────
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

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABEL = { pending: 'Pendiente', signed: 'Firmado', expired: 'Vencido' };
const STATUS_COLOR = { pending: C.warning, signed: C.success, expired: C.danger };
const STATUS_BG    = { pending: 'rgba(245,158,11,0.12)', signed: 'rgba(0,201,167,0.12)', expired: 'rgba(255,91,91,0.12)' };

function StatusBadge({ status }) {
  const label = STATUS_LABEL[status] || status;
  const color = STATUS_COLOR[status] || C.muted;
  const bg    = STATUS_BG[status]    || 'rgba(120,128,160,0.12)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function PdfIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: C.danger, flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function Btn({ onClick, children, style = {}, disabled = false, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 500, opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      {children}
    </button>
  );
}

// ── Mini stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, color = C.text }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', flex: '1 1 140px', minWidth: 130 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── File input helper ─────────────────────────────────────────────────────────
function handleFileRead(file, onResult) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB'); return; }
  if (file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    onResult({
      file_base64: e.target.result,
      file_name:   file.name,
      file_size:   file.size,
    });
  };
  reader.readAsDataURL(file);
}

// ── Download helper ───────────────────────────────────────────────────────────
function downloadContract(contract) {
  if (!contract.file_base64) return;
  const a = document.createElement('a');
  a.href = contract.file_base64;
  a.download = contract.file_name || 'contrato.pdf';
  a.click();
}

// ── Form modal ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title:       '',
  contact_id:  '',
  lead_id:     '',
  status:      'pending',
  signed_at:   '',
  notes:       '',
  file_base64: null,
  file_name:   null,
  file_size:   null,
};

function ContractModal({ contract, contacts, leads, onClose, onSaved }) {
  const isEdit = !!contract;
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [replaceFile, setReplaceFile] = useState(false);

  useEffect(() => {
    if (contract) {
      setForm({
        title:       contract.title       || '',
        contact_id:  contract.contact_id  || '',
        lead_id:     contract.lead_id     || '',
        status:      contract.status      || 'pending',
        signed_at:   contract.signed_at   ? contract.signed_at.slice(0, 10) : '',
        notes:       contract.notes       || '',
        file_base64: null,  // don't load existing base64 into form state (large)
        file_name:   contract.file_name   || null,
        file_size:   contract.file_size   || null,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [contract]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileRead(file, (result) => {
      setForm(prev => ({ ...prev, ...result }));
      setReplaceFile(true);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('El título es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:      form.title.trim(),
        contact_id: form.contact_id || null,
        lead_id:    form.lead_id    || null,
        status:     form.status,
        signed_at:  form.status === 'signed' && form.signed_at ? form.signed_at : null,
        notes:      form.notes || null,
      };
      // Only include file fields if a new file was selected
      if (form.file_base64) {
        payload.file_base64 = form.file_base64;
        payload.file_name   = form.file_name;
        payload.file_size   = form.file_size;
      }
      if (isEdit) {
        await api.updateContract(contract.id, payload);
      } else {
        await api.createContract(payload);
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
            {isEdit ? 'Editar Contrato' : 'Nuevo Contrato'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Título del contrato *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ej: Contrato de servicios"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Contact + Lead */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Cliente</label>
              <select value={form.contact_id} onChange={e => set('contact_id', e.target.value)} style={inputStyle}>
                <option value="">— Sin cliente —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lead relacionado</label>
              <select value={form.lead_id} onChange={e => set('lead_id', e.target.value)} style={inputStyle}>
                <option value="">— Sin lead —</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status + Signed at */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
                <option value="pending">Pendiente</option>
                <option value="signed">Firmado</option>
                <option value="expired">Vencido</option>
              </select>
            </div>
            {form.status === 'signed' && (
              <div>
                <label style={labelStyle}>Fecha de firma</label>
                <input
                  type="date"
                  value={form.signed_at}
                  onChange={e => set('signed_at', e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notas</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Observaciones, condiciones..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* File */}
          <div>
            <label style={labelStyle}>Archivo PDF</label>
            {isEdit && contract.file_name && !replaceFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PdfIcon />
                  <span style={{ fontSize: 13, color: C.text }}>{contract.file_name}</span>
                  {contract.file_size && <span style={{ fontSize: 11, color: C.muted }}>({fmtSize(contract.file_size)})</span>}
                </div>
                <button type="button" onClick={() => setReplaceFile(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accent, padding: 0 }}>
                  Reemplazar
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFile}
                  id="contract-file-input"
                  style={{ display: 'none' }}
                />
                <label htmlFor="contract-file-input" style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: C.surface2,
                  border: `1px dashed ${C.border}`, borderRadius: 10, padding: '12px 16px',
                  cursor: 'pointer', color: C.muted, fontSize: 13,
                }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {form.file_name ? (
                    <span style={{ color: C.text }}>{form.file_name} ({fmtSize(form.file_size)})</span>
                  ) : (
                    <span>Seleccionar PDF (máx. 10 MB)</span>
                  )}
                </label>
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(255,91,91,0.1)', border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.danger }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn onClick={onClose} style={{ background: C.surface2, color: C.muted }}>Cancelar</Btn>
            <Btn
              onClick={undefined}
              disabled={saving}
              style={{ background: C.accent, color: '#fff' }}
            >
              {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear contrato')}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ contract, onClose, onEdit, onDelete, onDownload, onPreview }) {
  if (!contract) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{contract.title}</div>
            <StatusBadge status={contract.status} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Cliente"    value={contract.contact_name || <span style={{ color: C.muted }}>—</span>} />
          <Row label="Lead"       value={contract.lead_title   || <span style={{ color: C.muted }}>—</span>} />
          <Row label="Creado por" value={contract.created_by_name || '—'} />
          <Row label="Fecha"      value={fmtDate(contract.created_at)} />
          {contract.signed_at && <Row label="Firmado" value={fmtDate(contract.signed_at)} />}
          {contract.notes && (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Notas</div>
              <div style={{ background: C.surface2, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.text, lineHeight: 1.5 }}>{contract.notes}</div>
            </div>
          )}
          {contract.file_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, borderRadius: 10, padding: '10px 12px' }}>
              <PdfIcon />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contract.file_name}</div>
                {contract.file_size && <div style={{ fontSize: 11, color: C.muted }}>{fmtSize(contract.file_size)}</div>}
              </div>
            </div>
          )}

          {/* Firma electrónica */}
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Firma Electrónica</div>
            <SignaturePanel
              contractId={contract.id}
              contractStatus={contract.status}
              onStatusChange={() => { /* parent can reload if needed */ }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {contract.file_name && (
            <>
              <Btn onClick={() => onPreview(contract)} style={{ background: 'rgba(59,130,246,0.12)', color: C.accent }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Ver PDF
              </Btn>
              <Btn onClick={() => onDownload(contract)} style={{ background: 'rgba(0,201,167,0.12)', color: C.success }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Descargar
              </Btn>
            </>
          )}
          <Btn onClick={() => onEdit(contract)} style={{ background: 'rgba(59,130,246,0.12)', color: C.accent }}>Editar</Btn>
          <Btn onClick={() => onDelete(contract)} style={{ background: 'rgba(255,91,91,0.1)', color: C.danger }}>Eliminar</Btn>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 12, color: C.muted, width: 90, flexShrink: 0, paddingTop: 1 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text, flex: 1 }}>{value}</div>
    </div>
  );
}

function PdfPreviewModal({ url, filename, onClose }) {
  // iOS Safari doesn't support <embed> for PDFs — open in new tab instead
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(url, '_blank');
    onClose();
    return null;
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{filename}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={url} download={filename}
            style={{ background: C.success, border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            ⬇ Descargar
          </a>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ flex: 1, overflow: 'hidden' }}>
        <embed src={url} type="application/pdf" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ContratosPage() {
  const [contracts, setContracts]       = useState([]);
  const [contacts,  setContacts]        = useState([]);
  const [leads,     setLeads]           = useState([]);
  const [loading,   setLoading]         = useState(true);
  const [search,    setSearch]          = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editContract, setEditContract] = useState(null);
  const [detailContract, setDetailContract] = useState(null);

  const [delConfirm, setDelConfirm]     = useState(null); // contract to delete
  const [downloading, setDownloading]   = useState(null); // contract id
  const [previewPdf, setPreviewPdf] = useState(null); // { url, filename }

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search)       q.set('search', search);
      if (statusFilter) q.set('status', statusFilter);
      const qs = q.toString() ? `?${q.toString()}` : '';
      const data = await api.contracts(qs);
      setContracts(data.contracts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  useEffect(() => {
    // Load contacts and leads for selects (first 200 only)
    api.contacts('?page=1').then(d => setContacts(d.contacts || [])).catch(() => {});
    api.leads('?page=1').then(d => setLeads(d.leads || [])).catch(() => {});
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total     = contracts.length;
  const pending   = contracts.filter(c => c.status === 'pending').length;
  const signed    = contracts.filter(c => c.status === 'signed').length;
  const now       = new Date();
  const thisMonth = contracts.filter(c => {
    const d = new Date(c.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // ── Actions ────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditContract(null); setModalOpen(true); };
  const openEdit   = (c) => { setDetailContract(null); setEditContract(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditContract(null); };

  const handleSaved = () => { closeModal(); loadContracts(); };

  const confirmDelete = (c) => { setDetailContract(null); setDelConfirm(c); };
  const doDelete = async () => {
    if (!delConfirm) return;
    try {
      await api.deleteContract(delConfirm.id);
      setDelConfirm(null);
      loadContracts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownload = async (contract) => {
    setDownloading(contract.id);
    try {
      // If we already have file_base64 in the object (detail), use it directly
      if (contract.file_base64) {
        downloadContract(contract);
      } else {
        // Otherwise fetch the full contract with base64
        const full = await api.contract(contract.id);
        downloadContract(full);
      }
    } catch (err) {
      alert('Error al descargar: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (contract) => {
    try {
      let c = contract;
      if (!c.file_base64) c = await api.contract(contract.id);
      const data = c.data || c;
      if (!data.file_base64) return alert('Sin archivo PDF');
      const bytes = Uint8Array.from(atob(data.file_base64), ch => ch.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewPdf({ url, filename: data.file_name || 'contrato.pdf' });
    } catch (e) {
      alert('Error al cargar PDF: ' + e.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 24px 60px', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Contratos</span>
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
              placeholder="Buscar contratos..."
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, color: C.text, outline: 'none', width: 210 }}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: statusFilter ? C.text : C.muted, outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="signed">Firmado</option>
            <option value="expired">Vencido</option>
          </select>

          {/* New button */}
          <Btn onClick={openCreate} style={{ background: C.accent, color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 14 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Nuevo Contrato
          </Btn>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total contratos" value={total}     color={C.text} />
        <StatCard label="Pendientes"      value={pending}   color={C.warning} />
        <StatCard label="Firmados"        value={signed}    color={C.success} />
        <StatCard label="Este mes"        value={thisMonth} color={C.accent} />
      </div>

      {/* ── Table ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', overflowX: 'auto' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 140px 140px 110px 160px 100px 120px 100px', gap: 0, borderBottom: `1px solid ${C.border}`, padding: '0 16px' }}>
          {['#', 'Título', 'Cliente', 'Lead', 'Estado', 'Archivo', 'Fecha', 'Creado por', 'Acciones'].map(h => (
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
        {!loading && contracts.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.muted }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ marginBottom: 12, opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Sin contratos</div>
            <div style={{ fontSize: 13 }}>Crea el primer contrato con el botón "+ Nuevo Contrato"</div>
          </div>
        )}

        {/* Rows */}
        {!loading && contracts.map((c, i) => (
          <div key={c.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr 140px 140px 110px 160px 100px 120px 100px',
              gap: 0,
              padding: '0 16px',
              borderBottom: i < contracts.length - 1 ? `1px solid ${C.border}` : 'none',
              background: 'transparent',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surface2}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* ID */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ background: C.surface2, borderRadius: 6, padding: '2px 7px', fontSize: 11, color: C.muted, fontWeight: 600 }}>#{c.id}</span>
            </div>

            {/* Title */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <button onClick={() => setDetailContract(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200, transition: 'color 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.color = C.accent}
                  onMouseLeave={e => e.currentTarget.style.color = C.text}>
                  {c.title}
                </span>
              </button>
            </div>

            {/* Contact */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 13, color: c.contact_name ? C.text : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.contact_name || '—'}
              </span>
            </div>

            {/* Lead */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 13, color: c.lead_title ? C.text : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.lead_title || '—'}
              </span>
            </div>

            {/* Status */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <StatusBadge status={c.status} />
            </div>

            {/* File */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {c.file_name ? (
                <>
                  <PdfIcon />
                  <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{c.file_name}</span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: C.muted }}>—</span>
              )}
            </div>

            {/* Date */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.muted }}>{fmtDate(c.signed_at || c.created_at)}</span>
            </div>

            {/* Created by */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.created_by_name || '—'}
              </span>
            </div>

            {/* Actions */}
            <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {c.file_name && (
                <button
                  onClick={() => handleDownload(c)}
                  disabled={downloading === c.id}
                  title="Descargar PDF"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.success, padding: 5, borderRadius: 6, display: 'flex', opacity: downloading === c.id ? 0.5 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,201,167,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
              )}
              <button
                onClick={() => openEdit(c)}
                title="Editar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, padding: 5, borderRadius: 6, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button
                onClick={() => confirmDelete(c)}
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
        <ContractModal
          contract={editContract}
          contacts={contacts}
          leads={leads}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {detailContract && (
        <DetailModal
          contract={detailContract}
          onClose={() => setDetailContract(null)}
          onEdit={openEdit}
          onDelete={confirmDelete}
          onDownload={handleDownload}
          onPreview={handlePreview}
        />
      )}
      {previewPdf && (
        <PdfPreviewModal
          url={previewPdf.url}
          filename={previewPdf.filename}
          onClose={() => { URL.revokeObjectURL(previewPdf.url); setPreviewPdf(null); }}
        />
      )}

      {/* ── Delete confirm ── */}
      {delConfirm && (
        <div onClick={() => setDelConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,91,91,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" fill="none" stroke={C.danger} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Eliminar contrato</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
              ¿Seguro que deseas eliminar <strong style={{ color: C.text }}>{delConfirm.title}</strong>? Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn onClick={() => setDelConfirm(null)} style={{ background: C.surface2, color: C.muted, padding: '9px 20px' }}>Cancelar</Btn>
              <Btn onClick={doDelete} style={{ background: C.danger, color: '#fff', padding: '9px 20px' }}>Eliminar</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
