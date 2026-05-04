'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';

// ── Calculator ────────────────────────────────────────────────────────────────
function Calculadora() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev]       = useState(null);
  const [op, setOp]           = useState(null);
  const [fresh, setFresh]     = useState(false);

  const press = (val) => {
    if (val === 'C') {
      setDisplay('0'); setPrev(null); setOp(null); setFresh(false);
      return;
    }
    if (val === '±') {
      setDisplay(d => String(-parseFloat(d)));
      return;
    }
    if (val === '%') {
      setDisplay(d => String(parseFloat(d) / 100));
      return;
    }
    if (['+', '-', '×', '÷'].includes(val)) {
      setPrev(parseFloat(display));
      setOp(val);
      setFresh(true);
      return;
    }
    if (val === '=') {
      if (op === null || prev === null) return;
      const cur = parseFloat(display);
      let res;
      if (op === '+') res = prev + cur;
      else if (op === '-') res = prev - cur;
      else if (op === '×') res = prev * cur;
      else if (op === '÷') res = cur === 0 ? 'Error' : prev / cur;
      const str = typeof res === 'number' ? String(parseFloat(res.toPrecision(12))) : res;
      setDisplay(str);
      setPrev(null); setOp(null); setFresh(false);
      return;
    }
    if (val === '.') {
      if (fresh) { setDisplay('0.'); setFresh(false); return; }
      if (display.includes('.')) return;
      setDisplay(d => d + '.');
      return;
    }
    // digit
    if (fresh) { setDisplay(val); setFresh(false); return; }
    setDisplay(d => d === '0' ? val : d.length >= 12 ? d : d + val);
  };

  const BTN = [
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  const isOp   = v => ['+','-','×','÷'].includes(v);
  const isFunc = v => ['C','±','%'].includes(v);

  return (
    <div style={{ maxWidth: 300, margin: '0 auto' }}>
      {/* Display */}
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '18px 20px', marginBottom: 12, textAlign: 'right',
      }}>
        {op !== null && (
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 2 }}>
            {prev} {op}
          </div>
        )}
        <div style={{
          color: 'var(--text)', fontSize: display.length > 10 ? 22 : 32,
          fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {display}
        </div>
      </div>

      {/* Buttons */}
      {BTN.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {row.map((v, ci) => {
            const wide = v === '0';
            const active = v === op;
            const accent = isOp(v) || v === '=';
            const muted  = isFunc(v);
            return (
              <button
                key={ci}
                onClick={() => press(v)}
                style={{
                  flex: wide ? 2 : 1,
                  padding: '16px 0',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  fontWeight: accent ? 600 : 400,
                  background: active
                    ? 'var(--accent)'
                    : accent
                      ? 'rgba(59,130,246,0.18)'
                      : muted
                        ? 'var(--surface)'
                        : 'var(--surface)',
                  color: accent ? 'var(--accent)' : muted ? 'var(--text)' : 'var(--text)',
                  border: `1px solid ${accent ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                  transition: 'background 0.1s',
                  textAlign: wide ? 'left' : 'center',
                  paddingLeft: wide ? 20 : 0,
                }}
              >
                {v}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Notas Rápidas ─────────────────────────────────────────────────────────────
function NotasRapidas() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('crm_quick_notes') || '';
    setText(stored);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    clearTimeout(timer.current);
    setSaved(false);
    timer.current = setTimeout(() => {
      localStorage.setItem('crm_quick_notes', val);
      setSaved(true);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Guardado automáticamente en tu navegador</span>
        {saved && (
          <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Guardado
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Escribe tus notas rápidas aquí... Se guardan automáticamente."
        style={{
          width: '100%', minHeight: 320, padding: '14px 16px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
          color: 'var(--text)', fontSize: 14, lineHeight: 1.65, resize: 'vertical',
          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
      <button
        onClick={() => { if (confirm('¿Borrar todas las notas?')) { setText(''); localStorage.removeItem('crm_quick_notes'); setSaved(false); } }}
        style={{ alignSelf: 'flex-end', padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
      >
        Limpiar notas
      </button>
    </div>
  );
}

// ── Google Maps ───────────────────────────────────────────────────────────────
function GoogleMaps() {
  const [query, setQuery] = useState('Puerto Rico');
  const [src, setSrc]     = useState('https://maps.google.com/maps?output=embed&q=Puerto+Rico');

  const buscar = () => {
    if (!query.trim()) return;
    setSrc(`https://maps.google.com/maps?output=embed&q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Buscar lugar..."
          style={{
            flex: 1, padding: '8px 14px', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={buscar} style={{
          padding: '8px 18px', background: 'var(--accent)', border: 'none',
          borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Buscar
        </button>
      </div>
      <iframe
        key={src}
        src={src}
        width="100%"
        height="400"
        style={{ border: 'none', borderRadius: 12, border: '1px solid var(--border)' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Google Maps"
      />
    </div>
  );
}

// ── Google Meet ───────────────────────────────────────────────────────────────
function GoogleMeet() {
  const [savedLink, setSavedLink] = useState('');
  const [inputLink, setInputLink] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('crm_meet_link') || '';
    setSavedLink(stored);
    setInputLink(stored);
  }, []);

  const guardar = () => {
    localStorage.setItem('crm_meet_link', inputLink.trim());
    setSavedLink(inputLink.trim());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Nueva reunión */}
      <div style={{ padding: 20, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Iniciar nueva reunión
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Abre Google Meet en una nueva pestaña y crea una sala instantánea.
        </p>
        <a
          href="https://meet.google.com/new"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: 'var(--accent)', borderRadius: 10,
            color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Nuevo Meet
        </a>
      </div>

      {/* Enlace recurrente */}
      <div style={{ padding: 20, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Enlace de reunión recurrente
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Guarda un enlace de Meet fijo que puedas compartir con clientes.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type="url"
            value={inputLink}
            onChange={e => setInputLink(e.target.value)}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            style={{
              flex: 1, padding: '8px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text)', fontSize: 13, outline: 'none',
            }}
          />
          <button onClick={guardar} style={{
            padding: '8px 16px', background: 'var(--accent)', border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Guardar
          </button>
        </div>
        {savedLink && (
          <a
            href={savedLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8,
              color: 'var(--accent)', fontSize: 13, textDecoration: 'none', fontWeight: 500,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Abrir enlace guardado
          </a>
        )}
      </div>
    </div>
  );
}

// ── Portal LUMA ───────────────────────────────────────────────────────────────
function PortalLuma() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: 20, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          Portal LUMA — Permisos e Interconexión
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Accede al portal de LUMA para gestionar solicitudes de interconexión, permisos y seguimiento de proyectos solares en Puerto Rico.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="https://miacceso.lumapr.com/login.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', background: '#f59e0b', border: 'none',
              borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
              textDecoration: 'none', cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Abrir Portal LUMA
          </a>
          <a
            href="https://energia.pr.gov"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--text)', fontSize: 14, fontWeight: 600,
              textDecoration: 'none', cursor: 'pointer',
            }}
          >
            PREB — Bureau de Energía PR
          </a>
        </div>
      </div>
      <div style={{ padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Tip:</strong> Verifica el estatus de interconexión de un cliente antes de programar la instalación.
          Los leads en etapa "Permisos LUMA" aparecen marcados en el pipeline.
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
// ── Import Excel ──────────────────────────────────────────────────────────────
function ImportarExcel() {
  const [rows, setRows]       = useState([]);
  const [headers, setHeaders] = useState([]);
  const [map, setMap]         = useState({ name: '', email: '', phone: '', company: '' });
  const [status, setStatus]   = useState(null); // null | 'loading' | 'done' | 'error'
  const [result, setResult]   = useState(null);
  const fileRef = useRef();

  const readFile = async (file) => {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (json.length < 2) return;
    const hdrs = json[0].map(String);
    setHeaders(hdrs);
    setRows(json.slice(1));
    // Auto-detect columns
    const find = (...keys) => hdrs.findIndex(h => keys.some(k => h.toLowerCase().includes(k)));
    setMap({
      name:    hdrs[find('nombre','name','contact','cliente')] || '',
      email:   hdrs[find('email','correo','mail')]             || '',
      phone:   hdrs[find('tel','phone','fono','whatsapp','cel')]|| '',
      company: hdrs[find('empresa','company','compan','negocio')]|| '',
    });
  };

  const importar = async () => {
    if (!rows.length) return;
    setStatus('loading');
    const idx = (col) => headers.indexOf(col);
    const data = rows
      .map(r => ({
        name:    map.name    ? String(r[idx(map.name)]    || '').trim() : '',
        email:   map.email   ? String(r[idx(map.email)]   || '').trim() : '',
        phone:   map.phone   ? String(r[idx(map.phone)]   || '').trim() : '',
        company: map.company ? String(r[idx(map.company)] || '').trim() : '',
      }))
      .filter(r => r.name || r.email || r.phone);
    try {
      const res = await api.importContacts(data);
      setResult(res);
      setStatus('done');
    } catch (e) {
      setResult({ error: e.message });
      setStatus('error');
    }
  };

  const FIELDS = [
    { key: 'name', label: 'Nombre *' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'company', label: 'Empresa' },
  ];

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Importar contactos desde Excel / CSV</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Soporta .xlsx, .xls y .csv. Máximo 1000 filas.</div>

      {/* Upload zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
        style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 20, transition: 'border-color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#1b9af5'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Arrastra tu archivo aquí o haz clic</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>.xlsx · .xls · .csv</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) readFile(e.target.files[0]); }} />
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            ✅ {rows.length} filas detectadas — mapea las columnas:
          </div>

          {/* Column mapping */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <select value={map[f.key]} onChange={e => setMap(m => ({ ...m, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}>
                  <option value="">— No importar —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, overflowX: 'auto' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Vista previa (primeras 3 filas):</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>{FIELDS.map(f => <th key={f.key} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--muted)', fontWeight: 600 }}>{f.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((r, i) => (
                  <tr key={i}>
                    {FIELDS.map(f => {
                      const idx = headers.indexOf(map[f.key]);
                      return <td key={f.key} style={{ padding: '4px 8px', color: 'var(--text)', borderTop: '1px solid var(--border)' }}>{idx >= 0 ? String(r[idx] || '') : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={importar} disabled={status === 'loading' || !map.name}
            style={{ background: '#1b9af5', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (status === 'loading' || !map.name) ? 0.6 : 1 }}>
            {status === 'loading' ? 'Importando...' : `Importar ${rows.length} contactos`}
          </button>

          {status === 'done' && result && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 13, color: '#10b981' }}>
              ✅ Importación completada — {result.created || result.inserted || 'varios'} contactos creados
            </div>
          )}
          {status === 'error' && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
              ⚠️ Error: {result?.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TABS = [
  {
    id: 'calculadora', label: 'Calculadora',
    icon: 'M9 7H7a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6m-3 4v6m-2-4h4',
  },
  {
    id: 'notas', label: 'Notas rápidas',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  {
    id: 'maps', label: 'Google Maps',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    id: 'meet', label: 'Google Meet',
    icon: 'M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  },
  {
    id: 'fareharbor', label: 'Portal LUMA',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'importar', label: 'Importar Excel',
    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  },
];

export default function HerramientasPage() {
  const [activeTab, setActiveTab] = useState('calculadora');

  return (
    <div style={{ padding: '20px 24px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Herramientas
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
          Utilidades rápidas accesibles desde cualquier página
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border)',
        marginBottom: 24, overflowX: 'auto', flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', background: 'none', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                color: active ? 'var(--accent)' : 'var(--muted)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24,
      }}>
        {activeTab === 'calculadora'  && <Calculadora />}
        {activeTab === 'notas'        && <NotasRapidas />}
        {activeTab === 'maps'         && <GoogleMaps />}
        {activeTab === 'meet'         && <GoogleMeet />}
        {activeTab === 'fareharbor'   && <PortalLuma />}
        {activeTab === 'importar'     && <ImportarExcel />}
      </div>
    </div>
  );
}
