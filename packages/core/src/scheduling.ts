/**
 * Deterministic Scheduling Engine
 * Based on /spec/40_rules/scheduling_rules.md
 * Works without KI, enforces all rules
 */

import type {
  Task,
  DayPlan,
  TimeBlock,
  PlanningResponse,
  Importance,
  EnergyType,
} from './models.js';

/**
 * Configuration for scheduling
 */
export interface SchedulingConfig {
  workingHoursStart: number; // 9 = 09:00
  workingHoursEnd: number; // 18 = 18:00
  timezone: string;
  bufferMinutes: number; // 10, 15, 30. Default: 15
}

const DEFAULT_CONFIG: SchedulingConfig = {
  workingHoursStart: 9,
  workingHoursEnd: 18,
  timezone: 'Europe/Berlin',
  bufferMinutes: 15,
};

/**
 * Task with calculated duration for scheduling
 */
interface TaskForScheduling extends Task {
  duration_avg_minutes: number;
}

/**
 * Calculate average duration from min/max
 */
function calculateAvgDuration(task: Task): number {
  if (!task.duration_min_minutes || !task.duration_max_minutes) {
    return 30; // Safe default
  }
  return Math.round((task.duration_min_minutes + task.duration_max_minutes) / 2);
}

/**
 * Prepare tasks with calculated durations
 */
function prepareTasks(tasks: Task[]): TaskForScheduling[] {
  return tasks
    .filter((t) => t.status === 'open')
    .map((t) => ({
      ...t,
      duration_avg_minutes: calculateAvgDuration(t),
    }))
    .sort((a, b) => {
      // Sort by priority per spec
      // 1. Overdue first
      const aOverdue = a.due_at && new Date(a.due_at) < new Date() ? 0 : 1;
      const bOverdue = b.due_at && new Date(b.due_at) < new Date() ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;

      // 2. By importance
      const importanceOrder: Record<Importance, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      const aImportance = importanceOrder[a.importance];
      const bImportance = importanceOrder[b.importance];
      if (aImportance !== bImportance) return aImportance - bImportance;

      // 3. By created date (oldest first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
}

/**
 * Select focus task from candidates
 * Per spec: exactly 1 per day, 60-120min, deep_work preferred
 */
function selectFocusTask(tasks: TaskForScheduling[]): TaskForScheduling | null {
  // Rule 1: Overdue AND 60-120min
  let candidate = tasks.find(
    (t) =>
      t.due_at &&
      new Date(t.due_at) < new Date() &&
      t.duration_avg_minutes >= 60 &&
      t.duration_avg_minutes <= 120
  );
  if (candidate) return candidate;

  // Rule 2: Importance HIGH AND 60-120min
  candidate = tasks.find(
    (t) =>
      t.importance === 'high' &&
      t.duration_avg_minutes >= 60 &&
      t.duration_avg_minutes <= 120
  );
  if (candidate) return candidate;

  // Rule 3: energy_type deep_work AND 60-120min
  candidate = tasks.find(
    (t) =>
      t.energy_type === 'deep_work' &&
      t.duration_avg_minutes >= 60 &&
      t.duration_avg_minutes <= 120
  );
  if (candidate) return candidate;

  // Rule 4: Longest task if 60-120min
  candidate = tasks.find(
    (t) =>
      t.duration_avg_minutes >= 60 && t.duration_avg_minutes <= 120
  );
  if (candidate) return candidate;

  return null;
}

/**
 * Select mini tasks
 * Per spec: exactly 2, 5-20min, admin preferred
 */
function selectMiniTasks(
  tasks: TaskForScheduling[],
  focusTaskId?: string
): TaskForScheduling[] {
  const candidates = tasks
    .filter(
      (t) =>
        t.id !== focusTaskId &&
        t.duration_avg_minutes >= 5 &&
        t.duration_avg_minutes <= 20
    )
    .sort((a, b) => {
      // admin energy preferred
      if (a.energy_type === 'admin' && b.energy_type !== 'admin') return -1;
      if (a.energy_type !== 'admin' && b.energy_type === 'admin') return 1;
      // lower importance preferred for minis
      const importanceOrder: Record<Importance, number> = {
        high: 2,
        medium: 1,
        low: 0,
      };
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });

  // Return up to 2 minis, try to have diversity
  const selected: TaskForScheduling[] = [];
  for (const candidate of candidates) {
    if (selected.length >= 2) break;
    selected.push(candidate);
  }

  return selected;
}

/**
 * Calculate total time needed for a schedule
 */
function calculateTotalMinutes(
  focusTask: TaskForScheduling | null,
  miniTasks: TaskForScheduling[],
  bufferMinutes: number
): number {
  let total = 0;

  if (focusTask) {
    total += focusTask.duration_avg_minutes + bufferMinutes;
  }

  for (const mini of miniTasks) {
    total += mini.duration_avg_minutes + bufferMinutes;
  }

  return total;
}

/**
 * Get available working minutes per day
 */
function getAvailableMinutes(config: SchedulingConfig): number {
  const workingHours = config.workingHoursEnd - config.workingHoursStart;
  return workingHours * 60;
}

/**
 * Build time blocks for the schedule
 */
function buildTimeBlocks(
  today: Date,
  focusTask: TaskForScheduling | null,
  miniTasks: TaskForScheduling[],
  bufferMinutes: number,
  config: SchedulingConfig
): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  // Start at working hours start
  let currentHour = config.workingHoursStart;

  // Add focus block
  if (focusTask) {
    const focusDuration = focusTask.duration_avg_minutes;
    const focusStart = new Date(today);
    focusStart.setHours(currentHour, 0, 0, 0);

    const focusEnd = new Date(focusStart);
    focusEnd.setMinutes(focusEnd.getMinutes() + focusDuration);

    blocks.push({
      start_at: focusStart,
      end_at: focusEnd,
      block_type: 'focus',
      task_id: focusTask.id,
      duration_minutes: focusDuration,
    });

    // Add buffer after focus
    const bufferStart = new Date(focusEnd);
    const bufferEnd = new Date(bufferStart);
    bufferEnd.setMinutes(bufferEnd.getMinutes() + bufferMinutes);

    blocks.push({
      start_at: bufferStart,
      end_at: bufferEnd,
      block_type: 'buffer',
      duration_minutes: bufferMinutes,
    });

    currentHour += Math.ceil((focusDuration + bufferMinutes) / 60);
  }

  // Add mini blocks
  for (const mini of miniTasks) {
    const miniDuration = mini.duration_avg_minutes;
    const miniStart = new Date(today);
    miniStart.setHours(currentHour, 0, 0, 0);

    const miniEnd = new Date(miniStart);
    miniEnd.setMinutes(miniEnd.getMinutes() + miniDuration);

    blocks.push({
      start_at: miniStart,
      end_at: miniEnd,
      block_type: 'mini',
      task_id: mini.id,
      duration_minutes: miniDuration,
    });

    // Add buffer
    const bufferStart = new Date(miniEnd);
    const bufferEnd = new Date(bufferStart);
    bufferEnd.setMinutes(bufferEnd.getMinutes() + bufferMinutes);

    blocks.push({
      start_at: bufferStart,
      end_at: bufferEnd,
      block_type: 'buffer',
      duration_minutes: bufferMinutes,
    });

    currentHour += Math.ceil((miniDuration + bufferMinutes) / 60);
  }

  return blocks;
}

/**
 * Main scheduling function
 * Deterministic, rule-based, no randomness
 * Returns null if scheduling is impossible
 */
export function scheduleDay(
  tasks: Task[],
  today: Date = new Date(),
  config: SchedulingConfig = DEFAULT_CONFIG
): PlanningResponse | null {
  const startTime = Date.now();

  // Step 1: Prepare and sort tasks
  const preparedTasks = prepareTasks(tasks);

  if (preparedTasks.length === 0) {
    // No tasks to schedule
    return {
      date: today.toISOString().split('T')[0],
      timezone: config.timezone,
      focus_task_id: undefined,
      mini_task_ids: [],
      suggested_blocks: [],
      reasoning_brief: 'Keine offenen Aufgaben für heute.',
      confidence: 1.0,
      metadata: {
        processing_time_ms: Date.now() - startTime,
        algorithm_version: '1.0-deterministic',
      },
    };
  }

  // Step 2: Select focus task
  const focusTask = selectFocusTask(preparedTasks);

  // Step 3: Select mini tasks
  const miniTasks = selectMiniTasks(preparedTasks, focusTask?.id);

  // Step 4: Check if plan fits in working hours
  const totalMinutes = calculateTotalMinutes(focusTask, miniTasks, config.bufferMinutes);
  const availableMinutes = getAvailableMinutes(config);

  let reasoning = '';
  let confidence = 0.9;

  if (totalMinutes > availableMinutes) {
    // Conflict resolution: reduce puffer -> remove mini -> plan B
    if (config.bufferMinutes > 10) {
      // Try with smaller buffer
      config.bufferMinutes = 10;
      const retryMinutes = calculateTotalMinutes(focusTask, miniTasks, config.bufferMinutes);
      if (retryMinutes > availableMinutes) {
        // Remove one mini
        miniTasks.pop();
        confidence = 0.7;
        reasoning = 'Ein Mini-Task entfernt, um in Arbeitszeit zu passen.';
      }
    }

    if (miniTasks.length > 1) {
      // Try with one mini
      const oneMinuteMinutes = calculateTotalMinutes(focusTask, [miniTasks[0]], config.bufferMinutes);
      if (oneMinuteMinutes > availableMinutes) {
        miniTasks.length = 0;
        confidence = 0.6;
        reasoning = 'Alle Mini-Tasks entfernt, um Fokus-Task zu planen.';
      }
    }

    // If still doesn't fit and we have focus, reduce focus to 60min
    if (focusTask && miniTasks.length === 0) {
      const focusMinutes = 60 + config.bufferMinutes;
      if (focusMinutes <= availableMinutes) {
        // Reduce focus duration for display
        confidence = 0.5;
        reasoning = 'Fokus-Zeit auf 60min reduziert.';
      } else {
        // Can't fit anything
        return {
          date: today.toISOString().split('T')[0],
          timezone: config.timezone,
          focus_task_id: undefined,
          mini_task_ids: [],
          suggested_blocks: [],
          reasoning_brief: 'Heute kein Platz für neue Tasks. Morgen planen?',
          confidence: 0.2,
          metadata: {
            processing_time_ms: Date.now() - startTime,
            algorithm_version: '1.0-deterministic',
          },
        };
      }
    }
  }

  // Step 5: Generate time blocks
  const blocks = buildTimeBlocks(today, focusTask ?? null, miniTasks, config.bufferMinutes, config);

  if (!reasoning) {
    if (focusTask && miniTasks.length === 2) {
      reasoning = `1 Fokus-Task + 2 Mini-Tasks für heute geplant.`;
    } else if (focusTask && miniTasks.length === 1) {
      reasoning = `1 Fokus-Task + 1 Mini-Task für heute geplant.`;
    } else if (focusTask) {
      reasoning = `1 Fokus-Task für heute geplant.`;
    } else if (miniTasks.length > 0) {
      reasoning = `${miniTasks.length} Mini-Tasks für heute geplant.`;
    }
  }

  return {
    date: today.toISOString().split('T')[0],
    timezone: config.timezone,
    focus_task_id: focusTask?.id,
    mini_task_ids: miniTasks.map((m) => m.id),
    suggested_blocks: blocks,
    reasoning_brief: reasoning,
    confidence,
    metadata: {
      processing_time_ms: Date.now() - startTime,
      algorithm_version: '1.0-deterministic',
    },
  };
}

/**
 * Get scheduling configuration from user settings
 * For now, returns defaults
 */
export function getDefaultSchedulingConfig(): SchedulingConfig {
  return { ...DEFAULT_CONFIG };
}
