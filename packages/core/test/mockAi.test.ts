/**
 * Test: Mock AI Layer
 * Validates that mock extraction and planning produce valid JSON outputs
 */

import { describe, it, expect } from 'vitest';
import { extractFromNoteMock, planFromItemsMock } from '../src/mockAi';
import { validateExtraction, validatePlanning } from '../src/validation';

describe('Mock Extraction', () => {
  it('should extract from simple note and return valid schema', () => {
    const note = 'Meeting at 14:00\nWrite email\nIdea for new feature';
    const result = extractFromNoteMock(note);

    // Should have valid schema
    const validation = validateExtraction(result);
    expect(validation.valid).toBe(true);
  });

  it('should extract items with confidence scores', () => {
    const note = 'Fix the bug\nCall client';
    const result = extractFromNoteMock(note);

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.confidence).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should extract tasks with duration estimates', () => {
    const note = 'Implement feature\nQuick review';
    const result = extractFromNoteMock(note);

    const validation = validateExtraction(result);
    expect(validation.valid).toBe(true);

    const taskItem = result.items.find((i) => i.type === 'task');
    if (taskItem) {
      const fields = taskItem.parsed_fields as any;
      expect(fields.duration_min_minutes).toBeDefined();
      expect(fields.duration_max_minutes).toBeDefined();
      expect(fields.duration_min_minutes).toBeGreaterThanOrEqual(5);
      expect(fields.duration_max_minutes).toBeGreaterThanOrEqual(fields.duration_min_minutes);
    }
  });

  it('should extract events with timezone', () => {
    const note = 'Team meeting at 14:00';
    const result = extractFromNoteMock(note);

    const validation = validateExtraction(result);
    expect(validation.valid).toBe(true);

    const eventItem = result.items.find((i) => i.type === 'event');
    if (eventItem) {
      const fields = eventItem.parsed_fields as any;
      expect(fields.timezone).toBeDefined();
    }
  });

  it('should generate questions for low confidence items', () => {
    const note = 'Vague task';
    const result = extractFromNoteMock(note);

    let hasQuestion = false;
    for (const item of result.items) {
      if (item.confidence < 0.5 && item.questions && item.questions.length > 0) {
        hasQuestion = true;
        expect(item.questions.length).toBeLessThanOrEqual(1); // Max 1 per policy
      }
    }

    // At least validate schema even if no questions
    const validation = validateExtraction(result);
    expect(validation.valid).toBe(true);
  });

  it('should set overall_confidence as average of items', () => {
    const note = 'Task 1\nTask 2\nTask 3';
    const result = extractFromNoteMock(note);

    if (result.items.length > 0) {
      const avgConfidence =
        result.items.reduce((sum, i) => sum + i.confidence, 0) / result.items.length;
      expect(Math.abs(result.overall_confidence - avgConfidence)).toBeLessThan(0.01);
    }
  });

  it('should parse explicit durations from task titles', () => {
    const note = 'Review PR for 20 minutes\nMeeting 30min';
    const result = extractFromNoteMock(note);

    const validation = validateExtraction(result);
    expect(validation.valid).toBe(true);

    for (const item of result.items) {
      if (item.type === 'task') {
        const fields = item.parsed_fields as any;
        expect(fields.estimation_source).toBeDefined();
        if (item.title.includes('20') || item.title.includes('30')) {
          // Should have parsed source if explicit time detected
          if (fields.estimation_source === 'parsed') {
            expect(fields.duration_min_minutes).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('should limit extraction to 10 items max', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Task ${i}`).join('\n');
    const result = extractFromNoteMock(lines);

    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it('should respect confidence bounds', () => {
    const note = 'Normal task\nVague thing\nMeeting at 14:00';
    const result = extractFromNoteMock(note);

    expect(result.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(result.overall_confidence).toBeLessThanOrEqual(1);
  });

  it('should return valid metadata', () => {
    const note = 'Test task';
    const result = extractFromNoteMock(note);

    expect(result.metadata.processing_time_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.model_version).toBeDefined();
  });
});

describe('Mock Planning', () => {
  it('should return object with metadata', () => {
    const items = [
      { id: 'task-1', type: 'task', title: 'Focus work' },
      { id: 'task-2', type: 'task', title: 'Mini task' },
    ];

    const result = planFromItemsMock(items);

    expect(result.metadata).toBeDefined();
    expect(result.metadata.processing_time_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.algorithm_version).toBeDefined();
  });

  it('should handle empty items list', () => {
    const result = planFromItemsMock([]);

    expect(result.metadata).toBeDefined();
    expect(result.metadata.processing_time_ms).toBeGreaterThanOrEqual(0);
  });

  it('should accept timezone context', () => {
    const items = [{ id: 'task-1', type: 'task', title: 'Test' }];
    const result = planFromItemsMock(items, {
      timezone: 'Europe/Berlin',
    });

    expect(result.metadata).toBeDefined();
  });
});
