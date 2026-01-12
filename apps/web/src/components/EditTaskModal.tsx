import { useState } from 'react';
import { Task } from '@make-now/core';
import { updateTaskStatus, saveTask } from '../storage';
import { useAuth } from '../auth/authContext';

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onSave?: () => void;
}

export function EditTaskModal({ task, onClose, onSave }: EditTaskModalProps) {
  const { firebaseUser } = useAuth();
  const userId = firebaseUser?.uid || '';
  
  const [title, setTitle] = useState(task.title);
  const [importance, setImportance] = useState<'high' | 'medium' | 'low'>(task.importance || 'medium');
  const [minDuration, setMinDuration] = useState(task.duration_min_minutes || 15);
  const [maxDuration, setMaxDuration] = useState(task.duration_max_minutes || 30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Titel ist erforderlich');
      return;
    }

    if (minDuration < 5 || maxDuration > 480 || minDuration > maxDuration) {
      setError('Gültige Dauer: 5-480 Min, Min <= Max');
      return;
    }

    setLoading(true);
    try {
      const updated: Task = {
        ...task,
        title: title.trim(),
        importance,
        duration_min_minutes: minDuration,
        duration_max_minutes: maxDuration,
        updated_at: new Date(),
      };

      await saveTask(userId, updated, firebaseUser);
      onSave?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Task wirklich löschen?')) {
      return;
    }

    setLoading(true);
    try {
      // Delete by marking as cancelled
      await updateTaskStatus(userId, task.id, 'cancelled', firebaseUser);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen');
    } finally {
      setLoading(false);
    }
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
        <div className="section-title">Task bearbeiten</div>

        <div style={{ marginTop: 16 }}>
          <div className="label">Titel</div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task-Titel"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="label">Wichtigkeit</div>
          <div className="flex" style={{ gap: 8, marginTop: 8 }}>
            {(['high', 'medium', 'low'] as const).map((imp) => (
              <button
                key={imp}
                className={`button ${importance === imp ? '' : 'secondary'}`}
                onClick={() => setImportance(imp)}
                style={{ flex: 1 }}
              >
                {imp === 'high' ? '🔴 Hoch' : imp === 'medium' ? '🟡 Mittel' : '🟢 Niedrig'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="label">Min. Dauer (Min)</div>
          <input
            type="number"
            min="5"
            max="480"
            value={minDuration}
            onChange={(e) => setMinDuration(Math.max(5, parseInt(e.target.value) || 5))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="label">Max. Dauer (Min)</div>
          <input
            type="number"
            min="5"
            max="480"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Math.max(5, parseInt(e.target.value) || 30))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error && <div style={{ color: '#b91c1c', marginTop: 12 }}>{error}</div>}

        <div className="flex" style={{ gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
          <button
            className="button secondary"
            onClick={handleDelete}
            disabled={loading}
            style={{ flex: 0 }}
          >
            🗑️ Löschen
          </button>
          <div className="flex" style={{ gap: 8 }}>
            <button
              className="button secondary"
              onClick={onClose}
              disabled={loading}
            >
              Abbrechen
            </button>
            <button
              className="button"
              onClick={handleSave}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? '⏳ Speichert...' : '💾 Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
