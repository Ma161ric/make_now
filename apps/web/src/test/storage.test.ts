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

      addNote(note, extraction);

      const retrieved = getNote('note-1');
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

      addNote(note1, extraction);
      addNote(note2, extraction);

      const notes = listNotes();
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

      addNote(note, extraction);

      const retrieved = getExtraction('note-1');
      expect(retrieved).toEqual(extraction);
      expect(retrieved?.items).toHaveLength(1);
    });

    it('should return undefined for non-existent note', () => {
      const note = getNote('non-existent');
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
      addNote(note, extraction);

      saveReviewedItems(noteId, items);

      const retrieved = getReviewedItems(noteId);
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
      addNote(note, extraction);

      saveReviewedItems(noteId, []);

      const updatedNote = getNote(noteId);
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

      addNote(note1, extraction);
      addNote(note2, extraction);
      saveReviewedItems('note-1', items1);
      saveReviewedItems('note-2', items2);

      const allItems = listAllReviewedItems();
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

      saveTask(task);

      const retrieved = getTask('task-1');
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

      saveTask(task1);
      saveTask(task2);

      const tasks = listTasks();
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

      saveTask(task1);
      saveTask(task2);

      const openTasks = listTasks((t) => t.status === 'open');
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

      saveTask(task);
      updateTaskStatus('task-1', 'scheduled');

      const updated = getTask('task-1');
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

      saveTask(task);
      updateTaskStatus('task-1', 'done');

      const updated = getTask('task-1');
      expect(updated?.status).toBe('done');
      expect(updated?.completed_at).toBeDefined();
    });

    it('should not fail when updating non-existent task', () => {
      expect(() => updateTaskStatus('non-existent', 'done')).not.toThrow();
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

      saveDayPlan(dayPlan);

      const retrieved = getDayPlan('2026-01-09');
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

      savePlan('2026-01-09', plan);

      const retrieved = getPlan('2026-01-09');
      expect(retrieved).toEqual(plan);

      const dayPlan = getDayPlan('2026-01-09');
      expect(dayPlan?.status).toBe('suggested');
      expect(dayPlan?.replan_count).toBe(0);
    });

    it('should return undefined for non-existent day plan', () => {
      const plan = getDayPlan('2026-01-01');
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

      saveDayPlan(plan1);
      saveDayPlan(plan2);

      const retrieved = getDayPlan('2026-01-09');
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

      saveDailyReview(review);

      const retrieved = getDailyReview('2026-01-09');
      expect(retrieved).toEqual(review);
    });

    it('should return undefined for non-existent review', () => {
      const review = getDailyReview('2026-01-01');
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

      saveDailyReview(review1);
      saveDailyReview(review2);

      const retrieved = getDailyReview('2026-01-09');
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

      saveTask(task);

      // Simulate page reload by directly accessing localStorage
      const rawState = localStorage.getItem('make-now-state');
      expect(rawState).toBeDefined();

      const parsed = JSON.parse(rawState!);
      expect(parsed.tasks['task-1']).toBeDefined();
    });

    it('should initialize with empty state when localStorage is empty', () => {
      const tasks = listTasks();
      expect(tasks).toHaveLength(0);

      const notes = listNotes();
      expect(notes).toHaveLength(0);
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('make-now-state', 'invalid-json{{{');

      const tasks = listTasks();
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
      saveTask(task);

      // Manually change version in localStorage
      const rawState = localStorage.getItem('make-now-state');
      const parsed = JSON.parse(rawState!);
      parsed.version = 999;
      localStorage.setItem('make-now-state', JSON.stringify(parsed));

      // Should return empty state
      const tasks = listTasks();
      expect(tasks).toHaveLength(0);
    });
  });
});
