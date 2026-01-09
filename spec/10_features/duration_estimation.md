# Feature: Duration Estimation

## Zweck

Schätzung der benötigten Zeit für Tasks als Bereich (Minimum-Maximum) mit Confidence-Wert. Die KI analysiert den Task-Text und liefert realistische Zeitschätzungen. Der Nutzer kann die Schätzung überschreiben.

## Nutzerstory

Als Nutzer möchte ich eine realistische Zeitschätzung für meine Aufgaben erhalten, damit ich meinen Tag besser planen kann, ohne jede Dauer manuell eingeben zu müssen.

## In Scope

- KI-basierte Dauerschätzung aus Task-Titel
- Bereich angeben (min-max) statt Single-Value
- Confidence für jede Schätzung
- Default-Werte nach Task-Typ
- Manuelle Überschreibung durch Nutzer
- Anzeige der Schätzung in Review und Detail

## Out of Scope

- Lernen aus tatsächlicher Dauer (V2)
- Anpassung nach Nutzer-Profil (V2)
- Historische Analyse vergangener Tasks (V2)
- Team-Benchmarks (V3)

## Daten und Felder

### Task Duration Fields

Siehe [Task Model](../30_models/task_model.md).

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| duration_min_minutes | Integer | Nein | null | Minimale Dauer in Minuten |
| duration_max_minutes | Integer | Nein | null | Maximale Dauer in Minuten |
| estimation_source | Enum | Ja | ai | Quelle der Schätzung |
| confidence | Float | Nein | null | Confidence 0.0-1.0 |

### Estimation Source Enum

- `ai`: KI-Schätzung
- `user_override`: Nutzer hat Schätzung überschrieben
- `default`: Fallback Default-Wert angewendet
- `parsed`: Explizit aus Notiz extrahiert ("30 Minuten")

## UI Verhalten

### In Extraction Review Screen

- Jede Task Card zeigt Dauer als Badge
- Format: "15-30 Min" oder "1-2 Std"
- Confidence Badge daneben: 🟢🟡🔴
- Tap auf Badge → Quick Edit Popover

### Quick Edit Popover

- Preset Buttons: 5min, 15min, 30min, 1h, 2h
- Custom Input: Zwei Felder (Min, Max)
- Nach Änderung: `estimation_source` → `user_override`

### In Task Detail Screen

- Sektion "Geschätzte Dauer"
- Slider mit zwei Thumbs für Min-Max
- Anzeige in Minuten oder Stunden (auto-switch ab 60min)
- Label: "KI-Schätzung" oder "Deine Angabe"

### In Today Plan Screen

- Summierung: "3 Aufgaben, ca. 2-4 Stunden"
- Verwendet Mittelwert des Bereichs für Gesamtrechnung

## Flow Schritte

### Bei Extraktion

1. KI extrahiert Task mit Titel
2. KI analysiert Titel auf Dauer-Hinweise
3. Falls explizite Angabe ("30 Minuten"): `estimation_source` = `parsed`, Confidence = 1.0
4. Sonst: KI schätzt basierend auf Titel-Semantik
5. Falls Schätzung unsicher: Nutze Default-Werte
6. System setzt `duration_min_minutes`, `duration_max_minutes`, `confidence`, `estimation_source`

### Bei manueller Änderung

1. Nutzer öffnet Duration Quick Edit
2. Nutzer wählt Preset oder gibt Custom ein
3. System updated Fields
4. System setzt `estimation_source` = `user_override`
5. System setzt `confidence` = 1.0

## Regeln

### Schätzbereich

- Min muss < Max sein
- Min >= 5 Minuten
- Max <= 480 Minuten (8 Stunden)
- Default Spread: Max = Min × 1.5 (z.B. 30-45min)

### Default Duration Table

Siehe [Default Durations](../40_rules/default_durations.md).

| Task-Typ | Min | Max | Confidence |
|----------|-----|-----|------------|
| Meeting | 30 | 60 | 0.7 |
| Email schreiben | 5 | 15 | 0.8 |
| Anruf | 10 | 20 | 0.7 |
| Präsentation vorbereiten | 60 | 120 | 0.6 |
| Dokument lesen | 15 | 30 | 0.7 |
| Code Review | 20 | 40 | 0.6 |
| Unknown | 30 | 60 | 0.5 |

### KI Estimation Rules

- Bei Verben wie "vorbereiten", "erstellen": 60-120min
- Bei "schnell", "kurz": 5-15min
- Bei "Meeting", "Call": 30-60min
- Bei "Email", "Nachricht": 5-15min
- Bei unklarem Kontext: Default Unknown

### Confidence Calculation

- Explizite Angabe im Text: 1.0
- Klare Verb-Matches: 0.8
- Heuristische Schätzung: 0.6
- Fallback Default: 0.5

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Task ohne erkennbare Dauer | Default Unknown: 30-60min, Confidence 0.5 |
| Nutzer gibt nur Min an | Max = Min × 1.5 automatisch |
| Nutzer gibt Min > Max an | Swap Werte automatisch |
| Dauer > 8 Stunden | Warnung: "Aufgabe zu groß, in kleinere aufteilen?" |
| Dauer < 5 Minuten | Warnung: "Sehr kurz, wirklich?" |
| KI liefert keine Schätzung | Fallback Default Unknown |

## Akzeptanzkriterien

- [ ] Jede Task hat duration_min und duration_max
- [ ] Confidence-Wert ist gesetzt
- [ ] Explizite Dauer-Angaben im Text werden erkannt
- [ ] Default-Werte werden korrekt angewendet
- [ ] Nutzer kann Schätzung überschreiben
- [ ] Überschriebene Schätzung hat `user_override` Source
- [ ] UI zeigt Confidence visuell (Badges)
- [ ] Summen-Berechnung nutzt Mittelwerte

## Telemetrie Events

### duration_estimated

**Wann**: KI schätzt Dauer für einen Task

**Properties**:
- `task_title_length`: Integer
- `duration_min`: Integer
- `duration_max`: Integer
- `estimation_source`: String
- `confidence`: Float
- `explicit_in_text`: Boolean

### duration_overridden

**Wann**: Nutzer überschreibt KI-Schätzung

**Properties**:
- `old_duration_min`: Integer
- `old_duration_max`: Integer
- `new_duration_min`: Integer
- `new_duration_max`: Integer
- `override_method`: String (preset, custom)

### duration_warning_shown

**Wann**: System zeigt Warnung bei ungewöhnlicher Dauer

**Properties**:
- `warning_type`: String (too_long, too_short)
- `duration_minutes`: Integer
