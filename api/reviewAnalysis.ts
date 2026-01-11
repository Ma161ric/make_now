import { VercelRequest, VercelResponse } from '@vercel/node';

// Import Groq using require for CommonJS compatibility
const Groq = require('groq-sdk').default;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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
    const completion = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 500,
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
        suggestions: ['Continue with consistent daily planning', 'Reflect on what worked well'],
        insight: 'Every day is a learning opportunity',
        tomorrow_focus: 'Focus on one key priority',
      });
    }

    const analysis = JSON.parse(jsonMatch[0]);

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
