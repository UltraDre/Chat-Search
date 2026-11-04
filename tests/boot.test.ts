// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../src/boot';
import { createApp } from '../src/app';
import { resetState } from '../src/state';

beforeEach(() => {
  localStorage.clear();
  resetState();
  vi.restoreAllMocks();
  document.body.innerHTML = '<div id="app"><div class="boot-fallback">Loading…</div></div>';
});

describe('boot', () => {
  it('replaces the loading skeleton with the app', () => {
    boot(createApp);
    expect(document.querySelector('.boot-fallback')).toBeNull();
    expect(document.querySelector('.app')).not.toBeNull();
    expect(document.getElementById('searchPanel')).not.toBeNull();
  });

  it('shows a readable error instead of a blank page when mounting throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    boot(() => {
      throw new Error('boom');
    });
    const fallback = document.querySelector('[role="alert"]');
    expect(fallback).not.toBeNull();
    expect(fallback!.textContent).toContain('Something went wrong while starting the app');
    expect(fallback!.textContent).toContain('boom');
    expect(document.body.textContent).not.toBe('');
  });

  it('reports a missing mount point', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '';
    boot(createApp);
    expect(document.body.textContent).toContain('App container missing');
  });
});
