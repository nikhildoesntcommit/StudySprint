// Per-device UI conveniences (remembered views). Storage can be unavailable, so never throw.
export function getPref<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(`ss.${key}`) as T) || fallback; } catch { return fallback; }
}
export function setPref(key: string, value: string) {
  try { localStorage.setItem(`ss.${key}`, value); } catch { /* ignore */ }
}
