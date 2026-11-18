import { dateContext } from '../../api/chat.ts';
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, info?: unknown) => { c ? pass++ : fail++; if (!c) console.log('FAIL', n, info); };
// 17.11.2026 23:20 Berlin = 22:20 UTC
const a = dateContext(new Date('2026-11-17T22:20:00Z'), 'Europe/Berlin');
ok('now iso', a.nowIso === '2026-11-17T23:20+01:00', a.nowIso);
ok('heute', a.days.startsWith('2026-11-17 = Dienstag (heute)'), a.days.split('\n')[0]);
ok('morgen', a.days.split('\n')[1] === '2026-11-18 = Mittwoch (morgen)', a.days.split('\n')[1]);
ok('8 Tage', a.days.split('\n').length === 8);
ok('Beispieltag ist nicht fest', a.exampleDay === '2026-11-19');
// just after midnight local: 00:10 Berlin on 18.11 = 23:10 UTC on 17.11
const b = dateContext(new Date('2026-11-17T23:10:00Z'), 'Europe/Berlin');
ok('nach Mitternacht lokal', b.nowIso === '2026-11-18T00:10+01:00' && b.days.startsWith('2026-11-18 = Mittwoch (heute)'), b.nowIso);
// summer time
const c = dateContext(new Date('2026-07-01T10:00:00Z'), 'Europe/Berlin');
ok('Sommerzeit', c.nowIso === '2026-07-01T12:00+02:00', c.nowIso);
const d = dateContext(new Date('2026-11-17T22:20:00Z'), 'America/New_York');
ok('New York', d.nowIso === '2026-11-17T17:20-05:00', d.nowIso);
console.log(`${pass} passed ${fail} failed`);
