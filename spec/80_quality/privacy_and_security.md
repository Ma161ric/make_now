# Privacy and Security

## Übersicht

GDPR-konforme Datenschutz- und Sicherheitsrichtlinien für alle Features.

## GDPR Compliance

### Rechtsgrundlage

**Art. 6 Abs. 1 lit. b DSGVO**: Vertragserfüllung
- User erstellt Account → Vertrag
- App speichert Tasks/Events → Erfüllung des Vertrags

**Art. 6 Abs. 1 lit. a DSGVO**: Einwilligung
- Kalender-Integration → Explicit Consent
- WhatsApp-Integration → Explicit Consent
- Analytics → Explicit Consent (Opt-in)

### Betroffenenrechte

**Auskunftsrecht (Art. 15 DSGVO)**:
- UI: Settings → "Daten exportieren"
- Format: JSON (human-readable)
- Umfang: Alle User-Daten (Tasks, Notes, Events, Plans, Settings)

**Recht auf Löschung (Art. 17 DSGVO)**:
- UI: Settings → "Alle Daten löschen"
- Scope: User + All related data
- Timeline: Immediate (soft delete), 30 days (hard delete)
- Exceptions: Legal retention (7 Jahre für Buchhaltung, falls paid)

**Recht auf Datenübertragbarkeit (Art. 20 DSGVO)**:
- Export Format: JSON, CSV (für Tasks/Events)
- Import zu anderen Apps: CSV-Import (standard format)

**Widerspruchsrecht (Art. 21 DSGVO)**:
- Analytics: Opt-out jederzeit
- Marketing (V2): Opt-out jederzeit

### Transparenz

**Datenschutzerklärung**:
- Verfügbar: Bei Onboarding + Settings
- Sprache: Deutsch (V1)
- Inhalt:
  - Welche Daten gespeichert
  - Zu welchem Zweck
  - Wie lange
  - An wen übermittelt (AI Service, Calendar Provider)
  - Betroffenenrechte

**Consent Management**:
- Kalender: "Ich erlaube Zugriff auf meinen Kalender (nur lesen)"
- WhatsApp: "Ich erlaube WhatsApp-Integration"
- Analytics: "Anonyme Nutzungsdaten senden (optional)"

## Data Collection

### Personal Data

**Required (Account)**:
- Email (for login, optional V1)
- Device ID (for sync)
- Timezone

**User-Generated**:
- InboxNotes (raw_text)
- Tasks (title, notes, duration, importance)
- Events (title, start_time, end_time)
- Ideas (title, tags)
- DayPlans (date, reasoning)

**Metadata**:
- Timestamps (created_at, updated_at)
- Status (task_status, note_status)
- User settings (work_hours, buffer_duration)

### Sensitive Data

**Special Categories (Art. 9 DSGVO)**:
- Gesundheitsdaten: Möglich (z.B. "Arzttermin")
- Politische Meinung: Möglich
- Religiöse Ansichten: Möglich

**Handling**:
- V1: Kein Special Handling (User verantwortlich)
- V2: E2E Encryption (optional)
- Hinweis bei Onboarding: "Keine sensiblen Gesundheitsdaten eingeben"

### Third-Party Data

**Kalender**:
- Events (title, start, end, location) → Read-only
- Retention: Cache für 24h
- Löschen: Bei Trennen der Integration

**WhatsApp**:
- Phone Number (hashed)
- Message Text (nur für Extraction)
- Retention: 7 Tage, dann gelöscht
- Löschen: Bei Trennen der Integration

### AI Service

**Daten gesendet**:
- InboxNote.raw_text
- User timezone
- Current date
- (Optional) Calendar free slots

**Daten NICHT gesendet**:
- Email
- Device ID
- Full task list

**Retention (AI Provider)**:
- Zero Data Retention (contractual requirement)
- Logs max 30 days (for debugging)

**Provider Selection**:
- V1: OpenAI (US-based, Privacy Shield successor)
- Alternative: EU-based LLM (z.B. Aleph Alpha)

## Data Storage

### Location

**V1**: Device-only (SQLite local)
- Keine Cloud-Sync
- Backup via Export-Funktion

**V2**: Optional Cloud Sync
- Server: EU (z.B. Frankfurt, AWS eu-central-1)
- Database: PostgreSQL (encrypted at rest)

### Encryption

**In Transit**:
- HTTPS/TLS 1.3
- Certificate Pinning (V2)

**At Rest**:
- V1: SQLite encryption (SQLCipher, optional)
- V2: AES-256 encryption (database level)
- Device: Relies on OS encryption (iOS FileVault, Android FDE)

**E2E Encryption** (V2):
- Sensitive fields: Task.title, Event.title, Note.raw_text
- Key Management: User passphrase (PBKDF2)
- Limitation: AI cannot extract from E2E encrypted notes

### Retention

**Active Data**:
- Tasks: Until deleted or archived
- Events: Synchronized mit Kalender
- Notes: Until deleted or archived
- Plans: Last 30 days

**Archived Data**:
- Auto-delete after 90 days (configurable)

**Logs**:
- Error Logs: 30 days
- Analytics: 365 days (anonymized)

## Access Control

### User Authentication

**V1**: Device-only (kein Login)
- Device ID as identifier

**V2**: Account-based
- Email + Password (min 12 chars)
- 2FA (TOTP, optional)
- Biometric (Face ID, Fingerprint)

### API Security

**Authentication**:
- API Key (server-to-server)
- JWT Token (client-to-server, V2)

**Authorization**:
- User can only access own data
- Role-based (future: Premium users)

**Rate Limiting**:
- See `/spec/80_quality/non_functional_requirements.md`
- DDoS Protection (Cloudflare, V2)

## Integrations

### Calendar

**Permissions**:
- Read Calendars (iOS: NSCalendarsUsageDescription)
- Read Events

**Scope**:
- Last 7 days, Next 30 days
- Only free/busy status (not event details, optional V1)

**Revocation**:
- Settings → "Trennen"
- Delete cached calendar data

### WhatsApp

**Permissions**:
- Webhook URL registered with Meta

**Data Handling**:
- Phone Number: Hashed (SHA-256)
- Messages: Deleted after extraction (max 24h)
- No message history stored

**Revocation**:
- Settings → "Trennen"
- Webhook deregistered
- Phone number hash deleted

## Telemetry

### Analytics

**Opt-in** (required by GDPR):
- Default: Off
- User must explicitly enable

**Data Collected** (if enabled):
- Event counts (e.g., "note_created", "plan_confirmed")
- Aggregated metrics (e.g., avg notes/day)
- No PII (no email, no text content)

**Identifiers**:
- Device ID (hashed)
- User ID (anonymized)

**Provider**:
- Self-hosted (Plausible, Umami)
- OR: Privacy-focused (Fathom, Simple Analytics)
- NICHT: Google Analytics

### Crash Reporting

**Auto-enabled** (legitimate interest):
- Crash logs
- Stack traces
- Device model, OS version
- No user data (sanitize before sending)

**Provider**:
- Sentry (EU instance)
- Crashlytics (Google, GDPR-compliant)

## Incident Response

### Data Breach

**Detection**:
- Automated monitoring (failed logins, unusual access)
- Log analysis

**Response**:
- Confirm breach within 24h
- Notify users within 72h (GDPR Art. 33)
- Notify authorities (BfDI, Germany)

**Mitigation**:
- Force password reset
- Revoke API tokens
- Audit logs for affected users

### User Notification

**Template**:
```
Betreff: Sicherheitshinweis – Datenschutzvorfall

Sehr geehrte/r Nutzer/in,

am [Datum] wurde ein Sicherheitsvorfall festgestellt.
Betroffene Daten: [Liste]
Maßnahmen: [Liste]

Wir empfehlen:
- Passwort ändern
- Verdächtige Aktivitäten prüfen

Fragen: privacy@dayflow.app

Mit freundlichen Grüßen,
Das DayFlow-Team
```

## Third-Party Audits

**V1**: Self-assessment
- GDPR Checklist
- Privacy Policy Review

**V2**: External Audit
- Penetration Testing
- GDPR Compliance Audit
- ISO 27001 (optional)

## Children's Privacy

**COPPA, GDPR Art. 8**:
- Minimum Age: 16 Jahre (Germany)
- Age Verification: Self-declaration (V1)
- Parental Consent: Required for <16 (V2)

## Marketing & Tracking

**V1**: Keine Marketing-Features

**V2** (optional):
- Email Newsletter: Double Opt-in
- Push Notifications: Opt-in
- No third-party tracking cookies

## Data Processor Agreements (DPA)

**AI Service**: OpenAI DPA (Standard)
- Zero data retention clause
- Sub-processors disclosed

**Cloud Provider** (V2): AWS
- Standard AWS DPA
- EU region only

**Analytics**: Sentry DPA
- EU instance
- 30-day retention

## Contact

**Data Protection Officer** (required if >20 employees):
- Email: privacy@dayflow.app
- Response Time: 7 days

**Data Subject Requests**:
- Email: privacy@dayflow.app
- Form: Settings → "Datenauskunft anfordern"

## Verwandte Security-Dokumente

**Threat Modeling und Risk Management**:
- `/spec/80_quality/threat_model.md` → Vollständiges Threat Model mit 12 Risiken und Controls
- `/spec/80_quality/secure_storage.md` → Storage-Strategie, Verschlüsselung, Export/Import

**Secrets und API Keys**:
- `/spec/80_quality/secrets_management.md` → .env-Regeln, Key-Rotation, Backend-Proxy
- `/adr/0003_no_secrets_in_client.md` → Begründung für "Keine API Keys im Client"

**Web Security Baseline**:
- `/spec/80_quality/web_security_baseline.md` → XSS-Prevention, CSP, Security Headers
