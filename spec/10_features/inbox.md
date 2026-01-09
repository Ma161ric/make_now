# Feature: Inbox

## Zweck

Die Inbox ist der zentrale Eingang für alle Notizen. Der Nutzer kann schnell und ohne Struktur alles erfassen, was ihm einfällt. Die Inbox sammelt Rohdaten, die später in strukturierte Items umgewandelt werden.

## Nutzerstory

Als Nutzer möchte ich schnell eine Notiz erfassen können, ohne über Felder, Kategorien oder Zeitangaben nachdenken zu müssen, damit ich nichts vergesse und meinen Gedankenfluss nicht unterbreche.

## In Scope

- Freitext-Eingabefeld als Hauptinteraktion
- Speichern von Rohnotizen mit Timestamp
- Liste aller Inbox-Einträge chronologisch
- Status: unverarbeitet, verarbeitet, archiviert
- Löschen von Inbox-Einträgen
- Markieren als "verarbeitet" nach erfolgreicher Extraktion

## Out of Scope

- Voice-to-Text Eingabe (V2)
- Bilder oder Anhänge (V2)
- Tags oder Kategorien beim Erfassen
- Automatisches Löschen nach X Tagen
- Suche in Inbox (V1)

## Daten und Felder

### InboxNote Model

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| id | UUID | Ja | auto | Eindeutige ID |
| raw_text | String | Ja | - | Freitext-Notiz |
| created_at | DateTime | Ja | now() | Erstellungszeitpunkt |
| status | Enum | Ja | unprocessed | Status der Verarbeitung |
| source | Enum | Ja | app_inbox | Herkunft der Notiz |
| processed_at | DateTime | Nein | null | Zeitpunkt der Verarbeitung |

### Status Enum

- `unprocessed`: Noch nicht verarbeitet
- `processed`: Erfolgreich in Items umgewandelt
- `archived`: Vom Nutzer archiviert ohne Verarbeitung

### Source Enum

- `app_inbox`: Direkt in App eingetragen
- `whatsapp`: Aus WhatsApp importiert (V1)

## UI Verhalten

### Inbox Capture Screen

- Großes Textfeld, autofokussiert beim Öffnen
- Placeholder: "Was steht an? Einfach reinschreiben..."
- Button "Hinzufügen" oder Enter-Taste speichert
- Nach Speichern: Feld leert sich, Cursor bleibt im Feld
- Snackbar Bestätigung: "Notiert ✓"

### Inbox Liste Screen

- Chronologisch, neueste oben
- Jede Notiz zeigt: Erste 60 Zeichen, Zeitstempel relativ ("vor 2 Std")
- Swipe-Actions:
  - Links: Archivieren (grau)
  - Rechts: Verarbeiten (blau)
- Tap auf Notiz: Öffnet Extraktion Review Screen
- Wenn leer: Empty State anzeigen

### Empty State

- Icon: Leerer Posteingang
- Text: "Dein Inbox ist leer. Einfach lostippen!"
- CTA Button: "Erste Notiz erfassen"

## Flow Schritte

1. Nutzer öffnet App → Inbox Capture Screen angezeigt
2. Nutzer tippt Freitext-Notiz
3. Nutzer drückt "Hinzufügen"
4. System speichert InboxNote mit Status `unprocessed`
5. System zeigt Bestätigung
6. Nutzer kann weitere Notiz eingeben oder zur Liste wechseln

## Regeln

- Minimale Länge: 3 Zeichen
- Maximale Länge: 2000 Zeichen
- Leere Notizen werden nicht gespeichert
- Nur Whitespace wird nicht gespeichert
- Duplikate sind erlaubt (keine Deduplizierung)

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Nutzer gibt nur Whitespace ein | Button "Hinzufügen" bleibt disabled |
| Nutzer gibt nur Emojis ein | Wird gespeichert, aber Extraktion liefert wahrscheinlich Idea |
| Notiz länger als 2000 Zeichen | Character Counter zeigt Limit, weitere Eingabe blockiert |
| Netzwerkfehler beim Speichern | Lokale Speicherung, Retry beim nächsten App-Start |
| App-Absturz während Eingabe | Unsaved Notiz geht verloren, kein Auto-Save |

## Akzeptanzkriterien

- [ ] Nutzer kann Freitext-Notiz in <3 Sekunden erfassen
- [ ] Notiz wird lokal gespeichert, auch offline
- [ ] Nach Speichern ist Eingabefeld sofort wieder bereit
- [ ] Inbox-Liste zeigt alle unverarbeiteten Notizen
- [ ] Status-Änderungen sind persistent
- [ ] Archivierte Notizen verschwinden aus Hauptliste
- [ ] Empty State wird bei leerer Inbox angezeigt

## Telemetrie Events

### inbox_note_created

**Wann**: Nach erfolgreichem Speichern einer neuen Inbox-Notiz

**Properties**:
- `text_length`: Integer (Länge der Notiz)
- `source`: String (app_inbox, whatsapp)
- `timestamp`: ISO8601 DateTime

### inbox_note_processed

**Wann**: Notiz wurde erfolgreich verarbeitet

**Properties**:
- `items_extracted`: Integer (Anzahl extrahierter Items)
- `time_to_process_seconds`: Integer (Zeit zwischen created und processed)

### inbox_note_archived

**Wann**: Nutzer archiviert Notiz manuell

**Properties**:
- `age_minutes`: Integer (Alter der Notiz in Minuten)

### inbox_opened

**Wann**: Inbox Liste Screen wird geöffnet

**Properties**:
- `unprocessed_count`: Integer
