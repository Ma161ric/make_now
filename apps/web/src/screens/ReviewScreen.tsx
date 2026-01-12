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
import { useAuth } from '../auth/authContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAiDurationEstimation } from '../hooks/useAiDurationEstimation';
import { extractFromNoteCloud } from '../firebase/functionsService';

function toEditableItems(userId: string, noteId: string): ExtractedItem[] {
  const reviewed = getReviewedItems(userId, noteId);
  if (reviewed) return reviewed;
  const extraction = getExtraction(userId, noteId);
  return extraction?.items ?? [];
}

function getTaskDurationCategory(minMin: number | null | undefined): 'long' | 'middle' | 'short' {
  if (!minMin) return 'short';
  if (minMin >= 60) return 'long';
  if (minMin >= 20) return 'middle';
  return 'short';
}

export default function ReviewScreen() {
  const params = useParams();
  const navigate = useNavigate();
  const { user, firebaseUser } = useAuth();
  const { preferences } = usePreferences();
  const userId = user?.id || firebaseUser?.uid || '';
  const noteId = params.id || '';
  const note = userId ? getNote(userId, noteId) : undefined;
  const [items, setItems] = useState<ExtractedItem[]>(() => userId ? toEditableItems(userId, noteId) : []);
  const [selectedForPlan, setSelectedForPlan] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reextracting, setReextracting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const extraction: ExtractionResponse | undefined = useMemo(() => userId ? getExtraction(userId, noteId) : undefined, [noteId, userId]);

  if (!note || !extraction) {
    return <div className="card">Notiz nicht gefunden.</div>;
  }

  const updateItem = (id: string, updater: (item: ExtractedItem) => ExtractedItem) => {
    setItems((prev) => prev.map((it) => (it.id === id ? updater(it) : it)));
  };

  const handleReextract = async () => {
    setReextracting(true);
    setError(null);
    setSuccess(null);
    try {
      const extraction = await extractFromNoteCloud(note.raw_text);
      console.log('[Review] Re-extraction result:', extraction);
      
      // Use new extraction if items exist
      if (extraction.items && extraction.items.length > 0) {
        setItems(extraction.items);
        setSuccess('AI hat neue Items extrahiert.');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setSuccess('AI konnte keine Items extrahieren - bitte manuell eingeben.');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-extraction failed');
    } finally {
      setReextracting(false);
    }
  };

  // Check if empty extraction
  const hasEmptyExtraction = !extraction.items || extraction.items.length === 0;

  const handleToggleForPlan = (itemId: string) => {
    const newSelected = new Set(selectedForPlan);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    
    // Validate limits
    const tasks = items.filter(it => it.type === 'task' && newSelected.has(it.id));
    const limits = preferences.schedulingLimits;
    
    let longCount = 0, middleCount = 0, shortCount = 0;
    for (const task of tasks) {
      const fields = task.parsed_fields as TaskFields;
      const minMin = fields?.duration_min_minutes;
      const category = getTaskDurationCategory(minMin);
      if (category === 'long') longCount++;
      else if (category === 'middle') middleCount++;
      else shortCount++;
    }

    if (
      longCount <= limits.max_long_tasks &&
      middleCount <= limits.max_middle_tasks &&
      shortCount <= limits.max_short_tasks
    ) {
      setSelectedForPlan(newSelected);
      setError(null);
    } else {
      setError(
        `Limit überschritten: ${longCount}/${limits.max_long_tasks} lang, ${middleCount}/${limits.max_middle_tasks} mittel, ${shortCount}/${limits.max_short_tasks} kurz`
      );
    }
  };

  const handleAddToPlan = () => {
    const itemsForPlan = items.filter(item => selectedForPlan.has(item.id));
    if (itemsForPlan.length === 0) {
      setError('Bitte wähle mindestens ein Item zum Plan hinzu.');
      return;
    }
    
    // Save selected items for daily planning
    console.log('[Review] Adding to plan:', itemsForPlan);
    setSuccess(`${itemsForPlan.length} Item(s) zum Tagesplan hinzugefügt!`);
    setTimeout(() => setSuccess(null), 3000);
    
    // Mark note as "planned"
    saveReviewedItems(userId, noteId, items);
    
    // Navigate to Today/Planning view
    setTimeout(() => navigate('/today'), 500);
  };

  const handleSave = () => {
    // Ensure all items have required fields
    const completeItems = items.map(item => {
      if (!item.id) {
        console.warn('[Review] Item missing id:', item);
        item.id = `item-${Date.now()}-${Math.random()}`;
      }
      if (!item.parsed_fields) {
        console.warn('[Review] Item missing parsed_fields:', item);
        item.parsed_fields = item.type === 'task' 
          ? { duration_min_minutes: 15, duration_max_minutes: 30, importance: 'medium' }
          : item.type === 'event'
          ? { start_at: '', end_at: '', timezone: 'Europe/Berlin' }
          : { content: '' };
      }
      return item;
    });

    const updatedExtraction: ExtractionResponse = {
      ...extraction,
      items: completeItems,
      overall_confidence:
        completeItems.length > 0
          ? Math.round((completeItems.reduce((s, i) => s + (i.confidence ?? 0.5), 0) / completeItems.length) * 100) / 100
          : extraction.overall_confidence,
    };
    const validation = validateExtraction(updatedExtraction);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join('\n');
      console.error('[Review] Validation errors:', validation.errors);
      setError(`Validierung fehlgeschlagen:\n${errorMessages}`);
      return;
    }
    saveReviewedItems(userId, noteId, completeItems);
    setError(null);
    
    // Navigate back to notes after short delay
    setTimeout(() => navigate('/'), 500);
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="section-title">Extraction Review</div>
        <div className="muted" style={{ marginBottom: 8 }}>Notiz: {note.raw_text}</div>
        
        {/* Re-extraction section */}
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="label">KI-Extraktion</div>
            <button
              className="button secondary"
              onClick={handleReextract}
              disabled={reextracting}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              title={hasEmptyExtraction ? 'Notiz neu analysieren' : 'Analyse wiederholen'}
            >
              {reextracting ? '⏳ ...' : '🤖'} {hasEmptyExtraction ? 'Analysieren' : 'Neu analysieren'}
            </button>
          </div>
          {hasEmptyExtraction && (
            <div className="muted" style={{ marginTop: 8, fontSize: '0.875rem', color: '#d97706' }}>
              Keine Items extrahiert - nutze den Button um mit KI zu analysieren oder fülle Felder manuell aus.
            </div>
          )}
        </div>

        {error && <div style={{ color: '#b91c1c', marginBottom: 8, padding: '8px', backgroundColor: '#fee2e2', borderRadius: '4px' }}>{error}</div>}
        {success && <div style={{ color: '#15803d', marginBottom: 8, padding: '8px', backgroundColor: '#dcfce7', borderRadius: '4px' }}>{success}</div>}
        
        {items.length === 0 && <div className="muted">Keine Items - nutze KI-Button oder erstelle manuell.</div>}
        
        <div className="grid" style={{ gap: 12, marginBottom: 16 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ borderColor: '#e5e7eb' }}>
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
                    <div className="badge">{item.type}</div>
                    <div className="muted">Confidence {Math.round(item.confidence * 100)}%</div>
                  </div>
                </div>
                {item.type === 'task' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={selectedForPlan.has(item.id)}
                      onChange={() => handleToggleForPlan(item.id)}
                      title="Zum Tagesplan hinzufügen"
                    />
                    <span className="muted" style={{ fontSize: '0.875rem' }}>In Plan</span>
                  </label>
                )}
              </div>
              <div className="grid" style={{ gap: 8 }}>
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

        {/* Action buttons */}
        <div className="flex" style={{ justifyContent: 'space-between', gap: 12 }}>
          <button
            className="button secondary"
            onClick={() => navigate(-1)}
          >
            ← Zurück
          </button>
          {selectedForPlan.size > 0 && (
            <button
              className="button"
              onClick={handleAddToPlan}
              title="Ausgewählte Items zum Tagesplan hinzufügen"
            >
              ✓ In Plan ({selectedForPlan.size})
            </button>
          )}
          {selectedForPlan.size === 0 && (
            <button
              className="button"
              onClick={handleSave}
              title="Items speichern ohne zum Plan hinzuzufügen"
            >
              Speichern
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskFieldsEditor({ title, fields, onChange }: { title: string; fields: TaskFields; onChange: (f: TaskFields) => void }) {
  const { estimateDuration, loading, error } = useAiDurationEstimation();
  const [showEstimation, setShowEstimation] = useState(false);

  // Provide defaults if fields are empty
  const duration_min = fields?.duration_min_minutes ?? 15;
  const duration_max = fields?.duration_max_minutes ?? 30;
  const importance = fields?.importance ?? 'medium';

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
          value={duration_min}
          onChange={(e) => onChange({ ...fields, duration_min_minutes: Number(e.target.value) })}
          style={{ width: '120px' }}
        />
        <input
          type="number"
          className="input"
          value={duration_max}
          onChange={(e) => onChange({ ...fields, duration_max_minutes: Number(e.target.value) })}
          style={{ width: '120px' }}
        />
      </div>
      <div className="label">Fälligkeit (optional)</div>
      <input
        type="datetime-local"
        className="input"
        value={fields?.due_at ? fields.due_at : ''}
        onChange={(e) => onChange({ ...fields, due_at: e.target.value || undefined })}
      />
      <div className="label">Importance</div>
      <select
        className="input"
        value={importance}
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
        value={fields?.start_at ? fields.start_at : ''}
        onChange={(e) => onChange({ ...fields, start_at: e.target.value || undefined })}
      />
      <div className="label">Ende</div>
      <input
        type="datetime-local"
        className="input"
        value={fields?.end_at ? fields.end_at : ''}
        onChange={(e) => onChange({ ...fields, end_at: e.target.value || undefined })}
      />
      <div className="label">Zeitzone</div>
      <input
        className="input"
        value={fields?.timezone || 'Europe/Berlin'}
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
        value={fields?.content || ''}
        onChange={(e) => onChange({ ...fields, content: e.target.value })}
      />
    </div>
  );
}
