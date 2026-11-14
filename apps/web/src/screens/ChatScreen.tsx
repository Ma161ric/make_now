import React, { useEffect, useRef, useState } from 'react';
import type { Task } from '@make-now/core';
import { useAuth } from '../auth/authContext';
import { saveTask, addNote } from '../storage';
import { extractFromNoteCloud } from '../firebase/functionsService';
import { uuid } from '../utils';
import { API_BASE, authHeaders } from '../utils/apiAuth';
import { MicButton } from '../components/MicButton';
import styles from './ChatScreen.module.css';

interface Proposal {
  kind: 'task' | 'note';
  title: string;
  duration_min_minutes?: number;
  duration_max_minutes?: number;
  importance?: 'high' | 'medium' | 'low';
  due_date?: string;
  text?: string;
  reason?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals?: (Proposal & { state?: 'saved' | 'dismissed' })[];
}

const HISTORY_LIMIT = 60;
const storageKey = (uid: string) => `dayflow_chat_${uid}`;

function loadHistory(uid: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(uid)) || '[]');
  } catch {
    return [];
  }
}

function durationLabel(p: Proposal): string | null {
  const { duration_min_minutes: min, duration_max_minutes: max } = p;
  if (min && max && min !== max) return `${min}–${max} min`;
  if (min || max) return `${min || max} min`;
  return null;
}

export const ChatScreen: React.FC = () => {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || '';
  const [messages, setMessages] = useState<ChatMessage[]>(() => (uid ? loadHistory(uid) : []));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (uid) setMessages(loadHistory(uid));
  }, [uid]);

  useEffect(() => {
    if (uid) localStorage.setItem(storageKey(uid), JSON.stringify(messages.slice(-HISTORY_LIMIT)));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, uid]);

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
      setMessages((m) => [...m, { id: uuid(), role: 'assistant', content: json.reply, proposals: json.proposals || [] }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const markProposal = (msgId: string, index: number, state: 'saved' | 'dismissed') =>
    setMessages((m) =>
      m.map((msg) =>
        msg.id === msgId ? { ...msg, proposals: msg.proposals?.map((p, i) => (i === index ? { ...p, state } : p)) } : msg
      )
    );

  const accept = async (msgId: string, index: number, p: Proposal) => {
    try {
      if (p.kind === 'task') {
        const now = new Date();
        const task: Task = {
          id: uuid(),
          title: p.title,
          status: 'open',
          created_at: now,
          updated_at: now,
          duration_min_minutes: p.duration_min_minutes,
          duration_max_minutes: p.duration_max_minutes,
          estimation_source: 'ai',
          importance: p.importance || 'medium',
          due_at: p.due_date ? new Date(`${p.due_date}T12:00:00`) : undefined,
          notes: p.reason,
        };
        await saveTask(uid, task, firebaseUser);
      } else {
        const raw = [p.title, p.text].filter(Boolean).join('\n\n').slice(0, 2000);
        const extraction = await extractFromNoteCloud(raw);
        await addNote(uid, { id: uuid(), raw_text: raw, created_at: new Date().toISOString(), status: 'unprocessed' }, extraction, firebaseUser);
      }
      markProposal(msgId, index, 'saved');
    } catch (e: any) {
      setError(`Speichern fehlgeschlagen: ${e.message}`);
    }
  };

  const clear = () => {
    if (window.confirm('Chatverlauf löschen? Gespeicherte Aufgaben bleiben.')) setMessages([]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Chat</h1>
        {messages.length > 0 && (
          <button className={styles.linkButton} onClick={clear}>Verlauf löschen</button>
        )}
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.empty}>
            Erzähl, was ansteht oder was dich beschäftigt. Ich helfe beim Sortieren und schlage To-dos vor, die du mit einem Klick übernimmst.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? styles.userRow : styles.assistantRow}>
            <div className={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>{msg.content}</div>

            {msg.proposals && msg.proposals.length > 0 && (
              <div className={styles.proposals}>
                {msg.proposals.map((p, i) => (
                  <div key={i} className={`${styles.proposal} ${p.state ? styles.proposalDone : ''}`}>
                    <div className={styles.proposalBody}>
                      <span className={styles.proposalKind}>{p.kind === 'task' ? 'To-do' : 'Notiz'}</span>
                      <strong>{p.title}</strong>
                      <span className={styles.proposalMeta}>
                        {[durationLabel(p), p.importance && { high: 'wichtig', medium: 'normal', low: 'unwichtig' }[p.importance], p.due_date && `bis ${p.due_date}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {p.state === 'saved' ? (
                      <span className={styles.proposalState}>✓ übernommen</span>
                    ) : p.state === 'dismissed' ? (
                      <span className={styles.proposalState}>verworfen</span>
                    ) : (
                      <div className={styles.proposalActions}>
                        <button className={styles.primaryButton} onClick={() => accept(msg.id, i, p)}>Übernehmen</button>
                        <button className={styles.linkButton} onClick={() => markProposal(msg.id, i, 'dismissed')}>Nein</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {sending && <div className={styles.assistantRow}><div className={styles.assistantBubble}>…</div></div>}
        <div ref={bottomRef} />
      </div>

      {error && <p className={styles.error}>{error}</p>}

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
          placeholder="Was steht an? Schreiben oder sprechen …"
          rows={2}
          maxLength={4000}
          disabled={sending}
        />
        <MicButton onText={(t) => setInput((cur) => (cur ? `${cur} ${t}` : t))} onError={setError} />
        <button className={styles.primaryButton} type="submit" disabled={sending || !input.trim()}>
          Senden
        </button>
      </form>
    </div>
  );
};
