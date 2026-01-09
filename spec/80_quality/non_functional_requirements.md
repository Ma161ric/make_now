# Non-Functional Requirements

## Übersicht

Nicht-funktionale Anforderungen an Performance, Zuverlässigkeit, Skalierbarkeit und Benutzererfahrung.

## Performance

### Response Times

**Target**: < 200ms für 95% aller UI-Operationen

**Critical Paths**:
- Inbox Capture → Save: < 100ms (p95)
- Note → Extraction: < 3s (p95)
- Extraction Review → Accept: < 200ms (p95)
- Day Plan Generation: < 2s (p95)
- Task Mark as Done: < 100ms (p95)

**AI Operations**:
- Extraction (Basic): < 2s (p95), < 5s (p99)
- Extraction (Complex): < 5s (p95), < 10s (p99)
- Day Planning: < 2s (p95), < 5s (p99)

**Timeouts**:
- AI Extraction: 10s → Fallback to manual mode
- AI Planning: 8s → Fallback to simple algorithm
- Calendar Sync: 5s → Cache stale data
- WhatsApp Webhook: 3s → Return 200, process async

### Database

- Read Query: < 50ms (p95)
- Write Query: < 100ms (p95)
- Index Scan: < 20ms (p95)

### Offline Support

- Inbox Capture: ✅ Fully offline
- Note Review: ✅ Offline (if cached)
- Day Plan: ✅ Offline (uses last calendar sync)
- Task Edit: ✅ Offline
- Daily Review: ✅ Offline

**Sync Strategy**:
- Queue writes during offline
- Sync on reconnect
- Conflict resolution: Last Write Wins (with timestamp)

## Scalability

### V1 Targets (MVP)

- Users: 1-1000
- Notes/User/Day: 5-15
- Tasks/User: 10-50
- Events/User: 5-20

### Data Limits

- Max InboxNote text: 2000 chars
- Max Task title: 200 chars
- Max Event title: 200 chars
- Max Notes per Task: 1000 chars
- Calendar Sync: Last 7 days, Next 30 days

### Rate Limits

**User Operations**:
- Inbox Capture: 100/hour (prevent spam)
- Extraction: 50/hour
- Day Plan Generation: 20/day
- Replan: 3/day (hard limit)

**API Endpoints**:
- WhatsApp Inbound: 50 messages/user/day
- AI Extraction: 100 requests/user/day
- AI Planning: 50 requests/user/day
- Calendar Sync: 1 req/5min

## Availability

**Target**: 99.5% uptime (MVP), 99.9% (V2)

**Downtime Budget**: ~3.6h/month (MVP)

**Degradation Strategy**:
- AI unavailable → Manual mode (User must set duration, importance)
- Calendar unavailable → Use cached data (max age: 1h)
- Database down → Block writes, allow reads from cache
- WhatsApp webhook down → Log + Retry 3× (exp backoff)

## Reliability

### Data Integrity

- All writes ACID-compliant
- Foreign key constraints enforced
- State transitions validated
- Duplicate detection (same raw_text < 60s)

### Error Recovery

- AI Timeout → Retry 1×, then Fallback
- Network Error → Queue + Retry (max 3×)
- Schema Validation Failed → Log + Manual mode
- Calendar Sync Failed → Use stale data + Warn user

### Backup

- Daily database snapshot
- Point-in-Time Recovery (last 7 days)
- Export User Data (JSON format)

## Security

**See**: `/spec/80_quality/privacy_and_security.md` für Details

**Key Points**:
- E2E encryption für sensitive data (optional V2)
- HTTPS/TLS only
- OAuth2 for Calendar, WhatsApp
- API Key rotation every 90 days

## Usability

### Accessibility

**WCAG 2.1 Level AA** (Goal for V2)

**MVP Requirements**:
- Screen Reader Support (iOS VoiceOver, Android TalkBack)
- Dynamic Text Sizes (iOS, Android)
- Minimum Touch Target: 44×44pt (iOS), 48×48dp (Android)
- Color Contrast: 4.5:1 (Text), 3:1 (UI Components)
- Keyboard Navigation (optional V1, required V2)

### Localization

**V1**: Deutsch (de_DE)
- Timezone: Europe/Berlin
- Date Format: DD.MM.YYYY
- Time Format: 24h (09:00, 18:30)
- Weekday Start: Montag

**V2**: English (en_US, en_GB)

### Error Handling

- User-Facing Errors: Deutsch, klar, actionable
- Technical Errors: Log to telemetry
- Keine Stack Traces an User
- Recovery Actions anbieten (z.B. "Nochmal versuchen")

## Compatibility

### Mobile OS

**iOS**:
- Minimum: iOS 15.0
- Target: iOS 17.0
- Device: iPhone 8 and newer

**Android**:
- Minimum: Android 9.0 (API 28)
- Target: Android 14.0 (API 34)
- Device: Mid-range and up (4GB+ RAM)

### Calendar Integrations

- iOS: Calendar.framework (iCloud, Google, Outlook)
- Android: CalendarProvider (Google, Outlook)

### Backend

- Database: SQLite (local) or PostgreSQL (server)
- Runtime: Node.js 18+ or Python 3.11+
- AI Service: OpenAI API compatible (GPT-4, Claude)

## Monitoring

### Key Metrics

**Performance**:
- p50, p95, p99 response times
- AI timeout rate
- Offline queue length

**Reliability**:
- Error rate (by type)
- Crash rate
- Sync failures

**Usage**:
- DAU, WAU, MAU
- Notes/User/Day
- Planning confirmations
- Replan trigger rate

**Business**:
- Time to first plan
- Daily Review completion rate
- Retention (D1, D7, D30)

### Alerts

**Critical** (Page on-call):
- Error rate > 5%
- Crash rate > 1%
- API timeout rate > 10%

**Warning** (Slack):
- AI timeout > 5%
- Sync failures > 3%
- Replan > 5/day (per user)

## Legal & Compliance

**GDPR**:
- See `/spec/80_quality/privacy_and_security.md`
- Data Deletion within 30 days
- Data Export on request
- Cookie Consent (Web only)

**App Store Guidelines**:
- iOS: Apple App Store Review Guidelines
- Android: Google Play Developer Policy

## Versioning

**App Versioning**: Semantic Versioning (1.0.0)
- Major: Breaking changes, new features
- Minor: Non-breaking features
- Patch: Bugfixes

**API Versioning**: v1 (MVP)
- v1: Initial release (MVP)
- v2: Calendar Write, Advanced AI (geplant)

**Database Migrations**: Alembic (Python) or Flyway (Java)
- Forward-only migrations
- Rollback tested in staging

## Testing Requirements

**See**: `/spec/80_quality/test_plan.md` für Details

**Coverage Targets**:
- Unit Tests: > 80%
- Integration Tests: Critical paths covered
- E2E Tests: Happy paths + 3 error scenarios
