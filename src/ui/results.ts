import { formatDateDivider, shortTime } from '../lib/dates';
import { escapeHtml, highlightText } from '../lib/highlight';
import { groupByDay } from '../lib/parser';
import { isSentSide } from '../lib/search';
import type { Message } from '../lib/types';

export interface RenderContext {
  speaker1: string;
  speaker2: string;
  keyword: string;
  selected: Set<string>;
  onToggle: (msg: Message, selected: boolean) => void;
}

/** Builds the whole results list in one fragment to keep scrolling smooth. */
export function renderResults(container: HTMLElement, messages: Message[], ctx: RenderContext): void {
  const fragment = document.createDocumentFragment();

  for (const group of groupByDay(messages)) {
    fragment.appendChild(dateDivider(formatDateDivider(group.timestamp)));
    for (const msg of group.messages) {
      fragment.appendChild(messageRow(msg, ctx));
    }
  }

  container.replaceChildren(fragment);
}

export function renderEmpty(container: HTMLElement, title: string, hint?: string): void {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = escapeHtml(title) + (hint ? `<br><span class="muted">${escapeHtml(hint)}</span>` : '');
  container.replaceChildren(el);
}

function dateDivider(label: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'date-divider';
  const span = document.createElement('span');
  span.textContent = label;
  div.appendChild(span);
  return div;
}

function messageRow(msg: Message, ctx: RenderContext): HTMLElement {
  const sent = isSentSide(msg, ctx.speaker1);
  const selected = ctx.selected.has(msg.id);

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${sent ? 'sent' : 'received'}${selected ? ' selected' : ''}`;
  wrapper.dataset.id = msg.id;

  const checkboxWrap = document.createElement('div');
  checkboxWrap.className = 'msg-checkbox-wrap';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'msg-select';
  checkbox.checked = selected;
  checkbox.setAttribute('aria-label', `select message from ${msg.speaker}`);
  checkbox.addEventListener('change', () => {
    wrapper.classList.toggle('selected', checkbox.checked);
    ctx.onToggle(msg, checkbox.checked);
  });
  checkboxWrap.appendChild(checkbox);

  const bubbleContainer = document.createElement('div');
  bubbleContainer.className = 'bubble-container';

  const name = document.createElement('div');
  name.className = 'msg-speaker-name';
  const speakerClass = sent ? 'highlight-s1' : 'highlight-s2';
  name.innerHTML = `<span class="${speakerClass}">${escapeHtml(msg.speaker)}</span><span class="msg-timestamp-inline">${shortTime(msg.rawTime)}</span>`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.title = `${msg.displayDate} · ${msg.rawTime}`;

  const text = document.createElement('div');
  text.className = 'msg-text';
  text.innerHTML = highlightText(msg.message, ctx.speaker1, ctx.speaker2, ctx.keyword);

  bubble.appendChild(text);
  bubbleContainer.append(name, bubble);

  if (sent) wrapper.append(bubbleContainer, checkboxWrap);
  else wrapper.append(checkboxWrap, bubbleContainer);

  return wrapper;
}

/** Keeps checkboxes in sync when selection is cleared or restored in bulk. */
export function syncSelection(container: HTMLElement, selected: Set<string>): void {
  container.querySelectorAll<HTMLElement>('.msg-wrapper').forEach((row) => {
    const id = row.dataset.id;
    const box = row.querySelector<HTMLInputElement>('.msg-select');
    if (!id || !box) return;
    const isSelected = selected.has(id);
    box.checked = isSelected;
    row.classList.toggle('selected', isSelected);
  });
}
