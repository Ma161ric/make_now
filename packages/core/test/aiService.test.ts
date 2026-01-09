import { describe, expect, it } from 'vitest';
import {
  AiResponseParseError,
  AiService,
  AiValidationError,
  ExtractionRequest,
  PlanDayRequest,
} from '../src/aiService';
import { MOCK_EXTRACTION_RESPONSE, MOCK_PLANNING_RESPONSE } from '../src/mockResponses';

const extractionInput: ExtractionRequest = {
  text: 'Write project summary for 30 minutes and team sync at 14:00',
  context: {
    current_date: '2026-01-09',
    current_time: '10:00:00',
    timezone: 'Europe/Berlin',
    user_language: 'de',
  },
  constraints: {
    max_items: 10,
    require_confidence: true,
  },
};

const planInput: PlanDayRequest = {
  date: '2026-01-09',
  timezone: 'Europe/Berlin',
  available_tasks: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Write project summary',
      duration_min_minutes: 30,
      duration_max_minutes: 45,
      importance: 'high',
      energy_type: 'deep_work',
    },
  ],
  busy_intervals: [
    { start_at: '2026-01-09T14:00:00Z', end_at: '2026-01-09T15:00:00Z' },
  ],
  constraints: {
    working_hours_start: '09:00:00',
    working_hours_end: '18:00:00',
    buffer_minutes: 15,
  },
};

describe('AiService (mock fallback)', () => {
  it('returns mock extraction when mode=mock', async () => {
    const service = new AiService({ mode: 'mock' });
    const result = await service.extract(extractionInput);

    expect(result.source).toBe('mock');
    expect(result.validation.valid).toBe(true);
    expect(result.data.items.length).toBeGreaterThan(0);
  });
});

describe('AiService (live with stubbed fetch)', () => {
  it('parses valid extraction JSON and validates schema', async () => {
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(MOCK_EXTRACTION_RESPONSE),
              },
            },
          ],
        }),
        { status: 200 }
      );

    const service = new AiService({ apiKey: 'test-key', fetchImpl: fetchMock });
    const result = await service.extract(extractionInput, { useMock: false });

    expect(result.source).toBe('live');
    expect(result.data.items[0].id).toBe(MOCK_EXTRACTION_RESPONSE.items[0].id);
    expect(result.validation.valid).toBe(true);
  });

  it('raises parse error on non-JSON response', async () => {
    const fetchMock = async () => new Response('not json', { status: 200 });
    const service = new AiService({ apiKey: 'test-key', fetchImpl: fetchMock });

    await expect(service.extract(extractionInput, { useMock: false })).rejects.toBeInstanceOf(
      AiResponseParseError
    );
  });

  it('raises validation error on schema violation', async () => {
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ foo: 'bar' }),
              },
            },
          ],
        }),
        { status: 200 }
      );

    const service = new AiService({ apiKey: 'test-key', fetchImpl: fetchMock });

    await expect(service.planDay(planInput, { useMock: false })).rejects.toBeInstanceOf(
      AiValidationError
    );
  });

  it('parses planning responses and keeps validation', async () => {
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(MOCK_PLANNING_RESPONSE),
              },
            },
          ],
        }),
        { status: 200 }
      );

    const service = new AiService({ apiKey: 'test-key', fetchImpl: fetchMock });
    const result = await service.planDay(planInput, { useMock: false });

    expect(result.data.focus_task_id).toBe(MOCK_PLANNING_RESPONSE.focus_task_id);
    expect(result.validation.valid).toBe(true);
  });
});
