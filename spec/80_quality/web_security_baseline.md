# Web Security Baseline

## 1. Input Handling und Output Rendering

### Grundregel

**Alle User-Inputs sind gefährlich, bis sie validiert und sanitized wurden.**

### Input Validation

**Regel**: Validiere auf Server-Side (V2) UND Client-Side (UX)

**Beispiel** (Task-Titel):
```typescript
function validateTaskTitle(title: string): ValidationResult {
  // Length
  if (title.length < 1) {
    return { valid: false, error: "Titel fehlt" };
  }
  if (title.length > 200) {
    return { valid: false, error: "Titel zu lang (max. 200 Zeichen)" };
  }
  
  // No control characters (außer \n, \t)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(title)) {
    return { valid: false, error: "Ungültige Zeichen" };
  }
  
  return { valid: true };
}
```

### Output Rendering (XSS Prevention)

**React (default: sicher)**:
```tsx
// ✅ SAFE (escaped by default)
<div>{task.title}</div>
<input value={task.title} />

// ❌ UNSAFE (NEVER USE)
<div dangerouslySetInnerHTML={{ __html: task.title }} />
```

**Vue (default: sicher)**:
```vue
<!-- ✅ SAFE -->
<div>{{ task.title }}</div>
<input :value="task.title" />

<!-- ❌ UNSAFE -->
<div v-html="task.title"></div>
```

**Plain JavaScript**:
```typescript
// ✅ SAFE
element.textContent = task.title;

// ❌ UNSAFE
element.innerHTML = task.title;
```

### Sanitization (nur wenn HTML erlaubt)

**MVP**: Kein HTML in User-Inputs → Keine Sanitization nötig

**V2** (falls Rich Text Editor):
```typescript
import DOMPurify from "dompurify";

function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "u", "a"],
    ALLOWED_ATTR: ["href"]
  });
}

// Usage
<div dangerouslySetInnerHTML={{ __html: sanitizeHTML(richText) }} />
```

## 2. XSS-Schutz: Do's und Don'ts

### ✅ DO

1. **Render User-Input als Text** (React: `{text}`, Vue: `{{ text }}`)
2. **Validiere Inputs** (Client + Server)
3. **Content Security Policy** (siehe Abschnitt 3)
4. **Escape HTML Entities** (falls Plain JS)
5. **Use Framework Defaults** (React/Vue sind XSS-safe by default)

### ❌ DON'T

1. **`dangerouslySetInnerHTML`** ohne Sanitization
2. **`eval(userInput)`**
3. **`new Function(userInput)`**
4. **`innerHTML = userInput`**
5. **`<a href="javascript:${userInput}">`**
6. **`<img src="x" onerror="${userInput}">`**

### Test-Cases (XSS Prevention)

**Input**: `<script>alert(1)</script>`  
**Expected**: Text wird gerendert als `<script>alert(1)</script>` (keine Ausführung)

**Input**: `<img src=x onerror=alert(1)>`  
**Expected**: Text wird gerendert als-is (kein Image, kein Alert)

**Input**: `'; DROP TABLE tasks; --`  
**Expected**: (SQL Injection irrelevant im MVP, da kein SQL, aber gut zu testen)

## 3. Content Security Policy (CSP)

### Zielkonfiguration (streng)

**Empfehlung für Produktion**:
```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.openai.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

**Erklärung**:
- `default-src 'self'`: Alles nur von eigener Domain
- `script-src 'self'`: Keine Inline-Scripts, keine eval()
- `style-src 'self' 'unsafe-inline'`: Inline-Styles erlaubt (React Styled Components)
- `img-src 'self' data: https:`: Bilder von eigener Domain, Data-URLs, HTTPS
- `connect-src 'self' https://api.openai.com`: Fetch nur zu eigenem Backend (V2: + OpenAI)
- `frame-ancestors 'none'`: Kein Embedding in iframes (Clickjacking-Schutz)

### MVP Minimal Version (relaxed)

**Für Entwicklung**:
```http
Content-Security-Policy:
  default-src 'self' 'unsafe-inline' 'unsafe-eval';
  img-src 'self' data: https:;
  connect-src 'self' http://localhost:* ws://localhost:*;
```

**Begründung**: Dev-Tools (HMR, React DevTools) brauchen `unsafe-inline`, `unsafe-eval`, WebSockets

**Wichtig**: Produktions-Build muss strenge CSP haben!

### CSP Implementation

**Vite (vite.config.ts)**:
```typescript
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    headers: {
      "Content-Security-Policy": process.env.NODE_ENV === "production"
        ? "default-src 'self'; script-src 'self'; ..." // Streng
        : "default-src 'self' 'unsafe-inline' 'unsafe-eval'; ..." // Dev
    }
  }
});
```

**Next.js (next.config.js)**:
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; ..."
          }
        ]
      }
    ];
  }
};
```

### CSP Testing

**Manual**: Browser DevTools Console → CSP-Violations werden geloggt

**Automated**:
```typescript
// E2E Test (Playwright)
test("CSP is set correctly", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response.headers()["content-security-policy"];
  
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain("unsafe-eval"); // Produktions-Build
});
```

## 4. Security Headers

### Empfohlene Headers

**Produktion**:
```http
# XSS Protection (Legacy, aber schadet nicht)
X-XSS-Protection: 1; mode=block

# Clickjacking Protection
X-Frame-Options: DENY

# MIME-Type Sniffing Prevention
X-Content-Type-Options: nosniff

# Referrer Policy (Privacy)
Referrer-Policy: strict-origin-when-cross-origin

# Permissions Policy (Browser Features)
Permissions-Policy: geolocation=(), microphone=(), camera=()

# HSTS (HTTPS only, nach erstem Deployment)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Implementation (Vite)

**vite.config.ts**:
```typescript
export default defineConfig({
  server: {
    headers: {
      "Content-Security-Policy": "...",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }
  }
});
```

### HSTS Hinweis

**Wichtig**: `Strict-Transport-Security` nur nach erstem erfolgreichen HTTPS-Deployment setzen!

**Grund**: Verhindert HTTP-Zugriff dauerhaft (max-age). Wenn falsch konfiguriert, können User nicht mehr zugreifen.

## 5. Abhängigkeiten: Updates, Lockfiles, Audit

### Lockfiles committen

**Zweck**: Reproduzierbare Builds, Supply-Chain Security

**Files**:
- `package-lock.json` (npm)
- `yarn.lock` (Yarn)
- `pnpm-lock.yaml` (pnpm)

**Regel**: Lockfile MUSS committed werden (`.gitignore` darf es nicht enthalten)

### npm audit (automatisiert)

**Vor jedem Release**:
```bash
npm audit --production
```

**CI-Check**:
```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm audit --production --audit-level=high
```

**Erlaubte Schweregrade**:
- `npm audit --audit-level=high`: Blockt bei Critical/High (empfohlen)
- `npm audit --audit-level=critical`: Blockt nur bei Critical (weniger streng)

### Dependency Updates

**Strategie**:
1. **Automatisch**: Dependabot (GitHub) oder Renovate (GitLab)
2. **Wöchentlich**: Minor/Patch Updates
3. **Monatlich**: Major Updates (mit Testing)

**Dependabot Config** (`.github/dependabot.yml`):
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "your-team"
```

### Known Vulnerabilities

**Szenario**: `npm audit` zeigt Vulnerabilities in Dependencies

**Prozess**:
1. Prüfe Severity (Critical/High → sofort fixen, Low → später)
2. Prüfe, ob Update verfügbar (`npm update`)
3. Falls kein Update: Alternative Dependency suchen
4. Falls keine Alternative: Risiko dokumentieren + akzeptieren (mit Begründung)

**Beispiel** (akzeptiertes Risiko):
```markdown
# Known Vulnerabilities

## CVE-2023-12345 in package `old-lib`

- **Severity**: Low
- **Impact**: Prototype Pollution (nur in Node.js, nicht im Browser)
- **Mitigation**: Wir nutzen `old-lib` nur für CSS-Parsing im Build-Schritt
- **Accepted**: Ja (bis `old-lib@v2` released)
- **Review Date**: 2026-03-01
```

## 6. Telemetrie: Datenschutz-Grenzen

### Was NIEMALS getrackt werden darf

**Verboten**:
- `raw_text` (Notiz-Inhalt)
- `task.title` (Task-Titel)
- `event.title` (Event-Titel)
- `idea.title` (Idee-Titel)
- User Email, Phone
- IP-Adresse (außer für Rate Limiting, dann sofort hashen)

**Erlaubt**:
- `text_length` (Anzahl Zeichen)
- `tasks_count` (Anzahl Tasks)
- `extraction_duration_ms` (Performance)
- `user_id` (hashed Device-ID)

### Sanitization (siehe `/spec/80_quality/telemetry_events.md`)

**Implementation**:
```typescript
function trackEvent(name: string, props: Record<string, any>) {
  // Remove PII
  const sanitized = { ...props };
  delete sanitized.raw_text;
  delete sanitized.title;
  delete sanitized.email;
  delete sanitized.phone;
  
  // Send
  analytics.track(name, sanitized);
}
```

## 7. Akzeptanzkriterien

### AC1: Input/Output Rendering

- [ ] Alle User-Inputs werden als Text gerendert (React: `{text}`, Vue: `{{ text }}`)
- [ ] Keine Verwendung von `dangerouslySetInnerHTML`, `v-html`, `innerHTML`
- [ ] Input-Validation für alle Felder (Title, Notes, etc.)

### AC2: XSS-Prevention

- [ ] Unit Test: Input `<script>alert(1)</script>` → Kein Alert
- [ ] E2E Test: XSS-Payload in Notiz → Kein Alert, Text wird escaped
- [ ] Code-Review: Keine Verwendung von `eval()`, `new Function()`

### AC3: Content Security Policy

- [ ] CSP Header ist gesetzt (Produktion: streng, Dev: relaxed)
- [ ] E2E Test: CSP-Header enthält `default-src 'self'`
- [ ] Browser Console: Keine CSP-Violations bei normaler Nutzung

### AC4: Security Headers

- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] (Nach HTTPS-Deployment) `Strict-Transport-Security`

### AC5: Dependency Audit

- [ ] `npm audit --production` zeigt keine Critical/High Vulnerabilities
- [ ] CI-Pipeline führt `npm audit` aus
- [ ] Lockfile (`package-lock.json`) ist committed
- [ ] Dependabot ist konfiguriert

### AC6: Telemetrie-Datenschutz

- [ ] Telemetrie trackt keine PII (`raw_text`, `title`, `email`)
- [ ] Unit Test: `trackEvent` entfernt PII-Fields
- [ ] Code-Review: Telemetrie-Calls enthalten nur erlaubte Properties

## Release-Checkliste

**Vor jedem Production-Deployment**:

- [ ] `npm audit --production` → Keine Critical/High
- [ ] Bundle-Analyse: Keine API Keys im Bundle
- [ ] CSP Header gesetzt (strenge Version)
- [ ] Security Headers gesetzt (X-Frame-Options, etc.)
- [ ] XSS-Tests durchgeführt (5 gängige Payloads)
- [ ] E2E-Tests grün
- [ ] Telemetrie-Sanitization verifiziert
- [ ] `.env`-Dateien nicht committed
- [ ] Lockfiles committed

## Verwandte Dokumente

- `/spec/80_quality/threat_model.md` → R1 (XSS), R3 (Dependencies), R6 (Telemetrie)
- `/spec/80_quality/secrets_management.md` → API Keys, .env
- `/spec/80_quality/telemetry_events.md` → PII Sanitization
- `/spec/80_quality/privacy_and_security.md` → GDPR Compliance
