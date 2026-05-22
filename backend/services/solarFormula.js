'use strict';
/**
 * Fórmula solar única — Energy Depot PR.
 *
 * Source of truth. Backend y frontend deberían consumirla via
 * GET /api/config/solar (registrado en server.js) en vez de duplicar
 * constantes en cada archivo.
 *
 * Constantes (Vega Coop):
 *   panelPrice:        $1,084 / panel (550W)
 *   panelWatts:        550 W
 *   factorProduccion:  1460 kWh/kW/año
 *   tarifaLuma:        $0.26 / kWh
 *   pmt15:             0.008711 (6.50% APR, 15 años)
 *   pmt10:             0.010605 (4.99% APR, 10 años)
 */

const DEFAULTS = {
  panelPrice: 1084,
  panelWatts: 550,
  factorProduccion: 1460,
  tarifaLuma: 0.26,
  pmt15: 0.008711,
  pmt10: 0.010605,
};

/** Cálculo del sistema FV en base a consumo mensual (kWh). Devuelve null si no hay datos. */
function calcSolar(months, pricing) {
  const pRaw = pricing || DEFAULTS;
  // Clamps anti-divide-by-zero
  const p = {
    ...DEFAULTS,
    ...pRaw,
    panelWatts: Math.max(Number(pRaw.panelWatts) || DEFAULTS.panelWatts, 1),
    panelPrice: Math.max(Number(pRaw.panelPrice) || 0, 0),
    tarifaLuma: Math.max(Number(pRaw.tarifaLuma) || 0, 0),
  };
  // Si vienen 13 meses (histórico LUMA completo), usar los últimos 12.
  const inputMonths = (months && months.length > 12) ? months.slice(-12) : (months || []);
  const filled = inputMonths.map(Number).filter(v => v > 0);
  if (filled.length < 1) return null;
  const avgKwh   = filled.reduce((a, b) => a + b, 0) / filled.length;
  const annCons  = Math.round(avgKwh * 12);
  // Paneles = redondear hacia arriba al par próximo.
  let panels = 2 * Math.ceil(((avgKwh / 30 / 4.5) * 1000 / p.panelWatts) / 2);
  if (!Number.isFinite(panels) || panels < 2) panels = 2;
  const systemKw = parseFloat(((panels * p.panelWatts) / 1000).toFixed(2));
  const annProd  = Math.round(panels * 2.5 * 365);
  const costBase = Math.round(panels * p.panelPrice);
  const annualSavings = Math.round(avgKwh * p.tarifaLuma * 12);
  const roi = annualSavings > 0 ? Math.round(costBase / annualSavings) : 0;
  return { avg: Math.round(avgKwh), systemKw, panels, costBase, annualSavings, roi, annProd, annCons };
}

/** Pago mensual a financiamiento. */
function pagoMensual(total, years, ratePct, pricing) {
  const p = { ...DEFAULTS, ...(pricing || {}) };
  const t = Number(total) || 0;
  if (t <= 0 || !years || years <= 0) return 0;
  if (years === 15 && ratePct === 6.5)  return Math.round(t * p.pmt15);
  if (years === 10 && ratePct === 4.99) return Math.round(t * p.pmt10);
  const r = ratePct / 12 / 100;
  const n = years * 12;
  if (r <= 0) return Math.round(t / n);
  const denom = 1 - Math.pow(1 + r, -n);
  if (!denom) return 0;
  return Math.round(t * r / denom);
}

module.exports = { DEFAULTS, calcSolar, pagoMensual };
