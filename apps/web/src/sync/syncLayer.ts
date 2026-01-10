import { User } from 'firebase/auth';
import { FirestoreService } from '../firebase/firestoreService';
import { Task, ExtractedItem, ExtractionResponse, PlanningResponse } from '@make-now/core';
import { StoredNote, DayPlanState, DailyReviewData } from '../storage';

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
      // TODO: Fetch from Firestore
      // For now, fall back to localStorage
    }
    return this.getFromLocalStorage('notes');
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
      // TODO: Implement Firestore fetch
      // For now, fall back to localStorage
    }
    return this.getFromLocalStorage('tasks', filter);
  }

  async updateTaskStatus(user: User | null, taskId: string, status: Task['status']): Promise<void> {
    if (user) {
      // Fetch task, update it, save back
      const task = await this.getFromLocalStorage('task', taskId);
      if (task) {
        task.status = status;
        task.updated_at = new Date();
        if (status === 'done') {
          task.completed_at = new Date();
        }
        await this.firestoreService.saveTask(user.uid, task);
      }
    }
    // Update in localStorage
    this.updateInLocalStorage('taskStatus', taskId, status);
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

  // LocalStorage fallback methods
  private saveToLocalStorage(type: string, data: any, extra?: any): void {
    // Delegate to original storage.ts functions
    // This is a simplified version - actual implementation would import from storage.ts
  }

  private getFromLocalStorage(type: string, param?: any): any {
    // Delegate to original storage.ts functions
  }

  private updateInLocalStorage(type: string, id: string, value: any): void {
    // Delegate to original storage.ts functions
  }
}

export const syncLayer = new SyncLayer();
