import { useCallback, useState } from 'react';
import { estimateDuration, GroqAPIError } from '@make-now/core';

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
      const apiKey = import.meta.env.GROQ_API_KEY;
      
      if (!apiKey) {
        throw new Error('Groq API Key fehlt. Bitte in .env konfigurieren.');
      }

      const result = await estimateDuration(taskTitle, apiKey);
      return result;
    } catch (err) {
      const errorMessage = err instanceof GroqAPIError 
        ? err.message 
        : err instanceof Error 
          ? err.message 
          : 'Unbekannter Fehler bei der Schätzung';
      
      setError(errorMessage);
      console.error('Duration estimation error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    estimateDuration: estimate,
    loading,
    error,
  };
}
