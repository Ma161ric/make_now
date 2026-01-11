import { VercelRequest, VercelResponse } from '@vercel/node';

// Mock duration estimation - no AI dependency
function estimateDurationAI(taskTitle: string) {
  return {
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    confidence: 0.7,
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

  const { taskTitle } = req.body;

  if (!taskTitle || typeof taskTitle !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: taskTitle must be a non-empty string',
    });
  }

  try {
    const result = estimateDurationAI(taskTitle);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Duration estimation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to estimate duration',
    });
  }
};
