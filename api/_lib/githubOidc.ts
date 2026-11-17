/**
 * Lets the GitHub Actions workflow of this repository call the server without
 * any shared secret: the workflow asks GitHub for a signed token (OIDC), we
 * check GitHub's signature and that it really comes from our repo's workflow.
 */
import { createPublicKey, verify } from 'node:crypto';

const ISSUER = 'https://token.actions.githubusercontent.com';
export const REMIND_AUDIENCE = 'dayflow-remind';
const REPO = 'Ma161ric/make_now';

let jwks: { at: number; keys: any[] } | null = null;
async function keys(): Promise<any[]> {
  if (jwks && Date.now() - jwks.at < 3600_000) return jwks.keys;
  const res = await fetch(`${ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('GitHub-Schlüssel nicht erreichbar');
  jwks = { at: Date.now(), keys: ((await res.json()) as any).keys || [] };
  return jwks.keys;
}

export interface OidcCheck {
  ok: boolean;
  reason?: string;
}

/** Pure check of the claims (exported for tests). */
export function checkClaims(c: any, now = Date.now()): OidcCheck {
  if (c?.iss !== ISSUER) return { ok: false, reason: 'iss' };
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(REMIND_AUDIENCE)) return { ok: false, reason: 'aud' };
  if (typeof c.exp !== 'number' || c.exp * 1000 < now - 60_000) return { ok: false, reason: 'exp' };
  if (typeof c.nbf === 'number' && c.nbf * 1000 > now + 60_000) return { ok: false, reason: 'nbf' };
  if (c.repository !== REPO) return { ok: false, reason: 'repository' };
  if (c.ref !== 'refs/heads/main') return { ok: false, reason: 'ref' };
  if (typeof c.workflow_ref !== 'string' || !c.workflow_ref.startsWith(`${REPO}/.github/workflows/remind.yml@`)) return { ok: false, reason: 'workflow' };
  if (!['schedule', 'workflow_dispatch'].includes(c.event_name)) return { ok: false, reason: 'event' };
  return { ok: true };
}

export async function verifyGithubOidc(token: string): Promise<OidcCheck> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'format' };
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (header.alg !== 'RS256') return { ok: false, reason: 'alg' };
    const jwk = (await keys()).find((k) => k.kid === header.kid);
    if (!jwk) return { ok: false, reason: 'kid' };
    const valid = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    if (!valid) return { ok: false, reason: 'signature' };
    return checkClaims(JSON.parse(Buffer.from(parts[1], 'base64url').toString()));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
