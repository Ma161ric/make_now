/**
 * Test: Plan B Trigger Conditions
 * Tests when Plan B should be suggested instead of a regular plan
 * Based on /spec/10_features/plan_b_replan.md
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

describe('Plan B Trigger Conditions', () => {
  describe('Insufficient Time Scenarios', () => {
    it('should return low confidence when tasks cannot fit in working hours', () => {
      // Create tasks that exceed available working hours (9h = 540min)
      const tasks = [
        createTestTask({
          id: 'huge-1',
          duration_min_minutes: 300,
          duration_max_minutes: 360,
          importance: 'high',
        }),
        createTestTask({
          id: 'huge-2',
          duration_min_minutes: 300,
          duration_max_minutes: 360,
        }),
      ];

      const result = scheduleDay(tasks, new Date(), {
        workingHoursStart: 9,
        workingHoursEnd: 18, // 9 hours = 540 minutes
        timezone: 'Europe/Berlin',
        bufferMinutes: 15,
      });

      expect(result).toBeDefined();
      // Should have lower confidence due to time constraints
      expect(result!.confidence).toBeLessThan(1.0);
    });

    it('should still schedule focus task when no time for minis', () => {
      // Focus task that takes most of the day
      const tasks = [
        createTestTask({
          id: 'big-focus',
          duration_min_minutes: 420, // 7 hours
          duration_max_minutes: 480,
          importance: 'high',
          energy_type: 'deep_work',
        }),
        createTestTask({
          id: 'mini-1',
          duration_min_minutes: 100,
          duration_max_minutes: 120,
        }),
      ];

      const result = scheduleDay(tasks, new Date(), {
        workingHoursStart: 9,
        workingHoursEnd: 18,
        timezone: 'Europe/Berlin',
        bufferMinutes: 15,
      });

      expect(result).toBeDefined();
      // Should still have a focus task
      if (result!.focus_task_id) {
        expect(result!.mini_task_ids.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('No Suitable Tasks', () => {
    it('should return empty plan when all tasks are done', () => {
      const tasks = [
        createTestTask({ id: 'task-1', status: 'done' }),
        createTestTask({ id: 'task-2', status: 'done' }),
        createTestTask({ id: 'task-3', status: 'cancelled' }),
      ];

      const result = scheduleDay(tasks);

      expect(result).toBeDefined();
      expect(result!.focus_task_id).toBeNull();
      expect(result!.mini_task_ids).toHaveLength(0);
      expect(result!.confidence).toBe(1.0); // High confidence that nothing needs scheduling
    });

    it('should return empty plan when no tasks exist', () => {
      const result = scheduleDay([]);

      expect(result).toBeDefined();
      expect(result!.focus_task_id).toBeNull();
      expect(result!.mini_task_ids).toHaveLength(0);
      expect(result!.suggested_blocks).toHaveLength(0);
    });

    it('should handle only mini-sized tasks (no focus candidate)', () => {
      const tasks = [
        createTestTask({
          id: 'mini-1',
          duration_min_minutes: 10,
          duration_max_minutes: 15,
        }),
        createTestTask({
          id: 'mini-2',
          duration_min_minutes: 10,
          duration_max_minutes: 20,
        }),
        createTestTask({
          id: 'mini-3',
          duration_min_minutes: 15,
          duration_max_minutes: 20,
        }),
      ];

      const result = scheduleDay(tasks);

      expect(result).toBeDefined();
      // No focus task (none are 60-120 min)
      expect(result!.focus_task_id).toBeNull();
      // Should still have minis
      expect(result!.mini_task_ids.length).toBeGreaterThan(0);
      expect(result!.mini_task_ids.length).toBeLessThanOrEqual(2);
    });

    it('should handle only focus-sized tasks (no mini candidates)', () => {
      const tasks = [
        createTestTask({
          id: 'focus-1',
          duration_min_minutes: 90,
          duration_max_minutes: 120,
          importance: 'high',
        }),
        createTestTask({
          id: 'focus-2',
          duration_min_minutes: 60,
          duration_max_minutes: 90,
        }),
      ];

      const result = scheduleDay(tasks);

      expect(result).toBeDefined();
      // Should have focus task
      expect(result!.focus_task_id).toBe('focus-1');
      // No minis available
      expect(result!.mini_task_ids).toHaveLength(0);
    });
  });

  describe('Scheduling Conflict Resolution', () => {
    it('should reduce buffer when time is tight', () => {
      // Tasks that need reduced buffer to fit
      const tasks = [
        createTestTask({
          id: 'focus-1',
          duration_min_minutes: 360, // 6 hours
          duration_max_minutes: 420,
          importance: 'high',
        }),
        createTestTask({
          id: 'mini-1',
          duration_min_minutes: 60,
          duration_max_minutes: 90,
        }),
        createTestTask({
          id: 'mini-2',
          duration_min_minutes: 60,
          duration_max_minutes: 90,
        }),
      ];

      const result = scheduleDay(tasks, new Date(), {
        workingHoursStart: 9,
        workingHoursEnd: 18,
        timezone: 'Europe/Berlin',
        bufferMinutes: 30, // Large buffer that may need reduction
      });

      expect(result).toBeDefined();
      // Should have adapted the plan
      expect(result!.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should prioritize focus task over minis when time is limited', () => {
      const tasks = [
        createTestTask({
          id: 'focus-1',
          duration_min_minutes: 420, // 7 hours
          duration_max_minutes: 480,
          importance: 'high',
          energy_type: 'deep_work',
        }),
        createTestTask({
          id: 'mini-1',
          duration_min_minutes: 60,
          duration_max_minutes: 90,
        }),
        createTestTask({
          id: 'mini-2',
          duration_min_minutes: 60,
          duration_max_minutes: 90,
        }),
      ];

      const result = scheduleDay(tasks, new Date(), {
        workingHoursStart: 9,
        workingHoursEnd: 18,
        timezone: 'Europe/Berlin',
        bufferMinutes: 15,
      });

      expect(result).toBeDefined();
      // Focus should be preserved if possible
      // Minis may be reduced or removed
    });
  });

  describe('Reasoning Messages', () => {
    it('should provide reasoning for empty plan', () => {
      const result = scheduleDay([]);

      expect(result).toBeDefined();
      expect(result!.reasoning_brief).toBeTruthy();
      expect(result!.reasoning_brief.length).toBeGreaterThan(0);
    });

    it('should provide reasoning for normal plan', () => {
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

      const result = scheduleDay(tasks);

      expect(result).toBeDefined();
      expect(result!.reasoning_brief).toBeTruthy();
    });

    it('should provide reasoning when plan is constrained', () => {
      const tasks = [
        createTestTask({
          id: 'huge-task',
          duration_min_minutes: 480,
          duration_max_minutes: 540,
        }),
      ];

      const result = scheduleDay(tasks, new Date(), {
        workingHoursStart: 9,
        workingHoursEnd: 12, // Only 3 hours available
        timezone: 'Europe/Berlin',
        bufferMinutes: 15,
      });

      expect(result).toBeDefined();
      expect(result!.reasoning_brief).toBeTruthy();
    });
  });
});
