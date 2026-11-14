/** Shape returned by /api/extractFromNote (formerly in functions/src/types.ts). */
export interface ExtractionOutput {
  items: Array<{
    type: 'task' | 'idea' | 'event';
    title: string;
    description?: string;
    due_at?: string;
    duration_min_minutes?: number;
    duration_max_minutes?: number;
    confidence: number;
    importance: 'high' | 'medium' | 'low';
    energy_type: 'deep_work' | 'admin' | 'creative';
  }>;
  metadata: {
    processing_time_ms: number;
    model_version: string;
    algorithm_version: string;
  };
}
