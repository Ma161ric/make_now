# ADR 0003: Keine Secrets im Client

**Status**: Accepted  
**Date**: 2026-01-09  
**Deciders**: Security Team, Engineering Team  
**Tags**: security, secrets, api-keys

## Context

Die App benötigt Zugriff auf externe Services (KI, Kalender, WhatsApp) über APIs. Diese APIs erfordern Authentication via API Keys oder OAuth.

### Problem

**Option A**: API Keys im Frontend speichern (localStorage, Bundle)
- ✅ Einfache Implementation
- ✅ Kein Backend nötig
- ❌ **Keys sind öffentlich sichtbar** (Browser DevTools, Bundle-Analyse)
- ❌ **Key-Missbrauch durch Dritte** (unbegrenzte Kosten)
- ❌ **Keine Rate Limiting**
- ❌ **Keine Revocation** (Key-Leak → alle User betroffen)

**Option B**: Keys nur im Backend, Frontend ruft Proxy auf
- ✅ Keys sind sicher
- ✅ Rate Limiting möglich
- ✅ Revocation/Rotation einfach
- ✅ User-spezifische Policies
- ❌ Backend nötig (MVP-Scope-Erweiterung)

### Real-World Beispiel

**Szenario**: OpenAI API Key im Frontend

1. User öffnet App
2. DevTools → Application → LocalStorage → `OPENAI_API_KEY=sk-xyz`
3. Angreifer kopiert Key
4. Angreifer macht 10.000 Requests → $500 Kosten
5. Kein Rate Limiting → Kosten explodieren

**Konsequenz**: 
- Finanzieller Schaden
- Service-Unterbrechung (OpenAI blockiert Key)
- Privacy-Verletzung (Angreifer sieht alle Requests)

## Decision

**Wir verbieten API Keys und Secrets im Client-Code.**

**Harte Regel**: 
- Keine API Keys im Frontend-Bundle
- Keine Secrets in localStorage
- Keine OAuth Client Secrets im Client

**Erlaubt** (mit Einschränkungen):
- Public API Keys mit Domain-Restriction (z.B. Google Maps)
- Short-Lived OAuth Access Tokens (<1h)

**Konsequenz für MVP**:
- Kein Live-KI-Service (Mock-Daten oder deterministischer Fallback)
- V2: Backend-Proxy für KI-Calls

## Implementation

### MVP (kein Backend)

**KI-Extraction**: 
- **Option 1**: Mock-Daten für Demo
- **Option 2**: Deterministischer Parser (Regex-basiert, kein LLM)
- **Option 3**: User muss Tasks manuell erstellen

**Chosen**: Option 2 (Deterministischer Parser)

**Beispiel**:
```typescript
// Deterministischer Fallback (kein LLM)
function extractItems(noteText: string): ExtractionResult {
  const items: Item[] = [];
  
  // Einfache Heuristiken
  if (noteText.includes("Email")) {
    items.push({
      type: "task",
      title: noteText,
      duration_min: 10,
      duration_max: 15
    });
  }
  
  return { items, confidence: 0.5 };
}
```

### V2 (Backend-Proxy)

**Architecture**:
```
Client → POST /api/extract → Backend (with API Key) → OpenAI
                                    ↓
                            Validate + Return
                                    ↓
Client ← JSON Response
```

**Backend** (Node.js):
```typescript
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Server-side only!
});

app.post("/api/extract", async (req, res) => {
  const { note_text } = req.body;
  
  // Rate Limiting
  if (!checkRateLimit(req.user.id)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  
  // Call OpenAI (Server-side API Key)
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: buildPrompt(note_text) }]
  });
  
  res.json(JSON.parse(response.choices[0].message.content));
});
```

**Client** (React):
```typescript
async function extractItems(noteText: string): Promise<ExtractionResult> {
  // Client hat KEINEN Zugriff auf API Key
  const response = await fetch("/api/extract", {
    method: "POST",
    body: JSON.stringify({ note_text: noteText })
  });
  
  return response.json();
}
```

## Consequences

### Positive

- ✅ Maximale Sicherheit (Keys niemals exponiert)
- ✅ Rate Limiting möglich (User-spezifisch)
- ✅ Kosten-Kontrolle (Backend kann Limits setzen)
- ✅ Revocation einfach (Backend rotiert Keys)
- ✅ Audit Logs (wer hat wann was aufgerufen)

### Negative

- ❌ MVP kann kein Live-KI nutzen (bewusst akzeptiert)
- ❌ Backend nötig für V2 (zusätzliche Infrastruktur)
- ❌ Latenz erhöht (Client → Backend → OpenAI → Backend → Client)

### Mitigation

**MVP**:
- Deterministischer Parser für Basic Use-Cases
- User-Hinweis: "KI-Features folgen in V2"

**V2 Latenz**:
- Backend-Proxy in gleicher Region wie KI-Service (z.B. EU-West)
- Caching häufiger Patterns (z.B. "Email" → 10min Task)

## Enforcement

### Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

if git diff --cached | grep -E "(sk-[a-zA-Z0-9]{48}|OPENAI_API_KEY)"; then
  echo "ERROR: API Key detected in commit!"
  exit 1
fi
```

### CI-Check

```yaml
# .github/workflows/security.yml
name: Secret Scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: |
          if grep -r "sk-" src/; then
            echo "ERROR: API Key found in source code"
            exit 1
          fi
```

### Code-Review Checklist

- [ ] Keine `OPENAI_API_KEY` in Code
- [ ] Keine `sk-...` Strings in Bundle
- [ ] Alle KI-Calls gehen an `/api/*`, nicht direkt zu OpenAI

## Alternatives Considered

**Option C**: Encrypted Keys im Client (mit User-Passphrase)
- User gibt Passwort ein → Client decrypted API Key → nutzt Key
- **Rejected**: User muss eigenen API Key mitbringen (schlechte UX)

**Option D**: Serverless Functions (Vercel, Netlify)
- API Key in Serverless Function Environment Variables
- **Accepted als V2 Alternative**: Einfacher als Full Backend

## Related

- See `/spec/80_quality/secrets_management.md` für .env-Regeln
- See `/spec/80_quality/threat_model.md` → R5 (Secrets im Client)
- See `/spec/50_ai/ai_inputs_outputs.md` → Backend-Proxy Contract

## References

- OWASP: "Never store secrets in client-side code"
- OpenAI Best Practices: "Use API Keys server-side only"
- Real-World Incident: GitHub Secret Scanning findet 10.000 API Keys/Monat
