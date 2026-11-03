/** HTML-escapes user content before it is injected with innerHTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const OPEN = '\u0000';
const CLOSE = '\u0001';

/**
 * Highlights the keyword (blue) and both speaker names (yellow / green) inside
 * a message body. Placeholders are inserted in a single escaped pass so a
 * speaker name can never be double-wrapped by the keyword pass.
 */
export function highlightText(text: string, speaker1: string, speaker2: string, keyword: string): string {
  const names: { name: string; cls: string }[] = [];
  const s1 = speaker1.trim();
  const s2 = speaker2.trim();
  if (s1) names.push({ name: s1, cls: 's1' });
  if (s2) names.push({ name: s2, cls: 's2' });

  // Longer names first, case-insensitive, de-duplicated.
  const seen = new Set<string>();
  const ordered = names
    .filter(({ name }) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.name.length - a.name.length);

  // Combined pass: longest alternative wins at any given position.
  const kw = keyword.trim();
  const lookup = new Map<string, string>();
  const patterns: string[] = [];
  for (const { name, cls } of ordered) {
    const key = name.toLowerCase();
    if (lookup.has(key)) continue;
    lookup.set(key, cls);
    patterns.push(escapeRegex(name));
  }
  if (kw && !lookup.has(kw.toLowerCase())) {
    lookup.set(kw.toLowerCase(), 'kw');
    patterns.push(escapeRegex(kw));
  }

  if (!patterns.length) return escapeHtml(text).replace(/\n/g, '<br>');

  // Single callbacks (not a positional group) keep this cheap on long messages.
  const regex = new RegExp(patterns.join('|'), 'gi');
  const marked = text.replace(regex, (match) => {
    const cls = lookup.get(match.toLowerCase()) ?? 'kw';
    return `${OPEN}${cls}\u0002${match}${CLOSE}`;
  });

  return escapeHtml(marked)
    .replace(new RegExp(`${OPEN}(\\w*)\u0002`, 'g'), (_m, cls: string) => {
      if (cls === 'kw') return '<mark class="keyword">';
      if (cls === 's2') return '<mark class="speaker2">';
      return '<mark>';
    })
    .replace(new RegExp(CLOSE, 'g'), '</mark>')
    .replace(/\n/g, '<br>');
}
