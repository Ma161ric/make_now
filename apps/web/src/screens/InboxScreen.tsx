import { FormEvent, useMemo, useState, useEffect, useRef } from 'react';
import { validateExtraction } from '@make-now/core';
import { extractFromNoteCloud } from '../firebase/functionsService';
import { addNote, listNotes } from '../storage';
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
      const validation = validateExtraction(extraction);
      if (!validation.valid) {
        setError('Extraktion ungültig, bitte Text anpassen.');
        setSyncing(false);
        return;
      }
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
        setSuccess('Gespeichert. Jetzt prüfen.');
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
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div>{note.raw_text.slice(0, 80) || '(leer)'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(note.created_at).toLocaleString()}</div>
                </div>
                <Link className="button secondary" to={`/review/${note.id}`}>Review</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
