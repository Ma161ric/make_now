import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestRouter } from './TestRouter';
import DailyReviewScreen from '../screens/DailyReviewScreen';
import * as storage from '../storage';
import { Task, PlanningResponse } from '@make-now/core';

const testUserId = 'test-user-123';
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../auth/authContext', () => ({
  useAuth: () => ({
    user: { id: testUserId, email: 'test@example.com', displayName: 'Test User' },
    firebaseUser: null,
    loading: false,
    error: null,
    isAuthenticated: true,
  }),
}));

describe('DailyReviewScreen', () => {
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
  });

  it('should show message when no confirmed plan exists', () => {
    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    expect(screen.getByText('Kein bestätigter Plan für heute vorhanden.')).toBeInTheDocument();
  });

  it('should show existing review if already completed', () => {
    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        scheduling_notes: 'Test plan',
      },
    };

    const review: storage.DailyReviewData = {
      id: 'review-1',
      date: today,
      day_plan_id: 'plan-1',
      completed_at: new Date().toISOString(),
      tasks_done: 3,
      tasks_total: 5,
      reflection_note: 'Good day',
      mood: 'good',
    };

    storage.saveDayPlan(testUserId, dayPlan);
    storage.saveDailyReview(testUserId, review);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    expect(screen.getByText('Review für heute bereits abgeschlossen.')).toBeInTheDocument();
    expect(screen.getByText(/Erledigte Tasks: 3 von 5/)).toBeInTheDocument();
    expect(screen.getByText('Good day')).toBeInTheDocument();
  });

  it('should display all tasks from the plan', () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Focus Task',
      status: 'scheduled',
      duration_minutes: 90,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task2: Task = {
      id: 'task-2',
      title: 'Mini Task 1',
      status: 'scheduled',
      duration_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(testUserId, task1);
    storage.saveTask(testUserId, task2);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2'],
        scheduling_notes: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    expect(screen.getByText('Focus Task')).toBeInTheDocument();
    expect(screen.getByText('Mini Task 1')).toBeInTheDocument();
  });

  it('should allow marking tasks as done, postpone, or keep-open', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(testUserId, task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        scheduling_notes: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    const doneButton = screen.getByRole('button', { name: /Erledigt/ });
    const postponeButton = screen.getByRole('button', { name: /Morgen/ });
    const openButton = screen.getByRole('button', { name: /Offen/ });

    expect(doneButton).toBeInTheDocument();
    expect(postponeButton).toBeInTheDocument();
    expect(openButton).toBeInTheDocument();

    fireEvent.click(doneButton);
    expect(doneButton).toHaveClass('button');
    expect(doneButton).not.toHaveClass('secondary');
  });

  it('should disable complete button when not all tasks are reviewed', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(testUserId, task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        scheduling_notes: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    const completeButton = screen.getByRole('button', { name: /Tag abschließen/ });
    expect(completeButton).toBeDisabled();
  });

  it('should save review and update task statuses when completing', async () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Task Done',
      status: 'scheduled',
      duration_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const task2: Task = {
      id: 'task-2',
      title: 'Task Postponed',
      status: 'scheduled',
      duration_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(testUserId, task1);
    storage.saveTask(testUserId, task2);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2'],
        scheduling_notes: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    // Mark task 1 as done
    const doneButtons = screen.getAllByRole('button', { name: /Erledigt/ });
    fireEvent.click(doneButtons[0]);

    // Mark task 2 as postpone
    const postponeButtons = screen.getAllByRole('button', { name: /Morgen/ });
    fireEvent.click(postponeButtons[1]);

    // Complete the review
    const completeButton = screen.getByRole('button', { name: /Tag abschließen/ });
    fireEvent.click(completeButton);

    await waitFor(() => {
      // Check task statuses
      const updatedTask1 = storage.getTask(testUserId, 'task-1');
      expect(updatedTask1?.status).toBe('done');

      const updatedTask2 = storage.getTask(testUserId, 'task-2');
      expect(updatedTask2?.status).toBe('scheduled');

      // Check plan status
      const updatedPlan = storage.getDayPlan(testUserId, today);
      expect(updatedPlan?.status).toBe('completed');

      // Check review was saved
      const review = storage.getDailyReview(testUserId, today);
      expect(review).toBeDefined();
      expect(review?.tasks_done).toBe(1);
      expect(review?.tasks_total).toBe(2);

      // Should navigate home
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should save optional reflection and mood', async () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(testUserId, task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        scheduling_notes: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    // Mark task as done
    const doneButton = screen.getByRole('button', { name: /Erledigt/ });
    fireEvent.click(doneButton);

    // Enter reflection
    const textarea = screen.getByPlaceholderText('Was lief gut? Was nicht?');
    fireEvent.change(textarea, { target: { value: 'Great day!' } });

    // Select mood
    const moodButtons = screen.getAllByRole('button');
    const greatButton = moodButtons.find(btn => btn.textContent?.includes('😊'));
    fireEvent.click(greatButton!);

    // Complete the review
    const completeButton = screen.getByRole('button', { name: /Tag abschließen/ });
    fireEvent.click(completeButton);

    await waitFor(() => {
      const review = storage.getDailyReview(testUserId, today);
      expect(review?.reflection_note).toBe('Great day!');
      expect(review?.mood).toBe('great');
    });
  });

  it('should show motivation text based on completion percentage', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Task 1',
        status: 'scheduled',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'task-2',
        title: 'Task 2',
        status: 'scheduled',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'task-3',
        title: 'Task 3',
        status: 'scheduled',
        duration_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    tasks.forEach(t => storage.saveTask(testUserId, t));

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: ['task-2', 'task-3'],
        scheduling_notes: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    // Mark all as done
    const doneButtons = screen.getAllByRole('button', { name: /Erledigt/ });
    doneButtons.forEach(btn => fireEvent.click(btn));

    expect(screen.getByText('Perfekt! Alles geschafft! 🏆')).toBeInTheDocument();
    expect(screen.getByText('3 von 3 Aufgaben erledigt')).toBeInTheDocument();
  });

  it('should allow navigating back without completing', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test Task',
      status: 'scheduled',
      duration_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    storage.saveTask(testUserId, task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        scheduling_notes: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    const laterButton = screen.getByRole('button', { name: /Später/ });
    fireEvent.click(laterButton);

    expect(mockNavigate).toHaveBeenCalledWith('/today');
  });

  it('should display energy level buttons', () => {
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

    storage.saveTask(testUserId, task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        reasoning_brief: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    const happyButton = screen.getByRole('button', { name: '😊' });
    const sadButton = screen.getByRole('button', { name: '😔' });
    expect(happyButton).toBeInTheDocument();
    expect(sadButton).toBeInTheDocument();
  });

  it('should handle task completion tracking', () => {
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

    storage.saveTask(testUserId, task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        reasoning_brief: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should allow review input', async () => {
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

    storage.saveTask(testUserId, task);

    const dayPlan: storage.DayPlanState = {
      id: 'plan-1',
      date: today,
      status: 'confirmed',
      replan_count: 0,
      plan: {
        focus_task_id: 'task-1',
        mini_task_ids: [],
        reasoning_brief: 'Test plan',
      },
    };

    storage.saveDayPlan(testUserId, dayPlan);

    render(
      <TestRouter>
        <DailyReviewScreen />
      </TestRouter>
    );

    const textarea = screen.getByPlaceholderText(/Was lief gut/i);
    fireEvent.change(textarea, { target: { value: 'Today I learned...' } });
    expect(textarea).toHaveValue('Today I learned...');
  });
});
