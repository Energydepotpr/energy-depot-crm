'use strict';
// Genera iconos PWA con fondo navy + logo blanco centrado.
// Output: frontend/public/{apple-icon.png, icon-192.png, icon-512.png}

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SRC_LOGO = path.resolve(__dirname, '../../frontend/public/logo-icon.png');
const OUT_DIR  = path.resolve(__dirname, '../../frontend/public');
const BG       = '#1a3c8f'; // navy Energy Depot

async function buildIcon(size, filename) {
  // Logo tal cual (mismo del sidebar/favicon), fondo blanco para que se vea bien
  // en home screens claros y oscuros.
  const out = await sharp(SRC_LOGO)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
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
