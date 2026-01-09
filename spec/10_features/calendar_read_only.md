# Feature: Calendar Read-only (V1)

## Zweck

Integration von Kalender-Daten (Read-only) zur Erkennung von Busy Intervals und freien Zeitfenstern. Ermöglicht realistischere Tagesplanung durch Berücksichtigung existierender Termine. Schreibt NICHT in den Kalender.

## Nutzerstory

Als Nutzer möchte ich, dass die App meine existierenden Termine kennt, damit Tasks nur in freie Zeitfenster geplant werden und ich keine Überschneidungen habe.

## In Scope

- Integration mit Kalender-Provider (iCloud, Google, Outlook)
- Auslesen von Busy Intervals für heute/morgen
- Erkennung freier Zeitfenster
- Berücksichtigung bei Day Plan Generation
- Anzeige von Busy Intervals in Timeline (optional)
- Einmalige Berechtigung anfragen

## Out of Scope

- Kalender Write (V2)
- Mehrere Kalender gleichzeitig (V2)
- Terminserien bearbeiten (V2)
- Kalender-Synchronisation (V2)
- Terminvorschläge an andere senden (V3)

## Daten und Felder

### CalendarConnection Model

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | UUID | Ja | Eindeutige ID |
| provider | Enum | Ja | icloud, google, outlook |
| connected_at | DateTime | Ja | Zeitpunkt der Verbindung |
| last_sync | DateTime | Nein | Letzter Sync-Zeitpunkt |
| status | Enum | Ja | active, disconnected, error |
| calendar_id | String | Ja | Provider-spezifische ID |

### BusyInterval Model

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | UUID | Ja | Eindeutige ID |
| calendar_id | String | Ja | Provider-spezifische Event-ID |
| start_at | DateTime | Ja | Startzeit |
| end_at | DateTime | Ja | Endzeit |
| title | String | Nein | Event-Titel (optional) |
| all_day | Boolean | Ja | Ganztägig? |
| fetched_at | DateTime | Ja | Zeitpunkt des Fetches |

### FreeSlot Model (computed)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| start_at | DateTime | Start des freien Fensters |
| end_at | DateTime | Ende des freien Fensters |
| duration_minutes | Integer | Dauer in Minuten |
| suitable_for | Enum | focus, mini, either |

## UI Verhalten

### Onboarding / Settings

**Kalender verbinden**:
- Screen: "Kalender verbinden?"
- Text: "DayFlow kann deine Termine sehen und passende Lücken finden. Wir schreiben nichts in deinen Kalender."
- Provider-Auswahl: iCloud, Google, Outlook
- Button: "Verbinden"
- Nach Verbindung: "Verbunden ✓"

**Settings**:
- Option: "Kalender-Integration"
- Status: Verbunden mit [Provider]
- Button: "Trennen"

### In Day Plan Screen

**Mit Kalender**:
- Zeitvorschläge nur in freien Fenstern
- Busy Intervals optisch angedeutet (Timeline-Ansicht)
- Fokus-Block nur in Fenster ≥90min
- Mini-Tasks in kleinere Lücken

**Ohne Kalender**:
- Standard-Verhalten ohne Zeitvorschläge
- Nur Aufgaben-Liste

### Timeline-Ansicht (optional)

- Vertikale Timeline 8:00-20:00
- Busy Intervals grau hinterlegt
- Geplante Tasks farbig
- Freie Slots weiß

## Flow Schritte

### Initiales Verbinden

1. Nutzer öffnet Settings → Kalender
2. Nutzer wählt Provider
3. System fordert Berechtigung an (OS-Level)
4. Nutzer gewährt Berechtigung
5. System speichert CalendarConnection
6. System führt ersten Sync durch
7. System zeigt Bestätigung

### Täglicher Sync

1. System läuft morgens (6:00) Background Job
2. System lädt Busy Intervals für heute + morgen
3. System speichert BusyIntervals
4. System berechnet FreeSlots
5. System nutzt FreeSlots für Day Plan Generation

### Bei Day Plan Generation

1. Planning Algorithm wird aufgerufen
2. System prüft: Kalender verbunden?
   - Ja: Lade BusyIntervals für heute
   - Nein: Überspringe
3. System berechnet FreeSlots aus Lücken
4. System wählt Tasks und ordnet in FreeSlots zu
5. System generiert TimeBlocks nur in FreeSlots
6. System gibt DayPlan mit Zeitvorschlägen zurück

## Regeln

### Sync-Regeln

- Sync 1× morgens automatisch
- Sync bei manueller Replan-Anforderung
- Cache für 6 Stunden gültig
- Bei Sync-Fehler: Nutze letzten erfolgreichen Stand

### Free Slot Berechnung

- FreeSlot = Lücke zwischen BusyIntervals
- Minimum 10 Minuten (sonst ignorieren)
- Innerhalb Arbeitszeiten (aus Settings)
- `suitable_for`:
  - ≥90min → `focus`
  - 20-90min → `either`
  - 10-20min → `mini`

### Task-Zuordnung

- Fokus-Aufgabe nur in `focus` FreeSlot
- Mini-Aufgabe in `mini` oder `either`
- Puffer zwischen Tasks auch in FreeSlot
- Wenn kein passender Slot: Keine Zeitvorschläge, nur Aufgaben-Liste

### Arbeitszeiten

- Default: 8:00-18:00
- User-einstellbar in Settings
- BusyIntervals außerhalb werden ignoriert

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Kalender komplett voll | Hinweis: "Heute kein Platz für neue Tasks", Plan ohne Zeitvorschläge |
| Nur kleine Lücken (<90min) | Keine Fokus-Aufgabe, nur Mini-Aufgaben |
| Sync-Fehler | Fallback: Plane ohne Kalender, Hinweis anzeigen |
| Berechtigung entzogen | Status `disconnected`, Nutzer informieren |
| Ganztägige Events | Blockieren ganzen Tag, keine Planung |
| Überlappende Events | Zusammenführen zu einem BusyInterval |

## Akzeptanzkriterien

- [ ] Nutzer kann Kalender-Provider verbinden
- [ ] Berechtigung wird korrekt angefragt
- [ ] BusyIntervals werden geladen
- [ ] FreeSlots werden berechnet
- [ ] Day Plan nutzt FreeSlots für Zeitvorschläge
- [ ] Fokus-Aufgabe nur in ≥90min Slots
- [ ] Bei vollem Kalender Hinweis statt Plan
- [ ] Sync läuft 1× morgens
- [ ] Fehler bei Sync werden gehandhabt

## Telemetrie Events

### calendar_connected

**Wann**: Kalender erfolgreich verbunden

**Properties**:
- `provider`: String (icloud, google, outlook)

### calendar_sync_completed

**Wann**: Sync erfolgreich

**Properties**:
- `intervals_fetched`: Integer
- `free_slots_found`: Integer
- `duration_ms`: Integer

### calendar_sync_failed

**Wann**: Sync fehlgeschlagen

**Properties**:
- `provider`: String
- `error_type`: String (permission, network, api_error)

### day_plan_with_calendar

**Wann**: Plan mit Kalender-Daten generiert

**Properties**:
- `busy_intervals_count`: Integer
- `free_slots_used`: Integer
- `tasks_scheduled_with_time`: Integer
