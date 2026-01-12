# DayFlow: 2-Wochen Upgrade Plan

**Ziel**: App aus Alpha in Beta nehmen. Kritische Bugs fixen, Fehlerbehandlung + Accessibility basics.

**Baseline**: App funktioniert (MVP). Aber fehlerhafte Error Recovery, schwache Validation, keine A11y.

**Start-Datum**: 13.01.2026  
**End-Datum**: 26.01.2026 (Freitag)  
**Team Estimate**: 1 Senior Eng (60-80h) oder 2 People (40h each)

---

## WOCHE 1: Fehlerbehandlung + Security (Must-Fix)

### Tag 1-2: Error Recovery in Extraction Pipeline

**Tickets**: MUST-001, MUST-005  
**Effort**: 3h  
**Owner**: Frontend  

**Deliverables**:
- ✅ Try-catch in InboxScreen.handleSubmit() (DONE)
- ✅ Error toast with retry button (DONE)
- ✅ Improved error/success message styling (DONE)
- [ ] Test: InboxScreen.test.tsx with error scenarios
- [ ] Manual test: Simulate network failure, verify retry works

**Acceptance Criteria**:
- Extraction fails (network) → User sees error + Retry button
- Retry button → Re-attempt same note
- Note text is preserved (not lost)
- Toast auto-dismisses after 5s OR user clicks close

---

### Tag 2-3: Firestore Rules Hardening

**Tickets**: MUST-002  
**Effort**: 2h  
**Owner**: Backend/Firebase  

**Deliverables**:
- ✅ Add timestamp validation (created_at, updated_at) (DONE)
- ✅ Add strict title/text length validation (DONE)
- ✅ Rate limiting helper (DONE)
- [ ] Deploy to Firebase (test environment first)
- [ ] Run Firestore Emulator tests
- [ ] Verify old data still works (backward compat)

**Acceptance Criteria**:
- Rules enforce created_at is timestamp
- Rules enforce title 1-200 chars
- Rules prevent future-dated timestamps
- Emulator tests pass (100% coverage of rules)
- Rollback plan: Keep old rules as fallback

---

### Tag 3: Race Condition Fix in Sync

**Tickets**: MUST-003  
**Effort**: 2h  
**Owner**: Frontend  

**Deliverables**:
- [ ] Add `version` field to DayPlan, Task models
- [ ] Implement Last-Write-Wins comparison in useDayPlanSync()
- [ ] Log conflicts to console (debug info)
- [ ] Toast notification: "Plan updated from another device"
- [ ] Manual test: Open same plan in 2 tabs, edit both, verify winner

**Acceptance Criteria**:
- Two tabs edit same plan → latest timestamp wins
- User sees notification (non-blocking toast)
- Data is not corrupted
- Console logs conflict event

---

### Tag 4: Timezone Support + Use Preferences

**Tickets**: MUST-006  
**Effort**: 1.5h  
**Owner**: Frontend  

**Deliverables**:
- ✅ Add timezone field to PreferencesContext (DONE)
- ✅ Update InboxScreen to use preferences.timezone (DONE)
- [ ] Add timezone selector in SettingsScreen
  - Use IANA timezone list (preload top 10, searchable)
  - Save to localStorage + Firestore
- [ ] Test: Change timezone, capture note, verify extraction uses correct tz
- [ ] Manual test: Run in PST/EST/UTC, verify times are correct

**Acceptance Criteria**:
- Default timezone = browser locale (fallback: Europe/Berlin)
- User can select timezone in Settings
- Timezone persists across sessions
- Groq API receives correct timezone
- Scheduling respects timezone boundaries

---

## WOCHE 2: Accessibility + Testing (Should-Fix)

### Tag 5-6: ARIA Labels + Focus Management

**Tickets**: MUST-004  
**Effort**: 2h  
**Owner**: Frontend  

**Deliverables**:
- ✅ Add aria-label + title to TodayScreen buttons (DONE)
- [ ] Add aria-label to all interactive elements (20+ places)
  - Buttons: Edit, Review, Delete, Close
  - Form inputs: Note textarea, Status radios, Mood buttons
  - Links: Navigation, Item review links
- [ ] Add :focus-visible CSS styles to buttons + inputs
- [ ] Test with WAVE accessibility scanner (free, online)
- [ ] Manual test: Tab through app, verify logical order

**Acceptance Criteria**:
- All buttons have aria-label or visible text
- All form inputs have associated labels
- :focus-visible outline visible on keyboard navigation
- WAVE scan shows < 5 errors
- Keyboard nav logical (tab order makes sense)

---

### Tag 6-7: Component Tests for Critical Flows

**Tickets**: MUST-008  
**Effort**: 4h  
**Owner**: Frontend/QA  

**Deliverables**:
- ✅ InboxScreen.test.tsx (DONE - 10 tests)
- [ ] TodayScreen.test.tsx (focus task, mini tasks, edit, review)
- [ ] TaskReviewModal.test.tsx (status, mood, reflection)
- [ ] Run tests: `npm test` should show 80%+ coverage for screens
- [ ] Ensure all tests pass locally + in CI

**Acceptance Criteria**:
- InboxScreen: Form validation, success, error, retry
- TodayScreen: Task rendering, edit button, review button, plan B
- TaskReviewModal: Status selection, mood selection, save
- 60%+ screen coverage (lines)
- All tests < 2s (fast feedback)

---

### Tag 7: Groq Integration (Optional / Can defer)

**Tickets**: MUST-007  
**Effort**: 2h (backend) or 30min (if deferring)  
**Owner**: Backend OR Feature Flag  

**Decision Point**: Do we have Groq key ready?

**Option A: Integrate Groq (if ready)**
- [ ] Create /api/extract serverless function (Vercel)
  - Input: { noteText, timezone }
  - Output: ExtractionResponse
  - Error handling: timeout, rate limit, invalid response
- [ ] Update InboxScreen to call /api/extract instead of mock
- [ ] Add GROQ_API_KEY to Vercel environment (secret)
- [ ] Rate limiting: max 10 extractions/hour per user (logged in)
- [ ] Fallback: If Groq fails, show error + retry (don't fall back to mock)
- [ ] Test: Real notes, verify extraction quality

**Option B: Keep Mock + Add Disclaimer (if not ready)**
- [ ] Add banner: "⚠️ Demo Mode: Using simulated AI"
- [ ] Add settings flag: "Enable AI when available"
- [ ] Keep mock code, easy to swap later
- [ ] Document: where to add GROQ_API_KEY

**Acceptance Criteria**:
- Either: Real Groq extracts notes OR Mock with disclaimer
- No silent failures (errors are user-visible)
- Rate limiting prevents abuse
- Tests pass with both mock and real (where applicable)

---

## WOCHE 3: Polish + Documentation (Nice-to-Have)

### OPTIONAL: Add Design Tokens

**Effort**: 2h  
**Deliverables**:
- Extract color, spacing, typography to CSS variables
- Document in DESIGN_SYSTEM.md

### OPTIONAL: E2E Test (Cypress)

**Effort**: 4h  
**Deliverables**:
- Full Capture-Review-Plan flow
- Plan B replan scenario
- Daily Review scenario

### OPTIONAL: Privacy Policy + Terms

**Effort**: 2h  
**Deliverables**:
- Write minimal Privacy Policy (GDPR/CCPA)
- Write Terms of Service
- Link from login screen

---

## DAILY STANDUP TEMPLATE

Each day, answer:
1. **What shipped?** (1-2 sentences)
2. **What blocked?** (0-1 sentences)
3. **What's next?** (1-2 sentences, priority)

Example:
```
Mon 13.01:
✅ Error recovery in InboxScreen (try-catch + retry UI)
🚫 None
→ Tomorrow: Firestore rules + rate limiting

Tue 14.01:
✅ Firestore rules strengthened (timestamps, length validation)
🚫 Emulator tests failed (fixed)
→ Tomorrow: Sync race condition + timezone

...
```

---

## TESTING CHECKLIST (Before Ship)

```markdown
## Unit Tests
- [ ] scheduling.test.ts passes (existing)
- [ ] validation.test.ts passes (existing)
- [ ] InboxScreen.test.tsx passes (new)
- [ ] TodayScreen.test.tsx passes (new)
- [ ] TaskReviewModal.test.tsx passes (new)
- Coverage: 60%+ for /screens, /components

## Integration Tests
- [ ] Firebase rules emulator: all cases pass
- [ ] Firestore CRUD operations work
- [ ] Auth flow (signup, login, logout) works
- [ ] Sync: localStorage ↔ Firestore

## Manual E2E Tests (on staging/preview)
- [ ] Capture note → extract → review → save → plan → confirm (happy path)
- [ ] Capture fails (network) → retry → success
- [ ] Two tabs: edit plan in both → verify winner
- [ ] Timezone: Change to EST, capture, verify scheduling uses EST
- [ ] Accessibility: Tab through all screens, no traps, labels visible
- [ ] Mobile: Test on iOS Safari + Android Chrome (responsive)
- [ ] Dark mode: Light/dark toggle works, persists
- [ ] Logout + login: Data persists

## Performance Checks
- [ ] Lighthouse score: 80+ (speed)
- [ ] Bundle size: < 500KB gzipped (Vite build)
- [ ] LCP < 2.5s (on 4G)
- [ ] No memory leaks (DevTools)

## Security Checks
- [ ] Firestore rules: test with curl (no unauthorized reads)
- [ ] Env vars: GROQ_API_KEY not in bundle (backend only)
- [ ] HTTPS everywhere (production)
- [ ] CSP headers set (if on Vercel)

## Deployment
- [ ] Deploy to staging first (test full flow)
- [ ] Verify Firestore rules deployed
- [ ] Verify env vars set in Vercel
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Monitor error logs (Sentry/Vercel)
```

---

## SUCCESS METRICS (End of 2 Weeks)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Extraction error recovery** | 100% user-visible, 0 silent fails | Manual test + error logs |
| **Security rules** | 100% enforce validation | Emulator tests |
| **A11y baseline** | WAVE < 5 errors | Online scanner |
| **Test coverage** | 60%+ for screens | `npm test --coverage` |
| **Timezone support** | User can select, used in extraction | Manual test |
| **Zero breaking changes** | Existing data still works | Rollback test |

---

## BLOCKERS / RISKS

| Risk | Mitigation |
|------|-----------|
| **Groq API key not ready** | Use mock mode + feature flag, easy to swap |
| **Firestore migration issues** | Test with Emulator, have rollback rules ready |
| **Test flakiness** | Use `vi.useFakeTimers()` for time-dependent tests |
| **Mobile compatibility** | Test on real devices (iPhone + Android) daily |
| **Performance regression** | Monitor bundle size before/after |

---

## LINKS

- Tickets: [GitHub Issues](https://github.com/your-repo/issues?labels=must-fix)
- Staging: https://dayflow-staging.vercel.app
- Production: https://dayflow.app
- Specs: [/spec directory](../spec/00_overview.md)

---

**Final Checklist Before Merge**:
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Builds without warnings (`npm run build`)
- [ ] Staging tested (manual E2E)
- [ ] Code reviewed (at least 1 approval)
- [ ] Changelog updated
- [ ] Release notes drafted (for users)

