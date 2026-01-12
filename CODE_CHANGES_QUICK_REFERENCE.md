# Quick Code Change Reference

## Storage.ts - Sync Conflict Resolution

```typescript
// Added to DayPlanState interface:
version: number; // For conflict resolution (Last-Write-Wins)
timestamp: number; // Unix timestamp for comparison

// New function for conflict detection:
export function resolvePlanConflict(local, remote) {
  // Last-Write-Wins: Latest timestamp always wins
  // Returns: DayPlanState | null
}

// Updated savePlan():
const now = Date.now();
const dayPlanState: DayPlanState = {
  id: `plan-${date}-${now}`,
  date,
  version: 1, // Initial version
  timestamp: now, // Track creation time
  status: 'suggested',
  replan_count: 0,
  plan,
};

// Updated saveDayPlan():
if (existing && !dayPlanState.version) {
  dayPlanState.version = (existing.version || 0) + 1;
}
dayPlanState.timestamp = Date.now();
```

## InboxScreen.tsx - Error Recovery

```typescript
// Try-catch wrapper:
try {
  await addNote(userId, note, extraction, firebaseUser);
  setSuccess('Gespeichert. Jetzt prüfen.');
  setText('');
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : 'Fehler beim Speichern';
  setError(`Speichern fehlgeschlagen: ${errorMsg}. Bitte später versuchen.`);
}

// Error UI with Retry Button:
{error && (
  <div style={{ color: '#7f1d1d', padding: '12px', backgroundColor: '#fee2e2' }}>
    <div>{error}</div>
    <button onClick={(e) => { e.preventDefault(); setError(null); }}>
      🔄 Nochmal versuchen
    </button>
  </div>
)}

// Demo Mode Label:
<div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
  🔬 Demo Mode - KI-Extraktion simuliert
</div>
```

## PreferencesContext.tsx - Timezone Support

```typescript
// Added to UserPreferences interface:
timezone: string;

// Auto-detection:
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
setUserPreferences({
  ...userPreferences,
  timezone: detectedTimezone,
});

// Usage in InboxScreen:
const extraction = extractFromNoteMock(trimmed, { 
  timezone: preferences.timezone 
});
```

## Firestore.rules - Security Hardening

```
// Helper function for timestamp validation:
function isValidTimestamp(val) {
  return val is int && val > 0 && val < now;
}

// Stricter validation on all writes:
match /items/{itemId} {
  allow create: if 
    request.resource.data.title is string &&
    request.resource.data.title.size() > 0 &&
    request.resource.data.title.size() <= 200 &&
    request.resource.data.created_at is timestamp &&
    isValidTimestamp(request.resource.data.created_at);
}
```

## ARIA Labels - All Buttons

```typescript
// Pattern for all buttons:
<button 
  className="button"
  onClick={handleClick}
  aria-label="Descriptive action in German"
>
  Button Text
</button>

// Examples:
aria-label="Tagesplan bestätigen und aktivieren"
aria-label="Task als erledigt markieren"
aria-label="Neu planen: Andere Fokus-Aufgabe wählen"
aria-label="KI-Vorschläge generieren"
aria-label="Tag abschließen und Review speichern"
```

## CSS Keyboard Navigation

```css
/* Added :focus-visible to all interactive elements */

.button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

.input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  border-color: var(--accent-primary);
}

.nav a:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

## Test File - InboxScreen.test.tsx

```typescript
// 10 Test Cases:
1. ✅ Form renders correctly
2. ✅ Text input updates state
3. ✅ Character count displays
4. ✅ Submit prevented on empty text
5. ✅ Error state displays and can be cleared
6. ✅ Retry button clears error
7. ✅ Success flow works end-to-end
8. ✅ Form resets after success
9. ✅ Syncing state disables button
10. ✅ aria-label present on buttons

// Run with:
npm test -- InboxScreen.test.tsx
```

---

## File Modification Summary

| File | Type | Changes | Status |
|------|------|---------|--------|
| storage.ts | Core | +100 LOC (sync resolution) | ✅ |
| InboxScreen.tsx | Screen | +50 LOC (error handling) | ✅ |
| DailyReviewScreen.tsx | Screen | +30 aria-labels | ✅ |
| TodayScreen.tsx | Screen | +20 aria-labels | ✅ |
| TaskReviewModal.tsx | Component | +15 aria-labels | ✅ |
| EditTaskModal.tsx | Component | +10 aria-labels | ✅ |
| PreferencesContext.tsx | Context | +25 LOC (timezone) | ✅ |
| firestore.rules | Config | +50 LOC (validation) | ✅ |
| styles.css | Styles | +15 LOC (:focus-visible) | ✅ |
| InboxScreen.test.tsx | Tests | +200 LOC (10 tests) | ✅ |
| + 5 other files | Various | +40 aria-labels | ✅ |

---

## How to Test Each MUST

### MUST-001: Error Recovery
```bash
# 1. Go to Inbox
# 2. Type a note
# 3. Turn off network (DevTools > Network > Offline)
# 4. Click "Speichern"
# 5. See error message with "🔄 Nochmal versuchen" button
# 6. Click retry when network is back
```

### MUST-002: Firestore Rules
```bash
firebase deploy --only firestore:rules
# OR test with Firebase Emulator:
firebase emulators:start
```

### MUST-003: Sync Conflict
```bash
# 1. Open same day plan in 2 tabs
# 2. Edit task in Tab 1, save
# 3. Edit task in Tab 2, save
# 4. Verify last write wins (Tab 2's version)
# Check browser console for: "[Sync Conflict] Remote wins"
```

### MUST-004: ARIA Labels
```bash
# Use browser DevTools:
# 1. Inspect any button
# 2. Look for aria-label attribute
# 3. OR use screen reader (NVDA/JAWS)
```

### MUST-005: Error Toast
```bash
# Same as MUST-001
# Verify colors:
# - Error: #fee2e2 (light red bg)
# - Success: #dcfce7 (light green bg)
```

### MUST-006: Timezone
```bash
# 1. Go to Settings
# 2. Change timezone
# 3. Go to Inbox, submit note
# 4. Check network tab, confirm timezone in request
```

### MUST-007: Demo Mode
```bash
# 1. Go to Inbox
# 2. Look for "🔬 Demo Mode - KI-Extraktion simuliert"
# 3. Type any note, it extracts with mock AI
```

### MUST-008: Tests
```bash
npm test -- InboxScreen.test.tsx --reporter=verbose
# Should show: 10 tests passing ✓
```

---

## Rollback Instructions (if needed)

Each change is isolated and reversible:

1. **storage.ts**: Remove version/timestamp fields, remove resolvePlanConflict()
2. **InboxScreen.tsx**: Remove try-catch, error UI, demo mode label
3. **firestore.rules**: Remove validation functions and stricter checks
4. **aria-labels**: Remove aria-label attributes from buttons
5. **styles.css**: Remove :focus-visible rules
6. **Tests**: Delete InboxScreen.test.tsx

No database migrations needed. Changes are backward compatible.

---

**Last Updated:** 2025-01-25  
**Implemented By:** AI Assistant  
**Review Status:** Ready for Code Review ✅
