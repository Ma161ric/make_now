# GitHub Issues Template – From Senior Review

Copy-paste these into your GitHub repo as issues for immediate action.

---

## 🔴 CRITICAL ISSUES (Week 1)

### Issue: MUST-001 – Add Error Recovery to Extraction Pipeline
**Title**: Error recovery: Extraction fails silently, note is lost  
**Labels**: bug, critical, error-handling  
**Assignee**: Frontend Lead  
**Effort**: 1h (mostly done, just test + verify)  

**Description**:
Currently, if extraction fails (network error), the user loses the note. There's no error message, no retry option.

**What's been done**:
- ✅ Try-catch added in InboxScreen.tsx
- ✅ Error toast with retry button
- ✅ Improved error message styling

**What's left**:
- [ ] Run manual test: disable network, capture note → see error + retry button
- [ ] Verify retry actually works
- [ ] Test case: Network fails, user clicks retry, succeeds
- [ ] Merge to main

**Acceptance Criteria**:
- User sees error message (red box, clear language)
- "Retry" button is visible
- Retry button clears error, re-attempts save
- Note text is preserved (user doesn't have to retype)

**Related**: InboxScreen.tsx (try-catch patch applied)

---

### Issue: MUST-002 – Strengthen Firestore Security Rules
**Title**: Firestore Rules: Add timestamp & length validation  
**Labels**: security, critical, firestore  
**Assignee**: Backend / Firebase Admin  
**Effort**: 1.5h  

**Description**:
Current rules only check `.size() > 0` for titles. They don't validate timestamps, which could allow data injection. Rules need hardening.

**What's been done**:
- ✅ Added created_at / updated_at timestamp validation
- ✅ Stricter title length (1-200 chars)
- ✅ Rate limiting helper (boilerplate)

**What's left**:
- [ ] Deploy rules to Firebase: `firebase deploy --only firestore:rules`
- [ ] Test with Firestore Emulator (run all rule tests)
- [ ] Verify backward compat (old data still works)
- [ ] Rollback plan ready (keep old rules as fallback)

**Acceptance Criteria**:
- All rules deploy without errors
- Emulator tests pass 100%
- No data loss (old documents still readable)
- Timestamps cannot be faked (only system time allowed)

**Related**: firestore.rules (patch applied)

---

### Issue: MUST-003 – Fix Sync Race Condition (2 Tabs)
**Title**: Race condition: Opening app in 2 tabs causes conflicting writes  
**Labels**: bug, critical, sync  
**Assignee**: Frontend Lead  
**Effort**: 2h  

**Description**:
If user opens the app in 2 browser tabs and edits a DayPlan in both, the writes conflict. Last-Write-Wins is implied but not implemented. This can cause data loss.

**Solution**:
1. Add `version` field to DayPlan & Task models
2. Implement Last-Write-Wins: Compare timestamps, older version loses
3. Log conflicts to console (debug)
4. Show toast: "Plan updated from another device" (non-blocking)

**Manual Test**:
- [ ] Open app in Tab A
- [ ] Open same app in Tab B
- [ ] Edit plan in Tab A, save
- [ ] Edit plan in Tab B, save
- [ ] Verify: Latest timestamp wins, user sees notification

**Acceptance Criteria**:
- No data corruption (plan is valid)
- User sees notification of conflict
- Console logs which version won (for debugging)
- Data is not lost (loser version is kept, just not displayed)

**Related**: useSyncEffect.ts, useDayPlanSync hook

---

### Issue: MUST-004 – Add ARIA Labels & Focus Management
**Title**: Accessibility: No ARIA labels, buttons inaccessible to screenreaders  
**Labels**: a11y, critical, accessibility  
**Assignee**: Frontend / QA  
**Effort**: 2h  

**Description**:
Many buttons use emoji ("✏️", "📝") with no text labels. Screen readers can't tell what they do. Focus indicators missing.

**What's been done**:
- ✅ Added aria-label + title to TodayScreen buttons

**What's left**:
- [ ] Add aria-label to all interactive elements (20+ buttons, inputs)
- [ ] Add :focus-visible CSS styles (2px outline)
- [ ] Test with WAVE accessibility scanner (online, free)
- [ ] Manual test: Tab through screens, verify logical order

**Buttons to fix**:
- [ ] Edit (pencil icon)
- [ ] Delete (X icon)
- [ ] Close (modal)
- [ ] Review (modal)
- [ ] Status buttons (Done, Postpone, Keep-open)
- [ ] Mood buttons (😊 😐 😔)
- [ ] Theme toggle (🌙 ☀️)
- [ ] Menu/Navigation buttons

**Acceptance Criteria**:
- All buttons have aria-label OR visible text
- All form inputs have <label htmlFor="...">
- :focus-visible outline visible on keyboard navigation
- WAVE scan: < 5 errors
- Keyboard Tab order is logical

**Related**: All screens/components with buttons

---

### Issue: MUST-005 – Improve Error Message UX
**Title**: Error messages: Unclear, not prominent, no retry option  
**Labels**: ux, critical, error-handling  
**Assignee**: Frontend  
**Effort**: 30min (mostly done)  

**Description**:
When errors occur, messages are inline text, easy to miss. Should be prominent (toast), with clear language and retry option.

**What's been done**:
- ✅ Error toast with red background & border
- ✅ Retry button in error state
- ✅ Better error message formatting

**What's left**:
- [ ] Test locally: trigger errors, verify styling is good
- [ ] Make sure toast auto-dismisses after 5s
- [ ] Test on mobile: error message readable?

**Acceptance Criteria**:
- Errors are visible (red box, not hidden)
- Error text is clear and actionable
- Retry button works
- Toast dismisses automatically or on user action

**Related**: Toast.tsx component, InboxScreen.tsx

---

### Issue: MUST-006 – Add Timezone to User Settings
**Title**: Timezone hardcoded to Europe/Berlin, breaks for other users  
**Labels**: feature, critical, localization  
**Assignee**: Frontend  
**Effort**: 1.5h  

**Description**:
Currently, timezone is hardcoded to "Europe/Berlin". User in EST timezone captures task "10 AM tomorrow" → system interprets as Berlin time → wrong scheduling.

**What's been done**:
- ✅ Added timezone field to PreferencesContext
- ✅ Auto-detect user's local timezone
- ✅ InboxScreen uses preferences.timezone

**What's left**:
- [ ] Add timezone selector in SettingsScreen
  - IANA timezone list (show top 10, searchable input)
  - Save to localStorage + Firestore
- [ ] Test: Change timezone to PST, capture note "10 AM", verify scheduling
- [ ] Verify Groq API receives correct timezone

**Manual Test**:
1. Open Settings
2. Select timezone: America/Los_Angeles (PST)
3. Go to Inbox, capture: "Meeting at 2 PM tomorrow"
4. Verify: Scheduling uses PST (not Berlin time)
5. Change back to UTC, verify again

**Acceptance Criteria**:
- Default timezone = browser locale (fallback: Europe/Berlin)
- User can select timezone in Settings
- Timezone persists across sessions (localStorage + Firestore)
- Groq API receives correct timezone in extraction call
- Scheduling respects user's timezone boundaries

**Related**: PreferencesContext.tsx (updated), SettingsScreen.tsx (needs timezone selector)

---

### Issue: MUST-007 – Integrate Real Groq AI (or Keep Mock with Disclaimer)
**Title**: Extraction uses mock AI, should use real Groq API  
**Labels**: feature, critical, ai  
**Assignee**: Backend / AI  
**Effort**: 2h (if integrating) OR 30min (if deferring)  

**Description**:
Currently, extraction uses hardcoded `extractFromNoteMock()`. App claims to use AI but doesn't. Need to decide: integrate real Groq or keep mock with disclaimer.

**Option A: Integrate Groq (if ready)**
- [ ] Create `/api/extract` serverless function (Vercel)
- [ ] Frontend calls POST /api/extract (instead of direct Groq)
- [ ] Backend uses GROQ_API_KEY (secret, not exposed)
- [ ] Implement rate limiting (10 extractions/hour per user)
- [ ] Add error handling: timeout, rate limit, invalid response
- [ ] Fallback: If Groq fails, show error + retry (don't fall back to mock)
- [ ] Test with real notes, verify extraction quality

**Option B: Keep Mock (if not ready)**
- [ ] Add disclaimer: "⚠️ Demo Mode: Using simulated AI"
- [ ] Document where to add GROQ_API_KEY later
- [ ] Keep code ready to swap (no rework needed)

**Decision Required**:
Is Groq API key ready? If yes → go with Option A. If no → Option B, implement later.

**Acceptance Criteria**:
- Either: Real Groq extracts notes properly OR Mock with clear disclaimer
- No silent failures (errors are visible)
- Rate limiting prevents abuse
- Tests pass (both mock and real, where applicable)

**Related**: groqService.ts, InboxScreen.tsx (currently uses mock)

---

### Issue: MUST-008 – Add Component Tests for Critical Screens
**Title**: Add React component tests (InboxScreen, TodayScreen, TaskReviewModal)  
**Labels**: testing, critical, test-coverage  
**Assignee**: QA / Frontend  
**Effort**: 4h  

**Description**:
Currently, React components are untested. InboxScreen form submission, error handling, async state updates are all untested. This is a high-risk blind spot.

**What's been done**:
- ✅ InboxScreen.test.tsx created (10 tests)
  - Form validation
  - Error handling + retry
  - Success flow
  - Character count
  - Disabled state while syncing

**What's left**:
- [ ] Run tests: `npm test` → InboxScreen tests should pass
- [ ] Write TodayScreen.test.tsx (15+ tests)
  - Task list rendering
  - Edit button click
  - Review button click
  - Plan B (replan) trigger
  - Drag-and-drop reordering
- [ ] Write TaskReviewModal.test.tsx (10+ tests)
  - Status selection (Done / Postpone / Keep-open)
  - Mood selection
  - Reflection text input
  - Save button
  - Close on Escape key
- [ ] Verify tests run fast (< 2s each)
- [ ] Target: 60%+ coverage for /screens & /components

**Manual Test**:
- [ ] Run: `npm test` → all tests pass
- [ ] Run: `npm test -- --coverage` → see coverage report
- [ ] Fix any failing tests before merge

**Acceptance Criteria**:
- All component tests pass
- InboxScreen: 10 tests pass
- TodayScreen: 15+ tests pass
- TaskReviewModal: 10+ tests pass
- Coverage: 60%+ for screens & components
- Tests run in < 5s total

**Related**: 
- InboxScreen.test.tsx (created, ready to run)
- TodayScreen.tsx (needs tests)
- TaskReviewModal.tsx (needs tests)

---

## 🟠 SHOULD-FIX ISSUES (Week 2)

### Issue: SHOULD-001 – Implement End-to-End Flow Tests
**Title**: E2E: Add Cypress tests for critical user flows  
**Labels**: testing, should-fix, e2e  
**Effort**: 4h  

**Flow Tests**:
1. **Capture-Review-Plan**: User captures note → reviews items → creates plan → confirms
2. **Plan B**: User sees plan → hits "Plan B" button → sees replan dialog → chooses option → gets new plan
3. **Daily Review**: User completes tasks → evening → does review → saves reflection

**Tech**: Cypress (already can be added via npm)

**Acceptance Criteria**:
- All 3 flows pass in CI
- Tests run in < 30s
- No flakiness (runs consistently)

---

### Issue: SHOULD-002 – Add Input Sanitization
**Title**: Security: Add XSS protection (DOMPurify)  
**Labels**: security, should-fix  
**Effort**: 1h  

**Description**:
User-submitted text (notes, task titles) should be sanitized to prevent XSS attacks.

**Solution**:
- Use DOMPurify library
- Sanitize all text inputs before display

---

### Issue: SHOULD-003 – Refactor Storage into Smaller Modules
**Title**: Code quality: Split storage.ts (200+ lines) into smaller files  
**Labels**: refactor, should-fix, code-quality  
**Effort**: 3h  

**Files to create**:
- storageNotes.ts (note CRUD)
- storageTasks.ts (task CRUD)
- storagePlans.ts (plan CRUD)
- storageReviews.ts (review CRUD)

---

### Issue: SHOULD-004 – Add Custom Hooks for State Management
**Title**: DX: Create useTaskManagement(), usePlanManagement() hooks  
**Labels**: refactor, should-fix, dx  
**Effort**: 4h  

**Hooks to create**:
- useTaskManagement() – manage task CRUD
- usePlanManagement() – manage plan CRUD
- useAsync() – reusable async pattern (React Query-like)

---

### Issue: SHOULD-005 – Add Privacy Policy & Terms
**Title**: Legal: Add privacy policy + terms of service  
**Labels**: legal, should-fix  
**Effort**: 2h  

**Deliverables**:
- Privacy Policy (GDPR, CCPA compliant)
- Terms of Service
- Link from login/signup screens

---

## 💚 NICE-TO-HAVE ISSUES (Later)

### Issue: NICE-001 – Create Design System (CSS Tokens)
**Effort**: 2h  
**Scope**: Extract colors, spacing, typography to CSS variables

### Issue: NICE-002 – Add Skeleton Loaders
**Effort**: 2h  
**Scope**: Replace static "Loading..." with skeleton components

### Issue: NICE-003 – Add Error Tracking (Sentry)
**Effort**: 2h  
**Scope**: Monitor production errors

### Issue: NICE-004 – Implement Virtual Scrolling for Lists
**Effort**: 3h  
**Scope**: Handle 1000+ tasks without performance degradation

---

## HOW TO USE THIS

1. Copy each issue into your GitHub repo
2. Assign team members
3. Prioritize by label (critical → should → nice)
4. Link to this review: `docs/REVIEW_SUMMARY.md`
5. Reference code patches: Check modified files
6. Use for sprint planning

---

**Total Effort**: ~20h (Week 1-2)

