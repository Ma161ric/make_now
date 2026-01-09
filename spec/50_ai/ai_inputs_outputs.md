# AI Inputs and Outputs

## Übersicht

Definiert den Vertrag zwischen App und KI-Service. Die KI ist ein Black Box Service, der JSON empfängt und JSON zurückgibt. Alle Inputs und Outputs sind strikt typisiert und validiert.

## Allgemeine Regeln

1. **JSON First**: Alle Kommunikation in JSON
2. **Schema Validation**: Jede Response wird gegen JSON Schema validiert
3. **Idempotent**: Gleicher Input → Gleicher Output
4. **Stateless**: KI hat keinen State zwischen Calls
5. **Timeout**: Max 10 Sekunden pro Request

## Extraction Service

### Purpose

Extrahiert strukturierte Items (Tasks, Events, Ideas) aus Freitext-Notiz.

### Input Schema

```json
{
  "operation": "extract",
  "input": {
    "text": "Email an Chef schreiben, Meeting um 14 Uhr, Präsentation bis Freitag",
    "context": {
      "current_date": "2026-01-09",
      "current_time": "10:00:00",
      "timezone": "Europe/Berlin",
      "user_language": "de"
    },
    "constraints": {
      "max_items": 10,
      "require_confidence": true
    }
  }
}
```

### Input Fields

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| operation | String | Ja | Immer "extract" |
| input.text | String | Ja | Freitext-Notiz, max 2000 Zeichen |
| input.context.current_date | String (ISO Date) | Ja | Heutiges Datum |
| input.context.current_time | String (HH:MM:SS) | Ja | Aktuelle Uhrzeit |
| input.context.timezone | String (IANA) | Ja | Zeitzone |
| input.context.user_language | String | Ja | "de" (nur Deutsch im MVP) |
| input.constraints.max_items | Integer | Nein | Default 10 |
| input.constraints.require_confidence | Boolean | Nein | Default true |

### Output Schema

Siehe [extraction_schema.json](extraction_schema.json).

```json
{
  "items": [
    {
      "id": "temp_uuid_1",
      "type": "task",
      "title": "Email an Chef schreiben",
      "raw_text_span": "Email an Chef schreiben",
      "parsed_fields": {
        "duration_min_minutes": 10,
        "duration_max_minutes": 20,
        "estimation_source": "ai"
      },
      "confidence": 0.9,
      "questions": []
    },
    {
      "id": "temp_uuid_2",
      "type": "event",
      "title": "Meeting",
      "raw_text_span": "Meeting um 14 Uhr",
      "parsed_fields": {
        "start_at": "2026-01-09T14:00:00+01:00",
        "end_at": "2026-01-09T15:00:00+01:00",
        "timezone": "Europe/Berlin"
      },
      "confidence": 0.95,
      "questions": []
    }
  ],
  "overall_confidence": 0.925,
  "metadata": {
    "processing_time_ms": 1234,
    "model_version": "gpt-4-2024"
  }
}
```

### Output Fields

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| items | Array | Ja | Liste extrahierter Items, 0-N |
| items[].id | String (UUID) | Ja | Temporäre ID |
| items[].type | Enum | Ja | task, event, idea |
| items[].title | String | Ja | Titel, max 200 Zeichen |
| items[].raw_text_span | String | Nein | Original-Textstelle |
| items[].parsed_fields | Object | Ja | Typ-spezifische Felder |
| items[].confidence | Float | Ja | 0.0-1.0 |
| items[].questions | Array[String] | Nein | Rückfragen bei Low Confidence |
| overall_confidence | Float | Ja | Durchschnitt aller Items |
| metadata | Object | Ja | Debug-Info |

### Parsed Fields per Type

**Task**:
```json
{
  "duration_min_minutes": 30,
  "duration_max_minutes": 60,
  "estimation_source": "ai",  // ai, parsed, default
  "due_at": "2026-01-10T23:59:59+01:00",  // optional
  "importance": "high",  // optional: low, medium, high
  "energy_type": "deep_work"  // optional
}
```

**Event**:
```json
{
  "start_at": "2026-01-09T14:00:00+01:00",  // optional
  "end_at": "2026-01-09T15:00:00+01:00",  // optional
  "time_window_start": "14:00:00",  // alternative zu start_at
  "time_window_end": "18:00:00",  // alternative zu end_at
  "timezone": "Europe/Berlin",
  "all_day": false
}
```

**Idea**:
```json
{
  "content": "Ausführlichere Beschreibung wenn vorhanden"
}
```

## Planning Service

### Purpose

Generiert Tagesplan aus verfügbaren Tasks und Constraints.

### Input Schema

```json
{
  "operation": "plan_day",
  "input": {
    "date": "2026-01-09",
    "timezone": "Europe/Berlin",
    "available_tasks": [
      {
        "id": "uuid_task_1",
        "title": "Email schreiben",
        "duration_min_minutes": 10,
        "duration_max_minutes": 20,
        "importance": "high",
        "due_at": null,
        "energy_type": "admin"
      }
    ],
    "busy_intervals": [
      {
        "start_at": "2026-01-09T14:00:00+01:00",
        "end_at": "2026-01-09T15:00:00+01:00"
      }
    ],
    "constraints": {
      "working_hours_start": "09:00:00",
      "working_hours_end": "18:00:00",
      "buffer_minutes": 15,
      "prefer_morning_focus": true
    }
  }
}
```

### Output Schema

Siehe [planning_schema.json](planning_schema.json).

```json
{
  "date": "2026-01-09",
  "timezone": "Europe/Berlin",
  "focus_task_id": "uuid_task_1",
  "mini_task_ids": ["uuid_task_2", "uuid_task_3"],
  "suggested_blocks": [
    {
      "start_at": "2026-01-09T09:00:00+01:00",
      "end_at": "2026-01-09T11:00:00+01:00",
      "block_type": "focus",
      "task_id": "uuid_task_1",
      "duration_minutes": 120
    },
    {
      "start_at": "2026-01-09T11:00:00+01:00",
      "end_at": "2026-01-09T11:15:00+01:00",
      "block_type": "buffer",
      "task_id": null,
      "duration_minutes": 15
    }
  ],
  "reasoning_brief": "Fokus auf Task 1 wegen hoher Wichtigkeit. Mini-Tasks in Nachmittagslücken.",
  "confidence": 0.85,
  "metadata": {
    "processing_time_ms": 567
  }
}
```

## Confidence Policy

Siehe [Confidence Policy](../40_rules/confidence_policy.md).

### Rückfragen

Wenn `confidence < 0.5` für ein Item:
- `items[].questions` enthält genau 1 Frage
- Frage ist spezifisch: "Wie lange dauert '[Titel]' ungefähr?"
- Keine generischen Fragen

### Maximal 1 Rückfrage

Pro Extraktion maximal 1 Item mit Rückfrage. Andere Low-Confidence Items:
- Bekommen Default-Werte
- Confidence bleibt <0.5
- User muss in Review klären

## Fallback Policy

### KI liefert leeres Array

```json
{
  "items": [],
  "overall_confidence": 0.0
}
```

**App-Verhalten**:
- Zeige Hinweis: "Konnte nichts erkennen"
- InboxNote bleibt `unprocessed`
- User kann Notiz editieren oder verwerfen

### KI liefert invalides JSON

**App-Verhalten**:
- Parsing-Fehler loggen
- Fallback: Erstelle 1 Idea mit Original-Text
- Confidence = 0.0
- InboxNote → `processed` (mit Fallback-Item)

### KI-API Timeout (>10 Sekunden)

**App-Verhalten**:
- Fehler-Snackbar: "Verarbeitung nicht möglich"
- InboxNote bleibt `unprocessed`
- Retry-Option anbieten

### KI-API Error (500, 503)

**App-Verhalten**:
- Fehler loggen
- Retry 3× mit Exponential Backoff
- Nach 3 Fehlern: User informieren
- InboxNote bleibt `unprocessed`

## Safety

### Verbotene KI-Aktionen

- Termine halluzinieren ohne Textbasis
- Personen hinzufügen die nicht im Text sind
- Wichtigkeit raten ohne Anhaltspunkte
- Deadlines erfinden

### Erlaubte Defaults

- Default-Dauer aus [Default Durations](../40_rules/default_durations.md)
- Zeitzone = Europe/Berlin
- Heute als Default-Datum wenn impliziert

### Kritische Felder

Folgende Felder NUR setzen wenn im Text:
- `start_at`, `end_at`
- `due_at`
- `time_window_*`

## Validation

Jede KI-Response wird validiert:

```python
def validate_extraction_response(response):
    # Schema Validation
    validate_json_schema(response, extraction_schema)
    
    # Business Rules
    for item in response["items"]:
        assert 0.0 <= item["confidence"] <= 1.0
        assert len(item["title"]) <= 200
        
        if item["type"] == "task":
            assert item["parsed_fields"]["duration_min_minutes"] > 0
            assert item["parsed_fields"]["duration_max_minutes"] >= item["parsed_fields"]["duration_min_minutes"]
        
        if item["type"] == "event":
            if "start_at" in item["parsed_fields"] and "end_at" in item["parsed_fields"]:
                assert item["parsed_fields"]["end_at"] > item["parsed_fields"]["start_at"]
    
    # Max 1 Question
    items_with_questions = [i for i in response["items"] if i.get("questions")]
    assert len(items_with_questions) <= 1
    
    return True
```

## Error Responses

KI kann Fehler zurückgeben:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Text too long (max 2000 characters)",
    "details": {}
  }
}
```

**Error Codes**:
- `INVALID_INPUT`: Input nicht valide
- `PROCESSING_ERROR`: Interner Fehler
- `RATE_LIMIT`: Zu viele Requests

## Testing

Mock-Responses für Tests:
- Happy Path: 3 Items, alle High Confidence
- Low Confidence: 1 Item mit Rückfrage
- Empty: 0 Items
- Mixed: Task + Event + Idea
- Invalid: Malformed JSON
- Timeout: Keine Response in 10s
