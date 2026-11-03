import type { Message, SearchCriteria, SearchResult } from './types';

/**
 * Filters the log. Speaker matching is exact (case-insensitive) to match the
 * original behaviour; the keyword is a plain case-insensitive substring match
 * across every message; dates are inclusive whole-day comparisons.
 */
export function searchMessages(messages: Message[], criteria: SearchCriteria): SearchResult {
  const s1 = criteria.speaker1.trim().toLowerCase();
  const s2 = criteria.speaker2.trim().toLowerCase();
  const keyword = criteria.keyword.trim().toLowerCase();
  const { from, to } = criteria;

  if (!s1 && !keyword) {
    return { messages: [], error: 'Enter speaker 1 or a keyword to search all chats.' };
  }
  if (from !== null && to !== null && from > to) {
    return { messages: [], error: '“From” date cannot be after “To” date.' };
  }

  const result = messages.filter((msg) => {
    if (s1 && !(msg.speakerLower === s1 || (s2 && msg.speakerLower === s2))) return false;
    if (keyword && !msg.message.toLowerCase().includes(keyword)) return false;
    if (from !== null && msg.dayTimestamp < from) return false;
    if (to !== null && msg.dayTimestamp > to) return false;
    return true;
  });

  result.sort((a, b) => a.fullTimestamp - b.fullTimestamp);
  return { messages: result, error: null };
}

/**
 * Decides which side of the conversation a message sits on. Speaker 1 is the
 * "sent" side (right, yellow, green bubble); everyone else is "received".
 */
export function isSentSide(msg: Message, speaker1: string): boolean {
  const s1 = speaker1.trim().toLowerCase();
  if (!s1) return false;
  return msg.speakerLower === s1;
}
