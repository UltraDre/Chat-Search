// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { parseLog } from '../src/lib/parser';
import { resetState, setFile } from '../src/state';

const LOG = [
  '[15/07/2025, 23:11:51] Samuel: Hey Ada',
  '[15/07/2025, 23:12:03] Ada: hello Samuel',
  '[16/07/2025, 09:00:00] Samuel: meeting at 10',
  'carried on to a second line',
  '[17/07/2025, 18:30:00] Ada: budget approved',
].join('\n');

function boot() {
  document.body.innerHTML = '<div id="app"></div>';
  createApp(document.getElementById('app')!);
  return document;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function loadLog() {
  // Mirrors what loadFile() does once the FileReader resolves, including the
  // range auto-fit (the fixture log predates today).
  const { messages } = parseLog(LOG);
  setFile('chat.txt', LOG, messages);
  $('fileName').textContent = 'chat.txt';
  $<HTMLInputElement>('startDate').value = '2025-07-15';
  $<HTMLInputElement>('endDate').value = '2025-07-17';
}

function setDate(id: string, iso: string) {
  const el = $<HTMLInputElement>(id);
  el.value = iso;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  localStorage.clear();
  resetState();
  vi.useRealTimers();
});

describe('app shell', () => {
  it('renders all three tabs with Search active', () => {
    boot();
    const tabs = [...document.querySelectorAll('.tab-btn')].map((t) => t.textContent);
    expect(tabs).toEqual(['Search', 'Results', 'Names']);
    expect($('searchPanel').classList.contains('active-panel')).toBe(true);
    expect($('resultsPanel').classList.contains('active-panel')).toBe(false);
  });

  it('defaults the range to the last year and ends today', () => {
    boot();
    const today = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect($<HTMLInputElement>('endDate').value).toBe(iso(today));
    expect($<HTMLInputElement>('startDate').value).toBe(iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())));
  });

  it('shows the empty results state and zero count', () => {
    boot();
    expect($('resultsContainer').textContent).toContain('upload a log');
    expect($('resultCountBadge').textContent).toBe('0 messages');
    expect($('parseStats').textContent).toBe('no file');
  });
});

describe('searching', () => {
  it('explains that a log is required before searching', () => {
    boot();
    $('name1').focus();
    $<HTMLInputElement>('name1').value = 'Samuel';
    $('searchBtn').click();
    expect($('resultsPanel').classList.contains('active-panel')).toBe(true);
    expect($('resultsContainer').textContent).toContain('upload a valid chat log first');
  });

  it('renders bubbles, a date divider and the count', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Samuel';
    $<HTMLInputElement>('name2').value = 'Ada';
    setDate('startDate', '2025-07-15');
    setDate('endDate', '2025-07-17');
    $('searchBtn').click();

    expect($('resultsPanel').classList.contains('active-panel')).toBe(true);
    expect($('resultCountBadge').textContent).toBe('4 messages');
    expect(document.querySelectorAll('.msg-wrapper')).toHaveLength(4);
    expect(document.querySelectorAll('.date-divider')).toHaveLength(3);
    expect(document.querySelectorAll('.msg-wrapper.sent')).toHaveLength(2);
    expect($('mainFooter').classList.contains('hide-footer')).toBe(true);
  });

  it('shows continuation lines inside the same bubble', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Samuel';
    setDate('startDate', '2025-07-15');
    setDate('endDate', '2025-07-16');
    $('searchBtn').click();
    const bubbles = [...document.querySelectorAll('.msg-text')].map((b) => b.innerHTML);
    // The wrapped line lives in the same bubble as "meeting at 10", after a <br>.
    expect(bubbles.some((html) => html.includes('meeting at 10<br>carried on to a second line'))).toBe(true);
  });

  it('reports when nothing matches', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Nobody';
    $('searchBtn').click();
    expect($('resultsContainer').textContent).toContain('no matches');
  });

  it('rejects an inverted date range before searching', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Samuel';
    setDate('startDate', '2025-07-17');
    setDate('endDate', '2025-07-15');
    $('searchBtn').click();
    expect($('resultsContainer').textContent).toMatch(/annot be after/);
  });

  it('submits on Enter', () => {
    boot();
    loadLog();
    const input = $<HTMLInputElement>('name1');
    input.value = 'Ada';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelectorAll('.msg-wrapper').length).toBeGreaterThan(0);
  });
});

describe('selection and delete', () => {
  it('shows the delete button only once something is selected', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Ada';
    $('searchBtn').click();

    const btn = $<HTMLButtonElement>('deleteSelectedBtn');
    expect(btn.classList.contains('visible')).toBe(false);

    const box = document.querySelector<HTMLInputElement>('.msg-select')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(btn.classList.contains('visible')).toBe(true);
    expect(btn.textContent).toContain('(1)');
  });

  it('removes selected messages from this view only (search brings them back)', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Ada';
    $('searchBtn').click();
    expect(document.querySelectorAll('.msg-wrapper')).toHaveLength(2);

    const box = document.querySelector<HTMLInputElement>('.msg-select')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    $('deleteSelectedBtn').click();

    expect(document.querySelectorAll('.msg-wrapper')).toHaveLength(1);
    expect($('resultCountBadge').textContent).toBe('1 message');
    expect(document.querySelector<HTMLInputElement>('.msg-select')!.checked).toBe(false);

    // Original behaviour: the log itself is untouched, a new search restores both.
    $('searchBtn').click();
    expect(document.querySelectorAll('.msg-wrapper')).toHaveLength(2);
  });
});

describe('names tab', () => {
  it('remembers searched speakers and can forget them', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Samuel';
    $<HTMLInputElement>('name2').value = 'Ada';
    $('searchBtn').click();

    ([...document.querySelectorAll('.tab-btn')].find((b) => b.textContent === 'Names') as HTMLButtonElement).click();
    expect($('namesPanel').classList.contains('active-panel')).toBe(true);
    expect($('namesCount').textContent).toBe('2 names');
    expect(document.querySelectorAll('.name-row')).toHaveLength(2);
    expect($('mainFooter').classList.contains('hide-footer')).toBe(false);

    document.querySelector<HTMLButtonElement>('.name-delete-btn')!.click();
    expect($('namesCount').textContent).toBe('1 name');

    const stored = JSON.parse(localStorage.getItem('log-search:names') ?? '[]');
    expect(stored).toHaveLength(1);
  });

  it('preserves spaces and special characters in searched suggestions and picks', () => {
    boot();
    loadLog();
    const input = $<HTMLInputElement>('name1');
    input.value = 'adex ea';
    $('searchBtn').click();
    expect(JSON.parse(localStorage.getItem('log-search:names')!)).toContain('adex ea');

    // Reload the saved names, then use the suggestion in either field.
    resetState();
    document.body.innerHTML = '<div id="app"></div>';
    createApp(document.getElementById('app')!);
    const second = $<HTMLInputElement>('name2');
    second.value = 'a';
    second.dispatchEvent(new Event('input', { bubbles: true }));
    const item = document.querySelector<HTMLElement>('#suggestions2 .suggestion-item')!;
    expect(item.textContent).toBe('adex ea');
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(second.value).toBe('adex ea');
    expect(JSON.parse(localStorage.getItem('log-search:names')!)).toEqual(['adex ea']);
  });

  it('renders literal percent signs, unicode and HTML-like text safely', () => {
    localStorage.setItem('log-search:names', JSON.stringify(['A 100% <img src=x> é', 'A%20literal']));
    resetState();
    boot();
    const input = $<HTMLInputElement>('name1');
    input.value = 'A';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const items = [...document.querySelectorAll<HTMLElement>('#suggestions1 .suggestion-item')];
    expect(items.map((item) => item.textContent)).toEqual(['A 100% <img src=x> é', 'A%20literal']);
    expect($('suggestions1').querySelector('img')).toBeNull();
    expect(items[0].querySelector('.highlight')?.textContent).toBe('A');
    items[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(input.value).toBe('A 100% <img src=x> é');
  });

  it('offers prefix suggestions while typing', () => {
    boot();
    localStorage.setItem('log-search:names', JSON.stringify(['Samuel', 'Samantha', 'Ada']));
    resetState(); // reloads the saved speaker list, like a fresh visit
    document.body.innerHTML = '<div id="app"></div>';
    createApp(document.getElementById('app')!);

    const input = $<HTMLInputElement>('name1');
    input.value = 'Sam';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const items = [...document.querySelectorAll('#suggestions1 .suggestion-item')].map((i) => i.textContent);
    expect(items).toEqual(['Samantha', 'Samuel']);
    expect($('suggestions1').style.display).toBe('block');

    document.querySelector<HTMLElement>('#suggestions1 .suggestion-item')!.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    expect(input.value).toBe('Samantha');
  });
});

describe('persistence', () => {
  it('restores file, filters and tab after a reload', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Samuel';
    $('searchBtn').click();

    // Flush the debounced save, then rebuild the app like a fresh page load.
    vi.useFakeTimers();
    window.dispatchEvent(new Event('beforeunload'));
    vi.useRealTimers();

    const raw = localStorage.getItem('log-search:state');
    expect(raw).toBeTruthy();

    document.body.innerHTML = '<div id="app"></div>';
    createApp(document.getElementById('app')!);

    expect($<HTMLInputElement>('name1').value).toBe('Samuel');
    expect($('resultCountBadge').textContent).toBe('2 messages');
    expect($('resultsPanel').classList.contains('active-panel')).toBe(true);
    expect($('restoreIndicator').style.display).toBe('inline-block');
    expect($('fileName').textContent).toBe('chat.txt');
  });

  it('clears everything when the file is cleared', () => {
    boot();
    loadLog();
    $<HTMLInputElement>('name1').value = 'Samuel';
    $('searchBtn').click();

    $('clearFileBtn').click();
    expect($('fileName').textContent).toBe('none');
    expect($('parseStats').textContent).toBe('no file');
    expect($<HTMLInputElement>('name1').value).toBe('');
    expect($('searchPanel').classList.contains('active-panel')).toBe(true);
    expect(localStorage.getItem('log-search:state')).toBeNull();
  });
});

describe('mobile zoom guards', () => {
  it('keeps every focusable field at 16px or more', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/styles.css', 'utf8');
    expect(css).toMatch(/input,\s*select,\s*textarea\s*\{\s*font-size: 16px;/);
    expect(css).not.toMatch(/input[^{]*\{[^}]*font-size:\s*0?\.\d+rem/);
  });
});
