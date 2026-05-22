'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SignaturePad reutilizable con 3 modos:
 *   - draw   → canvas mouse/touch
 *   - type   → escribir nombre con fuente cursiva
 *   - upload → subir imagen (o PDF si pdfjs CDN carga)
 *
 * Props:
 *   value         dataURL actual (image/png)
 *   onChange(dataUrl)
 *   defaultName   nombre sugerido para el modo "Escribir"
 *   height        alto del area de firma en px (default 160)
 *   accent        color principal (default #1a3c8f)
 */
export default function SignaturePad({
  value = '',
  onChange = () => {},
  defaultName = '',
  height = 160,
  accent = '#1a3c8f',
}) {
  const [mode, setMode] = useState('draw'); // draw | type | upload
  const [typedName, setTypedName] = useState(defaultName || '');
  const [uploadInfo, setUploadInfo] = useState(''); // nombre archivo subido
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const drawnEmpty = useRef(true);
  const wrapRef = useRef(null);

  const isEmpty = !value;

  // ─── Canvas setup ─────────────────────────────────────────────────────────
  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0) return;
    c.width  = rect.width  * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  useEffect(() => {
    if (mode === 'draw') {
      // Esperar a que el canvas esté visible (después del switch de tab)
      requestAnimationFrame(() => setupCanvas());
    }
  }, [mode, setupCanvas]);

  const getPos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - rect.left;
    const y = (t ? t.clientY : e.clientY) - rect.top;
    return { x, y };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    drawnEmpty.current = false;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!drawnEmpty.current) {
      try { onChange(canvasRef.current.toDataURL('image/png')); } catch {}
    }
  };
  const clearAll = () => {
    drawnEmpty.current = true;
    setUploadInfo('');
    if (mode === 'draw') {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
      }
    }
    onChange('');
  };

  // ─── Modo "Escribir" → render texto cursivo a PNG ────────────────────────
  const renderTyped = useCallback((name) => {
    if (!name || !name.trim()) { onChange(''); return; }
    const W = 600, H = 180;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Ajustar tamaño para que entre
    let size = 72;
    const family = `"Dancing Script","Allura","Brush Script MT","Segoe Script",cursive`;
    do {
      ctx.font = `400 ${size}px ${family}`;
      if (ctx.measureText(name).width <= W - 40) break;
      size -= 4;
    } while (size > 24);
    ctx.font = `400 ${size}px ${family}`;
    ctx.fillText(name.trim(), W / 2, H / 2);
    onChange(c.toDataURL('image/png'));
  }, [onChange]);

  useEffect(() => {
    if (mode === 'type') {
      renderTyped(typedName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onTypedChange = (v) => {
    setTypedName(v);
    renderTyped(v);
  };

  // ─── Modo "Subir" ────────────────────────────────────────────────────────
  const imageFileToPng = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try { resolve(c.toDataURL('image/png')); } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const loadPdfJs = () => new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } catch (e) { reject(e); }
    };
    s.onerror = () => reject(new Error('No se pudo cargar pdfjs'));
    document.head.appendChild(s);
  });

  const pdfFirstPageToPng = async (file) => {
    const pdfjsLib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas');
    c.width = viewport.width;
    c.height = viewport.height;
    const ctx = c.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return c.toDataURL('image/png');
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        try {
          const dataUrl = await pdfFirstPageToPng(file);
          setUploadInfo(file.name + ' (página 1)');
          onChange(dataUrl);
        } catch (err) {
          alert('No se pudo procesar el PDF. Sube una imagen (PNG/JPG) en su lugar.');
          e.target.value = '';
          return;
        }
      } else if (file.type.startsWith('image/')) {
        const dataUrl = await imageFileToPng(file);
        setUploadInfo(file.name);
        onChange(dataUrl);
      } else {
        alert('Formato no soportado. Sube una imagen (PNG/JPG) o PDF.');
        e.target.value = '';
      }
    } catch (err) {
      alert('Error procesando el archivo: ' + (err?.message || err));
    }
  };

  // ─── UI ──────────────────────────────────────────────────────────────────
  const tabBtn = (k, label) => (
    <button
      type="button"
      onClick={() => setMode(k)}
      style={{
        flex: 1,
        minHeight: 44,
        padding: '8px 10px',
        border: 'none',
        borderBottom: mode === k ? `3px solid ${accent}` : '3px solid transparent',
        background: mode === k ? 'rgba(26,60,143,0.06)' : 'transparent',
        color: mode === k ? accent : '#475569',
        fontWeight: mode === k ? 800 : 600,
        fontSize: 13,
        cursor: 'pointer',
        borderRadius: '6px 6px 0 0',
      }}
    >{label}</button>
  );

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 10 }}>
        {tabBtn('draw',   '✏️ Dibujar')}
        {tabBtn('type',   '⌨️ Escribir')}
        {tabBtn('upload', '📎 Subir')}
      </div>

      {mode === 'draw' && (
        <div style={{ border: '2px dashed #94a3b8', borderRadius: 8, background: '#f8fafc' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height, touchAction: 'none', display: 'block', borderRadius: 6 }}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          />
        </div>
      )}

      {mode === 'type' && (
        <div>
          <input
            type="text"
            value={typedName}
            onChange={(e) => onTypedChange(e.target.value)}
            placeholder="Escribe tu nombre completo"
            style={{
              width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1',
              borderRadius: 8, fontSize: 15, marginBottom: 8, outline: 'none',
              minHeight: 44,
            }}
          />
          <div style={{
            border: '2px dashed #94a3b8', borderRadius: 8, background: '#f8fafc',
            height, display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', padding: 8,
          }}>
            {typedName.trim() ? (
              <span style={{
                fontFamily: '"Dancing Script","Allura","Brush Script MT","Segoe Script",cursive',
                fontSize: Math.min(64, Math.max(28, Math.floor((height || 160) * 0.5))),
                color: '#0f172a', lineHeight: 1, whiteSpace: 'nowrap',
                maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{typedName.trim()}</span>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: 13 }}>La firma aparecerá aquí</span>
            )}
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <div>
          <label
            htmlFor="sig-file"
            style={{
              display: 'block', textAlign: 'center', cursor: 'pointer',
              border: '2px dashed #94a3b8', borderRadius: 8, background: '#f8fafc',
              padding: '24px 12px', minHeight: 44, color: '#475569', fontSize: 13,
            }}
          >
            📎 Toca para subir una imagen (PNG/JPG) o PDF
            <input id="sig-file" type="file" accept="image/*,application/pdf"
              onChange={onFile}
              style={{ display: 'none' }} />
          </label>
          {value && (
            <div style={{
              marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 8,
              background: '#fff', padding: 8, textAlign: 'center',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="firma" style={{ maxWidth: '100%', maxHeight: height, display: 'inline-block' }} />
              {uploadInfo && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{uploadInfo}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
        <button
          type="button"
          onClick={clearAll}
          style={{
            background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 6,
            padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: '#475569',
            minHeight: 36,
          }}
        >Limpiar</button>
        <span style={{ fontSize: 11, color: isEmpty ? '#94a3b8' : '#16a34a', fontWeight: 600 }}>
          {isEmpty ? 'Sin firma' : '✓ Firma lista'}
        </span>
      </div>
    </div>
  );
}
