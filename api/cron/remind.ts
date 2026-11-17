/**
 * Reminders as push notifications. Called every few minutes by the GitHub
 * Actions workflow .github/workflows/remind.yml, which proves itself with a
 * GitHub-signed token (no shared secret to set up).
 *
 *  - shortly before each DayFlow block (task, sport, appointment): "In 10 Min: …"
 *  - in the evening, once: "Wie lief dein Tag?" if planned tasks are still open
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/firebaseAdmin.js';
import { openWorkspace } from '../_lib/workspace.js';
import { pushToUser } from '../_lib/webpush.js';
import { verifyGithubOidc } from '../_lib/githubOidc.js';
import { localDateString, zonedTimeToUtc } from '../../packages/core/src/freeSlotScheduling.js';

const MIN = 60_000;
const AHEAD = 15 * MIN; // remind blocks starting within the next 15 minutes
const EVENING_HOUR = 19;

const hhmm = (d: Date, tz: string) => d.toLocaleTimeString('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // either Vercel's cron secret, or the signed token of this repo's GitHub workflow (no secret needed)
  const auth = String(req.headers.authorization || '');
  const secret = process.env.CRON_SECRET;
  const bySecret = !!secret && auth === `Bearer ${secret}`;
  if (!bySecret) {
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const check = token ? await verifyGithubOidc(token) : { ok: false };
    if (!check.ok) return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const users = await db().collection('push_subscriptions').listDocuments();
  let sent = 0;
  const failed: string[] = [];

  for (const userDoc of users) {
    const uid = userDoc.id;
    try {
      const hasDevice = !(await userDoc.collection('devices').limit(1).get()).empty;
      if (!hasDevice) continue;
      const ws = await openWorkspace(uid);
      const tz = ws.tz;
      const date = localDateString(now, tz);
      const stateRef = db().doc(`push_state/${uid}`);
      const state = ((await stateRef.get()).data() || {}) as { date?: string; sent?: string[]; evening?: string };
      const already = new Set(state.date === date ? state.sent || [] : []);
      const update: { date: string; sent: string[]; evening?: string } = { date, sent: [...already] };

      // 1) shortly before a block
      if (ws.settings.remindBlocks !== false) {
        const soon = (await ws.blocks.list(now, new Date(now.getTime() + AHEAD))).filter(
          (b) => b.kind !== 'free' && b.start.getTime() > now.getTime() && b.start.getTime() <= now.getTime() + AHEAD && !already.has(`${b.id}@${b.start.getTime()}`)
        );
        for (const b of soon) {
          const minutes = Math.max(1, Math.round((b.start.getTime() - now.getTime()) / MIN));
          sent += await pushToUser(uid, {
            title: `In ${minutes} Min: ${b.title}`,
            body: `${hhmm(b.start, tz)} – ${hhmm(b.end, tz)}${b.location ? ` · ${b.location}` : ''}`,
            url: '/today',
            tag: `block-${b.id}`,
          });
          update.sent.push(`${b.id}@${b.start.getTime()}`);
        }
      }

      // 2) evening question, once a day
      const eveningAt = zonedTimeToUtc(date, EVENING_HOUR, 0, tz);
      if (ws.settings.eveningReview !== false && state.evening !== date && now >= eveningAt) {
        const dayStart = zonedTimeToUtc(date, 0, 0, tz);
        const tasks = (await ws.blocks.list(dayStart, now)).filter((b) => b.kind === 'task' && b.taskId);
        const ids = [...new Set(tasks.map((b) => b.taskId!))];
        let open = 0;
        if (ids.length) {
          const docs = await Promise.all(ids.map((id) => db().doc(`users/${uid}/items/${id}`).get()));
          open = docs.filter((d) => d.exists && (d.data() as any)?.status !== 'done' && (d.data() as any)?.status !== 'cancelled').length;
        }
        if (open > 0) {
          sent += await pushToUser(uid, {
            title: 'Wie lief dein Tag?',
            body: open === 1 ? 'Eine Aufgabe wartet noch auf dein Häkchen.' : `${open} Aufgaben warten noch auf dein Häkchen.`,
            url: '/today',
            tag: 'evening',
          });
        }
        update.evening = date;
      } else if (state.evening) {
        update.evening = state.evening;
      }

      update.sent = update.sent.slice(-200);
      await stateRef.set(update);
    } catch (e: any) {
      failed.push(uid.slice(0, 6));
      console.error(`[remind] ${uid} failed`, e?.message || e);
    }
  }
  return res.status(200).json({ users: users.length, sent, failed: failed.length });
}
