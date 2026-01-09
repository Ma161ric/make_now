# Flow: Capture to Plan

## Übersicht

Vollständiger Flow von der ersten Notiz-Erfassung bis zum bestätigten Tagesplan. Beschreibt den Happy Path für einen neuen Nutzer am ersten Tag.

## Akteure

- **Nutzer**: Person, die die App nutzt
- **System**: DayFlow App (Frontend + Backend)
- **KI**: Externer KI-Service für Extraktion und Planning

## Vorbedingungen

- App installiert und geöffnet
- Nutzer hat noch keinen Plan für heute
- Keine Inbox-Notizen vorhanden

## Schritte

### 1. Notiz erfassen

1. System zeigt Inbox Capture Screen (autofokussiert)
2. Nutzer tippt: "Email an Chef schreiben, Meeting um 14 Uhr mit Team, Präsentation bis Freitag fertig machen"
3. Nutzer drückt "Hinzufügen"
4. System speichert InboxNote:
   - `raw_text` = Eingabe
   - `status` = `unprocessed`
   - `source` = `app_inbox`
   - `created_at` = now()
5. System zeigt Snackbar: "Notiert ✓"
6. Eingabefeld leert sich

**Event**: `inbox_note_created`

### 2. Zur Verarbeitung

7. Nutzer sieht Notiz in Inbox-Liste
8. Nutzer tappt auf Notiz ODER swiped→Verarbeiten
9. System zeigt Loading: "Analysiere Notiz..."

**Event**: `extraction_started`

### 3. Extraktion

10. System ruft KI-Extraktion auf:
    - Input: InboxNote.raw_text
    - Context: Datum heute, Zeitzone
11. KI analysiert und liefert:
    ```json
    {
      "items": [
        {
          "type": "task",
          "title": "Email an Chef schreiben",
          "duration_min": 10,
          "duration_max": 20,
          "confidence": 0.9
        },
        {
          "type": "event",
          "title": "Meeting mit Team",
          "start_at": "2026-01-09T14:00:00+01:00",
          "confidence": 0.95
        },
        {
          "type": "task",
          "title": "Präsentation fertig machen",
          "duration_min": 60,
          "duration_max": 120,
          "due_at": "2026-01-10T23:59:59+01:00",
          "confidence": 0.85
        }
      ],
      "overall_confidence": 0.9
    }
    ```
12. System zeigt Extraction Review Screen

**Event**: `extraction_completed`

### 4. Review Extraktion

13. Nutzer sieht 3 Item Cards:
    - 📋 Email an Chef schreiben (10-20 Min) 🟢
    - 📅 Meeting mit Team (14:00) 🟢
    - 📋 Präsentation fertig machen (1-2 Std, bis Fr.) 🟢
14. Nutzer reviewed:
    - Alle Titles korrekt
    - Zeiten passen
    - Keine Änderungen nötig
15. Nutzer drückt "Alle akzeptieren"

**Event**: `extraction_reviewed` (items_accepted=3)

### 5. Items speichern

16. System erstellt:
    - Task 1: "Email an Chef schreiben"
      - `duration_min_minutes` = 10
      - `duration_max_minutes` = 20
      - `status` = `open`
      - `estimation_source` = `ai`
    - Event 1: "Meeting mit Team"
      - `start_at` = 14:00
      - `status` = `confirmed`
    - Task 2: "Präsentation fertig machen"
      - `duration_min_minutes` = 60
      - `duration_max_minutes` = 120
      - `due_at` = 2026-01-10
      - `status` = `open`
17. System updated InboxNote:
    - `status` = `processed`
    - `processed_at` = now()
18. System zeigt Snackbar: "2 Aufgaben und 1 Termin gespeichert"
19. System navigiert zu Home/Today

### 6. Tagesplan generieren

20. System erkennt: Kein Plan für heute
21. System sammelt Input:
    - Offene Tasks: Email, Präsentation
    - Events heute: Meeting 14:00-15:00 (geschätzt)
    - User Settings: Arbeitszeit 9:00-18:00, Puffer 15min
22. System ruft Planning Algorithm auf:
    - `date` = heute
    - `available_tasks` = [Email, Präsentation]
    - `busy_intervals` = [14:00-15:00]
    - `working_hours` = 9:00-18:00
23. Planning Algorithm wählt:
    - **Fokus**: Präsentation (60-120min, wichtig wegen due_at)
    - **Mini**: Email (10-20min, schneller Win)
    - **Zeitvorschläge**:
      - Präsentation: 9:00-11:00 (Fokus-Slot morgens)
      - Email: 11:15-11:30 (Nach Fokus, vor Meeting)
      - Puffer: 11:30-11:45
      - [Meeting 14:00-15:00]
24. System zeigt Day Plan Screen

**Event**: `day_plan_generated`

### 7. Plan bestätigen

25. Nutzer sieht:
    - 🎯 Fokus: Präsentation fertig machen (9:00-11:00)
    - ⚡ Mini: Email an Chef schreiben (11:15-11:30)
    - ⏸️ Puffer: 15 Minuten
26. Nutzer liest Reasoning: "Fokus auf Präsentation wegen Deadline Freitag"
27. Nutzer drückt "Plan bestätigen"

**Event**: `day_plan_confirmed`

### 8. Today-Liste aktiv

28. System updated:
    - Task "Präsentation": `status` = `scheduled`
    - Task "Email": `status` = `scheduled`
    - DayPlan: `status` = `confirmed`, `confirmed_at` = now()
29. System zeigt Today-Liste:
    - 2 Aufgaben für heute
    - Optional: Timeline mit Zeitblöcken
30. Snackbar: "Dein Plan für heute steht! 🎯"

## Nachbedingungen

- Inbox-Notiz verarbeitet
- 2 Tasks in DB
- 1 Event in DB
- DayPlan confirmed
- Today-Liste hat 2 Tasks

## Alternative Flows

### A1: Niedrige Confidence

Nach Schritt 11:
- KI liefert Confidence < 0.5 für ein Item
- Extraction Result enthält `questions`:
  ```json
  {
    "questions": ["Wie lange dauert die Präsentation ungefähr?"]
  }
  ```
- System zeigt gelbes Banner mit Frage
- Nutzer antwortet oder wählt Quick-Button (1h, 2h)
- System updated Item mit Antwort
- Weiter mit Schritt 13

### A2: Nutzer editiert Item

Nach Schritt 13:
- Nutzer tappt auf "Email" Title
- System zeigt Edit-Popover
- Nutzer ändert Titel zu "Wichtige Email an Chef"
- Nutzer ändert Dauer zu 15-30min
- System updated temp Item
- Weiter mit Schritt 15

**Event**: `extraction_item_edited`

### A3: Plan B nach Generierung

Nach Schritt 24:
- Nutzer möchte andere Fokus-Aufgabe
- Nutzer drückt "Plan B"
- System zeigt Replan-Dialog
- Nutzer wählt "Andere Fokus-Aufgabe"
- System generiert neuen Plan mit Email als Fokus
- Zurück zu Schritt 24 mit neuem Plan

**Event**: `day_plan_replanned`

## Fehlerbehandlung

### E1: KI-Extraktion fehlschlägt

Nach Schritt 10:
- KI API Timeout oder Fehler
- System zeigt Fehler: "Verarbeitung nicht möglich, später nochmal"
- InboxNote bleibt `unprocessed`
- Nutzer kann später retry

**Event**: `extraction_failed`

### E2: Keine Tasks extrahiert

Nach Schritt 11:
- KI liefert 0 Tasks
- System zeigt Hinweis: "Konnte nichts erkennen. Nochmal anders formulieren?"
- Nutzer kann Notiz editieren oder verwerfen

## Zeitaufwand

- Schritte 1-6: ~10 Sekunden
- Schritte 7-12: ~3-5 Sekunden (KI)
- Schritte 13-19: ~15-30 Sekunden (Review)
- Schritte 20-24: ~2-3 Sekunden (Planning)
- Schritte 25-30: ~5 Sekunden (Bestätigung)

**Total**: ~35-60 Sekunden vom ersten Tippen bis zum bestätigten Plan

## Validierung

- [ ] Nutzer kann kompletten Flow ohne Fehler durchlaufen
- [ ] Alle Events werden geloggt
- [ ] Items werden korrekt gespeichert
- [ ] Plan ist realistisch und passt in Arbeitszeit
- [ ] UI-Feedback bei jedem Schritt
- [ ] Fehler werden abgefangen und behandelt
