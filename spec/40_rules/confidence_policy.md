# Confidence Policy

## Übersicht

Regeln, wann die KI Rückfragen stellt, wie viele, in welcher Form, und was bei niedriger Confidence passiert. Ziel: Balance zwischen Automatisierung und Kontrolle.

## Confidence Levels

### High Confidence: 0.8 - 1.0

**Bedeutung**: KI ist sehr sicher

**Verhalten**:
- Keine Rückfragen
- Grünes Badge 🟢 in UI
- Auto-Suggestion wird angezeigt
- User kann ohne Review bestätigen

**Beispiele**:
- "Meeting um 14 Uhr" → Event mit start_at=14:00, Confidence=0.95
- "Email schreiben 10min" → Task mit duration=10min, Confidence=1.0 (explizit)

### Medium Confidence: 0.5 - 0.8

**Bedeutung**: KI ist unsicher, aber hat eine Vermutung

**Verhalten**:
- Keine Rückfragen
- Gelbes Badge 🟡 in UI
- Subtiler Hinweis: "Bitte prüfen"
- User sollte reviewen, kann aber überspringen

**Beispiele**:
- "Präsentation vorbereiten" → Task, duration=60-120min, Confidence=0.6
- "Termin nachmittags" → Event mit time_window 14:00-18:00, Confidence=0.6

### Low Confidence: 0.0 - 0.5

**Bedeutung**: KI weiß es nicht sicher

**Verhalten**:
- **Genau 1 Rückfrage** (max)
- Rotes Badge 🔴 in UI
- Gelbes Banner mit Frage
- User MUSS antworten oder Item ablehnen

**Beispiele**:
- "Sache machen" → Task, aber unklar was und wie lange, Confidence=0.3
- Frage: "Wie lange dauert 'Sache machen' ungefähr?"

## Rückfragen-Regeln

### Maximale Anzahl

- **Pro Extraktion**: Maximal 1 Rückfrage
- **Nie**: Mehrere Fragen auf einmal
- **Nie**: Rückfragen bei Confidence ≥0.5

### Rückfrage-Typ

**Dauer unklar**:
- Frage: "Wie lange dauert '[Task-Titel]' ungefähr?"
- Quick-Buttons: 15min, 30min, 1h, 2h
- Custom Input-Feld

**Zeitpunkt unklar**:
- Frage: "Wann findet '[Event-Titel]' statt?"
- Quick-Buttons: Heute 14:00, Heute 16:00, Morgen 10:00
- Custom Date-Time Picker

**Typ unklar** (Task vs. Event vs. Idea):
- Frage: "Was genau ist '[Titel]'?"
- Quick-Buttons: Aufgabe, Termin, Nur Notiz

### Rückfrage-Priorität

Wenn mehrere Items Low Confidence haben:
1. Frage nur zum wichtigsten / ersten Item
2. Andere Items: Status `tentative`, User muss in Review klären
3. Begründung: Nicht überfordern

### Rückfrage-Format

Immer:
- Spezifisch, nicht generisch
- Mit Kontext (Task-Titel in Frage)
- Mit Quick-Buttons für häufige Antworten
- Mit Custom-Option für Edge Cases

Verboten:
- "Alles klar?"
- "Mehr Details?"
- Offene Fragen ohne Kontext

## Confidence Berechnung

### Faktoren

| Faktor | Gewicht | Beschreibung |
|--------|---------|--------------|
| Keyword Match | 0.3 | Klares Keyword erkannt (z.B. "Meeting") |
| Explizite Angabe | 0.4 | Zeit/Datum explizit im Text |
| Kontext-Klarheit | 0.2 | Satz ist grammatisch klar |
| Ambiguität | -0.3 | Widersprüchliche Angaben |

### Formel

```
Confidence = (
    keyword_match_score * 0.3 +
    explicit_value_score * 0.4 +
    context_clarity_score * 0.2 -
    ambiguity_penalty * 0.3
)
```

Clamp auf [0.0, 1.0].

### Beispiele

**"Meeting um 14 Uhr"**:
- keyword_match: 1.0 (Meeting)
- explicit_value: 1.0 (14 Uhr)
- context_clarity: 0.9 (klar)
- ambiguity: 0.0
- **Confidence**: (1.0×0.3 + 1.0×0.4 + 0.9×0.2 - 0) = 0.88 → High

**"Email schreiben"**:
- keyword_match: 1.0 (Email)
- explicit_value: 0.0 (keine Zeit)
- context_clarity: 1.0
- ambiguity: 0.0
- **Confidence**: (1.0×0.3 + 0.0×0.4 + 1.0×0.2 - 0) = 0.5 → Medium

**"Sache erledigen irgendwann"**:
- keyword_match: 0.0 (kein klares Wort)
- explicit_value: 0.0
- context_clarity: 0.3 (vage)
- ambiguity: 0.2 (irgendwann = unklar)
- **Confidence**: (0.0×0.3 + 0.0×0.4 + 0.3×0.2 - 0.2×0.3) = 0.0 → Low

## Fallback-Strategie

### Bei Confidence < 0.5

**Option A: Rückfrage** (bevorzugt für Tasks/Events):
- Zeige Rückfrage
- Warte auf User-Antwort
- Update Item mit Antwort
- Confidence → 1.0

**Option B: Tentative Item** (für Ideas):
- Erstelle Item mit Status `tentative`
- User kann in Review anpassen oder verwerfen
- Kein Block für Workflow

### Bei keiner Antwort

Wenn User Rückfrage ignoriert:
- Item bleibt `tentative`
- Wird in Review angezeigt
- User muss dort entscheiden

### Bei Parsing-Fehler

Wenn KI invalides JSON liefert:
- Erstelle 1 Idea mit kompletter Original-Notiz
- Status `active`
- Confidence = 0.0
- Logging für Debug

## Safety Rules

### Verbotene Annahmen

KI darf NICHT:
- Termine halluzinieren ("vermutlich Dienstag")
- Personen hinzufügen die nicht genannt sind
- Wichtigkeit schätzen ohne Anhaltspunkte
- Deadlines erfinden

### Erlaubte Defaults

KI darf:
- Default-Dauer setzen (mit niedriger Confidence)
- Zeitzone annehmen (Europe/Berlin)
- Heute als Default-Datum (wenn "heute" impliziert)

### Kritische Felder

Felder die NICHT halluziniert werden dürfen:
- `start_at`, `end_at` (Events)
- `due_at` (Tasks)
- `calendar_id` (immer null bei Extraktion)

## Nutzer-Feedback

### Annahme-Korrektur

Wenn User KI-Vorschlag korrigiert:
- Logging für späteres Learning (V2)
- Keine sofortige Anpassung (MVP)
- Confidence bleibt für dieses Item

### Konsistente Ablehnungen

Wenn User mehrfach gleichen Vorschlag ablehnt (V2):
- Pattern erkennen
- Confidence für ähnliche Tasks senken
- Mehr Rückfragen

## Testing

Für jede Confidence-Schwelle muss getestet werden:
- [ ] High Confidence Items haben kein Badge
- [ ] Medium Confidence Items haben gelbes Badge
- [ ] Low Confidence Items haben rotes Badge
- [ ] Rückfrage erscheint bei Confidence <0.5
- [ ] Maximal 1 Rückfrage pro Extraktion
- [ ] Rückfrage ist spezifisch und hilfreich
- [ ] Quick-Buttons decken häufige Antworten ab
- [ ] Antwort updated Confidence zu 1.0
- [ ] Keine Halluzinationen bei kritischen Feldern
