import { useCallback, useState } from 'react';
import { estimateDurationCloud } from '../firebase/functionsService';

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
      const result = await estimateDurationCloud(taskTitle);
      return {
        min_minutes: result.min,
        max_minutes: result.max,
        confidence: result.confidence
      };
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Unbekannter Fehler bei der Zeitschätzung';
      
      setError(errorMessage);
      console.error('AI duration estimation error:', err);
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
