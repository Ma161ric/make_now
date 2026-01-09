# Secrets Management

## 1. Harte Regeln

### Regel 1: Keine Secrets im Client-Code

**Definition**: Ein Secret ist jede Information, die Zugriff auf externe Systeme gewährt:
- API Keys (OpenAI, Anthropic, etc.)
- OAuth Client Secrets
- Database Credentials
- Encryption Keys (außer User-generiert)
- Signing Keys

**Harte Regel**: **Secrets dürfen NIE im Client-Code, Frontend-Bundle oder localStorage gespeichert werden.**

**Begründung**: Siehe `/adr/0003_no_secrets_in_client.md`

**Konsequenzen**:
- ✅ Public API Keys (z.B. Google Maps) sind erlaubt (Domain-Restricted)
- ❌ OpenAI API Key im Frontend ist **VERBOTEN**
- ❌ OAuth Client Secret im Frontend ist **VERBOTEN**
- ✅ OAuth Access Token (short-lived, <1h) ist erlaubt
- ❌ OAuth Refresh Token im localStorage ist **VERBOTEN** (httpOnly Cookie verwenden)

### Regel 2: .env-Dateien niemals committen

**.gitignore** muss enthalten:
```
.env
.env.local
.env.*.local
*.pem
*.key
*.p12
```

**Nur erlaubt**: `.env.example` (ohne echte Secrets)

## 2. Dev Setup

### .env für Entwicklung (lokal)

**Zweck**: Lokale Development-Umgebung konfigurieren

**Erlaubte Variablen** (im Client-Build):
```env
# Public Config (im Bundle sichtbar)
VITE_APP_VERSION=1.0.0
VITE_API_URL=http://localhost:3000
VITE_ENV=development
```

**Verbotene Variablen** (NIEMALS im Client):
```env
# NEVER EVER IN CLIENT!
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

### .env.example (committed)

**Zweck**: Template für neue Developer

**Inhalt**:
```env
# Public Config (safe to commit)
VITE_APP_VERSION=1.0.0
VITE_API_URL=http://localhost:3000
VITE_ENV=development

# Secrets (NEVER commit real values!)
# Backend only (not used in MVP)
# OPENAI_API_KEY=sk-xxx...
# DATABASE_URL=postgresql://user:pass@localhost/dayflow
```

### Setup-Instruktionen (README.md)

```markdown
## Development Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. (MVP: Keine Secrets nötig, da kein Backend)

3. (V2: Trage Backend-Secrets ein, siehe Backend-Dokumentation)
```

## 3. V2: Backend-Proxy für KI-Calls

**Wann**: Sobald echte KI-Integration (OpenAI, Anthropic, etc.)

### Architektur

**Client** → **Backend-Proxy** → **KI-Service**

**Datenfluss**:
```
1. User erstellt Notiz: "Email an Chef, Meeting 14 Uhr"
2. Client sendet POST /api/extract { note_text: "..." }
3. Backend validiert Request (Rate Limiting, User Auth)
4. Backend ruft OpenAI API auf (mit Server-side API Key)
5. Backend validiert Response (Schema)
6. Backend sendet Response an Client
```

### Backend-Proxy Implementierung (Pseudocode)

**Endpoint**: `POST /api/extract`

**Request**:
```json
{
  "note_text": "Email an Chef, Meeting 14 Uhr",
  "timezone": "Europe/Berlin",
  "current_date": "2026-01-09"
}
```

**Response**:
```json
{
  "items": [...],
  "question": {...}
}
```

**Backend-Code** (Node.js/Express):
```typescript
import { OpenAI } from "openai";
import { validateExtractionSchema } from "./schemas";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Server-side only!
});

app.post("/api/extract", async (req, res) => {
  const { note_text, timezone, current_date } = req.body;
  
  // 1. Rate Limiting (optional)
  if (!checkRateLimit(req.user.id)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  
  // 2. Input Validation
  if (!note_text || note_text.length > 2000) {
    return res.status(400).json({ error: "Invalid input" });
  }
  
  // 3. Call OpenAI (Server-side API Key)
  const prompt = buildExtractionPrompt(note_text, timezone, current_date);
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });
  
  const aiResponse = response.choices[0].message.content;
  
  // 4. Parse + Validate
  let parsed;
  try {
    parsed = JSON.parse(aiResponse);
  } catch (e) {
    return res.status(500).json({ error: "AI returned invalid JSON" });
  }
  
  if (!validateExtractionSchema(parsed)) {
    return res.status(500).json({ error: "Schema validation failed" });
  }
  
  // 5. Return to Client
  res.json(parsed);
});
```

**Client-Code**:
```typescript
async function extractItems(noteText: string): Promise<ExtractionResult> {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      note_text: noteText,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      current_date: new Date().toISOString().split("T")[0]
    })
  });
  
  if (!response.ok) {
    throw new Error("Extraction failed");
  }
  
  return response.json();
}
```

**Wichtig**: Client hat **KEINEN** direkten Zugriff auf OpenAI API Key.

## 4. Rotation und Incident Basics

### Key Rotation

**Regelmäßig** (alle 90 Tage):
- OpenAI API Key rotieren
- OAuth Client Secrets rotieren
- JWT Signing Keys rotieren

**Prozess**:
1. Neuen Key generieren (bei Provider)
2. Neuen Key in Backend setzen (`OPENAI_API_KEY_NEW`)
3. Backend unterstützt beide Keys (7 Tage Overlap)
4. Alten Key löschen

### Incident Response

**Szenario**: API Key geleakt (z.B. versehentlich committed)

**Sofort-Maßnahmen** (innerhalb 1h):
1. Key widerrufen (bei Provider)
2. Neuen Key generieren
3. Backend neu deployen
4. Audit Logs prüfen (wurde Key missbraucht?)
5. Git History bereinigen (BFG Repo Cleaner)

**Template** (Runbook):
```markdown
# Incident: API Key Leak

1. [ ] Key widerrufen (OpenAI Dashboard → API Keys → Revoke)
2. [ ] Neuen Key generieren
3. [ ] `.env` aktualisieren (nur Server)
4. [ ] Backend neu starten
5. [ ] Prüfen: OpenAI Usage Dashboard (ungewöhnliche Aktivität?)
6. [ ] Git History säubern:
   ```bash
   bfg --replace-text <(echo "sk-old-key==>REDACTED")
   git push --force
   ```
7. [ ] Post-Mortem: Wie konnte das passieren? Pre-Commit Hook?
```

## 5. Logging und Redaction

### Was wird geloggt?

**Erlaubt**:
- Request-IDs
- HTTP Status Codes
- Error Messages (sanitized)
- Timings (Performance)
- User-IDs (hashed)

**Verboten**:
- API Keys
- Passwords
- OAuth Tokens
- Notiz-Inhalte (raw_text)
- PII (Email, Phone)

### Redaction-Funktion

**Zweck**: Automatisches Entfernen von Secrets aus Logs

**Implementation**:
```typescript
function redactSecrets(text: string): string {
  let redacted = text;
  
  // OpenAI API Keys (sk-...)
  redacted = redacted.replace(/sk-[a-zA-Z0-9]{48}/g, "REDACTED_API_KEY");
  
  // JWT Tokens (eyJ...)
  redacted = redacted.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "REDACTED_JWT");
  
  // Generic Secrets (password=...)
  redacted = redacted.replace(/password=\S+/gi, "password=REDACTED");
  
  return redacted;
}

// Usage
logger.error(redactSecrets(errorMessage));
```

### Logging Best Practices

**DO**:
```typescript
logger.info("Extraction request", {
  request_id: "abc-123",
  user_id: hashUserId(userId),
  note_length: noteText.length, // Länge, nicht Inhalt
  duration_ms: 1850
});
```

**DON'T**:
```typescript
logger.info("Extraction request", {
  api_key: process.env.OPENAI_API_KEY, // NEVER!
  note_text: noteText, // NEVER!
  user_email: user.email // NEVER!
});
```

## 6. Akzeptanzkriterien

### AC1: Keine Secrets im Client

**Pre-Commit Hook** (empfohlen):
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for common secret patterns
if git diff --cached | grep -E "(sk-[a-zA-Z0-9]{48}|OPENAI_API_KEY|password=)"; then
  echo "ERROR: Potential secret detected in commit!"
  echo "Please remove secrets before committing."
  exit 1
fi
```

**CI-Check**:
```yaml
# .github/workflows/security.yml
name: Security Check
on: [push, pull_request]
jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Scan for secrets
        run: |
          npm install -g @secretlint/secretlint
          secretlint "**/*"
```

**Manual Checklist** (vor Release):
- [ ] `grep -r "sk-" src/` → Keine Treffer
- [ ] `grep -r "OPENAI_API_KEY" src/` → Keine Treffer (außer als String für Backend-Config)
- [ ] Frontend-Bundle enthält keine Secrets (Webpack Bundle Analyzer)

### AC2: .env-Dateien

- [ ] `.env` ist in `.gitignore`
- [ ] `.env.example` ist committed (ohne echte Secrets)
- [ ] README enthält Setup-Instruktionen

### AC3: Backend-Proxy (V2)

- [ ] Client ruft nur `/api/extract`, `/api/plan` auf
- [ ] Backend validiert Inputs (max 2000 chars)
- [ ] Backend validiert Outputs (Schema)
- [ ] Backend hat Rate Limiting (50 requests/hour/user)
- [ ] API Key liegt nur in Backend-Umgebung (nie im Client)

### AC4: Logging

- [ ] Logs enthalten keine API Keys
- [ ] Logs enthalten keine Notiz-Inhalte (nur Länge)
- [ ] Logs enthalten keine PII (nur hashed User-IDs)
- [ ] `redactSecrets()` wird für alle Error-Logs verwendet

### AC5: Rotation und Incident

- [ ] Runbook für Key-Leak existiert
- [ ] OpenAI API Key wird alle 90 Tage rotiert (Kalender-Erinnerung)
- [ ] Post-Mortem-Template existiert

## Verwandte Dokumente

- `/adr/0003_no_secrets_in_client.md` → Begründung für Regel 1
- `/spec/80_quality/threat_model.md` → R5 (Secrets im Client)
- `/spec/80_quality/web_security_baseline.md` → Input Validation, CSP
- `/spec/50_ai/ai_inputs_outputs.md` → Backend-Proxy Contract
