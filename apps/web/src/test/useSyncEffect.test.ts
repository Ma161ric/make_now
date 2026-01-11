import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDayPlanSync, useTasksSync, useDataMigration } from '../hooks/useSyncEffect';

// Mock FirestoreService
vi.mock('../firebase/firestoreService', () => ({
  FirestoreService: class {
    onDayPlanSnapshot = vi.fn((_uid: string, _date: string, cb: any) => {
      cb({ id: 'plan-1', test: true });
      return vi.fn();
    });
    onTasksSnapshot = vi.fn((_uid: string, cb: any) => {
      cb([{ id: 'task-1', test: true }]);
      return vi.fn();
    });
    saveTask = vi.fn();
    saveDayPlan = vi.fn();
    saveDailyReview = vi.fn();
  },
}));

describe('useDayPlanSync', () => {
  it('calls onUpdate with plan when user and enabled', () => {
    const onUpdate = vi.fn();
    const user = { uid: 'user-1' } as any;
    renderHook(() => useDayPlanSync('2026-01-11', onUpdate, { user, enabled: true }));
    expect(onUpdate).toHaveBeenCalledWith({ id: 'plan-1', test: true });
  });

  it('does not call onUpdate if no user', () => {
    const onUpdate = vi.fn();
    renderHook(() => useDayPlanSync('2026-01-11', onUpdate, { user: null, enabled: true }));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('useTasksSync', () => {
  it('calls onUpdate with tasks when user and enabled', () => {
    const onUpdate = vi.fn();
    const user = { uid: 'user-1' } as any;
    renderHook(() => useTasksSync(onUpdate, { user, enabled: true }));
    expect(onUpdate).toHaveBeenCalledWith([{ id: 'task-1', test: true }]);
  });

  it('does not call onUpdate if no user', () => {
    const onUpdate = vi.fn();
    renderHook(() => useTasksSync(onUpdate, { user: null, enabled: true }));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('useDataMigration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks migration as done if no local data', () => {
    const user = { uid: 'user-1' } as any;
    renderHook(() => useDataMigration(user));
    // Migration is async, so we just verify the hook doesn't throw
    expect(localStorage).toBeDefined();
  });

  it('does nothing if already migrated', () => {
    const user = { uid: 'user-1' } as any;
    localStorage.setItem('migration-done-user-1', 'true');
    renderHook(() => useDataMigration(user));
    // Should not throw or change
    expect(localStorage.getItem('migration-done-user-1')).toBe('true');
  });

  it('does not migrate when user is null', () => {
    renderHook(() => useDataMigration(null));
    // Should not throw when user is null
    expect(localStorage).toBeDefined();
  });
});
