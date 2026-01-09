import { extractFromNoteMock, planFromItemsMock } from './mockAi';
import type { ExtractionResponse, PlanningResponse } from './models';
import { validateExtraction, validatePlanning } from './validation';
import type { ValidationResult } from './validation';

export interface AiServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  mode?: 'live' | 'mock';
  fetchImpl?: typeof fetch;
}

export interface ExtractionRequest {
  text: string;
  context: {
    current_date: string; // ISO date
    current_time: string; // HH:MM:SS
    timezone: string; // IANA
    user_language: string; // e.g. "de"
  };
  constraints?: {
    max_items?: number;
    require_confidence?: boolean;
  };
}

export interface PlanDayRequest {
  date: string; // ISO date
  timezone: string;
  available_tasks: Array<{
    id: string;
    title: string;
    duration_min_minutes: number;
    duration_max_minutes: number;
    importance?: string;
    due_at?: string | null;
    energy_type?: string | null;
  }>;
  busy_intervals?: Array<{ start_at: string; end_at: string }>;
  constraints?: {
    working_hours_start?: string;
    working_hours_end?: string;
    buffer_minutes?: number;
    prefer_morning_focus?: boolean;
  };
}

export interface AiCallOptions {
  useMock?: boolean;
}

export interface AiCallResult<T> {
  data: T;
  validation: ValidationResult;
  rawText: string;
  source: 'live' | 'mock';
}

interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama3-70b-8192';
const DEFAULT_TIMEOUT = 10_000;

export class AiService {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly mode: 'live' | 'mock';

  constructor(config: AiServiceConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.model = config.model || DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT;
    this.fetchImpl = config.fetchImpl || fetch;
    this.mode = config.mode || 'live';
  }

  async extract(
    request: ExtractionRequest,
    options?: AiCallOptions
  ): Promise<AiCallResult<ExtractionResponse>> {
    const shouldMock = this.shouldUseMock(options);
    if (shouldMock) {
      const data = extractFromNoteMock(request.text, { timezone: request.context.timezone });
      const validation = validateExtraction(data);
      return { data, validation, rawText: JSON.stringify(data), source: 'mock' };
    }

    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: this.buildExtractionSystemPrompt(request),
      },
      {
        role: 'user',
        content: JSON.stringify({ operation: 'extract', input: request }),
      },
    ];

    const rawText = await this.callGroq(messages);
    const parsed = this.safeParseJson(rawText);
    const validation = validateExtraction(parsed);

    if (!validation.valid) {
      throw new AiValidationError('Extraction response failed schema validation', validation, rawText);
    }

    return { data: parsed as ExtractionResponse, validation, rawText, source: 'live' };
  }

  async planDay(
    request: PlanDayRequest,
    options?: AiCallOptions
  ): Promise<AiCallResult<PlanningResponse>> {
    const shouldMock = this.shouldUseMock(options);
    if (shouldMock) {
      const data = planFromItemsMock(
        request.available_tasks.map((t) => ({ id: t.id, type: 'task', title: t.title })),
        { timezone: request.timezone }
      ) as unknown as PlanningResponse;
      const validation = validatePlanning(data);
      return { data, validation, rawText: JSON.stringify(data), source: 'mock' };
    }

    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: this.buildPlanningSystemPrompt(request),
      },
      {
        role: 'user',
        content: JSON.stringify({ operation: 'plan_day', input: request }),
      },
    ];

    const rawText = await this.callGroq(messages);
    const parsed = this.safeParseJson(rawText);
    const validation = validatePlanning(parsed);

    if (!validation.valid) {
      throw new AiValidationError('Planning response failed schema validation', validation, rawText);
    }

    return { data: parsed as PlanningResponse, validation, rawText, source: 'live' };
  }

  private shouldUseMock(options?: AiCallOptions): boolean {
    if (options?.useMock) return true;
    if (this.mode === 'mock') return true;
    return !this.apiKey;
  }

  private async callGroq(messages: GroqMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new AiServiceError('API key missing for live AI call');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    try {
      const response = await this.fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new AiHttpError(response.status, errorBody);
      }

      const rawBody = await response.text();
      let json: any;

      try {
        json = JSON.parse(rawBody);
      } catch (error) {
        throw new AiResponseParseError('Failed to parse AI provider response JSON', rawBody);
      }

      const content = json?.choices?.[0]?.message?.content;

      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new AiResponseParseError('Empty AI response', rawBody);
      }

      return content;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new AiServiceError('AI request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private safeParseJson(rawText: string): unknown {
    const jsonText = this.extractJson(rawText);

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      throw new AiResponseParseError('Failed to parse AI JSON response', rawText);
    }
  }

  private extractJson(rawText: string): string {
    const fenceMatch = rawText.match(/```json\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      return fenceMatch[1].trim();
    }

    const firstBrace = rawText.indexOf('{');
    if (firstBrace >= 0) {
      return rawText.slice(firstBrace).trim();
    }

    return rawText.trim();
  }

  private buildExtractionSystemPrompt(request: ExtractionRequest): string {
    const maxItems = request.constraints?.max_items ?? 10;
    return [
      'You are DayFlow AI extraction engine.',
      'Return ONLY valid JSON that matches extraction_schema.json (draft-07).',
      'Do not wrap the JSON in code fences.',
      `Max items: ${maxItems}. Overall confidence is the average of item confidences (0-1).`,
      'If confidence for an item < 0.5 add exactly one clarifying question; otherwise omit questions.',
      'Use defaults only when text is missing; never hallucinate times or due dates.',
      `Timezone: ${request.context.timezone}. Language: ${request.context.user_language}.`,
      'Fallback when nothing is found: {"items":[],"overall_confidence":0,"metadata":{"processing_time_ms":0}}.',
    ].join(' ');
  }

  private buildPlanningSystemPrompt(request: PlanDayRequest): string {
    return [
      'You are DayFlow planning engine. Produce JSON that matches planning_schema.json (draft-07).',
      'Always output JSON only, no markdown.',
      'Use given tasks and busy intervals; do not invent new tasks or times outside working hours.',
      `Date: ${request.date}, timezone: ${request.timezone}.`,
      'Confidence is 0-1. Reasoning should be concise (max 500 chars).',
      'If no plan is possible, return zero suggested_blocks and confidence 0.',
    ].join(' ');
  }
}

export class AiServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiServiceError';
  }
}

export class AiHttpError extends AiServiceError {
  constructor(public status: number, public body: string) {
    super(`AI HTTP error ${status}`);
    this.name = 'AiHttpError';
  }
}

export class AiResponseParseError extends AiServiceError {
  constructor(message: string, public rawText: string) {
    super(message);
    this.name = 'AiResponseParseError';
  }
}

export class AiValidationError extends AiServiceError {
  constructor(message: string, public validation: ValidationResult, public rawText: string) {
    super(message);
    this.name = 'AiValidationError';
  }
}
