'use strict';
/**
 * Plantilla del paso 3 de la secuencia welcome_7touches.
 * Email seguimiento ~1h después del WA/SMS inicial pidiendo factura LUMA.
 */
function build({ primer_nombre = 'amigo', cotizar_link = 'https://crm-energydepotpr.com/cotizar' } = {}) {
  const subject = `${primer_nombre}, tu cotización solar en 5 minutos`;

  const text = `Hola ${primer_nombre},

¿Sabías que con tu factura LUMA puedo decirte EN 3 MINUTOS cuánto ahorrarías al mes con solar? Sin compromiso, sin llamada de venta.

Solo súbeme tu factura aquí: ${cotizar_link}

O si prefieres, llena un formulario corto y te llega la cotización al instante: ${cotizar_link}

Saludos,
Equipo Energy Depot LLC
787-627-8585
info@energydepotpr.com`;

  const html = `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(26,60,143,.08);">
    <div style="background:linear-gradient(135deg,#1a3c8f,#1e4ba8);padding:28px 24px;text-align:center;">
      <div style="display:inline-block;color:#67e8f9;font-weight:700;letter-spacing:1px;font-size:12px;">ENERGY DEPOT LLC</div>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">Tu cotización solar en 5 minutos ☀️</h1>
    </div>
    <div style="padding:28px 28px 8px;">
      <h2 style="color:#67e8f9;background:#0b2566;display:inline-block;padding:6px 14px;border-radius:20px;margin:0 0 18px;font-size:14px;">Hola ${primer_nombre}</h2>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
        ¿Sabías que con tu factura LUMA puedo decirte <strong>EN 3 MINUTOS</strong>
        cuánto ahorrarías al mes con solar? Sin compromiso, sin llamada de venta.
      </p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.55;">
        Solo súbeme tu factura. El sistema lee tus 12 meses de consumo y te genera
        un PDF con sistema recomendado, ahorro proyectado y pago mensual.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${cotizar_link}"
           style="display:inline-block;background:linear-gradient(135deg,#1a3c8f,#1e4ba8);color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(26,60,143,.3);">
          Sube tu factura LUMA →
        </a>
      </div>
      <p style="margin:18px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
        ¿Prefieres llenar un formulario corto? <a href="${cotizar_link}" style="color:#1a3c8f;">Cotizar aquí</a>.
      </p>
    </div>
    <div style="padding:18px 28px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
      Energy Depot LLC · 787-627-8585 · info@energydepotpr.com<br>
      Si no quieres recibir más correos, contéstanos "no" y te sacamos del listado.
    </div>
  </div>
</body></html>`.trim();

  return { subject, text, html };
}

module.exports = { build };
