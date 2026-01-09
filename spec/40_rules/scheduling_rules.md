# Scheduling Rules

## Übersicht

Deterministisches Regelwerk für die Generierung von Tagesplänen. Diese Regeln müssen auch ohne KI funktionieren. Die KI darf Vorschläge machen, aber die Engine setzt die Regeln durch.

## Grundprinzipien

1. **Realistic über Optimistic**: Lieber weniger planen, als zu viel
2. **Quality über Quantity**: 1 gut erledigte Aufgabe > 5 angefangene
3. **Buffer is King**: Immer Puffer einplanen für Unerwartetes
4. **Deep Work Protection**: Fokus-Zeit ist heilig, keine Unterbrechungen

## Tagesstruktur

### 1 Fokus-Aufgabe

- **Dauer**: 60-120 Minuten (Mittelwert des duration-Bereichs)
- **Anzahl**: Genau 1 pro Tag
- **Zeitfenster**: Bevorzugt vormittags (9:00-12:00)
- **Eigenschaften**:
  - `energy_type` = `deep_work` bevorzugt
  - `importance` = `high` bevorzugt
  - Überfällige Tasks (`due_at` < today) haben Vorrang

### 2 Mini-Aufgaben

- **Dauer**: 5-20 Minuten (Mittelwert)
- **Anzahl**: Genau 2 pro Tag (wenn verfügbar)
- **Zeitfenster**: Flexible Platzierung
- **Eigenschaften**:
  - `energy_type` = `admin` bevorzugt
  - Schnelle Wins für Motivation
  - Passen in kleine Lücken

### Puffer

- **Default**: 15 Minuten nach jedem Block
- **User-einstellbar**: 10, 15, 30 Minuten
- **Minimum**: 1 Puffer pro Tag
- **Platzierung**: Nach Fokus-Block, nach jedem Mini-Block

## Auswahlalgorithmus

### Step 1: Kandidaten sammeln

```
SELECT * FROM tasks
WHERE status = 'open'
ORDER BY
  CASE WHEN due_at < CURRENT_DATE THEN 0 ELSE 1 END,  -- Überfällig zuerst
  importance DESC,                                      -- Dann Wichtigkeit
  created_at ASC                                       -- Dann Alter
LIMIT 20
```

### Step 2: Fokus-Aufgabe wählen

**Kriterien (Priorität absteigend)**:

1. Überfällig UND duration_avg 60-120min
2. Importance `high` UND duration_avg 60-120min
3. energy_type `deep_work` UND duration_avg 60-120min
4. Längste verfügbare Task (wenn 60-120min)
5. Erste Task mit duration_avg <60min (als Ersatz, mit Warnung)

**Rejection Rules**:
- Task >120min → Zu lang, aufteilen vorschlagen
- Task <30min → Nicht als Fokus geeignet
- Keine passende → Plan ohne Fokus (nur Minis)

### Step 3: Mini-Aufgaben wählen

**Kriterien**:

1. duration_avg 5-20min
2. importance `medium` oder `low` (nicht hoch, die kommen in Fokus)
3. energy_type `admin` bevorzugt
4. Zwei verschiedene Arten (Diversität)

**Rejection Rules**:
- Nur 1 verfügbar → Nur 1 Mini
- Keine verfügbar → Plan ohne Minis

### Step 4: Zeit-Allokation

**Ohne Kalender (MVP Default)**:

1. Nutzer gibt Working Hours an (Settings): Default 9:00-18:00
2. Verfügbare Zeit = Working Hours - User Events
3. Berechne Gesamtzeit: Fokus + 2×Mini + 3×Puffer
4. Wenn Gesamtzeit > verfügbare Zeit → Reduziere (siehe Fallback)

**Mit Kalender (V1)**:

1. Lade BusyIntervals für heute
2. Berechne FreeSlots
3. Finde Slot ≥90min für Fokus
4. Finde Slots ≥10min für Minis
5. Platziere Tasks in Slots

### Step 5: Zeitvorschläge generieren

**Ohne Kalender**:
- Keine konkreten Zeiten
- Nur Liste: Fokus, Mini1, Mini2
- Reihenfolge: Fokus zuerst

**Mit Kalender**:
- Fokus: Erste Slot ≥90min am Vormittag
- Mini1: Nach Fokus + Puffer
- Mini2: Nächster Slot ≥10min
- Puffer zwischen allen

## Konfliktauflösung

### Zu wenig Zeit

**Problem**: Gesamtzeit > verfügbare Zeit

**Lösung**:
1. Reduziere Puffer auf 10min
2. Entferne 1 Mini
3. Entferne beide Minis
4. Reduziere Fokus auf 60min
5. Plan B: Vorschlag für morgen

### Keine passende Fokus-Aufgabe

**Problem**: Alle Tasks <60min oder >120min

**Lösung**:
- Option A: Wähle längste verfügbare (<60min) mit Hinweis "Kurze Fokus-Zeit heute"
- Option B: Plan ohne Fokus, nur 3-4 Minis

### Kalender komplett voll

**Problem**: Keine FreeSlots ≥10min

**Lösung**:
- Zeige Hinweis: "Heute kein Platz für neue Tasks"
- Generiere keinen Plan
- Biete "Morgen planen" an

## Deep Work Rules

### Mindest-Slot für Fokus

- Slot muss ≥90min sein (60min Task + 15min Puffer + 15min Anlauf)
- Slot darf KEINE Events enthalten
- Slot sollte vormittags sein (Energie-Level)

### Keine Fokus-Arbeit in Lücken

- Lücken <90min → Nur Minis oder Puffer
- Keine Fokus-Aufgabe zwischen zwei Meetings
- Ausnahme: Nutzer forciert manuell

## Puffer-Strategie

### Puffer-Zwecke

1. **Context Switching**: Wechsel zwischen Aufgaben
2. **Unerwartetes**: Anrufe, Fragen, Toilette
3. **Überlauf**: Task dauert länger als gedacht

### Puffer-Platzierung

- Nach jedem Fokus-Block: 15min (Default)
- Nach jedem Mini-Block: 15min (Default)
- Nicht vor erstem Block
- Nicht nach letztem Block (Feierabend)

### Puffer anpassen

User kann in Settings wählen:
- 10min (straff)
- 15min (Standard)
- 30min (entspannt)

## Wichtigkeit und Dringlichkeit

### Matrix

| | Dringend (due_at < 3 Tage) | Nicht dringend |
|-|----------------------------|----------------|
| **Wichtig** (`importance=high`) | Fokus, sofort | Fokus, bald |
| **Nicht wichtig** (`importance=low`) | Mini, heute | Mini, später |

### Priorisierung

1. Überfällig + Wichtig → Höchste Prio, immer Fokus
2. Wichtig + Dringend → Fokus
3. Wichtig + Nicht dringend → Fokus
4. Nicht wichtig + Dringend → Mini
5. Nicht wichtig + Nicht dringend → Niedrigste Prio

## Edge Cases

### Alle Tasks >2h

- Wähle kürzeste als Fokus
- Hinweis: "Aufgabe ggf. in Teile aufteilen?"
- Plane nur 60-90min davon
- Rest bleibt offen

### Nur 1 Task verfügbar

- Diese als Fokus (wenn ≥30min)
- Keine Minis
- Viel Puffer

### >10 Tasks verfügbar

- Nutze nur Top 5 für Auswahl
- Rest bleibt backlog
- Hinweis: "X weitere Aufgaben offen"

## Algorithmus Pseudocode

```python
def generate_day_plan(date, available_tasks, busy_intervals, settings):
    # Step 1: Filter und Sortieren
    candidates = filter_and_sort_tasks(available_tasks)
    
    # Step 2: Fokus wählen
    focus_task = select_focus_task(candidates)
    
    # Step 3: Minis wählen
    mini_tasks = select_mini_tasks(candidates, exclude=[focus_task])
    
    # Step 4: Zeit berechnen
    total_time = calculate_total_time(focus_task, mini_tasks, settings.buffer)
    available_time = calculate_available_time(busy_intervals, settings.working_hours)
    
    # Step 5: Validieren
    if total_time > available_time:
        return apply_fallback_strategy(focus_task, mini_tasks, available_time)
    
    # Step 6: Zeitvorschläge
    if settings.calendar_enabled:
        blocks = schedule_with_calendar(focus_task, mini_tasks, busy_intervals)
    else:
        blocks = schedule_without_calendar(focus_task, mini_tasks)
    
    # Step 7: DayPlan erstellen
    return DayPlan(
        focus_task=focus_task,
        mini_tasks=mini_tasks,
        blocks=blocks,
        reasoning=generate_reasoning(focus_task, mini_tasks)
    )
```

## Validierung

Jeder generierte Plan muss prüfen:
- [ ] Genau 1 Fokus-Aufgabe (oder 0 wenn keine passend)
- [ ] 0-2 Mini-Aufgaben
- [ ] Gesamtzeit ≤ verfügbare Zeit
- [ ] Puffer eingeplant
- [ ] Keine Überschneidungen mit Busy Intervals
- [ ] Fokus-Block ≥90min Slot (wenn Kalender)
- [ ] Reasoning vorhanden und verständlich
