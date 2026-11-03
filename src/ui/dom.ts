/** Tiny typed DOM helpers — no framework, no virtual DOM, just enough sugar. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function $opt<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function on<K extends keyof HTMLElementEventMap>(
  target: EventTarget,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): void {
  target.addEventListener(type, handler as EventListener, options);
}

/** Debounce helper used for persistence writes. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 180): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Keeps the footer in sync with the tab bar. */
export function setFooterVisible(visible: boolean): void {
  $opt('mainFooter')?.classList.toggle('hide-footer', !visible);
}
