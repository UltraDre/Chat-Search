/**
 * Boot smoke test for the published root build.
 *
 * Loads the repo-root index.html — the same file a plain static server hands
 * out — into a real DOM, executes the bundle it references, and asserts the app
 * shell rendered. Catches "blank page" regressions that type checks and unit
 * tests miss: wrong paths, a stale build, a boot-time throw.
 *
 *   npm run build && npm run publish:root && node scripts/verify-boot.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const rootUrl = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', rootUrl), 'utf8');

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

// Read the asset paths straight out of the markup, so a wrong path fails here.
const scriptSrc = html.match(/<script[^>]*\ssrc="([^"]+)"/)?.[1];
const styleHref = html.match(/<link[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"/)?.[1];
if (!scriptSrc) fail('index.html has no module script tag');

const resolve = (href) => href.replace(/^\.?\//, '');
const bundleName = resolve(scriptSrc);
if (!existsSync(new URL(bundleName, rootUrl))) {
  fail(`${bundleName} is missing from the repo root — run \`npm run publish:root\``);
}
if (styleHref && !existsSync(new URL(resolve(styleHref), rootUrl))) {
  fail(`${styleHref} is missing from the repo root — run \`npm run publish:root\``);
}

const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/, ''), {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});

const { window } = dom;
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// The published bundle is a single self-contained script (no imports), so it can
// be evaluated directly in the page's global scope.
const code = readFileSync(new URL(bundleName, rootUrl), 'utf8');
window.eval(code);

const document = window.document;
if (!document.querySelector('#app .app')) {
  fail('the app shell did not render (#app .app missing) — the page would be blank');
}

const checks = [
  ['.tab-btn', 3, 'tab buttons'],
  ['#searchPanel', 1, 'search panel'],
  ['#resultsPanel', 1, 'results panel'],
  ['#namesPanel', 1, 'names panel'],
  ['#name1', 1, 'speaker 1 input'],
  ['#searchBtn', 1, 'search button'],
  ['#resultsContainer', 1, 'results container'],
];

for (const [selector, expected, label] of checks) {
  const found = document.querySelectorAll(selector).length;
  if (found !== expected) fail(`expected ${expected} ${label}, found ${found}`);
}

const dropdowns = document.querySelectorAll('#suggestions1').length;
if (dropdowns !== 1) fail(`expected a single suggestions dropdown, found ${dropdowns}`);

if (document.querySelector('.boot-fallback')) fail('the loading fallback was never replaced');
if (!document.getElementById('searchPanel').classList.contains('active-panel')) {
  fail('the Search tab is not active on boot');
}

const start = document.getElementById('startDate').value;
const end = document.getElementById('endDate').value;
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
  fail(`date pickers not seeded (start=${start}, end=${end})`);
}

// The manifest has to be relative to survive being served from any base path.
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', rootUrl), 'utf8'));
if (manifest.icons?.some((icon) => icon.src.startsWith('/'))) {
  fail('manifest icons use absolute paths — the app would break under a subpath');
}

console.log('✓ published root build boots and renders the app');
console.log(`  tabs: ${[...document.querySelectorAll('.tab-btn')].map((t) => t.textContent).join(' · ')}`);
console.log(`  date range: ${start} → ${end}`);
console.log(`  bundle: ${bundleName} (${(code.length / 1024).toFixed(1)} kB)`);
console.log(`  stylesheet: ${styleHref}`);
