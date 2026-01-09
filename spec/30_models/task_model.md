# Data Model: Task

## Übersicht

Tasks sind ausführbare Aufgaben mit geschätzter Dauer. Sie durchlaufen verschiedene Status und können in Tagespläne aufgenommen werden.

## Datenbank Schema

### Tabelle: tasks

| Feld | Typ | Pflicht | Default | Indiziert | Beschreibung |
|------|-----|---------|---------|-----------|--------------|
| id | UUID | Ja | auto | PRIMARY | Eindeutige ID |
| title | VARCHAR(200) | Ja | - | - | Aufgabentitel |
| raw_note | TEXT | Nein | null | - | Original-Notiz falls extrahiert |
| status | ENUM | Ja | open | INDEX | Aktueller Status |
| created_at | TIMESTAMP | Ja | now() | INDEX | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Ja | now() | - | Letztes Update |
| completed_at | TIMESTAMP | Nein | null | INDEX | Erledigungszeitpunkt |
| due_at | TIMESTAMP | Nein | null | INDEX | Fälligkeit |
| duration_min_minutes | INTEGER | Nein | null | - | Minimale Dauer in Minuten |
| duration_max_minutes | INTEGER | Nein | null | - | Maximale Dauer in Minuten |
| estimation_source | ENUM | Ja | ai | - | Quelle der Schätzung |
| confidence | FLOAT | Nein | null | - | Confidence 0.0-1.0 |
| importance | ENUM | Nein | medium | INDEX | Wichtigkeit |
| energy_type | ENUM | Nein | null | - | Energie-Typ für Scheduling |
| inbox_note_id | UUID | Nein | null | FOREIGN KEY | Referenz auf InboxNote |
| day_plan_id | UUID | Nein | null | FOREIGN KEY | Referenz auf DayPlan |
| notes | TEXT | Nein | null | - | Zusätzliche Notizen |

## Enums

### status

- `open`: Offen, noch nicht geplant
- `scheduled`: In Today-Liste, noch nicht begonnen
- `in_progress`: Gerade in Arbeit (V2)
- `done`: Erledigt
- `cancelled`: Abgebrochen (V2)

### estimation_source

- `ai`: KI-Schätzung
- `parsed`: Explizit aus Text extrahiert
- `user_override`: Nutzer hat überschrieben
- `default`: Fallback Default-Wert

### importance

- `low`: Niedrige Priorität
- `medium`: Mittlere Priorität (Default)
- `high`: Hohe Priorität

### energy_type

- `deep_work`: Fokussierte Arbeit, keine Unterbrechungen
- `admin`: Administrative Aufgaben, leicht unterbrechbar
- `creative`: Kreative Arbeit, flexible Planung
- `null`: Nicht kategorisiert

## Constraints

### Validierungs-Regeln

- `title`: Länge 3-200 Zeichen
- `duration_min_minutes`: ≥5, ≤480 (8 Stunden)
- `duration_max_minutes`: ≥5, ≤480 (8 Stunden)
- `duration_min_minutes` ≤ `duration_max_minutes`
- `confidence`: Wenn gesetzt, dann 0.0-1.0
- `completed_at`: Nur gesetzt wenn `status` = `done`
- `day_plan_id`: Nur gesetzt wenn `status` = `scheduled` oder `in_progress`

### Foreign Keys

- `inbox_note_id` → `inbox_notes.id` (ON DELETE SET NULL)
- `day_plan_id` → `day_plans.id` (ON DELETE SET NULL)

## Indexes

```sql
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_due_at ON tasks(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_tasks_importance ON tasks(importance);
```

## Berechnete Felder (Application Layer)

### duration_avg_minutes

```
(duration_min_minutes + duration_max_minutes) / 2
```

Wird für Scheduling und Summierung genutzt.

### is_overdue

```
due_at < now() AND status NOT IN ('done', 'cancelled')
```

Für Filterung und Priorisierung.

### age_days

```
(now() - created_at) / 86400
```

Für Analytics und Review.

## Beispiel-Records

### Task: Email schreiben

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Email an Chef schreiben",
  "raw_note": "Email an Chef schreiben, Meeting um 14 Uhr",
  "status": "scheduled",
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T10:05:00Z",
  "completed_at": null,
  "due_at": null,
  "duration_min_minutes": 10,
  "duration_max_minutes": 20,
  "estimation_source": "ai",
  "confidence": 0.9,
  "importance": "high",
  "energy_type": "admin",
  "inbox_note_id": "660e8400-e29b-41d4-a716-446655440001",
  "day_plan_id": "770e8400-e29b-41d4-a716-446655440002",
  "notes": null
}
```

### Task: Präsentation vorbereiten

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "title": "Präsentation fertig machen",
  "raw_note": "Präsentation bis Freitag fertig machen",
  "status": "open",
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T10:00:00Z",
  "completed_at": null,
  "due_at": "2026-01-10T23:59:59Z",
  "duration_min_minutes": 60,
  "duration_max_minutes": 120,
  "estimation_source": "ai",
  "confidence": 0.85,
  "importance": "high",
  "energy_type": "deep_work",
  "inbox_note_id": "660e8400-e29b-41d4-a716-446655440001",
  "day_plan_id": null,
  "notes": null
}
```

## Lifecycle

```
[Created: status=open]
    ↓
[Added to DayPlan: status=scheduled, day_plan_id set]
    ↓
[User starts (V2): status=in_progress]
    ↓
[User completes: status=done, completed_at set]
```

Alternative:
```
[Created: status=open]
    ↓
[User cancels (V2): status=cancelled]
```

## Queries

### Offene Tasks für Planning

```sql
SELECT * FROM tasks
WHERE status = 'open'
ORDER BY 
  importance DESC,
  due_at ASC NULLS LAST,
  created_at ASC
LIMIT 20;
```

### Today-Liste

```sql
SELECT * FROM tasks
WHERE day_plan_id = :day_plan_id
  AND status IN ('scheduled', 'in_progress')
ORDER BY 
  energy_type DESC, -- deep_work first
  duration_avg_minutes DESC;
```

### Überfällige Tasks

```sql
SELECT * FROM tasks
WHERE due_at < now()
  AND status NOT IN ('done', 'cancelled')
ORDER BY due_at ASC;
```

## Migration Notes

- V1: Alle Felder wie spezifiziert
- V2: Hinzufügen `recurring_rule_id` für wiederkehrende Tasks
- V2: Hinzufügen `project_id` für Projekt-Zuordnung
- V2: Hinzufügen `tags` als JSONB für flexible Kategorisierung
