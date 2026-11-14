/**
 * The AI answers in a simple flat format (easier for models to get right).
 * The app and spec/50_ai/extraction_schema.json expect items with an id and
 * type-specific `parsed_fields`. This converts one into the other.
 */
import { randomUUID } from 'node:crypto';

export interface FlatItem {
  type?: string;
  title?: string;
  description?: string;
  importance?: string;
  energy_type?: string;
  confidence?: number;
  duration_min_minutes?: number;
  duration_max_minutes?: number;
  due_at?: string;
  start_at?: string;
  end_at?: string;
  location?: string;
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

/** ISO date-time or undefined. Accepts "2026-11-20" and full timestamps. */
function isoDateTime(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T17:00:00` : v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

export function toSchemaItem(item: FlatItem, timezone = 'Europe/Berlin') {
  const title = String(item.title || '').trim().slice(0, 200);
  const confidence = clamp01(item.confidence, 0.7);
  const base = { id: randomUUID(), title, confidence, raw_text_span: item.description?.slice(0, 500) };

  const start = isoDateTime(item.start_at);
  const end = isoDateTime(item.end_at);

  // Events need a concrete time; without one they are handled as tasks
  if (item.type === 'event' && start && end) {
    return {
      ...base,
      type: 'event' as const,
      parsed_fields: { start_at: start, end_at: end, timezone, ...(item.location ? { location: String(item.location).slice(0, 500) } : {}) },
    };
  }

  if (item.type === 'idea') {
    return { ...base, type: 'idea' as const, parsed_fields: { content: String(item.description || title).slice(0, 10000) } };
  }

  const min = clampInt(item.duration_min_minutes, 5, 480, 30);
  const max = Math.max(min, clampInt(item.duration_max_minutes, 5, 480, Math.max(min, 45)));
  const due = isoDateTime(item.due_at);
  return {
    ...base,
    type: 'task' as const,
    parsed_fields: {
      duration_min_minutes: min,
      duration_max_minutes: max,
      estimation_source: typeof item.duration_min_minutes === 'number' ? ('ai' as const) : ('default' as const),
      ...(due ? { due_at: due } : {}),
      ...(pick(item.importance, ['low', 'medium', 'high'] as const) ? { importance: item.importance } : {}),
      ...(pick(item.energy_type, ['deep_work', 'admin', 'creative'] as const) ? { energy_type: item.energy_type } : {}),
    },
  };
}

export function toSchemaResponse(items: FlatItem[], processingMs: number, modelVersion: string, timezone?: string) {
  const converted = items
    .filter((i) => typeof i?.title === 'string' && i.title.trim().length > 0)
    .slice(0, 10)
    .map((i) => toSchemaItem(i, timezone));
  const overall = converted.length ? converted.reduce((s, i) => s + i.confidence, 0) / converted.length : 0;
  return {
    items: converted,
    overall_confidence: Math.round(overall * 100) / 100,
    metadata: { processing_time_ms: Math.max(0, Math.round(processingMs)), model_version: modelVersion },
  };
}
