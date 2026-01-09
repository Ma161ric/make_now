# ADR 0002: AI Contract JSON-First mit Schema Validation

**Status**: Accepted  
**Date**: 2025-01-09  
**Deciders**: Engineering Team  
**Tags**: ai, architecture, schema

## Context

Die App nutzt AI (LLM) für zwei Aufgaben:
1. **Extraction**: Freitext → Tasks/Events/Ideas
2. **Planning**: Available Tasks → Day Plan

LLMs sind probabilistisch und können unvorhersehbare Outputs liefern. Wir brauchen eine robuste Integration.

### Optionen

**Option A**: Function Calling (OpenAI, Anthropic)
- ✅ Native LLM-Feature
- ✅ Strukturierte Outputs
- ❌ Vendor Lock-in (unterschiedliche APIs)
- ❌ Keine Garantie für valide JSON
- ❌ Schwer testbar (Mocking kompliziert)

**Option B**: JSON-First mit Schema Validation
- ✅ Vendor-agnostic (jeder LLM kann JSON)
- ✅ Explizite Schema-Validierung (ajv, JSON Schema)
- ✅ Testbar (Fixtures, Mocking)
- ✅ Fallback-Strategy klar definiert
- ❌ Etwas mehr Code (Parser + Validator)

**Option C**: Unstrukturierter Text + NLP
- ✅ Sehr flexibel
- ❌ Extrem schwer zu parsen
- ❌ Kein deterministisches Verhalten
- ❌ Keine Validierung möglich

## Decision

**Wir nutzen JSON-First mit Schema Validation** (Option B).

### Begründung

1. **Vendor Independence**:
   - OpenAI, Anthropic, oder EU-basiertes LLM austauschbar
   - Nur Prompt ändern, nicht Code

2. **Testability**:
   - JSON-Fixtures für Unit Tests
   - Schema-Validation separat testbar
   - Mocking einfach (returne JSON)

3. **Robustheit**:
   - Schema-Validation fängt ungültige Outputs
   - Fallback klar definiert (siehe unten)
   - Kein "hoffen dass LLM korrekt ist"

4. **Clarity**:
   - Schema = Single Source of Truth
   - Developer sieht exakt, was AI liefern muss
   - User-facing Errors klar zuordenbar

## Implementation

### Schema Files

**extraction_schema.json**:
```json
{
  "type": "object",
  "required": ["items"],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "oneOf": [
          { "$ref": "#/definitions/Task" },
          { "$ref": "#/definitions/Event" },
          { "$ref": "#/definitions/Idea" }
        ]
      }
    },
    "question": { "$ref": "#/definitions/Question" }
  },
  "definitions": {
    "Task": { ... },
    "Event": { ... },
    "Idea": { ... },
    "Question": { ... }
  }
}
```

**planning_schema.json**:
```json
{
  "type": "object",
  "required": ["focus_task_id", "reasoning"],
  "properties": {
    "focus_task_id": { "type": "string" },
    "mini_task_ids": { "type": "array", "maxItems": 2 },
    "buffer_minutes": { "type": "number", "minimum": 0 },
    "reasoning": { "type": "string" }
  }
}
```

### Validation Flow

```typescript
async function extractItems(note: string): Promise<ExtractionResult> {
  // 1. Call AI
  const aiResponse = await callLLM({
    prompt: buildExtractionPrompt(note),
    temperature: 0.3,
    max_tokens: 1000
  });
  
  // 2. Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(aiResponse);
  } catch (e) {
    return fallbackToManualMode("Invalid JSON");
  }
  
  // 3. Validate Schema
  const valid = ajv.validate(extractionSchema, parsed);
  if (!valid) {
    logSchemaErrors(ajv.errors);
    return fallbackToManualMode("Schema validation failed");
  }
  
  // 4. Return
  return parsed;
}
```

### Fallback Strategy

**Extraction Failed**:
- User sieht: "Konnte nicht verarbeiten. Bitte manuell erstellen."
- Note bleibt `unprocessed`
- User kann manuell Task erstellen

**Planning Failed**:
- User sieht: "KI nicht verfügbar. Selbst auswählen?"
- Fallback: Deterministischer Algorithmus (siehe `/spec/40_rules/scheduling_rules.md`)
- Oder: Manuelle Auswahl

## Consequences

### Positive

- ✅ Vendor-agnostic (OpenAI, Anthropic, Aleph Alpha, etc.)
- ✅ Testbar (Fixtures, Schema-Tests)
- ✅ Robust (Schema-Validation fängt Fehler)
- ✅ Debuggable (Log invalid JSON + Schema errors)
- ✅ Fallback klar definiert

### Negative

- ❌ Mehr Code (Parser + Validator + Fallback)
- ❌ LLM könnte trotzdem invalides JSON liefern (selten)
- ❌ Schema-Updates erfordern Migrations-Tests

### Mitigation

**Invalid JSON**:
- Retry 1× mit Prompt: "Your previous response was invalid JSON. Please respond ONLY with valid JSON."
- If still fails → Fallback

**Schema Evolution**:
- Versioned Schemas (v1, v2)
- Backwards-compatible changes only (add fields, don't remove)
- Test old fixtures against new schema

## Examples

### Valid Extraction

**Input**:
```
Email an Chef, Meeting 14 Uhr, Präsentation fertig
```

**Output** (AI Response):
```json
{
  "items": [
    {
      "type": "task",
      "title": "Email an Chef schreiben",
      "duration_min": 10,
      "duration_max": 15,
      "importance": "normal",
      "confidence": 0.9
    },
    {
      "type": "event",
      "title": "Meeting",
      "start_time": "14:00",
      "confidence": 0.7
    },
    {
      "type": "task",
      "title": "Präsentation fertig machen",
      "duration_min": 60,
      "duration_max": 120,
      "importance": "high",
      "confidence": 0.8
    }
  ]
}
```

**Validation**: ✅ Pass

### Invalid Extraction

**Input**:
```
Arzt
```

**Output** (AI Response):
```json
{
  "items": [
    {
      "type": "event",
      "title": "Arzt",
      "confidence": 0.4
    }
  ],
  "question": {
    "question": "Wann findet der Arzttermin statt?",
    "field": "start_time"
  }
}
```

**Validation**: ✅ Pass (event ohne start_time ist erlaubt, wenn Question vorhanden)

### Invalid JSON

**Output** (AI Response):
```
The user wants to create a task: "Email an Chef"
```

**Validation**: ❌ Fail → Fallback

## Related

- See `/spec/50_ai/ai_inputs_outputs.md` für AI Contract
- See `/spec/50_ai/extraction_schema.json` für Schema
- See `/spec/50_ai/planning_schema.json` für Schema
- See `/spec/80_quality/test_plan.md` für Schema Validation Tests

## References

- JSON Schema Spec: https://json-schema.org/
- ajv (Validator): https://ajv.js.org/
- Anthropic Docs: "Prefer structured outputs (JSON) for reliability"
- OpenAI Docs: "Function Calling is beta, use JSON mode for production"
