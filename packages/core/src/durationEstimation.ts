/**
 * AI Duration Estimation
 * Estimates task duration based on title and description using AI
 */

export interface DurationEstimationRequest {
  text: string;
  context?: {
    user_language?: string;
  };
}

export interface DurationEstimationResponse {
  duration_min_minutes: number;
  duration_max_minutes: number;
  confidence: number;
  reasoning?: string;
  estimation_source: 'ai' | 'default';
}

/**
 * Mock implementation of duration estimation
 * Returns reasonable estimates based on keywords in the text
 */
export function estimateDurationFromText(text: string): DurationEstimationResponse {
  const lowerText = text.toLowerCase();

  // Quick task indicators
  if (
    lowerText.includes('schnell') ||
    lowerText.includes('kurz') ||
    lowerText.includes('fix') ||
    lowerText.includes('update') ||
    lowerText.includes('check')
  ) {
    return {
      duration_min_minutes: 5,
      duration_max_minutes: 15,
      confidence: 0.8,
      reasoning: 'Quick task based on keywords',
      estimation_source: 'ai',
    };
  }

  // Meeting/Call indicators
  if (
    lowerText.includes('meeting') ||
    lowerText.includes('call') ||
    lowerText.includes('gespräch') ||
    lowerText.includes('besprechung')
  ) {
    return {
      duration_min_minutes: 30,
      duration_max_minutes: 60,
      confidence: 0.75,
      reasoning: 'Meeting duration based on common practice',
      estimation_source: 'ai',
    };
  }

  // Large task indicators
  if (
    lowerText.includes('implement') ||
    lowerText.includes('entwickeln') ||
    lowerText.includes('erstellen') ||
    lowerText.includes('build') ||
    lowerText.includes('refactor')
  ) {
    return {
      duration_min_minutes: 90,
      duration_max_minutes: 180,
      confidence: 0.65,
      reasoning: 'Complex development task',
      estimation_source: 'ai',
    };
  }

  // Research/Learning indicators
  if (
    lowerText.includes('research') ||
    lowerText.includes('learn') ||
    lowerText.includes('study') ||
    lowerText.includes('recherche')
  ) {
    return {
      duration_min_minutes: 45,
      duration_max_minutes: 90,
      confidence: 0.7,
      reasoning: 'Research/learning task',
      estimation_source: 'ai',
    };
  }

  // Default for medium tasks
  return {
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    confidence: 0.5,
    reasoning: 'Default estimate for unspecified task',
    estimation_source: 'ai',
  };
}
