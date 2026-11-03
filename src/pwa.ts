import { on } from './ui/dom';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Shows the "install app" pill once the browser offers an install prompt, and
 * hides it again when the app is already installed or the prompt was used.
 */
export function initInstallPrompt(button: HTMLButtonElement | null): void {
  if (button) {
    let deferred: InstallPromptEvent | null = null;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferred = event as InstallPromptEvent;
      button.hidden = false;
    });

    on(button, 'click', async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      button.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
      deferred = null;
      button.hidden = true;
    });
  }

  registerServiceWorker();
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  // Dev builds serve modules straight from disk, so only register in production.
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => {
        // First visit only: let the user know the app now works offline.
        if (!sessionStorage.getItem('log-search:offline-hint')) {
          sessionStorage.setItem('log-search:offline-hint', '1');
          toast('ready offline · add to home screen');
        }
      })
      .catch(() => {
        /* offline support is a bonus, never a blocker */
      });
  });

  window.addEventListener('offline', () => toast('offline · everything still works'));
}

/** Small, self-dismissing status pill. */
function toast(message: string): void {
  const el = document.createElement('div');
  el.className = 'sw-toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}
