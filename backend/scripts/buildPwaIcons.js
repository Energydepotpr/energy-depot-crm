'use strict';
// Genera iconos PWA con fondo navy + logo blanco centrado.
// Output: frontend/public/{apple-icon.png, icon-192.png, icon-512.png}

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SRC_LOGO = path.resolve(__dirname, '../../frontend/public/logo-icon.png');
const OUT_DIR  = path.resolve(__dirname, '../../frontend/public');
const BG       = '#1a3c8f'; // navy Energy Depot

async function buildIcon(size, filename, padPct = 0.18) {
  // Logo centrado con padding generoso + fondo blanco limpio.
  // iOS aplica esquinas redondeadas automáticamente al apple-touch-icon,
  // por eso el logo se reduce ~18% para que no quede pegado a los bordes.
  const inner = Math.round(size * (1 - padPct * 2));
  const logo = await sharp(SRC_LOGO)
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const out = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
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
