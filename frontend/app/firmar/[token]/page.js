'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const BACKEND = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

export default function FirmarContratoPage() {
  const { token } = useParams();
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [data, setData]         = useState(null); // { html, already_signed, cliente, signed_name, signed_at }
  const [name, setName]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const isEmpty   = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/public/firma/${token}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error cargando contrato');
        setData(j);
        if (j.cliente) setName(j.cliente);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  // Canvas helpers
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect  = c.getBoundingClientRect();
    c.width  = rect.width  * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

  const submit = async () => {
    if (isEmpty.current) return alert('Por favor dibuja tu firma antes de continuar.');
    if (!name.trim())    return alert('Escribe tu nombre completo.');
    setSubmitting(true);
    try {
      const sig = canvasRef.current.toDataURL('image/png');
      const r = await fetch(`${BACKEND}/api/public/firma/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: sig, signed_name: name.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error firmando');
      setDone(true);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div style={S.center}>Cargando contrato…</div>;
  if (error)   return <div style={S.center}><div style={S.card}><h2 style={{color:'#dc2626'}}>No se pudo cargar</h2><p>{error}</p></div></div>;

  if (done || data?.already_signed) {
    return (
      <div style={S.center}>
        <div style={S.card}>
          <div style={{ fontSize:48, textAlign:'center' }}>✓</div>
          <h2 style={{ textAlign:'center', color:'#1a3c8f' }}>Contrato firmado</h2>
          <p style={{ textAlign:'center', color:'#475569' }}>
            {data?.already_signed
              ? `Este contrato fue firmado por ${data.signed_name || 'el cliente'} el ${data.signed_at ? new Date(data.signed_at).toLocaleString('es-PR') : ''}.`
              : 'Te enviamos una copia firmada por correo electrónico.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:'#f1f5f9', minHeight:'100vh', padding:'0 0 60px' }}>
      <div style={{ background:'linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%)', color:'#fff', padding:'18px 20px', textAlign:'center' }}>
        <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'#bfdbfe', fontWeight:700 }}>Energy Depot LLC</div>
        <div style={{ fontSize:18, fontWeight:800, marginTop:4 }}>Revisa y firma tu contrato</div>
      </div>
      <div style={{ background:'#67e8f9', height:4 }} />

      <div style={{ maxWidth: 860, margin:'20px auto', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ padding:'10px 16px', background:'#1a3c8f', color:'#fff', fontSize:13, fontWeight:700 }}>Contrato</div>
        <iframe
          title="Contrato"
          style={{ width:'100%', height:'70vh', border:0, background:'#fff' }}
          srcDoc={data?.html || ''}
        />
      </div>

      <div style={{ maxWidth: 860, margin:'18px auto', background:'#fff', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1a3c8f', marginBottom:10, textTransform:'uppercase', letterSpacing:0.6 }}>Firma del comprador</div>
        <label style={{ fontSize:12, color:'#475569', fontWeight:600, display:'block', marginBottom:4 }}>Tu nombre completo</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Juan Pérez Rivera"
          style={{ width:'100%', padding:'10px 12px', border:'1px solid #cbd5e1', borderRadius:8, fontSize:14, marginBottom:14 }} />

        <div style={{ fontSize:12, color:'#475569', fontWeight:600, marginBottom:4 }}>Dibuja tu firma abajo</div>
        <div style={{ border:'2px dashed #94a3b8', borderRadius:8, background:'#f8fafc', position:'relative' }}>
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
          {submitting ? 'Procesando…' : '✓ Firmar y aceptar contrato'}
        </button>
        <p style={{ fontSize:11, color:'#64748b', marginTop:12, textAlign:'center', lineHeight:1.5 }}>
          Al firmar declaras haber leído y aceptado los términos del contrato. Recibirás una copia firmada por correo electrónico.
        </p>
      </div>
    </div>
  );
}

const S = {
  center: { minHeight:'100vh', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif' },
  card:   { background:'#fff', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,.08)', padding:'30px 26px', maxWidth:420, width:'100%' },
};
