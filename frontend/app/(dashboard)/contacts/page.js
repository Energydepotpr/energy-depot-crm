'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';

const BASE = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

function ContactModal({ contact, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:    contact?.name    || '',
    phone:   contact?.phone   || '',
    email:   contact?.email   || '',
    company: contact?.company || '',
    notes:   contact?.notes   || '',
  });
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null); // { name, id } when 409

  const save = async (force = false) => {
    if (!form.name.trim()) return;
    setSaving(true);
    setDuplicate(null);
    try {
      if (contact) await api.updateContact(contact.id, form);
      else await api.createContact(force ? { ...form, force: true } : form);
      onSaved();
      onClose();
    } catch (e) {
      if (e.status === 409 && e.existing) {
        setDuplicate(e.existing);
      } else {
        alert(e.message);
      }
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-white mb-5">{contact ? 'Editar contacto' : 'Nuevo contacto'}</h2>
        <div className="space-y-3">
          {[
            { key: 'name',    label: 'Nombre *',   type: 'text',  placeholder: 'Juan Pérez' },
            { key: 'phone',   label: 'Teléfono',   type: 'tel',   placeholder: '+1234567890' },
            { key: 'email',   label: 'Email',      type: 'email', placeholder: 'correo@ejemplo.com' },
            { key: 'company', label: 'Empresa',    type: 'text',  placeholder: 'Nombre empresa' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-muted mb-1">{f.label}</label>
              <input className="input" type={f.type} placeholder={f.placeholder}
                value={form[f.key]} onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setDuplicate(null); }} />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted mb-1">Notas</label>
            <textarea className="input resize-none" rows={3} placeholder="Notas internas..."
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        {duplicate && (
          <div style={{ marginTop: 16, background: '#78350f20', border: '1px solid #f59e0b40', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              ⚠️ Ya existe: <strong>{duplicate.name}</strong>. ¿Crear de todas formas?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { onClose(); window.location.href = '/contacts'; }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid #2a3156', borderRadius: 8, padding: '7px 10px', color: '#e0e4f0', fontSize: 12, cursor: 'pointer' }}
              >
                Ver contacto existente
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                style={{ flex: 1, background: '#f59e0b20', border: '1px solid #f59e0b50', borderRadius: 8, padding: '7px 10px', color: '#f59e0b', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                {saving ? 'Guardando...' : 'Crear de todas formas'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={() => save(false)} disabled={saving || !form.name.trim()} className="btn-primary px-4 py-2 text-sm flex-1 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const CRM_FIELDS = [
  { value: 'name',    label: 'Nombre' },
  { value: 'phone',   label: 'Teléfono' },
  { value: 'email',   label: 'Email' },
  { value: 'company', label: 'Empresa' },
  { value: 'notes',   label: 'Notas' },
  { value: '_skip',   label: '— Ignorar columna —' },
];

function autoMapHeader(h) {
  const l = h.toLowerCase();
  if (l.includes('nombre') || l.includes('name')) return 'name';
  if (l.includes('telefono') || l.includes('phone') || l.includes('tel') || l.includes('móvil') || l.includes('movil')) return 'phone';
  if (l.includes('email') || l.includes('correo') || l.includes('mail')) return 'email';
  if (l.includes('empresa') || l.includes('company') || l.includes('organiz')) return 'company';
  if (l.includes('nota') || l.includes('note') || l.includes('comment') || l.includes('observ')) return 'notes';
  return '_skip';
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function ImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [step, setStep] = useState('upload'); // upload | map | preview | done
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split('\n').filter(Boolean);
      if (lines.length < 2) return;
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
      const rows = lines.slice(1).map(l => parseCSVLine(l).map(v => v.replace(/^"|"$/g, '').trim()));
      setRawHeaders(headers);
      setRawRows(rows);
      const autoMap = {};
      headers.forEach(h => { autoMap[h] = autoMapHeader(h); });
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(f, 'UTF-8');
  };

  const applyMapping = () => {
    return rawRows
      .map(row => {
        const obj = {};
        rawHeaders.forEach((h, i) => {
          const field = mapping[h];
          if (field && field !== '_skip') obj[field] = row[i] || '';
        });
        return obj;
      })
      .filter(r => r.name && r.name.trim());
  };

  const importar = async () => {
    const rows = applyMapping();
    if (rows.length === 0) { alert('No hay filas con nombre válido'); return; }
    setImporting(true);
    try {
      const res = await api.importContacts(rows);
      setResult(res);
      setStep('done');
      onImported();
    } catch (e) { alert(e.message); }
    setImporting(false);
  };

  const previewRows = applyMapping().slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="card p-6 w-full max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Importar contactos desde CSV</h2>
          {step !== 'upload' && step !== 'done' && (
            <span className="text-xs text-muted">Paso {step === 'map' ? '1' : '2'} de 2</span>
          )}
        </div>

        {step === 'upload' && (
          <>
            <p className="text-xs text-muted mb-5">La primera fila debe ser el encabezado. Luego podrás mapear las columnas.</p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-accent/50 rounded-xl p-10 text-center cursor-pointer transition-colors"
            >
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onFileChange} />
              <svg className="w-8 h-8 text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-muted">Click para seleccionar CSV</p>
            </div>
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm w-full mt-4">Cancelar</button>
          </>
        )}

        {step === 'map' && (
          <>
            <p className="text-xs text-muted mb-4">Asigna cada columna del CSV al campo correspondiente.</p>
            <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
              {rawHeaders.map(h => (
                <div key={h} className="flex items-center gap-3">
                  <div className="flex-1 text-sm text-white font-mono bg-surface2 rounded px-2 py-1.5 truncate">{h}</div>
                  <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <select
                    className="input text-sm flex-1"
                    value={mapping[h] || '_skip'}
                    onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                  >
                    {CRM_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('preview')} disabled={!Object.values(mapping).includes('name')}
                className="btn-primary px-4 py-2 text-sm flex-1 disabled:opacity-50">
                Ver vista previa →
              </button>
              <button onClick={() => setStep('upload')} className="btn-ghost px-4 py-2 text-sm">Atrás</button>
            </div>
            {!Object.values(mapping).includes('name') && (
              <p className="text-xs text-danger mt-2">Debes mapear al menos la columna "Nombre".</p>
            )}
          </>
        )}

        {step === 'preview' && (
          <>
            <p className="text-xs text-muted mb-3">Vista previa ({previewRows.length} de {applyMapping().length} filas):</p>
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-xs">
                <thead><tr className="text-muted border-b border-border">
                  {['Nombre','Teléfono','Email','Empresa'].map(h => <th key={h} className="text-left pb-1.5 pr-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-1.5 pr-3 text-white">{r.name || '—'}</td>
                      <td className="py-1.5 pr-3 text-muted">{r.phone || '—'}</td>
                      <td className="py-1.5 pr-3 text-muted">{r.email || '—'}</td>
                      <td className="py-1.5 text-muted">{r.company || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={importar} disabled={importing}
                className="btn-primary px-4 py-2 text-sm flex-1 disabled:opacity-50">
                {importing ? 'Importando...' : `Importar ${applyMapping().length} contactos`}
              </button>
              <button onClick={() => setStep('map')} className="btn-ghost px-4 py-2 text-sm">Atrás</button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <>
            <div className="bg-success/10 border border-success/20 rounded-lg px-4 py-4 mb-4 text-center">
              <div className="text-2xl mb-2">✅</div>
              <div className="text-sm font-medium text-success">Importación completada</div>
              <div className="text-xs text-muted mt-1">{result.creados} contactos creados · {result.omitidos} omitidos (duplicados)</div>
            </div>
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm w-full">Cerrar</button>
          </>
        )}
      </div>
    </div>
  );
}

function DuplicatesModal({ onClose, onMerged }) {
  const [dupes, setDupes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(null); // pair index being merged

  useEffect(() => {
    api.findDuplicates()
      .then(setDupes)
      .catch(e => alert(e.message))
      .finally(() => setLoading(false));
  }, []);

  const merge = async (keepId, discardId, idx) => {
    setMerging(idx);
    try {
      await api.mergeContacts(keepId, discardId);
      setDupes(prev => prev.filter((_, i) => i !== idx));
      onMerged();
    } catch (e) { alert(e.message); }
    setMerging(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="card p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Detectar duplicados</h2>
            <p className="text-xs text-muted mt-0.5">Contactos con el mismo teléfono o nombre idéntico</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted text-sm">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Buscando duplicados...
            </div>
          )}
          {!loading && dupes.length === 0 && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-sm text-muted">No se encontraron contactos duplicados</p>
            </div>
          )}
          {dupes.map((d, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4 mb-3 bg-bg">
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: d.reason === 'phone' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: d.reason === 'phone' ? '#f59e0b' : '#60a5fa', fontWeight: 600 }}>
                  {d.reason === 'phone' ? '📞 Mismo teléfono' : '👤 Mismo nombre'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[{ id: d.id1, name: d.name1, phone: d.phone1, email: d.email1 }, { id: d.id2, name: d.name2, phone: d.phone2, email: d.email2 }].map((c, ci) => (
                  <div key={ci} className="bg-surface rounded-lg p-3">
                    <div className="text-sm font-medium text-white">{c.name}</div>
                    {c.phone && <div className="text-xs text-muted mt-1">📞 {c.phone}</div>}
                    {c.email && <div className="text-xs text-muted mt-0.5">✉️ {c.email}</div>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => merge(d.id1, d.id2, idx)}
                  disabled={merging === idx}
                  style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', cursor: 'pointer', opacity: merging === idx ? 0.5 : 1 }}
                >
                  {merging === idx ? 'Combinando...' : `Mantener "${d.name1}"`}
                </button>
                <button
                  onClick={() => merge(d.id2, d.id1, idx)}
                  disabled={merging === idx}
                  style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', cursor: 'pointer', opacity: merging === idx ? 0.5 : 1 }}
                >
                  {merging === idx ? 'Combinando...' : `Mantener "${d.name2}"`}
                </button>
                <button
                  onClick={() => setDupes(prev => prev.filter((_, i) => i !== idx))}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                >
                  Omitir
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm w-full">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

const AVATAR_COLORS = [
  '#1b9af5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#1b9af5',
];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
}

const S = {
  page:    { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'inherit' },
  topBar:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexWrap: 'wrap', gap: 10 },
  topLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  title:   { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' },
  badge:   { background: 'var(--surface2)', color: 'var(--muted)', fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 8px' },
  topRight:{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  searchWrap: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' },
  searchInput: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, fontSize: 13, color: 'var(--text)', outline: 'none', width: 200 },
  btnGhost: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' },
  btnPrimary: { background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  tableWrap: { margin: '0 24px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  thead:   { background: 'var(--surface2)' },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  thCheck: { padding: '10px 14px', width: 36, borderBottom: '1px solid var(--border)' },
  td:      { padding: '0 14px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)', height: 48, verticalAlign: 'middle', whiteSpace: 'nowrap' },
  tdMuted: { padding: '0 14px', fontSize: 13, color: 'var(--muted)', borderBottom: '1px solid var(--border)', height: 48, verticalAlign: 'middle', whiteSpace: 'nowrap' },
  avatar:  { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 },
  nameBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontWeight: 500, padding: 0, textAlign: 'left' },
  tag:     { display: 'inline-flex', alignItems: 'center', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600, marginRight: 4 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: 'var(--muted)', display: 'flex', alignItems: 'center' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px 24px' },
  pageBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 11px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer' },
  pageBtnActive: { background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, padding: '5px 11px', fontSize: 13, color: '#fff', fontWeight: 700, cursor: 'pointer' },
};

const TAG_COLORS = [
  { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
];
function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

export default function ContactsPage() {
  const router = useRouter();
  const { lang } = useLang();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [hoveredRow, setHoveredRow] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [dupesModal, setDupesModal] = useState(false);
  const [filterSource, setFilterSource] = useState('');
  const [filterSmallGroup, setFilterSmallGroup] = useState(false);
  // contact_ids with small-group leads (cached after first load)
  const [smallGroupContactIds, setSmallGroupContactIds] = useState(null);
  const [generatingPortal, setGeneratingPortal] = useState(null); // contact id

  const generatePortal = async (contactId, contactName) => {
    setGeneratingPortal(contactId);
    try {
      const data = await api.portalToken(contactId);
      if (data.link) {
        await navigator.clipboard.writeText(data.link).catch(() => {});
        alert(`Portal generado para ${contactName}:\n\n${data.link}\n\n(Enlace copiado al portapapeles)`);
      }
    } catch (err) {
      alert('Error al generar portal: ' + err.message);
    } finally {
      setGeneratingPortal(null);
    }
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const exportCSV = () => {
    const headers = ['Nombre', 'Teléfono', 'Email', 'Empresa', 'Notas'];
    const rows = contacts.map(c => [
      c.name || '',
      c.phone || '',
      c.email || '',
      c.company || '',
      (c.notes || '').replace(/\n/g, ' '),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contactos-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cargar = (p = 1, s = search, src = filterSource) => {
    setLoading(true);
    const q = new URLSearchParams({ page: p, limit: PAGE_SIZE, ...(s ? { search: s } : {}), ...(src ? { source: src } : {}) }).toString();
    api.contacts(`?${q}`)
      .then(d => { setContacts(d.contacts || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(1, search, filterSource); setPage(1); }, [search, filterSource]);

  // Load small-group contact ids from leads when filter is activated
  useEffect(() => {
    if (!filterSmallGroup || smallGroupContactIds !== null) return;
    api.leads().then(leads => {
      const arr = Array.isArray(leads) ? leads : [];
      const ids = new Set(
        arr
          .filter(l => !l.cantidad_personas || Number(l.cantidad_personas) <= 4)
          .map(l => l.contact_id)
          .filter(Boolean)
      );
      setSmallGroupContactIds(ids);
    }).catch(() => setSmallGroupContactIds(new Set()));
  }, [filterSmallGroup]);

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este contacto?')) return;
    try {
      await api.deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      if (e.leads_count !== undefined) {
        alert(`No se puede eliminar: este contacto tiene ${e.leads_count || 'varios'} leads. Elimínalos primero.`);
      } else {
        alert(e.message);
      }
      cargar();
    }
  };

  const exportar = () => {
    const token = localStorage.getItem('crm_token');
    const url = `${BASE}/api/contacts/export`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contactos.csv';
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob);
        a.click();
      });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  };

  const COLS = ['', 'Nombre', 'Empresa', 'Teléfono', 'Email', 'Tags', 'Creado', ''];

  // Apply small-group filter client-side (contacts whose leads have cantidad_personas <= 4 or null)
  const contactosFiltrados = filterSmallGroup && smallGroupContactIds
    ? contacts.filter(c => smallGroupContactIds.has(c.id))
    : contacts;

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={{ ...S.topBar, padding: isMobile ? '10px 12px' : '14px 24px' }}>
        <div style={S.topLeft}>
          <span style={S.title}>{t('nav.contacts', lang)}</span>
          <span style={S.badge}>{loading ? '...' : total}</span>
        </div>
        <div style={{ ...S.topRight, gap: isMobile ? 6 : 8 }}>
          <div style={S.searchWrap}>
            <svg style={S.searchIcon} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('common.search', lang)}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...S.searchInput, width: isMobile ? 140 : 200 }}
            />
          </div>
          {!isMobile && (
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: filterSource ? 'var(--text)' : 'var(--muted)', outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Origen: Todos</option>
              <option value="manual">Manual</option>
              <option value="invoice">Factura</option>
              <option value="import">Importado</option>
              <option value="webhook">Webhook</option>
            </select>
          )}
          {!isMobile && (
            <button onClick={exportCSV}
              style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('contacts.exportCsv', lang)}
            </button>
          )}
          {!isMobile && (
            <button
              onClick={() => { setFilterSmallGroup(f => !f); if (!filterSmallGroup) setSmallGroupContactIds(null); }}
              title="Filtrar contactos con grupos de 1-4 personas"
              style={{ ...S.btnGhost, borderColor: filterSmallGroup ? '#f59e0b' : 'var(--border)', color: filterSmallGroup ? '#f59e0b' : 'var(--muted)', background: filterSmallGroup ? 'rgba(245,158,11,0.1)' : 'none' }}
            >
              👥 Grupos -5
            </button>
          )}
          {!isMobile && (
            <button
              onClick={() => setDupesModal(true)}
              style={S.btnGhost}
              title="Detectar contactos duplicados"
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#f59e0b'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              🔍 {t('contacts.dupDetect', lang)}
            </button>
          )}
          {!isMobile && (
            <button
              onClick={() => setImportModal(true)}
              style={S.btnGhost}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1b9af5'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              {t('contacts.import2', lang)}
            </button>
          )}
          {!isMobile && (
            <button
              onClick={exportar}
              style={S.btnGhost}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1b9af5'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              {t('contacts.export', lang)}
            </button>
          )}
          <button onClick={() => setModal('new')} style={{ ...S.btnPrimary, padding: isMobile ? '7px 12px' : '7px 16px', fontSize: isMobile ? 12 : 13 }}>
            {isMobile ? `+ ${t('contacts.newShort', lang)}` : `+ ${t('contacts.newTitle', lang)}`}
          </button>
        </div>
      </div>

      {/* Mobile filter bar */}
      {isMobile && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          {['', 'manual', 'invoice', 'import', 'webhook'].map(src => {
            const labels = { '': 'Todos', manual: 'Manual', invoice: 'Factura', import: 'Importado', webhook: 'Webhook' };
            const active = filterSource === src;
            return (
              <button key={src} onClick={() => setFilterSource(src)}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {labels[src]}
              </button>
            );
          })}
          <button
            onClick={() => { setFilterSmallGroup(f => !f); if (!filterSmallGroup) setSmallGroupContactIds(null); }}
            style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: filterSmallGroup ? 700 : 400, border: `1px solid ${filterSmallGroup ? '#f59e0b' : 'var(--border)'}`, background: filterSmallGroup ? 'rgba(245,158,11,0.18)' : 'var(--surface)', color: filterSmallGroup ? '#f59e0b' : 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            👥 Grupos -5
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ ...S.tableWrap, margin: isMobile ? '0 0 16px' : '0 24px 24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 'auto' : 700 }}>
          <thead style={S.thead}>
            <tr>
              {!isMobile && <th style={S.thCheck}>
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selected.size === contacts.length}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer', accentColor: '#1b9af5' }}
                />
              </th>}
              <th style={S.th}>{t('contacts.col.name', lang)}</th>
              {!isMobile && <th style={S.th}>{t('contacts.col.company', lang)}</th>}
              <th style={S.th}>{t('contacts.col.phone', lang)}</th>
              {!isMobile && <th style={S.th}>{t('contacts.col.email', lang)}</th>}
              {!isMobile && <th style={S.th}>Tags</th>}
              {!isMobile && <th style={S.th}>{t('common.created', lang)}</th>}
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: '#7880a0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div style={{ width: 16, height: 16, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Cargando...
                  </div>
                </td>
              </tr>
            )}
            {!loading && contactosFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: '#7880a0', fontSize: 14 }}>
                  {filterSmallGroup ? 'Sin contactos con grupos de 1-4 personas' : search ? 'Sin resultados para esa búsqueda' : 'No hay contactos aún'}
                </td>
              </tr>
            )}
            {contactosFiltrados.map((c, idx) => {
              const isHovered = hoveredRow === c.id;
              const isSelected = selected.has(c.id);
              const color = avatarColor(c.name);
              const rowBg = isSelected
                ? 'rgba(59,130,246,0.07)'
                : isHovered
                  ? 'rgba(255,255,255,0.03)'
                  : idx % 2 === 1
                    ? 'rgba(255,255,255,0.015)'
                    : 'transparent';

              const tags = c.tags
                ? (Array.isArray(c.tags) ? c.tags : c.tags.split(',').map(t => t.trim()).filter(Boolean))
                : [];

              return (
                <tr
                  key={c.id}
                  onMouseEnter={() => setHoveredRow(c.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: rowBg, transition: 'background 0.1s', height: 48 }}
                >
                  {/* Checkbox — desktop only */}
                  {!isMobile && (
                    <td style={{ ...S.td, width: 36, paddingLeft: 14, paddingRight: 14 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        style={{ cursor: 'pointer', accentColor: '#1b9af5' }}
                      />
                    </td>
                  )}

                  {/* Nombre */}
                  <td style={{ ...S.td, paddingLeft: isMobile ? 12 : 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ ...S.avatar, background: color + '28', color, flexShrink: 0 }}>
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <button onClick={() => setModal(c)} style={{ ...S.nameBtn, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 130 : 200 }}>
                          {c.name}
                        </button>
                        {isMobile && c.company && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Empresa — desktop only */}
                  {!isMobile && <td style={S.tdMuted}>{c.company || '—'}</td>}

                  {/* Teléfono */}
                  <td style={S.tdMuted}>
                    {c.phone ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="13" height="13" fill="none" stroke="#25d366" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
                        </svg>
                        {isMobile ? c.phone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d+)/, '$1 $2-$3-$4') : c.phone}
                      </div>
                    ) : '—'}
                  </td>

                  {/* Email — desktop only */}
                  {!isMobile && (
                    <td style={{ ...S.tdMuted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.email || '—'}
                    </td>
                  )}

                  {/* Tags — desktop only */}
                  {!isMobile && (
                    <td style={S.td}>
                      {tags.length > 0
                        ? tags.slice(0, 3).map(tag => {
                            const tc = tagColor(tag);
                            return (
                              <span key={tag} style={{ ...S.tag, background: tc.bg, color: tc.color }}>
                                {tag}
                              </span>
                            );
                          })
                        : <span style={{ color: 'var(--muted)' }}>—</span>
                      }
                    </td>
                  )}

                  {/* Creado — desktop only */}
                  {!isMobile && <td style={S.tdMuted}>{formatDate(c.created_at)}</td>}

                  {/* Acciones */}
                  <td style={{ ...S.td, width: isMobile ? 60 : 130, paddingRight: isMobile ? 8 : 14 }}>
                    <div style={{ display: 'flex', gap: 2, opacity: isMobile ? 1 : (isHovered ? 1 : 0), transition: 'opacity 0.15s' }}>
                      {/* Ver perfil completo */}
                      <button
                        onClick={() => router.push(`/contacts/${c.id}`)}
                        title="Ver perfil y timeline"
                        style={S.actionBtn}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#1b9af5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {/* Portal del cliente */}
                      {!isMobile && (
                        <button
                          onClick={() => generatePortal(c.id, c.name)}
                          disabled={generatingPortal === c.id}
                          title="Generar portal del cliente"
                          style={S.actionBtn}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.color = '#10b981'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                        >
                          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => setModal(c)}
                        title="Editar"
                        style={S.actionBtn}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = '#1b9af5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => eliminar(c.id)}
                        title="Eliminar"
                        style={S.actionBtn}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={S.pagination}>
          <button
            onClick={() => { const p = page - 1; setPage(p); cargar(p); }}
            disabled={page === 1}
            style={{ ...S.pageBtn, opacity: page === 1 ? 0.35 : 1 }}
          >
            ← Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => { setPage(p); cargar(p); }}
                style={p === page ? S.pageBtnActive : S.pageBtn}
              >
                {p}
              </button>
            );
          })}
          {totalPages > 7 && page < totalPages && (
            <>
              <span style={{ color: '#7880a0', padding: '0 4px' }}>...</span>
              <button onClick={() => { setPage(totalPages); cargar(totalPages); }} style={S.pageBtn}>{totalPages}</button>
            </>
          )}
          <button
            onClick={() => { const p = page + 1; setPage(p); cargar(p); }}
            disabled={page >= totalPages}
            style={{ ...S.pageBtn, opacity: page >= totalPages ? 0.35 : 1 }}
          >
            Next →
          </button>
        </div>
      )}

      {modal && (
        <ContactModal contact={modal === 'new' ? null : modal}
          onClose={() => setModal(null)} onSaved={() => cargar(1)} />
      )}
      {importModal && (
        <ImportModal onClose={() => setImportModal(false)} onImported={() => cargar(1)} />
      )}
      {dupesModal && (
        <DuplicatesModal onClose={() => setDupesModal(false)} onMerged={() => cargar(1)} />
      )}
    </div>
  );
}
