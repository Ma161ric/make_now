import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDayPlan, getDailyReview, saveDailyReview, listTasks, updateTaskStatus, saveDayPlan } from '../storage';
import { formatDate } from '../utils';
import { useAuth } from '../auth/authContext';
import { generateReviewAnalysis } from '../utils/aiReview';
import { generateDayPlanWithAI } from '../utils/aiDayPlanning';

export default function DailyReviewScreen() {
  const navigate = useNavigate();
  const { user, firebaseUser } = useAuth();
  const userId = user?.id || firebaseUser?.uid || '';
  const today = formatDate(new Date());
  const dayPlan = userId ? getDayPlan(userId, today) : undefined;
  const existingReview = userId ? getDailyReview(userId, today) : undefined;

  const [taskStates, setTaskStates] = useState<Record<string, 'done' | 'postpone' | 'keep-open'>>({});
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState<'great' | 'good' | 'okay' | 'tough' | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    suggestions: string[];
    insight: string;
    tomorrow_focus: string;
  } | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiPlanSuggestions, setAiPlanSuggestions] = useState<{
    suggested_tasks: Array<{ title: string; duration_minutes: number; priority: string }>;
    focus_recommendation: string;
    planning_tips: string[];
  } | null>(null);
  const [loadingPlanAI, setLoadingPlanAI] = useState(false);

  if (!dayPlan || dayPlan.status !== 'confirmed') {
    return (
      <div className="card">
        <div className="section-title">Daily Review</div>
        <div className="muted">Kein bestätigter Plan für heute vorhanden.</div>
      </div>
    );
  }

  if (existingReview) {
    return (
      <div className="card">
        <div className="section-title">Daily Review</div>
        <div className="muted">Review für heute bereits abgeschlossen.</div>
        <div style={{ marginTop: 12 }}>
          <div>Erledigte Tasks: {existingReview.tasks_done} von {existingReview.tasks_total}</div>
          {existingReview.mood && <div>Stimmung: {getMoodEmoji(existingReview.mood)}</div>}
          {existingReview.reflection_note && (
            <div style={{ marginTop: 8 }}>
              <div className="label">Notiz</div>
              <div className="muted">{existingReview.reflection_note}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const plan = dayPlan.plan;
  const allTaskIds = [
    ...(plan.focus_task_id ? [plan.focus_task_id] : []),
    ...plan.mini_task_ids,
  ];
  const tasks = allTaskIds.map(id => listTasks(userId, t => t.id === id)[0]).filter(Boolean);

  const allReviewed = tasks.every(t => taskStates[t.id]);
  const doneCount = Object.values(taskStates).filter(s => s === 'done').length;

  const handleGenerateAISuggestions = async () => {
    if (!reflection || !mood) {
      setError('Bitte Notiz und Stimmung angeben für AI-Vorschläge.');
      return;
    }

    setLoadingAI(true);
    setError(null);

    try {
      const prompt = `Analyze this day reflection and provide actionable suggestions for improvement:

Reflection: "${reflection}"
Mood: ${mood}
Tasks completed: ${doneCount}/${tasks.length}

Please respond with valid JSON (no markdown, just the JSON object):
{
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "insight": "One key insight about today",
  "tomorrow_focus": "What to focus on tomorrow"
}`;

      const analysis = await generateReviewAnalysis(prompt, reflection, mood, doneCount, tasks.length);
      setAiSuggestions(analysis);
    } catch (err) {
      console.error('Failed to generate AI suggestions:', err);
      setError('AI-Vorschläge konnten nicht generiert werden.');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleComplete = () => {
    if (!allReviewed) {
      setError('Bitte alle Aufgaben bewerten.');
      return;
    }

    // Update task states
    tasks.forEach(task => {
      const state = taskStates[task.id];
      if (state === 'done') {
        updateTaskStatus(userId, task.id, 'done');
      } else if (state === 'postpone') {
        updateTaskStatus(userId, task.id, 'scheduled');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Would need to update due_at here in a real implementation
      } else {
        updateTaskStatus(userId, task.id, 'open');
      }
    });

    // Mark plan as completed
    saveDayPlan(userId, {
      ...dayPlan,
      status: 'completed',
    });

    // Save review
    const review: import('../storage').DailyReviewData = {
      id: `review-${today}-${Date.now()}`,
      date: today,
      day_plan_id: dayPlan.id,
      completed_at: new Date().toISOString(),
      tasks_done: doneCount,
      tasks_total: tasks.length,
      reflection_note: reflection || undefined,
      mood,
    };
    saveDailyReview(userId, review);

    setError(null);
    setCompleted(true);
  };

  const motivationText = getMotivationText(doneCount, tasks.length);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="section-title">Daily Review</div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Wie war dein Tag? • {today}
        </div>

        <div className="grid" style={{ gap: 12 }}>
          {tasks.map(task => (
            <div key={task.id} className="card" style={{ borderColor: '#e5e7eb' }}>
              <div className="label">{task.title}</div>
              <div className="flex" style={{ gap: 8, marginTop: 8 }}>
                <button
                  className={`button ${taskStates[task.id] === 'done' ? '' : 'secondary'}`}
                  onClick={() => setTaskStates(prev => ({ ...prev, [task.id]: 'done' }))}
                  style={{ flex: 1 }}
                >
                  ✅ Erledigt
                </button>
                <button
                  className={`button ${taskStates[task.id] === 'postpone' ? '' : 'secondary'}`}
                  onClick={() => setTaskStates(prev => ({ ...prev, [task.id]: 'postpone' }))}
                  style={{ flex: 1 }}
                >
                  ➡️ Morgen
                </button>
                <button
                  className={`button ${taskStates[task.id] === 'keep-open' ? '' : 'secondary'}`}
                  onClick={() => setTaskStates(prev => ({ ...prev, [task.id]: 'keep-open' }))}
                  style={{ flex: 1 }}
                >
                  ⏸️ Offen
                </button>
              </div>
            </div>
          ))}
        </div>

        {allReviewed && (
          <div style={{ marginTop: 12, padding: 12, background: '#ecfeff', borderRadius: 8 }}>
            <div style={{ fontWeight: 600 }}>{motivationText}</div>
            <div className="muted">{doneCount} von {tasks.length} Aufgaben erledigt</div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="label">Kurze Notiz zum Tag? (optional)</div>
          <textarea
            className="input"
            rows={3}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Was lief gut? Was nicht?"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="label">Stimmung</div>
          <div className="flex" style={{ gap: 8 }}>
            {(['great', 'good', 'okay', 'tough'] as const).map(m => (
              <button
                key={m}
                className={`button ${mood === m ? '' : 'secondary'}`}
                onClick={() => setMood(m)}
                style={{ flex: 1 }}
              >
                {getMoodEmoji(m)}
              </button>
            ))}
          </div>
        </div>

        {mood && reflection && !aiSuggestions && (
          <div style={{ marginTop: 12 }}>
            <button
              className="button"
              onClick={handleGenerateAISuggestions}
              disabled={loadingAI}
              style={{ width: '100%' }}
            >
              {loadingAI ? '⏳ KI analysiert...' : '✨ KI-Vorschläge generieren'}
            </button>
          </div>
        )}

        {aiSuggestions && (
          <div style={{ marginTop: 12, padding: 12, background: '#f0f9ff', borderRadius: 0, borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontWeight: 600, color: '#0c4a6e', marginBottom: 8 }}>✨ KI-Analyse</div>
            
            {aiSuggestions.insight && (
              <div style={{ marginBottom: 8 }}>
                <div className="label" style={{ fontSize: '0.875rem' }}>Erkenntnis</div>
                <div className="muted">{aiSuggestions.insight}</div>
              </div>
            )}
            
            {aiSuggestions.suggestions && aiSuggestions.suggestions.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div className="label" style={{ fontSize: '0.875rem' }}>Verbesserungsvorschläge</div>
                <ul style={{ marginLeft: 16, marginTop: 4, color: '#475569' }}>
                  {aiSuggestions.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiSuggestions.tomorrow_focus && (
              <div>
                <div className="label" style={{ fontSize: '0.875rem' }}>Fokus für morgen</div>
                <div className="muted">{aiSuggestions.tomorrow_focus}</div>
              </div>
            )}

            <button
              className="button secondary"
              onClick={() => setAiSuggestions(null)}
              style={{ marginTop: 8, width: '100%' }}
            >
              Schließen
            </button>
          </div>
        )}

        {error && <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>}

        {completed && !aiPlanSuggestions && (
          <div style={{ marginTop: 12, padding: 12, background: '#dcfce7', borderRadius: 0, borderLeft: '4px solid #22c55e' }}>
            <div style={{ fontWeight: 600, color: '#166534', marginBottom: 8 }}>✅ Tag gespeichert!</div>
            <div className="muted">Dein Review wurde erfolgreich gespeichert.</div>
            <button
              className="button"
              onClick={async () => {
                setLoadingPlanAI(true);
                setError(null);
                try {
                  const suggestions = await generateDayPlanWithAI(reflection, mood!, doneCount, tasks.length);
                  if (suggestions) {
                    setAiPlanSuggestions(suggestions);
                  } else {
                    setError('Fehler beim Generieren der Planvorschläge. Versuche es später erneut.');
                  }
                } catch (err) {
                  setError('Fehler beim Generieren der Planvorschläge. Versuche es später erneut.');
                  console.error('AI planning error:', err);
                } finally {
                  setLoadingPlanAI(false);
                }
              }}
              disabled={loadingPlanAI}
              style={{ marginTop: 12, width: '100%' }}
            >
              {loadingPlanAI ? '⏳ Plane den nächsten Tag...' : '🎯 Nächsten Tag mit KI planen'}
            </button>
            <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
              <button className="button secondary" onClick={() => navigate('/')}>
                Zur Inbox
              </button>
              <button className="button" onClick={() => navigate('/today')}>
                Zum Heute
              </button>
            </div>
          </div>
        )}

        {aiPlanSuggestions && (
          <div style={{ marginTop: 12, padding: 12, background: '#fef3c7', borderRadius: 0, borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 8 }}>🎯 KI-Planungsvorschläge für morgen</div>
            
            {aiPlanSuggestions.focus_recommendation && (
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ fontSize: '0.875rem' }}>Fokus</div>
                <div className="muted">{aiPlanSuggestions.focus_recommendation}</div>
              </div>
            )}
            
            {aiPlanSuggestions.suggested_tasks && aiPlanSuggestions.suggested_tasks.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ fontSize: '0.875rem' }}>Vorgeschlagene Tasks</div>
                <ul style={{ marginLeft: 16, marginTop: 4, color: '#475569' }}>
                  {aiPlanSuggestions.suggested_tasks.map((task, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <strong>{task.title}</strong> ({task.duration_minutes}min, {task.priority})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiPlanSuggestions.planning_tips && aiPlanSuggestions.planning_tips.length > 0 && (
              <div>
                <div className="label" style={{ fontSize: '0.875rem' }}>Tipps für die Planung</div>
                <ul style={{ marginLeft: 16, marginTop: 4, color: '#475569' }}>
                  {aiPlanSuggestions.planning_tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
              <button
                className="button secondary"
                onClick={() => setAiPlanSuggestions(null)}
              >
                Schließen
              </button>
              <button className="button" onClick={() => navigate('/today')}>
                Zum Planning
              </button>
            </div>
          </div>
        )}

        {!completed && (
          <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
            <button className="button secondary" onClick={() => navigate('/today')}>
              Später
            </button>
            <button
              className="button"
              onClick={handleComplete}
              disabled={!allReviewed}
            >
              Tag abschließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getMoodEmoji(mood: 'great' | 'good' | 'okay' | 'tough'): string {
  const map = {
    great: '😊',
    good: '🙂',
    okay: '😐',
    tough: '😔',
  };
  return map[mood];
}

function getMotivationText(done: number, total: number): string {
  const pct = (done / total) * 100;
  if (pct === 100) return 'Perfekt! Alles geschafft! 🏆';
  if (pct >= 66) return 'Stark! Fast alles erledigt! 🎉';
  if (pct >= 33) return 'Solide! Morgen geht\'s weiter. 💪';
  return 'Schwieriger Tag. Morgen wird besser! 🌟';
}
