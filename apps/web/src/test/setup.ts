import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Firebase Auth
vi.mock('../firebase/firebaseConfig', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((callback) => {
      callback(null);
      return vi.fn(); // unsubscribe function
    }),
  },
  getDb: vi.fn(async () => ({})),
  app: {},
}));

// Mock AuthContext
vi.mock('../auth/authContext', () => ({
  useAuth: vi.fn(() => ({
    firebaseUser: { uid: 'test-uid', email: 'test@example.com', displayName: 'Test User' },
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock the FirestoreService entirely - bypass Firebase calls completely
vi.mock('../firebase/firestoreService', () => ({
  FirestoreService: class MockFirestoreService {
    async saveDayPlan() {
      return Promise.resolve();
    }
    async getDayPlan() {
      return Promise.resolve(null);
    }
    async saveTask() {
      return Promise.resolve();
    }
    async getTask() {
      return Promise.resolve(null);
    }
    async saveInboxNote() {
      return Promise.resolve();
    }
    async getInboxNotes() {
      return Promise.resolve([]);
    }
    async saveDailyReview() {
      return Promise.resolve();
    }
    async getDailyReview() {
      return Promise.resolve(null);
    }
    onDayPlanSnapshot() {
      return () => {};
    }
    onTasksSync() {
      return () => {};
    }
    onInboxNotesSnapshot() {
      return () => {};
    }
  },
}));

// Mock firebase/firestore as backup (in case it's imported directly)
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: any, path: string) => ({ path })),
  doc: vi.fn((_ref: any, id?: string) => ({ id })),
  setDoc: vi.fn(async () => undefined),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  updateDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  query: vi.fn((_ref: any) => ({ _ref })),
  where: vi.fn((_field: string) => ({ _field })),
  onSnapshot: vi.fn((_ref: any, callback: Function) => {
    callback({ exists: () => false, data: () => ({}) });
    return vi.fn();
  }),
  Timestamp: {
    now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }),
    fromDate: (date: Date) => ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    }),
  },
}));

// Mock localStorage - define directly on globalThis
const localStorageMock = {
  data: {} as Record<string, string>,
  getItem(key: string) {
    return this.data[key] || null;
  },
  setItem(key: string, value: string) {
    this.data[key] = String(value);
  },
  removeItem(key: string) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  },
  key(index: number) {
    const keys = Object.keys(this.data);
    return keys[index] || null;
  },
  get length() {
    return Object.keys(this.data).length;
  },
};

// @ts-ignore
globalThis.localStorage = localStorageMock;

// Mock window.matchMedia
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
});
