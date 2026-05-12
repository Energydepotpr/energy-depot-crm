'use strict';
// Genera iconos PWA con fondo navy + logo blanco centrado.
// Output: frontend/public/{apple-icon.png, icon-192.png, icon-512.png}

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SRC_LOGO = path.resolve(__dirname, '../../frontend/public/logo-icon.png');
const OUT_DIR  = path.resolve(__dirname, '../../frontend/public');
const BG       = '#1a3c8f'; // navy Energy Depot

async function buildIcon(size, filename, paddingPct = 0.16) {
  const inner = Math.round(size * (1 - paddingPct * 2));
  // Carga logo, lo lleva a blanco preservando alpha, lo achica a `inner`
  const logoWhite = await sharp(SRC_LOGO)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    // Convierte el logo en silueta blanca: multiplicamos canal alpha con blanco puro.
    // Reemplazamos los píxeles de color por blanco manteniendo alpha original.
    .ensureAlpha()
    .composite([{
      input: Buffer.from(`<svg width="${inner}" height="${inner}"><rect width="100%" height="100%" fill="white"/></svg>`),
      blend: 'in'
    }])
    .png()
    .toBuffer();

  const out = await sharp({
    create: {
      width: size, height: size, channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logoWhite, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(OUT_DIR, filename), out);
  console.log(`✓ ${filename} (${size}x${size})`);
}

(async () => {
  await buildIcon(192, 'icon-192.png');
  await buildIcon(512, 'icon-512.png');
  await buildIcon(180, 'apple-icon.png');
})().catch(e => { console.error(e); process.exit(1); });
