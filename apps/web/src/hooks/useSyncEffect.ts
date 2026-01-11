import { useEffect } from 'react';
import { User } from 'firebase/auth';
import { FirestoreService } from '../firebase/firestoreService';
import { DayPlanState } from '../storage';

const firestoreService = new FirestoreService();

interface UseSyncEffectOptions {
  user: User | null;
  enabled?: boolean;
}

// Hook for real-time syncing day plans
export function useDayPlanSync(date: string, onUpdate: (plan: DayPlanState | null) => void, options: UseSyncEffectOptions) {
  const { user, enabled = true } = options;

  useEffect(() => {
    if (!user || !enabled) return;

    // Set up real-time listener
    const unsubscribe = firestoreService.onDayPlanSnapshot(user.uid, date, (plan) => {
      onUpdate(plan);
    });

    return () => {
      unsubscribe();
    };
  }, [user, date, enabled, onUpdate]);
}

// Hook for real-time syncing tasks
export function useTasksSync(onUpdate: (tasks: any[]) => void, options: UseSyncEffectOptions) {
  const { user, enabled = true } = options;

  useEffect(() => {
    if (!user || !enabled) return;

    // Set up real-time listener for tasks
    const unsubscribe = firestoreService.onTasksSnapshot(user.uid, (tasks) => {
      onUpdate(tasks);
    });

    return () => {
      unsubscribe();
    };
  }, [user, enabled, onUpdate]);
}

// Hook for one-time data migration from localStorage to Firestore
export function useDataMigration(user: User | null) {
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const migrationKey = `migration-done-${user.uid}`;
    const alreadyMigrated = localStorage.getItem(migrationKey);

    if (alreadyMigrated) return;

    // Migrate local data to Firestore
    const migrateData = async () => {
      try {
        const localState = localStorage.getItem('make-now-state');
        if (!localState) {
          // No local data to migrate
          if (isMounted) {
            localStorage.setItem(migrationKey, 'true');
          }
          return;
        }

        const state = JSON.parse(localState);
        
        // Migrate tasks
        if (state.tasks) {
          for (const task of Object.values(state.tasks)) {
            await firestoreService.saveTask(user.uid, task as any);
          }
        }

        // Migrate day plans
        if (state.dayPlans) {
          for (const [date, dayPlan] of Object.entries(state.dayPlans)) {
            await firestoreService.saveDayPlan(user.uid, date, dayPlan as any);
          }
        }

        // Migrate daily reviews
        if (state.dailyReviews) {
          for (const review of Object.values(state.dailyReviews)) {
            await firestoreService.saveDailyReview(user.uid, review as any);
          }
        }

        // Mark migration as complete (only if component still mounted)
        if (isMounted) {
          localStorage.setItem(migrationKey, 'true');
          console.log('Data migration completed successfully');
        }
      } catch (error) {
        if (isMounted) {
          console.error('Data migration failed:', error);
        }
      }
    };

    migrateData();

    // Cleanup: mark component as unmounted
    return () => {
      isMounted = false;
    };
  }, [user]);
}
