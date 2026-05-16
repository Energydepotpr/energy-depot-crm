'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { pool } = require('../services/db');
const { generatePDF } = require('../services/puppeteerPool');
const { sendEmail } = require('../services/gmailService');
const { getConfigValue } = require('../services/configService');

async function ensureContratosFirmaTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contratos_firma (
      id SERIAL PRIMARY KEY,
      lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      token VARCHAR(64) UNIQUE NOT NULL,
      pdf_base64 TEXT NOT NULL,
      contrato_data JSONB,
      signature_base64 TEXT,
      signed_at TIMESTAMP,
      signed_ip VARCHAR(64),
      signed_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contratos_firma_lead  ON contratos_firma(lead_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contratos_firma_token ON contratos_firma(token)`);
}

function frontendBase() {
  // Siempre usar el dominio público del CRM para links públicos (firma, share).
  // Ignora FRONTEND_URL si apunta a vercel.app o localhost.
  const fromEnv = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  const isUgly = !fromEnv || fromEnv.includes('localhost') || fromEnv.includes('vercel.app');
  return isUgly ? 'https://crm-energydepotpr.com' : fromEnv;
}

function emailHTMLContratoParaFirma({ cliente, signingUrl }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
    <div style="max-width:600px;margin:0 auto;background:#fff">
      <div style="background:linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%);padding:28px 32px;color:#fff">
        <div style="font-size:11pt;color:#bfdbfe;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Energy Depot LLC</div>
        <div style="font-size:20pt;font-weight:800;margin-top:6px">Tu contrato está listo para firma</div>
      </div>
      <div style="height:5px;background:#67e8f9"></div>
      <div style="padding:30px 32px;font-size:11pt;line-height:1.6">
        <p style="margin:0 0 14px">Hola <strong>${cliente}</strong>,</p>
        <p style="margin:0 0 14px">Gracias por elegir <strong>Energy Depot</strong> para tu proyecto de energía renovable. Adjuntamos tu contrato como referencia y preparamos un enlace seguro para que puedas revisarlo y firmarlo electrónicamente desde tu teléfono o computadora.</p>
        <div style="text-align:center;margin:26px 0">
          <a href="${signingUrl}" style="display:inline-block;background:#1a3c8f;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:12pt">Revisar y firmar el contrato →</a>
        </div>
        <p style="margin:0 0 12px;font-size:10.5pt;color:#475569">Una vez firmes, recibirás automáticamente una copia del contrato firmado por email. Si tienes preguntas, responde a este correo o llámanos al (787) 627-8585.</p>
        <p style="margin:18px 0 0;font-size:10.5pt">Saludos,<br/><strong>Equipo Energy Depot LLC</strong></p>
      </div>
      <div style="background:#0f2558;color:#bfdbfe;padding:14px 32px;font-size:9pt;text-align:center">
        Global Plaza Suite 204 &middot; San Juan, PR 00920 &middot; (787) 627-8585 &middot; info@energydepotpr.com
      </div>
    </div>
  </body></html>`;
}

const fmt  = n => `$ ${Number(n||0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtShort = (d = new Date()) => {
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
};
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function logoB64() {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '../assets/logo.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

/* ============================================================
   HTML — Diseño visual moderno (header navy/cyan, cards de partes,
   tabla de pagos profesional, firmas modernas) + texto LITERAL
   de las 17 cláusulas del Contrato oficial ED-2025.1
   ============================================================ */
function buildContratoHTML(d) {
  const {
    nombre, direccionFisica, direccionPostal, telefono, email,
    ctaAee, numContador, vendedorAsignado, fechaCorta,
    precioTotal, pronto, pct45a, pct45b, pct10, pctLabels = ['','',''], esEfectivo,
    signatureDataUrl, signedName, signedAt
  } = d;
  const LOGO = logoB64();
  const numContrato = `ED-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;

  const dfCompradorLines = (direccionFisica || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);
  const dpCompradorLines = (direccionPostal || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);

  // Tabla de desembolsos (filas)
  const pagos = esEfectivo
    ? [
        { monto: pct45a, pct: pctLabels[0] || '50%', desc: 'Materiales y firma de contrato', when: 'Al firmar' },
        { monto: pct45b, pct: pctLabels[1] || '50%', desc: 'Instalación y certificación',     when: 'Al concluir' },
      ]
    : [
        ...(pronto > 0 ? [{ monto: pronto, pct: '—', desc: 'Pronto otorgado por cliente', when: 'Inicial' }] : []),
        { monto: pct45a, pct: pctLabels[0] || '45%', desc: 'Del balance a financiar al firmar el contrato', when: 'Al firmar' },
        { monto: pct45b, pct: pctLabels[1] || '45%', desc: 'Del balance al concluir la instalación del Sistema', when: 'Instalación' },
        { monto: pct10,  pct: pctLabels[2] || '10%', desc: 'Del balance pendiente al concluir la certificación del Sistema', when: 'Certificación' },
      ];

  const pagosHTML = pagos.map(p => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#1a3c8f;font-size:11pt;font-family:'Plus Jakarta Sans',-apple-system,'Segoe UI',sans-serif">${fmt(p.monto)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center"><span style="background:#dbeafe;color:#1a3c8f;padding:3px 10px;border-radius:12px;font-size:9.5pt;font-weight:700;font-family:'Plus Jakarta Sans',-apple-system,sans-serif">${p.pct}</span></td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:10pt;color:#374151;font-family:'Plus Jakarta Sans',-apple-system,sans-serif">${p.desc}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:9.5pt;color:#64748b;text-align:right;font-style:italic;font-family:'Plus Jakarta Sans',-apple-system,sans-serif">${p.when}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:Letter;margin:16mm 14mm 18mm 14mm}
  body{font-family:'Times New Roman',Times,serif;color:#1f2937;background:#fff;font-size:11pt;line-height:1.5}
  .sans{font-family:'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}

  /* ===== HEADER ===== */
  .hero{background:linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%);padding:22px 24px;display:flex;align-items:center;justify-content:space-between;color:#fff;border-radius:10px}
  .hero .left{display:flex;align-items:center;gap:18px}
  .hero img{height:56px;width:auto;object-fit:contain;filter:brightness(1.1)}
  .hero .brand{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20pt;font-weight:900;letter-spacing:1px}
  .hero .right{text-align:right;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  .hero .right .t1{font-size:16pt;font-weight:800;line-height:1.1}
  .hero .right .t2{font-size:8.5pt;color:#bfdbfe;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase}
  .hero .right .t3{font-size:8pt;color:#93c5fd;margin-top:6px;font-family:'Courier New',monospace}
  .band{background:#67e8f9;height:5px}

  /* ===== PAGE BLOCKS ===== */
  .page{padding:18px 0 0 0}
  .pagebreak{page-break-before:always}

  /* ===== INTRO ===== */
  h1.title{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15pt;color:#1a3c8f;font-weight:800;margin-bottom:6px;line-height:1.2}
  .meta{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:9.5pt;color:#64748b;margin-bottom:18px;border-bottom:2px solid #e5e7eb;padding-bottom:10px}
  .meta strong{color:#1a3c8f}

  /* ===== PARTES CARDS ===== */
  .partes{display:flex;gap:14px;margin-bottom:18px}
  .partes .card{flex:1;border-radius:10px;padding:16px 18px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  .partes .vendedor{background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid #1a3c8f}
  .partes .comprador{background:#ecfeff;border:1px solid #a5f3fc;border-top:3px solid #06b6d4}
  .partes .label{font-size:8.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
  .partes .vendedor .label{color:#64748b}
  .partes .comprador .label{color:#0e7490}
  .partes .name{font-size:12pt;font-weight:800;margin-bottom:8px}
  .partes .vendedor .name{color:#1a3c8f}
  .partes .comprador .name{color:#155e75}
  .partes .info{font-size:9.5pt;line-height:1.6;color:#475569}
  .partes .info .row{display:flex;gap:6px;margin-top:2px}
  .partes .info .k{color:#94a3b8;min-width:78px;font-weight:600}

  /* ===== ASIGNADO + PRECIO ===== */
  .asignado{background:linear-gradient(135deg,#1a3c8f 0%,#0f2558 100%);color:#fff;padding:14px 22px;border-radius:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  .asignado .lbl{font-size:8.5pt;color:#bfdbfe;letter-spacing:1.5px;text-transform:uppercase;font-weight:700}
  .asignado .v{font-size:12pt;font-weight:700;margin-top:2px}
  .asignado .total{font-size:18pt;font-weight:900;letter-spacing:-0.5px;margin-top:2px}

  /* ===== PREÁMBULO + SECCIONES ===== */
  .preambulo{background:#f8fafc;border-left:3px solid #1a3c8f;padding:12px 16px;margin-bottom:20px;border-radius:0 8px 8px 0;page-break-inside:avoid;break-inside:avoid-page;page-break-after:avoid;break-after:avoid-page}
  .preambulo .head{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:9pt;font-weight:700;color:#1a3c8f;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .preambulo .body{font-size:9pt;color:#374151;line-height:1.5;text-align:justify}
  .preambulo .body p{margin-bottom:6pt}
  .preambulo .head{margin-bottom:6px}

  .seccion-head{font-weight:700;color:#1f2937;text-align:center;text-transform:uppercase;font-size:11pt;margin:14px 0 12px;letter-spacing:1px;page-break-before:always;break-before:page}

  /* ===== CLÁUSULAS ===== */
  .clausula{margin-bottom:14px}
  /* Texto 100% continuo — solo NO partir tabla de pagos y firmas finales */
  table.pagos, .firmas{page-break-inside:avoid;break-inside:avoid-page}
  body, p, .texto, .sub, .sub-bullet, .clausula, .clausula-row{orphans:1;widows:1}
  /* Sin float ni flex — todo block normal para que el texto pagine libre */
  /* Cláusulas 1-17: TEXTO PLANO serif (sin chips ni colores brand) */
  .clausula-row{display:block}
  .clausula .num{display:inline;font-weight:700;color:#1f2937;margin-right:4px}
  .clausula .body{display:inline}
  .clausula .titulo{display:inline;font-weight:700;color:#1f2937;font-size:11pt}
  .clausula .texto{display:block;margin-top:4px;font-size:11pt;color:#1f2937;line-height:1.55;text-align:justify}
  .sub{margin:6px 0 6px 24px;font-size:10.5pt;color:#1f2937;line-height:1.55;text-align:justify}
  .sub .letra{font-weight:700;color:#1f2937}
  .sub-titulo{font-weight:700;color:#1f2937}
  .sub-bullet{margin:4px 0 4px 40px;font-size:10.5pt;color:#1f2937;line-height:1.5}

  /* ===== TABLA DESEMBOLSOS ===== */
  .pagos-wrap{margin-left:42px;margin-top:8px;margin-bottom:6px}
  table.pagos{width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0}
  table.pagos thead tr{background:#1a3c8f}
  table.pagos th{padding:10px 16px;color:#fff;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  table.pagos th.l{text-align:left}
  table.pagos th.c{text-align:center}
  table.pagos th.r{text-align:right}

  /* ===== POR TODO LO CUAL ===== */
  .por-todo{background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:16px 22px;margin-top:18px;text-align:center;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:10.5pt;color:#1a3c8f;font-weight:700}
  .cert-band{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:#f0f9ff;border-left:3px solid #06b6d4;padding:12px 18px;margin:14px 0;font-size:10pt;color:#0c4a6e;text-align:center;font-weight:600;border-radius:0 8px 8px 0}
  .reafirma{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:#f8fafc;border:1px dashed #1a3c8f;padding:14px 18px;margin:16px 0;font-size:10.5pt;color:#1a3c8f;font-weight:600;text-align:center;border-radius:8px}

  /* ===== FIRMAS ===== */
  .firmas{display:flex;gap:80px;margin-top:90px;margin-bottom:60px;page-break-inside:avoid;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  .firmas .col{flex:1;min-width:0}
  .firmas .line{border-bottom:2px solid #1a3c8f;height:60px}
  .firmas .col .lbl{font-size:9pt;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-top:10px}
  .firmas .col .nm{font-size:12pt;font-weight:700;color:#1a3c8f;margin-top:5px;white-space:nowrap;overflow:visible}
  .firmas .col .tt{font-size:9.5pt;color:#64748b;margin-top:2px}

  /* ===== FOOTER ===== */
  .footer{background:#0f2558;color:#bfdbfe;padding:16px 24px;font-size:8pt;text-align:center;letter-spacing:0.4px;margin-top:60px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;border-radius:8px}
  .footer .name{font-weight:700;color:#fff;font-size:9pt;letter-spacing:1.5px;margin-bottom:4px}
  .footer .ver{margin-top:6px;color:#93c5fd;font-style:italic;font-size:7.5pt}
</style>
</head>
<body>

<!-- ============ HERO HEADER ============ -->
<div class="hero">
  <div class="left">
    ${LOGO ? `<img src="${LOGO}"/>` : `<div class="brand">ENERGY DEPOT</div>`}
  </div>
  <div class="right">
    <div class="t1">CONTRATO</div>
    <div class="t2">Desarrollo Proyecto Energía Renovable</div>
    <div class="t3">${numContrato}</div>
  </div>
</div>
<div class="band"></div>

<!-- ============ PÁGINA 1 ============ -->
<div class="page">

  <h1 class="title">Contrato de Desarrollo de Proyecto de Sistema Energía Renovable</h1>
  <div class="meta">Suscrito el <strong>${esc(fechaCorta)}</strong> &middot; Modalidad: <strong>${esEfectivo ? 'Pago en Efectivo' : 'Con Financiamiento'}</strong></div>

  <!-- BLOQUE DE PARTES -->
  <div class="partes">
    <div class="card vendedor">
      <div class="label">Vendedor</div>
      <div class="name">ENERGY DEPOT LLC</div>
      <div class="info">
        <div class="row"><span class="k">Dirección:</span><span>Global Plaza, Suite 204, San Juan, PR 00920</span></div>
        <div class="row"><span class="k">Teléfono:</span><span>787-627-8585</span></div>
        <div class="row"><span class="k">Correo:</span><span>info@energydepotpr.com</span></div>
        <div class="row"><span class="k">Vendedor:</span><span>${esc(vendedorAsignado)}</span></div>
        <div class="row"><span class="k">Fecha cot.:</span><span>${esc(fechaCorta)}</span></div>
      </div>
    </div>
    <div class="card comprador">
      <div class="label">Comprador</div>
      <div class="name">${esc(nombre)}</div>
      <div class="info">
        <div class="row"><span class="k">Dir. física:</span><span>${dfCompradorLines.length ? dfCompradorLines.map(esc).join(', ') : '—'}</span></div>
        <div class="row"><span class="k">Dir. postal:</span><span>${dpCompradorLines.length ? dpCompradorLines.map(esc).join(', ') : '—'}</span></div>
        <div class="row"><span class="k">Teléfono:</span><span>${esc(telefono) || '—'}</span></div>
        <div class="row"><span class="k">Correo:</span><span>${esc(email) || '—'}</span></div>
        <div class="row"><span class="k">Cta AEE:</span><span>${esc(ctaAee) || '—'}</span></div>
        <div class="row"><span class="k">Contador:</span><span>${esc(numContador) || '—'}</span></div>
      </div>
    </div>
  </div>

  <!-- ASIGNADO + PRECIO -->
  <div class="asignado">
    <div>
      <div class="lbl">Vendedor Asignado</div>
      <div class="v">${esc(vendedorAsignado)}</div>
    </div>
    <div style="text-align:right">
      <div class="lbl">Precio Total</div>
      <div class="total">${fmt(precioTotal)}</div>
    </div>
  </div>

  <!-- PREÁMBULO -->
  <div class="preambulo">
    <div class="head">Preámbulo</div>
    <div class="body">
      <p style="margin-bottom:8pt">El presente Contrato de Compraventa de Sistema Energía Renovable (el &ldquo;Contrato&rdquo;) es suscrito hoy por y entre las partes identificadas arriba.</p>
      <p style="margin-bottom:8pt"><strong>Por Cuanto,</strong> ENERGY DEPOT LLC (El &ldquo;Vendedor&rdquo;) es una compañía debidamente registrada en el Departamento de Estado de Puerto Rico bajo el número 390731 y autorizada para operar bajo las leyes del Estado Libre Asociado de Puerto Rico, se dedica a la venta al detal y al por mayor de sistemas energía renovable (el &ldquo;Sistema SELF-ENERGY&rdquo;) en Puerto Rico;</p>
      <p><strong>Por Cuanto,</strong> el Comprador está interesado en adquirir del Vendedor un Sistema SELF-ENERGY para convertir energía solar en energía eléctrica utilizable para suplementar o sustituir el servicio de energía eléctrica en su residencia, comercio o industria. <strong>Por Tanto,</strong> el Comprador y el Vendedor han convenido la compraventa de un Sistema SELF-ENERGY sujeto a los siguientes términos y condiciones.</p>
    </div>
  </div>

  <div class="seccion-head">Términos y Condiciones</div>

  <!-- 1. Descripción -->
  <div class="clausula">
    <div class="titulo"><span class="num">1</span> Descripción del Sistema Energía Renovable</div>
        <div class="texto">El Sistema SELF-ENERGY adquirido por el Comprador del Vendedor es aquél sistema descrito en la cotización de Sistema SELF-ENERGY suscrito por el Vendedor y Comprador que se hace formar parte integral de este Contrato como su Exhibit I (Factura).</div>
  </div>

  <!-- 2. Precio -->
  <div class="clausula">
    <div class="titulo"><span class="num">2</span> Precio</div>
        <div class="texto">El precio del Sistema SERE es la suma de <strong style="color:#1a3c8f">${fmt(precioTotal)}</strong>, más cualquier otro impuesto o cargo aplicable por ley según se desglosa en la Factura de Compra de Sistema SELF-ENERGY que se hace formar parte integral de este Contrato como su <strong><u>Exhibit II</u></strong> (el &ldquo;Precio de Compraventa&rdquo;). El Precio de Compraventa incluye los gastos y costos asociados con la compraventa del Sistema SELF-ENERGY y su instalación. El Precio de Compraventa no incluye los costos o gastos asociados con la remoción o relocalización de sistemas de aires acondicionado, cisternas, plantas eléctricas, antenas, calentadores solares y/o cualquieras otros equipos u obstrucciones, los cuales serán responsabilidad exclusiva del Comprador.</div>
  </div>

  <!-- 3. Desembolso del Precio de Compraventa -->
  <div class="clausula">
    <div class="titulo"><span class="num">3</span> Desembolso del Precio de Compraventa</div>
    <div class="texto">Los desembolsos del Precio de Compraventa <strong>${fmt(precioTotal)}</strong> será(n) realizado(s) por <strong>${esc(nombre)}</strong> de la siguiente forma:</div>
    <div class="pagos-wrap">
      <table class="pagos">
        <thead>
          <tr>
            <th class="l">Monto</th>
            <th class="c">%</th>
            <th class="l">Concepto</th>
            <th class="r">Etapa</th>
          </tr>
        </thead>
        <tbody>${pagosHTML}</tbody>
      </table>
    </div>
    <div class="sub" style="margin-top:8pt">La falta de pago de los desembolsos del Precio de Compraventa conforme a lo antes expresado conllevará, en adición a cualquier otro remedio establecido en este Contrato, la acumulación de intereses por mora a razón de 8% anual.</div>
  </div>

</div>

<!-- ============ PÁGINA 2 ============ --><div class="page">

  <!-- 4. Compraventa con Financiamiento -->
  <div class="clausula">
    <div class="titulo"><span class="num">4</span> Compraventa con Financiamiento</div>
        <div class="texto">Sólo aplicable cuando medie financiamiento para la compra del Sistema SELF-ENERGY, según adelantado por el Comprador en el Preacuerdo de Compraventa de Sistema SELF-ENERGY.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> El calendario de desembolsos del Precio de Compraventa se realizará conforme a los acuerdos llegados entre el Vendedor y la correspondiente institución financiera, los cuales no necesariamente concordarán con el calendario establecido en la Sección 3 de este Contrato. Los desembolsos del Precio de Compraventa serán realizados por la institución financiera directamente al Vendedor.</p>
    <p class="sub"><span class="letra">b.</span> El cierre de las facilidades de crédito a ser utilizadas para el pago del Precio de Compraventa se llevará a cabo no más tarde de 30 días a partir de la firma del presente Contrato.</p>
  </div>

  <!-- 5. Derecho de Acceso -->
  <div class="clausula">
    <div class="titulo"><span class="num">5</span> Derecho de Acceso</div>
        <div class="texto">El Comprador proveerá acceso al personal del Vendedor a las facilidades donde se ubicará el Sistema SELF-ENERGY (las &ldquo;Facilidades&rdquo;) para que éstos puedan ejecutar sus obligaciones bajo este Contrato, incluyendo, sin limitarse, a la instalación, evaluación, inspección, certificación, validación y/o cualquier otra acción necesaria para la operación del Sistema SELF-ENERGY. Con la firma del presente Contrato, el Comprador le Concede al Vendedor un derecho de acceso a las Facilidades para cumplir con sus obligaciones. De igual forma, el Comprador dará acceso a las Facilidades al personal de LUMA Energy o PREPA y/o cualquier agencia gubernamental para que éstos puedan ejecutar sus deberes conforme a la ley y reglamentación aplicable a la generación de energía eléctrica con Sistemas SELF-ENERGY. El Comprador también autoriza el acceso al personal técnico de Energy Depot LLC posterior a la instalación, cuando sea necesario para mantenimiento, inspección, actualización o evaluación del desempeño del Sistema.</div>
  </div>

  <!-- 6. Instalación y Permisos -->
  <div class="clausula">
    <div class="titulo"><span class="num">6</span> Instalación y Permisos</div>
        <div class="texto">El Vendedor será responsable de la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador identificadas en este acuerdo de Compraventa de Sistema SELF-ENERGY. La instalación del Sistema Fotovoltaico comenzará con la obtención de los permisos y endosos necesarios requeridos por ley, si algunos, para la instalación de Sistemas SELF-ENERGY, incluyendo, sin limitarse, al endoso de los planos del diseño eléctrico por LUMA Energy o PREPA. El comienzo de la instalación además estará sujeta al cumplimiento por el Comprador del derecho de acceso requerido en la Sección 5 de este Contrato. El Comprador se obliga a suscribir todo y cualquier documento necesario para la obtención por conducto del Vendedor de cualquier permiso o endoso requerido para la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador y la interconexión del mismo con LUMA Energy o PREPA.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Cumplimiento Regulatorio.</span> Energy Depot LLC realizará la instalación y puesta en marcha del Sistema conforme al Código Eléctrico de Puerto Rico (NEC 2020), los reglamentos de LUMA Energy, y las disposiciones del Negociado de Energía de Puerto Rico (NEPR). Cualquier requisito adicional o modificación solicitada por dichas entidades será responsabilidad del Comprador, incluyendo costos de ingeniería o materiales adicionales que sean necesarios para cumplir con la normativa vigente.</p>
    <p class="sub"><span class="letra">b.</span> <span class="sub-titulo">Cumplimiento de Estándares Técnicos y de Seguridad.</span> Energy Depot LLC garantiza que todos los equipos, componentes y materiales utilizados en la instalación del Sistema SELF-ENERGY cumplen con los estándares y certificaciones aplicables de seguridad y eficiencia eléctrica, incluyendo los establecidos por Underwriters Laboratories (UL), Institute of Electrical and Electronics Engineers (IEEE), National Electrical Code (NEC 2020) y cualquier otra norma técnica vigente en Puerto Rico o los Estados Unidos.</p>
  </div>

  <!-- 6-A. Modificaciones Técnicas -->
  <div class="clausula">
    <div class="titulo"><span class="num" style="font-size:9pt">6-A</span> Modificaciones Técnicas y Sustitución de Equipos</div>
    <div class="texto">Energy Depot LLC podrá realizar ajustes técnicos o sustituciones de componentes en el diseño, equipos o materiales del Sistema, siempre que dichas modificaciones no reduzcan la capacidad nominal de generación contratada. Estos cambios podrán efectuarse por razones de disponibilidad, cumplimiento de normativas eléctricas, seguridad o mejoras tecnológicas, y no constituirán incumplimiento contractual, siempre y cuando se mantenga la capacidad de producción pactada.</div>
  </div>

  <!-- 7. Relevo -->
  <div class="clausula">
    <div class="titulo"><span class="num">7</span> Relevo</div>
        <div class="texto">El Comprador reconoce que la permisilogía de la instalación y certificación por parte de LUMA Energy o PREPA del Sistema SELF-ENERGY depende de la evaluación favorable y endosos por la LUMA Energy o PREPA y otras agencias gubernamentales por lo que releva y exonera al Vendedor de cualquier demora, atraso o costos de mejora estructural solicitada por LUMA Energy o PREPA para la aceptación y cumplimiento de sus obligaciones bajo el presente Contrato de este proyecto para su interconexión en el programa de Medición.</div>
      </div>
  </div>

  <!-- ============ PÁGINA 3 ============ --><div class="page">

  <!-- 8. Mantenimiento -->
  <div class="clausula">
    <div class="titulo"><span class="num">8</span> Mantenimiento</div>
        <div class="texto">El Comprador reconoce que será exclusivamente responsable de la operación, mantenimiento y reparación del Sistema SELF-ENERGY, excepto que aplique cualquier situación cubierta por la garantía limitada del Sistema SELF-ENERGY ofrecida por el Vendedor. El Comprador será exclusivamente responsable de cualquier mantenimiento, reparación y/o requisito necesario (i.e. seguros, etc.) para la aprobación de cualquier Acuerdo de Interconexión, Acuerdo de Medición Neta y/o cualquier otro acuerdo suscrito con LUMA Energy o PREPA relacionado al Sistema SELF-ENERGY (colectivamente, los &ldquo;Acuerdos Energéticos&rdquo;). El Comprador reconoce que los Acuerdos Energéticos son a un término definido y que su renovación depende del cumplimiento por el Comprador de una serie de requisitos establecidos por ley, reglamento y/o en los propios Acuerdos Energéticos. Será responsabilidad exclusiva del Comprador el cumplimiento con dichos Acuerdo Energéticos y los requisitos necesarios para su renovación. Por lo menos tres (3) meses previos al vencimiento de cualquiera de los Acuerdo Energéticos, el Comprador podrá notificar al Vendedor que desea que el Vendedor le refiera, a costo exclusivo del Comprador, un profesional para que lo asista o ayude en la renovación de cualquiera de los Acuerdos Energéticos.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Monitoreo del Sistema y Uso de Datos.</span> El Comprador autoriza a Energy Depot LLC a instalar, acceder y utilizar equipos o software de monitoreo remoto del Sistema con el fin de verificar su desempeño y realizar mantenimiento preventivo. Energy Depot LLC podrá recopilar y analizar datos operacionales del sistema exclusivamente para fines técnicos, de garantía o mejora de servicio. Dichos datos serán tratados como confidenciales y no se divulgarán a terceros sin autorización expresa del Comprador.</p>
  </div>

  <!-- 9. Garantía Limitada -->
  <div class="clausula">
    <div class="titulo"><span class="num">9</span> Garantía Limitada</div>
        <div class="texto">Energy Depot LLC garantiza la labor de instalación por un período de quince (15) años, cubriendo únicamente defectos atribuibles a la instalación original. La garantía no cubre daños causados por terceros, fenómenos naturales, modificaciones no autorizadas, mal uso del sistema o fallas en la red eléctrica externa. Las garantías de los equipos individuales se regirán por los términos y condiciones establecidos por el fabricante de cada componente. El Comprador reconoce que cualquier alteración o reparación realizada sin autorización escrita de Energy Depot LLC anulará esta garantía.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Limitación de Responsabilidad.</span> Energy Depot LLC no será responsable por daños indirectos, incidentales, especiales o consecuentes que surjan del uso o desempeño del Sistema, incluyendo pérdida de ingresos, ahorros o beneficios. La responsabilidad total de Energy Depot LLC bajo este Contrato se limitará, en todo caso, al monto efectivamente pagado por el Comprador por concepto del Sistema SELF-ENERGY.</p>
    <p class="sub"><span class="letra">b.</span> <span class="sub-titulo">Transferibilidad de Garantía.</span> La garantía de quince (15) años establecida en este Contrato aplica exclusivamente al Comprador original del Sistema de Energía Renovable instalado por Energy Depot LLC. En caso de que el inmueble donde se encuentre el sistema sea vendido o transferido durante el período de garantía, Energy Depot LLC, a su sola discreción, podrá ofrecer una transferencia limitada de garantía al nuevo propietario (&ldquo;Segundo Tenedor&rdquo;), siempre que se cumplan las siguientes condiciones:</p>
    <div class="sub-bullet">• El Segundo Tenedor notifique por escrito a Energy Depot LLC dentro de los noventa (90) días siguientes a la compraventa del inmueble.</div>
    <div class="sub-bullet">• El sistema se encuentre en condiciones operativas originales, sin modificaciones, alteraciones ni intervenciones no autorizadas.</div>
    <div class="sub-bullet">• Se realice una inspección técnica certificada por Energy Depot LLC (a costo del Segundo Tenedor) para validar el estado del sistema.</div>
    <p class="sub">Una vez aprobada la transferencia, el Segundo Tenedor gozará de una garantía residual de cinco (5) años contados a partir de la fecha de traspaso, limitada exclusivamente a defectos de instalación y mano de obra. Esta transferencia no incluye componentes eléctricos, paneles, inversores u otros equipos, cuyos términos de garantía continúan regidos por el fabricante original.</p>
    <p class="sub"><span class="letra">c.</span> <span class="sub-titulo">Limitación de Transferencia de Garantía por Herencia.</span> La garantía de quince (15) años ofrecida por Energy Depot LLC es personal e intransferible, y aplica únicamente al Comprador original identificado en este Contrato. En caso de fallecimiento del Comprador y traspaso del inmueble por sucesión o herencia, la garantía no se transferirá automáticamente a los herederos o sucesores del inmueble.</p>
  </div>

</div>

<!-- ============ PÁGINA 4 ============ --><div class="page">

  <p class="sub">No obstante, Energy Depot LLC podrá, a su entera discreción, ofrecer al heredero principal o nuevo titular del inmueble una evaluación técnica y opción de reinscripción de garantía bajo los siguientes términos:</p>
  <div class="sub-bullet">• Que el heredero solicite formalmente la reinscripción dentro de los noventa (90) días siguientes a la inscripción de la herencia.</div>
  <div class="sub-bullet">• Que el sistema se encuentre en condiciones operativas originales, sin alteraciones ni intervención de terceros.</div>
  <div class="sub-bullet">• Que el heredero asuma los costos de inspección, reinscripción y certificación del sistema.</div>
  <p class="sub">Si Energy Depot LLC aprueba dicha reinscripción, se otorgará una garantía residual de tres (3) años, limitada únicamente a defectos de instalación y mano de obra. En ningún caso Energy Depot LLC será responsable por reclamos derivados de fallas, daños o condiciones posteriores al fallecimiento del Comprador original y antes de la reinscripción formal.</p>

  <p class="sub"><span class="letra">d.</span> <span class="sub-titulo">Traspaso de Acuerdo de Medición Neta en Caso de Venta del Inmueble.</span> En caso de que el Comprador original venda o transfiera el inmueble donde se encuentre instalado el Sistema de Energía Renovable, el nuevo propietario (&ldquo;Segundo Tenedor&rdquo;) será responsable de realizar el proceso de traspaso del Acuerdo de Medición Neta ante LUMA Energy o cualquier otra entidad reguladora aplicable.</p>
  <p class="sub">Dicho proceso puede requerir la presentación de nuevas certificaciones eléctricas, la firma de acuerdos actualizados bajo términos diferentes a los originalmente aprobados, o la reevaluación de la infraestructura eléctrica de la red por parte de LUMA Energy o el Negociado de Energía de Puerto Rico (NEPR).</p>
  <p class="sub">Energy Depot LLC no será responsable por:</p>
  <div class="sub-bullet">• La aprobación o rechazo del traspaso del Acuerdo de Medición Neta,</div>
  <div class="sub-bullet">• Cualquier costo, demora o gasto asociado a dicho proceso,</div>
  <div class="sub-bullet">• La pérdida parcial o total de beneficios de medición neta, o</div>
  <div class="sub-bullet">• La declinación o cancelación del sistema en el programa de medición neta debido a limitaciones técnicas, falta de capacidad o cambios regulatorios.</div>
  <p class="sub">El Segundo Tenedor entiende que el derecho a participar en programas de medición neta está sujeto a las políticas y disponibilidad de la red eléctrica en el momento del traspaso, las cuales son totalmente independientes a Energy Depot LLC.</p>

  <div class="cert-band">Energy Depot LLC certifica que todas las instalaciones son realizadas por personal técnico con licencias vigentes del Colegio de Peritos Electricistas de Puerto Rico o bajo su supervisión directa.</div>

  <!-- 10. Facilidades -->
  <div class="clausula">
    <div class="titulo"><span class="num">10</span> Facilidades</div>
        <div class="texto">El Comprador presentara al Vendedor que <strong>__X___</strong> es titular de la Facilidades identificadas con la localización donde se instalará el Sistema SELF-ENERGY o ________ posee autorización legal por escrito del titular de las Facilidades para la instalación del Sistema SELF-ENERGY. El Comprador releva, exonera y se compromete a proveer defensa al Vendedor con respecto a cualquier reclamación que se presente contra el Vendedor relacionado a la falta de autorización por el dueño o titular de las Facilidades para la instalación del Sistema SELF-ENERGY.</div>
  </div>

  <!-- 11. Autorización para Documentación Visual y Mercadeo -->
  <div class="clausula">
    <div class="titulo"><span class="num">11</span> Autorización para Documentación Visual y Mercadeo</div>
        <div class="texto">El Comprador autoriza expresamente a Energy Depot LLC y a sus representantes a grabar, fotografiar y documentar todo el proceso de instalación, inspección, y finalización del Sistema de Energía Renovable, con fines de:</div>
      </div>
    </div>
    <div class="sub-bullet">• Documentación técnica y control de calidad; y</div>
    <div class="sub-bullet">• Promoción y mercadeo del trabajo realizado, incluyendo su publicación en redes sociales, materiales publicitarios, televisión, radio o páginas web.</div>
    <p class="sub">Energy Depot LLC se compromete a salvaguardar la privacidad y datos personales del Comprador conforme a la ley y a no divulgar información que identifique su dirección o datos financieros sin consentimiento adicional.</p>
    <p class="sub">Energy Depot LLC cumplirá con las disposiciones de la Ley 39-2012 de Protección de Información Personal y el Reglamento de Privacidad del Negociado de Energía.</p>
  </div>

</div>

<!-- ============ PÁGINA 5 ============ --><div class="page">

  <!-- 12. Documentos y Facturas -->
  <div class="clausula">
    <div class="titulo"><span class="num">12</span> Documentos y Facturas</div>
        <div class="texto">El Comprador proveerá copia al Vendedor de los Acuerdos Energéticos, así como cualquier otro contrato o acuerdo suscrito con relación al Sistema SELF-ENERGY, así como de copia de las facturas de consumo de energía eléctrica para las Facilidades por un periodo de doce (12) meses luego de instalado el Sistema SELF-ENERGY.</div>
  </div>

  <!-- 13. Notificaciones -->
  <div class="clausula">
    <div class="titulo"><span class="num">13</span> Notificaciones</div>
        <div class="texto">Todas las notificaciones, requerimientos, instrucciones y otras comunicaciones requeridos bajo este Contrato se harán por escrito y serán enviados por correo certificado con acuse de recibo, correo electrónico con acuse de recibo o facsímile o entregadas a la mano a la parte a las siguientes direcciones de las partes que surgen en el encabezamiento.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Cláusula de Comunicación Continua.</span> Energy Depot LLC mantendrá comunicación con el Comprador durante todo el proceso de permisos, instalación y certificación, informando de manera periódica sobre el estatus de los trámites.</p>
  </div>

  <!-- 14. Cancelación del Proyecto -->
  <div class="clausula">
    <div class="titulo"><span class="num">14</span> Cancelación del Proyecto y Aplicación de Pagos</div>
        <div class="texto">En caso de cancelación voluntaria del proyecto por parte del Comprador, o si el contrato se termina antes de completarse por causas ajenas a Energy Depot LLC, cualquier cantidad recibida como pronto, pago parcial o desembolso inicial, ya sea directamente del Comprador o de una institución financiera, se aplicará a los costos incurridos hasta la fecha de cancelación, incluyendo, sin limitarse a:</div>
      </div>
    </div>
    <div class="sub-bullet">• Visita técnica preliminar,</div>
    <div class="sub-bullet">• Desarrollo del diseño conceptual o de ingeniería,</div>
    <div class="sub-bullet">• Preparación del plano eléctrico,</div>
    <div class="sub-bullet">• Trámites de permisos o interconexión, y</div>
    <div class="sub-bullet">• Gastos administrativos y logísticos.</div>
    <p class="sub">Energy Depot LLC devolverá cualquier excedente no utilizado al Comprador una vez deducidos los gastos razonables y documentables.</p>
    <p class="sub">Si los costos incurridos exceden el monto recibido, el Comprador se compromete a cubrir la diferencia dentro de los quince (15) días siguientes a la notificación escrita. La política de cancelación aplica tanto a clientes directos como a proyectos financiados.</p>
  </div>

  <!-- 15. Remedios y Resolución de Controversias -->
  <div class="clausula">
    <div class="titulo"><span class="num">15</span> Remedios y Resolución de Controversias</div>
        <div class="texto">En adición a cualquier remedio provisto por ley y/o cualquier remedio específico establecido en las demás secciones de este Contrato, en caso de incumplimiento por el Comprador de cualesquiera de sus obligaciones bajo este Contrato, el Vendedor podrá, además:</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> En casos donde no medie financiamiento por una institución financiera, (i) dar por terminado el presente Contrato; (ii) tomar posesión del Sistema SELF-ENERGY conforme a lo dispuesto en la Ley de Transacciones Garantizadas de Puerto Rico, según enmendada; (iii) paralizar la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador; (iv) retener cualquier parte del Precio de Compraventa pagado por el Vendedor; y/o (v) acelerar el pago de cualquier desembolso no vencido del Precio de Compraventa.</p>
    <p class="sub"><span class="letra">b.</span> <span class="sub-titulo">Cláusula de Resolución Amistosa Previa al Arbitraje.</span> Antes de acudir al proceso de arbitraje, las partes se comprometen a intentar una reunión de conciliación amistosa dentro de un término de diez (10) días naturales desde la notificación del reclamo. Esta reunión podrá celebrarse de manera presencial o virtual, y no afectará el derecho posterior de las partes a acudir al arbitraje.</p>
    <p class="sub"><span class="letra">c.</span> En caso de incumplimiento de cualquiera de las obligaciones contenidas en este Contrato, las partes acuerdan que toda reclamación, disputa o controversia derivada o relacionada con el presente Contrato, su interpretación, ejecución o terminación, se resolverá exclusivamente mediante arbitraje vinculante ante el Centro de Arbitraje y Mediación de la Cámara de Comercio de Puerto Rico, conforme a su reglamento vigente. Este proceso ofrece un mecanismo rápido, imparcial y especializado, en lugar de recurrir a agencias administrativas como DACO o a los tribunales ordinarios, salvo para ejecutar el laudo arbitral o solicitar medidas provisionales según la ley aplicable. La decisión del árbitro será final, firme y vinculante, y podrá ejecutarse en los tribunales del Estado Libre Asociado de Puerto Rico.</p>
  </div>

  <!-- 16. Fuerza Mayor -->
  <div class="clausula">
    <div class="titulo"><span class="num">16</span> Fuerza Mayor</div>
        <div class="texto">Ninguna de las partes será responsable por el incumplimiento de sus obligaciones contractuales cuando dicho incumplimiento sea resultado directo de eventos fuera de su control razonable, incluyendo, pero sin limitarse a, desastres naturales, eventos climáticos severos (huracanes categoría 3 o más), actos de gobierno, interrupciones en la cadena de suministro, pandemias, huelgas o fallas de terceros como LUMA Energy o PREPA. En tales casos, el plazo de cumplimiento se extenderá por el tiempo que dure la causa de fuerza mayor, sin penalidades para Energy Depot LLC.</div>
      </div>
  </div>

  <!-- ============ PÁGINA 6 ============ --><div class="page">

  <!-- 17. Misceláneos -->
  <div class="clausula">
    <div class="titulo"><span class="num">17</span> Misceláneos</div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Enmiendas.</span> Este Acuerdo únicamente podrá ser enmendado, modificado o cedido mediante el consentimiento por escrito de las partes.</p>
    <p class="sub"><span class="letra">b.</span> <span class="sub-titulo">Ley Aplicable.</span> Este Contrato se regirá e interpretará conforme a las leyes del Estado Libre Asociado de Puerto Rico, incluyendo el Código Civil vigente y la Ley de Arbitraje Comercial, y cualquier disposición aplicable al comercio y contratos privados.</p>
    <p class="sub"><span class="letra">c.</span> <span class="sub-titulo">Cláusula de Cesión y Subcontratación.</span> Energy Depot LLC podrá delegar o subcontratar partes del proyecto a profesionales certificados en Puerto Rico, sin que ello implique modificación del presente contrato ni liberación de sus responsabilidades.</p>
    <p class="sub"><span class="letra">d.</span> <span class="sub-titulo">Separabilidad.</span> Si alguna cláusula de este Contrato resultare inválida, ilegal o no pudiera hacerse valer en el Estado Libre Asociado de Puerto Rico, no se afectará por ello la validez y efectividad de las demás cláusulas y condiciones del Contrato ni se afectará la validez y efectividad de dicha cláusula y las demás cláusulas en cualquier otra jurisdicción en que la cláusula se considere válida.</p>
    <p class="sub"><span class="letra">e.</span> <span class="sub-titulo">No Renuncia.</span> Las partes convienen que si alguna de ellas, en algún momento, no reclama u omite reclamar a la otra parte el cumplimiento de alguna de las cláusulas de este Contrato, no significa que haya renunciado a sus derechos bajo el presente Contrato. En cualquier momento podrá requerir de la otra el cumplimiento específico del mismo.</p>
    <p class="sub"><span class="letra">f.</span> <span class="sub-titulo">Encabezamientos.</span> Los encabezamientos de las secciones y cláusulas en este Contrato se incluyen para referencia y conveniencia y no constituirán parte alguna de este Contrato. Las palabras utilizadas en este Contrato se interpretarán en el género o número que las circunstancias ameriten.</p>
    <p class="sub"><span class="letra">g.</span> <span class="sub-titulo">Jurisdicción.</span> Las partes acuerdan que cualquier acción judicial relacionada con la ejecución o validación de un laudo arbitral se presentará exclusivamente ante los tribunales del Estado Libre Asociado de Puerto Rico.</p>
    <p class="sub"><span class="letra">h.</span> <span class="sub-titulo">Sucesores y Causahabientes.</span> Los pactos y cláusulas aquí contenidas obligarán y beneficiarán a las partes y a sus respectivos causahabientes, albaceas, administradores, sucesores y cesionarios.</p>
    <p class="sub"><span class="letra">i.</span> <span class="sub-titulo">Referencia a cumplimiento con leyes de protección al consumidor.</span> Este contrato cumple con las disposiciones aplicables de la Ley de Prácticas y Anuncios Engañosos de Puerto Rico (Ley Núm. 5 de 23 de abril de 1973) y la Ley de Seguridad de Productos de Consumo (Ley Núm. 108-2011).</p>
    <p class="sub"><span class="letra">i.</span> <span class="sub-titulo">Reconocimiento de Información Precontractual.</span> El Comprador declara haber recibido y comprendido toda la información técnica y económica sobre el proyecto, incluyendo la descripción del sistema, garantías, mantenimiento y limitaciones, previo a la firma del presente contrato.</p>
    <p class="sub"><span class="letra">i.</span> <span class="sub-titulo">Consentimiento y Reconocimiento.</span> Las partes reconocen que han leído el presente Contrato, aceptan y están de acuerdo con las condiciones y términos aquí pactados, y que ejecutan el mismo voluntariamente y con completo entendimiento de los efectos y consecuencias del mismo.</p>
  </div>

  <div class="reafirma">Energy Depot LLC reafirma su compromiso de actuar conforme a los principios de transparencia, servicio responsable y calidad garantizada, buscando siempre la satisfacción y seguridad del cliente.</div>

  <div class="por-todo"><strong>POR TODO LO CUAL,</strong> las partes otorgan este Contrato en la fecha indicada al principio del mismo.</div>

  <!-- FIRMAS -->
  <div class="firmas">
    <div class="col">
      <div class="line"></div>
      <div class="lbl">Vendedor</div>
      <div class="nm">Gilberto J. Díaz Merced</div>
      <div class="tt">CEO &middot; Energy Depot LLC</div>
    </div>
    <div class="col">
      <div class="line" style="position:relative">
        ${signatureDataUrl ? `<img src="${signatureDataUrl}" style="position:absolute;bottom:0;left:0;height:44px;max-width:100%;object-fit:contain"/>` : ''}
      </div>
      <div class="lbl">Comprador</div>
      <div class="nm">${esc(signedName || nombre)}</div>
      <div class="tt">Cliente &middot; Comprador${signedAt ? ` &middot; Firmado ${esc(signedAt)}` : ''}</div>
    </div>
  </div>

  <!-- ============ FOOTER ============ -->
<div class="footer">
  <div class="name">ENERGY DEPOT LLC</div>
  <div>Global Plaza Suite 204 &middot; San Juan, PR 00920 &middot; (787) 627-8585 &middot; info@energydepotpr.com &middot; energydepotpr.com</div>
  <div class="ver">Versión Oficial: Contrato ED-2025.1. Documento confidencial propiedad de Energy Depot LLC. Su uso no autorizado está prohibido.</div>
</div>

</body>
</html>`;
}

/* ============================================================
   POST /api/leads/:id/contrato-solar
   ============================================================ */
async function generarContratoSolar(req, res) {
  try {
    const {
      modalidad = 'financiamiento',
      prontoDado = 0,
      numCtaLuma = '',
      numContador = '',
      vendedor = 'Gilberto J. Díaz',
      direccionPostal = '',
      sendClientEmail = false,
      pcts: pctsCustom = null  // [p1, p2, p3] suman 100 (financiamiento) o [p1, p2] suman 100 (efectivo)
    } = req.body;
    const leadId = req.params.id;
    await ensureContratosFirmaTable();

    const r = await pool.query(
      `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
       FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id WHERE l.id = $1`, [leadId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = r.rows[0];
    const sd   = lead.solar_data || {};
    const calc = sd.calc || {};

    const nombre    = lead.contact_name || lead.title || '';
    const telefono  = sd.telefono || lead.contact_phone || '';
    const email     = sd.email    || lead.contact_email || '';
    const direccionFisica = [sd.address, sd.city ? `${sd.city}${sd.zip ? ', PR ' + sd.zip : ''}` : '']
      .filter(Boolean).join('\n');
    const direccionPostalFinal = direccionPostal || sd.address_postal || sd.addressPostal || '';
    const ctaAee = numCtaLuma || sd.cta_aee || sd.ctaAee || '';
    const numContadorFinal = numContador || sd.num_contador || sd.numContador || '';

    // Precio total — desde cotización activa o cálculo
    const subtotalBruto = Number(calc.costBase || lead.value || 0) +
      (sd.batteries||[]).reduce((s,b) => s + (b.unitPrice||0)*(b.qty||1), 0);
    let descuentoPct = 0;
    if (Array.isArray(sd.quotations) && sd.quotations.length > 0) {
      const q = sd.quotations.find(x => x.id === sd.activeQuotationId) || sd.quotations[0];
      descuentoPct = Number(q?.descuentoPct) || 0;
    }
    if (!descuentoPct) descuentoPct = Number(sd.descuentoPct) || 0;
    descuentoPct = Math.max(0, Math.min(100, descuentoPct));
    const precioTotal = Math.round(subtotalBruto - subtotalBruto * descuentoPct / 100);

    // Calendario de desembolsos
    const esEfectivo = modalidad === 'efectivo';
    const pronto = Number(prontoDado) || 0;
    const balance = Math.max(0, precioTotal - pronto);
    let pct45a, pct45b, pct10;
    let pctLabels = ['', '', ''];
    const sanitize = (arr, n) => {
      if (!Array.isArray(arr) || arr.length < n) return null;
      const nums = arr.slice(0, n).map(x => Number(x) || 0);
      const sum = nums.reduce((a,b)=>a+b, 0);
      if (sum <= 0) return null;
      // Normaliza para sumar 100 (tolera input tipo 50/50 o 0.5/0.5)
      const factor = 100 / sum;
      return nums.map(x => +(x * factor).toFixed(2));
    };
    if (esEfectivo) {
      const p = sanitize(pctsCustom, 2) || [50, 50];
      pct45a = Math.round(precioTotal * p[0] / 100);
      pct45b = precioTotal - pct45a;
      pct10  = 0;
      pctLabels = [`${Math.round(p[0])}%`, `${Math.round(p[1])}%`, ''];
    } else {
      const p = sanitize(pctsCustom, 3) || [45, 45, 10];
      pct45a = Math.round(balance * p[0] / 100);
      pct45b = Math.round(balance * p[1] / 100);
      pct10  = balance - pct45a - pct45b;
      pctLabels = [`${Math.round(p[0])}%`, `${Math.round(p[1])}%`, `${Math.round(p[2])}%`];
    }

    const html = buildContratoHTML({
      nombre,
      direccionFisica,
      direccionPostal: direccionPostalFinal,
      telefono, email,
      ctaAee, numContador: numContadorFinal,
      vendedorAsignado: vendedor,
      fechaCorta: fmtShort(),
      precioTotal, pronto, pct45a, pct45b, pct10, pctLabels,
      esEfectivo
    });

    const pdfBuf = await generatePDF(html, {
      format: 'Letter',
      printBackground: true,
      margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
    });

    const base64 = Buffer.from(pdfBuf).toString('base64');
    const titulo = `Contrato Solar — ${nombre}`;
    const fname  = `Contrato-${(nombre||'cliente').replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`;

    const cr = await pool.query(
      `INSERT INTO contracts (title, contact_id, lead_id, file_base64, file_name, file_size, status, created_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8) RETURNING id`,
      [titulo, lead.contact_id, leadId, base64, fname, pdfBuf.length,
       req.user?.id || null,
       `Modalidad: ${esEfectivo ? 'Efectivo' : 'Financiamiento'}${pronto ? ' · Pronto: $'+pronto.toLocaleString() : ''}`]
    );

    // --- Firma electrónica: crear registro contratos_firma ---
    const token = crypto.createHash('sha256')
      .update(crypto.randomBytes(32).toString('hex') + ':' + leadId + ':' + Date.now())
      .digest('hex').slice(0, 64);

    const contratoData = {
      modalidad, prontoDado: pronto, numCtaLuma: ctaAee, numContador: numContadorFinal,
      vendedor, direccionPostal: direccionPostalFinal,
      precioTotal, pct45a, pct45b, pct10,
      pcts: esEfectivo
        ? [Number(pctLabels[0]?.replace('%','')) || 50, Number(pctLabels[1]?.replace('%','')) || 50]
        : [Number(pctLabels[0]?.replace('%','')) || 45, Number(pctLabels[1]?.replace('%','')) || 45, Number(pctLabels[2]?.replace('%','')) || 10],
      nombre, telefono, email, direccionFisica,
    };

    await pool.query(
      `INSERT INTO contratos_firma (lead_id, token, pdf_base64, contrato_data)
       VALUES ($1, $2, $3, $4)`,
      [leadId, token, base64, contratoData]
    );

    // --- Persistir config del contrato en solar_data.contrato_config ---
    try {
      const contratoConfig = {
        modalidad,
        prontoDado: pronto,
        pcts: esEfectivo
          ? [Number(pctLabels[0].replace('%','')) || 0, Number(pctLabels[1].replace('%','')) || 0]
          : [Number(pctLabels[0].replace('%','')) || 0, Number(pctLabels[1].replace('%','')) || 0, Number(pctLabels[2].replace('%','')) || 0],
        numCtaLuma: ctaAee,
        numContador: numContadorFinal,
        direccionPostal: direccionPostalFinal,
        vendedor,
        updatedAt: new Date().toISOString(),
      };
      await pool.query(
        `UPDATE leads
            SET solar_data = jsonb_set(COALESCE(solar_data, '{}'::jsonb), '{contrato_config}', $1::jsonb, true)
          WHERE id = $2`,
        [JSON.stringify(contratoConfig), leadId]
      );
    } catch (errCfg) {
      console.error('[contratoSolar saveConfig]', errCfg.message);
    }

    const signingUrl = `${frontendBase()}/firmar/${token}`;

    // --- Auto-envío al cliente ---
    let emailSent = false;
    let emailError = null;
    if (sendClientEmail && email) {
      try {
        const from = await getConfigValue('email_from', 'info@energydepotpr.com');
        const bcc  = await getConfigValue('email_auto_bcc', '');
        await sendEmail({
          from, to: email, bcc: bcc || undefined,
          subject: `${nombre || 'Cliente'} — Contrato Energy Depot LLC para firma`,
          html: emailHTMLContratoParaFirma({ cliente: nombre || 'Cliente', signingUrl }),
          attachments: [{ filename: fname, content: base64, encoding: 'base64', contentType: 'application/pdf' }],
        });
        emailSent = true;
      } catch (err) {
        console.error('[contratoSolar email]', err.message);
        emailError = err.message;
      }
    }

    res.json({
      ok: true,
      contract_id: cr.rows[0].id,
      pdf: base64,
      filename: fname,
      signing_url: signingUrl,
      token,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (e) {
    console.error('[contratoSolar]', e.message);
    res.status(500).json({ error: e.message });
  }
}

/* ============================================================
   GET /api/public/firma/:token — HTML del contrato sin firma
   ============================================================ */
async function getFirmaPublic(req, res) {
  try {
    await ensureContratosFirmaTable();
    const { token } = req.params;
    const r = await pool.query(
      `SELECT * FROM contratos_firma WHERE token = $1`, [token]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Enlace no encontrado' });
    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }
    const cd = row.contrato_data || {};
    const html = buildContratoHTML({
      nombre: cd.nombre || '',
      direccionFisica: cd.direccionFisica || '',
      direccionPostal: cd.direccionPostal || '',
      telefono: cd.telefono || '',
      email: cd.email || '',
      ctaAee: cd.numCtaLuma || '',
      numContador: cd.numContador || '',
      vendedorAsignado: cd.vendedor || '',
      fechaCorta: fmtShort(new Date(row.created_at)),
      precioTotal: cd.precioTotal || 0,
      pronto: cd.prontoDado || 0,
      pct45a: cd.pct45a || 0,
      pct45b: cd.pct45b || 0,
      pct10:  cd.pct10  || 0,
      esEfectivo: cd.modalidad === 'efectivo',
      signatureDataUrl: row.signature_base64 || null,
      signedName: row.signed_name || null,
      signedAt: row.signed_at ? new Date(row.signed_at).toLocaleString('es-PR') : null,
    });
    res.json({
      ok: true,
      html,
      already_signed: !!row.signed_at,
      signed_at: row.signed_at,
      signed_name: row.signed_name,
      cliente: cd.nombre || '',
      expires_at: row.expires_at,
    });
  } catch (e) {
    console.error('[getFirmaPublic]', e.message);
    res.status(500).json({ error: e.message });
  }
}

/* ============================================================
   POST /api/public/firma/:token — guarda firma, regenera PDF, envía email
   ============================================================ */
async function postFirmaPublic(req, res) {
  try {
    await ensureContratosFirmaTable();
    const { token } = req.params;
    const { signature, signed_name } = req.body || {};
    if (!signature || !String(signature).startsWith('data:image')) {
      return res.status(400).json({ error: 'Firma inválida' });
    }
    if (!signed_name || !signed_name.trim()) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }
    const r = await pool.query(`SELECT * FROM contratos_firma WHERE token = $1`, [token]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Enlace no encontrado' });
    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }
    if (row.signed_at) {
      return res.status(409).json({ error: 'Este contrato ya fue firmado' });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
    const signedAt = new Date();

    await pool.query(
      `UPDATE contratos_firma
         SET signature_base64 = $1, signed_at = $2, signed_ip = $3, signed_name = $4
       WHERE token = $5`,
      [signature, signedAt, ip, signed_name.trim(), token]
    );

    // Regenerar PDF firmado
    const cd = row.contrato_data || {};
    const signedHtml = buildContratoHTML({
      nombre: cd.nombre || '',
      direccionFisica: cd.direccionFisica || '',
      direccionPostal: cd.direccionPostal || '',
      telefono: cd.telefono || '',
      email: cd.email || '',
      ctaAee: cd.numCtaLuma || '',
      numContador: cd.numContador || '',
      vendedorAsignado: cd.vendedor || '',
      fechaCorta: fmtShort(new Date(row.created_at)),
      precioTotal: cd.precioTotal || 0,
      pronto: cd.prontoDado || 0,
      pct45a: cd.pct45a || 0,
      pct45b: cd.pct45b || 0,
      pct10:  cd.pct10  || 0,
      esEfectivo: cd.modalidad === 'efectivo',
      signatureDataUrl: signature,
      signedName: signed_name.trim(),
      signedAt: signedAt.toLocaleString('es-PR'),
    });
    const pdfBuf = await generatePDF(signedHtml, {
      format: 'Letter', printBackground: true,
      margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
    });
    const signedB64 = Buffer.from(pdfBuf).toString('base64');
    const fname = `Contrato-Firmado-${(cd.nombre || 'cliente').replace(/\s+/g,'-')}-${signedAt.toISOString().slice(0,10)}.pdf`;

    // Guardamos el PDF firmado reemplazando el anterior
    await pool.query(`UPDATE contratos_firma SET pdf_base64 = $1 WHERE token = $2`, [signedB64, token]);

    // Email al cliente + BCC
    let emailSent = false;
    let emailError = null;
    try {
      const from = await getConfigValue('email_from', 'info@energydepotpr.com');
      const bcc  = await getConfigValue('email_auto_bcc', '');
      const to   = cd.email;
      if (to) {
        await sendEmail({
          from, to, bcc: bcc || undefined,
          subject: `Contrato Energy Depot firmado — ${cd.nombre || 'Cliente'}`,
          html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1f2937;max-width:600px">
            <h2 style="color:#1a3c8f">¡Gracias! Hemos recibido tu firma.</h2>
            <p>Hola <strong>${cd.nombre || 'Cliente'}</strong>, adjuntamos copia del contrato firmado para tus registros. Nuestro equipo continuará con los próximos pasos del proyecto y te mantendrá informado.</p>
            <p style="margin-top:18px">Saludos,<br/><strong>Equipo Energy Depot LLC</strong><br/>(787) 627-8585</p>
          </div>`,
          attachments: [{ filename: fname, content: signedB64, encoding: 'base64', contentType: 'application/pdf' }],
        });
        emailSent = true;
      }
    } catch (err) {
      console.error('[postFirmaPublic email]', err.message);
      emailError = err.message;
    }

    res.json({ ok: true, signed_at: signedAt, email_sent: emailSent, email_error: emailError });
  } catch (e) {
    console.error('[postFirmaPublic]', e.message);
    res.status(500).json({ error: e.message });
  }
}

/* ============================================================
   GET /api/leads/:id/contratos-firma — lista contratos del lead
   ============================================================ */
async function listContratosFirma(req, res) {
  try {
    await ensureContratosFirmaTable();
    const leadId = req.params.id;
    const r = await pool.query(
      `SELECT id, token, signed_at, signed_name, created_at, expires_at, contrato_data
         FROM contratos_firma
        WHERE lead_id = $1
        ORDER BY created_at DESC`,
      [leadId]
    );
    const base = frontendBase();
    res.json({
      ok: true,
      contratos: r.rows.map(row => ({
        ...row,
        signing_url: `${base}/firmar/${row.token}`,
        status: row.signed_at ? 'firmado' : (new Date(row.expires_at) < new Date() ? 'expirado' : 'pendiente'),
      })),
    });
  } catch (e) {
    console.error('[listContratosFirma]', e.message);
    res.status(500).json({ error: e.message });
  }
}

/* ============================================================
   GET /api/contratos-firma/:id/pdf — descargar PDF (firmado o no)
   ============================================================ */
async function downloadContratoFirma(req, res) {
  try {
    const r = await pool.query(
      `SELECT pdf_base64, signed_at, contrato_data FROM contratos_firma WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const row = r.rows[0];
    const cd  = row.contrato_data || {};
    const fname = `Contrato${row.signed_at ? '-Firmado' : ''}-${(cd.nombre||'cliente').replace(/\s+/g,'-')}.pdf`;
    res.json({ ok: true, pdf: row.pdf_base64, filename: fname, signed_at: row.signed_at });
  } catch (e) {
    console.error('[downloadContratoFirma]', e.message);
    res.status(500).json({ error: e.message });
  }
}

/* ============================================================
   DELETE /api/contratos-firma/:id — eliminar contrato
   ============================================================ */
async function deleteContratoFirma(req, res) {
  try {
    const r = await pool.query(`DELETE FROM contratos_firma WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error('[deleteContratoFirma]', e.message);
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  generarContratoSolar,
  getFirmaPublic,
  postFirmaPublic,
  listContratosFirma,
  downloadContratoFirma,
  deleteContratoFirma,
};
