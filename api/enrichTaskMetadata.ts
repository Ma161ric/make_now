import { VercelRequest, VercelResponse } from '@vercel/node';
import { prompt as askAi, extractJson } from './_lib/llm.js';
import { optionalUser } from './_lib/firebaseAdmin.js';

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

async function enrichTaskMetadata(req: TaskMetadataRequest, allowClaude: boolean): Promise<TaskMetadataResponse> {
  const { title, description, importance = 'medium' } = req;

  try {
    // Create detailed prompt for Groq to estimate task metadata
    const prompt = `You are a task management expert. Analyze the following task and provide realistic estimates.

Task Title: "${title}"
${description ? `Task Description: "${description}"` : ''}
Importance Level: ${importance}

Based on this task, provide ONLY a JSON response (no markdown, no explanation) with:
{
  "estimated_min_minutes": <number>,
  "estimated_max_minutes": <number>,
  "days_until_due": <number between 0-7>,
  "reasoning": "<brief reasoning>"
}

Guidelines:
- For high importance: min 30-60 min, max 90-180 min, due in 1-2 days
- For medium importance: min 15-30 min, max 45-90 min, due in 3-5 days  
- For low importance: min 10-20 min, max 30-60 min, due in 5-7 days
- Look for keywords like "today", "tomorrow", "urgent", "deadline" to adjust due dates
- Be realistic with time estimates based on task complexity`;

    const llm = await askAi(prompt, { allowClaude, maxTokens: 300 });
    const parsed = extractJson(llm.text);
    if (!parsed) throw new Error('AI returned no JSON');

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (parsed.days_until_due || 3));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    return {
      duration_min_minutes: Math.max(10, parsed.estimated_min_minutes || 15),
      duration_max_minutes: Math.max(20, parsed.estimated_max_minutes || 60),
      due_date: dueDateStr,
      confidence: 0.9, // High confidence when using real AI
    };
  } catch (error) {
    console.error('Task enrichment error:', error);
    // Fallback to heuristics-based defaults
    const hasDeadline = /today|tomorrow|urgent|asap|ASAP|deadline/.test(title);
    const isHighPriority = importance === 'high' || /critical|important|urgent/.test(title.toLowerCase());

    const minDuration = isHighPriority ? 30 : 15;
    const maxDuration = isHighPriority ? 90 : 60;
    const daysUntilDue = isHighPriority ? 1 : (hasDeadline ? 2 : 7);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (daysUntilDue - 1));

    return {
      duration_min_minutes: minDuration,
      duration_max_minutes: maxDuration,
      due_date: dueDate.toISOString().split('T')[0],
      confidence: 0.6, // Lower confidence for fallback
    };
  }
}

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

  const { title, description, importance } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: title must be a non-empty string',
    });
  }

  try {
    const allowClaude = (await optionalUser(req)) !== null;
    const result = await enrichTaskMetadata({ title, description, importance }, allowClaude);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Task enrichment error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to enrich task metadata',
    });
  }
};
