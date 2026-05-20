'use strict';
const fs   = require('fs');
const path = require('path');
const { LOAN_FORM_SECTIONS } = require('./solicitudPrestamoForm');

function logoB64() {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '../assets/logo.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  .replace(/\n/g,'<br>');

function buildSolicitudHTML({ cooperativa, form_data = {}, signatureDataUrl, signedName, signedAt, createdAt }) {
  const LOGO = logoB64();
  const fechaCorta = (d) => {
    const dt = d ? new Date(d) : new Date();
    const mm = String(dt.getMonth()+1).padStart(2,'0');
    const dd = String(dt.getDate()).padStart(2,'0');
    return `${mm}/${dd}/${dt.getFullYear()}`;
  };

  const renderField = (f) => {
    const v = form_data[f.key];
    const colSpan = f.width === 'full' ? 'grid-column:1/-1' : '';
    return `
      <div class="fld" style="${colSpan}">
        <div class="lbl">${esc(f.label)}</div>
        <div class="val">${v ? esc(v) : '<span class="empty">—</span>'}</div>
      </div>
    `;
  };

  const renderSection = (s) => `
    <div class="sec">
      <div class="sec-title">${esc(s.title)}</div>
      <div class="grid">
        ${s.fields.map(renderField).join('')}
      </div>
    </div>
  `;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Solicitud de Préstamo</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;font-size:10pt;line-height:1.45}
  .header{background:linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%);color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}
  .header .brand{font-size:9pt;letter-spacing:1.5px;text-transform:uppercase;color:#bfdbfe;font-weight:700}
  .header .title{font-size:18pt;font-weight:800;margin-top:4px}
  .header img{height:42px}
  .cyan{height:4px;background:#67e8f9}
  .meta{padding:14px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;gap:18px;font-size:9.5pt}
  .meta b{color:#1a3c8f}
  .body{padding:18px 24px}
  .sec{margin-bottom:14px;page-break-inside:avoid;break-inside:avoid-page}
  .sec-title{font-size:10.5pt;font-weight:800;color:#1a3c8f;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #67e8f9;padding-bottom:4px;margin-bottom:8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}
  .fld{padding:5px 0;border-bottom:1px solid #e2e8f0}
  .fld .lbl{font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
  .fld .val{font-size:10pt;color:#0f172a;font-weight:600;margin-top:2px;word-break:break-word}
  .empty{color:#cbd5e1;font-weight:400}
  .firma-block{margin-top:18px;border:2px solid #1a3c8f;border-radius:10px;padding:16px;background:#f8fafc;page-break-inside:avoid}
  .firma-block .ft{font-size:9pt;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px}
  .firma-img{max-height:90px;max-width:280px;border-bottom:1.5px solid #1a3c8f;padding-bottom:4px}
  .firma-meta{font-size:9pt;color:#475569;margin-top:6px}
  .firma-meta b{color:#1a3c8f}
  .declaracion{font-size:8.5pt;color:#475569;margin-top:14px;line-height:1.55;text-align:justify}
  .foot{background:#0f2558;color:#bfdbfe;padding:10px 24px;font-size:8pt;text-align:center;margin-top:16px}
  .pending{background:#fef3c7;color:#92400e;padding:6px 12px;border-radius:6px;font-size:9pt;font-weight:700;display:inline-block;margin-bottom:8px}
</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">Energy Depot LLC</div>
      <div class="title">Solicitud de Préstamo</div>
    </div>
    ${LOGO ? `<img src="${LOGO}" alt="Energy Depot"/>` : ''}
  </div>
  <div class="cyan"></div>
  <div class="meta">
    <div><b>Cooperativa:</b> ${esc(cooperativa || '—')}</div>
    <div><b>Fecha:</b> ${esc(fechaCorta(createdAt))}</div>
    ${signedAt ? `<div><b>Firmada:</b> ${esc(fechaCorta(signedAt))}</div>` : `<div style="color:#92400e;font-weight:700">⏳ Pendiente firma</div>`}
  </div>
  <div class="body">
    ${LOAN_FORM_SECTIONS.map(renderSection).join('')}

    <div class="declaracion">
      Declaro que la información contenida en esta solicitud es verdadera, correcta y completa, y autorizo a la cooperativa
      a verificar todos los datos suministrados, incluyendo referencias, empleo, historial de crédito e información financiera.
      Entiendo que cualquier información falsa o inexacta podrá resultar en la denegación de la solicitud o cancelación del préstamo.
    </div>

    <div class="firma-block">
      <div class="ft">Firma del solicitante</div>
      ${signatureDataUrl
        ? `<img class="firma-img" src="${signatureDataUrl}" alt="firma" />
           <div class="firma-meta"><b>Nombre:</b> ${esc(signedName || '')} &nbsp; · &nbsp; <b>Firmada:</b> ${esc(signedAt ? new Date(signedAt).toLocaleString('es-PR') : '—')}</div>`
        : `<div style="height:90px;border-bottom:1.5px solid #cbd5e1"></div>
           <div class="firma-meta" style="color:#92400e">⏳ Pendiente de firma electrónica del solicitante.</div>`
      }
    </div>
  </div>
  <div class="foot">Energy Depot LLC · (787) 627-8585 · info@energydepotpr.com · Global Plaza Suite 204, San Juan, PR 00920</div>
</body></html>`;
}

module.exports = { buildSolicitudHTML };
