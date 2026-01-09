# Flow: Daily Review Flow

## Übersicht

Täglicher Abschluss-Flow am Abend. Nutzer markiert Tasks als erledigt, verschiebt Offenes, gibt optionales Feedback. Bereitet morgigen Tag vor.

## Akteure

- **Nutzer**: Person, die den Tag abschließt
- **System**: DayFlow App

## Vorbedingungen

- Confirmed DayPlan für heute existiert
- Today-Liste hat ≥1 Tasks
- Aktuelle Zeit >16:00

## Trigger

### Automatischer Trigger

1. System-Time = 18:30
2. System prüft:
   - DayPlan für heute confirmed?
   - Today-Liste nicht leer?
   - Daily Review noch nicht gemacht?
3. System zeigt Push Notification:
   - "Zeit für Daily Review?"
   - Tap → Öffnet Review Screen

### Manueller Trigger

1. Nutzer öffnet Today-Liste
2. System zeigt Button "Tag abschließen" (immer sichtbar ab 16:00)
3. Nutzer tappt Button
4. System öffnet Review Screen

## Hauptflow

### 1. Review Screen anzeigen

1. System lädt DayPlan und zugehörige Tasks
2. System zeigt Daily Review Screen:
   - Header: Datum "Do. 9. Januar"
   - Headline: "Wie war dein Tag?"
   - Task-Liste (alle Today-Tasks)
   - Statistik (initial: 0 von X)
   - Reflection-Bereich (optional)
   - Button "Tag abschließen" (disabled)

### 2. Tasks reviewen

3. Jede Task zeigt:
   - Title
   - Geschätzte Dauer
   - 3 Status-Buttons (initial: alle unselected)

4. Nutzer wählt Status für erste Task:
   - Tap ✅ "Erledigt" → Button grün, andere disabled
   - Tap ➡️ "Morgen" → Button blau, andere disabled
   - Tap ⏸️ "Offen lassen" → Button grau, andere disabled

5. System updated Statistik live:
   - "1 von 3 Aufgaben erledigt"
   - Progress Bar: 33%

6. Nutzer wiederholt für alle Tasks

7. Wenn alle Tasks einen Status haben:
   - Button "Tag abschließen" wird enabled
   - Statistik final: "2 von 3 Aufgaben erledigt 🎉"

### 3. Optional: Reflection

8. Nutzer scrollt zu Reflection-Bereich
9. Nutzer tippt in Textfeld (Placeholder: "Was lief gut? Was nicht?")
10. System speichert Input in temp State
11. Nutzer wählt optional Mood (4 Emoji-Buttons):
    - 😊 "Alles geschafft"
    - 🙂 "Meiste geschafft"
    - 😐 "Gemischt"
    - 😔 "Schwieriger Tag"
12. System speichert Mood in temp State

### 4. Abschließen

13. Nutzer drückt "Tag abschließen"
14. System validiert:
    - Alle Tasks haben Status?
    - Mind. 1 Task?
15. System updated Tasks in DB:
    - Tasks mit ✅ → `status` = `done`, `completed_at` = now()
    - Tasks mit ➡️ → `status` = `scheduled`, `due_at` = morgen 00:00
    - Tasks mit ⏸️ → `status` = `open`, kein Änderung an `due_at`
16. System updated DayPlan:
    - `status` = `completed`
17. System erstellt DailyReview Record:
    - `date` = heute
    - `day_plan_id` = aktueller Plan
    - `tasks_done` = Anzahl ✅
    - `tasks_total` = Anzahl gesamt
    - `reflection_note` = optional
    - `mood` = optional
    - `completed_at` = now()
18. System zeigt Success-Screen:
    - Motivations-Text basierend auf Completion Rate
    - Statistik: "2 von 3 Aufgaben erledigt"
    - Button: "Fertig"
19. Nutzer tappt "Fertig"
20. System navigiert zu Home/Inbox
21. System startet Background Job: Morgen-Plan vorbereiten

**Event**: `daily_review_completed`

## Motivations-Texte

Basierend auf Completion Rate (done / total):

- **100%**: "Perfekt! Alles geschafft! 🏆"
- **66-99%**: "Stark! Fast alles erledigt! 🎉"
- **33-65%**: "Solide! Morgen geht's weiter. 💪"
- **0-32%**: "Schwieriger Tag. Morgen wird besser! 🌟"

## Alternative Flows

### A1: Nutzer drückt "Später"

Nach Schritt 1:
- Button "Später" wird angezeigt (Text Link)
- Nutzer drückt "Später"
- System schließt Review Screen
- Tasks bleiben im aktuellen Status
- Kein DailyReview erstellt
- Nutzer kann später manuell starten

**Event**: `daily_review_skipped`

### A2: Nutzer verlässt Screen ohne Abschluss

Während Schritte 2-12:
- Nutzer drückt Back-Button oder wechselt App
- System zeigt Confirm-Dialog: "Review abbrechen?"
- Option A: "Abbrechen" → Zurück zu Review
- Option B: "Verwerfen" → Temp State verwerfen, Screen schließen

**Event**: `daily_review_incomplete` (tasks_reviewed=1, tasks_total=3)

### A3: Alle Tasks "Offen lassen"

Nach Schritt 7:
- Nutzer hat alle Tasks mit ⏸️ markiert
- Statistik: "0 von 3 Aufgaben erledigt"
- Motivations-Text: "Schwieriger Tag. Morgen wird besser!"
- Weiter normal mit Schritt 13
- Tasks bleiben Status `open`

### A4: Review nach Mitternacht

Trigger um 00:30 (nächster Tag):
- System erkennt: DayPlan von gestern nicht reviewed
- Notification: "Gestrigen Tag noch abschließen?"
- Wenn ja: Review Screen mit Datum-Kontext "Mi. 8. Januar (gestern)"
- Weiter normal, aber DailyReview.date = gestern

## Fehlerbehandling

### E1: Nicht alle Tasks haben Status

Bei Schritt 14:
- Validation fehlgeschlagen
- System scrollt zu erstem Task ohne Status
- System zeigt Hinweis: "Bitte Status für alle Aufgaben wählen"
- Button bleibt disabled

### E2: Speichern fehlschlägt

Nach Schritt 15:
- DB-Fehler beim Update
- System zeigt Fehler: "Speichern fehlgeschlagen"
- Retry-Option anbieten
- Temp State bleibt erhalten

### E3: Today-Liste leer

Bei Trigger:
- DayPlan existiert, aber alle Tasks schon erledigt oder deleted
- System zeigt NICHT Review Screen
- Stattdessen: Auto-Complete DailyReview:
  - `tasks_done` = 0
  - `tasks_total` = 0
  - `status` = `completed`
- Keine Notification

## Zeitverhalten

### Optimale Review-Zeit

- Empfohlen: 18:00-20:00
- Frühestens: 16:00
- Spätestens: 23:59 (selber Tag)

### Notification-Strategie

- Erste Notification: 18:30
- Wenn ignoriert: Keine weitere heute
- Wenn erneut ignoriert: Morgen früh Reminder

## Datenfluss

```
Today Tasks (status: scheduled)
    ↓
[User Reviews]
    ↓
Status Updates:
  - done → Task.status = done, completed_at = now
  - morgen → Task.status = scheduled, due_at = tomorrow
  - offen → Task.status = open
    ↓
DayPlan.status = completed
    ↓
DailyReview created
    ↓
[Background: Prepare tomorrow plan]
```

## Validierung

- [ ] Review öffnet automatisch um 18:30
- [ ] Review kann manuell ab 16:00 gestartet werden
- [ ] Alle Tasks werden angezeigt
- [ ] Status-Buttons sind mutual exclusive
- [ ] Statistik berechnet sich live korrekt
- [ ] Button enabled nur wenn alle Tasks reviewed
- [ ] Completion Rate und Motivations-Text korrekt
- [ ] Tasks werden korrekt updated
- [ ] DailyReview wird gespeichert
- [ ] Reflection ist komplett optional
- [ ] Success-Screen zeigt richtigen Text
