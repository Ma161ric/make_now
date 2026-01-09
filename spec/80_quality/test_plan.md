# Test Plan

## Übersicht

Teststrategie für Unit Tests, Integration Tests, Flow Tests, Schema Validation und E2E Tests.

## Test Pyramid

```
         ╱╲
        ╱E2E╲        ~10 Tests
       ╱──────╲
      ╱ Flow  ╲      ~30 Tests
     ╱──────────╲
    ╱Integration╲    ~50 Tests
   ╱──────────────╲
  ╱  Unit Tests   ╲  ~200 Tests
 ╱────────────────╲
```

## 1. Unit Tests

**Target Coverage**: 80%

### Models

**Task Model**:
- ✅ Create task with valid data
- ✅ Validate title (min 1, max 200 chars)
- ✅ Validate duration (min > 0, max < min)
- ✅ Default importance = normal
- ✅ Default energy_type = mental
- ✅ State transitions (open → in_progress → done)
- ❌ Invalid state transition (open → done without in_progress)
- ✅ Due date in past (allowed)
- ✅ Foreign key constraint (inbox_note_id must exist)

**Event Model**:
- ✅ Create event with valid data
- ✅ Validate end_time > start_time
- ✅ Default all_day = false
- ✅ Location optional
- ✅ State transitions (tentative → confirmed)
- ❌ Invalid state transition (confirmed → tentative)

**Idea Model**:
- ✅ Create idea with valid data
- ✅ Tags as JSON array
- ✅ Default tags = []

**InboxNote Model**:
- ✅ Create note with valid data
- ✅ Validate raw_text (min 3, max 2000 chars)
- ✅ Default status = unprocessed
- ✅ State transitions (unprocessed → reviewed → archived)

**DayPlan Model**:
- ✅ Create plan with valid data
- ✅ Unique constraint (user_id, date)
- ✅ Focus task required
- ✅ Mini tasks (0-2)
- ✅ Buffer minutes > 0

### Rules

**Scheduling Rules**:
- ✅ Calculate total duration (focus + minis + buffer)
- ✅ Filter tasks by deadline (urgent first)
- ✅ Filter tasks by importance (high first)
- ✅ Select focus task (60-120min, high importance)
- ✅ Select mini tasks (5-20min)
- ✅ Fit tasks into free slots
- ✅ No tasks if calendar full
- ❌ Focus task > 120min (reject)
- ❌ Mini task < 5min (reject)

**Default Durations**:
- ✅ "email" → 10-15min
- ✅ "meeting" → 60min
- ✅ "call" → 30min
- ✅ Fallback → 30-60min

**Confidence Policy**:
- ✅ confidence < 0.5 → max 1 question
- ✅ confidence ≥ 0.5 → no question
- ✅ Pick lowest confidence item for question
- ✅ Question format: "Wie lange dauert '[Titel]' ungefähr?"

### AI Service

**Extraction**:
- ✅ Parse valid JSON
- ✅ Validate against schema (extraction_schema.json)
- ❌ Invalid JSON → Fallback
- ❌ Schema violation → Fallback
- ✅ Timeout (10s) → Fallback
- ✅ Confidence calculation
- ✅ Question generation

**Planning**:
- ✅ Parse valid JSON
- ✅ Validate against schema (planning_schema.json)
- ❌ Invalid JSON → Fallback
- ❌ Schema violation → Fallback
- ✅ Timeout (8s) → Fallback
- ✅ Reasoning extraction

## 2. Schema Validation Tests

**extraction_schema.json**:
- ✅ Valid: 2 tasks, 1 event
- ✅ Valid: 0 tasks, 0 events (empty)
- ✅ Valid: 1 question
- ❌ Invalid: Missing "items"
- ❌ Invalid: task.confidence > 1.0
- ❌ Invalid: task.duration_min > duration_max
- ❌ Invalid: event missing start_time
- ❌ Invalid: question missing "question"

**planning_schema.json**:
- ✅ Valid: focus + 2 minis + buffer
- ✅ Valid: focus only
- ❌ Invalid: Missing focus_task_id
- ❌ Invalid: mini_tasks > 2
- ❌ Invalid: buffer_minutes < 0
- ❌ Invalid: Missing reasoning

## 3. Integration Tests

### Database

**CRUD Operations**:
- ✅ Create InboxNote → Read
- ✅ Create Task → Read
- ✅ Update Task status → Read
- ✅ Delete Task → Verify deleted
- ✅ Foreign key cascade (delete InboxNote → delete Tasks)

**Transactions**:
- ✅ Create Note + Tasks in transaction
- ❌ Rollback on error

**Queries**:
- ✅ Get tasks by status
- ✅ Get tasks by due date
- ✅ Get tasks for today's plan
- ✅ Get inbox notes (unprocessed only)
- ✅ Get calendar events (date range)

### AI Service

**Extraction**:
- ✅ Send request → Receive response
- ✅ Parse JSON → Validate schema
- ❌ Timeout → Fallback
- ❌ Network error → Retry → Fallback

**Planning**:
- ✅ Send request → Receive response
- ✅ Parse JSON → Validate schema
- ❌ Timeout → Fallback

### Calendar Integration

**Sync**:
- ✅ Connect calendar → Read events
- ✅ Cache events → Retrieve from cache
- ✅ Sync updates (incremental)
- ❌ Auth error → Prompt re-login
- ❌ Network error → Use stale cache

**Free Slots**:
- ✅ Calculate free slots (9:00-18:00, no events)
- ✅ Calculate free slots (with calendar events)
- ✅ No free slots (calendar full)

### WhatsApp Integration

**Webhook**:
- ✅ Receive message → Parse → Extract
- ✅ Receive command ("done") → Mark task done
- ✅ Receive command ("morgen") → Postpone task
- ❌ Invalid command → Error reply
- ❌ Rate limit → Error reply

## 4. Flow Tests

### Capture to Plan Flow

**Steps**:
1. ✅ User creates note → Saved
2. ✅ Trigger extraction → AI extracts 2 tasks
3. ✅ Review screen → Accept all
4. ✅ Request day plan → Plan generated
5. ✅ Confirm plan → Tasks in "today"

**Assertions**:
- Note status = reviewed
- 2 tasks with status = open
- 1 day plan with focus + 2 minis
- Plan confirmed_at timestamp set

### Extraction Review Flow

**Steps**:
1. ✅ User creates note
2. ✅ Extraction → 1 task with confidence 0.3
3. ✅ Review screen shows question
4. ✅ User answers "30min"
5. ✅ Accept task → Saved with duration 25-35min

**Assertions**:
- Task.duration_min = 25
- Task.duration_max = 35
- Note.status = reviewed

### Daily Review Flow

**Steps**:
1. ✅ User has 3 tasks today (1 done, 2 open)
2. ✅ Open review → Shows 3 tasks
3. ✅ Mark 1 as "morgen" → Task.due_date = tomorrow
4. ✅ Mark 1 as "offen" → Task.status = open
5. ✅ Complete review → Statistics shown

**Assertions**:
- 1 task done
- 1 task postponed (due_date = tomorrow)
- 1 task still open
- Completion rate = 33%

### Plan B Flow

**Steps**:
1. ✅ User has plan (focus + 2 minis)
2. ✅ Complete 1 mini task
3. ✅ Trigger "Plan B" → Options shown
4. ✅ Select "Andere Fokus-Aufgabe"
5. ✅ New plan generated

**Assertions**:
- Old plan archived
- New plan with different focus task
- Replan count = 1

### WhatsApp to Today Flow

**Steps**:
1. ✅ User sends WhatsApp message
2. ✅ Webhook receives → Auto-extract
3. ✅ 1 task created (status = open)
4. ✅ Day plan includes task
5. ✅ User confirms plan

**Assertions**:
- InboxNote.source = "whatsapp"
- Task.inbox_note_id = note.id
- DayPlan includes task

## 5. End-to-End Tests

### Happy Path

**Scenario**: User captures note → extracts → plans → completes → reviews

**Steps**:
1. Open app
2. Type "Email an Chef, Meeting 14 Uhr, Präsentation fertig"
3. Tap "Hinzufügen"
4. Tap note → Review
5. Accept all
6. Tap "Plan für heute"
7. Confirm plan
8. Mark focus task done
9. Open review
10. Complete review

**Assertions**:
- 2 tasks created (email, presentation)
- 1 event created (meeting)
- Day plan confirmed
- 1 task done
- Review completed

### Error Handling

**Scenario 1**: AI timeout
1. Create note
2. Trigger extraction
3. AI times out (10s)
4. Fallback to manual mode
5. User manually creates task

**Scenario 2**: Calendar full
1. Request day plan
2. Calendar has no free slots
3. Show empty state
4. Suggest "Morgen planen"

**Scenario 3**: WhatsApp rate limit
1. User sends 51 messages today
2. Webhook receives 51st message
3. Reply: "Limit erreicht (50/Tag)"

## 6. Performance Tests

### Response Times

- ✅ Inbox Capture → Save: < 100ms (p95)
- ✅ Extraction: < 3s (p95)
- ✅ Day Plan: < 2s (p95)
- ✅ Task Mark Done: < 100ms (p95)

### Load Tests

- ✅ 100 concurrent users → Extraction
- ✅ 1000 notes in database → Query < 50ms

## 7. Regression Tests

**After each release**:
- ✅ Re-run all Unit Tests
- ✅ Re-run all Flow Tests
- ✅ Re-run 3 critical E2E paths

## 8. Manual Tests

**UX Review**:
- ✅ Tap targets ≥ 44×44pt
- ✅ Text contrast ≥ 4.5:1
- ✅ Screen reader (VoiceOver, TalkBack)
- ✅ Dynamic text sizes

**Device Testing**:
- ✅ iPhone 8, 13, 15 Pro
- ✅ Android Mid-range, Flagship

**Edge Cases**:
- ✅ Offline mode → Sync on reconnect
- ✅ Low battery → No background processing
- ✅ Airplane mode → Show error

## Test Data

### Fixtures

**Users**:
```json
{
  "id": "user-1",
  "timezone": "Europe/Berlin",
  "work_start": "09:00",
  "work_end": "18:00",
  "buffer_minutes": 15
}
```

**InboxNotes**:
```json
{
  "id": "note-1",
  "raw_text": "Email an Chef schreiben, Meeting 14 Uhr",
  "status": "unprocessed",
  "user_id": "user-1"
}
```

**Tasks**:
```json
{
  "id": "task-1",
  "title": "Email an Chef",
  "duration_min": 10,
  "duration_max": 15,
  "importance": "normal",
  "status": "open",
  "inbox_note_id": "note-1"
}
```

## CI/CD Integration

**On Commit**:
- ✅ Run Unit Tests
- ✅ Run Schema Validation Tests
- ❌ Block merge if tests fail

**On PR**:
- ✅ Run Unit + Integration Tests
- ✅ Run Flow Tests
- ❌ Block merge if coverage < 80%

**On Release**:
- ✅ Run all tests (Unit + Integration + Flow + E2E)
- ✅ Performance tests
- ✅ Manual UX review

## Tools

- **Unit Tests**: Jest (JS/TS), pytest (Python)
- **Integration Tests**: Supertest (API), pytest + fixtures
- **E2E Tests**: Detox (React Native), Appium
- **Schema Validation**: ajv (JSON Schema)
- **Coverage**: Istanbul (JS), Coverage.py
- **CI/CD**: GitHub Actions, GitLab CI
