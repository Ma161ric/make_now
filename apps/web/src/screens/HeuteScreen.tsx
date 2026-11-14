/**
 * "Heute" (Dark Focus): one big card for what is happening right now,
 * a timeline of the rest of the day, and one input to jot something down.
 * Data comes from the Google Calendar plan (/api/calendar/today).
 * Without a connected calendar the classic Today screen is shown instead.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { updateTaskStatus } from '../storage';
import { extractFromNoteCloud } from '../firebase/functionsService';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { IconArrowRight, IconCheck } from '../components/Icons';
import { MicButton } from '../components/MicButton';
import { loadSuggestions, saveSuggestions, fromExtraction } from '../utils/suggestions';
import TodayScreen from './TodayScreen';
import styles from './HeuteScreen.module.css';

type Kind = 'task' | 'sport' | 'free' | 'event' | 'busy';

interface Item {
  start: string;
  end: string;
  kind: Kind;
  title: string;
  task_id?: string;
  location?: string;
}

interface Timeline {
  connected: boolean;
  status?: 'ok' | 'needs_reauth';
  needs_upgrade?: boolean;
  window?: { start: string; end: string };
  all_day?: string[];
  items: Item[];
}

const MIN = 60_000;
const PX_PER_MIN = 1.1;

const hhmm = (d: Date | string) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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

const KIND_LABEL: Record<Kind, string> = { task: 'Aufgabe', sport: 'Sport', free: 'Freizeit', event: 'Termin', busy: 'Termin' };

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
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [noteState, setNoteState] = useState<{ kind: 'saving' | 'saved' | 'error'; count?: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setTimeline(await api<Timeline>('today'));
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
    () => items.find((i) => new Date(i.start).getTime() > t && i !== current) || null,
    [items, t, current]
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
  };

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
      setNoteState({ kind: 'saved', count: found.length });
    } catch {
      setNoteState({ kind: 'error' });
    }
  };

  // Not connected: keep the classic screen so nothing is lost
  if (timeline && !timeline.connected) {
    return (
      <>
        <div className={styles.connectHint}>
          <span>Verbinde deinen Google Kalender, dann plant DayFlow deinen Tag automatisch.</span>
          <Link to="/settings" className="button">Kalender verbinden</Link>
        </div>
        <TodayScreen />
      </>
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
      {error && <div className={styles.banner} role="alert">{error}</div>}

      <div className={styles.layout}>
        <section aria-label="Jetzt" className={styles.nowCard}>
          {!timeline ? (
            <p className={styles.muted}>Lade deinen Tag …</p>
          ) : current ? (
            <NowCard item={current} now={t} next={next} done={!!current.task_id && done.has(current.task_id)} onDone={() => markDone(current)} />
          ) : (
            <FreeCard now={t} next={next} onPlan={planToday} busy={busy} />
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
            <DayTimeline items={items} now={t} windowEnd={timeline?.window?.end} done={done} />
          </section>

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
              {noteState.kind === 'saved' && (
                <>
                  ✓ {noteState.count} {noteState.count === 1 ? 'Vorschlag' : 'Vorschläge'} in der Inbox. <Link to="/">Jetzt bestätigen</Link>
                </>
              )}
              {noteState.kind === 'error' && 'Konnte die Notiz nicht speichern. Versuch es nochmal.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const NowCard: React.FC<{ item: Item; now: number; next: Item | null; done: boolean; onDone: () => void }> = ({ item, now, next, done, onDone }) => {
  const start = new Date(item.start).getTime();
  const end = new Date(item.end).getTime();
  const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const kindClass = item.kind === 'sport' ? styles.sport : item.kind === 'free' ? styles.free : '';

  return (
    <div className={`${styles.nowInner} ${kindClass}`}>
      <div>
        <p className={styles.eyebrow}>
          Jetzt · {hhmm(item.start)} – {hhmm(item.end)}
        </p>
        <h1 className={styles.nowTitle}>{item.title}</h1>
        <p className={styles.nowSub}>
          {item.kind === 'free' && 'Keine Aufgabe eingeplant. Die Zeit gehört dir. '}
          {item.kind === 'busy' && 'Termin aus deinem Kalender. '}
          {item.kind === 'event' && item.location && `Ort: ${item.location}. `}
          {next ? `Danach: ${next.title} um ${hhmm(next.start)}.` : 'Danach ist nichts mehr geplant.'}
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
                <IconCheck size={18} /> Erledigt
              </span>
            ) : (
              <button className="button" onClick={onDone}>
                Erledigt
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const FreeCard: React.FC<{ now: number; next: Item | null; onPlan: () => void; busy: boolean }> = ({ now, next, onPlan, busy }) => (
  <div className={styles.nowInner}>
    <div>
      <p className={styles.eyebrow}>Jetzt</p>
      <h1 className={styles.nowTitle}>{next ? 'Gerade frei' : 'Für heute ist nichts mehr geplant'}</h1>
      <p className={styles.nowSub}>
        {next ? `Als Nächstes: ${next.title} um ${hhmm(next.start)}.` : 'Hast du noch Zeit? DayFlow kann den Rest des Tages mit offenen Aufgaben füllen.'}
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
    </div>
  </div>
);

const DayTimeline: React.FC<{ items: Item[]; now: number; windowEnd?: string; done: Set<string> }> = ({ items, now, windowEnd, done }) => {
  const upcoming = items.filter((i) => new Date(i.end).getTime() > now);
  if (!upcoming.length) {
    return <p className={styles.empty}>Für den Rest des Tages ist nichts eingetragen.</p>;
  }

  // From the current full hour to the end of the planning window / last block
  const from = new Date(now);
  from.setMinutes(0, 0, 0);
  const fromT = from.getTime();
  const lastEnd = Math.max(...upcoming.map((i) => new Date(i.end).getTime()), windowEnd ? new Date(windowEnd).getTime() : 0);
  const toT = Math.ceil(lastEnd / (60 * MIN)) * 60 * MIN;
  const height = ((toT - fromT) / MIN) * PX_PER_MIN;
  const y = (ms: number) => ((Math.max(ms, fromT) - fromT) / MIN) * PX_PER_MIN;

  const hours: number[] = [];
  for (let h = fromT; h <= toT; h += 60 * MIN) hours.push(h);

  return (
    <div className={styles.timeline} style={{ height }}>
      {hours.map((h) => (
        <div key={h} className={styles.hour} style={{ top: y(h) }}>
          <span>{hhmm(new Date(h))}</span>
        </div>
      ))}
      {upcoming.map((i) => {
        const s = new Date(i.start).getTime();
        const e = new Date(i.end).getTime();
        const top = y(s);
        const h = Math.max(22, y(e) - top - 3);
        const isDone = !!i.task_id && done.has(i.task_id);
        return (
          <div
            key={`${i.kind}-${i.start}-${i.title}`}
            className={`${styles.block} ${styles[`block_${i.kind}`]} ${isDone ? styles.blockDone : ''} ${s <= now && now < e ? styles.blockNow : ''}`}
            style={{ top, height: h }}
          >
            <span className={styles.blockTitle}>{i.title}</span>
            {h >= 38 && (
              <span className={styles.blockMeta}>
                {hhmm(i.start)} – {hhmm(i.end)} · {i.location ? i.location : duration(e - s)}
              </span>
            )}
          </div>
        );
      })}
      <div className={styles.nowLine} style={{ top: y(now) }} aria-hidden="true" />
    </div>
  );
};

export default HeuteScreen;
