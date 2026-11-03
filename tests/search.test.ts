import { describe, expect, it } from 'vitest';
import { parseLog } from '../src/lib/parser';
import { isSentSide, searchMessages } from '../src/lib/search';
import { isoToTimestamp, parseDateDMY, parseDateMDY, formatDateDivider, dayKey, shortTime } from '../src/lib/dates';
import { highlightText } from '../src/lib/highlight';

const LOG = `[15/07/2025, 23:11:51] Samuel: Hey Ada
[15/07/2025, 23:12:03] Ada: hello Samuel
[16/07/2025, 09:00:00] Samuel: meeting at 10
[17/07/2025, 18:30:00] Ada: budget approved`;

const messages = parseLog(LOG).messages;
const day = (dmy: string) => parseDateDMY(dmy)!;

describe('searchMessages', () => {
  it('requires speaker 1 or a keyword', () => {
    const { error, messages: hits } = searchMessages(messages, {
      speaker1: '',
      speaker2: '',
      keyword: '',
      from: null,
      to: null,
    });
    expect(hits).toEqual([]);
    expect(error).toMatch(/speaker 1 or a keyword/i);
  });

  it('filters by speaker 1 exactly, case-insensitively', () => {
    const { messages: hits } = searchMessages(messages, {
      speaker1: 'samuel',
      speaker2: '',
      keyword: '',
      from: null,
      to: null,
    });
    expect(hits).toHaveLength(2);
    expect(hits.every((m) => m.speaker === 'Samuel')).toBe(true);
  });

  it('includes both speakers when speaker 2 is set', () => {
    const { messages: hits } = searchMessages(messages, {
      speaker1: 'Samuel',
      speaker2: 'Ada',
      keyword: '',
      from: null,
      to: null,
    });
    expect(hits).toHaveLength(4);
  });

  it('does not match partial speaker names', () => {
    const { messages: hits } = searchMessages(messages, {
      speaker1: 'Sam',
      speaker2: '',
      keyword: '',
      from: null,
      to: null,
    });
    expect(hits).toHaveLength(0);
  });

  it('searches keywords across every speaker', () => {
    const { messages: hits } = searchMessages(messages, {
      speaker1: '',
      speaker2: '',
      keyword: 'SAMUEL',
      from: null,
      to: null,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].speaker).toBe('Ada');
  });

  it('applies inclusive day bounds', () => {
    const { messages: hits } = searchMessages(messages, {
      speaker1: 'Samuel',
      speaker2: 'Ada',
      keyword: '',
      from: day('15/07/2025'),
      to: day('16/07/2025'),
    });
    expect(hits).toHaveLength(3);
  });

  it('rejects an inverted date range', () => {
    const { error } = searchMessages(messages, {
      speaker1: 'Samuel',
      speaker2: '',
      keyword: '',
      from: day('17/07/2025'),
      to: day('15/07/2025'),
    });
    expect(error).toMatch(/cannot be after/i);
  });

  it('combines speaker + keyword + range and stays chronological', () => {
    const { messages: hits } = searchMessages(messages, {
      speaker1: 'Samuel',
      speaker2: '',
      keyword: 'meeting',
      from: day('15/07/2025'),
      to: day('17/07/2025'),
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain('meeting');
  });
});

describe('isSentSide', () => {
  const samuel = messages.find((m) => m.speaker === 'Samuel')!;
  const ada = messages.find((m) => m.speaker === 'Ada')!;

  it('puts speaker 1 on the right, everyone else on the left', () => {
    expect(isSentSide(samuel, 'Samuel')).toBe(true);
    expect(isSentSide(ada, 'Samuel')).toBe(false);
    expect(isSentSide(samuel, 'samuel')).toBe(true);
  });

  it('never marks anyone as sent without speaker 1', () => {
    expect(isSentSide(samuel, '')).toBe(false);
  });
});

describe('date helpers', () => {
  it('round-trips ISO <-> dd/mm/yyyy', () => {
    expect(isoToTimestamp('2025-07-15')).toBe(day('15/07/2025'));
  });

  it('parses both log date shapes', () => {
    expect(parseDateDMY('15/07/2025')).not.toBeNull();
    expect(parseDateMDY('6/6/26')).toBe(Date.UTC(2026, 5, 6));
    expect(parseDateDMY('32/01/2026')).toBeNull();
    expect(parseDateDMY('31/02/2026')).toBeNull();
  });

  it('labels today and yesterday', () => {
    const now = new Date(2026, 10, 3);
    expect(formatDateDivider(Date.UTC(2026, 10, 3), now)).toBe('Today');
    expect(formatDateDivider(Date.UTC(2026, 10, 2), now)).toBe('Yesterday');
    expect(formatDateDivider(Date.UTC(2026, 9, 30), now)).toBe('30/10/2026');
  });

  it('builds stable day keys and short times', () => {
    expect(dayKey(Date.UTC(2026, 0, 5))).toBe('2026-01-05');
    expect(shortTime('9:5:11')).toBe('09:05');
    expect(shortTime('')).toBe('00:00');
  });
});

describe('highlightText', () => {
  it('marks both speakers, speakers win over the keyword', () => {
    const html = highlightText('Hey Ada, Samuel here', 'Samuel', 'Ada', 'Ada');
    // Ada is speaker 2, so she keeps her own colour instead of the keyword blue.
    expect(html).toContain('<mark class="speaker2">Ada</mark>');
    expect(html).toContain('<mark>Samuel</mark>');
  });

  it('marks a keyword that is not a speaker name', () => {
    const html = highlightText('budget approved', 'Samuel', 'Ada', 'budget');
    expect(html).toBe('<mark class="keyword">budget</mark> approved');
  });

  it('escapes HTML so log content cannot inject markup', () => {
    const html = highlightText('<img src=x onerror=alert(1)>', '', '', 'alert');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('never nests marks when a name contains the keyword', () => {
    const html = highlightText('Samuel said hi', 'Samuel', '', 'Sam');
    expect(html).toBe('<mark>Samuel</mark> said hi');
  });

  it('escapes regex characters in names and keywords', () => {
    expect(highlightText('cost is $5 (approx)', 'A$5 (approx)', '', '')).toContain('cost is $5 (approx)');
    expect(highlightText('cost is $5 (approx)', '', '', '$5 (approx)')).toBe(
      'cost is <mark class="keyword">$5 (approx)</mark>',
    );
  });

  it('converts newlines to breaks and handles empty queries', () => {
    expect(highlightText('a\nb', '', '', '')).toBe('a<br>b');
  });
});
