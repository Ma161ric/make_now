import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { scheduleDay, validatePlanning, PlanningResponse, Task } from '@make-now/core';
import { listAllReviewedItems, getDayPlan, saveDayPlan, saveTask, listTasks, getTask } from '../storage';
import { formatDate, uuid } from '../utils';
import { useAuth } from '../auth/authContext';
import { useDayPlanSync, useDataMigration } from '../hooks/useSyncEffect';
import { SyncStatus } from '../components/SyncStatus';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableTaskItem({ task, type }: { task: Task; type: 'focus' | 'mini' }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  if (type === 'focus') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="card"
        data-focus-task
      >
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="badge">🎯 FOKUS</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{task.title}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              ca. {task.duration_min_minutes}-{task.duration_max_minutes} Min
            </div>
          </div>
          <div className="muted" style={{ fontSize: 20 }}>⋮⋮</div>
        </div>
      </div>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="list-item"
    >
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <div>
          <div>⚡ {task.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            ca. {task.duration_min_minutes}-{task.duration_max_minutes} Min
          </div>
        </div>
        <div className="muted" style={{ fontSize: 20 }}>⋮⋮</div>
      </div>
    </li>
  );
}

function mapToTasks(items: ReturnType<typeof listAllReviewedItems>): Task[] {
  const now = new Date();
  return items
    .filter((i) => i.type === 'task')
    .map((item) => {
      const fields = item.parsed_fields as any;
      const id = item.id || uuid(); // Use item.id if exists, otherwise generate new UUID
      
      return {
        id,
        title: item.title,
        status: 'open' as const,
        created_at: now,
        updated_at: now,
        estimation_source: fields.estimation_source || 'default',
        duration_min_minutes: fields.duration_min_minutes || 15,
        duration_max_minutes: fields.duration_max_minutes || 30,
        importance: fields.importance || 'medium',
        energy_type: fields.energy_type || 'mixed',
        due_at: fields.due_at ? new Date(fields.due_at) : undefined,
      } as Task;
    });
}

export default function TodayScreen() {
  const today = formatDate(new Date());
  const { user, firebaseUser } = useAuth();
  const [syncing, setSyncing] = useState(false);
  
  // Get userId from user object (should always be available in this screen)
  const userId = user?.id || firebaseUser?.uid || '';
  
  const existingDayPlan = userId ? getDayPlan(userId, today) : undefined;
  
  const [dayPlanState, setDayPlanState] = useState<ReturnType<typeof getDayPlan>>(existingDayPlan);
  const [error, setError] = useState<string | null>(null);
  const [showReplanDialog, setShowReplanDialog] = useState(false);
  const [sortedTaskIds, setSortedTaskIds] = useState<string[]>([]);

  const items = useMemo(() => (userId ? listAllReviewedItems(userId) : []), [userId]);

  // Data migration on first login
  useDataMigration(firebaseUser);

  // Real-time sync for day plan
  const handlePlanUpdate = useCallback((plan: any) => {
    if (plan) {
      setDayPlanState(plan);
    }
  }, []);

  useDayPlanSync(today, handlePlanUpdate, { user: firebaseUser });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize sorted task IDs from plan
  useEffect(() => {
    if (dayPlanState?.plan) {
      const allIds = [
        ...(dayPlanState?.plan?.focus_task_id ? [dayPlanState.plan.focus_task_id] : []),
        ...(dayPlanState?.plan?.mini_task_ids || []),
      ];
      setSortedTaskIds(allIds);
    }
  }, [dayPlanState?.plan?.focus_task_id, dayPlanState?.plan?.mini_task_ids]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !dayPlanState) return;

    const oldIndex = sortedTaskIds.indexOf(active.id as string);
    const newIndex = sortedTaskIds.indexOf(over.id as string);

    const newTaskIds = arrayMove(sortedTaskIds, oldIndex, newIndex);
    setSortedTaskIds(newTaskIds);

    // Update plan with new order
    const newFocusTaskId = newTaskIds[0];
    const newMiniTaskIds = newTaskIds.slice(1);

    const updatedPlan = {
      ...dayPlanState,
      plan: {
        ...dayPlanState.plan,
        focus_task_id: newFocusTaskId || undefined,
        mini_task_ids: newMiniTaskIds,
      },
    };

    setDayPlanState(updatedPlan);
    setSyncing(true);
    try {
      await saveDayPlan(userId, updatedPlan, firebaseUser);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (dayPlanState || !userId) return;
    
    const initializePlan = async () => {
      // Create tasks from reviewed items if not already in storage
      const tasksToCreate = mapToTasks(items);
      for (const task of tasksToCreate) {
        if (!getTask(userId, task.id)) {
          await saveTask(userId, task, firebaseUser);
        }
      }

      // Generate initial plan
      const openTasks = listTasks(userId, t => t.status === 'open');
      if (openTasks.length === 0) {
        setError('Keine offenen Tasks verfügbar.');
        return;
      }
      
      const generated = scheduleDay(openTasks, new Date());
      if (!generated) {
        setError('Heute kein Platz für neue Tasks.');
        return;
      }
      const validation = validatePlanning(generated);
      if (!validation.valid) {
        setError('Plan ungültig laut Schema.');
        return;
      }
      
      const newDayPlan = {
        id: `plan-${today}-${Date.now()}`,
        date: today,
        status: 'suggested' as const,
        replan_count: 0,
        plan: generated,
      };
      
      setDayPlanState(newDayPlan);
    };
    
    initializePlan();
  }, [items, dayPlanState, today, userId, firebaseUser]);

  const handleConfirm = async () => {
    if (!dayPlanState) return;
    
    setSyncing(true);
    
    // Mark selected tasks as scheduled
    const allTaskIds = [
      ...(dayPlanState.plan.focus_task_id ? [dayPlanState.plan.focus_task_id] : []),
      ...dayPlanState.plan.mini_task_ids,
    ];
    
    for (const id of allTaskIds) {
      const task = getTask(userId, id);
      if (task && task.status === 'open') {
        await saveTask(userId, { ...task, status: 'scheduled', day_plan_id: dayPlanState.id }, firebaseUser);
      }
    }
    
    // Mark plan as confirmed
    const confirmedPlan = {
      ...dayPlanState,
      status: 'confirmed' as const,
      confirmed_at: new Date().toISOString(),
    };
    await saveDayPlan(userId, confirmedPlan, firebaseUser);
    setDayPlanState(confirmedPlan);
    setError(null);
    setSyncing(false);
  };

  const handleReplan = async (option: 'other_focus' | 'mini_only' | 'less_time' | 'manual') => {
    if (!dayPlanState || dayPlanState.replan_count >= 3) {
      setError('Max 3 Replans pro Tag erreicht.');
      return;
    }

    setSyncing(true);
    try {
      // Get remaining tasks (exclude done tasks)
      const openTasks = listTasks(userId, t => t.status === 'open' || t.status === 'scheduled');
      
      // Apply replan constraints based on option
      // (simplified - full implementation would adjust scheduling config based on option)
      // option: 'other_focus', 'mini_only', 'less_time', 'manual'
      const newPlan = scheduleDay(openTasks, new Date());
      
      if (!newPlan) {
        setError('Kein Plan möglich.');
        return;
      }

      // Mark old plan as replanned
      await saveDayPlan(userId, { ...dayPlanState, status: 'replanned' }, firebaseUser);
      
      // Create new plan
      const replanState = {
        id: `plan-${today}-${Date.now()}`,
        date: today,
        status: 'suggested' as const,
        replan_count: dayPlanState.replan_count + 1,
        original_plan_id: dayPlanState.original_plan_id || dayPlanState.id,
        plan: newPlan,
      };
      
      await saveDayPlan(userId, replanState, firebaseUser);
      setDayPlanState(replanState);
      setShowReplanDialog(false);
      setError(null);
    } finally {
      setSyncing(false);
    }
  };

  if (!dayPlanState) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <div className="card">
          <div className="section-title">Today Plan</div>
          {error && <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>}
          {!error && <div className="muted">Plan wird geladen...</div>}
        </div>
      </div>
    );
  }

  const plan = dayPlanState.plan;
  const isConfirmed = dayPlanState.status === 'confirmed';
  const canReplan = isConfirmed && dayPlanState.replan_count < 3;

  // Get actual task objects for display using sorted order
  const sortedTasks = sortedTaskIds.map(id => getTask(userId, id)).filter(Boolean);
  const focusTask = sortedTasks[0] || null;
  const miniTasks = sortedTasks.slice(1);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid" style={{ gap: 16 }}>
        <div className="card">
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-title">Today Plan</div>
            <div className="flex" style={{ gap: '1rem', alignItems: 'center' }}>
              <SyncStatus syncing={syncing} />
              {canReplan && (
                <button className="button secondary" onClick={() => setShowReplanDialog(true)}>
                  🔄 Plan B
                </button>
              )}
            </div>
          </div>
          <div className="muted" style={{ marginBottom: 8 }}>
            {today} {isConfirmed && '✓ Bestätigt'}
          </div>

          <SortableContext items={sortedTaskIds} strategy={verticalListSortingStrategy}>
            {focusTask && (
              <div style={{ marginBottom: 12 }}>
                <SortableTaskItem task={focusTask} type="focus" />
              </div>
            )}

            <div className="label">Mini Tasks</div>
            {miniTasks.length === 0 && <div className="muted">Keine Minis.</div>}
            {miniTasks.length > 0 && (
              <ul className="list">
                {miniTasks.map((task) => 
                  task ? <SortableTaskItem key={task.id} task={task} type="mini" /> : null
                )}
              </ul>
            )}
          </SortableContext>

        <div className="label" style={{ marginTop: 12 }}>Zeitblöcke</div>
        <ul className="list">
          {(plan?.suggested_blocks || []).map((b, idx) => (
            <li key={idx} className="list-item">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div>{b.block_type.toUpperCase()}</div>
                <div className="muted">
                  {new Date(b.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                  {new Date(b.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {plan?.reasoning_brief && (
          <div style={{ marginTop: 12, padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 14 }}>{plan.reasoning_brief}</div>
          </div>
        )}

        {error && <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>}

        <div className="flex" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          {isConfirmed ? (
            <>
              <Link className="button secondary" to="/daily-review">
                Tag abschließen
              </Link>
              <div className="muted">Plan aktiv</div>
            </>
          ) : (
            <button className="button" onClick={handleConfirm} style={{ flex: 1 }}>
              Plan bestätigen
            </button>
          )}
        </div>
      </div>

      {showReplanDialog && (
        <div className="card" style={{ borderColor: '#3b82f6' }}>
          <div className="section-title">Neu planen?</div>
          <div className="muted" style={{ marginBottom: 12 }}>
            Replan {dayPlanState.replan_count + 1} von 3
          </div>
          <div className="grid" style={{ gap: 8 }}>
            <button
              className="button secondary"
              onClick={() => handleReplan('other_focus')}
            >
              🎯 Andere Fokus-Aufgabe
            </button>
            <button
              className="button secondary"
              onClick={() => handleReplan('mini_only')}
            >
              ⚡ Nur noch Mini-Aufgaben
            </button>
            <button
              className="button secondary"
              onClick={() => handleReplan('less_time')}
            >
              🕐 Mit weniger Zeit planen
            </button>
          </div>
          <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
            <button className="button secondary" onClick={() => setShowReplanDialog(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
      </div>
    </DndContext>
  );
}
