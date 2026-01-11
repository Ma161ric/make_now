import { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

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

  const { prompt, reflection, mood, tasksDone, tasksTotal } = req.body as ReviewInput;

  if (!prompt || !reflection) {
    return res.status(400).json({
      error: 'Missing required fields: prompt, reflection',
    });
  }

  try {
    const message = await groq.messages.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Groq');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      suggestions: analysis.suggestions || [],
      insight: analysis.insight || '',
      tomorrow_focus: analysis.tomorrow_focus || '',
    });
  } catch (error: any) {
    console.error('Groq API error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate review analysis',
    });
  }
};
