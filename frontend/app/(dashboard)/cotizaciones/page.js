'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { loadBaterias, DEFAULT_BATERIAS, loadPricing, DEFAULT_PRICING } from '../../../lib/baterias';

const SIN_BATERIA = { name: 'Sin batería', precio: 0 };

const MESES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function calcular(meses, batPrecio, pricing = DEFAULT_PRICING) {
  const { panelPrice, panelWatts, tarifaLuma, factorProduccion, pmt15 } = pricing;
  const filled = meses.map(Number).filter(v => v > 0);
  if (!filled.length) return null;
  const avgKwh   = filled.reduce((a,b) => a+b, 0) / filled.length;
  const annCons  = Math.round(avgKwh * 12);
  const panels   = Math.round((annCons * 1.07) / factorProduccion * 1000 / panelWatts);
  const systemKw = parseFloat(((panels * panelWatts) / 1000).toFixed(2));
  const annProd  = Math.round(systemKw * factorProduccion);
  const costBase = Math.round(panels * panelPrice);
  const subtotal = costBase + batPrecio;
  const pagoLuma = Math.round(avgKwh * tarifaLuma);
  const annSav   = pagoLuma * 12;
  const roi      = annSav > 0 ? Math.round(costBase / annSav) : 0;
  const offset   = annCons > 0 ? Math.round(annProd / annCons * 100) : 0;
  const pagoFV   = Math.round(costBase * pmt15);
  const pagoBat  = Math.round(subtotal * pmt15);
  return { avgKwh: Math.round(avgKwh), annCons, panels, systemKw, annProd, costBase, subtotal, pagoLuma, annSav, roi, offset, pagoFV, pagoBat };
}

const fmt  = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = n => Number(n).toLocaleString('en-US');

function CotizadorInner() {
  const params     = useSearchParams();
  const leadIdUrl  = params.get('leadId');

  const [info, setInfo]       = useState({ name:'', email:'', phone:'', city:'', address:'', zip:'' });
  const [meses, setMeses]     = useState(Array(12).fill(''));
  const [batIdx, setBatIdx]   = useState(0);
  const [calc, setCalc]       = useState(null);
  const [leadId, setLeadId]   = useState(leadIdUrl || null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [msg, setMsg]         = useState({ text:'', ok:true });
  const [BATERIAS, setBaterias] = useState([SIN_BATERIA, ...DEFAULT_BATERIAS]);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  useEffect(() => {
    loadBaterias().then(list => setBaterias([SIN_BATERIA, ...list]));
    loadPricing().then(setPricing);
  }, []);

  useEffect(() => {
    if (!leadIdUrl) return;
    setLoading(true);
    api.lead(leadIdUrl).then(lead => {
      if (!lead) return;
      setLeadId(lead.id);
      setInfo({
        name:    lead.contact_name || lead.title || '',
        email:   lead.solar_data?.email || lead.contact_email || '',
        phone:   lead.solar_data?.telefono || lead.contact_phone || '',
        city:    lead.solar_data?.city || '',
        address: lead.solar_data?.address || '',
        zip:     lead.solar_data?.zip || '',
      });
      const sd = lead.solar_data || {};
      if (sd.meses?.length) {
        const m = Array(12).fill('');
        sd.meses.slice(0, 12).forEach((v, i) => { m[i] = v || ''; });
        setMeses(m);
      }
      if (sd.batteries?.length) {
        const idx = BATERIAS.findIndex(b => b.name === sd.batteries[0]?.name);
        if (idx >= 0) setBatIdx(idx);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [leadIdUrl]);

  useEffect(() => {
    setCalc(calcular(meses, BATERIAS[batIdx]?.precio || 0, pricing));
  }, [meses, batIdx, pricing, BATERIAS]);

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text:'', ok:true }), 3000); };

  const guardarLead = async () => {
    if (!info.name.trim()) return showMsg('El nombre es requerido', false);
    setSaveLoading(true);
    try {
      const bat = BATERIAS[batIdx];
      const solarData = {
        meses, calc,
        batteries: bat.precio > 0 ? [{ name: bat.name, qty: 1, unitPrice: bat.precio }] : [],
        pagoLuz:   calc?.pagoLuma || '',
        email:     info.email,
        telefono:  info.phone,
        city:      info.city,
        address:   info.address,
        zip:       info.zip,
        submittedAt: new Date().toISOString(),
        source: 'cotizacion-crm',
      };
      if (leadId) {
        await api.saveSolarData(leadId, { solar_data: solarData, value: calc?.costBase || 0 });
        showMsg('✓ Lead actualizado');
      } else {
        const r = await api.createLead({ title: `${info.name}${info.city ? ` — ${info.city}` : ''}`, contact_name: info.name, contact_email: info.email, contact_phone: info.phone, solar_data: solarData, value: calc?.costBase || 0 });
        const newId = r.id || r.lead_id;
        setLeadId(newId);
        showMsg('✓ Lead creado — #' + newId);
      }
    } catch (e) { showMsg('Error: ' + e.message, false); }
    finally { setSaveLoading(false); }
  };

  const generarPDF = async () => {
    const id = leadId;
    if (!id) { await guardarLead(); return; }
    setPdfLoading(true);
    try {
      const data = await api.leadPropuesta(id);
      if (!data.pdf) throw new Error('Sin PDF');
      const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a'); a.href = url; a.download = data.filename || `Propuesta-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showMsg('Error PDF: ' + e.message, false); }
    finally { setPdfLoading(false); }
  };

  const S = {
    card:  { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'18px 20px' },
    lbl:   { fontSize:11, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4, display:'block' },
    inp:   { width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13, color:'var(--text)', outline:'none', boxSizing:'border-box' },
    sec:   { fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 },
    stat:  { background:'var(--bg)', borderRadius:8, padding:'10px 14px', textAlign:'center' },
  };

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>Cargando datos del lead…</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg)', color:'var(--text)' }}>

      {/* Header */}
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>☀️ Cotización Solar</div>
          {leadId && <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>Lead #{leadId}{info.name ? ` · ${info.name}` : ''}</div>}
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {msg.text && <span style={{ fontSize:12, fontWeight:600, color: msg.ok ? '#10b981' : '#ef4444' }}>{msg.text}</span>}
          <button
            onClick={() => {
              const link = (typeof window !== 'undefined' ? window.location.origin : 'https://crm-energydepotpr.com') + '/cotizar';
              navigator.clipboard.writeText(link).then(() => {
                setMsg({ ok: true, text: '✓ Link copiado: ' + link });
                setTimeout(() => setMsg({ ok: true, text: '' }), 4000);
              });
            }}
            title="Copiar link público para que el cliente se autocotice"
            style={{ background:'rgba(124,58,237,0.10)', border:'1px solid #7c3aed', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, color:'#7c3aed', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            Copiar link autocotizar
          </button>
          <button onClick={guardarLead} disabled={saveLoading || !info.name.trim()} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:7, padding:'7px 16px', fontSize:13, fontWeight:600, color:'var(--text)', cursor:'pointer', opacity: saveLoading || !info.name.trim() ? 0.5 : 1 }}>
            {saveLoading ? 'Guardando…' : leadId ? 'Actualizar Lead' : 'Guardar como Lead'}
          </button>
          <button onClick={generarPDF} disabled={!calc || pdfLoading} style={{ background:'#1a3c8f', border:'none', borderRadius:7, padding:'7px 18px', fontSize:13, fontWeight:700, color:'#fff', cursor: calc ? 'pointer' : 'default', opacity: (!calc || pdfLoading) ? 0.5 : 1, display:'flex', alignItems:'center', gap:7 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {pdfLoading ? 'Generando…' : 'Generar Propuesta PDF'}
          </button>
        </div>
      </div>

      {/* Body — 2 columnas */}
      <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 340px', gap:22, alignItems:'start' }}>

        {/* ─── IZQUIERDA: Formulario ─── */}
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

          {/* Info del cliente */}
          <div style={S.card}>
            <div style={S.sec}>Información del Cliente</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Nombre completo *','name','text'],['Email','email','email'],['Teléfono','phone','tel'],['Ciudad','city','text'],['Dirección','address','text'],['ZIP','zip','text']].map(([lbl, key, type]) => (
                <div key={key} style={key==='name'||key==='address'?{gridColumn:'1/-1'}:{}}>
                  <label style={S.lbl}>{lbl}</label>
                  <input type={type} value={info[key]} onChange={e => setInfo(p => ({...p,[key]:e.target.value}))} style={S.inp} placeholder={lbl.replace(' *','')} />
                </div>
              ))}
            </div>
          </div>

          {/* Consumo mensual kWh */}
          <div style={S.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={S.sec}>Consumo Mensual (kWh — de la factura LUMA)</div>
              <button onClick={() => setMeses(Array(12).fill(''))} style={{ fontSize:11, color:'var(--muted)', background:'none', border:'none', cursor:'pointer' }}>Limpiar</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
              {MESES_LABELS.map((m, i) => (
                <div key={i}>
                  <label style={{ ...S.lbl, marginBottom:4 }}>{m}</label>
                  <input type="number" value={meses[i]} onChange={e => { const n=[...meses]; n[i]=e.target.value; setMeses(n); }} placeholder="kWh" min="0"
                    style={{ ...S.inp, textAlign:'center', color: Number(meses[i]) > 0 ? '#3b82f6' : 'var(--text)', fontWeight: Number(meses[i]) > 0 ? 700 : 400 }} />
                </div>
              ))}
            </div>
            {calc && (
              <div style={{ marginTop:12, padding:'8px 12px', background:'var(--bg)', borderRadius:6, fontSize:12, color:'var(--muted)', display:'flex', gap:16, flexWrap:'wrap' }}>
                <span>Promedio: <strong style={{ color:'var(--text)' }}>{fmtK(calc.avgKwh)} kWh/mes</strong></span>
                <span>Pago LUMA estimado: <strong style={{ color:'#ef4444' }}>{fmt(calc.pagoLuma)}/mes</strong></span>
                <span>Consumo anual: <strong style={{ color:'var(--text)' }}>{fmtK(calc.annCons)} kWh</strong></span>
              </div>
            )}
          </div>

          {/* Batería */}
          <div style={S.card}>
            <div style={S.sec}>Sistema de Respaldo (Batería)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {BATERIAS.map((b, i) => (
                <button key={i} onClick={() => setBatIdx(i)} style={{ border: batIdx===i ? '2px solid #1a3c8f' : '1px solid var(--border)', borderRadius:8, padding:'10px 14px', textAlign:'left', cursor:'pointer', background: batIdx===i ? 'rgba(26,60,143,0.1)' : 'var(--bg)', transition:'all 0.15s' }}>
                  <div style={{ fontSize:12, fontWeight:700, color: batIdx===i ? '#60a5fa' : 'var(--text)' }}>{b.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{b.precio > 0 ? fmt(b.precio) : 'Sin respaldo'}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── DERECHA: Resultados ─── */}
        <div style={{ position:'sticky', top:0, display:'flex', flexDirection:'column', gap:14 }}>
          {!calc ? (
            <div style={{ ...S.card, textAlign:'center', padding:'50px 20px' }}>
              <div style={{ fontSize:36, marginBottom:14 }}>☀️</div>
              <div style={{ fontSize:14, color:'var(--muted)', lineHeight:1.6 }}>Ingresa el consumo mensual<br/>para ver la cotización</div>
            </div>
          ) : (<>
            {/* Sistema */}
            <div style={S.card}>
              <div style={S.sec}>Sistema Recomendado</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                {[['Capacidad DC',`${calc.systemKw} kW`],['Paneles',`${calc.panels} unidades`],['Producción/año',`${fmtK(calc.annProd)} kWh`],['Cobertura',`${calc.offset}%`]].map(([k,v]) => (
                  <div key={k} style={S.stat}>
                    <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600, textTransform:'uppercase' }}>{k}</div>
                    <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', marginTop:2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagos */}
            <div style={S.card}>
              <div style={S.sec}>Comparación Mensual</div>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#991b1b' }}>LUMA Actual</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#dc2626' }}>{fmt(calc.pagoLuma)}</div>
                </div>
                <div style={{ background:'#dbeafe', border:'1px solid #93c5fd', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1e40af' }}>Solo Placas</div>
                    <div style={{ fontSize:10, color:'#3b82f6' }}>15 años · 6.5%</div>
                  </div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#1d4ed8' }}>{fmt(calc.pagoFV)}</div>
                </div>
                {BATERIAS[batIdx].precio > 0 && (
                  <div style={{ background:'#ede9fe', border:'1px solid #c4b5fd', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#5b21b6' }}>Placas + Batería</div>
                      <div style={{ fontSize:10, color:'#7c3aed' }}>15 años · 6.5%</div>
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#6d28d9' }}>{fmt(calc.pagoBat)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Precios */}
            <div style={S.card}>
              <div style={S.sec}>Desglose</div>
              <div style={{ display:'flex', flexDirection:'column', gap:7, fontSize:12 }}>
                {[
                  ['Sistema FV', fmt(calc.costBase), false],
                  ...(BATERIAS[batIdx].precio > 0 ? [[BATERIAS[batIdx].name, fmt(BATERIAS[batIdx].precio), false]] : []),
                  ['Total', fmt(calc.subtotal), 'bold'],
                ].map(([k,v,style]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', paddingTop: style==='bold'?8:0, borderTop: style==='bold'?'1px solid var(--border)':undefined }}>
                    <span style={{ color: style==='green'?'#10b981':'var(--muted)' }}>{k}</span>
                    <span style={{ fontWeight: style==='bold'?800:500, color: style==='green'?'#10b981':style==='bold'?'var(--text)':'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ROI */}
            <div style={{ background:'#1a3c8f', borderRadius:10, padding:'14px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[['Ahorro anual estimado', fmt(calc.annSav)],['Retorno de inversión', `${calc.roi} años`]].map(([k,v]) => (
                <div key={k} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k}</div>
                  <div style={{ fontSize:17, fontWeight:900, color:'#fff', marginTop:3 }}>{v}</div>
                </div>
              ))}
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

export default function CotizacionesPage() {
  return (
    <Suspense fallback={<div style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>Cargando…</div>}>
      <CotizadorInner />
    </Suspense>
  );
}
