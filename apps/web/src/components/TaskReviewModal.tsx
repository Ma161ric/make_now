import { useState } from 'react';
import { Task, updateTaskStatus } from '../storage';

interface TaskReviewModalProps {
  task: Task;
  onClose: () => void;
  onSave: (reflection: string, mood: 'great' | 'good' | 'okay' | 'tough', status: 'done' | 'postpone' | 'keep-open') => void;
}

export function TaskReviewModal({ task, onClose, onSave }: TaskReviewModalProps) {
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState<'great' | 'good' | 'okay' | 'tough' | undefined>();
  const [status, setStatus] = useState<'done' | 'postpone' | 'keep-open' | undefined>();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!status) {
      setError('Bitte wähle einen Status.');
      return;
    }

    onSave(reflection, mood || 'okay', status);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card" style={{ maxWidth: 500, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="section-title">Task Review: {task.title}</div>

        <div style={{ marginTop: 16 }}>
          <div className="label">Status</div>
          <div className="flex" style={{ gap: 8, marginTop: 8 }}>
            <button
              className={`button ${status === 'done' ? '' : 'secondary'}`}
              onClick={() => setStatus('done')}
              style={{ flex: 1 }}
            >
              ✅ Erledigt
            </button>
            <button
              className={`button ${status === 'postpone' ? '' : 'secondary'}`}
              onClick={() => setStatus('postpone')}
              style={{ flex: 1 }}
            >
              ➡️ Morgen
            </button>
            <button
              className={`button ${status === 'keep-open' ? '' : 'secondary'}`}
              onClick={() => setStatus('keep-open')}
              style={{ flex: 1 }}
            >
              ⏸️ Offen
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="label">Wie war es?</div>
          <div className="flex" style={{ gap: 8, marginTop: 8 }}>
            <button
              className={`button ${mood === 'great' ? '' : 'secondary'}`}
              onClick={() => setMood('great')}
              title="Super!"
            >
              😊 Toll
            </button>
            <button
              className={`button ${mood === 'good' ? '' : 'secondary'}`}
              onClick={() => setMood('good')}
              title="Gut"
            >
              🙂 Gut
            </button>
            <button
              className={`button ${mood === 'okay' ? '' : 'secondary'}`}
              onClick={() => setMood('okay')}
              title="Okay"
            >
              😐 Okay
            </button>
            <button
              className={`button ${mood === 'tough' ? '' : 'secondary'}`}
              onClick={() => setMood('tough')}
              title="Schwierig"
            >
              😔 Tough
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="label">Notiz (optional)</div>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Was war gut? Was war schwierig?"
            style={{
              width: '100%',
              minHeight: 100,
              padding: 8,
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              fontFamily: 'inherit',
              fontSize: 'inherit',
              marginTop: 8,
            }}
          />
        </div>

        {error && <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>}

        <div className="flex" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="button secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="button" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
