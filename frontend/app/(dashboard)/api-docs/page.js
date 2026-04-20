'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

// ── Colores por método HTTP ───────────────────────────────────────────────────
const METHOD_COLORS = {
  GET:    { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#10b981' },
  POST:   { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', text: '#1b9af5' },
  PATCH:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#f59e0b' },
  PUT:    { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#f59e0b' },
  DELETE: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#ef4444' },
};

function MethodBadge({ method }) {
  const c = METHOD_COLORS[method] || { bg: 'rgba(120,128,160,0.12)', border: 'rgba(120,128,160,0.35)', text: '#7880a0' };
  return (
    <span style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      borderRadius: 5,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      fontFamily: 'monospace',
      flexShrink: 0,
    }}>{method}</span>
  );
}

// ── Botón copiar ──────────────────────────────────────────────────────────────
function CopyButton({ text, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: 11,
        color: copied ? '#10b981' : '#7880a0',
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {copied ? '✓ Copiado' : label}
    </button>
  );
}

// ── Bloque de código con highlighting simulado ────────────────────────────────
function CodeBlock({ code, language = 'bash' }) {
  if (!code) return null;

  // Colorear bash/curl de forma básica
  const renderBash = (line) => {
    // Keywords curl / -X / -H / -d
    return line
      .split(/(\bcurl\b|-X [A-Z]+|-H|-d|--header|--data|https?:\/\/[^\s"]+|"[^"]*"|'[^']*')/)
      .map((part, i) => {
        if (/^curl$/.test(part)) return <span key={i} style={{ color: '#f59e0b', fontWeight: 700 }}>{part}</span>;
        if (/^-[XHd]/.test(part)) return <span key={i} style={{ color: '#8b5cf6' }}>{part}</span>;
        if (/^https?:\/\//.test(part)) return <span key={i} style={{ color: '#1b9af5' }}>{part}</span>;
        if (/^".*"$/.test(part) || /^'.*'$/.test(part)) return <span key={i} style={{ color: '#10b981' }}>{part}</span>;
        return <span key={i}>{part}</span>;
      });
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        <CopyButton text={code} />
      </div>
      <pre style={{
        background: '#0d1117',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '14px 16px',
        paddingRight: 80,
        fontSize: 12,
        fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
        color: '#c9d1d9',
        overflowX: 'auto',
        whiteSpace: 'pre',
        lineHeight: 1.6,
        margin: 0,
      }}>
        {language === 'bash'
          ? code.split('\n').map((line, i) => <div key={i}>{renderBash(line)}</div>)
          : code}
      </pre>
    </div>
  );
}

// ── Sección de un endpoint ────────────────────────────────────────────────────
function EndpointCard({ endpoint }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Header del endpoint */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%',
          background: open ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          border: 'none',
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
        }}
      >
        <MethodBadge method={endpoint.method} />
        <code style={{ fontFamily: 'monospace', fontSize: 13, color: '#e0e4f0', flex: 1 }}>
          {endpoint.path}
        </code>
        <span style={{ fontSize: 12, color: '#7880a0', flex: 2, paddingRight: 8 }}>
          {endpoint.description}
        </span>
        {!endpoint.auth && (
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', flexShrink: 0 }}>
            público
          </span>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <CopyButton text={endpoint.path} label="Copiar URL" />
          <svg
            width="14" height="14" fill="none" stroke="#7880a0" strokeWidth="2" viewBox="0 0 24 24"
            style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          >
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </div>
      </button>

      {/* Detalles expandidos */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Auth badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 12 }}>
            {endpoint.auth ? (
              <span style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Requiere autenticación (Bearer token)
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><polyline points="20,6 9,17 4,12" />
                </svg>
                Endpoint público — no requiere token
              </span>
            )}
          </div>

          {/* Query params */}
          {endpoint.params && endpoint.params.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Parámetros de query
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Nombre', 'Tipo', 'Requerido', 'Descripción'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#7880a0', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {endpoint.params.map(p => (
                    <tr key={p.name} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <code style={{ color: '#8b5cf6', fontFamily: 'monospace', fontSize: 12 }}>{p.name}</code>
                      </td>
                      <td style={{ padding: '6px 8px', color: '#10b981', fontFamily: 'monospace', fontSize: 11 }}>{p.type}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ color: p.required ? '#ef4444' : '#7880a0', fontSize: 11 }}>
                          {p.required ? 'sí' : 'no'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', color: '#a0a8c0', fontSize: 12 }}>{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Body */}
          {endpoint.body && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Cuerpo de la petición (JSON)
              </div>
              <pre style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#c9d1d9',
                overflowX: 'auto',
                margin: 0,
              }}>
                {JSON.stringify(endpoint.body, null, 2)
                  .split('\n')
                  .map((line, i) => {
                    const keyMatch = line.match(/^(\s*)("[\w_]+")(: )(.+)$/);
                    if (keyMatch) {
                      const [, indent, key, colon, val] = keyMatch;
                      const isStr = val.startsWith('"');
                      return (
                        <div key={i}>
                          {indent}
                          <span style={{ color: '#79c0ff' }}>{key}</span>
                          <span style={{ color: '#c9d1d9' }}>{colon}</span>
                          <span style={{ color: isStr ? '#a5d6ff' : '#ff7b72' }}>{val}</span>
                        </div>
                      );
                    }
                    return <div key={i}>{line}</div>;
                  })
                }
              </pre>
            </div>
          )}

          {/* Response */}
          {endpoint.response && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Ejemplo de respuesta
              </div>
              <pre style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#10b981',
                overflowX: 'auto',
                margin: 0,
              }}>
                {JSON.stringify(endpoint.response, null, 2)}
              </pre>
            </div>
          )}

          {/* Example curl */}
          {endpoint.example && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Ejemplo con curl
              </div>
              <CodeBlock code={endpoint.example} language="bash" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ApiDocsPage() {
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);

  useEffect(() => {
    fetch('/backend/api/docs')
      .then(r => r.json())
      .then(d => { setDocs(d); setActiveGroup(d.resources?.[0]?.name || null); })
      .catch(err => setError(err.message || 'Error cargando documentación'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
      <div style={{ width: 20, height: 20, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: 24 }}>
      <div style={{ color: '#ef4444', fontSize: 13, padding: 16, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
        Error: {error}
      </div>
    </div>
  );

  if (!docs) return null;

  const { info, resources } = docs;
  const activeResource = resources?.find(r => r.name === activeGroup);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Sidebar de navegación */}
      <div style={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        padding: '20px 0',
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{ padding: '0 16px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7880a0' }}>
          Recursos
        </div>
        {resources?.map(r => (
          <button
            key={r.name}
            onClick={() => setActiveGroup(r.name)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: activeGroup === r.name ? 'rgba(59,130,246,0.1)' : 'transparent',
              border: 'none',
              borderRight: `2px solid ${activeGroup === r.name ? '#1b9af5' : 'transparent'}`,
              padding: '7px 16px',
              fontSize: 13,
              color: activeGroup === r.name ? '#e0e4f0' : '#7880a0',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontWeight: activeGroup === r.name ? 600 : 400,
            }}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Contenido principal */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* Header general (solo cuando no hay grupo seleccionado o en la primera vista) */}
        {activeGroup === resources?.[0]?.name && (
          <div style={{ marginBottom: 28, padding: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" stroke="#1b9af5" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>{info?.title}</h1>
                <span style={{ fontSize: 12, color: '#7880a0' }}>v{info?.version}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#a0a8c0', marginBottom: 16, lineHeight: 1.6 }}>{info?.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {/* Base URL */}
              <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Base URL</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <code style={{ fontSize: 11, color: '#1b9af5', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {info?.base_url}
                  </code>
                  <CopyButton text={info?.base_url || ''} />
                </div>
              </div>

              {/* Auth */}
              <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Autenticación</div>
                <code style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'monospace' }}>{info?.authentication?.type}</code>
                <div style={{ fontSize: 11, color: '#7880a0', marginTop: 2 }}>{info?.authentication?.header}</div>
              </div>

              {/* Cómo obtener el token */}
              <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Obtener token</div>
                <code style={{ fontSize: 11, color: '#10b981', fontFamily: 'monospace' }}>{info?.authentication?.obtain}</code>
                <div style={{ fontSize: 11, color: '#7880a0', marginTop: 2 }}>Expira en: {info?.authentication?.expiration}</div>
              </div>
            </div>

            {/* Ejemplo de autenticación */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7880a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Ejemplo: obtener token
              </div>
              <CodeBlock
                language="bash"
                code={`curl -X POST ${info?.base_url || ''}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"tu@email.com","password":"tu-password"}'`}
              />
              <div style={{ fontSize: 11, color: '#7880a0', marginTop: 8 }}>
                Usa el campo <code style={{ color: '#f59e0b', fontFamily: 'monospace' }}>token</code> de la respuesta como{' '}
                <code style={{ color: '#f59e0b', fontFamily: 'monospace' }}>Authorization: Bearer TOKEN</code> en cada petición.
              </div>
            </div>
          </div>
        )}

        {/* Endpoints del recurso activo */}
        {activeResource && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>{activeResource.name}</h2>
              {activeResource.description && (
                <p style={{ fontSize: 13, color: '#7880a0', marginTop: 4, marginBottom: 0 }}>{activeResource.description}</p>
              )}
            </div>

            {activeResource.endpoints?.map((ep, i) => (
              <EndpointCard key={i} endpoint={ep} />
            ))}
          </div>
        )}

        {/* Pie de página */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#7880a0' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>CRM IA Propio · API {info?.version}</span>
            <span>·</span>
            <span>Todos los timestamps son UTC (ISO 8601)</span>
            <span>·</span>
            <span>Rate limit: 100 req/min por token</span>
          </div>
        </div>
      </div>
    </div>
  );
}
