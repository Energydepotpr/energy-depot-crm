'use strict';
/**
 * Template HTML para Factura de Proyecto (Energy Depot LLC).
 * Si la factura está pagada agrega una marca de agua "PAGADO" diagonal.
 */

const fs = require('fs');
const path = require('path');

function logoB64() {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '../assets/logo.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

const fmtMoney = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function fmtDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildFacturaHTML({
  invoice,           // row de project_invoices
  cliente,           // { nombre, email, telefono, direccion }
  empresa,           // { nombre, direccion, ein, telefono, email }
  banco,             // texto multilínea con info bancaria (opcional)
}) {
  const isPaid = invoice.status === 'pagada';
  const logo = logoB64();

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Factura ${esc(invoice.numero)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:0;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;background:#fff;font-size:11pt;line-height:1.5;position:relative}
  .page{max-width:780px;margin:0 auto;padding:0 0 40px;position:relative}
  .header{background:linear-gradient(135deg,#0f2558 0%,#1a3c8f 60%, #1a3c8f 100%);color:#fff;padding:28px 40px;display:flex;justify-content:space-between;align-items:flex-start}
  .header .brand{display:flex;align-items:center;gap:14px}
  .header img{height:48px;width:auto;background:#fff;padding:6px 10px;border-radius:8px}
  .header .brand-text{font-weight:800;font-size:18pt;letter-spacing:.4px}
  .header .brand-sub{font-size:9.5pt;color:#bfdbfe;letter-spacing:1.2px;text-transform:uppercase}
  .invnum{text-align:right}
  .invnum .lbl{font-size:9pt;color:#bfdbfe;text-transform:uppercase;letter-spacing:1.5px}
  .invnum .val{font-size:18pt;font-weight:800;margin-top:4px}
  .accent{height:5px;background:#67e8f9}
  .section{padding:24px 40px}
  .grid{display:flex;gap:24px;flex-wrap:wrap}
  .card{flex:1;min-width:220px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
  .card h4{margin:0 0 6px;font-size:9pt;letter-spacing:1.2px;color:#1a3c8f;text-transform:uppercase}
  .card .name{font-weight:700;font-size:12pt;color:#0f172a}
  .card .line{font-size:10pt;color:#475569;margin-top:2px}
  .meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:18px}
  .meta .item{flex:1;min-width:150px}
  .meta .item .l{font-size:9pt;color:#64748b;text-transform:uppercase;letter-spacing:1px}
  .meta .item .v{font-size:11.5pt;font-weight:700;color:#0f172a;margin-top:2px}
  table.items{width:100%;border-collapse:collapse;margin-top:8px;font-size:10.5pt}
  table.items thead th{background:#0f2558;color:#fff;padding:10px 12px;text-align:left;font-weight:600;font-size:10pt;letter-spacing:.4px}
  table.items thead th:last-child{text-align:right}
  table.items tbody td{padding:14px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  table.items tbody td:last-child{text-align:right;font-weight:700;color:#0f172a}
  .total-row{display:flex;justify-content:flex-end;margin-top:14px}
  .total-box{min-width:280px;background:linear-gradient(135deg,#0f2558,#1a3c8f);color:#fff;border-radius:10px;padding:16px 22px}
  .total-box .l{font-size:10pt;color:#bfdbfe;text-transform:uppercase;letter-spacing:1.2px}
  .total-box .v{font-size:22pt;font-weight:800;margin-top:4px}
  .terms{margin-top:26px;background:#f1f5f9;border-left:4px solid #67e8f9;padding:14px 18px;border-radius:0 8px 8px 0;font-size:10pt;color:#334155;white-space:pre-line}
  .footer{margin-top:30px;padding:14px 40px;background:#0f2558;color:#bfdbfe;font-size:9pt;text-align:center}
  ${isPaid ? `
  .paid-stamp{position:fixed;top:42%;left:0;right:0;text-align:center;transform:rotate(-22deg);pointer-events:none;z-index:9999}
  .paid-stamp .lbl{display:inline-block;font-size:140pt;font-weight:900;color:rgba(220,38,38,0.22);letter-spacing:14px;border:14px solid rgba(220,38,38,0.22);padding:18px 60px;border-radius:18px}
  .paid-meta{margin-top:10px;font-size:14pt;color:rgba(220,38,38,0.55);font-weight:700;letter-spacing:2px}
  ` : ''}
</style></head>
<body>
${isPaid ? `<div class="paid-stamp">
  <div class="lbl">PAGADO</div>
  <div class="paid-meta">${esc(fmtDate(invoice.paid_at))}${invoice.paid_method ? ' &middot; ' + esc(String(invoice.paid_method).toUpperCase()) : ''}</div>
</div>` : ''}
<div class="page">
  <div class="header">
    <div class="brand">
      ${logo ? `<img src="${logo}" alt="Energy Depot">` : ''}
      <div>
        <div class="brand-sub">${esc(empresa.nombre || 'Energy Depot LLC')}</div>
        <div class="brand-text">Factura / Invoice</div>
      </div>
    </div>
    <div class="invnum">
      <div class="lbl">Número</div>
      <div class="val">${esc(invoice.numero)}</div>
    </div>
  </div>
  <div class="accent"></div>

  <div class="section">
    <div class="grid">
      <div class="card">
        <h4>Facturado a / Bill to</h4>
        <div class="name">${esc(cliente.nombre || '—')}</div>
        ${cliente.direccion ? `<div class="line">${esc(cliente.direccion).replace(/\n/g,'<br>')}</div>` : ''}
        ${cliente.telefono ? `<div class="line">📞 ${esc(cliente.telefono)}</div>` : ''}
        ${cliente.email ? `<div class="line">✉ ${esc(cliente.email)}</div>` : ''}
      </div>
      <div class="card">
        <h4>De / From</h4>
        <div class="name">${esc(empresa.nombre || 'Energy Depot LLC')}</div>
        ${empresa.direccion ? `<div class="line">${esc(empresa.direccion).replace(/\n/g,'<br>')}</div>` : ''}
        ${empresa.telefono ? `<div class="line">📞 ${esc(empresa.telefono)}</div>` : ''}
        ${empresa.email ? `<div class="line">✉ ${esc(empresa.email)}</div>` : ''}
        ${empresa.ein ? `<div class="line">EIN: ${esc(empresa.ein)}</div>` : ''}
      </div>
    </div>

    <div class="meta">
      <div class="item"><div class="l">Emisión</div><div class="v">${esc(fmtDate(invoice.fecha_emision))}</div></div>
      <div class="item"><div class="l">Vencimiento</div><div class="v">${esc(fmtDate(invoice.fecha_vencimiento))}</div></div>
      <div class="item"><div class="l">Etapa</div><div class="v">${esc(invoice.etapa || '')}</div></div>
      <div class="item"><div class="l">Estado</div><div class="v" style="color:${isPaid?'#16a34a':'#b45309'}">${isPaid ? 'PAGADA' : 'PENDIENTE'}</div></div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:55%">Descripción</th>
          <th style="width:20%">Etapa</th>
          <th style="width:10%;text-align:center">%</th>
          <th style="width:15%">Monto</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(invoice.concepto || invoice.etapa || 'Servicios profesionales')}</td>
          <td>${esc(invoice.etapa || '')}</td>
          <td style="text-align:center">${invoice.porcentaje != null ? Number(invoice.porcentaje).toFixed(0) + '%' : '—'}</td>
          <td>${fmtMoney(invoice.monto)}</td>
        </tr>
      </tbody>
    </table>

    <div class="total-row">
      <div class="total-box">
        <div class="l">Total a pagar</div>
        <div class="v">${fmtMoney(invoice.monto)}</div>
      </div>
    </div>

    <div class="terms"><strong>Términos de pago:</strong>
${esc(banco || 'Aceptamos efectivo, transferencia ACH, cheque y tarjeta de crédito.\nPara coordinar el pago contáctanos al ' + (empresa.telefono || '(787) 627-8585') + '.\nReferencia obligatoria: ' + invoice.numero)}</div>
  </div>

  <div class="footer">
    ${esc(empresa.nombre || 'Energy Depot LLC')} &middot; ${esc(empresa.direccion ? empresa.direccion.split('\n')[0] : 'San Juan, PR')} &middot; ${esc(empresa.telefono || '(787) 627-8585')} &middot; ${esc(empresa.email || 'info@energydepotpr.com')}
  </div>
</div>
</body></html>`;
}

module.exports = { buildFacturaHTML };
