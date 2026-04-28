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
          .map(b => ({ name: String(b.name), precio: Number(b.precio) || 0 }));
      }
    }
  } catch {}
  return DEFAULT_BATERIAS;
}

export async function saveBaterias(list) {
  return api.saveSetting('solar_batteries', JSON.stringify(list));
}
