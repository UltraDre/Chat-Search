# log · search

A minimalist, offline-first **PWA** for searching WhatsApp-style chat logs by
speaker, date and keyword. Upload a `.txt` export, narrow it down, read the hits
as chat bubbles, tick the ones you want and delete them from the view.

Everything happens in the browser — no upload, no backend, no accounts.

This is a rebuild of the original single-file `index.html`. The rebuilt version is
written in **TypeScript + Vite** and is installable as a PWA.

```
Search  ·  Results  ·  Names
```

---

## Why this stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | The old build had ~1,000 lines of untyped DOM + regex code; types make the parsers and state safe to change. |
| Build | Vite 8 | Instant dev server, tiny bundle (~26 kB JS / ~19 kB CSS), no runtime framework. |
| UI | Hand-written DOM modules | The UI is small and performance-sensitive (thousands of bubbles); a framework would add weight without benefit. |
| PWA | `vite-plugin-pwa` (Workbox) | Generates the manifest, icons, and a precache service worker from one config. |
| Tests | Vitest + jsdom | Parser/search/highlight unit tests plus end-to-end DOM tests of the real app. |

No React/Vue/Svelte: the whole app is a handful of screens, and the original
`localStorage` + template approach ports over 1:1.

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173  (bound to 0.0.0.0 for previews)
```

```bash
npm run build      # typecheck + production build into dist/ (with sw.js)
npm run preview    # serve dist/ locally to test the service worker
npm test           # 46 unit + DOM tests
npm run typecheck  # tsc --noEmit
npm run icons      # re-rasterise public/favicon.svg into the PWA icon set
```

`public/sample-chat.txt` is a small log you can load to try the app.

---

## Features

### Search tab
- **Two log formats**, auto-detected, and both can be mixed in one file:
  - `[15/07/2025, 23:11:51] Speaker: text` (day-first)
  - `6/6/26, 22:16 - Speaker: text` (month-first, 2-digit year)
- **Multi-line messages**: wrapped lines, blank lines and system notices are
  merged into the message above them, exactly as they appear in WhatsApp.
- **Filters**: speaker 1 (required-ish), optional speaker 2, a date range, and a
  case-insensitive keyword that searches every message body.
- **Speaker autocomplete** with ↑/↓/Enter/Esc support, fed by the saved names.
- **Date range auto-fits to the uploaded log** so an older export doesn't come
  back empty (the pickers used to start on "today → today").
- **Auto-save**: the log text, filters, selections and active tab are restored on
  the next visit (`localStorage`), with a `↻ restored` badge and graceful
  fallback if the browser's storage quota is exceeded.

### Results tab
- WhatsApp-style bubbles: speaker 1 on the right, everyone else on the left,
  day dividers (`Today` / `Yesterday` / `dd/mm/yyyy`), multi-line text preserved.
- Highlighting: **speaker 1 yellow**, **speaker 2 bright green**, **keyword
  blue** — highlighted live while you type, without rebuilding the list.
- Checkboxes to select messages, then **Delete selected** (removes them from the
  current view only, like the original — a new search brings them back).
- Tap a bubble to select it on touch devices.

### Names tab
- Every speaker you search for is remembered, listed and reusable.
- Remove a name with `✕`; the autocomplete updates immediately.

### Look & feel
- Same layout, spacing, pill controls, typography scale and copy as the original.
- Light **and** dark themes via `prefers-color-scheme`.
- `prefers-reduced-motion` respected.

---

## No page zoom while typing

The classic mobile annoyance: iOS Safari (and Android Chrome) zoom into any input
whose font-size is under 16px. Three things prevent it:

1. **Locked viewport** in `index.html`:
   `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`.
2. **16px minimum on text fields** (`input, select, textarea`) in
   `src/styles.css`, plus `touch-action: manipulation` to drop double-tap zoom.
   Buttons deliberately keep their original smaller pill typography.
3. `-webkit-text-size-adjust: 100%` and `100dvh` layout height, so the page also
   doesn't jump when the on-screen keyboard opens (safe-area insets handle
   notches and the home-bar).

A test asserts the 16px rule so it can't regress silently.

---

## PWA / offline

- `vite-plugin-pwa` generates `manifest.webmanifest`, precaches the app shell
  (`16 entries`, ~90 kB) and registers `sw.js` with `autoUpdate`.
- **Installable**: standalone display, theme colours for light/dark, 192/512
  icons plus a **maskable** 512 for Android, and an `apple-touch-icon`.
- When the browser offers it, an **`install app`** pill appears in the Search
  header; tapping it opens the native install prompt.
- After the first load, the app works with no network at all.
- Everything is client-side, so there is nothing to "sync" when offline.

To verify offline: `npm run build && npm run preview`, open the app, load a log,
then go offline in DevTools and reload.

---

## Project structure

```
index.html              app shell + PWA meta (viewport, manifest, icons)
src/
  main.ts               boot
  app.ts                wires the tabs, search, file loading, restore
  state.ts              the single app state object + persistence helpers
  styles.css            the original design, plus mobile/PWA refinements
  pwa.ts                install prompt + service-worker registration + toasts
  lib/
    types.ts            Message, SearchCriteria, …
    parser.ts           log parsing, continuation merging, ids, day grouping
    search.ts           filtering + which side of the chat a message is on
    highlight.ts        escaping + speaker/keyword highlighting
    dates.ts            UTC-safe date parsing/formatting (no timezone drift)
    storage.ts          versioned localStorage, legacy-key migration
  ui/
    template.ts         markup for the three tabs
    dom.ts              tiny typed DOM helpers
    suggestions.ts      autocomplete behaviour
    results.ts          bubble/divider rendering
    names.ts            saved-speaker list
public/
  favicon.svg icons/ sample-chat.txt
tests/                  parser, search, highlight, date + full-app DOM tests
```

## Data & privacy

- The log file is read with `FileReader` and never leaves the device.
- Persisted under two keys: `log-search:state` (log text + filters + tab) and
  `log-search:names` (saved speakers). Both are cleared with **clear**.
- On first run the old build's `edge_searcher_state` / `speaker_suggestions`
  keys are migrated once, so existing sessions survive the upgrade.

## Notes on behaviour kept from the original

- Speaker matching is **exact** (case-insensitive), not partial: searching `Sam`
  won't match `Samuel`.
- Speaker 1 alone puts every hit on the right; adding speaker 2 splits the two
  sides.
- Dates are compared as whole days in UTC, so results don't shift with timezone.
- "Delete selected" only affects the current result view.
