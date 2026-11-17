/**
 * What DayFlow keeps on this device for a signed-in user, and how to get rid of it
 * when they sign out or delete their account (shared computers, a lent phone).
 */
import { API_BASE, authHeaders } from './apiAuth';

/** Stop reminders on this device for the current user. Needs the session, so call it before signing out. */
export async function dropPushSubscription(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    await fetch(`${API_BASE}/calendar/push-unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* no push on this device */
  }
}

/** Chat history, cached plans, open proposals and app state of this user (and of no-one else). */
export function clearDeviceData(uid: string | null | undefined): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const mine = !!uid && k.includes(uid);
      // older keys without a user id (sync layer, evening review)
      const shared = ['make-now-state', 'onboarding-completed', 'note', 'task', 'dayPlan', 'dailyReview'].includes(k) || k.startsWith('dayflow-review-');
      if (mine || shared) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* storage blocked: nothing kept either */
  }
}
