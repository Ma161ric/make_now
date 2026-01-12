# Calendar Sync Implementation Plan (V2.0)

## Overview
Implement multi-provider calendar integration (Google, Apple/iCloud, Outlook) read-only to show busy intervals and suggest tasks only in free slots.

## Supported Providers

| Provider | Protocol | Complexity | Priority |
|----------|----------|-----------|----------|
| **Google** | OAuth 2.0 + Google Calendar API | Medium | 1 (START) |
| **Apple (iCloud)** | CalDAV + Sign in with Apple | Medium | 2 (WEEK 2) |
| **Outlook** | OAuth 2.0 + Microsoft Graph API | Medium | 3 (WEEK 3) |

## Architecture

```
┌─ Frontend (React)
│  ├─ SettingsScreen: "Connect Calendar" button
│  ├─ OAuth Redirect Handler
│  └─ TodayScreen: Show busy intervals + free slots
│
├─ Backend (Vercel Functions)
│  ├─ /api/auth/google-oauth → redirect to Google OAuth
│  ├─ /api/auth/google-callback → exchange code for token, save to user
│  └─ /api/calendar/fetch-events → read events from Google Calendar API
│
└─ Storage (Firebase)
   └─ users/{userId}/calendarConnection: {provider, token, lastSync}
      users/{userId}/busyIntervals: [{ start, end, title }]
```

## Implementation Steps

### Phase 1: Google OAuth Setup (Day 1)

**1.1 Google Cloud Console Configuration**
```
1. Create OAuth 2.0 credential (Web application)
2. Set Authorized redirect URIs:
   - http://localhost:5173/auth/calendar/callback (dev)
   - https://dayflow.vercel.app/auth/calendar/callback (prod)
3. Get Client ID + Secret
4. Store in environment:
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_REDIRECT_URI (https://dayflow.vercel.app/auth/calendar/callback)
```

**1.2 Apple Sign In Setup** (for CalDAV auth)
```
1. Apple Developer Account
2. Create App ID with "Sign in with Apple" capability
3. Create Services ID for Web
4. Get Team ID, Key ID, Key File
5. Store in environment:
   - APPLE_TEAM_ID
   - APPLE_KEY_ID
   - APPLE_KEY_FILE (private key)
   - APPLE_CLIENT_ID
```

**1.3 Outlook OAuth Setup**
```
1. Microsoft Azure Portal
2. Create App Registration
3. Create Client Secret
4. Set Redirect URI:
   - https://dayflow.vercel.app/auth/calendar/callback
5. Store in environment:
   - MICROSOFT_CLIENT_ID
   - MICROSOFT_CLIENT_SECRET
   - MICROSOFT_REDIRECT_URI
```

**1.4 Create Multi-Provider OAuth Flow API**

New file: `api/auth/calendar-oauth.ts`
```typescript
// GET /api/auth/calendar-oauth?provider=google|apple|outlook&userId=XXX
// Dispatches to provider-specific OAuth flow
// Returns: redirect to provider consent screen
```

New file: `api/auth/calendar-callback.ts`
```typescript
// GET /api/auth/calendar-callback?provider=google&code=XXX&state=YYY
// 1. Identify provider
// 2. Exchange code for tokens
// 3. Save to users/{userId}/calendarConnection[provider]
// 4. Redirect to app: /settings?calendar=connected
```

### Phase 2: Calendar Event Fetching (Day 2)

**2.1 Provider-Specific Fetch APIs**

New file: `api/calendar/fetch-google.ts`
```typescript
// Fetch from Google Calendar API
// 1. Get user's Google access token
// 2. Call: https://www.googleapis.com/calendar/v3/calendars/primary/events
// 3. Parse events → BusyIntervals
```

New file: `api/calendar/fetch-apple.ts`
```typescript
// Fetch via CalDAV protocol (Apple's standard)
// 1. Get user's iCloud credentials from calendarConnection
// 2. Connect to CalDAV server (caldav.icloud.com)
// 3. Query VEVENT entries for date range
// 4. Parse → BusyIntervals
// Note: CalDAV is standard protocol, works with any provider
```

New file: `api/calendar/fetch-outlook.ts`
```typescript
// Fetch from Microsoft Graph API
// 1. Get user's Outlook access token
// 2. Call: https://graph.microsoft.com/v1.0/me/calendarview
// 3. Parse events → BusyIntervals
```

**2.2 Unified Fetch Endpoint**

New file: `api/calendar/fetch-events.ts`
```typescript
// POST /api/calendar/fetch-events
// Body: { userId, provider, date } or { userId, dateRange: [start, end] }
// 1. Get user's calendarConnection for provider
// 2. Route to provider-specific fetch (Google/Apple/Outlook)
// 3. Parse events → BusyIntervals
// 4. Save to users/{userId}/busyIntervals/{provider}/{date}
// 5. Return: [{ start_at, end_at, title, all_day, provider }]
```

Update `packages/core/src/models.ts`:
```typescript
export interface BusyInterval {
  id: string;
  calendar_id: string;
  start_at: DateTime;
  end_at: DateTime;
  title?: string;
  all_day: boolean;
  fetched_at: DateTime;
}

export interface CalendarConnection {
  id: string;
  provider: 'google' | 'outlook'; // outlook future
  connected_at: DateTime;
  last_sync: DateTime;
  status: 'active' | 'disconnected' | 'error';
  calendar_id: string; // Google's primary calendar ID
}
```

### Phase 3: UI Integration (Day 2-3)

**3.1 Settings Screen - Multi-Provider Connect**

File: `apps/web/src/screens/SettingsScreen.tsx`
```tsx
// Add section "Calendar Integration"
// Show 3 provider buttons:
// ┌─────────────────────────────────────┐
// │ Google Calendar  [Connect]          │
// │ Apple (iCloud)   [Connect]          │
// │ Outlook          [Connect]          │
// └─────────────────────────────────────┘
// 
// After connecting, show:
// ✓ Google Calendar (connected 2h ago)
// ✓ Apple iCloud (connected yesterday)
// [Disconnect button for each]
//
// Note: User can connect multiple calendars simultaneously!
```

**3.2 Today Screen - Show Free Slots**

File: `apps/web/src/screens/TodayScreen.tsx`
```tsx
// Fetch busyIntervals for today on component mount
// Show timeline view:
// ┌─────────────────────────────────────────┐
// │ 9:00  [Meeting]                 [Free]  │
// │ 10:00 [Meeting continues]               │
// │ 11:00 [FREE - 90min available]          │
// │ 12:00 [Lunch]                           │
// │ 13:00 [FREE - 3h available]             │
// └─────────────────────────────────────────┘

// When generating plan:
// ✅ Suggest focus task in 90min+ slot
// ✅ Suggest mini tasks in smaller slots
// ❌ Avoid scheduling over busy intervals
```

**3.3 Plan Generation Algorithm Update**

File: `packages/core/src/scheduling.ts`
```typescript
// Add optional busyIntervals parameter
// When generating plan:
// 1. Calculate freeSlots from busyIntervals
// 2. For focusTask: require freeSlot >= 90min
// 3. For miniTasks: fit in freeSlots >= 5min
// 4. Return timeBlocks only in freeSlots
// 5. Show reasoning: "Fokus geplant in 11:00-12:30 (einziges freies 90min+ Fenster)"
```

### Phase 4: Data Storage (Day 1-2)

**4.1 Store Calendar Connections (Multi-Provider)**

In Firebase Firestore:
```
users/{userId}/
  ├─ calendarConnections: {
  │    google: {
  │      provider: 'google',
  │      calendar_id: 'primary',
  │      connected_at: timestamp,
  │      last_sync: timestamp,
  │      status: 'active'
  │    },
  │    apple: {
  │      provider: 'apple',
  │      calendar_id: 'icloud@icloud.com',
  │      connected_at: timestamp,
  │      last_sync: timestamp,
  │      status: 'active'
  │    },
  │    outlook: {
  │      provider: 'outlook',
  │      calendar_id: 'AAMkADk0...',
  │      connected_at: timestamp,
  │      last_sync: timestamp,
  │      status: 'disconnected'
  │    }
  │  }
  │
  └─ private/ (encrypted field)
       └─ calendarTokens: {
            google: {
              access_token: '...',
              refresh_token: '...',
              expires_at: timestamp
            },
            apple: {
              username: '...',
              password: '...' (encrypted),
              calendar_url: 'https://caldav.icloud.com/...'
            },
            outlook: {
              access_token: '...',
              refresh_token: '...',
              expires_at: timestamp
            }
          }
```

**4.2 Cache Busy Intervals (Per Provider)**

Per day per provider (avoid repeated API calls):
```
users/{userId}/busyIntervals/{provider}/{date}/
  ├─ fetched_at: timestamp
  ├─ intervals: [
  │    {
  │      id: 'google-event-123' | 'apple-vevent-xyz' | 'outlook-event-abc',
  │      provider: 'google' | 'apple' | 'outlook',
  │      start_at: '2026-01-12T10:00:00Z',
  │      end_at: '2026-01-12T11:00:00Z',
  │      title: 'Team Meeting',
  │      all_day: false
  │    }
  │  ]
```

**Merged View (for TodayScreen):**
```
TodayScreen will:
1. Fetch busyIntervals from ALL connected providers
2. Merge intervals across providers
3. Show unified timeline: "10-11 Team Meeting (Google) + 11-12 Lunch (Apple)"
4. Calculate freeSlots accounting for ALL meetings across ALL calendars
```

### Phase 5: Edge Cases & Error Handling (Day 3)

**5.1 Token Refresh**
- Google tokens expire in 1 hour
- Use refresh_token to get new access_token
- Implement token refresh middleware in API routes

**5.2 Calendar Sync Failures**
- Network error → show "Sync failed, using last cached data"
- Permission revoked → show "Calendar disconnected, reconnect?"
- Rate limit → exponential backoff

**5.3 Overlapping Events**
- Merge overlapping busy intervals into single interval
- Example: [9-10] + [9:30-11] = [9-11]

**5.4 All-Day Events**
- Mark as `all_day: true`
- Block entire day (no planning)
- Show as banner: "🌍 All-Day Event: Company Offsite"

### Phase 6: Testing & Deployment (Day 3-4)

**6.1 Unit Tests**
- Test token refresh logic
- Test interval merging
- Test free slot calculation
- Test plan generation with busy intervals

**6.2 Integration Tests**
- Full OAuth flow (mock Google API)
- Fetch events → parse → store → retrieve
- Plan generation uses real busy intervals

**6.3 E2E Tests**
- User connects calendar
- Calendar events appear in plan screen
- Plan suggests tasks in free slots only

---

---

## Development Timeline (Multi-Provider)

| Phase | Task | Days | Start | End |
|-------|------|------|-------|-----|
| 1 | OAuth Setup (Google + Apple + Outlook) | 2 | Mon | Tue |
| 2 | Fetch Events APIs (Google/Apple/Outlook) | 2 | Wed | Thu |
| 3 | UI Integration + Merge Logic | 1 | Fri | Fri |
| 4 | Data Storage (Multi-Provider) | 1 | Sat | Sat |
| 5 | Error Handling + Token Refresh | 1 | Sun | Sun |
| 6 | Testing & Deploy | 1 | Mon | Mon |
| | **Total** | **~8 days** | | |

**Phased Rollout:**
- **Week 1**: Google (START) - Most users
- **Week 2**: Apple iCloud - Large user base
- **Week 3**: Outlook - Enterprise users

---

## Testing Scenarios

### ✅ Happy Path (Multi-Provider)
1. User connects **Google Calendar** + **Apple iCloud**
2. System fetches events from both:
   - Google: 2 meetings (10-11, 14-15)
   - Apple: 1 lunch event (12-13)
3. Merged timeline shows: 10-11 Meeting, 12-13 Lunch, 14-15 Meeting
4. Plan generated: focus task at 15:30-17:00 (only free 90min slot, after all meetings)
5. Reasoning: "Fokus in 15:30-17:00, einziges Fenster ≥90min nach allen Meetings"

### ⚠️ Provider-Specific Edge Cases
1. **Google token expires**: Auto-refresh using refresh_token ✅
2. **Apple (CalDAV) down**: Use cached intervals from last sync, show notice
3. **Outlook permission revoked**: Show "Reconnect Outlook?" button
4. **Different timezones**: Google/Outlook/Apple have different timezone formats - normalize all to UTC
5. **All-day event from Apple** (format: DATE, not DATETIME): Block entire day
6. **Duplicate events** (same meeting in multiple calendars): Deduplicate by start_at + end_at + title fuzzy match

---

## API Contracts

### GET /api/auth/google-oauth
```
Input: ?userId=abc123
Output: 302 redirect to Google OAuth
```

### GET /api/auth/google-callback
```
Input: ?code=xxx&state=yyy
Process: Exchange code → token → save to Firebase
Output: 302 redirect to app (/settings?calendar=connected)
```

### POST /api/calendar/fetch-events
```
Input: {
  userId: string,
  date: string (YYYY-MM-DD) or dateRange: [start, end]
}
Output: {
  success: boolean,
  intervals: BusyInterval[],
  cached: boolean,
  lastSync: timestamp
}
Error: {
  error: string,
  reason: 'token_expired' | 'permission_denied' | 'network_error'
}
```

---

## Files to Create/Modify

**New Files:**
- `api/auth/calendar-oauth.ts` (multi-provider dispatcher)
- `api/auth/calendar-callback.ts` (multi-provider handler)
- `api/auth/google-oauth-handler.ts` (Google-specific)
- `api/auth/apple-signin-handler.ts` (Apple-specific)
- `api/auth/outlook-oauth-handler.ts` (Outlook-specific)
- `api/calendar/fetch-events.ts` (unified endpoint)
- `api/calendar/fetch-google.ts` (Google Calendar API)
- `api/calendar/fetch-apple.ts` (CalDAV protocol)
- `api/calendar/fetch-outlook.ts` (Microsoft Graph API)
- `apps/web/src/utils/calendarUtils.ts` (merge, dedupe, normalize)
- `apps/web/src/components/CalendarTimeline.tsx` (multi-provider timeline UI)
- `packages/core/src/calendarIntegration.ts` (logic)

**Modified Files:**
- `packages/core/src/models.ts` (CalendarConnection with provider array)
- `packages/core/src/scheduling.ts` (busyIntervals from multiple providers)
- `apps/web/src/screens/SettingsScreen.tsx` (3 provider buttons)
- `apps/web/src/screens/TodayScreen.tsx` (show merged intervals)
- `.env.local` / `.env.production` (GOOGLE_* + APPLE_* + MICROSOFT_*)

---

## Start Point

**First commit:** Set up OAuth infrastructure
1. Google Cloud Console configuration
2. `/api/auth/google-oauth.ts` → redirects to Google
3. `/api/auth/google-callback.ts` → saves token
4. Settings button "Connect Calendar"

Then iterate: Fetch → Display → Plan Integration → Polish

Ready to start? 🚀
