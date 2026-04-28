'use strict';
const fs   = require('fs');
const path = require('path');
const { pool } = require('../services/db');

const fmt  = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = () => new Date().toLocaleDateString('es-PR', { year:'numeric', month:'long', day:'numeric' });

function logoB64() {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '../assets/logo.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

function buildContratoHTML({ nombre, direccion, ciudad, telefono, email, numCtaLuma, numContador,
  precioTotal, modalidad, prontoDado, vendedor, fecha, sistemas }) {

  const esEfectivo = modalidad === 'efectivo';
  const LOGO = logoB64();
  const numContrato = `ED-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;

  // Pagos
  let pagos = [];
  if (esEfectivo) {
    pagos = [
      { monto: Math.round(precioTotal * 0.5), pct: '50%', desc: 'Materiales y firma de contrato', when: 'Al firmar' },
      { monto: precioTotal - Math.round(precioTotal * 0.5), pct: '50%', desc: 'Instalación y certificación', when: 'Al concluir' },
    ];
  } else {
    const p1 = prontoDado || 0;
    const fin = precioTotal - p1;
    const p2  = Math.round(fin * 0.4);
    const p3  = Math.round(fin * 0.5);
    const p4  = fin - p2 - p3;
    pagos = [
      ...(p1 > 0 ? [{ monto: p1, pct: '—', desc: 'Pronto otorgado por cliente', when: 'Inicial' }] : []),
      { monto: p2, pct: '40%', desc: 'Firma del contrato con institución financiera', when: 'Al firmar' },
      { monto: p3, pct: '50%', desc: 'Al concluir la instalación del Sistema', when: 'Instalación' },
      { monto: p4, pct: '10%', desc: 'Al concluir la certificación del Sistema',  when: 'Certificación' },
    ];
  }

  const pagosHTML = pagos.map((p,i) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#1a3c8f;font-size:11pt;width:130px">${fmt(p.monto)}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;width:80px;text-align:center"><span style="background:#dbeafe;color:#1a3c8f;padding:3px 10px;border-radius:12px;font-size:9.5pt;font-weight:700">${p.pct}</span></td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-size:10pt;color:#374151">${p.desc}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-size:9.5pt;color:#64748b;text-align:right;font-style:italic">${p.when}</td>
    </tr>`).join('');

  const renderClausula = c => `
    <div style="margin-bottom:14px;page-break-inside:avoid">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="flex-shrink:0;width:32px;height:32px;background:#1a3c8f;color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12pt">${c.n}</div>
        <div style="flex:1">
          <div style="font-weight:700;color:#1a3c8f;font-size:11pt;margin-bottom:4px">${c.t}</div>
          <div style="font-size:10pt;color:#374151;line-height:1.6">${c.d}</div>
        </div>
      </div>
    </div>`;

  const clausulasInicio = [
    { n:'1', t:'Descripción del Sistema', d:`El Sistema SELF-ENERGY adquirido por el Comprador es aquél descrito en la Oferta de Cotización adjunta como Anejo 1${sistemas ? ': <strong>'+sistemas+'</strong>' : '.'}` },
    { n:'2', t:'Precio', d:`El precio del Sistema SERE es la suma de <strong style="color:#1a3c8f">${fmt(precioTotal)}</strong>, más cualquier impuesto o cargo aplicable por ley según se desglosa en la Factura de Compra que forma parte integral de este Contrato como Anejo 2.` },
  ].map(renderClausula).join('');

  const clausulasFinal = [
    { n:'4', t:'Compraventa con Financiamiento', d:`Sólo aplicable cuando medie financiamiento. <strong>(a)</strong> El calendario de desembolsos se realizará conforme a los acuerdos entre el Vendedor y la corporación financiera. <strong>(b)</strong> El cierre de las facilidades de crédito se llevará a cabo no más tarde de noventa (90) días a partir de la firma; de lo contrario el Comprador deberá completar el pago de contado.` },
    { n:'5', t:'Derecho de Acceso', d:'El Comprador proveerá acceso al personal del Vendedor a las facilidades donde se ubicará el Sistema SELF-ENERGY para todos los propósitos relacionados con la instalación, mantenimiento y reparación del Sistema.' },
    { n:'6', t:'Instalación y Permisos', d:'El Vendedor será responsable de la instalación del Sistema y de obtener todos los permisos y aprobaciones regulatorias necesarias, incluyendo los permisos de LUMA Energy y DACO.' },
    { n:'7', t:'Relevo', d:'El Comprador reconoce que la permisilogía e instalación y certificación por parte de LUMA puede tomar de 1 a 6 meses o más. El Vendedor no es responsable por las demoras atribuibles a LUMA.' },
    { n:'8', t:'Mantenimiento', d:'El Comprador será exclusivamente responsable de la operación, mantenimiento y reparación del Sistema, excepto por defectos de fabricación o instalación cubiertos por las garantías aplicables.' },
    { n:'9', t:'Garantía Limitada', d:'El Vendedor dará garantía al Sistema conforme a los términos del manufacturero. La garantía cubre piezas y equipos. La garantía de mano de obra tendrá un período de un (1) año desde la fecha de instalación.' },
    { n:'10', t:'Facilidades', d:'El Comprador presenta al Vendedor que es titular de las Facilidades. Será responsable de obtener cualquier consentimiento de terceros necesario, incluyendo asociaciones de residentes u organismos gubernamentales.' },
    { n:'11', t:'Documentos', d:'El Comprador proveerá al Vendedor copia de los Acuerdos Energéticos, contratos de servicio eléctrico y el historial de consumo eléctrico de los últimos doce (12) meses.' },
    { n:'12', t:'Notificaciones', d:'Todas las notificaciones se considerarán debidamente notificadas cuando se entreguen personalmente, por correo certificado con acuse de recibo, o por correo electrónico a las direcciones establecidas en este Contrato.' },
    { n:'13', t:'Remedios', d:'<strong>(a)</strong> Sin financiamiento de institución financiera, el Vendedor podrá: (i) terminar el Contrato; (ii) tomar posesión del Sistema; (iii) cobrar daños y honorarios de abogados. <strong>(b)</strong> Buscar cumplimiento específico u otro remedio en equidad o derecho.' },
    { n:'14', t:'Misceláneos', d:'<strong>(a) Enmiendas:</strong> sólo por escrito con consentimiento de las partes. <strong>(b) Ley Aplicable:</strong> Estado Libre Asociado de Puerto Rico. <strong>(c) Acuerdo Completo:</strong> reemplaza todos los acuerdos previos. <strong>(d) Consentimiento:</strong> las partes reconocen haberlo leído y aceptado libremente.' },
  ].map(renderClausula).join('');

  // Sección 3 (pagos) - separada porque tiene tabla
  const seccion3 = `
    <div style="margin-bottom:16px;page-break-inside:avoid">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
        <div style="flex-shrink:0;width:32px;height:32px;background:#1a3c8f;color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12pt">3</div>
        <div style="flex:1">
          <div style="font-weight:700;color:#1a3c8f;font-size:11pt;margin-bottom:4px">Calendario de Desembolsos</div>
          <div style="font-size:10pt;color:#374151;line-height:1.6">Los desembolsos del Precio de Compraventa de <strong>${fmt(precioTotal)}</strong> serán realizados por <strong>${nombre}</strong> de la siguiente forma:</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;margin-left:44px;width:calc(100% - 44px)">
        <thead>
          <tr style="background:#1a3c8f">
            <th style="padding:10px 16px;text-align:left;color:#fff;font-size:9.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Monto</th>
            <th style="padding:10px 16px;text-align:center;color:#fff;font-size:9.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">%</th>
            <th style="padding:10px 16px;text-align:left;color:#fff;font-size:9.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Concepto</th>
            <th style="padding:10px 16px;text-align:right;color:#fff;font-size:9.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Etapa</th>
          </tr>
        </thead>
        <tbody>${pagosHTML}</tbody>
      </table>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;background:#fff;font-size:10.5pt;line-height:1.5}
  @page{size:Letter;margin:0}
</style>
</head>
<body>

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%);padding:28px 50px;display:flex;align-items:center;justify-content:space-between;color:#fff">
  <div style="display:flex;align-items:center;gap:18px">
    ${LOGO ? `<img src="${LOGO}" style="height:60px;width:auto;object-fit:contain;filter:brightness(1.1)"/>` : `<div style="font-size:22pt;font-weight:900;letter-spacing:1px">ENERGY DEPOT</div>`}
  </div>
  <div style="text-align:right">
    <div style="font-size:18pt;font-weight:800;letter-spacing:0.5px;line-height:1.1">CONTRATO</div>
    <div style="font-size:9pt;color:#bfdbfe;margin-top:4px;letter-spacing:1.5px;text-transform:uppercase">Sistema Energía Renovable</div>
    <div style="font-size:8.5pt;color:#93c5fd;margin-top:8px;font-family:monospace">${numContrato}</div>
  </div>
</div>

<!-- BAND -->
<div style="background:#67e8f9;height:6px"></div>

<!-- CONTENT -->
<div style="padding:30px 50px 20px">

  <h1 style="font-size:16pt;color:#1a3c8f;font-weight:800;margin-bottom:6px;line-height:1.2">Contrato de Desarrollo de Proyecto Solar</h1>
  <div style="font-size:9.5pt;color:#64748b;margin-bottom:20px;border-bottom:2px solid #e5e7eb;padding-bottom:12px">
    Suscrito el <strong style="color:#374151">${fecha}</strong> · Modalidad: <strong style="color:#1a3c8f">${esEfectivo ? 'Pago en Efectivo' : 'Con Financiamiento'}</strong>
  </div>

  <!-- PARTES -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">

    <!-- Vendedor -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;border-top:3px solid #1a3c8f">
      <div style="font-size:8.5pt;color:#64748b;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Vendedor</div>
      <div style="font-size:13pt;font-weight:800;color:#1a3c8f;margin-bottom:10px">ENERGY DEPOT LLC</div>
      <div style="font-size:9.5pt;color:#475569;line-height:1.7">
        <div>📍 Global Plaza Suite 204</div>
        <div style="padding-left:18px">Cll John A. Ernot</div>
        <div style="padding-left:18px">San Juan, PR 00920</div>
        <div style="margin-top:6px">📞 787-627-8585</div>
        <div>✉️ info@energydepotpr.com</div>
        <div>🌐 energydepotpr.com</div>
      </div>
    </div>

    <!-- Comprador -->
    <div style="background:#fef9e7;border:1px solid #fde68a;border-radius:10px;padding:18px;border-top:3px solid #f59e0b">
      <div style="font-size:8.5pt;color:#92400e;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Comprador</div>
      <div style="font-size:13pt;font-weight:800;color:#92400e;margin-bottom:10px">${nombre}</div>
      <div style="font-size:9.5pt;color:#78350f;line-height:1.7">
        ${direccion ? `<div>📍 ${direccion}</div>` : ''}
        ${ciudad ? `<div style="padding-left:18px">${ciudad}</div>` : ''}
        ${telefono ? `<div style="margin-top:6px">📞 ${telefono}</div>` : ''}
        ${email ? `<div>✉️ ${email}</div>` : ''}
        ${numCtaLuma ? `<div style="margin-top:6px">🔌 LUMA: ${numCtaLuma}</div>` : ''}
        ${numContador ? `<div>📊 Contador: ${numContador}</div>` : ''}
      </div>
    </div>

  </div>

  <!-- ASIGNADO -->
  <div style="background:#1a3c8f;color:#fff;padding:14px 22px;border-radius:8px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:8.5pt;color:#bfdbfe;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Vendedor Asignado</div>
      <div style="font-size:12pt;font-weight:700;margin-top:2px">${vendedor || 'Gilberto J. Díaz Merced'}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:8.5pt;color:#bfdbfe;letter-spacing:1.5px;text-transform:uppercase;font-weight:700">Precio Total</div>
      <div style="font-size:18pt;font-weight:900;letter-spacing:-0.5px;margin-top:2px">${fmt(precioTotal)}</div>
    </div>
  </div>

  <!-- PREÁMBULO -->
  <div style="background:#f8fafc;border-left:3px solid #1a3c8f;padding:14px 18px;margin-bottom:22px;border-radius:0 8px 8px 0">
    <div style="font-size:9pt;font-weight:700;color:#1a3c8f;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Preámbulo</div>
    <div style="font-size:10pt;color:#475569;line-height:1.7">
      El presente Contrato de Compraventa de Sistema Energía Renovable es suscrito por y entre las partes identificadas. <strong>Por Cuanto</strong>, ENERGY DEPOT LLC se dedica a la venta al detal de sistemas de energía renovable y servicios relacionados; y el Comprador está interesado en adquirir un Sistema SELF-ENERGY para convertir energía solar en eléctrica. <strong>Por lo tanto</strong>, en consideración de los compromisos mutuos, las Partes acuerdan lo siguiente:
    </div>
  </div>

  <!-- TÉRMINOS Y CONDICIONES -->
  <div style="font-size:11pt;font-weight:800;color:#1a3c8f;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;padding-bottom:6px;border-bottom:2px solid #1a3c8f">Términos y Condiciones</div>

  ${clausulasInicio}

  ${seccion3}

  ${clausulasFinal}

  <!-- DECLARACIÓN FINAL -->
  <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:16px 20px;margin-top:18px;text-align:center">
    <div style="font-size:10.5pt;color:#1a3c8f;font-weight:700">POR TODO LO CUAL, las partes otorgan este Contrato en la fecha indicada al principio del mismo.</div>
  </div>

  <!-- FIRMAS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:50px;page-break-inside:avoid">
    <div>
      <div style="border-bottom:2px solid #1a3c8f;height:50px"></div>
      <div style="padding-top:8px">
        <div style="font-size:8.5pt;color:#64748b;letter-spacing:1px;text-transform:uppercase;font-weight:700">Vendedor</div>
        <div style="font-size:11pt;font-weight:700;color:#1a3c8f;margin-top:4px">${vendedor || 'Gilberto J. Díaz Merced'}</div>
        <div style="font-size:9.5pt;color:#64748b">CEO · Energy Depot LLC</div>
      </div>
    </div>
    <div>
      <div style="border-bottom:2px solid #1a3c8f;height:50px"></div>
      <div style="padding-top:8px">
        <div style="font-size:8.5pt;color:#64748b;letter-spacing:1px;text-transform:uppercase;font-weight:700">Comprador</div>
        <div style="font-size:11pt;font-weight:700;color:#1a3c8f;margin-top:4px">${nombre}</div>
        <div style="font-size:9.5pt;color:#64748b">Cliente / Comprador</div>
      </div>
    </div>
  </div>

</div>

<!-- FOOTER -->
<div style="background:#0f2558;color:#bfdbfe;padding:16px 50px;font-size:8pt;text-align:center;letter-spacing:0.5px;margin-top:30px">
  <div style="font-weight:700;color:#fff;font-size:9pt;letter-spacing:1.5px;margin-bottom:4px">ENERGY DEPOT LLC</div>
  <div>Global Plaza Suite 204 · San Juan, PR 00920 · (787) 627-8585 · info@energydepotpr.com · energydepotpr.com</div>
</div>

</body>
</html>`;
}

// POST /api/leads/:id/contrato-solar
async function generarContratoSolar(req, res) {
  try {
    const { modalidad = 'efectivo', prontoDado = 0, numCtaLuma = '', numContador = '', vendedor = 'Gilberto J. Díaz Merced' } = req.body;
    const leadId = req.params.id;

    const r = await pool.query(
      `SELECT l.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
       FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id WHERE l.id = $1`, [leadId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = r.rows[0];
    const sd   = lead.solar_data || {};
    const calc = sd.calc || {};

    const nombre    = lead.contact_name || lead.title;
    const telefono  = sd.telefono || lead.contact_phone || '';
    const email     = sd.email    || lead.contact_email || '';
    const direccion = sd.address  || '';
    const ciudad    = sd.city ? `${sd.city}${sd.zip ? ', PR ' + sd.zip : ''}` : '';
    const bat       = (sd.batteries||[])[0]?.name || '';
    const sistemas  = `${calc.panels||''} paneles solares 550W · ${calc.systemKw||''} kW DC${bat ? ' · Batería: '+bat : ''}`;

    const precioTotal = Number(calc.costBase || lead.value || 0) +
      (sd.batteries||[]).reduce((s,b) => s + (b.unitPrice||0)*(b.qty||1), 0);

    const html = buildContratoHTML({
      nombre, direccion, ciudad, telefono, email,
      numCtaLuma, numContador, vendedor,
      precioTotal, modalidad,
      prontoDado: Number(prontoDado),
      fecha: fmtD(), sistemas,
    });

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil:'load', timeout:60000 });
    await page.evaluate(() => document.fonts.ready);
    const pdfBuf = await page.pdf({ format:'A4', printBackground:true, margin:{ top:'15mm', bottom:'15mm', left:'15mm', right:'15mm' } });
    await browser.close();

    // Guardar en tabla contracts
    const base64 = Buffer.from(pdfBuf).toString('base64');
    const titulo  = `Contrato Solar — ${nombre}`;
    const fname   = `Contrato-${nombre.replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`;

    const cr = await pool.query(
      `INSERT INTO contracts (title, contact_id, lead_id, file_base64, file_name, file_size, status, created_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8) RETURNING id`,
      [titulo, lead.contact_id, leadId, base64, fname, pdfBuf.length,
       req.user?.id || null, `Modalidad: ${modalidad === 'efectivo' ? 'Efectivo' : 'Financiamiento'}${prontoDado ? ' · Pronto: $'+Number(prontoDado).toLocaleString() : ''}`]
    );

    res.json({ ok:true, contract_id: cr.rows[0].id, pdf: base64, filename: fname });
  } catch (e) {
    console.error('[contratoSolar]', e.message);
    res.status(500).json({ error: e.message });
  }
}

module.exports = { generarContratoSolar };
