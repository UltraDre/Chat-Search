import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

/**
 * The repo root doubles as the deployable static site (npm run publish:root), so
 * a plain static server — no Node build, no dev server — can serve the app.
 * These tests keep that copy honest.
 */
describe('published root build', () => {
  const html = read('index.html');

  it('references only relative asset paths', () => {
    const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith('/')).toBe(false);
      expect(/^https?:/.test(url)).toBe(false);
    }
  });

  it('points at files that exist', () => {
    const script = html.match(/<script[^>]*\ssrc="([^"]+)"/)?.[1];
    expect(script).toBeTruthy();
    expect(existsSync(script!.replace(/^\.\//, ''))).toBe(true);

    const css = html.match(/<link[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"/)?.[1];
    expect(css).toBeTruthy();
    expect(existsSync(css!.replace(/^\.\//, ''))).toBe(true);
  });

  it('ships a manifest and service worker with relative scope', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false);
      expect(existsSync(icon.src)).toBe(true);
    }
    expect(existsSync('sw.js')).toBe(true);
  });

  it('does not ship TypeScript or source files as page entry points', () => {
    // A browser cannot execute .ts: the served page must load the built bundle.
    expect(html).not.toMatch(/src="[^"]*\.ts"/);
    expect(html).toMatch(/src="\.\/assets\/app\.js"/);
  });

  it('revisions stable asset filenames so offline clients receive updates', () => {
    const sw = read('sw.js');
    expect(sw).toMatch(/url:"assets\/app\.js",revision:"[a-f0-9]+"/);
    expect(sw).toMatch(/url:"assets\/style\.css",revision:"[a-f0-9]+"/);
  });

  it('keeps the offline precache list pointing at real files', () => {
    const sw = read('sw.js');
    const entries = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
    expect(entries.length).toBeGreaterThan(5);
    for (const entry of entries) {
      const path = entry.replace(/^\.?\//, '').split('?')[0];
      if (path.includes('__') || path === '') continue;
      expect(existsSync(path), `precache entry missing on disk: ${entry}`).toBe(true);
    }
  });
});
