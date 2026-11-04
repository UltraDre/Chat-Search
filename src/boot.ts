/**
 * Boots the app and, if anything goes wrong before the UI is on screen,
 * replaces the blank page with a readable message instead of silence.
 */
export function boot(mount: (root: HTMLElement) => void): void {
  const root = document.getElementById('app');

  if (!root) {
    showFatal('App container missing', 'The #app element was not found in index.html.');
    return;
  }

  try {
    mount(root);
  } catch (error) {
    console.error('[log·search] failed to start', error);
    showFatal(
      'Something went wrong while starting the app',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      true,
    );
  }
}

/** Lightweight, style-independent fallback UI: no CSS or JS dependencies. */
function showFatal(title: string, detail: string, reloadable = false): void {
  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'alert');
  wrap.style.cssText = [
    'font-family:-apple-system,"Segoe UI",Roboto,sans-serif',
    'max-width:32rem',
    'margin:12vh auto 0',
    'padding:1.5rem 1.6rem',
    'border:1px solid #e2e8f0',
    'border-radius:20px',
    'background:#fff',
    'color:#0f172a',
    'line-height:1.6',
    'box-shadow:0 8px 24px rgba(0,0,0,0.06)',
  ].join(';');

  const heading = document.createElement('h1');
  heading.textContent = '⌕ log search';
  heading.style.cssText = 'font-size:1.05rem;font-weight:600;margin:0 0 .5rem';

  const message = document.createElement('p');
  message.textContent = title;
  message.style.cssText = 'font-size:.8rem;margin:0 0 .4rem';

  const info = document.createElement('p');
  info.textContent = detail;
  info.style.cssText =
    'font-size:.7rem;color:#64748b;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word';

  wrap.append(heading, message, info);

  if (reloadable) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'reload';
    button.style.cssText =
      'margin-top:1rem;font:inherit;font-size:.75rem;padding:6px 16px;border-radius:40px;border:1px solid #0f172a;background:#0f172a;color:#fff;cursor:pointer';
    button.addEventListener('click', () => window.location.reload());
    wrap.appendChild(button);
  }

  const target = document.body ?? document.documentElement;
  target.replaceChildren(wrap);
}

/** Surfaces module-loading failures (e.g. a stale dev-server import). */
export function watchBootErrors(): void {
  window.addEventListener('error', (event) => {
    // Only take over the page if the app never mounted.
    if (document.querySelector('.app')) return;
    const detail = event.error instanceof Error ? event.error.message : event.message;
    if (!detail) return;
    showFatal('The app could not load its scripts', String(detail), true);
  });
}
