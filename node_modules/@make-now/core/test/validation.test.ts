/**
 * Test: Schema Validation
 * Tests that Ajv validation correctly validates against the schemas
 */

import { describe, it, expect } from 'vitest';
import { validateExtraction, validatePlanning } from '../src/validation';
import type { ExtractionResponse, PlanningResponse } from '../src/models';

describe('Extraction Validation', () => {
  it('should accept valid extraction response', () => {
    const validExtraction: ExtractionResponse = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'task',
          title: 'Implement feature',
          confidence: 0.8,
          parsed_fields: {
            duration_min_minutes: 60,
            duration_max_minutes: 120,
            estimation_source: 'default',
          },
        },
      ],
      overall_confidence: 0.8,
      metadata: {
        processing_time_ms: 100,
      },
    };

    const result = validateExtraction(validExtraction);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept event in extraction', () => {
    const extraction: ExtractionResponse = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'event',
          title: 'Team Meeting',
          confidence: 0.85,
          parsed_fields: {
            timezone: 'Europe/Berlin',
            start_at: '2025-01-15T14:00:00Z',
            end_at: '2025-01-15T15:00:00Z',
          },
        },
      ],
      overall_confidence: 0.85,
      metadata: {
        processing_time_ms: 50,
      },
    };

    const result = validateExtraction(extraction);
    expect(result.valid).toBe(true);
  });

  it('should accept idea in extraction', () => {
    const extraction: ExtractionResponse = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'idea',
          title: 'New product concept',
          confidence: 0.6,
          parsed_fields: {
            content: 'An idea for a new feature',
          },
        },
      ],
      overall_confidence: 0.6,
      metadata: {
        processing_time_ms: 75,
      },
    };

    const result = validateExtraction(extraction);
    expect(result.valid).toBe(true);
  });

  it('should accept extraction with questions', () => {
    const extraction: ExtractionResponse = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'task',
          title: 'Vague task',
          confidence: 0.4,
          questions: ['Wie lange dauert diese Aufgabe?'],
          parsed_fields: {
            duration_min_minutes: 30,
            duration_max_minutes: 60,
            estimation_source: 'default',
          },
        },
      ],
      overall_confidence: 0.4,
      metadata: {
        processing_time_ms: 120,
      },
    };

    const result = validateExtraction(extraction);
    expect(result.valid).toBe(true);
  });

  it('should reject extraction with invalid UUID', () => {
    const invalid = {
      items: [
        {
          id: 'not-a-uuid',
          type: 'task',
          title: 'Test',
          confidence: 0.8,
          parsed_fields: {
            duration_min_minutes: 30,
            duration_max_minutes: 60,
            estimation_source: 'default',
          },
        },
      ],
      overall_confidence: 0.8,
      metadata: {
        processing_time_ms: 100,
      },
    };

    const result = validateExtraction(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject extraction with confidence out of range', () => {
    const invalid = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'task',
          title: 'Test',
          confidence: 1.5, // Invalid, > 1.0
          parsed_fields: {
            duration_min_minutes: 30,
            duration_max_minutes: 60,
            estimation_source: 'default',
          },
        },
      ],
      overall_confidence: 1.5,
      metadata: {
        processing_time_ms: 100,
      },
    };

    const result = validateExtraction(invalid);
    expect(result.valid).toBe(false);
  });

  it('should reject extraction with missing required fields', () => {
    const invalid = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'task',
          // Missing title
          confidence: 0.8,
          parsed_fields: {
            duration_min_minutes: 30,
            duration_max_minutes: 60,
            estimation_source: 'default',
          },
        },
      ],
      overall_confidence: 0.8,
      metadata: {
        processing_time_ms: 100,
      },
    };

    const result = validateExtraction(invalid);
    expect(result.valid).toBe(false);
  });

  it('should reject extraction with too many items', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      id: `550e8400-e29b-41d4-a716-44665544000${i}`,
      type: 'task' as const,
      title: `Task ${i}`,
      confidence: 0.8,
      parsed_fields: {
        duration_min_minutes: 30,
        duration_max_minutes: 60,
        estimation_source: 'default' as const,
      },
    }));

    const invalid = {
      items,
      overall_confidence: 0.8,
      metadata: {
        processing_time_ms: 100,
      },
    };

    const result = validateExtraction(invalid);
    expect(result.valid).toBe(false); // Max 10 items per schema
  });
});

describe('Planning Validation', () => {
  it('should accept valid planning response', () => {
    const validPlanning: PlanningResponse = {
      date: '2025-01-15',
      timezone: 'Europe/Berlin',
      focus_task_id: '550e8400-e29b-41d4-a716-446655440000',
      mini_task_ids: [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ],
      suggested_blocks: [
        {
          start_at: new Date('2025-01-15T09:00:00').toISOString(),
          end_at: new Date('2025-01-15T10:30:00').toISOString(),
          block_type: 'focus',
          task_id: '550e8400-e29b-41d4-a716-446655440000',
          duration_minutes: 90,
        },
        {
          start_at: new Date('2025-01-15T10:30:00').toISOString(),
          end_at: new Date('2025-01-15T10:45:00').toISOString(),
          block_type: 'buffer',
          task_id: null,
          duration_minutes: 15,
        },
      ],
      reasoning_brief: 'Fokus-Task am Morgen, dann Buffer',
      confidence: 0.9,
      metadata: {
        processing_time_ms: 50,
      },
    };

    const result = validatePlanning(validPlanning);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept planning without focus task', () => {
    const planning: PlanningResponse = {
      date: '2025-01-15',
      timezone: 'Europe/Berlin',
      mini_task_ids: ['550e8400-e29b-41d4-a716-446655440001'],
      suggested_blocks: [
        {
          start_at: new Date('2025-01-15T10:00:00').toISOString(),
          end_at: new Date('2025-01-15T10:15:00').toISOString(),
          block_type: 'mini',
          task_id: '550e8400-e29b-41d4-a716-446655440001',
          duration_minutes: 15,
        },
      ],
      reasoning_brief: 'Nur Mini-Tasks heute',
      confidence: 0.7,
      metadata: {
        processing_time_ms: 40,
      },
    };

    const result = validatePlanning(planning);
    expect(result.valid).toBe(true);
  });

  it('should reject planning with invalid date format', () => {
    const invalid = {
      date: '15-01-2025', // Wrong format
      timezone: 'Europe/Berlin',
      mini_task_ids: [],
      suggested_blocks: [],
      reasoning_brief: 'Test',
      confidence: 0.8,
      metadata: {
        processing_time_ms: 50,
      },
    };

    const result = validatePlanning(invalid);
    expect(result.valid).toBe(false);
  });

  it('should reject planning with too many mini tasks', () => {
    const invalid = {
      date: '2025-01-15',
      timezone: 'Europe/Berlin',
      mini_task_ids: [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ],
      suggested_blocks: [],
      reasoning_brief: 'Test',
      confidence: 0.8,
      metadata: {
        processing_time_ms: 50,
      },
    };

    const result = validatePlanning(invalid);
    expect(result.valid).toBe(false); // Max 2 minis per schema
  });

  it('should reject planning with invalid block type', () => {
    const invalid = {
      date: '2025-01-15',
      timezone: 'Europe/Berlin',
      mini_task_ids: [],
      suggested_blocks: [
        {
          start_at: new Date('2025-01-15T09:00:00').toISOString(),
          end_at: new Date('2025-01-15T10:00:00').toISOString(),
          block_type: 'invalid_type', // Not in enum
          task_id: null,
          duration_minutes: 60,
        },
      ],
      reasoning_brief: 'Test',
      confidence: 0.8,
      metadata: {
        processing_time_ms: 50,
      },
    };

    const result = validatePlanning(invalid);
    expect(result.valid).toBe(false);
  });

  it('should format validation errors clearly', () => {
    const invalid = {
      items: [],
      overall_confidence: 2.0, // Invalid
    };

    const result = validateExtraction(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toBeDefined();
  });
});
