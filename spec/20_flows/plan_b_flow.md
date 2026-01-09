# Flow: Plan B Flow

## Übersicht

Neu-Planung während des Tages, wenn der ursprüngliche Plan nicht mehr passt. Berücksichtigt bereits Erledigtes, aktuelle Uhrzeit und verbleibende Zeit.

## Akteure

- **Nutzer**: Person, die neu planen will
- **System**: DayFlow App
- **Planning Engine**: Algorithmus für Tagesplanung

## Vorbedingungen

- DayPlan für heute confirmed
- Today-Liste hat ≥1 Tasks
- Mindestens 30 Minuten vor Feierabend (aus Settings)
- Nicht alle Tasks erledigt

## Hauptflow

### 1. Plan B initiieren

1. Nutzer öffnet Today-Liste
2. System zeigt "Plan B" Button (oben rechts, Icon 🔄)
3. Nutzer drückt "Plan B"
4. System öffnet Replan-Dialog

**Event**: `plan_b_opened`

### 2. Replan-Dialog anzeigen

5. System berechnet aktuellen Status:
   - Aktuelle Uhrzeit: 14:30
   - Erledigte Tasks: 1 von 3
   - Verbleibende Tasks: Task A (Fokus, 60-120min), Task B (Mini, 10-20min)
   - Feierabend (aus Settings): 18:00
   - Verfügbare Zeit: 3h 30min (210 Minuten)
   - Busy Intervals: Optional aus Kalender (falls V1)

6. System zeigt Replan-Dialog:
   - **Header**: "Neu planen?"
   - **Status**: "Du hast 1 von 3 Aufgaben erledigt"
   - **Kontext**:
     - "Jetzt: 14:30"
     - "Noch ca. 3.5 Stunden bis Feierabend"
   - **Offene Aufgaben**:
     - List: "Präsentation fertig machen (Fokus, 1-2h)"
     - List: "Email schreiben (Mini, 10-20min)"

7. System zeigt Optionen (Radio Buttons):
   - 🎯 "Andere Fokus-Aufgabe wählen"
   - ⚡ "Nur noch Mini-Aufgaben"
   - 🕐 "Mit weniger Zeit planen"
   - ✏️ "Manuell auswählen"

8. System zeigt Buttons:
   - Primary: "Neu planen"
   - Secondary: "Abbrechen"

### 3. Option wählen

9. Nutzer wählt Option (z.B. ⚡ "Nur noch Mini-Aufgaben")
10. Radio Button wird selected
11. Optional: System zeigt Vorschau:
    - "Plan wird angepasst: 2-3 Mini-Aufgaben statt Fokus"

### 4. Neu planen

12. Nutzer drückt "Neu planen"
13. System zeigt Loading: "Plan wird erstellt..."
14. System markiert aktuellen DayPlan:
    - `status` = `replanned`
    - `replan_count` ++
15. System sammelt Planning Input:
    - `date` = heute
    - `current_time` = 14:30
    - `remaining_time_minutes` = 210
    - `available_tasks` = [Task A, Task B] (nur nicht erledigte)
    - `busy_intervals` = optional Kalender-Daten
    - `preference` = "mini_only" (gewählte Option)
    - `working_hours_end` = 18:00

**Event**: `plan_b_executed`

### 5. Planning Engine ausführen

16. Planning Engine verarbeitet:
    - **Constraint**: remaining_time = 210min
    - **Constraint**: Nur Mini-Tasks (5-20min)
    - **Exclude**: Erledigte Tasks

17. Planning Engine wählt:
    - Mini-Task B: Email (10-20min)
    - Optional: Task A als reduzierte Version (30min statt 60-120min)
    - Puffer: 15min
    - **Zeitvorschläge**:
      - Email: 14:45-15:00
      - Puffer: 15:00-15:15
      - Präsentation (Teil 1): 15:15-15:45

18. Planning Engine gibt neuen DayPlan zurück

### 6. Neuen Plan anzeigen

19. System zeigt Day Plan Screen:
   - Header: "Neuer Plan für heute"
   - Hinweis: "Angepasst für verbleibende Zeit"
   - **Mini-Aufgaben**:
     - ⚡ Email schreiben (14:45-15:00)
     - ⚡ Präsentation (Teil) (15:15-15:45)
   - **Puffer**: 15 Minuten
   - Reasoning: "Fokus-Aufgabe zu lang, auf Mini-Aufgaben reduziert"

20. System zeigt Buttons:
   - Primary: "Plan bestätigen"
   - Secondary: "Nochmal ändern" (→ Plan B)

### 7. Plan bestätigen

21. Nutzer drückt "Plan bestätigen"
22. System updated Tasks:
    - Task B: `status` = `scheduled`
    - Task A: Bleibt `open` (oder teilweise scheduled)
23. System confirmed neuen DayPlan:
    - `status` = `confirmed`
    - `confirmed_at` = now()
    - `original_plan_id` = ID des ersten Plans
    - `replan_count` = 1
    - `replan_reason` = "time_shortage"
24. System updated Today-Liste
25. System zeigt Snackbar: "Neuer Plan für heute erstellt"
26. System navigiert zu Today-Liste

**Event**: `day_plan_confirmed` (plan_version=2)

## Alternative Flows

### A1: Option "Andere Fokus-Aufgabe"

Bei Schritt 17:
- Planning Engine wählt zweitwichtigsten Task als Fokus
- Behält Mini-Aufgaben wenn Zeit reicht
- Beispiel: Wenn Task C (Dokument lesen, 30-60min) verfügbar:
  - Fokus: Task C
  - Mini: Task B
  - Task A verschoben

### A2: Option "Mit weniger Zeit planen"

Bei Schritt 17:
- Planning Engine reduziert auf 1 Task (wichtigsten)
- Keine Mini-Aufgaben
- Maximale Puffer
- Beispiel:
  - Nur Task A, aber nur 60min statt 120min
  - Hinweis: "Rest morgen weitermachen"

### A3: Option "Manuell auswählen"

Bei Schritt 12:
- Statt Planning Engine: Manuelle Auswahl
- System zeigt Task-Liste mit Checkboxes
- Nutzer wählt 1-3 Tasks
- System übernimmt Auswahl, generiert Zeitvorschläge
- Weiter mit Schritt 19

### A4: Nochmal ändern

Nach Schritt 20:
- Nutzer drückt "Nochmal ändern"
- System markiert neuen Plan als `replanned`
- Zurück zu Schritt 4 (Replan-Dialog)
- `replan_count` ++

### A5: Replan-Limit erreicht

Bei Schritt 3:
- System prüft: `replan_count` >= 3?
- Wenn ja: System zeigt Warnung:
  - "Du hast heute schon 3× neu geplant."
  - "Vielleicht reicht's für heute? 💪"
  - Buttons: "Trotzdem neu planen" / "Abbrechen"
- Wenn Nutzer fortsetzt: Normal weiter
- Bei 4. Versuch: Hinweis "Nimm dir morgen vor, realistischer zu planen"

**Event**: `plan_b_limit_reached`

### A6: <30min verfügbar

Bei Schritt 5:
- System berechnet: Nur 25 Minuten bis Feierabend
- System zeigt statt Dialog:
  - "Fast geschafft! Nur noch 25 Minuten."
  - "Einfach weitermachen statt neu planen?"
  - Button: "OK"
- Kein Replan möglich

## Fehlerbehandlung

### E1: Planning Engine findet keine passende Aufgabe

Nach Schritt 17:
- Keine Task passt in verbleibende Zeit
- System zeigt Hinweis:
  - "Keine Aufgabe passt mehr heute."
  - "Lieber morgen weitermachen?"
- Buttons: "Daily Review starten" / "Zurück"

### E2: Alle Tasks erledigt

Bei Schritt 1:
- System prüft: Today-Liste leer oder alle `done`?
- "Plan B" Button wird ausgeblendet
- Hinweis: "Alles erledigt! 🎉"

### E3: Planning Engine Fehler

Nach Schritt 16:
- Algorithmus wirft Fehler
- System zeigt Fehler: "Planung fehlgeschlagen"
- Retry-Option oder "Manuell auswählen"

## Datenfluss

```
Aktueller DayPlan (confirmed)
    ↓
User triggers Plan B
    ↓
System berechnet:
  - Erledigte Tasks
  - Verbleibende Zeit
  - Verfügbare Tasks
    ↓
User wählt Replan-Option
    ↓
Planning Engine:
  - Input: Constraints + Preference
  - Output: Neuer DayPlan
    ↓
Alter Plan: status = replanned
    ↓
Neuer Plan angezeigt
    ↓
User bestätigt
    ↓
Neuer Plan: status = confirmed
    ↓
Today-Liste updated
```

## Replan-Zähler

- `replan_count` startet bei 0
- Jeder Replan ++
- Max 3× empfohlen
- Bei 4. Versuch: Warnung aber erlaubt

## Validierung

- [ ] "Plan B" Button erscheint nach Plan-Bestätigung
- [ ] Dialog zeigt korrekten aktuellen Status
- [ ] Verfügbare Zeit wird korrekt berechnet
- [ ] Erledigte Tasks bleiben `done`
- [ ] Neuer Plan berücksichtigt Constraints
- [ ] Alter Plan wird `replanned`
- [ ] Replan-Count wird incrementiert
- [ ] Max 3× wird durchgesetzt (mit Warnung)
- [ ] <30min blockiert Replan mit Hinweis
- [ ] Alle Optionen funktionieren korrekt
- [ ] Neuer Plan ist realistisch
