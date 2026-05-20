'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const BACKEND = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

export default function SolicitudPrestamoPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [data, setData]       = useState(null); // { cooperativa, form_sections, form_data, already_signed, signed_name, signed_at }
  const [formData, setFormData] = useState({});
  const [name, setName]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const isEmpty   = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/public/solicitud/${token}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error cargando solicitud');
        setData(j);
        setFormData(j.form_data || {});
        if (j.form_data?.nombre_completo) setName(j.form_data.nombre_completo);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  // Canvas setup
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect  = c.getBoundingClientRect();
    c.width  = rect.width  * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, [data, done]);

  const getPos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - rect.left;
    const y = (t ? t.clientY : e.clientY) - rect.top;
    return { x, y };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; const { x,y } = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x,y); };
  const move  = (e) => { if (!drawing.current) return; e.preventDefault(); const { x,y } = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(x,y); ctx.stroke(); isEmpty.current = false; };
  const end   = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); isEmpty.current = true; };

  const setField = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const submit = async () => {
    // Validar requeridos
    const required = (data?.form_sections || []).flatMap(s => s.fields).filter(f => f.required);
    const missing = required.filter(f => !formData[f.key] || String(formData[f.key]).trim() === '');
    if (missing.length) { alert('Faltan campos requeridos:\n- ' + missing.map(m => m.label).join('\n- ')); return; }
    if (isEmpty.current) return alert('Por favor dibuja tu firma antes de continuar.');
    if (!name.trim()) return alert('Escribe tu nombre completo para firmar.');
    setSubmitting(true);
    try {
      const sig = canvasRef.current.toDataURL('image/png');
      const r = await fetch(`${BACKEND}/api/public/solicitud/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: sig, signed_name: name.trim(), form_data: formData }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error firmando');
      setDone(true);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div style={S.center}>Cargando solicitud…</div>;
  if (error) return <div style={S.center}><div style={S.card}><h2 style={{ color:'#dc2626' }}>No se pudo cargar</h2><p>{error}</p></div></div>;

  if (done || data?.already_signed) {
    return (
      <div style={S.center}>
        <div style={S.card}>
          <div style={{ fontSize:48, textAlign:'center' }}>✓</div>
          <h2 style={{ textAlign:'center', color:'#1a3c8f' }}>Solicitud recibida</h2>
          <p style={{ textAlign:'center', color:'#475569' }}>
            {data?.already_signed
              ? `Esta solicitud fue firmada por ${data.signed_name || 'el solicitante'} el ${data.signed_at ? new Date(data.signed_at).toLocaleString('es-PR') : ''}.`
              : 'Te enviaremos una copia firmada por correo electrónico.'}
          </p>
        </div>
      </div>
    );
  }

  const fld = (f) => {
    const v = formData[f.key] || '';
    const baseStyle = {
      width:'100%', padding:'10px 12px', border:'1px solid #cbd5e1', borderRadius:8,
      fontSize:14, marginTop:4, outline:'none', fontFamily:'inherit', background:'#fff',
    };
    const colSpan = f.width === 'full' ? '1 / -1' : 'auto';
    return (
      <div key={f.key} style={{ gridColumn: colSpan }}>
        <label style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:.3 }}>
          {f.label}{f.required && <span style={{ color:'#dc2626' }}> *</span>}
        </label>
        {f.type === 'textarea' ? (
          <textarea value={v} onChange={e => setField(f.key, e.target.value)} rows={3} style={{ ...baseStyle, resize:'vertical' }} />
        ) : (
          <input type={f.type || 'text'} value={v} onChange={e => setField(f.key, e.target.value)} style={baseStyle} />
        )}
      </div>
    );
  };

  return (
    <div style={{ background:'#f1f5f9', minHeight:'100vh', padding:'0 0 60px' }}>
      <div style={{ background:'linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%)', color:'#fff', padding:'20px 20px', textAlign:'center' }}>
        <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'#bfdbfe', fontWeight:700 }}>Energy Depot LLC</div>
        <div style={{ fontSize:18, fontWeight:800, marginTop:4 }}>Solicitud de Préstamo</div>
        {data?.cooperativa && <div style={{ fontSize:12, color:'#bfdbfe', marginTop:4 }}>Cooperativa: {data.cooperativa}</div>}
      </div>
      <div style={{ background:'#67e8f9', height:4 }} />

      <div style={{ maxWidth: 860, margin:'18px auto', padding:'0 12px' }}>
        <div style={{ background:'#fff', borderRadius:10, padding:'18px 16px', boxShadow:'0 1px 3px rgba(0,0,0,.08)', marginBottom:14, fontSize:13, color:'#475569', lineHeight:1.5 }}>
          Por favor revisa y completa la información a continuación. Una vez la firmes electrónicamente, recibirás una copia por correo electrónico.
        </div>

        {(data?.form_sections || []).map(sec => (
          <div key={sec.title} style={{ background:'#fff', borderRadius:10, padding:'18px 16px', boxShadow:'0 1px 3px rgba(0,0,0,.08)', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#1a3c8f', textTransform:'uppercase', letterSpacing:1, borderBottom:'2px solid #67e8f9', paddingBottom:6, marginBottom:14 }}>{sec.title}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }} className="grid-resp">
              {sec.fields.map(fld)}
            </div>
          </div>
        ))}

        <div style={{ background:'#fff', borderRadius:10, padding:'18px 16px', boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#1a3c8f', textTransform:'uppercase', letterSpacing:1, borderBottom:'2px solid #67e8f9', paddingBottom:6, marginBottom:14 }}>Firma del solicitante</div>
          <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:4 }}>Tu nombre completo</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Juan Pérez Rivera"
            style={{ width:'100%', padding:'10px 12px', border:'1px solid #cbd5e1', borderRadius:8, fontSize:14, marginBottom:14 }} />

          <div style={{ fontSize:12, color:'#475569', fontWeight:600, marginBottom:4 }}>Dibuja tu firma abajo</div>
          <div style={{ border:'2px dashed #94a3b8', borderRadius:8, background:'#f8fafc' }}>
            <canvas
              ref={canvasRef}
              style={{ width:'100%', height:180, touchAction:'none', display:'block', borderRadius:6 }}
              onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
              onTouchStart={start} onTouchMove={move} onTouchEnd={end}
            />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
            <button onClick={clear} style={{ background:'transparent', border:'1px solid #cbd5e1', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', color:'#475569' }}>Limpiar</button>
            <span style={{ fontSize:11, color:'#94a3b8' }}>Usa el dedo o el mouse para firmar</span>
          </div>

          <button onClick={submit} disabled={submitting}
            style={{ marginTop:18, width:'100%', background:'#1a3c8f', color:'#fff', border:0, padding:'14px', borderRadius:10, fontSize:15, fontWeight:800, cursor:'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Procesando…' : '✓ Firmar y enviar solicitud'}
          </button>
          <p style={{ fontSize:11, color:'#64748b', marginTop:12, textAlign:'center', lineHeight:1.5 }}>
            Al firmar declaras que la información provista es verdadera y autorizas a la cooperativa a verificarla.
          </p>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.grid-resp) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const S = {
  center: { minHeight:'100vh', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif' },
  card:   { background:'#fff', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,.08)', padding:'30px 26px', maxWidth:420, width:'100%' },
};
