'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SignaturePad from '../../components/SignaturePad';

const BACKEND = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

// ─── Campos Tu Coop (mismos que TuCoopSolicitudModal en el CRM) ──────────────
const TU_COOP_SECTIONS = [
  { title: 'Información del Préstamo', fields: [
    { key:'proposito', label:'Propósito', type:'select', options:['vacaciones','consolidacion','mejoras','otro'], width:'full' },
    { key:'cantidad_solicitada', label:'Cantidad Solicitada', type:'text' },
  ]},
  { title: 'Información del Solicitante', fields: [
    { key:'nombre_completo', label:'Nombre Completo', type:'text', width:'full' },
    { key:'seguro_social', label:'Seguro Social' },
    { key:'fecha_nacimiento', label:'Fecha de Nacimiento' },
    { key:'telefono', label:'Teléfono' },
    { key:'licencia_conducir', label:'Lic. Conducir' },
    { key:'licencia_vencimiento', label:'Lic. Vencimiento' },
    { key:'licencia_emitida_en', label:'Lic. Emitida en' },
    { key:'correo', label:'Correo', type:'email' },
    { key:'celular', label:'Celular' },
    { key:'estado_civil', label:'Estado Civil', type:'select', options:['casado','separado','soltero'] },
    { key:'dependientes', label:'Dependientes' },
    { key:'direccion_fisica', label:'Dirección Física', width:'full' },
    { key:'direccion_postal', label:'Dirección Postal', width:'full' },
    { key:'vive_en_casa', label:'Vive en casa', type:'select', options:['propia','alquilada','familiar','otro'] },
    { key:'tiempo_residencia', label:'Tiempo de residencia' },
    { key:'pariente_nombre_direccion', label:'Pariente — Nombre y Dirección', width:'full' },
    { key:'pariente_correo', label:'Pariente — Correo' },
    { key:'pariente_telefono', label:'Pariente — Teléfono' },
  ]},
  { title: 'Empleo', fields: [
    { key:'empleado_tipo', label:'Tipo de empleado', type:'select', options:['regular','probatorio','contrato','cuenta_propia'], width:'full' },
    { key:'tiempo_empleo', label:'Tiempo en el empleo' },
    { key:'patrono', label:'Patrono' },
    { key:'ocupacion', label:'Ocupación' },
    { key:'patrono_telefono', label:'Teléfono del patrono' },
    { key:'supervisor', label:'Supervisor' },
    { key:'telefono_empleo', label:'Teléfono empleo' },
    { key:'direccion_empleo', label:'Dirección del empleo', width:'full' },
    { key:'salario_bruto', label:'Salario bruto' },
  ]},
];

export default function SolicitudPrestamoPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [data, setData]       = useState(null); // { cooperativa, template, form_sections, form_data, already_signed, signed_name, signed_at }
  const [formData, setFormData] = useState({});
  const [name, setName]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const [sig, setSig]         = useState('');

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

  const setField = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const isTuCoop = data?.template === 'tu_coop';

  const submit = async () => {
    if (isTuCoop) {
      if (!String(formData.nombre_completo || name || '').trim()) {
        return alert('El nombre completo es requerido');
      }
    } else {
      const required = (data?.form_sections || []).flatMap(s => s.fields).filter(f => f.required);
      const missing = required.filter(f => !formData[f.key] || String(formData[f.key]).trim() === '');
      if (missing.length) { alert('Faltan campos requeridos:\n- ' + missing.map(m => m.label).join('\n- ')); return; }
    }
    if (!sig) return alert('Por favor firma antes de continuar.');
    if (!name.trim()) return alert('Escribe tu nombre completo para firmar.');
    setSubmitting(true);
    try {
      const fd = isTuCoop
        ? { ...formData, nombre_completo: formData.nombre_completo || name, firma_fecha: formData.firma_fecha || new Date().toLocaleDateString('es-PR') }
        : formData;
      const r = await fetch(`${BACKEND}/api/public/solicitud/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: sig, signed_name: name.trim(), form_data: fd }),
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
            <h2 style={{ color:'#1a3c8f', margin:'8px 0 4px', fontSize:20 }}>Solicitud firmada</h2>
            <p style={{ color:'#475569', margin:0, fontSize:14, lineHeight:1.4 }}>
              {data?.already_signed && !done
                ? `Firmada por ${data.signed_name || 'el solicitante'} el ${data.signed_at ? new Date(data.signed_at).toLocaleString('es-PR') : ''}.`
                : 'Hemos recibido tu solicitud firmada. Te enviaremos una copia por correo electrónico.'}
            </p>
          </div>
          {BackBtn}
          {pdfDataUrl && (
            <>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <a href={pdfDataUrl} download={`Solicitud-${data.signed_name || 'firmada'}.pdf`}
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
              <iframe src={pdfDataUrl} title="Solicitud firmada"
                style={{ width:'100%', height:'70vh', minHeight:420, border:'1px solid #cbd5e1', borderRadius:8 }} />
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Render campo (input/select/textarea) ──────────────────────────────────
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
        ) : f.type === 'select' ? (
          <select value={v} onChange={e => setField(f.key, e.target.value)} style={baseStyle}>
            <option value="">— Seleccionar —</option>
            {(f.options || []).map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g,' ')}</option>)}
          </select>
        ) : (
          <input type={f.type || 'text'} value={v} onChange={e => setField(f.key, e.target.value)} style={baseStyle} />
        )}
      </div>
    );
  };

  const sections = isTuCoop ? TU_COOP_SECTIONS : (data?.form_sections || []);

  return (
    <div style={{ background:'#f1f5f9', minHeight:'100vh', padding:'0 0 60px' }}>
      <div style={{ background:'linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%)', color:'#fff', padding:'20px 20px', textAlign:'center' }}>
        <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'#bfdbfe', fontWeight:700 }}>Energy Depot LLC</div>
        <div style={{ fontSize:18, fontWeight:800, marginTop:4 }}>{isTuCoop ? 'Solicitud Tu Coop' : 'Solicitud de Préstamo'}</div>
        {data?.cooperativa && <div style={{ fontSize:12, color:'#bfdbfe', marginTop:4 }}>Cooperativa: {data.cooperativa}</div>}
      </div>
      <div style={{ background:'#67e8f9', height:4 }} />

      <div style={{ maxWidth: 860, margin:'18px auto', padding:'0 12px' }}>
        <div style={{ background:'#fff', borderRadius:10, padding:'18px 16px', boxShadow:'0 1px 3px rgba(0,0,0,.08)', marginBottom:14, fontSize:13, color:'#475569', lineHeight:1.5 }}>
          Por favor revisa y completa la información a continuación. Puedes editar cualquier campo. Una vez firmes electrónicamente, recibirás una copia por correo electrónico.
        </div>

        {sections.map(sec => (
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

          <div style={{ fontSize:12, color:'#475569', fontWeight:600, marginBottom:6 }}>Firma</div>
          <SignaturePad value={sig} onChange={setSig} defaultName={name} height={180} />

          <button onClick={submit} disabled={submitting}
            style={{ marginTop:18, width:'100%', background:'#1a3c8f', color:'#fff', border:0, padding:'14px', borderRadius:10, fontSize:15, fontWeight:800, cursor:'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Procesando…' : '✓ Firmar y enviar'}
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
