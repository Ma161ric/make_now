# User Data Isolation Implementation ✅

## Datum: 2026-01-11

### ✅ ABGESCHLOSSEN - Kern-Implementierung

#### 1. **storage.ts - User-Scoped localStorage** ✅
- ✅ `getStorageKey(userId: string)` - Generiert eindeutige Keys pro User
- ✅ Alle Funktionen haben **userId als erstes Parameter** hinzubekommen:
  - `listNotes(userId, ...)`
  - `addNote(userId, ...)`
  - `getNote(userId, id)`
  - `saveTask(userId, task)`
  - `listTasks(userId, ...)`
  - `getTask(userId, id)`
  - `saveDayPlan(userId, ...)`
  - `getDayPlan(userId, date)`
  - `saveDailyReview(userId, ...)`
  - `getDailyReview(userId, date)`
  - `savePlan(userId, ...)`
  - `getPlan(userId, ...)`

**Struktur:**
```
localStorage Key: "make-now-state-{userId}"
Jeder User hat völlig isolierte Daten
```

---

#### 2. **Alle Screens aktualisiert** ✅
- ✅ **TodayScreen.tsx** - Holt `userId` aus AuthContext, nutzt überall
- ✅ **InboxScreen.tsx** - userId hinzugefügt
- ✅ **ReviewScreen.tsx** - userId hinzugefügt + Auth-Hook importiert
- ✅ **DailyReviewScreen.tsx** - userId hinzugefügt + Auth-Hook importiert

**Pattern pro Screen:**
```tsx
const { user, firebaseUser } = useAuth();
const userId = user?.id || firebaseUser?.uid || '';
// Alle Storage-Aufrufe verwenden userId
```

---

#### 3. **Firestore Security Rules** ✅
- ✅ `users/{userId}` - Nur der User kann seine eigenen Daten sehen
- ✅ Alle Sub-Collections sind user-scoped:
  - `day_plans/` - User kann nur seine eigenen Pläne sehen/bearbeiten
  - `items/` - Tasks sind pro User isoliert (Korrektur: war `tasks/`, ist jetzt `items/`)
  - `inbox_notes/` - Notizen pro User
  - `daily_reviews/` - Reviews pro User

**Sicherheits-Policy:**
```
- isOwner(userId) = isAuthenticated() && request.auth.uid == userId
- Alle Operationen (read/write) erfordern isOwner()
```

---

### ⏳ NÄCHSTE SCHRITTE (In dieser Reihenfolge)

#### 1. **Test-Dateien aktualisieren** (~30 Minuten)
Die folgenden Test-Dateien benötigen userId in allen storage-Aufrufen:

```
- apps/web/src/test/TodayScreen.test.tsx
  ├─ Bereits: testUserId = 'test-user-123' definiert
  ├─ storage.saveTask(testUserId, task) - FIX START
  ├─ storage.saveDayPlan(testUserId, dayPlan)
  ├─ storage.getTask(testUserId, id)
  └─ storage.getDayPlan(testUserId, date)

- apps/web/src/test/TodayScreen.dragdrop.test.tsx
  └─ Gleiche Muster wie oben

- apps/web/src/test/InboxScreen.test.tsx
  └─ storage.addNote(userId, ...) überal

- apps/web/src/test/DailyReviewScreen.test.tsx
  └─ Alle storage-Aufrufe brauchen userId

- apps/web/src/test/storage.test.ts
  └─ Grund-Struktur-Tests aktualisieren
```

**Test-Muster:**
```tsx
describe('...', () => {
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('...', () => {
    storage.saveTask(testUserId, task);  // ← userId erste Parameter
    // ...
  });
});
```

---

#### 2. **Hooks aktualisieren** (falls nötig)
Prüfe diese Dateien auf Storage-Aufrufe:
- `apps/web/src/hooks/useSyncEffect.ts` - Nutzt Storage?
- `apps/web/src/sync/syncLayer.ts` - Nutzt Storage?

Falls ja: userId von Props/Context holen und durchreichen.

---

#### 3. **Firebase Deploy & Firestore Rules deployen**
```bash
# Firestore Rules testen
firebase emulators:start --only firestore

# In Production deployen
firebase deploy --only firestore:rules
```

---

#### 4. **Integration Tests / E2E Tests**
```
✓ User A erstellt Task → Wird in Make-Now angezeigt
✗ User B sieht NICHT User A's Tasks (= KERN TEST)
  └─ localStorage: unterschiedliche Keys
  └─ Firestore: Security Rules verhindern Zugriff

✓ Bei Logout → Daten bleiben in localStorage
✓ Bei neuem Login → Richtige Daten für den User
```

---

#### 5. **Optional: Data Migration für bestehende User**
Wenn das System bereits Daten ohne userId gespeichert hat:

```typescript
// apps/web/src/hooks/useSyncEffect.ts oder neu: migrateStorage.ts
export async function migrateOldStorageToUserScoped(userId: string) {
  const oldKey = 'make-now-state';
  const oldData = localStorage.getItem(oldKey);
  
  if (oldData && !localStorage.getItem(getStorageKey(userId))) {
    // Migriere zu neuem Format
    localStorage.setItem(getStorageKey(userId), oldData);
    localStorage.removeItem(oldKey); // Optional: alte Daten löschen
  }
}

// Aufrufen in AuthContext nach erfolgreichem Login
```

---

### 📋 Implementierungs-Checklist

- [x] storage.ts - userId-Parameter hinzugefügt zu alle Funktionen
- [x] localStorage Keys user-scoped machen
- [x] TodayScreen.tsx - userId holen und nutzen
- [x] InboxScreen.tsx - userId holen und nutzen  
- [x] ReviewScreen.tsx - userId holen und nutzen
- [x] DailyReviewScreen.tsx - userId holen und nutzen
- [ ] **TODO**: Test-Dateien aktualisieren (TodayScreen.test.tsx, etc.)
- [ ] **TODO**: Hooks prüfen (useSyncEffect.ts, syncLayer.ts)
- [ ] **TODO**: Firestore Rules deployen
- [ ] **TODO**: E2E Tests - Multi-User Szenario
- [ ] **TODO**: Optional: Migration für alte Daten

---

### 🎯 Sicherheits-Verifizierung

Nachdem alles implementiert ist:

```bash
# 1. Storage-Keys prüfen (DevTools Console)
localStorage
# Sollte zeigen: make-now-state-{userId} statt make-now-state

# 2. Firestore-Zugriff testen (Firebase Console)
# User A versucht /users/{userId_B}/tasks zu lesen → DENIED ✓

# 3. localStorage-Isolation testen (Chrome DevTools)
# User A logout + User B login → Unterschiedliche Daten ✓
```

---

### 📚 Dateien, die geändert wurden

**Core:**
- ✅ `apps/web/src/storage.ts` (126 Zeilen → +getStorageKey, userId-Parameter)
- ✅ `apps/web/src/screens/TodayScreen.tsx`
- ✅ `apps/web/src/screens/InboxScreen.tsx`
- ✅ `apps/web/src/screens/ReviewScreen.tsx`
- ✅ `apps/web/src/screens/DailyReviewScreen.tsx`
- ✅ `firestore.rules` (Items-Collection korrigiert)

**Tests (noch zu aktualisieren):**
- ⏳ `apps/web/src/test/TodayScreen.test.tsx`
- ⏳ `apps/web/src/test/TodayScreen.dragdrop.test.tsx`
- ⏳ `apps/web/src/test/InboxScreen.test.tsx`
- ⏳ `apps/web/src/test/DailyReviewScreen.test.tsx`
- ⏳ `apps/web/src/test/storage.test.ts`

---

### 💡 Wichtige Notizen

1. **AuthContext - user vs firebaseUser**
   - `user.id` kommt von Custom-User-Objekt
   - `firebaseUser.uid` kommt von Firebase Auth
   - Code nutzt: `user?.id || firebaseUser?.uid || ''`

2. **localStorage vs Firestore**
   - localStorage: Offline First, lokale Isolation
   - Firestore: Backend, Security Rules enforced

3. **Test-Konfiguration**
   - Alle Tests müssen `testUserId` verwenden
   - localStorage wird in `beforeEach()` gelöscht

4. **Fehlermöglichkeiten**
   - Vergessene userId → Runtime-Fehler "Cannot read property of undefined"
   - Falsche Parameter-Reihenfolge → Typen-Fehler
   - Alte Tests ohne userId → FAIL

---

### 🚀 Nächster Terminal-Befehl nach Abschluss

```bash
# Tests laufen lassen
npm run test

# Firestore Rules deployen
firebase deploy --only firestore:rules

# App starten und testen
npm run dev
```

---

**Status: 70% Complete** ✅
- Kern-Datenbank-Isolation: 100% ✅
- Screen-Implementierung: 100% ✅
- Test-Updates: 0% ⏳
- Deployment: 0% ⏳
