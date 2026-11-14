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

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;
const DAILY_LIMIT = () => Number(process.env.CHAT_DAILY_LIMIT || 150);

export interface Proposal {
  kind: 'task' | 'note';
  title: string;
  duration_min_minutes?: number;
  duration_max_minutes?: number;
  importance?: 'high' | 'medium' | 'low';
  due_date?: string; // YYYY-MM-DD
  text?: string; // for notes
  reason?: string;
}

function sanitizeMessages(input: unknown): LlmMessage[] {
  if (!Array.isArray(input)) throw new HttpError(400, 'messages must be an array');
  const msgs = input
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_CHARS) }) as LlmMessage);
  // Both APIs need the conversation to start with the user
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new HttpError(400, 'last message must be from the user');
  return msgs;
}

function sanitizeProposals(input: unknown): Proposal[] {
  if (!Array.isArray(input)) return [];
  const int = (v: unknown) => (typeof v === 'number' && v >= 5 && v <= 480 ? Math.round(v) : undefined);
  return input.slice(0, 5).flatMap((p: any): Proposal[] => {
    const kind = p?.kind === 'note' ? 'note' : p?.kind === 'task' ? 'task' : null;
    const title = typeof p?.title === 'string' ? p.title.trim().slice(0, 200) : '';
    if (!kind || title.length < 3) return [];
    const min = int(p.duration_min_minutes);
    const max = int(p.duration_max_minutes);
    return [
      {
        kind,
        title,
        duration_min_minutes: min,
        duration_max_minutes: max && min && max < min ? min : max,
        importance: ['high', 'medium', 'low'].includes(p.importance) ? p.importance : undefined,
        due_date: typeof p.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.due_date) ? p.due_date : undefined,
        text: kind === 'note' && typeof p.text === 'string' ? p.text.slice(0, 2000) : undefined,
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

function systemPrompt(now: string, tasks: string): string {
  return `Du bist der Assistent in DayFlow, einer App, die Notizen in Aufgaben verwandelt und sie automatisch in freie Lücken im Kalender einplant.
Jetzt ist ${now}.

Deine Rolle:
- Du hilfst beim Nachdenken, Diskutieren und Priorisieren. Antworte auf Deutsch, knapp und konkret, wie ein ehrlicher Freund, der gut organisiert ist.
- Wenn etwas Umsetzbares auftaucht, schlägst du es als To-do vor: klein und konkret genug, um es in einem Kalenderblock zu erledigen (lieber "Anschreiben für Bewerbung X entwerfen, 45 min" als "Bewerbungen machen").
- Schätze für jedes To-do realistisch, wie lange es dauert (min/max in Minuten, 5-480).
- Gedanken oder Infos, die keine Aufgabe sind, kannst du als Notiz vorschlagen.
- Schlage nichts doppelt vor, was schon in den offenen Aufgaben steht. Erfinde keine Fakten.
- Nicht jede Nachricht braucht Vorschläge. Höchstens 5 pro Antwort.

Offene Aufgaben des Nutzers:
${tasks}

Antworte IMMER als JSON, ohne Text davor oder danach:
{"reply": "deine Antwort (Markdown erlaubt)", "proposals": [{"kind": "task", "title": "...", "duration_min_minutes": 30, "duration_max_minutes": 45, "importance": "high|medium|low", "due_date": "YYYY-MM-DD oder weglassen", "reason": "kurz warum"}, {"kind": "note", "title": "...", "text": "..."}]}`;
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
      { system: systemPrompt(nowText, tasks), messages, maxTokens: 1500, temperature: 0.5 },
      { allowClaude: true }
    );

    const parsed = extractJson<{ reply?: unknown; proposals?: unknown }>(llm.text);
    const reply = typeof parsed?.reply === 'string' && parsed.reply.trim() ? parsed.reply : llm.text;
    return res.status(200).json({ reply, proposals: parsed ? sanitizeProposals(parsed.proposals) : [], provider: llm.provider });
  } catch (e: any) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error('[chat] failed', e);
    return res.status(502).json({ error: 'Die KI ist gerade nicht erreichbar. Versuch es gleich nochmal.' });
  }
}
