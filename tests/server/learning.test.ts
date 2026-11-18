import { learnFactor, scaleMinutes } from '../../api/_lib/learning.ts';
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
const now = new Date('2026-12-20T20:00:00Z');
const day = (n: number) => new Date(now.getTime() - n * 86400000);
function entries(n: number, ratio: number, spanDays: number) {
  const out: any[] = [];
  for (let i = 0; i < n; i++) {
    const s = new Date(day(spanDays - Math.floor((i * spanDays) / n)).getTime());
    s.setUTCHours(10, 0, 0, 0);
    const e = new Date(s.getTime() + 60 * 60000);
    out.push({ type: 'done', task_id: 't' + i, planned_start: s.toISOString(), planned_end: e.toISOString(), done_at: new Date(s.getTime() + ratio * 60 * 60000).toISOString(), at: s });
  }
  return out;
}
let r = learnFactor(entries(12, 1.3, 25), now);
ok(r.active && r.factor === 1.3, 'learns 1.3 ' + JSON.stringify(r));
r = learnFactor(entries(12, 1.3, 10), now);
ok(!r.active && r.factor === 1 && r.days_needed === 11, 'too few days ' + JSON.stringify(r));
r = learnFactor(entries(5, 1.3, 30), now);
ok(!r.active && r.factor === 1, 'too few samples');
r = learnFactor(entries(12, 1.05, 30), now);
ok(r.active && r.factor === 1, 'small difference ignored');
r = learnFactor(entries(12, 2.5, 30), now);
ok(r.factor === 1.5, 'capped at 1.5');
r = learnFactor(entries(12, 0.5, 30), now);
ok(r.factor === 0.8, 'floor 0.8');
// outliers (ticked off much later) ignored
const mixed = [...entries(10, 1.2, 30), ...entries(5, 6, 30).map((e, i) => ({ ...e, task_id: 'x' + i }))];
r = learnFactor(mixed, now);
ok(r.factor === 1.2 && r.samples === 10, 'outliers dropped ' + JSON.stringify(r));
// extend entries
const ext = entries(10, 1, 30).map((e) => ({ type: 'extend', task_id: e.task_id, planned_start: e.planned_start, planned_end: e.planned_end, minutes: 30, at: e.at }));
r = learnFactor(ext, now);
ok(r.factor === 1.5, 'extend 60+30 → 1.5 ' + JSON.stringify(r));
ok(scaleMinutes(60, 1.25) === 75 && scaleMinutes(undefined, 1.3) === undefined && scaleMinutes(20, 1) === 20, 'scale');
console.log(`${pass} passed ${fail} failed`);
