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
};

export interface CalendarConnection {
  refresh_token: string;
  calendar_id: string;
  timezone: string;
  status: 'ok' | 'needs_reauth';
  settings: CalendarSettings;
  last_plan?: unknown;
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
  const snap = await db().collection(`users/${uid}/items`).where('status', '==', 'open').get();
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

  const calendarIds = (await google.listVisibleCalendarIds(accessToken)).filter((id) => id !== calendarId);
  const [busy, tasks] = await Promise.all([google.freeBusy(accessToken, calendarIds, dayStart, dayEnd), loadOpenTasks(uid)]);

  const config: FreeSlotConfig = {
    ...DEFAULT_FREE_SLOT_CONFIG,
    timezone: tz,
    windowStartHour: settings.windowStartHour,
    windowEndHour: settings.windowEndHour,
    maxBlocks: settings.maxBlocks,
    maxPlannedMinutes: settings.maxPlannedMinutes,
  };
  const plan = planIntoFreeSlots(tasks, busy, date, now, config);

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
    free_time: freeTime.map((f) => ({ start: f.start.toISOString(), end: f.end.toISOString(), idea: f.idea })),
    skipped_task_ids: plan.skipped_task_ids,
    removed_previous: previous.length,
  };
  await ref.update({ last_plan: { ...result, at: FieldValue.serverTimestamp() }, status: 'ok' });
  return result;
}

export type TimelineKind = 'task' | 'sport' | 'free' | 'busy';

export interface TimelineItem {
  start: string;
  end: string;
  kind: TimelineKind;
  title: string;
  task_id?: string;
}

export interface Timeline {
  connected: boolean;
  status?: 'ok' | 'needs_reauth';
  date?: string;
  timezone?: string;
  window?: { start: string; end: string };
  items: TimelineItem[];
}

/**
 * Today's timeline for the "Heute" screen: DayFlow blocks (tasks, sport,
 * free time) plus busy times from the user's other calendars. Other
 * calendars only expose free/busy (scope), so those items say "Termin".
 */
export async function getTimeline(uid: string, now = new Date()): Promise<Timeline> {
  const snap = await connectionRef(uid).get();
  const conn = snap.data() as CalendarConnection | undefined;
  if (!conn?.refresh_token) return { connected: false, items: [] };
  if (conn.status === 'needs_reauth') return { connected: true, status: 'needs_reauth', items: [] };

  const settings = { ...DEFAULT_SETTINGS, ...(conn.settings || {}) };
  const tz = conn.timezone || DEFAULT_FREE_SLOT_CONFIG.timezone;
  const date = localDateString(now, tz);
  const dayStart = zonedTimeToUtc(date, 0, 0, tz);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), 0, 0, tz);

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
  const [own, busy] = await Promise.all([
    conn.calendar_id ? google.listEvents(accessToken, conn.calendar_id, dayStart, dayEnd) : Promise.resolve([]),
    google.freeBusy(accessToken, calendarIds, dayStart, dayEnd),
  ]);

  const items: TimelineItem[] = [];
  for (const e of own) {
    if (!e.start.dateTime || !e.end.dateTime) continue; // all-day: not a block
    const taskId = e.extendedProperties?.private?.dayflow_task_id;
    const kind: TimelineKind = taskId === 'sport' ? 'sport' : taskId === 'free_time' ? 'free' : taskId ? 'task' : 'busy';
    const title = (e.summary || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Block';
    items.push({
      start: new Date(e.start.dateTime).toISOString(),
      end: new Date(e.end.dateTime).toISOString(),
      kind,
      title,
      ...(kind === 'task' ? { task_id: taskId } : {}),
    });
  }
  for (const b of busy) {
    items.push({ start: b.start.toISOString(), end: b.end.toISOString(), kind: 'busy', title: 'Termin' });
  }
  items.sort((a, b) => a.start.localeCompare(b.start));

  return {
    connected: true,
    status: 'ok',
    date,
    timezone: tz,
    window: {
      start: zonedTimeToUtc(date, settings.windowStartHour, 0, tz).toISOString(),
      end: zonedTimeToUtc(date, settings.windowEndHour, 0, tz).toISOString(),
    },
    items,
  };
}
