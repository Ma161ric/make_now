import { describe, it, expect, beforeEach } from 'vitest';
import {
  addNote,
  getNote,
  listNotes,
  getExtraction,
  saveReviewedItems,
  getReviewedItems,
  listAllReviewedItems,
  saveTask,
  getTask,
  listTasks,
  updateTaskStatus,
  saveDayPlan,
  getDayPlan,
  saveDailyReview,
  getDailyReview,
  savePlan,
  getPlan,
  StoredNote,
  DayPlanState,
  DailyReviewData,
} from '../storage';
import { ExtractionResponse, PlanningResponse, Task } from '@make-now/core';

const testUserId = 'test-user-edge';
const otherUserId = 'other-user-edge';

describe('storage - Edge Cases and 100% Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Multiple User Isolation', () => {
    it('should completely isolate data between two different users', () => {
      const task1: Task = {
        id: 'task-1',
        title: 'User 1 Task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const task2: Task = {
        id: 'task-1', // Same ID but different user
        title: 'User 2 Task',
        status: 'done',
        duration_minutes: 60,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task1);
      saveTask(otherUserId, task2);

      // User 1 should get their own task
      const user1Task = getTask(testUserId, 'task-1');
      expect(user1Task?.title).toBe('User 1 Task');
      expect(user1Task?.status).toBe('open');

      // User 2 should get their own task
      const user2Task = getTask(otherUserId, 'task-1');
      expect(user2Task?.title).toBe('User 2 Task');
      expect(user2Task?.status).toBe('done');
    });

    it('should maintain separate note lists for different users', () => {
      const note1: StoredNote = {
        id: 'note-1',
        raw_text: 'User 1 Note',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };

      const note2: StoredNote = {
        id: 'note-2',
        raw_text: 'User 2 Note',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };

      const extraction: ExtractionResponse = {
        items: [],
        questions: [],
        confidence: 'high',
      };

      addNote(testUserId, note1, extraction);
      addNote(otherUserId, note2, extraction);

      const user1Notes = listNotes(testUserId);
      const user2Notes = listNotes(otherUserId);

      expect(user1Notes).toHaveLength(1);
      expect(user1Notes[0].raw_text).toBe('User 1 Note');

      expect(user2Notes).toHaveLength(1);
      expect(user2Notes[0].raw_text).toBe('User 2 Note');
    });

    it('should not mix day plans between users', () => {
      const plan1: DayPlanState = {
        id: 'plan-1',
        date: '2026-01-09',
        status: 'suggested',
        replan_count: 0,
        plan: {
          focus_block: {
            task_id: 'task-1',
            start_time: '09:00',
            end_time: '10:30',
            duration_minutes: 90,
          },
          mini_tasks: [],
          scheduling_notes: 'User 1 Plan',
        },
      };

      const plan2: DayPlanState = {
        id: 'plan-2',
        date: '2026-01-09',
        status: 'confirmed',
        replan_count: 1,
        plan: {
          focus_block: {
            task_id: 'task-2',
            start_time: '10:00',
            end_time: '11:00',
            duration_minutes: 60,
          },
          mini_tasks: [],
          scheduling_notes: 'User 2 Plan',
        },
      };

      saveDayPlan(testUserId, plan1);
      saveDayPlan(otherUserId, plan2);

      const user1Plan = getDayPlan(testUserId, '2026-01-09');
      const user2Plan = getDayPlan(otherUserId, '2026-01-09');

      expect(user1Plan?.plan.scheduling_notes).toBe('User 1 Plan');
      expect(user2Plan?.plan.scheduling_notes).toBe('User 2 Plan');
    });

    it('should not leak daily reviews between users', () => {
      const review1: DailyReviewData = {
        id: 'review-1',
        date: '2026-01-09',
        day_plan_id: 'plan-1',
        completed_at: new Date().toISOString(),
        tasks_done: 3,
        tasks_total: 5,
        mood: 'good',
      };

      const review2: DailyReviewData = {
        id: 'review-2',
        date: '2026-01-09',
        day_plan_id: 'plan-2',
        completed_at: new Date().toISOString(),
        tasks_done: 1,
        tasks_total: 5,
        mood: 'bad',
      };

      saveDailyReview(testUserId, review1);
      saveDailyReview(otherUserId, review2);

      const user1Review = getDailyReview(testUserId, '2026-01-09');
      const user2Review = getDailyReview(otherUserId, '2026-01-09');

      expect(user1Review?.mood).toBe('good');
      expect(user1Review?.tasks_done).toBe(3);

      expect(user2Review?.mood).toBe('bad');
      expect(user2Review?.tasks_done).toBe(1);
    });
  });

  describe('Empty and Null Data Handling', () => {
    it('should handle empty task list gracefully', () => {
      const tasks = listTasks(testUserId);
      expect(tasks).toEqual([]);
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should handle empty notes list gracefully', () => {
      const notes = listNotes(testUserId);
      expect(notes).toEqual([]);
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should return undefined for non-existent task', () => {
      const task = getTask(testUserId, 'non-existent-id');
      expect(task).toBeUndefined();
    });

    it('should return undefined for non-existent note', () => {
      const note = getNote(testUserId, 'non-existent-id');
      expect(note).toBeUndefined();
    });

    it('should return undefined for non-existent extraction', () => {
      const extraction = getExtraction(testUserId, 'non-existent-id');
      expect(extraction).toBeUndefined();
    });

    it('should return undefined for non-existent day plan', () => {
      const plan = getDayPlan(testUserId, '2026-01-01');
      expect(plan).toBeUndefined();
    });

    it('should return undefined for non-existent daily review', () => {
      const review = getDailyReview(testUserId, '2026-01-01');
      expect(review).toBeUndefined();
    });

    it('should return undefined for non-existent reviewed items', () => {
      const items = getReviewedItems(testUserId, 'non-existent-note');
      expect(items).toBeUndefined();
    });
  });

  describe('Data Mutation and Updates', () => {
    it('should update task and reflect change immediately', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Update Test',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task);

      // Update to scheduled
      updateTaskStatus(testUserId, 'task-1', 'scheduled');
      let updated = getTask(testUserId, 'task-1');
      expect(updated?.status).toBe('scheduled');

      // Update to done
      updateTaskStatus(testUserId, 'task-1', 'done');
      updated = getTask(testUserId, 'task-1');
      expect(updated?.status).toBe('done');
      expect(updated?.completed_at).toBeDefined();
    });

    it('should preserve task data when updating status', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Preserve Test',
        status: 'open',
        duration_minutes: 45,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task);
      updateTaskStatus(testUserId, 'task-1', 'scheduled');

      const updated = getTask(testUserId, 'task-1');
      expect(updated?.title).toBe('Preserve Test');
      expect(updated?.duration_minutes).toBe(45);
    });

    it('should allow multiple task updates in sequence', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Multi Update',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task);

      updateTaskStatus(testUserId, 'task-1', 'scheduled');
      updateTaskStatus(testUserId, 'task-1', 'in_progress');
      updateTaskStatus(testUserId, 'task-1', 'done');

      const final = getTask(testUserId, 'task-1');
      expect(final?.status).toBe('done');
    });

    it('should handle reviewed items update with empty array', () => {
      const note: StoredNote = {
        id: 'note-1',
        raw_text: 'Test',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };

      addNote(testUserId, note, { items: [], questions: [], confidence: 'high' });
      saveReviewedItems(testUserId, 'note-1', []);

      const reviewed = getReviewedItems(testUserId, 'note-1');
      expect(reviewed).toEqual([]);
    });
  });

  describe('Large Data Handling', () => {
    it('should handle many tasks for single user', () => {
      const tasks: Task[] = [];
      for (let i = 0; i < 100; i++) {
        tasks.push({
          id: `task-${i}`,
          title: `Task ${i}`,
          status: 'open',
          duration_minutes: 30,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      tasks.forEach(t => saveTask(testUserId, t));

      const allTasks = listTasks(testUserId);
      expect(allTasks).toHaveLength(100);
    });

    it('should handle many notes for single user', () => {
      const notes: StoredNote[] = [];
      for (let i = 0; i < 50; i++) {
        notes.push({
          id: `note-${i}`,
          raw_text: `Note ${i}`,
          created_at: new Date().toISOString(),
          status: 'unprocessed',
        });
      }

      const extraction: ExtractionResponse = {
        items: [],
        questions: [],
        confidence: 'high',
      };

      notes.forEach(n => addNote(testUserId, n, extraction));

      const allNotes = listNotes(testUserId);
      expect(allNotes).toHaveLength(50);
    });
  });

  describe('User ID Edge Cases', () => {
    it('should handle empty string userId', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask('', task);
      const retrieved = getTask('', 'task-1');
      expect(retrieved).toBeDefined();
    });

    it('should handle special characters in userId', () => {
      const specialUserId = 'user@example.com-123_special';
      const task: Task = {
        id: 'task-1',
        title: 'Test',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(specialUserId, task);
      const retrieved = getTask(specialUserId, 'task-1');
      expect(retrieved?.title).toBe('Test');
    });

    it('should handle very long userId', () => {
      const longUserId = 'a'.repeat(500);
      const task: Task = {
        id: 'task-1',
        title: 'Test',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(longUserId, task);
      const retrieved = getTask(longUserId, 'task-1');
      expect(retrieved?.title).toBe('Test');
    });
  });

  describe('Date and Time Handling', () => {
    it('should correctly handle different date formats for day plans', () => {
      const dates = ['2026-01-01', '2026-12-31', '2026-02-29'];

      dates.forEach(date => {
        const plan: DayPlanState = {
          id: `plan-${date}`,
          date,
          status: 'suggested',
          replan_count: 0,
          plan: {
            focus_block: {
              task_id: 'task-1',
              start_time: '09:00',
              end_time: '10:30',
              duration_minutes: 90,
            },
            mini_tasks: [],
            scheduling_notes: `Plan for ${date}`,
          },
        };

        saveDayPlan(testUserId, plan);
        const retrieved = getDayPlan(testUserId, date);
        expect(retrieved?.date).toBe(date);
      });
    });

    it('should handle ISO date strings in reviews', () => {
      const isoDate = new Date().toISOString();
      const review: DailyReviewData = {
        id: 'review-1',
        date: '2026-01-09',
        day_plan_id: 'plan-1',
        completed_at: isoDate,
        tasks_done: 3,
        tasks_total: 5,
        mood: 'good',
      };

      saveDailyReview(testUserId, review);
      const retrieved = getDailyReview(testUserId, '2026-01-09');
      expect(retrieved?.completed_at).toBe(isoDate);
    });
  });

  describe('Filter and List Operations', () => {
    it('should filter tasks with custom predicate', () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Quick task',
          status: 'open',
          duration_minutes: 15,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'task-2',
          title: 'Long task',
          status: 'open',
          duration_minutes: 120,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'task-3',
          title: 'Medium task',
          status: 'done',
          duration_minutes: 45,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      tasks.forEach(t => saveTask(testUserId, t));

      // Filter long tasks
      const longTasks = listTasks(
        testUserId,
        t => t.duration_minutes > 60
      );
      expect(longTasks).toHaveLength(1);
      expect(longTasks[0].id).toBe('task-2');

      // Filter done tasks
      const doneTasks = listTasks(testUserId, t => t.status === 'done');
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].id).toBe('task-3');
    });

    it('should list all reviewed items across multiple notes', () => {
      const note1: StoredNote = {
        id: 'note-1',
        raw_text: 'Note 1',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };

      const note2: StoredNote = {
        id: 'note-2',
        raw_text: 'Note 2',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };

      addNote(testUserId, note1, {
        items: [],
        questions: [],
        confidence: 'high',
      });
      addNote(testUserId, note2, {
        items: [],
        questions: [],
        confidence: 'high',
      });

      const items1 = [
        { type: 'task' as const, title: 'Item 1', duration_minutes: 30 },
      ];
      const items2 = [
        { type: 'task' as const, title: 'Item 2', duration_minutes: 60 },
      ];

      saveReviewedItems(testUserId, 'note-1', items1);
      saveReviewedItems(testUserId, 'note-2', items2);

      const allItems = listAllReviewedItems(testUserId);
      expect(allItems).toHaveLength(2);
    });
  });

  describe('Storage Key Generation', () => {
    it('should use correct localStorage key format', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const testId = 'test-key-user';
      saveTask(testId, task);

      const expectedKey = `make-now-state-${testId}`;
      const stored = localStorage.getItem(expectedKey);
      expect(stored).toBeDefined();
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.tasks['task-1']).toBeDefined();
    });
  });
});
