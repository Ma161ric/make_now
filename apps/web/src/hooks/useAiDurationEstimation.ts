import { useState, useCallback } from 'react';
import { estimateDurationFromText } from '@make-now/core';

export interface DurationEstimate {
  min_minutes: number;
  max_minutes: number;
  confidence: number;
  reasoning?: string;
}

export function useAiDurationEstimation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimateDuration = useCallback(async (title: string, description?: string): Promise<DurationEstimate | null> => {
    setLoading(true);
    setError(null);

    try {
      const text = description ? `${title}. ${description}` : title;
      const estimate = await estimateDurationFromText(text);
      
      return {
        min_minutes: estimate.duration_min_minutes,
        max_minutes: estimate.duration_max_minutes,
        confidence: estimate.confidence,
        reasoning: estimate.reasoning,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Estimation failed';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    estimateDuration,
    loading,
    error,
  };
}
