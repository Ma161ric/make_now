/**
 * Last known data per screen, so switching tabs shows the previous state
 * instantly while fresh data loads in the background (no skeleton flicker).
 * Kept in memory and in localStorage; keyed by the signed-in user.
 */
import { auth } from '../firebase/firebaseConfig';

const mem = new Map<string, unknown>();
const fullKey = (key: string) => `dayflow_cache_${auth.currentUser?.uid || 'anon'}_${key}`;

export function readCache<T>(key: string): T | null {
  const k = fullKey(key);
  if (mem.has(k)) return mem.get(k) as T;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const value = JSON.parse(raw) as T;
    mem.set(k, value);
    return value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T) {
  const k = fullKey(key);
  mem.set(k, value);
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* storage full or blocked: memory is enough */
  }
}
