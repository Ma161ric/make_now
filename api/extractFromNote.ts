import { VercelRequest, VercelResponse } from '@vercel/node';
import { complete, prompt, extractJson } from './_lib/llm.js';
import { FieldValue } from 'firebase-admin/firestore';
import { db, requireUserInfo, HttpError, UNVERIFIED_AI_LIMIT, unverifiedHint } from './_lib/firebaseAdmin.js';
import { toSchemaResponse, type FlatItem } from './_lib/extractionFormat.js';
import { validateExtraction } from '../packages/core/src/validation.js';


const DAILY_LIMIT = () => Number(process.env.EXTRACT_DAILY_LIMIT || 100);

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Signed-in users only: this endpoint spends the AI key
  let uid: string;
  let verified = false;
  try {
    ({ uid, verified } = await requireUserInfo(req));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 401;
    return res.status(status).json({ error: 'Bitte anmelden' });
  }

  const { noteText } = req.body || {};
  if (!noteText || typeof noteText !== 'string' || noteText.length > 4000) {
    return res.status(400).json({ error: 'noteText: 1-4000 Zeichen' });
  }

  // Per-user daily limit, shared counter document with the chat
  const date = new Date().toISOString().slice(0, 10);
  const ref = db().doc(`ai_usage/${uid}_${date}`);
  await ref.set({ uid, date, extract: FieldValue.increment(1) }, { merge: true });
  const usage = (await ref.get()).data() || {};
  if ((usage.extract ?? 0) > DAILY_LIMIT()) {
    return res.status(429).json({ error: 'Tageslimit erreicht, morgen geht es weiter.' });
  }
  if (!verified && (usage.chat ?? 0) + (usage.extract ?? 0) + (usage.transcribe ?? 0) > UNVERIFIED_AI_LIMIT) {
    return res.status(429).json({ error: unverifiedHint });
  }
  const allowClaude = true;

  try {
    const startTime = Date.now();

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = `You extract actionable items from a user's personal notes (often German).
Today is ${today}. Return ONLY valid JSON, no other text, in exactly this structure:
{
  "items": [
    {
      "type": "task" | "event" | "idea",
      "title": "short, concrete title in the note's language",
      "description": "optional details",
      "importance": "high" | "medium" | "low",
      "energy_type": "deep_work" | "admin" | "creative",
      "duration_min_minutes": 15,
      "duration_max_minutes": 30,
      "due_at": "YYYY-MM-DD (only if the note implies a date)",
      "start_at": "ISO date-time (events only)",
      "end_at": "ISO date-time (events only)",
      "confidence": 0.85
    }
  ]
}
Rules: one item per separate thing to do; realistic durations between 5 and 480 minutes;
"event" only for appointments with a time, everything else to do is a "task"; at most 10 items.`;

    const llm = await complete(
      { system: systemPrompt, messages: [{ role: 'user', content: noteText.slice(0, 8000) }], temperature: 0.2, maxTokens: 2000 },
      { allowClaude }
    );
    console.log(`[AI] ${llm.provider} answered`);

    const raw = extractJson<{ items?: FlatItem[] }>(llm.text);
    if (!raw) throw new Error('AI returned no JSON');
    const flatItems: FlatItem[] = Array.isArray(raw.items) ? raw.items : [];
    console.log('[AI] Parsed result:', flatItems.length, 'items');

    // Fill in missing durations for tasks with a second, small AI call
    const enriched = await Promise.all(
      flatItems.map(async (item) => {
        if ((item.type ?? 'task') !== 'task' || typeof item.duration_min_minutes === 'number') return item;
        try {
          const est = await prompt(
            `How long does this task realistically take? Return ONLY JSON: {"min_minutes": <5-480>, "max_minutes": <5-480>}
Task: "${item.title}"${item.description ? ` (${item.description})` : ''}`,
            { allowClaude, temperature: 0.2, maxTokens: 100 }
          );
          const parsed = extractJson(est.text);
          if (parsed && typeof parsed.min_minutes === 'number') {
            return { ...item, duration_min_minutes: parsed.min_minutes, duration_max_minutes: parsed.max_minutes };
          }
        } catch (err) {
          console.error('[AI] duration estimate failed:', (err as Error).message);
        }
        return item;
      })
    );

    // Convert to the schema format the app expects, then validate
    const output = toSchemaResponse(enriched, Date.now() - startTime, `${llm.provider}:${llm.model}`);
    const validation = validateExtraction(output);
    if (!validation.valid) {
      console.error('[AI] Validation failed:', JSON.stringify(validation.errors).slice(0, 1000));
      return res.status(200).json({
        items: [],
        overall_confidence: 0,
        metadata: { processing_time_ms: Date.now() - startTime, model_version: 'validation-failed' },
      });
    }

    return res.status(200).json(output);
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to extract items from note',
    });
  }
};
