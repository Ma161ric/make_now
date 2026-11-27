/**
 * Suggestions = what the AI recognised in a note, waiting for ✓ or ×.
 * Kept in localStorage per user until confirmed (becomes a task) or dropped.
 */
import type { ExtractionResponse, Importance, Task, TaskFields, EventFields, IdeaFields } from '@make-now/core';
import { uuid } from '../utils';

export interface Suggestion {
  id: string;
  kind: 'task' | 'event' | 'idea' | 'memory' | 'person_note';
  /** memory / person_note: the text to remember */
  title: string;
  // person_note: who it is about (person_id when the assistant knew the person)
  person?: string;
  person_id?: string;
  duration_min_minutes: number;
  duration_max_minutes: number;
  importance: Importance;
  due_at?: string; // ISO
  note?: string;
  // appointments (kind 'event'): fixed time, go to the calendar, not to Aufgaben
  start_at?: string; // ISO
  end_at?: string; // ISO
  location?: string;
  source: string; // the note or chat message it came from
  msg_id?: string; // assistant message it belongs to (shown inline under it on phones)
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
      const end = f.start_at ? new Date(new Date(f.start_at).getTime() + 60 * 60_000).toISOString() : undefined;
      return { ...base, kind: 'event' as const, duration_min_minutes: 60, duration_max_minutes: 60, importance: 'high' as Importance, due_at: f.start_at, start_at: f.start_at, end_at: f.end_at || end, location: f.location };
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
  if (a === b) return fmt(a);
  // "15–30 min", but "30 min – 1 h" when the units differ
  return a < 60 && b < 60 ? `${a}–${b} min` : a >= 60 && b >= 60 ? `${fmt(a).replace(' h', '')}–${fmt(b)}` : `${fmt(a)} – ${fmt(b)}`;
}

/** Chat proposals → suggestions for the Assistent panel. */
export function fromChatProposals(proposals: any[], source: string, msgId?: string): Suggestion[] {
  const now = new Date().toISOString();
  return (proposals || []).flatMap((p): Suggestion[] => {
    if (!p?.title) return [];
    const base = { id: uuid(), title: String(p.title), source, msg_id: msgId, created_at: now, importance: (p.importance || 'medium') as Importance };
    if (p.kind === 'memory') {
      return [{ ...base, kind: 'memory', importance: 'low', duration_min_minutes: 0, duration_max_minutes: 0 }];
    }
    if (p.kind === 'person_note') {
      if (typeof p.person !== 'string' || !p.person.trim()) return [];
      return [{ ...base, kind: 'person_note', importance: 'low', duration_min_minutes: 0, duration_max_minutes: 0, person: p.person.trim(), ...(typeof p.person_id === 'string' ? { person_id: p.person_id } : {}) }];
    }
    if (p.kind === 'event' && p.start_at) {
      const mins = p.end_at ? Math.max(15, Math.round((+new Date(p.end_at) - +new Date(p.start_at)) / 60000)) : 60;
      return [{ ...base, kind: 'event', importance: 'high', start_at: p.start_at, end_at: p.end_at, location: p.location, duration_min_minutes: mins, duration_max_minutes: mins }];
    }
    if (p.kind !== 'task') return [];
    const min = p.duration_min_minutes || p.duration_max_minutes || 30;
    return [{
      ...base,
      kind: 'task',
      duration_min_minutes: min,
      duration_max_minutes: Math.max(min, p.duration_max_minutes || min),
      due_at: p.due_date ? new Date(`${p.due_date}T12:00:00`).toISOString() : undefined,
      note: p.reason,
    }];
  });
}

/** Remember this (fact or note about a person) instead of a to-do or appointment */
export const isKnowledge = (s: Pick<Suggestion, 'kind'>) => s.kind === 'memory' || s.kind === 'person_note';

export function addSuggestions(uid: string, list: Suggestion[]) {
  if (list.length) saveSuggestions(uid, [...list, ...loadSuggestions(uid)]);
}
