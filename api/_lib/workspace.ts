/**
 * Where DayFlow keeps its plan and where it learns about the user's
 * appointments, independent of the planning logic:
 *
 *  provider 'google'  blocks live in the "DayFlow" Google calendar,
 *                     appointments come from the user's other Google calendars
 *  provider 'local'   blocks live in Firestore (server-only collection);
 *                     appointments come from an optional calendar link (.ics,
 *                     e.g. an iCloud calendar shared as public link) and from
 *                     the ones added in DayFlow itself. The plan can be
 *                     subscribed to as a calendar feed.
 *
 * A block remembers the times DayFlow planned it at. If the user moves it
 * elsewhere (e.g. in Google Calendar), it is "pinned": DayFlow never moves or
 * deletes it again on its own.
 */
import { randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';
import * as google from './google.js';
import { parseIcs, normalizeCalendarUrl } from './ics.js';
import { DEFAULT_FREE_SLOT_CONFIG } from '../../packages/core/src/freeSlotScheduling.js';
import type { CalendarConnection, CalendarSettings } from './planner.js';

export type BlockKind = 'task' | 'sport' | 'free' | 'appointment';

export interface Block {
  id: string;
  title: string;
  start: Date;
  end: Date;
  kind: BlockKind;
  /** task id, 'sport' or 'free_time'; none for appointments */
  taskId?: string;
  planDate?: string;
  /** where DayFlow put it (ISO); differs from start/end once the user moved it */
  plannedStart?: string;
  plannedEnd?: string;
  location?: string;
  description?: string;
  /** provider data needed to write the block back unchanged */
  meta?: Record<string, string>;
}

export type NewBlock = Omit<Block, 'id' | 'meta' | 'plannedStart' | 'plannedEnd'> & {
  reminderMinutes?: number | null;
  colorId?: string;
  transparent?: boolean;
};

export interface BlockStore {
  list(from: Date, to: Date): Promise<Block[]>;
  insert(b: NewBlock): Promise<string>;
  /** asPlanned: DayFlow moved it itself (not a manual change, so not pinned) */
  move(b: Block, start: Date, end: Date, asPlanned: boolean): Promise<void>;
  remove(b: Block): Promise<void>;
}

export interface ExternalEvent {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  allDay?: { startDate: string; endDate: string };
  /** only "busy" is known (old Google connections without the events scope) */
  busyOnly?: boolean;
  /** marked "free" in the user's calendar: shown, but does not block planning */
  transparent?: boolean;
}

export type Provider = 'google' | 'local';

export interface Workspace {
  uid: string;
  provider: Provider;
  conn: CalendarConnection;
  settings: CalendarSettings;
  tz: string;
  blocks: BlockStore;
  /** the user's appointments outside DayFlow (all-day ones included) */
  external(from: Date, to: Date): Promise<ExternalEvent[]>;
  needsUpgrade: boolean;
}

export class NotConnectedError extends Error {
  constructor() {
    super('Kalender ist nicht eingerichtet');
  }
}
export class NeedsReauthError extends Error {
  constructor() {
    super('Google-Zugriff abgelaufen, bitte Kalender neu verbinden');
  }
}

export const connectionRef = (uid: string) => db().doc(`calendar_connections/${uid}`);
const localBlocks = (uid: string) => db().collection(`dayflow_blocks/${uid}/items`);

export function providerOf(conn: Partial<CalendarConnection> | undefined): Provider | null {
  if (!conn) return null;
  if (conn.provider === 'local') return 'local';
  if (conn.refresh_token) return 'google';
  return null;
}

/** DayFlow put it there and the user has since moved it by hand */
export function isPinned(b: Block): boolean {
  if (b.kind !== 'task' && b.kind !== 'sport') return false;
  if (!b.plannedStart || !b.plannedEnd) return false;
  return Math.abs(b.start.getTime() - Date.parse(b.plannedStart)) > 60_000 || Math.abs(b.end.getTime() - Date.parse(b.plannedEnd)) > 60_000;
}

const kindOfTask = (taskId?: string): BlockKind =>
  !taskId ? 'appointment' : taskId === 'sport' ? 'sport' : taskId === 'free_time' ? 'free' : 'task';

const cleanTitle = (s?: string) => (s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Block';

// ------------------------------------------------------------------ Google

function googleStore(accessToken: string, calendarId: string, tz: string): BlockStore {
  const toBlock = (e: google.CalendarEvent): Block | null => {
    if (!e.start.dateTime || !e.end.dateTime) return null;
    const p = e.extendedProperties?.private || {};
    const taskId = p.dayflow_task_id;
    return {
      id: e.id,
      title: cleanTitle(e.summary),
      start: new Date(e.start.dateTime),
      end: new Date(e.end.dateTime),
      kind: kindOfTask(taskId),
      ...(taskId ? { taskId } : {}),
      ...(p.dayflow_plan_date ? { planDate: p.dayflow_plan_date } : {}),
      ...(p.dayflow_start ? { plannedStart: p.dayflow_start, plannedEnd: p.dayflow_end } : {}),
      ...(e.location ? { location: e.location } : {}),
      meta: p,
    };
  };
  return {
    async list(from, to) {
      const events = await google.listEvents(accessToken, calendarId, from, to);
      return events.map(toBlock).filter((b): b is Block => !!b);
    },
    async insert(b) {
      if (b.kind === 'appointment') {
        const ev = await google.insertAppointment(accessToken, calendarId, { title: b.title, start: b.start, end: b.end, timeZone: tz, location: b.location });
        return ev.id;
      }
      const ev = await google.insertEvent(accessToken, calendarId, {
        summary: b.title,
        description: b.description || 'Von DayFlow eingeplant',
        start: b.start,
        end: b.end,
        timeZone: tz,
        taskId: b.taskId!,
        planDate: b.planDate!,
        transparent: b.transparent,
        colorId: b.colorId,
        reminderMinutes: b.reminderMinutes,
      });
      return ev.id;
    },
    async move(b, start, end, asPlanned) {
      const priv = asPlanned && b.kind !== 'appointment' ? { ...(b.meta || {}), dayflow_start: start.toISOString(), dayflow_end: end.toISOString() } : undefined;
      await google.patchEvent(accessToken, calendarId, b.id, { start, end, timeZone: tz, privateProps: priv });
    },
    async remove(b) {
      await google.deleteEvent(accessToken, calendarId, b.id);
    },
  };
}

// ------------------------------------------------------------------- local

function localStore(uid: string): BlockStore {
  const col = localBlocks(uid);
  return {
    async list(from, to) {
      // overlap query: start < to, filter end > from in memory
      const snap = await col.where('start', '<', Timestamp.fromDate(to)).where('start', '>=', Timestamp.fromDate(new Date(from.getTime() - 24 * 3600_000))).get();
      return snap.docs
        .map((d): Block => {
          const x = d.data();
          return {
            id: d.id,
            title: x.title,
            start: x.start.toDate(),
            end: x.end.toDate(),
            kind: x.kind,
            ...(x.task_id ? { taskId: x.task_id } : {}),
            ...(x.plan_date ? { planDate: x.plan_date } : {}),
            ...(x.planned_start ? { plannedStart: x.planned_start, plannedEnd: x.planned_end } : {}),
            ...(x.location ? { location: x.location } : {}),
            ...(x.description ? { description: x.description } : {}),
          };
        })
        .filter((b) => b.end > from)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    },
    async insert(b) {
      const ref = col.doc();
      await ref.set({
        title: b.title,
        start: Timestamp.fromDate(b.start),
        end: Timestamp.fromDate(b.end),
        kind: b.kind,
        ...(b.taskId ? { task_id: b.taskId } : {}),
        ...(b.planDate ? { plan_date: b.planDate } : {}),
        ...(b.kind !== 'appointment' ? { planned_start: b.start.toISOString(), planned_end: b.end.toISOString() } : {}),
        ...(b.location ? { location: b.location } : {}),
        ...(b.description ? { description: b.description } : {}),
        ...(b.reminderMinutes !== undefined ? { reminder_minutes: b.reminderMinutes } : {}),
      });
      return ref.id;
    },
    async move(b, start, end, asPlanned) {
      await col.doc(b.id).update({
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
        ...(asPlanned && b.kind !== 'appointment' ? { planned_start: start.toISOString(), planned_end: end.toISOString() } : {}),
      });
    },
    async remove(b) {
      await col.doc(b.id).delete();
    },
  };
}

// --------------------------------------------------------------- external

/** fetched calendar links are cached a few minutes per server instance */
const icsCache = new Map<string, { at: number; text: string }>();

async function fetchIcs(url: string): Promise<string> {
  const hit = icsCache.get(url);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.text;
  let current = url;
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(current, { headers: { 'User-Agent': 'DayFlow/1.0 (+https://make-now.vercel.app)' }, signal: AbortSignal.timeout(8000), redirect: 'manual' });
    if (res.status < 300 || res.status >= 400) break;
    const next = res.headers.get('location');
    const safe = next ? normalizeCalendarUrl(new URL(next, current).toString()) : null;
    if (!safe) throw new Error('Kalender-Link leitet an eine unerlaubte Adresse weiter');
    current = safe;
    res = null;
  }
  if (!res) throw new Error('Zu viele Weiterleitungen');
  if (!res.ok) throw new Error(`Kalender-Link antwortet mit ${res.status}`);
  if (Number(res.headers.get('content-length') || 0) > 5_000_000) throw new Error('Kalender ist zu groß');
  const text = await res.text();
  if (text.length > 5_000_000) throw new Error('Kalender ist zu groß');
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Unter dem Link liegt kein Kalender');
  icsCache.set(url, { at: Date.now(), text });
  return text;
}

export async function readCalendarLink(url: string, from: Date, to: Date, tz: string): Promise<ExternalEvent[]> {
  return parseIcs(await fetchIcs(url), from, to, tz);
}

// ------------------------------------------------------------------- open

export async function openWorkspace(uid: string, opts: { ensureCalendar?: boolean } = {}): Promise<Workspace> {
  const ref = connectionRef(uid);
  const snap = await ref.get();
  const conn = snap.data() as (CalendarConnection & { scopes?: string[] }) | undefined;
  const provider = providerOf(conn);
  if (!conn || !provider) throw new NotConnectedError();

  const { DEFAULT_SETTINGS } = await import('./planner.js');
  const settings: CalendarSettings = { ...DEFAULT_SETTINGS, ...(conn.settings || {}) };
  const tz = conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone;

  if (provider === 'local') {
    const urls = (conn.ics_urls || []).filter(Boolean);
    return {
      uid,
      provider,
      conn,
      settings,
      tz,
      blocks: localStore(uid),
      needsUpgrade: false,
      async external(from, to) {
        const lists = await Promise.all(urls.map((u) => readCalendarLink(u, from, to, tz).catch((e) => {
          console.warn('[ics] link failed', String(e?.message || e));
          return [] as ExternalEvent[];
        })));
        return lists.flat();
      },
    };
  }

  if (conn.status === 'needs_reauth') throw new NeedsReauthError();
  let accessToken: string;
  try {
    accessToken = await google.refreshAccessToken(conn.refresh_token);
  } catch (e) {
    if (e instanceof google.GoogleAuthRevokedError) {
      await ref.update({ status: 'needs_reauth' });
      throw new NeedsReauthError();
    }
    throw e;
  }

  let calendarId = conn.calendar_id;
  if (opts.ensureCalendar && (!calendarId || !(await google.calendarExists(accessToken, calendarId)))) {
    calendarId = await google.createCalendar(accessToken, tz);
    await ref.update({ calendar_id: calendarId });
  }
  const canReadEvents = (conn.scopes || []).includes(google.EVENTS_READ_SCOPE);

  return {
    uid,
    provider,
    conn: { ...conn, calendar_id: calendarId },
    settings,
    tz,
    blocks: googleStore(accessToken, calendarId, tz),
    needsUpgrade: !canReadEvents,
    async external(from, to) {
      const calendarIds = (await google.listVisibleCalendarIds(accessToken)).filter((id) => id !== calendarId);
      if (!canReadEvents) {
        return (await google.freeBusy(accessToken, calendarIds, from, to)).map((b) => ({ title: 'Termin', start: b.start, end: b.end, busyOnly: true }));
      }
      const lists = await Promise.all(calendarIds.slice(0, 20).map((id) => google.listEvents(accessToken, id, from, to).catch(() => [])));
      const out: ExternalEvent[] = [];
      for (const e of lists.flat()) {
        if (e.status === 'cancelled' || e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
        const transparent = e.transparency === 'transparent';
        const title = (e.summary || '').trim() || 'Termin';
        if (!e.start.dateTime || !e.end.dateTime) {
          if (e.start.date) out.push({ title, start: new Date(`${e.start.date}T00:00:00Z`), end: new Date(`${e.end.date || e.start.date}T00:00:00Z`), allDay: { startDate: e.start.date, endDate: e.end.date || e.start.date } });
          continue;
        }
        out.push({
          title,
          start: new Date(e.start.dateTime),
          end: new Date(e.end.dateTime),
          ...(e.location ? { location: e.location.slice(0, 120) } : {}),
          ...(transparent ? { transparent } : {}),
        });
      }
      return out;
    },
  };
}

export const newFeedToken = () => randomBytes(18).toString('base64url');
