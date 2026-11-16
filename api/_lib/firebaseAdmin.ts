/**
 * Firebase Admin for Vercel functions.
 * Files under api/_lib are not deployed as endpoints (underscore prefix).
 *
 * Env: FIREBASE_SERVICE_ACCOUNT = the service account JSON (one line)
 */
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { VercelRequest } from '@vercel/node';

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

export const db = () => getFirestore(app());
export const adminAuth = () => getAuth(app());

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Like requireUser, but returns null instead of throwing (no token, invalid
 * token, or Firebase Admin not configured). Used to decide whether the paid
 * AI provider may be used for a request.
 */
export async function optionalUser(req: VercelRequest): Promise<string | null> {
  if (!req.headers.authorization || !process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    return await requireUser(req);
  } catch {
    return null;
  }
}

/**
 * Verifies the Firebase ID token from `Authorization: Bearer <token>`
 * and returns the user's uid.
 */
export async function requireUser(req: VercelRequest): Promise<string> {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new HttpError(401, 'Not signed in');
  try {
    const decoded = await getAuth(app()).verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new HttpError(401, 'Invalid session');
  }
}
