import { ExtractionResponse, PlanningResponse, ExtractedItem, Task, TaskStatus } from '@make-now/core';

const STORAGE_KEY = 'make-now-state';
const VERSION = 1;

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

export function addNote(note: StoredNote, extraction: ExtractionResponse) {
  const state = loadState();
  state.notes.push(note);
  state.extractions[note.id] = extraction;
  saveState(state);
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

export function saveTask(task: Task) {
  const state = loadState();
  state.tasks[task.id] = task;
  saveState(state);
}

export function getTask(id: string): Task | undefined {
  return loadState().tasks[id];
}

export function listTasks(filter?: (task: Task) => boolean): Task[] {
  const state = loadState();
  const tasks = Object.values(state.tasks);
  return filter ? tasks.filter(filter) : tasks;
}

export function updateTaskStatus(taskId: string, status: TaskStatus) {
  const state = loadState();
  const task = state.tasks[taskId];
  if (task) {
    task.status = status;
    task.updated_at = new Date();
    if (status === 'done') {
      task.completed_at = new Date();
    }
    saveState(state);
  }
}

export function saveDayPlan(dayPlanState: DayPlanState) {
  const state = loadState();
  state.dayPlans[dayPlanState.date] = dayPlanState;
  saveState(state);
}

export function getDayPlan(date: string): DayPlanState | undefined {
  return loadState().dayPlans[date];
}

export function saveDailyReview(review: DailyReviewData) {
  const state = loadState();
  state.dailyReviews[review.date] = review;
  saveState(state);
}

export function getDailyReview(date: string): DailyReviewData | undefined {
  return loadState().dailyReviews[date];
}

export function savePlan(date: string, plan: PlanningResponse) {
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
}

export function getPlan(date: string): PlanningResponse | undefined {
  const dayPlan = loadState().dayPlans[date];
  return dayPlan?.plan;
}
