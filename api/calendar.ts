/**
 * Google Calendar integration, one function for all actions (keeps the
 * Vercel function count low). vercel.json rewrites /api/calendar/:action
 * to /api/calendar?action=:action (dynamic [action] files are not matched
 * because of the catch-all SPA rewrite):
 *
 *   POST /api/calendar/connect     -> { url }  start Google OAuth (auth)
 *   GET  /api/calendar/callback    <- Google redirects here
 *   GET  /api/calendar/status      -> connection + settings + last plan (auth)
 *   GET  /api/calendar/today       -> today's timeline for the Heute screen (auth)
 *   GET  /api/calendar/week?start=YYYY-MM-DD -> 7 days for the week view (auth)
 *   POST /api/calendar/settings    { windowStartHour, windowEndHour, maxBlocks, maxPlannedMinutes, enabled, timezone } (auth)
 *   POST /api/calendar/plan        { day: 'today' | 'tomorrow' } -> plan (auth)
 *   POST /api/calendar/place       { task_id, title, minutes } -> one task into the next free gap today (auth)
 *   POST /api/calendar/extend      { task_id, minutes } -> running block longer, later DayFlow blocks move back (auth)
 *   POST /api/calendar/event       { title, start_at, end_at, location? } -> appointment in DayFlow calendar (auth)
 *   POST /api/calendar/resolve     { task_id } -> block that collides with an appointment moves away (auth)
 *   POST /api/calendar/undo        -> restores the day before the last change (auth)
 *   POST /api/calendar/local       { timezone } -> use DayFlow without Google (auth)
 *   POST /api/calendar/links       { urls: string[] } -> calendar links (.ics, e.g. iCloud) to respect (auth)
 *   GET  /api/feed/:token          -> the plan as subscribable calendar (.ics), no login (secret token)
 *   POST /api/calendar/disconnect  revoke + delete connection (auth)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser, HttpError } from './_lib/firebaseAdmin.js';
import * as google from './_lib/google.js';
import { createState, verifyState } from './_lib/oauthState.js';
import { connectionRef, planForUser, getTimeline, getWeek, addAppointment, extendTask, placeTaskToday, resolveConflict, undoLast, logDone, DEFAULT_SETTINGS, type CalendarConnection, type CalendarSettings } from './_lib/planner.js';
import { providerOf, NotConnectedError, NeedsReauthError, newFeedToken, readCalendarLink, openWorkspace } from './_lib/workspace.js';
import { buildIcs, normalizeCalendarUrl } from './_lib/ics.js';
import { db } from './_lib/firebaseAdmin.js';
import { addDays, localDateString, zonedTimeToUtc } from '../packages/core/src/freeSlotScheduling.js';

function appUrl(path: string): string {
  const base = process.env.APP_URL || '';
  return `${base}${path}`;
}

function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function sanitizeSettings(input: any, current: CalendarSettings): CalendarSettings {
  const int = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
  const s: CalendarSettings = {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : current.enabled,
    windowStartHour: int(input?.windowStartHour, 0, 23, current.windowStartHour),
    windowEndHour: int(input?.windowEndHour, 1, 24, current.windowEndHour),
    maxBlocks: int(input?.maxBlocks, 0, 10, current.maxBlocks),
    maxPlannedMinutes: int(input?.maxPlannedMinutes, 15, 720, current.maxPlannedMinutes),
    freeTimeEnabled: typeof input?.freeTimeEnabled === 'boolean' ? input.freeTimeEnabled : current.freeTimeEnabled,
    freeTimeIdeas: Array.isArray(input?.freeTimeIdeas)
      ? input.freeTimeIdeas
          .filter((i: unknown): i is string => typeof i === 'string')
          .map((i: string) => i.trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 12)
      : current.freeTimeIdeas,
    sportEnabled: typeof input?.sportEnabled === 'boolean' ? input.sportEnabled : current.sportEnabled,
    sportEveryDays: int(input?.sportEveryDays, 1, 7, current.sportEveryDays),
    sportMinutes: int(input?.sportMinutes, 30, 240, current.sportMinutes),
    sportLabel:
      typeof input?.sportLabel === 'string' && input.sportLabel.trim() ? input.sportLabel.trim().slice(0, 40) : current.sportLabel,
    bufferBeforeEventsMinutes: int(input?.bufferBeforeEventsMinutes, 0, 120, current.bufferBeforeEventsMinutes ?? 30),
  };
  if (s.windowEndHour <= s.windowStartHour) throw new HttpError(400, 'Ende muss nach dem Start liegen');
  return s;
}

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const back = (status: string) => res.redirect(302, appUrl(`/settings?calendar=${status}`));

  if (error) return back('denied');
  const uid = state ? verifyState(state) : null;
  if (!uid || !code) return back('error');

  try {
    const tokens = await google.exchangeCode(code);
    const granted = tokens.scope.split(' ');
    if (!google.SCOPES.every((s) => granted.includes(s))) return back('missing_scopes');
    if (!tokens.refresh_token) return back('error');

    const ref = connectionRef(uid);
    const existing = (await ref.get()).data() as Partial<CalendarConnection> | undefined;
    const timezone = existing?.timezone || 'Europe/Berlin';

    let calendarId = existing?.calendar_id;
    if (!calendarId || !(await google.calendarExists(tokens.access_token, calendarId))) {
      calendarId = await google.createCalendar(tokens.access_token, timezone);
    }

    await ref.set(
      {
        provider: 'google',
        refresh_token: tokens.refresh_token,
        calendar_id: calendarId,
        timezone,
        status: 'ok',
        scopes: granted,
        settings: { ...DEFAULT_SETTINGS, ...(existing?.settings || {}) },
        connected_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return back('connected');
  } catch (e) {
    console.error('[calendar] callback failed', e);
    return back('error');
  }
}

/**
 * The plan as a calendar feed (.ics) for Apple/Google calendar subscriptions.
 * No login: the long random token in the URL is the key.
 */
async function handleFeed(req: VercelRequest, res: VercelResponse) {
  const token = String(req.query.t || '');
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return res.status(404).send('Not found');
  const hit = await db().collection('calendar_connections').where('feed_token', '==', token).limit(1).get();
  if (hit.empty) return res.status(404).send('Not found');
  const uid = hit.docs[0].id;
  const ws = await openWorkspace(uid);
  const today = localDateString(new Date(), ws.tz);
  const from = zonedTimeToUtc(addDays(today, -7), 0, 0, ws.tz);
  const to = zonedTimeToUtc(addDays(today, 30), 0, 0, ws.tz);
  const blocks = (await ws.blocks.list(from, to)).filter((b) => b.kind !== 'free');
  const ics = buildIcs(
    'DayFlow',
    blocks.map((b) => ({
      uid: `${uid.slice(0, 8)}-${b.id}`,
      title: b.title,
      start: b.start,
      end: b.end,
      description: b.description,
      location: b.location,
      alarmMinutes: b.kind === 'appointment' ? 30 : b.kind === 'sport' ? 15 : 5,
    }))
  );
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(ics);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '');
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (action === 'callback' && req.method === 'GET') return await handleCallback(req, res);
    if (action === 'feed' && req.method === 'GET') return await handleFeed(req, res);

    if (req.method !== 'POST' && !((action === 'status' || action === 'today' || action === 'week') && req.method === 'GET')) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const uid = await requireUser(req);
    const ref = connectionRef(uid);

    switch (action) {
      case 'connect': {
        // Remember the browser's time zone for planning
        const tz = req.body?.timezone;
        if (isValidTimeZone(tz)) await ref.set({ timezone: tz }, { merge: true });
        return res.status(200).json({ url: google.authUrl(createState(uid)) });
      }

      case 'status': {
        const snap = await ref.get();
        const c = snap.data() as (CalendarConnection & { last_plan?: any }) | undefined;
        const provider = providerOf(c);
        if (!c || !provider) return res.status(200).json({ connected: false });
        let feedToken = c.feed_token;
        if (provider === 'local' && !feedToken) {
          feedToken = newFeedToken();
          await ref.set({ feed_token: feedToken }, { merge: true });
        }
        return res.status(200).json({
          connected: true,
          provider,
          ics_urls: c.ics_urls || [],
          feed_url: feedToken ? appUrl(`/api/feed/${feedToken}`) : null,
          status: c.status,
          timezone: c.timezone,
          settings: { ...DEFAULT_SETTINGS, ...(c.settings || {}) },
          last_plan: c.last_plan ? { ...c.last_plan, at: c.last_plan.at?.toDate?.()?.toISOString() ?? null } : null,
        });
      }

      case 'week': {
        const start = String(req.query.start || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new HttpError(400, 'start=YYYY-MM-DD fehlt');
        return res.status(200).json(await getWeek(uid, start));
      }

      case 'today': {
        return res.status(200).json(await getTimeline(uid));
      }

      case 'settings': {
        const snap = await ref.get();
        const current = { ...DEFAULT_SETTINGS, ...((snap.data() as any)?.settings || {}) };
        const settings = sanitizeSettings(req.body, current);
        const update: Record<string, unknown> = { settings };
        if (isValidTimeZone(req.body?.timezone)) update.timezone = req.body.timezone;
        await ref.set(update, { merge: true });
        return res.status(200).json({ settings });
      }

      case 'plan': {
        const day = req.body?.day === 'today' ? 'today' : 'tomorrow';
        const result = await planForUser(uid, day);
        return res.status(200).json(result);
      }

      case 'place': {
        const { task_id, title } = req.body || {};
        const minutes = Number(req.body?.minutes);
        if (typeof task_id !== 'string' || !task_id || typeof title !== 'string' || !title.trim()) throw new HttpError(400, 'task_id und title fehlen');
        if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) throw new HttpError(400, 'minutes: 5-480');
        return res.status(200).json(await placeTaskToday(uid, { id: task_id, title: title.trim().slice(0, 200), minutes }));
      }

      case 'extend': {
        const taskId = req.body?.task_id;
        const minutes = Number(req.body?.minutes);
        if (typeof taskId !== 'string' || !taskId || taskId === 'free_time') throw new HttpError(400, 'task_id fehlt');
        if (![15, 30, 60].includes(minutes)) throw new HttpError(400, 'minutes: 15, 30 oder 60');
        return res.status(200).json(await extendTask(uid, taskId, minutes));
      }

      case 'event': {
        const { title, start_at, end_at, location } = req.body || {};
        const start = new Date(start_at);
        const end = new Date(end_at);
        if (typeof title !== 'string' || !title.trim() || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
          throw new HttpError(400, 'Titel, Start und Ende werden gebraucht');
        }
        const ev = await addAppointment(uid, {
          title: title.trim().slice(0, 200),
          start,
          end,
          location: typeof location === 'string' && location.trim() ? location.trim().slice(0, 200) : undefined,
        });
        return res.status(200).json({ id: ev.id, link: ev.link });
      }

      case 'resolve': {
        const taskId = req.body?.task_id;
        if (typeof taskId !== 'string' || !taskId) throw new HttpError(400, 'task_id fehlt');
        return res.status(200).json(await resolveConflict(uid, taskId));
      }

      case 'done': {
        const taskId = req.body?.task_id;
        if (typeof taskId !== 'string' || !taskId) throw new HttpError(400, 'task_id fehlt');
        await logDone(uid, taskId);
        return res.status(200).json({ ok: true });
      }

      case 'undo': {
        return res.status(200).json(await undoLast(uid));
      }

      case 'local': {
        // DayFlow without Google: the plan lives in DayFlow (+ subscribable feed)
        const snap = await ref.get();
        const existing = snap.data() as Partial<CalendarConnection> | undefined;
        if (providerOf(existing) === 'google') throw new HttpError(409, 'Google Kalender ist verbunden. Erst trennen.');
        const tz = isValidTimeZone(req.body?.timezone) ? req.body.timezone : existing?.timezone || 'Europe/Berlin';
        await ref.set(
          {
            provider: 'local',
            timezone: tz,
            status: 'ok',
            settings: { ...DEFAULT_SETTINGS, ...(existing?.settings || {}) },
            feed_token: existing?.feed_token || newFeedToken(),
            ics_urls: existing?.ics_urls || [],
            connected_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return res.status(200).json({ connected: true, provider: 'local' });
      }

      case 'links': {
        const snap = await ref.get();
        const c = snap.data() as CalendarConnection | undefined;
        if (providerOf(c) !== 'local') throw new HttpError(409, 'Kalender-Links gibt es nur ohne Google-Verbindung');
        const raw: unknown[] = Array.isArray(req.body?.urls) ? req.body.urls.slice(0, 5) : [];
        const urls: string[] = [];
        for (const u of raw) {
          if (typeof u !== 'string' || !u.trim()) continue;
          const url = normalizeCalendarUrl(u);
          if (!url) throw new HttpError(400, 'Das ist kein gültiger Kalender-Link');
          // check it really is a calendar before saving it
          try {
            const now = new Date();
            await readCalendarLink(url, now, new Date(now.getTime() + 86_400_000), c!.timezone || 'Europe/Berlin');
          } catch (e: any) {
            throw new HttpError(400, `Link geht nicht: ${e?.message || e}`);
          }
          urls.push(url);
        }
        await ref.update({ ics_urls: urls });
        return res.status(200).json({ ics_urls: urls });
      }

      case 'disconnect': {
        const snap = await ref.get();
        const token = (snap.data() as any)?.refresh_token;
        if (token) await google.revokeToken(token);
        await ref.delete();
        return res.status(200).json({ connected: false });
      }

      default:
        return res.status(404).json({ error: 'Unknown action' });
    }
  } catch (e: any) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    if (e instanceof NotConnectedError) return res.status(409).json({ error: 'Richte zuerst in den Einstellungen deinen Kalender ein', code: 'not_connected' });
    if (e instanceof google.GoogleAuthRevokedError || e instanceof NeedsReauthError) {
      return res.status(409).json({ error: 'Google-Zugriff abgelaufen, bitte Kalender neu verbinden', code: 'needs_reauth' });
    }
    console.error(`[calendar] ${action} failed`, e);
    return res.status(500).json({ error: e?.message || 'Interner Fehler' });
  }
}
