# Threat Model

## 1. Ziel und Scope

### Ziel

Identifikation und Bewertung von Sicherheitsrisiken für DayFlow, priorisiert nach MVP-Phase und Zukunftsausbau.

### Scope

**MVP (Web, Local-First)**:
- Single-Page Application (React/Vue/etc.)
- localStorage/IndexedDB für alle Daten
- Keine Backend-Kommunikation
- Keine externe Integrationen
- Keine User-Accounts

**V2 (Backend + Integrationen)**:
- Optional: Cloud-Sync
- Optional: KI-Service (Extraction, Planning)
- Optional: Kalender Read-Only
- Optional: WhatsApp Integration

**Out of Scope**:
- Multi-Tenant Enterprise Security
- HIPAA/PCI-DSS Compliance
- Nation-State Attackers

## 2. Schutzgüter und Datenkategorien

### Schutzgüter

1. **User-Daten** (höchste Priorität)
   - InboxNotes (raw_text)
   - Tasks, Events, Ideas
   - Day Plans

2. **Vertraulichkeit**
   - Notizen können sensible Infos enthalten (Gesundheit, Finanzen)
   - Kein Zugriff durch Dritte

3. **Integrität**
   - Keine Manipulation von Daten
   - Korrekte State-Transitions

4. **Verfügbarkeit**
   - Daten nicht verloren
   - Export/Backup möglich

### Datenkategorien

| Kategorie | Beispiele | MVP Speicherort | V2 Speicherort |
|-----------|-----------|-----------------|----------------|
| **Öffentlich** | App-Version, Telemetrie-Events | localStorage | Server (anonymisiert) |
| **Intern** | User Settings, Preferences | localStorage | Server (verschlüsselt) |
| **Vertraulich** | Task-Titel, Notizen | localStorage | Server (verschlüsselt) |
| **Hochsensibel** | Gesundheitsdaten (falls User eingibt) | localStorage (Warnung) | Server (E2E optional) |

## 3. Angreifer-Modelle

### A1: Opportunistischer Angreifer

**Profil**: Script-Kiddie, automatisierte Tools

**Ziel**: XSS, CSRF, bekannte Schwachstellen

**Wahrscheinlichkeit**: Hoch

**Impact**: Mittel (Datendiebstahl aus localStorage)

### A2: Physischer Zugriff

**Profil**: Jemand mit physischem Zugriff zum Gerät

**Ziel**: localStorage auslesen, Daten kopieren

**Wahrscheinlichkeit**: Niedrig-Mittel

**Impact**: Hoch (voller Datenzugriff)

### A3: Kompromittierte Dependency

**Profil**: Supply-Chain-Attack (npm-Paket)

**Ziel**: Code-Injection, Datenexfiltration

**Wahrscheinlichkeit**: Niedrig

**Impact**: Sehr hoch (voller App-Zugriff)

### A4: Man-in-the-Middle (V2)

**Profil**: Netzwerk-Angreifer bei KI/Backend-Calls

**Ziel**: Request-Interception, Daten mitlesen

**Wahrscheinlichkeit**: Niedrig (mit HTTPS)

**Impact**: Mittel (Notiz-Inhalte sichtbar)

## 4. Angriffsflächen

### 4.1 Web MVP

**Client-Side**:
- Input Fields (XSS-Risiko)
- localStorage (physischer Zugriff)
- Browser DevTools (Debug-Informationen)
- Third-Party Dependencies (npm)

**Keine Server-Side** (im MVP)

### 4.2 Später: Mobile

**Zusätzlich**:
- App-Sandbox (iOS/Android)
- Keychain/Keystore
- Inter-App Communication (URL Schemes)

### 4.3 Später: Integrationen

**KI-Service**:
- API-Endpoints
- Request/Response Manipulation
- Data Leakage durch Logs

**Kalender/WhatsApp**:
- OAuth-Flow Hijacking
- Token-Diebstahl
- Webhook-Injection

## 5. Risiken, Priorisierung und Controls

### R1: XSS durch User-Input

**Beschreibung**: User gibt `<script>alert(1)</script>` in Notiz ein, wird als HTML gerendert

**Wahrscheinlichkeit**: Hoch

**Impact**: Hoch (Session-Hijacking, Datendiebstahl)

**Angreifer**: A1

**Phase**: MVP

**Control**:
- **C1.1**: Alle Inputs als Text rendern (React: `{text}`, nie `dangerouslySetInnerHTML`)
- **C1.2**: Content Security Policy: `script-src 'self'`
- **C1.3**: Input Sanitization (zusätzlich, nicht als primäre Verteidigung)

**Test**:
- Unit Test: Eingabe `<script>alert(1)</script>` → Rendert als Text
- E2E Test: DevTools Console zeigt keine CSP-Violations für legitime Nutzung

---

### R2: localStorage Zugriff bei physischem Gerätezugriff

**Beschreibung**: Angreifer hat physischen Zugriff, öffnet DevTools, liest localStorage

**Wahrscheinlichkeit**: Niedrig-Mittel

**Impact**: Hoch (alle Daten sichtbar)

**Angreifer**: A2

**Phase**: MVP (bewusst akzeptiert)

**Control**:
- **C2.1**: User-Hinweis in Onboarding: "Daten lokal gespeichert, Gerät schützen"
- **C2.2**: V2: Optional Client-Side Encryption (Passphrase-basiert)
- **C2.3**: Export/Delete-Funktion (User kann Daten selbst löschen)

**Test**:
- Manuelle Prüfung: Onboarding-Text enthält Hinweis
- Manuelle Prüfung: Settings → "Alle Daten löschen" funktioniert

---

### R3: Dependency Compromise (npm Supply Chain)

**Beschreibung**: Kompromittiertes npm-Paket injected Code

**Wahrscheinlichkeit**: Niedrig

**Impact**: Sehr hoch

**Angreifer**: A3

**Phase**: MVP + V2

**Control**:
- **C3.1**: Lockfile committen (`package-lock.json`, `yarn.lock`)
- **C3.2**: `npm audit` vor jedem Release
- **C3.3**: Dependabot/Renovate für Updates
- **C3.4**: Code-Review bei großen Dependency-Changes

**Test**:
- CI-Check: `npm audit --production` hat keine Critical/High Vulnerabilities
- Code-Review Checklist: Dependency-Changes geprüft

---

### R4: CSRF (Cross-Site Request Forgery)

**Beschreibung**: Böse Seite sendet Request an DayFlow-Backend

**Wahrscheinlichkeit**: N/A (kein Backend im MVP)

**Impact**: N/A

**Angreifer**: A1

**Phase**: V2 (Backend)

**Control**:
- **C4.1**: SameSite Cookies (`SameSite=Strict`)
- **C4.2**: CSRF-Token bei State-Changing Requests
- **C4.3**: CORS Policy (nur eigene Domain)

**Test**:
- E2E Test: Request von fremder Origin wird blockiert

---

### R5: Secrets im Client-Code (API Keys)

**Beschreibung**: OpenAI API Key im Frontend-Bundle

**Wahrscheinlichkeit**: Hoch (wenn nicht verhindert)

**Impact**: Sehr hoch (Key-Missbrauch, Kosten)

**Angreifer**: A1

**Phase**: V2 (KI-Integration)

**Control**:
- **C5.1**: **Harte Regel**: Keine API Keys im Client (siehe ADR 0003)
- **C5.2**: Backend-Proxy für alle KI-Calls
- **C5.3**: `.env` nur für Dev-Umgebung, nie committed
- **C5.4**: Pre-Commit Hook: Prüfe auf `OPENAI_API_KEY` in Code

**Test**:
- CI-Check: Bundle enthält keine Strings wie `sk-`, `OPENAI_API_KEY`
- Code-Review: KI-Calls gehen an `/api/extract`, nicht direkt zu OpenAI

---

### R6: Data Exfiltration via Telemetry

**Beschreibung**: Telemetrie-Event enthält `raw_text` aus Notiz

**Wahrscheinlichkeit**: Mittel (ohne Controls)

**Impact**: Hoch (Datenleck)

**Angreifer**: Interner Fehler

**Phase**: MVP

**Control**:
- **C6.1**: Whitelist für erlaubte Event-Properties (siehe `/spec/80_quality/telemetry_events.md`)
- **C6.2**: Sanitization-Funktion prüft PII
- **C6.3**: Unit Tests für Sanitization

**Test**:
- Unit Test: `trackEvent("note_created", {raw_text: "secret"})` → `raw_text` entfernt
- Code-Review: Telemetry-Calls enthalten keine PII

---

### R7: Clickjacking

**Beschreibung**: DayFlow in `<iframe>` auf böser Seite, User klickt unwissentlich

**Wahrscheinlichkeit**: Niedrig

**Impact**: Mittel (ungewollte Aktionen)

**Angreifer**: A1

**Phase**: MVP

**Control**:
- **C7.1**: HTTP Header: `X-Frame-Options: DENY`
- **C7.2**: CSP: `frame-ancestors 'none'`

**Test**:
- E2E Test: Versuch, App in iframe zu laden → blockiert
- Header-Check: Response enthält `X-Frame-Options: DENY`

---

### R8: Unvalidated AI Response (Schema Violation)

**Beschreibung**: KI liefert invalide JSON, App crashed

**Wahrscheinlichkeit**: Mittel

**Impact**: Mittel (Fehler, schlechte UX)

**Angreifer**: Kein Angreifer (Bug)

**Phase**: V2 (KI)

**Control**:
- **C8.1**: JSON Schema Validation (ajv)
- **C8.2**: Fallback zu Manual Mode bei Validation Error
- **C8.3**: Sentry-Logging für Schema-Fehler

**Test**:
- Unit Test: Invalide JSON → Fallback
- Integration Test: Schema Violation → Fallback

---

### R9: Calendar/WhatsApp Token Theft

**Beschreibung**: OAuth-Token aus localStorage gestohlen

**Wahrscheinlichkeit**: Niedrig-Mittel

**Impact**: Mittel (Zugriff auf Kalender/WhatsApp)

**Angreifer**: A2 (physischer Zugriff) oder A1 (XSS)

**Phase**: V2 (Integrationen)

**Control**:
- **C9.1**: XSS-Prevention (siehe R1)
- **C9.2**: Short-Lived Tokens (1h) + Refresh Token (httpOnly Cookie)
- **C9.3**: Token-Rotation bei jedem Refresh
- **C9.4**: Revocation-Endpoint (User kann Token widerrufen)

**Test**:
- E2E Test: Token-Rotation funktioniert
- Manuelle Prüfung: Settings → "Trennen" widerruft Token

---

### R10: Data Loss (localStorage cleared)

**Beschreibung**: Browser löscht localStorage (z.B. "Clear Browsing Data")

**Wahrscheinlichkeit**: Mittel

**Impact**: Hoch (Datenverlust)

**Angreifer**: Kein Angreifer (User-Fehler)

**Phase**: MVP

**Control**:
- **C10.1**: Export-Funktion (User kann Backup erstellen)
- **C10.2**: Onboarding-Hinweis: "Daten lokal, regelmäßig exportieren"
- **C10.3**: V2: Optional Cloud-Sync

**Test**:
- E2E Test: Export → Import → Daten wiederhergestellt
- Manuelle Prüfung: Onboarding-Text vorhanden

---

### R11: Insecure Deserialization

**Beschreibung**: User importiert böse JSON-Datei

**Wahrscheinlichkeit**: Niedrig

**Impact**: Mittel (App crashed oder XSS)

**Angreifer**: A1 (Social Engineering)

**Phase**: MVP

**Control**:
- **C11.1**: Schema-Validation bei Import
- **C11.2**: Sanitization aller importierten Texte
- **C11.3**: Import-Preview (User sieht, was importiert wird)

**Test**:
- Unit Test: Import mit `<script>` → Sanitized
- E2E Test: Invalide JSON → Error-Message

---

### R12: Denial of Service (lokale Resources)

**Beschreibung**: User erstellt 100.000 Tasks, App friert ein

**Wahrscheinlichkeit**: Niedrig

**Impact**: Niedrig (nur lokale App betroffen)

**Angreifer**: Kein Angreifer (User-Fehler)

**Phase**: MVP

**Control**:
- **C12.1**: Pagination (max 100 Tasks pro View)
- **C12.2**: Virtualized Lists (React Window)
- **C12.3**: V2: Soft Limits (z.B. max 500 Tasks)

**Test**:
- Performance Test: 1000 Tasks → UI bleibt responsiv

## 6. Explizite Non-Goals im MVP

**NG1: E2E Encryption**  
Begründung: Keine Cloud-Sync im MVP, daher nicht nötig

**NG2: Multi-Factor Authentication**  
Begründung: Keine Accounts im MVP

**NG3: Rate Limiting**  
Begründung: Keine Server-Calls im MVP

**NG4: Intrusion Detection**  
Begründung: Keine Backend-Infrastruktur

**NG5: GDPR Consent Management (komplex)**  
Begründung: Nur lokale Daten, kein Tracking ohne Opt-in (siehe `/spec/80_quality/privacy_and_security.md`)

## 7. Verifizierung

### Code-Level Checks

**Vor jedem Release**:
- [ ] `npm audit --production` → Keine Critical/High
- [ ] Bundle enthält keine API Keys (Regex: `sk-`, `OPENAI_API_KEY`)
- [ ] CSP Header konfiguriert (siehe `/spec/80_quality/web_security_baseline.md`)
- [ ] Alle Inputs werden als Text gerendert (Code-Review)
- [ ] Telemetrie sanitized PII (Unit Tests)

### Runtime Checks

- [ ] Browser DevTools Console: Keine CSP-Violations (normale Nutzung)
- [ ] Export/Import funktioniert
- [ ] Settings → "Alle Daten löschen" löscht localStorage

### Security Testing

**MVP**:
- Manuelle XSS-Tests (10 Inputs mit `<script>`, `<img onerror>`, etc.)
- Dependency Audit (automatisiert)

**V2**:
- Penetration Test (extern, optional)
- OAuth-Flow Sicherheit (OWASP Checkliste)

## Verwandte Dokumente

- `/spec/80_quality/web_security_baseline.md` → Konkrete Controls
- `/spec/80_quality/secure_storage.md` → localStorage, Migration
- `/spec/80_quality/secrets_management.md` → API Keys, .env
- `/adr/0003_no_secrets_in_client.md` → Begründung für C5.1
