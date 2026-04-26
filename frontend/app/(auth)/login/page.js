'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import Logo from '../../components/Logo';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%)' }}>
      {/* Decorative background glow */}
      <div style={{ position:'absolute', top:'20%', left:'10%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(103,232,249,0.18) 0%,transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'15%', right:'10%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.15) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ background:'#ffffff', borderRadius:16, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.4)', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:28 }}>
          <Logo variant="card" size={36}/>
        </div>

        <div style={{ textAlign:'center', marginBottom:30 }}>
          <h1 style={{ fontSize:18, fontWeight:800, color:'#1a3c8f', letterSpacing:'0.5px' }}>Sistema CRM</h1>
          <p style={{ fontSize:13, color:'#64748b', marginTop:6 }}>Inicia sesión para continuar</p>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#475569', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              style={{ width:'100%', padding:'11px 14px', fontSize:14, border:'1.5px solid #e2e8f0', borderRadius:8, outline:'none', color:'#0f2558', background:'#f8fafc', boxSizing:'border-box', transition:'border 0.15s' }}
              onFocus={e=>e.target.style.borderColor='#1a3c8f'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}
            />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#475569', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width:'100%', padding:'11px 14px', fontSize:14, border:'1.5px solid #e2e8f0', borderRadius:8, outline:'none', color:'#0f2558', background:'#f8fafc', boxSizing:'border-box', transition:'border 0.15s' }}
              onFocus={e=>e.target.style.borderColor='#1a3c8f'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}
            />
          </div>
          {error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#991b1b' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ width:'100%', padding:'12px', fontSize:14, fontWeight:700, color:'#fff', background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1a3c8f 0%,#3b82f6 100%)', border:'none', borderRadius:8, cursor: loading?'default':'pointer', marginTop:6, letterSpacing:'0.3px', transition:'opacity 0.15s' }}
          >
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:24, paddingTop:20, borderTop:'1px solid #f1f5f9' }}>
          <div style={{ fontSize:10, color:'#94a3b8', letterSpacing:'1.5px', textTransform:'uppercase', fontWeight:600 }}>Energy Depot LLC</div>
          <div style={{ fontSize:10, color:'#cbd5e1', marginTop:3 }}>energydepotpr.com · 787-627-8585</div>
        </div>
      </div>
    </div>
  );
}
