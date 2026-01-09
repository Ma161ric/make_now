import { FormEvent, useMemo, useState } from 'react';
import { extractFromNoteMock, validateExtraction } from '@make-now/core';
import { addNote, listNotes } from '../storage';
import { uuid } from '../utils';
import { Link } from 'react-router-dom';

export default function InboxScreen() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const notes = useMemo(() => listNotes(), [text, success]);

  const handleSubmit = (e: FormEvent) => {
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
    addNote(
      {
        id: noteId,
        raw_text: trimmed,
        created_at: new Date().toISOString(),
        status: 'unprocessed',
      },
      extraction
    );
    setSuccess('Gespeichert. Jetzt prüfen.');
    setText('');
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="section-title">Inbox Capture</div>
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
