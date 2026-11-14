/**
 * Minimal Google OAuth + Calendar API client (plain fetch, no googleapis dep).
 *
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */

// Least privilege: read-only access to events (to show your appointments
// with title and place on "Heute"), the calendar list, free/busy, and full
// access ONLY to calendars this app creates (the "DayFlow" calendar).
export const EVENTS_READ_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
  EVENTS_READ_SCOPE,
];

const CAL = 'https://www.googleapis.com/calendar/v3';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export class GoogleAuthRevokedError extends Error {}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: env('GOOGLE_REDIRECT_URI'),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // we need a refresh token for the nightly run
    prompt: 'consent', // always return a refresh token, also on reconnect
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      ...body,
    }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    if (json.error === 'invalid_grant') throw new GoogleAuthRevokedError('Google access was revoked');
    throw new Error(`Google token error: ${json.error || res.status}`);
  }
  return json as { access_token: string; refresh_token?: string; scope: string; expires_in: number };
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: env('GOOGLE_REDIRECT_URI') });
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const t = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  return t.access_token;
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
}

async function api<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${CAL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`Google Calendar ${init.method || 'GET'} ${path.split('?')[0]}: ${json?.error?.message || res.status}`);
  return json as T;
}

/** Ids of the calendars the user has switched on in Google Calendar. */
export async function listVisibleCalendarIds(accessToken: string): Promise<string[]> {
  const out = await api<{ items: { id: string; selected?: boolean; primary?: boolean }[] }>(
    accessToken,
    '/users/me/calendarList?minAccessRole=freeBusyReader&maxResults=250'
  );
  return out.items.filter((c) => c.primary || c.selected).map((c) => c.id);
}

export async function freeBusy(accessToken: string, calendarIds: string[], timeMin: Date, timeMax: Date) {
  const out = await api<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(accessToken, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: calendarIds.slice(0, 50).map((id) => ({ id })),
    }),
  });
  return Object.values(out.calendars).flatMap((c) => (c.busy || []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) })));
}

export async function createCalendar(accessToken: string, timeZone: string): Promise<string> {
  const cal = await api<{ id: string }>(accessToken, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: 'DayFlow', description: 'Von DayFlow automatisch eingeplante Aufgaben', timeZone }),
  });
  return cal.id;
}

/** True if the calendar still exists and we can access it. */
export async function calendarExists(accessToken: string, calendarId: string): Promise<boolean> {
  const res = await fetch(`${CAL}/calendars/${encodeURIComponent(calendarId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

export async function listPlannedEventIds(accessToken: string, calendarId: string, planDate: string): Promise<string[]> {
  const params = new URLSearchParams({ privateExtendedProperty: `dayflow_plan_date=${planDate}`, maxResults: '250', showDeleted: 'false' });
  const out = await api<{ items: { id: string }[] }>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return (out.items || []).map((e) => e.id);
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string) {
  await api(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' }).catch(
    (e: Error) => {
      // already gone is fine
      if (!/404|410|deleted/i.test(e.message)) throw e;
    }
  );
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    timeZone: string;
    taskId: string;
    planDate: string;
    /** shows as "free" for others / other tools (used for free-time blocks) */
    transparent?: boolean;
    colorId?: string;
    reminderMinutes?: number | null;
  }
) {
  return api<{ id: string; htmlLink: string }>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString(), timeZone: event.timeZone },
      end: { dateTime: event.end.toISOString(), timeZone: event.timeZone },
      reminders: {
        useDefault: false,
        overrides: event.reminderMinutes === null ? [] : [{ method: 'popup', minutes: event.reminderMinutes ?? 5 }],
      },
      ...(event.transparent ? { transparency: 'transparent' } : {}),
      ...(event.colorId ? { colorId: event.colorId } : {}),
      extendedProperties: { private: { dayflow: '1', dayflow_task_id: event.taskId, dayflow_plan_date: event.planDate } },
    }),
  });
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  location?: string;
  transparency?: 'opaque' | 'transparent';
  status?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** Events of one calendar in [timeMin, timeMax), recurring ones expanded. */
export async function listEvents(accessToken: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const out = await api<{ items: CalendarEvent[] }>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return out.items || [];
}
