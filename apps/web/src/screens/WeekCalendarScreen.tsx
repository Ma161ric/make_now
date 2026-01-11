import { useEffect, useMemo, useState } from 'react';
import { getDayPlan, listTasks } from '../storage';
import { formatDate } from '../utils';
import { useAuth } from '../auth/authContext';
import { Task, PlanningResponse } from '@make-now/core';
import { useTasksSync } from '../hooks/useSyncEffect';

interface DayView {
  date: string;
  dateObj: Date;
  plan?: PlanningResponse;
  focusTask?: Task;
  miniTasks: Task[];
  blocks: Array<{
    start_at: string;
    end_at: string;
    block_type: string;
  }>;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatTimeShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr: string): string {
  const parts = dateStr.split('-'); // YYYY-MM-DD format
  return `${parts[2]}.${parts[1]}`;
}

export default function WeekCalendarScreen() {
  const { user, firebaseUser } = useAuth();
  const userId = user?.id || firebaseUser?.uid || '';
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [days, setDays] = useState<DayView[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Generate day views for the week
  useEffect(() => {
    if (!userId) return;

    const dayViews: DayView[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);

      const dayPlan = getDayPlan(userId, dateStr);
      const allTasks = listTasks(userId);

      const focusTaskId = dayPlan?.plan?.focus_task_id;
      const miniTaskIds = dayPlan?.plan?.mini_task_ids || [];

      const focusTask = focusTaskId ? allTasks.find(t => t.id === focusTaskId) : undefined;
      const miniTasks = miniTaskIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as Task[];

      dayViews.push({
        date: dateStr,
        dateObj: date,
        plan: dayPlan?.plan,
        focusTask,
        miniTasks,
        blocks: dayPlan?.plan?.suggested_blocks || [],
      });
    }

    setDays(dayViews);
  }, [userId, weekStart]);

  // Sync handler for real-time updates
  const handleTasksUpdate = () => {
    // Refresh day views when tasks change
    const dayViews: DayView[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);

      const dayPlan = getDayPlan(userId, dateStr);
      const allTasks = listTasks(userId);

      const focusTaskId = dayPlan?.plan?.focus_task_id;
      const miniTaskIds = dayPlan?.plan?.mini_task_ids || [];

      const focusTask = focusTaskId ? allTasks.find(t => t.id === focusTaskId) : undefined;
      const miniTasks = miniTaskIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as Task[];

      dayViews.push({
        date: dateStr,
        dateObj: date,
        plan: dayPlan?.plan,
        focusTask,
        miniTasks,
        blocks: dayPlan?.plan?.suggested_blocks || [],
      });
    }

    setDays(dayViews);
  };

  useTasksSync(handleTasksUpdate, { user: firebaseUser });

  const prevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const nextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const today = formatDate(new Date());

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="button secondary" onClick={prevWeek}>← Vorherige Woche</button>
          <div className="section-title" style={{ margin: 0 }}>Wochenansicht</div>
          <button className="button secondary" onClick={nextWeek}>Nächste Woche →</button>
        </div>
        <div className="muted" style={{ marginBottom: 16 }}>
          Woche vom {formatDateShort(formatDate(weekStart))} - {formatDateShort(formatDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)))}
        </div>

        {/* Calendar Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          padding: '8px 0',
        }}>
          {days.map((day) => {
            const isToday = day.date === today;
            const dayName = day.dateObj.toLocaleDateString('de-DE', { weekday: 'short' });

            return (
              <div
                key={day.date}
                style={{
                  border: isToday ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '12px',
                  backgroundColor: isToday ? '#f0f9ff' : '#fafafa',
                  minHeight: '360px',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isToday ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Day Header */}
                <div style={{ marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {dayName}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {formatDateShort(day.date)}
                  </div>
                  {day.plan?.status === 'confirmed' && (
                    <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>✓ Plan bestätigt</div>
                  )}
                </div>

                {/* Focus Task */}
                {day.focusTask && (
                  <div style={{
                    padding: 8,
                    backgroundColor: '#fef3c7',
                    borderRadius: 6,
                    marginBottom: 8,
                    borderLeft: '3px solid #f59e0b',
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600 }}>🎯 {day.focusTask.title}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {day.focusTask.duration_min_minutes}-{day.focusTask.duration_max_minutes}min
                    </div>
                  </div>
                )}

                {/* Mini Tasks */}
                {day.miniTasks.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#6b7280' }}>
                      Minis ({day.miniTasks.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {day.miniTasks.map(task => (
                        <div
                          key={task.id}
                          style={{
                            padding: 6,
                            backgroundColor: '#e0f2fe',
                            borderRadius: 4,
                            fontSize: 11,
                            borderLeft: '2px solid #0284c7',
                          }}
                        >
                          ⚡ {task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Blocks */}
                {day.blocks.length > 0 && (
                  <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: '#6b7280' }}>
                      Zeitblöcke
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {day.blocks.slice(0, 3).map((block, idx) => (
                        <div key={idx} style={{ fontSize: 9, color: '#6b7280' }}>
                          <span style={{ textTransform: 'uppercase', fontWeight: 500 }}>
                            {block.block_type}
                          </span>
                          {' '}
                          <span>
                            {formatTimeShort(block.start_at)}-{formatTimeShort(block.end_at)}
                          </span>
                        </div>
                      ))}
                      {day.blocks.length > 3 && (
                        <div style={{ fontSize: 9, color: '#9ca3af' }}>
                          +{day.blocks.length - 3} mehr
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!day.focusTask && day.miniTasks.length === 0 && day.blocks.length === 0 && (
                  <div style={{ color: '#d1d5db', fontSize: 12, textAlign: 'center', marginTop: 'auto' }}>
                    Keine Planung
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
