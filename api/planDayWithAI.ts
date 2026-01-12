import { VercelRequest, VercelResponse } from '@vercel/node';

// Import Groq using require for CommonJS compatibility
const Groq = require('groq-sdk').default;

interface PlanTask {
  title: string;
  duration_minutes: number;
  priority: 'high' | 'medium' | 'low';
}

interface DayPlanResponse {
  suggested_tasks: PlanTask[];
  focus_recommendation: string;
  planning_tips: string[];
}

interface PlanInput {
  prompt: string;
  reflection: string;
  mood: string;
  tasksDone: number;
  tasksTotal: number;
  completionRate: number;
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_PLAN: DayPlanResponse = {
  suggested_tasks: [
    { title: 'Gestrigen Fokus fortsetzen', duration_minutes: 45, priority: 'high' },
    { title: 'Fortschritt überprüfen und anpassen', duration_minutes: 30, priority: 'medium' },
    { title: 'Eine kleine Aufgabe abschließen', duration_minutes: 15, priority: 'low' },
  ],
  focus_recommendation: 'Baue auf deinem Momentum auf und konzentriere dich auf deine Prioritäten.',
  planning_tips: [
    'Beginne mit deiner Aufgabe mit der höchsten Energie',
    'Mache regelmäßige Pausen',
    'Überprüfe deinen Fortschritt um die Mittagszeit',
  ],
};

function validatePlanResponse(data: any): data is DayPlanResponse {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.suggested_tasks)) return false;
  if (typeof data.focus_recommendation !== 'string') return false;
  if (!Array.isArray(data.planning_tips)) return false;

  // Validate tasks structure
  return data.suggested_tasks.every((task: any) =>
    typeof task.title === 'string' &&
    typeof task.duration_minutes === 'number' &&
    ['high', 'medium', 'low'].includes(task.priority)
  );
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body as PlanInput;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      error: 'Missing required fields: prompt',
    });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'Du bist ein hilfreicher Assistent, der intelligente Tagesplanungen basierend auf Reflexionen erstellt. Antworte mit gültigem JSON, keine Markdown oder zusätzlicher Text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '';

    if (!content) {
      console.warn('Empty response from Groq');
      return res.status(200).json(DEFAULT_PLAN);
    }

    // Try to extract JSON - handle various formats
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in Groq response:', content.substring(0, 100));
      return res.status(200).json(DEFAULT_PLAN);
    }

    let plan: any;
    try {
      plan = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.warn('Failed to parse JSON:', jsonMatch[0].substring(0, 100));
      return res.status(200).json(DEFAULT_PLAN);
    }

    // Validate and sanitize response
    if (!validatePlanResponse(plan)) {
      console.warn('Invalid plan response structure, using defaults');
      return res.status(200).json(DEFAULT_PLAN);
    }

    // Sanitize and limit suggestions
    const sanitized: DayPlanResponse = {
      suggested_tasks: plan.suggested_tasks.slice(0, 5).map((task: any) => ({
        title: String(task.title).substring(0, 100),
        duration_minutes: Math.max(5, Math.min(480, parseInt(task.duration_minutes) || 30)),
        priority: task.priority,
      })),
      focus_recommendation: String(plan.focus_recommendation).substring(0, 200),
      planning_tips: plan.planning_tips
        .slice(0, 5)
        .map((tip: any) => String(tip).substring(0, 150)),
    };

    return res.status(200).json(sanitized);
  } catch (error: any) {
    console.error('Groq API error:', error?.message || error);

    // Return graceful fallback instead of error
    return res.status(200).json(DEFAULT_PLAN);
  }
};
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
