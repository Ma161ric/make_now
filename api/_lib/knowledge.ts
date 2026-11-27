/**
 * What the assistant knows when it answers: things it should remember about you,
 * the people you mentioned, and your appointments of the next days.
 * Everything here is optional context: if loading fails the chat still answers.
 */
import { db } from './firebaseAdmin.js';
import { getWeek, type WeekDay } from './planner.js';

export const MAX_MEMORIES_IN_PROMPT = 60;
export const MAX_PEOPLE_IN_PROMPT = 50;
const MAX_SECTION_CHARS = 5000;
const LOAD_TIMEOUT_MS = 2500;

export interface PersonRef {
  id: string;
  name: string;
}

export interface KnowledgeContext {
  memories: string;
  people: string;
  calendar: string;
  /** known people, so a proposal can only point at a person that exists */
  peopleRefs: PersonRef[];
  /** stored facts (lower case) so the same thing is not proposed twice */
  memoryTexts: string[];
}

const iso = (v: any): string => (typeof v === 'string' ? v : typeof v?.toDate === 'function' ? v.toDate().toISOString() : '');
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** one line per entry; the whole section stays short so the prompt does not explode */
const cap = (lines: string[], max = MAX_SECTION_CHARS) => {
  const out: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length + 1 > max) break;
    out.push(l);
    len += l.length + 1;
  }
  return out.join('\n');
};
/** data must not be able to open a new section or fake an instruction block */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export async function loadMemories(uid: string): Promise<{ text: string; texts: string[] }> {
  const snap = await db().collection(`users/${uid}/memories`).limit(300).get();
  const list = snap.docs
    .map((d) => d.data() as any)
    .filter((m) => typeof m?.text === 'string' && m.text.trim())
    .sort((a, b) => iso(b.created_at).localeCompare(iso(a.created_at)))
    .slice(0, MAX_MEMORIES_IN_PROMPT);
  return {
    text: list.length ? cap(list.map((m) => `- ${clip(oneLine(m.text), 300)}`)) : '(noch nichts gemerkt)',
    texts: list.map((m) => oneLine(m.text).toLowerCase()),
  };
}

export async function loadPeople(uid: string): Promise<{ text: string; refs: PersonRef[] }> {
  const snap = await db().collection(`users/${uid}/people`).limit(300).get();
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((p) => typeof p.name === 'string' && p.name.trim())
    .sort((a, b) => iso(b.updated_at || b.created_at).localeCompare(iso(a.updated_at || a.created_at)))
    .slice(0, MAX_PEOPLE_IN_PROMPT);
  const lines = list.map((p) => {
    const notes = Array.isArray(p.notes)
      ? p.notes
          .filter((n: any) => typeof n?.text === 'string')
          .sort((a: any, b: any) => iso(b.created_at).localeCompare(iso(a.created_at)))
          .slice(0, 3)
          .map((n: any) => clip(oneLine(n.text), 120))
      : [];
    const about = typeof p.about === 'string' && p.about.trim() ? ` – ${clip(oneLine(p.about), 120)}` : '';
    return `- ${clip(oneLine(p.name), 80)} (id ${p.id})${about}${notes.length ? `; Notizen: ${notes.join(' | ')}` : ''}`;
  });
  return { text: lines.length ? cap(lines) : '(noch keine Personen)', refs: list.map((p) => ({ id: p.id, name: oneLine(p.name) })) };
}

/** Appointments and planned blocks of the next 7 days, one line each */
export function formatWeek(days: WeekDay[], tz: string): string {
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });
  const fmtTime = (s: string) => new Date(s).toLocaleTimeString('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const lines: string[] = [];
  for (const day of days) {
    for (const a of day.all_day) lines.push(`- ${fmtDay(day.date)} ganztägig: ${clip(oneLine(a), 100)}`);
    for (const it of day.items) {
      if (it.kind === 'free') continue;
      const label = it.kind === 'busy' && !it.title ? 'belegt' : clip(oneLine(it.title || 'belegt'), 100);
      const tag = it.kind === 'task' ? ' (eingeplante Aufgabe)' : it.kind === 'sport' ? ' (Sport)' : '';
      lines.push(`- ${fmtDay(day.date)} ${fmtTime(it.start)}–${fmtTime(it.end)} ${label}${tag}${it.location ? ` @ ${clip(oneLine(it.location), 60)}` : ''}`);
    }
  }
  return lines.length ? cap(lines, 4000) : '(keine Termine in den nächsten 7 Tagen)';
}

type WeekFn = (uid: string, start: string) => Promise<{ connected: boolean; status?: string; days: WeekDay[] }>;

export async function loadCalendar(uid: string, now: Date, tz: string, week: WeekFn = getWeek): Promise<string> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const w = await week(uid, today);
  if (!w.connected) return '(kein Kalender verbunden)';
  if (w.status === 'needs_reauth') return '(Kalender muss neu verbunden werden)';
  return formatWeek(w.days, tz);
}

/** All of it at once; each part on its own, a failing part only loses that part */
export async function knowledgeContext(uid: string, now: Date, tz: string, deps: { week?: WeekFn } = {}): Promise<KnowledgeContext> {
  const [mem, ppl, cal] = await Promise.all([
    withTimeout(loadMemories(uid), LOAD_TIMEOUT_MS).catch((e) => (console.warn('[chat] memories', e?.message), null)),
    withTimeout(loadPeople(uid), LOAD_TIMEOUT_MS).catch((e) => (console.warn('[chat] people', e?.message), null)),
    withTimeout(loadCalendar(uid, now, tz, deps.week), LOAD_TIMEOUT_MS).catch((e) => (console.warn('[chat] calendar', e?.message), null)),
  ]);
  return {
    memories: mem?.text ?? '(gerade nicht verfügbar)',
    people: ppl?.text ?? '(gerade nicht verfügbar)',
    calendar: cal ?? '(gerade nicht verfügbar)',
    peopleRefs: ppl?.refs ?? [],
    memoryTexts: mem?.texts ?? [],
  };
}
