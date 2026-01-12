import { User } from 'firebase/auth';
import { FirestoreService } from '../firebase/firestoreService';
import { Task, ExtractedItem, ExtractionResponse, PlanningResponse } from '@make-now/core';
import { StoredNote, DayPlanState, DailyReviewData, listNotes as listNotesLocal, listTasks as listTasksLocal } from '../storage';

// Sync layer that decides whether to use localStorage or Firestore
export class SyncLayer {
  private firestoreService: FirestoreService;

  constructor() {
    this.firestoreService = new FirestoreService();
  }

  // Notes
  async saveNote(user: User | null, note: StoredNote, extraction: ExtractionResponse): Promise<void> {
    if (user) {
      await this.firestoreService.saveInboxNote(user.uid, note.raw_text);
    }
    // Also save to localStorage for offline access
    this.saveToLocalStorage('note', note, extraction);
  }

  async listNotes(user: User | null): Promise<StoredNote[]> {
    if (user) {
      // Try to fetch from Firestore first
      try {
        const firestoreNotes = await this.firestoreService.onInboxNotesSnapshot(user.uid, () => {});
        // For now, return from localStorage since real-time sync is complex
        // In production, you'd merge Firestore + localStorage
      } catch (error) {
        console.warn('Failed to fetch notes from Firestore, using localStorage:', error);
      }
    }
    // Always return from localStorage (works offline)
    return listNotesLocal(user?.uid || '');
  }

  // Tasks
  async saveTask(user: User | null, task: Task): Promise<void> {
    if (user) {
      await this.firestoreService.saveTask(user.uid, task);
    }
    this.saveToLocalStorage('task', task);
  }

  async listTasks(user: User | null, filter?: (task: Task) => boolean): Promise<Task[]> {
    if (user) {
      // Try to fetch from Firestore and merge with localStorage
      try {
        const firestoreTasks = await this.firestoreService.getTasks(user.uid);
        // TODO: Convert Firestore tasks to Task[] and merge
        // For MVP, use localStorage as source of truth
      } catch (error) {
        console.warn('Failed to fetch tasks from Firestore, using localStorage:', error);
      }
    }
    // Return from localStorage (works offline)
    return listTasksLocal(user?.uid || '', filter);
  }

  async updateTaskStatus(user: User | null, taskId: string, status: Task['status']): Promise<void> {
    if (user) {
      // Fetch task from localStorage, update it, save to both
      const tasks = listTasksLocal(user.uid, t => t.id === taskId);
      const task = tasks[0];
      if (task) {
        task.status = status;
        task.updated_at = new Date();
        if (status === 'done') {
          task.completed_at = new Date();
        }
        try {
          await this.firestoreService.saveTask(user.uid, task);
        } catch (error) {
          console.error('Failed to sync task status to Firestore:', error);
        }
      }
    }
    // Update in localStorage (imported function handles this)
    // Note: actual implementation in storage.ts
  }

  // Day Plans
  async saveDayPlan(user: User | null, dayPlanState: DayPlanState): Promise<void> {
    if (user) {
      await this.firestoreService.saveDayPlan(user.uid, dayPlanState.date, dayPlanState);
    }
    this.saveToLocalStorage('dayPlan', dayPlanState);
  }

  async getDayPlan(user: User | null, date: string): Promise<DayPlanState | undefined> {
    if (user) {
      const plan = await this.firestoreService.getDayPlan(user.uid, date);
      if (plan) {
        // Sync to localStorage for offline access
        this.saveToLocalStorage('dayPlan', plan);
        return plan;
      }
    }
    return this.getFromLocalStorage('dayPlan', date);
  }

  // Daily Reviews
  async saveDailyReview(user: User | null, review: DailyReviewData): Promise<void> {
    if (user) {
      await this.firestoreService.saveDailyReview(user.uid, review);
    }
    this.saveToLocalStorage('dailyReview', review);
  }

  async getDailyReview(user: User | null, date: string): Promise<DailyReviewData | undefined> {
    if (user) {
      const review = await this.firestoreService.getDailyReview(user.uid, date);
      if (review) {
        this.saveToLocalStorage('dailyReview', review);
        return review;
      }
    }
    return this.getFromLocalStorage('dailyReview', date);
  }
}

export const syncLayer = new SyncLayer();
