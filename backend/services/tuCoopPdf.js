'use strict';
/**
 * Generador del PDF de Solicitud Tu Coop.
 *
 * Implementación: template HTML (templates/coops/tu-coop-solicitud.html.js) →
 * renderizado a PDF con Puppeteer (singleton de services/puppeteerPool.js).
 *
 * Reemplaza la versión basada en pdf-lib + coordenadas absolutas, que tenía
 * problemas de alineación. Tu Coop autorizó el uso de este formulario en
 * HTML para evaluar casos de financiamiento enviados por Energy Depot LLC.
 */
const { getBrowser } = require('./puppeteerPool');
const { buildHtml } = require('../templates/coops/tu-coop-solicitud.html.js');

async function generateTuCoopPdf(formData = {}, signaturePngBase64 = null) {
  const html = buildHtml(formData, signaturePngBase64);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 200));
    const pdf = await page.pdf({
      width: '8.5in',
      height: '14in',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true,
      timeout: 30000,
    });
    return Buffer.from(pdf);
  } finally {
    page.close().catch(() => {});
  }
}

module.exports = { generateTuCoopPdf };
