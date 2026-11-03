/** A single chat message pulled out of the uploaded log. */
export interface Message {
  /** Stable identity used to reconcile selections across re-renders. */
  id: string;
  rawDate: string;
  rawTime: string;
  speaker: string;
  /** Lower-cased speaker, cached for cheap comparisons. */
  speakerLower: string;
  /** Body text, continuation lines joined with "\n". */
  message: string;
  /** UTC midnight of the message day — used for date filtering/grouping. */
  dayTimestamp: number;
  /** Exact moment of the message, used for ordering. */
  fullTimestamp: number;
  displayDate: string;
  displayTime: string;
}

export interface ParseResult {
  messages: Message[];
  /** Lines that looked like message headers but were rejected. */
  rejected: number;
}

export interface SearchCriteria {
  speaker1: string;
  speaker2: string;
  keyword: string;
  from: number | null;
  to: number | null;
}

export interface SearchResult {
  messages: Message[];
  error: string | null;
}

export type TabId = 'search' | 'results' | 'names';
