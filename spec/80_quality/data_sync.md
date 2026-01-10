# Data Persistence & Cloud Sync

## Übersicht

Spezifikation für Datenpersistierung, Cloud-Synchronisation und Offline-Support. Behandelt lokale Caches, Sync-Strategien und Konfliktauflösung.

## 1. Data Storage Layers

### Layer 1: Local Storage (Browser)

**Purpose**: Fast, offline-capable access

**Storage Type**: localStorage + IndexedDB (V2)

**Data**: All user data (inbox, tasks, plans, reviews)

**TTL**: Indefinite (until logout or app uninstall)

**Size**: ~5-10MB per user

```typescript
interface LocalCache {
  version: "1.0";
  userId: string;
  lastSyncedAt: ISO8601;
  data: {
    inboxNotes: InboxNote[];
    tasks: Task[];
    events: Event[];
    ideas: Idea[];
    dayPlans: { [date: string]: DayPlan };
    dailyReviews: { [date: string]: DailyReview };
    settings: UserSettings;
  };
  metadata: {
    deviceId: string;
    lastBackupAt: ISO8601;
    cacheVersion: string;
  };
}
```

### Layer 2: Firebase Realtime Database (Server)

**Purpose**: Source of truth, multi-device sync

**Data Structure**: Firestore (document-based)

**Availability**: 99.95% SLA

**Replication**: Geo-replicated (automatic)

```
firestore/
└── users/{uid}/
    ├── profile
    ├── inbox_notes/{noteId}
    ├── items/{itemId}
    ├── day_plans/{date}
    └── daily_reviews/{date}
```

### Layer 3: Cloud Backup (V2)

**Purpose**: Disaster recovery, long-term archival

**Storage**: Google Cloud Storage or similar

**Frequency**: Daily automatic backups

**User Accessible**: Via settings → "Download Backup"

## 2. Sync Model: Client-First Offline

### Architecture

```
┌─────────────────────────┐
│   App (React)           │
│   • UI State            │
│   • Real-time Listeners │
└────────────┬────────────┘
             │
    ┌────────▼────────┐
    │  Local Storage  │
    │  (Source)       │
    └────────┬────────┘
             │
    ┌────────▼──────────────┐
    │  Sync Queue           │
    │  (pending changes)    │
    └────────┬──────────────┘
             │
    ┌────────▼──────────────┐
    │  Firebase SDK         │
    │  (network layer)      │
    └────────┬──────────────┘
             │
    ┌────────▼──────────────┐
    │  Firestore            │
    │  (Cloud)              │
    └───────────────────────┘
```

### Write Flow

```typescript
async function createTask(task: Task) {
  // 1. Optimistic update (local first)
  const localTask = {
    ...task,
    id: generateId(),
    status: 'pending_sync',
    created_at: new Date()
  };
  
  setLocalTask(localTask);
  
  // 2. Queue for sync
  addToSyncQueue({
    operation: 'create',
    collection: 'tasks',
    data: localTask
  });
  
  // 3. If online, sync immediately
  if (navigator.onLine) {
    await syncQueue();
  }
  
  // 4. Listener updates status when confirmed
}
```

### Read Flow

```typescript
// 1. Load from local storage (fast)
const tasks = loadFromLocalStorage('tasks');

// 2. Set up real-time listener
const unsubscribe = db.collection('users')
  .doc(userId)
  .collection('tasks')
  .onSnapshot((snapshot) => {
    // 3. Merge server updates with local
    const serverTasks = snapshot.docs.map(doc => doc.data());
    const merged = mergeWithConflictResolution(tasks, serverTasks);
    
    // 4. Update both local and state
    saveToLocalStorage('tasks', merged);
    setTasks(merged);
  });
```

## 3. Sync Queue & Pending Changes

### Queue Structure

```typescript
interface SyncQueue {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: 'tasks' | 'notes' | 'reviews' | ...;
  documentId: string;
  data: any;
  timestamp: ISO8601;
  retryCount: number;
  maxRetries: number;
  lastError?: Error;
}
```

### Queue Persistence

```typescript
interface QueuePersistence {
  storage: localStorage;
  key: 'sync_queue_{userId}';
  
  // Save on every change
  function enqueue(change: Change) {
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    queue.push(change);
    localStorage.setItem(key, JSON.stringify(queue));
  }
  
  // Load on app start
  function loadQueue(): Change[] {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  
  // Clear after successful sync
  function dequeue(changeId: string) {
    const queue = loadQueue();
    const filtered = queue.filter(c => c.id !== changeId);
    localStorage.setItem(key, JSON.stringify(filtered));
  }
}
```

### Sync Process

```typescript
async function syncQueue() {
  if (!navigator.onLine) return;
  if (isSyncing) return; // Prevent concurrent syncs
  
  isSyncing = true;
  setSyncStatus('syncing');
  
  const queue = loadQueue();
  
  for (const change of queue) {
    try {
      switch (change.operation) {
        case 'create':
          await db.collection('users').doc(userId)
            .collection(change.collection)
            .doc(change.documentId)
            .set(change.data);
          break;
        case 'update':
          await db.collection('users').doc(userId)
            .collection(change.collection)
            .doc(change.documentId)
            .update(change.data);
          break;
        case 'delete':
          await db.collection('users').doc(userId)
            .collection(change.collection)
            .doc(change.documentId)
            .delete();
          break;
      }
      
      // Success: remove from queue
      dequeue(change.id);
      
    } catch (error) {
      // Retry logic
      change.retryCount++;
      if (change.retryCount < change.maxRetries) {
        // Save back to queue with incremented count
        enqueue(change);
      } else {
        // Max retries exceeded
        showError(`Sync failed for ${change.collection}: ${error.message}`);
        setSyncStatus('error');
        break;
      }
    }
  }
  
  isSyncing = false;
  setSyncStatus('synced');
}
```

## 4. Conflict Resolution

### Last-Write-Wins Strategy

```typescript
interface ConflictResolution {
  strategy: 'lww';
  
  function resolve(local: Item, server: Item): Item {
    const localTimestamp = new Date(local.updated_at).getTime();
    const serverTimestamp = new Date(server.updated_at).getTime();
    
    if (localTimestamp > serverTimestamp) {
      return local; // Local is newer
    } else if (serverTimestamp > localTimestamp) {
      return server; // Server is newer
    } else {
      // Same timestamp: compare IDs (deterministic)
      return local.id > server.id ? local : server;
    }
  }
}
```

### Merge Example

```
Scenario:
  - Phone: edits task at 14:35:22
  - Laptop: edits same task at 14:35:18
  - Both send updates to server
  
Resolution:
  - Server receives both
  - Compares timestamps
  - Keeps Phone version (14:35:22 > 14:35:18)
  - Both clients receive authoritative version
  
Result: No data loss, all edits attempt to sync
```

## 5. Real-Time Listeners

### Listener Setup (React)

```typescript
function useSyncedTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  useEffect(() => {
    // Load local data immediately
    const localTasks = loadFromLocalStorage('tasks') || [];
    setTasks(localTasks);
    setIsLoading(false);
    
    if (!user) return;
    
    // Set up real-time listener
    const unsubscribe = db.collection('users')
      .doc(user.uid)
      .collection('tasks')
      .onSnapshot(
        (snapshot) => {
          const serverTasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Merge with local
          const merged = mergeChanges(localTasks, serverTasks);
          setTasks(merged);
          saveToLocalStorage('tasks', merged);
        },
        (error) => {
          console.error('Listener error:', error);
          setSyncStatus('error');
        }
      );
    
    return () => unsubscribe();
  }, [user]);
  
  return { tasks, isLoading };
}
```

### Listener Detachment

```typescript
function handleLogout() {
  // Unsubscribe all listeners
  if (currentListeners) {
    currentListeners.forEach(unsub => unsub());
    currentListeners.clear();
  }
  
  // Clear local data
  localStorage.clear();
  
  // Clear sync queue
  localStorage.removeItem(`sync_queue_${user.uid}`);
  
  // Sign out
  auth.signOut();
}
```

## 6. Offline Support

### Offline Detection

```typescript
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}
```

### Offline Modes

#### Read-Only Mode (No Pending Changes)

```
User can:
  ✓ View all local data
  ✓ Browse tasks, notes, plans
  ✗ Create new items
  ✗ Edit existing items
```

#### Full Offline Mode (With Queuing)

```
User can:
  ✓ View all local data
  ✓ Create new items (queued)
  ✓ Edit existing items (queued)
  ✓ Delete items (queued)
  
UI shows:
  - "Offline" badge
  - "Syncing..." spinner when reconnecting
  - Pending changes count
```

### Reconnection Flow

```typescript
window.addEventListener('online', async () => {
  setSyncStatus('reconnecting');
  
  // Wait a moment for connection to stabilize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Sync pending changes
  await syncQueue();
  
  // Refresh data from server
  await refreshAllListeners();
  
  setSyncStatus('synced');
});
```

## 7. Data Migration (Local → Cloud)

### First Login After Sign-Up

```typescript
async function migrateLocalToCloud(userId: string) {
  const showMigrationDialog = true;
  
  // Show progress
  console.log('Migrating local data to cloud...');
  
  const localData = {
    inboxNotes: loadFromLocalStorage('inbox_notes') || [],
    tasks: loadFromLocalStorage('tasks') || [],
    events: loadFromLocalStorage('events') || [],
    ideas: loadFromLocalStorage('ideas') || [],
    dayPlans: loadFromLocalStorage('day_plans') || {},
    dailyReviews: loadFromLocalStorage('daily_reviews') || {}
  };
  
  const batch = db.batch();
  let documentCount = 0;
  
  // Migrate inbox notes
  localData.inboxNotes.forEach(note => {
    const docRef = db.collection('users').doc(userId)
      .collection('inbox_notes').doc(note.id);
    batch.set(docRef, {
      ...note,
      migrated_from_local: true,
      migrated_at: serverTimestamp()
    });
    documentCount++;
  });
  
  // Migrate tasks
  localData.tasks.forEach(task => {
    const docRef = db.collection('users').doc(userId)
      .collection('tasks').doc(task.id);
    batch.set(docRef, {
      ...task,
      migrated_from_local: true,
      migrated_at: serverTimestamp()
    });
    documentCount++;
  });
  
  // (Similar for events, ideas, plans, reviews)
  
  // Execute batch
  await batch.commit();
  
  console.log(`Migrated ${documentCount} documents`);
  
  // Clear local data (keep backup in export)
  const backup = exportAllData();
  downloadBackup(backup);
  
  // DON'T clear localStorage here - keep for offline access
  // Just mark as migrated
  localStorage.setItem('data_migrated', 'true');
}
```

## 8. Performance Optimization

### Pagination for Large Collections

```typescript
function usePaginatedTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;
  
  useEffect(() => {
    let query: Query = db.collection('users')
      .doc(userId)
      .collection('tasks')
      .orderBy('updated_at', 'desc')
      .limit(pageSize);
    
    const unsubscribe = query.onSnapshot((snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setTasks(newTasks);
      setHasMore(newTasks.length === pageSize);
    });
    
    return () => unsubscribe();
  }, []);
  
  function loadMore() {
    const lastDoc = tasks[tasks.length - 1];
    const query = db.collection('users')
      .doc(userId)
      .collection('tasks')
      .orderBy('updated_at', 'desc')
      .startAfter(lastDoc)
      .limit(pageSize);
    
    // ... load and append
  }
  
  return { tasks, hasMore, loadMore };
}
```

### Batch Updates

```typescript
async function updateMultipleTasks(taskIds: string[], updates: Partial<Task>) {
  const batch = db.batch();
  
  taskIds.forEach(id => {
    const docRef = db.collection('users').doc(userId)
      .collection('tasks').doc(id);
    batch.update(docRef, {
      ...updates,
      updated_at: serverTimestamp()
    });
  });
  
  await batch.commit();
}
```

## 9. Monitoring & Debugging

### Sync Status UI

```typescript
interface SyncStatus {
  status: 'synced' | 'syncing' | 'error' | 'offline';
  lastSyncedAt?: ISO8601;
  pendingChangesCount?: number;
  errorMessage?: string;
}

// Show in App Header
<SyncStatusIndicator status={syncStatus} />
```

### Logging

```typescript
function logSyncEvent(event: {
  type: 'start' | 'complete' | 'error' | 'queue_added';
  collection: string;
  documentId?: string;
  timestamp: ISO8601;
  details?: any;
}) {
  // Send to Analytics
  analytics.event('sync_event', event);
}
```

## 10. Testing Strategy

### Unit Tests
- [ ] Sync queue operations
- [ ] Conflict resolution logic
- [ ] Data merge functions
- [ ] Timestamp comparisons

### Integration Tests
- [ ] Local storage persistence
- [ ] Firebase read/write
- [ ] Real-time listener updates
- [ ] Batch operations

### E2E Tests
- [ ] Complete offline workflow
- [ ] Reconnection and sync
- [ ] Multi-device sync
- [ ] Data migration

### Performance Tests
- [ ] Initial sync time < 2s
- [ ] Update latency < 500ms
- [ ] Batch update with 100 items < 3s
