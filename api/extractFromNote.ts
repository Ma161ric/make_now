import { VercelRequest, VercelResponse } from '@vercel/node';
import { complete, prompt, extractJson } from './_lib/llm.js';
import { optionalUser } from './_lib/firebaseAdmin.js';
import { toSchemaResponse, type FlatItem } from './_lib/extractionFormat.js';
import { validateExtraction } from '../packages/core/src/validation.js';


export default async (req: VercelRequest, res: VercelResponse) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { noteText } = req.body;

  if (!noteText || typeof noteText !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: noteText must be a non-empty string',
    });
  }

  // Paid model only for signed-in users
  const allowClaude = (await optionalUser(req)) !== null;

  try {
    console.log('[AI] Extracting from note:', noteText.substring(0, 100) + '...');
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
