import { describe, it, expect } from 'vitest';
import type { Task } from '../src/models';
import {
  planIntoFreeSlots,
  planFreeTime,
  pickLongBlockSlot,
  daysBetween,
  computeFreeSlots,
  zonedTimeToUtc,
  localDateString,
  addDays,
  DEFAULT_FREE_SLOT_CONFIG,
  type FreeSlotConfig,
} from '../src/freeSlotScheduling';

const TZ = 'Europe/Berlin';
const DAY = '2026-11-16'; // a Monday, CET (UTC+1)
const BEFORE_DAY = new Date('2026-11-15T20:00:00Z');

function task(id: string, minutes: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status: 'open',
    created_at: new Date('2026-11-01T10:00:00Z'),
    updated_at: new Date('2026-11-01T10:00:00Z'),
    duration_min_minutes: minutes,
    duration_max_minutes: minutes,
    estimation_source: 'ai',
    importance: 'medium',
    ...overrides,
  };
}

const local = (h: number, m = 0) => zonedTimeToUtc(DAY, h, m, TZ);
const cfg = (o: Partial<FreeSlotConfig> = {}): FreeSlotConfig => ({ ...DEFAULT_FREE_SLOT_CONFIG, timezone: TZ, ...o });

describe('time zone helpers', () => {
  it('converts Berlin wall time to UTC in winter and summer', () => {
    expect(zonedTimeToUtc('2026-11-16', 10, 0, TZ).toISOString()).toBe('2026-11-16T09:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-01', 10, 0, TZ).toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });

  it('handles the DST switch day', () => {
    // 2026-03-29: clocks jump 02:00 -> 03:00
    expect(zonedTimeToUtc('2026-03-29', 10, 0, TZ).toISOString()).toBe('2026-03-29T08:00:00.000Z');
  });

  it('gets local date and adds days across month end', () => {
    expect(localDateString(new Date('2026-11-15T23:30:00Z'), TZ)).toBe('2026-11-16');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});

describe('computeFreeSlots', () => {
  it('returns the whole window when nothing is busy', () => {
    const slots = computeFreeSlots(local(10), local(20), [], 10, 15);
    expect(slots).toHaveLength(1);
    expect(slots[0].start).toEqual(local(10));
    expect(slots[0].end).toEqual(local(20));
  });

  it('cuts out busy events plus buffer and merges overlaps', () => {
    const busy = [
      { start: local(12), end: local(13) },
      { start: local(12, 30), end: local(14) }, // overlaps the first
      { start: local(18), end: local(22) }, // runs past window end
    ];
    const slots = computeFreeSlots(local(10), local(20), busy, 10, 15);
    expect(slots.map((s) => [s.start, s.end])).toEqual([
      [local(10), local(11, 50)],
      [local(14, 10), local(17, 50)],
    ]);
  });

  it('drops gaps shorter than the minimum', () => {
    const busy = [
      { start: local(10, 10), end: local(11) },
    ];
    const slots = computeFreeSlots(local(10), local(12), busy, 0, 15);
    expect(slots.map((s) => [s.start, s.end])).toEqual([[local(11), local(12)]]);
  });
});

describe('planIntoFreeSlots', () => {
  it('plans tasks around existing events, never overlapping them', () => {
    const busy = [{ start: local(10), end: local(12) }, { start: local(13), end: local(15) }];
    const plan = planIntoFreeSlots([task('a', 30), task('b', 90)], busy, DAY, BEFORE_DAY, cfg());

    expect(plan.blocks).toHaveLength(2);
    for (const block of plan.blocks) {
      for (const b of busy) {
        const overlaps = block.start < b.end && block.end > b.start;
        expect(overlaps).toBe(false);
      }
    }
    // gap 12:10-12:50 (buffer around events): 30-min task fits, 90-min task only after 15:10
    expect(plan.blocks[0]).toMatchObject({ task_id: 'a', start: local(12, 10), end: local(12, 40) });
    expect(plan.blocks[1]).toMatchObject({ task_id: 'b', start: local(15, 10) });
  });

  it('respects max blocks and max planned minutes', () => {
    const tasks = [task('a', 60), task('b', 60), task('c', 60), task('d', 60)];
    expect(planIntoFreeSlots(tasks, [], DAY, BEFORE_DAY, cfg({ maxBlocks: 2 })).blocks).toHaveLength(2);
    expect(planIntoFreeSlots(tasks, [], DAY, BEFORE_DAY, cfg({ maxPlannedMinutes: 150 })).blocks).toHaveLength(2);
  });

  it('puts high importance and overdue tasks first', () => {
    const tasks = [
      task('low', 30, { importance: 'low' }),
      task('high', 30, { importance: 'high' }),
      task('overdue', 30, { importance: 'low', due_at: new Date('2026-11-10T10:00:00Z') }),
    ];
    const plan = planIntoFreeSlots(tasks, [], DAY, BEFORE_DAY, cfg());
    expect(plan.blocks.map((b) => b.task_id)).toEqual(['overdue', 'high', 'low']);
  });

  it('ignores tasks that are not open', () => {
    const plan = planIntoFreeSlots([task('done', 30, { status: 'done' }), task('open', 30)], [], DAY, BEFORE_DAY, cfg());
    expect(plan.blocks.map((b) => b.task_id)).toEqual(['open']);
  });

  it('skips a task that fits nowhere but keeps planning smaller ones', () => {
    const busy = [{ start: local(11), end: local(20) }];
    const plan = planIntoFreeSlots([task('big', 120, { importance: 'high' }), task('small', 30)], busy, DAY, BEFORE_DAY, cfg());
    expect(plan.blocks.map((b) => b.task_id)).toEqual(['small']);
    expect(plan.skipped_task_ids).toEqual(['big']);
  });

  it('uses the default duration when a task has no estimate', () => {
    const t = task('x', 0, { duration_min_minutes: undefined, duration_max_minutes: undefined });
    const plan = planIntoFreeSlots([t], [], DAY, BEFORE_DAY, cfg({ defaultDurationMinutes: 25 }));
    expect(plan.blocks[0].duration_minutes).toBe(25);
  });

  it('does not schedule in the past when planning today', () => {
    const now = local(15, 7);
    const plan = planIntoFreeSlots([task('a', 30)], [], DAY, now, cfg());
    expect(plan.blocks[0].start).toEqual(local(15, 15));
  });

  it('returns nothing when the window is already over', () => {
    const plan = planIntoFreeSlots([task('a', 30)], [], DAY, local(21), cfg());
    expect(plan.blocks).toEqual([]);
  });
});

describe('remaining slots and free time', () => {
  it('returns what is left after tasks, respecting buffers', () => {
    const busy = [{ start: local(14), end: local(15) }];
    const plan = planIntoFreeSlots([task('a', 60)], busy, DAY, BEFORE_DAY, cfg());
    // task 10:00-11:00, then 11:10-13:50 and 15:10-20:00 stay free
    expect(plan.remaining_slots.map((s) => [s.start, s.end])).toEqual([
      [local(11, 10), local(13, 50)],
      [local(15, 10), local(20)],
    ]);
  });

  it('turns long enough gaps into free-time blocks with rotating ideas', () => {
    const gaps = [
      { start: local(11), end: local(11, 20) }, // too short
      { start: local(13), end: local(14) },
      { start: local(16), end: local(20) },
    ];
    const blocks = planFreeTime(gaps, DAY, ['Sport', 'Spaziergang', 'Lesen'], 30);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].start).toEqual(local(13));
    expect(blocks[0].idea).not.toBe(blocks[1].idea);
    const nextDay = planFreeTime(gaps, '2026-11-17', ['Sport', 'Spaziergang', 'Lesen'], 30);
    expect(nextDay[0].idea).not.toBe(blocks[0].idea);
  });

  it('works without ideas', () => {
    expect(planFreeTime([{ start: local(13), end: local(14) }], DAY, [], 30)[0].idea).toBe('');
  });
});

describe('sport block helpers', () => {
  it('picks the latest gap that fits and places the block at its start', () => {
    const slots = [
      { start: local(10), end: local(12) },
      { start: local(13), end: local(14) }, // too short for 90 min
      { start: local(16), end: local(20) },
    ];
    expect(pickLongBlockSlot(slots, 90)).toEqual({ start: local(16), end: local(17, 30) });
    expect(pickLongBlockSlot(slots, 300)).toBe(null);
  });

  it('counts days between local dates across month ends', () => {
    expect(daysBetween('2026-11-28', '2026-12-01')).toBe(3);
    expect(daysBetween('2026-11-16', '2026-11-16')).toBe(0);
    expect(daysBetween('2026-11-17', '2026-11-16')).toBe(-1);
  });
});
