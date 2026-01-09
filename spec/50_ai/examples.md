# AI Examples

## Übersicht

Mindestens 20 Beispiele für KI-Extraktion und Planning. Deckt Happy Path, Edge Cases, Low Confidence, mehrdeutige Eingaben und typische WhatsApp-Nachrichten ab.

## Extraktion Examples

### Example 1: Mehrfach-Tasks in einer Notiz

**Input**:
```
"Email an Chef schreiben, Präsentation vorbereiten, Termin beim Zahnarzt buchen"
```

**Context**:
```json
{
  "current_date": "2026-01-09",
  "current_time": "10:00:00",
  "timezone": "Europe/Berlin"
}
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Email an Chef schreiben",
      "parsed_fields": {
        "duration_min_minutes": 5,
        "duration_max_minutes": 15,
        "estimation_source": "ai"
      },
      "confidence": 0.85
    },
    {
      "type": "task",
      "title": "Präsentation vorbereiten",
      "parsed_fields": {
        "duration_min_minutes": 60,
        "duration_max_minutes": 120,
        "estimation_source": "ai"
      },
      "confidence": 0.7
    },
    {
      "type": "task",
      "title": "Termin beim Zahnarzt buchen",
      "parsed_fields": {
        "duration_min_minutes": 5,
        "duration_max_minutes": 10,
        "estimation_source": "ai"
      },
      "confidence": 0.8
    }
  ]
}
```

---

### Example 2: Event mit genauer Uhrzeit

**Input**:
```
"Meeting mit Team heute um 14:30 Uhr"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "event",
      "title": "Meeting mit Team",
      "parsed_fields": {
        "start_at": "2026-01-09T14:30:00+01:00",
        "end_at": "2026-01-09T15:30:00+01:00",
        "timezone": "Europe/Berlin",
        "all_day": false
      },
      "confidence": 0.95
    }
  ]
}
```

---

### Example 3: Event mit unscharf Zeit

**Input**:
```
"Arzttermin morgen nachmittags"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "event",
      "title": "Arzttermin",
      "parsed_fields": {
        "time_window_start": "14:00:00",
        "time_window_end": "18:00:00",
        "timezone": "Europe/Berlin",
        "all_day": false
      },
      "confidence": 0.6,
      "questions": ["Wann genau findet 'Arzttermin' statt?"]
    }
  ]
}
```

---

### Example 4: Task ohne Datum, nur Aufgabe

**Input**:
```
"Code Review für PR #123"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Code Review für PR #123",
      "parsed_fields": {
        "duration_min_minutes": 20,
        "duration_max_minutes": 40,
        "estimation_source": "ai",
        "energy_type": "deep_work"
      },
      "confidence": 0.75
    }
  ]
}
```

---

### Example 5: Explizite Dauer im Text

**Input**:
```
"Meeting Vorbereitung 1 Stunde"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Meeting Vorbereitung",
      "parsed_fields": {
        "duration_min_minutes": 60,
        "duration_max_minutes": 72,
        "estimation_source": "parsed"
      },
      "confidence": 1.0
    }
  ]
}
```

---

### Example 6: Keine Dauer im Text, Default

**Input**:
```
"Projekt XY vorantreiben"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Projekt XY vorantreiben",
      "parsed_fields": {
        "duration_min_minutes": 30,
        "duration_max_minutes": 60,
        "estimation_source": "default"
      },
      "confidence": 0.5
    }
  ]
}
```

---

### Example 7: Low Confidence mit Rückfrage

**Input**:
```
"Sache für Klaus erledigen"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Sache für Klaus erledigen",
      "parsed_fields": {
        "duration_min_minutes": 30,
        "duration_max_minutes": 60,
        "estimation_source": "default"
      },
      "confidence": 0.3,
      "questions": ["Wie lange dauert 'Sache für Klaus erledigen' ungefähr?"]
    }
  ]
}
```

---

### Example 8: Umgangssprache

**Input**:
```
"muss noch schnell email tippen und dann raus"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Email tippen",
      "parsed_fields": {
        "duration_min_minutes": 5,
        "duration_max_minutes": 10,
        "estimation_source": "ai"
      },
      "confidence": 0.8
    }
  ]
}
```

---

### Example 9: WhatsApp kurz

**Input**:
```
"gleich meeting 15 uhr"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "event",
      "title": "Meeting",
      "parsed_fields": {
        "start_at": "2026-01-09T15:00:00+01:00",
        "end_at": "2026-01-09T16:00:00+01:00",
        "timezone": "Europe/Berlin",
        "all_day": false
      },
      "confidence": 0.9
    }
  ]
}
```

---

### Example 10: Deadline

**Input**:
```
"Präsentation bis Freitag fertig machen"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Präsentation fertig machen",
      "parsed_fields": {
        "duration_min_minutes": 60,
        "duration_max_minutes": 120,
        "estimation_source": "ai",
        "due_at": "2026-01-10T23:59:59+01:00",
        "importance": "high"
      },
      "confidence": 0.85
    }
  ]
}
```

---

### Example 11: Leere Nachricht

**Input**:
```
""
```

**Expected Extraction**:
```json
{
  "items": [],
  "overall_confidence": 0.0
}
```

---

### Example 12: Nur Emoji

**Input**:
```
"🎉"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "idea",
      "title": "🎉",
      "parsed_fields": {},
      "confidence": 0.5
    }
  ]
}
```

---

### Example 13: Nur Fragezeichen

**Input**:
```
"???"
```

**Expected Extraction**:
```json
{
  "items": [],
  "overall_confidence": 0.0
}
```

---

### Example 14: Relative Zeitangabe "morgen"

**Input**:
```
"morgen Bericht abgeben"
```

**Context**: current_date = 2026-01-09

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Bericht abgeben",
      "parsed_fields": {
        "duration_min_minutes": 10,
        "duration_max_minutes": 20,
        "estimation_source": "ai",
        "due_at": "2026-01-10T23:59:59+01:00"
      },
      "confidence": 0.85
    }
  ]
}
```

---

### Example 15: Relative "nächste Woche"

**Input**:
```
"nächste Woche Team Meeting"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "event",
      "title": "Team Meeting",
      "parsed_fields": {
        "time_window_start": "09:00:00",
        "time_window_end": "17:00:00",
        "timezone": "Europe/Berlin",
        "all_day": false
      },
      "confidence": 0.5,
      "questions": ["Wann genau findet 'Team Meeting' statt?"]
    }
  ]
}
```

---

### Example 16: Mehrere Events

**Input**:
```
"Meeting um 10, Lunch um 12:30, Call um 16 Uhr"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "event",
      "title": "Meeting",
      "parsed_fields": {
        "start_at": "2026-01-09T10:00:00+01:00",
        "end_at": "2026-01-09T11:00:00+01:00",
        "timezone": "Europe/Berlin"
      },
      "confidence": 0.9
    },
    {
      "type": "event",
      "title": "Lunch",
      "parsed_fields": {
        "start_at": "2026-01-09T12:30:00+01:00",
        "end_at": "2026-01-09T13:30:00+01:00",
        "timezone": "Europe/Berlin"
      },
      "confidence": 0.9
    },
    {
      "type": "event",
      "title": "Call",
      "parsed_fields": {
        "start_at": "2026-01-09T16:00:00+01:00",
        "end_at": "2026-01-09T16:30:00+01:00",
        "timezone": "Europe/Berlin"
      },
      "confidence": 0.9
    }
  ]
}
```

---

### Example 17: Task mit Importance

**Input**:
```
"wichtig: Budget Plan erstellen"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Budget Plan erstellen",
      "parsed_fields": {
        "duration_min_minutes": 45,
        "duration_max_minutes": 90,
        "estimation_source": "ai",
        "importance": "high"
      },
      "confidence": 0.8
    }
  ]
}
```

---

### Example 18: Idea statt Task

**Input**:
```
"vielleicht mal ein Buch schreiben"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "idea",
      "title": "Buch schreiben",
      "parsed_fields": {
        "content": "vielleicht mal ein Buch schreiben"
      },
      "confidence": 0.7
    }
  ]
}
```

---

### Example 19: Sehr lange Notiz

**Input**:
```
"Heute muss ich noch die Präsentation für das Meeting morgen fertig machen, dann Email an den Chef schreiben wegen Budget, und danach Termin beim Arzt um 16 Uhr nicht vergessen"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "task",
      "title": "Präsentation fertig machen",
      "parsed_fields": {
        "duration_min_minutes": 60,
        "duration_max_minutes": 120,
        "estimation_source": "ai",
        "due_at": "2026-01-10T23:59:59+01:00"
      },
      "confidence": 0.8
    },
    {
      "type": "task",
      "title": "Email an Chef wegen Budget",
      "parsed_fields": {
        "duration_min_minutes": 10,
        "duration_max_minutes": 20,
        "estimation_source": "ai"
      },
      "confidence": 0.85
    },
    {
      "type": "event",
      "title": "Termin beim Arzt",
      "parsed_fields": {
        "start_at": "2026-01-09T16:00:00+01:00",
        "end_at": "2026-01-09T16:30:00+01:00",
        "timezone": "Europe/Berlin"
      },
      "confidence": 0.9
    }
  ]
}
```

---

### Example 20: Widersprüchliche Angaben

**Input**:
```
"Meeting um 14 Uhr, nein lieber um 15 Uhr"
```

**Expected Extraction**:
```json
{
  "items": [
    {
      "type": "event",
      "title": "Meeting",
      "parsed_fields": {
        "start_at": "2026-01-09T15:00:00+01:00",
        "end_at": "2026-01-09T16:00:00+01:00",
        "timezone": "Europe/Berlin"
      },
      "confidence": 0.6,
      "questions": ["Wann genau findet 'Meeting' statt? 14 oder 15 Uhr?"]
    }
  ]
}
```

---

## Planning Examples

### Planning Example 1: Standard Tag

**Input Tasks**:
- Task 1: "Präsentation" (60-120min, importance=high, deep_work)
- Task 2: "Email" (5-15min, importance=medium, admin)
- Task 3: "Anruf" (10-20min, importance=low, admin)

**Busy Intervals**: []

**Working Hours**: 9:00-18:00

**Expected Plan**:
```json
{
  "focus_task_id": "task_1",
  "mini_task_ids": ["task_2", "task_3"],
  "suggested_blocks": [
    {
      "start_at": "2026-01-09T09:00:00+01:00",
      "end_at": "2026-01-09T11:00:00+01:00",
      "block_type": "focus",
      "task_id": "task_1",
      "duration_minutes": 120
    },
    {
      "start_at": "2026-01-09T11:00:00+01:00",
      "end_at": "2026-01-09T11:15:00+01:00",
      "block_type": "buffer",
      "task_id": null,
      "duration_minutes": 15
    },
    {
      "start_at": "2026-01-09T11:15:00+01:00",
      "end_at": "2026-01-09T11:25:00+01:00",
      "block_type": "mini",
      "task_id": "task_2",
      "duration_minutes": 10
    },
    {
      "start_at": "2026-01-09T11:25:00+01:00",
      "end_at": "2026-01-09T11:40:00+01:00",
      "block_type": "buffer",
      "task_id": null,
      "duration_minutes": 15
    },
    {
      "start_at": "2026-01-09T11:40:00+01:00",
      "end_at": "2026-01-09T11:55:00+01:00",
      "block_type": "mini",
      "task_id": "task_3",
      "duration_minutes": 15
    }
  ],
  "reasoning_brief": "Fokus auf Präsentation wegen hoher Wichtigkeit. Mini-Aufgaben im Anschluss.",
  "confidence": 0.9
}
```

---

## Validation

Jedes Beispiel muss validieren gegen:
- [ ] Input-Schema
- [ ] Output-Schema
- [ ] Business Rules (duration_min < duration_max, etc.)
- [ ] Confidence Ranges
- [ ] Max 1 Question per Extraction
