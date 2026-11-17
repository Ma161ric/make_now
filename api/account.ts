/**
 * Your data in DayFlow.
 *
 *   GET  /api/account                          what is stored (counts)
 *   POST /api/account { action: 'forget_learning' }  delete the learned times (time_log)
 *   POST /api/account { action: 'delete_all' }       delete everything incl. the account
 *   POST /api/account { action: 'export' }           everything stored about you, as JSON (DSGVO Art. 15/20)
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

/** Firestore values to plain JSON (timestamps as ISO text) */
function plain(v: any): any {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

async function exportEverything(uid: string) {
  const firestore = db();
  const user = await adminAuth().getUser(uid);
  const userCols = await firestore.doc(`users/${uid}`).listCollections();
  const collections: Record<string, unknown[]> = {};
  for (const col of userCols) {
    const snap = await col.get();
    collections[col.id] = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  }
  const conn = (await firestore.doc(`calendar_connections/${uid}`).get()).data() || null;
  // keys and tokens stay out of the file: they are access keys, not data about you
  const { refresh_token, feed_token, undo, ...connection } = (conn || {}) as Record<string, unknown>;
  const blocks = await firestore.collection(`dayflow_blocks/${uid}/items`).get();
  const devices = await firestore.collection(`push_subscriptions/${uid}/devices`).get();
  const usage = await firestore.collection('ai_usage').where(FieldPath.documentId(), '>=', `${uid}_`).where(FieldPath.documentId(), '<', `${uid}_~`).get();
  return {
    exported_at: new Date().toISOString(),
    account: {
      uid,
      email: user.email ?? null,
      email_verified: user.emailVerified,
      name: user.displayName ?? null,
      sign_in: user.providerData.map((p) => p.providerId),
      created: user.metadata.creationTime,
      last_sign_in: user.metadata.lastSignInTime,
    },
    data: collections,
    calendar: conn ? { ...plain(connection), google_connected: Boolean(refresh_token), subscribe_link_active: Boolean(feed_token) } : null,
    dayflow_blocks: blocks.docs.map((d) => ({ id: d.id, ...plain(d.data()) })),
    reminder_devices: devices.docs.map((d) => ({ user_agent: d.data().ua ?? d.data().user_agent ?? null, added: plain(d.data().created_at ?? d.data().at ?? null) })),
    ai_usage_per_day: usage.docs.map((d) => plain(d.data())),
  };
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
    if (action === 'export') {
      res.setHeader('Content-Disposition', 'attachment; filename="dayflow-daten.json"');
      return res.status(200).json(await exportEverything(uid));
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
