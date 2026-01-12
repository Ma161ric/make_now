import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { ExtractionOutput, PlanningOutput } from '@make-now/core';

// Initialize Functions
const functions = getFunctions();

// Connect to emulator in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

/**
 * Call Vercel API to extract items from note text
 */
export async function extractFromNoteCloud(noteText: string): Promise<ExtractionOutput> {
  const apiUrl = import.meta.env.VITE_API_URL || 'https://make-now.vercel.app/api';
  
  try {
    console.log('[AI] Calling extractFromNote API...');
    const response = await fetch(`${apiUrl}/extractFromNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ noteText }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Extraction API failed');
    }

    const result = await response.json();
    console.log('[AI] Extraction API response:', result);
    return result;
  } catch (error: any) {
    console.error('[AI] Extraction API error:', error);
    throw new Error(`AI extraction failed: ${error.message}`);
  }
}

/**
 * Call Cloud Function to generate daily plan
 */
export async function planDayCloud(
  items: any[],
  date?: string,
  timezone?: string
): Promise<PlanningOutput> {
  const callable = httpsCallable<
    { items: any[]; date?: string; timezone?: string },
    PlanningOutput
  >(functions, 'planDay');

  try {
    const result = await callable({ items, date, timezone });
    return result.data;
  } catch (error: any) {
    console.error('Cloud function error:', error);
    throw new Error(`AI planning failed: ${error.message}`);
  }
}

/**
 * Call Cloud Function to estimate task duration
 */
export async function estimateDurationCloud(
  taskTitle: string,
  description?: string
): Promise<{ min: number; max: number; confidence: number; source: string }> {
  const callable = httpsCallable<
    { taskTitle: string; description?: string },
    { min: number; max: number; confidence: number; source: string }
  >(functions, 'estimateDuration');

  try {
    const result = await callable({ taskTitle, description });
    return result.data;
  } catch (error: any) {
    console.error('Cloud function error:', error);
    throw new Error(`AI duration estimation failed: ${error.message}`);
  }
}
