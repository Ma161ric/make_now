import { auth } from '../firebase/firebaseConfig';

/** Base URL of the Vercel API (same origin by default). */
export const API_BASE: string = import.meta.env.VITE_API_URL || '/api';

/**
 * Authorization header with the user's Firebase ID token, or {} when signed out.
 * The server only uses the paid AI model (Claude) for requests that carry it.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    return {};
  }
}
