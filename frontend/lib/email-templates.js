// Plantillas de correo de Energy Depot LLC

const LOGO = 'https://energy-depot-web.vercel.app/logo.png';

export const EMAIL_TEMPLATES = {
  cotizaciones_pdf: {
    name: '✉️ Cotizaciones en PDF (moderno)',
    subject: (lead) =>
      `${lead?.contact_name || 'Cliente'} — Cotización Solar Energy Depot PR`,
    html: (lead) => `
<div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; background:#f3f4f6;">
  <div style="background:#ffffff; padding:18px 24px; border-bottom:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td><img src="${LOGO}" alt="Energy Depot PR" style="height:42px;display:block;"/></td>
        <td align="right" style="color:#7e2099;font-size:13px;font-weight:600;">Tus cotizaciones en PDF</td>
      </tr>
    </table>
  </div>
  <div style="background:#fff; padding:32px 28px;">
    <h2 style="color:#7e2099;font-size:22px;font-weight:800;margin:0 0 16px;">Hola ${lead?.contact_name || ''},</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 18px;">
      Ya están listas tus cotizaciones. Adjuntamos tus <strong>propuestas en PDF</strong> para que compares y elijas la opción que mejor se ajuste a tu hogar.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:18px 22px;margin:18px 0;">
      <div style="font-weight:700;color:#111;margin-bottom:10px;">Opciones incluidas (PDF adjuntos):</div>
      <ul style="margin:0;padding-left:18px;color:#374151;line-height:1.8;">
        <li>Opción A — Sistema solar base</li>
        <li>Opción B — Sistema solar + batería</li>
      </ul>
      <p style="color:#9ca3af;font-size:12px;margin:10px 0 0;">*Revisa los PDFs adjuntos para ver detalles completos, precios y términos.</p>
    </div>
    <div style="background:#0f172a;color:#fff;border-radius:8px;padding:24px;margin:24px 0;">
      <h3 style="margin:0 0 12px;font-size:17px;">Paso 2 (recomendado): Pre-cualificación de crédito — sin afectar tu empírica</h3>
      <p style="line-height:1.6;margin:0 0 14px;">Para poder confirmarte pagos aproximados y opciones de financiamiento de energía renovable, lo ideal es completar una indagación Soft Pull con <strong>SoftPull Credit Solutions</strong>.</p>
      <p style="margin:6px 0;">✅ No aparece como indagación dura</p>
      <p style="margin:6px 0;">✅ No afecta tu crédito</p>
      <p style="margin:6px 0;">⏱️ Toma 2–3 minutos</p>
      <a href="https://softpull.app/energydepot" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700;margin-top:14px;">Pre-cualificar ahora (Soft Pull)</a>
    </div>
    <div style="background:#0f172a;color:#fff;border-radius:8px;padding:18px 22px;font-size:14px;line-height:1.6;">
      Si prefieres, también puedes responder este email indicando cuál opción te gustó (A/B/C) y te guiamos paso a paso.
    </div>
    <p style="margin:18px 0 4px;color:#374151;">¿Quieres que revisemos tu elección contigo? Estamos listos para ayudarte.</p>
    <p style="color:#7c3aed;font-weight:700;margin:0;">
      <a href="tel:7876278585" style="color:#7c3aed;text-decoration:none;">Hablar con un asesor</a>
      &nbsp;•&nbsp;
      <a href="mailto:info@energydepotpr.com" style="color:#7c3aed;text-decoration:none;">Responder este email</a>
    </p>
  </div>
  <div style="background:#f3f4f6;padding:16px 28px;border-top:1px solid #e5e7eb;">
    <div style="font-weight:700;color:#374151;margin-bottom:4px;">Energy Depot PR</div>
    <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.5;">Este email incluye tus propuestas en PDF adjuntas. Si no ves los adjuntos, revisa tu carpeta de "Promociones" o "Spam".</p>
  </div>
</div>`.trim(),
    text: (lead) => `Hola ${lead?.contact_name || ''},

Ya están listas tus cotizaciones. Adjuntamos tus propuestas en PDF para que compares y elijas la opción que mejor se ajuste a tu hogar.

Opciones incluidas (PDF adjuntos):
- Opción A — Sistema solar base
- Opción B — Sistema solar + batería

Paso 2 (recomendado): Pre-cualificación de crédito — Soft Pull, no afecta tu crédito.
https://softpull.app/energydepot

¿Quieres que revisemos tu elección contigo? Estamos listos para ayudarte.

Energy Depot PR · 787-627-8585 · info@energydepotpr.com`,
  },

  cotizacion_clasica: {
    name: '📄 Cotización (tradicional)',
    subject: (lead) => `${lead?.contact_name || 'Cliente'} — Cotización Energy Depot LLC`,
    html: (lead) => `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#333;">
  <div style="border-bottom:1px solid #ccc;padding-bottom:14px;margin-bottom:18px;">
    <img src="${LOGO}" alt="Energy Depot LLC" style="height:60px;display:block;"/>
  </div>
  <p>Saludos${lead?.contact_name ? ` ${lead.contact_name}` : ''},</p>
  <p style="font-style:italic;font-weight:700;color:#7e2099;">¡Te felicitamos por dar el primer paso y tomar la decisión de evaluar el proyecto de energía renovable para tu propiedad!</p>
  <p>Te vamos a asistir en todas las áreas que conlleva el desarrollo de tu proyecto, adjunto encontrarás la(s) cotización(es) del sistema sugerido según su consumo de energía (Solo Medición Neta o con Respaldo de Batería) y "datasheet" de los equipos propuestos.</p>
  <p>En la propuesta encontrará un ejemplo de pago mensual y el costo del kWh por el periodo del financiamiento. De necesitar asistencia para el financiamiento nuestro departamento de desarrollo de negocios puede asistirle.</p>
  <p><strong>Los documentos requeridos para la solicitud de financiamiento son:</strong></p>
  <ol style="line-height:1.8;">
    <li>Solicitud debidamente llena para su evaluación (Llenar solo las partes de Información Personal del Solicitante y Información Empleo Solicitante).</li>
    <li>Copia de licencia de conducir o ID válida.</li>
    <li>Tarjeta de SS.</li>
    <li>Últimos 2 talonarios de trabajo. (Empleo propio últimos 2 estados bancarios) o último estado bancario donde reciben sus ingresos de retiro o pensiones en caso pensionados.</li>
    <li>Carta de empleo. (Empleo propio última planilla) o certificaciones de pensiones SS o retiro.</li>
    <li>Recibo de luz.</li>
    <li>Cotización y contrato de proyecto firmados por cliente.</li>
    <li>Presentar escrituras de la propiedad solo con el fin de evidenciar que el solicitante es el titular de la propiedad (NO SE HACE GRAVAMEN A LA MISMA)</li>
  </ol>
  <p><a href="https://www.energydepotpr.com/registro" style="color:#1976d2;font-weight:700;text-decoration:underline;">¡¡¡OPRIME AQUÍ PARA REGISTRARTE Y COMENZAR CON LOS PASOS QUE TE LLEVARAN POR EL CAMINO AL AHORRO!!!</a></p>
  <p><strong>NOTA IMPORTANTE:</strong></p>
  <p>Recuerde que la compra de este equipo es quizás una de las inversiones más relevantes para su economía y la planificación financiera de su futuro ya que no necesariamente representa un incremento en sus gastos mensuales, sino que sustituye una deuda existente con LUMA que no tiene fin. Con la compra de este sistema usted se está encargando de estabilizar el costo del kWh y le pone fin al pago de su consumo actual de energía. Nos placería tener la dicha de ser la compañía de su elección para el desarrollo del proyecto de energía renovable para su propiedad.</p>
  <p>De tener dudas o preguntas por favor siéntase en la libertad de comunicarse con nuestro departamento de desarrollo de proyectos al 787-627-8585. Nos place mucho poder servirle y nos reiteramos a sus órdenes siempre!</p>
  <p>Cordialmente,</p>
  <p><strong>Servicio al Cliente</strong></p>
  <p style="margin:0;">ENERGY DEPOT LLC<br/>
  <strong>Tel. Ofic.</strong> <a href="tel:7876278585" style="color:#1976d2;">787-627-8585</a><br/>
  <strong>Email.</strong> <a href="mailto:info@energydepotpr.com" style="color:#1976d2;">info@energydepotpr.com</a><br/>
  <strong>Web.</strong> <a href="https://www.energydepotpr.com" style="color:#1976d2;">www.energydepotpr.com</a></p>
  <p style="color:#16a34a;font-size:13px;margin-top:18px;">We are green. Think before printing.<br/>Somos verdes. Piense antes de imprimir.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;"/>
  <p style="font-size:11px;color:#888;line-height:1.5;"><strong>CONFIDENTIALITY NOTICE</strong> If you have received this email by error, please notify the sender immediately by email at the address shown. This email transmission may contain confidential information. This information is intended only for use of the individual(s) or entity to whom it is addressed to. Please delete it from your files if you are not the intended recipient. Thank you for your compliance.</p>
  <p style="font-size:11px;color:#888;line-height:1.5;"><strong>AVISO DE CONFIDENCIALIDAD</strong> Si usted ha recibido este email por error, favor de notificar inmediatamente al remitente a la dirección mostrada en este email. Esta transmisión puede contener información confidencial. Esta información es para el uso del individuo(s) o de la entidad a los cuales se intentó dirigir. Favor de eliminarlo de sus archivos si usted no es el recipiente previsto. Gracias por su cumplimiento.</p>
</div>`.trim(),
    text: (lead) => `Saludos${lead?.contact_name ? ` ${lead.contact_name}` : ''},

¡Te felicitamos por dar el primer paso y tomar la decisión de evaluar el proyecto de energía renovable para tu propiedad!

Adjunto encontrarás la(s) cotización(es) del sistema sugerido según su consumo de energía y "datasheet" de los equipos propuestos.

De necesitar asistencia para el financiamiento, contáctanos al 787-627-8585.

Cordialmente,
Servicio al Cliente
ENERGY DEPOT LLC
787-627-8585 · info@energydepotpr.com · www.energydepotpr.com`,
  },
};
