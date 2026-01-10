import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ExtractedItem,
  TaskFields,
  EventFields,
  IdeaFields,
  validateExtraction,
  ExtractionResponse,
} from '@make-now/core';
import { getExtraction, getNote, getReviewedItems, saveReviewedItems } from '../storage';
import { useAiDurationEstimation } from '../hooks/useAiDurationEstimation';

function toEditableItems(noteId: string): ExtractedItem[] {
  const reviewed = getReviewedItems(noteId);
  if (reviewed) return reviewed;
  const extraction = getExtraction(noteId);
  return extraction?.items ?? [];
}

export default function ReviewScreen() {
  const params = useParams();
  const navigate = useNavigate();
  const noteId = params.id || '';
  const note = getNote(noteId);
  const [items, setItems] = useState<ExtractedItem[]>(() => toEditableItems(noteId));
  const [error, setError] = useState<string | null>(null);

  const extraction: ExtractionResponse | undefined = useMemo(() => getExtraction(noteId), [noteId]);

  if (!note || !extraction) {
    return <div className="card">Notiz nicht gefunden.</div>;
  }

  const updateItem = (id: string, updater: (item: ExtractedItem) => ExtractedItem) => {
    setItems((prev) => prev.map((it) => (it.id === id ? updater(it) : it)));
  };

  const handleSave = () => {
    const updatedExtraction: ExtractionResponse = {
      ...extraction,
      items,
      overall_confidence:
        items.length > 0
          ? Math.round((items.reduce((s, i) => s + (i.confidence ?? 0), 0) / items.length) * 100) / 100
          : extraction.overall_confidence,
    };
    const validation = validateExtraction(updatedExtraction);
    if (!validation.valid) {
      setError('Validierung fehlgeschlagen. Bitte Felder prüfen.');
      return;
    }
    saveReviewedItems(noteId, items);
    setError(null);
    navigate('/today');
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="section-title">Extraction Review</div>
        <div className="muted" style={{ marginBottom: 8 }}>Notiz: {note.raw_text}</div>
        {error && <div style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
        {items.length === 0 && <div className="muted">Keine Items extrahiert.</div>}
        <div className="grid" style={{ gap: 12 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ borderColor: '#e5e7eb' }}>
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div className="badge">{item.type}</div>
                <div className="muted">Confidence {Math.round(item.confidence * 100)}%</div>
              </div>
              <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                <div>
                  <div className="label">Titel</div>
                  <input
                    className="input"
                    value={item.title}
                    onChange={(e) => updateItem(item.id, (it) => ({ ...it, title: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="label">Typ</div>
                  <select
                    className="input"
                    value={item.type}
                    onChange={(e) => updateItem(item.id, (it) => ({ ...it, type: e.target.value as any }))}
                  >
                    <option value="task">task</option>
                    <option value="event">event</option>
                    <option value="idea">idea</option>
                  </select>
                </div>
                {item.type === 'task' && (
                  <TaskFieldsEditor
                    title={item.title}
                    fields={item.parsed_fields as TaskFields}
                    onChange={(fields) => updateItem(item.id, (it) => ({ ...it, parsed_fields: fields }))}
                  />
                )}
                {item.type === 'event' && (
                  <EventFieldsEditor
                    fields={item.parsed_fields as EventFields}
                    onChange={(fields) => updateItem(item.id, (it) => ({ ...it, parsed_fields: fields }))}
                  />
                )}
                {item.type === 'idea' && (
                  <IdeaFieldsEditor
                    fields={item.parsed_fields as IdeaFields}
                    onChange={(fields) => updateItem(item.id, (it) => ({ ...it, parsed_fields: fields }))}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="button" onClick={handleSave}>Weiter zum Plan</button>
        </div>
      </div>
    </div>
  );
}

function TaskFieldsEditor({ title, fields, onChange }: { title: string; fields: TaskFields; onChange: (f: TaskFields) => void }) {
  const { estimateDuration, loading, error } = useAiDurationEstimation();
  const [showEstimation, setShowEstimation] = useState(false);

  const handleEstimate = async () => {
    const estimate = await estimateDuration(title);
    if (estimate) {
      onChange({
        ...fields,
        duration_min_minutes: estimate.min_minutes,
        duration_max_minutes: estimate.max_minutes,
        estimation_source: 'ai',
      });
      setShowEstimation(true);
      setTimeout(() => setShowEstimation(false), 3000);
    }
  };

  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="label">Dauer (Min/Max)</div>
        <button
          className="button secondary"
          onClick={handleEstimate}
          disabled={loading}
          style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }}
        >
          {loading ? '⏳' : '🤖'} AI Estimate
        </button>
      </div>
      {error && <div className="muted" style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{error}</div>}
      {showEstimation && (
        <div className="muted" style={{ color: '#15803d', fontSize: '0.875rem' }}>✓ Duration estimated by AI</div>
      )}
      <div className="flex">
        <input
          type="number"
          className="input"
          value={fields.duration_min_minutes}
          onChange={(e) => onChange({ ...fields, duration_min_minutes: Number(e.target.value) })}
          style={{ width: '120px' }}
        />
        <input
          type="number"
          className="input"
          value={fields.duration_max_minutes}
          onChange={(e) => onChange({ ...fields, duration_max_minutes: Number(e.target.value) })}
          style={{ width: '120px' }}
        />
      </div>
      <div className="label">Fälligkeit (optional)</div>
      <input
        type="datetime-local"
        className="input"
        value={fields.due_at ? fields.due_at : ''}
        onChange={(e) => onChange({ ...fields, due_at: e.target.value || undefined })}
      />
      <div className="label">Importance</div>
      <select
        className="input"
        value={fields.importance || 'medium'}
        onChange={(e) => onChange({ ...fields, importance: e.target.value as any })}
      >
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
    </div>
  );
}

function EventFieldsEditor({ fields, onChange }: { fields: EventFields; onChange: (f: EventFields) => void }) {
  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="label">Start</div>
      <input
        type="datetime-local"
        className="input"
        value={fields.start_at ? fields.start_at : ''}
        onChange={(e) => onChange({ ...fields, start_at: e.target.value || undefined })}
      />
      <div className="label">Ende</div>
      <input
        type="datetime-local"
        className="input"
        value={fields.end_at ? fields.end_at : ''}
        onChange={(e) => onChange({ ...fields, end_at: e.target.value || undefined })}
      />
      <div className="label">Zeitzone</div>
      <input
        className="input"
        value={fields.timezone || 'Europe/Berlin'}
        onChange={(e) => onChange({ ...fields, timezone: e.target.value })}
      />
    </div>
  );
}

function IdeaFieldsEditor({ fields, onChange }: { fields: IdeaFields; onChange: (f: IdeaFields) => void }) {
  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="label">Inhalt</div>
      <textarea
        className="input"
        rows={3}
        value={fields.content || ''}
        onChange={(e) => onChange({ ...fields, content: e.target.value })}
      />
    </div>
  );
}
