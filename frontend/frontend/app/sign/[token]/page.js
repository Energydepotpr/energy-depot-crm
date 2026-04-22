'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

const BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/backend')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

async function apiGet(path) {
  const r = await fetch(`${BASE_URL}${path}`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return {}; }
}

async function apiPost(path, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  return data;
}

// ── Canvas signature component ─────────────────────────────────────────────
function SignatureCanvas({ onReady }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const lastPos   = useRef({ x: 0, y: 0 });
  const hasDrawn  = useRef(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
    hasDrawn.current = true;
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = (e) => {
    e?.preventDefault();
    drawing.current = false;
    if (onReady && hasDrawn.current) {
      onReady(canvasRef.current);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    if (onReady) onReady(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        style={{
          width: '100%',
          height: 180,
          border: '2px solid #cbd5e1',
          borderRadius: 12,
          background: '#f8fafc',
          cursor: 'crosshair',
          display: 'block',
          touchAction: 'none',
        }}
      />
      <button type="button" onClick={clear}
        style={{
          marginTop: 8, background: 'none', border: '1px solid #cbd5e1',
          borderRadius: 8, padding: '5px 14px', fontSize: 12, color: '#64748b',
          cursor: 'pointer',
        }}>
        Limpiar firma
      </button>
    </div>
  );
}

// ── Main sign page ─────────────────────────────────────────────────────────
export default function SignPage() {
  const { token } = useParams();

  const [state,      setState]      = useState('loading'); // loading | ready | already_signed | expired | error | success
  const [contractData,setContractData] = useState(null);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail,setSignerEmail]= useState('');
  const [accepted,   setAccepted]   = useState(false);
  const [sigCanvas,  setSigCanvas]  = useState(null);   // canvas element or null
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');
  const [alreadySigned, setAlreadySigned] = useState(null);

  useEffect(() => {
    if (!token) return;
    apiGet(`/api/public/sign/${token}`)
      .then(data => {
        if (data.error) {
          if (data.error.includes('expirado')) { setState('expired'); }
          else { setState('error'); setErrorMsg(data.error); }
          return;
        }
        if (data.already_signed) {
          setState('already_signed');
          setAlreadySigned({ name: data.signer_name, at: data.signed_at, contract: data.contract });
          return;
        }
        setContractData(data.contract);
        setState('ready');
      })
      .catch(err => {
        setState('error');
        setErrorMsg(err.message || 'Error al cargar el contrato');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!accepted)       return setFormError('Debes aceptar los términos del contrato.');
    if (!signerName.trim()) return setFormError('Tu nombre completo es requerido.');
    if (!sigCanvas)      return setFormError('Por favor dibuja tu firma en el área de abajo.');

    const signatureData = sigCanvas.toDataURL('image/png');

    setSubmitting(true);
    try {
      await apiPost(`/api/public/sign/${token}`, {
        signer_name:    signerName.trim(),
        signer_email:   signerEmail.trim() || undefined,
        signature_data: signatureData,
      });
      setState('success');
    } catch (err) {
      setFormError(err.message || 'Error al firmar');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === 'loading') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #e2e8f0', borderTop: '2px solid #1877f2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          Cargando contrato...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    </div>
  );

  // ── Expired ──────────────────────────────────────────────────────────────
  if (state === 'expired') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
          <h2 style={{ color: '#ef4444', margin: '0 0 8px' }}>Enlace expirado</h2>
          <p style={{ color: '#64748b', margin: 0 }}>Este enlace de firma ha expirado. Contacta al emisor para obtener uno nuevo.</p>
        </div>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === 'error') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <h2 style={{ color: '#ef4444', margin: '0 0 8px' }}>Enlace no válido</h2>
          <p style={{ color: '#64748b', margin: 0 }}>{errorMsg || 'Este enlace no existe o no es válido.'}</p>
        </div>
      </div>
    </div>
  );

  // ── Already signed ────────────────────────────────────────────────────────
  if (state === 'already_signed') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
          <h2 style={{ color: '#10b981', margin: '0 0 8px' }}>Contrato ya firmado</h2>
          {alreadySigned && (
            <p style={{ color: '#64748b', margin: 0 }}>
              <strong>{alreadySigned.contract?.title}</strong> fue firmado
              {alreadySigned.name && <> por <strong>{alreadySigned.name}</strong></>}
              {alreadySigned.at && <> el {new Date(alreadySigned.at).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}</>}.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (state === 'success') return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>✓</div>
          <h2 style={{ color: '#10b981', margin: '0 0 10px', fontSize: 22 }}>¡Contrato firmado exitosamente!</h2>
          <p style={{ color: '#64748b', margin: '0 0 6px', fontSize: 15 }}>
            <strong>{contractData?.title}</strong> ha sido firmado.
          </p>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: 13 }}>
            Puedes cerrar esta ventana. Recibirás una copia si proporcionaste tu email.
          </p>
        </div>
      </div>
    </div>
  );

  // ── Ready — show contract + sign form ────────────────────────────────────
  return (
    <div style={styles.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} * { box-sizing: border-box; }`}</style>
      <div style={styles.card}>
        {/* Header */}
        <div style={{ background: '#1877f2', borderRadius: '16px 16px 0 0', padding: '24px 28px', marginTop: -28, marginLeft: -28, marginRight: -28 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Firma Electrónica</div>
          <h1 style={{ color: '#fff', margin: 0, fontSize: 20, fontWeight: 700 }}>{contractData?.title}</h1>
        </div>

        <div style={{ height: 28 }} />

        {/* Contract content */}
        {contractData?.notes && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 24, maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contenido del contrato</div>
            <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{contractData.notes}</div>
          </div>
        )}

        {contractData?.file_base64 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Documento adjunto</div>
            <a
              href={contractData.file_base64}
              download={contractData.file_name || 'contrato.pdf'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1877f2', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {contractData.file_name || 'Descargar contrato'}
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Accept checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: accepted ? 'rgba(16,185,129,0.04)' : '#fff8ed', border: `1px solid ${accepted ? '#10b981' : '#f59e0b'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', marginBottom: 20 }}>
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#10b981', width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
              He leído, entiendo y acepto todos los términos y condiciones del presente contrato. Entiendo que mi firma electrónica tiene la misma validez legal que una firma manuscrita.
            </span>
          </label>

          {/* Signer info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={styles.label}>Nombre completo *</label>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Juan Pérez"
                required
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Email de confirmación</label>
              <input
                type="email"
                value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                placeholder="tu@email.com"
                style={styles.input}
              />
            </div>
          </div>

          {/* Signature canvas */}
          <div style={{ marginBottom: 24 }}>
            <label style={styles.label}>Firma *</label>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>
              Dibuja tu firma con el dedo (móvil) o el mouse (escritorio):
            </p>
            <SignatureCanvas onReady={canvas => setSigCanvas(canvas)} />
          </div>

          {formError && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
              {formError}
            </div>
          )}

          <button type="submit" disabled={submitting || !accepted}
            style={{
              width: '100%', background: submitting || !accepted ? '#94a3b8' : '#1877f2',
              border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700,
              color: '#fff', cursor: submitting || !accepted ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {submitting ? (
              <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Firmando...</>
            ) : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Firmar contrato
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
            Al firmar, aceptas que esta firma electrónica es legalmente vinculante.
          </p>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px 60px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
    padding: '28px 28px 32px',
    width: '100%',
    maxWidth: 620,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    color: '#1e293b',
    outline: 'none',
    background: '#fff',
  },
};
