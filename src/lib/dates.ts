/**
 * Date helpers.
 *
 * Everything is computed in UTC on purpose: the log's own dd/mm/yyyy values are
 * compared as calendar days, never shifted by the viewer's timezone.
 */

/** "2026-11-03" -> "03/11/2026" */
export function isoToDmy(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** "03/11/2026" -> "2026-11-03" */
export function dmyToIso(dmy: string): string {
  if (!dmy) return '';
  const parts = dmy.split('/');
  if (parts.length !== 3) return '';
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Local "today" as an ISO yyyy-mm-dd string (date pickers default to this). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** UTC timestamp -> ISO yyyy-mm-dd (for pre-filling date pickers). */
export function timestampToIso(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Seeds empty date pickers with today, leaving any existing value alone. */
export function setDefaultDates(from: HTMLInputElement, to: HTMLInputElement): void {
  const today = todayIso();
  if (!from.value) from.value = today;
  if (!to.value) to.value = today;
}

/** `dd/mm/yyyy` at UTC midnight, or null when invalid. */
export function parseDateDMY(value: string): number | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  // Reject rollovers such as 31/02.
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1) return null;
  return t;
}

/** `mm/dd/yy` (2000-based) at UTC midnight, or null when invalid. */
export function parseDateMDY(value: string): number | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const mo = parseInt(m[1], 10);
  const d = parseInt(m[2], 10);
  const yy = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(2000 + yy, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1) return null;
  return t;
}

/** Accepts either log format's date. */
export function parseDateUniversal(value: string): number | null {
  return parseDateDMY(value) ?? parseDateMDY(value);
}

/** "2026-11-03" -> UTC midnight, or null. */
export function isoToTimestamp(iso: string): number | null {
  return iso ? parseDateDMY(isoToDmy(iso)) : null;
}

/** Stable yyyy-mm-dd key for grouping messages by day (UTC). */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** "Today" / "Yesterday" / "03/11/2026" for a UTC day timestamp. */
export function formatDateDivider(timestamp: number, now: Date = new Date()): string {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const DAY = 86_400_000;
  if (timestamp === today) return 'Today';
  if (timestamp === today - DAY) return 'Yesterday';
  const d = new Date(timestamp);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** Normalise "9:5" / "09:05:11" to "HH:MM". */
export function shortTime(rawTime: string): string {
  const [hh = '00', mm = '00'] = (rawTime || '').split(':');
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
}
