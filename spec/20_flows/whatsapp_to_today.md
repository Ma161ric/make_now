# Flow: WhatsApp to Today

## Übersicht

Kompletter Flow von WhatsApp-Nachricht bis zur Today-Liste. Zeigt Ingest, Auto-Extraktion und optionale Antworten.

## Akteure

- **Nutzer**: Person, die WhatsApp nutzt
- **System**: DayFlow Backend + App
- **WhatsApp**: Messaging Platform (via API/Bridge)
- **KI**: Extraktions-Service

## Vorbedingungen

- WhatsApp Connection ist `active`
- Nutzer hat Bot-Nummer in Kontakten
- Auto-Extraktion ist aktiviert (Settings)

## Hauptflow

### 1. Nachricht senden

1. Nutzer öffnet WhatsApp
2. Nutzer wählt DayFlow Bot aus Kontakten
3. Nutzer tippt: "Meeting Vorbereitung 1 Stunde, Email an Team schicken"
4. Nutzer sendet Nachricht (14:23 Uhr)

### 2. Nachricht empfangen

5. WhatsApp sendet Webhook an DayFlow Backend
6. Backend empfängt:
   ```json
   {
     "from": "+491234567890",
     "message_id": "whatsapp_msg_12345",
     "text": "Meeting Vorbereitung 1 Stunde, Email an Team schicken",
     "timestamp": "2026-01-09T14:23:00Z"
   }
   ```
7. Backend validiert:
   - Absender bekannt?
   - Rate Limit OK? (<50 heute)
   - Nachricht ist Text? (keine Medien)

**Event**: `whatsapp_message_received`

### 3. InboxNote erstellen

8. Backend erstellt InboxNote:
   - `raw_text` = "Meeting Vorbereitung 1 Stunde, Email an Team schicken"
   - `source` = `whatsapp`
   - `status` = `unprocessed`
   - `created_at` = now()
   - `metadata` = {
       "whatsapp_message_id": "whatsapp_msg_12345",
       "sender_phone": "+491234567890",
       "received_at": "2026-01-09T14:23:00Z"
     }
9. Backend speichert InboxNote in DB

### 4. Auto-Extraktion (wenn aktiviert)

10. Backend prüft: Auto-Extraktion ON?
11. Ja → Backend startet Extraktion:
    - Input: InboxNote.raw_text
    - Context: Datum, Zeitzone, Uhrzeit
12. KI analysiert und liefert:
    ```json
    {
      "items": [
        {
          "type": "task",
          "title": "Meeting Vorbereitung",
          "duration_min": 60,
          "duration_max": 60,
          "confidence": 0.95,
          "estimation_source": "parsed"
        },
        {
          "type": "task",
          "title": "Email an Team schicken",
          "duration_min": 5,
          "duration_max": 15,
          "confidence": 0.9,
          "estimation_source": "ai"
        }
      ]
    }
    ```

**Event**: `extraction_completed`

### 5. Items automatisch speichern

13. Backend erstellt Tasks:
    - Task 1: "Meeting Vorbereitung"
      - `duration_min_minutes` = 60
      - `duration_max_minutes` = 60
      - `status` = `open`
      - `estimation_source` = `parsed`
      - `confidence` = 0.95
    - Task 2: "Email an Team schicken"
      - `duration_min_minutes` = 5
      - `duration_max_minutes` = 15
      - `status` = `open`
      - `estimation_source` = `ai`
      - `confidence` = 0.9

14. Backend updated InboxNote:
    - `status` = `processed`
    - `processed_at` = now()

**Event**: `whatsapp_message_processed`

### 6. Bestätigung senden

15. Backend generiert Bestätigungs-Nachricht:
    - Text: "2 Aufgaben gespeichert ✓"
16. Backend sendet via WhatsApp API an Nutzer
17. Nutzer erhält WhatsApp-Nachricht (14:23 Uhr + 2 Sek)

### 7. App-Sync

18. Mobile App synced (Background oder bei Öffnung)
19. App lädt neue InboxNote und Tasks
20. Badge-Count updated
21. Optional: Push Notification:
    - "2 neue Aufgaben aus WhatsApp"

### 8. Nutzer öffnet App

22. Nutzer öffnet DayFlow App (15:00 Uhr)
23. App zeigt Inbox-Liste:
    - 1 neue processed Notiz mit Icon 💬
24. App zeigt Task-Liste:
    - "Meeting Vorbereitung" (offen)
    - "Email an Team schicken" (offen)

### 9. In Today-Liste aufnehmen

25. Nutzer öffnet Day Plan Screen
26. System generiert Tagesplan:
    - Berücksichtigt neue Tasks
    - Wählt "Meeting Vorbereitung" als Fokus (60min)
    - Wählt "Email an Team" als Mini (5-15min)
27. Nutzer bestätigt Plan
28. Tasks werden in Today-Liste aufgenommen

## Alternative Flows

### A1: Auto-Extraktion AUS

Nach Schritt 10:
- Auto-Extraktion ist deaktiviert
- Backend erstellt nur InboxNote
- Backend sendet Bestätigung: "Notiert ✓"
- Nutzer muss später manuell in App extrahieren
- Weiter mit Schritt 18

### A2: Niedrige Confidence

Nach Schritt 12:
- KI liefert Item mit Confidence < 0.5
- Extraction Result enthält `questions`:
  ```json
  {
    "questions": ["Wie lange dauert 'Meeting Vorbereitung' ungefähr?"]
  }
  ```
- Backend erstellt InboxNote, aber Items NICHT automatisch
- Backend setzt `status` = `unprocessed` (trotz Extraktion)
- Backend sendet: "Notiert, aber bitte nochmal prüfen 🔍"
- Nutzer muss in App reviewen

### A3: Extraktion fehlschlägt

Nach Schritt 11:
- KI API Timeout oder Fehler
- Backend erstellt nur InboxNote
- InboxNote bleibt `unprocessed`
- Backend sendet: "Notiert, aber konnte nicht verarbeiten. Später nochmal?"
- Nutzer kann später in App extrahieren

**Event**: `whatsapp_message_failed` (error_type=extraction_error)

### A4: Rate Limit erreicht

Bei Schritt 7:
- Nutzer hat heute schon 50 Nachrichten geschickt
- Backend lehnt ab
- Backend sendet: "Limit erreicht (50/Tag), morgen weiter"
- Nachricht wird NICHT gespeichert

**Event**: `whatsapp_rate_limit_hit`

### A5: Medien statt Text

Bei Schritt 7:
- Nutzer sendet Bild oder Voice Message
- Backend erkennt: type = "image"
- Backend ignoriert Nachricht
- Backend sendet: "Nur Text-Nachrichten bitte"
- Keine InboxNote erstellt

**Event**: `whatsapp_message_failed` (error_type=media)

### A6: Sehr lange Nachricht

Bei Schritt 7:
- Nachricht >2000 Zeichen
- Backend schneidet ab bei 2000
- Backend speichert gekürzte Version
- Backend sendet: "Nachricht gekürzt (zu lang), erste 2000 Zeichen gespeichert"

**Event**: `whatsapp_message_failed` (error_type=too_long)

## WhatsApp Reply Flow (V1)

### Nach Schritt 17: Nutzer antwortet mit Command

29. Nutzer antwortet in WhatsApp: "done"
30. Backend empfängt Command
31. Backend matched auf letzte Task: "Email an Team schicken"
32. Backend setzt Status `done`
33. Backend sendet: "Erledigt: Email an Team schicken ✓"
34. App synced
35. Task erscheint als erledigt in App

Siehe [WhatsApp Replies](../10_features/whatsapp_replies.md) für Details.

## Fehlerbehandlung

### E1: Webhook Fehler

Bei Schritt 6:
- Backend nicht erreichbar oder Fehler
- WhatsApp retried Webhook (3×)
- Nach 3 Fehlern: Nachricht geht verloren
- Logging für Debug

### E2: DB-Fehler beim Speichern

Nach Schritt 9:
- DB-Fehler
- Backend retried (3×)
- Nach 3 Fehlern: Fehler-Log, Nachricht verwerfen
- Backend sendet: "Fehler beim Speichern, bitte nochmal"

### E3: WhatsApp API down

Bei Schritt 16:
- Bestätigung kann nicht gesendet werden
- Backend loggt Fehler
- InboxNote und Tasks werden trotzdem gespeichert
- Keine Bestätigung an Nutzer

## Timing

- Schritt 1-6: ~1 Sekunde
- Schritt 7-9: <500ms
- Schritt 10-14: ~3-5 Sekunden (KI)
- Schritt 15-17: ~1 Sekunde
- **Total**: ~5-7 Sekunden von Send bis Bestätigung

## Datenfluss

```
WhatsApp Message
    ↓
[Webhook]
    ↓
Backend validiert
    ↓
InboxNote created (source=whatsapp)
    ↓
[Auto-Extraction ON?]
    ↓
KI Extraction
    ↓
Tasks created
    ↓
InboxNote → processed
    ↓
Bestätigung via WhatsApp
    ↓
[App Sync]
    ↓
Tasks in App sichtbar
    ↓
[User plans day]
    ↓
Tasks in Today-Liste
```

## Validierung

- [ ] Nachricht wird empfangen und gespeichert
- [ ] InboxNote hat Source `whatsapp`
- [ ] Auto-Extraktion funktioniert wenn ON
- [ ] Tasks werden automatisch gespeichert
- [ ] Bestätigung wird gesendet
- [ ] App synced neue Daten
- [ ] Badge und Notification funktionieren
- [ ] Medien werden abgelehnt mit Hinweis
- [ ] Rate Limit schützt vor Spam
- [ ] Fehler werden gehandhabt
- [ ] Tasks erscheinen in Day Plan
- [ ] WhatsApp Replies funktionieren (V1)
