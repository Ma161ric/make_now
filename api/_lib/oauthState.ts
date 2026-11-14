/**
 * Signed, short-lived OAuth `state` so the callback knows which user started
 * the flow and nobody can forge it (CSRF / account-mixing protection).
 *
 * Env: OAUTH_STATE_SECRET (any long random string)
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.OAUTH_STATE_SECRET;
  if (!s || s.length < 16) throw new Error('OAUTH_STATE_SECRET is not set (min. 16 chars)');
  return s;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createState(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + TTL_MS, n: randomBytes(8).toString('hex') })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns the uid, or null if the state is invalid or expired. */
export function verifyState(state: string): string | null {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'string' || typeof exp !== 'number' || Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}
