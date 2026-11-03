/**
 * Rasterises public/favicon.svg into the PNG sizes the manifest and iOS need.
 *   npm run icons      (requires sharp: npm i -D sharp)
 */
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url));
const outDir = new URL('../public/icons/', import.meta.url);
await mkdir(outDir, { recursive: true });

const targets = [
  { file: 'icon-32.png', size: 32 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(new URL(file, outDir).pathname);
  console.log(`icons/${file}  ${size}x${size}`);
}

// Maskable icon: same art, scaled to 80% inside a full-bleed slate square so
// Android's circular/squircle masks never clip the bubble.
const inner = Math.round(512 * 0.8);
const art = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0f172a' } })
  .composite([{ input: art, gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(new URL('icon-maskable-512.png', outDir).pathname);
console.log('icons/icon-maskable-512.png  512x512 (maskable)');
