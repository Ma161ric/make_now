import { parseIcs, buildIcs, normalizeCalendarUrl } from '../../api/_lib/ics.ts';
let pass = 0, fail = 0;
const eq = (name: string, a: unknown, b: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', name, '\n  got ', JSON.stringify(a), '\n  want', JSON.stringify(b)); };
const ok = (name: string, c: boolean, d?: unknown) => { c ? pass++ : fail++; if (!c) console.log('FAIL', name, JSON.stringify(d)); };
const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
const from = new Date('2026-11-16T00:00:00Z'), to = new Date('2026-11-23T00:00:00Z');

// 1 simple TZID event
let r = parseIcs(cal(`BEGIN:VEVENT\r\nUID:a\r\nDTSTART;TZID=Europe/Berlin:20261117T140000\r\nDTEND;TZID=Europe/Berlin:20261117T160000\r\nSUMMARY:Übung Web\\, Raum 112\r\nLOCATION:Amalienstr. 73A\r\nEND:VEVENT`), from, to);
eq('tzid', r.map(e => [e.title, e.start.toISOString(), e.end.toISOString(), e.location]), [['Übung Web, Raum 112', '2026-11-17T13:00:00.000Z', '2026-11-17T15:00:00.000Z', 'Amalienstr. 73A']]);

// 2 weekly recurring with BYDAY, starting in October, EXDATE one week
r = parseIcs(cal(`BEGIN:VEVENT\r\nUID:b\r\nDTSTART;TZID=Europe/Berlin:20261014T100000\r\nDTEND;TZID=Europe/Berlin:20261014T120000\r\nRRULE:FREQ=WEEKLY;BYDAY=WE,FR;UNTIL=20270210T230000Z\r\nEXDATE;TZID=Europe/Berlin:20261120T100000\r\nSUMMARY:Vorlesung\r\nEND:VEVENT`), from, to);
eq('weekly', r.map(e => e.start.toISOString()), ['2026-11-18T09:00:00.000Z']);

// 3 folded line + UTC + DURATION
r = parseIcs(cal(`BEGIN:VEVENT\r\nUID:c\r\nDTSTART:20261119T170000Z\r\nDURATION:PT1H30M\r\nSUMMARY:Sehr langer Titel der\r\n  umgebrochen wurde\r\nEND:VEVENT`), from, to);
eq('fold+duration', r.map(e => [e.title, e.end.toISOString()]), [['Sehr langer Titel der umgebrochen wurde', '2026-11-19T18:30:00.000Z']]);

// 4 all-day
r = parseIcs(cal(`BEGIN:VEVENT\r\nUID:d\r\nDTSTART;VALUE=DATE:20261122\r\nDTEND;VALUE=DATE:20261123\r\nSUMMARY:Geburtstag\r\nEND:VEVENT`), from, to);
eq('allday', r.map(e => e.allDay), [{ startDate: '2026-11-22', endDate: '2026-11-23' }]);

// 5 cancelled + override (moved occurrence)
r = parseIcs(cal(`BEGIN:VEVENT\r\nUID:e\r\nDTSTART;TZID=Europe/Berlin:20261116T090000\r\nDTEND;TZID=Europe/Berlin:20261116T100000\r\nRRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Daily\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:e\r\nRECURRENCE-ID;TZID=Europe/Berlin:20261117T090000\r\nDTSTART;TZID=Europe/Berlin:20261117T150000\r\nDTEND;TZID=Europe/Berlin:20261117T160000\r\nSUMMARY:Daily verschoben\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:f\r\nSTATUS:CANCELLED\r\nDTSTART:20261118T080000Z\r\nDTEND:20261118T090000Z\r\nSUMMARY:abgesagt\r\nEND:VEVENT`), from, to);
eq('override', r.map(e => e.title + ' ' + e.start.toISOString()), ['Daily 2026-11-16T08:00:00.000Z', 'Daily verschoben 2026-11-17T14:00:00.000Z', 'Daily 2026-11-18T08:00:00.000Z']);

// 6 DST: weekly event crossing the March switch keeps local time
r = parseIcs(cal(`BEGIN:VEVENT\r\nUID:g\r\nDTSTART;TZID=Europe/Berlin:20270322T100000\r\nDTEND;TZID=Europe/Berlin:20270322T110000\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:x\r\nEND:VEVENT`), new Date('2027-03-28T00:00:00Z'), new Date('2027-04-01T00:00:00Z'));
eq('dst', r.map(e => e.start.toISOString()), ['2027-03-29T08:00:00.000Z']);

// 7 monthly + interval 2 weekly
r = parseIcs(cal(`BEGIN:VEVENT\r\nUID:h\r\nDTSTART;TZID=Europe/Berlin:20260918T180000\r\nDTEND;TZID=Europe/Berlin:20260918T190000\r\nRRULE:FREQ=MONTHLY\r\nSUMMARY:Monat\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:i\r\nDTSTART;TZID=Europe/Berlin:20261102T080000\r\nDTEND;TZID=Europe/Berlin:20261102T090000\r\nRRULE:FREQ=WEEKLY;INTERVAL=2\r\nSUMMARY:Zweiwoechentlich\r\nEND:VEVENT`), from, to);
eq('monthly+interval', r.map(e => e.title + ' ' + e.start.toISOString()), ['Zweiwoechentlich 2026-11-16T07:00:00.000Z', 'Monat 2026-11-18T17:00:00.000Z']);

// 8 build + reparse round trip
const ics = buildIcs('DayFlow', [{ uid: 'x1', title: 'Steuer; machen, jetzt', start: new Date('2026-11-17T09:00:00Z'), end: new Date('2026-11-17T10:00:00Z'), description: 'Von DayFlow eingeplant · sehr lange Beschreibung die über fünfundsiebzig Zeichen hinausgeht und gefaltet werden muss', alarmMinutes: 5 }]);
eq('lines<=75', ics.split('\r\n').every(l => Buffer.byteLength(l) <= 75), true);
r = parseIcs(ics, from, to);
eq('roundtrip', r.map(e => [e.title, e.start.toISOString()]), [['Steuer; machen, jetzt', '2026-11-17T09:00:00.000Z']]);

eq('url', [normalizeCalendarUrl('webcal://p12-caldav.icloud.com/published/2/abc'), normalizeCalendarUrl('http://x.de'), normalizeCalendarUrl('quatsch')], ['https://p12-caldav.icloud.com/published/2/abc', null, null]);
// endless daily series that started years ago still shows up today
{
  const old = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:old\r\nDTSTART;TZID=Europe/Berlin:20100104T080000\r\nDTEND;TZID=Europe/Berlin:20100104T083000\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Alt\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:oldw\r\nDTSTART;TZID=Europe/Berlin:20100104T090000\r\nDTEND;TZID=Europe/Berlin:20100104T100000\r\nRRULE:FREQ=WEEKLY;BYDAY=TU\r\nSUMMARY:AltWoche\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  const ev = parseIcs(old, new Date('2026-11-17T00:00:00Z'), new Date('2026-11-18T00:00:00Z'));
  ok('old daily series still today', ev.some((e) => e.title === 'Alt' && e.start.toISOString() === '2026-11-17T07:00:00.000Z'), ev.map((e) => e.title + ' ' + e.start.toISOString()));
  ok('old weekly series on tuesday', ev.some((e) => e.title === 'AltWoche' && e.start.toISOString() === '2026-11-17T08:00:00.000Z'), ev.map((e) => e.title + ' ' + e.start.toISOString()));
}
// hostile file: thousands of endless series must not block the server
{
  let big = 'BEGIN:VCALENDAR\r\n';
  for (let i = 0; i < 8000; i++) big += `BEGIN:VEVENT\r\nUID:${i}\r\nDTSTART:20000101T100000Z\r\nDTEND:20000101T110000Z\r\nRRULE:FREQ=DAILY\r\nSUMMARY:x\r\nEND:VEVENT\r\n`;
  big += 'END:VCALENDAR\r\n';
  const t0 = Date.now();
  parseIcs(big, new Date('2026-11-17T00:00:00Z'), new Date('2026-11-18T00:00:00Z'));
  ok('hostile file under 3 s', Date.now() - t0 < 3000, Date.now() - t0);
}
console.log(`${pass} passed ${fail} failed`);
