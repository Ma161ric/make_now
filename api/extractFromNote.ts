import { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { ExtractionOutput } from '../functions/src/types';

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

    const startTime = Date.now();

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
