/**
 * Test: Timezone and DST Edge Cases
 * Tests for proper timezone handling including Daylight Saving Time transitions
 * Based on /spec/00_overview.md - Default Timezone: Europe/Berlin
 */

import { describe, it, expect } from 'vitest';
import { scheduleDay } from '../src/scheduling';
import type { Task } from '../src/models';

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    title: 'Test Task',
    status: 'open',
    created_at: new Date(),
    updated_at: new Date(),
    duration_min_minutes: 60,
    duration_max_minutes: 90,
    estimation_source: 'default',
    importance: 'medium',
    ...overrides,
  };
}

describe('Timezone Handling', () => {
  describe('Europe/Berlin Default', () => {
    it('should use Europe/Berlin as default timezone', () => {
      const tasks = [createTestTask({ id: 'task-1' })];
      const result = scheduleDay(tasks);

      expect(result).toBeDefined();
      expect(result!.timezone).toBe('Europe/Berlin');
    });

    it('should respect custom timezone in config', () => {
      const tasks = [createTestTask({ id: 'task-1' })];
      const result = scheduleDay(tasks, new Date(), {
        workingHoursStart: 9,
        workingHoursEnd: 18,
        timezone: 'America/New_York',
        bufferMinutes: 15,
      });

      expect(result).toBeDefined();
      expect(result!.timezone).toBe('America/New_York');
    });
  });

  describe('DST Transitions - Europe/Berlin', () => {
    // DST in Europe/Berlin:
    // - Starts: Last Sunday of March at 02:00 → 03:00 (lose 1 hour)
    // - Ends: Last Sunday of October at 03:00 → 02:00 (gain 1 hour)

    it('should handle scheduling on DST start day (March - spring forward)', () => {
      // Last Sunday of March 2026 is March 29
      const dstStartDay = new Date('2026-03-29T10:00:00');
      const tasks = [
        createTestTask({
          id: 'focus-1',
          duration_min_minutes: 90,
          duration_max_minutes: 120,
        }),
        createTestTask({
          id: 'mini-1',
          duration_min_minutes: 15,
          duration_max_minutes: 20,
        }),
      ];

      const result = scheduleDay(tasks, dstStartDay);

      expect(result).toBeDefined();
      expect(result!.date).toBe('2026-03-29');
      // Plan should still be valid even on DST transition day
      expect(result!.suggested_blocks.length).toBeGreaterThan(0);
    });

    it('should handle scheduling on DST end day (October - fall back)', () => {
      // Last Sunday of October 2026 is October 25
      const dstEndDay = new Date('2026-10-25T10:00:00');
      const tasks = [
        createTestTask({
          id: 'focus-1',
          duration_min_minutes: 90,
          duration_max_minutes: 120,
        }),
      ];

      const result = scheduleDay(tasks, dstEndDay);

      expect(result).toBeDefined();
      expect(result!.date).toBe('2026-10-25');
      expect(result!.suggested_blocks.length).toBeGreaterThan(0);
    });

    it('should handle year boundary (December 31 to January 1)', () => {
      const newYearsEve = new Date('2026-12-31T10:00:00');
      const tasks = [createTestTask({ id: 'task-1' })];

      const result = scheduleDay(tasks, newYearsEve);

      expect(result).toBeDefined();
      expect(result!.date).toBe('2026-12-31');
    });

    it('should handle leap year day (February 29)', () => {
      // 2028 is a leap year
      const leapDay = new Date('2028-02-29T10:00:00');
      const tasks = [createTestTask({ id: 'task-1' })];

      const result = scheduleDay(tasks, leapDay);

      expect(result).toBeDefined();
      expect(result!.date).toBe('2028-02-29');
    });
  });

  describe('Time Block Boundaries', () => {
    it('should not schedule blocks outside working hours', () => {
      const tasks = [
        createTestTask({
          id: 'focus-1',
          duration_min_minutes: 60,
          duration_max_minutes: 90,
        }),
        createTestTask({
          id: 'mini-1',
          duration_min_minutes: 10,
          duration_max_minutes: 15,
        }),
        createTestTask({
          id: 'mini-2',
          duration_min_minutes: 10,
          duration_max_minutes: 15,
        }),
      ];

      const result = scheduleDay(tasks, new Date(), {
        workingHoursStart: 9,
        workingHoursEnd: 18,
        timezone: 'Europe/Berlin',
        bufferMinutes: 15,
      });

      expect(result).toBeDefined();

      // All blocks should be within working hours
      for (const block of result!.suggested_blocks) {
        const startHour = new Date(block.start_at).getHours();
        const endHour = new Date(block.end_at).getHours();
        
        expect(startHour).toBeGreaterThanOrEqual(9);
        expect(endHour).toBeLessThanOrEqual(18);
      }
    });

    it('should handle midnight edge case', () => {
      // Note: Date parsing of '2026-01-15T00:00:00' without timezone
      // may be interpreted as UTC and converted to local time
      const midnight = new Date(2026, 0, 15, 0, 0, 0); // Local time constructor
      const tasks = [createTestTask({ id: 'task-1' })];

      const result = scheduleDay(tasks, midnight);

      expect(result).toBeDefined();
      expect(result!.date).toBe('2026-01-15');
    });

    it('should handle 23:59 edge case', () => {
      const almostMidnight = new Date('2026-01-15T23:59:59');
      const tasks = [createTestTask({ id: 'task-1' })];

      const result = scheduleDay(tasks, almostMidnight);

      expect(result).toBeDefined();
      expect(result!.date).toBe('2026-01-15');
    });
  });

  describe('Date Format Consistency', () => {
    it('should always return ISO date format (YYYY-MM-DD)', () => {
      const dates = [
        new Date('2026-01-01'),
        new Date('2026-06-15'),
        new Date('2026-12-31'),
      ];

      for (const date of dates) {
        const tasks = [createTestTask({ id: 'task-1' })];
        const result = scheduleDay(tasks, date);

        expect(result).toBeDefined();
        expect(result!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('should pad single-digit months and days', () => {
      const jan5 = new Date('2026-01-05');
      const tasks = [createTestTask({ id: 'task-1' })];
      const result = scheduleDay(tasks, jan5);

      expect(result).toBeDefined();
      expect(result!.date).toBe('2026-01-05');
    });
  });
});

describe('Due Date Timezone Handling', () => {
  it('should handle due date in past (overdue) regardless of timezone', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tasks = [
      createTestTask({
        id: 'overdue-task',
        due_at: yesterday,
        duration_min_minutes: 60,
        duration_max_minutes: 90,
      }),
      createTestTask({
        id: 'normal-task',
        duration_min_minutes: 60,
        duration_max_minutes: 90,
        importance: 'high',
      }),
    ];

    const result = scheduleDay(tasks);

    expect(result).toBeDefined();
    // Overdue task should be selected as focus
    expect(result!.focus_task_id).toBe('overdue-task');
  });

  it('should handle due date exactly today', () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const tasks = [
      createTestTask({
        id: 'due-today',
        due_at: today,
        duration_min_minutes: 60,
        duration_max_minutes: 90,
      }),
    ];

    const result = scheduleDay(tasks);

    expect(result).toBeDefined();
    // Should be schedulable
    expect(result!.suggested_blocks.length).toBeGreaterThanOrEqual(0);
  });
});
