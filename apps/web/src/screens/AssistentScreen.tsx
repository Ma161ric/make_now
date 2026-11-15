/**
 * Assistent = chat + inbox in one page.
 * Left: talk or dictate. Right: what the assistant recognised, typed as
 * To-do (→ Aufgaben) or Termin (→ DayFlow calendar). Plain chatting yields
 * no proposal. Each card: take over, edit, drop. On phones the proposals sit
 * right under the assistant's reply and can be swiped (right = take, left = drop).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { saveTask } from '../storage';
import { uuid } from '../utils';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { MicButton } from '../components/MicButton';
import { IconCheck, IconX, IconPencil, IconArrowUp } from '../components/Icons';
import {
  type Suggestion,
  loadSuggestions,
  saveSuggestions,
  onSuggestionsChange,
  fromChatProposals,
  addSuggestions,
  suggestionToTask,
  durationLabel,
} from '../utils/suggestions';
import styles from './AssistentScreen.module.css';

/** What happened to a proposal of this message (shown as one line under it) */
interface Done {
  id: string;
  title: string;
  kind: 'task' | 'event';
  taskId?: string;
  minutes?: number;
  placed?: string; // "heute 18:15–19:15" or "morgen"
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  done?: Done[];
}

const HISTORY_LIMIT = 60;
const chatKey = (uid: string) => `dayflow_chat_${uid}`;
const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

function loadHistory(uid: string): ChatMessage[] {
  try {
    return (JSON.parse(localStorage.getItem(chatKey(uid)) || '[]') as ChatMessage[]).map(({ id, role, content, done }) => ({ id, role, content, done }));
  } catch {
    return [];
  }
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** "2026-11-19T14:00" for <input type=datetime-local>, in local time. */
const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function summary(s: Suggestion): string[] {
  if (s.kind === 'event' && s.start_at) {
    const parts = [`${dayLabel(s.start_at)}, ${timeLabel(s.start_at)}${s.end_at ? `–${timeLabel(s.end_at)}` : ''}`];
    if (s.location) parts.push(s.location);
    return parts;
  }
  const parts = [durationLabel(s.duration_min_minutes, s.duration_max_minutes)];
  parts.push(s.due_at ? `Frist ${dayLabel(s.due_at)}` : 'keine Frist');
  if (s.importance === 'high') parts.push('wichtig');
  return parts.filter(Boolean);
}

export const AssistentScreen: React.FC = () => {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || '';
  const [messages, setMessages] = useState<ChatMessage[]>(() => (uid ? loadHistory(uid) : []));
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => (uid ? loadSuggestions(uid) : []));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; plan?: { id: string; title: string; minutes: number } } | null>(null);
  const [placing, setPlacing] = useState(false);
  /** phone bottom sheet: list of open proposals, or one proposal being edited */
  const [sheet, setSheet] = useState<null | 'list' | { edit: string }>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    setMessages(loadHistory(uid));
    setSuggestions(loadSuggestions(uid));
    return onSuggestionsChange(() => setSuggestions(loadSuggestions(uid)));
  }, [uid]);

  useEffect(() => {
    if (uid) localStorage.setItem(chatKey(uid), JSON.stringify(messages.slice(-HISTORY_LIMIT)));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, uid]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.plan ? 7000 : 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const setSugg = (list: Suggestion[]) => {
    setSuggestions(list);
    saveSuggestions(uid, list);
  };
  const patch = (id: string, p: Partial<Suggestion>) => setSugg(suggestions.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const drop = (id: string) => setSugg(suggestions.filter((x) => x.id !== id));

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { id: uuid(), role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
      const msgId = uuid();
      setMessages((m) => [...m, { id: msgId, role: 'assistant', content: json.reply }]);
      addSuggestions(uid, fromChatProposals(json.proposals || [], text, msgId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const accept = async (s: Suggestion) => {
    setBusyId(s.id);
    setError(null);
    try {
      if (s.kind === 'event' && s.start_at) {
        const end = s.end_at || new Date(new Date(s.start_at).getTime() + (s.duration_min_minutes || 60) * 60_000).toISOString();
        const res = await fetch(`${API_BASE}/calendar/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ title: s.title, start_at: s.start_at, end_at: end, location: s.location }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
        if (inChat(s)) addDone(s, { id: s.id, title: s.title, kind: 'event' });
        else setToast({ text: `Termin „${s.title}“ steht im Kalender` });
      } else {
        const task = suggestionToTask(s);
        await saveTask(uid, task, firebaseUser);
        const plan = { id: task.id, title: task.title, minutes: task.duration_max_minutes || task.duration_min_minutes || 30 };
        if (inChat(s)) addDone(s, { id: s.id, title: s.title, kind: 'task', taskId: plan.id, minutes: plan.minutes });
        else setToast({ text: `„${s.title}“ ist in Aufgaben`, plan });
      }
      setSugg(loadSuggestions(uid).filter((x) => x.id !== s.id));
      if (editing === s.id) setEditing(null);
      setSheet((cur) => (cur && cur !== 'list' && cur.edit === s.id ? null : cur));
    } catch (e: any) {
      setError(`Konnte nicht übernommen werden: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  /** Is this proposal shown under its message in the chat? */
  const inChat = (s: Suggestion) => !!s.msg_id && messages.some((m) => m.id === s.msg_id);
  const addDone = (s: Suggestion, entry: Done) =>
    setMessages((ms) => ms.map((m) => (m.id === s.msg_id ? { ...m, done: [...(m.done || []), entry] } : m)));
  const setPlaced = (doneId: string, placed: string) =>
    setMessages((ms) => ms.map((m) => (m.done?.some((d) => d.id === doneId) ? { ...m, done: m.done!.map((d) => (d.id === doneId ? { ...d, placed } : d)) } : m)));

  // One tap after ✓: put the new to-do into the next free gap today
  const placeToday = async (plan: { id: string; title: string; minutes: number }, doneId?: string) => {
    setPlacing(true);
    try {
      const res = await fetch(`${API_BASE}/calendar/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ task_id: plan.id, title: plan.title, minutes: plan.minutes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
      const placed = json.placed ? `heute ${timeLabel(json.start)}–${timeLabel(json.end)}` : 'morgen';
      if (doneId) setPlaced(doneId, placed);
      else
        setToast({
          text: json.placed ? `Eingeplant: ${placed}` : 'Heute ist keine Lücke mehr frei, kommt morgen dran',
        });
    } catch (e: any) {
      setToast(null);
      setError(`Einplanen hat nicht geklappt: ${e.message}`);
    } finally {
      setPlacing(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('Chatverlauf löschen? Vorschläge und Aufgaben bleiben.')) setMessages([]);
  };

  /** Proposals that are not under a message in the chat (e.g. from the Heute note field) */
  const orphans = suggestions.filter((s) => !inChat(s));
  const tasks = suggestions.filter((s) => s.kind !== 'event' || !s.start_at);
  const events = suggestions.filter((s) => s.kind === 'event' && s.start_at);

  const renderEditor = (s: Suggestion) => {
    const isEvent = s.kind === 'event' && !!s.start_at;
    return (
          <div className={styles.editor}>
            <label>
              <span>Titel</span>
              <input className="input" value={s.title} onChange={(e) => patch(s.id, { title: e.target.value })} />
            </label>
            {isEvent ? (
              <div className={styles.editorRow}>
                <label>
                  <span>Beginn</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={toLocalInput(s.start_at)}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const start = new Date(e.target.value);
                      const len = s.start_at && s.end_at ? +new Date(s.end_at) - +new Date(s.start_at) : 3_600_000;
                      patch(s.id, { start_at: start.toISOString(), end_at: new Date(start.getTime() + len).toISOString() });
                    }}
                  />
                </label>
                <label>
                  <span>Dauer</span>
                  <select
                    className="input"
                    value={s.start_at && s.end_at ? Math.round((+new Date(s.end_at) - +new Date(s.start_at)) / 60000) : 60}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      patch(s.id, { end_at: new Date(new Date(s.start_at!).getTime() + m * 60_000).toISOString(), duration_min_minutes: m, duration_max_minutes: m });
                    }}
                  >
                    {[...new Set([...DURATIONS, s.duration_min_minutes])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>{durationLabel(m, m)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Ort</span>
                  <input className="input" value={s.location || ''} onChange={(e) => patch(s.id, { location: e.target.value })} />
                </label>
              </div>
            ) : (
              <div className={styles.editorRow}>
                <label>
                  <span>Dauer</span>
                  <select
                    className="input"
                    value={s.duration_max_minutes}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      patch(s.id, { duration_min_minutes: m, duration_max_minutes: m });
                    }}
                  >
                    {[...new Set([...DURATIONS, s.duration_max_minutes])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>{durationLabel(m, m)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Frist</span>
                  <input
                    className="input"
                    type="date"
                    value={s.due_at ? toLocalInput(s.due_at).slice(0, 10) : ''}
                    onChange={(e) => patch(s.id, { due_at: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}
                  />
                </label>
                <label>
                  <span>Wichtigkeit</span>
                  <select className="input" value={s.importance} onChange={(e) => patch(s.id, { importance: e.target.value as Suggestion['importance'] })}>
                    <option value="high">wichtig</option>
                    <option value="medium">normal</option>
                    <option value="low">unwichtig</option>
                  </select>
                </label>
              </div>
            )}
            {!isEvent && (
              <button className={styles.textButton} onClick={() => {
                const start = new Date();
                start.setDate(start.getDate() + 1);
                start.setHours(9, 0, 0, 0);
                patch(s.id, { kind: 'event', start_at: start.toISOString(), end_at: new Date(start.getTime() + 3_600_000).toISOString() });
              }}>
                Doch ein Termin?
              </button>
            )}
            {isEvent && (
              <button className={styles.textButton} onClick={() => patch(s.id, { kind: 'task', start_at: undefined, end_at: undefined })}>
                Doch ein To-do?
              </button>
            )}
          </div>
    );
  };

  const renderCard = (s: Suggestion) => {
    const isEvent = s.kind === 'event' && !!s.start_at;
    const isEditing = editing === s.id;
    return (
      <li key={s.id} className={`${styles.card} ${isEvent ? styles.cardEvent : styles.cardTask}`}>
        <div className={styles.cardRow}>
          <div className={styles.cardMain}>
            <span className={styles.kind}>{isEvent ? 'Termin' : s.kind === 'idea' ? 'Idee' : 'To-do'}</span>
            <strong className={styles.title}>{s.title}</strong>
            <span className={styles.meta}>{summary(s).join(' · ')}</span>
          </div>
          <div className={styles.actions}>
            <button className={styles.accept} onClick={() => accept(s)} disabled={busyId === s.id} aria-label={`„${s.title}“ übernehmen`} title="Übernehmen">
              <IconCheck size={16} />
            </button>
            <button className={styles.icon} onClick={() => (sheet ? setSheet({ edit: s.id }) : setEditing(isEditing ? null : s.id))} aria-label={`„${s.title}“ bearbeiten`} aria-expanded={isEditing} title="Bearbeiten">
              <IconPencil size={16} />
            </button>
            <button className={styles.icon} onClick={() => drop(s.id)} aria-label={`„${s.title}“ verwerfen`} title="Verwerfen">
              <IconX size={16} />
            </button>
          </div>
        </div>

        {isEditing && renderEditor(s)}
      </li>
    );
  };

  return (
    <div className={styles.page}>
      <section className={styles.chat} aria-label="Chat">
        <div className={styles.head}>
          <h1>Assistent</h1>
          {messages.length > 0 && (
            <button className={styles.textButton} onClick={clearChat}>Verlauf löschen</button>
          )}
        </div>

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              <p>Erzähl einfach, was ansteht.</p>
              <p className={styles.emptyHint}>„Muss noch die Steuer machen und Do um 14 Uhr Wohnung anschauen“ wird zu einem To-do und einem Termin. Einfach reden geht auch, dann schlage ich nichts vor.</p>
            </div>
          )}
          {messages.map((m) => {
            const open = m.role === 'assistant' ? suggestions.filter((s) => s.msg_id === m.id) : [];
            return (
              <div key={m.id} className={m.role === 'user' ? styles.userRow : styles.botRow}>
                <div className={m.role === 'user' ? styles.userBubble : styles.botBubble}>{m.content}</div>
                {(open.length > 0 || (m.done?.length ?? 0) > 0) && (
                  <div className={styles.inline}>
                    {open.map((s) => (
                      <InlineCard
                        key={s.id}
                        s={s}
                        busy={busyId === s.id}
                        onAccept={() => accept(s)}
                        onDrop={() => drop(s.id)}
                        onEdit={() => setSheet({ edit: s.id })}
                      />
                    ))}
                    {m.done?.map((d) => (
                      <div key={d.id} className={styles.doneLine}>
                        <IconCheck size={14} />
                        <span className={styles.doneText}>
                          <strong>{d.title}</strong>
                          {d.kind === 'event' ? ' im Kalender' : d.placed ? ` eingeplant ${d.placed}` : ' in Aufgaben'}
                        </span>
                        {d.kind === 'task' && !d.placed && d.taskId && (
                          <button className={styles.doneAction} disabled={placing} onClick={() => placeToday({ id: d.taskId!, title: d.title, minutes: d.minutes || 30 }, d.id)}>
                            Heute einplanen
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {sending && (
            <div className={styles.botRow}>
              <div className={`${styles.botBubble} ${styles.typing}`} aria-label="Assistent schreibt">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {orphans.length > 0 && (
          <button className={styles.pill} onClick={() => setSheet('list')}>
            {orphans.length} {orphans.length === 1 ? 'offener Vorschlag' : 'offene Vorschläge'}
          </button>
        )}

        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Was steht an?"
            rows={1}
            maxLength={4000}
            disabled={sending}
            aria-label="Nachricht"
          />
          <MicButton onText={(t) => setInput((cur) => (cur ? `${cur} ${t}` : t))} onError={setError} />
          <button className={styles.send} type="submit" disabled={sending || !input.trim()} aria-label="Senden">
            <IconArrowUp size={18} />
          </button>
        </form>
      </section>

      <aside className={styles.panel} aria-label="Vorschläge">
        <div className={styles.panelHead}>
          <h2>Vorschläge</h2>
          {suggestions.length > 0 && <span className={styles.count}>{suggestions.length}</span>}
        </div>

        {suggestions.length === 0 ? (
          <p className={styles.panelEmpty}>
            Was ich aus dem Gespräch erkenne, landet hier. Übernommene To-dos gehen in <Link to="/tasks">Aufgaben</Link> und ein Termin in deinen Kalender.
          </p>
        ) : (
          <>
            {tasks.length > 0 && (
              <>
                <h3 className={styles.group}>To-dos</h3>
                <ul className={styles.list}>{tasks.map(renderCard)}</ul>
              </>
            )}
            {events.length > 0 && (
              <>
                <h3 className={styles.group}>Termine</h3>
                <ul className={styles.list}>{events.map(renderCard)}</ul>
              </>
            )}
            {suggestions.length > 1 && (
              <button className={styles.textButton} onClick={() => window.confirm('Alle Vorschläge verwerfen?') && setSugg([])}>
                Alle verwerfen
              </button>
            )}
          </>
        )}
      </aside>

      {sheet && (
        <div className={styles.sheetBackdrop} onClick={() => setSheet(null)}>
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Vorschläge" onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetGrip} aria-hidden="true" />
            {sheet === 'list' ? (
              <>
                <h2 className={styles.sheetTitle}>Offene Vorschläge</h2>
                <ul className={styles.list}>{orphans.map(renderCard)}</ul>
              </>
            ) : (
              (() => {
                const s = suggestions.find((x) => x.id === sheet.edit);
                if (!s) return <p className={styles.panelEmpty}>Der Vorschlag ist schon erledigt.</p>;
                return (
                  <>
                    <h2 className={styles.sheetTitle}>{s.kind === 'event' && s.start_at ? 'Termin bearbeiten' : 'To-do bearbeiten'}</h2>
                    {renderEditor(s)}
                    <div className={styles.sheetActions}>
                      <button className={styles.sheetSecondary} onClick={() => { drop(s.id); setSheet(null); }}>Verwerfen</button>
                      <button className={styles.sheetPrimary} onClick={() => accept(s)} disabled={busyId === s.id}>Übernehmen</button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="status">
          <span>{toast.text}</span>
          {toast.plan && (
            <button className={styles.toastAction} onClick={() => placeToday(toast.plan!)} disabled={placing}>
              {placing ? 'Plane …' : 'Heute einplanen'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * A proposal right under the assistant's reply. Tap = edit, buttons or swipe:
 * right takes it over, left drops it.
 */
const InlineCard: React.FC<{ s: Suggestion; busy: boolean; onAccept: () => void; onDrop: () => void; onEdit: () => void }> = ({ s, busy, onAccept, onDrop, onEdit }) => {
  const isEvent = s.kind === 'event' && !!s.start_at;
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const LIMIT = 90;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (!moved.current && Math.abs(x) > 10 && Math.abs(x) > Math.abs(y)) {
      moved.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (moved.current) setDx(Math.max(-140, Math.min(140, x)));
  };
  const onPointerUp = () => {
    if (!start.current) return;
    const d = dx;
    start.current = null;
    setDx(0);
    if (!moved.current) return onEdit();
    if (d > LIMIT) onAccept();
    else if (d < -LIMIT) onDrop();
  };

  return (
    <div className={styles.swipeWrap}>
      <div className={`${styles.swipeHint} ${dx > 0 ? styles.swipeYes : styles.swipeNo}`} aria-hidden="true" style={{ opacity: Math.min(1, Math.abs(dx) / LIMIT) }}>
        {dx > 0 ? <><IconCheck size={16} /> Übernehmen</> : <>Verwerfen <IconX size={16} /></>}
      </div>
      <div
        className={`${styles.inlineCard} ${isEvent ? styles.cardEvent : styles.cardTask}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; setDx(0); }}
      >
        <div
          className={styles.inlineMain}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onEdit())}
          aria-label={`„${s.title}“ bearbeiten`}
        >
          <span className={styles.kind}>{isEvent ? 'Termin' : 'To-do'}</span>
          <strong className={styles.title}>{s.title}</strong>
          <span className={styles.meta}>{summary(s).join(' · ')}</span>
        </div>
        <button className={styles.inlineDrop} onClick={onDrop} aria-label={`„${s.title}“ verwerfen`}>
          <IconX size={18} />
        </button>
        <button className={styles.inlineAccept} onClick={onAccept} disabled={busy} aria-label={`„${s.title}“ übernehmen`}>
          <IconCheck size={18} />
        </button>
      </div>
    </div>
  );
};
