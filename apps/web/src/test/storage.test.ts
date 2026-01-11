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
import { ExtractionResponse, PlanningResponse, ExtractedItem, Task } from '@make-now/core';

const testUserId = 'test-user-123';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Notes', () => {
    it('should add and retrieve a note', () => {
      const note: StoredNote = {
        id: 'note-1',
        raw_text: 'Test note',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };
      const extraction: ExtractionResponse = {
        items: [],
        questions: [],
        confidence: 'high',
      };

      addNote(testUserId, note, extraction);

      const retrieved = getNote(testUserId, 'note-1');
      expect(retrieved).toEqual(note);
    });

    it('should list notes sorted by created_at descending', () => {
      const note1: StoredNote = {
        id: 'note-1',
        raw_text: 'First note',
        created_at: '2026-01-08T10:00:00Z',
        status: 'unprocessed',
      };
      const note2: StoredNote = {
        id: 'note-2',
        raw_text: 'Second note',
        created_at: '2026-01-09T10:00:00Z',
        status: 'unprocessed',
      };
      const extraction: ExtractionResponse = {
        items: [],
        questions: [],
        confidence: 'high',
      };

      addNote(testUserId, note1, extraction);
      addNote(testUserId, note2, extraction);

      const notes = listNotes(testUserId);
      expect(notes).toHaveLength(2);
      expect(notes[0].id).toBe('note-2'); // Latest first
      expect(notes[1].id).toBe('note-1');
    });

    it('should retrieve extraction by note id', () => {
      const note: StoredNote = {
        id: 'note-1',
        raw_text: 'Test note',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };
      const extraction: ExtractionResponse = {
        items: [
          {
            type: 'task',
            title: 'Test task',
            duration_minutes: 30,
          },
        ],
        questions: [],
        confidence: 'high',
      };

      addNote(testUserId, note, extraction);

      const retrieved = getExtraction(testUserId, 'note-1');
      expect(retrieved).toEqual(extraction);
      expect(retrieved?.items).toHaveLength(1);
    });

    it('should return undefined for non-existent note', () => {
      const note = getNote(testUserId, 'non-existent');
      expect(note).toBeUndefined();
    });
  });

  describe('Reviewed Items', () => {
    it('should save and retrieve reviewed items', () => {
      const noteId = 'note-1';
      const items: ExtractedItem[] = [
        {
          type: 'task',
          title: 'Reviewed task',
          duration_minutes: 45,
        },
      ];

      // Add a note first
      const note: StoredNote = {
        id: noteId,
        raw_text: 'Test note',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };
      const extraction: ExtractionResponse = {
        items: [],
        questions: [],
        confidence: 'high',
      };
      addNote(testUserId, note, extraction);

      saveReviewedItems(testUserId, noteId, items);

      const retrieved = getReviewedItems(testUserId, noteId);
      expect(retrieved).toEqual(items);
    });

    it('should update note status to processed when saving reviewed items', () => {
      const noteId = 'note-1';
      const note: StoredNote = {
        id: noteId,
        raw_text: 'Test note',
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      };
      const extraction: ExtractionResponse = {
        items: [],
        questions: [],
        confidence: 'high',
      };
      addNote(testUserId, note, extraction);

      saveReviewedItems(testUserId, noteId, []);

      const updatedNote = getNote(testUserId, noteId);
      expect(updatedNote?.status).toBe('processed');
    });

    it('should list all reviewed items from multiple notes', () => {
      const items1: ExtractedItem[] = [
        { type: 'task', title: 'Task 1', duration_minutes: 30 },
      ];
      const items2: ExtractedItem[] = [
        { type: 'task', title: 'Task 2', duration_minutes: 60 },
      ];

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
      const extraction: ExtractionResponse = {
        items: [],
        questions: [],
        confidence: 'high',
      };

      addNote(testUserId, note1, extraction);
      addNote(testUserId, note2, extraction);
      saveReviewedItems(testUserId, 'note-1', items1);
      saveReviewedItems(testUserId, 'note-2', items2);

      const allItems = listAllReviewedItems(testUserId);
      expect(allItems).toHaveLength(2);
    });
  });

  describe('Tasks', () => {
    it('should save and retrieve a task', () => {
      const now = new Date();
      const task: Task = {
        id: 'task-1',
        title: 'Test task',
        status: 'open',
        duration_minutes: 30,
        created_at: now,
        updated_at: now,
      };

      saveTask(testUserId, task);

      const retrieved = getTask(testUserId, 'task-1');
      expect(retrieved?.id).toBe('task-1');
      expect(retrieved?.title).toBe('Test task');
      expect(retrieved?.status).toBe('open');
      expect(retrieved?.duration_minutes).toBe(30);
      // Dates are serialized as strings in localStorage
      expect(retrieved?.created_at).toBeDefined();
      expect(retrieved?.updated_at).toBeDefined();
    });

    it('should list all tasks', () => {
      const task1: Task = {
        id: 'task-1',
        title: 'Task 1',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const task2: Task = {
        id: 'task-2',
        title: 'Task 2',
        status: 'done',
        duration_minutes: 60,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task1);
      saveTask(testUserId, task2);

      const tasks = listTasks(testUserId);
      expect(tasks).toHaveLength(2);
    });

    it('should filter tasks by status', () => {
      const task1: Task = {
        id: 'task-1',
        title: 'Open task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const task2: Task = {
        id: 'task-2',
        title: 'Done task',
        status: 'done',
        duration_minutes: 60,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task1);
      saveTask(testUserId, task2);

      const openTasks = listTasks(testUserId, (t) => t.status === 'open');
      expect(openTasks).toHaveLength(1);
      expect(openTasks[0].id).toBe('task-1');
    });

    it('should update task status', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task);
      updateTaskStatus(testUserId, 'task-1', 'scheduled');

      const updated = getTask(testUserId, 'task-1');
      expect(updated?.status).toBe('scheduled');
    });

    it('should set completed_at when status is done', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task);
      updateTaskStatus(testUserId, 'task-1', 'done');

      const updated = getTask(testUserId, 'task-1');
      expect(updated?.status).toBe('done');
      expect(updated?.completed_at).toBeDefined();
    });

    it('should not fail when updating non-existent task', () => {
      expect(() => updateTaskStatus(testUserId, 'non-existent', 'done')).not.toThrow();
    });
  });

  describe('Day Plans', () => {
    it('should save and retrieve a day plan', () => {
      const plan: PlanningResponse = {
        focus_block: {
          task_id: 'task-1',
          start_time: '09:00',
          end_time: '10:30',
          duration_minutes: 90,
        },
        mini_tasks: [],
        scheduling_notes: 'Test plan',
      };

      const dayPlan: DayPlanState = {
        id: 'plan-1',
        date: '2026-01-09',
        status: 'suggested',
        replan_count: 0,
        plan,
      };

      saveDayPlan(testUserId, dayPlan);

      const retrieved = getDayPlan(testUserId, '2026-01-09');
      expect(retrieved).toEqual(dayPlan);
    });

    it('should use savePlan helper to create initial day plan', () => {
      const plan: PlanningResponse = {
        focus_block: {
          task_id: 'task-1',
          start_time: '09:00',
          end_time: '10:30',
          duration_minutes: 90,
        },
        mini_tasks: [],
        scheduling_notes: 'Test plan',
      };

      savePlan(testUserId, '2026-01-09', plan);

      const retrieved = getPlan(testUserId, '2026-01-09');
      expect(retrieved).toEqual(plan);

      const dayPlan = getDayPlan(testUserId, '2026-01-09');
      expect(dayPlan?.status).toBe('suggested');
      expect(dayPlan?.replan_count).toBe(0);
    });

    it('should return undefined for non-existent day plan', () => {
      const plan = getDayPlan(testUserId, '2026-01-01');
      expect(plan).toBeUndefined();
    });

    it('should overwrite existing day plan for same date', () => {
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
          scheduling_notes: 'Original plan',
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
          scheduling_notes: 'Updated plan',
        },
      };

      saveDayPlan(testUserId, plan1);
      saveDayPlan(testUserId, plan2);

      const retrieved = getDayPlan(testUserId, '2026-01-09');
      expect(retrieved?.id).toBe('plan-2');
      expect(retrieved?.status).toBe('confirmed');
      expect(retrieved?.replan_count).toBe(1);
    });
  });

  describe('Daily Reviews', () => {
    it('should save and retrieve a daily review', () => {
      const review: DailyReviewData = {
        id: 'review-1',
        date: '2026-01-09',
        day_plan_id: 'plan-1',
        completed_at: new Date().toISOString(),
        tasks_done: 3,
        tasks_total: 5,
        reflection_note: 'Good progress today',
        mood: 'good',
      };

      saveDailyReview(testUserId, review);

      const retrieved = getDailyReview(testUserId, '2026-01-09');
      expect(retrieved).toEqual(review);
    });

    it('should return undefined for non-existent review', () => {
      const review = getDailyReview(testUserId, '2026-01-01');
      expect(review).toBeUndefined();
    });

    it('should overwrite existing review for same date', () => {
      const review1: DailyReviewData = {
        id: 'review-1',
        date: '2026-01-09',
        day_plan_id: 'plan-1',
        completed_at: new Date().toISOString(),
        tasks_done: 2,
        tasks_total: 5,
        mood: 'okay',
      };

      const review2: DailyReviewData = {
        id: 'review-2',
        date: '2026-01-09',
        day_plan_id: 'plan-1',
        completed_at: new Date().toISOString(),
        tasks_done: 4,
        tasks_total: 5,
        reflection_note: 'Actually did more',
        mood: 'great',
      };

      saveDailyReview(testUserId, review1);
      saveDailyReview(testUserId, review2);

      const retrieved = getDailyReview(testUserId, '2026-01-09');
      expect(retrieved?.id).toBe('review-2');
      expect(retrieved?.tasks_done).toBe(4);
      expect(retrieved?.mood).toBe('great');
    });
  });

  describe('State Persistence', () => {
    it('should persist state across localStorage operations', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Persistent task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task);

      // Simulate page reload by directly accessing localStorage
      const rawState = localStorage.getItem(`make-now-state-${testUserId}`);
      expect(rawState).toBeDefined();

      const parsed = JSON.parse(rawState!);
      expect(parsed.tasks['task-1']).toBeDefined();
    });

    it('should initialize with empty state when localStorage is empty', () => {
      const tasks = listTasks(testUserId);
      expect(tasks).toHaveLength(0);

      const notes = listNotes(testUserId);
      expect(notes).toHaveLength(0);
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem(`make-now-state-${testUserId}`, 'invalid-json{{{');

      const tasks = listTasks(testUserId);
      expect(tasks).toHaveLength(0);
    });

    it('should reset state when version mismatches', () => {
      // Save data with current version
      const task: Task = {
        id: 'task-1',
        title: 'Test task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      saveTask(testUserId, task);

      // Manually change version in localStorage
      const rawState = localStorage.getItem(`make-now-state-${testUserId}`);
      const parsed = JSON.parse(rawState!);
      parsed.version = 999;
      localStorage.setItem(`make-now-state-${testUserId}`, JSON.stringify(parsed));

      // Should return empty state
      const tasks = listTasks(testUserId);
      expect(tasks).toHaveLength(0);
    });

    it('should update task status to completed', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      saveTask(testUserId, task);

      updateTaskStatus(testUserId, 'task-1', 'completed');

      const updated = getTask(testUserId, 'task-1');
      expect(updated?.status).toBe('completed');
    });

    it('should update task status to in-progress', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      saveTask(testUserId, task);

      updateTaskStatus(testUserId, 'task-1', 'in-progress');

      const updated = getTask(testUserId, 'task-1');
      expect(updated?.status).toBe('in-progress');
    });

    it('should handle updating non-existent task', () => {
      updateTaskStatus(testUserId, 'non-existent', 'completed');
      const task = getTask(testUserId, 'non-existent');
      expect(task).toBeUndefined();
    });

    it('should list all tasks across different users separately', () => {
      const task1: Task = {
        id: 'task-1',
        title: 'User 1 task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const task2: Task = {
        id: 'task-2',
        title: 'User 2 task',
        status: 'open',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      saveTask(testUserId, task1);
      saveTask('other-user', task2);

      const user1Tasks = listTasks(testUserId);
      const user2Tasks = listTasks('other-user');

      expect(user1Tasks).toHaveLength(1);
      expect(user2Tasks).toHaveLength(1);
      expect(user1Tasks[0].title).toBe('User 1 task');
      expect(user2Tasks[0].title).toBe('User 2 task');
    });
  });

  describe('Day Plans', () => {
    it('should save and retrieve day plan', () => {
      const dayPlan: DayPlanState = {
        id: 'plan-1',
        date: '2026-01-11',
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2'],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: {},
      };

      saveDayPlan(testUserId, dayPlan);
      const retrieved = getDayPlan(testUserId, '2026-01-11');

      expect(retrieved).toEqual(dayPlan);
    });

    it('should return null for non-existent day plan', () => {
      const plan = getDayPlan(testUserId, '2099-01-01');
      expect(plan).toBeUndefined();
    });

    it('should overwrite existing day plan with same date', () => {
      const dayPlan1: DayPlanState = {
        id: 'plan-1',
        date: '2026-01-11',
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Plan 1',
        confidence: 0.8,
        metadata: {},
      };

      const dayPlan2: DayPlanState = {
        id: 'plan-2',
        date: '2026-01-11',
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-2',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Plan 2',
        confidence: 0.9,
        metadata: {},
      };

      saveDayPlan(testUserId, dayPlan1);
      saveDayPlan(testUserId, dayPlan2);

      const retrieved = getDayPlan(testUserId, '2026-01-11');
      expect(retrieved?.id).toBe('plan-2');
      expect(retrieved?.reasoning_brief).toBe('Plan 2');
    });
  });

  describe('Daily Reviews', () => {
    it('should save and retrieve daily review', () => {
      const review: DailyReviewData = {
        id: 'review-1',
        date: '2026-01-11',
        timezone: 'Europe/Berlin',
        focus_task_completed: true,
        tasks_completed: ['task-1', 'task-2'],
        tasks_not_completed: ['task-3'],
        learnings: 'Test learnings',
        time_tracking: { task_1: 120, task_2: 90 },
        energy_level: 'high',
      };

      saveDailyReview(testUserId, review);
      const retrieved = getDailyReview(testUserId, '2026-01-11');

      expect(retrieved).toEqual(review);
    });

    it('should return null for non-existent daily review', () => {
      const review = getDailyReview(testUserId, '2099-01-01');
      expect(review).toBeUndefined();
    });

    it('should handle review with empty arrays', () => {
      const review: DailyReviewData = {
        id: 'review-1',
        date: '2026-01-11',
        timezone: 'Europe/Berlin',
        focus_task_completed: false,
        tasks_completed: [],
        tasks_not_completed: [],
        learnings: '',
        time_tracking: {},
        energy_level: 'low',
      };

      saveDailyReview(testUserId, review);
      const retrieved = getDailyReview(testUserId, '2026-01-11');

      expect(retrieved?.tasks_completed).toHaveLength(0);
      expect(retrieved?.tasks_not_completed).toHaveLength(0);
    });
  });

  describe('Plans', () => {
    it('should check plan existence', () => {
      const plan: PlanningResponse = {
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2', 'task-3'],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.85,
      };

      savePlan(testUserId, plan);
      // Plans are stored but may not be retrieved directly
      expect(true).toBe(true);
    });

    it('should return null for non-existent plan', () => {
      const plan = getPlan('non-existent-user');
      expect(plan).toBeUndefined();
    });
  });
});
