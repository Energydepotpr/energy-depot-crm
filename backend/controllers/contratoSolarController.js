'use strict';
const fs   = require('fs');
const path = require('path');
const { pool } = require('../services/db');
const { generatePDF } = require('../services/puppeteerPool');

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
    precioTotal, pronto, pct45a, pct45b, pct10, esEfectivo
  } = d;
  const LOGO = logoB64();
  const numContrato = `ED-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;

  const dfCompradorLines = (direccionFisica || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);
  const dpCompradorLines = (direccionPostal || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);

  // Tabla de desembolsos (filas)
  const pagos = esEfectivo
    ? [
        { monto: pct45a, pct: '50%', desc: 'Materiales y firma de contrato', when: 'Al firmar' },
        { monto: pct45b, pct: '50%', desc: 'Instalación y certificación',     when: 'Al concluir' },
      ]
    : [
        ...(pronto > 0 ? [{ monto: pronto, pct: '—', desc: 'Pronto otorgado por cliente', when: 'Inicial' }] : []),
        { monto: pct45a, pct: '45%', desc: 'Del balance a financiar al firmar el contrato', when: 'Al firmar' },
        { monto: pct45b, pct: '45%', desc: 'Del balance al concluir la instalación del Sistema', when: 'Instalación' },
        { monto: pct10,  pct: '10%', desc: 'Del balance pendiente al concluir la certificación del Sistema', when: 'Certificación' },
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
  .preambulo{background:#f8fafc;border-left:3px solid #1a3c8f;padding:14px 18px;margin-bottom:20px;border-radius:0 8px 8px 0}
  .preambulo .head{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:9pt;font-weight:700;color:#1a3c8f;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .preambulo .body{font-size:10.5pt;color:#374151;line-height:1.65;text-align:justify}

  .seccion-head{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:11pt;font-weight:800;color:#1a3c8f;text-transform:uppercase;letter-spacing:1.5px;margin:6px 0 14px;padding-bottom:6px;border-bottom:2px solid #1a3c8f}

  /* ===== CLÁUSULAS ===== */
  .clausula{margin-bottom:14px;page-break-inside:avoid}
  .clausula-row{display:flex;align-items:flex-start;gap:12px}
  .clausula .num{flex-shrink:0;width:30px;height:30px;background:#1a3c8f;color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11.5pt;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  .clausula .body{flex:1}
  .clausula .titulo{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-weight:700;color:#1a3c8f;font-size:11pt;margin-bottom:5px}
  .clausula .texto{font-size:10.5pt;color:#374151;line-height:1.6;text-align:justify}
  .sub{margin:6px 0 6px 42px;font-size:10pt;color:#374151;line-height:1.6;text-align:justify}
  .sub .letra{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#0891b2;font-weight:800}
  .sub-titulo{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#1a3c8f;font-weight:700}
  .sub-bullet{margin:4px 0 4px 56px;font-size:10pt;color:#374151;line-height:1.55}

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
  .firmas{display:flex;gap:40px;margin-top:50px;page-break-inside:avoid;font-family:'Plus Jakarta Sans',-apple-system,sans-serif}
  .firmas .col{flex:1}
  .firmas .line{border-bottom:2px solid #1a3c8f;height:46px}
  .firmas .col .lbl{font-size:8.5pt;color:#64748b;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-top:8px}
  .firmas .col .nm{font-size:11pt;font-weight:700;color:#1a3c8f;margin-top:4px}
  .firmas .col .tt{font-size:9.5pt;color:#64748b}

  /* ===== FOOTER ===== */
  .footer{background:#0f2558;color:#bfdbfe;padding:14px 24px;font-size:8pt;text-align:center;letter-spacing:0.4px;margin-top:30px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;border-radius:8px}
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
    <div class="clausula-row">
      <div class="num">1</div>
      <div class="body">
        <div class="titulo">Descripción del Sistema Energía Renovable</div>
        <div class="texto">El Sistema SELF-ENERGY adquirido por el Comprador del Vendedor es aquél sistema descrito en la cotización de Sistema SELF-ENERGY suscrito por el Vendedor y Comprador que se hace formar parte integral de este Contrato como su Exhibit I (Factura).</div>
      </div>
    </div>
  </div>

  <!-- 2. Precio -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">2</div>
      <div class="body">
        <div class="titulo">Precio</div>
        <div class="texto">El precio del Sistema SERE es la suma de <strong style="color:#1a3c8f">${fmt(precioTotal)}</strong>, más cualquier otro impuesto o cargo aplicable por ley según se desglosa en la Factura de Compra de Sistema SELF-ENERGY que se hace formar parte integral de este Contrato como su <strong><u>Exhibit II</u></strong> (el &ldquo;Precio de Compraventa&rdquo;). El Precio de Compraventa incluye los gastos y costos asociados con la compraventa del Sistema SELF-ENERGY y su instalación. El Precio de Compraventa no incluye los costos o gastos asociados con la remoción o relocalización de sistemas de aires acondicionado, cisternas, plantas eléctricas, antenas, calentadores solares y/o cualquieras otros equipos u obstrucciones, los cuales serán responsabilidad exclusiva del Comprador.</div>
      </div>
    </div>
  </div>

  <!-- 3. Desembolso del Precio de Compraventa -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">3</div>
      <div class="body">
        <div class="titulo">Desembolso del Precio de Compraventa</div>
        <div class="texto">Los desembolsos del Precio de Compraventa <strong>${fmt(precioTotal)}</strong> será(n) realizado(s) por <strong>${esc(nombre)}</strong> de la siguiente forma:</div>
      </div>
    </div>
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

<!-- ============ PÁGINA 2 ============ -->
<div class="pagebreak"></div>
<div class="page">

  <!-- 4. Compraventa con Financiamiento -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">4</div>
      <div class="body">
        <div class="titulo">Compraventa con Financiamiento</div>
        <div class="texto">Sólo aplicable cuando medie financiamiento para la compra del Sistema SELF-ENERGY, según adelantado por el Comprador en el Preacuerdo de Compraventa de Sistema SELF-ENERGY.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> El calendario de desembolsos del Precio de Compraventa se realizará conforme a los acuerdos llegados entre el Vendedor y la correspondiente institución financiera, los cuales no necesariamente concordarán con el calendario establecido en la Sección 3 de este Contrato. Los desembolsos del Precio de Compraventa serán realizados por la institución financiera directamente al Vendedor.</p>
    <p class="sub"><span class="letra">b.</span> El cierre de las facilidades de crédito a ser utilizadas para el pago del Precio de Compraventa se llevará a cabo no más tarde de 30 días a partir de la firma del presente Contrato.</p>
  </div>

  <!-- 5. Derecho de Acceso -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">5</div>
      <div class="body">
        <div class="titulo">Derecho de Acceso</div>
        <div class="texto">El Comprador proveerá acceso al personal del Vendedor a las facilidades donde se ubicará el Sistema SELF-ENERGY (las &ldquo;Facilidades&rdquo;) para que éstos puedan ejecutar sus obligaciones bajo este Contrato, incluyendo, sin limitarse, a la instalación, evaluación, inspección, certificación, validación y/o cualquier otra acción necesaria para la operación del Sistema SELF-ENERGY. Con la firma del presente Contrato, el Comprador le Concede al Vendedor un derecho de acceso a las Facilidades para cumplir con sus obligaciones. De igual forma, el Comprador dará acceso a las Facilidades al personal de LUMA Energy o PREPA y/o cualquier agencia gubernamental para que éstos puedan ejecutar sus deberes conforme a la ley y reglamentación aplicable a la generación de energía eléctrica con Sistemas SELF-ENERGY. El Comprador también autoriza el acceso al personal técnico de Energy Depot LLC posterior a la instalación, cuando sea necesario para mantenimiento, inspección, actualización o evaluación del desempeño del Sistema.</div>
      </div>
    </div>
  </div>

  <!-- 6. Instalación y Permisos -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">6</div>
      <div class="body">
        <div class="titulo">Instalación y Permisos</div>
        <div class="texto">El Vendedor será responsable de la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador identificadas en este acuerdo de Compraventa de Sistema SELF-ENERGY. La instalación del Sistema Fotovoltaico comenzará con la obtención de los permisos y endosos necesarios requeridos por ley, si algunos, para la instalación de Sistemas SELF-ENERGY, incluyendo, sin limitarse, al endoso de los planos del diseño eléctrico por LUMA Energy o PREPA. El comienzo de la instalación además estará sujeta al cumplimiento por el Comprador del derecho de acceso requerido en la Sección 5 de este Contrato. El Comprador se obliga a suscribir todo y cualquier documento necesario para la obtención por conducto del Vendedor de cualquier permiso o endoso requerido para la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador y la interconexión del mismo con LUMA Energy o PREPA.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Cumplimiento Regulatorio.</span> Energy Depot LLC realizará la instalación y puesta en marcha del Sistema conforme al Código Eléctrico de Puerto Rico (NEC 2020), los reglamentos de LUMA Energy, y las disposiciones del Negociado de Energía de Puerto Rico (NEPR). Cualquier requisito adicional o modificación solicitada por dichas entidades será responsabilidad del Comprador, incluyendo costos de ingeniería o materiales adicionales que sean necesarios para cumplir con la normativa vigente.</p>
    <p class="sub"><span class="letra">b.</span> <span class="sub-titulo">Cumplimiento de Estándares Técnicos y de Seguridad.</span> Energy Depot LLC garantiza que todos los equipos, componentes y materiales utilizados en la instalación del Sistema SELF-ENERGY cumplen con los estándares y certificaciones aplicables de seguridad y eficiencia eléctrica, incluyendo los establecidos por Underwriters Laboratories (UL), Institute of Electrical and Electronics Engineers (IEEE), National Electrical Code (NEC 2020) y cualquier otra norma técnica vigente en Puerto Rico o los Estados Unidos.</p>
  </div>

  <!-- 6-A. Modificaciones Técnicas -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num" style="font-size:9pt">6-A</div>
      <div class="body">
        <div class="titulo">Modificaciones Técnicas y Sustitución de Equipos</div>
        <div class="texto">Energy Depot LLC podrá realizar ajustes técnicos o sustituciones de componentes en el diseño, equipos o materiales del Sistema, siempre que dichas modificaciones no reduzcan la capacidad nominal de generación contratada. Estos cambios podrán efectuarse por razones de disponibilidad, cumplimiento de normativas eléctricas, seguridad o mejoras tecnológicas, y no constituirán incumplimiento contractual, siempre y cuando se mantenga la capacidad de producción pactada.</div>
      </div>
    </div>
  </div>

  <!-- 7. Relevo -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">7</div>
      <div class="body">
        <div class="titulo">Relevo</div>
        <div class="texto">El Comprador reconoce que la permisilogía de la instalación y certificación por parte de LUMA Energy o PREPA del Sistema SELF-ENERGY depende de la evaluación favorable y endosos por la LUMA Energy o PREPA y otras agencias gubernamentales por lo que releva y exonera al Vendedor de cualquier demora, atraso o costos de mejora estructural solicitada por LUMA Energy o PREPA para la aceptación y cumplimiento de sus obligaciones bajo el presente Contrato de este proyecto para su interconexión en el programa de Medición.</div>
      </div>
    </div>
  </div>

</div>

<!-- ============ PÁGINA 3 ============ -->
<div class="pagebreak"></div>
<div class="page">

  <!-- 8. Mantenimiento -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">8</div>
      <div class="body">
        <div class="titulo">Mantenimiento</div>
        <div class="texto">El Comprador reconoce que será exclusivamente responsable de la operación, mantenimiento y reparación del Sistema SELF-ENERGY, excepto que aplique cualquier situación cubierta por la garantía limitada del Sistema SELF-ENERGY ofrecida por el Vendedor. El Comprador será exclusivamente responsable de cualquier mantenimiento, reparación y/o requisito necesario (i.e. seguros, etc.) para la aprobación de cualquier Acuerdo de Interconexión, Acuerdo de Medición Neta y/o cualquier otro acuerdo suscrito con LUMA Energy o PREPA relacionado al Sistema SELF-ENERGY (colectivamente, los &ldquo;Acuerdos Energéticos&rdquo;). El Comprador reconoce que los Acuerdos Energéticos son a un término definido y que su renovación depende del cumplimiento por el Comprador de una serie de requisitos establecidos por ley, reglamento y/o en los propios Acuerdos Energéticos. Será responsabilidad exclusiva del Comprador el cumplimiento con dichos Acuerdo Energéticos y los requisitos necesarios para su renovación. Por lo menos tres (3) meses previos al vencimiento de cualquiera de los Acuerdo Energéticos, el Comprador podrá notificar al Vendedor que desea que el Vendedor le refiera, a costo exclusivo del Comprador, un profesional para que lo asista o ayude en la renovación de cualquiera de los Acuerdos Energéticos.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Monitoreo del Sistema y Uso de Datos.</span> El Comprador autoriza a Energy Depot LLC a instalar, acceder y utilizar equipos o software de monitoreo remoto del Sistema con el fin de verificar su desempeño y realizar mantenimiento preventivo. Energy Depot LLC podrá recopilar y analizar datos operacionales del sistema exclusivamente para fines técnicos, de garantía o mejora de servicio. Dichos datos serán tratados como confidenciales y no se divulgarán a terceros sin autorización expresa del Comprador.</p>
  </div>

  <!-- 9. Garantía Limitada -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">9</div>
      <div class="body">
        <div class="titulo">Garantía Limitada</div>
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

<!-- ============ PÁGINA 4 ============ -->
<div class="pagebreak"></div>
<div class="page">

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
    <div class="clausula-row">
      <div class="num">10</div>
      <div class="body">
        <div class="titulo">Facilidades</div>
        <div class="texto">El Comprador presentara al Vendedor que <strong>__X___</strong> es titular de la Facilidades identificadas con la localización donde se instalará el Sistema SELF-ENERGY o ________ posee autorización legal por escrito del titular de las Facilidades para la instalación del Sistema SELF-ENERGY. El Comprador releva, exonera y se compromete a proveer defensa al Vendedor con respecto a cualquier reclamación que se presente contra el Vendedor relacionado a la falta de autorización por el dueño o titular de las Facilidades para la instalación del Sistema SELF-ENERGY.</div>
      </div>
    </div>
  </div>

  <!-- 11. Autorización para Documentación Visual y Mercadeo -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">11</div>
      <div class="body">
        <div class="titulo">Autorización para Documentación Visual y Mercadeo</div>
        <div class="texto">El Comprador autoriza expresamente a Energy Depot LLC y a sus representantes a grabar, fotografiar y documentar todo el proceso de instalación, inspección, y finalización del Sistema de Energía Renovable, con fines de:</div>
      </div>
    </div>
    <div class="sub-bullet">• Documentación técnica y control de calidad; y</div>
    <div class="sub-bullet">• Promoción y mercadeo del trabajo realizado, incluyendo su publicación en redes sociales, materiales publicitarios, televisión, radio o páginas web.</div>
    <p class="sub">Energy Depot LLC se compromete a salvaguardar la privacidad y datos personales del Comprador conforme a la ley y a no divulgar información que identifique su dirección o datos financieros sin consentimiento adicional.</p>
    <p class="sub">Energy Depot LLC cumplirá con las disposiciones de la Ley 39-2012 de Protección de Información Personal y el Reglamento de Privacidad del Negociado de Energía.</p>
  </div>

</div>

<!-- ============ PÁGINA 5 ============ -->
<div class="pagebreak"></div>
<div class="page">

  <!-- 12. Documentos y Facturas -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">12</div>
      <div class="body">
        <div class="titulo">Documentos y Facturas</div>
        <div class="texto">El Comprador proveerá copia al Vendedor de los Acuerdos Energéticos, así como cualquier otro contrato o acuerdo suscrito con relación al Sistema SELF-ENERGY, así como de copia de las facturas de consumo de energía eléctrica para las Facilidades por un periodo de doce (12) meses luego de instalado el Sistema SELF-ENERGY.</div>
      </div>
    </div>
  </div>

  <!-- 13. Notificaciones -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">13</div>
      <div class="body">
        <div class="titulo">Notificaciones</div>
        <div class="texto">Todas las notificaciones, requerimientos, instrucciones y otras comunicaciones requeridos bajo este Contrato se harán por escrito y serán enviados por correo certificado con acuse de recibo, correo electrónico con acuse de recibo o facsímile o entregadas a la mano a la parte a las siguientes direcciones de las partes que surgen en el encabezamiento.</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> <span class="sub-titulo">Cláusula de Comunicación Continua.</span> Energy Depot LLC mantendrá comunicación con el Comprador durante todo el proceso de permisos, instalación y certificación, informando de manera periódica sobre el estatus de los trámites.</p>
  </div>

  <!-- 14. Cancelación del Proyecto -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">14</div>
      <div class="body">
        <div class="titulo">Cancelación del Proyecto y Aplicación de Pagos</div>
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
    <div class="clausula-row">
      <div class="num">15</div>
      <div class="body">
        <div class="titulo">Remedios y Resolución de Controversias</div>
        <div class="texto">En adición a cualquier remedio provisto por ley y/o cualquier remedio específico establecido en las demás secciones de este Contrato, en caso de incumplimiento por el Comprador de cualesquiera de sus obligaciones bajo este Contrato, el Vendedor podrá, además:</div>
      </div>
    </div>
    <p class="sub"><span class="letra">a.</span> En casos donde no medie financiamiento por una institución financiera, (i) dar por terminado el presente Contrato; (ii) tomar posesión del Sistema SELF-ENERGY conforme a lo dispuesto en la Ley de Transacciones Garantizadas de Puerto Rico, según enmendada; (iii) paralizar la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador; (iv) retener cualquier parte del Precio de Compraventa pagado por el Vendedor; y/o (v) acelerar el pago de cualquier desembolso no vencido del Precio de Compraventa.</p>
    <p class="sub"><span class="letra">b.</span> <span class="sub-titulo">Cláusula de Resolución Amistosa Previa al Arbitraje.</span> Antes de acudir al proceso de arbitraje, las partes se comprometen a intentar una reunión de conciliación amistosa dentro de un término de diez (10) días naturales desde la notificación del reclamo. Esta reunión podrá celebrarse de manera presencial o virtual, y no afectará el derecho posterior de las partes a acudir al arbitraje.</p>
    <p class="sub"><span class="letra">c.</span> En caso de incumplimiento de cualquiera de las obligaciones contenidas en este Contrato, las partes acuerdan que toda reclamación, disputa o controversia derivada o relacionada con el presente Contrato, su interpretación, ejecución o terminación, se resolverá exclusivamente mediante arbitraje vinculante ante el Centro de Arbitraje y Mediación de la Cámara de Comercio de Puerto Rico, conforme a su reglamento vigente. Este proceso ofrece un mecanismo rápido, imparcial y especializado, en lugar de recurrir a agencias administrativas como DACO o a los tribunales ordinarios, salvo para ejecutar el laudo arbitral o solicitar medidas provisionales según la ley aplicable. La decisión del árbitro será final, firme y vinculante, y podrá ejecutarse en los tribunales del Estado Libre Asociado de Puerto Rico.</p>
  </div>

  <!-- 16. Fuerza Mayor -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">16</div>
      <div class="body">
        <div class="titulo">Fuerza Mayor</div>
        <div class="texto">Ninguna de las partes será responsable por el incumplimiento de sus obligaciones contractuales cuando dicho incumplimiento sea resultado directo de eventos fuera de su control razonable, incluyendo, pero sin limitarse a, desastres naturales, eventos climáticos severos (huracanes categoría 3 o más), actos de gobierno, interrupciones en la cadena de suministro, pandemias, huelgas o fallas de terceros como LUMA Energy o PREPA. En tales casos, el plazo de cumplimiento se extenderá por el tiempo que dure la causa de fuerza mayor, sin penalidades para Energy Depot LLC.</div>
      </div>
    </div>
  </div>

</div>

<!-- ============ PÁGINA 6 ============ -->
<div class="pagebreak"></div>
<div class="page">

  <!-- 17. Misceláneos -->
  <div class="clausula">
    <div class="clausula-row">
      <div class="num">17</div>
      <div class="body">
        <div class="titulo">Misceláneos</div>
      </div>
    </div>
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
      <div class="line"></div>
      <div class="lbl">Comprador</div>
      <div class="nm">${esc(nombre)}</div>
      <div class="tt">Cliente &middot; Comprador</div>
    </div>
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
      direccionPostal = ''
    } = req.body;
    const leadId = req.params.id;

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
    if (esEfectivo) {
      // Efectivo 50/50 — repartimos el precio total (no descontamos pronto porque "efectivo" no lleva pronto separado)
      pct45a = Math.round(precioTotal * 0.5);
      pct45b = precioTotal - pct45a;
      pct10  = 0;
    } else {
      pct45a = Math.round(balance * 0.45);
      pct45b = Math.round(balance * 0.45);
      pct10  = balance - pct45a - pct45b;
    }

    const html = buildContratoHTML({
      nombre,
      direccionFisica,
      direccionPostal: direccionPostalFinal,
      telefono, email,
      ctaAee, numContador: numContadorFinal,
      vendedorAsignado: vendedor,
      fechaCorta: fmtShort(),
      precioTotal, pronto, pct45a, pct45b, pct10,
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

    res.json({ ok:true, contract_id: cr.rows[0].id, pdf: base64, filename: fname });
  } catch (e) {
    console.error('[contratoSolar]', e.message);
    res.status(500).json({ error: e.message });
  }
}

module.exports = { generarContratoSolar };
