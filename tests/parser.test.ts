import { describe, expect, it } from 'vitest';
import { parseLog, groupByDay } from '../src/lib/parser';

const BRACKET = `[15/07/2025, 23:11:51] Samuel: Hey there
[15/07/2025, 23:12:03] Ada: hello!
[16/07/2025, 09:00:00] Samuel: meeting at 10`;

const LEGACY = `6/6/26, 22:16 - Ada: first
6/6/26, 22:20 - Samuel: second
7/6/26, 08:05 - Ada: third`;

describe('parseLog — bracket format', () => {
  it('reads speaker, date and time', () => {
    const { messages } = parseLog(BRACKET);
    expect(messages).toHaveLength(3);
    expect(messages[0].speaker).toBe('Samuel');
    expect(messages[0].message).toBe('Hey there');
    expect(messages[0].rawTime).toBe('23:11:51');
    expect(new Date(messages[0].dayTimestamp).toISOString()).toBe('2025-07-15T00:00:00.000Z');
  });

  it('orders chronologically and keeps ids unique', () => {
    const { messages } = parseLog(BRACKET);
    expect(messages.map((m) => m.fullTimestamp)).toEqual([...messages.map((m) => m.fullTimestamp)].sort((a, b) => a - b));
    expect(new Set(messages.map((m) => m.id)).size).toBe(messages.length);
  });
});

describe('parseLog — legacy format', () => {
  it('treats the date as month-first with a 2000-based year', () => {
    const { messages } = parseLog(LEGACY);
    expect(messages).toHaveLength(3);
    expect(new Date(messages[0].dayTimestamp).toISOString()).toBe('2026-06-06T00:00:00.000Z');
    expect(new Date(messages[2].dayTimestamp).toISOString()).toBe('2026-07-06T00:00:00.000Z');
  });
});

describe('parseLog — continuation lines', () => {
  it('merges wrapped and empty lines into the message above', () => {
    const raw = `[01/02/2026, 10:00:00] Ada: line one
wrapped tail

second paragraph
[01/02/2026, 10:05:00] Samuel: reply`;
    const { messages } = parseLog(raw);
    expect(messages).toHaveLength(2);
    expect(messages[0].message).toBe('line one\nwrapped tail\n\nsecond paragraph');
    expect(messages[0].message.split('\n')[0]).toBe('line one');
  });

  it('keeps text before the first header out of the log', () => {
    const { messages } = parseLog('Messages and calls are end-to-end encrypted.\n[01/02/2026, 10:00:00] Ada: hi');
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toBe('hi');
  });
});

describe('parseLog — robustness', () => {
  it('strips unicode spaces and BOM, and ignores "-" joined names safely', () => {
    const raw = '\uFEFF[15/07/2025,\u00A023:11:51] Jean-Luc: en avant';
    const { messages } = parseLog(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0].speaker).toBe('Jean-Luc');
  });

  it('rejects impossible dates and out-of-range times', () => {
    const { messages, rejected } = parseLog(
      ['[31/02/2026, 10:00:00] Ada: nope', '[01/02/2026, 25:00:00] Ada: nope', '[01/02/2026, 10:00:00] Ada: ok'].join('\n'),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toBe('ok');
    expect(rejected).toBe(2);
  });

  it('handles both formats in one file', () => {
    const { messages } = parseLog(`${BRACKET}\n${LEGACY}`);
    expect(messages).toHaveLength(6);
  });

  it('returns nothing for empty input', () => {
    expect(parseLog('').messages).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('groups and sorts days ascending', () => {
    const { messages } = parseLog(BRACKET);
    const groups = groupByDay(messages);
    expect(groups).toHaveLength(2);
    expect(groups[0].messages).toHaveLength(2);
    expect(groups[1].messages).toHaveLength(1);
  });
});
