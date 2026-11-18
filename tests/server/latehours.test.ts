import { store, Timestamp } from './support/fake-firebase.mjs';
import { planForUser } from '../../api/_lib/planner.ts';
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d?: unknown) => { c ? pass++ : (fail++, console.log('FAIL', n, JSON.stringify(d))); };
const B = (h: number, m = 0, d = 17) => new Date(Date.UTC(2026, 10, d, h - 1, m));
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
(globalThis as any).fetch = async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR' });
const setup = (uid: string, latestHour: number) => {
  store.set(`calendar_connections/${uid}`, { provider: 'local', timezone: 'Europe/Berlin', status: 'ok', ics_urls: [],
    settings: { enabled: true, windowStartHour: 8, windowEndHour: 20, maxBlocks: 3, maxPlannedMinutes: 480, freeTimeEnabled: false, freeTimeIdeas: [], sportEnabled: false, sportEveryDays: 2, sportMinutes: 90, sportLabel: 'Sport', bufferBeforeEventsMinutes: 30, latestHour } });
  const t = (id: string, title: string, min: number, extra: any = {}) => store.set(`users/${uid}/items/${id}`, { title, status: 'open', type: 'task', importance: 'medium', duration_min_minutes: min, duration_max_minutes: min, created_at: Timestamp.fromDate(new Date('2026-11-01')), estimation_source: 'ai', ...extra });
  t('l1', 'Lang', 120); t('q1', 'Kurz A', 15); t('q2', 'Kurz B', 20); t('w', 'Müll', 10, { not_before: '2026-11-18' });
};
const blocks = (uid: string) => [...store.entries()].filter(([p]) => p.startsWith(`dayflow_blocks/${uid}/items/`)).map(([, d]: any) => ({ title: d.title, s: d.start.ms, e: d.end.ms })).sort((a, b) => a.s - b.s);

// at 19:00 only one hour of window left: long task can't fit, quick ones go after 20:00 but before 23:00
setup('u1', 23);
await planForUser('u1', 'today', B(19, 0));
const b1 = blocks('u1');
ok('quick tasks planned', ['Kurz A', 'Kurz B'].every((t) => b1.some((b) => b.title === t)), b1.map((b) => `${b.title} ${hhmm(b.s)}`));
ok('long task not after window', !b1.some((b) => b.title.startsWith('Lang') && b.e > B(20).getTime()), b1.map((b) => `${b.title} ${hhmm(b.s)}-${hhmm(b.e)}`));
ok('nothing after 23:00', b1.every((b) => b.e <= B(23).getTime()), b1.map((b) => `${b.title} ${hhmm(b.e)}`));
ok('recurring next one hidden until its day', !b1.some((b) => b.title === 'Müll'));

// late at 22:50 with limit 23: nothing fits any more
setup('u2', 23);
await planForUser('u2', 'today', B(22, 50));
ok('hard stop at 23:00', blocks('u2').length === 0, blocks('u2').map((b) => `${b.title} ${hhmm(b.s)}`));

// tomorrow: recurring task shows up
setup('u3', 23);
await planForUser('u3', 'tomorrow', B(19, 0));
ok('recurring shows up on its day', blocks('u3').some((b) => b.title === 'Müll'), blocks('u3').map((b) => b.title));
console.log(`${pass} passed ${fail} failed`);
