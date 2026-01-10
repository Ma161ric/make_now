import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestRouter } from './TestRouter';
import TodayScreen from '../screens/TodayScreen';
import { ThemeProvider } from '../ThemeContext';
import * as storage from '../storage';
import { Task, ExtractedItem } from '@make-now/core';

// Mock @dnd-kit modules
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (arr: any[], oldIndex: number, newIndex: number) => {
    const newArr = [...arr];
    const [removed] = newArr.splice(oldIndex, 1);
    newArr.splice(newIndex, 0, removed);
    return newArr;
  },
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

// Mock scheduleDay and validatePlanning
vi.mock('@make-now/core', async () => {
  const actual = await vi.importActual('@make-now/core');
  return {
    ...actual,
    scheduleDay: vi.fn((tasks) => ({
      focus_task_id: tasks[0]?.id,
      mini_task_ids: tasks.slice(1, 3).map((t: Task) => t.id),
      suggested_blocks: [
        {
          block_type: 'focus',
          start_at: new Date('2026-01-09T09:00:00Z').toISOString(),
          end_at: new Date('2026-01-09T10:30:00Z').toISOString(),
          duration_minutes: 90,
          task_id: tasks[0]?.id,
        },
      ],
      reasoning_brief: 'Generated plan',
    })),
    validatePlanning: vi.fn(() => ({ valid: true })),
  };
});

describe('TodayScreen', () => {
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    localStorage.clear();
  });

  it('should generate initial plan when no plan exists', async () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'open',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });

  it('should display existing plan when one exists', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Focus Task',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'suggested',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [
          {
            block_type: 'focus',
            start_at: new Date('2026-01-09T09:00:00Z').toISOString(),
            end_at: new Date('2026-01-09T10:30:00Z').toISOString(),
            duration_minutes: 90,
            task_id: 'task-1',
          },
        ],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    expect(screen.getByText('Focus Task')).toBeInTheDocument();
    expect(screen.getByText(/ca\. 60-120 Min/)).toBeInTheDocument();
  });

  it('should confirm plan and set tasks to scheduled', async () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Focus Task',
      status: 'open',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task2: Task = {
      id: 'task-2',
      title: 'Mini Task',
      status: 'open',
      duration_min_minutes: 20,
      duration_max_minutes: 40,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task1);
    storage.saveTask(task2);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'suggested',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2'],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    const confirmButton = screen.getByRole('button', { name: /Plan bestätigen/ });
    fireEvent.click(confirmButton);

    // Wait for async confirm to complete and tasks to update
    await waitFor(() => {
      expect(storage.getTask('task-1')?.status).toBe('scheduled');
      expect(storage.getTask('task-2')?.status).toBe('scheduled');
      expect(storage.getDayPlan(today)?.status).toBe('confirmed');
    });
  });

  it('should show Plan B button when plan is confirmed', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    expect(screen.getByRole('button', { name: /Plan B/ })).toBeInTheDocument();
  });

  it('should open replan dialog when Plan B is clicked', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    const planBButton = screen.getByRole('button', { name: /Plan B/ });
    fireEvent.click(planBButton);

    expect(screen.getByText('Neu planen?')).toBeInTheDocument();
    expect(screen.getByText('Replan 1 von 3')).toBeInTheDocument();
  });

  it('should create new plan when replan option is selected', async () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Original Focus',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task2: Task = {
      id: 'task-2',
      title: 'Alternative Focus',
      status: 'open',
      duration_min_minutes: 45,
      duration_max_minutes: 75,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task1);
    storage.saveTask(task2);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Original plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    // Open replan dialog
    const planBButton = screen.getByRole('button', { name: /Plan B/ });
    fireEvent.click(planBButton);

    // Select replan option
    const otherFocusButton = screen.getByRole('button', { name: /Andere Fokus-Aufgabe/ });
    fireEvent.click(otherFocusButton);

    await waitFor(() => {
      // Check old plan is marked as replanned
      const oldPlan = storage.getDayPlan(today);
      expect(oldPlan?.replan_count).toBe(1);
    });
  });

  it('should enforce max 3 replans per day', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 3,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    // Plan B button should not be shown
    expect(screen.queryByRole('button', { name: /Plan B/ })).not.toBeInTheDocument();
  });

  it('should show daily review link when plan is confirmed', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    const reviewLink = screen.getByRole('link', { name: /Tag abschließen/ });
    expect(reviewLink).toBeInTheDocument();
    expect(reviewLink).toHaveAttribute('href', '/daily-review');
  });

  it('should display time blocks from plan', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'suggested',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [
          {
            block_type: 'focus',
            start_at: '2026-01-09T09:00:00Z',
            end_at: '2026-01-09T10:30:00Z',
            duration_minutes: 90,
            task_id: 'task-1',
          },
          {
            block_type: 'mini',
            start_at: '2026-01-09T14:00:00Z',
            end_at: '2026-01-09T14:30:00Z',
            duration_minutes: 30,
          },
        ],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <TodayScreen />
      </TestRouter>
    );

    expect(screen.getByText('FOCUS')).toBeInTheDocument();
    expect(screen.getByText('MINI')).toBeInTheDocument();
  });

  it('should display mini tasks list', () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Focus Task',
      status: 'scheduled',
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task2: Task = {
      id: 'task-2',
      title: 'Mini Task 1',
      status: 'scheduled',
      duration_min_minutes: 20,
      duration_max_minutes: 40,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task3: Task = {
      id: 'task-3',
      title: 'Mini Task 2',
      status: 'scheduled',
      duration_min_minutes: 10,
      duration_max_minutes: 20,
      estimation_source: 'parsed',
      importance: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(task1);
    storage.saveTask(task2);
    storage.saveTask(task3);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'suggested',
      replan_count: 0,
      plan: {
        date: today,
        timezone: 'Europe/Berlin',
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2', 'task-3'],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
        confidence: 0.8,
        metadata: { processing_time_ms: 100 },
      },
    };

    storage.saveDayPlan(dayPlan);

    render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    expect(screen.getByText(/Mini Task 1/)).toBeInTheDocument();
    expect(screen.getByText(/Mini Task 2/)).toBeInTheDocument();
  });
});

