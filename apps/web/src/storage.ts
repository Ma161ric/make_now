import { ExtractionResponse, PlanningResponse, ExtractedItem, Task, TaskStatus } from '@make-now/core';
import { User } from 'firebase/auth';
import { FirestoreService } from './firebase/firestoreService';

const STORAGE_KEY = 'make-now-state';
const VERSION = 1;

const firestoreService = new FirestoreService();

export type NoteStatus = 'unprocessed' | 'processed' | 'archived';
export interface StoredNote {
  id: string;
  raw_text: string;
  created_at: string; // ISO
  status: NoteStatus;
}

export interface DayPlanState {
  id: string;
  date: string;
  status: 'suggested' | 'confirmed' | 'replanned' | 'completed';
  replan_count: number;
  original_plan_id?: string;
  plan: PlanningResponse;
  confirmed_at?: string;
}

export interface DailyReviewData {
  id: string;
  date: string;
  day_plan_id: string;
  completed_at: string;
  tasks_done: number;
  tasks_total: number;
  reflection_note?: string;
  mood?: 'great' | 'good' | 'okay' | 'tough';
}

interface StoredState {
  version: number;
  notes: StoredNote[];
  extractions: Record<string, ExtractionResponse>;
  reviewedItems: Record<string, ExtractedItem[]>; // editable items after review
  tasks: Record<string, Task>; // all tasks by ID
  dayPlans: Record<string, DayPlanState>; // keyed by date
  dailyReviews: Record<string, DailyReviewData>; // keyed by date
}

function initialState(): StoredState {
  return {
    version: VERSION,
    notes: [],
    extractions: {},
    reviewedItems: {},
    tasks: {},
    dayPlans: {},
    dailyReviews: {},
  };
}

function loadState(): StoredState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialState();
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== VERSION) {
      return initialState();
    }
    return parsed as StoredState;
  } catch {
    return initialState();
  }
}

function saveState(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function listNotes(): StoredNote[] {
  return loadState().notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addNote(note: StoredNote, extraction: ExtractionResponse, user?: User | null) {
  const state = loadState();
  state.notes.push(note);
  state.extractions[note.id] = extraction;
  saveState(state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveInboxNote(user.uid, note.raw_text);
  }
}

export function getNote(id: string): StoredNote | undefined {
  return loadState().notes.find((n) => n.id === id);
}

export function getExtraction(id: string): ExtractionResponse | undefined {
  return loadState().extractions[id];
}

export function saveReviewedItems(noteId: string, items: ExtractedItem[]) {
  const state = loadState();
  state.reviewedItems[noteId] = items;
  const note = state.notes.find((n) => n.id === noteId);
  if (note) note.status = 'processed';
  saveState(state);
}

export function getReviewedItems(noteId: string): ExtractedItem[] | undefined {
  return loadState().reviewedItems[noteId];
}

export function listAllReviewedItems(): ExtractedItem[] {
  const state = loadState();
  return Object.values(state.reviewedItems).flat();
}

export async function saveTask(task: Task, user?: User | null) {
  const state = loadState();
  state.tasks[task.id] = task;
  saveState(state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveTask(user.uid, task);
  }
}

export function getTask(id: string): Task | undefined {
  return loadState().tasks[id];
}

export function listTasks(filter?: (task: Task) => boolean): Task[] {
  const state = loadState();
  const tasks = Object.values(state.tasks);
  return filter ? tasks.filter(filter) : tasks;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, user?: User | null) {
  const state = loadState();
  const task = state.tasks[taskId];
  if (task) {
    task.status = status;
    task.updated_at = new Date();
    if (status === 'done') {
      task.completed_at = new Date();
    }
    saveState(state);
    
    // Sync to Firestore if user is logged in
    if (user) {
      await firestoreService.saveTask(user.uid, task);
    }
  }
}

export async function saveDayPlan(dayPlanState: DayPlanState, user?: User | null) {
  const state = loadState();
  state.dayPlans[dayPlanState.date] = dayPlanState;
  saveState(state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveDayPlan(user.uid, dayPlanState.date, dayPlanState);
  }
}

export function getDayPlan(date: string): DayPlanState | undefined {
  return loadState().dayPlans[date];
}

export async function saveDailyReview(review: DailyReviewData, user?: User | null) {
  const state = loadState();
  state.dailyReviews[review.date] = review;
  saveState(state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveDailyReview(user.uid, review);
  }
}

export function getDailyReview(date: string): DailyReviewData | undefined {
  return loadState().dailyReviews[date];
}

export async function savePlan(date: string, plan: PlanningResponse, user?: User | null) {
  const state = loadState();
  const dayPlanState: DayPlanState = {
    id: `plan-${date}-${Date.now()}`,
    date,
    status: 'suggested',
    replan_count: 0,
    plan,
  };
  state.dayPlans[date] = dayPlanState;
  saveState(state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveDayPlan(user.uid, date, dayPlanState);
  }
}

export function getPlan(date: string): PlanningResponse | undefined {
  const dayPlan = loadState().dayPlans[date];
  return dayPlan?.plan;
}
