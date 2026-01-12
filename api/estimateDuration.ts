import { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function estimateDurationAI(taskTitle: string) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'user',
          content: `Estimate duration for this task. Return ONLY JSON (no other text):
{"min_minutes": <5-480>, "max_minutes": <5-480>}

Task: "${taskTitle}"`,
        },
      ],
      temperature: 0.2,
      max_tokens: 100,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from API');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate response
    const minMin = Math.max(5, Math.min(480, parsed.min_minutes ?? 15));
    const maxMin = Math.max(minMin, Math.min(480, parsed.max_minutes ?? 30));

    return {
      duration_min_minutes: minMin,
      duration_max_minutes: maxMin,
      confidence: 0.85,
    };
  } catch (error) {
    console.error('AI estimation error:', error);
    // Fallback to defaults
    return {
      duration_min_minutes: 15,
      duration_max_minutes: 30,
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

  const { taskTitle } = req.body;

  if (!taskTitle || typeof taskTitle !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: taskTitle must be a non-empty string',
    });
  }

  try {
    console.log('[Duration] Estimating for:', taskTitle);
    const result = await estimateDurationAI(taskTitle);
    console.log('[Duration] Result:', result);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Duration estimation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to estimate duration',
    });
  }
};
