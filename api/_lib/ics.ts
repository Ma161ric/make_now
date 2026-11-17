/**
 * Minimal iCalendar (.ics) support, no dependencies:
 *  - parseIcs: read a calendar (e.g. an iCloud calendar shared as a public
 *    link) and return the events inside a time range, recurring ones expanded
 *  - buildIcs: write DayFlow's plan as a feed the iPhone calendar can subscribe to
 *
 * Supported: DTSTART/DTEND/DURATION with TZID, UTC ("Z"), floating and
 * all-day (VALUE=DATE) values; RRULE with FREQ DAILY/WEEKLY/MONTHLY/YEARLY,
 * INTERVAL, COUNT, UNTIL, BYDAY (weekly); EXDATE; RECURRENCE-ID overrides;
 * STATUS:CANCELLED. That covers what Apple/Google calendars export in practice.
 */
import { zonedTimeToUtc, addDays } from '../../packages/core/src/freeSlotScheduling.js';

export interface IcsEvent {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  /** all-day events: local dates, end exclusive */
  allDay?: { startDate: string; endDate: string };
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface LocalDT {
  date: string; // YYYY-MM-DD (in tz)
  hour: number;
  minute: number;
  tz: string; // IANA zone or 'UTC'
  allDay: boolean;
}

const unescapeText = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): Prop | null {
  const colon = findValueColon(line);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...rawParams] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

/** first ':' that is not inside a quoted parameter value */
function findValueColon(line: string): number {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) return i;
  }
  return -1;
}

const tzCheck = new Map<string, boolean>();
function validTz(tz: string | undefined, fallback: string): string {
  if (!tz) return fallback;
  if (!tzCheck.has(tz)) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      tzCheck.set(tz, true);
    } catch {
      tzCheck.set(tz, false);
    }
  }
  return tzCheck.get(tz) ? tz : fallback;
}

function parseDT(p: Prop, defaultTz: string): LocalDT | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || p.params.VALUE === 'DATE') return { date, hour: 0, minute: 0, tz: defaultTz, allDay: true };
  const tz = m[7] ? 'UTC' : validTz(p.params.TZID, defaultTz);
  return { date, hour: Number(m[4]), minute: Number(m[5]), tz, allDay: false };
}

const toUtc = (d: LocalDT) => zonedTimeToUtc(d.date, d.hour, d.minute, d.tz);

function parseDuration(v: string): number | null {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, sign, w, d, h, min, s] = m;
  const ms = (((Number(w || 0) * 7 + Number(d || 0)) * 24 + Number(h || 0)) * 60 + Number(min || 0)) * 60_000 + Number(s || 0) * 1000;
  return sign === '-' ? -ms : ms;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
function addMonths(date: string, n: number): string | null {
  const [y, m, d] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  if (d > last) return null; // e.g. the 31st in a short month: skipped, like real calendars do
  return `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** local start dates of a recurring event's occurrences (until rangeEnd) */
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function expand(rule: string, start: LocalDT, rangeStartDate: string, rangeEndDate: string, defaultTz: string): string[] {
  const parts = Object.fromEntries(rule.split(';').map((kv) => kv.split('=') as [string, string]));
  const freq = parts.FREQ;
  const interval = Math.max(1, Number(parts.INTERVAL || 1));
  const count = parts.COUNT ? Number(parts.COUNT) : Infinity;
  let untilMs = Infinity;
  if (parts.UNTIL) {
    const u = parseDT({ name: 'UNTIL', params: {}, value: parts.UNTIL }, start.tz === 'UTC' ? defaultTz : start.tz);
    if (u) untilMs = u.allDay ? zonedTimeToUtc(addDays(u.date, 1), 0, 0, start.tz).getTime() - 1 : toUtc(u).getTime();
  }
  const byDay = (parts.BYDAY || '')
    .split(',')
    .map((d) => d.replace(/^[+-]?\d+/, ''))
    .map((d) => WEEKDAYS.indexOf(d))
    .filter((i) => i >= 0);

  const out: string[] = [];
  const push = (date: string) => {
    if (out.length >= count) return false;
    const at = toUtc({ ...start, date }).getTime();
    if (at > untilMs || date > rangeEndDate) return false;
    out.push(date);
    return true;
  };

  // Without COUNT the occurrences before the range don't matter: start close to it
  // (an endless daily series from years ago would otherwise cost thousands of steps)
  const lead = count === Infinity ? Math.max(0, dayDiff(start.date, rangeStartDate) - 7) : 0;

  if (freq === 'DAILY') {
    const first = addDays(start.date, Math.floor(lead / interval) * interval);
    for (let i = 0, d = first; i < 3000; i++, d = addDays(d, interval)) if (!push(d)) break;
  } else if (freq === 'WEEKLY') {
    const days = byDay.length ? byDay : [weekday(start.date)];
    // week starts Monday (WKST default)
    const mondayOffset = (weekday(start.date) + 6) % 7;
    let weekStart = addDays(start.date, -mondayOffset + Math.floor(lead / (7 * interval)) * 7 * interval);
    for (let w = 0; w < 1500; w++, weekStart = addDays(weekStart, 7 * interval)) {
      let stop = false;
      for (const wd of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = addDays(weekStart, (wd + 6) % 7);
        if (d < start.date) continue;
        if (!push(d)) {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
  } else if (freq === 'MONTHLY') {
    for (let i = 0; i < 600; i++) {
      const d = addMonths(start.date, i * interval);
      if (!d) continue;
      if (!push(d)) break;
    }
  } else if (freq === 'YEARLY') {
    for (let i = 0; i < 100; i++) {
      const d = addMonths(start.date, i * 12 * interval);
      if (!d) continue;
      if (!push(d)) break;
    }
  } else {
    out.push(start.date);
  }
  return out;
}

/** upper bound of entries read from one calendar file (keeps a huge file from blocking the server) */
export const MAX_EVENTS = 5_000;

export function parseIcs(text: string, from: Date, to: Date, defaultTz = 'Europe/Berlin'): IcsEvent[] {
  const lines = unfold(text);
  const raw: Prop[][] = [];
  let current: Prop[] | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = [];
    else if (line === 'END:VEVENT') {
      if (current) raw.push(current);
      current = null;
      // a normal calendar has a few thousand entries; more is a broken or hostile file
      if (raw.length >= MAX_EVENTS) break;
    } else if (current) {
      const p = parseLine(line);
      if (p) current.push(p);
    }
  }

  // RECURRENCE-ID overrides replace single occurrences of their series
  const overridden = new Set<string>();
  for (const props of raw) {
    const uid = props.find((p) => p.name === 'UID')?.value;
    const rid = props.find((p) => p.name === 'RECURRENCE-ID');
    if (uid && rid) {
      const d = parseDT(rid, defaultTz);
      if (d) overridden.add(`${uid}|${toUtc(d).getTime()}`);
    }
  }

  const rangeEndDate = addDays(new Date(to.getTime()).toISOString().slice(0, 10), 1);
  const rangeStartDate = addDays(new Date(from.getTime()).toISOString().slice(0, 10), -1);
  const out: IcsEvent[] = [];
  for (const props of raw) {
    const get = (n: string) => props.find((p) => p.name === n);
    if ((get('STATUS')?.value || '').toUpperCase() === 'CANCELLED') continue;
    const dtStartProp = get('DTSTART');
    if (!dtStartProp) continue;
    const start = parseDT(dtStartProp, defaultTz);
    if (!start) continue;
    const uid = get('UID')?.value || '';
    const title = unescapeText(get('SUMMARY')?.value || 'Termin').trim() || 'Termin';
    const location = get('LOCATION')?.value ? unescapeText(get('LOCATION')!.value).trim() : undefined;

    let durationMs: number;
    const dtEndProp = get('DTEND');
    const end = dtEndProp ? parseDT(dtEndProp, defaultTz) : null;
    if (start.allDay) {
      const days = end ? Math.max(1, Math.round((Date.parse(`${end.date}T00:00:00Z`) - Date.parse(`${start.date}T00:00:00Z`)) / 86_400_000)) : 1;
      durationMs = days * 86_400_000;
    } else if (end) {
      durationMs = toUtc(end).getTime() - toUtc(start).getTime();
    } else {
      durationMs = parseDuration(get('DURATION')?.value || '') ?? 60 * 60_000;
    }
    if (durationMs <= 0) durationMs = 60 * 60_000;

    const exdates = new Set<number>();
    for (const p of props.filter((x) => x.name === 'EXDATE')) {
      for (const v of p.value.split(',')) {
        const d = parseDT({ ...p, value: v }, defaultTz);
        if (d) exdates.add(d.allDay ? Date.parse(`${d.date}T00:00:00Z`) : toUtc(d).getTime());
      }
    }

    const rrule = get('RRULE')?.value;
    const isOverride = !!get('RECURRENCE-ID');
    const dates = rrule && !isOverride ? expand(rrule, start, rangeStartDate, rangeEndDate, defaultTz) : [start.date];

    for (const date of dates) {
      if (start.allDay) {
        const days = Math.round(durationMs / 86_400_000);
        const endDate = addDays(date, days);
        if (exdates.has(Date.parse(`${date}T00:00:00Z`))) continue;
        const s = zonedTimeToUtc(date, 0, 0, defaultTz);
        const e = zonedTimeToUtc(endDate, 0, 0, defaultTz);
        if (e <= from || s >= to) continue;
        out.push({ title, start: s, end: e, location, allDay: { startDate: date, endDate } });
        continue;
      }
      const s = toUtc({ ...start, date });
      if (exdates.has(s.getTime())) continue;
      if (rrule && !isOverride && overridden.has(`${uid}|${s.getTime()}`)) continue;
      const e = new Date(s.getTime() + durationMs);
      if (e <= from || s >= to) continue;
      out.push({ title, start: s, end: e, ...(location ? { location } : {}) });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ---------------------------------------------------------------- writing

const icsText = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 wants lines of at most 75 octets */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export interface FeedEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  /** minutes before start, or null for no alarm */
  alarmMinutes?: number | null;
}

export function buildIcs(name: string, events: FeedEvent[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DayFlow//Plan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(name)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@dayflow`,
      `DTSTAMP:${icsUtc(now)}`,
      `DTSTART:${icsUtc(e.start)}`,
      `DTEND:${icsUtc(e.end)}`,
      `SUMMARY:${icsText(e.title)}`
    );
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
    if (e.alarmMinutes !== null && e.alarmMinutes !== undefined) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:-PT${e.alarmMinutes}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** webcal://… (as iCloud hands it out) -> https://… */
/**
 * Only real internet hosts: no localhost, no IP addresses of private networks,
 * no cloud metadata endpoints (the server fetches these links).
 */
export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (h.includes(':')) return false; // IPv6 literals: never needed for calendar links
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  if (/^\d+$/.test(h)) return false; // decimal IP tricks like https://2130706433
  return h.includes('.');
}

export function normalizeCalendarUrl(input: string): string | null {
  const url = input.trim().replace(/^webcals?:\/\//i, 'https://');
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !isPublicHost(u.hostname) || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}
