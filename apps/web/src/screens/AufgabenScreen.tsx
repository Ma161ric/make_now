/**
 * Two pages from one component:
 * - Inbox (mode="inbox"): write or speak what is on your mind; what the AI
 *   recognises shows up right below, confirm with ✓ or drop with ×.
 * - Aufgaben (mode="tasks"): the list, Heute (times from the calendar) and
 *   Später, done/undone with one tap, tap a task to edit / plan / delete.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task, Importance } from '@make-now/core';
import { useAuth } from '../auth/authContext';
import { useTasksSync } from '../hooks/useSyncEffect';
import { saveTask, updateTaskStatus } from '../storage';
import { extractFromNoteCloud } from '../firebase/functionsService';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { MicButton } from '../components/MicButton';
import { IconArrowRight, IconCheck } from '../components/Icons';
import {
  type Suggestion,
  loadSuggestions,
  saveSuggestions,
  onSuggestionsChange,
  fromExtraction,
  suggestionToTask,
  durationLabel,
} from '../utils/suggestions';
import { uuid } from '../utils';
import styles from './AufgabenScreen.module.css';

const OPEN = new Set(['open', 'scheduled', 'in_progress']);
const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
const AUTO_KEY = (uid: string) => `dayflow_auto_accept_${uid}`;

const toDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

function normalize(raw: any): Task | null {
  if (!raw?.title || (raw.type && raw.type !== 'task')) return null;
  return {
    ...raw,
    importance: raw.importance || 'medium',
    estimation_source: raw.estimation_source || 'default',
    created_at: toDate(raw.created_at) || new Date(0),
    updated_at: toDate(raw.updated_at) || new Date(0),
    due_at: toDate(raw.due_at),
    completed_at: toDate(raw.completed_at),
  } as Task;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const dueLabel = (d?: Date) => (d ? `bis ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}` : '');
const IMPORTANCE: Record<Importance, string> = { high: 'wichtig', medium: 'normal', low: 'unwichtig' };

const TasksAndInbox: React.FC<{ mode: 'inbox' | 'tasks' }> = ({ mode }) => {
  const { user, firebaseUser } = useAuth();
  const uid = user?.id || '';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [todayTimes, setTodayTimes] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => (uid ? loadSuggestions(uid) : []));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [autoAccept, setAutoAccept] = useState(() => (uid ? localStorage.getItem(AUTO_KEY(uid)) === '1' : false));

  // Tasks live from Firestore
  const onTasks = useCallback((raw: any[]) => {
    setTasks(raw.map(normalize).filter(Boolean) as Task[]);
    setLoaded(true);
  }, []);
  useTasksSync(onTasks, { user: firebaseUser, enabled: !!firebaseUser });

  // Suggestions (shared with the capture field on "Heute")
  useEffect(() => {
    if (!uid) return;
    setSuggestions(loadSuggestions(uid));
    setAutoAccept(localStorage.getItem(AUTO_KEY(uid)) === '1');
    return onSuggestionsChange(() => setSuggestions(loadSuggestions(uid)));
  }, [uid]);

  // Today's planned times from the calendar
  const loadToday = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/calendar/today`, { headers: await authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const map: Record<string, string> = {};
      for (const i of json.items || []) if (i.task_id) map[i.task_id] = i.start;
      setTodayTimes(map);
    } catch {
      /* calendar is optional here */
    }
  }, []);
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage((cur) => (cur === m ? null : cur)), 4000);
  };

  const setSugg = (list: Suggestion[]) => {
    setSuggestions(list);
    saveSuggestions(uid, list);
  };

  const accept = async (s: Suggestion) => {
    try {
      await saveTask(uid, suggestionToTask(s), firebaseUser);
      setSugg(loadSuggestions(uid).filter((x) => x.id !== s.id));
    } catch (e: any) {
      flash(`Konnte nicht speichern: ${e.message}`);
    }
  };
  const drop = (s: Suggestion) => setSugg(suggestions.filter((x) => x.id !== s.id));
  const editSuggestion = (id: string, patch: Partial<Suggestion>) => setSugg(suggestions.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const note = text.trim();
    if (!note || busy) return;
    setBusy(true);
    try {
      const extraction = await extractFromNoteCloud(note);
      let found = fromExtraction(extraction, note);
      if (!found.length) {
        // AI found nothing: keep the note as one task so nothing gets lost
        found = [{ id: uuid(), kind: 'task', title: note.slice(0, 200), duration_min_minutes: 15, duration_max_minutes: 30, importance: 'medium', source: note, created_at: new Date().toISOString() }];
      }
      setText('');
      if (autoAccept) {
        for (const s of found) await saveTask(uid, suggestionToTask(s), firebaseUser);
        flash(`${found.length} ${found.length === 1 ? 'Aufgabe' : 'Aufgaben'} angelegt.`);
      } else {
        setSugg([...found, ...loadSuggestions(uid)]);
      }
    } catch (err: any) {
      flash(`Das hat nicht geklappt: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = () => {
    const next = !autoAccept;
    setAutoAccept(next);
    localStorage.setItem(AUTO_KEY(uid), next ? '1' : '0');
  };

  const toggleDone = async (t: Task) => {
    const next = t.status === 'done' ? 'open' : 'done';
    setTasks((list) => list.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    try {
      await updateTaskStatus(uid, t.id, next, firebaseUser);
    } catch (e: any) {
      flash(`Konnte nicht speichern: ${e.message}`);
    }
  };

  const saveEdit = async (t: Task, patch: Partial<Task>) => {
    try {
      await saveTask(uid, { ...t, ...patch, updated_at: new Date() }, firebaseUser);
      setExpanded(null);
    } catch (e: any) {
      flash(`Konnte nicht speichern: ${e.message}`);
    }
  };

  const remove = async (t: Task) => {
    if (!window.confirm(`„${t.title}“ löschen?`)) return;
    await updateTaskStatus(uid, t.id, 'cancelled', firebaseUser).catch((e) => flash(e.message));
    setExpanded(null);
  };

  const planToday = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/calendar/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ day: 'today' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Planen fehlgeschlagen');
      await loadToday();
      flash(json.blocks?.length ? `Heute eingeplant: ${json.blocks.length} ${json.blocks.length === 1 ? 'Aufgabe' : 'Aufgaben'}.` : 'Heute ist kein Platz mehr frei.');
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const q = query.trim().toLowerCase();
  const matching = useMemo(() => (q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : tasks), [tasks, q]);
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const now = new Date();
    try {
      await saveTask(uid, { id: uuid(), title, status: 'open', created_at: now, updated_at: now, duration_min_minutes: 30, duration_max_minutes: 30, estimation_source: 'default', importance: 'medium' }, firebaseUser);
      setNewTitle('');
      setAdding(false);
    } catch (err: any) {
      flash(`Konnte nicht speichern: ${err.message}`);
    }
  };

  const open = useMemo(() => matching.filter((t) => OPEN.has(t.status)), [matching]);
  const done = useMemo(
    () => matching.filter((t) => t.status === 'done').sort((a, b) => (b.completed_at?.getTime() || 0) - (a.completed_at?.getTime() || 0)),
    [tasks]
  );
  const today = useMemo(
    () => open.filter((t) => todayTimes[t.id]).sort((a, b) => todayTimes[a.id].localeCompare(todayTimes[b.id])),
    [open, todayTimes]
  );
  const later = useMemo(() => {
    const rank: Record<Importance, number> = { high: 0, medium: 1, low: 2 };
    return open
      .filter((t) => !todayTimes[t.id])
      .sort((a, b) => (a.due_at?.getTime() ?? Infinity) - (b.due_at?.getTime() ?? Infinity) || rank[a.importance] - rank[b.importance]);
  }, [open, todayTimes]);

  const renderTask = (t: Task, meta: string) => (
    <li key={t.id} className={styles.taskItem}>
      <div className={styles.taskRow}>
        <button
          className={`${styles.check} ${t.status === 'done' ? styles.checked : ''}`}
          onClick={() => toggleDone(t)}
          aria-label={t.status === 'done' ? `„${t.title}“ wieder öffnen` : `„${t.title}“ erledigt`}
          aria-pressed={t.status === 'done'}
        >
          {t.status === 'done' && <IconCheck size={14} />}
        </button>
        <button className={styles.taskMain} onClick={() => setExpanded(expanded === t.id ? null : t.id)} aria-expanded={expanded === t.id}>
          <span className={`${styles.taskTitle} ${t.status === 'done' ? styles.doneTitle : ''}`}>{t.title}</span>
          <span className={styles.taskMeta}>{meta}</span>
        </button>
        {t.importance === 'high' && t.status !== 'done' && <span className={styles.tag}>wichtig</span>}
      </div>
      {expanded === t.id && <TaskEditor task={t} onSave={(p) => saveEdit(t, p)} onDelete={() => remove(t)} onPlanToday={planToday} busy={busy} />}
    </li>
  );

  if (mode === 'inbox') {
    return (
      <div className={styles.page}>
        <div>
          <h1 className={styles.h1}>Was geht dir durch den Kopf?</h1>
          <p className={styles.lead}>Einfach reinschreiben oder sprechen. DayFlow macht Aufgaben daraus.</p>
        </div>
      <form className={styles.capture} onSubmit={submit}>
        <label htmlFor="capture" className="visually-hidden">Was steht an?</label>
        <textarea
          id="capture"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Was steht an? Schreiben oder sprechen …"
          rows={2}
          maxLength={2000}
          disabled={busy}
        />
        <div className={styles.captureActions}>
          <MicButton onText={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} onError={flash} className={styles.captureMic} />
          <button type="submit" className={styles.captureSend} disabled={!text.trim() || busy} aria-label="In Aufgaben umwandeln">
            {busy ? <span className={styles.dots}>…</span> : <IconArrowRight size={18} />}
          </button>
        </div>
      </form>

      {message && <p className={styles.message} role="status">{message}</p>}

      {suggestions.length > 0 && (
        <section className={styles.card} aria-label="Neu erkannt">
          <div className={styles.cardHeader}>
            <h2>Neu erkannt</h2>
            <label className={styles.auto}>
              <input type="checkbox" checked={autoAccept} onChange={toggleAuto} /> künftig automatisch übernehmen
            </label>
          </div>
          <ul className={styles.list}>
            {suggestions.map((s) => (
              <li key={s.id} className={styles.suggestion}>
                <span className={styles.newTag}>{s.kind === 'event' ? 'Termin' : s.kind === 'idea' ? 'Idee' : 'neu'}</span>
                <div className={styles.suggestionMain}>
                  <input
                    className={styles.inlineInput}
                    value={s.title}
                    onChange={(e) => editSuggestion(s.id, { title: e.target.value })}
                    aria-label="Titel"
                    maxLength={200}
                  />
                  <span className={styles.taskMeta}>
                    <select
                      className={styles.inlineSelect}
                      value={s.duration_max_minutes}
                      onChange={(e) => editSuggestion(s.id, { duration_min_minutes: Number(e.target.value), duration_max_minutes: Number(e.target.value) })}
                      aria-label="Dauer"
                    >
                      {[...new Set([...DURATIONS, s.duration_max_minutes])].sort((a, b) => a - b).map((m) => (
                        <option key={m} value={m}>{durationLabel(m, m)}</option>
                      ))}
                    </select>
                    {s.due_at && ` · ${dueLabel(new Date(s.due_at))}`}
                  </span>
                </div>
                <button className={styles.iconAccept} onClick={() => accept(s)} aria-label={`„${s.title}“ übernehmen`}>
                  <IconCheck size={16} />
                </button>
                <button className={styles.iconDrop} onClick={() => drop(s)} aria-label={`„${s.title}“ verwerfen`}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

        {suggestions.length === 0 && !busy && (
          <p className={styles.hint}>
            {open.length ? `${open.length} offene ${open.length === 1 ? 'Aufgabe' : 'Aufgaben'}` : 'Noch keine offenen Aufgaben'} ·{' '}
            <Link to="/tasks">Zu den Aufgaben</Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.h1}>Aufgaben</h1>
        <button className="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          + Neue Aufgabe
        </button>
      </div>

      {adding && (
        <form className={styles.addForm} onSubmit={addTask}>
          <label htmlFor="new-task" className="visually-hidden">Titel der neuen Aufgabe</label>
          <input id="new-task" className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titel, z. B. Zahnarzt anrufen" maxLength={200} autoFocus />
          <button className="button" type="submit" disabled={!newTitle.trim()}>Anlegen</button>
        </form>
      )}

      {message && <p className={styles.message} role="status">{message}</p>}

      <div className={styles.filterRow}>
        <label htmlFor="task-search" className="visually-hidden">Aufgaben durchsuchen</label>
        <input id="task-search" className={`input ${styles.search}`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …" />
        <div className={styles.tabs} role="tablist" aria-label="Filter">
        <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? styles.tabActive : styles.tab} onClick={() => setTab('open')}>
          Offen {open.length}
        </button>
        <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? styles.tabActive : styles.tab} onClick={() => setTab('done')}>
          Erledigt {done.length}
        </button>
        </div>
      </div>

      <section className={styles.card}>
        {!loaded ? (
          <p className={styles.empty}>Lade …</p>
        ) : tab === 'open' ? (
          open.length === 0 ? (
            <p className={styles.empty}>Nichts offen. Schreib oben, was ansteht.</p>
          ) : (
            <>
              {today.length > 0 && (
                <>
                  <h2 className={styles.groupTitle}>Heute</h2>
                  <ul className={styles.list}>{today.map((t) => renderTask(t, `${hhmm(todayTimes[t.id])} · ${durationLabel(t.duration_min_minutes, t.duration_max_minutes)}`))}</ul>
                </>
              )}
              {later.length > 0 && (
                <>
                  <h2 className={styles.groupTitle}>{today.length ? 'Später' : 'Offen'}</h2>
                  <ul className={styles.list}>
                    {later.map((t) => renderTask(t, [durationLabel(t.duration_min_minutes, t.duration_max_minutes), dueLabel(t.due_at)].filter(Boolean).join(' · ')))}
                  </ul>
                </>
              )}
            </>
          )
        ) : done.length === 0 ? (
          <p className={styles.empty}>Noch nichts erledigt.</p>
        ) : (
          <ul className={styles.list}>
            {done.slice(0, 50).map((t) => renderTask(t, t.completed_at ? `erledigt am ${t.completed_at.toLocaleDateString('de-DE')}` : 'erledigt'))}
          </ul>
        )}
      </section>
    </div>
  );
};

export const AufgabenScreen: React.FC = () => <TasksAndInbox mode="tasks" />;

const TaskEditor: React.FC<{
  task: Task;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onPlanToday: () => void;
  busy: boolean;
}> = ({ task, onSave, onDelete, onPlanToday, busy }) => {
  const [title, setTitle] = useState(task.title);
  const [minutes, setMinutes] = useState(task.duration_max_minutes || task.duration_min_minutes || 30);
  const [due, setDue] = useState(task.due_at ? task.due_at.toISOString().slice(0, 10) : '');
  const [importance, setImportance] = useState<Importance>(task.importance || 'medium');
  const id = task.id.slice(0, 8);

  return (
    <div className={styles.editor}>
      <div className={styles.editorGrid}>
        <label htmlFor={`t-${id}`}>Titel</label>
        <input id={`t-${id}`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <label htmlFor={`d-${id}`}>Dauer</label>
        <select id={`d-${id}`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[...new Set([...DURATIONS, minutes])].sort((a, b) => a - b).map((m) => (
            <option key={m} value={m}>{durationLabel(m, m)}</option>
          ))}
        </select>
        <label htmlFor={`f-${id}`}>Frist</label>
        <input id={`f-${id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <label htmlFor={`i-${id}`}>Wichtigkeit</label>
        <select id={`i-${id}`} value={importance} onChange={(e) => setImportance(e.target.value as Importance)}>
          {(Object.keys(IMPORTANCE) as Importance[]).map((k) => (
            <option key={k} value={k}>{IMPORTANCE[k]}</option>
          ))}
        </select>
      </div>
      <div className={styles.editorActions}>
        <button
          className="button"
          disabled={!title.trim()}
          onClick={() =>
            onSave({
              title: title.trim(),
              duration_min_minutes: minutes,
              duration_max_minutes: minutes,
              due_at: due ? new Date(`${due}T17:00:00`) : undefined,
              importance,
            })
          }
        >
          Speichern
        </button>
        {task.status !== 'done' && (
          <button className="button secondary" onClick={onPlanToday} disabled={busy}>
            Heute noch einplanen
          </button>
        )}
        <button className={styles.deleteButton} onClick={onDelete}>
          Löschen
        </button>
      </div>
    </div>
  );
};

export default AufgabenScreen;
