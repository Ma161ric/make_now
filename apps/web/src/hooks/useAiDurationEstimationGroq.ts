import { useCallback, useState } from 'react';

interface DurationEstimate {
  min_minutes: number;
  max_minutes: number;
  confidence: number;
}

export function useAiDurationEstimationGroq() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimate = useCallback(async (taskTitle: string): Promise<DurationEstimate | null> => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://make-now.vercel.app/api';
      const response = await fetch(`${apiUrl}/estimateDuration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTitle }),
      });

      if (!response.ok) {
        throw new Error('Duration estimation failed');
      }

      const result = await response.json();
      return {
        min_minutes: result.duration_min_minutes || result.min_minutes,
        max_minutes: result.duration_max_minutes || result.max_minutes,
        confidence: result.confidence || 0.85,
      };
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Duration estimation failed';
      
      setError(errorMessage);
      console.error('Duration estimation error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    estimate,
    loading,
    error,
  };
}
