# Feature: Day Plan

## Zweck

Generierung eines realistischen Tagesplans mit 1 Fokus-Aufgabe, 2 Mini-Aufgaben und Puffern. Der Plan berücksichtigt verfügbare Zeit, Prioritäten und optionale Kalender-Daten. Der Nutzer bestätigt den Vorschlag per Tap.

## Nutzerstory

Als Nutzer möchte ich jeden Morgen einen realistischen Tagesplan vorgeschlagen bekommen, der mich nicht überfordert, damit ich fokussiert arbeiten kann und am Abend ein Erfolgserlebnis habe.

## In Scope

- Algorithmus für Tagesplan-Generierung
- Auswahl: 1 Fokus-Aufgabe (60-120min), 2 Mini-Aufgaben (5-20min)
- Berücksichtigung von Priorität und Dauer
- Puffer-Zeiten zwischen Blöcken
- Vorschlag von Zeitslots (optional)
- Bestätigen per Tap → Today-Liste erzeugen
- Plan B Button: Neu generieren

## Out of Scope

- Schreiben in Kalender (MVP)
- Multi-Tages-Planung (V2)
- Automatisches Verschieben bei Verzug (V2)
- Team-Koordination (V3)

## Daten und Felder

### DayPlan Model

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| id | UUID | Ja | auto | Eindeutige ID |
| date | Date | Ja | heute | Datum des Plans |
| timezone | String | Ja | Europe/Berlin | Zeitzone |
| focus_task_id | UUID | Nein | null | Referenz auf Task |
| mini_task_ids | Array[UUID] | Nein | [] | Bis zu 2 Task-IDs |
| suggested_blocks | Array[TimeBlock] | Nein | [] | Zeitvorschläge |
| status | Enum | Ja | suggested | Status des Plans |
| confirmed_at | DateTime | Nein | null | Zeitpunkt der Bestätigung |
| reasoning_brief | String | Nein | null | KI-Begründung für Auswahl |

### TimeBlock Model

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| start_at | DateTime | Ja | Startzeit des Blocks |
| end_at | DateTime | Ja | Endzeit des Blocks |
| block_type | Enum | Ja | focus, mini, buffer |
| task_id | UUID | Nein | Referenz auf Task (null bei buffer) |
| duration_minutes | Integer | Ja | Berechnete Dauer |

### Status Enum

- `suggested`: Plan vorgeschlagen, wartet auf Bestätigung
- `confirmed`: Plan bestätigt, Tasks in Today-Liste
- `replanned`: Verworfen und neu geplant
- `completed`: Tag abgeschlossen (nach Daily Review)

## UI Verhalten

### Day Plan Screen

**Header**:
- Datum und Wochentag: "Heute, Do. 9. Januar"
- Motivations-Zeile: "Dein Plan für heute" oder "Lass uns loslegen!"

**Fokus-Aufgabe Card** (groß, prominent):
- Icon 🎯
- Titel der Aufgabe
- Geschätzte Dauer: "ca. 1-2 Stunden"
- Optional: Zeitvorschlag "9:00 - 11:00"
- Badge: FOKUS

**Mini-Aufgaben Cards** (kleiner):
- Icon ⚡
- Titel
- Geschätzte Dauer: "ca. 15 Minuten"
- Optional: Zeitvorschlag

**Puffer Card** (subtil, ausgegraut):
- Icon ⏸️
- Text: "Puffer: 15 Minuten"
- Info: "Für Unerwartetes"

**Reasoning** (optional, ausklappbar):
- Text: "Fokus auf [Aufgabe] wegen hoher Priorität. Mini-Aufgaben passen in Lücken."

**Bottom Actions**:
- Primary Button: "Plan bestätigen" (groß, grün)
- Secondary Button: "Plan B" (kleiner, blau)
- Text Link: "Manuell auswählen"

### Nach Bestätigung

- Alle 3 Aufgaben Status → `scheduled`
- DayPlan Status → `confirmed`
- Navigation zu Today-Liste
- Snackbar: "Dein Plan für heute steht! 🎯"

### Plan B Dialog

- Headline: "Neuen Plan generieren?"
- Text: "Andere Aufgaben vorschlagen oder mit mehr/weniger Zeit?"
- Options:
  - "Andere Fokus-Aufgabe"
  - "Mehr Mini-Aufgaben"
  - "Weniger Zeit"
- Button: "Neu planen"

## Flow Schritte

### Initiales Generieren

1. Nutzer öffnet App am Morgen
2. System prüft: Gibt es heute schon einen confirmed Plan?
   - Ja → Zeige Today-Liste
   - Nein → Generiere Plan
3. System sammelt Input:
   - Alle offenen Tasks (Status `open`, `in_progress`)
   - Optional: Busy Intervals aus Kalender (V1)
   - User Settings: Arbeitszeiten, Puffer-Dauer
4. System ruft Planning Algorithm auf (siehe [Scheduling Rules](../40_rules/scheduling_rules.md))
5. System erhält DayPlan mit Task-IDs und TimeBlocks
6. System zeigt Day Plan Screen
7. Nutzer reviewed und bestätigt
8. System erstellt Today-Liste

### Plan B Replan

1. Nutzer drückt "Plan B"
2. System zeigt Replan-Dialog
3. Nutzer wählt Option
4. System markiert aktuellen Plan als `replanned`
5. System generiert neuen Plan mit Constraint
6. System zeigt neuen Plan

## Regeln

Siehe [Scheduling Rules](../40_rules/scheduling_rules.md) für Details.

### Auswahl-Regeln

**Fokus-Aufgabe**:
- Dauer: 60-120 Minuten (Mittelwert des Bereichs)
- Priorität: Hoch bevorzugt
- Energy Type: Deep Work bevorzugt
- Nur 1 pro Tag

**Mini-Aufgaben**:
- Dauer: 5-20 Minuten
- Genau 2 Stück
- Energy Type: Admin bevorzugt
- Schnelle Wins für Motivation

**Puffer**:
- Default 15 Minuten nach jedem Block
- User-einstellbar: 10, 15, 30 Minuten
- Mindestens 1 Puffer pro Tag

### Zeit-Regeln

- Gesamtzeit Fokus + Mini + Puffer darf verfügbare Zeit nicht überschreiten
- Fokus-Block nicht in Lücken <90 Minuten quetschen
- Wenn zu wenig Zeit: Weniger Mini-Aufgaben oder kürzere Fokus-Aufgabe

### Prioritäts-Regeln

- Überfällige Tasks (due_at in Vergangenheit) haben Vorrang
- Importance `high` → Fokus-Kandidat
- Importance `low` → Nicht in Today, außer nichts anderes verfügbar

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Keine offenen Tasks | Empty State: "Nichts zu tun! 🎉" |
| Nur 1 Task verfügbar | Dieser als Fokus, keine Mini-Aufgaben |
| Alle Tasks >2h | Wähle kürzesten als Fokus, Warnung: "Aufgabe ggf. aufteilen" |
| Kalender komplett voll (V1) | Zeige Hinweis: "Heute kein Platz für neue Tasks" |
| Nutzer lehnt 5x Plan ab | Hinweis: "Manuell auswählen?" |

## Akzeptanzkriterien

- [ ] Plan wird innerhalb <3 Sekunden generiert
- [ ] Plan enthält immer 1 Fokus-Aufgabe
- [ ] Plan enthält 0-2 Mini-Aufgaben
- [ ] Puffer sind eingeplant
- [ ] Gesamtzeit überschreitet verfügbare Zeit nicht
- [ ] Nach Bestätigung sind Tasks in Today-Liste
- [ ] "Plan B" generiert neuen Plan
- [ ] Reasoning erklärt Auswahl verständlich

## Telemetrie Events

### day_plan_generated

**Wann**: Plan wurde generiert

**Properties**:
- `date`: String (ISO Date)
- `focus_task_id`: String
- `mini_tasks_count`: Integer
- `total_duration_minutes`: Integer
- `has_time_suggestions`: Boolean
- `calendar_used`: Boolean
- `generation_time_ms`: Integer

### day_plan_confirmed

**Wann**: Nutzer bestätigt Plan

**Properties**:
- `time_to_confirm_seconds`: Integer
- `plan_version`: Integer (1 = initial, 2+ = nach Replan)

### day_plan_replanned

**Wann**: Nutzer fordert Plan B an

**Properties**:
- `reason`: String (different_focus, more_mini, less_time, manual)
- `previous_plan_id`: String

### day_plan_manual_override

**Wann**: Nutzer wählt "Manuell auswählen"

**Properties**:
- `rejected_plans_count`: Integer
