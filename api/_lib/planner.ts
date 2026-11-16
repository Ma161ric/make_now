/**
 * Planning on top of a Workspace (Google calendar or DayFlow-only, see
 * workspace.ts):
 *
 *  - planForUser   plans a day: open tasks into the free gaps, sport if due
 *  - getTimeline   today for the "Heute" screen (+ free gaps, conflicts)
 *  - getWeek       seven days for the week view
 *  - extendTask    "Brauche länger": block longer, later blocks move back
 *  - placeTaskToday one task into the next free gap today
 *  - resolveConflict a block that collides with an appointment moves away
 *  - undoLast      restores the day as it was before the last change
 *
 * Trust rules:
 *  - appointments (the user's calendars, ones added in DayFlow) never move
 *  - DayFlow only touches its own blocks; blocks the user moved by hand
 *    ("pinned") are never moved or deleted automatically
 *  - every change first saves the day's blocks, so it can be undone
 *  - free time is not written into the calendar any more, it is only shown
 */
import { loadLearning, scaleMinutes } from './learning.js';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';
import {
  planIntoFreeSlots,
  pickLongBlockSlot,
  daysBetween,
  zonedTimeToUtc,
  localDateString,
  addDays,
  DEFAULT_FREE_SLOT_CONFIG,
  type FreeSlotConfig,
} from '../../packages/core/src/freeSlotScheduling.js';
import type { Task } from '../../packages/core/src/models.js';
import { openWorkspace, isPinned, connectionRef, NotConnectedError, NeedsReauthError, type Block, type ExternalEvent, type Workspace, type NewBlock } from './workspace.js';

export { connectionRef };

export interface CalendarSettings {
  enabled: boolean;
  windowStartHour: number;
  windowEndHour: number;
  maxBlocks: number;
  maxPlannedMinutes: number;
  /** Show the free gaps of the day (with an idea) in the app */
  freeTimeEnabled: boolean;
  freeTimeIdeas: string[];
  /** Reserve a longer sport block every few days */
  sportEnabled: boolean;
  sportEveryDays: number;
  sportMinutes: number;
  sportLabel: string;
  /** Kept free before every appointment (way to uni etc.) */
  bufferBeforeEventsMinutes: number;
  /** Ask in the evening what got done */
  eveningReview: boolean;
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
  eveningReview: true,
};

export interface CalendarConnection {
  /** 'local' = DayFlow without Google; missing = Google (older documents) */
  provider?: 'google' | 'local';
  refresh_token: string;
  calendar_id: string;
  timezone: string;
  status: 'ok' | 'needs_reauth';
  settings: CalendarSettings;
  last_plan?: unknown;
  /** local date (YYYY-MM-DD) of the last planned sport block */
  last_sport_date?: string;
  /** calendar links (.ics) whose appointments DayFlow respects (local mode) */
  ics_urls?: string[];
  /** secret for the subscribable plan feed */
  feed_token?: string;
  undo?: UndoSnapshot | null;
}

interface UndoSnapshot {
  label: string;
  date: string;
  at: string;
  blocks: { title: string; start: string; end: string; kind: string; taskId?: string; planDate?: string; description?: string }[];
}

const MIN = 60_000;
const GAP = DEFAULT_FREE_SLOT_CONFIG.bufferMinutes * MIN;

/** Firestore Timestamp | Date | string | number -> Date */
function toDate(v: any): Date | undefined {
  if (!v) return undefined;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function loadOpenTasks(uid: string): Promise<Task[]> {
  const snap = await db().collection(`users/${uid}/items`).where('status', 'in', ['open', 'scheduled', 'in_progress']).get();
  return snap.docs
    .map((doc): any => ({ id: doc.id, ...doc.data() }))
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

const dayRange = (date: string, tz: string) => ({ from: zonedTimeToUtc(date, 0, 0, tz), to: zonedTimeToUtc(addDays(date, 1), 0, 0, tz) });

/** DayFlow's own planned blocks (not appointments) */
const isPlanned = (b: Block) => b.kind !== 'appointment';

/**
 * Times DayFlow must not plan into: appointments (outside DayFlow and the
 * ones added in DayFlow), each with the buffer before it, plus pinned blocks.
 */
function fixedBusy(ws: Workspace, external: ExternalEvent[], blocks: Block[]): { start: Date; end: Date }[] {
  const buffer = ws.settings.bufferBeforeEventsMinutes * MIN;
  const appts = [
    ...external.filter((e) => !e.allDay && !e.transparent),
    ...blocks.filter((b) => b.kind === 'appointment'),
  ].map((e) => ({ start: new Date(e.start.getTime() - buffer), end: e.end }));
  const pinned = blocks.filter(isPinned).map((b) => ({ start: b.start, end: b.end }));
  return [...appts, ...pinned];
}

// ---------------------------------------------------------------- undo

async function saveUndo(ws: Workspace, label: string, date: string, blocks: Block[]) {
  const snapshot: UndoSnapshot = {
    label,
    date,
    at: new Date().toISOString(),
    blocks: blocks.filter(isPlanned).map((b) => ({
      title: b.title,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      kind: b.kind,
      ...(b.taskId ? { taskId: b.taskId } : {}),
      ...(b.planDate ? { planDate: b.planDate } : {}),
      ...(b.description ? { description: b.description } : {}),
    })),
  };
  await connectionRef(ws.uid).set({ undo: snapshot }, { merge: true });
}

export async function undoLast(uid: string): Promise<{ undone: string | null }> {
  const ws = await openWorkspace(uid);
  const snap = ws.conn.undo;
  if (!snap) return { undone: null };
  const { from, to } = dayRange(snap.date, ws.tz);
  const current = (await ws.blocks.list(from, to)).filter(isPlanned);
  for (const b of current) await ws.blocks.remove(b);
  for (const b of snap.blocks) {
    await ws.blocks.insert({
      title: b.title,
      start: new Date(b.start),
      end: new Date(b.end),
      kind: b.kind as NewBlock['kind'],
      taskId: b.taskId,
      planDate: b.planDate || snap.date,
      description: b.description,
      ...(b.kind === 'sport' ? { colorId: '6', reminderMinutes: 15 } : {}),
    });
  }
  await connectionRef(uid).update({ undo: null });
  return { undone: snap.label };
}

// -------------------------------------------------------------- planning

export type PlanDay = 'today' | 'tomorrow';

export interface PlanResult {
  date: string;
  blocks: { task_id: string; title: string; start: string; end: string; duration_minutes: number }[];
  free_time: { start: string; end: string; idea: string }[];
  sport: { start: string; end: string } | null;
  skipped_task_ids: string[];
  removed_previous: number;
  kept_pinned: number;
}

export async function planForUser(uid: string, day: PlanDay, now = new Date()): Promise<PlanResult> {
  const ws = await openWorkspace(uid, { ensureCalendar: true });
  const { settings, tz } = ws;
  const today = localDateString(now, tz);
  const date = day === 'today' ? today : addDays(today, 1);
  const { from, to } = dayRange(date, tz);

  const existing = await ws.blocks.list(from, to);
  // earlier DayFlow blocks of that day: replaced, unless the user moved them
  const previous = existing.filter((b) => isPlanned(b) && (!b.planDate || b.planDate === date));
  const pinned = previous.filter(isPinned);
  await saveUndo(ws, day === 'today' ? 'Neu planen' : 'Plan für morgen', date, existing);
  for (const b of previous) if (!pinned.includes(b)) await ws.blocks.remove(b);

  const kept = existing.filter((b) => !previous.includes(b) || pinned.includes(b));
  const [external, allTasks, learning] = await Promise.all([ws.external(from, to), loadOpenTasks(uid), loadLearning(uid, now)]);
  const busy = fixedBusy(ws, external, kept);

  // tasks that already have a block that day (moved by the user) are done planning.
  // Estimates are scaled by what DayFlow learned (only after 3 weeks of data).
  const alreadyThere = new Set(pinned.map((b) => b.taskId));
  const tasks = allTasks
    .filter((t) => !alreadyThere.has(t.id))
    .map((t) =>
      learning.factor === 1
        ? t
        : { ...t, duration_min_minutes: scaleMinutes(t.duration_min_minutes, learning.factor), duration_max_minutes: scaleMinutes(t.duration_max_minutes, learning.factor) }
    );

  const config: FreeSlotConfig = {
    ...DEFAULT_FREE_SLOT_CONFIG,
    timezone: tz,
    windowStartHour: settings.windowStartHour,
    windowEndHour: settings.windowEndHour,
    maxBlocks: settings.maxBlocks,
    maxPlannedMinutes: settings.maxPlannedMinutes,
    defaultDurationMinutes: scaleMinutes(DEFAULT_FREE_SLOT_CONFIG.defaultDurationMinutes, learning.factor)!,
  };
  const conn = ws.conn;
  const sportDue =
    settings.sportEnabled &&
    !alreadyThere.has('sport') &&
    (!conn.last_sport_date || conn.last_sport_date === date || daysBetween(conn.last_sport_date, date) >= settings.sportEveryDays);
  let sport = sportDue ? pickLongBlockSlot(planIntoFreeSlots([], busy, date, now, config).free_slots, settings.sportMinutes) : null;
  let plan = planIntoFreeSlots(tasks, sport ? [...busy, sport] : busy, date, now, config);
  if (!sport && settings.sportEnabled && !alreadyThere.has('sport') && plan.blocks.length === 0) {
    sport = pickLongBlockSlot(plan.remaining_slots, settings.sportMinutes);
    if (sport) plan = planIntoFreeSlots(tasks, [...busy, sport], date, now, config);
  }

  if (sport) {
    await ws.blocks.insert({
      title: settings.sportLabel,
      description: 'Von DayFlow eingeplant: Zeit für Bewegung.',
      start: sport.start,
      end: sport.end,
      kind: 'sport',
      taskId: 'sport',
      planDate: date,
      colorId: '6',
      reminderMinutes: 15,
    });
  }
  for (const block of plan.blocks) {
    await ws.blocks.insert({
      title: block.partial ? `${block.title} · Teil` : block.title,
      description: block.partial
        ? `Von DayFlow eingeplant · ein Teil (${block.duration_minutes} min), der Rest kommt an einem der nächsten Tage`
        : `Von DayFlow eingeplant · geschätzt ${block.duration_minutes} min`,
      start: block.start,
      end: block.end,
      kind: 'task',
      taskId: block.task_id,
      planDate: date,
    });
  }

  const result: PlanResult = {
    date,
    blocks: plan.blocks.map((b) => ({ task_id: b.task_id, title: b.title, start: b.start.toISOString(), end: b.end.toISOString(), duration_minutes: b.duration_minutes })),
    sport: sport ? { start: sport.start.toISOString(), end: sport.end.toISOString() } : null,
    free_time: [],
    skipped_task_ids: plan.skipped_task_ids,
    removed_previous: previous.length - pinned.length,
    kept_pinned: pinned.length,
  };
  await connectionRef(uid).update({
    last_plan: { ...result, at: FieldValue.serverTimestamp() },
    status: 'ok',
    ...(sport ? { last_sport_date: date } : {}),
  });
  return result;
}

// -------------------------------------------------------------- reading

export type TimelineKind = 'task' | 'sport' | 'free' | 'event' | 'busy';

export interface TimelineItem {
  /** DayFlow's own blocks: id for moving */
  id?: string;
  start: string;
  end: string;
  kind: TimelineKind;
  title: string;
  task_id?: string;
  location?: string;
  /** moved by the user: DayFlow leaves it alone */
  pinned?: boolean;
  /** overlaps this appointment */
  conflict?: string;
  /** free gap shown in the app only */
  idea?: string;
  /** task already marked done */
  done?: boolean;
}

export interface Timeline {
  connected: boolean;
  provider?: 'google' | 'local';
  status?: 'ok' | 'needs_reauth';
  needs_upgrade?: boolean;
  date?: string;
  timezone?: string;
  window?: { start: string; end: string };
  all_day?: string[];
  items: TimelineItem[];
  undo?: { label: string; at: string } | null;
  evening_review?: boolean;
}

function toItems(blocks: Block[], external: ExternalEvent[]): { items: TimelineItem[]; allDay: { title: string; startDate: string; endDate: string }[] } {
  const items: TimelineItem[] = [];
  const allDay: { title: string; startDate: string; endDate: string }[] = [];
  const appts = [...external.filter((e) => !e.allDay && !e.transparent), ...blocks.filter((b) => b.kind === 'appointment')];
  for (const b of blocks) {
    if (b.kind === 'free') continue; // old free-time entries: free gaps are computed now
    const kind: TimelineKind = b.kind === 'appointment' ? 'event' : b.kind;
    const clash = kind === 'task' || kind === 'sport' ? appts.find((a) => a.start < b.end && a.end > b.start) : undefined;
    items.push({
      id: b.id,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      kind,
      title: b.title,
      ...(b.kind === 'task' ? { task_id: b.taskId } : {}),
      ...(b.location ? { location: b.location } : {}),
      ...(isPinned(b) ? { pinned: true } : {}),
      ...(clash ? { conflict: clash.title } : {}),
    });
  }
  for (const e of external) {
    if (e.allDay) {
      allDay.push({ title: e.title, ...e.allDay });
      continue;
    }
    items.push({
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      kind: e.busyOnly ? 'busy' : 'event',
      title: e.title,
      ...(e.location ? { location: e.location } : {}),
    });
  }
  items.sort((a, b) => a.start.localeCompare(b.start));
  return { items, allDay };
}

/** free gaps (>= 45 min) from now until the end of the window, each with an idea */
function freeGaps(items: TimelineItem[], fromMs: number, toMs: number, ideas: string[], date: string): TimelineItem[] {
  const busy = items
    .filter((i) => i.kind !== 'free')
    .map((i) => ({ s: Date.parse(i.start), e: Date.parse(i.end) }))
    .sort((a, b) => a.s - b.s);
  const out: TimelineItem[] = [];
  let cursor = Math.ceil(fromMs / (5 * MIN)) * 5 * MIN;
  const seed = Number(date.replace(/-/g, '')) % Math.max(1, ideas.length);
  const push = (s: number, e: number) => {
    if (e - s < 45 * MIN) return;
    const idea = ideas.length ? ideas[(seed + out.length) % ideas.length] : '';
    out.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString(), kind: 'free', title: 'Frei', ...(idea ? { idea } : {}) });
  };
  for (const b of busy) {
    if (b.e <= cursor) continue;
    if (b.s > cursor) push(cursor, Math.min(b.s, toMs));
    cursor = Math.max(cursor, b.e);
    if (cursor >= toMs) break;
  }
  if (cursor < toMs) push(cursor, toMs);
  return out;
}

/** flag task items whose task is already done (best effort) */
async function markDone(uid: string, items: TimelineItem[]): Promise<void> {
  const ids = [...new Set(items.map((i) => i.task_id).filter((id): id is string => !!id))];
  if (!ids.length) return;
  try {
    const col = db().collection(`users/${uid}/items`);
    const docs = await Promise.all(ids.map((id) => col.doc(id).get()));
    const done = new Set(docs.filter((d) => d.exists && (d.data() as any)?.status === 'done').map((d) => d.id));
    for (const i of items) if (i.task_id && done.has(i.task_id)) i.done = true;
  } catch {
    /* not important enough to fail the timeline */
  }
}

/** remember when a planned task was really finished (for learning durations later) */
export async function logDone(uid: string, taskId: string, now = new Date(), type: 'done' | 'missed' = 'done'): Promise<void> {
  const ws = await openWorkspace(uid);
  const date = localDateString(now, ws.tz);
  const { from, to } = dayRange(date, ws.tz);
  const blocks = (await ws.blocks.list(from, to)).filter((b) => b.taskId === taskId);
  const first = blocks.sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  await db()
    .collection(`users/${uid}/time_log`)
    .add({
      type,
      task_id: taskId,
      title: first?.title || null,
      planned_start: first ? first.plannedStart || first.start.toISOString() : null,
      planned_end: first ? blocks[blocks.length - 1].plannedEnd || blocks[blocks.length - 1].end.toISOString() : null,
      done_at: now.toISOString(),
      at: FieldValue.serverTimestamp(),
    });
}

export async function getTimeline(uid: string, now = new Date()): Promise<Timeline> {
  let ws: Workspace;
  try {
    ws = await openWorkspace(uid);
  } catch (e: any) {
    if (e instanceof NotConnectedError) return { connected: false, items: [] };
    if (e instanceof NeedsReauthError) return { connected: true, status: 'needs_reauth', items: [] };
    throw e;
  }
  const { tz, settings } = ws;
  const date = localDateString(now, tz);
  const { from, to } = dayRange(date, tz);
  const [blocks, external] = await Promise.all([ws.blocks.list(from, to), ws.external(from, to)]);
  const { items, allDay } = toItems(blocks, external);
  const windowStart = zonedTimeToUtc(date, settings.windowStartHour, 0, tz);
  const windowEnd = zonedTimeToUtc(date, settings.windowEndHour, 0, tz);
  await markDone(uid, items);
  if (settings.freeTimeEnabled) items.push(...freeGaps(items, Math.max(now.getTime(), windowStart.getTime()), windowEnd.getTime(), settings.freeTimeIdeas, date));
  items.sort((a, b) => a.start.localeCompare(b.start));
  const undo = ws.conn.undo && ws.conn.undo.date === date ? { label: ws.conn.undo.label, at: ws.conn.undo.at } : null;
  return {
    connected: true,
    provider: ws.provider,
    status: 'ok',
    ...(ws.needsUpgrade ? { needs_upgrade: true } : {}),
    date,
    timezone: tz,
    window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
    all_day: allDay.filter((a) => a.startDate <= date && a.endDate > date).map((a) => a.title),
    items,
    undo,
    evening_review: ws.settings.eveningReview,
  };
}

export interface WeekDay {
  date: string;
  all_day: string[];
  items: TimelineItem[];
}

export async function getWeek(uid: string, start: string): Promise<{ connected: boolean; provider?: string; status?: string; needs_upgrade?: boolean; window?: { startHour: number; endHour: number }; days: WeekDay[] }> {
  let ws: Workspace;
  try {
    ws = await openWorkspace(uid);
  } catch (e: any) {
    if (e instanceof NotConnectedError) return { connected: false, days: [] };
    if (e instanceof NeedsReauthError) return { connected: true, status: 'needs_reauth', days: [] };
    throw e;
  }
  const { tz, settings } = ws;
  const from = zonedTimeToUtc(start, 0, 0, tz);
  const to = zonedTimeToUtc(addDays(start, 7), 0, 0, tz);
  const [blocks, external] = await Promise.all([ws.blocks.list(from, to), ws.external(from, to)]);
  const { items, allDay } = toItems(blocks, external);
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), all_day: [], items: [] }));
  for (const it of items) days.find((d) => d.date === localDateString(new Date(it.start), tz))?.items.push(it);
  for (const a of allDay) for (const d of days) if (d.date >= a.startDate && d.date < a.endDate) d.all_day.push(a.title);
  return {
    connected: true,
    provider: ws.provider,
    status: 'ok',
    ...(ws.needsUpgrade ? { needs_upgrade: true } : {}),
    window: { startHour: settings.windowStartHour, endHour: settings.windowEndHour },
    days,
  };
}

// -------------------------------------------------------------- changes

/** Saves a confirmed appointment (Google: DayFlow calendar, local: DayFlow). */
export async function addAppointment(uid: string, ev: { title: string; start: Date; end: Date; location?: string }) {
  const ws = await openWorkspace(uid, { ensureCalendar: true });
  const id = await ws.blocks.insert({ title: ev.title, start: ev.start, end: ev.end, kind: 'appointment', location: ev.location });
  return { id, link: null as string | null };
}

export interface ExtendResult {
  end: string;
  added: number;
  moved: number;
  dropped: string[];
}

/**
 * "Brauche länger": the running block gets longer and the DayFlow blocks after
 * it move back. Appointments and pinned blocks never move. Blocks pushed past
 * the planning window are removed; their tasks stay open for tomorrow.
 */
export async function extendTask(uid: string, taskId: string, minutes: number, now = new Date()): Promise<ExtendResult> {
  const ws = await openWorkspace(uid);
  const { tz, settings } = ws;
  const date = localDateString(now, tz);
  const { from, to } = dayRange(date, tz);
  const windowEnd = Math.max(zonedTimeToUtc(date, settings.windowEndHour, 0, tz).getTime(), now.getTime() + 3 * 60 * MIN);
  const t = now.getTime();

  const blocks = await ws.blocks.list(from, to);
  const block = blocks.filter((b) => b.taskId === taskId && b.end.getTime() > t).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  if (!block) throw new Error('Kein Block für diese Aufgabe gefunden');
  await saveUndo(ws, 'Brauche länger', date, blocks);

  const external = await ws.external(now, to);
  const fixed = fixedBusy(ws, external, blocks.filter((b) => b.id !== block.id))
    .map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }))
    .sort((a, b) => a.start - b.start);
  const clash = (s: number, e: number) => fixed.find((f) => s < f.end && e > f.start);

  let newEnd = block.end.getTime() + minutes * MIN;
  const hit = clash(block.end.getTime(), newEnd);
  if (hit) newEnd = Math.max(block.end.getTime(), hit.start);
  const added = Math.round((newEnd - block.end.getTime()) / MIN);
  if (added > 0) await ws.blocks.move(block, block.start, new Date(newEnd), true);
  // real durations, so DayFlow can later learn how long things really take
  await db()
    .collection(`users/${uid}/time_log`)
    .add({
      type: 'extend',
      task_id: taskId,
      title: block.title,
      minutes: added,
      planned_start: block.plannedStart || block.start.toISOString(),
      planned_end: block.plannedEnd || block.end.toISOString(),
      at: FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  const movable = blocks
    .filter((b) => b.id !== block.id && (b.kind === 'task' || b.kind === 'sport') && !isPinned(b) && b.start >= block.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  let cursor = newEnd + GAP;
  let moved = 0;
  const dropped: string[] = [];
  for (const b of movable) {
    const dur = b.end.getTime() - b.start.getTime();
    let s = Math.max(b.start.getTime(), cursor);
    for (let f = clash(s, s + dur); f; f = clash(s, s + dur)) s = f.end + GAP;
    if (s + dur > windowEnd) {
      await ws.blocks.remove(b);
      dropped.push(b.title);
      continue;
    }
    if (s !== b.start.getTime()) {
      await ws.blocks.move(b, new Date(s), new Date(s + dur), true);
      moved++;
    }
    cursor = s + dur + GAP;
  }
  // old free-time entries in the way go away
  for (const b of blocks.filter((x) => x.kind === 'free' && x.start.getTime() < cursor && x.end.getTime() > block.start.getTime())) await ws.blocks.remove(b);

  return { end: new Date(newEnd).toISOString(), added, moved, dropped };
}

export interface PlaceResult {
  placed: boolean;
  start?: string;
  end?: string;
}

/**
 * One task into the first free gap today (after now) that fits; asked for by
 * hand, so the evening counts too. The rest of the plan stays as it is.
 */
export async function placeTaskToday(uid: string, task: { id: string; title: string; minutes: number }, now = new Date(), opts: { skipUndo?: boolean; blocks?: Block[] } = {}): Promise<PlaceResult> {
  const ws = await openWorkspace(uid, { ensureCalendar: true });
  const { tz, settings } = ws;
  const date = localDateString(now, tz);
  const { from, to } = dayRange(date, tz);
  const blocks = opts.blocks ?? (await ws.blocks.list(from, to));
  if (!opts.skipUndo) await saveUndo(ws, `„${task.title}“ eingeplant`, date, blocks);

  const external = await ws.external(now, to);
  const busy = fixedBusy(ws, external, blocks);
  for (const b of blocks) if (b.kind === 'task' || b.kind === 'sport') busy.push({ start: b.start, end: b.end });
  const config: FreeSlotConfig = { ...DEFAULT_FREE_SLOT_CONFIG, timezone: tz, windowStartHour: settings.windowStartHour, windowEndHour: 24 };
  const ms = task.minutes * MIN;
  const slot = planIntoFreeSlots([], busy, date, now, config).free_slots.find((s) => s.end.getTime() - s.start.getTime() >= ms);
  if (!slot) return { placed: false };

  const start = slot.start;
  const end = new Date(start.getTime() + ms);
  await ws.blocks.insert({
    title: task.title,
    description: `Von DayFlow eingeplant · geschätzt ${task.minutes} min`,
    start,
    end,
    kind: 'task',
    taskId: task.id,
    planDate: date,
  });
  for (const b of blocks.filter((x) => x.kind === 'free' && x.start < end && x.end > start)) await ws.blocks.remove(b);
  return { placed: true, start: start.toISOString(), end: end.toISOString() };
}

/** A block that collides with an appointment moves to the next free gap today. */
/**
 * The user moves a DayFlow block by hand in the app (or takes it out of today).
 * A moved task/sport block counts as pinned, exactly like moving it in Google.
 */
export async function moveBlock(
  uid: string,
  blockId: string,
  change: { start: Date } | { remove: true },
  now = new Date()
): Promise<{ moved: boolean; start?: string; end?: string }> {
  const ws = await openWorkspace(uid);
  const date = localDateString(now, ws.tz);
  const { from, to } = dayRange(date, ws.tz);
  const blocks = await ws.blocks.list(from, to);
  const block = blocks.find((b) => b.id === blockId);
  if (!block) throw new Error('Block nicht gefunden');
  const label = `„${block.title}“ ${'remove' in change ? 'aus dem Plan genommen' : 'verschoben'}`;
  if (block.kind !== 'appointment') await saveUndo(ws, label, date, blocks);
  if ('remove' in change) {
    await ws.blocks.remove(block);
    return { moved: true };
  }
  const length = block.end.getTime() - block.start.getTime();
  const start = new Date(Math.round(change.start.getTime() / (5 * MIN)) * 5 * MIN);
  if (start.getTime() < from.getTime() || start.getTime() + length > to.getTime() + 60 * MIN) {
    throw new Error('Nur innerhalb von heute verschiebbar');
  }
  const end = new Date(start.getTime() + length);
  await ws.blocks.move(block, start, end, false);
  return { moved: true, start: start.toISOString(), end: end.toISOString() };
}

export async function resolveConflict(uid: string, taskId: string, now = new Date()): Promise<PlaceResult> {
  const ws = await openWorkspace(uid);
  const date = localDateString(now, ws.tz);
  const { from, to } = dayRange(date, ws.tz);
  const blocks = await ws.blocks.list(from, to);
  const block = blocks.find((b) => b.taskId === taskId && b.end.getTime() > now.getTime());
  if (!block) throw new Error('Kein Block für diese Aufgabe gefunden');
  await saveUndo(ws, `„${block.title}“ verschoben`, date, blocks);
  await ws.blocks.remove(block);
  const minutes = Math.round((block.end.getTime() - block.start.getTime()) / MIN);
  const rest = blocks.filter((b) => b.id !== block.id);
  if (block.kind === 'sport') {
    const external = await ws.external(now, to);
    const busy = [...fixedBusy(ws, external, rest), ...rest.filter((b) => b.kind === 'task').map((b) => ({ start: b.start, end: b.end }))];
    const config: FreeSlotConfig = { ...DEFAULT_FREE_SLOT_CONFIG, timezone: ws.tz, windowStartHour: ws.settings.windowStartHour, windowEndHour: 24 };
    const slot = planIntoFreeSlots([], busy, date, now, config).free_slots.find((s) => s.end.getTime() - s.start.getTime() >= minutes * MIN);
    if (!slot) return { placed: false };
    const end = new Date(slot.start.getTime() + minutes * MIN);
    await ws.blocks.insert({ title: block.title, start: slot.start, end, kind: 'sport', taskId: 'sport', planDate: date, colorId: '6', reminderMinutes: 15 });
    return { placed: true, start: slot.start.toISOString(), end: end.toISOString() };
  }
  return placeTaskToday(uid, { id: taskId, title: block.title.replace(/ · Teil$/, ''), minutes }, now, { skipUndo: true, blocks: rest });
}
