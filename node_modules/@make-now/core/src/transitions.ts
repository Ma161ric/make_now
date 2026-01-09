/**
 * State Transition Logic
 * Based on /spec/30_models/states_and_transitions.md
 * Enforces valid state transitions and prevents invalid ones
 */

import type {
  Task,
  TaskStatus,
  Event,
  EventStatus,
  Idea,
  IdeaStatus,
  InboxNote,
  InboxNoteStatus,
} from './models';
import { StateTransitionError } from './models';

/**
 * Valid Task state transitions
 * Based on state diagram in spec
 */
const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ['scheduled', 'done', 'cancelled'],
  scheduled: ['open', 'in_progress', 'done', 'cancelled'],
  in_progress: ['done', 'cancelled'],
  done: [], // Terminal state
  cancelled: [], // Terminal state
};

/**
 * Valid Event state transitions
 */
const VALID_EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  tentative: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [], // Terminal state
};

/**
 * Valid Idea state transitions
 */
const VALID_IDEA_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  active: ['archived', 'converted'],
  archived: [], // Not restorable per spec
  converted: [], // Terminal state
};

/**
 * Valid InboxNote state transitions
 */
const VALID_INBOXNOTE_TRANSITIONS: Record<InboxNoteStatus, InboxNoteStatus[]> = {
  unprocessed: ['processed', 'failed'],
  processed: [], // Terminal for now
  failed: [], // Terminal for now
};

/**
 * Transition a task to a new status with validation
 */
export function transitionTaskStatus(task: Task, newStatus: TaskStatus): Task {
  const validNextStates = VALID_TASK_TRANSITIONS[task.status];

  if (!validNextStates.includes(newStatus)) {
    throw new StateTransitionError(
      task.status,
      newStatus,
      `Task cannot transition from '${task.status}' to '${newStatus}'`
    );
  }

  const updatedTask = { ...task, status: newStatus, updated_at: new Date() };

  // Side effects per spec
  if (newStatus === 'done') {
    updatedTask.completed_at = new Date();
  }

  if (newStatus === 'open') {
    updatedTask.day_plan_id = undefined;
  }

  if (newStatus === 'scheduled') {
    // day_plan_id should be set by caller
  }

  return updatedTask;
}

/**
 * Transition an event to a new status with validation
 */
export function transitionEventStatus(event: Event, newStatus: EventStatus): Event {
  const validNextStates = VALID_EVENT_TRANSITIONS[event.status];

  if (!validNextStates.includes(newStatus)) {
    throw new StateTransitionError(
      event.status,
      newStatus,
      `Event cannot transition from '${event.status}' to '${newStatus}'`
    );
  }

  return { ...event, status: newStatus, updated_at: new Date() };
}

/**
 * Transition an idea to a new status with validation
 */
export function transitionIdeaStatus(idea: Idea, newStatus: IdeaStatus): Idea {
  const validNextStates = VALID_IDEA_TRANSITIONS[idea.status];

  if (!validNextStates.includes(newStatus)) {
    throw new StateTransitionError(
      idea.status,
      newStatus,
      `Idea cannot transition from '${idea.status}' to '${newStatus}'`
    );
  }

  const updatedIdea = { ...idea, status: newStatus, updated_at: new Date() };

  if (newStatus === 'archived') {
    updatedIdea.archived_at = new Date();
  }

  return updatedIdea;
}

/**
 * Transition an inbox note to a new status with validation
 */
export function transitionInboxNoteStatus(
  note: InboxNote,
  newStatus: InboxNoteStatus,
  errorMessage?: string
): InboxNote {
  const validNextStates = VALID_INBOXNOTE_TRANSITIONS[note.status];

  if (!validNextStates.includes(newStatus)) {
    throw new StateTransitionError(
      note.status,
      newStatus,
      `InboxNote cannot transition from '${note.status}' to '${newStatus}'`
    );
  }

  const updated = { ...note, status: newStatus, updated_at: new Date() };
  if (errorMessage) {
    updated.error_message = errorMessage;
  }
  return updated;
}
