export interface SuggestionOptions {
  input: HTMLInputElement;
  dropdown: HTMLElement;
  getNames: () => string[];
  onPick: (name: string) => void;
  onSubmit: () => void;
}

/**
 * Returns the suggestion dropdown in `container`, creating it once.
 * Idempotent so a re-mount can never leave duplicate ids in the document.
 */
export function mountDropdown(container: HTMLElement, id: string): HTMLElement {
  const existing = container.querySelector<HTMLElement>(`.suggestions-dropdown#${id}`);
  if (existing) return existing;
  const dropdown = document.createElement('div');
  dropdown.className = 'suggestions-dropdown';
  dropdown.id = id;
  dropdown.setAttribute('role', 'listbox');
  container.appendChild(dropdown);
  return dropdown;
}

/**
 * Prefix-matching speaker autocomplete with keyboard support
 * (↑ ↓ Enter/Esc), matching the dropdown behaviour of the original build.
 */
export function attachSuggestions({ input, dropdown, getNames, onPick, onSubmit }: SuggestionOptions): void {
  let activeIndex = -1;

  function matches(): string[] {
    const value = input.value.trim().toLowerCase();
    if (!value) return [];
    return getNames()
      .filter((name) => name.toLowerCase().startsWith(value))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 8);
  }

  function paint(): void {
    const value = input.value.trim();
    const found = value ? matches() : [];

    if (!found.length) {
      close();
      return;
    }

    activeIndex = -1;
    const lower = value.toLowerCase();
    dropdown.innerHTML = found
      .map((name) => {
        const at = name.toLowerCase().indexOf(lower);
        const before = escape(name.slice(0, at));
        const hit = escape(name.slice(at, at + value.length));
        const after = escape(name.slice(at + value.length));
        return `<div class="suggestion-item" role="option">${before}<span class="highlight">${hit}</span>${after}</div>`;
      })
      .join('');
    dropdown.style.display = 'block';
  }

  function close(): void {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    activeIndex = -1;
  }

  function highlight(index: number): void {
    const items = dropdown.querySelectorAll<HTMLElement>('.suggestion-item');
    items.forEach((item, i) => item.classList.toggle('active', i === index));
    items[index]?.scrollIntoView({ block: 'nearest' });
    activeIndex = index;
  }

  function pick(name: string): void {
    input.value = name;
    close();
    onPick(name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  input.addEventListener('input', paint);
  input.addEventListener('focus', () => {
    if (input.value.trim()) paint();
  });
  input.addEventListener('blur', () => {
    // Delay so a tap/click on an item lands before the list closes.
    setTimeout(close, 140);
  });

  dropdown.addEventListener('mousedown', (event) => {
    const item = (event.target as HTMLElement).closest('.suggestion-item');
    if (!item) return;
    event.preventDefault();
    pick(item.textContent ?? '');
  });

  input.addEventListener('keydown', (event) => {
    const items = dropdown.querySelectorAll<HTMLElement>('.suggestion-item');
    const open = dropdown.style.display === 'block' && items.length > 0;

    switch (event.key) {
      case 'ArrowDown':
        if (!open) return;
        event.preventDefault();
        highlight((activeIndex + 1) % items.length);
        break;
      case 'ArrowUp':
        if (!open) return;
        event.preventDefault();
        highlight((activeIndex - 1 + items.length) % items.length);
        break;
      case 'Enter':
        event.preventDefault();
        if (open && activeIndex >= 0) {
          pick(items[activeIndex].textContent ?? '');
        } else {
          close();
          onSubmit();
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case 'Tab':
        if (open && activeIndex >= 0) {
          event.preventDefault();
          pick(items[activeIndex].textContent ?? '');
        }
        break;
      default:
        break;
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (!input.contains(target) && !dropdown.contains(target)) close();
  });
}
