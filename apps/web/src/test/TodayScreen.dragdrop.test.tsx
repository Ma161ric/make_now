import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestRouter } from './TestRouter';
import { ThemeProvider } from '../ThemeContext';
import TodayScreen from '../screens/TodayScreen';
import * as storage from '../storage';
import { Task } from '@make-now/core';
import { arrayMove } from '@dnd-kit/sortable';

// Mock DnD libraries
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => (
    <div data-testid="dnd-context" data-ondragend={onDragEnd ? 'true' : 'false'}>
      {children}
    </div>
  ),
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
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: { 'data-testid': 'sortable-item' },
    listeners: { onPointerDown: vi.fn(), onKeyDown: vi.fn() },
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

// Mock core scheduling
vi.mock('@make-now/core', async () => {
  const actual = await vi.importActual('@make-now/core');
  return {
    ...actual,
    scheduleDay: vi.fn((tasks) => ({
      focus_task_id: tasks[0]?.id,
      mini_task_ids: tasks.slice(1, 3).map((t: Task) => t.id),
      suggested_blocks: [],
      reasoning_brief: 'Generated plan',
    })),
    validatePlanning: vi.fn(() => ({ valid: true })),
  };
});

describe('TodayScreen - Drag and Drop', () => {
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    localStorage.clear();
  });

  it('should render DndContext wrapper', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_minutes: 90,
      duration_min_minutes: 60,
      duration_max_minutes: 120,
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
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
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

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
  });

  it('should display drag handles for tasks', () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Focus Task',
      status: 'scheduled',
      duration_minutes: 90,
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task2: Task = {
      id: 'task-2',
      title: 'Mini Task',
      status: 'scheduled',
      duration_minutes: 20,
      duration_min_minutes: 15,
      duration_max_minutes: 25,
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
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2'],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
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

    // Check for drag handle indicators
    const handles = screen.getAllByText('⋮⋮');
    expect(handles.length).toBeGreaterThan(0);
  });

  it('should correctly reorder tasks with arrayMove helper', () => {
    const taskIds = ['task-1', 'task-2', 'task-3'];
    
    // Move task from index 0 to index 2
    const reordered = arrayMove(taskIds, 0, 2);
    expect(reordered).toEqual(['task-2', 'task-3', 'task-1']);

    // Move task from index 2 to index 0
    const reordered2 = arrayMove(taskIds, 2, 0);
    expect(reordered2).toEqual(['task-3', 'task-1', 'task-2']);
  });

  it('should maintain focus task and mini tasks distinction', () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Original Focus',
      status: 'scheduled',
      duration_minutes: 90,
      duration_min_minutes: 60,
      duration_max_minutes: 120,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task2: Task = {
      id: 'task-2',
      title: 'Mini 1',
      status: 'scheduled',
      duration_minutes: 20,
      duration_min_minutes: 15,
      duration_max_minutes: 25,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task3: Task = {
      id: 'task-3',
      title: 'Mini 2',
      status: 'scheduled',
      duration_minutes: 20,
      duration_min_minutes: 15,
      duration_max_minutes: 25,
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
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2', 'task-3'],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
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

    // Focus task should have FOKUS badge
    expect(screen.getByText('🎯 FOKUS')).toBeInTheDocument();
    expect(screen.getByText('Original Focus')).toBeInTheDocument();

    // Mini tasks should be in list
    expect(screen.getByText(/Mini 1/)).toBeInTheDocument();
    expect(screen.getByText(/Mini 2/)).toBeInTheDocument();
  });

  it('should display focus task with special styling', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Focus Task',
      status: 'scheduled',
      duration_minutes: 90,
      duration_min_minutes: 60,
      duration_max_minutes: 120,
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
        focus_task_id: 'task-1',
        mini_task_ids: [],
        suggested_blocks: [],
        reasoning_brief: 'Test plan',
      },
    };

    storage.saveDayPlan(dayPlan);

    const { container } = render(
      <TestRouter>
        <ThemeProvider>
          <TodayScreen />
        </ThemeProvider>
      </TestRouter>
    );

    // Focus task should have special data attribute
    const focusCard = container.querySelector('[data-focus-task]');
    expect(focusCard).toBeInTheDocument();
  });
});
