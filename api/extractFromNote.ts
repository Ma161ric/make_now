import { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { ExtractionOutput } from '../functions/src/types.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Fallback extraction when Groq doesn't return items
 */
function extractItemsFallback(noteText: string): any[] {
  const items: any[] = [];
  const lines = noteText.split('\n').filter(l => l.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and headings
    if (!trimmed || trimmed.length < 3) continue;

    // Detect if it's a task (starts with -, *, •, TODO, [ ], etc)
    const isTask = /^[\-\*•]\s|^TODO|^\[\s?\]|^task|^do:|^finish|^complete/i.test(trimmed);
    
    // Detect urgency
    const isUrgent = /urgent|asap|today|now|immediately|critical|deadline/i.test(trimmed);
    const isImportant = /important|priority|key|main|focus/i.test(trimmed);
    
    // Build item
    const item = {
      type: isTask ? 'task' : 'idea',
      title: trimmed.replace(/^[\-\*•]\s+|^TODO\s+|^\[\s?\]\s+|^task\s+|^do:\s+|^finish\s+|^complete\s+/i, '').substring(0, 100),
      description: null,
      importance: isUrgent ? 'high' : isImportant ? 'medium' : 'low',
      energy_type: /meeting|call|email|review|read/i.test(trimmed) ? 'admin' : 'deep_work',
      confidence: 0.6, // Lower confidence for fallback
    };

    items.push(item);
  }

  return items;
}

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

    console.log('[AI] Calling Groq with prompt...');
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    console.log('[AI] Raw response:', content?.substring(0, 200));
    
    if (!content) {
      throw new Error('No response from Groq API');
    }

    // Extract JSON from response (might have extra text)
    let jsonStr = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
      console.log('[AI] Extracted JSON');
    }

    const result: ExtractionOutput = JSON.parse(jsonStr);
    console.log('[AI] Parsed result:', result.items.length, 'items');

    // If Groq returned empty items, use fallback extraction
    if (!result.items || result.items.length === 0) {
      console.log('[AI] No items from Groq, using fallback extraction...');
      result.items = extractItemsFallback(noteText);
      console.log('[AI] Fallback extracted:', result.items.length, 'items');
    }


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
