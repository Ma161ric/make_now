import type { ExtractionResponse, PlanningResponse } from './models';

export const MOCK_EXTRACTION_RESPONSE: ExtractionResponse = {
  items: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      type: 'task',
      title: 'Write project summary',
      raw_text_span: 'Write project summary for 30 minutes',
      parsed_fields: {
        duration_min_minutes: 30,
        duration_max_minutes: 45,
        estimation_source: 'ai',
        importance: 'high',
        energy_type: 'deep_work',
      },
      confidence: 0.82,
      questions: [],
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      type: 'event',
      title: 'Team sync',
      raw_text_span: 'Team sync at 14:00',
      parsed_fields: {
        start_at: '2026-01-09T14:00:00Z',
        end_at: '2026-01-09T15:00:00Z',
        timezone: 'Europe/Berlin',
        all_day: false,
      },
      confidence: 0.9,
      questions: [],
    },
  ],
  overall_confidence: 0.86,
  metadata: {
    processing_time_ms: 123,
    model_version: 'mock-fixture-v1',
  },
};

export const MOCK_PLANNING_RESPONSE: PlanningResponse = {
  date: '2026-01-09',
  timezone: 'Europe/Berlin',
  focus_task_id: '11111111-1111-1111-1111-111111111111',
  mini_task_ids: ['22222222-2222-2222-2222-222222222222'],
  suggested_blocks: [
    {
      start_at: '2026-01-09T09:00:00Z',
      end_at: '2026-01-09T10:00:00Z',
      block_type: 'focus',
      task_id: '11111111-1111-1111-1111-111111111111',
      duration_minutes: 60,
    },
    {
      start_at: '2026-01-09T10:00:00Z',
      end_at: '2026-01-09T10:15:00Z',
      block_type: 'buffer',
      task_id: null,
      duration_minutes: 15,
    },
  ],
  reasoning_brief: 'Prioritize summary first, short break before next block.',
  confidence: 0.88,
  metadata: {
    processing_time_ms: 42,
    algorithm_version: 'mock-fixture-v1',
  },
};
