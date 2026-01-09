/**
 * Core Data Models
 * Based on /spec/30_models/*.md
 */

// Task States
export type TaskStatus = 'open' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';

// Event States
export type EventStatus = 'tentative' | 'confirmed' | 'cancelled';

// Idea States
export type IdeaStatus = 'active' | 'archived' | 'converted';

// InboxNote States
export type InboxNoteStatus = 'unprocessed' | 'processed' | 'failed';

// Task Properties
export type EstimationSource = 'ai' | 'parsed' | 'user_override' | 'default';
export type Importance = 'low' | 'medium' | 'high';
export type EnergyType = 'deep_work' | 'admin' | 'creative';

// Item Types (from extraction)
export type ItemType = 'task' | 'event' | 'idea';

/**
 * Task Model
 * Executable work item with duration and status tracking
 */
export interface Task {
  id: string; // UUID
  title: string; // 3-200 chars
  raw_note?: string;
  status: TaskStatus;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  due_at?: Date;
  duration_min_minutes?: number; // 5-480
  duration_max_minutes?: number; // 5-480
  estimation_source: EstimationSource;
  confidence?: number; // 0.0-1.0
  importance: Importance; // Default: medium
  energy_type?: EnergyType;
  inbox_note_id?: string;
  day_plan_id?: string;
  notes?: string;
}

/**
 * Event Model
 * Calendar events extracted or added
 */
export interface Event {
  id: string; // UUID
  title: string; // 1-200 chars
  status: EventStatus;
  created_at: Date;
  updated_at: Date;
  start_at?: Date;
  end_at?: Date;
  time_window_start?: string; // HH:MM:SS
  time_window_end?: string; // HH:MM:SS
  timezone: string; // IANA, Default: Europe/Berlin
  all_day: boolean;
  location?: string;
  confidence?: number; // 0.0-1.0
  inbox_note_id?: string;
  notes?: string;
}

/**
 * Idea Model
 * Captured ideas not yet actionable
 */
export interface Idea {
  id: string; // UUID
  title: string;
  status: IdeaStatus;
  created_at: Date;
  updated_at: Date;
  archived_at?: Date;
  content?: string;
  confidence?: number; // 0.0-1.0
  inbox_note_id?: string;
  notes?: string;
}

/**
 * InboxNote Model
 * Raw captured note
 */
export interface InboxNote {
  id: string; // UUID
  raw_text: string;
  status: InboxNoteStatus;
  created_at: Date;
  updated_at: Date;
  error_message?: string;
}

/**
 * DayPlan Model
 * Daily schedule
 */
export interface DayPlan {
  id: string; // UUID
  date: Date; // Today's date
  timezone: string;
  focus_task_id?: string;
  mini_task_ids: string[]; // max 2
  suggested_blocks: TimeBlock[];
  reasoning: string;
  confidence: number; // 0.0-1.0
  status: 'draft' | 'confirmed' | 'archived';
  created_at: Date;
  updated_at: Date;
}

/**
 * TimeBlock Model
 * Part of a DayPlan
 */
export interface TimeBlock {
  start_at: Date;
  end_at: Date;
  block_type: 'focus' | 'mini' | 'buffer';
  task_id?: string; // null for buffer blocks
  duration_minutes: number;
}

/**
 * Extracted Item (from AI/Mock)
 * Temporary representation before converting to Task/Event/Idea
 */
export interface ExtractedItem {
  id: string; // UUID
  type: ItemType;
  title: string;
  raw_text_span?: string;
  parsed_fields: TaskFields | EventFields | IdeaFields;
  confidence: number;
  questions?: string[]; // max 1 per policy
}

export interface TaskFields {
  duration_min_minutes: number;
  duration_max_minutes: number;
  estimation_source: EstimationSource;
  due_at?: string; // ISO 8601
  importance?: Importance;
  energy_type?: EnergyType;
}

export interface EventFields {
  start_at?: string; // ISO 8601
  end_at?: string; // ISO 8601
  time_window_start?: string; // HH:MM:SS
  time_window_end?: string; // HH:MM:SS
  timezone: string;
  all_day?: boolean;
  location?: string;
}

export interface IdeaFields {
  content?: string;
}

/**
 * Extraction Response (from AI/Mock)
 * Matches extraction_schema.json
 */
export interface ExtractionResponse {
  items: ExtractedItem[];
  overall_confidence: number;
  metadata: {
    processing_time_ms: number;
    model_version?: string;
  };
}

/**
 * Planning Response (from Scheduling Engine)
 * Matches planning_schema.json
 */
export interface PlanningResponse {
  date: string; // ISO 8601 date
  timezone: string;
  focus_task_id?: string;
  mini_task_ids: string[];
  suggested_blocks: TimeBlock[];
  reasoning_brief: string;
  confidence: number;
  metadata: {
    processing_time_ms: number;
    algorithm_version?: string;
  };
}

/**
 * State Transition Validation
 * Enforces rules from /spec/30_models/states_and_transitions.md
 */
export class StateTransitionError extends Error {
  constructor(
    public from: string,
    public to: string,
    public reason: string
  ) {
    super(`Invalid transition: ${from} -> ${to}. Reason: ${reason}`);
    this.name = 'StateTransitionError';
  }
}
