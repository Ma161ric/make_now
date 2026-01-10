# Firebase Backend Integration

## Übersicht

DayFlow wechselt von Web Local-First zu Cloud-Sync mit Firebase Realtime Database. Ermöglicht Multi-Device-Synchronisation, User-Management und sichere Persistierung.

## Architektur

```
┌─────────────────────────────────────────┐
│         DayFlow Web/Mobile Apps          │
│  (React, React Native + localStorage)    │
└──────────┬──────────────────────────────┘
           │
           │ Firebase SDK
           │ • Auth
           │ • Realtime DB
           │ • Cloud Storage
           │
┌──────────▼──────────────────────────────┐
│     Firebase Backend (Google Cloud)      │
│  • Authentication (Email, Google, Apple) │
│  • Realtime Database                     │
│  • Security Rules                        │
│  • Cloud Functions (optional)            │
└──────────────────────────────────────────┘
```

## 1. Firebase Authentication

### Supported Methods

#### 1.1 Email/Password
- **Usage**: Primary auth method
- **Flow**: Sign-up → Verify Email → Login
- **Implementation**: Firebase Auth UI
- **Security**: Password hashing via Firebase

#### 1.2 Google Sign-In
- **Usage**: Fast onboarding
- **Flow**: Google OAuth → Firebase Token
- **Implementation**: Firebase Auth + Google Console
- **Scope**: email, profile

#### 1.3 Apple Sign-In
- **Usage**: iOS users
- **Flow**: Apple OAuth → Firebase Token
- **Implementation**: Firebase Auth + Apple Developer
- **Scope**: email, name (optional)

### User Model

```typescript
interface User {
  uid: string;              // Firebase UID
  email: string;
  displayName: string;
  photoURL?: string;
  created_at: ISO8601;
  updated_at: ISO8601;
  lastSyncedAt?: ISO8601;
  preferences: UserPreferences;
}

interface UserPreferences {
  timezone: string;         // Europe/Berlin
  language: string;         // de, en
  theme: 'light' | 'dark';
  notifications_enabled: boolean;
  sync_interval: number;    // minutes, default: 5
}
```

### Sign-Up Flow

```
1. User enters email + password
   ↓
2. Firebase Auth.createUserWithEmailAndPassword()
   ↓
3. Send verification email
   ↓
4. User clicks link, email_verified = true
   ↓
5. Create /users/{uid}/profile document
   ↓
6. Sync existing local data to Firestore (migration)
   ↓
7. Redirect to app
```

### Login Flow

```
1. User enters email + password
   ↓
2. Firebase Auth.signInWithEmailAndPassword()
   ↓
3. Fetch ID token
   ↓
4. Set up real-time listeners on user data
   ↓
5. Sync from server to local storage
```

## 2. Realtime Database Schema

### Firestore Structure

```
firestore/
├── users/
│   └── {uid}/
│       ├── profile
│       │   ├── email: string
│       │   ├── displayName: string
│       │   ├── created_at: timestamp
│       │   └── lastSyncedAt: timestamp
│       │
│       ├── inbox_notes/{noteId}
│       │   ├── raw_text: string
│       │   ├── created_at: timestamp
│       │   ├── status: "unprocessed" | "processing" | "processed"
│       │   └── device_id: string (for conflicts)
│       │
│       ├── items/{itemId}
│       │   ├── type: "task" | "event" | "idea"
│       │   ├── title: string
│       │   ├── status: string
│       │   ├── created_at: timestamp
│       │   ├── updated_at: timestamp
│       │   └── source_note_id: string
│       │
│       ├── day_plans/{date}
│       │   ├── plan: PlanningResponse
│       │   ├── status: "suggested" | "confirmed"
│       │   ├── created_at: timestamp
│       │   └── confirmed_at: timestamp
│       │
│       └── daily_reviews/{date}
│           ├── completed_at: timestamp
│           ├── tasks: {taskId: status}
│           └── reflection: string
```

### Indexes

```
1. users/{uid}/inbox_notes
   - created_at (descending)
   
2. users/{uid}/items
   - type (ascending)
   - updated_at (descending)
   
3. users/{uid}/daily_reviews
   - created_at (descending)
```

## 3. Security Rules

### Authentication Guard

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Only authenticated users can read/write their own data
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      
      // Granular rules for subcollections
      match /{document=**} {
        allow read, write: if request.auth.uid == uid;
      }
    }
    
    // Deny everything else
    match /{document=**} {
      allow read, write: false;
    }
  }
}
```

### Data Validation Rules

```javascript
// Example: inbox_notes must have required fields
match /users/{uid}/inbox_notes/{noteId} {
  allow create: if 
    request.resource.data.size() > 0 &&
    request.resource.data.raw_text is string &&
    request.resource.data.raw_text.size() > 2 &&
    request.resource.data.raw_text.size() <= 2000 &&
    request.resource.data.created_at is timestamp;
    
  allow update: if
    request.resource.data.status is string &&
    (request.resource.data.status in ['unprocessed', 'processing', 'processed']);
}
```

## 4. Sync Strategy

### Client-Side: Offline-First Pattern

```typescript
interface SyncState {
  isOnline: boolean;
  lastSyncedAt: Date;
  pendingChanges: Change[];
  syncInProgress: boolean;
}

interface Change {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  data: any;
  created_at: Date;
}
```

### Sync Process

```
1. On app start
   ├─ Check authentication
   ├─ Load local data from localStorage
   ├─ Connect to Firestore real-time listeners
   ├─ Sync pending changes to server
   └─ Merge server updates to local

2. On every user action (create/update task)
   ├─ Write to local storage (optimistic update)
   ├─ Add to pending changes queue
   ├─ If online: sync immediately
   └─ If offline: queue for later

3. On network reconnect
   ├─ Resume pending changes sync
   ├─ Listen for server updates
   └─ Merge conflicts (Last-Write-Wins)

4. Periodic sync (every 5 min when online)
   ├─ Fetch latest server state
   ├─ Merge changes
   └─ Push local updates
```

### Conflict Resolution

**Strategy**: Last-Write-Wins (LWW) with timestamps

```typescript
interface ConflictResolution {
  strategy: 'lww';
  
  // Local change: Jan 10, 14:35:22
  // Server state: Jan 10, 14:35:18
  // → Local version wins
  
  resolution(local: Item, server: Item): Item {
    return local.updated_at > server.updated_at ? local : server;
  }
}
```

## 5. Data Migration (Local → Cloud)

### One-time Migration on First Login

```typescript
async function migrateLocalDataToCloud(uid: string) {
  const localData = getAllLocalData();
  
  const batch = db.batch();
  
  // Migrate inbox notes
  localData.inbox_notes.forEach(note => {
    const docRef = db.collection('users').doc(uid)
      .collection('inbox_notes').doc(note.id);
    batch.set(docRef, {
      ...note,
      migrated_from_local: true,
      migrated_at: new Date()
    });
  });
  
  // Migrate tasks, events, ideas, plans, reviews
  // (same pattern)
  
  await batch.commit();
  
  // Clear local data (or keep for offline access)
  localStorage.clear();
}
```

## 6. Real-time Listeners

### Setup in React

```typescript
useEffect(() => {
  const unsubscribe = db.collection('users')
    .doc(currentUser.uid)
    .collection('items')
    .orderBy('updated_at', 'desc')
    .onSnapshot((snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Update local state + localStorage
      setItems(items);
      localStorage.setItem('items', JSON.stringify(items));
    });
  
  return () => unsubscribe();
}, [currentUser]);
```

### Detach Listeners on Logout

```typescript
function handleLogout() {
  // Unsubscribe all listeners
  listeners.forEach(unsub => unsub());
  listeners.clear();
  
  // Clear local data
  localStorage.clear();
  
  // Sign out
  auth.signOut();
}
```

## 7. Implementation Timeline

### Phase 1: MVP User Setup (Week 1-2)
- [ ] Firebase project setup
- [ ] Email/password authentication
- [ ] Firestore schema
- [ ] Security rules
- [ ] Local-to-cloud migration

### Phase 2: Real-time Sync (Week 3-4)
- [ ] Real-time listeners
- [ ] Offline-first pattern
- [ ] Conflict resolution
- [ ] Pending changes queue

### Phase 3: Multi-Auth (Week 5)
- [ ] Google Sign-In
- [ ] Apple Sign-In
- [ ] OAuth token refresh

### Phase 4: Advanced Features (V2)
- [ ] Cloud Functions for AI calls
- [ ] File storage (exports, avatars)
- [ ] Backup & restore
- [ ] Data analytics

## 8. Cost Estimates (Firebase Pricing)

### Monthly Baseline (100 users)

| Service | Usage | Cost |
|---------|-------|------|
| Authentication | 100 MAU | Free tier (1000 MAU) |
| Firestore Reads | 10k | $0.06 |
| Firestore Writes | 5k | $0.18 |
| Firestore Storage | 1GB | Free tier (1GB) |
| **Total** | - | **<$1/month** |

### Scaling (10k users)

| Service | Usage | Cost |
|---------|-------|------|
| Authentication | 10k MAU | ~$500 |
| Firestore Reads | 500k | $3 |
| Firestore Writes | 200k | $1.20 |
| Firestore Storage | 10GB | $0.18 |
| **Total** | - | **~$500/month** |

## 9. Development Setup

### Firebase Project Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize Firebase
firebase init

# Select:
# - Firestore
# - Authentication
# - Hosting (optional)
```

### Environment Variables

```bash
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

### Initialize Firebase in App

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ...
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

## 10. Testing Strategy

### Authentication Tests
- [ ] Sign-up with email
- [ ] Email verification
- [ ] Login/logout
- [ ] Session persistence
- [ ] Google/Apple sign-in

### Firestore Tests
- [ ] Create/read/update/delete operations
- [ ] Security rule validation
- [ ] Real-time listener accuracy
- [ ] Offline queueing

### Sync Tests
- [ ] Pending changes persistence
- [ ] Network reconnect handling
- [ ] Conflict resolution
- [ ] Data migration

### Performance Tests
- [ ] Initial sync time
- [ ] Real-time update latency
- [ ] Offline mode responsiveness
- [ ] Storage quota checks
