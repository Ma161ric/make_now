import { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface TaskMetadataRequest {
  title: string;
  description?: string;
  importance?: 'high' | 'medium' | 'low';
}

interface TaskMetadataResponse {
  duration_min_minutes: number;
  duration_max_minutes: number;
  due_date: string; // ISO date
  confidence: number;
}

async function enrichTaskMetadata(req: TaskMetadataRequest): Promise<TaskMetadataResponse> {
  const { title, description, importance = 'medium' } = req;

  try {
    const message = await groq.messages.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are a task planning expert. Estimate duration and deadline for this task. Return ONLY valid JSON:
{"duration_min_minutes": <5-480>, "duration_max_minutes": <5-480>, "days_until_due": <1-30>, "confidence": <0.0-1.0>}

Task Title: "${title}"
${description ? `Description: "${description}"` : ''}
Importance: ${importance}

Rules:
- min_minutes must be 5-480
- max_minutes must be >= min_minutes and <= 480
- days_until_due: 1=today, 2=tomorrow, 7=this week, 14=next week, 30=next month
  - high importance: prefer 1-3 days
  - medium importance: prefer 3-7 days
  - low importance: prefer 7-30 days
- confidence: 0.0-1.0 based on how clear the task is
- Return ONLY the JSON object, nothing else`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clamp values
    const minMin = Math.max(5, Math.min(480, parsed.duration_min_minutes ?? 15));
    const maxMin = Math.max(minMin, Math.min(480, parsed.duration_max_minutes ?? 30));
    const daysUntilDue = Math.max(1, Math.min(30, parsed.days_until_due ?? 3));
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.7));

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (daysUntilDue - 1));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    return {
      duration_min_minutes: minMin,
      duration_max_minutes: maxMin,
      due_date: dueDateStr,
      confidence,
    };
  } catch (error) {
    console.error('Task enrichment error:', error);
    // Fallback defaults based on importance
    const defaultDays = importance === 'high' ? 1 : importance === 'medium' ? 3 : 7;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + defaultDays);

    return {
      duration_min_minutes: 15,
      duration_max_minutes: 30,
      due_date: dueDate.toISOString().split('T')[0],
      confidence: 0.5,
    };
  }
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

  const { title, description, importance } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: title must be a non-empty string',
    });
  }

  try {
    const result = await enrichTaskMetadata({
      title,
      description,
      importance,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Task enrichment error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to enrich task metadata',
    });
  }
};
