import { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { ExtractionOutput } from '../functions/src/types.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export default async (req: VercelRequest, res: VercelResponse) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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

  try {
    console.log('[AI] Extracting from note:', noteText.substring(0, 100) + '...');
    const startTime = Date.now();

    const systemPrompt = `You are a task extraction assistant. Extract tasks, ideas, and events from user notes.
Return a valid JSON object with this exact structure:
{
  "items": [
    {
      "type": "task" | "idea" | "event",
      "title": "string (max 100 chars)",
      "description": "string (optional, max 500 chars)",
      "due_at": "ISO date string (optional)",
      "duration_min_minutes": number (optional, 5-480),
      "duration_max_minutes": number (optional, 5-480),
      "confidence": number (0.0-1.0),
      "importance": "high" | "medium" | "low",
      "energy_type": "deep_work" | "admin" | "creative"
    }
  ],
  "metadata": {
    "processing_time_ms": number,
    "algorithm_version": "string"
  }
}`;

    const userPrompt = `Extract all actionable items from this note:\n\n${noteText}`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Groq API');
    }

    const result: ExtractionOutput = JSON.parse(content);

    // Enrich tasks with duration and deadline estimates
    if (result.items) {
      const enrichedItems = await Promise.all(
        result.items.map(async (item) => {
          if (item.type === 'task' && !item.duration_min_minutes) {
            try {
              const enrichment = await groq.chat.completions.create({
                model: 'mixtral-8x7b-32768',
                messages: [
                  {
                    role: 'user',
                    content: `Estimate duration and deadline for this task. Return ONLY valid JSON (no markdown):
{"min_minutes": <5-480>, "max_minutes": <5-480>, "days_until_due": <1-30>, "confidence": <0.0-1.0>}
Task: "${item.title}" ${item.description ? `(${item.description})` : ''}
Importance: ${item.importance || 'medium'}`,
                  },
                ],
                temperature: 0.3,
                max_tokens: 300,
              });

              const enrichContent = enrichment.choices[0]?.message?.content;
              if (enrichContent) {
                const jsonMatch = enrichContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
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
    }

    // Add actual processing time
    result.metadata = {
      ...result.metadata,
      processing_time_ms: Date.now() - startTime,
      algorithm_version: GROQ_MODEL,
    };

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Extraction error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to extract items from note',
    });
  }
};
