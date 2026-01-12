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
    // Groq API call - using mock fallback for now since API not active in development
    // TODO: Implement real Groq call when API key is available
    // const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    //   body: JSON.stringify({ ... })
    // });
    
    // For now, return sensible defaults based on title
    const hasDeadline = /today|tomorrow|urgent|asap|ASAP|deadline/.test(title);
    const hasDuration = /(\d+\s*(min|hour|hr))/.test(title);
    const isHighPriority = importance === 'high' || /critical|important|urgent/.test(title.toLowerCase());

    // Smart defaults based on importance
    const minDuration = isHighPriority ? 30 : 15;
    const maxDuration = isHighPriority ? 90 : 60;
    const daysUntilDue = isHighPriority ? 1 : (hasDeadline ? 2 : 7);
    const confidence = hasDuration ? 0.85 : 0.65;

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (daysUntilDue - 1));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    return {
      duration_min_minutes: minDuration,
      duration_max_minutes: maxDuration,
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
