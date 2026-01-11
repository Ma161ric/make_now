import { describe, it, expect, beforeEach } from 'vitest';
import * as storage from '../storage';
import { Task, ExtractedItem } from '@make-now/core';

describe('User Data Isolation', () => {
  const user1Id = 'user-123-abc';
  const user2Id = 'user-456-def';
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    localStorage.clear();
  });

  describe('localStorage Key Isolation', () => {
    it('should use different storage keys for different users', () => {
      const task1: Task = {
        id: 'task-1',
        title: 'User1 Task',
        status: 'open',
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'parsed',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const task2: Task = {
        id: 'task-2',
        title: 'User2 Task',
        status: 'open',
        duration_min_minutes: 45,
        duration_max_minutes: 90,
        estimation_source: 'parsed',
        importance: 'medium',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // User1 speichert Task
      storage.saveTask(user1Id, task1);

      // User2 speichert Task
      storage.saveTask(user2Id, task2);

      // Keys sollten unterschiedlich sein
      const user1Key = `make-now-state-${user1Id}`;
      const user2Key = `make-now-state-${user2Id}`;

      expect(localStorage.getItem(user1Key)).toBeDefined();
      expect(localStorage.getItem(user2Key)).toBeDefined();
      expect(localStorage.getItem(user1Key)).not.toBe(localStorage.getItem(user2Key));
    });

    it('user1 should not see user2 tasks in localStorage', () => {
      const task: Task = {
        id: 'shared-task-id',
        title: 'User2 Secret Task',
        status: 'open',
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'parsed',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // User2 speichert ein Task
      storage.saveTask(user2Id, task);

      // User1 versucht, das Task zu holen - sollte undefined sein
      const result = storage.getTask(user1Id, task.id);
      expect(result).toBeUndefined();

      // User2 kann sein Task sehen
      const user2Result = storage.getTask(user2Id, task.id);
      expect(user2Result).toBeDefined();
      expect(user2Result?.title).toBe('User2 Secret Task');
    });

    it('user2 should not see user1 day plans', () => {
      const dayPlan = {
        id: 'plan-1',
        date: today,
        status: 'confirmed' as const,
        replan_count: 0,
        plan: {
          date: today,
          timezone: 'Europe/Berlin',
          focus_task_id: 'task-1',
          mini_task_ids: [],
          suggested_blocks: [],
          reasoning_brief: 'User1 plan',
          confidence: 0.8,
          metadata: { processing_time_ms: 100 },
        },
      };

      // User1 speichert Plan
      storage.saveDayPlan(user1Id, dayPlan);

      // User2 versucht, den Plan zu holen - sollte undefined sein
      const user2Result = storage.getDayPlan(user2Id, today);
      expect(user2Result).toBeUndefined();

      // User1 kann seinen Plan sehen
      const user1Result = storage.getDayPlan(user1Id, today);
      expect(user1Result).toBeDefined();
      expect(user1Result?.status).toBe('confirmed');
    });
  });

  describe('Task Isolation', () => {
    it('listTasks should only return tasks for the authenticated user', () => {
      const task1: Task = {
        id: 'user1-task',
        title: 'User1 Task',
        status: 'open',
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'parsed',
        importance: 'medium',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const task2: Task = {
        id: 'user2-task',
        title: 'User2 Task',
        status: 'open',
        duration_min_minutes: 45,
        duration_max_minutes: 90,
        estimation_source: 'parsed',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      };

      storage.saveTask(user1Id, task1);
      storage.saveTask(user2Id, task2);

      // User1 sollte nur sein Task sehen
      const user1Tasks = storage.listTasks(user1Id);
      expect(user1Tasks).toHaveLength(1);
      expect(user1Tasks[0].id).toBe('user1-task');

      // User2 sollte nur sein Task sehen
      const user2Tasks = storage.listTasks(user2Id);
      expect(user2Tasks).toHaveLength(1);
      expect(user2Tasks[0].id).toBe('user2-task');
    });

    it('updateTaskStatus should only update user own tasks', () => {
      const task: Task = {
        id: 'task-to-update',
        title: 'Original Task',
        status: 'open',
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'parsed',
        importance: 'medium',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // User1 erstellt Task
      storage.saveTask(user1Id, task);

      // User2 versucht, Status zu ändern (sollte User1's Task nicht finden)
      storage.updateTaskStatus(user2Id, task.id, 'done');

      // User1's Task sollte immer noch 'open' sein
      const user1Task = storage.getTask(user1Id, task.id);
      expect(user1Task?.status).toBe('open');

      // User1 kann seinen Task aktualisieren
      storage.updateTaskStatus(user1Id, task.id, 'scheduled');
      const updatedTask = storage.getTask(user1Id, task.id);
      expect(updatedTask?.status).toBe('scheduled');
    });
  });

  describe('Notes and Extractions Isolation', () => {
    it('user2 should not see user1 notes', () => {
      const note = {
        id: 'note-1',
        raw_text: 'User1 secret note',
        created_at: new Date().toISOString(),
        status: 'unprocessed' as const,
      };

      const extraction = {
        items: [],
        questions: [],
        confidence: 'high' as const,
      };

      // User1 speichert Notiz
      storage.addNote(user1Id, note, extraction);

      // User2 kann Note nicht sehen
      const user2Notes = storage.listNotes(user2Id);
      expect(user2Notes).toHaveLength(0);

      // User1 kann seine Note sehen
      const user1Notes = storage.listNotes(user1Id);
      expect(user1Notes).toHaveLength(1);
      expect(user1Notes[0].raw_text).toBe('User1 secret note');
    });

    it('user2 should not see user1 extractions', () => {
      const note = {
        id: 'note-with-extraction',
        raw_text: 'Extract this',
        created_at: new Date().toISOString(),
        status: 'unprocessed' as const,
      };

      const extraction = {
        items: [
          {
            id: 'item-1',
            type: 'task' as const,
            title: 'Extracted Task',
            confidence: 0.9,
            parsed_fields: {
              duration_min_minutes: 30,
              duration_max_minutes: 60,
            },
          },
        ],
        questions: [],
        confidence: 'high' as const,
      };

      // User1 speichert mit Extraction
      storage.addNote(user1Id, note, extraction);

      // User2 kann Extraction nicht sehen
      const user2Extraction = storage.getExtraction(user2Id, note.id);
      expect(user2Extraction).toBeUndefined();

      // User1 kann seine Extraction sehen
      const user1Extraction = storage.getExtraction(user1Id, note.id);
      expect(user1Extraction).toBeDefined();
      expect(user1Extraction?.items[0].title).toBe('Extracted Task');
    });
  });

  describe('Daily Reviews Isolation', () => {
    it('user2 should not see user1 daily reviews', () => {
      const review = {
        id: 'review-1',
        date: today,
        day_plan_id: 'plan-1',
        completed_at: new Date().toISOString(),
        tasks_done: 3,
        tasks_total: 5,
        reflection_note: 'Good day!',
        mood: 'great' as const,
      };

      // User1 speichert Review
      storage.saveDailyReview(user1Id, review);

      // User2 kann Review nicht sehen
      const user2Review = storage.getDailyReview(user2Id, today);
      expect(user2Review).toBeUndefined();

      // User1 kann seinen Review sehen
      const user1Review = storage.getDailyReview(user1Id, today);
      expect(user1Review).toBeDefined();
      expect(user1Review?.mood).toBe('great');
    });
  });

  describe('Cross-User Data Contamination Prevention', () => {
    it('should not leak data when user1 saves and user2 initializes', () => {
      // User1 erstellt umfassende Daten
      const user1Task: Task = {
        id: 'user1-task',
        title: 'User1 Important Task',
        status: 'open',
        duration_min_minutes: 60,
        duration_max_minutes: 120,
        estimation_source: 'parsed',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      };

      storage.saveTask(user1Id, user1Task);
      const user1Plan = {
        id: 'user1-plan',
        date: today,
        status: 'confirmed' as const,
        replan_count: 0,
        plan: {
          date: today,
          timezone: 'Europe/Berlin',
          focus_task_id: 'user1-task',
          mini_task_ids: [],
          suggested_blocks: [],
          reasoning_brief: 'User1 plan',
          confidence: 0.9,
          metadata: { processing_time_ms: 100 },
        },
      };
      storage.saveDayPlan(user1Id, user1Plan);

      // User2 wird initialisiert (fresh user)
      const user2Tasks = storage.listTasks(user2Id);
      const user2Plan = storage.getDayPlan(user2Id, today);

      // User2 sollte User1's Daten nicht sehen
      expect(user2Tasks).toHaveLength(0);
      expect(user2Plan).toBeUndefined();
    });

    it('should handle simultaneous task creation by different users', () => {
      // Beide User erstellen Tasks mit gleichem ID (edge case)
      const taskId = 'shared-id-task';

      const user1Task: Task = {
        id: taskId,
        title: 'User1 Version',
        status: 'open',
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'parsed',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const user2Task: Task = {
        id: taskId,
        title: 'User2 Version',
        status: 'open',
        duration_min_minutes: 45,
        duration_max_minutes: 90,
        estimation_source: 'parsed',
        importance: 'medium',
        created_at: new Date(),
        updated_at: new Date(),
      };

      storage.saveTask(user1Id, user1Task);
      storage.saveTask(user2Id, user2Task);

      // Jeder User sollte seine Version sehen
      const user1Result = storage.getTask(user1Id, taskId);
      const user2Result = storage.getTask(user2Id, taskId);

      expect(user1Result?.title).toBe('User1 Version');
      expect(user2Result?.title).toBe('User2 Version');
    });
  });

  describe('localStorage Clear Behavior', () => {
    it('should not affect other users when clearing localStorage', () => {
      const task1: Task = {
        id: 'user1-task',
        title: 'User1 Task',
        status: 'open',
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'parsed',
        importance: 'medium',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const task2: Task = {
        id: 'user2-task',
        title: 'User2 Task',
        status: 'open',
        duration_min_minutes: 45,
        duration_max_minutes: 90,
        estimation_source: 'parsed',
        importance: 'high',
        created_at: new Date(),
        updated_at: new Date(),
      };

      storage.saveTask(user1Id, task1);
      storage.saveTask(user2Id, task2);

      // Lösche nur User1's Daten (simuliert nur seinen localStorage-Schlüssel löschen)
      localStorage.removeItem(`make-now-state-${user1Id}`);

      // User1 sollte keine Tasks mehr haben
      expect(storage.listTasks(user1Id)).toHaveLength(0);

      // User2's Daten sollten still vorhanden sein
      expect(storage.listTasks(user2Id)).toHaveLength(1);
    });
  });

  describe('All Storage Functions Use userId', () => {
    it('listNotes requires userId', () => {
      const note = {
        id: 'note-1',
        raw_text: 'Test note',
        created_at: new Date().toISOString(),
        status: 'unprocessed' as const,
      };

      const extraction = { items: [], questions: [], confidence: 'high' as const };

      storage.addNote(user1Id, note, extraction);

      // Different users see different notes
      expect(storage.listNotes(user1Id)).toHaveLength(1);
      expect(storage.listNotes(user2Id)).toHaveLength(0);
    });

    it('getTask requires userId', () => {
      const task: Task = {
        id: 'test-task',
        title: 'Test',
        status: 'open',
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'parsed',
        importance: 'medium',
        created_at: new Date(),
        updated_at: new Date(),
      };

      storage.saveTask(user1Id, task);

      expect(storage.getTask(user1Id, task.id)).toBeDefined();
      expect(storage.getTask(user2Id, task.id)).toBeUndefined();
    });

    it('listAllReviewedItems requires userId', () => {
      const note = {
        id: 'note-1',
        raw_text: 'Test',
        created_at: new Date().toISOString(),
        status: 'unprocessed' as const,
      };

      const items: ExtractedItem[] = [
        {
          id: 'item-1',
          type: 'task',
          title: 'Item',
          confidence: 0.9,
          parsed_fields: {
            duration_min_minutes: 30,
            duration_max_minutes: 60,
          },
        },
      ];

      storage.addNote(user1Id, note, { items, questions: [], confidence: 'high' });
      storage.saveReviewedItems(user1Id, note.id, items);

      expect(storage.listAllReviewedItems(user1Id)).toHaveLength(1);
      expect(storage.listAllReviewedItems(user2Id)).toHaveLength(0);
    });
  });
});
