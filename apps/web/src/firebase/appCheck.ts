/**
 * Firebase App Check (optional): proves to Firestore and the DayFlow API that a request
 * comes from this web app and not from a script. Only active when VITE_APPCHECK_SITE_KEY
 * (reCAPTCHA Enterprise site key) is set at build time; without it nothing is loaded.
 */
import type { AppCheck } from 'firebase/app-check';
import { app } from './firebaseConfig';

const SITE_KEY: string | undefined = import.meta.env.VITE_APPCHECK_SITE_KEY;
let ready: Promise<AppCheck | null> | null = null;

export const appCheckEnabled = (): boolean => !!SITE_KEY;

/** Starts App Check once; resolves to null when it is off or could not start. */
export function startAppCheck(): Promise<AppCheck | null> {
  if (!SITE_KEY) return Promise.resolve(null);
  ready ??= import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) =>
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(SITE_KEY), isTokenAutoRefreshEnabled: true })
    )
    .catch(() => null);
  return ready;
}

/** Header for our own API, or {} when App Check is off or no token is available. */
export async function appCheckHeader(): Promise<Record<string, string>> {
  const ac = await startAppCheck();
  if (!ac) return {};
  try {
    const { getToken } = await import('firebase/app-check');
    return { 'X-Firebase-AppCheck': (await getToken(ac, false)).token };
  } catch {
    return {};
  }
}
