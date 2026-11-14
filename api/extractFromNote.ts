import { VercelRequest, VercelResponse } from '@vercel/node';
import { complete, prompt, extractJson } from './_lib/llm.js';
import { optionalUser } from './_lib/firebaseAdmin.js';
import { ExtractionOutput } from '../functions/src/types.js';
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

    const systemPrompt = `You are a task extraction assistant. 
Extract actionable items (tasks, ideas, events) from user notes.
IMPORTANT: Return ONLY valid JSON, no other text.
Return this exact JSON structure:
{
  "items": [
    {
      "type": "task",
      "title": "brief title",
      "description": "optional details",
      "importance": "high" or "medium" or "low",
      "energy_type": "deep_work" or "admin" or "creative",
      "confidence": 0.85
    }
  ],
  "metadata": {
    "processing_time_ms": 0,
    "algorithm_version": "groq"
  }
}`;

    const userPrompt = `Extract items from this note. Return ONLY valid JSON:

${noteText}`;

    const llm = await complete(
      { system: systemPrompt, messages: [{ role: 'user', content: userPrompt }], temperature: 0.2, maxTokens: 2000 },
      { allowClaude }
    );
    console.log(`[AI] ${llm.provider} answered`);

    const result = extractJson<ExtractionOutput>(llm.text);
    if (!result) throw new Error('AI returned no JSON');
    console.log('[AI] Parsed result:', result.items?.length || 0, 'items');

    // CRITICAL: Validate AI output against schema
    const validation = validateExtraction(result);
    if (!validation.valid) {
      console.error('[AI] Validation failed:', validation.errors);
      // Return empty extraction as fallback (don't crash)
      return res.status(200).json({
        items: [],
        overall_confidence: 0,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          model_version: 'validation-failed',
        },
      });
    }

    // If AI returns no items, that's ok - return empty extraction early
    if (!result.items || result.items.length === 0) {
      console.log('[AI] Groq returned no items - returning empty extraction');
      return res.status(200).json({
        items: [],
        overall_confidence: 0,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          model_version: 'groq-empty',
        },
      });
    }

    // Enrich tasks with duration and deadline estimates (ONLY if we have items)
    console.log('[AI] Enriching', result.items.length, 'items...');
    const enrichedItems = await Promise.all(
        result.items.map(async (item) => {
          if (item.type === 'task' && !item.duration_min_minutes) {
            try {
              const enrichment = await prompt(
                `Estimate duration and deadline for this task. Return ONLY valid JSON (no markdown):
{"min_minutes": <5-480>, "max_minutes": <5-480>, "days_until_due": <1-30>, "confidence": <0.0-1.0>}
Task: "${item.title}" ${item.description ? `(${item.description})` : ''}
Importance: ${item.importance || 'medium'}`,
                { allowClaude, temperature: 0.3, maxTokens: 300 }
              );

              {
                const parsed = extractJson(enrichment.text);
                if (parsed) {
                  const minMin = Math.max(5, Math.min(480, parsed.min_minutes ?? parsed.min ?? 15));
                  const maxMin = Math.max(minMin, Math.min(480, parsed.max_minutes ?? parsed.max ?? 30));
                  const daysUntilDue = Math.max(1, Math.min(30, parsed.days_until_due ?? parsed.days ?? 3));

                  const dueDate = new Date();
                  dueDate.setDate(dueDate.getDate() + (daysUntilDue - 1));

                  return {
                    ...item,
                    duration_min_minutes: minMin,
                    duration_max_minutes: maxMin,
                    due_at: dueDate.toISOString().split('T')[0],
                    confidence: Math.max(0, Math.min(1, parsed.confidence ?? item.confidence ?? 0.7)),
                  };
                }
              }
            } catch (err) {
              console.error('Error enriching task:', err);
            }
          }
          return item;
        })
      );

      result.items = enrichedItems;

    // Add actual processing time
    result.metadata = {
      ...result.metadata,
      processing_time_ms: Date.now() - startTime,
      algorithm_version: `${llm.provider}:${llm.model}`,
    };

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to extract items from note',
    });
  }
};
