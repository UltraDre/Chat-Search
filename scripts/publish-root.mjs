/**
 * Publishes the production build to the repo root so the app runs from any
 * static server — including ones that just serve the checkout with no build
 * step, no Node and no dev server (that is the situation that produced a
 * styled-less "Loading…" page).
 *
 *   npm run build && npm run publish:root
 *
 * Copies: index.html, assets/, icons/, favicon.svg, sample-chat.txt, sw.js and
 * the Workbox runtime. The manifest is generated (not copied) so its URLs can be
 * relative to wherever the folder is served from.
 */
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('✗ dist/ not found — run `npm run build` first.');
  process.exit(1);
}

// 1. Static files that belong at the root.
await copyFile(join(dist, 'index.html'), join(root, 'index.html'));
for (const file of ['favicon.svg', 'sample-chat.txt']) {
  if (existsSync(join(dist, file))) await copyFile(join(dist, file), join(root, file));
  else if (existsSync(join(root, 'public', file))) await copyFile(join(root, 'public', file), join(root, file));
}

// 2. Folders.
for (const dir of ['assets', 'icons']) {
  await rm(join(root, dir), { recursive: true, force: true });
  await mkdir(join(root, dir), { recursive: true });
  for (const entry of await readdir(join(dist, dir))) {
    await copyFile(join(dist, dir, entry), join(root, dir, entry));
  }
}

// 3. Service worker + Workbox runtime (filenames are hashed, so copy whatever is there).
await rm(join(root, 'sw.js'), { force: true });
await copyFile(join(dist, 'sw.js'), join(root, 'sw.js'));
for (const entry of await readdir(dist)) {
  if (entry.startsWith('workbox-') && entry.endsWith('.js')) {
    await copyFile(join(dist, entry), join(root, entry));
  }
}

// 4. Manifest, rewritten with relative URLs so it works from the root, a subpath
//    or a sandbox preview proxy alike.
const manifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons ?? []) icon.src = icon.src.replace(/^\.?\//, '');
for (const shortcut of manifest.shortcuts ?? []) {
  if (shortcut.url) shortcut.url = shortcut.url.replace(/^\.?\//, './');
}
manifest.start_url = manifest.start_url?.startsWith('http') ? manifest.start_url : './';
manifest.scope = './';
await writeFile(join(root, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log('✓ published dist/ to the repo root');
const published = (await readdir(root)).filter((f) =>
  ['index.html', 'manifest.webmanifest', 'sw.js', 'assets', 'icons'].includes(f),
);
console.log(`  ${published.join(' · ')}`);
