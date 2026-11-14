/**
 * Assistent = chat + inbox in one page.
 * Left: talk or dictate. Right: what the assistant recognised, typed as
 * To-do (→ Aufgaben) or Termin (→ DayFlow calendar). Plain chatting yields
 * no proposal. Each card: ✓ take over, ✗ drop, ✎ edit.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { saveTask } from '../storage';
import { uuid } from '../utils';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { MicButton } from '../components/MicButton';
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const HISTORY_LIMIT = 60;
const chatKey = (uid: string) => `dayflow_chat_${uid}`;
const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

function loadHistory(uid: string): ChatMessage[] {
  try {
    return (JSON.parse(localStorage.getItem(chatKey(uid)) || '[]') as ChatMessage[]).map(({ id, role, content }) => ({ id, role, content }));
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
      setMessages((m) => [...m, { id: uuid(), role: 'assistant', content: json.reply }]);
      addSuggestions(uid, fromChatProposals(json.proposals || [], text));
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
        setToast({ text: `Termin „${s.title}“ steht im Kalender` });
      } else {
        const task = suggestionToTask(s);
        await saveTask(uid, task, firebaseUser);
        setToast({
          text: `„${s.title}“ ist in Aufgaben`,
          plan: { id: task.id, title: task.title, minutes: task.duration_max_minutes || task.duration_min_minutes || 30 },
        });
      }
      setSugg(loadSuggestions(uid).filter((x) => x.id !== s.id));
      if (editing === s.id) setEditing(null);
    } catch (e: any) {
      setError(`Konnte nicht übernommen werden: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  // One tap after ✓: put the new to-do into the next free gap today
  const placeToday = async (plan: { id: string; title: string; minutes: number }) => {
    setPlacing(true);
    try {
      const res = await fetch(`${API_BASE}/calendar/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ task_id: plan.id, title: plan.title, minutes: plan.minutes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
      setToast({
        text: json.placed
          ? `Eingeplant: heute ${timeLabel(json.start)}–${timeLabel(json.end)}`
          : 'Heute ist keine Lücke mehr frei, kommt morgen dran',
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

  const tasks = suggestions.filter((s) => s.kind !== 'event' || !s.start_at);
  const events = suggestions.filter((s) => s.kind === 'event' && s.start_at);

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
              ✓
            </button>
            <button className={styles.icon} onClick={() => setEditing(isEditing ? null : s.id)} aria-label={`„${s.title}“ bearbeiten`} aria-expanded={isEditing} title="Bearbeiten">
              ✎
            </button>
            <button className={styles.icon} onClick={() => drop(s.id)} aria-label={`„${s.title}“ verwerfen`} title="Verwerfen">
              ✕
            </button>
          </div>
        </div>

        {isEditing && (
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
        )}
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
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? styles.userRow : styles.botRow}>
              <div className={m.role === 'user' ? styles.userBubble : styles.botBubble}>{m.content}</div>
            </div>
          ))}
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
            ↑
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
            Was ich aus dem Gespräch erkenne, landet hier. Mit ✓ geht ein To-do in <Link to="/tasks">Aufgaben</Link> und ein Termin in deinen Kalender.
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
