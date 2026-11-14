/**
 * GET /api/health  - shows which parts of the setup work. Never returns secrets,
 * only "ok" / "missing" / an error message per check.
 *
 * Checks that call other services only use free endpoints (model lists,
 * a Firestore read), so opening this page costs nothing.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/firebaseAdmin.js';

type Check = 'ok' | 'missing' | string;

const has = (name: string) => Boolean(process.env[name]);

async function check(fn: () => Promise<void>): Promise<Check> {
  try {
    await fn();
    return 'ok';
  } catch (e: any) {
    return `error: ${String(e?.message || e).slice(0, 160)}`;
  }
}

async function fetchOk(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, max-age=60');

  const env = Object.fromEntries(
    [
      'GROQ_API_KEY',
      'ANTHROPIC_API_KEY',
      'FIREBASE_SERVICE_ACCOUNT',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'APP_URL',
      'OAUTH_STATE_SECRET',
      'CRON_SECRET',
    ].map((n) => [n, has(n) ? 'ok' : 'missing'])
  );

  const [groq, claude, firebase] = await Promise.all([
    has('GROQ_API_KEY')
      ? check(() => fetchOk('https://api.groq.com/openai/v1/models', { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }))
      : Promise.resolve<Check>('missing'),
    has('ANTHROPIC_API_KEY')
      ? check(() =>
          fetchOk('https://api.anthropic.com/v1/models', { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' })
        )
      : Promise.resolve<Check>('missing'),
    has('FIREBASE_SERVICE_ACCOUNT')
      ? check(async () => {
          await db().collection('calendar_connections').limit(1).get();
        })
      : Promise.resolve<Check>('missing'),
  ]);

  const redirect = process.env.GOOGLE_REDIRECT_URI || '';
  const appUrl = process.env.APP_URL || '';
  const hints: string[] = [];
  if (redirect && !redirect.endsWith('/api/calendar/callback')) hints.push('GOOGLE_REDIRECT_URI muss auf /api/calendar/callback enden');
  if (appUrl.endsWith('/')) hints.push('APP_URL ohne Schrägstrich am Ende angeben');
  if (redirect && appUrl && !redirect.startsWith(appUrl)) hints.push('GOOGLE_REDIRECT_URI und APP_URL zeigen auf verschiedene Domains');

  return res.status(200).json({
    services: { groq, claude, firebase },
    env,
    hints,
    ai: has('ANTHROPIC_API_KEY') ? 'Claude zuerst, Groq als Fallback' : 'nur Groq',
    calendar: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'APP_URL', 'OAUTH_STATE_SECRET', 'FIREBASE_SERVICE_ACCOUNT'].every(has)
      ? 'konfiguriert'
      : 'unvollständig',
  });
}
