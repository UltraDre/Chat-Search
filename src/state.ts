import type { Message, TabId } from './lib/types';
import {
  clearState as clearPersistedState,
  loadNames,
  loadState,
  saveNames,
  saveState as persistState,
  type PersistedState,
} from './lib/storage';
import { dmyToIso, isoToDmy } from './lib/dates';

/** Everything the tabs read from. One object, mutated in place, persisted lazily. */
export interface AppState {
  fileContent: string | null;
  fileName: string | null;
  messages: Message[];
  /** Messages left after "delete selected" — the working set for searches. */
  visibleMessages: Message[];
  results: Message[];
  selected: Set<string>;
  speakers: string[];
  activeTab: TabId;
}

export const state: AppState = {
  fileContent: null,
  fileName: null,
  messages: [],
  visibleMessages: [],
  results: [],
  selected: new Set(),
  speakers: loadNames(),
  activeTab: 'search',
};

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribes to state changes (used to re-sync the UI after mutations). */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(): void {
  for (const listener of listeners) listener();
}

/* ── file ─────────────────────────────────────────────────────────────── */

export function setFile(name: string, content: string, messages: Message[]): void {
  state.fileName = name;
  state.fileContent = content;
  state.messages = messages;
  state.visibleMessages = messages;
  state.results = [];
  state.selected.clear();
  notify();
}

export function clearFile(): void {
  state.fileName = null;
  state.fileContent = null;
  state.messages = [];
  state.visibleMessages = [];
  state.results = [];
  state.selected.clear();
  clearPersistedState();
  notify();
}

export function hasFile(): boolean {
  return state.messages.length > 0;
}

/* ── speakers ─────────────────────────────────────────────────────────── */

export function rememberSpeaker(name: string): boolean {
  const clean = name.trim();
  if (!clean) return false;
  const exists = state.speakers.some((s) => s.toLowerCase() === clean.toLowerCase());
  if (exists) return false;
  state.speakers = [...state.speakers, clean].sort((a, b) => a.localeCompare(b));
  saveNames(state.speakers);
  return true;
}

export function forgetSpeaker(name: string): boolean {
  const next = state.speakers.filter((s) => s !== name);
  if (next.length === state.speakers.length) return false;
  state.speakers = next;
  saveNames(state.speakers);
  return true;
}

/* ── persistence ──────────────────────────────────────────────────────── */

export interface FormSnapshot {
  name1: string;
  name2: string;
  /** ISO yyyy-mm-dd values straight from the date pickers. */
  startDate: string;
  endDate: string;
  searchText: string;
}

export function persist(form: FormSnapshot): void {
  const payload: PersistedState = {
    version: 2,
    fileContent: state.fileContent,
    fileName: state.fileName,
    name1: form.name1,
    name2: form.name2,
    startDate: form.startDate ? isoToDmy(form.startDate) : '',
    endDate: form.endDate ? isoToDmy(form.endDate) : '',
    searchText: form.searchText,
    // Selections are stored as message ids so they survive a reload.
    selectedIds: [...state.selected],
    activeTab: state.activeTab,
    savedAt: Date.now(),
  };
  if (persistState(payload)) return;

  // Quota exceeded: keep the filters and names, drop the (large) log text.
  persistState({ ...payload, fileContent: null });
}

/** Test helper / hard reset: puts the singleton back to a cold start. */
export function resetState(): void {
  state.fileContent = null;
  state.fileName = null;
  state.messages = [];
  state.visibleMessages = [];
  state.results = [];
  state.selected = new Set();
  state.speakers = loadNames();
  state.activeTab = 'search';
}

export function savedSnapshot(): PersistedState | null {
  return loadState();
}

export { dmyToIso, isoToDmy };
