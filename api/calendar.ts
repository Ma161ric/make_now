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
 *   POST /api/calendar/event       { title, start_at, end_at, location? } -> appointment in DayFlow calendar (auth)
 *   POST /api/calendar/disconnect  revoke + delete connection (auth)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser, HttpError } from './_lib/firebaseAdmin.js';
import * as google from './_lib/google.js';
import { createState, verifyState } from './_lib/oauthState.js';
import { connectionRef, planForUser, getTimeline, getWeek, addAppointment, DEFAULT_SETTINGS, type CalendarConnection, type CalendarSettings } from './_lib/planner.js';

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
    maxBlocks: int(input?.maxBlocks, 1, 10, current.maxBlocks),
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '');
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (action === 'callback' && req.method === 'GET') return await handleCallback(req, res);

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
        if (!snap.exists || !snap.data()?.refresh_token) return res.status(200).json({ connected: false });
        const c = snap.data() as CalendarConnection & { last_plan?: any };
        return res.status(200).json({
          connected: true,
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
        return res.status(200).json({ id: ev.id, link: ev.htmlLink });
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
    if (e instanceof google.GoogleAuthRevokedError) {
      return res.status(409).json({ error: 'Google-Zugriff abgelaufen, bitte Kalender neu verbinden', code: 'needs_reauth' });
    }
    console.error(`[calendar] ${action} failed`, e);
    return res.status(500).json({ error: e?.message || 'Interner Fehler' });
  }
}
