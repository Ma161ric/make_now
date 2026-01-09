import { ExtractionResponse, PlanningResponse, ExtractedItem } from '@make-now/core';

const STORAGE_KEY = 'make-now-state';
const VERSION = 1;

export type NoteStatus = 'saved' | 'processed';
export interface StoredNote {
  id: string;
  raw_text: string;
  created_at: string; // ISO
  status: NoteStatus;
}

interface StoredState {
  version: number;
  notes: StoredNote[];
  extractions: Record<string, ExtractionResponse>;
  reviewedItems: Record<string, ExtractedItem[]>; // editable items after review
  plans: Record<string, PlanningResponse>; // keyed by ISO date
}

function initialState(): StoredState {
  return {
    version: VERSION,
    notes: [],
    extractions: {},
    reviewedItems: {},
    plans: {},
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

export function savePlan(date: string, plan: PlanningResponse) {
  const state = loadState();
  state.plans[date] = plan;
  saveState(state);
}

export function getPlan(date: string): PlanningResponse | undefined {
  return loadState().plans[date];
}
