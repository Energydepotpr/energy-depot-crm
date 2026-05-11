'use strict';

const LOGO_URL = 'https://crm-energydepotpr.com/logo.png';

function defaultSubject(name, count) {
  const who = name || 'Cliente';
  return count > 1
    ? `${who} — ${count} Cotizaciones Solares Energy Depot PR`
    : `${who} — Cotización Solar Energy Depot PR`;
}

function defaultHtml({ name, count = 1, options = [] }) {
  const opsList = options.length
    ? options.map(o => `<li>${o}</li>`).join('')
    : (count > 1
        ? '<li>Opción A — Sistema solar base</li><li>Opción B — Sistema solar + batería</li>'
        : '<li>Tu propuesta solar personalizada</li>');
  return `
<div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; background:#f3f4f6;">
  <div style="background:#0f172a; padding:16px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td><img src="${LOGO_URL}" alt="Energy Depot PR" style="height:36px;display:block;"/></td>
        <td align="right" style="color:#a78bfa;font-size:13px;font-weight:500;">Tus cotizaciones en PDF</td>
      </tr>
    </table>
  </div>
  <div style="background:#fff; padding:32px 28px;">
    <h2 style="color:#7e2099;font-size:22px;font-weight:800;margin:0 0 16px;">Hola ${name || ''},</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 18px;">
      Ya ${count > 1 ? 'están listas tus cotizaciones' : 'está lista tu cotización'}. Adjuntamos ${count > 1 ? 'tus' : 'tu'} <strong>${count > 1 ? 'propuestas en PDF' : 'propuesta en PDF'}</strong> para que ${count > 1 ? 'compares y elijas' : 'revises'} la opción que mejor se ajuste a tu hogar.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:18px 22px;margin:18px 0;">
      <div style="font-weight:700;color:#111;margin-bottom:10px;">${count > 1 ? 'Opciones incluidas (PDF adjuntos):' : 'Documento adjunto:'}</div>
      <ul style="margin:0;padding-left:18px;color:#374151;line-height:1.8;">${opsList}</ul>
      <p style="color:#9ca3af;font-size:12px;margin:10px 0 0;">*Revisa ${count > 1 ? 'los PDFs adjuntos' : 'el PDF adjunto'} para ver detalles completos, precios y términos.</p>
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
      Si prefieres, también puedes responder este email indicando cuál opción te gustó y te guiamos paso a paso.
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
    <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.5;">Este email incluye ${count > 1 ? 'tus propuestas' : 'tu propuesta'} en PDF ${count > 1 ? 'adjuntas' : 'adjunta'}. Si no ${count > 1 ? 'ves los adjuntos' : 'ves el adjunto'}, revisa tu carpeta de "Promociones" o "Spam".</p>
  </div>
</div>`.trim();
}

function defaultText({ name, count = 1 }) {
  return `Hola ${name || ''},

Ya ${count > 1 ? 'están listas tus cotizaciones' : 'está lista tu cotización'}. Adjuntamos ${count > 1 ? 'tus propuestas' : 'tu propuesta'} en PDF para que ${count > 1 ? 'compares y elijas' : 'revises'} la opción que mejor se ajuste a tu hogar.

Paso 2 (recomendado): Pre-cualificación de crédito — Soft Pull, no afecta tu crédito.
https://softpull.app/energydepot

¿Quieres que revisemos tu elección contigo? Estamos listos para ayudarte.

Energy Depot PR · 787-627-8585 · info@energydepotpr.com`;
}

function interp(s, vars) {
  return String(s || '')
    .replace(/\{\{\s*contact_name\s*\}\}/g, vars.name || '')
    .replace(/\{\{\s*email\s*\}\}/g, vars.email || '')
    .replace(/\{\{\s*count\s*\}\}/g, String(vars.count || 1));
}

async function buildModernEmail({ name, email, count = 1, options = [], getConfigValue }) {
  let subject = null;
  let html = null;
  if (typeof getConfigValue === 'function') {
    try {
      const ovSubj = await getConfigValue('email_tpl_modern_subject', '');
      const ovHtml = await getConfigValue('email_tpl_modern_html', '');
      if (ovSubj) subject = interp(ovSubj, { name, email, count });
      if (ovHtml) html = interp(ovHtml, { name, email, count });
    } catch {}
  }
  if (!subject) subject = defaultSubject(name, count);
  if (!html)    html    = defaultHtml({ name, count, options });
  const text = defaultText({ name, count });
  return { subject, html, text };
}

module.exports = { buildModernEmail };
