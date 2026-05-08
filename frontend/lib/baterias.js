import { api } from './api';

export const DEFAULT_BATERIAS = [
  { name: 'SolaX ESS 10.24 kWh', precio: 9900 },
  { name: 'SolaX ESS 15.36 kWh', precio: 12950 },
  { name: 'SolaX ESS 20.48 kWh', precio: 15900 },
  { name: 'FranklinWH G2',       precio: 13539 },
  { name: 'Tesla PowerWall 3',   precio: 11992 },
];

export async function loadBaterias() {
  try {
    const cfg = await api.settings();
    if (cfg.solar_batteries) {
      const parsed = typeof cfg.solar_batteries === 'string'
        ? JSON.parse(cfg.solar_batteries)
        : cfg.solar_batteries;
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .filter(b => b && b.name)
          .map(b => ({ name: String(b.name), precio: Number(b.precio) || 0, description: b.description ? String(b.description) : '' }));
      }
    }
  } catch {}
  return DEFAULT_BATERIAS;
}

export async function saveBaterias(list) {
  return api.saveSetting('solar_batteries', JSON.stringify(list));
}

export const DEFAULT_PRICING = {
  panelPrice: 1084,
  panelWatts: 550,
  tarifaLuma: 0.26,
  factorProduccion: 1460,
  pmt15: 0.008711,
};

export async function loadPricing() {
  try {
    const cfg = await api.settings();
    if (cfg.solar_pricing) {
      const p = typeof cfg.solar_pricing === 'string' ? JSON.parse(cfg.solar_pricing) : cfg.solar_pricing;
      // Backwards compat: convert old kwPrice to panelPrice
      if (p.kwPrice && !p.panelPrice) {
        p.panelPrice = +(p.kwPrice * (p.panelWatts || 550) / 1000).toFixed(2);
      }
      return { ...DEFAULT_PRICING, ...p };
    }
  } catch {}
  return DEFAULT_PRICING;
}

export async function savePricing(pricing) {
  return api.saveSetting('solar_pricing', JSON.stringify(pricing));
}
