'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

const fmt = n => `$${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const NAVY = '#1a3c8f', GREEN = '#10b981', RED = '#ef4444', ORANGE = '#f59e0b';

const PERIODS = [
  { key:'mes', label:'Mes' },
  { key:'trimestre', label:'Trimestre' },
  { key:'semestre', label:'Semestre' },
  { key:'anio', label:'Año' },
  { key:'custom', label:'Personalizado' },
];

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => { const f = () => setM(window.innerWidth < 768); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return m;
}

export default function ContabilidadPage() {
  const isMobile = useIsMobile();
  const [subtab, setSubtab] = useState('reporte');
  const [period, setPeriod] = useState('mes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const qs = () => {
    let q = `?period=${period}`;
    if (period === 'custom' && from) { q += `&from=${from}`; if (to) q += `&to=${to}`; }
    return q;
  };

  return (
    <div style={{ padding: isMobile ? '14px 14px 90px' : '18px 22px', maxWidth: 1300, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--text)' }}>Contabilidad</h1>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, marginBottom: 14 }}>Ganancia por proyecto, gastos operacionales y reportes de ganancia neta ajustada.</div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['reporte','📊 Reporte'],['proyectos','🏗️ Ganancia por proyecto'],['gastos','💸 Gastos operacionales']].map(([k,l]) => (
          <button key={k} onClick={() => setSubtab(k)}
            style={{ background: subtab===k ? NAVY : 'var(--surface)', color: subtab===k ? '#fff' : 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {/* Selector de período (reporte + proyectos) */}
      {subtab !== 'gastos' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              style={{ background: period===p.key ? NAVY : 'transparent', color: period===p.key ? '#fff' : 'var(--muted)', border: '1px solid var(--border)', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{p.label}</button>
          ))}
          {period === 'custom' && (
            <>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', fontSize:13, color:'var(--text)' }} />
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', fontSize:13, color:'var(--text)' }} />
            </>
          )}
        </div>
      )}

      {subtab === 'reporte' && <ReporteTab qs={qs()} isMobile={isMobile} />}
      {subtab === 'proyectos' && <ProyectosTab qs={qs()} isMobile={isMobile} />}
      {subtab === 'gastos' && <GastosTab isMobile={isMobile} />}
    </div>
  );
}

// ── REPORTE ─────────────────────────────────────────────────────────────────
function ReporteTab({ qs, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); api.acctReport(qs).then(setData).catch(e=>setData({error:e.message})).finally(()=>setLoading(false)); }, [qs]);

  if (loading) return <div style={{ color:'var(--muted)', padding:30, textAlign:'center' }}>Cargando…</div>;
  if (data?.error) return <div style={{ color:RED, padding:20 }}>{data.error}</div>;

  const Row = ({ label, value, color, bold, indent, sign }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid var(--border)', paddingLeft: indent ? 28 : 14 }}>
      <span style={{ color: 'var(--text)', fontWeight: bold ? 800 : 500, fontSize: bold ? 15 : 13 }}>{label}</span>
      <span style={{ color: color || 'var(--text)', fontWeight: bold ? 900 : 700, fontSize: bold ? 16 : 14, fontVariantNumeric:'tabular-nums' }}>{sign}{fmt(value)}</span>
    </div>
  );

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 16 }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'12px 14px', background:NAVY, color:'#fff', fontWeight:800, fontSize:14 }}>Estado de resultados</div>
        <Row label="Ingresos (facturado)" value={data.ingreso} color={GREEN} />
        <Row label="− Costo de proyectos" value={data.costoProyectos} color={ORANGE} sign="−" />
        <Row label="= Ganancia bruta" value={data.gananciaBruta} bold color={NAVY} />
        <Row label="− Gastos fijos" value={data.gastosFijos} color={ORANGE} sign="−" indent />
        <Row label="− Gastos variables" value={data.gastosVariables} color={ORANGE} sign="−" indent />
        <Row label="− Total gastos operacionales" value={data.gastosOperacionales} color={ORANGE} sign="−" />
        <div style={{ display:'flex', justifyContent:'space-between', padding:'16px 14px', background: data.gananciaNetaAjustada >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
          <span style={{ fontWeight:900, fontSize:16, color:'var(--text)' }}>Ganancia neta ajustada</span>
          <span style={{ fontWeight:900, fontSize:20, color: data.gananciaNetaAjustada >= 0 ? GREEN : RED, fontVariantNumeric:'tabular-nums' }}>{fmt(data.gananciaNetaAjustada)}</span>
        </div>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'12px 14px', background:'var(--bg)', color:'var(--muted)', fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:0.5 }}>Detalle de gastos ({data.meses} {data.meses===1?'mes':'meses'})</div>
        {(!data.detalleGastos || data.detalleGastos.length===0) && <div style={{ padding:18, color:'var(--muted)', fontSize:13 }}>Sin gastos registrados.</div>}
        {(data.detalleGastos||[]).map((g,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:13 }}>
            <span style={{ color:'var(--text)' }}>
              <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background: g.tipo==='fijo'?NAVY:ORANGE, marginRight:8 }} />
              {g.concepto}{g.recurrente ? ` (×${g.meses})` : ''}
            </span>
            <span style={{ color:'var(--text)', fontWeight:700 }}>{fmt(g.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GANANCIA POR PROYECTO ────────────────────────────────────────────────────
function ProyectosTab({ qs, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = () => { setLoading(true); api.acctProfit(qs).then(setData).catch(e=>setData({error:e.message})).finally(()=>setLoading(false)); };
  useEffect(reload, [qs]);

  const editCost = async (p) => {
    const v = prompt(`Costo del proyecto ${p.numero} (deja vacío para usar el costo de los items):`, p.costo);
    if (v === null) return;
    try { await api.acctSetCost(p.id, v.trim()===''?null:Number(v)); reload(); } catch(e){ alert(e.message); }
  };

  if (loading) return <div style={{ color:'var(--muted)', padding:30, textAlign:'center' }}>Cargando…</div>;
  if (data?.error) return <div style={{ color:RED, padding:20 }}>{data.error}</div>;

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr 1fr':'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        <Kpi label="Ingresos" value={data.totales.ingreso} color={GREEN} />
        <Kpi label="Costo" value={data.totales.costo} color={ORANGE} />
        <Kpi label="Ganancia" value={data.totales.ganancia} color={NAVY} />
      </div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        {data.projects.length===0 && <div style={{ padding:24, color:'var(--muted)', textAlign:'center' }}>Sin facturas en este período.</div>}
        {data.projects.map(p=>(
          <div key={p.id} style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontWeight:700, color:'var(--text)', fontSize:13 }}>{p.numero} · {p.cliente}</span>
              <span style={{ fontSize:11, color:p.ganancia>=0?GREEN:RED, fontWeight:700 }}>{p.margen}% margen</span>
            </div>
            <div style={{ display:'flex', gap:16, fontSize:13, flexWrap:'wrap' }}>
              <span style={{ color:'var(--muted)' }}>Ingreso: <b style={{ color:GREEN }}>{fmt(p.ingreso)}</b></span>
              <span style={{ color:'var(--muted)' }}>Costo: <b style={{ color:ORANGE }}>{fmt(p.costo)}</b>{p.costo_manual && <span title="Costo manual"> ✏️</span>}</span>
              <span style={{ color:'var(--muted)' }}>Ganancia: <b style={{ color:p.ganancia>=0?NAVY:RED }}>{fmt(p.ganancia)}</b></span>
              <button onClick={()=>editCost(p)} style={{ background:'none', border:'none', color:NAVY, fontSize:12, fontWeight:700, cursor:'pointer', marginLeft:'auto' }}>Editar costo</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
      <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1, fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, color, marginTop:4 }}>{fmt(value)}</div>
    </div>
  );
}

// ── GASTOS OPERACIONALES ─────────────────────────────────────────────────────
function GastosTab({ isMobile }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ tipo:'fijo', concepto:'', categoria:'', monto:'', recurrente:true, fecha:'' });

  const reload = () => { setLoading(true); api.acctExpenses().then(d=>setList(d.items||[])).catch(()=>setList([])).finally(()=>setLoading(false)); };
  useEffect(reload, []);

  const add = async () => {
    if (!form.concepto.trim()) return alert('Concepto requerido');
    try {
      await api.acctCreateExpense({ ...form, monto: Number(form.monto)||0 });
      setForm({ tipo:'fijo', concepto:'', categoria:'', monto:'', recurrente:true, fecha:'' });
      reload();
    } catch(e){ alert(e.message); }
  };
  const del = async (id) => { if (!confirm('¿Eliminar este gasto?')) return; try { await api.acctDeleteExpense(id); reload(); } catch(e){ alert(e.message); } };
  const toggle = async (g) => { try { await api.acctUpdateExpense(g.id, { activo: !g.activo }); reload(); } catch(e){ alert(e.message); } };

  const inp = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 11px', fontSize:14, color:'var(--text)', outline:'none' };
  const fijos = list.filter(g=>g.tipo==='fijo'), variables = list.filter(g=>g.tipo==='variable');

  return (
    <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr', gap:16 }}>
      {/* Form */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:16, gridColumn: isMobile?'auto':'1 / -1' }}>
        <div style={{ fontWeight:800, color:'var(--text)', marginBottom:12 }}>Agregar gasto operacional</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Tipo</div>
            <select value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})} style={inp}>
              <option value="fijo">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </div>
          <div style={{ flex:'1 1 160px' }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Concepto</div>
            <input value={form.concepto} onChange={e=>setForm({...form, concepto:e.target.value})} placeholder="Ej: Renta oficina" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
          </div>
          <div style={{ flex:'0 1 130px' }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Categoría</div>
            <input value={form.categoria} onChange={e=>setForm({...form, categoria:e.target.value})} placeholder="renta, salario…" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
          </div>
          <div style={{ flex:'0 0 110px' }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Monto $</div>
            <input type="number" value={form.monto} onChange={e=>setForm({...form, monto:e.target.value})} placeholder="0" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text)', cursor:'pointer', paddingBottom:9 }}>
            <input type="checkbox" checked={form.recurrente} onChange={e=>setForm({...form, recurrente:e.target.checked})} />
            Mensual recurrente
          </label>
          {!form.recurrente && (
            <div style={{ flex:'0 0 150px' }}>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Fecha</div>
              <input type="date" value={form.fecha} onChange={e=>setForm({...form, fecha:e.target.value})} style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
            </div>
          )}
          <button onClick={add} style={{ background:GREEN, color:'#fff', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:800, cursor:'pointer' }}>+ Agregar</button>
        </div>
      </div>

      {[['Fijos', fijos, NAVY], ['Variables', variables, ORANGE]].map(([titulo, arr, color]) => (
        <div key={titulo} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'12px 14px', background:'var(--bg)', fontWeight:700, color, fontSize:13 }}>{titulo} ({arr.length})</div>
          {loading && <div style={{ padding:16, color:'var(--muted)' }}>Cargando…</div>}
          {!loading && arr.length===0 && <div style={{ padding:16, color:'var(--muted)', fontSize:13 }}>Ninguno.</div>}
          {arr.map(g=>(
            <div key={g.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'10px 14px', borderBottom:'1px solid var(--border)', opacity: g.activo?1:0.5 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{g.concepto}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{g.categoria||'—'} · {g.recurrente?'mensual':(g.fecha? new Date(g.fecha).toLocaleDateString('es-PR'):'puntual')}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontWeight:800, color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{fmt(g.monto)}{g.recurrente?'/mes':''}</span>
                <button onClick={()=>toggle(g)} title={g.activo?'Desactivar':'Activar'} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14 }}>{g.activo?'🟢':'⚪'}</button>
                <button onClick={()=>del(g.id)} style={{ background:'none', border:'none', color:RED, cursor:'pointer', fontSize:14 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
