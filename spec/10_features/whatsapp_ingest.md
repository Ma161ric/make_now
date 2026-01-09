# Feature: WhatsApp Ingest (V1)

## Zweck

Importieren von WhatsApp-Nachrichten als Inbox-Items. Nutzer kann Nachrichten aus WhatsApp an die App weiterleiten, die dann automatisch verarbeitet werden. Senkt die Hürde für schnelles Erfassen.

## Nutzerstory

Als Nutzer möchte ich Aufgaben direkt aus WhatsApp an meine Planungs-App schicken können, damit ich nicht die App öffnen muss und im Kontext bleibe.

## In Scope

- Empfangen von WhatsApp-Nachrichten
- Automatisches Erstellen von InboxNote mit Source `whatsapp`
- Optional: Automatische Extraktion nach Ingest
- Bestätigungs-Nachricht zurück an Nutzer (optional)
- Einmalige Einrichtung mit Verifizierung

## Out of Scope

- Zwei-Wege-Kommunikation (nur Ingest, V1)
- Gruppen-Chats (nur 1:1)
- Medien (Bilder, Voice Messages)
- WhatsApp Business API (nutzt Consumer API oder Bridge)

## Daten und Felder

### WhatsAppConnection Model

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | UUID | Ja | Eindeutige ID |
| phone_number | String | Ja | Nutzer-Telefonnummer |
| verified_at | DateTime | Ja | Zeitpunkt der Verifizierung |
| status | Enum | Ja | active, inactive |
| last_message_at | DateTime | Nein | Letzte empfangene Nachricht |

### InboxNote Erweiterung

- `source` Enum erhält Wert `whatsapp`
- `metadata` JSON-Feld mit:
  - `whatsapp_message_id`: String
  - `sender_phone`: String
  - `received_at`: DateTime

## UI Verhalten

### Einrichtung

**Settings Screen**:
- Sektion: "WhatsApp Ingest"
- Text: "Nachrichten an DayFlow schicken"
- Button: "WhatsApp verbinden"

**Verbindungs-Flow**:
1. Eingabe Telefonnummer
2. SMS mit Verifikations-Code
3. Code eingeben
4. Bot-Nummer wird angezeigt: "+49 xxx xxx xxxx"
5. Hinweis: "Schicke eine Nachricht an diese Nummer, um loszulegen"

**Nach Verbindung**:
- Status: "Verbunden ✓"
- Bot-Nummer angezeigt
- Toggle: "Auto-Extraktion" (an/aus)
- Button: "Trennen"

### In Inbox

- WhatsApp-Nachrichten haben Icon 💬
- Sonst wie normale InboxNotes

## Flow Schritte

### Einrichtung

1. Nutzer öffnet Settings → WhatsApp
2. Nutzer gibt Telefonnummer ein
3. System sendet SMS mit Verifikations-Code
4. Nutzer gibt Code ein
5. System verifiziert Code
6. System erstellt WhatsAppConnection
7. System zeigt Bot-Nummer
8. Nutzer speichert Bot-Nummer in Kontakten (optional)

### Nachricht empfangen

1. Nutzer schickt WhatsApp an Bot-Nummer
2. System empfängt Webhook (Backend)
3. System erstellt InboxNote:
   - `raw_text` = Nachricht
   - `source` = `whatsapp`
   - `metadata` = WhatsApp-Daten
4. Wenn Auto-Extraktion an:
   - System startet Extraktion
   - System speichert Items
5. System sendet optional Bestätigung zurück:
   - "Notiert ✓" oder
   - "1 Aufgabe, 1 Termin gespeichert ✓"

### Im App-Flow

- Neue InboxNotes erscheinen automatisch in Liste
- Badge-Count updated
- Push Notification (optional)

## Regeln

### Einrichtung

- Eine Telefonnummer pro Account
- Verifizierungs-Code gültig für 10 Minuten
- Max 3 Versuche für Code-Eingabe
- SMS-Sprache: Deutsch

### Nachrichtenverarbeitung

- Nur Text-Nachrichten
- Max 2000 Zeichen (WhatsApp-Limit)
- Medien werden ignoriert mit Hinweis
- Emojis erlaubt

### Auto-Extraktion

- Default: AN
- Wenn an: Extraktion sofort nach Ingest
- Wenn aus: Nur InboxNote erstellen
- Bei Extraktions-Fehler: InboxNote bleibt, Fehler loggen

### Bestätigungs-Nachricht

- Default: AN
- Wenn niedrige Confidence: "Notiert, aber bitte nochmal prüfen"
- Wenn Extraktion fehlschlägt: "Notiert, aber konnte nicht verarbeiten"
- Wenn erfolgreich: "X Aufgaben gespeichert ✓"

### Rate Limiting

- Max 50 Nachrichten pro Tag
- Bei Überschreitung: Nachricht "Limit erreicht, morgen weiter"
- Schützt vor Spam und API-Kosten

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Nachricht nur Emoji | InboxNote erstellen, Extraktion liefert wahrscheinlich Idea |
| Sehr lange Nachricht | Abschneiden bei 2000 Zeichen, Hinweis senden |
| Bild oder Voice | Ignorieren, Hinweis: "Nur Text-Nachrichten" |
| Mehrere Nachrichten schnell | Jede als separate InboxNote |
| Webhook-Fehler | Retry 3×, dann loggen und verwerfen |
| Nutzer löscht Chat | InboxNotes bleiben in App |
| Bot-Nummer blockiert | Status `inactive`, Nutzer informieren |

## Akzeptanzkriterien

- [ ] Nutzer kann Telefonnummer verbinden
- [ ] Verifizierungs-Code funktioniert
- [ ] Nachrichten werden als InboxNotes gespeichert
- [ ] Source `whatsapp` ist gesetzt
- [ ] Auto-Extraktion funktioniert wenn aktiviert
- [ ] Bestätigungs-Nachricht wird gesendet
- [ ] Rate Limit schützt vor Spam
- [ ] Medien werden ignoriert mit Hinweis
- [ ] Push Notification bei neuer Nachricht (optional)

## Telemetrie Events

### whatsapp_connected

**Wann**: WhatsApp erfolgreich verbunden

**Properties**:
- `phone_number_country`: String (DE, AT, CH, etc.)

### whatsapp_message_received

**Wann**: Nachricht von WhatsApp empfangen

**Properties**:
- `message_length`: Integer
- `auto_extraction_enabled`: Boolean

### whatsapp_message_processed

**Wann**: Nachricht erfolgreich verarbeitet

**Properties**:
- `extracted_items`: Integer
- `processing_time_ms`: Integer
- `confirmation_sent`: Boolean

### whatsapp_message_failed

**Wann**: Verarbeitung fehlgeschlagen

**Properties**:
- `error_type`: String (media, too_long, extraction_error)

### whatsapp_rate_limit_hit

**Wann**: Tages-Limit erreicht

**Properties**:
- `messages_today`: Integer
