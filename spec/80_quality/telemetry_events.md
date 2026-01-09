# Telemetry Events

## Übersicht

Alle Events für Analytics und Monitoring (opt-in, GDPR-compliant).

## Event Categories

1. **Capture**: Notiz-Erfassung
2. **Extraction**: AI-Verarbeitung
3. **Planning**: Tagesplanung
4. **Execution**: Aufgaben erledigen
5. **Review**: Daily Review
6. **Integration**: Kalender, WhatsApp
7. **System**: Errors, Performance

## Event Schema

```json
{
  "event_name": "string",
  "timestamp": "ISO8601",
  "user_id": "hashed_device_id",
  "session_id": "uuid",
  "properties": {
    // Event-specific
  }
}
```

## 1. Capture Events

### note_created

**When**: User saves a new note

**Properties**:
```json
{
  "text_length": 150,
  "source": "manual" | "whatsapp"
}
```

### note_archived

**When**: User archives a note

**Properties**:
```json
{
  "source": "swipe" | "extraction_review" | "manual"
}
```

## 2. Extraction Events

### extraction_started

**When**: User triggers extraction

**Properties**:
```json
{
  "note_id": "uuid",
  "text_length": 150,
  "trigger": "manual" | "auto" | "whatsapp"
}
```

### extraction_completed

**When**: Extraction finishes

**Properties**:
```json
{
  "note_id": "uuid",
  "duration_ms": 1850,
  "tasks_found": 2,
  "events_found": 1,
  "ideas_found": 0,
  "confidence_avg": 0.85,
  "question_asked": false
}
```

### extraction_failed

**When**: Extraction fails

**Properties**:
```json
{
  "note_id": "uuid",
  "error_type": "timeout" | "parse_error" | "no_items",
  "duration_ms": 5200,
  "retry_count": 1
}
```

### extraction_reviewed

**When**: User completes review

**Properties**:
```json
{
  "note_id": "uuid",
  "items_accepted": 3,
  "items_rejected": 1,
  "items_modified": 1,
  "question_answered": true,
  "duration_seconds": 15
}
```

## 3. Planning Events

### day_plan_requested

**When**: User requests a plan

**Properties**:
```json
{
  "date": "2025-01-09",
  "trigger": "automatic" | "manual" | "replan",
  "available_tasks": 8,
  "calendar_events": 2
}
```

### day_plan_generated

**When**: Plan is generated

**Properties**:
```json
{
  "date": "2025-01-09",
  "duration_ms": 1200,
  "focus_task_id": "uuid",
  "mini_tasks_count": 2,
  "buffer_minutes": 15,
  "confidence": 0.9,
  "reasoning_length": 120
}
```

### day_plan_confirmed

**When**: User confirms plan

**Properties**:
```json
{
  "date": "2025-01-09",
  "focus_task_id": "uuid",
  "mini_tasks_count": 2,
  "time_to_confirm_seconds": 8
}
```

### day_plan_rejected

**When**: User rejects plan (Plan B)

**Properties**:
```json
{
  "date": "2025-01-09",
  "reason": "wrong_focus" | "too_much" | "too_little" | "manual",
  "replan_count": 1
}
```

### replan_triggered

**When**: User triggers replan

**Properties**:
```json
{
  "date": "2025-01-09",
  "time_remaining_minutes": 210,
  "completed_tasks": 1,
  "total_tasks": 3,
  "replan_count": 2
}
```

### replan_limit_reached

**When**: Replan limit hit

**Properties**:
```json
{
  "date": "2025-01-09",
  "replan_count": 3
}
```

## 4. Execution Events

### task_started

**When**: User starts a task

**Properties**:
```json
{
  "task_id": "uuid",
  "task_type": "focus" | "mini",
  "planned_duration_minutes": 90,
  "start_time": "09:15"
}
```

### task_completed

**When**: User marks task done

**Properties**:
```json
{
  "task_id": "uuid",
  "task_type": "focus" | "mini",
  "planned_duration_minutes": 90,
  "actual_duration_minutes": 105,
  "on_time": false,
  "from_today_plan": true
}
```

### task_postponed

**When**: User moves task

**Properties**:
```json
{
  "task_id": "uuid",
  "from_date": "2025-01-09",
  "to_date": "2025-01-10",
  "reason": "no_time" | "plan_b" | "manual"
}
```

### task_deleted

**When**: User deletes task

**Properties**:
```json
{
  "task_id": "uuid",
  "status": "open" | "done",
  "age_days": 3
}
```

## 5. Review Events

### daily_review_started

**When**: User opens review

**Properties**:
```json
{
  "date": "2025-01-09",
  "trigger": "reminder" | "manual",
  "time": "18:45",
  "total_tasks": 3
}
```

### daily_review_completed

**When**: User completes review

**Properties**:
```json
{
  "date": "2025-01-09",
  "completed_tasks": 2,
  "postponed_tasks": 1,
  "open_tasks": 0,
  "completion_rate": 0.66,
  "mood": "happy" | "neutral" | "sad" | null,
  "duration_seconds": 45
}
```

### daily_review_skipped

**When**: User skips review

**Properties**:
```json
{
  "date": "2025-01-09"
}
```

## 6. Integration Events

### calendar_connected

**When**: Calendar connected

**Properties**:
```json
{
  "provider": "icloud" | "google" | "outlook",
  "calendars_selected": 3
}
```

### calendar_disconnected

**When**: Calendar disconnected

**Properties**:
```json
{
  "provider": "icloud" | "google" | "outlook",
  "days_connected": 15
}
```

### calendar_sync_started

**When**: Sync starts

**Properties**:
```json
{
  "provider": "icloud" | "google" | "outlook",
  "trigger": "automatic" | "manual"
}
```

### calendar_sync_completed

**When**: Sync finishes

**Properties**:
```json
{
  "provider": "icloud" | "google" | "outlook",
  "duration_ms": 850,
  "events_synced": 12,
  "errors": 0
}
```

### calendar_sync_failed

**When**: Sync fails

**Properties**:
```json
{
  "provider": "icloud" | "google" | "outlook",
  "error_type": "auth" | "network" | "timeout",
  "retry_count": 2
}
```

### whatsapp_connected

**When**: WhatsApp connected

**Properties**:
```json
{
  "phone_number_hashed": "sha256_hash"
}
```

### whatsapp_disconnected

**When**: WhatsApp disconnected

**Properties**:
```json
{
  "days_connected": 10,
  "messages_processed": 45
}
```

### whatsapp_message_received

**When**: Message from WhatsApp

**Properties**:
```json
{
  "message_length": 80,
  "auto_extract": true
}
```

### whatsapp_command_parsed

**When**: Command recognized

**Properties**:
```json
{
  "command": "done" | "morgen" | "duration" | "wichtig",
  "success": true
}
```

## 7. System Events

### app_opened

**When**: App foregrounded

**Properties**:
```json
{
  "session_id": "uuid",
  "time_since_last_open_hours": 12
}
```

### app_closed

**When**: App backgrounded

**Properties**:
```json
{
  "session_id": "uuid",
  "session_duration_seconds": 180
}
```

### error_occurred

**When**: Error happens

**Properties**:
```json
{
  "error_type": "network" | "parse" | "validation" | "unknown",
  "error_message": "sanitized_message",
  "context": "extraction" | "planning" | "sync"
}
```

### performance_slow

**When**: Operation > threshold

**Properties**:
```json
{
  "operation": "extraction" | "planning" | "query",
  "duration_ms": 5200,
  "threshold_ms": 3000
}
```

### offline_queue_synced

**When**: Offline queue processes

**Properties**:
```json
{
  "items_queued": 5,
  "items_synced": 5,
  "items_failed": 0,
  "duration_ms": 1200
}
```

## Aggregated Metrics

### Daily Aggregates

**Computed once per day**:
- `notes_created_count`
- `tasks_created_count`
- `tasks_completed_count`
- `tasks_completion_rate`
- `extractions_count`
- `extractions_avg_confidence`
- `plans_confirmed_count`
- `replan_count`
- `review_completed` (boolean)

### Weekly Aggregates

- `active_days` (days with ≥1 note)
- `avg_notes_per_day`
- `avg_tasks_completed_per_day`
- `avg_completion_rate`

## Privacy Safeguards

### PII Removal

**Never logged**:
- Task/Event titles
- Note raw_text
- Email
- Phone number (only hash)

**Sanitized**:
- Error messages (remove user data)
- Durations (rounded to nearest 5s)

### Data Retention

- Raw Events: 365 days
- Aggregated Metrics: 2 years
- User Deletion: All events deleted within 30 days

## Implementation Notes

### Backend

```typescript
interface TelemetryEvent {
  event_name: string;
  timestamp: string; // ISO8601
  user_id: string; // hashed
  session_id: string; // UUID
  properties: Record<string, any>;
}

function trackEvent(name: string, props: Record<string, any>) {
  if (!userHasOptedIn()) return;
  
  const event: TelemetryEvent = {
    event_name: name,
    timestamp: new Date().toISOString(),
    user_id: hashDeviceId(getDeviceId()),
    session_id: getCurrentSessionId(),
    properties: sanitize(props)
  };
  
  sendToAnalytics(event);
}
```

### Opt-In Check

```typescript
function userHasOptedIn(): boolean {
  return getUserSettings().analytics_enabled === true;
}
```

### Sanitization

```typescript
function sanitize(props: Record<string, any>): Record<string, any> {
  // Remove PII
  delete props.email;
  delete props.phone_number;
  delete props.text;
  delete props.title;
  
  // Round durations
  if (props.duration_ms) {
    props.duration_ms = Math.round(props.duration_ms / 5000) * 5000;
  }
  
  return props;
}
```
