import { VercelRequest, VercelResponse } from '@vercel/node';
import { PlanningInput, PlanningOutput } from '../functions/src/types.js';

// Mock planning function - returns empty day plan
function planFromItemsMock(items: PlanningInput['items']): PlanningOutput {
  return {
    date: new Date().toISOString().split('T')[0],
    timezone: 'UTC',
    mini_task_ids: [],
    suggested_blocks: [],
    reasoning_brief: 'Mock plan - no items provided',
    confidence: 0.5,
    metadata: {
      processing_time_ms: 0,
      algorithm_version: '1.0-mock',
    },
  };
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

  const { items, date, timezone } = req.body as PlanningInput;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({
      error: 'Invalid request: items must be an array',
    });
  }

  try {
    // For MVP, use mock planning algorithm
    // Later: integrate with Groq for AI-powered planning
    const result: PlanningOutput = planFromItemsMock(items);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Planning error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to plan day',
    });
  }
};
