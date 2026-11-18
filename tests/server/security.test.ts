import { normalizeCalendarUrl, isPublicHost, buildIcs } from '../../api/_lib/ics.ts';
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
for (const bad of ['http://example.com/a.ics', 'https://localhost/a', 'https://127.0.0.1/x', 'https://169.254.169.254/latest', 'https://10.0.0.5/x', 'https://192.168.1.1/x', 'https://172.20.1.1/x', 'https://[::1]/x', 'https://2130706433/x', 'https://metadata.google.internal/x', 'https://user:pw@example.com/x', 'file:///etc/passwd', 'javascript:alert(1)', 'https://foo.local/x'])
  ok(normalizeCalendarUrl(bad) === null, 'reject ' + bad);
for (const good of ['webcal://p123-caldav.icloud.com/published/2/abc', 'https://calendar.google.com/calendar/ical/x/basic.ics', 'https://outlook.office365.com/owa/calendar/x/calendar.ics'])
  ok(!!normalizeCalendarUrl(good), 'accept ' + good);
ok(isPublicHost('8.8.8.8') && !isPublicHost('100.64.0.1'), 'ip ranges');
const ics = buildIcs('DayFlow', [{ uid: 'u1', title: 'Hack\r\nBEGIN:VEVENT\rX', start: new Date('2026-11-17T10:00:00Z'), end: new Date('2026-11-17T11:00:00Z') }]);
ok(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT').length === 1 && !/\r(?!\n)/.test(ics), 'no line injection in feed ' + JSON.stringify(ics));
console.log(`${pass} passed ${fail} failed`);
