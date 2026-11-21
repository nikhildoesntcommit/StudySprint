// Minimal hash router (works on GitHub Pages and offline).
import { useSyncExternalStore } from 'react';

function current(): string {
  const h = location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/today';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): { path: string; parts: string[]; query: URLSearchParams } {
  const raw = useSyncExternalStore(subscribe, current, () => '/today');
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') };
}

export function navigate(path: string, replace = false) {
  const target = `#${path}`;
  if (replace) history.replaceState(null, '', target);
  else if (location.hash !== target) location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
  window.scrollTo({ top: 0 });
}

export const href = (path: string) => `#${path}`;
