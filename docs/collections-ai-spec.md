# Collections AI spec

## Item analysis output

```json
{
  "summary": "short summary",
  "tags": ["tag1", "tag2"],
  "contentType": "idea",
  "confidence": 0.84
}
```

## Collection analysis output

```json
{
  "themes": ["slow living", "minimalism", "cafe culture"],
  "intent": "lifestyle",
  "dominantContentTypes": ["video", "link", "note"],
  "recommendedMode": "apply",
  "suggestionTypes": ["micro_action", "place_plan", "reflection", "inspiration"],
  "confidence": 0.78
}
```

## Suggestion output

```json
{
  "type": "micro_action",
  "mode": "apply",
  "title": "Take a slow walk without headphones",
  "description": "Spend 10 minutes walking without your phone or music.",
  "reason": "Several saved items suggest interest in slow routines and mindful daily habits.",
  "estimatedEffort": "low"
}
```

## Rules
- output must always be valid JSON
- keep outputs practical and concise
- avoid generic motivational language
- suggestions must map to actual collection content