import { useState, useCallback } from 'react';

export interface DurationEstimate {
  min_minutes: number;
  max_minutes: number;
  confidence: number;
}

export function useAiDurationEstimation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimateDuration = useCallback(async (title: string, description?: string): Promise<DurationEstimate | null> => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://make-now.vercel.app/api';
      const taskTitle = description ? `${title} - ${description}` : title;
      
      const response = await fetch(`${apiUrl}/estimateDuration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTitle }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Duration estimation failed');
      }

      const estimate = await response.json();
      console.log('[Duration Hook] Estimate:', estimate);
      
      return {
        min_minutes: estimate.duration_min_minutes || estimate.min_minutes,
        max_minutes: estimate.duration_max_minutes || estimate.max_minutes,
        confidence: estimate.confidence || 0.85,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Estimation failed';
      console.error('[Duration Hook] Error:', errorMessage);
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
