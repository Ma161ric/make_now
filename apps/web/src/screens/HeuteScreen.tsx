/**
 * "Heute" (Dark Focus): one big card for what is happening right now,
 * a timeline of the rest of the day, and one input to jot something down.
 * Data comes from the Google Calendar plan (/api/calendar/today).
 * Without a connected calendar it asks to connect one.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { updateTaskStatus, saveTask } from '../storage';
import { extractFromNoteCloud } from '../firebase/functionsService';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { IconArrowRight, IconX } from '../components/Icons';
import { MicButton } from '../components/MicButton';
import { loadSuggestions, saveSuggestions, fromExtraction, suggestionToTask, type Suggestion } from '../utils/suggestions';
import { layoutLanes } from '../utils/lanes';
import { readCache, writeCache } from '../utils/viewCache';
import styles from './HeuteScreen.module.css';

type Kind = 'task' | 'sport' | 'free' | 'event' | 'busy';

interface Item {
  id?: string;
  start: string;
  end: string;
  kind: Kind;
  title: string;
  task_id?: string;
  location?: string;
  /** moved by hand: DayFlow leaves it where it is */
  pinned?: boolean;
  /** overlaps this appointment */
  conflict?: string;
  /** free gap: a suggestion what to do */
  idea?: string;
  done?: boolean;
}

interface Timeline {
  connected: boolean;
  status?: 'ok' | 'needs_reauth';
  needs_upgrade?: boolean;
  provider?: 'google' | 'local';
  undo?: { label: string; at: string } | null;
  evening_review?: boolean;
  tomorrow_first?: { title: string; start: string } | null;
  date?: string;
  window?: { start: string; end: string };
  all_day?: string[];
  items: Item[];
}

const MIN = 60_000;
/** Rückgängig is offered right after a change, not all day */
const UNDO_VISIBLE_MS = 15 * MIN;
const PX_PER_MIN = 0.9;
/** Phones: a bit more compact, the day should not need endless scrolling */
const pxPerMin = () => (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches ? 0.7 : PX_PER_MIN);

const hhmm = (d: Date | string) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** long titles in running text: cut after a few words */
const short = (t: string, max = 60) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

const KIND_LABEL: Record<Kind, string> = { task: 'Aufgabe', sport: 'Sport', free: 'Frei', event: 'Termin', busy: 'Termin' };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/calendar/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
  return json as T;
}

export const HeuteScreen: React.FC = () => {
  const { user, firebaseUser } = useAuth();
  const [timeline, setTimeline] = useState<Timeline | null>(() => {
    const cached = readCache<Timeline>('today');
    // only today's cached plan is useful
    return cached && cached.date === new Date().toLocaleDateString('en-CA') ? cached : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  // one-time hint that blocks can be tapped
  const [hintSeen, setHintSeen] = useState(() => {
    try { return localStorage.getItem('dayflow-hint-move') === '1'; } catch { return true; }
  });
  const hideMoveHint = () => {
    setHintSeen(true);
    try { localStorage.setItem('dayflow-hint-move', '1'); } catch { /* ignore */ }
  };
  const [note, setNote] = useState('');
  const [noteState, setNoteState] = useState<{ kind: 'saving' | 'saved' | 'error'; count?: number } | null>(null);
  // what the last note turned into: confirm it right here instead of in the Assistent
  const [captured, setCaptured] = useState<Suggestion[]>([]);
  const [capBusy, setCapBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const fresh = await api<Timeline>('today');
      setTimeline(fresh);
      writeCache('today', fresh);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const refresh = setInterval(load, 5 * MIN);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(refresh);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const items = timeline?.items || [];
  const t = now.getTime();

  // What is happening right now: own blocks win over other appointments
  const current = useMemo(() => {
    const running = items.filter((i) => new Date(i.start).getTime() <= t && t < new Date(i.end).getTime());
    return running.find((i) => i.kind !== 'busy' && i.kind !== 'event') || running[0] || null;
  }, [items, t]);
  const next = useMemo(
    () => items.find((i) => i.kind !== 'free' && new Date(i.start).getTime() > t && i !== current) || null,
    [items, t, current]
  );

  // done = marked here or already done on the server
  const isDone = useCallback((i: Item) => !!i.task_id && (!!i.done || done.has(i.task_id)), [done]);
  const doneIds = useMemo(() => new Set(items.filter(isDone).map((i) => i.task_id!)), [items, isDone]);

  // How the day is going: planned task blocks vs. done
  const dayStatus = useMemo(() => {
    const tasks = new Map<string, number>(); // task id -> end of its last block
    for (const i of items) if (i.kind === 'task' && i.task_id) tasks.set(i.task_id, Math.max(tasks.get(i.task_id) || 0, new Date(i.end).getTime()));
    if (!tasks.size) return null;
    let doneCount = 0;
    let missed = 0;
    for (const [id, end] of tasks) {
      if (doneIds.has(id)) doneCount++;
      else if (end <= t) missed++;
    }
    const base = `${doneCount} von ${tasks.size} erledigt`;
    if (doneCount === tasks.size) return { text: 'Alles erledigt für heute', ok: true };
    return missed ? { text: `${base} · ${missed} offen geblieben`, ok: false } : { text: `${base} · im Zeitplan`, ok: true };
  }, [items, doneIds, t]);

  // Evening: ask what got done. From 19:00, or earlier once every planned task is over.
  const reviewKey = `dayflow-review-${timeline?.date || ''}`;
  const [answered, setAnswered] = useState<string[]>([]);
  useEffect(() => {
    try {
      setAnswered(JSON.parse(localStorage.getItem(reviewKey) || '[]'));
    } catch {
      setAnswered([]);
    }
  }, [reviewKey]);
  const answer = (id: string) => {
    setAnswered((a) => {
      const next = [...a, id];
      try { localStorage.setItem(reviewKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const review = useMemo(() => {
    if (!timeline?.evening_review || answered.includes('closed')) return [];
    const tasks = new Map<string, Item>(); // first block of each task, with its last end
    let lastEnd = 0;
    for (const i of items) {
      if (i.kind !== 'task' || !i.task_id) continue;
      lastEnd = Math.max(lastEnd, new Date(i.end).getTime());
      if (!tasks.has(i.task_id)) tasks.set(i.task_id, i);
    }
    const hour = new Date(t).getHours();
    const evening = hour >= 19 || (hour >= 16 && lastEnd > 0 && lastEnd <= t);
    if (!evening) return [];
    return [...tasks.values()].filter((i) => new Date(i.start).getTime() <= t && !doneIds.has(i.task_id!) && !answered.includes(i.task_id!));
  }, [timeline?.evening_review, answered, items, t, doneIds]);

  const showMoveHint = !hintSeen && items.some((i) => i.id && i.kind !== 'free' && new Date(i.end).getTime() > t);

  const conflicts = useMemo(
    () => items.filter((i) => i.conflict && i.task_id && new Date(i.end).getTime() > t && !doneIds.has(i.task_id)),
    [items, t, doneIds]
  );

  const reconnect = async () => {
    try {
      const { url } = await api<{ url: string }>('connect', { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      window.location.href = url;
    } catch (e: any) {
      setError(e.message);
    }
  };

  const planToday = async () => {
    setBusy(true);
    try {
      await api('plan', { day: 'today' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const markDone = async (item: Item) => {
    if (!item.task_id || !user) return;
    setDone((d) => new Set(d).add(item.task_id!));
    try {
      await updateTaskStatus(user.id, item.task_id, 'done', firebaseUser);
    } catch (e: any) {
      setError(`Konnte nicht speichern: ${e.message}`);
    }
    // the real finishing time, so DayFlow can learn how long things take
    api('done', { task_id: item.task_id }).catch(() => {});
  };

  const missed = (item: Item) => {
    if (!item.task_id) return;
    answer(item.task_id);
    api('missed', { task_id: item.task_id }).catch(() => {});
  };

  const forget = (id: string) => {
    if (!user) return;
    saveSuggestions(user.id, loadSuggestions(user.id).filter((x) => x.id !== id));
    setCaptured((c) => c.filter((x) => x.id !== id));
  };

  /** take a captured suggestion: event → plan/calendar, task → Aufgaben (and optionally into today) */
  const takeCaptured = async (sg: Suggestion, today: boolean) => {
    if (!user) return;
    setCapBusy(sg.id);
    setError(null);
    try {
      if (sg.kind === 'event' && sg.start_at) {
        const end = sg.end_at || new Date(new Date(sg.start_at).getTime() + (sg.duration_min_minutes || 60) * MIN).toISOString();
        await api('event', { title: sg.title, start_at: sg.start_at, end_at: end, location: sg.location });
        setInfo(`„${sg.title}“ steht um ${hhmm(sg.start_at)} im Plan.`);
      } else {
        const task = suggestionToTask(sg);
        await saveTask(user.id, task, firebaseUser);
        if (today) {
          const r = await api<{ placed: boolean; start?: string; end?: string }>('place', {
            task_id: task.id,
            title: task.title,
            minutes: task.duration_max_minutes || task.duration_min_minutes || 30,
          });
          setInfo(r.placed && r.start ? `„${sg.title}“ ist heute um ${hhmm(r.start)} eingeplant.` : `Heute ist keine Lücke mehr frei. „${sg.title}“ kommt morgen dran.`);
        } else {
          setInfo(`„${sg.title}“ ist in Aufgaben.`);
        }
      }
      forget(sg.id);
      if (sg.kind === 'event' || today) await load();
    } catch (e: any) {
      setError(`Konnte nicht übernommen werden: ${e.message}`);
    } finally {
      setCapBusy(null);
    }
  };

  const startLocal = async () => {
    setBusy(true);
    try {
      await api('local', { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    setMoving(true);
    try {
      await api('undo', {});
      setInfo('Rückgängig gemacht.');
      await load();
    } catch (e: any) {
      setError(`Rückgängig hat nicht geklappt: ${e.message}`);
    } finally {
      setMoving(false);
    }
  };

  const resolve = async (item: Item) => {
    if (!item.task_id) return;
    setMoving(true);
    try {
      const r = await api<{ placed: boolean; start?: string }>('resolve', { task_id: item.task_id });
      setInfo(r.placed && r.start ? `„${item.title}“ ist jetzt um ${hhmm(r.start)}.` : `„${item.title}“ passt heute nicht mehr. Kommt morgen dran.`);
      await load();
    } catch (e: any) {
      setError(`Verschieben hat nicht geklappt: ${e.message}`);
    } finally {
      setMoving(false);
    }
  };

  // "Brauche länger": block gets longer, later DayFlow blocks move back
  const moveTo = async (item: Item, change: { start: Date } | { remove: true }) => {
    if (!item.id) return;
    setMoving(true);
    try {
      const r = await api<{ start?: string }>('move', 'remove' in change ? { id: item.id, remove: true } : { id: item.id, start: change.start.toISOString() });
      setInfo('remove' in change ? `„${item.title}“ ist für heute raus.` : `„${item.title}“ ist jetzt um ${hhmm(r.start || change.start)}. DayFlow lässt den Block dort.`);
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(`Verschieben hat nicht geklappt: ${e.message}`);
    } finally {
      setMoving(false);
    }
  };

  const extend = async (item: Item, minutes: number) => {
    if (!item.task_id) return;
    setMoving(true);
    setError(null);
    try {
      const r = await api<{ end: string; added: number; moved: number; dropped: string[] }>('extend', { task_id: item.task_id, minutes });
      const parts = [
        r.added > 0
          ? `„${item.title}“ geht jetzt bis ${hhmm(r.end)}.`
          : `Länger geht nicht, danach kommt ein Termin aus deinem Kalender.`,
      ];
      if (r.added > 0 && r.added < minutes) parts.push(`Nur ${r.added} min, danach kommt ein Termin.`);
      if (r.moved > 0) parts.push(`${r.moved} ${r.moved === 1 ? 'Block ist' : 'Blöcke sind'} nach hinten gerutscht.`);
      if (r.dropped.length) parts.push(`Passt heute nicht mehr: ${r.dropped.join(', ')}. Kommt morgen dran.`);
      setInfo(parts.join(' '));
      await load();
    } catch (e: any) {
      setError(`Verlängern hat nicht geklappt: ${e.message}`);
    } finally {
      setMoving(false);
    }
  };

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(null), 5000);
    return () => clearTimeout(t);
  }, [info]);

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text || !user) return;
    setNoteState({ kind: 'saving' });
    try {
      const extraction = await extractFromNoteCloud(text);
      let found = fromExtraction(extraction, text);
      if (!found.length) {
        found = [{ id: crypto.randomUUID(), kind: 'task', title: text.slice(0, 200), duration_min_minutes: 15, duration_max_minutes: 30, importance: 'medium', source: text, created_at: new Date().toISOString() }];
      }
      saveSuggestions(user.id, [...found, ...loadSuggestions(user.id)]);
      setNote('');
      setCaptured((c) => [...found, ...c]);
      setNoteState(null);
    } catch {
      setNoteState({ kind: 'error' });
    }
  };

  if (timeline && !timeline.connected) {
    return (
      <div className={styles.connectHint}>
        <span>
          DayFlow plant deine Aufgaben in die freien Lücken deines Tages. Mit Google Kalender siehst du alles an einem Ort.
          Ohne Google plant DayFlow hier in der App, und du kannst den Plan in jedem Kalender abonnieren, auch auf dem iPhone.
        </span>
        <div className={styles.connectActions}>
          <button className="button" onClick={reconnect} disabled={busy}>Mit Google verbinden</button>
          <button className={`button ${styles.later}`} onClick={startLocal} disabled={busy}>
            {busy ? 'Richte ein …' : 'Ohne Google nutzen'}
          </button>
        </div>
      </div>
    );
  }

  const dateLabel = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={styles.page}>
      <p className={styles.date}>{dateLabel}</p>

      {timeline?.status === 'needs_reauth' && (
        <div className={styles.banner} role="alert">
          Google hat den Kalender-Zugriff beendet. <Link to="/settings">Neu verbinden</Link>
        </div>
      )}
      {timeline?.needs_upgrade && (
        <div className={styles.banner}>
          Damit deine Termine mit Titel und Ort erscheinen, verbinde den Kalender einmal neu.{' '}
          <button className={styles.textButton} onClick={reconnect}>Jetzt verbinden</button>
        </div>
      )}
      {error && timeline && <div className={styles.banner} role="alert">{error}</div>}
      {info && <div className={styles.toast} role="status" onClick={() => setInfo(null)}>{info}</div>}
      {review.length > 0 && (
        <section className={styles.review} aria-labelledby="review-h">
          <div className={styles.reviewHead}>
            <h2 id="review-h">Wie lief dein Tag?</h2>
            <button className={styles.textButton} onClick={() => answer('closed')}>Später</button>
          </div>
          <p className={styles.reviewSub}>Was nicht geschafft ist, plant DayFlow wieder ein.</p>
          <ul className={styles.reviewList}>
            {review.map((i) => (
              <li key={i.task_id} className={styles.reviewItem}>
                <span className={styles.reviewTitle}>{i.title.replace(/ · Teil$/, '')}</span>
                <span className={styles.reviewButtons}>
                  <button className={styles.reviewNo} onClick={() => missed(i)}>Nicht geschafft</button>
                  <button className={styles.reviewYes} onClick={() => { answer(i.task_id!); markDone(i); }}>Geschafft</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {editing && <MoveSheet item={editing} busy={moving} onClose={() => setEditing(null)} onMove={(c) => moveTo(editing, c)} />}
      {conflicts.map((c) => (
        <div key={`c-${c.start}-${c.task_id}`} className={`${styles.banner} ${styles.bannerSlim}`} role="alert">
          <span>„{short(c.title, 40)}“ überschneidet sich mit „{short(c.conflict || '', 30)}“</span>
          <button className={styles.textButton} onClick={() => resolve(c)} disabled={moving}>Verschieben</button>
        </div>
      ))}
      {timeline?.undo && !info && t - new Date(timeline.undo.at).getTime() < UNDO_VISIBLE_MS && (
        <div className={`${styles.banner} ${styles.bannerSlim} ${styles.undoBanner}`} role="status">
          <span>{timeline.undo.label}</span>
          <button className={styles.textButton} onClick={undo} disabled={moving}>Rückgängig</button>
        </div>
      )}

      <div className={styles.layout}>
        <section aria-label="Jetzt" className={styles.nowCard}>
          {!timeline && error ? (
            <div className={styles.nowInner}>
              <div>
                <p className={styles.eyebrow}>Jetzt</p>
                <h1 className={styles.nowTitle}>Dein Tag lädt gerade nicht</h1>
                <p className={styles.nowSub}>Prüf deine Verbindung und versuch es nochmal.</p>
              </div>
              <div className={styles.actions}>
                <button className="button" onClick={() => load()}>Nochmal versuchen</button>
              </div>
            </div>
          ) : !timeline ? (
            <div className={`${styles.nowInner} ${styles.loading}`} aria-busy="true">
              <div>
                <p className={styles.eyebrow}>Jetzt</p>
                <span className="visually-hidden">Lade deinen Tag …</span>
                <div className={styles.skelTitle} />
                <div className={`${styles.skelTitle} ${styles.skelShort}`} />
                <div className={styles.skelLine} />
              </div>
              <div className={styles.nowBottom}>
                <div className={styles.skelCount} />
                <div className={styles.progress} />
              </div>
            </div>
          ) : current ? (
            <NowCard item={current} now={t} next={next} done={isDone(current)} onDone={() => markDone(current)} onExtend={(m) => extend(current, m)} moving={moving} onPlan={planToday} busy={busy} dayStatus={dayStatus} />
          ) : (
            <FreeCard now={t} next={next} onPlan={planToday} busy={busy} dayStatus={dayStatus} window={timeline?.window} tomorrow={timeline?.tomorrow_first || null} />
          )}
        </section>

        <div className={styles.side}>
          <section aria-label="Rest des Tages" className={styles.timelineCard}>
            <div className={styles.timelineHeader}>
              <h2>Rest des Tages</h2>
              <button className={styles.textButton} onClick={planToday} disabled={busy}>
                {busy ? 'Plane …' : 'Neu planen'}
              </button>
            </div>
            {!!timeline?.all_day?.length && (
              <ul className={styles.allDay} aria-label="Ganztägig">
                {timeline.all_day.map((title, i) => (
                  <li key={`${title}-${i}`}>{title}</li>
                ))}
              </ul>
            )}
            {showMoveHint && (
              <p className={styles.moveHint}>
                Tipp: Tipp einen Block an, um ihn zu verschieben.
                <button className={styles.textButton} onClick={hideMoveHint}>Verstanden</button>
              </p>
            )}
            <DayTimeline items={items} now={t} windowEnd={timeline?.window?.end} done={doneIds} onPick={(i) => { hideMoveHint(); setEditing(i); }} />
          </section>

          <div className={styles.captureBox}>
          <form className={styles.capture} onSubmit={saveNote}>
            <label htmlFor="heute-note" className="visually-hidden">Etwas notieren</label>
            <input
              id="heute-note"
              type="text"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteState?.kind !== 'saving') setNoteState(null);
              }}
              placeholder="Etwas notieren …"
              autoComplete="off"
              maxLength={2000}
            />
            <MicButton onText={(t) => setNote((cur) => (cur ? `${cur} ${t}` : t))} onError={(m) => setError(m)} />
            <button type="submit" aria-label="Notiz speichern" disabled={!note.trim() || noteState?.kind === 'saving'}>
              <IconArrowRight size={18} />
            </button>
          </form>
          {noteState && (
            <p className={styles.captureState} role="status">
              {noteState.kind === 'saving' && 'Wird verarbeitet …'}
              {noteState.kind === 'error' && 'Konnte die Notiz nicht speichern. Versuch es nochmal.'}
            </p>
          )}
          {captured.length > 0 && (
            <ul className={styles.captured} aria-label="Erkannt">
              {captured.slice(0, 3).map((sg) => {
                const isEvent = sg.kind === 'event' && !!sg.start_at;
                const busyHere = capBusy === sg.id;
                const mins = sg.duration_max_minutes || sg.duration_min_minutes;
                return (
                  <li key={sg.id} className={`${styles.capItem} ${isEvent ? styles.capEvent : ''}`}>
                    <div className={styles.capText}>
                      <span className={styles.capKind}>{isEvent ? 'Termin' : sg.kind === 'idea' ? 'Idee' : 'To-do'}</span>
                      <span className={styles.capTitle}>{sg.title}</span>
                      <span className={styles.capMeta}>
                        {isEvent ? `${hhmm(sg.start_at!)}${sg.end_at ? ` – ${hhmm(sg.end_at)}` : ''}${sg.location ? ` · ${sg.location}` : ''}` : mins ? duration(mins * MIN) : ''}
                      </span>
                    </div>
                    <div className={styles.capActions}>
                      <button className={styles.capDrop} onClick={() => forget(sg.id)} disabled={busyHere} aria-label={`„${sg.title}“ verwerfen`}>
                        <IconX size={16} />
                      </button>
                      {isEvent ? (
                        <button className={styles.capPrimary} onClick={() => takeCaptured(sg, false)} disabled={busyHere}>
                          {busyHere ? '…' : 'Eintragen'}
                        </button>
                      ) : (
                        <>
                          <button className={styles.capSecondary} onClick={() => takeCaptured(sg, false)} disabled={busyHere}>
                            Aufgabe
                          </button>
                          <button className={styles.capPrimary} onClick={() => takeCaptured(sg, true)} disabled={busyHere}>
                            {busyHere ? '…' : 'Heute einplanen'}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
              {captured.length > 3 && (
                <li className={styles.capMore}>
                  <Link to="/">{captured.length - 3} weitere beim Assistenten</Link>
                </li>
              )}
            </ul>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

type DayStatus = { text: string; ok: boolean } | null;

const StatusLine: React.FC<{ status: DayStatus }> = ({ status }) =>
  status ? <p className={`${styles.dayStatus} ${status.ok ? '' : styles.dayStatusLate}`}>{status.text}</p> : null;

const NowCard: React.FC<{ item: Item; now: number; next: Item | null; done: boolean; onDone: () => void; onExtend: (minutes: number) => void; moving: boolean; onPlan: () => void; busy: boolean; dayStatus: DayStatus }> = ({ item, now, next, done, onDone, onExtend, moving, onPlan, busy, dayStatus }) => {
  const [askLonger, setAskLonger] = React.useState(false);
  const start = new Date(item.start).getTime();
  const end = new Date(item.end).getTime();
  const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const kindClass = item.kind === 'sport' ? styles.sport : item.kind === 'free' ? styles.free : '';

  return (
    <div className={`${styles.nowInner} ${kindClass}`}>
      <div>
        <p className={styles.eyebrow}>
          Jetzt · {hhmm(item.start)} – {hhmm(item.end)}
          {item.pinned && <span className={styles.pinNow} title="Von dir verschoben, DayFlow plant ihn nicht um">fest</span>}
        </p>
        <h1 className={styles.nowTitle}>{item.kind === 'free' ? 'Gerade frei' : item.title}</h1>
        <p className={styles.nowSub}>
          {item.kind === 'free' && (item.idea ? `Idee: ${item.idea}. ` : 'Die Zeit gehört dir. ')}
          {item.kind === 'busy' && 'Termin aus deinem Kalender. '}
          {item.kind === 'event' && item.location && `Ort: ${item.location}. `}
          {next ? `Danach: ${short(next.title)} um ${hhmm(next.start)}.` : 'Danach ist nichts mehr geplant.'}
        </p>
      </div>
      <div className={styles.nowBottom}>
        <div className={styles.countdown}>
          <span className={styles.countdownValue}>{countdown(end - now)}</span>
          <span className={styles.muted}>verbleibend</span>
        </div>
        <div className={styles.progress} role="progressbar" aria-label={`${KIND_LABEL[item.kind]}: Fortschritt`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${progress}%` }} />
        </div>
        {item.kind === 'task' && (
          <div className={styles.actions}>
            {done ? (
              <span className={styles.doneLabel}>
                <svg className={styles.doneCheck} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M7 12.5l3.2 3.2L17 9" />
                </svg>
                Erledigt
              </span>
            ) : (
              <>
                <button className="button" onClick={onDone} disabled={moving}>
                  Erledigt
                </button>
                {askLonger ? (
                  [15, 30, 60].map((m) => (
                    <button key={m} className={`button ${styles.later}`} disabled={moving} onClick={() => { onExtend(m); setAskLonger(false); }}>
                      +{m} min
                    </button>
                  ))
                ) : (
                  <button className={`button ${styles.later}`} onClick={() => setAskLonger(true)} disabled={moving}>
                    {moving ? 'Verschiebe …' : 'Brauche länger'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {item.kind === 'free' && !next && (
          <div className={styles.actions}>
            <button className="button" onClick={onPlan} disabled={busy}>
              {busy ? 'Plane …' : 'Rest von heute planen'}
            </button>
          </div>
        )}
        <StatusLine status={dayStatus} />
      </div>
    </div>
  );
};

const FreeCard: React.FC<{
  now: number;
  next: Item | null;
  onPlan: () => void;
  busy: boolean;
  dayStatus: DayStatus;
  window?: { start: string; end: string };
  tomorrow: { title: string; start: string } | null;
}> = ({ now, next, onPlan, busy, dayStatus, window: win, tomorrow }) => {
  const winStart = win ? new Date(win.start).getTime() : 0;
  const winEnd = win ? new Date(win.end).getTime() : Infinity;
  // Outside the planning window there is no point in counting down hours
  if (win && now >= winEnd) {
    return (
      <div className={styles.nowInner}>
        <div>
          <p className={styles.eyebrow}>Heute</p>
          <h1 className={styles.nowTitle}>Feierabend</h1>
          <p className={styles.nowSub}>
            {next ? `Später steht noch ${short(next.title)} um ${hhmm(next.start)} an. ` : 'Für heute ist alles erledigt oder verplant. '}
            {tomorrow && `Morgen geht es um ${hhmm(tomorrow.start)} los mit ${short(tomorrow.title)}.`}
          </p>
        </div>
        <div className={styles.nowBottom}>
          <StatusLine status={dayStatus} />
        </div>
      </div>
    );
  }
  if (win && now < winStart && next && new Date(next.start).getTime() - now > 2 * 60 * MIN) {
    const hour = new Date(now).getHours();
    return (
      <div className={styles.nowInner}>
        <div>
          <p className={styles.eyebrow}>Heute</p>
          <h1 className={styles.nowTitle}>{hour < 5 ? 'Gute Nacht' : 'Guten Morgen'}</h1>
          <p className={styles.nowSub}>Dein Tag startet um {hhmm(next.start)} mit {short(next.title)}.</p>
        </div>
        <div className={styles.nowBottom}>
          <StatusLine status={dayStatus} />
        </div>
      </div>
    );
  }
  return (
  <div className={styles.nowInner}>
    <div>
      <p className={styles.eyebrow}>Jetzt</p>
      <h1 className={styles.nowTitle}>{next ? 'Gerade frei' : 'Für heute ist nichts mehr geplant'}</h1>
      <p className={styles.nowSub}>
        {next ? `Als Nächstes: ${short(next.title)} um ${hhmm(next.start)}.` : 'Hast du noch Zeit? DayFlow kann den Rest des Tages mit offenen Aufgaben füllen.'}
      </p>
    </div>
    <div className={styles.nowBottom}>
      {next ? (
        <div className={styles.countdown}>
          <span className={styles.countdownValue}>{countdown(new Date(next.start).getTime() - now)}</span>
          <span className={styles.muted}>bis zum nächsten Block</span>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className="button" onClick={onPlan} disabled={busy}>
            {busy ? 'Plane …' : 'Rest von heute planen'}
          </button>
        </div>
      )}
      <StatusLine status={dayStatus} />
    </div>
  </div>
  );
};

const toTimeValue = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const MoveSheet: React.FC<{ item: Item; busy: boolean; onClose: () => void; onMove: (c: { start: Date } | { remove: true }) => void }> = ({ item, busy, onClose, onMove }) => {
  const original = new Date(item.start);
  const length = new Date(item.end).getTime() - original.getTime();
  const [time, setTime] = useState(toTimeValue(original));
  const startFor = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    const d = new Date(original);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const shift = (minutes: number) => setTime(toTimeValue(new Date(startFor(time).getTime() + minutes * MIN)));
  const start = startFor(time);
  const changed = start.getTime() !== original.getTime();
  const isPlan = item.kind === 'task' || item.kind === 'sport';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`„${item.title}“ verschieben`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetGrip} aria-hidden="true" />
        <h2 className={styles.sheetTitle}>{item.title}</h2>
        <p className={styles.sheetSub}>
          {hhmm(original)} – {hhmm(item.end)}
          {isPlan && ' · Verschobene Blöcke plant DayFlow nicht mehr um.'}
        </p>
        <div className={styles.timeRow}>
          <button className={styles.stepButton} onClick={() => shift(-15)} disabled={busy} aria-label="15 Minuten früher">−15</button>
          <input className={styles.timeInput} type="time" step={300} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Neue Startzeit" disabled={busy} />
          <button className={styles.stepButton} onClick={() => shift(15)} disabled={busy} aria-label="15 Minuten später">+15</button>
        </div>
        <p className={styles.sheetSub}>bis {hhmm(new Date(start.getTime() + length))}</p>
        <div className={styles.sheetActions}>
          {isPlan ? (
            <button className={styles.sheetSecondary} onClick={() => onMove({ remove: true })} disabled={busy}>Heute nicht mehr</button>
          ) : (
            <button className={styles.sheetSecondary} onClick={onClose} disabled={busy}>Abbrechen</button>
          )}
          <button className={styles.sheetPrimary} onClick={() => onMove({ start })} disabled={busy || !changed}>
            {busy ? 'Speichere …' : 'Verschieben'}
          </button>
        </div>
      </div>
    </div>
  );
};

const DayTimeline: React.FC<{ items: Item[]; now: number; windowEnd?: string; done: Set<string>; onPick: (i: Item) => void }> = ({ items, now, windowEnd, done, onPick }) => {
  const PPM = pxPerMin();
  const upcoming = items.filter((i) => new Date(i.end).getTime() > now);
  if (!upcoming.length) {
    return <p className={styles.empty}>Für den Rest des Tages ist nichts eingetragen.</p>;
  }

  // From the current full hour (or shortly before the first block, if that is
  // much later, e.g. at night) to the end of the planning window / last block
  const firstStart = Math.min(...upcoming.map((i) => new Date(i.start).getTime()));
  const from = new Date(Math.max(now, firstStart - 30 * MIN));
  from.setMinutes(0, 0, 0);
  const fromT = from.getTime();
  const lastEnd = Math.max(...upcoming.map((i) => new Date(i.end).getTime()), windowEnd ? new Date(windowEnd).getTime() : 0);
  const toT = Math.ceil(lastEnd / (60 * MIN)) * 60 * MIN;
  const height = ((toT - fromT) / MIN) * PPM;
  const y = (ms: number) => ((Math.max(ms, fromT) - fromT) / MIN) * PPM;

  const hours: number[] = [];
  for (let h = fromT; h <= toT; h += 60 * MIN) hours.push(h);

  return (
    <div className={styles.timeline} style={{ height }}>
      {hours.map((h) => (
        <div key={h} className={styles.hour} style={{ top: y(h) }}>
          <span>{hhmm(new Date(h))}</span>
        </div>
      ))}
      {layoutLanes(upcoming).map(({ item: i, lane, lanes }) => {
        const s = new Date(i.start).getTime();
        const e = new Date(i.end).getTime();
        const top = y(s);
        const h = Math.max(22, y(e) - top - 3);
        const isDone = !!i.task_id && done.has(i.task_id);
        const movable = !!i.id && !isDone && i.kind !== 'free' && i.kind !== 'busy';
        return (
          <div
            key={`${i.kind}-${i.start}-${i.title}`}
            className={`${styles.block} ${styles[`block_${i.kind}`]} ${h < 34 ? styles.blockSmall : h < 50 ? styles.blockOneLine : ''} ${isDone ? styles.blockDone : ''} ${s <= now && now < e ? styles.blockNow : ''} ${movable ? styles.blockMovable : ''}`}
            style={{ top, height: h, ...(lanes > 1 ? { left: `calc(${(lane * 100) / lanes}% + ${lane ? 2 : 0}px)`, right: 'auto', width: `calc(${100 / lanes}% - 2px)` } : {}) }}
            {...(movable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `${i.title}, ${hhmm(i.start)} bis ${hhmm(i.end)}, verschieben`,
                  onClick: () => onPick(i),
                  onKeyDown: (ev: React.KeyboardEvent) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onPick(i)),
                }
              : {})}
          >
            <span className={styles.blockTitle}>
              {i.kind === 'free' && i.idea ? `Frei · ${i.idea}` : i.title}
              {i.pinned && <span className={styles.pin} title="Von dir verschoben">fest</span>}
            </span>
            {h >= 50 ? (
              <span className={styles.blockMeta}>
                {hhmm(i.start)} – {hhmm(i.end)} · {i.location ? i.location : duration(e - s)}
                {i.conflict && ` · überschneidet „${i.conflict}“`}
              </span>
            ) : (
              h >= 34 && <span className={styles.blockMeta}>{hhmm(i.start)}</span>
            )}
          </div>
        );
      })}
      {now >= fromT && <div className={styles.nowLine} style={{ top: y(now) }} aria-hidden="true" />}
    </div>
  );
};

export default HeuteScreen;
