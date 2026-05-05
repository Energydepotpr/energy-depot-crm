'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const inputWrap = (focused) => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    border: `1.5px solid ${focused ? '#1a3c8f' : '#e2e8f0'}`,
    borderRadius: 10,
    transition: 'all 0.2s ease',
    boxShadow: focused ? '0 0 0 4px rgba(103,232,249,0.25)' : 'none',
  });

  const inputStyle = {
    flex: 1,
    padding: '13px 14px 13px 44px',
    fontSize: 14,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#0f2a5c',
    borderRadius: 10,
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  };

  const iconStyle = {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    pointerEvents: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'inherit', background: '#fff' }}>
      {/* LEFT: Hero */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          background: 'linear-gradient(135deg,#0f2a5c 0%,#1a3c8f 55%,#2563eb 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 56px',
          overflow: 'hidden',
          color: '#fff',
        }}
        className="ed-hero"
      >
        {/* Radial glows */}
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(103,232,249,0.32) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-15%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Subtle grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <img src="https://energy-depot-web.vercel.app/logo.png" alt="Energy Depot" style={{ height: 32, width: 'auto', display: 'block' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', opacity: 0.9 }}>CRM Solar</div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(103,232,249,0.15)', border: '1px solid rgba(103,232,249,0.35)', fontSize: 12, fontWeight: 600, color: '#67e8f9', marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#67e8f9', boxShadow: '0 0 10px #67e8f9' }} />
            Energía solar para Puerto Rico
          </div>
          <h2 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em' }}>
            Gestiona tus leads solares con <span style={{ background: 'linear-gradient(90deg,#67e8f9,#a5f3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>inteligencia</span>.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, marginTop: 18, color: 'rgba(255,255,255,0.78)' }}>
            Pipeline de 7 etapas, cotizaciones automáticas, contratos PDF y seguimiento por SMS — todo en un solo lugar.
          </p>

          <div style={{ display: 'flex', gap: 28, marginTop: 36 }}>
            <Stat value="7" label="Etapas pipeline" />
            <Stat value="100%" label="Boricua" />
            <Stat value="24/7" label="Disponible" />
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          Energy Depot LLC · 787-627-8585 · energydepotpr.com
        </div>
      </div>

      {/* RIGHT: Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#fafbfc' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo (hidden on desktop) */}
          <div className="ed-mobile-logo" style={{ display: 'none', justifyContent: 'center', marginBottom: 24 }}>
            <img src="https://energy-depot-web.vercel.app/logo.png" alt="Energy Depot" style={{ height: 38 }} />
          </div>

          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f2a5c', margin: 0, letterSpacing: '-0.02em' }}>Bienvenido</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
              Inicia sesión en <span style={{ color: '#1a3c8f', fontWeight: 600 }}>Energy Depot CRM</span>
            </p>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                Correo electrónico
              </label>
              <div style={inputWrap(emailFocus)}>
                <svg style={iconStyle} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  placeholder="tu@energydepotpr.com"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                Contraseña
              </label>
              <div style={inputWrap(passFocus)}>
                <svg style={iconStyle} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPassFocus(true)}
                  onBlur={() => setPassFocus(false)}
                  placeholder="••••••••"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#991b1b' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                background: loading
                  ? 'linear-gradient(135deg,#64748b 0%,#94a3b8 100%)'
                  : 'linear-gradient(135deg,#1a3c8f 0%,#2563eb 100%)',
                border: 'none',
                borderRadius: 10,
                cursor: loading ? 'default' : 'pointer',
                marginTop: 6,
                letterSpacing: '0.2px',
                fontFamily: 'inherit',
                boxShadow: btnHover && !loading
                  ? '0 12px 28px rgba(26,60,143,0.45), 0 0 0 4px rgba(103,232,249,0.18)'
                  : '0 6px 16px rgba(26,60,143,0.28)',
                transform: btnHover && !loading ? 'translateY(-1px)' : 'translateY(0)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span className="ed-spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span>Iniciar sesión</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: '#94a3b8', letterSpacing: '0.5px' }}>
            Energy Depot LLC · 787-627-8585 · energydepotpr.com
          </div>
        </div>
      </div>

      <style jsx>{`
        .ed-spinner {
          animation: ed-spin 0.7s linear infinite;
        }
        @keyframes ed-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 860px) {
          :global(.ed-hero) { display: none !important; }
          :global(.ed-mobile-logo) { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
