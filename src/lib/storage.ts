import { dmyToIso, isoToDmy } from './dates';
import type { TabId } from './types';

export const STATE_KEY = 'log-search:state';
export const NAMES_KEY = 'log-search:names';
export const NAMES_MIGRATION_KEY = 'log-search:names-migrated';

/** Everything the app remembers between visits. */
export interface PersistedState {
  version: 2;
  /** Raw text of the uploaded log, so the session survives a reload. */
  fileContent: string | null;
  fileName: string | null;
  name1: string;
  name2: string;
  startDate: string; // dd/mm/yyyy (as in the old build)
  endDate: string;
  searchText: string;
  selectedIds: string[];
  activeTab: TabId;
  savedAt: number;
}

/** Keys used by the previous single-file build, imported once. */
const LEGACY_STATE_KEY = 'edge_searcher_state';
const LEGACY_NAMES_KEY = 'speaker_suggestions';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadState(): PersistedState | null {
  const state = readJson<PersistedState>(STATE_KEY);
  if (!state || typeof state !== 'object') return null;
  return state;
}

export function saveState(state: PersistedState): boolean {
  return writeJson(STATE_KEY, { ...state, savedAt: Date.now() });
}

export function clearState(): void {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function loadNames(): string[] {
  const names = readJson<string[]>(NAMES_KEY);
  if (!Array.isArray(names)) return [];
  return names.filter((n): n is string => typeof n === 'string' && n.trim() !== '');
}

export function saveNames(names: string[]): void {
  writeJson(NAMES_KEY, names);
}

/** Pulls names and search state out of the old build once, then forgets about it. */
export function migrateLegacy(): { names: string[]; state: PersistedState | null } {
  const already = (() => {
    try {
      return localStorage.getItem(NAMES_MIGRATION_KEY) === '1';
    } catch {
      return true;
    }
  })();

  const legacyNames = readJson<string[]>(LEGACY_NAMES_KEY) ?? [];
  const names = already ? [] : legacyNames.filter((n) => typeof n === 'string' && n.trim() !== '');

  let state: PersistedState | null = null;
  if (!already) {
    const legacy = readJson<{
      fileContent?: string | null;
      fileName?: string | null;
      name1?: string;
      name2?: string;
      startDate?: string;
      endDate?: string;
      searchText?: string;
      selectedIds?: string[];
      activeTab?: TabId;
    }>(LEGACY_STATE_KEY);

    if (legacy && (legacy.fileContent || legacy.name1 || legacy.searchText)) {
      state = {
        version: 2,
        fileContent: legacy.fileContent ?? null,
        fileName: legacy.fileName ?? null,
        name1: legacy.name1 ?? '',
        name2: legacy.name2 ?? '',
        // Old build stored ISO dates; keep whatever shape it used.
        startDate: legacy.startDate?.includes('-') ? isoToDmy(legacy.startDate) : legacy.startDate ?? '',
        endDate: legacy.endDate?.includes('-') ? isoToDmy(legacy.endDate) : legacy.endDate ?? '',
        searchText: legacy.searchText ?? '',
        selectedIds: Array.isArray(legacy.selectedIds) ? legacy.selectedIds : [],
        activeTab: legacy.activeTab ?? 'search',
        savedAt: Date.now(),
      };
    }
  }

  try {
    localStorage.setItem(NAMES_MIGRATION_KEY, '1');
  } catch {
    /* ignore */
  }

  return { names, state };
}

export { dmyToIso, isoToDmy };
