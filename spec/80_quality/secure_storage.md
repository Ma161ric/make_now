# Secure Storage

## 1. Datenklassifizierung und Beispiele

| Kategorie | Sensitivität | Beispiele | MVP Speicherort | V2 Speicherort |
|-----------|--------------|-----------|-----------------|----------------|
| **Öffentlich** | Keine | App-Version, UI-Sprache | localStorage | localStorage + Server |
| **Intern** | Niedrig | User Settings (Arbeitszeiten, Puffer) | localStorage | localStorage + Server |
| **Vertraulich** | Mittel | Task-Titel, Event-Titel, Notizen | localStorage | IndexedDB + Server (verschlüsselt) |
| **Hochsensibel** | Hoch | Gesundheitsdaten (falls User eingibt) | localStorage (Warnung) | Server (E2E optional) |
| **Secrets** | Kritisch | OAuth-Tokens, API-Keys | **NIE im Client** | Backend only |

## 2. MVP-Entscheidung: Web Local-First

### Technologie

**Browser Storage API**: `localStorage` (MVP), später `IndexedDB`

**Begründung**:
- Einfachste Implementation für MVP
- Keine Backend-Infrastruktur nötig
- Schneller Start

### Risiken und Akzeptanz

**R1: Daten unverschlüsselt im Browser**  
- **Risk Level**: Mittel
- **Akzeptanz**: Bewusst akzeptiert für MVP
- **Mitigation**: User-Hinweis im Onboarding, Export-Funktion
- **V2 Lösung**: Optional Client-Side Encryption

**R2: Daten verloren bei Browser-Daten-Löschung**  
- **Risk Level**: Mittel
- **Akzeptanz**: Bewusst akzeptiert für MVP
- **Mitigation**: Export-Funktion, Onboarding-Hinweis "Regelmäßig exportieren"
- **V2 Lösung**: Cloud-Sync (optional)

**R3: Keine Synchronisation zwischen Geräten**  
- **Risk Level**: Niedrig (Feature, kein Security-Risk)
- **Akzeptanz**: MVP Scope-Entscheidung
- **V2 Lösung**: Backend + Sync

## 3. Minimal Controls im MVP

### C1: Export-Funktion

**Zweck**: User kann Backup erstellen

**Format**: JSON (human-readable)

**Umfang**: Alle User-Daten (Tasks, Notes, Events, Ideas, Plans, Settings)

**Dateiname**: `dayflow_export_2026-01-09.json`

**Implementation**:
```typescript
interface ExportData {
  version: "1.0",
  exported_at: string, // ISO8601
  data: {
    inbox_notes: InboxNote[],
    tasks: Task[],
    events: Event[],
    ideas: Idea[],
    day_plans: DayPlan[],
    settings: UserSettings
  }
}

function exportData(): ExportData {
  return {
    version: "1.0",
    exported_at: new Date().toISOString(),
    data: {
      inbox_notes: getAllInboxNotes(),
      tasks: getAllTasks(),
      events: getAllEvents(),
      ideas: getAllIdeas(),
      day_plans: getAllDayPlans(),
      settings: getSettings()
    }
  };
}
```

### C2: Import-Funktion (mit Validation)

**Validation**:
1. JSON-Schema prüfen
2. Version prüfen (nur 1.0 akzeptiert)
3. Texte sanitizen (XSS-Prevention)
4. Daten-Merge oder Replace (User wählt)

**Implementation**:
```typescript
function importData(file: File, mode: "merge" | "replace"): Result {
  const data = JSON.parse(await file.text());
  
  // 1. Schema-Validation
  if (!validateExportSchema(data)) {
    throw new Error("Ungültiges Export-Format");
  }
  
  // 2. Version Check
  if (data.version !== "1.0") {
    throw new Error("Nicht unterstützte Version");
  }
  
  // 3. Sanitize
  const sanitized = sanitizeAll(data.data);
  
  // 4. Merge oder Replace
  if (mode === "replace") {
    clearAllData();
  }
  
  saveAll(sanitized);
  
  return { success: true, imported_count: count(sanitized) };
}
```

### C3: Delete-Funktion (alle Daten löschen)

**Zweck**: User kann alle Daten irreversibel löschen

**UI**: Settings → "Alle Daten löschen" (mit Bestätigungs-Dialog)

**Implementation**:
```typescript
function deleteAllData(): void {
  localStorage.clear();
  // Optional: IndexedDB.deleteDatabase("dayflow") falls IndexedDB genutzt
  window.location.reload(); // Neustart nach Löschung
}
```

### C4: Storage-Version (Migration Support)

**Zweck**: Ermöglicht spätere Schema-Änderungen

**Implementation**:
```typescript
const STORAGE_VERSION = "1.0";

function getStorageVersion(): string {
  return localStorage.getItem("storage_version") || "1.0";
}

function setStorageVersion(version: string): void {
  localStorage.setItem("storage_version", version);
}

function migrateIfNeeded(): void {
  const currentVersion = getStorageVersion();
  
  if (currentVersion === "1.0") {
    // Keine Migration nötig
    return;
  }
  
  // Zukünftige Migrationen hier
  // if (currentVersion < "2.0") { migrate_1_to_2(); }
}
```

## 4. Erweiterungspunkte für später

### 4.1 Wechsel von localStorage zu IndexedDB

**Wann**: Wenn Datenvolumen > 5 MB oder strukturierte Queries nötig

**Vorteile**:
- Größeres Limit (>50 MB)
- Indexierung (schnellere Queries)
- Transaktionen

**Migration**:
```typescript
// Phase 1: Parallel schreiben (beide Storages)
function saveTasks(tasks: Task[]): void {
  localStorage.setItem("tasks", JSON.stringify(tasks)); // Alt
  indexedDB.putAll("tasks", tasks); // Neu
}

// Phase 2: Nur noch IndexedDB
function saveTasks(tasks: Task[]): void {
  indexedDB.putAll("tasks", tasks);
}

// Migration-Script (einmalig)
function migrateToIndexedDB(): void {
  const data = getAllDataFromLocalStorage();
  indexedDB.saveAll(data);
  localStorage.setItem("migrated_to_indexeddb", "true");
}
```

### 4.2 Client-Side Encryption (Optional)

**Wann**: User will sensible Daten lokal verschlüsseln

**Ansatz**: Passphrase-basiert (User wählt Passwort)

**Algorithmus**: AES-256-GCM

**Key Derivation**: PBKDF2 (100.000 Iterations)

**Implementation** (Pseudocode):
```typescript
async function encryptData(plaintext: string, passphrase: string): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt); // PBKDF2
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  
  return base64({ salt, iv, ciphertext });
}

async function decryptData(encrypted: string, passphrase: string): string {
  const { salt, iv, ciphertext } = parseBase64(encrypted);
  const key = await deriveKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(plaintext);
}
```

**Risiken**:
- User vergisst Passphrase → Daten unwiederbringlich verloren
- Performance-Impact (Encryption/Decryption bei jedem Read/Write)

**MVP-Entscheidung**: Nicht implementiert, Erweiterungspunkt offen

### 4.3 Mobile: Keychain (iOS) und Keystore (Android)

**Zweck**: Sichere Speicherung von Tokens

**iOS (Keychain)**:
```swift
let query = [
  kSecClass: kSecClassGenericPassword,
  kSecAttrAccount: "oauth_token",
  kSecValueData: token.data(using: .utf8)!
] as CFDictionary

SecItemAdd(query, nil)
```

**Android (Keystore)**:
```kotlin
val keyStore = KeyStore.getInstance("AndroidKeyStore")
keyStore.load(null)

val secretKey = keyStore.getKey("oauth_token", null)
```

**MVP-Entscheidung**: Web only, Mobile später

### 4.4 Sync-Verschlüsselung (E2E, Optional)

**Wann**: V2, wenn Cloud-Sync eingeführt wird

**Ansatz**:
- User wählt: "Daten verschlüsselt syncen?" (Opt-in)
- Client verschlüsselt vor Upload
- Server sieht nur Ciphertext
- Key bleibt auf Client (z.B. in Keychain/localStorage + Passphrase)

**Trade-Off**:
- ✅ Maximale Privacy
- ❌ Server kann nicht durchsuchen
- ❌ KI-Extraction auf Server nicht möglich (muss lokal)

**MVP-Entscheidung**: Nicht implementiert, Architektur offen lassen

## 5. Storage Adapter Interface

**Zweck**: Austauschbare Storage-Implementierung (localStorage → IndexedDB → Cloud)

**Interface** (TypeScript):
```typescript
interface StorageAdapter {
  // Read
  get<T>(key: string): Promise<T | null>;
  getAll<T>(key: string): Promise<T[]>;
  
  // Write
  set<T>(key: string, value: T): Promise<void>;
  update<T>(key: string, value: Partial<T>): Promise<void>;
  delete(key: string): Promise<void>;
  
  // Batch
  setAll<T>(key: string, values: T[]): Promise<void>;
  deleteAll(key: string): Promise<void>;
  
  // Meta
  clear(): Promise<void>;
  export(): Promise<ExportData>;
  import(data: ExportData, mode: "merge" | "replace"): Promise<void>;
}
```

**Implementierungen**:

**LocalStorageAdapter** (MVP):
```typescript
class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }
  
  // ... weitere Methoden
}
```

**IndexedDBAdapter** (V2):
```typescript
class IndexedDBAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const db = await openDB("dayflow");
    return db.get(key);
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    const db = await openDB("dayflow");
    await db.put(key, value);
  }
  
  // ... weitere Methoden
}
```

**CloudSyncAdapter** (V2):
```typescript
class CloudSyncAdapter implements StorageAdapter {
  constructor(private localAdapter: StorageAdapter) {}
  
  async get<T>(key: string): Promise<T | null> {
    // 1. Try local cache
    const local = await this.localAdapter.get<T>(key);
    if (local) return local;
    
    // 2. Fetch from server
    const remote = await fetch(`/api/data/${key}`);
    const data = await remote.json();
    
    // 3. Cache locally
    await this.localAdapter.set(key, data);
    
    return data;
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    // 1. Save locally (optimistic update)
    await this.localAdapter.set(key, value);
    
    // 2. Sync to server (background)
    await fetch(`/api/data/${key}`, {
      method: "PUT",
      body: JSON.stringify(value)
    });
  }
  
  // ... weitere Methoden mit Conflict-Resolution
}
```

**Usage** (Dependency Injection):
```typescript
// MVP
const storage: StorageAdapter = new LocalStorageAdapter();

// V2 (IndexedDB)
const storage: StorageAdapter = new IndexedDBAdapter();

// V2 (Cloud-Sync)
const storage: StorageAdapter = new CloudSyncAdapter(
  new IndexedDBAdapter()
);

// Business Logic (unverändert)
async function createTask(task: Task): Promise<void> {
  const tasks = await storage.getAll<Task>("tasks");
  tasks.push(task);
  await storage.setAll("tasks", tasks);
}
```

## 6. Akzeptanzkriterien

### AC1: MVP Storage-Verhalten

- [ ] Alle Daten werden in `localStorage` gespeichert
- [ ] Key-Schema: `dayflow:tasks`, `dayflow:notes`, etc.
- [ ] Storage-Version ist `1.0`
- [ ] Export liefert JSON mit allen Daten
- [ ] Import validiert Schema und sanitized Inputs
- [ ] Delete löscht alle Keys mit Präfix `dayflow:`

### AC2: Migrations-Strategie

- [ ] `storage_version` Key existiert
- [ ] `migrateIfNeeded()` wird bei App-Start aufgerufen
- [ ] V2-Migration (localStorage → IndexedDB) ist im Code vorbereitet (als Kommentar/Stub)

### AC3: Delete und Reset

- [ ] Settings → "Alle Daten löschen" ruft `deleteAllData()` auf
- [ ] Bestätigungs-Dialog: "Wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
- [ ] Nach Löschung: `localStorage` ist leer (für DayFlow-Keys)
- [ ] Nach Löschung: App zeigt Onboarding-Screen

### AC4: Export/Import

- [ ] Export-Button erzeugt JSON-Datei
- [ ] JSON ist human-readable (pretty-printed)
- [ ] Import-Button akzeptiert nur `.json`-Dateien
- [ ] Import validiert Schema (ajv oder ähnlich)
- [ ] Import sanitized alle Text-Felder (XSS-Prevention)
- [ ] Import bietet "Merge" oder "Replace"

### AC5: Performance

- [ ] Read/Write < 50ms (p95) für < 1000 Items
- [ ] Export < 2s für < 1000 Items
- [ ] Import < 5s für < 1000 Items

## Verwandte Dokumente

- `/spec/80_quality/threat_model.md` → Risiko R2, R10
- `/spec/80_quality/web_security_baseline.md` → XSS-Prevention bei Import
- `/adr/0003_no_secrets_in_client.md` → Keine Tokens in localStorage (V2)
