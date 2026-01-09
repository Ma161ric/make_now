# Flow: Review Extraction

## Übersicht

Detaillierter Flow für das Review und die Bearbeitung von extrahierten Items nach KI-Extraktion. Beschreibt Interaktionen, Editier-Optionen und Bestätigung.

## Akteure

- **Nutzer**: Person, die extrahierte Items reviewed
- **System**: DayFlow App

## Vorbedingungen

- InboxNote existiert mit Status `unprocessed`
- KI-Extraktion wurde durchgeführt
- ExtractionResult liegt vor mit ≥1 Items

## Hauptflow

### 1. Review Screen anzeigen

1. System lädt ExtractionResult
2. System zeigt Extraction Review Screen:
   - Header: Original-Notiz in Readonly-Card
   - Count: "3 Aufgaben, 1 Termin gefunden"
   - Item Cards (eine pro Item)
3. Jede Item Card zeigt:
   - Icon basierend auf Type (📋/📅/💡)
   - Titel (editierbar)
   - Parsed Fields (Dauer, Zeitpunkt, etc.)
   - Confidence Badge (🟢/🟡/🔴)
   - Buttons: "Akzeptieren" / "Ablehnen"

### 2. Confidence-basierte Anzeige

**High Confidence (≥0.8)**:
- Grünes Badge 🟢
- Kein Hinweis
- Standard-Darstellung

**Medium Confidence (0.5-0.8)**:
- Gelbes Badge 🟡
- Subtiler Hinweis: "Bitte prüfen"
- Standard-Darstellung

**Low Confidence (<0.5)**:
- Rotes Badge 🔴
- Gelbes Banner oben mit Rückfrage
- Eingabefeld oder Quick-Buttons

### 3. Nutzer-Interaktionen

#### 3a. Item akzeptieren (ohne Änderung)

4. Nutzer drückt "Akzeptieren" auf einer Card
5. System updated Item:
   - `status` = `accepted`
   - Visuelles Feedback: Grüner Haken, Card leicht ausgegraut
6. Button wechselt zu "✓ Akzeptiert"

#### 3b. Item editieren

4. Nutzer tappt auf Titel
5. System zeigt Inline-Edit oder Popover:
   - Textfeld mit aktuellem Titel
   - Fokussiert und Text selektiert
6. Nutzer ändert Text
7. Nutzer drückt Enter oder "OK"
8. System updated `title` im temp Item
9. System zeigt Änderung

**Event**: `extraction_item_edited` (field=title)

#### 3c. Dauer editieren (Tasks only)

4. Nutzer tappt auf Duration Badge
5. System zeigt Quick Edit Popover:
   - Preset Buttons: 5min, 15min, 30min, 1h, 2h
   - Custom Input: Min/Max Felder
6. Nutzer wählt Preset ODER gibt Custom ein
7. System validiert (min < max, min ≥ 5)
8. System updated `parsed_fields.duration_min/max`
9. System setzt `estimation_source` = `user_override`
10. Badge updated mit neuer Dauer

**Event**: `extraction_item_edited` (field=duration)

#### 3d. Item ablehnen

4. Nutzer drückt "Ablehnen"
5. System zeigt Confirm-Dialog: "Wirklich verwerfen?"
6. Nutzer bestätigt
7. System updated Item:
   - `status` = `rejected`
   - Card wird ausgegraut oder ausgeblendet
8. Count updated: "2 Aufgaben, 1 Termin gefunden"

**Event**: `extraction_item_edited` (action=rejected)

### 4. Rückfragen beantworten (Low Confidence)

**Wenn Rückfrage vorhanden**:

1. System zeigt gelbes Banner:
   - Text: "Wie lange dauert 'Präsentation vorbereiten' ungefähr?"
   - Quick-Buttons: 15min, 30min, 1h, 2h
   - Custom Input-Feld
2. Nutzer wählt Option ODER gibt Custom ein
3. System parsed Antwort
4. System updated betreffendes Item:
   - `parsed_fields.duration_min/max` = Antwort
   - `confidence` = 1.0
   - `estimation_source` = `user_override`
5. Banner verschwindet
6. Item Badge updated: 🔴 → 🟢

**Event**: `extraction_question_answered`

### 5. Alle Items reviewed

9. Nutzer hat alle Items akzeptiert oder abgelehnt
10. Button "Alle akzeptieren" wird enabled (wenn ≥1 accepted)
11. Count zeigt: "2 von 3 Items akzeptiert"

### 6. Bestätigung

12. Nutzer drückt "Alle akzeptieren"
13. System validiert:
    - Mind. 1 Item accepted?
    - Alle Pflichtfelder vorhanden?
14. System erstellt permanente Records:
    - Für jedes accepted Item:
      - Task → tasks table
      - Event → events table
      - Idea → ideas table
15. System updated InboxNote:
    - `status` = `processed`
    - `processed_at` = now()
16. System zeigt Snackbar: "2 Aufgaben und 1 Termin gespeichert"
17. System navigiert zu Home oder Today

**Event**: `extraction_reviewed` (items_accepted=2, items_rejected=1)

## Alternative Flows

### A1: Alle Items ablehnen

Nach Schritt 9:
- Nutzer hat alle Items abgelehnt
- Count: "0 Items akzeptiert"
- Button "Alle akzeptieren" bleibt disabled
- Hinweis: "Mindestens 1 Item akzeptieren"
- Option: "Notiz erneut verarbeiten" oder "Abbrechen"

### A2: Abbrechen während Review

Während Schritte 1-11:
- Nutzer drückt "Abbrechen" oder Back-Button
- System zeigt Confirm-Dialog: "Änderungen verwerfen?"
- Nutzer bestätigt
- System verwirft temp Items
- InboxNote bleibt `unprocessed`
- Navigation zurück zu Inbox-Liste

### A3: Neue Felder hinzufügen

Nach Schritt 8:
- Nutzer möchte zusätzliches Feld setzen (z.B. Importance)
- Nutzer tappt auf "Mehr" oder "Details"
- System zeigt erweiterte Edit-Maske:
  - Importance: Low/Medium/High
  - Due Date Picker (falls nicht gesetzt)
  - Notes Textfeld
- Nutzer setzt Werte
- System updated `parsed_fields`
- Zurück zu Card-Ansicht

### A4: Item-Typ ändern

Nach Schritt 8:
- KI hat fälschlicherweise Task als Idea klassifiziert
- Nutzer tappt auf Type-Icon
- System zeigt Type-Picker: Task / Event / Idea
- Nutzer wählt korrekten Type
- System updated `type` und zeigt passende Fields
- Nutzer füllt ggf. fehlende Fields aus

## Fehlerbehandlung

### E1: Validierungs-Fehler

Bei Schritt 13:
- Task ohne Titel → Fehler: "Titel fehlt"
- Event ohne Zeitangabe → Warnung: "Keine Zeit gesetzt, als Task speichern?"
- Ungültige Dauer (min > max) → Fehler: "Dauer ungültig"
- System zeigt Fehler bei betroffenem Item
- Button bleibt disabled

### E2: Speichern fehlschlägt

Nach Schritt 14:
- DB-Fehler beim Speichern
- System zeigt Fehler: "Speichern fehlgeschlagen"
- Items bleiben in Temp State
- Retry-Option anbieten

## UI-Zustände

### Item Card States

- **Unreviewed** (default): Weiß, beide Buttons aktiv
- **Accepted**: Leicht grün, Haken-Icon, "✓ Akzeptiert"
- **Rejected**: Ausgegraut, durchgestrichen (optional)
- **Editing**: Fokussiert, Hintergrund leicht highlighted

### Bottom Button States

- **Disabled**: Grau, keine Items akzeptiert
- **Enabled**: Grün, mind. 1 Item akzeptiert
- **Loading**: Spinner, während Speichern

## Validierung

- [ ] Alle Items werden korrekt angezeigt
- [ ] Confidence Badges stimmen mit Werten überein
- [ ] Titel-Edit funktioniert inline
- [ ] Dauer-Edit zeigt Presets und Custom
- [ ] Ablehnen entfernt Item aus Accepted-Count
- [ ] Rückfragen erscheinen bei Low Confidence
- [ ] Antworten updated Confidence zu High
- [ ] "Alle akzeptieren" nur bei ≥1 accepted enabled
- [ ] Speichern erstellt korrekte DB-Records
- [ ] InboxNote wird als `processed` markiert
