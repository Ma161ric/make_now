/**
 * Calendar-aware scheduling
 *
 * Places open tasks into the FREE gaps of a day, around the user's existing
 * calendar events. Pure and deterministic: no I/O, no randomness, so it can
 * run on the server (cron) and in tests alike.
 */

import type { Task, Importance } from './models.js';

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface FreeSlotConfig {
  /** IANA time zone the day and window refer to, e.g. Europe/Berlin */
  timezone: string;
  /** Local hour the planning window opens (10 = 10:00) */
  windowStartHour: number;
  /** Local hour the planning window closes (20 = 20:00) */
  windowEndHour: number;
  /** Max number of task blocks per day */
  maxBlocks: number;
  /** Max total planned task minutes per day */
  maxPlannedMinutes: number;
  /** Gap kept before and after existing events and between blocks */
  bufferMinutes: number;
  /** Gaps shorter than this are ignored */
  minSlotMinutes: number;
  /** Used when a task has no duration estimate */
  defaultDurationMinutes: number;
}

export const DEFAULT_FREE_SLOT_CONFIG: FreeSlotConfig = {
  timezone: 'Europe/Berlin',
  windowStartHour: 10,
  windowEndHour: 20,
  maxBlocks: 3,
  maxPlannedMinutes: 240,
  bufferMinutes: 10,
  minSlotMinutes: 15,
  defaultDurationMinutes: 30,
};

export interface PlannedBlock {
  task_id: string;
  title: string;
  start: Date;
  end: Date;
  duration_minutes: number;
  /** Only part of a long task: no gap (or not enough budget) for the whole thing today */
  partial?: boolean;
}

/** Long tasks that fit nowhere in one piece get a part of at least this length */
export const MIN_PART_MINUTES = 45;
/** Tasks up to this long are "quick ones": they don't count against maxBlocks */
export const SHORT_TASK_MINUTES = 30;
/** …and at most this long, so one big task does not eat the whole day's budget */
export const MAX_PART_MINUTES = 120;

export interface FreeSlotPlan {
  date: string; // YYYY-MM-DD (local)
  blocks: PlannedBlock[];
  free_slots: BusyInterval[];
  /** Gaps still free after placing the tasks (at least minSlotMinutes long) */
  remaining_slots: BusyInterval[];
  skipped_task_ids: string[];
}

const MINUTE = 60_000;

/**
 * Offset (ms) of `timeZone` from UTC at the given instant.
 */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The UTC instant of a local wall-clock time in `timeZone`.
 * `date` is YYYY-MM-DD. Handles DST correctly for normal hours.
 */
export function zonedTimeToUtc(date: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  // Two passes so the offset is taken at the target instant, not the guess
  let utc = guess - tzOffsetMs(new Date(guess), timeZone);
  utc = guess - tzOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

/**
 * Local calendar date (YYYY-MM-DD) of an instant in `timeZone`.
 */
export function localDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Local date `days` after `date` (YYYY-MM-DD).
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/**
 * Free gaps inside [windowStart, windowEnd] after removing busy intervals
 * (each widened by `buffer` minutes on both sides).
 */
export function computeFreeSlots(
  windowStart: Date,
  windowEnd: Date,
  busy: BusyInterval[],
  bufferMinutes: number,
  minSlotMinutes: number
): BusyInterval[] {
  const pad = bufferMinutes * MINUTE;
  const widened = busy
    .map((b) => ({ start: b.start.getTime() - pad, end: b.end.getTime() + pad }))
    .filter((b) => b.end > windowStart.getTime() && b.start < windowEnd.getTime())
    .sort((a, b) => a.start - b.start);

  const free: BusyInterval[] = [];
  let cursor = windowStart.getTime();
  for (const b of widened) {
    if (b.start > cursor) free.push({ start: new Date(cursor), end: new Date(Math.min(b.start, windowEnd.getTime())) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= windowEnd.getTime()) break;
  }
  if (cursor < windowEnd.getTime()) free.push({ start: new Date(cursor), end: windowEnd });

  return free.filter((s) => s.end.getTime() - s.start.getTime() >= minSlotMinutes * MINUTE);
}

function taskDuration(task: Task, fallback: number): number {
  const min = task.duration_min_minutes;
  const max = task.duration_max_minutes;
  if (min && max) return Math.round((min + max) / 2);
  return min || max || fallback;
}

function toTime(value: unknown): number | null {
  if (!value) return null;
  const t = new Date(value as string | number | Date).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Priority order: overdue/due soonest, then importance, then oldest.
 */
export function orderTasksForPlanning(tasks: Task[], now: Date): Task[] {
  const importanceOrder: Record<Importance, number> = { high: 0, medium: 1, low: 2 };
  return tasks
    .filter((t) => t.status === 'open' || t.status === 'scheduled' || t.status === 'in_progress')
    .slice()
    .sort((a, b) => {
      const aDue = toTime(a.due_at) ?? Infinity;
      const bDue = toTime(b.due_at) ?? Infinity;
      const aOverdue = aDue < now.getTime() ? 0 : 1;
      const bOverdue = bDue < now.getTime() ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const imp = (importanceOrder[a.importance] ?? 1) - (importanceOrder[b.importance] ?? 1);
      if (imp !== 0) return imp;
      if (aDue !== bDue) return aDue - bDue;
      return (toTime(a.created_at) ?? 0) - (toTime(b.created_at) ?? 0);
    });
}

/**
 * Plan one local day: put the highest-priority open tasks into the earliest
 * free gaps that fit them.
 *
 * @param date  local day to plan, YYYY-MM-DD
 * @param now   current instant; nothing is placed before it (planning "today")
 */
export function planIntoFreeSlots(
  tasks: Task[],
  busy: BusyInterval[],
  date: string,
  now: Date,
  config: FreeSlotConfig = DEFAULT_FREE_SLOT_CONFIG
): FreeSlotPlan {
  const tz = config.timezone;
  let windowStart = zonedTimeToUtc(date, config.windowStartHour, 0, tz);
  const windowEnd = zonedTimeToUtc(date, config.windowEndHour, 0, tz);

  // Never schedule in the past: start at the next quarter hour from now
  if (now.getTime() > windowStart.getTime()) {
    const quarter = 15 * MINUTE;
    windowStart = new Date(Math.ceil(now.getTime() / quarter) * quarter);
  }

  const empty: FreeSlotPlan = { date, blocks: [], free_slots: [], remaining_slots: [], skipped_task_ids: [] };
  if (windowStart >= windowEnd) return empty;

  const freeSlots = computeFreeSlots(windowStart, windowEnd, busy, config.bufferMinutes, config.minSlotMinutes);
  // Mutable copy we carve blocks out of
  const remaining = freeSlots.map((s) => ({ start: s.start.getTime(), end: s.end.getTime() }));

  const blocks: PlannedBlock[] = [];
  const skipped: string[] = [];
  let plannedMinutes = 0;
  // maxBlocks limits the bigger tasks only (0 = no limit). Quick ones are
  // limited by the time budget, so a day full of small things still moves.
  let bigBlocks = 0;
  const limit = config.maxBlocks > 0 ? config.maxBlocks : Infinity;

  for (const task of orderTasksForPlanning(tasks, now)) {
    if (config.maxPlannedMinutes - plannedMinutes < 5) break;
    const duration = taskDuration(task, config.defaultDurationMinutes);
    const isShort = duration <= SHORT_TASK_MINUTES;
    if (!isShort && bigBlocks >= limit) continue;
    const budget = config.maxPlannedMinutes - plannedMinutes;
    let minutes = duration;
    let partial = false;
    let slot = duration <= budget ? remaining.find((s) => s.end - s.start >= duration * MINUTE) : undefined;

    // Too long for any gap (or for what's left of the day's budget): plan a
    // part of it in the biggest gap, so long tasks still move forward
    if (!slot && duration >= 60) {
      const biggest = remaining.reduce<(typeof remaining)[number] | undefined>(
        (best, s) => (!best || s.end - s.start > best.end - best.start ? s : best),
        undefined
      );
      const room = biggest ? Math.floor((biggest.end - biggest.start) / MINUTE) : 0;
      const part = Math.floor(Math.min(duration, budget, room, MAX_PART_MINUTES) / 15) * 15;
      if (biggest && part >= MIN_PART_MINUTES) {
        slot = biggest;
        minutes = part;
        partial = true;
      }
    }
    if (!slot) {
      skipped.push(task.id);
      continue;
    }
    const start = slot.start;
    const end = start + minutes * MINUTE;
    blocks.push({
      task_id: task.id,
      title: task.title,
      start: new Date(start),
      end: new Date(end),
      duration_minutes: minutes,
      ...(partial ? { partial: true } : {}),
    });
    plannedMinutes += minutes;
    if (!isShort) bigBlocks++;
    slot.start = end + config.bufferMinutes * MINUTE;
  }

  const remainingSlots = remaining
    .filter((s) => s.end - s.start >= config.minSlotMinutes * MINUTE)
    .map((s) => ({ start: new Date(s.start), end: new Date(s.end) }));

  return { date, blocks, free_slots: freeSlots, remaining_slots: remainingSlots, skipped_task_ids: skipped };
}

export interface FreeTimeBlock {
  start: Date;
  end: Date;
  idea: string;
}

/**
 * Turns the gaps left after planning into free-time blocks, each with one
 * suggestion. Suggestions rotate by date so not every day says the same.
 * The first gap long enough gets a movement idea if the list has one
 * (first entry is treated as the "active" idea, e.g. Sport / Gym).
 */
export function planFreeTime(
  remaining: BusyInterval[],
  date: string,
  ideas: string[],
  minMinutes = 30
): FreeTimeBlock[] {
  const list = ideas.map((i) => i.trim()).filter(Boolean);
  const gaps = remaining.filter((g) => g.end.getTime() - g.start.getTime() >= minMinutes * MINUTE);
  if (!gaps.length) return [];
  const [y, m, d] = date.split('-').map(Number);
  const dayIndex = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return gaps.map((g, i) => ({
    start: g.start,
    end: g.end,
    idea: list.length ? list[(dayIndex + i) % list.length] : '',
  }));
}

/**
 * Picks a slot for a longer block such as sport: the gap that fits and starts
 * latest (sport tends to fit better in the afternoon/evening), placed at the
 * start of that gap. Returns null if nothing fits.
 */
export function pickLongBlockSlot(slots: BusyInterval[], minutes: number): BusyInterval | null {
  const fitting = slots.filter((s) => s.end.getTime() - s.start.getTime() >= minutes * MINUTE);
  if (!fitting.length) return null;
  const slot = fitting.reduce((a, b) => (b.start > a.start ? b : a));
  return { start: slot.start, end: new Date(slot.start.getTime() + minutes * MINUTE) };
}

/** Days from local date a to local date b (YYYY-MM-DD), b - a. */
export function daysBetween(a: string, b: string): number {
  const t = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}
