# Calendar Provider Integration

## Übersicht

Generisches Interface für Read-only Kalender-Integration. Unterstützt iCloud, Google Calendar, Outlook. Schreibt NICHT in Kalender (MVP).

## Provider Interface

```typescript
interface CalendarProvider {
  connect(credentials: ProviderCredentials): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  sync(date: Date): Promise<BusyInterval[]>;
  getWorkingHours(): Promise<WorkingHours>;
  getStatus(): ConnectionStatus;
}
```

## Supported Providers

### iCloud

- **Platform**: iOS native
- **Auth**: iOS Keychain
- **API**: EventKit Framework
- **Rate Limit**: Unlimited (local)

### Google Calendar

- **Platform**: iOS + Android
- **Auth**: OAuth 2.0
- **API**: Google Calendar API v3
- **Rate Limit**: 1.000.000 requests/day

### Microsoft Outlook

- **Platform**: iOS + Android
- **Auth**: OAuth 2.0 / MSAL
- **API**: Microsoft Graph API
- **Rate Limit**: 10.000 requests/10 minutes

## Data Models

### BusyInterval

```json
{
  "calendar_id": "google_cal_event_12345",
  "start_at": "2026-01-09T14:00:00+01:00",
  "end_at": "2026-01-09T15:00:00+01:00",
  "title": "Meeting mit Team",
  "all_day": false,
  "timezone": "Europe/Berlin"
}
```

### WorkingHours

```json
{
  "monday": {"start": "09:00", "end": "18:00"},
  "tuesday": {"start": "09:00", "end": "18:00"},
  "wednesday": {"start": "09:00", "end": "18:00"},
  "thursday": {"start": "09:00", "end": "18:00"},
  "friday": {"start": "09:00", "end": "18:00"},
  "saturday": null,
  "sunday": null
}
```

## Connection Flow

### 1. Request Permission

```typescript
const result = await provider.connect({
  scope: "read_only",
  requested_calendars: ["primary"]
});
```

### 2. Handle OAuth (Google/Outlook)

- Redirect to Provider OAuth URL
- User authorizes
- Callback with auth code
- Exchange for access token
- Store in secure storage

### 3. Store Connection

```typescript
const connection = {
  provider: "google",
  connected_at: new Date(),
  status: "active",
  calendar_id: "primary"
};
```

## Sync Flow

### Daily Sync (Background)

```typescript
async function dailySync() {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  
  const busyIntervalsToday = await provider.sync(today);
  const busyIntervalsTomorrow = await provider.sync(tomorrow);
  
  await saveBusyIntervals([...busyIntervalsToday, ...busyIntervalsTomorrow]);
}
```

### On-Demand Sync (User-triggered)

```typescript
async function syncNow() {
  const today = new Date();
  const busyIntervals = await provider.sync(today);
  await saveBusyIntervals(busyIntervals);
  return busyIntervals;
}
```

## Error Handling

### Permission Denied

```typescript
if (result.error === "permission_denied") {
  showDialog("Kalender-Berechtigung benötigt");
  // Guide to Settings
}
```

### Token Expired

```typescript
if (error.status === 401) {
  await refreshToken();
  retry(originalRequest);
}
```

### Network Error

```typescript
if (error.type === "network") {
  // Use cached data
  const cachedIntervals = await getCachedBusyIntervals(date);
  return cachedIntervals;
}
```

## Free Slot Calculation

```typescript
function calculateFreeSlots(
  busyIntervals: BusyInterval[],
  workingHours: WorkingHours,
  date: Date
): FreeSlot[] {
  const dayOfWeek = getDayOfWeek(date);
  const hours = workingHours[dayOfWeek];
  
  if (!hours) return []; // Weekend
  
  const start = parseTime(hours.start);
  const end = parseTime(hours.end);
  
  // Sort busy intervals
  const sorted = busyIntervals.sort((a, b) => a.start_at - b.start_at);
  
  const freeSlots = [];
  let currentTime = start;
  
  for (const busy of sorted) {
    if (busy.start_at > currentTime) {
      // Free slot before busy interval
      freeSlots.push({
        start_at: currentTime,
        end_at: busy.start_at,
        duration_minutes: (busy.start_at - currentTime) / 60000
      });
    }
    currentTime = Math.max(currentTime, busy.end_at);
  }
  
  // Free slot after last busy interval
  if (currentTime < end) {
    freeSlots.push({
      start_at: currentTime,
      end_at: end,
      duration_minutes: (end - currentTime) / 60000
    });
  }
  
  return freeSlots.filter(slot => slot.duration_minutes >= 10); // Min 10min
}
```

## Caching Strategy

- Cache BusyIntervals for 6 hours
- Invalidate on manual sync
- Store with timestamp

```typescript
interface CachedData {
  date: string;
  intervals: BusyInterval[];
  fetched_at: Date;
  expires_at: Date; // fetched_at + 6 hours
}
```

## Privacy

- Nur Event-Zeiten, KEINE Details (außer optional Title)
- Kein Zugriff auf Teilnehmer
- Kein Zugriff auf Beschreibung
- Kein Schreiben (MVP)

## Settings UI

```
[x] Kalender verbunden: Google Calendar
    Letzte Synchronisation: vor 2 Std

[ ] Trennen
```

## Testing

Mock Provider für Tests:

```typescript
class MockCalendarProvider implements CalendarProvider {
  async sync(date: Date): Promise<BusyInterval[]> {
    return [
      {
        start_at: "2026-01-09T14:00:00+01:00",
        end_at: "2026-01-09T15:00:00+01:00",
        title: "Mock Meeting"
      }
    ];
  }
}
```
