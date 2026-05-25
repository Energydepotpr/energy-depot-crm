'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SignaturePad from '../../components/SignaturePad';

const BACKEND = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

export default function FirmarContratoPage() {
  const { token } = useParams();
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [data, setData]         = useState(null); // { html, already_signed, cliente, signed_name, signed_at }
  const [name, setName]         = useState('');
  const [sig, setSig]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

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

  const submit = async () => {
    if (!sig) return alert('Por favor firma antes de continuar.');
    if (!name.trim()) return alert('Escribe tu nombre completo.');
    setSubmitting(true);
    try {
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
    const backSlug = (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('back')
      : null) || data?.clientLinkSlug || null;
    const pdfDataUrl = data?.pdf ? `data:application/pdf;base64,${data.pdf}` : null;
    const BackBtn = backSlug ? (
      <a href={`/cliente/${backSlug}`} style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        background:'#1a3c8f', color:'#fff',
        padding:'14px 18px', borderRadius:10, textDecoration:'none',
        fontSize:14, fontWeight:700, minHeight:48,
      }}>
        🔙 Continuar cargando documentos
      </a>
    ) : null;
    return (
      <div style={{ minHeight:'100vh', background:'#f1f5f9', padding:'12px 12px 24px' }}>
        <div style={{
          maxWidth:880, margin:'0 auto', background:'#fff',
          borderRadius:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
          padding:'18px 16px', display:'flex', flexDirection:'column', gap:14,
        }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:42, color:'#1a3c8f', lineHeight:1 }}>✓</div>
            <h2 style={{ color:'#1a3c8f', margin:'8px 0 4px', fontSize:20 }}>Contrato firmado</h2>
            <p style={{ color:'#475569', margin:0, fontSize:14, lineHeight:1.4 }}>
              {data?.already_signed
                ? `Firmado por ${data.signed_name || 'el cliente'} el ${data.signed_at ? new Date(data.signed_at).toLocaleString('es-PR') : ''}.`
                : 'Te enviamos una copia firmada por correo electrónico.'}
            </p>
          </div>
          {BackBtn}
          {pdfDataUrl && (
            <>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <a href={pdfDataUrl} download={`Contrato-${data.signed_name || 'firmado'}.pdf`}
                  style={{ flex:'1 1 140px', textAlign:'center', background:'transparent',
                    color:'#1a3c8f', border:'1px solid #1a3c8f',
                    padding:'10px 14px', borderRadius:8, textDecoration:'none',
                    fontSize:13, fontWeight:600, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  ⬇️ Descargar
                </a>
                <a href={pdfDataUrl} target="_blank" rel="noopener noreferrer"
                  style={{ flex:'1 1 140px', textAlign:'center', background:'transparent',
                    color:'#1a3c8f', border:'1px solid #1a3c8f',
                    padding:'10px 14px', borderRadius:8, textDecoration:'none',
                    fontSize:13, fontWeight:600, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  ↗ Abrir
                </a>
              </div>
              <iframe src={pdfDataUrl} title="Contrato firmado"
                style={{ width:'100%', height:'70vh', minHeight:420, border:'1px solid #cbd5e1', borderRadius:8 }} />
            </>
          )}
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

        <div style={{ fontSize:12, color:'#475569', fontWeight:600, marginBottom:6 }}>Firma</div>
        <SignaturePad value={sig} onChange={setSig} defaultName={name} height={180} />

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
