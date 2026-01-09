import { useEffect, useMemo, useState } from 'react';
import { scheduleDay, validatePlanning, PlanningResponse, Task } from '@make-now/core';
import { listAllReviewedItems, getPlan, savePlan } from '../storage';
import { formatDate } from '../utils';

function mapToTasks(items: ReturnType<typeof listAllReviewedItems>): Task[] {
  const now = new Date();
  return items
    .filter((i) => i.type === 'task')
    .map((item) => {
      const fields = item.parsed_fields as any;
      return {
        id: item.id,
        title: item.title,
        status: 'open',
        created_at: now,
        updated_at: now,
        estimation_source: fields.estimation_source || 'default',
        duration_min_minutes: fields.duration_min_minutes,
        duration_max_minutes: fields.duration_max_minutes,
        importance: fields.importance || 'medium',
        energy_type: fields.energy_type,
        due_at: fields.due_at ? new Date(fields.due_at) : undefined,
      } as Task;
    });
}

export default function TodayScreen() {
  const today = formatDate(new Date());
  const [plan, setPlan] = useState<PlanningResponse | null>(() => getPlan(today) || null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => listAllReviewedItems(), []);

  useEffect(() => {
    if (plan) return;
    const tasks = mapToTasks(items);
    const generated = scheduleDay(tasks, new Date());
    if (!generated) {
      setError('Heute kein Platz für neue Tasks.');
      return;
    }
    const validation = validatePlanning(generated);
    if (!validation.valid) {
      setError('Plan ungültig laut Schema.');
      return;
    }
    setPlan(generated);
  }, [items, plan]);

  const handleSave = () => {
    if (plan) {
      savePlan(today, plan);
      setError(null);
    }
  };

  if (!plan) {
    return <div className="card">{error || 'Kein Plan verfügbar.'}</div>;
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="section-title">Today Plan</div>
        <div className="muted" style={{ marginBottom: 8 }}>{today}</div>
        {plan.focus_task_id ? (
          <div className="card" style={{ background: '#ecfeff' }}>
            <div className="label">Fokus</div>
            <div>{plan.focus_task_id}</div>
          </div>
        ) : (
          <div className="muted">Kein Fokus-Task heute.</div>
        )}
        <div className="label" style={{ marginTop: 12 }}>Mini Tasks</div>
        {plan.mini_task_ids.length === 0 && <div className="muted">Keine Minis.</div>}
        <ul className="list">
          {plan.mini_task_ids.map((id) => (
            <li key={id} className="list-item">{id}</li>
          ))}
        </ul>
        <div className="label" style={{ marginTop: 12 }}>Zeitblöcke</div>
        <ul className="list">
          {plan.suggested_blocks.map((b, idx) => (
            <li key={idx} className="list-item">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div>{b.block_type.toUpperCase()}</div>
                <div className="muted">{new Date(b.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </li>
          ))}
        </ul>
        {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
        <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="button" onClick={handleSave}>Plan übernehmen</button>
        </div>
      </div>
    </div>
  );
}
