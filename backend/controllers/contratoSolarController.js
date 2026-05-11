'use strict';
const fs   = require('fs');
const path = require('path');
const { pool } = require('../services/db');

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
   HTML — match EXACTO al Contrato ED-2025.1 (texto literal)
   ============================================================ */
function buildContratoHTML(d) {
  const {
    nombre, direccionFisica, direccionPostal, telefono, email,
    ctaAee, numContador, vendedorAsignado, fechaCorta,
    precioTotal, pronto, pct45a, pct45b, pct10
  } = d;
  const LOGO = logoB64();

  // Tabla de partes — split por saltos de línea
  const dirVendedorFisica = ['Global Plaza', 'Suite 204', 'San Juan, PR 00920'];
  const dirVendedorPostal = ['Global Plaza', 'Suite 204', 'San Juan, PR 00920'];

  const dfCompradorLines = (direccionFisica || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);
  const dpCompradorLines = (direccionPostal || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:Letter;margin:18mm 18mm 18mm 18mm}
  body{font-family:'Times New Roman',Times,serif;color:#000;background:#fff;font-size:11pt;line-height:1.35;text-align:justify}
  p{margin:0 0 8pt 0;text-align:justify}
  b,strong{font-weight:bold}
  .center{text-align:center}
  .bold{font-weight:bold}
  .u{text-decoration:underline}
  .sub{margin-left:28pt;margin-bottom:8pt}
  .pagebreak{page-break-before:always}
  table.partes{width:100%;border-collapse:collapse;margin:10pt 0}
  table.partes td{border:1px solid #000;padding:5pt 8pt;vertical-align:middle;font-size:10.5pt}
  table.partes td.lbl{font-weight:bold;width:22%}
  table.partes td.val{width:28%}
  .hdr-row{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8pt}
  .hdr-row .logo{display:flex;align-items:center;gap:8pt}
  .hdr-row .logo img{height:30pt}
  .hdr-row .title{font-weight:bold;font-size:11.5pt}
  .hdr-row .date{font-weight:bold;font-size:11pt}
  .intro{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6pt}
  .intro p{flex:1;margin-right:20pt}
  .des-row{display:flex;align-items:flex-start;margin-bottom:4pt}
  .des-row .amt{width:75pt;font-weight:bold}
  .des-row .eq{width:90pt}
  .des-row .pct{width:45pt;font-weight:bold}
  .des-row .desc{flex:1}
  .firma{display:flex;justify-content:space-between;gap:40pt;margin-top:30pt}
  .firma .col{width:48%}
  .firma .line{border-bottom:1px solid #000;height:24pt;margin-bottom:4pt}
  .footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:8pt;color:#444;font-style:italic}
</style>
</head>
<body>

<!-- ============ PÁGINA 1 ============ -->

<div class="hdr-row">
  <div class="logo">
    ${LOGO ? `<img src="${LOGO}"/>` : `<span class="bold">ENERGY DEPOT</span>`}
    <span class="title">Contrato de Desarrollo de Proyecto de Sistema Energía Renovable</span>
  </div>
</div>

<div class="intro">
  <p>El presente Contrato de Compraventa de Sistema Energía Renovable (el &ldquo;Contrato&rdquo;) es suscrito hoy por y entre las siguientes partes:</p>
  <div class="date">${esc(fechaCorta)}</div>
</div>

<table class="partes">
  <tr>
    <td class="lbl">Vendedor:</td>
    <td class="val"><span class="bold">ENERGY DEPOT LLC</span></td>
    <td class="lbl">Comprador:</td>
    <td class="val"><span class="bold">${esc(nombre)}</span></td>
  </tr>
  <tr>
    <td class="lbl">Dirección Física:</td>
    <td class="val">${dirVendedorFisica.map(esc).join('<br/>')}</td>
    <td class="lbl">Dirección Física:</td>
    <td class="val">${dfCompradorLines.length ? dfCompradorLines.map(esc).join('<br/>') : '&nbsp;'}</td>
  </tr>
  <tr>
    <td class="lbl">Dirección Postal:</td>
    <td class="val">${dirVendedorPostal.map(esc).join('<br/>')}</td>
    <td class="lbl">Dirección Postal:</td>
    <td class="val">${dpCompradorLines.length ? dpCompradorLines.map(esc).join('<br/>') : '0'}</td>
  </tr>
  <tr>
    <td class="lbl">Núm. de Teléfono:</td>
    <td class="val">787-627-8585</td>
    <td class="lbl">Núm. de Teléfono:</td>
    <td class="val">${esc(telefono)}</td>
  </tr>
  <tr>
    <td class="lbl">Núm. de Fax:</td>
    <td class="val">&nbsp;</td>
    <td class="lbl">Núm. de Fax:</td>
    <td class="val">&nbsp;</td>
  </tr>
  <tr>
    <td class="lbl">Correo Electrónico:</td>
    <td class="val">info@energydepotpr.com</td>
    <td class="lbl">Correo Electrónico:</td>
    <td class="val">${esc(email)}</td>
  </tr>
  <tr>
    <td class="lbl">Contacto:</td>
    <td class="val">&nbsp;</td>
    <td class="lbl">Contacto:</td>
    <td class="val">${esc(nombre)}</td>
  </tr>
  <tr>
    <td class="lbl">Vendedor asignado</td>
    <td class="val">${esc(vendedorAsignado)}</td>
    <td class="lbl">Num. Cta AEE</td>
    <td class="val">${esc(ctaAee)}</td>
  </tr>
  <tr>
    <td class="lbl">Fecha de cotización</td>
    <td class="val">${esc(fechaCorta)}</td>
    <td class="lbl">Num. Contador</td>
    <td class="val">${esc(numContador)}</td>
  </tr>
</table>

<p class="center bold" style="margin-top:8pt">Preámbulo</p>

<p>Por Cuanto, ENERGY DEPOT LLC (El &ldquo;Vendedor&rdquo;) es una compañía debidamente registrada en el Departamento de Estado de Puerto Rico bajo el número 390731 y autorizada para operar bajo las leyes del Estado Libre Asociado de Puerto Rico, se dedica a la venta al detal y al por mayor de sistemas energía renovable (el &ldquo;Sistema SELF-ENERGY&rdquo;) en Puerto Rico;</p>

<p>Por Cuanto, el Comprador está interesado en adquirir del Vendedor un Sistema SELF-ENERGY para convertir energía solar en energía eléctrica utilizable para suplementar o sustituir el servicio de energía eléctrica en su residencia, comercio o industria. Por Tanto, el Comprador y el Vendedor han convenido la compraventa de un Sistema SELF-ENERGY sujeto a los siguientes términos y condiciones.</p>

<p class="center bold">Términos y Condiciones</p>

<p><span class="bold">1. Descripción del Sistema Energía Renovable.</span> El Sistema SELF-ENERGY adquirido por el Comprador del Vendedor es aquél sistema descrito en la cotización de Sistema SELF-ENERGY suscrito por el Vendedor y Comprador que se hace formar parte integral de este Contrato como su Exhibit I (Factura).</p>

<p><span class="bold">2. Precio.</span> El precio del Sistema SERE es la suma de <span class="bold">${fmt(precioTotal)}</span>, más cualquier otro impuesto o cargo aplicable por ley según se desglosa en la Factura de Compra de Sistema SELF-ENERGY que se hace formar parte integral de este Contrato como su <span class="bold u">Exhibit II</span>(el &ldquo;Precio de Compraventa&rdquo;). El Precio de Compraventa incluye los gastos y costos asociados con la compraventa del Sistema SELF-ENERGY y su instalación. El Precio de Compraventa no incluye los costos o gastos asociados con la remoción o relocalización de sistemas de aires acondicionado, cisternas, plantas eléctricas, antenas, calentadores solares y/o cualquieras otros equipos u obstrucciones, los cuales serán responsabilidad exclusiva del Comprador.</p>

<p><span class="bold">3. Desembolso del Precio de Compraventa.</span> Los desembolsos del Precio de Compraventa <span class="bold">${fmt(precioTotal)}</span> será(n) realizado(s) por <span class="bold">${esc(nombre)}</span> de la siguiente forma:</p>

<div class="des-row">
  <div class="amt">${fmt(pronto)}</div>
  <div class="eq"></div>
  <div class="pct"></div>
  <div class="desc">Pronto otorgado por cliente.</div>
</div>
<div class="des-row">
  <div class="amt">${fmt(pct45a)}</div>
  <div class="eq">equivalente</div>
  <div class="pct">45%</div>
  <div class="desc">del balance a financiar inmediato se firme el presente contrato o contrato con la institución financiera.</div>
</div>
<div class="des-row">
  <div class="amt">${fmt(pct45b)}</div>
  <div class="eq">equivalente</div>
  <div class="pct">45%</div>
  <div class="desc">del balance al concluir la instalación del Sistema.</div>
</div>
<div class="des-row">
  <div class="amt">${fmt(pct10)}</div>
  <div class="eq">equivalente</div>
  <div class="pct">10%</div>
  <div class="desc">del balance pendiente al concluir la certificación del Sistema.</div>
</div>

<p style="margin-top:10pt">La falta de pago de los desembolsos del Precio de Compraventa conforme a lo antes expresado conllevará, en adición a cualquier otro remedio establecido en este Contrato, la acumulación de intereses por mora a razón de 8% anual.</p>

<!-- ============ PÁGINA 2 ============ -->
<div class="pagebreak"></div>

<p><span class="bold">4. Compraventa con Financiamiento.</span> Sólo aplicable cuando medie financiamiento para la compra del Sistema SELF-ENERGY, según adelantado por el Comprador en el Preacuerdo de Compraventa de Sistema SELF-ENERGY.</p>
<p class="sub"><span class="bold">a.</span> El calendario de desembolsos del Precio de Compraventa se realizará conforme a los acuerdos llegados entre el Vendedor y la correspondiente institución financiera, los cuales no necesariamente concordarán con el calendario establecido en la Sección 3 de este Contrato. Los desembolsos del Precio de Compraventa serán realizados por la institución financiera directamente al Vendedor.</p>
<p class="sub"><span class="bold">b.</span> El cierre de las facilidades de crédito a ser utilizadas para el pago del Precio de Compraventa se llevará a cabo no más tarde de 30 días a partir de la firma del presente Contrato.</p>

<p><span class="bold">5. Derecho de Acceso.</span> El Comprador proveerá acceso al personal del Vendedor a las facilidades donde se ubicará el Sistema SELF-ENERGY (las &ldquo;Facilidades&rdquo;) para que éstos puedan ejecutar sus obligaciones bajo este Contrato, incluyendo, sin limitarse, a la instalación, evaluación, inspección, certificación, validación y/o cualquier otra acción necesaria para la operación del Sistema SELF-ENERGY. Con la firma del presente Contrato, el Comprador le Concede al Vendedor un derecho de acceso a las Facilidades para cumplir con sus obligaciones. De igual forma, el Comprador dará acceso a las Facilidades al personal de LUMA Energy o PREPA y/o cualquier agencia gubernamental para que éstos puedan ejecutar sus deberes conforme a la ley y reglamentación aplicable a la generación de energía eléctrica con Sistemas SELF-ENERGY. El Comprador también autoriza el acceso al personal técnico de Energy Depot LLC posterior a la instalación, cuando sea necesario para mantenimiento, inspección, actualización o evaluación del desempeño del Sistema.</p>

<p><span class="bold">6. Instalación y Permisos.</span> El Vendedor será responsable de la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador identificadas en este acuerdo de Compraventa de Sistema SELF-ENERGY. La instalación del Sistema Fotovoltaico comenzará con la obtención de los permisos y endosos necesarios requeridos por ley, si algunos, para la instalación de Sistemas SELF-ENERGY, incluyendo, sin limitarse, al endoso de los planos del diseño eléctrico por LUMA Energy o PREPA. El comienzo de la instalación además estará sujeta al cumplimiento por el Comprador del derecho de acceso requerido en la Sección 5 de este Contrato. El Comprador se obliga a suscribir todo y cualquier documento necesario para la obtención por conducto del Vendedor de cualquier permiso o endoso requerido para la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador y la interconexión del mismo con LUMA Energy o PREPA.</p>
<p class="sub"><span class="bold">a. Cumplimiento Regulatorio.</span> Energy Depot LLC realizará la instalación y puesta en marcha del Sistema conforme al Código Eléctrico de Puerto Rico (NEC 2020), los reglamentos de LUMA Energy, y las disposiciones del Negociado de Energía de Puerto Rico (NEPR). Cualquier requisito adicional o modificación solicitada por dichas entidades será responsabilidad del Comprador, incluyendo costos de ingeniería o materiales adicionales que sean necesarios para cumplir con la normativa vigente.</p>
<p class="sub"><span class="bold">b. Cumplimiento de Estándares Técnicos y de Seguridad.</span> Energy Depot LLC garantiza que todos los equipos, componentes y materiales utilizados en la instalación del Sistema SELF-ENERGY cumplen con los estándares y certificaciones aplicables de seguridad y eficiencia eléctrica, incluyendo los establecidos por Underwriters Laboratories (UL), Institute of Electrical and Electronics Engineers (IEEE), National Electrical Code (NEC 2020) y cualquier otra norma técnica vigente en Puerto Rico o los Estados Unidos.</p>

<p><span class="bold">6-A. Modificaciones Técnicas y Sustitución de Equipos.</span> Energy Depot LLC podrá realizar ajustes técnicos o sustituciones de componentes en el diseño, equipos o materiales del Sistema, siempre que dichas modificaciones no reduzcan la capacidad nominal de generación contratada. Estos cambios podrán efectuarse por razones de disponibilidad, cumplimiento de normativas eléctricas, seguridad o mejoras tecnológicas, y no constituirán incumplimiento contractual, siempre y cuando se mantenga la capacidad de producción pactada.</p>

<p><span class="bold">7. Relevo.</span> El Comprador reconoce que la permisilogía de la instalación y certificación por parte de LUMA Energy o PREPA del Sistema SELF-ENERGY depende de la evaluación favorable y endosos por la LUMA Energy o PREPA y otras agencias gubernamentales por lo que releva y exonera al Vendedor de cualquier demora, atraso o costos de mejora estructural solicitada por LUMA Energy o PREPA para la aceptación y cumplimiento de sus obligaciones bajo el presente Contrato de este proyecto para su interconexión en el programa de Medición.</p>

<!-- ============ PÁGINA 3 ============ -->
<div class="pagebreak"></div>

<p><span class="bold">8. Mantenimiento.</span> El Comprador reconoce que será exclusivamente responsable de la operación, mantenimiento y reparación del Sistema SELF-ENERGY, excepto que aplique cualquier situación cubierta por la garantía limitada del Sistema SELF-ENERGY ofrecida por el Vendedor. El Comprador será exclusivamente responsable de cualquier mantenimiento, reparación y/o requisito necesario (i.e. seguros, etc.) para la aprobación de cualquier Acuerdo de Interconexión, Acuerdo de Medición Neta y/o cualquier otro acuerdo suscrito con LUMA Energy o PREPA relacionado al Sistema SELF-ENERGY (colectivamente, los &ldquo;Acuerdos Energéticos&rdquo;). El Comprador reconoce que los Acuerdos Energéticos son a un término definido y que su renovación depende del cumplimiento por el Comprador de una serie de requisitos establecidos por ley, reglamento y/o en los propios Acuerdos Energéticos. Será responsabilidad exclusiva del Comprador el cumplimiento con dichos Acuerdo Energéticos y los requisitos necesarios para su renovación. Por lo menos tres (3) meses previos al vencimiento de cualquiera de los Acuerdo Energéticos, el Comprador podrá notificar al Vendedor que desea que el Vendedor le refiera, a costo exclusivo del Comprador, un profesional para que lo asista o ayude en la renovación de cualquiera de los Acuerdos Energéticos.</p>
<p class="sub"><span class="bold">a. Monitoreo del Sistema y Uso de Datos.</span> El Comprador autoriza a Energy Depot LLC a instalar, acceder y utilizar equipos o software de monitoreo remoto del Sistema con el fin de verificar su desempeño y realizar mantenimiento preventivo. Energy Depot LLC podrá recopilar y analizar datos operacionales del sistema exclusivamente para fines técnicos, de garantía o mejora de servicio. Dichos datos serán tratados como confidenciales y no se divulgarán a terceros sin autorización expresa del Comprador.</p>

<p><span class="bold">9. Garantía Limitada.</span> Energy Depot LLC garantiza la labor de instalación por un período de quince (15) años, cubriendo únicamente defectos atribuibles a la instalación original. La garantía no cubre daños causados por terceros, fenómenos naturales, modificaciones no autorizadas, mal uso del sistema o fallas en la red eléctrica externa. Las garantías de los equipos individuales se regirán por los términos y condiciones establecidos por el fabricante de cada componente. El Comprador reconoce que cualquier alteración o reparación realizada sin autorización escrita de Energy Depot LLC anulará esta garantía.</p>
<p class="sub"><span class="bold">a. Limitación de Responsabilidad.</span> Energy Depot LLC no será responsable por daños indirectos, incidentales, especiales o consecuentes que surjan del uso o desempeño del Sistema, incluyendo pérdida de ingresos, ahorros o beneficios. La responsabilidad total de Energy Depot LLC bajo este Contrato se limitará, en todo caso, al monto efectivamente pagado por el Comprador por concepto del Sistema SELF-ENERGY.</p>
<p class="sub"><span class="bold">b. Transferibilidad de Garantía.</span> La garantía de quince (15) años establecida en este Contrato aplica exclusivamente al Comprador original del Sistema de Energía Renovable instalado por Energy Depot LLC. En caso de que el inmueble donde se encuentre el sistema sea vendido o transferido durante el período de garantía, Energy Depot LLC, a su sola discreción, podrá ofrecer una transferencia limitada de garantía al nuevo propietario (&ldquo;Segundo Tenedor&rdquo;), siempre que se cumplan las siguientes condiciones:</p>
<p class="sub">- El Segundo Tenedor notifique por escrito a Energy Depot LLC dentro de los noventa (90) días siguientes a la compraventa del inmueble.<br/>
- El sistema se encuentre en condiciones operativas originales, sin modificaciones, alteraciones ni intervenciones no autorizadas.<br/>
- Se realice una inspección técnica certificada por Energy Depot LLC (a costo del Segundo Tenedor) para validar el estado del sistema.</p>
<p class="sub">Una vez aprobada la transferencia, el Segundo Tenedor gozará de una garantía residual de cinco (5) años contados a partir de la fecha de traspaso, limitada exclusivamente a defectos de instalación y mano de obra. Esta transferencia no incluye componentes eléctricos, paneles, inversores u otros equipos, cuyos términos de garantía continúan regidos por el fabricante original.</p>
<p class="sub"><span class="bold">c. Limitación de Transferencia de Garantía por Herencia.</span> La garantía de quince (15) años ofrecida por Energy Depot LLC es personal e intransferible, y aplica únicamente al Comprador original identificado en este Contrato. En caso de fallecimiento del Comprador y traspaso del inmueble por sucesión o herencia, la garantía no se transferirá automáticamente a los herederos o sucesores del inmueble.</p>

<!-- ============ PÁGINA 4 ============ -->
<div class="pagebreak"></div>

<p class="sub">No obstante, Energy Depot LLC podrá, a su entera discreción, ofrecer al heredero principal o nuevo titular del inmueble una evaluación técnica y opción de reinscripción de garantía bajo los siguientes términos:</p>
<p class="sub">- Que el heredero solicite formalmente la reinscripción dentro de los noventa (90) días siguientes a la inscripción de la herencia.<br/>
- Que el sistema se encuentre en condiciones operativas originales, sin alteraciones ni intervención de terceros.<br/>
- Que el heredero asuma los costos de inspección, reinscripción y certificación del sistema.</p>
<p class="sub">Si Energy Depot LLC aprueba dicha reinscripción, se otorgará una garantía residual de tres (3) años, limitada únicamente a defectos de instalación y mano de obra. En ningún caso Energy Depot LLC será responsable por reclamos derivados de fallas, daños o condiciones posteriores al fallecimiento del Comprador original y antes de la reinscripción formal.</p>

<p class="sub"><span class="bold">d. Traspaso de Acuerdo de Medición Neta en Caso de Venta del Inmueble.</span> En caso de que el Comprador original venda o transfiera el inmueble donde se encuentre instalado el Sistema de Energía Renovable, el nuevo propietario (&ldquo;Segundo Tenedor&rdquo;) será responsable de realizar el proceso de traspaso del Acuerdo de Medición Neta ante LUMA Energy o cualquier otra entidad reguladora aplicable.</p>
<p class="sub">Dicho proceso puede requerir la presentación de nuevas certificaciones eléctricas, la firma de acuerdos actualizados bajo términos diferentes a los originalmente aprobados, o la reevaluación de la infraestructura eléctrica de la red por parte de LUMA Energy o el Negociado de Energía de Puerto Rico (NEPR).</p>
<p class="sub">Energy Depot LLC no será responsable por:<br/>
- La aprobación o rechazo del traspaso del Acuerdo de Medición Neta,<br/>
- Cualquier costo, demora o gasto asociado a dicho proceso,<br/>
- La pérdida parcial o total de beneficios de medición neta, o<br/>
- La declinación o cancelación del sistema en el programa de medición neta debido a limitaciones técnicas, falta de capacidad o cambios regulatorios.</p>
<p class="sub">El Segundo Tenedor entiende que el derecho a participar en programas de medición neta está sujeto a las políticas y disponibilidad de la red eléctrica en el momento del traspaso, las cuales son totalmente independientes a Energy Depot LLC.</p>

<p class="center bold" style="margin:14pt 0">Energy Depot LLC certifica que todas las instalaciones son realizadas por personal técnico con licencias vigentes del Colegio de Peritos Electricistas de Puerto Rico o bajo su supervisión directa.</p>

<p><span class="bold">10. Facilidades.</span> El Comprador presentara al Vendedor que <span class="bold">__X___</span> es titular de la Facilidades identificadas con la localización donde se instalará el Sistema SELF-ENERGY o ________ posee autorización legal por escrito del titular de las Facilidades para la instalación del Sistema SELF-ENERGY. El Comprador releva, exonera y se compromete a proveer defensa al Vendedor con respecto a cualquier reclamación que se presente contra el Vendedor relacionado a la falta de autorización por el dueño o titular de las Facilidades para la instalación del Sistema SELF-ENERGY.</p>

<p><span class="bold">11. Autorización para Documentación Visual y Mercadeo.</span> El Comprador autoriza expresamente a Energy Depot LLC y a sus representantes a grabar, fotografiar y documentar todo el proceso de instalación, inspección, y finalización del Sistema de Energía Renovable, con fines de:</p>
<p>Documentación técnica y control de calidad; y</p>
<p>Promoción y mercadeo del trabajo realizado, incluyendo su publicación en redes sociales, materiales publicitarios, televisión, radio o páginas web.</p>
<p>Energy Depot LLC se compromete a salvaguardar la privacidad y datos personales del Comprador conforme a la ley y a no divulgar información que identifique su dirección o datos financieros sin consentimiento adicional.</p>
<p>Energy Depot LLC cumplirá con las disposiciones de la Ley 39-2012 de Protección de Información Personal y el Reglamento de Privacidad del Negociado de Energía.</p>

<!-- ============ PÁGINA 5 ============ -->
<div class="pagebreak"></div>

<p><span class="bold">12. Documentos y Facturas.</span> El Comprador proveerá copia al Vendedor de los Acuerdos Energéticos, así como cualquier otro contrato o acuerdo suscrito con relación al Sistema SELF-ENERGY, así como de copia de las facturas de consumo de energía eléctrica para las Facilidades por un periodo de doce (12) meses luego de instalado el Sistema SELF-ENERGY.</p>

<p><span class="bold">13. Notificaciones.</span> Todas las notificaciones, requerimientos, instrucciones y otras comunicaciones requeridos bajo este Contrato se harán por escrito y serán enviados por correo certificado con acuse de recibo, correo electrónico con acuse de recibo o facsímile o entregadas a la mano a la parte a las siguientes direcciones de las partes que surgen en el encabezamiento.</p>
<p class="sub"><span class="bold">a. Cláusula de Comunicación Continua.</span> Energy Depot LLC mantendrá comunicación con el Comprador durante todo el proceso de permisos, instalación y certificación, informando de manera periódica sobre el estatus de los trámites.</p>

<p><span class="bold">14. Cancelación del Proyecto y Aplicación de Pagos.</span> En caso de cancelación voluntaria del proyecto por parte del Comprador, o si el contrato se termina antes de completarse por causas ajenas a Energy Depot LLC, cualquier cantidad recibida como pronto, pago parcial o desembolso inicial, ya sea directamente del Comprador o de una institución financiera, se aplicará a los costos incurridos hasta la fecha de cancelación, incluyendo, sin limitarse a:</p>
<p>Visita técnica preliminar,<br/>Desarrollo del diseño conceptual o de ingeniería,<br/>Preparación del plano eléctrico,<br/>Trámites de permisos o interconexión, y<br/>Gastos administrativos y logísticos.</p>
<p>Energy Depot LLC devolverá cualquier excedente no utilizado al Comprador una vez deducidos los gastos razonables y documentables.</p>
<p>Si los costos incurridos exceden el monto recibido, el Comprador se compromete a cubrir la diferencia dentro de los quince (15) días siguientes a la notificación escrita. La política de cancelación aplica tanto a clientes directos como a proyectos financiados.</p>

<p><span class="bold">15. Remedios y Resolución de Controversias.</span> En adición a cualquier remedio provisto por ley y/o cualquier remedio específico establecido en las demás secciones de este Contrato, en caso de incumplimiento por el Comprador de cualesquiera de sus obligaciones bajo este Contrato, el Vendedor podrá, además:</p>
<p class="sub"><span class="bold">a.</span> En casos donde no medie financiamiento por una institución financiera, (i) dar por terminado el presente Contrato; (ii) tomar posesión del Sistema SELF-ENERGY conforme a lo dispuesto en la Ley de Transacciones Garantizadas de Puerto Rico, según enmendada; (iii) paralizar la instalación del Sistema SELF-ENERGY en las Facilidades del Comprador; (iv) retener cualquier parte del Precio de Compraventa pagado por el Vendedor; y/o (v) acelerar el pago de cualquier desembolso no vencido del Precio de Compraventa.</p>
<p class="sub"><span class="bold">b. Cláusula de Resolución Amistosa Previa al Arbitraje.</span> Antes de acudir al proceso de arbitraje, las partes se comprometen a intentar una reunión de conciliación amistosa dentro de un término de diez (10) días naturales desde la notificación del reclamo. Esta reunión podrá celebrarse de manera presencial o virtual, y no afectará el derecho posterior de las partes a acudir al arbitraje.</p>
<p class="sub"><span class="bold">c.</span> En caso de incumplimiento de cualquiera de las obligaciones contenidas en este Contrato, las partes acuerdan que toda reclamación, disputa o controversia derivada o relacionada con el presente Contrato, su interpretación, ejecución o terminación, se resolverá exclusivamente mediante arbitraje vinculante ante el Centro de Arbitraje y Mediación de la Cámara de Comercio de Puerto Rico, conforme a su reglamento vigente. Este proceso ofrece un mecanismo rápido, imparcial y especializado, en lugar de recurrir a agencias administrativas como DACO o a los tribunales ordinarios, salvo para ejecutar el laudo arbitral o solicitar medidas provisionales según la ley aplicable. La decisión del árbitro será final, firme y vinculante, y podrá ejecutarse en los tribunales del Estado Libre Asociado de Puerto Rico.</p>

<p><span class="bold">16. Fuerza Mayor.</span> Ninguna de las partes será responsable por el incumplimiento de sus obligaciones contractuales cuando dicho incumplimiento sea resultado directo de eventos fuera de su control razonable, incluyendo, pero sin limitarse a, desastres naturales, eventos climáticos severos (huracanes categoría 3 o más), actos de gobierno, interrupciones en la cadena de suministro, pandemias, huelgas o fallas de terceros como LUMA Energy o PREPA. En tales casos, el plazo de cumplimiento se extenderá por el tiempo que dure la causa de fuerza mayor, sin penalidades para Energy Depot LLC.</p>

<!-- ============ PÁGINA 6 ============ -->
<div class="pagebreak"></div>

<p><span class="bold">17. Misceláneos.</span></p>
<p class="sub"><span class="bold">a. Enmiendas.</span> Este Acuerdo únicamente podrá ser enmendado, modificado o cedido mediante el consentimiento por escrito de las partes.</p>
<p class="sub"><span class="bold">b. Ley Aplicable.</span> Este Contrato se regirá e interpretará conforme a las leyes del Estado Libre Asociado de Puerto Rico, incluyendo el Código Civil vigente y la Ley de Arbitraje Comercial, y cualquier disposición aplicable al comercio y contratos privados.</p>
<p class="sub"><span class="bold">c. Cláusula de Cesión y Subcontratación.</span> Energy Depot LLC podrá delegar o subcontratar partes del proyecto a profesionales certificados en Puerto Rico, sin que ello implique modificación del presente contrato ni liberación de sus responsabilidades.</p>
<p class="sub"><span class="bold">d. Separabilidad.</span> Si alguna cláusula de este Contrato resultare inválida, ilegal o no pudiera hacerse valer en el Estado Libre Asociado de Puerto Rico, no se afectará por ello la validez y efectividad de las demás cláusulas y condiciones del Contrato ni se afectará la validez y efectividad de dicha cláusula y las demás cláusulas en cualquier otra jurisdicción en que la cláusula se considere válida.</p>
<p class="sub"><span class="bold">e. No Renuncia.</span> Las partes convienen que si alguna de ellas, en algún momento, no reclama u omite reclamar a la otra parte el cumplimiento de alguna de las cláusulas de este Contrato, no significa que haya renunciado a sus derechos bajo el presente Contrato. En cualquier momento podrá requerir de la otra el cumplimiento específico del mismo.</p>
<p class="sub"><span class="bold">f. Encabezamientos.</span> Los encabezamientos de las secciones y cláusulas en este Contrato se incluyen para referencia y conveniencia y no constituirán parte alguna de este Contrato. Las palabras utilizadas en este Contrato se interpretarán en el género o número que las circunstancias ameriten.</p>
<p class="sub"><span class="bold">g. Jurisdicción.</span> Las partes acuerdan que cualquier acción judicial relacionada con la ejecución o validación de un laudo arbitral se presentará exclusivamente ante los tribunales del Estado Libre Asociado de Puerto Rico.</p>
<p class="sub"><span class="bold">h. Sucesores y Causahabientes.</span> Los pactos y cláusulas aquí contenidas obligarán y beneficiarán a las partes y a sus respectivos causahabientes, albaceas, administradores, sucesores y cesionarios.</p>
<p class="sub"><span class="bold">i. Referencia a cumplimiento con leyes de protección al consumidor.</span> Este contrato cumple con las disposiciones aplicables de la Ley de Prácticas y Anuncios Engañosos de Puerto Rico (Ley Núm. 5 de 23 de abril de 1973) y la Ley de Seguridad de Productos de Consumo (Ley Núm. 108-2011).</p>
<p class="sub"><span class="bold">i. Reconocimiento de Información Precontractual.</span> El Comprador declara haber recibido y comprendido toda la información técnica y económica sobre el proyecto, incluyendo la descripción del sistema, garantías, mantenimiento y limitaciones, previo a la firma del presente contrato.</p>
<p class="sub"><span class="bold">i. Consentimiento y Reconocimiento.</span> Las partes reconocen que han leído el presente Contrato, aceptan y están de acuerdo con las condiciones y términos aquí pactados, y que ejecutan el mismo voluntariamente y con completo entendimiento de los efectos y consecuencias del mismo.</p>

<p class="bold" style="margin-top:14pt">Energy Depot LLC reafirma su compromiso de actuar conforme a los principios de transparencia, servicio responsable y calidad garantizada, buscando siempre la satisfacción y seguridad del cliente.</p>

<p style="margin-top:14pt"><span class="bold">POR TODO LO CUAL,</span> las partes otorgan este Contrato en la fecha indicada al principio del mismo.</p>

<div class="firma">
  <div class="col">
    <div>Por:</div>
    <div class="line"></div>
    <div>Nombre: Gilberto J. Díaz Merced</div>
    <div>Título: Energy Depot LLC / CEO</div>
  </div>
  <div class="col">
    <div>Por:</div>
    <div class="line"></div>
    <div>Nombre: <span class="bold">${esc(nombre)}</span></div>
    <div>Título: Cliente / Comprador</div>
  </div>
</div>

<div class="footer">Versión Oficial: Contrato ED-2025.1. Documento confidencial propiedad de Energy Depot LLC. Su uso no autorizado está prohibido.</div>

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
      // Efectivo 50/50 — repartimos el balance en mitad y mitad, dejando el último renglón en 0
      pct45a = Math.round(balance * 0.5);
      pct45b = balance - pct45a;
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
      precioTotal, pronto, pct45a, pct45b, pct10
    });

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil:'load', timeout:60000 });
    await page.evaluate(() => document.fonts.ready);
    const pdfBuf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top:'18mm', bottom:'18mm', left:'18mm', right:'18mm' }
    });
    await browser.close();

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
