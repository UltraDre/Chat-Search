import { TEMPLATE } from './ui/template';
import { $, $opt, on, setFooterVisible } from './ui/dom';
import { attachSuggestions, mountDropdown } from './ui/suggestions';
import { renderEmpty, renderResults, syncSelection } from './ui/results';
import { renderNames } from './ui/names';
import { parseLog } from './lib/parser';
import { searchMessages } from './lib/search';
import { dmyToIso, isoToTimestamp, timestampToIso, todayIso } from './lib/dates';
import { loadState } from './lib/storage';
import type { TabId } from './lib/types';
import {
  clearFile,
  forgetSpeaker,
  notify,
  persist,
  rememberSpeaker,
  setFile,
  state,
  subscribe,
} from './state';
import { initInstallPrompt } from './pwa';

interface Form {
  name1: string;
  name2: string;
  startDate: string;
  endDate: string;
  searchText: string;
}

/** Mounts the whole app into #app. */
export function createApp(root: HTMLElement): void {
  root.innerHTML = TEMPLATE;

  const el = {
    fileInput: $<HTMLInputElement>('fileInput'),
    uploadBtn: $<HTMLButtonElement>('uploadBtn'),
    clearFileBtn: $<HTMLButtonElement>('clearFileBtn'),
    fileName: $('fileName'),
    parseStats: $('parseStats'),
    restoreBadge: $('restoreIndicator'),
    name1: $<HTMLInputElement>('name1'),
    name2: $<HTMLInputElement>('name2'),
    startDate: $<HTMLInputElement>('startDate'),
    endDate: $<HTMLInputElement>('endDate'),
    searchText: $<HTMLInputElement>('searchText'),
    searchBtn: $<HTMLButtonElement>('searchBtn'),
    results: $('resultsContainer'),
    resultCount: $('resultCountBadge'),
    deleteBtn: $<HTMLButtonElement>('deleteSelectedBtn'),
    namesList: $('namesList'),
    namesCount: $('namesCount'),
    tabButtons: [...document.querySelectorAll<HTMLButtonElement>('.tab-btn')],
    panels: [...document.querySelectorAll<HTMLElement>('.tab-panel')],
  };

  // The markup already ships the dropdown shells; mount them idempotently.
  const suggestions1 = mountDropdown(el.name1.parentElement!, 'suggestions1');
  const suggestions2 = mountDropdown(el.name2.parentElement!, 'suggestions2');

  let restoreInProgress = false;

  const form = (): Form => ({
    name1: el.name1.value,
    name2: el.name2.value,
    startDate: el.startDate.value,
    endDate: el.endDate.value,
    searchText: el.searchText.value,
  });

  /**
   * Which picker the user last touched. Once they pick a date by hand we stop
   * auto-fitting the range to the log.
   */
  let lastDateTouched: 'start' | 'end' | null = null;

  /**
   * The log usually predates today, so a "today → today" default would return
   * nothing. On upload, fit the range to the whole file instead.
   */
  function fitRangeToLog(): void {
    if (!state.messages.length || lastDateTouched) return;
    let oldest = Infinity;
    let newest = -Infinity;
    for (const msg of state.messages) {
      if (msg.dayTimestamp < oldest) oldest = msg.dayTimestamp;
      if (msg.dayTimestamp > newest) newest = msg.dayTimestamp;
    }
    el.startDate.value = timestampToIso(oldest);
    el.endDate.value = timestampToIso(newest);
  }

  /* ── persistence ────────────────────────────────────────────────────── */

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const save = (): void => {
    if (restoreInProgress) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(form()), 120);
  };

  /* ── tabs ───────────────────────────────────────────────────────────── */

  function switchTab(tab: TabId, saveTab = true): void {
    state.activeTab = tab;
    el.panels.forEach((panel) => panel.classList.toggle('active-panel', panel.id === `${tab}Panel`));
    el.tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.tabIndex = isActive ? 0 : -1;
    });
    setFooterVisible(tab !== 'results');
    if (tab === 'results') updateDeleteButton();
    if (tab === 'names') renderNamesView();
    if (saveTab) save();
  }

  el.tabButtons.forEach((btn) => {
    btn.setAttribute('role', 'tab');
    on(btn, 'click', () => switchTab((btn.dataset.tab as TabId) ?? 'search'));
  });

  // Announce result counts to screen readers without stealing focus.
  el.resultCount.setAttribute('aria-live', 'polite');
  el.parseStats.setAttribute('aria-live', 'polite');

  /* ── header / badges ────────────────────────────────────────────────── */

  /** Fresh install: last ~year, so any recent log matches out of the box. */
  function defaultRange(): void {
    const now = new Date();
    el.startDate.value = todayIso(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
    el.endDate.value = todayIso(now);
  }

  function updateStats(): void {
    if (!state.messages.length) {
      el.parseStats.textContent = state.fileName ? '0 messages' : 'no file';
      return;
    }
    el.parseStats.textContent = `${state.messages.length} msgs`;
  }

  function updateResultCount(count: number): void {
    el.resultCount.textContent = `${count} message${count === 1 ? '' : 's'}`;
  }

  function updateDeleteButton(): void {
    const count = state.selected.size;
    el.deleteBtn.classList.toggle('visible', count > 0);
    el.deleteBtn.disabled = count === 0;
    el.deleteBtn.textContent = count > 0 ? `🗑 Delete selected (${count})` : '🗑 Delete selected';
  }

  function renderNamesView(): void {
    renderNames(el.namesList, el.namesCount, state, (name) => {
      forgetSpeaker(name);
      renderNamesView();
      notify();
    });
  }

  /* ── results rendering ──────────────────────────────────────────────── */

  function paintResults(): void {
    const speaker1 = el.name1.value.trim();
    const speaker2 = el.name2.value.trim();
    const keyword = el.searchText.value.trim();

    if (!state.results.length) return;

    renderResults(el.results, state.results, {
      speaker1,
      speaker2,
      keyword,
      selected: state.selected,
      onToggle: (msg, isSelected) => {
        if (isSelected) state.selected.add(msg.id);
        else state.selected.delete(msg.id);
        updateDeleteButton();
        save();
      },
    });
    updateResultCount(state.results.length);
    updateDeleteButton();
  }

  /**
   * Re-colours matches while the user edits a speaker or keyword. Debounced and
   * capped so a 10k-message result set never fights the keyboard.
   */
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;
  function repaintHighlights(): void {
    if (!state.results.length || state.results.length > 400) return;
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      paintResults();
      syncSelection(el.results, state.selected);
    }, 200);
  }

  /* ── search ─────────────────────────────────────────────────────────── */

  function runSearch(): void {
    if (!state.visibleMessages.length) {
      renderEmpty(
        el.results,
        state.fileName ? 'no valid messages in this file' : 'upload a valid chat log first',
        'supports [dd/mm/yyyy, HH:MM:SS] Speaker: text or m/d/yy, HH:MM - Speaker: text',
      );
      updateResultCount(0);
      switchTab('results');
      return;
    }

    const n1 = el.name1.value.trim();
    const n2 = el.name2.value.trim();
    const keyword = el.searchText.value.trim();

    if (n1) rememberSpeaker(n1);
    if (n2) rememberSpeaker(n2);

    const fromIso = el.startDate.value;
    const toIso = el.endDate.value;
    const from = fromIso ? isoToTimestamp(fromIso) : null;
    const to = toIso ? isoToTimestamp(toIso) : null;

    if (fromIso && from === null) return fail('invalid “from” date · use the date picker');
    if (toIso && to === null) return fail('invalid “to” date · use the date picker');

    const { messages, error } = searchMessages(state.visibleMessages, {
      speaker1: n1,
      speaker2: n2,
      keyword,
      from,
      to,
    });

    if (error) return fail(error);

    state.results = messages;
    state.selected.clear();

    if (!messages.length) {
      renderEmpty(el.results, 'no matches · adjust filters', 'deleted messages are removed from this view only');
      updateResultCount(0);
      updateDeleteButton();
    } else {
      paintResults();
    }

    renderNamesView();
    switchTab('results');
  }

  function fail(message: string): void {
    renderEmpty(el.results, message);
    updateResultCount(0);
    updateDeleteButton();
    switchTab('results');
  }

  /* ── file handling ──────────────────────────────────────────────────── */

  function loadFile(file: File): void {
    el.fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      const { messages, rejected } = parseLog(content);
      setFile(file.name, content, messages);
      fitRangeToLog();
      el.fileName.textContent = file.name;
      el.restoreBadge.style.display = 'inline-block';
      updateStats();

      if (messages.length) {
        renderEmpty(
          el.results,
          `${messages.length} messages loaded`,
          rejected ? `${rejected} invalid line${rejected === 1 ? '' : 's'} skipped · enter a speaker or keyword → search` : 'enter a speaker or date → search',
        );
      } else {
        renderEmpty(
          el.results,
          'no valid messages found',
          'check format: [dd/mm/yyyy, HH:MM:SS] Speaker: text or m/d/yy, HH:MM - Speaker: text',
        );
      }
      updateResultCount(0);
      updateDeleteButton();
      save();
    };
    reader.onerror = () => {
      renderEmpty(el.results, 'could not read that file', 'try a plain .txt export');
      resetFile();
    };
    reader.readAsText(file, 'UTF-8');
  }

  function resetFile(): void {
    clearFile();
    el.fileName.textContent = 'none';
    el.fileInput.value = '';
    el.restoreBadge.style.display = 'none';
    updateStats();
    renderEmpty(el.results, 'upload a log · search → results appear here', 'select messages with checkboxes · delete selected');
    updateResultCount(0);
    updateDeleteButton();
  }

  function clearEverything(): void {
    resetFile();
    el.name1.value = '';
    el.name2.value = '';
    el.searchText.value = '';
    lastDateTouched = null;
    defaultRange();
    suggestions1.style.display = 'none';
    suggestions2.style.display = 'none';
    renderEmpty(el.results, 'file cleared · upload a new log');
    switchTab('search');
  }

  /**
   * Removes the selection from the current results only, exactly like the
   * original build: running a new search brings the messages back.
   */
  function removeSelected(): void {
    if (!state.selected.size) return;
    const doomed = state.selected;
    state.results = state.results.filter((m) => !doomed.has(m.id));
    state.selected.clear();

    if (state.results.length) paintResults();
    else renderEmpty(el.results, 'nothing left in this view · search again');

    updateResultCount(state.results.length);
    updateDeleteButton();
    save();
  }

  /* ── restore ────────────────────────────────────────────────────────── */

  function restore(): boolean {
    const saved = loadState();
    if (!saved) return false;

    restoreInProgress = true;
    try {
      if (saved.name1) {
        el.name1.value = saved.name1;
        rememberSpeaker(saved.name1);
      }
      if (saved.name2) {
        el.name2.value = saved.name2;
        rememberSpeaker(saved.name2);
      }
      if (saved.startDate) {
        const iso = dmyToIso(saved.startDate);
        if (iso) el.startDate.value = iso;
      }
      if (saved.endDate) {
        const iso = dmyToIso(saved.endDate);
        if (iso) el.endDate.value = iso;
      }
      el.searchText.value = saved.searchText ?? '';

      if (saved.fileContent && saved.fileName) {
        const { messages } = parseLog(saved.fileContent);
        if (messages.length) {
          setFile(saved.fileName, saved.fileContent, messages);
          el.fileName.textContent = saved.fileName;
          el.restoreBadge.style.display = 'inline-block';
          updateStats();

          const restoredSelection = new Set((saved.selectedIds ?? []).filter((id) => messages.some((m) => m.id === id)));
          state.selected = restoredSelection;

          if (el.name1.value.trim() || el.searchText.value.trim()) {
            const from = el.startDate.value ? isoToTimestamp(el.startDate.value) : null;
            const to = el.endDate.value ? isoToTimestamp(el.endDate.value) : null;
            const { messages: hits } = searchMessages(state.visibleMessages, {
              speaker1: el.name1.value,
              speaker2: el.name2.value,
              keyword: el.searchText.value,
              from,
              to,
            });
            state.visibleMessages = messages;
            state.results = hits;
            if (hits.length) paintResults();
            else renderEmpty(el.results, 'no matches · adjust filters');
          } else {
            renderEmpty(
              el.results,
              `${messages.length} messages restored`,
              'enter a speaker or keyword → search',
            );
          }
        } else {
          el.fileName.textContent = `${saved.fileName} (invalid)`;
          updateStats();
        }
      }

      if (saved.activeTab) switchTab(saved.activeTab, false);
      return true;
    } finally {
      restoreInProgress = false;
    }
  }

  /* ── events ─────────────────────────────────────────────────────────── */

  on(el.uploadBtn, 'click', () => el.fileInput.click());
  on(el.fileInput, 'change', () => {
    const file = el.fileInput.files?.[0];
    if (file) loadFile(file);
    else resetFile();
  });
  on(el.clearFileBtn, 'click', clearEverything);
  on(el.searchBtn, 'click', runSearch);
  on(el.deleteBtn, 'click', removeSelected);

  // Touch devices: tapping a bubble toggles its checkbox (mouse users keep
  // normal text selection).
  if (window.matchMedia?.('(hover: none)').matches) {
    on(el.results, 'click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.msg-select')) return;
      const row = target.closest<HTMLElement>('.msg-wrapper');
      const box = row?.querySelector<HTMLInputElement>('.msg-select');
      if (!row || !box) return;
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  for (const [field, key] of [
    [el.name1, 'name1'],
    [el.name2, 'name2'],
    [el.startDate, 'start'],
    [el.endDate, 'end'],
    [el.searchText, 'keyword'],
  ] as const) {
    on(field, 'input', () => {
      if (key === 'start' || key === 'end') lastDateTouched = key;
      save();
      if (key !== 'start' && key !== 'end') repaintHighlights();
    });
    on(field, 'keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    });
  }

  attachSuggestions({
    input: el.name1,
    dropdown: suggestions1,
    getNames: () => state.speakers,
    onPick: (name) => {
      rememberSpeaker(name);
      renderNamesView();
    },
    onSubmit: runSearch,
  });

  attachSuggestions({
    input: el.name2,
    dropdown: suggestions2,
    getNames: () => state.speakers,
    onPick: (name) => {
      rememberSpeaker(name);
      renderNamesView();
    },
    onSubmit: runSearch,
  });

  // Keep the chip count live if names change elsewhere.
  subscribe(() => updateStats());
  window.addEventListener('beforeunload', () => persist(form()));

  /* ── boot ───────────────────────────────────────────────────────────── */

  defaultRange();
  const restored = restore();
  renderNamesView();
  updateStats();
  updateDeleteButton();
  if (!restored) {
    renderEmpty(el.results, 'upload a log · search → results appear here', 'select messages with checkboxes · delete selected · auto‑saved');
  }
  switchTab(state.activeTab, false);

  initInstallPrompt($opt<HTMLButtonElement>('installBtn'));
}
