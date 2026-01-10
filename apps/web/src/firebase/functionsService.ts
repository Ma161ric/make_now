import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { ExtractionOutput, PlanningOutput } from '@make-now/core';

// Initialize Functions
const functions = getFunctions();

// Connect to emulator in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

/**
 * Call Cloud Function to extract items from note text
 */
export async function extractFromNoteCloud(noteText: string): Promise<ExtractionOutput> {
  const callable = httpsCallable<{ noteText: string }, ExtractionOutput>(
    functions,
    'extractFromNote'
  );

  try {
    const result = await callable({ noteText });
    return result.data;
  } catch (error: any) {
    console.error('Cloud function error:', error);
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
