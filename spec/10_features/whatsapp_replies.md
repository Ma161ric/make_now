# Feature: WhatsApp Replies (V1)

## Zweck

Schnelle Status-Updates für Tasks via WhatsApp. Nutzer kann mit kurzen Schlüsselwörtern antworten, um Tasks als erledigt zu markieren, zu verschieben oder Dauer zu ändern. Reduziert Kontext-Wechsel.

## Nutzerstory

Als Nutzer möchte ich schnell "done" an meine WhatsApp schicken können, um eine Aufgabe als erledigt zu markieren, ohne die App öffnen zu müssen.

## In Scope

- Vordefinierte Keywords: done, morgen, 30min, wichtig
- Matching auf letzte Today-Tasks
- Status-Update via WhatsApp
- Bestätigungs-Nachricht zurück
- Fehlerbehandlung bei unklaren Commands

## Out of Scope

- Freies Natural Language (nur Keywords)
- Task-Erstellung via Reply (nur Updates)
- Mehrere Tasks gleichzeitig (V2)
- Komplexe Queries (V2)

## Daten und Felder

### WhatsAppCommand Model

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | UUID | Ja | Eindeutige ID |
| received_at | DateTime | Ja | Zeitpunkt des Empfangs |
| raw_text | String | Ja | Originalnachricht |
| command_type | Enum | Ja | done, postpone, duration, priority |
| task_id | UUID | Nein | Referenzierte Task |
| executed | Boolean | Ja | Erfolgreich ausgeführt? |
| response_sent | String | Nein | Gesendete Antwort |

### Command Type Enum

- `done`: Task als erledigt markieren
- `postpone`: Task verschieben
- `duration`: Dauer ändern
- `priority`: Wichtigkeit setzen

## UI Verhalten

### Keine direkte UI

WhatsApp Replies laufen komplett über WhatsApp. Die App zeigt nur:

**In Today-Liste**:
- Status-Changes werden live reflektiert
- Wenn Task via WhatsApp erledigt: ✅ erscheint

**In Settings**:
- Toggle: "WhatsApp Replies" (an/aus)
- Info-Text mit unterstützten Keywords

### Notification

Optional: Push Notification bei erfolgreichem Command
- "Aufgabe 'Email an Chef' erledigt ✓"

## Flow Schritte

### Command empfangen

1. Nutzer schickt Keyword an Bot-Nummer
2. System empfängt Nachricht
3. System parsed Keyword
4. System identifiziert Command Type
5. System matcht auf Task:
   - Wenn eindeutig: Nimm diese Task
   - Wenn mehrdeutig: Frage zurück
   - Wenn kein Match: Fehler
6. System führt Action aus
7. System sendet Bestätigung

### Beispiele

**Input**: "done"
- System findet letzte offene Today-Task
- System setzt Status `done`
- Response: "Erledigt: Email an Chef ✓"

**Input**: "morgen"
- System findet letzte offene Today-Task
- System setzt `due_at` = morgen
- Response: "Verschoben auf morgen: Präsentation vorbereiten"

**Input**: "30min"
- System findet letzte Task
- System setzt `duration_min_minutes` = 30, `duration_max_minutes` = 45
- Response: "Dauer gesetzt: Dokument lesen → 30-45 Min"

**Input**: "wichtig"
- System findet letzte Task
- System setzt `importance` = `high`
- Response: "Wichtig markiert: Code Review"

## Regeln

### Keyword Matching

**done** (Synonyme: erledigt, fertig, ✓):
- Setzt Status `done`
- `completed_at` = now()

**morgen** (Synonyme: tomorrow, verschieben):
- Setzt `due_at` = morgen 00:00
- Status bleibt `scheduled`

**Dauer-Angaben** (30min, 1h, 2h, 15min):
- Parsed Zahl + Einheit
- Setzt `duration_min_minutes` und `duration_max_minutes`
- `estimation_source` = `user_override`

**wichtig** (Synonyme: prio, urgent, high):
- Setzt `importance` = `high`

### Task Matching

- Default: Letzte offene Task aus Today-Liste
- Wenn mehrere offen: Fragt zurück mit Auswahl
- Wenn keine offenen: Hinweis "Keine offenen Aufgaben"

### Mehrdeutigkeit

Wenn >1 offene Task:
- Response: "Welche? 1) Email an Chef 2) Präsentation vorbereiten"
- Nutzer antwortet: "1"
- System führt aus

### Fehlerbehandlung

| Fehler | Response |
|--------|----------|
| Unbekanntes Keyword | "Verstehe nicht. Nutze: done, morgen, 30min, wichtig" |
| Keine Tasks | "Keine offenen Aufgaben heute" |
| Ungültige Dauer | "Ungültige Dauer. Nutze: 15min, 30min, 1h, 2h" |

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| "done done" | Nur 1× verarbeiten, Bestätigung |
| Emoji als Command | Ignorieren, Fehler-Response |
| Mehrere Keywords | Ersten verarbeiten, Rest ignorieren |
| Command für bereits erledigte Task | Hinweis: "Task schon erledigt" |
| Command ohne Today-Liste | Hinweis: "Heute keine Aufgaben geplant" |

## Akzeptanzkriterien

- [ ] "done" markiert letzte Task als erledigt
- [ ] "morgen" verschiebt Task auf morgen
- [ ] Dauer-Angaben werden korrekt geparst
- [ ] "wichtig" setzt Importance high
- [ ] Mehrdeutigkeit löst Rückfrage aus
- [ ] Unbekannte Keywords liefern Hilfe-Text
- [ ] Bestätigung wird gesendet
- [ ] Status-Changes reflektieren in App

## Telemetrie Events

### whatsapp_command_received

**Wann**: Command-Nachricht empfangen

**Properties**:
- `raw_text`: String (anonymisiert)
- `command_type`: String

### whatsapp_command_executed

**Wann**: Command erfolgreich ausgeführt

**Properties**:
- `command_type`: String
- `task_matched`: Boolean
- `execution_time_ms`: Integer

### whatsapp_command_failed

**Wann**: Command fehlgeschlagen

**Properties**:
- `error_type`: String (unknown_keyword, no_tasks, ambiguous)
- `raw_text`: String (anonymisiert)

### whatsapp_command_ambiguous

**Wann**: Mehrdeutige Task-Auswahl

**Properties**:
- `tasks_count`: Integer
- `resolved`: Boolean
