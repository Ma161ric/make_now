# Data Model: Idea

## Übersicht

Ideas sind Notizen ohne direkten Handlungsbedarf. Sie dienen als Gedächtnisstütze oder Sammlung von Gedanken, die später ggf. zu Tasks werden können.

## Datenbank Schema

### Tabelle: ideas

| Feld | Typ | Pflicht | Default | Indiziert | Beschreibung |
|------|-----|---------|---------|-----------|--------------|
| id | UUID | Ja | auto | PRIMARY | Eindeutige ID |
| title | VARCHAR(200) | Ja | - | - | Kurztitel der Idee |
| raw_note | TEXT | Nein | null | - | Original-Notiz falls extrahiert |
| content | TEXT | Nein | null | - | Ausführlicher Inhalt |
| status | ENUM | Ja | active | INDEX | Status |
| created_at | TIMESTAMP | Ja | now() | INDEX | Erstellungszeitpunkt |
| updated_at | TIMESTAMP | Ja | now() | - | Letztes Update |
| archived_at | TIMESTAMP | Nein | null | - | Archivierungszeitpunkt |
| inbox_note_id | UUID | Nein | null | FOREIGN KEY | Referenz auf InboxNote |

## Enums

### status

- `active`: Aktiv, sichtbar
- `archived`: Archiviert, ausgeblendet
- `converted`: Zu Task/Event umgewandelt (V2)

## Constraints

### Validierungs-Regeln

- `title`: Länge 3-200 Zeichen
- `content`: Max 10.000 Zeichen
- `archived_at`: Nur gesetzt wenn `status` = `archived`

### Foreign Keys

- `inbox_note_id` → `inbox_notes.id` (ON DELETE SET NULL)

## Indexes

```sql
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_created_at ON ideas(created_at DESC);
```

## Berechnete Felder (Application Layer)

### age_days

```
(now() - created_at) / 86400
```

Für Sortierung und Review.

## Beispiel-Records

### Idea: Buchidee

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "title": "Buch über Produktivität schreiben",
  "raw_note": "vielleicht mal ein Buch schreiben über meine Methoden",
  "content": "Idee: Buch über Produktivitäts-Methoden basierend auf meinen Erfahrungen. Fokus auf Minimal Scheduling und KI-Unterstützung.",
  "status": "active",
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T10:00:00Z",
  "archived_at": null,
  "inbox_note_id": "660e8400-e29b-41d4-a716-446655440010"
}
```

### Idea: Emoji-Only

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440001",
  "title": "🎉",
  "raw_note": "🎉",
  "content": null,
  "status": "active",
  "created_at": "2026-01-09T11:00:00Z",
  "updated_at": "2026-01-09T11:00:00Z",
  "archived_at": null,
  "inbox_note_id": "660e8400-e29b-41d4-a716-446655440011"
}
```

### Idea: Archiviert

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440002",
  "title": "Alte Notiz",
  "raw_note": "irgendwas",
  "content": "War mal relevant, jetzt nicht mehr",
  "status": "archived",
  "created_at": "2025-12-01T10:00:00Z",
  "updated_at": "2026-01-05T15:00:00Z",
  "archived_at": "2026-01-05T15:00:00Z",
  "inbox_note_id": null
}
```

## Lifecycle

```
[Created: status=active]
    ↓
[User archives: status=archived, archived_at set]
```

Alternative (V2):
```
[Created: status=active]
    ↓
[User converts to Task: status=converted]
    ↓
[New Task created with reference]
```

## Queries

### Aktive Ideas

```sql
SELECT * FROM ideas
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 50;
```

### Älteste unarchivierte Ideas (für Review)

```sql
SELECT * FROM ideas
WHERE status = 'active'
ORDER BY created_at ASC
LIMIT 10;
```

### Archivierte Ideas

```sql
SELECT * FROM ideas
WHERE status = 'archived'
ORDER BY archived_at DESC;
```

## UI-Konzept

Ideas werden in eigenem Screen angezeigt:
- Liste der aktiven Ideas
- Swipe-Actions: Archivieren, Zu Task konvertieren (V2)
- Tap: Detail-Ansicht mit vollständigem Content
- Suche über Title und Content (V2)

## Konvertierung zu Task (V2)

In V2 kann eine Idea zu Task konvertiert werden:
1. Nutzer wählt "Zu Task konvertieren"
2. System erstellt Task:
   - `title` = Idea.title
   - `notes` = Idea.content
   - `status` = `open`
3. System updated Idea:
   - `status` = `converted`
4. Referenz bleibt bestehen

## Migration Notes

- V1: Minimales Schema wie spezifiziert
- V2: Hinzufügen `converted_to_task_id` für Tracking
- V2: Hinzufügen `tags` als JSONB
- V2: Hinzufügen Full-Text Search Index
