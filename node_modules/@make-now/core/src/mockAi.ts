/**
 * Mock AI Layer
 * Generates valide JSON outputs that respect schemas and rules
 * Based on /spec/40_rules/confidence_policy.md and default_durations.md
 */

import type {
  ExtractionResponse,
  ExtractedItem,
  TaskFields,
  EventFields,
  IdeaFields,
} from './models';
import { estimateDuration, requiresQuestion, generateDurationQuestion } from './rules';

/**
 * Simple UUID v4-like generation
 * Works in Node.js and browser
 */
function generateId(): string {
  const chars = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += chars[((Math.random() * 16) | 8) & 0xf];
    } else {
      uuid += chars[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}

/**
 * Parse simple date strings
 * Supports: "today", "tomorrow", "in 3 days", "next monday", dates like "2025-01-15"
 */
function parseDate(dateString: string): Date | null {
  const lower = dateString.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lower === 'today' || lower === 'heute') {
    return new Date(today);
  }

  if (lower === 'tomorrow' || lower === 'morgen') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  if (lower.startsWith('in ')) {
    const match = lower.match(/in (\d+)\s*(days?|tagen?|hours?|stunden?)/i);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase()[0];
      const date = new Date(today);
      if (unit === 'd' || unit === 't') {
        date.setDate(date.getDate() + amount);
      } else if (unit === 'h' || unit === 's') {
        date.setHours(date.getHours() + amount);
      }
      return date;
    }
  }

  // Try ISO date format
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    const date = new Date(lower + 'T00:00:00Z');
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Parse simple time strings
 * Supports: "14:00", "2pm", "14h", etc.
 */
function parseTime(timeString: string): string | null {
  const lower = timeString.toLowerCase().trim();

  // HH:MM format
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(lower)) {
    const parts = lower.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    }
  }

  // XPM/XAM format
  const pmMatch = lower.match(/(\d{1,2})\s*(?:p|pm)/i);
  if (pmMatch) {
    let hour = parseInt(pmMatch[1], 10);
    if (hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:00:00`;
  }

  const amMatch = lower.match(/(\d{1,2})\s*(?:a|am)/i);
  if (amMatch) {
    let hour = parseInt(amMatch[1], 10);
    if (hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:00:00`;
  }

  // Xh format
  const hMatch = lower.match(/(\d{1,2})\s*h/i);
  if (hMatch) {
    const hour = parseInt(hMatch[1], 10);
    if (hour >= 0 && hour < 24) {
      return `${String(hour).padStart(2, '0')}:00:00`;
    }
  }

  return null;
}

/**
 * Detect task vs event vs idea from text
 * Simple heuristic
 */
function detectItemType(
  text: string
): 'task' | 'event' | 'idea' {
  const lower = text.toLowerCase();

  // Event keywords
  if (
    /(?:meeting|termin|appointment|event|um|at|uhr|treffen|besprechung)/.test(lower)
  ) {
    if (/\d{1,2}(?::\d{2})?(?:am|pm|uhr|h)/.test(lower)) {
      return 'event';
    }
  }

  // Idea keywords (less actionable)
  if (/(?:note|notiz|idee|idea|remember|gedanke|was ist|what if)/.test(lower)) {
    return 'idea';
  }

  // Default to task
  return 'task';
}

/**
 * Extract from a note (mock implementation)
 * Per spec: produces valid JSON, respects schemas and confidence policy
 */
export function extractFromNoteMock(
  noteText: string,
  _context?: { timezone?: string }
): ExtractionResponse {
  const startTime = Date.now();
  const timezone = _context?.timezone || 'Europe/Berlin';
  const items: ExtractedItem[] = [];

  // Simple line-by-line extraction
  const lines = noteText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  for (const line of lines.slice(0, 10)) {
    // Max 10 items per extraction policy
    const itemType = detectItemType(line);

    const item: ExtractedItem = {
      id: generateId(),
      type: itemType,
      title: line.substring(0, 200), // Max 200 chars
      raw_text_span: line,
      confidence: 0.7,
      parsed_fields: {} as TaskFields | EventFields | IdeaFields,
    };

    if (itemType === 'task') {
      const durationEst = estimateDuration(line);
      const taskFields: TaskFields = {
        duration_min_minutes: durationEst.min,
        duration_max_minutes: durationEst.max,
        estimation_source: durationEst.source,
        importance: 'medium',
      };

      // Check for due date
      const dueDateMatch = line.match(/(?:due|until|by|bis|fällig|am)\s+([^\s]+)/i);
      if (dueDateMatch) {
        const dueDate = parseDate(dueDateMatch[1]);
        if (dueDate) {
          taskFields.due_at = dueDate.toISOString();
          item.confidence = 0.85;
        }
      }

      item.parsed_fields = taskFields;
      item.confidence = durationEst.confidence;

      // Check if question needed
      if (requiresQuestion(item.confidence)) {
        item.questions = [generateDurationQuestion(item.title)];
      }
    } else if (itemType === 'event') {
      const eventFields: EventFields = {
        timezone,
        all_day: false,
      };

      // Try to extract time
      const timeMatch = line.match(/(\d{1,2}(?::\d{2})?(?:am|pm)?|[0-9]{1,2}[apAP][mM]|[0-9]{1,2}h)/);
      if (timeMatch) {
        const time = parseTime(timeMatch[1]);
        if (time) {
          const today = new Date();
          const [h, m] = time.split(':').map(Number);
          const startDate = new Date(today);
          startDate.setHours(h, m, 0, 0);
          const endDate = new Date(startDate);
          endDate.setHours(h + 1, m, 0, 0);

          eventFields.start_at = startDate.toISOString();
          eventFields.end_at = endDate.toISOString();
          item.confidence = 0.8;
        }
      } else {
        // No specific time, use time window
        eventFields.time_window_start = '09:00:00';
        eventFields.time_window_end = '18:00:00';
        item.confidence = 0.5;
        item.questions = ['Wann findet das Event statt?'];
      }

      item.parsed_fields = eventFields;
    } else {
      // Idea
      const ideaFields: IdeaFields = {
        content: line.substring(0, 1000),
      };
      item.parsed_fields = ideaFields;
      item.confidence = 0.75;
    }

    items.push(item);
  }

  // Calculate overall confidence
  const overallConfidence =
    items.length > 0
      ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
      : 0.5;

  return {
    items,
    overall_confidence: Math.round(overallConfidence * 100) / 100,
    metadata: {
      processing_time_ms: Date.now() - startTime,
      model_version: 'mock-v1',
    },
  };
}

/**
 * Plan from items (deterministic, scheduling-rule based)
 * This is a stub - the real planning comes from the scheduling engine
 * This function just wraps the scheduling result
 */
export function planFromItemsMock(
  items: Array<{ id: string; type: string; title: string }>,
  _context?: { date?: Date; timezone?: string }
): Omit<ReturnType<typeof extractFromNoteMock>, 'items' | 'overall_confidence'> {
  const startTime = Date.now();

  return {
    metadata: {
      processing_time_ms: Date.now() - startTime,
      model_version: 'mock-v1',
    },
  };
}
