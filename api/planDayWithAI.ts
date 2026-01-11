import { VercelRequest, VercelResponse } from '@vercel/node';

// Import Groq using require for CommonJS compatibility
const Groq = require('groq-sdk').default;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface PlanInput {
  prompt: string;
  reflection: string;
  mood: string;
  tasksDone: number;
  tasksTotal: number;
  completionRate: number;
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

  const { prompt } = req.body as PlanInput;

  if (!prompt) {
    return res.status(400).json({
      error: 'Missing required fields: prompt',
    });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in response, using defaults');
      return res.status(200).json({
        suggested_tasks: [
          { title: 'Continue yesterday\'s priorities', duration_minutes: 45, priority: 'high' },
          { title: 'Review progress and adjust', duration_minutes: 30, priority: 'medium' },
        ],
        focus_recommendation: 'Build on your momentum from yesterday',
        planning_tips: ['Start with your highest energy task', 'Take regular breaks'],
      });
    }

    const plan = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      suggested_tasks: Array.isArray(plan.suggested_tasks) ? plan.suggested_tasks : [],
      focus_recommendation: typeof plan.focus_recommendation === 'string' ? plan.focus_recommendation : '',
      planning_tips: Array.isArray(plan.planning_tips) ? plan.planning_tips : [],
    });
  } catch (error: any) {
    console.error('Groq API error:', error);
    // Return graceful fallback instead of error
    return res.status(200).json({
      suggested_tasks: [
        { title: 'Keep momentum going', duration_minutes: 45, priority: 'high' },
        { title: 'Focus on one key priority', duration_minutes: 30, priority: 'high' },
      ],
      focus_recommendation: 'Build on what worked yesterday',
      planning_tips: ['Plan your day the night before', 'Be realistic with your time'],
    });
  }
};
