/**
 * Wissen: what the assistant remembers about you and the people you told it about.
 * Everything here can be read, changed and deleted; the chat only proposes, you decide.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { IconArrowLeft, IconPencil, IconX } from '../components/Icons';
import {
  type Memory,
  type Person,
  listMemories,
  addMemory,
  saveMemory,
  deleteMemory,
  listPeople,
  savePerson,
  deletePerson,
  newPerson,
  withNote,
  sameName,
  MEMORY_MAX,
  NAME_MAX,
  ABOUT_MAX,
  NOTE_MAX,
} from '../utils/knowledge';
import styles from './WissenScreen.module.css';

const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const WissenScreen: React.FC = () => {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || '';
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newFact, setNewFact] = useState('');
  const [editFact, setEditFact] = useState<{ id: string; text: string } | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAbout, setNewAbout] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let gone = false;
    Promise.all([listMemories(uid), listPeople(uid)])
      .then(([m, p]) => {
        if (gone) return;
        setMemories(m);
        setPeople(p);
      })
      .catch(() => !gone && setError('Konnte dein Wissen nicht laden. Versuch es gleich nochmal.'));
    return () => {
      gone = true;
    };
  }, [uid]);

  /** run a change, show a plain error if it fails */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message && !/firebase|permission/i.test(e.message) ? e.message : 'Hat nicht geklappt, bitte nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const addFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    run(async () => {
      const { memory, existed } = await addMemory(uid, newFact, 'manual');
      if (!existed) setMemories((m) => [memory, ...(m || [])]);
      setNewFact('');
    });
  };

  const saveFact = (m: Memory) =>
    run(async () => {
      if (!editFact?.text.trim()) return;
      const saved = await saveMemory(uid, editFact.text, m.source, m.id, m.created_at);
      setMemories((list) => (list || []).map((x) => (x.id === m.id ? saved : x)));
      setEditFact(null);
    });

  const removeFact = (m: Memory) => {
    if (!window.confirm(`„${m.text}“ vergessen?`)) return;
    run(async () => {
      await deleteMemory(uid, m.id);
      setMemories((list) => (list || []).filter((x) => x.id !== m.id));
    });
  };

  const forgetAll = () => {
    if (!memories?.length || !window.confirm(`Alle ${memories.length} Einträge über dich vergessen? Personen bleiben.`)) return;
    run(async () => {
      for (const m of memories) await deleteMemory(uid, m.id);
      setMemories([]);
    });
  };

  const putPerson = (p: Person) => setPeople((list) => [...(list || []).filter((x) => x.id !== p.id), p].sort((a, b) => a.name.localeCompare(b.name, 'de')));

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    run(async () => {
      const p = await savePerson(uid, newPerson(newName, newAbout));
      putPerson(p);
      setNewName('');
      setNewAbout('');
      setAddingPerson(false);
      setOpen(p.id);
    });
  };

  const twins = (p: Person) => (people || []).filter((x) => x.id !== p.id && sameName(x.name, p.name)).length > 0;

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        <IconArrowLeft size={16} /> Assistent
      </Link>
      <h1 className={styles.h1}>Wissen</h1>
      <p className={styles.intro}>
        Das kennt der Assistent, wenn du mit ihm schreibst. Er schlägt neue Einträge im Chat vor, gespeichert wird nur, was du übernimmst oder hier einträgst.
      </p>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.section} aria-labelledby="me-h">
        <div className={styles.sectionHead}>
          <h2 id="me-h">Über dich</h2>
          {!!memories?.length && <span className={styles.count}>{memories.length}</span>}
        </div>

        <form className={styles.addRow} onSubmit={addFact}>
          <label htmlFor="new-fact" className="visually-hidden">Neuer Eintrag über dich</label>
          <input id="new-fact" className="input" value={newFact} onChange={(e) => setNewFact(e.target.value)} placeholder="z. B. Geht montags ins Gym" maxLength={MEMORY_MAX} />
          <button className="button" type="submit" disabled={busy || !newFact.trim()}>Merken</button>
        </form>

        {memories === null && !error && <p className={styles.muted}>Wird geladen …</p>}
        {memories?.length === 0 && <p className={styles.muted}>Noch nichts gemerkt. Erzähl dem Assistenten von dir, er schlägt dir vor, was er sich merken soll.</p>}
        {!!memories?.length && (
          <ul className={styles.list}>
            {memories.map((m) => (
              <li key={m.id} className={styles.row}>
                {editFact?.id === m.id ? (
                  <form className={styles.editForm} onSubmit={(e) => { e.preventDefault(); saveFact(m); }}>
                    <label htmlFor={`fact-${m.id}`} className="visually-hidden">Eintrag bearbeiten</label>
                    <textarea id={`fact-${m.id}`} className="input" rows={2} value={editFact.text} maxLength={MEMORY_MAX} onChange={(e) => setEditFact({ id: m.id, text: e.target.value })} autoFocus />
                    <div className={styles.editActions}>
                      <button type="button" className="button secondary" onClick={() => setEditFact(null)}>Abbrechen</button>
                      <button type="submit" className="button" disabled={busy || !editFact.text.trim()}>Speichern</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={styles.rowText}>
                      <p className={styles.text}>{m.text}</p>
                      <p className={styles.meta}>{m.source === 'chat' ? 'aus dem Chat' : 'selbst eingetragen'}{m.created_at ? `, ${dateLabel(m.created_at)}` : ''}</p>
                    </div>
                    <button className={styles.iconBtn} onClick={() => setEditFact({ id: m.id, text: m.text })} aria-label={`„${m.text}“ bearbeiten`} title="Bearbeiten">
                      <IconPencil size={16} />
                    </button>
                    <button className={styles.iconBtn} onClick={() => removeFact(m)} disabled={busy} aria-label={`„${m.text}“ vergessen`} title="Vergessen">
                      <IconX size={16} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {(memories?.length ?? 0) > 1 && (
          <button className={styles.textButton} onClick={forgetAll} disabled={busy}>Alles über dich vergessen</button>
        )}
      </section>

      <section className={styles.section} aria-labelledby="people-h">
        <div className={styles.sectionHead}>
          <h2 id="people-h">Personen</h2>
          {!!people?.length && <span className={styles.count}>{people.length}</span>}
          <button className={styles.headButton} onClick={() => setAddingPerson((a) => !a)} aria-expanded={addingPerson}>
            {addingPerson ? 'Abbrechen' : '+ Person'}
          </button>
        </div>

        {addingPerson && (
          <form className={styles.personForm} onSubmit={addPerson}>
            <label>
              <span>Name</span>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={NAME_MAX} placeholder="z. B. Lena" autoFocus />
            </label>
            <label>
              <span>Wer ist das? (optional)</span>
              <input className="input" value={newAbout} onChange={(e) => setNewAbout(e.target.value)} maxLength={ABOUT_MAX} placeholder="z. B. Kollegin aus dem Praktikum" />
            </label>
            {newName.trim() && (people || []).some((p) => sameName(p.name, newName)) && (
              <p className={styles.hint}>Es gibt schon jemanden mit dem Namen. Eine kurze Beschreibung hilft dem Assistenten, euch auseinanderzuhalten.</p>
            )}
            <button className="button" type="submit" disabled={busy || !newName.trim()}>Anlegen</button>
          </form>
        )}

        {people === null && !error && <p className={styles.muted}>Wird geladen …</p>}
        {people?.length === 0 && !addingPerson && (
          <p className={styles.muted}>Noch keine Personen. Erzählst du im Chat von jemandem, schlägt der Assistent eine Notiz vor, oder du legst sie hier an.</p>
        )}
        {!!people?.length && (
          <ul className={styles.list}>
            {people.map((p) => (
              <PersonRow
                key={p.id}
                p={p}
                open={open === p.id}
                twin={twins(p)}
                busy={busy}
                onToggle={() => setOpen((o) => (o === p.id ? null : p.id))}
                onSave={(next) => run(async () => putPerson(await savePerson(uid, next)))}
                onDelete={() => {
                  if (!window.confirm(`${p.name} mit allen Notizen löschen?`)) return;
                  run(async () => {
                    await deletePerson(uid, p.id);
                    setPeople((list) => (list || []).filter((x) => x.id !== p.id));
                    setOpen(null);
                  });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <p className={styles.footnote}>
        Damit der Assistent das nutzen kann, wird es beim Chatten an den KI-Anbieter geschickt. Notier über andere nur, was du wirklich brauchst. Mehr in der <Link to="/privacy">Datenschutzerklärung</Link>.
      </p>
    </div>
  );
};

const PersonRow: React.FC<{
  p: Person;
  open: boolean;
  twin: boolean;
  busy: boolean;
  onToggle: () => void;
  onSave: (p: Person) => void;
  onDelete: () => void;
}> = ({ p, open, twin, busy, onToggle, onSave, onDelete }) => {
  const [about, setAbout] = useState(p.about);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  useEffect(() => setAbout(p.about), [p.about]);
  const panelId = `person-${p.id}`;

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setNoteError(null);
      onSave(withNote(p, note));
      setNote('');
    } catch (err: any) {
      setNoteError(err.message);
    }
  };

  return (
    <li className={`${styles.person} ${open ? styles.personOpen : ''}`}>
      <button className={styles.personHead} onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
        <span className={styles.avatar} aria-hidden="true">{p.name.trim().charAt(0).toUpperCase()}</span>
        <span className={styles.rowText}>
          <span className={styles.name}>{p.name}</span>
          <span className={styles.meta}>
            {p.about || (twin ? 'ohne Beschreibung' : '')}
            {p.about || twin ? ' · ' : ''}
            {p.notes.length === 1 ? '1 Notiz' : `${p.notes.length} Notizen`}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <div id={panelId} className={styles.personBody}>
          <form className={styles.aboutRow} onSubmit={(e) => { e.preventDefault(); onSave({ ...p, about }); }}>
            <label htmlFor={`about-${p.id}`}>Wer ist das?</label>
            <div className={styles.addRow}>
              <input id={`about-${p.id}`} className="input" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={ABOUT_MAX} placeholder="z. B. Kumpel aus Konstanz" />
              <button className="button secondary" type="submit" disabled={busy || about.trim() === p.about.trim()}>Speichern</button>
            </div>
            {twin && !p.about.trim() && <p className={styles.hint}>Es gibt mehrere Personen mit diesem Namen. Mit einer Beschreibung fragt der Assistent gezielt nach.</p>}
          </form>

          <form className={styles.noteForm} onSubmit={addNote}>
            <label htmlFor={`note-${p.id}`} className="visually-hidden">Neue Notiz zu {p.name}</label>
            <textarea id={`note-${p.id}`} className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} placeholder={`Neue Notiz zu ${p.name}`} />
            <button className="button" type="submit" disabled={busy || !note.trim()}>Notiz hinzufügen</button>
            {noteError && <p className={styles.error} role="alert">{noteError}</p>}
          </form>

          {p.notes.length === 0 ? (
            <p className={styles.muted}>Noch keine Notizen.</p>
          ) : (
            <ul className={styles.notes} aria-label={`Notizen zu ${p.name}`}>
              {p.notes.map((n) => (
                <li key={n.id} className={styles.note}>
                  <div className={styles.rowText}>
                    <p className={styles.text}>{n.text}</p>
                    {n.created_at && <p className={styles.meta}>{dateLabel(n.created_at)}</p>}
                  </div>
                  <button
                    className={styles.iconBtn}
                    onClick={() => window.confirm('Notiz löschen?') && onSave({ ...p, notes: p.notes.filter((x) => x.id !== n.id) })}
                    disabled={busy}
                    aria-label={`Notiz „${n.text.slice(0, 40)}“ löschen`}
                    title="Löschen"
                  >
                    <IconX size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className={styles.danger} onClick={onDelete} disabled={busy}>{p.name} löschen</button>
        </div>
      )}
    </li>
  );
};
