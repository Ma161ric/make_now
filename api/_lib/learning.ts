/**
 * Learning how long things really take, from users/{uid}/time_log.
 *
 * Deliberately simple and careful: one factor per user ("your tasks take about
 * 20 % longer than estimated"), and only once there are at least three weeks of
 * data. Until then nothing changes.
 */
import { db } from './firebaseAdmin.js';

export const MIN_DAYS = 21;
export const MIN_SAMPLES = 8;
const MIN = 60_000;

export interface LogEntry {
  type: 'done' | 'missed' | 'extend';
  task_id?: string;
  planned_start?: string | null;
  planned_end?: string | null;
  done_at?: string;
  minutes?: number;
  /** when it was logged */
  at?: Date;
}

export interface Learning {
  /** factor the planner applies to task durations (1 = unchanged) */
  factor: number;
  active: boolean;
  days: number;
  samples: number;
  days_needed: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** pure: entries → factor */
export function learnFactor(entries: LogEntry[], now = new Date()): Learning {
  const times = entries.map((e) => e.at?.getTime()).filter((t): t is number => !!t && !isNaN(t));
  const days = times.length ? Math.floor((now.getTime() - Math.min(...times)) / (24 * 60 * MIN)) : 0;

  // one measurement per planned block (task + planned start)
  const groups = new Map<string, { len: number; start: number; done?: number; extra: number }>();
  for (const e of entries) {
    if (!e.task_id || !e.planned_start) continue;
    const start = Date.parse(e.planned_start);
    if (isNaN(start)) continue;
    const key = `${e.task_id}|${e.planned_start}`;
    const g = groups.get(key) || { len: 0, start, extra: 0 };
    if (e.planned_end && !isNaN(Date.parse(e.planned_end))) g.len = Math.max(g.len, Date.parse(e.planned_end) - start);
    if (e.type === 'extend' && typeof e.minutes === 'number') g.extra += e.minutes * MIN;
    if (e.type === 'done' && e.done_at && !isNaN(Date.parse(e.done_at))) g.done = Date.parse(e.done_at);
    groups.set(key, g);
  }

  const ratios: number[] = [];
  for (const g of groups.values()) {
    if (g.len < 10 * MIN) continue;
    let actual: number | undefined;
    if (g.done !== undefined && g.done > g.start) actual = g.done - g.start;
    else if (g.extra > 0) actual = g.len + g.extra;
    if (actual === undefined) continue;
    const r = actual / g.len;
    // ticked off hours later or right after starting: not a real measurement
    if (r < 0.3 || r > 3) continue;
    ratios.push(r);
  }

  const base = { days, samples: ratios.length, days_needed: Math.max(0, MIN_DAYS - days) };
  if (days < MIN_DAYS || ratios.length < MIN_SAMPLES) return { factor: 1, active: false, ...base };
  let f = Math.min(1.5, Math.max(0.8, median(ratios)));
  f = Math.round(f * 20) / 20; // steps of 5 %
  if (Math.abs(f - 1) < 0.1) f = 1; // small differences: leave the estimates alone
  return { factor: f, active: true, ...base };
}

export async function loadLearning(uid: string, now = new Date()): Promise<Learning> {
  try {
    const snap = await db().collection(`users/${uid}/time_log`).orderBy('at', 'desc').limit(400).get();
    const entries = snap.docs.map((d) => {
      const x = d.data() as any;
      return { ...x, at: x.at?.toDate ? x.at.toDate() : undefined } as LogEntry;
    });
    return learnFactor(entries, now);
  } catch {
    return { factor: 1, active: false, days: 0, samples: 0, days_needed: MIN_DAYS };
  }
}

/** scale a task's estimate by the learned factor, in 5-minute steps */
export function scaleMinutes(minutes: number | undefined, factor: number): number | undefined {
  if (!minutes || factor === 1) return minutes;
  return Math.max(5, Math.round((minutes * factor) / 5) * 5);
}
