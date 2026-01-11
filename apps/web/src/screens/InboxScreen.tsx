import { FormEvent, useMemo, useState, useEffect, useRef } from 'react';
import { extractFromNoteMock, validateExtraction } from '@make-now/core';
import { addNote, listNotes } from '../storage';
import { uuid } from '../utils';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useDataMigration } from '../hooks/useSyncEffect';
import { useLiveNotes } from '../hooks/useLiveNotes';
import { SyncStatus } from '../components/SyncStatus';

export default function InboxScreen() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { user, firebaseUser } = useAuth();
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
    const extraction = extractFromNoteMock(trimmed, { timezone: 'Europe/Berlin' });
    const validation = validateExtraction(extraction);
    if (!validation.valid) {
      setError('Extraktion ungültig, bitte Text anpassen.');
      return;
    }
    
    setSyncing(true);
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
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title">Inbox Capture</div>
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
          {error && <div className="muted" style={{ color: '#b91c1c' }}>{error}</div>}
          {success && <div className="muted" style={{ color: '#15803d' }}>{success}</div>}
          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <button className="button" type="submit">Speichern</button>
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
