import type { Message, ParseResult } from './types';

/** Unicode spaces WhatsApp likes to sprinkle into exports. */
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/** "[15/07/2025, 23:11:51] Speaker: text" — the bracket export. */
const HEADER_BRACKET =
  /^\[(\d{1,3}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?)\]\s*([^:]{1,80}?):\s?([\s\S]*)$/i;

/** "6/6/26, 22:16 - Speaker: text" — the legacy export. */
const HEADER_DASH =
  /^(\d{1,3}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?)\s*[-\u2013\u2014]\s*([^:]{1,80}?):\s?([\s\S]*)$/i;

const DAY_MS = 86_400_000;

function normalise(line: string): string {
  return line.replace(ODD_SPACES, ' ');
}

/** Parses a header-ish date into UTC midnight. Returns null when invalid. */
function toDayTimestamp(dateStr: string, monthFirst: boolean): number | null {
  const parts = dateStr.split(/[\/.\-]/);
  if (parts.length !== 3) return null;
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  const rawYear = parseInt(parts[2], 10);
  if (isNaN(a) || isNaN(b) || isNaN(rawYear)) return null;
  const year = parts[2].length <= 2 ? 2000 + rawYear : rawYear;
  const day = monthFirst ? b : a;
  const month = monthFirst ? a : b;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > 2200) return null;
  const ts = Date.UTC(year, month - 1, day);
  const asDate = new Date(ts);
  if (asDate.getUTCDate() !== day || asDate.getUTCMonth() !== month - 1) return null;
  return ts;
}

/** Parses a header-ish time into seconds since midnight. Returns null when invalid. */
function toSecondsOfDay(timeStr: string): number | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?m?\.?$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const seconds = m[3] ? parseInt(m[3], 10) : 0;
  const meridiem = (m[4] || '').toLowerCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = hours % 12 + (meridiem === 'p' ? 12 : 0);
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

interface Header {
  rawDate: string;
  rawTime: string;
  speaker: string;
  body: string;
  dayTimestamp: number;
  seconds: number;
}

function parseHeader(line: string): Header | null {
  const cleaned = normalise(line);

  // Bracket format: dd/mm/yyyy, day-first.
  let m = cleaned.match(HEADER_BRACKET);
  let monthFirst = false;
  if (!m) {
    // Legacy format: m/d/yy, month-first.
    m = cleaned.match(HEADER_DASH);
    monthFirst = true;
  }
  if (!m) return null;

  const [, dateStr, timeStr, rawSpeaker, body] = m;
  const speaker = rawSpeaker.replace(/^~\s*/, '').trim();
  if (!speaker) return null;

  const dayTimestamp = toDayTimestamp(dateStr, monthFirst);
  if (dayTimestamp === null) return null;
  const seconds = toSecondsOfDay(timeStr);
  if (seconds === null) return null;

  return {
    rawDate: dateStr,
    rawTime: timeStr.trim(),
    speaker,
    body,
    dayTimestamp,
    seconds,
  };
}

/** Hashing keeps message ids short and stable across reloads. */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/**
 * Parses a whole export. Continuation lines (multi-line messages, empty lines,
 * system notices) are appended to the message above them, mirroring WhatsApp.
 */
export function parseLog(text: string): ParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const drafts: { header: Header; body: string[] }[] = [];
  let current: { header: Header; body: string[] } | null = null;
  let rejected = 0;

  for (const line of lines) {
    const header = parseHeader(line);
    if (header) {
      if (current) drafts.push(current);
      current = { header, body: [header.body] };
      continue;
    }
    // A line shaped like a header that failed validation (bad date/time/speaker).
    if (!header && /^[\[~]?\s*\d{1,3}[\/.\-]\d{1,2}[\/.\-]\d{1,4}/.test(normalise(line).trim())) {
      rejected++;
    }
    if (current) current.body.push(line);
  }
  if (current) drafts.push(current);

  const seen = new Map<string, number>();
  const messages: Message[] = drafts.map(({ header, body }) => {
    const message = body.join('\n').replace(/\s+$/, '');
    const day = new Date(header.dayTimestamp);
    const displayDate = `${String(day.getUTCDate()).padStart(2, '0')}/${String(day.getUTCMonth() + 1).padStart(2, '0')}/${day.getUTCFullYear()}`;
    const base = `${header.speaker}|${header.rawDate}|${header.rawTime}|${message}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);

    return {
      id: `${hash(base)}${nth ? `-${nth}` : ''}`,
      rawDate: header.rawDate,
      rawTime: header.rawTime,
      speaker: header.speaker,
      speakerLower: header.speaker.toLowerCase(),
      message,
      dayTimestamp: header.dayTimestamp,
      fullTimestamp: header.dayTimestamp + header.seconds * 1000,
      displayDate,
      displayTime: header.rawTime,
    };
  });

  messages.sort((a, b) => a.fullTimestamp - b.fullTimestamp || a.id.localeCompare(b.id));
  return { messages, rejected };
}

/** Groups messages by their UTC day, preserving chronological order. */
export function groupByDay(messages: Message[]): { key: string; timestamp: number; messages: Message[] }[] {
  const groups = new Map<string, Message[]>();
  for (const msg of messages) {
    const key = `${msg.dayTimestamp}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(msg);
    else groups.set(key, [msg]);
  }
  return [...groups.entries()]
    .map(([key, msgs]) => ({ key, timestamp: Number(key), messages: msgs }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export { DAY_MS };
