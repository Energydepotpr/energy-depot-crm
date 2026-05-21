'use strict';
/**
 * Generador del PDF de Solicitud Tu Coop.
 * Carga el template `backend/templates/coops/tu-coop-solicitud.pdf` y dibuja
 * los campos del formulario encima usando pdf-lib.
 *
 * IMPORTANTE: las coordenadas son ESTIMACIONES iniciales basadas en el layout
 * visto (Letter 612x792, header rojo "TUCOOP" arriba, secciones: Información
 * del Préstamo, Información del Solicitante, Empleo, Cónyuge, Garantizador,
 * footer con firmas). Casi seguro habrá que ajustar. Para calibrar, abrir el
 * PDF resultante y mover los valores de COORDS hasta que cada valor caiga
 * dentro de su recuadro amarillo.
 *
 * Sistema de coordenadas pdf-lib: origen abajo-izquierda. y crece hacia arriba.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'coops', 'tu-coop-solicitud.pdf');
const PAGE_HEIGHT = 792;
const PAGE_WIDTH  = 612;

// Util: convertir Y "desde arriba" a Y de pdf-lib (desde abajo).
const yt = (yFromTop) => PAGE_HEIGHT - yFromTop;

/**
 * Coordenadas estimadas para cada campo en la página 1 del template.
 * Cada entrada: { x, y, size? }  — y se mide desde ABAJO (origen pdf-lib).
 *
 * Las estimaciones asumen el siguiente layout aproximado (Letter):
 *   - header rojo y banner azul: ~ y=720..792
 *   - sección "Información del Préstamo":   y ≈ 660..710
 *   - sección "Información del Solicitante": y ≈ 470..650
 *   - sección "Empleo":          y ≈ 360..460
 *   - sección "Cónyuge":         y ≈ 250..350
 *   - sección "Garantizador":    y ≈ 140..240
 *   - footer firmas:             y ≈ 60..130
 */
const COORDS = {
  // ── Información del Préstamo ───────────────────────────────────────────────
  proposito_vacaciones:   { x: 92,  y: yt(168), check: true },
  proposito_consolidacion:{ x: 200, y: yt(168), check: true },
  proposito_mejoras:      { x: 330, y: yt(168), check: true },
  proposito_otro:         { x: 440, y: yt(168), check: true },
  cantidad_solicitada:    { x: 175, y: yt(195) },

  // ── Información del Solicitante ───────────────────────────────────────────
  nombre_completo:        { x: 175, y: yt(238) },
  seguro_social:          { x: 175, y: yt(258) },
  fecha_nacimiento:       { x: 425, y: yt(258) },
  telefono:               { x: 175, y: yt(278) },
  licencia_conducir:      { x: 425, y: yt(278) },
  licencia_vencimiento:   { x: 175, y: yt(298) },
  licencia_emitida_en:    { x: 425, y: yt(298) },
  correo:                 { x: 175, y: yt(318) },
  celular:                { x: 425, y: yt(318) },

  estado_civil_casado:    { x: 215, y: yt(338), check: true },
  estado_civil_separado:  { x: 295, y: yt(338), check: true },
  estado_civil_soltero:   { x: 380, y: yt(338), check: true },
  dependientes:           { x: 480, y: yt(338) },

  direccion_fisica:       { x: 175, y: yt(358) },
  direccion_postal:       { x: 175, y: yt(378) },

  vive_propia:            { x: 215, y: yt(398), check: true },
  vive_alquilada:         { x: 280, y: yt(398), check: true },
  vive_familiar:          { x: 360, y: yt(398), check: true },
  vive_otro:              { x: 425, y: yt(398), check: true },
  tiempo_residencia:      { x: 500, y: yt(398) },

  pariente_nombre_direccion: { x: 175, y: yt(420) },
  pariente_correo:        { x: 175, y: yt(440) },
  pariente_telefono:      { x: 425, y: yt(440) },

  // ── Empleo ────────────────────────────────────────────────────────────────
  empleado_regular:       { x: 215, y: yt(484), check: true },
  empleado_probatorio:    { x: 285, y: yt(484), check: true },
  empleado_contrato:      { x: 370, y: yt(484), check: true },
  empleado_cuenta_propia: { x: 445, y: yt(484), check: true },
  tiempo_empleo:          { x: 175, y: yt(504) },
  patrono:                { x: 425, y: yt(504) },
  ocupacion:              { x: 175, y: yt(524) },
  patrono_telefono:       { x: 425, y: yt(524) },
  supervisor:             { x: 175, y: yt(544) },
  telefono_empleo:        { x: 425, y: yt(544) },
  direccion_empleo:       { x: 175, y: yt(564) },
  salario_bruto:          { x: 425, y: yt(564) },

  // ── Footer firmas ─────────────────────────────────────────────────────────
  firma_fecha:            { x: 410, y: yt(720) },
  // recuadro firma solicitante (imagen PNG)
  firma_box: { x: 80, y: yt(740), w: 240, h: 50 },
};

/**
 * Mapea proposito → flag de checkbox.
 */
function propositoFlags(p) {
  const v = String(p || '').toLowerCase();
  return {
    vacaciones:    v === 'vacaciones',
    consolidacion: v === 'consolidacion' || v === 'consolidación',
    mejoras:       v === 'mejoras',
    otro:          v === 'otro' || (v && !['vacaciones','consolidacion','consolidación','mejoras'].includes(v)),
  };
}

function estadoCivilFlags(p) {
  const v = String(p || '').toLowerCase();
  return {
    casado:   v === 'casado' || v === 'casada',
    separado: v === 'separado' || v === 'separada',
    soltero:  v === 'soltero' || v === 'soltera',
  };
}

function viveEnCasaFlags(p) {
  const v = String(p || '').toLowerCase();
  return {
    propia:    v === 'propia',
    alquilada: v === 'alquilada' || v === 'alquilado',
    familiar:  v === 'familiar',
    otro:      v === 'otro',
  };
}

function empleadoTipoFlags(p) {
  const v = String(p || '').toLowerCase().replace(/\s+/g, '_');
  return {
    regular:       v === 'regular',
    probatorio:    v === 'probatorio',
    contrato:      v === 'contrato',
    cuenta_propia: v === 'cuenta_propia' || v === 'cuentapropia',
  };
}

async function generateTuCoopPdf(formData = {}, signaturePngBase64 = null) {
  const tplBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(tplBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];

  const draw = (key, value, size = 9) => {
    const c = COORDS[key];
    if (!c || value == null || value === '') return;
    page.drawText(String(value), { x: c.x, y: c.y, size, font, color: rgb(0, 0, 0) });
  };

  const check = (key, on) => {
    if (!on) return;
    const c = COORDS[key];
    if (!c) return;
    page.drawText('X', { x: c.x, y: c.y, size: 10, font, color: rgb(0, 0, 0) });
  };

  // ── Propósito ──────────────────────────────────────────────────────────────
  const pr = propositoFlags(formData.proposito);
  check('proposito_vacaciones',    pr.vacaciones);
  check('proposito_consolidacion', pr.consolidacion);
  check('proposito_mejoras',       pr.mejoras);
  check('proposito_otro',          pr.otro);

  draw('cantidad_solicitada', formData.cantidad_solicitada);

  // ── Solicitante ────────────────────────────────────────────────────────────
  draw('nombre_completo',      formData.nombre_completo);
  draw('seguro_social',        formData.seguro_social);
  draw('fecha_nacimiento',     formData.fecha_nacimiento);
  draw('telefono',             formData.telefono);
  draw('licencia_conducir',    formData.licencia_conducir);
  draw('licencia_vencimiento', formData.licencia_vencimiento);
  draw('licencia_emitida_en',  formData.licencia_emitida_en);
  draw('correo',               formData.correo);
  draw('celular',              formData.celular);

  const ec = estadoCivilFlags(formData.estado_civil);
  check('estado_civil_casado',   ec.casado);
  check('estado_civil_separado', ec.separado);
  check('estado_civil_soltero',  ec.soltero);
  draw('dependientes', formData.dependientes);

  draw('direccion_fisica', formData.direccion_fisica);
  draw('direccion_postal', formData.direccion_postal);

  const vc = viveEnCasaFlags(formData.vive_en_casa);
  check('vive_propia',    vc.propia);
  check('vive_alquilada', vc.alquilada);
  check('vive_familiar',  vc.familiar);
  check('vive_otro',      vc.otro);
  draw('tiempo_residencia', formData.tiempo_residencia);

  draw('pariente_nombre_direccion', formData.pariente_nombre_direccion);
  draw('pariente_correo',           formData.pariente_correo);
  draw('pariente_telefono',         formData.pariente_telefono);

  // ── Empleo ─────────────────────────────────────────────────────────────────
  const et = empleadoTipoFlags(formData.empleado_tipo);
  check('empleado_regular',       et.regular);
  check('empleado_probatorio',    et.probatorio);
  check('empleado_contrato',      et.contrato);
  check('empleado_cuenta_propia', et.cuenta_propia);
  draw('tiempo_empleo',     formData.tiempo_empleo);
  draw('patrono',           formData.patrono);
  draw('ocupacion',         formData.ocupacion);
  draw('patrono_telefono',  formData.patrono_telefono);
  draw('supervisor',        formData.supervisor);
  draw('telefono_empleo',   formData.telefono_empleo);
  draw('direccion_empleo',  formData.direccion_empleo);
  draw('salario_bruto',     formData.salario_bruto);

  // ── Footer ─────────────────────────────────────────────────────────────────
  draw('firma_fecha', formData.firma_fecha || new Date().toLocaleDateString('es-PR'));

  // Firma como imagen PNG embebida
  if (signaturePngBase64) {
    try {
      // Aceptar tanto dataURL como base64 puro
      const cleanB64 = signaturePngBase64.includes(',')
        ? signaturePngBase64.split(',')[1]
        : signaturePngBase64;
      const sigBytes = Buffer.from(cleanB64, 'base64');
      const png = await pdfDoc.embedPng(sigBytes);
      const box = COORDS.firma_box;
      const dims = png.scaleToFit(box.w, box.h);
      page.drawImage(png, {
        x: box.x,
        y: box.y,
        width: dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error('[tuCoopPdf] embed firma:', e.message);
    }
  }

  const out = await pdfDoc.save();
  return Buffer.from(out);
}

module.exports = { generateTuCoopPdf, COORDS };
