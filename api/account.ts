/**
 * Your data in DayFlow.
 *
 *   GET  /api/account                          what is stored (counts)
 *   POST /api/account { action: 'forget_learning' }  delete the learned times (time_log)
 *   POST /api/account { action: 'delete_all' }       delete everything incl. the account
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, adminAuth, requireUser, HttpError } from './_lib/firebaseAdmin.js';
import { FieldPath } from 'firebase-admin/firestore';
import * as google from './_lib/google.js';
import { loadLearning } from './_lib/learning.js';

async function deleteCollection(path: string): Promise<number> {
  const col = db().collection(path);
  let total = 0;
  for (;;) {
    const snap = await col.limit(400).get();
    if (snap.empty) return total;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
}

async function deleteEverything(uid: string): Promise<void> {
  const firestore = db();
  // Google: remove DayFlow's own calendar and give up the access
  const connRef = firestore.doc(`calendar_connections/${uid}`);
  const conn = (await connRef.get()).data() as { refresh_token?: string; calendar_id?: string } | undefined;
  if (conn?.refresh_token) {
    try {
      const token = await google.refreshAccessToken(conn.refresh_token);
      if (conn.calendar_id) await google.deleteCalendar(token, conn.calendar_id);
    } catch {
      /* access already gone: nothing to clean up there */
    }
    await google.revokeToken(conn.refresh_token);
  }
  await connRef.delete();
  await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
  await firestore.recursiveDelete(firestore.doc(`dayflow_blocks/${uid}`));
  await firestore.recursiveDelete(firestore.doc(`push_subscriptions/${uid}`));
  await firestore.doc(`push_state/${uid}`).delete().catch(() => {});
  // AI usage counters: ids are `${uid}_${date}`
  const usage = await firestore.collection('ai_usage').where(FieldPath.documentId(), '>=', `${uid}_`).where(FieldPath.documentId(), '<', `${uid}_~`).get();
  await Promise.all(usage.docs.map((d) => d.ref.delete()));
  await adminAuth().deleteUser(uid);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const uid = await requireUser(req);
    if (req.method === 'GET') {
      const [learned, learning] = await Promise.all([db().collection(`users/${uid}/time_log`).count().get(), loadLearning(uid)]);
      return res.status(200).json({ learned_entries: learned.data().count, learning });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const action = req.body?.action;
    if (action === 'forget_learning') {
      const deleted = await deleteCollection(`users/${uid}/time_log`);
      return res.status(200).json({ deleted });
    }
    if (action === 'delete_all') {
      if (req.body?.confirm !== 'LÖSCHEN') throw new HttpError(400, 'Bitte bestätigen');
      await deleteEverything(uid);
      return res.status(200).json({ deleted: true });
    }
    throw new HttpError(400, 'Unbekannte Aktion');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error('account error', e);
    return res.status(status).json({ error: status === 500 ? 'Hat nicht geklappt, bitte nochmal versuchen' : e.message });
  }
}
