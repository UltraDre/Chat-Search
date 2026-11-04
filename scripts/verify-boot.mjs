/**
 * Boot smoke test for the production build.
 *
 * Loads dist/index.html into a real DOM (jsdom) and executes the built bundle,
 * then asserts the app shell rendered. Catches "blank page" regressions that
 * type checks and unit tests can miss (bad import, boot-time throw, etc.).
 *
 *   npm run build && node scripts/verify-boot.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const distUrl = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', distUrl), 'utf8');
const assets = readdirSync(new URL('assets/', distUrl));
const bundleName = assets.find((file) => /^index-.*\.js$/.test(file));
if (!bundleName) throw new Error('no built JS bundle found in dist/assets');

const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/, ''), {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});

const { window } = dom;
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// The built bundle is a single self-contained script (no imports), so it can be
// evaluated directly in the page's global scope.
const code = readFileSync(new URL(`assets/${bundleName}`, distUrl), 'utf8');
window.eval(code);

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const document = window.document;
const app = document.querySelector('#app .app');
if (!app) fail('the app shell did not render (#app .app missing) — page would be blank');

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

const duplicateDropdowns = document.querySelectorAll('#suggestions1').length;
if (duplicateDropdowns !== 1) fail(`expected a single suggestions dropdown, found ${duplicateDropdowns}`);

if (document.querySelector('.boot-fallback')) fail('the loading skeleton was never replaced');
if (!document.getElementById('searchPanel').classList.contains('active-panel')) {
  fail('the Search tab is not active on boot');
}

const start = document.getElementById('startDate').value;
const end = document.getElementById('endDate').value;
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
  fail(`date pickers not seeded (start=${start}, end=${end})`);
}

console.log('✓ production bundle boots and renders the app');
console.log(`  tabs: ${[...document.querySelectorAll('.tab-btn')].map((t) => t.textContent).join(' · ')}`);
console.log(`  date range: ${start} → ${end}`);
console.log(`  bundle: assets/${bundleName} (${(code.length / 1024).toFixed(1)} kB)`);
