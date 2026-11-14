/**
 * Nightly Vercel cron: plans tomorrow for every connected user.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/firebaseAdmin.js';
import { planForUser } from '../_lib/planner.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const snap = await db().collection('calendar_connections').where('status', '==', 'ok').get();
  const results: { uid: string; ok: boolean; blocks?: number; error?: string }[] = [];

  for (const doc of snap.docs) {
    if (doc.data().settings?.enabled === false) continue;
    try {
      const plan = await planForUser(doc.id, 'tomorrow');
      results.push({ uid: doc.id, ok: true, blocks: plan.blocks.length });
    } catch (e: any) {
      // one broken user must not stop the others
      console.error(`[cron] planning failed for ${doc.id}`, e);
      results.push({ uid: doc.id, ok: false, error: String(e?.message || e) });
    }
  }

  return res.status(200).json({ planned: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
}
