/**
 * One entry point for all AI calls: Claude first, Groq as backup.
 *
 * - Claude (paid) is only used when `allowClaude` is true. Endpoints pass
 *   that only for signed-in users, so strangers cannot spend your API budget.
 * - If Claude fails (outage, rate limit, timeout, no key), the same request
 *   goes to Groq (free tier).
 *
 * Env: ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional),
 *      GROQ_API_KEY, GROQ_MODEL (optional)
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system?: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResult {
  text: string;
  provider: 'claude' | 'groq';
  model: string;
}

const CLAUDE_MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const GROQ_MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 25_000;

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude(req: LlmRequest): Promise<LlmResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const model = CLAUDE_MODEL();
  const json = await withTimeout(async (signal) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        ...(req.system ? { system: req.system } : {}),
        messages: req.messages,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message || 'request failed'}`);
    return body;
  });
  const text = (json.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  if (!text) throw new Error('Claude returned no text');
  return { text, provider: 'claude', model };
}

async function callGroq(req: LlmRequest): Promise<LlmResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const model = GROQ_MODEL();
  const json = await withTimeout(async (signal) => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Error(`Groq ${res.status}: ${body?.error?.message || 'request failed'}`);
    return body;
  });
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned no text');
  return { text, provider: 'groq', model };
}

export async function complete(req: LlmRequest, opts: { allowClaude: boolean }): Promise<LlmResult> {
  if (opts.allowClaude && process.env.ANTHROPIC_API_KEY) {
    try {
      return await callClaude(req);
    } catch (e) {
      console.warn('[llm] Claude failed, falling back to Groq:', (e as Error).message);
    }
  }
  return callGroq(req);
}

/** First {...} block in a model answer, parsed; null if there is none. */
export function extractJson<T = any>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Shorthand for single-prompt calls. */
export function prompt(text: string, opts: { allowClaude: boolean; system?: string; maxTokens?: number; temperature?: number }) {
  return complete(
    { system: opts.system, messages: [{ role: 'user', content: text }], maxTokens: opts.maxTokens, temperature: opts.temperature },
    { allowClaude: opts.allowClaude }
  );
}
