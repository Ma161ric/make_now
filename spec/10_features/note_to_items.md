# Feature: Note to Items (Extraktion)

## Zweck

Umwandlung einer Freitext-Notiz in strukturierte Items (Tasks, Events, Ideas) mittels KI-gestützter Extraktion. Der Nutzer reviewed und bestätigt die Vorschläge.

## Nutzerstory

Als Nutzer möchte ich, dass meine Freitext-Notiz automatisch in verständliche Aufgaben, Termine und Ideen umgewandelt wird, damit ich nicht manuell strukturieren muss, aber die Kontrolle behalte.

## In Scope

- KI-Extraktion von Tasks, Events, Ideas aus Freitext
- Confidence-Wert für jedes extrahierte Item
- Gezielte Rückfragen bei niedriger Confidence
- Review Screen mit Vorschau aller Items
- Bearbeiten von extrahierten Items vor Bestätigung
- Einzelnes Item ablehnen oder akzeptieren
- Batch-Bestätigung aller Items

## Out of Scope

- Training der KI (nutzt externe API)
- Multi-Language Support (nur Deutsch im MVP)
- Lernen aus Nutzer-Korrekturen (V2)
- Auto-Kategorisierung nach Projekt (V2)

## Daten und Felder

### ExtractionResult Model

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | UUID | Ja | Eindeutige ID |
| inbox_note_id | UUID | Ja | Referenz auf InboxNote |
| extracted_at | DateTime | Ja | Zeitpunkt der Extraktion |
| items | Array[ExtractedItem] | Ja | Liste extrahierter Items |
| overall_confidence | Float | Ja | Durchschnittlicher Confidence-Wert |
| questions | Array[String] | Nein | Rückfragen der KI |

### ExtractedItem Model

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| temp_id | UUID | Ja | Temporäre ID vor Bestätigung |
| type | Enum | Ja | task, event, idea |
| title | String | Ja | Extrahierter Titel |
| raw_text_span | String | Nein | Original-Textstelle |
| confidence | Float | Ja | Sicherheit 0.0-1.0 |
| parsed_fields | JSON | Ja | Typ-spezifische Felder |
| status | Enum | Ja | suggested, accepted, rejected |

### Confidence Levels

- `0.0 - 0.5`: Low → Rückfrage erforderlich
- `0.5 - 0.8`: Medium → Review empfohlen
- `0.8 - 1.0`: High → Auto-Suggestion

## UI Verhalten

### Extraktion starten

- Von Inbox-Liste: Tap auf Notiz ODER Swipe→Verarbeiten
- Von Inbox Capture: Button "Sofort verarbeiten" nach Eingabe
- Loading Indicator: "Analysiere Notiz..."

### Extraction Review Screen

**Header**:
- Original-Notiz in Readonly-Card, leicht ausgegraut
- Anzahl gefundener Items: "3 Aufgaben, 1 Termin gefunden"

**Item Cards**:
- Jedes Item als Card mit Icon (📋 Task, 📅 Event, 💡 Idea)
- Titel groß und editierbar
- Parsed Fields anzeigen (Dauer, Zeitpunkt, etc.)
- Confidence Badge: 🟢 High, 🟡 Medium, 🔴 Low
- Buttons: "Akzeptieren" (grün), "Ablehnen" (grau)

**Rückfragen**:
- Falls vorhanden: Gelbes Banner oben
- Text: "Wie lange dauert 'Präsentation vorbereiten' ungefähr?"
- Eingabefeld oder Quick-Buttons (15min, 30min, 1h, 2h)

**Bottom Actions**:
- "Alle akzeptieren" (Primary Button)
- "Abbrechen" (Text Button)

### Nach Bestätigung

- Accepted Items werden in jeweilige Listen gespeichert
- InboxNote Status → `processed`
- Navigation zu Today oder Inbox (je nach Kontext)
- Snackbar: "3 Aufgaben und 1 Termin gespeichert"

## Flow Schritte

1. Nutzer wählt Inbox-Notiz zur Verarbeitung
2. System ruft KI-Extraktion auf (siehe [AI Contract](../50_ai/ai_inputs_outputs.md))
3. System erhält ExtractionResult mit Items
4. Wenn `overall_confidence < 0.5`: Zeige Rückfragen
5. System zeigt Extraction Review Screen
6. Nutzer reviewed Items:
   - Bearbeitet Titel oder Felder
   - Akzeptiert oder lehnt ab
   - Beantwortet Rückfragen
7. Nutzer drückt "Alle akzeptieren"
8. System speichert accepted Items in jeweilige Tabellen
9. System markiert InboxNote als processed
10. System navigiert zurück

## Regeln

### Extraktion

- Eine Notiz kann 0 bis N Items erzeugen
- Mindestens 1 Task, Event oder Idea wird erwartet
- Leere Extraktion (0 Items) → Notiz bleibt unprocessed, Hinweis an Nutzer
- Max. 1 Rückfrage pro Extraktion
- Rückfragen müssen spezifisch sein, keine generischen "Alles klar?"

### Confidence Policy

- Confidence < 0.5 → Immer Rückfrage
- Confidence < 0.8 → Gelbes Badge, aber keine Rückfrage
- Confidence >= 0.8 → Grünes Badge

### Title Generation

- Max. 60 Zeichen
- Aktionsverben bevorzugen
- Keine Duplikate von Titeln innerhalb einer Extraktion

### Datum Parsing

- Relative Angaben ("morgen", "nächste Woche") bezogen auf Extraktionszeitpunkt
- Fehlende Datumsangaben → kein `due_at` gesetzt
- Unscharfe Zeitangaben ("nachmittags") → `time_window` statt `start_at`

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Notiz enthält nur ein Fragezeichen | Extraktion liefert 0 Items, Hinweis: "Konnte nichts erkennen" |
| Notiz enthält nur Emojis | Idea mit Emoji als Titel |
| Mehrere Tasks in einem Satz | Separate Tasks, jeweils mit Confidence |
| Wiedersprüchliche Zeitangaben | KI wählt wahrscheinlichste, Confidence niedrig, Rückfrage |
| Sehr lange Notiz (>500 Zeichen) | Normale Verarbeitung, Chunking intern |
| KI API Timeout | Fehler-Snackbar: "Verarbeitung nicht möglich, später nochmal", Notiz bleibt unprocessed |
| KI liefert invalides JSON | Fallback: 1 Idea mit Original-Text, Logging |

## Akzeptanzkriterien

- [ ] Extraktion läuft in <5 Sekunden für typische Notizen
- [ ] Confidence-Werte sind korrekt berechnet und angezeigt
- [ ] Rückfragen erscheinen bei Confidence < 0.5
- [ ] Nutzer kann jeden Titel editieren vor Bestätigung
- [ ] Ablehnen eines Items entfernt es aus der Liste
- [ ] "Alle akzeptieren" speichert nur accepted Items
- [ ] Original-Notiz bleibt unverändert in Inbox
- [ ] Nach Verarbeitung ist Notiz als `processed` markiert

## Telemetrie Events

### extraction_started

**Wann**: KI-Extraktion wird gestartet

**Properties**:
- `note_length`: Integer
- `source`: String (app_inbox, whatsapp)

### extraction_completed

**Wann**: KI liefert Ergebnis zurück

**Properties**:
- `duration_ms`: Integer
- `items_count`: Integer
- `tasks_count`: Integer
- `events_count`: Integer
- `ideas_count`: Integer
- `overall_confidence`: Float
- `questions_count`: Integer

### extraction_failed

**Wann**: KI-Extraktion fehlgeschlagen

**Properties**:
- `error_type`: String (timeout, invalid_json, api_error)
- `note_length`: Integer

### extraction_reviewed

**Wann**: Nutzer bestätigt oder verwirft Items

**Properties**:
- `items_accepted`: Integer
- `items_rejected`: Integer
- `items_edited`: Integer
- `questions_answered`: Boolean
- `time_to_review_seconds`: Integer

### extraction_item_edited

**Wann**: Nutzer bearbeitet ein Item vor Bestätigung

**Properties**:
- `item_type`: String (task, event, idea)
- `field_edited`: String (title, duration, due_at)
