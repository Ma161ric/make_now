# Data Model: Event

## Übersicht

Events sind Termine mit konkreter Zeitangabe oder Zeitfenster. Sie können aus Notizen extrahiert oder manuell erstellt werden.

## Datenbank Schema

### Tabelle: events

| Feld | Typ | Pflicht | Default | Indiziert | Beschreibung |
|------|-----|---------|---------|-----------|--------------|
| id | UUID | Ja | auto | PRIMARY | Eindeutige ID |
| title | VARCHAR(200) | Ja | - | - | Event-Titel |
| raw_note | TEXT | Nein | null | - | Original-Notiz falls extrahiert |
| start_at | TIMESTAMP | Nein | null | INDEX | Startzeit (konkret) |
| end_at | TIMESTAMP | Nein | null | - | Endzeit (konkret) |
| time_window_start | TIME | Nein | null | - | Zeitfenster Start (unscharf) |
| time_window_end | TIME | Nein | null | - | Zeitfenster Ende (unscharf) |
| timezone | VARCHAR(50) | Ja | Europe/Berlin | - | Zeitzone |
| all_day | BOOLEAN | Ja | false | - | Ganztägig? |
| status | ENUM | Ja | tentative | INDEX | Status |
| created_at | TIMESTAMP | Ja | now() | - | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Ja | now() | - | Letztes Update |
| confidence | FLOAT | Nein | null | - | Confidence 0.0-1.0 |
| inbox_note_id | UUID | Nein | null | FOREIGN KEY | Referenz auf InboxNote |
| calendar_id | VARCHAR(200) | Nein | null | - | Externe Kalender-ID (Read-only) |
| location | VARCHAR(500) | Nein | null | - | Ort |
| notes | TEXT | Nein | null | - | Zusätzliche Notizen |

## Enums

### status

- `tentative`: Vorläufig, wartet auf Bestätigung
- `confirmed`: Bestätigt, findet statt
- `cancelled`: Abgesagt

## Zeitangaben

Events können Zeit auf 3 Arten angeben:

### 1. Konkrete Zeit

- `start_at` und `end_at` gesetzt
- Beispiel: Meeting 14:00-15:00
- `time_window_*` ist null

### 2. Zeitfenster (unscharf)

- `time_window_start` und `time_window_end` gesetzt
- `start_at` und `end_at` sind null
- Beispiel: "Nachmittags" → time_window 14:00-18:00
- Nutzer muss später konkretisieren

### 3. Ganztägig

- `all_day` = true
- `start_at` hat nur Date, keine Time
- `end_at` optional
- Beispiel: Geburtstag, Feiertag

## Constraints

### Validierungs-Regeln

- `title`: Länge 3-200 Zeichen
- Entweder `start_at`/`end_at` ODER `time_window_*` gesetzt
- Wenn `start_at` gesetzt: `end_at` ≥ `start_at`
- Wenn `time_window_start` gesetzt: `time_window_end` > `time_window_start`
- `confidence`: Wenn gesetzt, dann 0.0-1.0
- `timezone`: Valide IANA Timezone
- `all_day` = true → `start_at` ohne Uhrzeit

### Foreign Keys

- `inbox_note_id` → `inbox_notes.id` (ON DELETE SET NULL)

## Indexes

```sql
CREATE INDEX idx_events_start_at ON events(start_at) WHERE start_at IS NOT NULL;
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_calendar_id ON events(calendar_id) WHERE calendar_id IS NOT NULL;
```

## Berechnete Felder (Application Layer)

### duration_minutes

```
(end_at - start_at) / 60
```

Nur wenn konkrete Zeiten gesetzt.

### is_today

```
DATE(start_at) = DATE(now())
```

Für Today-Ansicht.

### needs_confirmation

```
status = 'tentative' AND start_at IS NOT NULL
```

Für Reminder.

## Beispiel-Records

### Event: Konkretes Meeting

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "title": "Meeting mit Team",
  "raw_note": "Meeting um 14 Uhr mit Team",
  "start_at": "2026-01-09T14:00:00+01:00",
  "end_at": "2026-01-09T15:00:00+01:00",
  "time_window_start": null,
  "time_window_end": null,
  "timezone": "Europe/Berlin",
  "all_day": false,
  "status": "confirmed",
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T10:05:00Z",
  "confidence": 0.95,
  "inbox_note_id": "660e8400-e29b-41d4-a716-446655440001",
  "calendar_id": null,
  "location": "Büro Raum 3",
  "notes": null
}
```

### Event: Unscharfes Zeitfenster

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440001",
  "title": "Arzttermin",
  "raw_note": "Arzttermin nachmittags",
  "start_at": null,
  "end_at": null,
  "time_window_start": "14:00:00",
  "time_window_end": "18:00:00",
  "timezone": "Europe/Berlin",
  "all_day": false,
  "status": "tentative",
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T10:00:00Z",
  "confidence": 0.6,
  "inbox_note_id": "660e8400-e29b-41d4-a716-446655440002",
  "calendar_id": null,
  "location": "Dr. Schmidt",
  "notes": "Bestätigung steht noch aus"
}
```

### Event: Ganztägig

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440002",
  "title": "Projektabgabe",
  "raw_note": "Projektabgabe am Freitag",
  "start_at": "2026-01-10T00:00:00+01:00",
  "end_at": "2026-01-10T23:59:59+01:00",
  "time_window_start": null,
  "time_window_end": null,
  "timezone": "Europe/Berlin",
  "all_day": true,
  "status": "confirmed",
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T10:00:00Z",
  "confidence": 1.0,
  "inbox_note_id": "660e8400-e29b-41d4-a716-446655440003",
  "calendar_id": null,
  "location": null,
  "notes": null
}
```

### Event: Aus Kalender (Read-only)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "title": "Zahnarzt",
  "raw_note": null,
  "start_at": "2026-01-09T16:00:00+01:00",
  "end_at": "2026-01-09T16:30:00+01:00",
  "time_window_start": null,
  "time_window_end": null,
  "timezone": "Europe/Berlin",
  "all_day": false,
  "status": "confirmed",
  "created_at": "2026-01-09T06:00:00Z",
  "updated_at": "2026-01-09T06:00:00Z",
  "confidence": 1.0,
  "inbox_note_id": null,
  "calendar_id": "google_cal_event_12345",
  "location": "Zahnarztpraxis Müller",
  "notes": null
}
```

## Lifecycle

```
[Created: status=tentative]
    ↓
[User confirms: status=confirmed]
```

Alternative:
```
[Created: status=tentative]
    ↓
[User cancels: status=cancelled]
```

Read-only Events aus Kalender:
```
[Synced from Calendar: status=confirmed, calendar_id set]
    ↓
[Not editable in DayFlow]
```

## Queries

### Heutige Events

```sql
SELECT * FROM events
WHERE DATE(start_at) = CURRENT_DATE
  AND status = 'confirmed'
ORDER BY start_at ASC;
```

### Events mit unscharfer Zeit

```sql
SELECT * FROM events
WHERE time_window_start IS NOT NULL
  AND status = 'tentative'
ORDER BY created_at DESC;
```

### Busy Intervals für Scheduling

```sql
SELECT start_at, end_at
FROM events
WHERE DATE(start_at) = :target_date
  AND status = 'confirmed'
  AND start_at IS NOT NULL
ORDER BY start_at ASC;
```

## Integration mit Calendar Provider

Events mit `calendar_id` gesetzt sind Read-only:
- Können nicht editiert werden
- Werden bei Sync aktualisiert
- Werden für Busy Intervals genutzt

Events ohne `calendar_id` sind lokal:
- Können editiert und gelöscht werden
- Werden NICHT in externen Kalender geschrieben (MVP)

## Migration Notes

- V1: Alle Felder wie spezifiziert
- V2: Hinzufügen `calendar_write_enabled` Flag
- V2: Hinzufügen `recurring_rule_id` für Serien
- V2: Hinzufügen `attendees` als JSONB für Teilnehmer
