/**
 * Test: State Transitions
 * Validates that state transitions follow the rules from /spec/30_models/states_and_transitions.md
 */

import { describe, it, expect } from 'vitest';
import type { Task, Event, Idea } from '../src/models';
import {
  transitionTaskStatus,
  transitionEventStatus,
  transitionIdeaStatus,
} from '../src/transitions';
import { StateTransitionError } from '../src/models';

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'open',
    created_at: new Date(),
    updated_at: new Date(),
    estimation_source: 'default',
    importance: 'medium',
    ...overrides,
  };
}

function createTestEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    title: 'Test Event',
    status: 'tentative',
    created_at: new Date(),
    updated_at: new Date(),
    timezone: 'Europe/Berlin',
    all_day: false,
    ...overrides,
  };
}

function createTestIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea-1',
    title: 'Test Idea',
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('Task State Transitions', () => {
  it('should transition from open to scheduled', () => {
    const task = createTestTask();
    const updated = transitionTaskStatus(task, 'scheduled');
    expect(updated.status).toBe('scheduled');
    expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(task.updated_at.getTime());
  });

  it('should transition from open to done', () => {
    const task = createTestTask();
    const updated = transitionTaskStatus(task, 'done');
    expect(updated.status).toBe('done');
    expect(updated.completed_at).toBeDefined();
  });

  it('should transition from scheduled to in_progress', () => {
    const task = createTestTask({ status: 'scheduled' });
    const updated = transitionTaskStatus(task, 'in_progress');
    expect(updated.status).toBe('in_progress');
  });

  it('should transition from scheduled back to open', () => {
    const task = createTestTask({ status: 'scheduled', day_plan_id: 'plan-1' });
    const updated = transitionTaskStatus(task, 'open');
    expect(updated.status).toBe('open');
    expect(updated.day_plan_id).toBeUndefined();
  });

  it('should reject transition from done to any other state', () => {
    const task = createTestTask({ status: 'done' });
    expect(() => transitionTaskStatus(task, 'open')).toThrow(StateTransitionError);
    expect(() => transitionTaskStatus(task, 'scheduled')).toThrow(StateTransitionError);
  });

  it('should reject invalid transition from open to in_progress', () => {
    const task = createTestTask();
    expect(() => transitionTaskStatus(task, 'in_progress')).toThrow(StateTransitionError);
  });

  it('should reject transition from cancelled to other states', () => {
    const task = createTestTask({ status: 'cancelled' });
    expect(() => transitionTaskStatus(task, 'open')).toThrow(StateTransitionError);
  });
});

describe('Event State Transitions', () => {
  it('should transition from tentative to confirmed', () => {
    const event = createTestEvent();
    const updated = transitionEventStatus(event, 'confirmed');
    expect(updated.status).toBe('confirmed');
  });

  it('should transition from tentative to cancelled', () => {
    const event = createTestEvent();
    const updated = transitionEventStatus(event, 'cancelled');
    expect(updated.status).toBe('cancelled');
  });

  it('should transition from confirmed to cancelled', () => {
    const event = createTestEvent({ status: 'confirmed' });
    const updated = transitionEventStatus(event, 'cancelled');
    expect(updated.status).toBe('cancelled');
  });

  it('should reject transition from confirmed back to tentative', () => {
    const event = createTestEvent({ status: 'confirmed' });
    expect(() => transitionEventStatus(event, 'tentative')).toThrow(StateTransitionError);
  });

  it('should reject transition from cancelled to other states', () => {
    const event = createTestEvent({ status: 'cancelled' });
    expect(() => transitionEventStatus(event, 'confirmed')).toThrow(StateTransitionError);
  });
});

describe('Idea State Transitions', () => {
  it('should transition from active to archived', () => {
    const idea = createTestIdea();
    const updated = transitionIdeaStatus(idea, 'archived');
    expect(updated.status).toBe('archived');
    expect(updated.archived_at).toBeDefined();
  });

  it('should transition from active to converted', () => {
    const idea = createTestIdea();
    const updated = transitionIdeaStatus(idea, 'converted');
    expect(updated.status).toBe('converted');
  });

  it('should reject transition from archived to active', () => {
    const idea = createTestIdea({ status: 'archived' });
    expect(() => transitionIdeaStatus(idea, 'active')).toThrow(StateTransitionError);
  });

  it('should reject transition from converted to other states', () => {
    const idea = createTestIdea({ status: 'converted' });
    expect(() => transitionIdeaStatus(idea, 'active')).toThrow(StateTransitionError);
  });
});

describe('Idempotent Transitions', () => {
  it('should return unchanged task if already in target status', () => {
    const task = createTestTask({ status: 'done' });
    const updated = transitionTaskStatus(task, 'done');
    expect(updated).toBe(task); // Same object reference
    expect(updated.status).toBe('done');
  });

  it('should return unchanged event if already in target status', () => {
    const event = createTestEvent({ status: 'confirmed' });
    const updated = transitionEventStatus(event, 'confirmed');
    expect(updated).toBe(event); // Same object reference
    expect(updated.status).toBe('confirmed');
  });

  it('should return unchanged idea if already in target status', () => {
    const idea = createTestIdea({ status: 'archived' });
    const updated = transitionIdeaStatus(idea, 'archived');
    expect(updated).toBe(idea); // Same object reference
    expect(updated.status).toBe('archived');
  });
});
