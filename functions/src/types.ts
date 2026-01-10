export interface Item {
  id: string;
  type: 'task' | 'idea' | 'event';
  title: string;
  description?: string;
  status: 'open' | 'scheduled' | 'done' | 'archived';
  created_at: string;
  due_at?: string;
  duration_min_minutes?: number;
  duration_max_minutes?: number;
  confidence?: number;
  importance: 'high' | 'medium' | 'low';
  energy_type?: 'deep_work' | 'admin' | 'creative';
}

export interface ExtractionInput {
  noteText: string;
}

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
  };
}

export interface PlanningInput {
  items: Item[];
  date?: string;
  timezone?: string;
}

export interface PlanningOutput {
  date: string;
  timezone: string;
  focus_task_id?: string;
  mini_task_ids: string[];
  suggested_blocks: Array<{
    start_at: string;
    end_at: string;
    block_type: 'focus' | 'mini' | 'buffer';
    task_id?: string;
    duration_minutes: number;
  }>;
  reasoning_brief: string;
  confidence: number;
  metadata: {
    processing_time_ms: number;
    algorithm_version: string;
  };
}
