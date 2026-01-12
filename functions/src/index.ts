import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Groq from 'groq-sdk';
import { ExtractionOutput, PlanningInput, PlanningOutput } from './types';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODEL = 'mixtral-8x7b-32768';

/**
 * Cloud Function: Extract items from note text
 * POST /extractFromNote
 * Body: { noteText: string }
 */
export const extractFromNote = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
    secrets: ['GROQ_API_KEY']
  })
  .https.onCall(async (data: { noteText: string }, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to use AI extraction.'
      );
    }

    const { noteText } = data;

    if (!noteText || typeof noteText !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'noteText must be a non-empty string'
      );
    }

    try {
      const systemPrompt = `You are a task extraction assistant. Extract tasks, ideas, and events from user notes.
Return a valid JSON object with this exact structure:
{
  "items": [
    {
      "type": "task" | "idea" | "event",
      "title": "string (max 100 chars)",
      "description": "string (optional, max 500 chars)",
      "due_at": "ISO date string (optional)",
      "duration_min_minutes": number (optional, 5-480),
      "duration_max_minutes": number (optional, 5-480),
      "confidence": number (0.0-1.0),
      "importance": "high" | "medium" | "low",
      "energy_type": "deep_work" | "admin" | "creative"
    }
  ],
  "metadata": {
    "processing_time_ms": number,
    "model_version": "string"
  }
}`;

      const userPrompt = `Extract all actionable items from this note:\n\n${noteText}`;

      const startTime = Date.now();
      
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Groq API');
      }

      const result: ExtractionOutput = JSON.parse(content);
      
      // Add actual processing time
      result.metadata = {
        ...result.metadata,
        processing_time_ms: Date.now() - startTime,
        model_version: GROQ_MODEL
      };

      return result;
    } catch (error: any) {
      console.error('Groq extraction error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `AI extraction failed: ${error.message}`
      );
    }
  });

/**
 * Cloud Function: Generate daily plan from items
 * POST /planDay
 * Body: { items: Item[], date?: string, timezone?: string }
 */
export const planDay = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
    secrets: ['GROQ_API_KEY']
  })
  .https.onCall(async (data: PlanningInput, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to use AI planning.'
      );
    }

    const { items, date, timezone } = data;

    if (!Array.isArray(items)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'items must be an array'
      );
    }

    try {
      const systemPrompt = `You are a daily planning assistant. Create an optimal daily plan from a list of tasks.
Return a valid JSON object with this exact structure:
{
  "date": "YYYY-MM-DD",
  "timezone": "string",
  "focus_task_id": "string (optional)",
  "mini_task_ids": ["string"],
  "suggested_blocks": [
    {
      "start_at": "ISO datetime",
      "end_at": "ISO datetime",
      "block_type": "focus" | "mini" | "buffer",
      "task_id": "string (optional)",
      "duration_minutes": number
    }
  ],
  "reasoning_brief": "string (max 200 chars)",
  "confidence": number (0.0-1.0),
  "metadata": {
    "processing_time_ms": number,
    "algorithm_version": "string"
  }
}`;

      const userPrompt = `Plan the day ${date || 'today'} (timezone: ${timezone || 'Europe/Berlin'}) with these items:\n\n${JSON.stringify(items, null, 2)}`;

      const startTime = Date.now();
      
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Groq API');
      }

      const result: PlanningOutput = JSON.parse(content);
      
      // Add actual processing time
      result.metadata = {
        ...result.metadata,
        processing_time_ms: Date.now() - startTime,
        algorithm_version: GROQ_MODEL
      };

      return result;
    } catch (error: any) {
      console.error('Groq planning error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `AI planning failed: ${error.message}`
      );
    }
  });

/**
 * Cloud Function: Estimate task duration
 * POST /estimateDuration
 * Body: { taskTitle: string, description?: string }
 */
export const estimateDuration = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 30,
    memory: '128MB',
    secrets: ['GROQ_API_KEY']
  })
  .https.onCall(async (data: { taskTitle: string; description?: string }, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to use AI duration estimation.'
      );
    }

    const { taskTitle, description } = data;

    if (!taskTitle || typeof taskTitle !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'taskTitle must be a non-empty string'
      );
    }

    try {
      const systemPrompt = `You are a time estimation assistant. Estimate realistic task durations.
Return a valid JSON object with this exact structure:
{
  "min": number (minutes, 5-480),
  "max": number (minutes, 5-480),
  "confidence": number (0.0-1.0),
  "source": "ai"
}`;

      const userPrompt = `Estimate duration for: "${taskTitle}"${description ? `\nDescription: ${description}` : ''}`;

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Groq API');
      }

      return JSON.parse(content);
    } catch (error: any) {
      console.error('Groq duration estimation error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `AI duration estimation failed: ${error.message}`
      );
    }
  });
