'use client';
import { useState, useMemo, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-c4232.up.railway.app';

const LOGO = 'https://energy-depot-web.vercel.app/logo.png';

const DEFAULT_PRICING = {
  panelPrice: 1084,
  panelWatts: 550,
  tarifaLuma: 0.26,
  factorProduccion: 1460,
  pmt15: 0.008711,
};
const DEFAULT_BATERIAS = [
  { name: 'SolaX ESS 10.24 kWh', precio: 9900 },
  { name: 'SolaX ESS 15.36 kWh', precio: 12950 },
  { name: 'SolaX ESS 20.48 kWh', precio: 15900 },
  { name: 'FranklinWH G2',       precio: 13539 },
  { name: 'Tesla PowerWall 3',   precio: 11992 },
];

function calc(meses, batPrecio = 0, pricing = DEFAULT_PRICING) {
  const filled = meses.map(Number).filter(v => v > 0);
  if (!filled.length) return null;
  const avg = filled.reduce((a,b)=>a+b,0) / filled.length;
  const annCons = Math.round(avg * 12);
  const panels = Math.round(annCons * 1.07 / pricing.factorProduccion * 1000 / pricing.panelWatts);
  const kw = +(panels * pricing.panelWatts / 1000).toFixed(2);
  const annProd = Math.round(kw * pricing.factorProduccion);
  const costBase = Math.round(panels * pricing.panelPrice);
  const sub = costBase + batPrecio;
  const pagoLuma = Math.round(avg * pricing.tarifaLuma);
  const offset = annCons > 0 ? Math.round(annProd / annCons * 100) : 0;
  return {
    avg: Math.round(avg), annCons, panels, kw, annProd, costBase, offset,
    pagoLuma,
    pagoFV: Math.round(costBase * pricing.pmt15),
    pagoBat: Math.round(sub * pricing.pmt15),
    sub,
    annualSavings: pagoLuma * 12,
  };
}

const fmt = n => '$' + Number(n||0).toLocaleString('en-US');

export default function CotizarPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [meses, setMeses] = useState(Array(12).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [bateriasList, setBateriasList] = useState(DEFAULT_BATERIAS);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [selectedBatt, setSelectedBatt] = useState({}); // { name: qty }

  useEffect(() => {
    fetch(API + '/api/public/solar-config')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.solar_batteries) && d.solar_batteries.length) setBateriasList(d.solar_batteries);
        if (d.solar_pricing) setPricing({ ...DEFAULT_PRICING, ...d.solar_pricing });
      })
      .catch(() => {});
  }, []);

  const batPrecio = useMemo(() => Object.entries(selectedBatt).reduce((s, [name, qty]) => {
    const b = bateriasList.find(x => x.name === name);
    return s + (b?.precio || 0) * (qty || 0);
  }, 0), [selectedBatt, bateriasList]);

  const c = useMemo(() => calc(meses, batPrecio, pricing), [meses, batPrecio, pricing]);

  const setBattQty = (name, delta) => {
    setSelectedBatt(prev => {
      const cur = prev[name] || 0;
      const next = Math.max(0, cur + delta);
      const out = { ...prev };
      if (next === 0) delete out[name];
      else out[name] = next;
      return out;
    });
  };

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Falta tu nombre'); return; }
    if (!email && !phone) { setErr('Falta email o teléfono'); return; }
    if (!c) { setErr('Llena al menos un mes de consumo'); return; }
    setSubmitting(true);
    try {
      const batteries = Object.entries(selectedBatt).map(([n, q]) => ({
        name: n, qty: q, unitPrice: bateriasList.find(b => b.name === n)?.precio || 0,
      }));
      const r = await fetch(API + '/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phonenumber: phone, city,
          meses, calc: c, batteries,
          source: 'autocotizar-web',
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');
      setResult({ ...c, updated: data.updated, batPrecio });
      setStep(3);
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)', fontFamily: "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif", padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <img src={LOGO} alt="Energy Depot" style={{ height: 38 }} />
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>787-627-8585 · energydepotpr.com</div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: step >= s ? '#1a3c8f' : '#e2e8f0' }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px rgba(15,42,92,0.06)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1a3c8f', letterSpacing: 2, marginBottom: 8 }}>PASO 1 DE 3</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f2a5c', marginBottom: 8, lineHeight: 1.2 }}>Cuéntanos sobre ti</h1>
            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 24 }}>Tus datos para preparar la propuesta personalizada.</p>

            <Field label="Nombre completo" value={name} onChange={setName} placeholder="Juan Pérez" />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
            <Field label="Teléfono" type="tel" value={phone} onChange={setPhone} placeholder="787-555-0000" />
            <Field label="Pueblo / Ciudad" value={city} onChange={setCity} placeholder="San Juan" optional />

            {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 12, fontWeight: 500 }}>{err}</div>}

            <button onClick={() => { setErr(''); if (!name.trim()) { setErr('Falta tu nombre'); return; } if (!email && !phone) { setErr('Necesitamos email o teléfono'); return; } setStep(2); }}
              style={{ marginTop: 20, width: '100%', background: 'linear-gradient(135deg, #1a3c8f, #0f2a5c)', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26,60,143,0.25)' }}>
              Siguiente →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px rgba(15,42,92,0.06)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1a3c8f', letterSpacing: 2, marginBottom: 8 }}>PASO 2 DE 3</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f2a5c', marginBottom: 8, lineHeight: 1.2 }}>Tu consumo de luz</h1>
            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 20 }}>Ingresa los kWh de los últimos 12 meses (mira tu factura LUMA). Mientras más completo, más precisa la cotización.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
              {meses.map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginBottom: 4, fontWeight: 600 }}>Mes {i+1}</div>
                  <input type="number" min="0" value={m} onChange={e => { const n=[...meses]; n[i]=e.target.value; setMeses(n); }}
                    style={{ width: '100%', padding: '10px 8px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, textAlign: 'center', outline: 'none', fontWeight: 600, color: '#0f2a5c' }} />
                </div>
              ))}
            </div>

            {c && (
              <div style={{ marginTop: 20, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <Stat label="Promedio mensual" value={`${c.avg} kWh`} />
                <Stat label="Consumo anual" value={`${c.annCons.toLocaleString()} kWh`} />
                <Stat label="Factura LUMA est." value={fmt(c.pagoLuma) + '/mes'} color="#ef4444" />
              </div>
            )}

            {/* Baterías opcionales */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2a5c', marginBottom: 4 }}>¿Quieres añadir batería de respaldo? <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>(opcional)</span></div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Selecciona qué baterías te interesan. Puedes elegir una o varias.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {bateriasList.map(b => {
                  const qty = selectedBatt[b.name] || 0;
                  const active = qty > 0;
                  return (
                    <div key={b.name} style={{ border: active ? '2px solid #1a3c8f' : '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: active ? 'rgba(26,60,143,0.06)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#1a3c8f' : '#0f2a5c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{fmt(b.precio)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button onClick={() => setBattQty(b.name, -1)} disabled={qty === 0} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, fontWeight: 700, cursor: qty > 0 ? 'pointer' : 'default', opacity: qty === 0 ? 0.4 : 1, color: '#0f2a5c' }}>−</button>
                        <div style={{ minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 800, color: active ? '#1a3c8f' : '#94a3b8' }}>{qty}</div>
                        <button onClick={() => setBattQty(b.name, +1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#0f2a5c' }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {batPrecio > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
                  Total baterías: <strong style={{ color: '#1a3c8f' }}>{fmt(batPrecio)}</strong>
                </div>
              )}
            </div>

            {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 12, fontWeight: 500 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(1)}
                style={{ flex: 1, background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                ← Atrás
              </button>
              <button onClick={submit} disabled={submitting}
                style={{ flex: 2, background: 'linear-gradient(135deg, #1a3c8f, #0f2a5c)', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 4px 12px rgba(26,60,143,0.25)' }}>
                {submitting ? 'Calculando…' : 'Ver mi cotización →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 36, boxShadow: '0 4px 24px rgba(15,42,92,0.06)', border: '1px solid #e2e8f0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f2a5c', marginBottom: 8 }}>¡{name.split(' ')[0]}, listo!</h1>
            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 24 }}>
              {result.updated ? 'Actualizamos tu cotización con los datos nuevos.' : 'Recibimos tus datos. Un asesor te contactará pronto.'}
            </p>

            <div style={{ background: 'linear-gradient(135deg, #1a3c8f, #0f2a5c)', borderRadius: 12, padding: 24, color: '#fff', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, letterSpacing: 1, marginBottom: 4 }}>SISTEMA RECOMENDADO</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>{result.kw} kW</div>
              <div style={{ fontSize: 14, opacity: 0.85 }}>{result.panels} paneles · {result.annProd.toLocaleString()} kWh/año · {result.offset}% cobertura</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: result.batPrecio > 0 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <ResultCard label="Pago LUMA actual" value={fmt(result.pagoLuma) + '/mes'} color="#ef4444" sub="Lo que pagas hoy" />
              <ResultCard label="Solar (sin batería)" value={fmt(result.pagoFV) + '/mes'} color="#10b981" sub="Financiado 15 años" />
              {result.batPrecio > 0 && (
                <ResultCard label="Solar + Batería" value={fmt(result.pagoBat) + '/mes'} color="#1a3c8f" sub="Con respaldo de energía" />
              )}
            </div>

            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: 14, fontSize: 13, color: '#78350f', marginBottom: 20 }}>
              💡 Esto es una estimación. Un asesor te dará la cotización final con baterías, financiamiento y opciones específicas para tu hogar.
            </div>

            <a href="https://wa.me/17876278585" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', background: '#25d366', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', marginBottom: 10 }}>
              Hablar por WhatsApp ahora →
            </a>
            <a href="tel:7876278585"
              style={{ display: 'block', background: 'transparent', color: '#1a3c8f', textAlign: 'center', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid #1a3c8f' }}>
              Llamar al 787-627-8585
            </a>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#64748b' }}>
          Energy Depot LLC · Global Plaza Suite 204 · San Juan, PR
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, optional }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#0f2a5c', display: 'block', marginBottom: 6 }}>
        {label} {optional && <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', color: '#0f2a5c', fontWeight: 500 }} />
    </div>
  );
}

function Stat({ label, value, color = '#0f2a5c' }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, color, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function ResultCard({ label, value, color, sub }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, color, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
