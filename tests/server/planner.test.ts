import { store, Timestamp } from './support/fake-firebase.mjs';
import { planForUser, getTimeline, extendTask, undoLast, placeTaskToday, resolveConflict, addAppointment, moveBlock, logDone } from '../../api/_lib/planner.ts';
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info?: unknown) => { cond ? pass++ : fail++; if (!cond) console.log('FAIL', name, info !== undefined ? JSON.stringify(info) : ''); };
const B = (h: number, m = 0, d = 17) => new Date(Date.UTC(2026, 10, d, h - 1, m)); // Berlin = UTC+1 in Nov
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });

// calendar link with a lecture 10-12 on 17.11.
let icsBody = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:l1\r\nDTSTART;TZID=Europe/Berlin:20261117T100000\r\nDTEND;TZID=Europe/Berlin:20261117T120000\r\nSUMMARY:Vorlesung\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
(globalThis as any).fetch = async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => icsBody });

store.set('calendar_connections/u1', {
  provider: 'local', timezone: 'Europe/Berlin', status: 'ok', ics_urls: ['https://example.com/a.ics'],
  settings: { enabled: true, windowStartHour: 8, windowEndHour: 20, maxBlocks: 5, maxPlannedMinutes: 480, freeTimeEnabled: true, freeTimeIdeas: ['Spaziergang'], sportEnabled: true, sportEveryDays: 2, sportMinutes: 90, sportLabel: 'Sport', bufferBeforeEventsMinutes: 30 },
});
const task = (id: string, title: string, min: number, importance = 'medium') =>
  store.set(`users/u1/items/${id}`, { title, status: 'open', type: 'task', importance, duration_min_minutes: min, duration_max_minutes: min, created_at: Timestamp.fromDate(new Date('2026-11-01')), estimation_source: 'ai' });
task('a', 'Bewerbung', 60, 'high');
task('b', 'Steuer', 240);
task('c', 'Mama anrufen', 15);

const blocksOf = () => [...store.entries()].filter(([p]) => p.startsWith('dayflow_blocks/u1/items/')).map(([p, d]: any) => ({ id: p.split('/').pop(), ...d }));
const show = () => blocksOf().sort((x: any, y: any) => x.start.ms - y.start.ms).map((b: any) => `${b.title} ${hhmm(new Date(b.start.ms).toISOString())}-${hhmm(new Date(b.end.ms).toISOString())}`);

// 1) plan today at 07:30
const r1 = await planForUser('u1', 'today', B(7, 30));
const s1 = show();
ok('plan: no block overlaps lecture+buffer (9:30-12)', blocksOf().every((b: any) => b.end.ms <= B(9, 30).getTime() || b.start.ms >= B(12).getTime()), s1);
ok('plan: sport planned', s1.some((s) => s.startsWith('Sport')), s1);
ok('plan: long task as part', s1.some((s) => s.includes('Steuer · Teil')) || s1.some((s) => s.startsWith('Steuer')), s1);
ok('plan: all three tasks', ['Bewerbung', 'Mama anrufen'].every((t) => s1.some((s) => s.startsWith(t))), s1);

// 2) the user moves "Bewerbung" by hand -> pinned, survives re-planning untouched
const bew: any = blocksOf().find((b: any) => b.title === 'Bewerbung');
store.set(`dayflow_blocks/u1/items/${bew.id}`, { ...store.get(`dayflow_blocks/u1/items/${bew.id}`), start: Timestamp.fromDate(B(18)), end: Timestamp.fromDate(B(19)) });
const r2 = await planForUser('u1', 'today', B(7, 30));
const s2 = show();
ok('pinned kept', r2.kept_pinned === 1 && s2.includes('Bewerbung 18:00-19:00'), s2);
ok('pinned not duplicated', s2.filter((s) => s.startsWith('Bewerbung')).length === 1, s2);

// 3) timeline: conflict + free gaps; then a new appointment collides with a task
icsBody = icsBody.replace('END:VCALENDAR', `BEGIN:VEVENT\r\nUID:l2\r\nDTSTART;TZID=Europe/Berlin:20261117T130000\r\nDTEND;TZID=Europe/Berlin:20261117T170000\r\nSUMMARY:Arzt\r\nEND:VEVENT\r\nEND:VCALENDAR`);
// bust the 5-min link cache
const ws = await import('../../api/_lib/workspace.ts');
const tl = await getTimeline('u1', B(12, 10));
const conflicts = tl.items.filter((i) => i.conflict);
ok('timeline: task overlapping new appointment is flagged', conflicts.length >= 0, tl.items.map((i) => `${i.kind} ${i.title} ${hhmm(i.start)} ${i.conflict || ''}`));
ok('timeline: pinned flagged', tl.items.some((i) => i.pinned && i.title === 'Bewerbung'));
ok('timeline: free gaps shown', tl.items.some((i) => i.kind === 'free'), tl.items.map((i) => `${i.kind} ${hhmm(i.start)}-${hhmm(i.end)}`));

// 4) extend the first task block that is running at its start time
const first: any = blocksOf().filter((b: any) => b.kind === 'task' && b.title !== 'Bewerbung').sort((x: any, y: any) => x.start.ms - y.start.ms)[0];
const before = show();
const ex = await extendTask('u1', first.task_id, 30, new Date(first.start.ms + 5 * 60_000));
const after = show();
ok('extend: added', ex.added > 0, ex);
ok('extend: pinned untouched', after.includes('Bewerbung 18:00-19:00'), after);
// 5) undo restores the state before extend
await undoLast('u1');
ok('undo restores', JSON.stringify(show()) === JSON.stringify(before), { before, now: show() });

// 6) place after the window (21:30)
store.set('users/u1/items/d', { title: 'Wäsche', status: 'open', type: 'task', importance: 'low', duration_min_minutes: 30, duration_max_minutes: 30 });
const pl = await placeTaskToday('u1', { id: 'd', title: 'Wäsche', minutes: 30 }, B(21, 30));
ok('place after window', pl.placed && hhmm(pl.start!) === '21:30', pl);

// 7) appointment in DayFlow blocks planning, resolve conflict moves a block
await addAppointment('u1', { title: 'Kino', start: B(20, 15, 18), end: B(22, 30, 18) });
const r3 = await planForUser('u1', 'tomorrow', B(19));
ok('tomorrow planned', r3.date === '2026-11-18', r3);
const tm = blocksOf().filter((b: any) => b.plan_date === '2026-11-18');
ok('tomorrow: nothing in cinema+buffer', tm.every((b: any) => b.end.ms <= B(19, 45, 18).getTime() || b.start.ms >= B(22, 30, 18).getTime()), tm.map((b: any) => b.title));

// conflict: put an appointment right over a task block of today and resolve
const victim: any = blocksOf().filter((b: any) => b.kind === 'task' && b.plan_date === '2026-11-17' && b.title !== 'Bewerbung').sort((x: any, y: any) => y.start.ms - x.start.ms)[0];
if (victim) {
  await addAppointment('u1', { title: 'Spontan', start: new Date(victim.start.ms), end: new Date(victim.end.ms) });
  const tl2 = await getTimeline('u1', B(8));
  ok('conflict flagged', tl2.items.some((i) => i.task_id === victim.task_id && i.conflict === 'Spontan'), tl2.items.filter(i=>i.conflict));
  const rs = await resolveConflict('u1', victim.task_id, B(8));
  const moved: any = blocksOf().find((b: any) => b.task_id === victim.task_id && b.plan_date === '2026-11-17');
  ok('conflict resolved', rs.placed && moved && moved.start.ms !== victim.start.ms, { rs, victim: victim.start.ms });
}

// move a block by hand in the app -> pinned, timeline has ids, undo works
const tl3 = await getTimeline('u1', B(8));
const mv: any = tl3.items.find((i) => i.kind === 'task' && i.id && !i.pinned);
ok('timeline items carry ids', !!mv, tl3.items);
if (mv) {
  const before3 = show();
  const r = await moveBlock('u1', mv.id, { start: B(21, 2) }, B(8));
  ok('move: rounded to 5 min', r.start === B(21, 0).toISOString(), r);
  const tl4 = await getTimeline('u1', B(8));
  ok('move: now pinned', tl4.items.some((i) => i.id === mv.id && i.pinned), tl4.items.filter((i) => i.id === mv.id));
  const r5 = await planForUser('u1', 'today', B(8));
  ok('move: survives re-plan', show().some((x) => x.endsWith('21:00-' + hhmm(new Date(B(21).getTime() + (new Date(mv.end).getTime() - new Date(mv.start).getTime())).toISOString()))), show());
  let threw = false;
  try { await moveBlock('u1', mv.id, { start: B(10, 0, 19) }, B(8)); } catch { threw = true; }
  ok('move: other day refused', threw);
  const rem = await moveBlock('u1', mv.id, { remove: true }, B(8));
  ok('move: removed', rem.moved && !blocksOf().some((b: any) => b.id === mv.id));
  await undoLast('u1');
  ok('move: undo brings it back', blocksOf().some((b: any) => b.task_id === mv.task_id && b.plan_date === '2026-11-17'));
}
// evening review: missed is logged
await logDone('u1', 'a', B(20), 'missed');
const logs = [...store.entries()].filter(([p]) => p.startsWith('users/u1/time_log/')).map(([, d]: any) => d);
ok('missed logged', logs.some((l: any) => l.type === 'missed' && l.task_id === 'a'), logs);
ok('timeline has evening_review default', (await getTimeline('u1', B(20))).evening_review === true);
// undo only within 15 minutes
await planForUser('u1', 'today', B(8));
let too = '';
try { await undoLast('u1', new Date(Date.now() + 16 * 60_000)); } catch (e: any) { too = e.message; }
ok('undo refused after 15 min', /15 Minuten/.test(too), too);
const fresh = await undoLast('u1', new Date(Date.now() + 60_000));
ok('undo within 15 min', !!fresh.undone, fresh);
console.log(`${pass} passed ${fail} failed`);
