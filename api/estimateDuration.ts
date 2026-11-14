import { VercelRequest, VercelResponse } from '@vercel/node';
import { prompt, extractJson } from './_lib/llm.js';
import { optionalUser } from './_lib/firebaseAdmin.js';

async function estimateDurationAI(taskTitle: string, allowClaude: boolean) {
  try {
    const llm = await prompt(
      `Estimate how long this task realistically takes a student. Return ONLY JSON (no other text):
{"min_minutes": <5-480>, "max_minutes": <5-480>}

Task: "${taskTitle}"`,
      { allowClaude, temperature: 0.2, maxTokens: 100 }
    );

    const parsed = extractJson(llm.text);
    if (!parsed) {
      throw new Error('No JSON found in response');
    }

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
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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
    const allowClaude = (await optionalUser(req)) !== null;
    const result = await estimateDurationAI(taskTitle, allowClaude);
    console.log('[Duration] Result:', result);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Duration estimation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to estimate duration',
    });
  }
};
