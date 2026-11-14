/**
 * Plans one day for one user: read busy times from Google Calendar,
 * place open tasks into the free gaps, write them into the DayFlow calendar.
 *
 * Re-running for the same day is safe: the previous DayFlow blocks of that
 * day are removed first, so you never get duplicates.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';
import * as google from './google.js';
import {
  planIntoFreeSlots,
  planFreeTime,
  pickLongBlockSlot,
  daysBetween,
  zonedTimeToUtc,
  localDateString,
  addDays,
  DEFAULT_FREE_SLOT_CONFIG,
  type FreeSlotConfig,
} from '../../packages/core/src/freeSlotScheduling.js';
import type { Task } from '../../packages/core/src/models.js';

export interface CalendarSettings {
  enabled: boolean;
  windowStartHour: number;
  windowEndHour: number;
  maxBlocks: number;
  maxPlannedMinutes: number;
  /** Fill the gaps left after tasks with free-time blocks */
  freeTimeEnabled: boolean;
  freeTimeIdeas: string[];
  /** Reserve a longer sport block every few days */
  sportEnabled: boolean;
  sportEveryDays: number;
  sportMinutes: number;
  sportLabel: string;
  /** Kept free before every appointment from a calendar (way to uni etc.) */
  bufferBeforeEventsMinutes: number;
}

export const DEFAULT_FREE_TIME_IDEAS = ['Sport / Gym', 'Spaziergang', 'Freunde treffen', 'Lesen', 'Kochen', 'Musik / Hobby'];

export const DEFAULT_SETTINGS: CalendarSettings = {
  enabled: true,
  windowStartHour: DEFAULT_FREE_SLOT_CONFIG.windowStartHour,
  windowEndHour: DEFAULT_FREE_SLOT_CONFIG.windowEndHour,
  maxBlocks: DEFAULT_FREE_SLOT_CONFIG.maxBlocks,
  maxPlannedMinutes: DEFAULT_FREE_SLOT_CONFIG.maxPlannedMinutes,
  freeTimeEnabled: true,
  freeTimeIdeas: DEFAULT_FREE_TIME_IDEAS,
  sportEnabled: true,
  sportEveryDays: 2,
  sportMinutes: 120,
  sportLabel: 'Sport / Gym',
  bufferBeforeEventsMinutes: 30,
};

/**
 * Times DayFlow must not plan into: appointments from the user's other
 * calendars plus appointments the user added via the assistant (DayFlow
 * calendar, no task id). Each starts `bufferBefore` minutes earlier.
 */
async function fixedBusy(
  accessToken: string,
  calendarId: string,
  from: Date,
  to: Date,
  bufferBefore: number,
  own?: google.CalendarEvent[]
): Promise<{ start: Date; end: Date }[]> {
  const calendarIds = (await google.listVisibleCalendarIds(accessToken)).filter((id) => id !== calendarId);
  const external = await google.freeBusy(accessToken, calendarIds, from, to);
  const ownEvents = own ?? (await google.listEvents(accessToken, calendarId, from, to));
  const appointments = ownEvents
    .filter((e) => e.start.dateTime && e.end.dateTime && !e.extendedProperties?.private?.dayflow_task_id && e.transparency !== 'transparent')
    .map((e) => ({ start: new Date(e.start.dateTime!), end: new Date(e.end.dateTime!) }));
  const ms = bufferBefore * 60_000;
  return [...external, ...appointments].map((b) => ({ start: new Date(b.start.getTime() - ms), end: b.end }));
}

export interface CalendarConnection {
  refresh_token: string;
  calendar_id: string;
  timezone: string;
  status: 'ok' | 'needs_reauth';
  settings: CalendarSettings;
  last_plan?: unknown;
  /** local date (YYYY-MM-DD) of the last planned sport block */
  last_sport_date?: string;
}

/**
 * Server-only collection. Clients cannot read it: firestore.rules denies
 * everything outside /users/{uid}, so the refresh token never reaches a browser.
 */
export const connectionRef = (uid: string) => db().doc(`calendar_connections/${uid}`);

/** Firestore Timestamp | Date | string | number -> Date */
function toDate(v: any): Date | undefined {
  if (!v) return undefined;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function loadOpenTasks(uid: string): Promise<Task[]> {
  // 'scheduled'/'in_progress' come from the old local planner; still to do
  const snap = await db().collection(`users/${uid}/items`).where('status', 'in', ['open', 'scheduled', 'in_progress']).get();
  return snap.docs
    .map((doc): any => ({ id: doc.id, ...doc.data() }))
    // the items collection can also hold ideas/events
    .filter((d: any) => !d.type || d.type === 'task')
    .filter((d: any) => typeof d.title === 'string' && d.title.length > 0)
    .map((d: any) => ({
      ...d,
      importance: d.importance || 'medium',
      created_at: toDate(d.created_at) || new Date(0),
      updated_at: toDate(d.updated_at) || new Date(0),
      due_at: toDate(d.due_at),
    })) as Task[];
}

export type PlanDay = 'today' | 'tomorrow';

export interface PlanResult {
  date: string;
  blocks: { task_id: string; title: string; start: string; end: string; duration_minutes: number }[];
  free_time: { start: string; end: string; idea: string }[];
  sport: { start: string; end: string } | null;
  skipped_task_ids: string[];
  removed_previous: number;
}

export async function planForUser(uid: string, day: PlanDay, now = new Date()): Promise<PlanResult> {
  const ref = connectionRef(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Kalender ist nicht verbunden');
  const conn = snap.data() as CalendarConnection;
  const settings = { ...DEFAULT_SETTINGS, ...(conn.settings || {}) };
  const tz = conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone;

  let accessToken: string;
  try {
    accessToken = await google.refreshAccessToken(conn.refresh_token);
  } catch (e) {
    if (e instanceof google.GoogleAuthRevokedError) await ref.update({ status: 'needs_reauth' });
    throw e;
  }

  // The user may have deleted the DayFlow calendar by hand: recreate it
  let calendarId = conn.calendar_id;
  if (!calendarId || !(await google.calendarExists(accessToken, calendarId))) {
    calendarId = await google.createCalendar(accessToken, tz);
    await ref.update({ calendar_id: calendarId });
  }

  const today = localDateString(now, tz);
  const date = day === 'today' ? today : addDays(today, 1);
  const dayStart = zonedTimeToUtc(date, 0, 0, tz);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), 0, 0, tz);

  // Remove our own earlier blocks for that day BEFORE reading busy times,
  // otherwise re-planning would treat them as busy and drift the plan.
  const previous = await google.listPlannedEventIds(accessToken, calendarId, date);
  for (const id of previous) await google.deleteEvent(accessToken, calendarId, id);

  const [busy, tasks] = await Promise.all([
    fixedBusy(accessToken, calendarId, dayStart, dayEnd, settings.bufferBeforeEventsMinutes),
    loadOpenTasks(uid),
  ]);

  const config: FreeSlotConfig = {
    ...DEFAULT_FREE_SLOT_CONFIG,
    timezone: tz,
    windowStartHour: settings.windowStartHour,
    windowEndHour: settings.windowEndHour,
    maxBlocks: settings.maxBlocks,
    maxPlannedMinutes: settings.maxPlannedMinutes,
  };
  // Sport: if it is due (every N days), reserve it BEFORE the tasks, so a
  // full to-do list cannot crowd it out. Re-planning the same day counts as due.
  const sportDue =
    settings.sportEnabled &&
    (!conn.last_sport_date || conn.last_sport_date === date || daysBetween(conn.last_sport_date, date) >= settings.sportEveryDays);
  let sport = sportDue ? pickLongBlockSlot(planIntoFreeSlots([], busy, date, now, config).free_slots, settings.sportMinutes) : null;

  let plan = planIntoFreeSlots(tasks, sport ? [...busy, sport] : busy, date, now, config);

  // Not due, but the day has no tasks and room for it: suggest sport anyway
  if (!sport && settings.sportEnabled && plan.blocks.length === 0) {
    sport = pickLongBlockSlot(plan.remaining_slots, settings.sportMinutes);
    if (sport) plan = planIntoFreeSlots(tasks, [...busy, sport], date, now, config);
  }

  if (sport) {
    await google.insertEvent(accessToken, calendarId, {
      summary: `🏋️ ${settings.sportLabel}`,
      description: 'Von DayFlow eingeplant: Zeit für Bewegung.',
      start: sport.start,
      end: sport.end,
      timeZone: tz,
      taskId: 'sport',
      planDate: date,
      colorId: '6', // tangerine
      reminderMinutes: 15,
    });
  }

  for (const block of plan.blocks) {
    await google.insertEvent(accessToken, calendarId, {
      summary: `🎯 ${block.title}`,
      description: `Von DayFlow eingeplant · geschätzt ${block.duration_minutes} min`,
      start: block.start,
      end: block.end,
      timeZone: tz,
      taskId: block.task_id,
      planDate: date,
    });
  }

  const freeTime = settings.freeTimeEnabled ? planFreeTime(plan.remaining_slots, date, settings.freeTimeIdeas) : [];
  for (const block of freeTime) {
    await google.insertEvent(accessToken, calendarId, {
      summary: block.idea ? `🌿 Freizeit · ${block.idea}` : '🌿 Freizeit',
      description: block.idea
        ? `Keine Aufgabe eingeplant, die Zeit gehört dir. Vorschlag: ${block.idea}`
        : 'Keine Aufgabe eingeplant, die Zeit gehört dir.',
      start: block.start,
      end: block.end,
      timeZone: tz,
      taskId: 'free_time',
      planDate: date,
      transparent: true,
      colorId: '2', // sage green
      reminderMinutes: null,
    });
  }

  const result: PlanResult = {
    date,
    blocks: plan.blocks.map((b) => ({
      task_id: b.task_id,
      title: b.title,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      duration_minutes: b.duration_minutes,
    })),
    sport: sport ? { start: sport.start.toISOString(), end: sport.end.toISOString() } : null,
    free_time: freeTime.map((f) => ({ start: f.start.toISOString(), end: f.end.toISOString(), idea: f.idea })),
    skipped_task_ids: plan.skipped_task_ids,
    removed_previous: previous.length,
  };
  await ref.update({
    last_plan: { ...result, at: FieldValue.serverTimestamp() },
    status: 'ok',
    ...(sport ? { last_sport_date: date } : {}),
  });
  return result;
}

export type TimelineKind = 'task' | 'sport' | 'free' | 'event' | 'busy';

export interface TimelineItem {
  start: string;
  end: string;
  kind: TimelineKind;
  title: string;
  task_id?: string;
  location?: string;
}

export interface Timeline {
  connected: boolean;
  status?: 'ok' | 'needs_reauth';
  /** connected before event details were available: reconnect to see them */
  needs_upgrade?: boolean;
  date?: string;
  timezone?: string;
  window?: { start: string; end: string };
  all_day?: string[];
  items: TimelineItem[];
}

/**
 * Today's timeline for the "Heute" screen: DayFlow blocks (tasks, sport,
 * free time) plus the user's other appointments with title and place.
 * Connections made before the events scope existed only get free/busy
 * ("Termin") until the user reconnects.
 */
export async function getTimeline(uid: string, now = new Date()): Promise<Timeline> {
  const snap = await connectionRef(uid).get();
  const conn = snap.data() as (CalendarConnection & { scopes?: string[] }) | undefined;
  if (!conn?.refresh_token) return { connected: false, items: [] };
  if (conn.status === 'needs_reauth') return { connected: true, status: 'needs_reauth', items: [] };

  const settings = { ...DEFAULT_SETTINGS, ...(conn.settings || {}) };
  const tz = conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone;
  const date = localDateString(now, tz);
  const dayStart = zonedTimeToUtc(date, 0, 0, tz);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), 0, 0, tz);
  const canReadEvents = (conn.scopes || []).includes(google.EVENTS_READ_SCOPE);

  let accessToken: string;
  try {
    accessToken = await google.refreshAccessToken(conn.refresh_token);
  } catch (e) {
    if (e instanceof google.GoogleAuthRevokedError) {
      await connectionRef(uid).update({ status: 'needs_reauth' });
      return { connected: true, status: 'needs_reauth', items: [] };
    }
    throw e;
  }

  const calendarIds = (await google.listVisibleCalendarIds(accessToken)).filter((id) => id !== conn.calendar_id);
  const ownPromise = conn.calendar_id ? google.listEvents(accessToken, conn.calendar_id, dayStart, dayEnd) : Promise.resolve([]);

  const items: TimelineItem[] = [];
  const allDay: string[] = [];

  for (const e of await ownPromise) {
    if (!e.start.dateTime || !e.end.dateTime) continue;
    const taskId = e.extendedProperties?.private?.dayflow_task_id;
    const kind: TimelineKind = taskId === 'sport' ? 'sport' : taskId === 'free_time' ? 'free' : taskId ? 'task' : 'event';
    items.push({
      start: new Date(e.start.dateTime).toISOString(),
      end: new Date(e.end.dateTime).toISOString(),
      kind,
      title: (e.summary || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Block',
      ...(kind === 'task' ? { task_id: taskId } : {}),
    });
  }

  if (canReadEvents) {
    const lists = await Promise.all(
      calendarIds.slice(0, 20).map((id) => google.listEvents(accessToken, id, dayStart, dayEnd).catch(() => []))
    );
    for (const e of lists.flat()) {
      if (e.status === 'cancelled') continue;
      if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
      const title = (e.summary || '').trim() || 'Termin';
      if (!e.start.dateTime || !e.end.dateTime) {
        allDay.push(title);
        continue;
      }
      items.push({
        start: new Date(e.start.dateTime).toISOString(),
        end: new Date(e.end.dateTime).toISOString(),
        kind: 'event',
        title,
        ...(e.location ? { location: e.location.slice(0, 120) } : {}),
      });
    }
  } else {
    for (const b of await google.freeBusy(accessToken, calendarIds, dayStart, dayEnd)) {
      items.push({ start: b.start.toISOString(), end: b.end.toISOString(), kind: 'busy', title: 'Termin' });
    }
  }
  items.sort((a, b) => a.start.localeCompare(b.start));

  return {
    connected: true,
    status: 'ok',
    ...(canReadEvents ? {} : { needs_upgrade: true }),
    date,
    timezone: tz,
    window: {
      start: zonedTimeToUtc(date, settings.windowStartHour, 0, tz).toISOString(),
      end: zonedTimeToUtc(date, settings.windowEndHour, 0, tz).toISOString(),
    },
    all_day: allDay,
    items,
  };
}

export interface WeekDay {
  date: string;
  all_day: string[];
  items: TimelineItem[];
}

/**
 * Seven days starting at `start` (YYYY-MM-DD, local): DayFlow blocks and the
 * user's own appointments, for the week view.
 */
export async function getWeek(uid: string, start: string): Promise<{ connected: boolean; status?: string; needs_upgrade?: boolean; window?: { startHour: number; endHour: number }; days: WeekDay[] }> {
  const snap = await connectionRef(uid).get();
  const conn = snap.data() as (CalendarConnection & { scopes?: string[] }) | undefined;
  if (!conn?.refresh_token) return { connected: false, days: [] };
  if (conn.status === 'needs_reauth') return { connected: true, status: 'needs_reauth', days: [] };

  const settings = { ...DEFAULT_SETTINGS, ...(conn.settings || {}) };
  const tz = conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone;
  const from = zonedTimeToUtc(start, 0, 0, tz);
  const to = zonedTimeToUtc(addDays(start, 7), 0, 0, tz);
  const canReadEvents = (conn.scopes || []).includes(google.EVENTS_READ_SCOPE);

  let accessToken: string;
  try {
    accessToken = await google.refreshAccessToken(conn.refresh_token);
  } catch (e) {
    if (e instanceof google.GoogleAuthRevokedError) {
      await connectionRef(uid).update({ status: 'needs_reauth' });
      return { connected: true, status: 'needs_reauth', days: [] };
    }
    throw e;
  }

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), all_day: [], items: [] }));
  const dayOf = (iso: string) => days.find((d) => d.date === localDateString(new Date(iso), tz));

  const calendarIds = (await google.listVisibleCalendarIds(accessToken)).filter((id) => id !== conn.calendar_id);
  const own = conn.calendar_id ? await google.listEvents(accessToken, conn.calendar_id, from, to) : [];
  for (const e of own) {
    if (!e.start.dateTime || !e.end.dateTime) continue;
    const taskId = e.extendedProperties?.private?.dayflow_task_id;
    const kind: TimelineKind = taskId === 'sport' ? 'sport' : taskId === 'free_time' ? 'free' : taskId ? 'task' : 'event';
    dayOf(e.start.dateTime)?.items.push({
      start: new Date(e.start.dateTime).toISOString(),
      end: new Date(e.end.dateTime).toISOString(),
      kind,
      title: (e.summary || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Block',
      ...(kind === 'task' ? { task_id: taskId } : {}),
    });
  }

  if (canReadEvents) {
    const lists = await Promise.all(calendarIds.slice(0, 20).map((id) => google.listEvents(accessToken, id, from, to).catch(() => [])));
    for (const e of lists.flat()) {
      if (e.status === 'cancelled' || e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
      const title = (e.summary || '').trim() || 'Termin';
      if (!e.start.dateTime || !e.end.dateTime) {
        // all-day (end date is exclusive)
        const s0 = e.start.date;
        const e0 = e.end.date;
        if (s0) for (const d of days) if (d.date >= s0 && (!e0 || d.date < e0)) d.all_day.push(title);
        continue;
      }
      dayOf(e.start.dateTime)?.items.push({
        start: new Date(e.start.dateTime).toISOString(),
        end: new Date(e.end.dateTime).toISOString(),
        kind: 'event',
        title,
        ...(e.location ? { location: e.location.slice(0, 120) } : {}),
      });
    }
  } else {
    for (const b of await google.freeBusy(accessToken, calendarIds, from, to)) {
      dayOf(b.start.toISOString())?.items.push({ start: b.start.toISOString(), end: b.end.toISOString(), kind: 'busy', title: 'Termin' });
    }
  }
  for (const d of days) d.items.sort((a, b) => a.start.localeCompare(b.start));

  return {
    connected: true,
    status: 'ok',
    ...(canReadEvents ? {} : { needs_upgrade: true }),
    window: { startHour: settings.windowStartHour, endHour: settings.windowEndHour },
    days,
  };
}

/** Saves a confirmed appointment into the user's DayFlow calendar. */
export async function addAppointment(uid: string, ev: { title: string; start: Date; end: Date; location?: string }) {
  const snap = await connectionRef(uid).get();
  const conn = snap.data() as CalendarConnection | undefined;
  if (!conn?.refresh_token || !conn.calendar_id) throw new Error('Kalender ist nicht verbunden');
  const accessToken = await google.refreshAccessToken(conn.refresh_token);
  return google.insertAppointment(accessToken, conn.calendar_id, { ...ev, timeZone: conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone });
}

export interface ExtendResult {
  end: string;
  /** minutes actually added (less than asked when an appointment is in the way) */
  added: number;
  moved: number;
  dropped: string[];
}

/**
 * "Brauche länger": the running block of this task gets longer and the DayFlow
 * blocks after it move back. Appointments (other calendars and ones added via
 * the assistant) never move and keep their buffer. Blocks pushed past the
 * planning window are removed; their tasks stay open for tomorrow.
 */
export async function extendTask(uid: string, taskId: string, minutes: number, now = new Date()): Promise<ExtendResult> {
  const snap = await connectionRef(uid).get();
  const conn = snap.data() as CalendarConnection | undefined;
  if (!conn?.refresh_token || !conn.calendar_id) throw new Error('Kalender ist nicht verbunden');
  const settings = { ...DEFAULT_SETTINGS, ...(conn.settings || {}) };
  const tz = conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone;
  const calendarId = conn.calendar_id;
  const accessToken = await google.refreshAccessToken(conn.refresh_token);

  const date = localDateString(now, tz);
  const dayStart = zonedTimeToUtc(date, 0, 0, tz);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), 0, 0, tz);
  const windowEnd = zonedTimeToUtc(date, settings.windowEndHour, 0, tz).getTime();
  const gap = DEFAULT_FREE_SLOT_CONFIG.bufferMinutes * 60_000;

  const own = (await google.listEvents(accessToken, calendarId, dayStart, dayEnd)).filter((e) => e.start.dateTime && e.end.dateTime);
  const startOf = (e: google.CalendarEvent) => new Date(e.start.dateTime!).getTime();
  const endOf = (e: google.CalendarEvent) => new Date(e.end.dateTime!).getTime();
  const taskOf = (e: google.CalendarEvent) => e.extendedProperties?.private?.dayflow_task_id;
  const t = now.getTime();

  const block = own
    .filter((e) => taskOf(e) === taskId && endOf(e) > t)
    .sort((a, b) => startOf(a) - startOf(b))[0];
  if (!block) throw new Error('Kein Block für diese Aufgabe gefunden');

  const fixed = (await fixedBusy(accessToken, calendarId, now, dayEnd, settings.bufferBeforeEventsMinutes, own))
    .map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }))
    .sort((a, b) => a.start - b.start);
  const clash = (s: number, e: number) => fixed.find((f) => s < f.end && e > f.start);

  // 1) Longer block, but never into an appointment (or its buffer)
  let newEnd = endOf(block) + minutes * 60_000;
  const hit = clash(endOf(block), newEnd);
  if (hit) newEnd = Math.max(endOf(block), hit.start);
  const added = Math.round((newEnd - endOf(block)) / 60_000);
  if (added > 0) await google.patchEventTimes(accessToken, calendarId, block.id, new Date(startOf(block)), new Date(newEnd), tz);

  // 2) Following DayFlow blocks (tasks, sport) move back as needed
  const movable = own
    .filter((e) => e.id !== block.id && taskOf(e) && taskOf(e) !== 'free_time' && startOf(e) >= startOf(block))
    .sort((a, b) => startOf(a) - startOf(b));
  let cursor = newEnd + gap;
  let moved = 0;
  const dropped: string[] = [];
  const placed: { start: number; end: number }[] = [{ start: startOf(block), end: newEnd }];
  for (const e of movable) {
    const dur = endOf(e) - startOf(e);
    let s = Math.max(startOf(e), cursor);
    for (let f = clash(s, s + dur); f; f = clash(s, s + dur)) s = f.end + gap;
    if (s + dur > windowEnd) {
      await google.deleteEvent(accessToken, calendarId, e.id);
      dropped.push((e.summary || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Block');
      continue;
    }
    if (s !== startOf(e)) {
      await google.patchEventTimes(accessToken, calendarId, e.id, new Date(s), new Date(s + dur), tz);
      moved++;
    }
    placed.push({ start: s, end: s + dur });
    cursor = s + dur + gap;
  }

  // 3) Free time gives way to whatever now overlaps it
  for (const e of own.filter((x) => taskOf(x) === 'free_time')) {
    let fs = startOf(e);
    let fe = endOf(e);
    for (const p of placed) {
      if (p.end <= fs || p.start >= fe) continue;
      if (p.start - fs >= fe - p.end) fe = p.start;
      else fs = p.end;
    }
    if (fe - fs < 15 * 60_000) await google.deleteEvent(accessToken, calendarId, e.id);
    else if (fs !== startOf(e) || fe !== endOf(e)) await google.patchEventTimes(accessToken, calendarId, e.id, new Date(fs), new Date(fe), tz);
  }

  return { end: new Date(newEnd).toISOString(), added, moved, dropped };
}

export interface PlaceResult {
  placed: boolean;
  start?: string;
  end?: string;
}

/**
 * Puts one task into the first free gap today that fits (after now), without
 * touching the rest of the plan. Appointments keep their buffer, free time
 * gives way. No gap: nothing happens, the task waits for tomorrow's plan.
 */
export async function placeTaskToday(uid: string, task: { id: string; title: string; minutes: number }, now = new Date()): Promise<PlaceResult> {
  const snap = await connectionRef(uid).get();
  const conn = snap.data() as CalendarConnection | undefined;
  if (!conn?.refresh_token || !conn.calendar_id) throw new Error('Kalender ist nicht verbunden');
  const settings = { ...DEFAULT_SETTINGS, ...(conn.settings || {}) };
  const tz = conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone;
  const calendarId = conn.calendar_id;
  const accessToken = await google.refreshAccessToken(conn.refresh_token);

  const date = localDateString(now, tz);
  const dayStart = zonedTimeToUtc(date, 0, 0, tz);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), 0, 0, tz);
  const own = (await google.listEvents(accessToken, calendarId, dayStart, dayEnd)).filter((e) => e.start.dateTime && e.end.dateTime);
  const taskOf = (e: google.CalendarEvent) => e.extendedProperties?.private?.dayflow_task_id;

  const busy = await fixedBusy(accessToken, calendarId, now, dayEnd, settings.bufferBeforeEventsMinutes, own);
  for (const e of own) {
    const id = taskOf(e);
    if (id && id !== 'free_time') busy.push({ start: new Date(e.start.dateTime!), end: new Date(e.end.dateTime!) });
  }
  const config: FreeSlotConfig = { ...DEFAULT_FREE_SLOT_CONFIG, timezone: tz, windowStartHour: settings.windowStartHour, windowEndHour: settings.windowEndHour };
  const ms = task.minutes * 60_000;
  const slot = planIntoFreeSlots([], busy, date, now, config).free_slots.find((s) => s.end.getTime() - s.start.getTime() >= ms);
  if (!slot) return { placed: false };

  const start = slot.start;
  const end = new Date(start.getTime() + ms);
  await google.insertEvent(accessToken, calendarId, {
    summary: `🎯 ${task.title}`,
    description: `Von DayFlow eingeplant · geschätzt ${task.minutes} min`,
    start,
    end,
    timeZone: tz,
    taskId: task.id,
    planDate: date,
  });

  for (const e of own.filter((x) => taskOf(x) === 'free_time')) {
    let fs = new Date(e.start.dateTime!).getTime();
    let fe = new Date(e.end.dateTime!).getTime();
    if (fe <= start.getTime() || fs >= end.getTime()) continue;
    if (start.getTime() - fs >= fe - end.getTime()) fe = start.getTime();
    else fs = end.getTime();
    if (fe - fs < 15 * 60_000) await google.deleteEvent(accessToken, calendarId, e.id);
    else await google.patchEventTimes(accessToken, calendarId, e.id, new Date(fs), new Date(fe), tz);
  }
  return { placed: true, start: start.toISOString(), end: end.toISOString() };
}
