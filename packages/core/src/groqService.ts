/**
 * Groq API Service for AI-powered extraction and planning
 * Uses Groq's fast inference API with LLaMA models
 */

import {
  ExtractionResponse,
  PlanningResponse,
  validateExtraction,
  validatePlanning,
} from './validation';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Fast, high-quality model

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export class GroqAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'GroqAPIError';
  }
}

/**
 * Call Groq API with retry logic
 */
async function callGroqAPI(
  apiKey: string,
  request: GroqRequest,
  retries = 2
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GroqAPIError(
          error.error?.message || `Groq API error: ${response.statusText}`,
          response.status,
          error
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

/**
 * Extract tasks, events, and ideas from natural language text
 */
export async function extractFromNote(
  noteText: string,
  options: { timezone?: string; apiKey: string }
): Promise<ExtractionResponse> {
  const { timezone = 'Europe/Berlin', apiKey } = options;

  if (!apiKey) {
    throw new GroqAPIError('Groq API key is required');
  }

  const systemPrompt = `Du bist ein AI-Assistent, der Freitext-Notizen in strukturierte Aufgaben (tasks), Termine (events) und Ideen (ideas) umwandelt.

WICHTIGE REGELN:
1. Antworte NUR mit gültigem JSON im ExtractionResponse Format
2. Zeitzone: ${timezone}
3. Schätze realistische Dauern für Tasks (min/max in Minuten)
4. Confidence: 0.0-1.0 (wie sicher bist du?)
5. Wenn unsicher (confidence < 0.6): Stelle EINE gezielte Frage

JSON Schema:
{
  "items": [
    {
      "id": "uuid",
      "type": "task" | "event" | "idea",
      "title": "string",
      "confidence": number,
      "parsed_fields": {
        // Für task:
        "duration_min_minutes": number,
        "duration_max_minutes": number,
        "importance": "high" | "medium" | "low",
        "estimation_source": "ai" | "default",
        
        // Für event:
        "start_at": "ISO timestamp",
        "end_at": "ISO timestamp",
        "all_day": boolean,
        
        // Für idea:
        "tags": ["string"]
      },
      "questions": ["string"] // max 1 Frage
    }
  ],
  "overall_confidence": number,
  "metadata": {
    "processing_time_ms": number,
    "model_version": "groq-llama-3.3-70b"
  }
}`;

  const userPrompt = `Extrahiere Tasks, Events und Ideas aus dieser Notiz:\n\n${noteText}`;

  const startTime = Date.now();

  try {
    const response = await callGroqAPI(apiKey, {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const processingTime = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new GroqAPIError('Empty response from Groq API');
    }

    const extraction: ExtractionResponse = JSON.parse(content);

    // Add metadata
    if (!extraction.metadata) {
      extraction.metadata = {
        processing_time_ms: processingTime,
        model_version: 'groq-llama-3.3-70b',
      };
    }

    // Validate response
    const validation = validateExtraction(extraction);
    if (!validation.valid) {
      throw new GroqAPIError(
        `Invalid extraction response: ${validation.errors.join(', ')}`,
        undefined,
        validation.errors
      );
    }

    return extraction;
  } catch (error) {
    if (error instanceof GroqAPIError) {
      throw error;
    }
    throw new GroqAPIError(
      `Failed to extract from note: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Generate a daily plan from reviewed tasks
 */
export async function planDay(
  tasks: any[],
  options: {
    date: string;
    timezone?: string;
    busyIntervals?: any[];
    apiKey: string;
  }
): Promise<PlanningResponse> {
  const { date, timezone = 'Europe/Berlin', busyIntervals = [], apiKey } = options;

  if (!apiKey) {
    throw new GroqAPIError('Groq API key is required');
  }

  const systemPrompt = `Du bist ein AI-Assistent für Tagesplanung.

WICHTIGE REGELN:
1. Antworte NUR mit gültigem JSON im PlanningResponse Format
2. Wähle 1 Fokus-Aufgabe (60-120 Min) + max 2 Mini-Aufgaben (5-20 Min)
3. Berücksichtige Priorität, Deadline, geschätzte Dauer
4. Zeitzone: ${timezone}
5. Vermeide beschäftigte Zeiten: ${JSON.stringify(busyIntervals)}

JSON Schema:
{
  "date": "YYYY-MM-DD",
  "timezone": "string",
  "focus_task_id": "uuid",
  "mini_task_ids": ["uuid"],
  "suggested_blocks": [
    {
      "start_at": "ISO timestamp",
      "end_at": "ISO timestamp",
      "block_type": "focus" | "mini" | "buffer",
      "task_id": "uuid" | null
    }
  ],
  "reasoning": "string",
  "buffer_minutes": number
}`;

  const userPrompt = `Plane den Tag ${date} mit diesen Aufgaben:\n\n${JSON.stringify(tasks, null, 2)}`;

  const startTime = Date.now();

  try {
    const response = await callGroqAPI(apiKey, {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new GroqAPIError('Empty response from Groq API');
    }

    const planning: PlanningResponse = JSON.parse(content);

    // Validate response
    const validation = validatePlanning(planning);
    if (!validation.valid) {
      throw new GroqAPIError(
        `Invalid planning response: ${validation.errors.join(', ')}`,
        undefined,
        validation.errors
      );
    }

    return planning;
  } catch (error) {
    if (error instanceof GroqAPIError) {
      throw error;
    }
    throw new GroqAPIError(
      `Failed to plan day: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Estimate task duration using AI
 */
export async function estimateDuration(
  taskTitle: string,
  apiKey: string
): Promise<{ min_minutes: number; max_minutes: number; confidence: number }> {
  if (!apiKey) {
    throw new GroqAPIError('Groq API key is required');
  }

  const systemPrompt = `Du bist ein Experte für Zeitschätzungen.

Schätze die Dauer für eine Aufgabe und antworte NUR mit JSON:
{
  "min_minutes": number,
  "max_minutes": number,
  "confidence": number (0.0-1.0)
}

Richtlinien:
- Email: 5-15 Min
- Meeting: 30-60 Min
- Code Review: 15-30 Min
- Implementation: 60-240 Min
- Research: 30-120 Min`;

  const userPrompt = `Schätze die Dauer: "${taskTitle}"`;

  try {
    const response = await callGroqAPI(apiKey, {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new GroqAPIError('Empty response from Groq API');
    }

    const result = JSON.parse(content);

    if (
      typeof result.min_minutes !== 'number' ||
      typeof result.max_minutes !== 'number' ||
      typeof result.confidence !== 'number'
    ) {
      throw new GroqAPIError('Invalid duration estimate response');
    }

    return result;
  } catch (error) {
    if (error instanceof GroqAPIError) {
      throw error;
    }
    throw new GroqAPIError(
      `Failed to estimate duration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}
