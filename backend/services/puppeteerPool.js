'use strict';
// Singleton browser para evitar el costo de launch (~2-3s) en cada PDF
let browserP = null;
let pdfCount = 0;
const RECYCLE_AFTER = 50; // evita fugas de memoria — recicla cada 50 PDFs

async function getBrowser() {
  if (browserP) {
    try {
      const b = await browserP;
      if (b && b.connected !== false) return b;
    } catch {}
  }
  const puppeteer = require('puppeteer');
  browserP = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--disable-extensions',
      '--no-first-run',
    ],
  });
  const b = await browserP;
  b.on('disconnected', () => { browserP = null; });
  return b;
}

async function generatePDF(html, options = {}) {
  pdfCount++;
  if (pdfCount > RECYCLE_AFTER) {
    try { const b = await browserP; b && (await b.close()); } catch {}
    browserP = null; pdfCount = 0;
  }
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123 });
    // domcontentloaded + manual font ready = más rápido que networkidle0
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // espera fuentes y dale 400ms extra para imágenes lazy
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 400));
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      timeout: 30000,
      ...options,
    });
  } finally {
    page.close().catch(() => {});
  }
}

module.exports = { generatePDF, getBrowser };
