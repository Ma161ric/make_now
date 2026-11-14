/**
 * Suggestions = what the AI recognised in a note, waiting for ✓ or ×.
 * Kept in localStorage per user until confirmed (becomes a task) or dropped.
 */
import type { ExtractionResponse, Importance, Task, TaskFields, EventFields, IdeaFields } from '@make-now/core';
import { uuid } from '../utils';

export interface Suggestion {
  id: string;
  kind: 'task' | 'event' | 'idea';
  title: string;
  duration_min_minutes: number;
  duration_max_minutes: number;
  importance: Importance;
  due_at?: string; // ISO
  note?: string;
  source: string; // the note it came from
  created_at: string;
}

const key = (uid: string) => `dayflow_suggestions_${uid}`;
const EVENT = 'dayflow:suggestions';

export function loadSuggestions(uid: string): Suggestion[] {
  try {
    return JSON.parse(localStorage.getItem(key(uid)) || '[]');
  } catch {
    return [];
  }
}

export function saveSuggestions(uid: string, list: Suggestion[]) {
  localStorage.setItem(key(uid), JSON.stringify(list.slice(0, 50)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onSuggestionsChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Turn an extraction into suggestions (events/ideas become tasks too, labelled). */
export function fromExtraction(extraction: ExtractionResponse, source: string): Suggestion[] {
  const now = new Date().toISOString();
  return (extraction.items || []).map((item) => {
    const base = { id: uuid(), title: item.title, source, created_at: now };
    if (item.type === 'event') {
      const f = item.parsed_fields as EventFields;
      return { ...base, kind: 'event' as const, duration_min_minutes: 30, duration_max_minutes: 60, importance: 'high' as Importance, due_at: f.start_at, note: f.location };
    }
    if (item.type === 'idea') {
      const f = item.parsed_fields as IdeaFields;
      return { ...base, kind: 'idea' as const, duration_min_minutes: 15, duration_max_minutes: 30, importance: 'low' as Importance, note: f.content };
    }
    const f = item.parsed_fields as TaskFields;
    return {
      ...base,
      kind: 'task' as const,
      duration_min_minutes: f.duration_min_minutes || 15,
      duration_max_minutes: f.duration_max_minutes || f.duration_min_minutes || 30,
      importance: f.importance || 'medium',
      due_at: f.due_at,
    };
  });
}

export function suggestionToTask(s: Suggestion): Task {
  const now = new Date();
  return {
    id: uuid(),
    title: s.title,
    status: 'open',
    created_at: now,
    updated_at: now,
    duration_min_minutes: s.duration_min_minutes,
    duration_max_minutes: Math.max(s.duration_min_minutes, s.duration_max_minutes),
    estimation_source: 'ai',
    importance: s.importance,
    due_at: s.due_at ? new Date(s.due_at) : undefined,
    raw_note: s.source,
    notes: s.note,
  };
}

export function durationLabel(min?: number, max?: number): string {
  if (!min && !max) return '';
  const a = min || max!;
  const b = max || min!;
  const fmt = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h`.replace('.', ',') : `${m} min`);
  return a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`.replace(' min–', '–');
}
