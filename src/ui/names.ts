import type { AppState } from '../state';

/** Renders the saved-speaker list used by both the Names tab and autocomplete. */
export function renderNames(list: HTMLElement, count: HTMLElement, state: AppState, onRemove: (name: string) => void): void {
  const names = [...state.speakers].sort((a, b) => a.localeCompare(b));
  count.textContent = `${names.length} name${names.length === 1 ? '' : 's'}`;

  if (!names.length) {
    list.innerHTML =
      '<div class="names-empty">no saved names yet<br><span class="muted">names you search for appear here automatically</span></div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const name of names) {
    const row = document.createElement('div');
    row.className = 'name-row';

    const text = document.createElement('span');
    text.className = 'name-text';
    text.textContent = name;
    text.title = name;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'name-delete-btn';
    remove.textContent = '✕';
    remove.title = `remove ${name}`;
    remove.setAttribute('aria-label', `remove ${name}`);
    remove.addEventListener('click', () => onRemove(name));

    row.append(text, remove);
    fragment.appendChild(row);
  }

  list.replaceChildren(fragment);
}
