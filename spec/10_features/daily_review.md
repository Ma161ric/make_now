# Feature: Daily Review

## Zweck

Tägliche Nachbearbeitung am Abend: Nutzer markiert Tasks als erledigt, verschiebt nicht Erledigtes, reflektiert kurz. Bereitet morgigen Plan vor. Schließt den Arbeitstag ab.

## Nutzerstory

Als Nutzer möchte ich am Abend meinen Tag kurz abschließen können, damit ich sehe, was ich geschafft habe, nichts vergesse und entspannt in den Feierabend gehe.

## In Scope

- Review Screen für Today-Liste
- Status setzen: Erledigt, Verschieben, Offen lassen
- Kurzes Reflection-Feedback (optional)
- Automatisches Verschieben auf morgen
- Statistik: X von Y erledigt
- Abschluss-Bestätigung

## Out of Scope

- Detaillierte Zeiterfassung (V2)
- Wöchentliche Reviews (V2)
- Streak-Tracking (V2)
- Export von Statistiken (V2)

## Daten und Felder

### DailyReview Model

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| id | UUID | Ja | auto | Eindeutige ID |
| date | Date | Ja | heute | Datum des Reviews |
| day_plan_id | UUID | Ja | - | Referenz auf DayPlan |
| completed_at | DateTime | Ja | now() | Zeitpunkt des Reviews |
| tasks_done | Integer | Ja | - | Anzahl erledigter Tasks |
| tasks_total | Integer | Ja | - | Anzahl geplanter Tasks |
| reflection_note | String | Nein | null | Optionale Notiz |
| mood | Enum | Nein | null | Stimmung am Ende |

### Mood Enum

- `great`: 😊 Alles geschafft, super Tag
- `good`: 🙂 Meiste geschafft, zufrieden
- `okay`: 😐 Gemischt, einiges offen
- `tough`: 😔 Wenig geschafft, schwieriger Tag

## UI Verhalten

### Trigger Daily Review

**Auto-Trigger**:
- Uhrzeit >18:00 und Today-Liste nicht leer
- Notification: "Zeit für Daily Review?"
- Tap → Öffnet Review Screen

**Manuell**:
- Button in Today-Liste: "Tag abschließen"
- Immer verfügbar, auch früher am Tag

### Daily Review Screen

**Header**:
- Datum: "Do. 9. Januar"
- Headline: "Wie war dein Tag?"

**Today-Liste Review**:
- Jede Task als Card
- Status-Buttons:
  - ✅ "Erledigt" (grün)
  - ➡️ "Morgen" (blau)
  - ⏸️ "Offen lassen" (grau)
- Default-Selektion: Nichts ausgewählt, Nutzer muss wählen

**Statistik**:
- Live-Update während Auswahl
- Text: "2 von 3 Aufgaben erledigt 🎉"
- Progress Bar visuell

**Reflection (optional)**:
- Label: "Kurze Notiz zum Tag? (optional)"
- Textfeld, Placeholder: "Was lief gut? Was nicht?"
- Mood Picker: 4 Emoji-Buttons

**Bottom Actions**:
- Primary Button: "Tag abschließen" (disabled bis alle Tasks reviewed)
- Link: "Später"

### Nach Abschluss

- Tasks mit ✅ → Status `done`
- Tasks mit ➡️ → Status `scheduled`, due_at = morgen
- Tasks mit ⏸️ → Status `open`
- DayPlan Status → `completed`
- DailyReview gespeichert
- Motivations-Screen: "Gut gemacht! 2 Aufgaben erledigt."
- Navigation zu Inbox oder Home

## Flow Schritte

1. System erkennt Trigger (Zeit oder manuell)
2. System zeigt Daily Review Screen
3. System lädt alle Tasks aus heutigem DayPlan
4. Nutzer wählt Status für jede Task
5. Statistik updated live
6. Optional: Nutzer schreibt Reflection, wählt Mood
7. Nutzer drückt "Tag abschließen"
8. System updated Task-Stati
9. System erstellt DailyReview Record
10. System zeigt Success-Screen
11. System bereitet morgigen Plan vor (Background)

## Regeln

### Status-Regeln

- Jede Task muss einen Status haben (kein Skip)
- Erledigt → Status `done`, `completed_at` = now()
- Morgen → Status `scheduled`, `due_at` = morgen 00:00
- Offen lassen → Status `open`, kein due_at Change

### Timing-Regeln

- Review kann ab 16:00 gestartet werden
- Empfohlen: 18:00-20:00
- Notification um 18:30 (einmalig pro Tag)
- Kann auch nächsten Tag nachgeholt werden

### Statistik-Regeln

- Tasks done / Tasks total
- Prozent: (done / total) × 100
- Motivations-Text:
  - 100%: "Perfekt! Alles geschafft! 🏆"
  - 66-99%: "Stark! Fast alles erledigt! 🎉"
  - 33-65%: "Solide! Morgen geht's weiter. 💪"
  - 0-32%: "Schwieriger Tag. Morgen wird besser! 🌟"

### Reflection Policy

- Komplett optional
- Nicht länger als 500 Zeichen
- Wird nicht analysiert oder verarbeitet (nur Speicherung)
- Kann später gelesen werden (V2)

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Nutzer macht Review nicht | Tasks bleiben Status `scheduled`, nächsten Tag als "überfällig" |
| Today-Liste leer | Review nicht angeboten, kein Trigger |
| Nutzer öffnet Review, abbricht | Keine Änderungen gespeichert, Tasks unverändert |
| Nutzer markiert alles "Offen" | Erlaubt, Statistik: 0 von 3 erledigt |
| Review nach Mitternacht | Gilt noch für vorherigen Tag, Datum-Kontext klar anzeigen |

## Akzeptanzkriterien

- [ ] Review-Trigger funktioniert um 18:30
- [ ] Alle Today-Tasks werden angezeigt
- [ ] Nutzer muss für jede Task Status wählen
- [ ] Statistik berechnet sich korrekt
- [ ] Erledigte Tasks erhalten Status `done`
- [ ] Verschobene Tasks haben due_at = morgen
- [ ] DailyReview wird gespeichert
- [ ] Motivation-Screen zeigt passenden Text
- [ ] Button disabled bis alle Tasks reviewed

## Telemetrie Events

### daily_review_started

**Wann**: Review Screen wird geöffnet

**Properties**:
- `trigger`: String (auto_notification, manual_button)
- `time_of_day`: String (morning, afternoon, evening, night)
- `tasks_count`: Integer

### daily_review_completed

**Wann**: Nutzer schließt Review ab

**Properties**:
- `tasks_done`: Integer
- `tasks_total`: Integer
- `completion_rate`: Float (0.0-1.0)
- `tasks_postponed`: Integer
- `tasks_left_open`: Integer
- `has_reflection`: Boolean
- `mood`: String (great, good, okay, tough, null)
- `time_to_complete_seconds`: Integer

### daily_review_skipped

**Wann**: Nutzer drückt "Später"

**Properties**:
- `tasks_count`: Integer

### daily_review_incomplete

**Wann**: Nutzer verlässt Screen ohne Abschluss

**Properties**:
- `tasks_reviewed`: Integer
- `tasks_total`: Integer
