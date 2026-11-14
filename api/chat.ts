/**
 * POST /api/chat  (signed in only)
 * Body: { messages: [{ role: 'user'|'assistant', content }], timezone? }
 * ->    { reply, proposals: [...], provider }
 *
 * The assistant knows the user's open tasks, talks things through, and when
 * something actionable comes up it PROPOSES to-dos or notes. Nothing is saved
 * here: the user confirms each proposal in the app.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { db, requireUser, HttpError } from './_lib/firebaseAdmin.js';
import { complete, extractJson, type LlmMessage } from './_lib/llm.js';
import { zonedTimeToUtc } from '../packages/core/src/freeSlotScheduling.js';

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;
const DAILY_LIMIT = () => Number(process.env.CHAT_DAILY_LIMIT || 150);

export interface Proposal {
  kind: 'task' | 'event';
  title: string;
  // task
  duration_min_minutes?: number;
  duration_max_minutes?: number;
  importance?: 'high' | 'medium' | 'low';
  due_date?: string; // YYYY-MM-DD
  // event (appointment at a fixed time)
  start_at?: string; // ISO
  end_at?: string; // ISO
  location?: string;
  reason?: string;
}

function sanitizeMessages(input: unknown): LlmMessage[] {
  if (!Array.isArray(input)) throw new HttpError(400, 'messages must be an array');
  const msgs = input
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_CHARS) }) as LlmMessage);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new HttpError(400, 'last message must be from the user');
  return msgs;
}

/** ISO with offset as is; a bare local time ("2026-11-19T14:00") is read in the user's zone. */
const isoOrUndef = (v: unknown, tz: string) => {
  if (typeof v !== 'string') return undefined;
  const local = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (local) return zonedTimeToUtc(local[1], Number(local[2]), Number(local[3]), tz).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

function sanitizeProposals(input: unknown, tz: string): Proposal[] {
  if (!Array.isArray(input)) return [];
  const int = (v: unknown) => (typeof v === 'number' && v >= 5 && v <= 480 ? Math.round(v) : undefined);
  return input.slice(0, 5).flatMap((p: any): Proposal[] => {
    const title = typeof p?.title === 'string' ? p.title.trim().slice(0, 200) : '';
    if (title.length < 2) return [];
    if (p?.kind === 'event') {
      const start = isoOrUndef(p.start_at, tz);
      if (!start) return []; // an appointment without a time is a task
      let end = isoOrUndef(p.end_at, tz);
      if (!end || end <= start) end = new Date(new Date(start).getTime() + 60 * 60_000).toISOString();
      return [{ kind: 'event', title, start_at: start, end_at: end, location: typeof p.location === 'string' ? p.location.slice(0, 120) : undefined, reason: typeof p.reason === 'string' ? p.reason.slice(0, 200) : undefined }];
    }
    if (p?.kind !== 'task') return [];
    const min = int(p.duration_min_minutes);
    const max = int(p.duration_max_minutes);
    return [
      {
        kind: 'task',
        title,
        duration_min_minutes: min,
        duration_max_minutes: max && min && max < min ? min : max,
        importance: ['high', 'medium', 'low'].includes(p.importance) ? p.importance : undefined,
        due_date: typeof p.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.due_date) ? p.due_date : undefined,
        reason: typeof p.reason === 'string' ? p.reason.slice(0, 200) : undefined,
      },
    ];
  });
}

async function openTasksSummary(uid: string): Promise<string> {
  const snap = await db().collection(`users/${uid}/items`).where('status', 'in', ['open', 'scheduled', 'in_progress']).limit(40).get();
  const lines = snap.docs
    .map((d): any => d.data())
    .filter((t: any) => typeof t.title === 'string' && (!t.type || t.type === 'task'))
    .map((t: any) => {
      const due = t.due_at?.toDate ? t.due_at.toDate().toISOString().slice(0, 10) : typeof t.due_at === 'string' ? t.due_at.slice(0, 10) : null;
      const dur = t.duration_min_minutes && t.duration_max_minutes ? `${t.duration_min_minutes}-${t.duration_max_minutes} min` : null;
      return `- ${t.title}${t.importance ? ` [${t.importance}]` : ''}${dur ? ` (${dur})` : ''}${due ? ` fällig ${due}` : ''}`;
    });
  return lines.length ? lines.join('\n') : '(keine offenen Aufgaben)';
}

/** Counts requests per user and day; throws 429 above the limit. */
async function checkQuota(uid: string, date: string) {
  const ref = db().doc(`ai_usage/${uid}_${date}`);
  await ref.set({ uid, date, chat: FieldValue.increment(1) }, { merge: true });
  const count = (await ref.get()).data()?.chat ?? 0;
  if (count > DAILY_LIMIT()) throw new HttpError(429, 'Tageslimit für den Chat erreicht, morgen geht es weiter.');
}

function systemPrompt(now: string, tz: string, tasks: string): string {
  return `Du bist der Assistent in DayFlow. Der Nutzer erzählt dir, was ansteht, oder redet einfach mit dir.
Jetzt ist ${now} (Zeitzone ${tz}).

Deine Aufgabe:
- Antworte auf Deutsch, knapp und konkret, wie ein ehrlicher, gut organisierter Freund. Hilf beim Sortieren und Priorisieren.
- Unterscheide genau, was der Nutzer sagt:
  1. TO-DO: etwas, das er erledigen muss, ohne feste Uhrzeit ("Zahnarzt anrufen", "Bewerbung schreiben"). Klein und konkret formulieren, realistische Dauer schätzen (5-480 min), Frist nur wenn genannt oder klar ableitbar.
  2. TERMIN: etwas zu einer festen Zeit ("Donnerstag 14 Uhr Wohnung anschauen", "morgen um 9 Zahnarzt"). Datum und Uhrzeit als ISO 8601 mit Zeitzonen-Offset, Dauer schätzen falls nicht genannt (meist 60 min), Ort falls genannt.
  3. NORMALES REDEN: Gedanken, Gefühle, Fragen, Smalltalk. Dafür KEINE Vorschläge.
- Relative Angaben ("morgen", "Donnerstag") beziehen sich auf jetzt.
- Nichts doppelt vorschlagen, was schon in den offenen Aufgaben steht. Nichts erfinden. Höchstens 5 Vorschläge.
- Erwähne in der Antwort kurz, was du vorschlägst ("Ich hab dir 2 To-dos und einen Termin rausgeschrieben"), die Details stehen in den Vorschlägen.

Offene Aufgaben des Nutzers:
${tasks}

Antworte IMMER als JSON, ohne Text davor oder danach:
{"reply": "deine Antwort",
 "proposals": [
  {"kind": "task", "title": "...", "duration_min_minutes": 15, "duration_max_minutes": 30, "importance": "high|medium|low", "due_date": "YYYY-MM-DD (optional)"},
  {"kind": "event", "title": "...", "start_at": "2026-11-19T14:00:00+01:00", "end_at": "2026-11-19T15:00:00+01:00", "location": "optional"}
 ]}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const uid = await requireUser(req);
    const messages = sanitizeMessages(req.body?.messages);

    let tz = 'Europe/Berlin';
    try {
      if (typeof req.body?.timezone === 'string') {
        new Intl.DateTimeFormat('de-DE', { timeZone: req.body.timezone });
        tz = req.body.timezone;
      }
    } catch {
      /* keep default */
    }
    const now = new Date();
    const nowText = now.toLocaleString('de-DE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const today = now.toLocaleDateString('en-CA', { timeZone: tz });

    await checkQuota(uid, today);
    const tasks = await openTasksSummary(uid);

    const llm = await complete(
      { system: systemPrompt(nowText, tz, tasks), messages, maxTokens: 1500, temperature: 0.4 },
      { allowClaude: true }
    );

    const parsed = extractJson<{ reply?: unknown; proposals?: unknown }>(llm.text);
    const reply = typeof parsed?.reply === 'string' && parsed.reply.trim() ? parsed.reply : llm.text;
    return res.status(200).json({ reply, proposals: parsed ? sanitizeProposals(parsed.proposals, tz) : [], provider: llm.provider });
  } catch (e: any) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error('[chat] failed', e);
    return res.status(502).json({ error: 'Die KI ist gerade nicht erreichbar. Versuch es gleich nochmal.' });
  }
}
