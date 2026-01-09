# States and Transitions

## Übersicht

Definiert alle erlaubten Zustandsübergänge für Tasks, Events, Ideas, InboxNotes und DayPlans. Stellt sicher, dass das System deterministisch und nachvollziehbar ist.

## Task States

### State Diagram

```
    ┌─────────┐
    │  open   │ ◄────────────────┐
    └────┬────┘                  │
         │                       │
         │ add to plan           │ remove from plan
         ▼                       │
  ┌────────────┐                 │
  │ scheduled  │─────────────────┘
  └─────┬──────┘
        │
        │ user starts (V2)
        ▼
  ┌─────────────┐
  │ in_progress │ (V2)
  └─────┬───────┘
        │
        ├─── user completes ───► ┌──────┐
        │                        │ done │
        │                        └──────┘
        │
        └─── user cancels (V2)──► ┌───────────┐
                                   │ cancelled │
                                   └───────────┘
```

### Transitions Table

| Von | Nach | Trigger | Bedingungen | Side Effects |
|-----|------|---------|-------------|--------------|
| `open` | `scheduled` | Zu DayPlan hinzufügen | DayPlan confirmed | `day_plan_id` gesetzt |
| `scheduled` | `open` | Aus DayPlan entfernen | - | `day_plan_id` = null |
| `scheduled` | `in_progress` | User startet (V2) | - | - |
| `in_progress` | `done` | User beendet | - | `completed_at` = now() |
| `scheduled` | `done` | User beendet (Shortcut) | - | `completed_at` = now() |
| `open` | `done` | User beendet (Shortcut) | - | `completed_at` = now() |
| `in_progress` | `cancelled` | User abbricht (V2) | - | - |
| `scheduled` | `cancelled` | User abbricht (V2) | - | - |
| `open` | `cancelled` | User abbricht (V2) | - | - |

### Forbidden Transitions

- `done` → Jeder andere State (Tasks können nicht "un-done" werden)
- `cancelled` → Jeder andere State (Stattdessen neue Task erstellen)

### Auto-Transitions

#### Daily Review: scheduled → open

Wenn Task nicht erledigt und "Offen lassen" gewählt:
```
scheduled → open
day_plan_id = null
```

#### Daily Review: scheduled → scheduled (morgen)

Wenn Task verschoben wird:
```
scheduled → scheduled
due_at = tomorrow
day_plan_id = null (wird morgen neu geplant)
```

## Event States

### State Diagram

```
    ┌───────────┐
    │ tentative │
    └─────┬─────┘
          │
          ├─── user confirms ───► ┌───────────┐
          │                       │ confirmed │
          │                       └───────────┘
          │
          └─── user cancels ─────► ┌───────────┐
                                    │ cancelled │
                                    └───────────┘
```

### Transitions Table

| Von | Nach | Trigger | Bedingungen | Side Effects |
|-----|------|---------|-------------|--------------|
| `tentative` | `confirmed` | User bestätigt | - | - |
| `tentative` | `cancelled` | User sagt ab | - | - |
| `confirmed` | `cancelled` | User sagt ab | - | - |

### Forbidden Transitions

- `confirmed` → `tentative` (Keine Rücknahme)
- `cancelled` → Jeder andere State

### Auto-Transitions

Keine.

## Idea States

### State Diagram

```
    ┌────────┐
    │ active │
    └────┬───┘
         │
         ├─── user archives ────► ┌───────────┐
         │                        │ archived  │
         │                        └───────────┘
         │
         └─── convert to task (V2)──► ┌───────────┐
                                       │ converted │
                                       └───────────┘
```

### Transitions Table

| Von | Nach | Trigger | Bedingungen | Side Effects |
|-----|------|---------|-------------|--------------|
| `active` | `archived` | User archiviert | - | `archived_at` = now() |
| `active` | `converted` | Convert to Task (V2) | - | Task erstellt |

### Forbidden Transitions

- `archived` → `active` (Keine Wiederherstellung im MVP)
- `converted` → Jeder andere State

## InboxNote States

### State Diagram

```
    ┌──────────────┐
    │ unprocessed  │
    └──────┬───────┘
           │
           ├─── extraction successful ──► ┌───────────┐
           │                              │ processed │
           │                              └───────────┘
           │
           └─── user archives ──────────► ┌───────────┐
                                           │ archived  │
                                           └───────────┘
```

### Transitions Table

| Von | Nach | Trigger | Bedingungen | Side Effects |
|-----|------|---------|-------------|--------------|
| `unprocessed` | `processed` | Extraction bestätigt | Mind. 1 Item accepted | `processed_at` = now() |
| `unprocessed` | `archived` | User archiviert | - | - |

### Forbidden Transitions

- `processed` → `unprocessed` (Keine Wiederverarbeitung)
- `archived` → Jeder andere State

## DayPlan States

### State Diagram

```
    ┌───────────┐
    │ suggested │
    └─────┬─────┘
          │
          ├─── user confirms ────► ┌───────────┐
          │                        │ confirmed │
          │                        └─────┬─────┘
          │                              │
          │                              │ daily review
          │                              ▼
          │                        ┌───────────┐
          │                        │ completed │
          │                        └───────────┘
          │
          └─── plan B ────────────► ┌───────────┐
                                     │ replanned │
                                     └───────────┘
```

### Transitions Table

| Von | Nach | Trigger | Bedingungen | Side Effects |
|-----|------|---------|-------------|--------------|
| `suggested` | `confirmed` | User bestätigt Plan | - | `confirmed_at` = now(), Tasks → scheduled |
| `suggested` | `replanned` | Plan B | - | Neuer DayPlan erstellt |
| `confirmed` | `replanned` | Plan B | - | Neuer DayPlan erstellt |
| `confirmed` | `completed` | Daily Review | Alle Tasks reviewed | DailyReview erstellt |
| `replanned` | - | - | Terminal State | - |

### Forbidden Transitions

- `completed` → Jeder andere State (Tag ist abgeschlossen)
- `replanned` → Jeder andere State (Terminal)

### Auto-Transitions

Keine. Alle Transitions sind user-triggered.

## WhatsAppConnection States

### State Diagram

```
    ┌────────┐
    │ active │
    └────┬───┘
         │
         ├─── connection lost ────► ┌──────────────┐
         │                          │ disconnected │
         │                          └──────────────┘
         │
         └─── api error ────────────► ┌───────┐
                                       │ error │
                                       └───────┘
```

### Transitions Table

| Von | Nach | Trigger | Bedingungen | Side Effects |
|-----|------|---------|-------------|--------------|
| `active` | `disconnected` | User trennt | - | - |
| `active` | `error` | API Fehler | - | Nutzer benachrichtigen |
| `disconnected` | `active` | User verbindet neu | Verifizierung OK | - |
| `error` | `active` | Retry erfolgreich | - | - |

## Validation Rules

### Status Changes

Jeder Status-Change muss:
1. Erlaubte Transition lt. Tabelle
2. Bedingungen erfüllt
3. Side Effects ausgeführt
4. `updated_at` aktualisiert
5. Event geloggt

### Rollback

Bei Fehler während Side Effects:
- Transaction rollback
- Status bleibt unverändert
- Fehler loggen
- Nutzer informieren

## Event Logging

Jede State Transition loggt Event:

```json
{
  "event": "state_transition",
  "entity_type": "task",
  "entity_id": "uuid",
  "from_state": "open",
  "to_state": "scheduled",
  "trigger": "add_to_plan",
  "user_id": "uuid",
  "timestamp": "ISO8601"
}
```

## Testing

Für jeden State muss getestet werden:
- [ ] Erlaubte Transitions funktionieren
- [ ] Verbotene Transitions werfen Fehler
- [ ] Bedingungen werden geprüft
- [ ] Side Effects werden ausgeführt
- [ ] Auto-Transitions triggern korrekt
- [ ] Events werden geloggt
