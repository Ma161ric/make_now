import { useState } from 'react';
import { generateDayPlanWithAI, type DayPlanSuggestions } from '../utils/aiDayPlanning';

interface AIPlanningProps {
  today: string;
  todayTasksDone: number;
  todayTasksTotal: number;
  yesterdayReflection?: string;
  yesterdayMood?: 'great' | 'good' | 'okay' | 'tough';
}

export function AIPlanningSection({
  today,
  todayTasksDone,
  todayTasksTotal,
  yesterdayReflection,
  yesterdayMood,
}: AIPlanningProps) {
  const [showTodayPlan, setShowTodayPlan] = useState(false);
  const [showTomorrowPlan, setShowTomorrowPlan] = useState(false);
  const [todayPlan, setTodayPlan] = useState<DayPlanSuggestions | null>(null);
  const [tomorrowPlan, setTomorrowPlan] = useState<DayPlanSuggestions | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateTodayPlan = async () => {
    if (!yesterdayReflection || !yesterdayMood) {
      setTodayPlan(null);
      setShowTodayPlan(false);
      return;
    }

    setLoading(true);
    try {
      const plan = await generateDayPlanWithAI(yesterdayReflection, yesterdayMood, 0, 1);
      setTodayPlan(plan);
      setShowTodayPlan(true);
    } catch (err) {
      console.error('Error generating today plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTomorrowPlan = async () => {
    // After today's review is completed
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setLoading(true);
    try {
      const plan = await generateDayPlanWithAI(
        'Based on today\'s accomplishments',
        'good',
        todayTasksDone,
        todayTasksTotal
      );
      setTomorrowPlan(plan);
      setShowTomorrowPlan(true);
    } catch (err) {
      console.error('Error generating tomorrow plan:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div className="section-title">🎯 AI-Planung</div>

      {/* Today's Plan */}
      {yesterdayReflection && yesterdayMood && (
        <div style={{ marginTop: 16 }}>
          <button
            className="button"
            onClick={handleGenerateTodayPlan}
            disabled={loading}
            style={{ width: '100%' }}
            aria-label={loading ? 'Tagesplan wird generiert' : 'KI-Plan für heute basierend auf gestern generieren'}
          >
            {loading ? '⏳ Generiere Plan...' : '✨ Heute planen basierend auf gestern'}
          </button>
        </div>
      )}

      {showTodayPlan && todayPlan && (
        <PlanDisplay plan={todayPlan} title="📋 Plan für heute" onClose={() => setShowTodayPlan(false)} />
      )}

      {/* Tomorrow's Plan */}
      {todayTasksDone > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            className="button"
            onClick={handleGenerateTomorrowPlan}
            disabled={loading}
            style={{ width: '100%' }}
            aria-label={loading ? 'Morgenplan wird generiert' : 'KI-Plan für morgen generieren'}
          >
            {loading ? '⏳ Generiere Plan...' : '🌟 Morgen planen basierend auf heute'}
          </button>
        </div>
      )}

      {showTomorrowPlan && tomorrowPlan && (
        <PlanDisplay plan={tomorrowPlan} title="📋 Plan für morgen" onClose={() => setShowTomorrowPlan(false)} />
      )}
    </div>
  );
}

function PlanDisplay({
  plan,
  title,
  onClose,
}: {
  plan: DayPlanSuggestions;
  title: string;
  onClose: () => void;
}) {
  return (
    <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 0, borderLeft: '4px solid var(--highlight)' }}>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>{title}</div>

      {plan.focus_recommendation && (
        <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
          <div className="label" style={{ fontSize: '0.875rem', marginBottom: 4 }}>🔥 Fokus</div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{plan.focus_recommendation}</div>
        </div>
      )}

      {plan.suggested_tasks && plan.suggested_tasks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ fontSize: '0.875rem', marginBottom: 6 }}>📋 Tasks</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {plan.suggested_tasks.map((task, i) => (
              <div key={i} style={{ padding: 8, background: 'white', borderRadius: 4, borderLeft: `3px solid ${task.priority === 'high' ? 'var(--danger)' : task.priority === 'medium' ? 'var(--highlight)' : 'var(--accent-primary)'}` }}>
                <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{task.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>⏱️ {task.duration_minutes}min • {task.priority === 'high' ? '🔴 Hoch' : task.priority === 'medium' ? '🟡 Mittel' : '🟢 Niedrig'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.planning_tips && plan.planning_tips.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ fontSize: '0.875rem', marginBottom: 6 }}>💡 Tipps</div>
          <ul style={{ marginLeft: 16, marginTop: 4, color: 'var(--text-muted)', gap: 4 }}>
            {plan.planning_tips.map((tip, i) => (
              <li key={i} style={{ marginBottom: 4, fontSize: '0.9rem' }}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <button 
        className="button secondary" 
        onClick={onClose} 
        style={{ width: '100%', marginTop: 8 }}
        aria-label="KI-Planungs-Dialog schließen"
      >
        Schließen
      </button>
    </div>
  );
}
