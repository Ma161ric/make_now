import { VercelRequest, VercelResponse } from '@vercel/node';

import { prompt as askAi, extractJson } from './_lib/llm.js';
import { optionalUser } from './_lib/firebaseAdmin.js';

interface ReviewInput {
  prompt: string;
  reflection: string;
  mood: string;
  tasksDone: number;
  tasksTotal: number;
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

  const { prompt } = req.body as ReviewInput;

  if (!prompt) {
    return res.status(400).json({
      error: 'Missing required fields: prompt',
    });
  }

  try {
    const allowClaude = (await optionalUser(req)) !== null;
    const llm = await askAi(prompt, { allowClaude, maxTokens: 500 });

    const analysis = extractJson(llm.text);
    if (!analysis) {
      console.warn('No JSON found in response, using defaults');
      return res.status(200).json({
        suggestions: ['Continue with consistent daily planning', 'Reflect on what worked well'],
        insight: 'Every day is a learning opportunity',
        tomorrow_focus: 'Focus on one key priority',
      });
    }

    return res.status(200).json({
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
      insight: typeof analysis.insight === 'string' ? analysis.insight : '',
      tomorrow_focus: typeof analysis.tomorrow_focus === 'string' ? analysis.tomorrow_focus : '',
    });
  } catch (error: any) {
    console.error('Groq API error:', error);
    // Return graceful fallback instead of error
    return res.status(200).json({
      suggestions: ['Keep up with daily planning', 'Track your progress consistently'],
      insight: 'Reflection is key to improvement',
      tomorrow_focus: 'Focus on priorities',
    });
  }
};
