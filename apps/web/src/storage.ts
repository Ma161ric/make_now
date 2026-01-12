import { ExtractionResponse, PlanningResponse, ExtractedItem, Task, TaskStatus } from '@make-now/core';
import { User } from 'firebase/auth';
import { FirestoreService } from './firebase/firestoreService';

const VERSION = 1;

const firestoreService = new FirestoreService();

// Generate user-scoped storage key
function getStorageKey(userId: string): string {
  return `make-now-state-${userId}`;
}

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
  version: number; // For conflict resolution (Last-Write-Wins)
  timestamp: number; // Unix timestamp for comparison
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

function loadState(userId: string): StoredState {
  const raw = localStorage.getItem(getStorageKey(userId));
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

function saveState(userId: string, state: StoredState) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
}

export function listNotes(userId: string): StoredNote[] {
  return loadState(userId).notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addNote(userId: string, note: StoredNote, extraction: ExtractionResponse, user?: User | null) {
  const state = loadState(userId);
  state.notes.push(note);
  state.extractions[note.id] = extraction;
  saveState(userId, state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveInboxNote(user.uid, note.raw_text);
  }
}

export function getNote(userId: string, id: string): StoredNote | undefined {
  return loadState(userId).notes.find((n) => n.id === id);
}

export function getExtraction(userId: string, id: string): ExtractionResponse | undefined {
  return loadState(userId).extractions[id];
}

export function saveReviewedItems(userId: string, noteId: string, items: ExtractedItem[]) {
  const state = loadState(userId);
  state.reviewedItems[noteId] = items;
  const note = state.notes.find((n) => n.id === noteId);
  if (note) note.status = 'processed';
  saveState(userId, state);
}

export function getReviewedItems(userId: string, noteId: string): ExtractedItem[] | undefined {
  return loadState(userId).reviewedItems[noteId];
}

export function listAllReviewedItems(userId: string): ExtractedItem[] {
  const state = loadState(userId);
  return Object.values(state.reviewedItems).flat();
}

export async function saveTask(userId: string, task: Task, user?: User | null) {
  const state = loadState(userId);
  state.tasks[task.id] = task;
  saveState(userId, state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveTask(user.uid, task);
  }
}

export function getTask(userId: string, id: string): Task | undefined {
  return loadState(userId).tasks[id];
}

export function listTasks(userId: string, filter?: (task: Task) => boolean): Task[] {
  const state = loadState(userId);
  const tasks = Object.values(state.tasks);
  return filter ? tasks.filter(filter) : tasks;
}

export async function updateTaskStatus(userId: string, taskId: string, status: TaskStatus, user?: User | null) {
  const state = loadState(userId);
  const task = state.tasks[taskId];
  if (task) {
    task.status = status;
    task.updated_at = new Date();
    if (status === 'done') {
      task.completed_at = new Date();
    }
    saveState(userId, state);
    
    // Sync to Firestore if user is logged in
    if (user) {
      await firestoreService.saveTask(user.uid, task);
    }
  }
}

export async function saveDayPlan(userId: string, dayPlanState: DayPlanState, user?: User | null) {
  const state = loadState(userId);
  const existing = state.dayPlans[dayPlanState.date];
  
  // MUST-003: Increment version and update timestamp for conflict detection
  if (existing && !dayPlanState.version) {
    dayPlanState.version = (existing.version || 0) + 1;
  } else if (!dayPlanState.version) {
    dayPlanState.version = 1;
  }
  dayPlanState.timestamp = Date.now();
  
  state.dayPlans[dayPlanState.date] = dayPlanState;
  saveState(userId, state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveDayPlan(user.uid, dayPlanState.date, dayPlanState);
  }
}

export function getDayPlan(userId: string, date: string): DayPlanState | undefined {
  return loadState(userId).dayPlans[date];
}

export async function saveDailyReview(userId: string, review: DailyReviewData, user?: User | null) {
  const state = loadState(userId);
  state.dailyReviews[review.date] = review;
  saveState(userId, state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveDailyReview(user.uid, review);
  }
}

export function getDailyReview(userId: string, date: string): DailyReviewData | undefined {
  return loadState(userId).dailyReviews[date];
}

export async function savePlan(userId: string, date: string, plan: PlanningResponse, user?: User | null) {
  const state = loadState(userId);
  const now = Date.now();
  const dayPlanState: DayPlanState = {
    id: `plan-${date}-${now}`,
    date,
    version: 1, // Initial version for new plan
    timestamp: now, // MUST-003: Track creation time for conflict detection
    status: 'suggested',
    replan_count: 0,
    plan,
  };
  state.dayPlans[date] = dayPlanState;
  saveState(userId, state);
  
  // Sync to Firestore if user is logged in
  if (user) {
    await firestoreService.saveDayPlan(user.uid, date, dayPlanState);
  }
}

export function getPlan(userId: string, date: string): PlanningResponse | undefined {
  const dayPlan = loadState(userId).dayPlans[date];
  return dayPlan?.plan;
}

/**
 * MUST-003: Conflict Resolution for Multi-Tab/Multi-Device Sync
 * Uses Last-Write-Wins (LWW) strategy with timestamp comparison.
 * 
 * Scenario: User opens two tabs, plans in both, both hit Firestore.
 * Without conflict resolution: Indeterminate which version wins.
 * With LWW: Latest timestamp always wins (deterministic, simple).
 * 
 * Trade-off: Loses earlier changes, but consistent state preferred over conflicted state.
 * Alternative: Merge strategy (complex, requires 3-way merge logic).
 */
export function resolvePlanConflict(
  local: DayPlanState | null,
  remote: DayPlanState | null
): DayPlanState | null {
  // Case 1: Only one version exists
  if (!local) return remote;
  if (!remote) return local;

  // Case 2: Both exist, compare timestamps
  const localTime = local.timestamp || 0;
  const remoteTime = remote.timestamp || 0;

  if (remoteTime > localTime) {
    console.log(
      `[Sync Conflict] Remote version wins (${new Date(remoteTime).toISOString()} > ${new Date(localTime).toISOString()})`
    );
    return remote;
  } else {
    console.log(
      `[Sync Conflict] Local version wins (${new Date(localTime).toISOString()} >= ${new Date(remoteTime).toISOString()})`
    );
    return local;
  }
}
