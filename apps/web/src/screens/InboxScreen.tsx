import { FormEvent, useMemo, useState, useEffect, useRef } from 'react';
import { validateExtraction } from '@make-now/core';
import { extractFromNoteCloud } from '../firebase/functionsService';
import { addNote, listNotes, deleteNote } from '../storage';
import { uuid } from '../utils';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { usePreferences } from '../context/PreferencesContext';
import { useDataMigration } from '../hooks/useSyncEffect';
import { useLiveNotes } from '../hooks/useLiveNotes';
import { SyncStatus } from '../components/SyncStatus';

export default function InboxScreen() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { user, firebaseUser } = useAuth();
  const { preferences } = usePreferences();
  const userId = user?.id || firebaseUser?.uid || '';
  const isMountedRef = useRef(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Use live notes hook for real-time updates
  const notes = useLiveNotes(userId);

  // Data migration on first login
  useDataMigration(firebaseUser);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleDelete = async (noteId: string, notePreview: string) => {
    const confirmed = confirm(`Notiz löschen?\n\n"${notePreview}"`);
    if (!confirmed) return;
    
    try {
      setDeletingId(noteId);
      await deleteNote(userId, noteId, firebaseUser);
      setSuccess('Notiz gelöscht.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fehler beim Löschen';
      setError(`Löschen fehlgeschlagen: ${errorMsg}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Bitte gib eine Notiz ein.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Notiz muss mindestens 3 Zeichen haben.');
      return;
    }
    if (trimmed.length > 2000) {
      setError('Notiz darf maximal 2000 Zeichen haben.');
      return;
    }
    const noteId = uuid();
    setSyncing(true);
    try {
      const extraction = await extractFromNoteCloud(trimmed);
      console.log('[Inbox] Extraction result:', extraction);
      await addNote(
        userId,
        {
          id: noteId,
          raw_text: trimmed,
          created_at: new Date().toISOString(),
          status: 'unprocessed',
        },
        extraction,
        firebaseUser
      );
      if (isMountedRef.current) {
        setSyncing(false);
        const hasItems = extraction.items && extraction.items.length > 0;
        const aiAvailable = !extraction.extracted_metadata?.algorithm_version?.startsWith('failed-');
        if (hasItems) {
          setSuccess('Gespeichert. Jetzt prüfen.');
        } else if (!aiAvailable) {
          setSuccess('AI nicht erreichbar, bitte in review erneut versuchen.');
        } else {
          setSuccess('Gespeichert. Wird beim Review analysiert.');
        }
        setText('');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSyncing(false);
        const errorMsg = err instanceof Error ? err.message : 'Fehler beim Speichern';
        setError(`Speichern fehlgeschlagen: ${errorMsg}. Bitte später versuchen.`);
      }
    }
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="section-title">Inbox Capture</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
              🔬 Demo Mode - KI-Extraktion simuliert
            </div>
          </div>
          <SyncStatus syncing={syncing} />
        </div>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
          <label className="label" htmlFor="note">Freitext Notiz</label>
          <textarea
            id="note"
            rows={4}
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Notiz eingeben..."
            maxLength={2000}
          />
          <div className="muted" style={{ fontSize: 12 }}>
            {text.length}/2000 Zeichen
          </div>
          {error && (
            <div style={{ color: '#7f1d1d', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '6px', borderLeft: '4px solid #dc2626' }}>
              <div>{error}</div>
              <button 
                className="button" 
                onClick={(e) => { e.preventDefault(); setError(null); }}
                style={{ marginTop: '8px', fontSize: '0.875rem', backgroundColor: '#dc2626' }}
                aria-label="Notiz-Eingabe erneut versuchen"
              >
                🔄 Nochmal versuchen
              </button>
            </div>
          )}
          {success && <div style={{ color: '#166534', padding: '12px', backgroundColor: '#dcfce7', borderRadius: '6px', borderLeft: '4px solid #22c55e' }}>{success}</div>}
          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <button 
              className="button" 
              type="submit" 
              disabled={syncing}
              aria-label={syncing ? 'Notiz wird gespeichert' : 'Notiz speichern'}
            >
              Speichern
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-title">Letzte Notizen</div>
        {notes.length === 0 && <div className="muted">Keine Notizen vorhanden.</div>}
        <ul className="list">
          {notes.map((note) => (
            <li key={note.id} className="list-item">
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div>{note.raw_text.slice(0, 80) || '(leer)'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(note.created_at).toLocaleString()}</div>
                </div>
                <div className="flex" style={{ gap: 8 }}>
                  <Link className="button secondary" to={`/review/${note.id}`}>Review</Link>
                  <button 
                    className="button secondary"
                    onClick={() => handleDelete(note.id, note.raw_text.slice(0, 60))}
                    disabled={deletingId === note.id}
                    style={{ color: '#b91c1c' }}
                    title="Notiz löschen"
                  >
                    {deletingId === note.id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
