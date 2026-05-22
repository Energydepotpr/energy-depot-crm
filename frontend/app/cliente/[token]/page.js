'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const BACKEND = typeof window !== 'undefined' ? '/backend' : (process.env.API_URL || 'http://localhost:3001');

// Comprime imagen >2MB redimensionando a max 1600px
async function compressIfNeeded(file) {
  const isImage = file.type && file.type.startsWith('image/');
  const fileToB64 = (f) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
  if (!isImage || file.size <= 2 * 1024 * 1024) {
    const b64 = await fileToB64(file);
    return { base64: b64, mime: file.type || 'application/octet-stream', filename: file.name };
  }
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = URL.createObjectURL(file);
    });
    const maxW = 1600;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return { base64: dataUrl.split(',')[1], mime: 'image/jpeg', filename: (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg' };
  } catch {
    const b64 = await fileToB64(file);
    return { base64: b64, mime: file.type || 'application/octet-stream', filename: file.name };
  }
}

const NAVY = '#1a3c8f';
const CYAN = '#67e8f9';

export default function ClienteDocsPage() {
  const { token } = useParams();
  const searchParams = useSearchParams();
  const etapaParam = searchParams?.get('etapa') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(null); // `${etapaId}|${docKey}`
  const [okMsg, setOkMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const qs = etapaParam ? `?etapa=${encodeURIComponent(etapaParam)}` : '';
      const r = await fetch(`${BACKEND}/api/public/client-docs/${token}${qs}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error cargando');
      setData(j);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const handlePickQuotation = async (quotation_id) => {
    setOkMsg('');
    try {
      const r = await fetch(`${BACKEND}/api/public/client-docs/${token}/pick-quotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotation_id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setOkMsg('Cotización elegida correctamente.');
      await load();
      setTimeout(() => setOkMsg(''), 4000);
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleUpload = async (etapa_id, doc_key, file) => {
    if (!file) return;
    const key = `${etapa_id}|${doc_key}`;
    setUploading(key);
    setOkMsg('');
    try {
      const { base64, mime, filename } = await compressIfNeeded(file);
      const r = await fetch(`${BACKEND}/api/public/client-docs/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa_id, doc_key, filename, mime_type: mime, base64 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error subiendo');
      setOkMsg(`Documento "${filename}" subido correctamente.`);
      await load();
      setTimeout(() => setOkMsg(''), 4000);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return <Wrapper><div style={{ padding: 24, color: '#64748b' }}>Cargando…</div></Wrapper>;
  }
  if (error) {
    return <Wrapper>
      <div style={{ padding: 24, color: '#dc2626', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Link inválido</div>
        <div style={{ fontSize: 14 }}>{error}</div>
      </div>
    </Wrapper>;
  }

  if (data?.notReady) {
    return <Wrapper>
      <Header leadName={data.leadName} />
      <div style={{ padding: 20 }}>
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12, padding: 18, color: '#92400e', fontSize: 14, lineHeight: 1.5 }}>
          Aún no podemos recibir tus documentos. Tu asesor de Energy Depot todavía debe elegir la cooperativa de financiamiento. Te avisaremos cuando esté listo.
        </div>
      </div>
    </Wrapper>;
  }

  return (
    <Wrapper>
      <Header leadName={data.leadName} cooperativa={data.cooperativa} />

      {okMsg && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, color: '#065f46', fontSize: 13, fontWeight: 600 }}>
          ✅ {okMsg}
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {data.etapas.map(etapa => {
          const total = etapa.docs.length;
          const done = etapa.docs.filter(d => d.uploaded).length;
          return (
            <div key={etapa.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ background: NAVY, color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{etapa.name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 12 }}>
                  {done}/{total}
                </div>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {etapa.docs.map(d => {
                  const isUp = uploading === `${etapa.id}|${d.key}`;
                  // Caso especial: cotización en etapa 1 → mostrar selector de cotizaciones existentes del lead
                  const isCotizPicker = d.key === 'cotizacion' && etapa.id === 'etapa1' && (data.quotations || []).length > 0;
                  // Caso especial: solicitud Tu Coop → botón para llenar/firmar inline
                  const isTuCoopSolicitud = d.key === 'solicitud' && etapa.id === 'etapa1' && data.tuCoopSolicitud;
                  return (
                    <div key={d.key} style={{
                      border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                      background: d.uploaded ? '#f0fdf4' : '#fafafa',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', flex: 1, lineHeight: 1.35 }}>
                          {d.label}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 12,
                          background: d.uploaded ? '#10b981' : '#f59e0b', color: '#fff', whiteSpace: 'nowrap' }}>
                          {d.uploaded ? '✓ Subido' : 'Pendiente'}
                        </div>
                      </div>
                      {d.uploaded && d.filename && (
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, wordBreak: 'break-all' }}>
                          {d.filename}
                        </div>
                      )}
                      {isCotizPicker ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>Elige tu cotización:</div>
                          {(data.quotations || []).map(q => {
                            const sel = q.id === data.activeQuotationId;
                            return (
                              <button key={q.id} onClick={() => handlePickQuotation(q.id)}
                                disabled={isUp}
                                style={{
                                  textAlign: 'left', padding: '12px 14px', borderRadius: 8,
                                  border: sel ? `2px solid ${NAVY}` : '1px solid #e5e7eb',
                                  background: sel ? '#eff6ff' : '#fff',
                                  cursor: isUp ? 'wait' : 'pointer',
                                  fontFamily: 'inherit',
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{q.name}</div>
                                  {sel && <div style={{ fontSize: 10, color: NAVY, fontWeight: 700 }}>✓ Elegida</div>}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{q.batteries}</div>
                                {q.total > 0 && (
                                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 4 }}>
                                    ${q.total.toLocaleString('en-US')}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : isTuCoopSolicitud ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {data.tuCoopSolicitud.isSigned ? (
                            <div style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ Solicitud firmada</div>
                          ) : data.tuCoopSolicitud.hasData ? (
                            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                              Tu asesor ya pre-llenó la solicitud. Solo necesitas <strong>revisar y firmar</strong>.
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                              Completa los datos del formulario y firma electrónicamente.
                            </div>
                          )}
                          <a href={data.tuCoopSolicitud.signingUrl} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              gap: 8, minHeight: 48, padding: '12px 16px',
                              background: data.tuCoopSolicitud.isSigned ? '#10b981' : NAVY,
                              color: '#fff', border: 'none',
                              borderRadius: 8, fontSize: 14, fontWeight: 700,
                              textDecoration: 'none',
                            }}>
                            {data.tuCoopSolicitud.isSigned
                              ? '👁 Ver solicitud firmada'
                              : data.tuCoopSolicitud.hasData
                                ? '✍️ Revisar y firmar solicitud'
                                : '📝 Llenar y firmar solicitud'}
                          </a>
                        </div>
                      ) : (
                        <label style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 8, minHeight: 48, padding: '12px 16px',
                          background: d.uploaded ? '#fff' : NAVY,
                          color: d.uploaded ? NAVY : '#fff',
                          border: `2px solid ${NAVY}`,
                          borderRadius: 8, fontSize: 14, fontWeight: 700,
                          cursor: isUp ? 'wait' : 'pointer',
                          opacity: isUp ? 0.6 : 1,
                        }}>
                          {isUp ? 'Subiendo…' : (d.uploaded ? '🔄 Reemplazar' : '📎 Adjuntar PDF / Foto')}
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            disabled={isUp}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(etapa.id, d.key, f);
                              e.target.value = '';
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '20px 0' }}>
          Energy Depot LLC · (787) 627-8585<br />
          info@energydepotpr.com
        </div>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      color: '#0f172a',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

function Header({ leadName, cooperativa }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${NAVY} 0%, #2952c2 100%)`,
      color: '#fff',
      padding: '24px 20px',
      borderBottom: `3px solid ${CYAN}`,
    }}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
        Energy Depot
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        Tus documentos
      </div>
      {leadName && (
        <div style={{ fontSize: 14, opacity: 0.95 }}>
          Hola, {leadName}
        </div>
      )}
      {cooperativa && (
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          Financiamiento: {cooperativa}
        </div>
      )}
    </div>
  );
}
